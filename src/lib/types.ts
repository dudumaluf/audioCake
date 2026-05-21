/**
 * AudioCake core domain types.
 *
 * The fields here cover what Phase 1 needs (audio assets + recording).
 * Tracks, clips, MIDI, etc. are added in later phases as the engine grows.
 *
 * Non-destructive editing principle: clips reference assets by id; edits
 * (trim, fade, stretch, pitch, gain) live on the clip, never on the asset.
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
