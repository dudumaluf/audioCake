'use client'

import { X } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { auditionAt } from '@/lib/audio/playback'
import { useProjectStore } from '@/lib/state/project-store'
import { useTransportStore } from '@/lib/state/transport-store'
import { snapTime, secPerBar } from '@/lib/utils/time'
import { cn } from '@/lib/utils'

interface RulerProps {
  pxPerSec: number
  bpm: number
  durationSec: number
}

/**
 * Bar/beat ruler across the top of the timeline.
 *
 * Renders bar marks + numbers + sub-beat ticks. Click anywhere to seek the
 * playhead; drag horizontally to set the loop region (also enables loop).
 */
export function Ruler({ pxPerSec, bpm, durationSec }: RulerProps) {
  const ticks = useMemo(() => {
    const barLen = secPerBar(bpm)
    const numBars = Math.ceil(durationSec / barLen) + 1
    return Array.from({ length: numBars }, (_, i) => i)
  }, [bpm, durationSec])

  const barLen = secPerBar(bpm)
  const setPlayhead = useTransportStore((s) => s.setPlayhead)
  const setLoopRegion = useProjectStore((s) => s.setLoopRegion)
  const setLoopEnabled = useProjectStore((s) => s.setLoopEnabled)
  const loopRegion = useProjectStore((s) => s.loopRegion)
  const loopEnabled = useProjectStore((s) => s.loopEnabled)
  const snap = useProjectStore((s) => s.snap)

  const dragStartRef = useRef<{ pointerX: number; rectLeft: number; time: number } | null>(null)
  const dragMovedRef = useRef(false)

  const timeFromEvent = (e: React.PointerEvent | PointerEvent, rectLeft: number): number => {
    const raw = Math.max(0, (e.clientX - rectLeft) / pxPerSec)
    return e.metaKey || e.ctrlKey ? raw : snapTime(raw, snap, bpm)
  }

  return (
    <div
      className="bg-panel/60 border-border/60 relative h-7 cursor-text border-b select-none"
      title="Click to seek (Cmd-click: silent seek). Shift+drag to set loop region."
      onPointerDown={(e) => {
        if (e.button !== 0) return
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const t = timeFromEvent(e, rect.left)
        // Shift = "set loop region" gesture: capture the pointer and start
        // a drag session that will write the loop bounds on move. Plain
        // click = seek (+ audition); Cmd+click = silent seek.
        if (e.shiftKey) {
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          dragStartRef.current = { pointerX: e.clientX, rectLeft: rect.left, time: t }
          dragMovedRef.current = false
          return
        }
        setPlayhead(t)
        if (!(e.metaKey || e.ctrlKey)) {
          const { clips } = useProjectStore.getState()
          void auditionAt(clips, t)
        }
      }}
      onPointerMove={(e) => {
        const drag = dragStartRef.current
        if (!drag) return
        if (Math.abs(e.clientX - drag.pointerX) > 3) {
          dragMovedRef.current = true
          const now = timeFromEvent(e, drag.rectLeft)
          const start = Math.min(drag.time, now)
          const end = Math.max(drag.time, now)
          setLoopRegion(end > start ? { start, end } : null)
        }
      }}
      onPointerUp={(e) => {
        if (!dragStartRef.current) return
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
        if (dragMovedRef.current) {
          setLoopEnabled(true)
        }
        dragStartRef.current = null
      }}
    >
      {ticks.map((bar) => {
        const left = bar * barLen * pxPerSec
        return (
          <div key={bar} className="pointer-events-none absolute top-0 bottom-0" style={{ left }}>
            <div className="bg-foreground/40 absolute top-0 bottom-1 left-0 w-px" />
            <span className="text-muted-foreground font-mono-num absolute top-0.5 left-1 text-[10px]">
              {bar + 1}
            </span>
            {[1, 2, 3].map((beat) => (
              <div
                key={beat}
                className="bg-foreground/15 absolute top-3 bottom-1 w-px"
                style={{ left: ((beat * barLen) / 4) * pxPerSec }}
              />
            ))}
          </div>
        )
      })}
      {loopRegion && (
        <div
          className={cn(
            'group/loop pointer-events-none absolute top-0 bottom-0 border-x',
            loopEnabled
              ? 'border-primary bg-primary/30'
              : 'border-muted-foreground/40 bg-muted-foreground/10',
          )}
          style={{
            left: loopRegion.start * pxPerSec,
            width: (loopRegion.end - loopRegion.start) * pxPerSec,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              setLoopRegion(null)
              setLoopEnabled(false)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Clear loop region"
            title="Clear loop region"
            className="bg-background/80 hover:bg-background border-border text-foreground pointer-events-auto absolute top-0.5 right-0.5 flex size-3.5 items-center justify-center rounded-sm border"
          >
            <X className="size-2.5" />
          </button>
        </div>
      )}
    </div>
  )
}
