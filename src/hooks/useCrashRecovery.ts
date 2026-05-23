'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { ulid } from 'ulid'
import { deleteRecoveryBlob, listRecoveryEntries, readRecoveryBlob } from '@/lib/storage/opfs'
import { useAssetStore } from '@/lib/state/asset-store'
import type { AudioAsset } from '@/lib/types'
import { buildPeaks, buildPeaksMinMax } from '@/lib/utils/audio-math'

/**
 * Scan OPFS `recovery/` on app boot. If any sessions exist (because a
 * previous tab crashed mid-recording without a clean stop), show a
 * persistent toast offering to recover.
 *
 * Recovery imports the WAV bytes directly as a fresh AudioAsset — no
 * decode needed (the recorder writes its own valid WAV). On accept
 * the recovery file is deleted; on dismiss the toast goes away but
 * the file stays so the user can try again next boot.
 */
export function useCrashRecovery(): void {
  const triedRef = useRef(false)

  useEffect(() => {
    if (triedRef.current) return
    triedRef.current = true
    void (async () => {
      try {
        const entries = await listRecoveryEntries()
        if (entries.length === 0) return
        // Most-recent first so the user sees the freshest take.
        entries.sort((a, b) => b.lastModified - a.lastModified)
        for (const entry of entries) {
          const dateLabel = new Date(entry.lastModified).toLocaleString()
          const sizeLabel = formatBytes(entry.size)
          toast(`Unsaved take from ${dateLabel}`, {
            description: `${sizeLabel} found in recovery storage`,
            duration: Infinity,
            action: {
              label: 'Recover',
              onClick: () => {
                void recover(entry.sessionId, entry.lastModified)
              },
            },
            cancel: {
              label: 'Discard',
              onClick: () => {
                void deleteRecoveryBlob(entry.sessionId)
              },
            },
          })
        }
      } catch {
        /* OPFS might be unavailable in this browser — ignore */
      }
    })()
  }, [])
}

async function recover(sessionId: string, lastModified: number): Promise<void> {
  try {
    const blob = await readRecoveryBlob(sessionId)
    if (!blob) {
      toast.error('Recovery file disappeared')
      return
    }
    // Decode just enough to compute peaks + duration. Re-uses the live
    // AudioContext via Tone (already initialised by now in most flows).
    const ac = new AudioContext()
    const buffer = await ac.decodeAudioData(await blob.arrayBuffer())
    const channels: Float32Array[] = []
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      channels.push(buffer.getChannelData(c).slice())
    }
    void ac.close()

    const peaks = buildPeaks(channels, buffer.sampleRate)
    const peaksMinMax = buildPeaksMinMax(channels, buffer.sampleRate)
    const id = ulid()
    const asset: AudioAsset = {
      id,
      name: `Recovered ${new Date(lastModified).toLocaleTimeString()}`,
      durationSec: buffer.duration,
      sampleRate: buffer.sampleRate === 44100 ? 44100 : 48000,
      channels: channels.length === 1 ? 1 : 2,
      peaks,
      peaksMinMax,
      createdAt: Date.now(),
      sourceDevice: 'Recovered',
    }
    await useAssetStore.getState().addRecording({ asset, wavBlob: blob })
    await deleteRecoveryBlob(sessionId)
    toast.success('Take recovered', {
      description: `${asset.name} added to library`,
    })
  } catch (e) {
    toast.error('Recovery failed', { description: (e as Error).message })
  }
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}
