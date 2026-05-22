import { ulid } from 'ulid'
import { startRecording, openInputStream, upmixToStereo } from '@/lib/audio/recorder'
import { encodeWav } from '@/lib/audio/wav-encoder'
import { sendNoteOff, sendNoteOn } from './engine'
import { useAssetStore } from '@/lib/state/asset-store'
import { useProjectStore } from '@/lib/state/project-store'
import type { AudioAsset, Clip, MidiAsset } from '@/lib/types'
import { buildPeaks } from '@/lib/utils/audio-math'

/**
 * Bounce a MIDI clip to audio by:
 *   1. Opening a getUserMedia stream on the chosen input device.
 *   2. Starting a recording session against that stream.
 *   3. Playing the MIDI clip's notes out to the MIDI output port using
 *      setTimeout-based scheduling (the device replies via its analog or
 *      USB-audio path, which the input stream captures).
 *   4. Stopping the recording when the clip ends, then committing the
 *      captured audio as a fresh AudioAsset and dropping a clip on the
 *      chosen audio track at the same startTime.
 *
 * Reports progress via `onProgress(0..1)` so the UI can render a bar.
 * Returns the new audio clip's id.
 */
export interface BounceOptions {
  midiClip: Clip
  midiAsset: MidiAsset
  /** Web MIDI output port id that drives the hardware synth. */
  midiOutPortId: string
  /** MIDI channel (0..15) to send notes on. */
  midiOutChannel: number
  /** getUserMedia deviceId for the audio capture (the device's USB return). */
  audioInputId: string
  /** Track id that the bounced audio clip will land on. */
  targetTrackId: string
  /** Pre-roll silence in seconds before the first note (default 0.25s). */
  preRollSec?: number
  /** Tail silence captured after the last note (default 0.5s). */
  tailSec?: number
  onProgress?: (fraction: number) => void
}

export async function bounceMidiClip(opts: BounceOptions): Promise<string> {
  const {
    midiClip,
    midiAsset,
    midiOutPortId,
    midiOutChannel,
    audioInputId,
    targetTrackId,
    preRollSec = 0.25,
    tailSec = 0.5,
    onProgress,
  } = opts

  // Notes that fall inside the clip's visible window.
  const visible = midiAsset.notes
    .filter(
      (n) => n.time + n.duration > midiClip.offset && n.time < midiClip.offset + midiClip.duration,
    )
    .map((n) => ({
      ...n,
      // Re-anchor time to start at 0 within the clip.
      time: Math.max(0, n.time - midiClip.offset),
    }))

  if (visible.length === 0) throw new Error('MIDI clip has no notes to bounce')

  const totalLengthSec = preRollSec + midiClip.duration + tailSec

  // Open the input stream + recorder.
  const stream = await openInputStream(audioInputId)
  const session = await startRecording(stream)

  // Schedule notes via setTimeout. Pre-roll silence first.
  const t0 = performance.now() + preRollSec * 1000
  const noteTimers: number[] = []
  for (const n of visible) {
    const onAt = t0 + n.time * 1000
    const offAt = onAt + n.duration * 1000
    const onDelay = Math.max(0, onAt - performance.now())
    const offDelay = Math.max(0, offAt - performance.now())
    noteTimers.push(
      window.setTimeout(() => {
        sendNoteOn(midiOutPortId, midiOutChannel, n.pitch, n.velocity)
      }, onDelay),
      window.setTimeout(() => {
        sendNoteOff(midiOutPortId, midiOutChannel, n.pitch)
      }, offDelay),
    )
  }

  // Progress reporter (UI tick).
  const startWall = performance.now()
  let progressTimer: number | null = window.setInterval(() => {
    const elapsed = (performance.now() - startWall) / 1000
    const frac = Math.min(1, elapsed / totalLengthSec)
    onProgress?.(frac)
  }, 100)

  // Wait for the whole window, then stop.
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, totalLengthSec * 1000)
  })

  if (progressTimer != null) {
    window.clearInterval(progressTimer)
    progressTimer = null
  }
  // Best-effort: ensure no notes left hanging if anything misbehaved.
  for (const t of noteTimers) window.clearTimeout(t)
  for (const n of visible) sendNoteOff(midiOutPortId, midiOutChannel, n.pitch)

  const { channels, sampleRate, durationSec } = await session.stop()
  stream.getTracks().forEach((t) => t.stop())

  const stereo = upmixToStereo(channels)
  const peaks = buildPeaks(stereo, sampleRate)
  const wav = encodeWav({ channels: stereo, sampleRate, bitDepth: 32 })
  const assetId = ulid()
  const asset: AudioAsset = {
    id: assetId,
    name: `${midiClip.name || midiAsset.name || 'MIDI'} (bounce)`,
    durationSec,
    sampleRate: sampleRate === 44100 ? 44100 : 48000,
    channels: 2,
    peaks,
    createdAt: Date.now(),
    sourceDevice: 'MIDI bounce',
  }
  await useAssetStore.getState().addRecording({ asset, wavBlob: wav })

  // Drop the new audio clip on the target track at the original MIDI clip's
  // start, accounting for the pre-roll we inserted.
  const newClipId = useProjectStore.getState().addClip({
    trackId: targetTrackId,
    kind: 'audio',
    assetId,
    startTime: midiClip.startTime,
    offset: preRollSec,
    duration: midiClip.duration,
    fadeIn: 0,
    fadeOut: 0,
    gainDb: 0,
    name: asset.name,
  })

  onProgress?.(1)
  return newClipId
}
