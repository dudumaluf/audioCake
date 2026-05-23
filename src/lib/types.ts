/**
 * AudioCake core domain types.
 *
 * Non-destructive editing principle: clips reference assets by id; edits
 * (trim, fade, stretch, pitch, gain) live on the clip, never on the asset.
 *
 * Phase 1: AudioAsset
 * Phase 2: Track, Clip
 * Phase 3+: editing fields on Clip (fadeIn, fadeOut already present)
 */

export type SampleRate = 44100 | 48000

/**
 * Metadata for an audio recording or imported file.
 *
 * The actual PCM data lives in OPFS at `audio/${id}.wav` and is loaded
 * on demand. Peaks are a downsampled visualization summary used by
 * waveform previews so we never have to decode the full file just to draw.
 */
export interface AudioAsset {
  id: string
  name: string
  durationSec: number
  sampleRate: SampleRate
  channels: 1 | 2
  /** RMS peaks at ~100 samples per second, mono-summed. -1..1 floats. */
  peaks: Float32Array
  createdAt: number
  /** Optional source-device label (e.g. "Roland S-1"). */
  sourceDevice?: string
}

/**
 * A timeline track. Two kinds: audio (plays back recorded WAVs) and MIDI
 * (plays notes through a Web MIDI output port).
 *
 * MIDI tracks carry their port + channel routing so each MIDI clip on the
 * track inherits where its events go.
 */
export interface Track {
  id: string
  name: string
  kind: 'audio' | 'midi'
  color: string
  /** dB, applied via per-track channel (audio only — MIDI ignores). */
  gainDb: number
  /** -1 (left) .. 1 (right) (audio only). */
  pan: number
  mute: boolean
  solo: boolean
  recordArm: boolean
  /** Audio-only: 3-band EQ. Each band is dB gain at the band center. */
  eq?: { low: number; mid: number; high: number }
  /** Audio-only: simple compressor. */
  compressor?: { thresholdDb: number; ratio: number; enabled: boolean }
  /** Audio-only: send to the global reverb return, in dB. -60 = off. */
  reverbSendDb?: number
  /** Audio-only: send to the global delay return, in dB. -60 = off. */
  delaySendDb?: number
  /** MIDI-only: where to send recorded/played notes back out (optional). */
  midiOutPortId?: string
  midiOutChannel?: number
  /** MIDI-only: which port + channel to record from (optional). */
  midiInPortId?: string
  midiInChannel?: number
}

/**
 * A clip placed on a track's timeline.
 *
 * Audio clips reference an `AudioAsset` via `assetId`; the offset/duration
 * trim non-destructively against the source WAV. MIDI clips reference a
 * `MidiAsset` instead; offset is still in seconds for consistency, and
 * notes outside the visible [offset, offset+duration] window are clipped
 * on playback.
 */
export interface Clip {
  id: string
  trackId: string
  /** Discriminator: which asset table to look in. */
  kind: 'audio' | 'midi'
  /** AudioAsset id (kind='audio') or MidiAsset id (kind='midi'). */
  assetId: string
  startTime: number
  offset: number
  duration: number
  fadeIn: number
  fadeOut: number
  gainDb: number
  name: string
  /** Optional. Defaults to 1 (no change). 0.5 = half-speed, 2 = double-speed. */
  timeStretch?: number
  /** Optional. Defaults to 0. -12..+12 semitones. */
  pitchSemitones?: number
  /** Optional. Defaults to false. */
  reverse?: boolean
}

/** A single MIDI note inside a MidiAsset. */
export interface MidiNote {
  /** Note start in seconds relative to the asset start. */
  time: number
  /** Note length in seconds. */
  duration: number
  /** 0..127 (MIDI note number). 60 = middle C. */
  pitch: number
  /** 0..127 (MIDI velocity). */
  velocity: number
}

/** A recorded or imported MIDI pattern stored in IndexedDB. */
export interface MidiAsset {
  id: string
  name: string
  notes: MidiNote[]
  /** Total length in seconds (covers the last note's end). */
  durationSec: number
  createdAt: number
  /** Optional: source device label this MIDI came from. */
  sourceDevice?: string
}

/** A loop region on the timeline (open interval if `end <= start`). */
export interface LoopRegion {
  start: number
  end: number
}

/**
 * Snap-to-grid resolution. `'off'` skips snapping entirely.
 * 1/4 = beat, 1/8 = eighth, 1/16 = sixteenth, 'bar' = whole bar.
 */
export type SnapResolution = 'off' | 'bar' | '1/4' | '1/8' | '1/16'

/**
 * Master FX return settings. Stored on the project so reloads / .acproj
 * round-trips preserve the user's space.
 *
 * `delayDivisionBeats`: 1 = 1/4 note, 0.5 = 1/8, 1.5 = 1/8 dotted,
 * 0.25 = 1/16, etc. -1 means "free" (use `delayMs` directly).
 */
export interface FxSettings {
  reverb: {
    /** Decay tail length in seconds. */
    decaySec: number
    /** Pre-delay in milliseconds. */
    preDelayMs: number
    /** Wet trim in dB (-20..0). */
    wetDb: number
  }
  delay: {
    /** Musical note value in beats. -1 means "use `delayMs` directly". */
    divisionBeats: number
    /** Manual delay time in ms when divisionBeats === -1. */
    delayMs: number
    /** Feedback (0..0.95). */
    feedback: number
    /** Wet trim in dB (-20..0). */
    wetDb: number
  }
}

export const DEFAULT_FX_SETTINGS: FxSettings = {
  reverb: { decaySec: 2.4, preDelayMs: 0, wetDb: 0 },
  delay: { divisionBeats: 1.5, delayMs: 375, feedback: 0.35, wetDb: 0 },
}

/** Current project schema version. Bump when migrations are needed. */
export const PROJECT_SCHEMA_VERSION = 1

/**
 * Project envelope: a save-/loadable, portable unit.
 *
 * `tracks` and `clips` are the structural state. `audioAssetIds` records
 * which library assets this project depends on, so an `.acproj` export
 * can bundle the matching OPFS blobs.
 *
 * Snap / zoom / loop are persisted so closing and reopening the project
 * returns you to the same view.
 */
export interface Project {
  id: string
  name: string
  bpm: number
  sampleRate: SampleRate
  tracks: Track[]
  clips: Clip[]
  audioAssetIds: string[]
  loopRegion: LoopRegion | null
  loopEnabled: boolean
  snap: SnapResolution
  pxPerSec: number
  /** Free-form notes / lyrics pad, saved with the project. */
  notes?: string
  /** Master reverb + delay settings (optional for back-compat). */
  fxSettings?: FxSettings
  createdAt: number
  updatedAt: number
  version: number
}
