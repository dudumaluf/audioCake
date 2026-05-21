'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { linearToDb } from '@/lib/utils/audio-math'

/**
 * Segmented LED-style level meter.
 *
 * Range: -60..0 dB across N segments. Below -18 dB is green, -18..-6 amber,
 * above -6 red. Held peaks render as a thin static cap on top of the live
 * peaks so the user can see momentary transients even after they decay.
 */
interface LevelMeterProps {
  peaks: number[]
  heldPeaks: number[]
  orientation?: 'horizontal' | 'vertical'
  segments?: number
  className?: string
}

const MIN_DB = -60
const MAX_DB = 0

export function LevelMeter({
  peaks,
  heldPeaks,
  orientation = 'horizontal',
  segments = 24,
  className,
}: LevelMeterProps) {
  const channels = useMemo(() => {
    const n = Math.max(peaks.length, heldPeaks.length, 1)
    const out: { live: number; held: number }[] = []
    for (let i = 0; i < n; i++) {
      out.push({
        live: dbToFraction(linearToDb(peaks[i] ?? 0)),
        held: dbToFraction(linearToDb(heldPeaks[i] ?? 0)),
      })
    }
    return out
  }, [peaks, heldPeaks])

  const isVertical = orientation === 'vertical'

  return (
    <div
      className={cn(
        'flex',
        isVertical ? 'h-full flex-row gap-[2px]' : 'w-full flex-col gap-[2px]',
        className,
      )}
      aria-label="Audio level"
    >
      {channels.map((ch, i) => (
        <div
          key={i}
          className={cn(
            'bg-background/40 border-border/60 relative overflow-hidden rounded-[2px] border',
            isVertical ? 'h-full w-2' : 'h-2 w-full',
          )}
        >
          <SegmentStrip fraction={ch.live} segments={segments} orientation={orientation} />
          <PeakCap fraction={ch.held} orientation={orientation} />
        </div>
      ))}
    </div>
  )
}

function SegmentStrip({
  fraction,
  segments,
  orientation,
}: {
  fraction: number
  segments: number
  orientation: 'horizontal' | 'vertical'
}) {
  const isVertical = orientation === 'vertical'
  const segmentSize = 100 / segments
  return (
    <div className={cn('absolute inset-0 flex', isVertical ? 'flex-col-reverse' : 'flex-row')}>
      {Array.from({ length: segments }, (_, i) => {
        const segmentFrac = (i + 1) / segments
        const lit = fraction >= segmentFrac - 0.5 / segments
        const color =
          segmentFrac > 0.92 ? 'bg-record' : segmentFrac > 0.75 ? 'bg-primary' : 'bg-monitor'
        return (
          <div
            key={i}
            className={cn(
              'transition-opacity duration-75',
              isVertical ? 'w-full' : 'h-full',
              lit ? color : 'bg-foreground/5',
            )}
            style={
              isVertical
                ? { height: `${segmentSize}%`, marginBottom: i < segments - 1 ? 1 : 0 }
                : { width: `${segmentSize}%`, marginRight: i < segments - 1 ? 1 : 0 }
            }
          />
        )
      })}
    </div>
  )
}

function PeakCap({
  fraction,
  orientation,
}: {
  fraction: number
  orientation: 'horizontal' | 'vertical'
}) {
  if (fraction <= 0) return null
  const pct = Math.min(100, fraction * 100)
  if (orientation === 'vertical') {
    return (
      <div
        className="bg-foreground absolute right-0 left-0 h-[1px] opacity-80"
        style={{ bottom: `${pct}%` }}
      />
    )
  }
  return (
    <div
      className="bg-foreground absolute top-0 bottom-0 w-[1px] opacity-80"
      style={{ left: `${pct}%` }}
    />
  )
}

function dbToFraction(db: number): number {
  if (!isFinite(db)) return 0
  if (db <= MIN_DB) return 0
  if (db >= MAX_DB) return 1
  return (db - MIN_DB) / (MAX_DB - MIN_DB)
}
