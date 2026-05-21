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
 * A timeline track. Phase 2 introduces audio tracks only; Phase 5 adds
 * `kind: 'midi'`. Default project ships with four audio tracks pre-named
 * for the Roland gear (see project-store).
 */
export interface Track {
  id: string
  name: string
  kind: 'audio'
  color: string
  /** dB, applied via per-track channel. -∞ shown as -60. */
  gainDb: number
  /** -1 (left) .. 1 (right). */
  pan: number
  mute: boolean
  solo: boolean
  recordArm: boolean
}

/**
 * A clip placed on a track's timeline. Edits are non-destructive: `offset`
 * trims from the asset's start, `duration` is the visible length, and
 * `fadeIn` / `fadeOut` taper the edges. The original asset is untouched.
 */
export interface Clip {
  id: string
  trackId: string
  assetId: string
  /** Seconds along the project timeline where the clip begins playing. */
  startTime: number
  /** Seconds into the source asset that the clip starts (trim from start). */
  offset: number
  /** Visible / playable duration in seconds. */
  duration: number
  fadeIn: number
  fadeOut: number
  /** dB; per-clip gain trim on top of the track's gain. */
  gainDb: number
  name: string
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
  createdAt: number
  updatedAt: number
  version: number
}
