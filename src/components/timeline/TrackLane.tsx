'use client'

import { useMemo, useState } from 'react'
import { ClipBlock } from './ClipBlock'
import { ClipContextMenu } from './ClipContextMenu'
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
  // Select the raw clips array (referentially stable until mutated) and
  // derive the per-track slice via useMemo. Returning a fresh `.filter(...)`
  // straight from the selector violates `getServerSnapshot` / React 18+'s
  // useSyncExternalStore expectation that snapshots are reference-stable.
  const allClips = useProjectStore((s) => s.clips)
  const clips = useMemo(() => allClips.filter((c) => c.trackId === track.id), [allClips, track.id])
  const snap = useProjectStore((s) => s.snap)
  const selectedClipIds = useProjectStore((s) => s.selectedClipIds)
  const addClip = useProjectStore((s) => s.addClip)
  const selectClips = useProjectStore((s) => s.selectClips)
  const audioAssets = useAssetStore((s) => s.assets)
  const midiAssets = useAssetStore((s) => s.midiAssets)
  // `dragOver` is null when no drag is happening, 'ok' when the lane is a
  // valid drop target for the incoming asset, 'reject' when not (e.g. a
  // MIDI asset being dragged over an audio track). We can only inspect
  // `e.dataTransfer.types` during dragover, not the values themselves,
  // but that's enough to know which clip kind is in flight.
  const [dragOver, setDragOver] = useState<null | 'ok' | 'reject'>(null)

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(null)
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
    // Click on empty lane = clear selection. Skip when the click came
    // from a clip (the outer `data-role="clip"` div) or its inner body —
    // those bubble through pointer-events even though we stop pointer-down
    // propagation, so without this check selecting a clip would
    // immediately clear itself on mouse-up.
    let el: HTMLElement | null = e.target as HTMLElement
    while (el && el !== e.currentTarget) {
      const role = el.dataset.role
      if (role === 'clip' || role === 'clip-body') return
      el = el.parentElement
    }
    selectClips([])
  }

  return (
    <div
      onClick={onBackgroundClick}
      onDragOver={(e) => {
        // Only intercept drags that carry an AudioCake asset payload —
        // otherwise we'd hijack window-level drags (file uploads etc).
        const types = e.dataTransfer.types
        const isAudio = types.includes('application/x-audiocake-asset')
        const isMidi = types.includes('application/x-audiocake-midi')
        if (!isAudio && !isMidi) return
        e.preventDefault()
        const compatible = (isAudio && track.kind === 'audio') || (isMidi && track.kind === 'midi')
        // Signal compatibility to the browser too so the user sees the
        // standard "not allowed" cursor over incompatible lanes.
        e.dataTransfer.dropEffect = compatible ? 'copy' : 'none'
        const next = compatible ? 'ok' : 'reject'
        if (dragOver !== next) setDragOver(next)
      }}
      onDragLeave={(e) => {
        // Only clear if the pointer actually left the lane, not just
        // entered a child (clip block, fade handle, etc.). currentTarget
        // is the lane; relatedTarget is wherever we're entering.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setDragOver(null)
        }
      }}
      onDrop={onDrop}
      className={cn(
        'relative border-b transition-colors',
        'border-border/60',
        dragOver === 'ok' && 'bg-primary/[0.12] ring-primary/40 ring-1 ring-inset',
        dragOver === 'reject' &&
          'bg-destructive/[0.08] ring-destructive/30 cursor-not-allowed ring-1 ring-inset',
        !dragOver && 'bg-background/30 hover:bg-background/40',
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
        const block =
          c.kind === 'audio' ? (
            <ClipBlock
              clip={c}
              pxPerSec={pxPerSec}
              trackColor={track.color}
              selected={selectedClipIds.includes(c.id)}
              onSelect={onSelect}
            />
          ) : (
            <MidiClipBlock
              clip={c}
              pxPerSec={pxPerSec}
              trackColor={track.color}
              selected={selectedClipIds.includes(c.id)}
              onSelect={onSelect}
            />
          )
        return (
          <ClipContextMenu key={c.id} clip={c}>
            {block}
          </ClipContextMenu>
        )
      })}
    </div>
  )
}
