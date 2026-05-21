'use client'

import { Drum } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useProjectStore } from '@/lib/state/project-store'

/**
 * Tap-tempo button: averages the intervals between recent taps and writes
 * the result into `projectStore.bpm`.
 *
 * Window of 4 taps; resets if more than 2 s elapses between taps.
 */
export function TapTempo() {
  const setBpm = useProjectStore((s) => s.setBpm)
  const tapsRef = useRef<number[]>([])

  const handleTap = () => {
    const now = performance.now()
    const last = tapsRef.current[tapsRef.current.length - 1]
    if (last && now - last > 2000) {
      tapsRef.current = []
    }
    tapsRef.current.push(now)
    if (tapsRef.current.length > 4) tapsRef.current = tapsRef.current.slice(-4)
    if (tapsRef.current.length >= 2) {
      const intervals: number[] = []
      for (let i = 1; i < tapsRef.current.length; i++) {
        intervals.push(tapsRef.current[i]! - tapsRef.current[i - 1]!)
      }
      const avgMs = intervals.reduce((s, v) => s + v, 0) / intervals.length
      const bpm = 60000 / avgMs
      setBpm(Math.round(bpm * 10) / 10)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={handleTap}
            aria-label="Tap tempo"
          >
            <Drum className="size-3.5" />
          </Button>
        }
      />
      <TooltipContent>Tap tempo — averages last 4 taps</TooltipContent>
    </Tooltip>
  )
}
