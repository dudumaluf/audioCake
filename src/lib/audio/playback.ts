import * as Tone from 'tone'
import type { SoundTouchNode } from '@soundtouchjs/audio-worklet'
import {
  continueMidiClock,
  startMidiClock,
  stopMidiClock,
  updateMidiClockBpm,
} from '@/lib/midi/engine'
import { scheduleMidiClip, type ScheduledMidiClip } from '@/lib/midi/player'
import { getMidiAsset } from '@/lib/storage/idb'
import { readAudioBlob } from '@/lib/storage/opfs'
import { computeAutoCrossfades, effectiveFades } from './crossfades'
import { applyStretchParams, createSoundTouchNode, registerSoundTouch } from './soundtouch'
import type { Clip, MidiAsset, Track } from '@/lib/types'

/**
 * Multi-track playback engine.
 *
 * Architecture: one master `Tone.Channel` per track (volume + pan + mute),
 * one `Tone.Player` per clip (loaded on-demand from OPFS, cached), all
 * driven by `Tone.getTransport()` for sample-accurate scheduling.
 *
 * The engine is intentionally imperative: `setBpm`, `play`, `stop`, etc.
 * are functions, not React state. The UI reads playhead position via rAF
 * and writes back through `useTransportStore`.
 *
 * Why not just rebuild on every project-store change: rebuilding nodes
 * causes audible clicks. We diff: tracks that already exist update their
 * channel params in place; clips that already loaded keep their player.
 */

interface TrackChannel {
  channel: Tone.Channel
  eq: Tone.EQ3
  compressor: Tone.Compressor
  /** Tone.Gain between compressor and channel. Driven by ramped automation
   *  for click-free mute/solo toggles (instead of `channel.mute = bool`
   *  which jumps the signal to 0 and produces a click). 1 = audible,
   *  0 = effectively muted. */
  muteGain: Tone.Gain
  /** Send to the global reverb return. Tapped from `muteGain` (post-mute)
   *  so toggling mute also silences the wet sends — otherwise muting a
   *  track with reverb would leave the room tail audible. */
  reverbSend: Tone.Gain
  /** Send to the global delay return. Same post-mute tap as reverbSend. */
  delaySend: Tone.Gain
  /** Last applied solo-aware mute decision, used to detect toggles. */
  effectiveMute: boolean
}

interface ClipPlayer {
  player: Tone.Player
  trackId: string
  buffer: AudioBuffer | null
  /** True when the cached `buffer` is the reversed flavour of the source. */
  bufferReversed: boolean
  loadingPromise: Promise<void> | null
  /** Inserted between player and track when stretch / pitch != neutral. */
  stretchNode: SoundTouchNode | null
  /**
   * True if the last `rewireClipRouting` call fell back to Tone.getDestination()
   * because the track-channel didn't exist at that moment. Used to force a
   * re-route on the next applyClips run once the channel materialises.
   */
  routedToFallback?: boolean
}

interface MidiSchedule {
  scheduled: ScheduledMidiClip | null
  trackId: string
}

const trackChannels = new Map<string, TrackChannel>()
const clipPlayers = new Map<string, ClipPlayer>()
const midiSchedules = new Map<string, MidiSchedule>()
const decodeCache = new Map<string, AudioBuffer>()
const midiAssetCache = new Map<string, MidiAsset>()
let masterMeter: Tone.Meter | null = null
let initialized = false
/** Which MIDI port we're sending clock to (the first track that has one). */
let activeClockPortId: string | null = null
let activeBpm = 120

let masterLimiter: Tone.Limiter | null = null
let masterReverb: Tone.Reverb | null = null
let masterDelay: Tone.FeedbackDelay | null = null
let metronomeSynth: Tone.MembraneSynth | null = null
let metronomeEventId: number | null = null
let metronomeEnabled = false

/** Delay note value in beats (1 = 1/4 note, 0.5 = 1/8, 1.5 = 1/8 dotted,
 *  0.25 = 1/16, 2 = 1/2, etc.). Default = 1/8 dotted, a classic delay feel
 *  that swings nicely against quarter-note backbeats. Made user-tunable
 *  via the FX dialog in session 2. */
let delayDivisionBeats = 1.5

function delayTimeForBpm(bpm: number): number {
  return (60 / bpm) * delayDivisionBeats
}

