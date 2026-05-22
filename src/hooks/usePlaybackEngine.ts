'use client'

import { useEffect } from 'react'
import {
  applyClips,
  applyTracks,
  getTransportTime,
  pauseTransport,
  rescheduleNow,
  setBpm,
  setLoop,
  setMetronomeEnabled,
  startTransport,
  stopTransport,
} from '@/lib/audio/playback'
import { useIOStore } from '@/lib/state/io-store'
import { useProjectStore } from '@/lib/state/project-store'
import { useTransportStore } from '@/lib/state/transport-store'

/**
 * Bridges the imperative playback engine to the React stores.
 *
 * - Mirrors track/clip/bpm/loop state into the engine whenever it changes
 *   (in render order: tracks first, then clips, because clip routing
 *   depends on track channels existing).
 * - Drives the playhead readout via rAF while playing.
 * - Provides `play()`, `pause()`, `stop()` actions for the topbar.
 *
 * Mount this hook once in the top-level shell.
 */
export function usePlaybackEngine() {
  const tracks = useProjectStore((s) => s.tracks)
  const clips = useProjectStore((s) => s.clips)
  const bpm = useProjectStore((s) => s.bpm)
  const loopRegion = useProjectStore((s) => s.loopRegion)
  const loopEnabled = useProjectStore((s) => s.loopEnabled)

  const isPlaying = useTransportStore((s) => s.isPlaying)
  const setPlayhead = useTransportStore((s) => s.setPlayhead)
  const setPlaying = useTransportStore((s) => s.setPlaying)

  // Track / clip / bpm reconciliation.
  useEffect(() => {
    applyTracks(tracks)
  }, [tracks])

  useEffect(() => {
    applyClips(clips)
  }, [clips])

  useEffect(() => {
    setBpm(bpm)
  }, [bpm])

  useEffect(() => {
    setLoop(loopEnabled, loopRegion?.start ?? 0, loopRegion?.end ?? 0)
    // If transport is mid-flight, re-run scheduling so the next iteration
    // honours the new loop window (or the lack of one).
    if (useTransportStore.getState().isPlaying) {
      const { clips: cs, tracks: ts } = useProjectStore.getState()
      rescheduleNow(cs, ts)
    }
  }, [loopEnabled, loopRegion])

  // Re-schedule when clips change during playback so newly-added clips
  // and edits inside the loop region take effect on the next iteration.
  useEffect(() => {
    if (useTransportStore.getState().isPlaying) {
      const { tracks: ts } = useProjectStore.getState()
      rescheduleNow(clips, ts)
    }
  }, [clips])

  const metronomeOnPlay = useIOStore((s) => s.metronomeOnPlay)
  useEffect(() => {
    setMetronomeEnabled(metronomeOnPlay)
  }, [metronomeOnPlay])

  // rAF playhead loop, only while playing.
  useEffect(() => {
    if (!isPlaying) return
    let raf = 0
    const tick = () => {
      setPlayhead(getTransportTime())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying, setPlayhead])

  return {
    play: async () => {
      const { clips: currentClips, tracks: currentTracks } = useProjectStore.getState()
      const startAt = useTransportStore.getState().playheadSec
      await startTransport(currentClips, currentTracks, startAt)
      setPlaying(true)
    },
    pause: () => {
      pauseTransport()
      setPlaying(false)
    },
    stop: () => {
      stopTransport()
      setPlaying(false)
      setPlayhead(0)
    },
  }
}
