import { encodeMp3 } from './encoders/mp3'
import { encodeWebCodecs } from './encoders/webcodecs'
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

  // Compute the project length: end of the last clip, with a tiny tail to
  // avoid clipping a fade-out.
  const lengthSec = clips.reduce((m, c) => Math.max(m, c.startTime + c.duration), 0) + 0.25
  if (lengthSec <= 0.25) {
    throw new Error('No clips to export')
  }
  const lengthFrames = Math.ceil(lengthSec * sampleRate)

  const ctx = new OfflineAudioContext({
    numberOfChannels: 2,
    length: lengthFrames,
    sampleRate,
  })

  // Solo logic mirrors the live engine.
  const anySoloed = tracks.some((t) => t.solo)
  const trackNodes = new Map<string, GainNode>()
  for (const t of tracks) {
    const gain = ctx.createGain()
    gain.gain.value = dbToLinear(t.gainDb)
    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, t.pan))
    const mute = ctx.createGain()
    const effectiveMute = anySoloed ? !t.solo : t.mute
    mute.gain.value = effectiveMute ? 0 : 1
    gain.connect(panner).connect(mute).connect(ctx.destination)
    trackNodes.set(t.id, gain)
  }

  // Decode each clip's asset (cache per asset id) and schedule it.
  const assetCache = new Map<string, AudioBuffer>()
  for (const c of clips) {
    const trackNode = trackNodes.get(c.trackId)
    if (!trackNode) continue
    let buffer = assetCache.get(c.assetId)
    if (!buffer) {
      const blob = await readAudioBlob(c.assetId)
      if (!blob) continue
      const arr = await blob.arrayBuffer()
      buffer = await ctx.decodeAudioData(arr)
      assetCache.set(c.assetId, buffer)
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const clipGain = ctx.createGain()
    clipGain.gain.value = dbToLinear(c.gainDb)
    // Fade in
    if (c.fadeIn > 0) {
      clipGain.gain.setValueAtTime(0, c.startTime)
      clipGain.gain.linearRampToValueAtTime(dbToLinear(c.gainDb), c.startTime + c.fadeIn)
    }
    // Fade out
    if (c.fadeOut > 0) {
      const fadeStart = c.startTime + c.duration - c.fadeOut
      clipGain.gain.setValueAtTime(dbToLinear(c.gainDb), Math.max(0, fadeStart))
      clipGain.gain.linearRampToValueAtTime(0, c.startTime + c.duration)
    }
    source.connect(clipGain).connect(trackNode)
    source.start(c.startTime, c.offset, c.duration)
  }

  // OfflineAudioContext doesn't natively report rendering progress, so we
  // emit two coarse stages: render-start, render-done.
  onProgress?.(0.05, 'render')
  const rendered = await ctx.startRendering()
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