function ensureInit() {
  if (initialized) return
  // Master limiter sits between everything and Tone.Destination so peaks
  // never exceed ~-0.3 dBFS (prevents clipping at the output stage and on
  // export).
  masterLimiter = new Tone.Limiter(-0.3)
  masterMeter = new Tone.Meter({ channelCount: 2, normalRange: true })
  masterLimiter.chain(masterMeter, Tone.getDestination())

  // Global FX returns. Tracks send into these via gain nodes; the returns
  // mix into the master limiter so wet signal still respects the ceiling.
  masterReverb = new Tone.Reverb({ decay: 2.4, wet: 1 })
  masterDelay = new Tone.FeedbackDelay({
    delayTime: delayTimeForBpm(activeBpm),
    feedback: 0.35,
    wet: 1,
  })
  masterReverb.connect(masterLimiter)
  masterDelay.connect(masterLimiter)

  initialized = true
}

/** Master signal node tracks should send to. Routes through the master limiter. */
function masterInput(): Tone.InputNode {
  ensureInit()
  return masterLimiter!
}

/**
 * SoundTouch processor must be registered before any node can be created.
 * Called from `startTransport`; safe to call multiple times.
 */
async function ensureSoundTouchRegistered(): Promise<void> {
  const ctx = Tone.getContext().rawContext as unknown as BaseAudioContext
  await registerSoundTouch(ctx)
}

export function getMasterMeter(): Tone.Meter | null {
  ensureInit()
  return masterMeter
}

export function setBpm(bpm: number): void {
  Tone.getTransport().bpm.value = bpm
  activeBpm = bpm
  if (activeClockPortId) updateMidiClockBpm(activeClockPortId, bpm)
  // Keep the master delay in sync with tempo so repeats stay on the grid
  // when the user changes BPM.
  if (masterDelay) {
    masterDelay.delayTime.rampTo(delayTimeForBpm(bpm), 0.05)
  }
}

/**
 * Update the delay's division (beats per repeat). 1 = 1/4 note,
 * 0.5 = 1/8, 1.5 = 1/8 dotted, 0.25 = 1/16, etc.
 * Wired to the FX dialog in session 2.
 */
export function setDelayDivisionBeats(beats: number): void {
  delayDivisionBeats = Math.max(0.0625, beats) // floor at 1/64 just in case
  if (masterDelay) {
    masterDelay.delayTime.rampTo(delayTimeForBpm(activeBpm), 0.05)
  }
}

/**
 * Apply user-tunable reverb settings. Decay change triggers an IR
 * regeneration (Tone.Reverb re-renders its convolution kernel offline);
 * the call awaits `.generate()` so the new tail is in place before we
 * return. PreDelay + wet ramp without regeneration.
 */
let currentReverbDecaySec = 2.4
export async function setReverbParams(params: {
  decaySec: number
  preDelayMs: number
  wetDb: number
}): Promise<void> {
  ensureInit()
  if (!masterReverb) return
  const wetLinear = params.wetDb <= -60 ? 0 : Math.pow(10, params.wetDb / 20)
  masterReverb.preDelay = params.preDelayMs / 1000
  masterReverb.wet.rampTo(wetLinear, 0.05)
  if (Math.abs(currentReverbDecaySec - params.decaySec) > 0.01) {
    masterReverb.decay = params.decaySec
    currentReverbDecaySec = params.decaySec
    try {
      await masterReverb.generate()
    } catch {
      /* Tone may throw if a previous generate is still pending — safe. */
    }
  }
}

/**
 * Apply user-tunable delay settings. `divisionBeats === -1` means "manual
 * ms" — the engine reads `delayMs` instead of computing from BPM.
 */
export function setDelayParams(params: {
  divisionBeats: number
  delayMs: number
  feedback: number
  wetDb: number
}): void {
  ensureInit()
  if (!masterDelay) return
  const wetLinear = params.wetDb <= -60 ? 0 : Math.pow(10, params.wetDb / 20)
  masterDelay.feedback.rampTo(Math.max(0, Math.min(0.95, params.feedback)), 0.05)
  masterDelay.wet.rampTo(wetLinear, 0.05)
  if (params.divisionBeats > 0) {
    delayDivisionBeats = params.divisionBeats
    masterDelay.delayTime.rampTo(delayTimeForBpm(activeBpm), 0.05)
  } else {
    masterDelay.delayTime.rampTo(Math.max(0.001, params.delayMs / 1000), 0.05)
  }
}

