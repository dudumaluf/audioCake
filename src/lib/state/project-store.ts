import { create } from 'zustand'
import { temporal } from 'zundo'
import { ulid } from 'ulid'
import type {
  Clip,
  FxSettings,
  LoopRegion,
  Project,
  SampleRate,
  SnapResolution,
  Track,
} from '@/lib/types'
import { DEFAULT_FX_SETTINGS, PROJECT_SCHEMA_VERSION } from '@/lib/types'

/**
 * Project state: tracks, clips, BPM, loop region, selection, snap settings.
 *
 * Undo/redo (Zundo) wraps this store, capturing the structural fields
 * (`tracks`, `clips`, `bpm`, `loopRegion`). Transient fields like the
 * current selection or zoom level are filtered out so undoing a clip move
 * doesn't also restore your old selection / zoom.
 */

interface ProjectState {
  projectId: string
  projectName: string
  sampleRate: SampleRate
  bpm: number
  tracks: Track[]
  clips: Clip[]
  loopRegion: LoopRegion | null
  loopEnabled: boolean
  snap: SnapResolution
  pxPerSec: number
  notes: string
  fxSettings: FxSettings
  selectedClipIds: string[]
  /** Increments every time we mutate structural state; used to detect dirty for autosave. */
  dirtyTick: number

  setProjectName: (name: string) => void
  setNotes: (notes: string) => void
  setBpm: (bpm: number) => void
  setSnap: (snap: SnapResolution) => void
  setPxPerSec: (px: number) => void
  setLoopEnabled: (enabled: boolean) => void
  setLoopRegion: (region: LoopRegion | null) => void
  setFxSettings: (fx: FxSettings) => void

  addTrack: (partial?: Partial<Omit<Track, 'id'>>) => string
  addMidiTrack: (partial?: Partial<Omit<Track, 'id' | 'kind'>>) => string
  removeTrack: (trackId: string) => void
  updateTrack: (trackId: string, patch: Partial<Track>) => void

  addClip: (clip: Omit<Clip, 'id'>) => string
  updateClip: (clipId: string, patch: Partial<Clip>) => void
  removeClip: (clipId: string) => void

  /** Multi-clip edit helpers used by keyboard shortcuts + inspector. */
  splitSelectedAt: (timeSec: number) => void
  duplicateSelected: () => void
  deleteSelected: () => void
  nudgeSelected: (deltaSec: number) => void

  selectClips: (ids: string[]) => void
  toggleClipSelected: (id: string) => void
  clearSelection: () => void

  /** Snapshot the current structural state into a Project envelope. */
  toProject: () => Project
  /** Replace structural state from a Project; clears selection + undo history. */
  loadProjectData: (project: Project) => void
  /** Reset to a fresh empty project (default tracks). */
  newProject: (name: string, sampleRate?: SampleRate) => void
}

