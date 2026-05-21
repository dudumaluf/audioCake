'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { ulid } from 'ulid'
import { getTransportTime } from '@/lib/audio/playback'
import { midiAssetDuration, startMidiRecording, type MidiRecordSession } from '@/lib/midi/recorder'
import { useAssetStore } from '@/lib/state/asset-store'
import { useProjectStore } from '@/lib/state/project-store'
import { useTransportStore } from '@/lib/state/transport-store'
import type { MidiAsset } from '@/lib/types'

/**
 * Auto-records MIDI from every record-armed MIDI track whenever transport
 * is playing.
 *
 * One asset is created per armed track per play session. On stop, each
 * session's notes are saved as a `MidiAsset` and dropped into the
 * library; the user can drag them onto a track. Optionally we also
 * insert a clip directly on the source track.
 */
export function useMidiRecorder(opts: { autoInsertClip?: boolean } = {}): void {
  const isPlaying = useTransportStore((s) => s.isPlaying)
  const tracks = useProjectStore((s) => s.tracks)
  const addClip = useProjectStore((s) => s.addClip)
  const addMidi = useAssetStore((s) => s.addMidi)
  const sessionsRef = useRef<
    Array<{
      trackId: string
      trackName: string
      session: MidiRecordSession
      startSec: number
    }>
  >([])

  useEffect(() => {
    if (isPlaying) {
      // Start a session for every armed MIDI track with a configured input.
      const playheadAtStart = useTransportStore.getState().playheadSec
      sessionsRef.current = []
      for (const t of tracks) {
        if (t.kind !== 'midi') continue
        if (!t.recordArm) continue
        if (!t.midiInPortId) continue
        const channel = t.midiInChannel
        const session = startMidiRecording(t.midiInPortId, channel, () => {
          const elapsed = getTransportTime() - playheadAtStart
          return Math.max(0, elapsed)
        })
        sessionsRef.current.push({
          trackId: t.id,
          trackName: t.name,
          session,
          startSec: playheadAtStart,
        })
      }
    } else {
      // Transport stopped — close out each session.
      const closing = sessionsRef.current
      sessionsRef.current = []
      void (async () => {
        for (const s of closing) {
          const notes = s.session.stop()
          if (notes.length === 0) continue
          const duration = midiAssetDuration(notes)
          const asset: MidiAsset = {
            id: ulid(),
            name: `${s.trackName} take`,
            notes,
            durationSec: duration,
            createdAt: Date.now(),
          }
          await addMidi(asset)
          if (opts.autoInsertClip !== false) {
            addClip({
              trackId: s.trackId,
              kind: 'midi',
              assetId: asset.id,
              startTime: s.startSec,
              offset: 0,
              duration,
              fadeIn: 0,
              fadeOut: 0,
              gainDb: 0,
              name: asset.name,
            })
          }
          toast.success('MIDI take saved', {
            description: `${asset.name} — ${notes.length} notes`,
          })
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])
}