/**
 * Enable or disable the metronome. When enabled, a click sounds on every
 * quarter note during playback (and during the count-in already provided
 * by the recorder hook). The click is routed direct-to-destination so it
 * bypasses the master limiter (and never appears in exports because we
 * only schedule it when the live transport plays).
 */
export function setMetronomeEnabled(enabled: boolean): void {
  ensureInit()
  metronomeEnabled = enabled
  if (!enabled) {
    cancelMetronome()
  } else if (Tone.getTransport().state === 'started') {
    scheduleMetronome()
  }
}

function scheduleMetronome(): void {
  if (!metronomeEnabled) return
  if (!metronomeSynth) {
    metronomeSynth = new Tone.MembraneSynth({
      pitchDecay: 0.01,
      octaves: 4,
      volume: -10,
    }).toDestination()
  }
  cancelMetronome()
  const transport = Tone.getTransport()
  metronomeEventId = transport.scheduleRepeat((time) => {
    metronomeSynth?.triggerAttackRelease('C5', '32n', time)
  }, '4n')
}

function cancelMetronome(): void {
  if (metronomeEventId != null) {
    Tone.getTransport().clear(metronomeEventId)
    metronomeEventId = null
  }
}

/**
 * Reconcile the track list with our active channels: create channels for new
 * tracks, update params on existing ones, dispose dropped ones. Solo logic
 * is applied here too (any solo'd track mutes all non-solo'd tracks).
 */
export function applyTracks(tracks: Track[]): void {
  ensureInit()
  const liveIds = new Set(tracks.map((t) => t.id))
  const anySoloed = tracks.some((t) => t.solo)

  const ctx = Tone.getContext()
  const MUTE_RAMP_SEC = 0.01

  for (const t of tracks) {
    let entry = trackChannels.get(t.id)
    if (!entry) {
      const channel = new Tone.Channel({
        volume: t.gainDb,
        pan: t.pan,
        // We never use `channel.mute` directly — it produces a click on
        // toggle. The `muteGain` below handles mute via a ramped Tone.Gain.
        mute: false,
      })
      const eq = new Tone.EQ3({ low: 0, mid: 0, high: 0 })
      const compressor = new Tone.Compressor({
        threshold: -18,
        ratio: 2,
        attack: 0.01,
        release: 0.1,
      })
      // Pre-channel mute gain so toggling silences sends + dry signal in one
      // place; starts at full audible (1) — apply the actual target below.
      const muteGain = new Tone.Gain(t.mute ? 0 : 1)
      // Per-track signal flow:
      //   incoming → EQ → Compressor → muteGain → Channel (gain/pan) → master limiter
      //                                       ↘︎ reverbSend → masterReverb → limiter
      //                                       ↘︎ delaySend  → masterDelay  → limiter
      // Sends tap post-mute so toggling mute silences them too.
      eq.chain(compressor, muteGain, channel)
      channel.connect(masterInput())

      const reverbSend = new Tone.Gain(0)
      const delaySend = new Tone.Gain(0)
      muteGain.connect(reverbSend)
      muteGain.connect(delaySend)
      if (masterReverb) reverbSend.connect(masterReverb)
      if (masterDelay) delaySend.connect(masterDelay)

      entry = {
        channel,
        eq,
        compressor,
        muteGain,
        reverbSend,
        delaySend,
        effectiveMute: t.mute,
      }
      trackChannels.set(t.id, entry)
    }
    entry.channel.volume.value = t.gainDb
    entry.channel.pan.value = t.pan
    const effectiveMute = anySoloed ? !t.solo : t.mute
    if (effectiveMute !== entry.effectiveMute) {
      // Toggled: ramp the muteGain to the target instead of jumping.
      const target = effectiveMute ? 0 : 1
      const now = ctx.currentTime
      const gainParam = entry.muteGain.gain
      gainParam.cancelScheduledValues(now)
      gainParam.setValueAtTime(gainParam.value, now)
      gainParam.linearRampToValueAtTime(target, now + MUTE_RAMP_SEC)
    }
    entry.effectiveMute = effectiveMute

    // Apply EQ / compressor settings if specified; otherwise leave defaults
    // (flat EQ, gentle compressor that does ~nothing at threshold -18).
    if (t.eq) {
      entry.eq.low.value = t.eq.low
      entry.eq.mid.value = t.eq.mid
      entry.eq.high.value = t.eq.high
    }
    if (t.compressor) {
      entry.compressor.threshold.value = t.compressor.thresholdDb
      entry.compressor.ratio.value = t.compressor.enabled ? t.compressor.ratio : 1
    }

    // Sends: -60 dB or lower = off (0 linear); above maps to linear gain.
    const reverbDb = t.reverbSendDb ?? -60
    const delayDb = t.delaySendDb ?? -60
    entry.reverbSend.gain.value = reverbDb <= -60 ? 0 : Math.pow(10, reverbDb / 20)
    entry.delaySend.gain.value = delayDb <= -60 ? 0 : Math.pow(10, delayDb / 20)
  }

  for (const [id, entry] of trackChannels) {
    if (!liveIds.has(id)) {
      try {
        entry.channel.disconnect()
        entry.eq.disconnect()
        entry.compressor.disconnect()
        entry.muteGain.disconnect()
        entry.reverbSend.disconnect()
        entry.delaySend.disconnect()
      } catch {
        /* */
      }
      entry.channel.dispose()
      entry.eq.dispose()
      entry.compressor.dispose()
      entry.muteGain.dispose()
      entry.reverbSend.dispose()
      entry.delaySend.dispose()
      trackChannels.delete(id)
    }
  }
}

