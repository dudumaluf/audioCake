'use client'

import { Download, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { midiAssetToBlob } from '@/lib/midi/file'
import { useAssetStore } from '@/lib/state/asset-store'
import { useProjectStore } from '@/lib/state/project-store'
import type { Clip, MidiAsset, MidiNote } from '@/lib/types'

interface PianoRollEditorProps {
  clip: Clip
}

const NOTE_HEIGHT = 9
const SECOND_PX = 120
const MIN_PITCH = 24
const MAX_PITCH = 96
const PITCH_RANGE = MAX_PITCH - MIN_PITCH + 1

/**
 * Inspector piano-roll editor for the selected MIDI clip.
 *
 * Interactions:
 *   - Click empty grid → add note at that pitch + time (1/4 note long).
 *   - Click existing note → select it.
 *   - Drag selected note → move (pitch + time).
 *   - Drag right edge of a note → resize duration.
 *   - Delete key (when focus is inside the editor) → remove selected note.
 *
 * Notes are stored on the MidiAsset; we mutate via `useAssetStore.addMidi`
 * (overwrite by id). The clip itself is unaffected unless its duration
 * needs to grow to accommodate longer notes.
 */
export function PianoRollEditor({ clip }: PianoRollEditorProps) {
  const asset = useAssetStore((s) => s.midiAssets.find((a) => a.id === clip.assetId))
  const addMidi = useAssetStore((s) => s.addMidi)
  const updateClip = useProjectStore((s) => s.updateClip)
  const bpm = useProjectStore((s) => s.bpm)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const dragRef = useRef<{
    idx: number
    mode: 'move' | 'resize'
    startTime: number
    startPitch: number
    startDuration: number
    startX: number
    startY: number
  } | null>(null)

  const notes = asset?.notes ?? []
  const totalSec = Math.max(2, asset?.durationSec ?? 0)
  const width = totalSec * SECOND_PX
  const height = PITCH_RANGE * NOTE_HEIGHT

  const beatLines = useMemo(() => {
    const lines: number[] = []
    const beat = 60 / bpm
    for (let t = 0; t <= totalSec; t += beat) lines.push(t)
    return lines
  }, [bpm, totalSec])

  const writeNotes = async (next: MidiNote[]) => {
    if (!asset) return
    const dur = Math.max(...next.map((n) => n.time + n.duration), 0)
    const nextAsset: MidiAsset = { ...asset, notes: next, durationSec: dur }
    await addMidi(nextAsset)
    if (clip.duration < dur) updateClip(clip.id, { duration: dur })
  }

  const addNote = (timeSec: number, pitch: number) => {
    if (!asset) return
    const note: MidiNote = {
      time: Math.max(0, timeSec),
      duration: 60 / bpm, // 1 beat default
      pitch,
      velocity: 100,
    }
    void writeNotes([...(asset.notes ?? []), note].sort((a, b) => a.time - b.time))
  }

  const removeNote = (idx: number) => {
    if (!asset) return
    void writeNotes(asset.notes.filter((_, i) => i !== idx))
    setSelectedIdx(null)
  }

  const onSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    if ((e.target as SVGElement).dataset.role === 'note') return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    addNote(x / SECOND_PX, MAX_PITCH - Math.floor(y / NOTE_HEIGHT))
  }

  const beginNoteDrag = (
    idx: number,
    mode: 'move' | 'resize',
    e: React.PointerEvent<SVGRectElement>,
  ) => {
    e.stopPropagation()
    setSelectedIdx(idx)
    const note = notes[idx]
    if (!note) return
    ;(e.currentTarget as SVGRectElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      idx,
      mode,
      startTime: note.time,
      startPitch: note.pitch,
      startDuration: note.duration,
      startX: e.clientX,
      startY: e.clientY,
    }
  }

  const onNoteDragMove = (e: React.PointerEvent<SVGRectElement>) => {
    const drag = dragRef.current
    if (!drag || !asset) return
    const dx = (e.clientX - drag.startX) / SECOND_PX
    if (drag.mode === 'move') {
      const dy = -Math.round((e.clientY - drag.startY) / NOTE_HEIGHT)
      const next = [...asset.notes]
      next[drag.idx] = {
        ...next[drag.idx]!,
        time: Math.max(0, drag.startTime + dx),
        pitch: Math.max(MIN_PITCH, Math.min(MAX_PITCH, drag.startPitch + dy)),
      }
      void writeNotes(next)
    } else {
      const next = [...asset.notes]
      next[drag.idx] = {
        ...next[drag.idx]!,
        duration: Math.max(0.05, drag.startDuration + dx),
      }
      void writeNotes(next)
    }
  }

  const endNoteDrag = (e: React.PointerEvent<SVGRectElement>) => {
    if (!dragRef.current) return
    ;(e.currentTarget as SVGRectElement).releasePointerCapture(e.pointerId)
    dragRef.current = null
  }

  const handleExportMid = () => {
    if (!asset) return
    const blob = midiAssetToBlob(asset, bpm)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sanitize(asset.name) || 'pattern'}.mid`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('MIDI exported', { description: `${asset.name}.mid` })
  }

  if (!asset) {
    return <div className="text-muted-foreground text-xs">MIDI asset missing.</div>
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          if (selectedIdx != null) {
            e.preventDefault()
            removeNote(selectedIdx)
          }
        }
      }}
      className="focus:outline-none"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
          Piano roll — {notes.length} notes
        </span>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={handleExportMid}
            aria-label="Export .mid"
          >
            <Download className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="bg-background/40 border-border max-h-72 overflow-auto rounded-sm border">
        <svg
          width={width}
          height={height}
          onPointerDown={onSvgPointerDown}
          className="block touch-none"
        >
          {/* Octave bands every 12 semitones */}
          {Array.from({ length: PITCH_RANGE }, (_, i) => {
            const pitch = MAX_PITCH - i
            const isBlack = [1, 3, 6, 8, 10].includes(pitch % 12)
            return (
              <rect
                key={pitch}
                x={0}
                y={i * NOTE_HEIGHT}
                width={width}
                height={NOTE_HEIGHT}
                fill={isBlack ? 'rgba(255,255,255,0.04)' : 'transparent'}
              />
            )
          })}
          {/* Beat grid */}
          {beatLines.map((t, i) => (
            <line
              key={i}
              x1={t * SECOND_PX}
              x2={t * SECOND_PX}
              y1={0}
              y2={height}
              stroke="rgba(255,255,255,0.08)"
            />
          ))}
          {/* Notes */}
          {notes.map((n, i) => {
            const y = (MAX_PITCH - n.pitch) * NOTE_HEIGHT
            const x = n.time * SECOND_PX
            const w = Math.max(4, n.duration * SECOND_PX)
            const isSelected = selectedIdx === i
            return (
              <g key={i}>
                <rect
                  data-role="note"
                  x={x}
                  y={y + 1}
                  width={w}
                  height={NOTE_HEIGHT - 2}
                  rx={2}
                  fill={isSelected ? 'var(--color-primary)' : 'oklch(75% 0.18 70 / 70%)'}
                  stroke={isSelected ? 'var(--color-foreground)' : 'rgba(255,255,255,0.25)'}
                  strokeWidth={1}
                  onPointerDown={(e) => beginNoteDrag(i, 'move', e)}
                  onPointerMove={onNoteDragMove}
                  onPointerUp={endNoteDrag}
                  onPointerCancel={endNoteDrag}
                  style={{ cursor: 'grab' }}
                />
                <rect
                  data-role="note"
                  x={x + w - 4}
                  y={y + 1}
                  width={4}
                  height={NOTE_HEIGHT - 2}
                  fill="transparent"
                  onPointerDown={(e) => beginNoteDrag(i, 'resize', e)}
                  onPointerMove={onNoteDragMove}
                  onPointerUp={endNoteDrag}
                  onPointerCancel={endNoteDrag}
                  style={{ cursor: 'ew-resize' }}
                />
              </g>
            )
          })}
        </svg>
      </div>
      {selectedIdx != null && notes[selectedIdx] && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="text-muted-foreground text-[10px] tracking-wider uppercase">
            Selected note
          </div>
          <div className="text-foreground text-xs">
            Pitch {notes[selectedIdx]!.pitch} · {notes[selectedIdx]!.duration.toFixed(2)}s · vel{' '}
            {notes[selectedIdx]!.velocity}
          </div>
          <Slider
            min={1}
            max={127}
            step={1}
            value={notes[selectedIdx]!.velocity}
            onValueChange={(v) => {
              const vel = Array.isArray(v) ? (v[0] ?? 0) : (v as number)
              const next = [...notes]
              next[selectedIdx] = { ...next[selectedIdx]!, velocity: vel }
              void writeNotes(next)
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive justify-start"
            onClick={() => removeNote(selectedIdx)}
          >
            <Trash2 className="size-3.5" />
            Delete note
          </Button>
        </div>
      )}
    </div>
  )
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_ ]/g, '').trim()
}