const DEFAULT_TRACK_COLORS = [
  'oklch(75% 0.18 70)',
  'oklch(75% 0.14 200)',
  'oklch(70% 0.16 145)',
  'oklch(70% 0.18 320)',
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

export const useProjectStore = create<ProjectState>()(
  temporal(
    (set, get) => ({
      projectId: ulid(),
      projectName: 'Untitled',
      sampleRate: 48000,
      bpm: 120,
      tracks: defaultTracks(),
      clips: [],
      loopRegion: null,
      loopEnabled: false,
      snap: '1/16',
      pxPerSec: 80,
      notes: '',
      fxSettings: DEFAULT_FX_SETTINGS,
      selectedClipIds: [],
      dirtyTick: 0,

      setProjectName: (projectName) => set({ projectName }),
      setNotes: (notes) => set({ notes }),
      setBpm: (bpm) => set({ bpm: Math.max(20, Math.min(300, bpm)) }),
      setSnap: (snap) => set({ snap }),
      setPxPerSec: (px) => set({ pxPerSec: Math.max(10, Math.min(800, px)) }),
      setLoopEnabled: (loopEnabled) => set({ loopEnabled }),
      setLoopRegion: (loopRegion) => set({ loopRegion }),
      setFxSettings: (fxSettings) => set({ fxSettings }),

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

      addMidiTrack: (partial) => {
        const id = ulid()
        const order = get().tracks.length
        const track: Track = {
          id,
          name: partial?.name ?? `MIDI ${order + 1}`,
          kind: 'midi',
          color: partial?.color ?? DEFAULT_TRACK_COLORS[order % DEFAULT_TRACK_COLORS.length]!,
          gainDb: 0,
          pan: 0,
          mute: partial?.mute ?? false,
          solo: partial?.solo ?? false,
          recordArm: partial?.recordArm ?? false,
          midiOutChannel: partial?.midiOutChannel ?? 0,
          midiInChannel: partial?.midiInChannel ?? 0,
          midiOutPortId: partial?.midiOutPortId,
          midiInPortId: partial?.midiInPortId,
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

      splitSelectedAt: (timeSec) => {
        const { clips, selectedClipIds } = get()
        const newSelection: string[] = []
        const next: Clip[] = []
        for (const c of clips) {
          const isSelected = selectedClipIds.includes(c.id)
          const inside = timeSec > c.startTime && timeSec < c.startTime + c.duration
          if (!isSelected || !inside) {
            next.push(c)
            if (isSelected) newSelection.push(c.id)
            continue
          }
          const splitOffset = timeSec - c.startTime
          const left: Clip = {
            ...c,
            duration: splitOffset,
            // Fade-out at original level on the split (visually cleaner).
            fadeOut: Math.min(c.fadeOut, splitOffset),
          }
          const right: Clip = {
            ...c,
            id: ulid(),
            startTime: timeSec,
            offset: c.offset + splitOffset,
            duration: c.duration - splitOffset,
            fadeIn: Math.min(c.fadeIn, c.duration - splitOffset),
          }
          next.push(left, right)
          newSelection.push(left.id, right.id)
        }
        set({ clips: next, selectedClipIds: newSelection })
      },

      duplicateSelected: () => {
        const { clips, selectedClipIds } = get()
        if (selectedClipIds.length === 0) return
        const additions: Clip[] = []
        const newSelection: string[] = []
        for (const c of clips) {
          if (!selectedClipIds.includes(c.id)) continue
          const dup: Clip = {
            ...c,
            id: ulid(),
            startTime: c.startTime + c.duration,
            name: c.name,
          }
          additions.push(dup)
          newSelection.push(dup.id)
        }
        set((s) => ({ clips: [...s.clips, ...additions], selectedClipIds: newSelection }))
      },

      deleteSelected: () => {
        const { selectedClipIds } = get()
        if (selectedClipIds.length === 0) return
        const drop = new Set(selectedClipIds)
        set((s) => ({
          clips: s.clips.filter((c) => !drop.has(c.id)),
          selectedClipIds: [],
        }))
      },

      nudgeSelected: (deltaSec) => {
        const { selectedClipIds } = get()
        if (selectedClipIds.length === 0) return
        const drop = new Set(selectedClipIds)
        set((s) => ({
          clips: s.clips.map((c) =>
            drop.has(c.id) ? { ...c, startTime: Math.max(0, c.startTime + deltaSec) } : c,
          ),
        }))
      },

      selectClips: (ids) => set({ selectedClipIds: ids }),
      toggleClipSelected: (id) =>
        set((s) => ({
          selectedClipIds: s.selectedClipIds.includes(id)
            ? s.selectedClipIds.filter((x) => x !== id)
            : [...s.selectedClipIds, id],
        })),
      clearSelection: () => set({ selectedClipIds: [] }),

      toProject: () => {
        const s = get()
        const now = Date.now()
        return {
          id: s.projectId,
          name: s.projectName,
          sampleRate: s.sampleRate,
          bpm: s.bpm,
          tracks: s.tracks,
          clips: s.clips,
          audioAssetIds: Array.from(
            new Set(s.clips.filter((c) => c.kind === 'audio').map((c) => c.assetId)),
          ),
          loopRegion: s.loopRegion,
          loopEnabled: s.loopEnabled,
          snap: s.snap,
          pxPerSec: s.pxPerSec,
          notes: s.notes,
          fxSettings: s.fxSettings,
          createdAt: now,
          updatedAt: now,
          version: PROJECT_SCHEMA_VERSION,
        }
      },

      loadProjectData: (p) => {
        set({
          projectId: p.id,
          projectName: p.name,
          sampleRate: p.sampleRate,
          bpm: p.bpm,
          tracks: p.tracks,
          clips: p.clips,
          loopRegion: p.loopRegion,
          loopEnabled: p.loopEnabled,
          snap: p.snap,
          pxPerSec: p.pxPerSec,
          notes: p.notes ?? '',
          fxSettings: p.fxSettings ?? DEFAULT_FX_SETTINGS,
          selectedClipIds: [],
        })
        useProjectStore.temporal.getState().clear()
      },

      newProject: (name, sampleRate = 48000) => {
        set({
          projectId: ulid(),
          projectName: name,
          sampleRate,
          bpm: 120,
          tracks: defaultTracks(),
          clips: [],
          loopRegion: null,
          loopEnabled: false,
          snap: '1/16',
          pxPerSec: 80,
          notes: '',
          fxSettings: DEFAULT_FX_SETTINGS,
          selectedClipIds: [],
        })
        useProjectStore.temporal.getState().clear()
      },
    }),
    {
      // Exclude transient fields from the undo history so a Cmd+Z doesn't
      // restore your old selection or zoom alongside the structural change.
      partialize: (state) => ({
        projectName: state.projectName,
        bpm: state.bpm,
        tracks: state.tracks,
        clips: state.clips,
        loopRegion: state.loopRegion,
        loopEnabled: state.loopEnabled,
      }),
      limit: 100,
    },
  ),
)

// Bump `dirtyTick` whenever any structural field changes. Autosave watches it
// (debounced) so we don't touch IDB on every keystroke or pixel of clip drag.
const STRUCTURAL_KEYS = [
  'projectName',
  'bpm',
  'tracks',
  'clips',
  'loopRegion',
  'loopEnabled',
  'snap',
  'pxPerSec',
  'sampleRate',
  'notes',
  'fxSettings',
] as const

useProjectStore.subscribe((state, prev) => {
  for (const k of STRUCTURAL_KEYS) {
    if (state[k] !== prev[k]) {
      // Avoid an infinite loop: only set if dirtyTick didn't itself just change.
      if (state.dirtyTick === prev.dirtyTick) {
        useProjectStore.setState({ dirtyTick: state.dirtyTick + 1 })
      }
      return
    }
  }
})