/**
 * Reconcile the clip list with our active players / midi schedules.
 *
 * Audio clips get a `Tone.Player`; MIDI clips just get tracked here so we
 * know which ones to schedule on the next `startTransport`. Both kinds
 * are routed through the track-channel map (MIDI ignores the channel for
 * audio output but uses the track's `midiOut*` for routing).
 */
export function applyClips(clips: Clip[]): void {
  ensureInit()
  const liveAudioIds = new Set(clips.filter((c) => c.kind === 'audio').map((c) => c.id))
  const liveMidiIds = new Set(clips.filter((c) => c.kind === 'midi').map((c) => c.id))
  const auto = computeAutoCrossfades(clips)

  for (const c of clips) {
    if (c.kind === 'midi') {
      if (!midiSchedules.has(c.id)) {
        midiSchedules.set(c.id, { scheduled: null, trackId: c.trackId })
      } else {
        midiSchedules.get(c.id)!.trackId = c.trackId
      }
      continue
    }
    let entry = clipPlayers.get(c.id)
    if (!entry) {
      const player = new Tone.Player({
        autostart: false,
        fadeIn: c.fadeIn,
        fadeOut: c.fadeOut,
        volume: c.gainDb,
      })
      entry = {
        player,
        // mark as unassigned so rewireClipRouting (called below) does the connect.
        trackId: '__unassigned__',
        buffer: null,
        bufferReversed: false,
        loadingPromise: null,
        stretchNode: null,
      }
      clipPlayers.set(c.id, entry)
    }
    const fades = effectiveFades(c, auto)
    entry.player.fadeIn = fades.fadeIn
    entry.player.fadeOut = fades.fadeOut
    entry.player.volume.value = c.gainDb

    // Match the player's playbackRate to the requested stretch so the
    // SoundTouch node (when present) compensates pitch to keep it stable.
    const ts = c.timeStretch ?? 1
    const ps = c.pitchSemitones ?? 0
    entry.player.playbackRate = ts

    // Reverse change forces a buffer re-load on next preload.
    const wantsReverse = !!c.reverse
    if (entry.buffer && entry.bufferReversed !== wantsReverse) {
      entry.buffer = null
      entry.loadingPromise = null
    }

    rewireClipRouting(entry, c.trackId, ts !== 1 || ps !== 0, { ts, ps })
  }

  for (const [id, entry] of clipPlayers) {
    if (!liveAudioIds.has(id)) {
      try {
        entry.player.disconnect()
      } catch {
        /* */
      }
      entry.player.dispose()
      clipPlayers.delete(id)
    }
  }
  for (const [id, entry] of midiSchedules) {
    if (!liveMidiIds.has(id)) {
      entry.scheduled?.cancel()
      midiSchedules.delete(id)
    }
  }
}

/**
 * (Re)connect a clip player into its track. When stretch/pitch is non-neutral,
 * insert a SoundTouchNode between the player and the track channel; otherwise
 * connect the player directly. Idempotent and routing-change safe.
 */
