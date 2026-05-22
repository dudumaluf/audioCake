import type { Clip } from '@/lib/types'

/**
 * Compute "effective" fade-in / fade-out lengths for each clip, accounting
 * for overlaps with other clips on the same track. Returns a map keyed by
 * clip id; clips with no neighbouring overlap are not present in the map
 * (callers fall back to the user-set fadeIn/fadeOut).
 *
 * The user's explicit fadeIn / fadeOut wins when larger than the overlap;
 * otherwise we expand to cover the overlap so adjacent clips equal-power
 * crossfade cleanly. We do NOT mutate the clips themselves.
 */
export function computeAutoCrossfades(
  clips: Clip[],
): Map<string, { fadeIn: number; fadeOut: number }> {
  const byTrack = new Map<string, Clip[]>()
  for (const c of clips) {
    if (c.kind !== 'audio') continue
    const list = byTrack.get(c.trackId)
    if (list) list.push(c)
    else byTrack.set(c.trackId, [c])
  }

  const out = new Map<string, { fadeIn: number; fadeOut: number }>()
  for (const trackClips of byTrack.values()) {
    const sorted = [...trackClips].sort((a, b) => a.startTime - b.startTime)
    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i]!
      const next = sorted[i + 1]
      if (!next) continue
      const curTs = cur.timeStretch ?? 1
      const curEnd = cur.startTime + cur.duration / curTs
      const nextStart = next.startTime
      const overlap = curEnd - nextStart
      if (overlap > 0.005) {
        const curEntry = out.get(cur.id) ?? {
          fadeIn: cur.fadeIn,
          fadeOut: cur.fadeOut,
        }
        const nextEntry = out.get(next.id) ?? {
          fadeIn: next.fadeIn,
          fadeOut: next.fadeOut,
        }
        curEntry.fadeOut = Math.max(curEntry.fadeOut, overlap)
        nextEntry.fadeIn = Math.max(nextEntry.fadeIn, overlap)
        out.set(cur.id, curEntry)
        out.set(next.id, nextEntry)
      }
    }
  }
  return out
}

/** Resolve the effective fadeIn / fadeOut for a clip given the auto-crossfade map. */
export function effectiveFades(
  clip: Clip,
  auto: Map<string, { fadeIn: number; fadeOut: number }>,
): { fadeIn: number; fadeOut: number } {
  const e = auto.get(clip.id)
  if (!e) return { fadeIn: clip.fadeIn, fadeOut: clip.fadeOut }
  return e
}
