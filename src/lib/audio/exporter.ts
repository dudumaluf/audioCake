import { computeAutoCrossfades, effectiveFades } from './crossfades'
import { encodeMp3 } from './encoders/mp3'
import { encodeWebCodecs } from './encoders/webcodecs'
import { createSoundTouchNode, registerSoundTouch } from './soundtouch'
import { encodeWav, type WavBitDepth } from './wav-encoder'
import { readAudioBlob } from '@/lib/storage/opfs'
import type { Clip, Track } from '@/lib/types'

export type ExportFormat = 'mp3' | 'aac' | 'wav' | 'opus'

export interface ExportOptions {
  format: ExportFormat
  bitrateKbps?: number
  bitDepth?: WavBitDepth
  sampleRate?: number
  normalize?: boolean
  /** Project BPM. Used to compute tempo-synced delay time. */
  bpm?: number
  /** Delay note value in beats (1=1/4, 0.5=1/8, 1.5=1/8dotted, etc.). */
  delayDivisionBeats?: number
  /** Progress callback called with 0..1. */
  onProgress?: (fraction: number, stage: 'render' | 'encode') => void
}

export interface ExportResult {
  blob: Blob
  mime: string
  extension: string
}

/**
 * Render the project to a mixed AudioBuffer via OfflineAudioContext, then
 * pipe through the chosen encoder.
 *
 * The render graph mirrors the live engine: per-track gain + pan, per-clip
 * fades + gain + buffer slicing (offset / duration). No external effects in
 * Phase 4; Phase 6 adds the per-track FX chain to both live and render.
 */
export async function renderAndExport(
  tracks: Track[],
  clips: Clip[],
  options: ExportOptions,
): Promise<ExportResult> {
  const { normalize, onProgress } = options
  const sampleRate = options.sampleRate ?? 48_000

  // Audio clips only for offline render (MIDI clips don't produce audio
  // unless bounced to audio first — see bounceMidiClip).
  const audioClips = clips.filter((c) => c.kind === 'audio')

  // Compute the project length: end of the last clip, with a tiny tail to
  // avoid clipping a fade-out. Account for clip timeStretch (>1 makes
  // it shorter, <1 makes it longer).
  const lengthSec =
    audioClips.reduce((m, c) => {
      const stretchedDur = c.duration / (c.timeStretch || 1)
      return Math.max(m, c.startTime + stretchedDur)
    }, 0) + 0.25
  if (lengthSec <= 0.25) {
    throw new Error('No clips to export')
  }
  const lengthFrames = Math.ceil(lengthSec * sampleRate)

  // We use Tone in the offline context too so the live engine's effects
  // (EQ, compressor, limiter, reverb/delay returns) can be reused without
  // re-implementing each one in raw Web Audio. setContext swaps Tone's
  // global context to the offline one for the duration of this render.
  const Tone = await import('tone')
  const previousCtx = Tone.getContext()
  const offlineCtx = new OfflineAudioContext({
    numberOfChannels: 2,
    length: lengthFrames,
    sampleRate,
  })
  Tone.setContext(offlineCtx as unknown as Parameters<typeof Tone.setContext>[0])

  // Register SoundTouch in the offline context (no-op if any clip has
  // neutral stretch / pitch; cheap if some do).
  await registerSoundTouch(offlineCtx)
  const ctx: BaseAudioContext = offlineCtx

  // Master chain: limiter feeding directly to offline destination.
  const masterLimiter = new Tone.Limiter(-0.3)
  masterLimiter.toDestination()

  // Global FX returns. Delay time follows the project's BPM + division so
  // the exported mix matches what the user hears live.
  const reverb = new Tone.Reverb({ decay: 2.4, wet: 1 })
  const exportBpm = options.bpm ?? 120
  const exportDelayBeats = options.delayDivisionBeats ?? 1.5
  const delay = new Tone.FeedbackDelay({
    delayTime: (60 / exportBpm) * exportDelayBeats,
    feedback: 0.35,
    wet: 1,
  })
  reverb.connect(masterLimiter)
  delay.connect(masterLimiter)

  // Solo logic mirrors the live engine.
  const anySoloed = tracks.some((t) => t.solo)
  const trackNodes = new Map<string, AudioNode>()
  for (const t of tracks) {
    const channel = new Tone.Channel({
      volume: t.gainDb,
      pan: t.pan,
      mute: anySoloed ? !t.solo : t.mute,
    })
    const eq = new Tone.EQ3({
      low: t.eq?.low ?? 0,
      mid: t.eq?.mid ?? 0,
      high: t.eq?.high ?? 0,
    })
    const compressor = new Tone.Compressor({
      threshold: t.compressor?.thresholdDb ?? -18,
      ratio: t.compressor?.enabled ? (t.compressor.ratio ?? 2) : 1,
      attack: 0.01,
      release: 0.1,
    })
    eq.chain(compressor, channel)
    channel.connect(masterLimiter)

    // Sends.
    const reverbDb = t.reverbSendDb ?? -60
    const delayDb = t.delaySendDb ?? -60
    if (reverbDb > -60) {
      const reverbSend = new Tone.Gain(Math.pow(10, reverbDb / 20))
      channel.connect(reverbSend)
      reverbSend.connect(reverb)
    }
    if (delayDb > -60) {
      const delaySend = new Tone.Gain(Math.pow(10, delayDb / 20))
      channel.connect(delaySend)
      delaySend.connect(delay)
    }

    // Use the EQ's native input as the track-input node so per-clip
    // signal flows through the full chain.
    trackNodes.set(t.id, eq.input as unknown as AudioNode)
  }

  // Auto-crossfade overlapping same-track clips so adjacent audio is
  // joined cleanly instead of stacking through the overlap.
  const auto = computeAutoCrossfades(audioClips)

  // Decode each clip's asset (cache per asset id + reverse flag) and schedule it.
  const assetCache = new Map<string, AudioBuffer>()
  for (const c of audioClips) {
    const trackNode = trackNodes.get(c.trackId)
    if (!trackNode) continue
    const reverse = !!c.reverse
    const cacheKey = reverse ? `${c.assetId}:rev` : c.assetId
    let buffer = assetCache.get(cacheKey)
    if (!buffer) {
      let base = assetCache.get(c.assetId)
      if (!base) {
        const blob = await readAudioBlob(c.assetId)
        if (!blob) continue
        const arr = await blob.arrayBuffer()
        base = await ctx.decodeAudioData(arr)
        assetCache.set(c.assetId, base)
      }
      buffer = reverse ? reverseBuffer(ctx, base) : base
      assetCache.set(cacheKey, buffer)
    }
    const ts = c.timeStretch ?? 1
    const ps = c.pitchSemitones ?? 0
    const stretchedDur = c.duration / ts

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = ts

    const fades = effectiveFades(c, auto)
    const clipGain = ctx.createGain()
    clipGain.gain.value = dbToLinear(c.gainDb)
    if (fades.fadeIn > 0) {
      const fadeIn = Math.min(fades.fadeIn, stretchedDur)
      clipGain.gain.setValueAtTime(0, c.startTime)
      clipGain.gain.linearRampToValueAtTime(dbToLinear(c.gainDb), c.startTime + fadeIn)
    }
    if (fades.fadeOut > 0) {
      const fadeOut = Math.min(fades.fadeOut, stretchedDur)
      const fadeStart = c.startTime + stretchedDur - fadeOut
      clipGain.gain.setValueAtTime(dbToLinear(c.gainDb), Math.max(0, fadeStart))
      clipGain.gain.linearRampToValueAtTime(0, c.startTime + stretchedDur)
    }

    if (ts !== 1 || ps !== 0) {
      const stNode = createSoundTouchNode(ctx, {
        timeStretch: ts,
        pitchSemitones: ps,
      })
      source.connect(stNode as unknown as AudioNode)
      ;(stNode as unknown as AudioNode).connect(clipGain)
    } else {
      source.connect(clipGain)
    }
    clipGain.connect(trackNode)
    source.start(c.startTime, c.offset, c.duration)
  }

  // OfflineAudioContext doesn't natively report rendering progress, so we
  // emit two coarse stages: render-start, render-done.
  onProgress?.(0.05, 'render')
  let rendered: AudioBuffer
  try {
    rendered = await offlineCtx.startRendering()
  } finally {
    // Always restore Tone's main-thread context so subsequent live
    // playback isn't pointing at the disposed offline context.
    Tone.setContext(previousCtx)
  }
  onProgress?.(0.65, 'render')

  // Extract de-interleaved channels for the encoder.
  let channels: Float32Array[] = []
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    channels.push(rendered.getChannelData(c).slice())
  }

  if (normalize) {
    channels = normalizeToPeakDb(channels, -1)
  }

  const encoded = await encode(channels, sampleRate, options, (frac) =>
    onProgress?.(0.65 + frac * 0.35, 'encode'),
  )
  onProgress?.(1, 'encode')

  return encoded
}

