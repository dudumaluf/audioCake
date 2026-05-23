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
 * A single clip on the timeline.
 *
 * Three interaction zones:
 *   - body drag: reposition the clip (`startTime`) with snap
 *   - left/right edge drag: trim (`offset` + `duration`), non-destructive
 *   - top corner drag (fade handles): adjust `fadeIn` / `fadeOut`
 *
 * All edits are committed to `projectStore.updateClip` on pointerup so the
 * undo history records one entry per gesture (not per frame).
 */
type DragMode = 'move' | 'trim-left' | 'trim-right' | 'fade-in' | 'fade-out'

interface DragStart {
  pointerX: number
  mode: DragMode
  start: number
  offset: number
  duration: number
  fadeIn: number
  fadeOut: number
}

export function ClipBlock({ clip, pxPerSec, trackColor, selected, onSelect }: ClipBlockProps) {
  const asset = useAssetStore((s) => s.assets.find((a) => a.id === clip.assetId))
  const snap = useProjectStore((s) => s.snap)
  const bpm = useProjectStore((s) => s.bpm)
  const updateClip = useProjectStore((s) => s.updateClip)

  const [preview, setPreview] = useState<Partial<Clip> | null>(null)
  const dragStartRef = useRef<DragStart | null>(null)

  // Apply the preview overlay on top of the committed clip while dragging.
  const live: Clip = preview ? { ...clip, ...preview } : clip

  const left = live.startTime * pxPerSec
  const width = Math.max(8, live.duration * pxPerSec)
  const fadeInPx = Math.min(width, live.fadeIn * pxPerSec)
  const fadeOutPx = Math.min(width, live.fadeOut * pxPerSec)

  const beginDrag = (mode: DragMode, e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    onSelect(clip.id, e.shiftKey)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragStartRef.current = {
      pointerX: e.clientX,
      mode,
      start: clip.startTime,
      offset: clip.offset,
      duration: clip.duration,
      fadeIn: clip.fadeIn,
      fadeOut: clip.fadeOut,
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragStartRef.current
    if (!drag) return
    const dx = e.clientX - drag.pointerX
    const dt = dx / pxPerSec
    const bypassSnap = e.metaKey || e.ctrlKey
    const snapped = (t: number) => (bypassSnap ? Math.max(0, t) : snapTime(t, snap, bpm))
    const maxDuration = asset ? asset.durationSec - drag.offset : drag.duration

    switch (drag.mode) {
      case 'move': {
        setPreview({ startTime: snapped(drag.start + dt) })
        break
      }
      case 'trim-left': {
        // Trimming the left edge moves both `startTime` and `offset` and
        // shrinks `duration`. Clamp to source bounds.
        const reqOffset = Math.max(0, drag.offset + dt)
        const newOffset = Math.min(asset ? asset.durationSec - 0.05 : reqOffset, reqOffset)
        const delta = newOffset - drag.offset
        const newDuration = Math.max(0.05, drag.duration - delta)
        const newStart = snapped(drag.start + delta)
        const startDelta = newStart - drag.start
        setPreview({
          startTime: newStart,
          offset: drag.offset + startDelta,
          duration: Math.max(0.05, drag.duration - startDelta),
          fadeIn: Math.min(drag.fadeIn, newDuration),
        })
        break
      }
      case 'trim-right': {
        const reqDuration = Math.max(0.05, drag.duration + dt)
        const newDuration = Math.min(maxDuration, reqDuration)
        setPreview({
          duration: newDuration,
          fadeOut: Math.min(drag.fadeOut, newDuration),
        })
        break
      }
      case 'fade-in': {
        const newFadeIn = Math.max(0, Math.min(drag.duration, drag.fadeIn + dt))
        setPreview({ fadeIn: newFadeIn })
        break
      }
      case 'fade-out': {
        const newFadeOut = Math.max(0, Math.min(drag.duration, drag.fadeOut - dt))
        setPreview({ fadeOut: newFadeOut })
        break
      }
    }
  }

  const endDrag = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    if (preview) {
      const patch: Partial<Clip> = {}
      for (const key of ['startTime', 'offset', 'duration', 'fadeIn', 'fadeOut'] as const) {
        const v = preview[key]
        if (v !== undefined && v !== clip[key]) {
          ;(patch as Record<string, number>)[key] = v
        }
      }
      if (Object.keys(patch).length > 0) updateClip(clip.id, patch)
    }
    setPreview(null)
    dragStartRef.current = null
  }

  const visiblePeaks = useVisiblePeaks(asset?.peaks, asset?.durationSec ?? 0, live)
  const visiblePeaksMinMax = useVisiblePeaksMinMax(
    asset?.peaksMinMax,
    asset?.durationSec ?? 0,
    live,
  )

  return (
    <div
      data-role="clip"
      onPointerDown={(e) => beginDrag('move', e)}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
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
          <MiniWaveform peaks={visiblePeaks} peaksMinMax={visiblePeaksMinMax} active />
        </div>
        {/* Fade-in shadow */}
        {fadeInPx > 1 && (
          <div
            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-black/50 to-transparent"
            style={{ width: fadeInPx }}
          />
        )}
        {/* Fade-out shadow */}
        {fadeOutPx > 1 && (
          <div
            className="absolute top-0 right-0 bottom-0 bg-gradient-to-l from-black/50 to-transparent"
            style={{ width: fadeOutPx }}
          />
        )}
        <div className="text-foreground/90 absolute top-0.5 left-1.5 max-w-full truncate pr-1.5 text-[10px] font-medium tracking-tight">
          {live.name || asset?.name || 'Clip'}
        </div>
      </div>

      {/* Trim handles. Edge zones; subtle visual on hover/selected. */}
      <div
        onPointerDown={(e) => beginDrag('trim-left', e)}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          'absolute top-0 bottom-0 left-0 w-1.5 cursor-ew-resize',
          selected ? 'bg-primary/40' : 'hover:bg-white/30',
        )}
      />
      <div
        onPointerDown={(e) => beginDrag('trim-right', e)}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          'absolute top-0 right-0 bottom-0 w-1.5 cursor-ew-resize',
          selected ? 'bg-primary/40' : 'hover:bg-white/30',
        )}
      />

      {/* Fade handles (top corners). Small triangles, only visible on selected. */}
      {selected && (
        <>
          <div
            onPointerDown={(e) => beginDrag('fade-in', e)}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="bg-primary absolute top-0 size-2 cursor-ew-resize"
            style={{
              left: Math.max(0, fadeInPx - 4),
              clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
            }}
            title={`Fade in: ${live.fadeIn.toFixed(2)}s`}
          />
          <div
            onPointerDown={(e) => beginDrag('fade-out', e)}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="bg-primary absolute top-0 size-2 cursor-ew-resize"
            style={{
              right: Math.max(0, fadeOutPx - 4),
              clipPath: 'polygon(0 0, 100% 0, 0 100%)',
            }}
            title={`Fade out: ${live.fadeOut.toFixed(2)}s`}
          />
        </>
      )}
    </div>
  )
}