function rewireClipRouting(
  entry: ClipPlayer,
  trackId: string,
  needsStretch: boolean,
  params: { ts: number; ps: number },
): void {
  const movedTrack = entry.trackId !== trackId
  const hadStretch = !!entry.stretchNode
  // Also re-route if last time we routed there was no matching track-channel
  // (we fell through to Tone.getDestination()) and now one exists. This
  // handles the bootstrap race where applyClips can run before applyTracks
  // has created the channels for a freshly-loaded project — without this
  // re-check, clips would stay wired direct to the master and the per-track
  // mute/solo/gain/pan would silently do nothing.
  const trackChannel = trackChannels.get(trackId)
  const wasRoutedToMasterFallback = entry.routedToFallback === true
  const channelNowAvailable = !!trackChannel
  const needsRerouteForChannel = wasRoutedToMasterFallback && channelNowAvailable
  if (!movedTrack && hadStretch === needsStretch && !needsRerouteForChannel) {
    if (entry.stretchNode)
      applyStretchParams(entry.stretchNode, { timeStretch: params.ts, pitchSemitones: params.ps })
    return
  }

  try {
    entry.player.disconnect()
  } catch {
    /* */
  }
  if (entry.stretchNode) {
    try {
      entry.stretchNode.disconnect()
    } catch {
      /* */
    }
    entry.stretchNode = null
  }

  // Route into the track's EQ (start of the per-track chain), not directly
  // to the channel — otherwise we bypass EQ + compressor.
  const target = (trackChannel?.eq ?? Tone.getDestination()) as Tone.InputNode
  entry.routedToFallback = !trackChannel

  if (needsStretch) {
    try {
      const ctx = Tone.getContext().rawContext as unknown as BaseAudioContext
      const stNode = createSoundTouchNode(ctx, {
        timeStretch: params.ts,
        pitchSemitones: params.ps,
      })
      // Bridge native AudioNode → Tone graph via a Tone.Gain (acts as a typed
      // pass-through that we can `.connect(target)` on the Tone side).
      const bridge = new Tone.Gain(1)
      entry.player.connect(stNode as unknown as Tone.InputNode)
      stNode.connect(bridge.input as unknown as AudioNode)
      bridge.connect(target)
      entry.stretchNode = stNode
    } catch (e) {
      console.warn('SoundTouch wiring failed (falling back to direct):', e)
      entry.player.connect(target)
    }
  } else {
    entry.player.connect(target)
  }
  entry.trackId = trackId
}

/**
 * Load the audio for a clip's asset if we haven't already.
 *
 * If `reverse` is true we lazily build a reversed copy in a separate cache
 * keyed by `${assetId}:rev` so a clip toggling reverse on/off doesn't
 * thrash the original decode cache.
 */
async function ensureClipBuffer(
  clipId: string,
  assetId: string,
  reverse: boolean,
): Promise<AudioBuffer> {
  const entry = clipPlayers.get(clipId)
  if (!entry) throw new Error(`No player for clip ${clipId}`)
  const cacheKey = reverse ? `${assetId}:rev` : assetId
  let buffer = decodeCache.get(cacheKey)
  if (!buffer) {
    let base = decodeCache.get(assetId)
    if (!base) {
      const blob = await readAudioBlob(assetId)
      if (!blob) throw new Error(`Audio blob missing for asset ${assetId}`)
      const arr = await blob.arrayBuffer()
      base = await Tone.getContext().decodeAudioData(arr)
      decodeCache.set(assetId, base)
    }
    buffer = reverse ? buildReversedBuffer(base) : base
    decodeCache.set(cacheKey, buffer)
  }
  if (entry.buffer !== buffer) {
    entry.player.buffer = new Tone.ToneAudioBuffer(buffer)
    entry.buffer = buffer
    entry.bufferReversed = reverse
  }
  return buffer
}

function buildReversedBuffer(src: AudioBuffer): AudioBuffer {
  const ctx = Tone.getContext().rawContext as unknown as BaseAudioContext
  const out = ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate)
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const inData = src.getChannelData(ch)
    const outData = out.getChannelData(ch)
    for (let i = 0, n = inData.length; i < n; i++) outData[n - 1 - i] = inData[i]!
  }
  return out
}

/**
 * Filter take-folder siblings down to the active take. A clip with no
 * `takeGroupId` is always kept; clips with a group are kept only when
 * `isActiveTake !== false` (treat absent flag as active for back-compat).
 *
 * Used by every code path that decides what actually plays — preload,
 * schedule, audition — so non-active takes are loaded/scheduled by
 * applyClips (so their UI bookkeeping exists) but never sound.
 */
