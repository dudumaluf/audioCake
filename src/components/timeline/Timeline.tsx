'use client'

import { Layers, Magnet, MagnetIcon, Minus, Music, Plus } from 'lucide-react'
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
import { auditionAt } from '@/lib/audio/playback'
import { useProjectStore } from '@/lib/state/project-store'
import { useTransportStore } from '@/lib/state/transport-store'
import type { SnapResolution, Track } from '@/lib/types'

const TRACK_HEIGHT_AUDIO = 64
const TRACK_HEIGHT_MIDI = 86
const HEADER_WIDTH = 200

function trackHeight(t: Track): number {
  return t.kind === 'midi' ? TRACK_HEIGHT_MIDI : TRACK_HEIGHT_AUDIO
}

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
  const addMidiTrack = useProjectStore((s) => s.addMidiTrack)
  const setSnap = useProjectStore((s) => s.setSnap)
  const setPxPerSec = useProjectStore((s) => s.setPxPerSec)
  const playheadSec = useTransportStore((s) => s.playheadSec)

  const totalTrackHeight = useMemo(
    () => tracks.reduce((sum, t) => sum + trackHeight(t), 0),
    [tracks],
  )

  // The total timeline length in seconds: enough to fit all clips plus a
  // 16-bar runway so users have empty space to drag into.
  const totalSec = useMemo(() => {
    const clipEnd = clips.reduce((m, c) => Math.max(m, c.startTime + c.duration), 0)
    const runway = 60 // 60s of empty space past content for arrangement headroom
    return Math.max(60, clipEnd + runway)
  }, [clips])

  const lanesScrollRef = useRef<HTMLDivElement>(null)

  return (
    <div className="bg-background flex h-full w-full flex-col">
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

        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => addTrack()}>
            <Plus className="size-3.5" />
            Audio
          </Button>
          <Button variant="outline" size="sm" onClick={() => addMidiTrack()}>
            <Music className="size-3.5" />
            MIDI
          </Button>
        </div>
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
              <TrackHeader key={t.id} track={t} height={trackHeight(t)} />
            ))}
            {tracks.length === 0 && (
              <div className="text-muted-foreground p-4 text-xs">
                No tracks yet. Click <span className="text-foreground font-medium">+ Audio</span> or{' '}
                <span className="text-foreground font-medium">+ MIDI</span> to add one.
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
                  height={trackHeight(t)}
                  pxPerSec={pxPerSec}
                  bpm={bpm}
                />
              ))}
            </div>
            <Playhead
              pxPerSec={pxPerSec}
              playheadSec={playheadSec}
              heightPx={totalTrackHeight + 28}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Playhead overlay. The 1-px line itself stays pointer-events-none so it
 * never blocks clicks on clips beneath it. The little diamond on top is
 * pointer-events: auto and draggable for scrubbing — drag releases short
 * audition slices at each cursor position so you hear what you're moving
 * over.
 */
function Playhead({
  pxPerSec,
  playheadSec,
  heightPx,
}: {
  pxPerSec: number
  playheadSec: number
  heightPx: number
}) {
  const setPlayhead = useTransportStore((s) => s.setPlayhead)
  const dragRef = useRef<{ rectLeft: number; lastAudition: number } | null>(null)

  return (
    <div
      className="bg-primary/90 pointer-events-none absolute top-0 w-px"
      style={{ left: playheadSec * pxPerSec, height: heightPx }}
    >
      <div
        title="Drag to scrub the playhead"
        className="bg-primary pointer-events-auto absolute -top-1 -left-2 size-4 rotate-45 cursor-ew-resize rounded-[1px]"
        onPointerDown={(e) => {
          e.stopPropagation()
          if (e.button !== 0) return
          // The diamond is positioned inside the lanes scroll container.
          // We can derive the lane left edge by reading the playhead's own
          // parent's bounding box and subtracting `playheadSec * pxPerSec`.
          const playheadEl = e.currentTarget.parentElement
          if (!playheadEl) return
          const rect = playheadEl.getBoundingClientRect()
          const laneLeft = rect.left - playheadSec * pxPerSec
          dragRef.current = { rectLeft: laneLeft, lastAudition: 0 }
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current
          if (!drag) return
          const t = Math.max(0, (e.clientX - drag.rectLeft) / pxPerSec)
          setPlayhead(t)
          // Throttle auditions so we fire ~one every 120 ms while dragging.
          const now = performance.now()
          if (now - drag.lastAudition > 120) {
            drag.lastAudition = now
            const { clips } = useProjectStore.getState()
            void auditionAt(clips, t)
          }
        }}
        onPointerUp={(e) => {
          if (!dragRef.current) return
          ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
          dragRef.current = null
        }}
      />
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
