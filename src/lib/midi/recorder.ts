import type { MidiNote } from '@/lib/types'
import { NOTE_OFF, NOTE_ON, subscribeInput, type IncomingMessage } from './engine'

/**
 * Start recording MIDI from a chosen input port + channel filter.
 *
 * `getTransportTimeSec()` should return the current playhead in seconds
 * so we can timestamp each note relative to the project start. Pair each
 * note-on with the matching note-off; if the user stops recording with a
 * key still held, we close the note at stop time.
 */
export interface MidiRecordSession {
  stop: () => MidiNote[]
}

export function startMidiRecording(
  portId: string,
  channel: number | undefined,
  getTransportTimeSec: () => number,
): MidiRecordSession {
  const heldByPitch = new Map<number, { time: number; velocity: number }>()
  const notes: MidiNote[] = []

  const unsub = subscribeInput(portId, (msg: IncomingMessage) => {
    if (channel !== undefined && msg.channel !== channel) return
    const t = getTransportTimeSec()
    if (msg.status === NOTE_ON) {
      // Velocity 0 is also note-off per MIDI spec.
      if (msg.data2 === 0) {
        completeNote(msg.data1, t)
      } else {
        heldByPitch.set(msg.data1, { time: t, velocity: msg.data2 })
      }
    } else if (msg.status === NOTE_OFF) {
      completeNote(msg.data1, t)
    }
  })

  function completeNote(pitch: number, endTime: number) {
    const held = heldByPitch.get(pitch)
    if (!held) return
    heldByPitch.delete(pitch)
    const duration = Math.max(0.01, endTime - held.time)
    notes.push({
      time: held.time,
      duration,
      pitch,
      velocity: held.velocity,
    })
  }

  return {
    stop: () => {
      const stopTime = getTransportTimeSec()
      for (const pitch of Array.from(heldByPitch.keys())) {
        completeNote(pitch, stopTime)
      }
      unsub()
      // Sort by start time for clean serialization / display.
      notes.sort((a, b) => a.time - b.time)
      return notes
    },
  }
}

/** Compute total length covering all notes (last note end). */
export function midiAssetDuration(notes: MidiNote[]): number {
  let max = 0
  for (const n of notes) max = Math.max(max, n.time + n.duration)
  return max
}