function audibleClips(clips: Clip[]): Clip[] {
  return clips.filter((c) => {
    if (!c.takeGroupId) return true
    return c.isActiveTake !== false
  })
}

/**
 * Preload all audio clip buffers + MIDI assets. Called once at start-of-
 * playback so the scheduler has everything ready and there's no audible gap.
 */
export async function preloadClips(clips: Clip[]): Promise<void> {
  await Promise.all(
    clips.map(async (c) => {
      if (c.kind === 'audio') {
        const entry = clipPlayers.get(c.id)
        if (!entry) return
        if (!entry.loadingPromise) {
          entry.loadingPromise = ensureClipBuffer(c.id, c.assetId, !!c.reverse)
            .then(() => undefined)
            .catch((e) => {
              console.error('Clip preload failed', c.id, e)
            })
        }
        await entry.loadingPromise
      } else {
        if (!midiAssetCache.has(c.assetId)) {
          const asset = await getMidiAsset(c.assetId)
          if (asset) midiAssetCache.set(c.assetId, asset)
        }
      }
    }),
  )
}

/**
 * Schedule playback of all clips starting at the current transport time.
 * Cancels any prior scheduling first so re-calling is idempotent.
 *
 * Needs the `tracks` so MIDI clips know which port + channel to send to.
 */
/**
 * (Re)schedule every clip onto Tone.Transport.
 *
 * Behaviour modes:
 *   - No loop active: each clip gets one transport.schedule() at its
 *     startTime; a clip the playhead is currently inside is also started
 *     immediately with a partial offset.
 *   - Loop active: clips that overlap the loop region are scheduled with
 *     transport.scheduleRepeat() at the loop length so they re-trigger
 *     on every iteration. We also schedule a stop at loop-end so a clip
 *     that extends past loop-end doesn't keep ringing across the seam.
 *
 * `tracks` is needed so MIDI clips can resolve their output port + channel.
 */
export function scheduleClips(clips: Clip[], tracks: Track[]): void {
  const transport = Tone.getTransport()
  transport.cancel(0)
  const tracksById = new Map(tracks.map((t) => [t.id, t]))
  const transportSec = transport.seconds
  const lookahead = Tone.getContext().lookAhead

  // Take folders: only the active take should sound.
  clips = audibleClips(clips)

  const looping = transport.loop
  const loopStart = looping ? Number(transport.loopStart) : 0
  const loopEnd = looping ? Number(transport.loopEnd) : Infinity
  const loopLen = looping ? loopEnd - loopStart : 0

  for (const c of clips) {
    if (c.kind === 'audio') {
      const entry = clipPlayers.get(c.id)
      if (!entry?.buffer) continue

      const ts = c.timeStretch ?? 1
      const stretchedDur = c.duration / ts
      const clipStart = c.startTime
      const clipEnd = c.startTime + stretchedDur

      if (looping && loopLen > 0) {
        // Skip clips that don't overlap the loop window at all.
        if (clipEnd <= loopStart || clipStart >= loopEnd) continue

        // For each loop iteration, start the player at the clip's
        // offset into the loop. If the clip starts before the loop, we
        // jump into the middle of the source.
        const effectiveClipStart = Math.max(clipStart, loopStart)
        const offsetIntoLoop = effectiveClipStart - loopStart
        const playedAtLoopBoundary = (effectiveClipStart - clipStart) * ts
        const sourceOffset = c.offset + playedAtLoopBoundary
        const cappedEnd = Math.min(clipEnd, loopEnd)
        const playDuration = (cappedEnd - effectiveClipStart) * ts

        if (playDuration > 0.001) {
          // Fire on every iteration via scheduleRepeat. The interval is the
          // loop length; the start time within the iteration is the clip's
          // offset from loop start. Tone.Player.start() internally cancels
          // any in-flight source for this player and ramps the envelope
          // cleanly from `time` — no manual stop() call required, which
          // avoids the stop-followed-by-start race that caused the
          // late / quiet start on some loop iterations.
          transport.scheduleRepeat(
            (time) => {
              try {
                entry.player.start(time, sourceOffset, playDuration)
              } catch {
                /* race against a concurrent disposal — safe to ignore */
              }
            },
            loopLen,
            offsetIntoLoop,
          )
        }

        // If the playhead is already inside this clip when scheduling,
        // start it immediately for the remainder of this iteration.
        if (transportSec > clipStart && transportSec < cappedEnd && transportSec < loopEnd) {
          const playedAlready = (transportSec - clipStart) * ts
          const remaining = Math.min(
            playDuration - (transportSec - effectiveClipStart) * ts,
            (cappedEnd - transportSec) * ts,
          )
          if (remaining > 0.001) {
            entry.player.start(`+${lookahead}`, c.offset + playedAlready, remaining)
          }
        }
        continue
      }

      // ---- Non-looping path ----
      if (transportSec >= clipEnd) continue

      if (transportSec > clipStart && transportSec < clipEnd) {
        // Playhead inside clip — start immediately with a partial offset.
        const playedAlready = (transportSec - clipStart) * ts
        const remaining = c.duration - playedAlready
        if (remaining > 0.001) {
          entry.player.start(`+${lookahead}`, c.offset + playedAlready, remaining)
        }
      } else {
        // Future start — schedule normally.
        transport.schedule((time) => {
          try {
            entry.player.start(time, c.offset, c.duration)
          } catch {
            /* */
          }
        }, clipStart)
      }
    } else {
      const sched = midiSchedules.get(c.id)
      const asset = midiAssetCache.get(c.assetId)
      const track = tracksById.get(c.trackId)
      sched?.scheduled?.cancel()
      if (!sched || !asset || !track?.midiOutPortId) {
        if (sched) sched.scheduled = null
        continue
      }
      sched.scheduled = scheduleMidiClip(c, asset, track.midiOutPortId, track.midiOutChannel ?? 0)
    }
  }

  // No global "stop everything at loop end" scheduler — each clip's
  // start(time, offset, duration) call already constrains the player to
  // its slice, and Tone.Player.start() internally cancels any prior
  // source for that player when re-triggered. The previous global stop
  // raced with the per-clip restart and produced the late / quiet start
  // we used to see on the loop boundary.
}

