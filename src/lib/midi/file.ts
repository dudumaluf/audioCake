import { Midi } from '@tonejs/midi'
import type { MidiAsset } from '@/lib/types'

/**
 * Serialise a MidiAsset as a Standard MIDI File (`.mid`).
 *
 * Uses @tonejs/midi which handles the encoding; one track is created
 * with all notes assigned to MIDI channel 1 (Logic / Ableton can remap
 * on import).
 */
export function midiAssetToBlob(asset: MidiAsset, bpm = 120): Blob {
  const midi = new Midi()
  midi.header.setTempo(bpm)
  const track = midi.addTrack()
  track.name = asset.name
  for (const note of asset.notes) {
    track.addNote({
      midi: note.pitch,
      time: note.time,
      duration: note.duration,
      velocity: Math.max(0, Math.min(1, note.velocity / 127)),
    })
  }
  const bytes = midi.toArray()
  return new Blob([new Uint8Array(bytes)], { type: 'audio/midi' })
}
