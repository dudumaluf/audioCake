'use client'

import { Copy, RotateCcw, Scissors, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '@/lib/state/project-store'
import { useTransportStore } from '@/lib/state/transport-store'
import type { Clip } from '@/lib/types'
import { cn } from '@/lib/utils'

const TRACK_COLORS = [
  'oklch(75% 0.18 70)',
  'oklch(75% 0.14 200)',
  'oklch(70% 0.16 145)',
  'oklch(70% 0.18 320)',
  'oklch(70% 0.20 30)',
  'oklch(70% 0.18 250)',
  'oklch(80% 0.10 90)',
  'oklch(60% 0.06 0)',
]

/**
 * Right-click context menu for clip blocks. Wraps `children` with a
 * ContextMenu trigger so the existing pointer-down (select / drag) logic
 * keeps working; only right-click pops the menu.
 *
 * Items match the keyboard shortcuts so the menu also serves as a
 * discoverability layer.
 */
export function ClipContextMenu({ clip, children }: { clip: Clip; children: React.ReactNode }) {
  const updateClip = useProjectStore((s) => s.updateClip)
  const removeClip = useProjectStore((s) => s.removeClip)
  const duplicateSelected = useProjectStore((s) => s.duplicateSelected)
  const splitSelectedAt = useProjectStore((s) => s.splitSelectedAt)
  const selectClips = useProjectStore((s) => s.selectClips)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameDraft, setRenameDraft] = useState(clip.name)

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          // `display: contents` so this trigger doesn't introduce a layout
          // wrapper that would break the absolute-positioned ClipBlock /
          // MidiClipBlock children. The context handler still fires.
          className="contents"
          // Make sure this single clip is the selection target so the
          // bulk actions (split, duplicate) act on it even if it wasn't
          // selected before the right-click.
          onContextMenu={() => selectClips([clip.id])}
        >
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel className="text-[10px] uppercase">
            {clip.kind === 'midi' ? 'MIDI clip' : 'Audio clip'}
          </ContextMenuLabel>
          <ContextMenuItem
            onClick={() => {
              setRenameDraft(clip.name)
              setRenameOpen(true)
            }}
          >
            Rename…
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => duplicateSelected()}>
            <Copy className="size-3.5" />
            Duplicate
            <ContextMenuShortcut>⌘D</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => splitSelectedAt(useTransportStore.getState().playheadSec)}
          >
            <Scissors className="size-3.5" />
            Split at playhead
            <ContextMenuShortcut>S</ContextMenuShortcut>
          </ContextMenuItem>
          {clip.kind === 'audio' && (
            <ContextMenuItem onClick={() => updateClip(clip.id, { reverse: !clip.reverse })}>
              <RotateCcw className="size-3.5" />
              {clip.reverse ? 'Un-reverse' : 'Reverse'}
            </ContextMenuItem>
          )}
          <ContextMenuSub>
            <ContextMenuSubTrigger>Colour</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <div className="grid grid-cols-4 gap-1 p-1.5">
                {TRACK_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      // Colour lives on the track in current model; setting a
                      // per-clip colour overrides via `clip.name` is more invasive.
                      // For now we re-colour the parent track since that's where
                      // the chip lives. (Per-clip colour can come later as a
                      // separate field.)
                      const projectStore = useProjectStore.getState()
                      const track = projectStore.tracks.find((t) => t.id === clip.trackId)
                      if (track) projectStore.updateTrack(track.id, { color })
                    }}
                    className={cn(
                      'size-5 rounded-sm border transition-transform hover:scale-110',
                      'border-transparent',
                    )}
                    style={{ background: color }}
                    aria-label={`Colour ${color}`}
                  />
                ))}
              </div>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => removeClip(clip.id)} className="text-destructive">
            <Trash2 className="size-3.5" />
            Delete
            <ContextMenuShortcut>⌫</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Rename clip</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateClip(clip.id, { name: renameDraft.trim() || clip.name })
                setRenameOpen(false)
              } else if (e.key === 'Escape') {
                setRenameOpen(false)
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                updateClip(clip.id, { name: renameDraft.trim() || clip.name })
                setRenameOpen(false)
              }}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
