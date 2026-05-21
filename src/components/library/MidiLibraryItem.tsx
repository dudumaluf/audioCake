'use client'

import { Music, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAssetStore } from '@/lib/state/asset-store'
import type { MidiAsset } from '@/lib/types'
import { formatTime } from '@/lib/utils/audio-math'
import { cn } from '@/lib/utils'

/**
 * Library row for a MIDI asset. Drag onto a MIDI track to insert as a clip.
 *
 * Currently no preview-play (would need a soft synth or a routed MIDI output);
 * users preview by dropping onto a track and hitting play.
 */
export function MidiLibraryItem({ asset }: { asset: MidiAsset }) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(asset.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const rename = useAssetStore((s) => s.renameMidi)
  const remove = useAssetStore((s) => s.removeMidi)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commitRename = async () => {
    const next = draftName.trim()
    setEditing(false)
    if (!next || next === asset.name) {
      setDraftName(asset.name)
      return
    }
    try {
      await rename(asset.id, next)
    } catch (e) {
      toast.error('Rename failed', { description: (e as Error).message })
      setDraftName(asset.name)
    }
  }

  return (
    <>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'copy'
          e.dataTransfer.setData('application/x-audiocake-midi', asset.id)
        }}
        className={cn(
          'group border-border/60 hover:bg-foreground/[0.04] flex items-center gap-2 rounded-md border p-2 transition-colors',
        )}
      >
        <Music className="text-muted-foreground size-3.5 shrink-0" />
        {editing ? (
          <Input
            ref={inputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              else if (e.key === 'Escape') {
                setEditing(false)
                setDraftName(asset.name)
              }
            }}
            className="h-7 px-2 py-0 text-sm"
          />
        ) : (
          <button
            className="hover:text-primary truncate text-left text-sm font-medium"
            onClick={() => setEditing(true)}
            title="Click to rename"
          >
            {asset.name}
          </button>
        )}
        <span className="text-muted-foreground font-mono-num shrink-0 text-[10px]">
          {asset.notes.length} · {formatTime(asset.durationSec)}
        </span>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditing(true)}
                  aria-label="Rename"
                >
                  <Pencil className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>Rename</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive size-7"
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Delete"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete MIDI pattern?</DialogTitle>
            <DialogDescription>
              &ldquo;{asset.name}&rdquo; will be removed permanently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await remove(asset.id)
                setConfirmDelete(false)
                toast.success('MIDI deleted')
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
