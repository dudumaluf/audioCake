import * as Tone from 'tone'
import type { Clip, Track } from '@/lib/types'
import { readAudioBlob } from '@/lib/storage/opfs'

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
  /** Last applied solo state across all tracks (recomputed each apply). */
  effectiveMute: boolean
}

interface ClipPlayer {
  player: Tone.Player
  trackId: string
  buffer: AudioBuffer | null
  loadingPromise: Promise<void> | null
}

const trackChannels = new Map<string, TrackChannel>()
const clipPlayers = new Map<string, ClipPlayer>()
const decodeCache = new Map<string, AudioBuffer>()
let masterMeter: Tone.Meter | null = null
let initialized = false

function ensureInit() {
  if (initialized) return
  masterMeter = new Tone.Meter({ channelCount: 2, normalRange: true })
  Tone.getDestination().chain(masterMeter)
  initialized = true
}

export function getMasterMeter(): Tone.Meter | null {
  ensureInit()
  return masterMeter
}

export function setBpm(bpm: number): void {
  Tone.getTransport().bpm.value = bpm
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

  for (const t of tracks) {
    let entry = trackChannels.get(t.id)
    if (!entry) {
      const channel = new Tone.Channel({
        volume: t.gainDb,
        pan: t.pan,
        mute: t.mute,
      })
      channel.toDestination()
      entry = { channel, effectiveMute: t.mute }
      trackChannels.set(t.id, entry)
    }
    entry.channel.volume.value = t.gainDb
    entry.channel.pan.value = t.pan
    const effectiveMute = anySoloed ? !t.solo : t.mute
    entry.channel.mute = effectiveMute
    entry.effectiveMute = effectiveMute
  }

  for (const [id, entry] of trackChannels) {
    if (!liveIds.has(id)) {
      try {
        entry.channel.disconnect()
      } catch {
        /* */
      }
      entry.channel.dispose()
      trackChannels.delete(id)
    }
  }
}

/**
 * Reconcile the clip list with our active players: create players for new
 * clips, update playback params on existing ones, dispose dropped ones.
 * Loading is deferred to playback time to avoid disk thrash when the user
 * just drags a clip around.
 */
export function applyClips(clips: Clip[]): void {
  ensureInit()
  const liveIds = new Set(clips.map((c) => c.id))
  for (const c of clips) {
    let entry = clipPlayers.get(c.id)
    if (!entry) {
      const player = new Tone.Player({
        autostart: false,
        fadeIn: c.fadeIn,
        fadeOut: c.fadeOut,
        volume: c.gainDb,
      })
      // Route to its track's channel if present, else direct.
      const trackChannel = trackChannels.get(c.trackId)
      if (trackChannel) player.connect(trackChannel.channel)
      else player.toDestination()
      entry = { player, trackId: c.trackId, buffer: null, loadingPromise: null }
      clipPlayers.set(c.id, entry)
    }
    entry.player.fadeIn = c.fadeIn
    entry.player.fadeOut = c.fadeOut
    entry.player.volume.value = c.gainDb

    // Re-route if the clip moved to a different track.
    if (entry.trackId !== c.trackId) {
      try {
        entry.player.disconnect()
      } catch {
        /* */
      }
      const newChannel = trackChannels.get(c.trackId)
      if (newChannel) entry.player.connect(newChannel.channel)
      else entry.player.toDestination()
      entry.trackId = c.trackId
    }
  }

  for (const [id, entry] of clipPlayers) {
    if (!liveIds.has(id)) {
      try {
        entry.player.disconnect()
      } catch {
        /* */
      }
      entry.player.dispose()
      clipPlayers.delete(id)
    }
  }
}

/**
 * Load the audio for a clip's asset if we haven't already. Returns the
 * decoded AudioBuffer (cached per assetId).
 */
async function ensureClipBuffer(clipId: string, assetId: string): Promise<AudioBuffer> {
  const entry = clipPlayers.get(clipId)
  if (!entry) throw new Error(`No player for clip ${clipId}`)
  let buffer = decodeCache.get(assetId)
  if (!buffer) {
    const blob = await readAudioBlob(assetId)
    if (!blob) throw new Error(`Audio blob missing for asset ${assetId}`)
    const arr = await blob.arrayBuffer()
    buffer = await Tone.getContext().decodeAudioData(arr)
    decodeCache.set(assetId, buffer)
  }
  if (entry.buffer !== buffer) {
    entry.player.buffer = new Tone.ToneAudioBuffer(buffer)
    entry.buffer = buffer
  }
  return buffer
}

/**
 * Preload all clip buffers. Called once at start-of-playback so the
 * scheduler has everything ready and there's no audible gap.
 */
export async function preloadClips(clips: Clip[]): Promise<void> {
  await Promise.all(
    clips.map(async (c) => {
      const entry = clipPlayers.get(c.id)
      if (!entry) return
      if (!entry.loadingPromise) {
        entry.loadingPromise = ensureClipBuffer(c.id, c.assetId)
          .then(() => undefined)
          .catch((e) => {
            console.error('Clip preload failed', c.id, e)
          })
      }
      await entry.loadingPromise
    }),
  )
}

/**
 * Schedule playback of all clips starting at the current transport time.
 * Cancels any prior scheduling first so re-calling is idempotent.
 */
export function scheduleClips(clips: Clip[]): void {
  const transport = Tone.getTransport()
  transport.cancel(0)
  for (const c of clips) {
    const entry = clipPlayers.get(c.id)
    if (!entry?.buffer) continue
    // We use Tone.Player.start at an absolute transport-relative time.
    // Player.start(when, offset, duration) plays a slice of the buffer.
    transport.schedule((time) => {
      entry.player.start(time, c.offset, c.duration)
    }, c.startTime)
  }
}

/** Begin transport playback at the given offset (default: current position). */
export async function startTransport(clips: Clip[], fromSec?: number): Promise<void> {
  ensureInit()
  await Tone.start() // requires user gesture upstream
  await preloadClips(clips)
  const transport = Tone.getTransport()
  if (fromSec !== undefined) transport.seconds = fromSec
  scheduleClips(clips)
  transport.start()
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
