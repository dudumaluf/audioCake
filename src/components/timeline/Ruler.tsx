'use client'

import { useMemo } from 'react'
import { secPerBar } from '@/lib/utils/time'

interface RulerProps {
  pxPerSec: number
  bpm: number
  durationSec: number
}

/**
 * Bar/beat ruler across the top of the timeline.
 *
 * Renders a heavy mark + bar number at each bar, a light mark at each beat.
 * Drawn as DOM (not canvas) so it scales with browser zoom and is easy to
 * extend (clickable seek in Phase 3).
 */
export function Ruler({ pxPerSec, bpm, durationSec }: RulerProps) {
  const ticks = useMemo(() => {
    const barLen = secPerBar(bpm)
    const numBars = Math.ceil(durationSec / barLen) + 1
    return Array.from({ length: numBars }, (_, i) => i)
  }, [bpm, durationSec])

  const barLen = secPerBar(bpm)

  return (
    <div className="bg-panel/60 border-border/60 relative h-7 border-b">
      {ticks.map((bar) => {
        const left = bar * barLen * pxPerSec
        return (
          <div key={bar} className="absolute top-0 bottom-0" style={{ left }}>
            <div className="bg-foreground/40 absolute top-0 bottom-1 left-0 w-px" />
            <span className="text-muted-foreground font-mono-num absolute top-0.5 left-1 text-[10px]">
              {bar + 1}
            </span>
            {/* Beat marks 2, 3, 4 inside the bar. */}
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
    </div>
  )
}
