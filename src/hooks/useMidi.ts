'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ensureMidiAccess,
  isWebMidiAvailable,
  listInputs,
  listOutputs,
  onMidiPortsChange,
  type MidiPortInfo,
} from '@/lib/midi/engine'

export interface UseMidiPorts {
  available: boolean
  inputs: MidiPortInfo[]
  outputs: MidiPortInfo[]
  /** True once we've successfully called `requestMIDIAccess`. */
  ready: boolean
  refresh: () => void
}

/**
 * Discover Web MIDI ports and keep the list in sync with `statechange`
 * (devices plugged in / out).
 *
 * Browsers that don't expose Web MIDI (currently Firefox) return
 * `available: false` so the UI can show a "MIDI unavailable" banner
 * without crashing.
 */
export function useMidi(): UseMidiPorts {
  const [ready, setReady] = useState(false)
  const [inputs, setInputs] = useState<MidiPortInfo[]>([])
  const [outputs, setOutputs] = useState<MidiPortInfo[]>([])

  const refresh = useCallback(() => {
    setInputs(listInputs())
    setOutputs(listOutputs())
  }, [])

  useEffect(() => {
    if (!isWebMidiAvailable()) return
    let cancelled = false
    queueMicrotask(async () => {
      const access = await ensureMidiAccess()
      if (cancelled || !access) return
      setReady(true)
      refresh()
    })
    const unsub = onMidiPortsChange(refresh)
    return () => {
      cancelled = true
      unsub()
    }
  }, [refresh])

  return {
    available: isWebMidiAvailable(),
    inputs,
    outputs,
    ready,
    refresh,
  }
}
