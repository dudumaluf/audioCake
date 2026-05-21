import { create } from 'zustand'
import { ulid } from 'ulid'
import type { Clip, LoopRegion, SnapResolution, Track } from '@/lib/types'

/**
 * Project state: tracks, clips, BPM, loop region, selection, snap settings.
 *
 * The store is intentionally action-rich and selector-light: every mutation
 * is a named action so Phase 3's undo/redo (Zundo) can wrap the whole store
 * cleanly without us having to mark each setter individually.
 */

interface ProjectState {
  bpm: number
  tracks: Track[]
  clips: Clip[]
  loopRegion: LoopRegion | null
  loopEnabled: boolean
  /** Snap-to-grid resolution for clip drag / resize / record-quantize. */
  snap: SnapResolution
  /** Pixels per second in the timeline view. */
  pxPerSec: number
  /** ids of currently selected clips. */
  selectedClipIds: string[]

  setBpm: (bpm: number) => void
  setSnap: (snap: SnapResolution) => void
  setPxPerSec: (px: number) => void
  setLoopEnabled: (enabled: boolean) => void
  setLoopRegion: (region: LoopRegion | null) => void

  addTrack: (partial?: Partial<Omit<Track, 'id'>>) => string
  removeTrack: (trackId: string) => void
  updateTrack: (trackId: string, patch: Partial<Track>) => void

  addClip: (clip: Omit<Clip, 'id'>) => string
  updateClip: (clipId: string, patch: Partial<Clip>) => void
  removeClip: (clipId: string) => void

  selectClips: (ids: string[]) => void
  clearSelection: () => void
}

const DEFAULT_TRACK_COLORS = [
  'oklch(75% 0.18 70)', // amber
  'oklch(75% 0.14 200)', // teal
  'oklch(70% 0.16 145)', // green
  'oklch(70% 0.18 320)', // magenta
]

function defaultTracks(): Track[] {
  const names = ['Drums (T-8)', 'Bass (J-6)', 'Lead (S-1)', 'Pad']
  return names.map((name, i) => ({
    id: ulid(),
    name,
    kind: 'audio' as const,
    color: DEFAULT_TRACK_COLORS[i] ?? DEFAULT_TRACK_COLORS[0]!,
    gainDb: 0,
    pan: 0,
    mute: false,
    solo: false,
    recordArm: false,
  }))
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  bpm: 120,
  tracks: defaultTracks(),
  clips: [],
  loopRegion: null,
  loopEnabled: false,
  snap: '1/16',
  pxPerSec: 80,
  selectedClipIds: [],

  setBpm: (bpm) => set({ bpm: Math.max(20, Math.min(300, bpm)) }),
  setSnap: (snap) => set({ snap }),
  setPxPerSec: (px) => set({ pxPerSec: Math.max(10, Math.min(800, px)) }),
  setLoopEnabled: (loopEnabled) => set({ loopEnabled }),
  setLoopRegion: (loopRegion) => set({ loopRegion }),

  addTrack: (partial) => {
    const id = ulid()
    const order = get().tracks.length
    const track: Track = {
      id,
      name: partial?.name ?? `Track ${order + 1}`,
      kind: 'audio',
      color: partial?.color ?? DEFAULT_TRACK_COLORS[order % DEFAULT_TRACK_COLORS.length]!,
      gainDb: partial?.gainDb ?? 0,
      pan: partial?.pan ?? 0,
      mute: partial?.mute ?? false,
      solo: partial?.solo ?? false,
      recordArm: partial?.recordArm ?? false,
    }
    set((s) => ({ tracks: [...s.tracks, track] }))
    return id
  },

  removeTrack: (trackId) =>
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== trackId),
      clips: s.clips.filter((c) => c.trackId !== trackId),
      selectedClipIds: s.selectedClipIds.filter(
        (id) => !s.clips.find((c) => c.id === id && c.trackId === trackId),
      ),
    })),

  updateTrack: (trackId, patch) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t)),
    })),

  addClip: (partial) => {
    const id = ulid()
    set((s) => ({ clips: [...s.clips, { ...partial, id }] }))
    return id
  },

  updateClip: (clipId, patch) =>
    set((s) => ({
      clips: s.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
    })),

  removeClip: (clipId) =>
    set((s) => ({
      clips: s.clips.filter((c) => c.id !== clipId),
      selectedClipIds: s.selectedClipIds.filter((id) => id !== clipId),
    })),

  selectClips: (ids) => set({ selectedClipIds: ids }),
  clearSelection: () => set({ selectedClipIds: [] }),
}))
