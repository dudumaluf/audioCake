'use client'

import { SlidersVertical } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ChannelStrip } from './ChannelStrip'
import { FxDialog } from './FxDialog'
import { LevelMeter } from '@/components/io/LevelMeter'
import { getMasterMeter } from '@/lib/audio/playback'
import { useProjectStore } from '@/lib/state/project-store'

/**
 * Mixer pane: horizontal strip of channel strips, with a master output
 * meter on the right.
 */
export function Mixer() {
  const tracks = useProjectStore((s) => s.tracks)
  const masterLevels = useMasterMeter()

  return (
    <div className="bg-panel/40 flex h-full w-full flex-col">
      <div className="border-border/60 flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <SlidersVertical className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">Mixer</span>
      </div>
      <div className="flex flex-1 overflow-x-auto">
        {tracks.map((t) => (
          <ChannelStrip key={t.id} track={t} />
        ))}
        <div className="border-border/60 bg-panel/30 ml-auto flex w-24 shrink-0 flex-col items-center gap-2 border-l p-2">
          <div className="flex w-full items-center justify-between gap-1">
            <div className="text-muted-foreground text-[10px] tracking-wider uppercase">Master</div>
            <FxDialog />
          </div>
          <div className="flex h-full w-full justify-center px-2">
            <LevelMeter
              peaks={masterLevels.peaks}
              heldPeaks={masterLevels.heldPeaks}
              orientation="vertical"
              segments={32}
              className="h-full max-w-[28px]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Polls Tone's master Meter at 60 Hz and derives a peak-hold envelope
 * locally. Simpler than building a worklet for the master since Tone
 * already exposes it.
 */
function useMasterMeter() {
  const [levels, setLevels] = useState<{ peaks: number[]; heldPeaks: number[] }>({
    peaks: [0, 0],
    heldPeaks: [0, 0],
  })

  useEffect(() => {
    let raf = 0
    let cancelled = false
    const held = [0, 0]
    const heldUntil = [0, 0]
    const tick = () => {
      if (cancelled) return
      const meter = getMasterMeter()
      const v = meter?.getValue()
      const arr = Array.isArray(v) ? v : v != null ? [v as number, v as number] : [0, 0]
      const peaks = arr.map((x) => Math.abs(x as number))
      const now = performance.now() / 1000
      for (let i = 0; i < peaks.length; i++) {
        if (peaks[i]! >= held[i]!) {
          held[i] = peaks[i]!
          heldUntil[i] = now + 1.5
        } else if (now > heldUntil[i]!) {
          held[i] = Math.max(peaks[i]!, held[i]! * 0.99)
        }
      }
      setLevels({ peaks, heldPeaks: held.slice() })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [])

  return levels
}
