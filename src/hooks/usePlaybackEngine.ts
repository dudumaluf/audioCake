'use client'

import { useEffect } from 'react'
import {
  applyClips,
  applyTracks,
  getTransportTime,
  pauseTransport,
  rescheduleNow,
  setBpm,
  setDelayParams,
  setLoop,
  setMetronomeEnabled,
  setReverbParams,
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

  // Track / clip / bpm reconciliation. We re-apply clips after tracks too
  // so any clip that fell back to master (because its track-channel didn't
  // exist yet — happens at bootstrap when loadProjectData replaces the
  // whole project state in one go) gets re-routed through the proper
  // channel as soon as it exists.
  useEffect(() => {
    applyTracks(tracks)
    applyClips(useProjectStore.getState().clips)
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

  // Mirror project FX settings into the engine. Reverb decay change
  // regenerates the IR asynchronously; we don't block on it because the
  // engine's old IR keeps working until the new one is ready.
  const fxSettings = useProjectStore((s) => s.fxSettings)
  useEffect(() => {
    void setReverbParams(fxSettings.reverb)
    setDelayParams(fxSettings.delay)
  }, [fxSettings])

  // rAF playhead loop. We extrapolate between Tone.Transport ticks using
  // performance.now() so the visual playhead glides smoothly even when
  // the audio context's transport time only ticks every few ms. Re-syncs
  // to the real transport time every 100 ms so drift can't accumulate.
  useEffect(() => {
    if (!isPlaying) return
    let raf = 0
    let baseWallMs = performance.now()
    let baseTransport = getTransportTime()
    let lastResyncWallMs = baseWallMs

    const tick = () => {
      const nowWall = performance.now()
      // Re-anchor every 100 ms so the extrapolation can't drift past the
      // real audio clock (and so loop-jumps are caught quickly).
      if (nowWall - lastResyncWallMs >= 100) {
        const real = getTransportTime()
        baseWallMs = nowWall
        baseTransport = real
        lastResyncWallMs = nowWall
        setPlayhead(real)
      } else {
        const extrapolated = baseTransport + (nowWall - baseWallMs) / 1000
        setPlayhead(extrapolated)
      }
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