function useVisiblePeaks(
  assetPeaks: Float32Array | undefined,
  assetDuration: number,
  clip: Clip,
): Float32Array {
  if (!assetPeaks || assetPeaks.length === 0 || assetDuration <= 0) return EMPTY_PEAKS
  const peaksPerSec = assetPeaks.length / assetDuration
  const start = Math.max(0, Math.floor(clip.offset * peaksPerSec))
  const end = Math.min(assetPeaks.length, Math.ceil((clip.offset + clip.duration) * peaksPerSec))
  if (end <= start) return EMPTY_PEAKS
  return assetPeaks.subarray(start, end)
}

/** Same as useVisiblePeaks but for the interleaved [min,max] flavour —
 *  index math needs the *2 because each peak window takes two floats. */
function useVisiblePeaksMinMax(
  assetPeaks: Float32Array | undefined,
  assetDuration: number,
  clip: Clip,
): Float32Array | undefined {
  if (!assetPeaks || assetPeaks.length === 0 || assetDuration <= 0) return undefined
  const numPeaks = assetPeaks.length / 2
  const peaksPerSec = numPeaks / assetDuration
  const startPeak = Math.max(0, Math.floor(clip.offset * peaksPerSec))
  const endPeak = Math.min(numPeaks, Math.ceil((clip.offset + clip.duration) * peaksPerSec))
  if (endPeak <= startPeak) return undefined
  return assetPeaks.subarray(startPeak * 2, endPeak * 2)
}

const EMPTY_PEAKS = new Float32Array(0)
