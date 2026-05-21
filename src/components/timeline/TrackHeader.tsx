'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useProjectStore } from '@/lib/state/project-store'
import type { Track } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TrackHeaderProps {
  track: Track
  height: number
}

/**
 * Per-track row header. Name + M/S buttons; finer mixing (pan, gain
 * faders, meters) lives in the Mixer pane.
 */
export function TrackHeader({ track, height }: TrackHeaderProps) {
  const updateTrack = useProjectStore((s) => s.updateTrack)
  const removeTrack = useProjectStore((s) => s.removeTrack)

  return (
    <div
      className="border-border/60 bg-panel/40 group/track flex items-center gap-2 border-b px-2"
      style={{ height }}
    >
      <div className="size-2.5 shrink-0 rounded-[2px]" style={{ background: track.color }} />
      <input
        value={track.name}
        onChange={(e) => updateTrack(track.id, { name: e.target.value })}
        className="hover:bg-background/40 focus:bg-background/40 min-w-0 flex-1 truncate rounded-sm bg-transparent px-1 py-0.5 text-xs outline-none"
      />
      <div className="flex shrink-0 gap-0.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                onClick={() => updateTrack(track.id, { mute: !track.mute })}
                className={cn(
                  'border-border h-5 w-5 rounded-sm border text-[10px] font-bold',
                  track.mute
                    ? 'border-record bg-record/30 text-record'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-label="Mute"
              >
                M
              </button>
            }
          />
          <TooltipContent>Mute</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                onClick={() => updateTrack(track.id, { solo: !track.solo })}
                className={cn(
                  'border-border h-5 w-5 rounded-sm border text-[10px] font-bold',
                  track.solo
                    ? 'border-primary bg-primary/30 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-label="Solo"
              >
                S
              </button>
            }
          />
          <TooltipContent>Solo</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive size-5 opacity-0 transition-opacity group-hover/track:opacity-100"
                onClick={() => removeTrack(track.id)}
                aria-label="Delete track"
              >
                <Trash2 className="size-3" />
              </Button>
            }
          />
          <TooltipContent>Delete track (clips on it are removed too)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
