import * as Tone from 'tone'
import type { Clip, MidiAsset } from '@/lib/types'
import { sendNoteOff, sendNoteOn } from './engine'

/**
 * Schedule a MIDI clip's notes on `Tone.getTransport()`.
 *
 * Each note's on / off is scheduled at the precise transport time so
 * the Roland (or any MIDI synth) plays them in sync with audio clips.
 * Notes outside the clip's visible window (offset / duration) are
 * skipped at scheduling time.
 *
 * Returns a disposer that cancels the scheduled events; call it when
 * the clip is edited / removed / playback stops.
 */
export interface ScheduledMidiClip {
  cancel: () => void
}

export function scheduleMidiClip(
  clip: Clip,
  asset: MidiAsset,
  portId: string,
  channel: number,
): ScheduledMidiClip {
  const transport = Tone.getTransport()
  const eventIds: number[] = []

  for (const note of asset.notes) {
    if (note.time < clip.offset) continue
    if (note.time >= clip.offset + clip.duration) continue
    const relTime = note.time - clip.offset
    const onAt = clip.startTime + relTime
    const offAt = Math.min(clip.startTime + clip.duration, onAt + note.duration)

    eventIds.push(
      transport.schedule(() => {
        sendNoteOn(portId, channel, note.pitch, note.velocity)
      }, onAt),
    )
    eventIds.push(
      transport.schedule(() => {
        sendNoteOff(portId, channel, note.pitch)
      }, offAt),
    )
  }

  return {
    cancel: () => {
      for (const id of eventIds) transport.clear(id)
    },
  }
}
