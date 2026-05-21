'use client'

import { Layers, Plus, Minus, Magnet, MagnetIcon } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Ruler } from './Ruler'
import { TrackHeader } from './TrackHeader'
import { TrackLane } from './TrackLane'
import { useProjectStore } from '@/lib/state/project-store'
import { useTransportStore } from '@/lib/state/transport-store'
import type { SnapResolution } from '@/lib/types'

const TRACK_HEIGHT = 64
const HEADER_WIDTH = 180

/**
 * The multi-track timeline.
 *
 * Layout: top toolbar (snap, zoom, add track), then a horizontal split
 * with the track-header column on the left and the scrollable lanes on
 * the right (lanes share their horizontal scroll with the ruler).
 */
export function Timeline() {
  const tracks = useProjectStore((s) => s.tracks)
  const clips = useProjectStore((s) => s.clips)
  const bpm = useProjectStore((s) => s.bpm)
  const pxPerSec = useProjectStore((s) => s.pxPerSec)
  const snap = useProjectStore((s) => s.snap)
  const addTrack = useProjectStore((s) => s.addTrack)
  const setSnap = useProjectStore((s) => s.setSnap)
  const setPxPerSec = useProjectStore((s) => s.setPxPerSec)
  const playheadSec = useTransportStore((s) => s.playheadSec)

  // The total timeline length in seconds: enough to fit all clips plus a
  // 16-bar runway so users have empty space to drag into.
  const totalSec = useMemo(() => {
    const clipEnd = clips.reduce((m, c) => Math.max(m, c.startTime + c.duration), 0)
    const runway = 60 // 60s of empty space past content for arrangement headroom
    return Math.max(60, clipEnd + runway)
  }, [clips])

  const lanesScrollRef = useRef<HTMLDivElement>(null)

  return (
    <div className="bg-background flex h-full flex-col">
      <div className="border-border/60 flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <Layers className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">Timeline</span>
        <div className="bg-border/80 mx-1 h-5 w-px" />

        <SnapSelector value={snap} onChange={setSnap} />

        <div className="ml-1 flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  onClick={() => setPxPerSec(pxPerSec / 1.25)}
                  aria-label="Zoom out"
                >
                  <Minus className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>Zoom out</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  onClick={() => setPxPerSec(pxPerSec * 1.25)}
                  aria-label="Zoom in"
                >
                  <Plus className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>Zoom in</TooltipContent>
          </Tooltip>
        </div>

        <Button variant="outline" size="sm" className="ml-auto" onClick={() => addTrack()}>
          <Plus className="size-3.5" />
          Track
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Track headers column */}
        <div
          className="border-border/60 flex shrink-0 flex-col border-r"
          style={{ width: HEADER_WIDTH }}
        >
          <div className="bg-panel/60 border-border/60 h-7 shrink-0 border-b" />
          <div className="overflow-y-auto">
            {tracks.map((t) => (
              <TrackHeader key={t.id} track={t} height={TRACK_HEIGHT} />
            ))}
            {tracks.length === 0 && (
              <div className="text-muted-foreground p-4 text-xs">
                No tracks yet. Click <span className="text-foreground font-medium">+ Track</span> to
                add one.
              </div>
            )}
          </div>
        </div>

        {/* Lanes (scrolls horizontally + vertically) */}
        <div ref={lanesScrollRef} className="relative flex-1 overflow-auto">
          <div style={{ width: totalSec * pxPerSec, minWidth: '100%' }} className="relative">
            <Ruler pxPerSec={pxPerSec} bpm={bpm} durationSec={totalSec} />
            <div>
              {tracks.map((t) => (
                <TrackLane
                  key={t.id}
                  track={t}
                  height={TRACK_HEIGHT}
                  pxPerSec={pxPerSec}
                  bpm={bpm}
                />
              ))}
            </div>
            <Playhead
              pxPerSec={pxPerSec}
              playheadSec={playheadSec}
              heightPx={tracks.length * TRACK_HEIGHT + 28}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function Playhead({
  pxPerSec,
  playheadSec,
  heightPx,
}: {
  pxPerSec: number
  playheadSec: number
  heightPx: number
}) {
  return (
    <div
      className="bg-primary/90 pointer-events-none absolute top-0 w-px"
      style={{ left: playheadSec * pxPerSec, height: heightPx }}
    >
      <div className="bg-primary absolute -top-1 -left-1 size-2 rotate-45 rounded-[1px]" />
    </div>
  )
}

function SnapSelector({
  value,
  onChange,
}: {
  value: SnapResolution
  onChange: (v: SnapResolution) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="text-muted-foreground flex items-center">
              {value === 'off' ? (
                <MagnetIcon className="size-3.5 opacity-40" />
              ) : (
                <Magnet className="size-3.5" />
              )}
            </span>
          }
        />
        <TooltipContent>Snap-to-grid (hold Cmd to bypass while dragging)</TooltipContent>
      </Tooltip>
      <Select value={value} onValueChange={(v) => onChange(v as SnapResolution)}>
        <SelectTrigger size="sm" className="min-w-[88px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="off">Off</SelectItem>
          <SelectItem value="bar">Bar</SelectItem>
          <SelectItem value="1/4">1/4</SelectItem>
          <SelectItem value="1/8">1/8</SelectItem>
          <SelectItem value="1/16">1/16</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
