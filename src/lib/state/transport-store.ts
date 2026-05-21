import { create } from 'zustand'

/**
 * Transport state. Separate from `projectStore` because most of these
 * fields change every frame (playhead) or per gesture (playing/recording)
 * and shouldn't be wrapped by Phase 3's undo/redo history.
 */
interface TransportState {
  isPlaying: boolean
  isRecording: boolean
  /** Current playhead position in seconds. Updated by the engine via rAF. */
  playheadSec: number
  setPlaying: (on: boolean) => void
  setRecording: (on: boolean) => void
  setPlayhead: (sec: number) => void
}

export const useTransportStore = create<TransportState>((set) => ({
  isPlaying: false,
  isRecording: false,
  playheadSec: 0,
  setPlaying: (on) => set({ isPlaying: on }),
  setRecording: (on) => set({ isRecording: on }),
  setPlayhead: (sec) => set({ playheadSec: Math.max(0, sec) }),
}))
