import { create } from 'zustand'

export type AutosaveStatus = 'saved' | 'pending' | 'saving'

interface AutosaveState {
  status: AutosaveStatus
  lastSavedAt: number | null
  setStatus: (status: AutosaveStatus) => void
  markSaved: () => void
}

/**
 * Tracks the autosave lifecycle so the topbar can show "Saved 5s ago" /
 * "Saving…" / "Unsaved changes" without subscribing to dirtyTick directly.
 *
 * Kept separate from the project store so this UI signal isn't part of
 * undo/redo or the structural autosave dirty tick itself.
 */
export const useAutosaveStore = create<AutosaveState>((set) => ({
  status: 'saved',
  lastSavedAt: null,
  setStatus: (status) => set({ status }),
  markSaved: () => set({ status: 'saved', lastSavedAt: Date.now() }),
}))
