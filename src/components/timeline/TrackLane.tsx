'use client'

import { useState } from 'react'
import { ClipBlock } from './ClipBlock'
import { MidiClipBlock } from './MidiClipBlock'
import { useAssetStore } from '@/lib/state/asset-store'
import { useProjectStore } from '@/lib/state/project-store'
import { snapTime } from '@/lib/utils/time'
import { midiAssetDuration } from '@/lib/midi/recorder'
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
  const audioAssets = useAssetStore((s) => s.assets)
  const midiAssets = useAssetStore((s) => s.midiAssets)
  const [dragOver, setDragOver] = useState(false)

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const audioAssetId = e.dataTransfer.getData('application/x-audiocake-asset')
    const midiAssetId = e.dataTransfer.getData('application/x-audiocake-midi')
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const rawTime = Math.max(0, x / pxPerSec)
    const bypassSnap = e.metaKey || e.ctrlKey
    const startTime = bypassSnap ? rawTime : snapTime(rawTime, snap, bpm)

    if (audioAssetId && track.kind === 'audio') {
      const asset = audioAssets.find((a) => a.id === audioAssetId)
      if (!asset) return
      const id = addClip({
        trackId: track.id,
        kind: 'audio',
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
    } else if (midiAssetId && track.kind === 'midi') {
      const asset = midiAssets.find((a) => a.id === midiAssetId)
      if (!asset) return
      const duration = asset.durationSec || midiAssetDuration(asset.notes) || 1
      const id = addClip({
        trackId: track.id,
        kind: 'midi',
        assetId: asset.id,
        startTime,
        offset: 0,
        duration,
        fadeIn: 0,
        fadeOut: 0,
        gainDb: 0,
        name: asset.name,
      })
      selectClips([id])
    }
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
      {clips.map((c) => {
        const onSelect = (id: string, additive: boolean) => {
          if (additive) {
            selectClips(
              selectedClipIds.includes(id)
                ? selectedClipIds.filter((s) => s !== id)
                : [...selectedClipIds, id],
            )
          } else {
            selectClips([id])
          }
        }
        if (c.kind === 'audio') {
          return (
            <ClipBlock
              key={c.id}
              clip={c}
              pxPerSec={pxPerSec}
              trackColor={track.color}
              selected={selectedClipIds.includes(c.id)}
              onSelect={onSelect}
            />
          )
        }
        return (
          <MidiClipBlock
            key={c.id}
            clip={c}
            pxPerSec={pxPerSec}
            trackColor={track.color}
            selected={selectedClipIds.includes(c.id)}
            onSelect={onSelect}
          />
        )
      })}
    </div>
  )
}
