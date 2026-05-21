'use client'

import { Pause, Pencil, Play, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MiniWaveform } from './MiniWaveform'
import { useAssetStore } from '@/lib/state/asset-store'
import { onPreviewChange, playPreview, stopPreview } from '@/lib/audio/preview'
import type { AudioAsset } from '@/lib/types'
import { formatTime } from '@/lib/utils/audio-math'
import { cn } from '@/lib/utils'

/**
 * A single row in the clip library.
 *
 * Click the play icon to preview through master out. Click the name to
 * rename inline (Enter to commit, Escape to cancel). Trash icon opens a
 * confirm dialog and then removes both the OPFS file and the IDB row.
 */
export function LibraryItem({ asset }: { asset: AudioAsset }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(asset.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const rename = useAssetStore((s) => s.rename)
  const remove = useAssetStore((s) => s.remove)

  useEffect(() => {
    return onPreviewChange((id) => setIsPlaying(id === asset.id))
  }, [asset.id])

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

  const handleRemove = async () => {
    try {
      await remove(asset.id)
      toast.success('Recording deleted')
    } catch (e) {
      toast.error('Delete failed', { description: (e as Error).message })
    } finally {
      setConfirmDelete(false)
    }
  }

  return (
    <>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'copy'
          e.dataTransfer.setData('application/x-audiocake-asset', asset.id)
        }}
        className={cn(
          'group border-border/60 hover:bg-foreground/[0.04] flex flex-col gap-1.5 rounded-md border p-2 transition-colors',
          isPlaying && 'border-primary/50 bg-primary/[0.04]',
        )}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => {
              if (isPlaying) stopPreview()
              else
                void playPreview(asset.id).catch((e) =>
                  toast.error('Preview failed', { description: (e as Error).message }),
                )
            }}
            aria-label={isPlaying ? 'Stop preview' : 'Play preview'}
          >
            {isPlaying ? (
              <Pause className="size-3.5 fill-current" />
            ) : (
              <Play className="size-3.5 fill-current" />
            )}
          </Button>

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
            {formatTime(asset.durationSec)}
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

        <div className="h-9 w-full overflow-hidden rounded-sm">
          <MiniWaveform peaks={asset.peaks} active={isPlaying} />
        </div>

        {asset.sourceDevice && (
          <div className="text-muted-foreground text-[10px]">{asset.sourceDevice}</div>
        )}
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete recording?</DialogTitle>
            <DialogDescription>
              &ldquo;{asset.name}&rdquo; will be removed permanently. This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