/**
 * Re-run scheduling using the current transport state. Used by the React
 * bridge when the loop region or loop-enabled flag changes while playing,
 * so the next iteration honours the new bounds.
 */
export function rescheduleNow(clips: Clip[], tracks: Track[]): void {
  scheduleClips(clips, tracks)
}

/**
 * One-shot "audition" of whatever audio sits at a given timeline position.
 *
 * Plays ~250 ms of every audio clip that overlaps the position, with the
 * correct source offset. Used by the ruler so clicking around the
 * arrangement gives instant aural feedback (no need to start the
 * transport). Skipped if the transport is already running.
 */
const AUDITION_SEC = 0.25
/** Short fade applied to every audition snippet so starting / re-triggering
 *  mid-waveform doesn't produce a DC click. 5 ms in, 15 ms out is
 *  inaudible musically but kills the click completely. */
const AUDITION_FADE_IN = 0.005
const AUDITION_FADE_OUT = 0.015

interface AuditionState {
  player: Tone.Player
  /** Original fade values on the player so we can restore them after the
   *  snippet completes — otherwise the next real-transport playback would
   *  inherit the tiny audition fades. */
  originalFadeIn: number
  originalFadeOut: number
  /** Timer that restores the original fades + clears this entry. */
  restoreTimer: number
}
const auditionState = new Map<string, AuditionState>()

function stopAndRestoreAudition(entry: AuditionState): void {
  try {
    if (entry.player.state === 'started') entry.player.stop()
  } catch {
    /* race against natural end — safe to ignore */
  }
  entry.player.fadeIn = entry.originalFadeIn
  entry.player.fadeOut = entry.originalFadeOut
  if (entry.restoreTimer) window.clearTimeout(entry.restoreTimer)
}

