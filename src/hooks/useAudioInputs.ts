'use client'

import { useCallback, useEffect, useState } from 'react'

export interface AudioInputDevice {
  deviceId: string
  label: string
}

export interface UseAudioInputs {
  devices: AudioInputDevice[]
  /** True once we have device labels (i.e. user granted at least one getUserMedia). */
  labelsAvailable: boolean
  /** Errors during enumeration (permissions denied, no devices, etc.). */
  error: string | null
  /**
   * Trigger a permissions prompt by opening a brief stream. Needed once
   * before device labels become visible per the MediaDevices spec.
   */
  requestPermission: () => Promise<boolean>
  /** Re-enumerate on demand (devicechange does this automatically). */
  refresh: () => void
}

/**
 * Enumerate audio input devices and keep the list in sync with hardware
 * connect/disconnect events.
 *
 * Browser spec: until the user has granted any audio permission, device
 * labels come back as empty strings. We surface that with `labelsAvailable`
 * so the UI can prompt for permission with a friendly call-to-action.
 */
export function useAudioInputs(): UseAudioInputs {
  const [devices, setDevices] = useState<AudioInputDevice[]>([])
  const [labelsAvailable, setLabelsAvailable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enumerate = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setError('This browser does not expose audio input devices.')
      return
    }
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      const inputs = list
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Unnamed input' }))
      setDevices(inputs)
      setLabelsAvailable(inputs.some((d) => d.label && d.label !== 'Unnamed input'))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      // We don't keep the stream; the spec only needs the permission grant.
      stream.getTracks().forEach((t) => t.stop())
      await enumerate()
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }, [enumerate])

  useEffect(() => {
    let cancelled = false
    const handler = () => {
      if (!cancelled) void enumerate()
    }
    // Defer the initial fetch off the render path so React's strict
    // "no setState directly in effect" lint is satisfied. Functionally
    // equivalent to calling enumerate() inline — the result still arrives
    // via the same async setState path inside enumerate().
    queueMicrotask(handler)
    navigator.mediaDevices?.addEventListener?.('devicechange', handler)
    return () => {
      cancelled = true
      navigator.mediaDevices?.removeEventListener?.('devicechange', handler)
    }
  }, [enumerate])

  return {
    devices,
    labelsAvailable,
    error,
    requestPermission,
    refresh: enumerate,
  }
}
