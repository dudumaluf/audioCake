import { ensureRunning, getAudioContext } from './engine'
import { readAudioBlob } from '@/lib/storage/opfs'

/**
 * Tiny preview player for the clip library.
 *
 * One asset plays at a time: starting a new preview cancels the previous
 * one so the user can quickly audition recordings without overlapping
 * playback. The real multi-track player arrives in Phase 2 with Tone.js.
 */

let currentSource: AudioBufferSourceNode | null = null
let currentAssetId: string | null = null
const decodeCache = new Map<string, AudioBuffer>()
const listeners = new Set<(playingId: string | null) => void>()

function notify(playingId: string | null) {
  currentAssetId = playingId
  for (const l of listeners) l(playingId)
}

export function onPreviewChange(listener: (playingId: string | null) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getPlayingPreviewId(): string | null {
  return currentAssetId
}

export function stopPreview(): void {
  if (currentSource) {
    try {
      currentSource.stop()
    } catch {
      /* already stopped */
    }
    currentSource = null
  }
  notify(null)
}

export async function playPreview(assetId: string): Promise<void> {
  const ctx = await ensureRunning()
  stopPreview()

  let buffer = decodeCache.get(assetId)
  if (!buffer) {
    const blob = await readAudioBlob(assetId)
    if (!blob) throw new Error('Audio not found for preview')
    const arr = await blob.arrayBuffer()
    buffer = await ctx.decodeAudioData(arr.slice(0))
    decodeCache.set(assetId, buffer)
  }

  const source = getAudioContext().createBufferSource()
  source.buffer = buffer
  source.connect(getAudioContext().destination)
  source.onended = () => {
    if (currentSource === source) {
      currentSource = null
      notify(null)
    }
  }
  source.start()
  currentSource = source
  notify(assetId)
}

export function clearPreviewCache(): void {
  decodeCache.clear()
}
