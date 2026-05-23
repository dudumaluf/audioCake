'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Small canvas-rendered waveform for the library list.
 *
 * If `peaksMinMax` (interleaved [min, max, ...]) is provided, draws the
 * actual signal envelope — top half from max, bottom half from min.
 * Falls back to mirrored RMS shape using `peaks` for assets recorded
 * before session 8 added minMax peaks.
 */
interface MiniWaveformProps {
  peaks: Float32Array
  peaksMinMax?: Float32Array
  className?: string
  active?: boolean
}

export function MiniWaveform({ peaks, peaksMinMax, className, active }: MiniWaveformProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const w = Math.max(1, Math.floor(rect.width * dpr))
    const h = Math.max(1, Math.floor(rect.height * dpr))
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, w, h)

    const color = active
      ? getCssVar('--color-primary', '#e5b463')
      : getCssVar('--color-foreground', '#e8e8e8')
    ctx.fillStyle = color
    ctx.globalAlpha = active ? 0.95 : 0.55

    const mid = h / 2

    // Preferred path: min/max peaks render the real signal shape.
    if (peaksMinMax && peaksMinMax.length >= 2) {
      // Two floats per peak window.
      const numPeaks = peaksMinMax.length / 2
      const step = numPeaks / w
      for (let x = 0; x < w; x++) {
        const start = Math.floor(x * step)
        const end = Math.max(start + 1, Math.floor((x + 1) * step))
        let lo = 0
        let hi = 0
        for (let i = start; i < end && i < numPeaks; i++) {
          const min = peaksMinMax[i * 2] ?? 0
          const max = peaksMinMax[i * 2 + 1] ?? 0
          if (min < lo) lo = min
          if (max > hi) hi = max
        }
        const yTop = Math.max(0, mid - hi * mid)
        const yBot = Math.min(h, mid - lo * mid)
        ctx.fillRect(x, yTop, 1, Math.max(1, yBot - yTop))
      }
      return
    }

    // Fallback: legacy RMS peaks (mirrored).
    if (peaks.length === 0) return
    const step = peaks.length / w
    for (let x = 0; x < w; x++) {
      const start = Math.floor(x * step)
      const end = Math.max(start + 1, Math.floor((x + 1) * step))
      let max = 0
      for (let i = start; i < end && i < peaks.length; i++) {
        const v = Math.abs(peaks[i] ?? 0)
        if (v > max) max = v
      }
      const half = Math.max(1, max * mid)
      ctx.fillRect(x, mid - half, 1, half * 2)
    }
  }, [peaks, peaksMinMax, active])

  return <canvas ref={ref} className={cn('block size-full', className)} />
}

function getCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}