export async function auditionAt(clips: Clip[], timeSec: number): Promise<void> {
  ensureInit()
  await Tone.start()
  await ensureSoundTouchRegistered()
  if (Tone.getTransport().state === 'started') return

  // Make sure relevant clip buffers are loaded. Inactive take-folder
  // siblings shouldn't audition either; the user only hears what's
  // currently the "live" take when scrubbing.
  const relevant = audibleClips(clips).filter((c) => {
    if (c.kind !== 'audio') return false
    const ts = c.timeStretch ?? 1
    const stretchedDur = c.duration / ts
    return timeSec >= c.startTime && timeSec < c.startTime + stretchedDur
  })
  if (relevant.length === 0) return

  await preloadClips(relevant)

  // Stop any in-flight audition first so quick scrub steps don't pile up.
  // Restoring fades is important here — if a previous audition was still
  // active, killing it without restoring would leave the player with the
  // micro fade values and the next real playback would sound truncated.
  for (const entry of auditionState.values()) {
    stopAndRestoreAudition(entry)
  }
  auditionState.clear()

  const ctx = Tone.getContext()
  const now = ctx.currentTime + ctx.lookAhead
  for (const c of relevant) {
    const entry = clipPlayers.get(c.id)
    if (!entry?.buffer) continue
    const ts = c.timeStretch ?? 1
    const playedAlready = (timeSec - c.startTime) * ts
    const sourceOffset = c.offset + playedAlready
    const dur = Math.min(AUDITION_SEC, c.duration - playedAlready)
    if (dur <= 0.01) continue

    // Save the clip's real fade values so we can restore them after the
    // snippet finishes.
    const originalFadeIn = entry.player.fadeIn as number
    const originalFadeOut = entry.player.fadeOut as number
    entry.player.fadeIn = AUDITION_FADE_IN
    entry.player.fadeOut = AUDITION_FADE_OUT
    try {
      entry.player.start(now, sourceOffset, dur)
      const restoreTimer = window.setTimeout(
        () => {
          entry.player.fadeIn = originalFadeIn
          entry.player.fadeOut = originalFadeOut
          auditionState.delete(c.id)
        },
        // Give the fade-out room to complete before we restore.
        Math.ceil((dur + AUDITION_FADE_OUT + 0.05) * 1000),
      )
      auditionState.set(c.id, {
        player: entry.player,
        originalFadeIn,
        originalFadeOut,
        restoreTimer,
      })
    } catch {
      // Restore immediately if the start call threw.
      entry.player.fadeIn = originalFadeIn
      entry.player.fadeOut = originalFadeOut
    }
  }
}

/** Begin transport playback at the given offset (default: current position). */
export async function startTransport(
  clips: Clip[],
  tracks: Track[],
  fromSec?: number,
): Promise<void> {
  ensureInit()
  await Tone.start()
  await ensureSoundTouchRegistered()
  await preloadClips(clips)
  const transport = Tone.getTransport()
  if (fromSec !== undefined) transport.seconds = fromSec
  scheduleClips(clips, tracks)

  // MIDI clock: pick the first MIDI track with an output port assigned.
  const midiClockTrack = tracks.find((t) => t.kind === 'midi' && t.midiOutPortId && !t.mute)
  if (midiClockTrack?.midiOutPortId) {
    activeClockPortId = midiClockTrack.midiOutPortId
    if (fromSec && fromSec > 0) continueMidiClock(activeClockPortId, activeBpm)
    else startMidiClock(activeClockPortId, activeBpm)
  }

  transport.start()
  if (metronomeEnabled) scheduleMetronome()
}

export function pauseTransport(): void {
  Tone.getTransport().pause()
  for (const { player } of clipPlayers.values()) {
    try {
      if (player.state === 'started') player.stop()
    } catch {
      /* */
    }
  }
  for (const sched of midiSchedules.values()) {
    sched.scheduled?.cancel()
    sched.scheduled = null
  }
  cancelMetronome()
  if (activeClockPortId) {
    stopMidiClock()
  }
}

export function stopTransport(): void {
  const transport = Tone.getTransport()
  transport.stop()
  transport.cancel(0)
  for (const { player } of clipPlayers.values()) {
    try {
      if (player.state === 'started') player.stop()
    } catch {
      /* */
    }
  }
  for (const sched of midiSchedules.values()) {
    sched.scheduled?.cancel()
    sched.scheduled = null
  }
  cancelMetronome()
  if (activeClockPortId) {
    stopMidiClock()
    activeClockPortId = null
  }
}

export function seekTransport(sec: number): void {
  Tone.getTransport().seconds = Math.max(0, sec)
}

export function getTransportTime(): number {
  return Tone.getTransport().seconds
}

export function setLoop(enabled: boolean, start: number, end: number): void {
  const transport = Tone.getTransport()
  if (enabled && end > start) {
    transport.loop = true
    transport.loopStart = start
    transport.loopEnd = end
  } else {
    transport.loop = false
  }
}
