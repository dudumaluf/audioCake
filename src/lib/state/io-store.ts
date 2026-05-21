import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Audio input device + recording settings state.
 *
 * Persists across reloads so the user doesn't have to reselect their
 * Roland every time they open the app.
 */
interface IOState {
  /** MediaDeviceInfo.deviceId for the currently selected input. */
  selectedInputId: string | null
  /** Last-known label of the selected input, used to find it again after a re-enumeration. */
  selectedInputLabel: string | null
  /** When true, route input to master output. Adds round-trip latency; off by default. */
  softwareMonitoring: boolean
  /** When true, play a 1-bar metronome count-in before recording starts. */
  countIn: boolean

  setSelectedInput: (id: string | null, label: string | null) => void
  setSoftwareMonitoring: (on: boolean) => void
  setCountIn: (on: boolean) => void
}

export const useIOStore = create<IOState>()(
  persist(
    (set) => ({
      selectedInputId: null,
      selectedInputLabel: null,
      softwareMonitoring: false,
      countIn: true,
      setSelectedInput: (id, label) => set({ selectedInputId: id, selectedInputLabel: label }),
      setSoftwareMonitoring: (on) => set({ softwareMonitoring: on }),
      setCountIn: (on) => set({ countIn: on }),
    }),
    { name: 'audiocake:io' },
  ),
)
