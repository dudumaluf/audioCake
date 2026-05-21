'use client'

import { useState } from 'react'
import { ClipBlock } from './ClipBlock'
import { useAssetStore } from '@/lib/state/asset-store'
import { useProjectStore } from '@/lib/state/project-store'
import { snapTime } from '@/lib/utils/time'
import type { Track } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TrackLaneProps {
  track: Track
  height: number
  pxPerSec: number
  bpm: number
}

/**
 * One horizontal lane: the visual strip on the right side of the track
 * header. Renders all clips assigned to this track and accepts drops from
 * the library (which carry an `assetId` via `dataTransfer`).
 */
export function TrackLane({ track, height, pxPerSec, bpm }: TrackLaneProps) {
  const clips = useProjectStore((s) => s.clips.filter((c) => c.trackId === track.id))
  const snap = useProjectStore((s) => s.snap)
  const selectedClipIds = useProjectStore((s) => s.selectedClipIds)
  const addClip = useProjectStore((s) => s.addClip)
  const selectClips = useProjectStore((s) => s.selectClips)
  const assets = useAssetStore((s) => s.assets)
  const [dragOver, setDragOver] = useState(false)

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const assetId = e.dataTransfer.getData('application/x-audiocake-asset')
    if (!assetId) return
    const asset = assets.find((a) => a.id === assetId)
    if (!asset) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const rawTime = Math.max(0, x / pxPerSec)
    const bypassSnap = e.metaKey || e.ctrlKey
    const startTime = bypassSnap ? rawTime : snapTime(rawTime, snap, bpm)
    const id = addClip({
      trackId: track.id,
      assetId: asset.id,
      startTime,
      offset: 0,
      duration: asset.durationSec,
      fadeIn: 0,
      fadeOut: 0,
      gainDb: 0,
      name: asset.name,
    })
    selectClips([id])
  }

  const onBackgroundClick = (e: React.MouseEvent) => {
    // Click on empty lane = clear selection; clicks bubbling from clips
    // are stopped by ClipBlock so we won't get here.
    if ((e.target as HTMLElement).dataset.role !== 'clip-body') {
      selectClips([])
    }
  }

  return (
    <div
      onClick={onBackgroundClick}
      onDragOver={(e) => {
        e.preventDefault()
        if (!dragOver) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={cn(
        'relative border-b',
        'border-border/60',
        dragOver ? 'bg-primary/[0.06]' : 'bg-background/30 hover:bg-background/40',
      )}
      style={{ height }}
    >
      {clips.map((c) => (
        <ClipBlock
          key={c.id}
          clip={c}
          pxPerSec={pxPerSec}
          trackColor={track.color}
          selected={selectedClipIds.includes(c.id)}
          onSelect={(id, additive) => {
            if (additive) {
              selectClips(
                selectedClipIds.includes(id)
                  ? selectedClipIds.filter((s) => s !== id)
                  : [...selectedClipIds, id],
              )
            } else {
              selectClips([id])
            }
          }}
        />
      ))}
    </div>
  )
}
