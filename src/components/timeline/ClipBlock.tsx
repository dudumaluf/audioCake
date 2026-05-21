'use client'

import { useRef, useState } from 'react'
import { MiniWaveform } from '@/components/library/MiniWaveform'
import { useAssetStore } from '@/lib/state/asset-store'
import { useProjectStore } from '@/lib/state/project-store'
import { snapTime } from '@/lib/utils/time'
import { cn } from '@/lib/utils'
import type { Clip } from '@/lib/types'

interface ClipBlockProps {
  clip: Clip
  pxPerSec: number
  trackColor: string
  selected: boolean
  onSelect: (clipId: string, additive: boolean) => void
}

/**
 * A single clip on the timeline. Renders the asset's peak waveform clipped
 * to the visible window (offset + duration), positioned absolutely along
 * the track.
 *
 * Phase 2 supports horizontal drag-reposition with snap. Trim/fade handles
 * are Phase 3.
 */
export function ClipBlock({ clip, pxPerSec, trackColor, selected, onSelect }: ClipBlockProps) {
  const asset = useAssetStore((s) => s.assets.find((a) => a.id === clip.assetId))
  const snap = useProjectStore((s) => s.snap)
  const bpm = useProjectStore((s) => s.bpm)
  const updateClip = useProjectStore((s) => s.updateClip)

  const [dragOffsetSec, setDragOffsetSec] = useState<number | null>(null)
  const dragStartRef = useRef<{ pointerX: number; startTime: number } | null>(null)

  const left = (clip.startTime + (dragOffsetSec ?? 0)) * pxPerSec
  const width = Math.max(8, clip.duration * pxPerSec)

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    onSelect(clip.id, e.shiftKey)
    if ((e.target as HTMLElement).dataset.role === 'clip-body') {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      dragStartRef.current = {
        pointerX: e.clientX,
        startTime: clip.startTime,
      }
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.pointerX
    const dt = dx / pxPerSec
    const bypassSnap = e.metaKey || e.ctrlKey
    const targetTime = Math.max(0, dragStartRef.current.startTime + dt)
    const snapped = bypassSnap ? targetTime : snapTime(targetTime, snap, bpm)
    setDragOffsetSec(snapped - dragStartRef.current.startTime)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    const newStart = Math.max(0, dragStartRef.current.startTime + (dragOffsetSec ?? 0))
    if (newStart !== clip.startTime) {
      updateClip(clip.id, { startTime: newStart })
    }
    setDragOffsetSec(null)
    dragStartRef.current = null
  }

  const visiblePeaks = useVisiblePeaks(asset?.peaks, asset?.durationSec ?? 0, clip)

  return (
    <div
      data-role="clip"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        'absolute top-1 bottom-1 cursor-grab rounded-sm border transition-shadow active:cursor-grabbing',
        selected
          ? 'border-primary shadow-[0_0_0_1px_var(--color-primary)]'
          : 'border-white/15 hover:border-white/30',
      )}
      style={{
        left,
        width,
        background: trackColor,
      }}
    >
      <div data-role="clip-body" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-90 mix-blend-overlay">
          <MiniWaveform peaks={visiblePeaks} active />
        </div>
        <div className="text-foreground/90 absolute top-0.5 left-1.5 max-w-full truncate pr-1.5 text-[10px] font-medium tracking-tight">
          {clip.name || asset?.name || 'Clip'}
        </div>
      </div>
    </div>
  )
}

/**
 * Slice the asset's peaks to the visible window (offset + duration), so the
 * clip waveform shows only the audio that will actually play.
 */
function useVisiblePeaks(
  assetPeaks: Float32Array | undefined,
  assetDuration: number,
  clip: Clip,
): Float32Array {
  if (!assetPeaks || assetPeaks.length === 0 || assetDuration <= 0) {
    return EMPTY_PEAKS
  }
  const peaksPerSec = assetPeaks.length / assetDuration
  const start = Math.max(0, Math.floor(clip.offset * peaksPerSec))
  const end = Math.min(assetPeaks.length, Math.ceil((clip.offset + clip.duration) * peaksPerSec))
  if (end <= start) return EMPTY_PEAKS
  return assetPeaks.subarray(start, end)
}

const EMPTY_PEAKS = new Float32Array(0)
