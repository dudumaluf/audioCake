'use client'

import { useRef, useState } from 'react'
import { useAssetStore } from '@/lib/state/asset-store'
import { useProjectStore } from '@/lib/state/project-store'
import { snapTime } from '@/lib/utils/time'
import { cn } from '@/lib/utils'
import type { Clip } from '@/lib/types'

interface MidiClipBlockProps {
  clip: Clip
  pxPerSec: number
  trackColor: string
  selected: boolean
  onSelect: (clipId: string, additive: boolean) => void
}

/**
 * Mini piano-roll for a MIDI clip on the timeline.
 *
 * Each note is rendered as a small rectangle whose vertical position is
 * its pitch (mapped into the clip's height) and horizontal position is
 * its time within the clip. Selected clips also expose the standard
 * trim handles; full piano-roll editing lives in the Inspector.
 */
type DragMode = 'move' | 'trim-left' | 'trim-right'

interface DragStart {
  pointerX: number
  mode: DragMode
  start: number
  offset: number
  duration: number
}

export function MidiClipBlock({
  clip,
  pxPerSec,
  trackColor,
  selected,
  onSelect,
}: MidiClipBlockProps) {
  const asset = useAssetStore((s) => s.midiAssets.find((a) => a.id === clip.assetId))
  const snap = useProjectStore((s) => s.snap)
  const bpm = useProjectStore((s) => s.bpm)
  const updateClip = useProjectStore((s) => s.updateClip)

  const [preview, setPreview] = useState<Partial<Clip> | null>(null)
  const dragStartRef = useRef<DragStart | null>(null)
  const live: Clip = preview ? { ...clip, ...preview } : clip

  const left = live.startTime * pxPerSec
  const width = Math.max(8, live.duration * pxPerSec)

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
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragStartRef.current
    if (!drag) return
    const dx = e.clientX - drag.pointerX
    const dt = dx / pxPerSec
    const bypassSnap = e.metaKey || e.ctrlKey
    const snapped = (t: number) => (bypassSnap ? Math.max(0, t) : snapTime(t, snap, bpm))

    switch (drag.mode) {
      case 'move':
        setPreview({ startTime: snapped(drag.start + dt) })
        break
      case 'trim-left': {
        const reqOffset = Math.max(0, drag.offset + dt)
        const delta = reqOffset - drag.offset
        const newStart = snapped(drag.start + delta)
        const startDelta = newStart - drag.start
        setPreview({
          startTime: newStart,
          offset: drag.offset + startDelta,
          duration: Math.max(0.05, drag.duration - startDelta),
        })
        break
      }
      case 'trim-right': {
        const newDuration = Math.max(0.05, drag.duration + dt)
        setPreview({ duration: newDuration })
        break
      }
    }
  }

  const endDrag = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    if (preview) {
      const patch: Partial<Clip> = {}
      for (const key of ['startTime', 'offset', 'duration'] as const) {
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

  return (
    <div
      data-role="clip"
      onPointerDown={(e) => beginDrag('move', e)}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn(
        'absolute top-1 bottom-1 cursor-grab overflow-hidden rounded-sm border transition-shadow active:cursor-grabbing',
        selected
          ? 'border-primary shadow-[0_0_0_1px_var(--color-primary)]'
          : 'border-white/15 hover:border-white/30',
      )}
      style={{ left, width, background: trackColor }}
    >
      <PianoRollMini notes={asset?.notes ?? []} offset={live.offset} duration={live.duration} />
      <div className="text-foreground/90 absolute top-0.5 left-1.5 max-w-full truncate pr-1.5 text-[10px] font-medium tracking-tight">
        {live.name || asset?.name || 'MIDI'}
      </div>
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
    </div>
  )
}

/**
 * Tiny SVG piano-roll preview painted inside a MIDI clip. Auto-fits the
 * pitch range of the visible notes so even a 1-bar bass line is readable.
 */
function PianoRollMini({
  notes,
  offset,
  duration,
}: {
  notes: Array<{ time: number; duration: number; pitch: number; velocity: number }>
  offset: number
  duration: number
}) {
  if (notes.length === 0 || duration <= 0) return null
  const visible = notes.filter((n) => n.time + n.duration > offset && n.time < offset + duration)
  if (visible.length === 0) return null
  const minPitch = Math.min(...visible.map((n) => n.pitch))
  const maxPitch = Math.max(...visible.map((n) => n.pitch))
  const pitchRange = Math.max(1, maxPitch - minPitch + 1)

  return (
    <svg
      className="absolute inset-0 size-full opacity-75 mix-blend-overlay"
      preserveAspectRatio="none"
      viewBox={`0 0 ${duration * 1000} ${pitchRange * 100}`}
    >
      {visible.map((n, i) => {
        const x = Math.max(0, n.time - offset) * 1000
        const w = Math.min(duration, n.time + n.duration - offset) * 1000 - x
        const y = (maxPitch - n.pitch) * 100
        return (
          <rect
            key={i}
            x={x}
            y={y + 4}
            width={Math.max(2, w)}
            height={92}
            rx={6}
            fill="white"
            fillOpacity={0.55 + 0.45 * (n.velocity / 127)}
          />
        )
      })}
    </svg>
  )
}
