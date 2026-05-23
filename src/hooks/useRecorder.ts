'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ulid } from 'ulid'
import {
  openInputStream,
  startLiveMonitor,
  startRecording,
  upmixToStereo,
} from '@/lib/audio/recorder'
import { encodeWav } from '@/lib/audio/wav-encoder'
import { useAssetStore } from '@/lib/state/asset-store'
import { useIOStore } from '@/lib/state/io-store'
import { getStorageEstimate, requestPersistentStorage } from '@/lib/storage/opfs'
import type { AudioAsset } from '@/lib/types'
import { buildPeaks } from '@/lib/utils/audio-math'

export type RecorderState = 'idle' | 'monitoring' | 'count-in' | 'recording' | 'saving'

/**
 * Single source of truth for the recording lifecycle.
 *
 * Lifecycle:
 *   idle → monitoring (opens stream, starts level meter)
 *   monitoring → count-in (optional 1-bar tick) → recording → saving → idle
 *
 * Why split monitoring from recording: the level meter needs the stream
 * open even when not actively capturing, so the user can see signal flow
 * and dial in their input level before hitting record. Stopping the
 * monitor closes the stream and releases the device.
 */
export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [levels, setLevels] = useState<{
    peaks: number[]
    rms: number[]
    heldPeaks: number[]
  }>({ peaks: [0], rms: [0], heldPeaks: [0] })

  const streamRef = useRef<MediaStream | null>(null)
  const monitorRef = useRef<Awaited<ReturnType<typeof startLiveMonitor>> | null>(null)
  const stopRecordRef = useRef<(() => Promise<void>) | null>(null)
  const countInTimerRef = useRef<number | null>(null)

  const { selectedInputId, selectedInputLabel, countIn } = useIOStore()
  const addRecording = useAssetStore((s) => s.addRecording)

  const stopMonitor = useCallback(() => {
    monitorRef.current?.stop()
    monitorRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (countInTimerRef.current != null) {
      window.clearTimeout(countInTimerRef.current)
      countInTimerRef.current = null
    }
    setLevels({ peaks: [0], rms: [0], heldPeaks: [0] })
  }, [])

  // Tear everything down on unmount.
  useEffect(() => {
    return () => {
      stopMonitor()
    }
  }, [stopMonitor])

  const startMonitor = useCallback(async () => {
    if (!selectedInputId) {
      toast.error('No audio input selected', {
        description: 'Pick a device in the top bar first.',
      })
      return false
    }
    try {
      const stream = await openInputStream(selectedInputId)
      streamRef.current = stream
      const monitor = await startLiveMonitor(stream, (peaks, rms, heldPeaks) => {
        setLevels({ peaks, rms, heldPeaks })
      })
      monitorRef.current = monitor
      setState('monitoring')
      return true
    } catch (e) {
      toast.error('Could not open input', { description: (e as Error).message })
      stopMonitor()
      return false
    }
  }, [selectedInputId, stopMonitor])

  const startCapture = useCallback(async () => {
    if (!streamRef.current) {
      const ok = await startMonitor()
      if (!ok) return
    }
    const stream = streamRef.current
    if (!stream) return

    // Hard cap: refuse a new capture if OPFS is already past 1 GB so we
    // don't fill up the user's quota and silently start losing data
    // mid-take. The StorageBanner has already been nagging since 500 MB.
    try {
      const est = await getStorageEstimate()
      if (est && est.usageBytes >= 1024 * 1024 * 1024) {
        toast.error('Storage full', {
          description:
            'AudioCake is using over 1 GB of browser storage. Delete some recordings or export + remove old projects before recording more.',
        })
        return
      }
    } catch {
      /* if estimate fails we err on the side of letting the user record */
    }

    const begin = async () => {
      setState('recording')
      // Use a fresh recovery session id per take. The recorder will flush
      // every 5s; on clean stop it deletes the file, on a crash the file
      // remains and the boot flow offers to recover it.
      const recoverySessionId = ulid()
      const session = await startRecording(stream, { recoverySessionId })
      stopRecordRef.current = async () => {
        setState('saving')
        const { channels, sampleRate, durationSec } = await session.stop()
        const stereo = upmixToStereo(channels)
        const peaks = buildPeaks(stereo, sampleRate)
        const id = ulid()
        const blob = encodeWav({ channels: stereo, sampleRate, bitDepth: 32 })

        const asset: AudioAsset = {
          id,
          name: defaultName(selectedInputLabel),
          durationSec,
          sampleRate: sampleRate === 44100 ? 44100 : 48000,
          channels: 2,
          peaks,
          createdAt: Date.now(),
          sourceDevice: selectedInputLabel ?? undefined,
        }

        await requestPersistentStorage()
        try {
          await addRecording({ asset, wavBlob: blob })
          toast.success('Recording saved', {
            description: `${asset.name} — ${durationSec.toFixed(1)}s`,
          })
        } catch (e) {
          toast.error('Save failed', { description: (e as Error).message })
        }
        stopRecordRef.current = null
        setState('monitoring')
      }
    }

    if (countIn) {
      setState('count-in')
      // 1-bar count-in at 120 BPM = 2 seconds. Real BPM-aware count-in
      // lands in Phase 2 with Tone.Transport.
      countInTimerRef.current = window.setTimeout(() => {
        countInTimerRef.current = null
        void begin()
      }, 2000)
    } else {
      await begin()
    }
  }, [addRecording, countIn, selectedInputLabel, startMonitor])

  const stopCapture = useCallback(async () => {
    if (countInTimerRef.current != null) {
      window.clearTimeout(countInTimerRef.current)
      countInTimerRef.current = null
      setState('monitoring')
      return
    }
    const stop = stopRecordRef.current
    if (stop) await stop()
  }, [])

  return {
    state,
    levels,
    selectedInputId,
    startMonitor,
    stopMonitor,
    startCapture,
    stopCapture,
  }
}

function defaultName(deviceLabel: string | null | undefined): string {
  const stamp = new Date()
  const hh = String(stamp.getHours()).padStart(2, '0')
  const mm = String(stamp.getMinutes()).padStart(2, '0')
  const prefix = deviceLabel ? deviceLabel.split(' ')[0] : 'Take'
  return `${prefix} ${hh}:${mm}`
}
