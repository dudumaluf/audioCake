'use client'

import { Layers } from 'lucide-react'
import { ClipBlock } from './ClipBlock'
import { ClipContextMenu } from './ClipContextMenu'
import { MidiClipBlock } from './MidiClipBlock'
import { useProjectStore } from '@/lib/state/project-store'
import type { Clip } from '@/lib/types'
import { cn } from '@/lib/utils'

const STRIPE_HEIGHT = 8 // px per sibling stripe under the active take

interface TakeFolderStackProps {
  /** All clips in the same take-folder group. */
  takes: Clip[]
  trackColor: string
  pxPerSec: number
  selectedClipIds: string[]
  onSelect: (id: string, additive: boolean) => void
}

/**
 * Render a take folder: the active take takes the bulk of the lane
 * height; the other takes appear as thin stripes underneath, in time
 * with the active take's horizontal extent. Click a stripe to promote
 * that take to active.
 *
 * Inactive stripes show the take's start/duration (might be slightly
 * different from the active take's), so you can see at-a-glance which
 * alternative was longer/shorter.
 */
export function TakeFolderStack({
  takes,
  trackColor,
  pxPerSec,
  selectedClipIds,
  onSelect,
}: TakeFolderStackProps) {
  const promoteTake = useProjectStore((s) => s.promoteTake)

  const active = takes.find((t) => t.isActiveTake !== false) ?? takes[0]!
  const inactive = takes.filter((t) => t.id !== active.id)

  // Active take consumes the lane minus the room reserved for the
  // sibling stripes (rendered absolutely as siblings of the active block).
  const stripesHeight = inactive.length * STRIPE_HEIGHT

  return (
    <>
      {/* Active take: full lane height minus the reserved stripe row.
          We don't set pointer-events: none here because the ClipBlock
          inside needs its own pointer events (drag, trim, fade handles).
          The badge below uses pointer-events-none on itself so it
          doesn't block dragging the active take. */}
      <div className="absolute top-0 right-0 left-0" style={{ bottom: stripesHeight }}>
        <ClipContextMenu clip={active}>
          {active.kind === 'audio' ? (
            <ClipBlock
              clip={active}
              pxPerSec={pxPerSec}
              trackColor={trackColor}
              selected={selectedClipIds.includes(active.id)}
              onSelect={onSelect}
            />
          ) : (
            <MidiClipBlock
              clip={active}
              pxPerSec={pxPerSec}
              trackColor={trackColor}
              selected={selectedClipIds.includes(active.id)}
              onSelect={onSelect}
            />
          )}
        </ClipContextMenu>
        {/* Folder badge: tiny count chip in the top-right of the active
            take so it's obvious there's a stack here. pointer-events-none
            so it doesn't intercept clip dragging. */}
        <div className="bg-background/80 text-foreground/90 pointer-events-none absolute top-0.5 right-0.5 z-10 flex items-center gap-1 rounded-sm px-1 py-px text-[9px] tracking-wide">
          <Layers className="size-2.5" />
          {takes.length}
        </div>
      </div>

      {/* Inactive takes: stripes stacked at the bottom of the lane */}
      {inactive.map((t, i) => (
        <button
          key={t.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            promoteTake(t.id)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Switch to take "${t.name}"`}
          title={`Switch to take "${t.name}"`}
          className={cn(
            'absolute cursor-pointer rounded-[2px] border opacity-60 transition-opacity hover:opacity-100',
            selectedClipIds.includes(t.id)
              ? 'border-primary opacity-100'
              : 'border-white/10 hover:border-white/30',
          )}
          style={{
            left: t.startTime * pxPerSec,
            width: t.duration * pxPerSec,
            bottom: i * STRIPE_HEIGHT + 1,
            height: STRIPE_HEIGHT - 2,
            background: trackColor,
          }}
        />
      ))}
    </>
  )
}
