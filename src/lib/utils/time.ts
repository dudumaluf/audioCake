import type { SnapResolution } from '@/lib/types'

/**
 * Time / grid conversions used by the timeline UI and the engine.
 *
 * All "seconds" values are wall-clock seconds along the project timeline.
 * The grid is BPM-driven so changing BPM redraws the ruler without moving
 * clips (clips stay anchored in seconds; ADR'd in the plan).
 */

/** Seconds per beat at the given BPM (4/4 assumed). */
export function secPerBeat(bpm: number): number {
  return 60 / bpm
}

/** Seconds per bar at the given BPM (4/4 assumed). */
export function secPerBar(bpm: number): number {
  return secPerBeat(bpm) * 4
}

/**
 * Convert a snap resolution to its duration in seconds at the given BPM.
 * `'off'` returns 0; callers should check.
 */
export function snapSeconds(resolution: SnapResolution, bpm: number): number {
  const beat = secPerBeat(bpm)
  switch (resolution) {
    case 'off':
      return 0
    case 'bar':
      return beat * 4
    case '1/4':
      return beat
    case '1/8':
      return beat / 2
    case '1/16':
      return beat / 4
  }
}

/**
 * Snap a time value to the nearest grid line. With `'off'` resolution the
 * input is returned unchanged. Always clamps to non-negative.
 */
export function snapTime(time: number, resolution: SnapResolution, bpm: number): number {
  if (resolution === 'off') return Math.max(0, time)
  const step = snapSeconds(resolution, bpm)
  if (step <= 0) return Math.max(0, time)
  return Math.max(0, Math.round(time / step) * step)
}

/**
 * Format seconds as `bar.beat.tick` (1-indexed bars/beats, 4/4 assumed).
 * Used in the timeline ruler and the transport readout.
 */
export function formatBarBeat(time: number, bpm: number): string {
  const beat = secPerBeat(bpm)
  const totalBeats = time / beat
  const bar = Math.floor(totalBeats / 4) + 1
  const beatInBar = Math.floor(totalBeats % 4) + 1
  const tick = Math.floor((totalBeats % 1) * 96) // 96 PPQN-ish, plenty for display
  return `${bar}.${beatInBar}.${String(tick).padStart(2, '0')}`
}