async function encode(
  channels: Float32Array[],
  sampleRate: number,
  options: ExportOptions,
  onProgress: (frac: number) => void,
): Promise<ExportResult> {
  switch (options.format) {
    case 'wav': {
      const blob = encodeWav({ channels, sampleRate, bitDepth: options.bitDepth ?? 16 })
      onProgress(1)
      return { blob, mime: 'audio/wav', extension: 'wav' }
    }
    case 'mp3': {
      const blob = await encodeMp3({
        channels,
        sampleRate,
        bitrateKbps: options.bitrateKbps ?? 192,
        onProgress,
      })
      return { blob, mime: 'audio/mpeg', extension: 'mp3' }
    }
    case 'aac':
    case 'opus': {
      const blob = await encodeWebCodecs({
        channels,
        sampleRate,
        codec: options.format,
        bitrateKbps: options.bitrateKbps ?? (options.format === 'aac' ? 192 : 128),
        onProgress,
      })
      return {
        blob,
        mime: options.format === 'aac' ? 'audio/mp4' : 'audio/ogg',
        extension: options.format === 'aac' ? 'm4a' : 'opus',
      }
    }
  }
}

function dbToLinear(db: number): number {
  if (db <= -60) return 0
  return Math.pow(10, db / 20)
}

function reverseBuffer(ctx: BaseAudioContext, src: AudioBuffer): AudioBuffer {
  const out = ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate)
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const inData = src.getChannelData(ch)
    const outData = out.getChannelData(ch)
    for (let i = 0, n = inData.length; i < n; i++) outData[n - 1 - i] = inData[i]!
  }
  return out
}

function normalizeToPeakDb(channels: Float32Array[], targetDb: number): Float32Array[] {
  let peak = 0
  for (const ch of channels)
    for (let i = 0; i < ch.length; i++) {
      const v = Math.abs(ch[i]!)
      if (v > peak) peak = v
    }
  if (peak === 0) return channels
  const target = Math.pow(10, targetDb / 20)
  const gain = target / peak
  return channels.map((ch) => {
    const out = new Float32Array(ch.length)
    for (let i = 0; i < ch.length; i++) out[i] = ch[i]! * gain
    return out
  })
}
