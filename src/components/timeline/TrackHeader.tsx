'use client'

import { Circle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMidi } from '@/hooks/useMidi'
import { useProjectStore } from '@/lib/state/project-store'
import type { Track } from '@/lib/types'
import { cn } from '@/lib/utils'

const TRACK_COLORS = [
  'oklch(75% 0.18 70)', // amber
  'oklch(75% 0.14 200)', // teal
  'oklch(70% 0.16 145)', // green
  'oklch(70% 0.18 320)', // magenta
  'oklch(70% 0.20 30)', // red-orange
  'oklch(70% 0.18 250)', // blue
  'oklch(80% 0.10 90)', // yellow
  'oklch(60% 0.06 0)', // slate
]

interface TrackHeaderProps {
  track: Track
  height: number
}

/**
 * Per-track row header in the timeline.
 *
 * Audio tracks show name + M / S buttons. MIDI tracks also expose record-arm,
 * input port + channel pickers, and output port + channel pickers because
 * that's the routing every MIDI clip on the track will use.
 */
export function TrackHeader({ track, height }: TrackHeaderProps) {
  const updateTrack = useProjectStore((s) => s.updateTrack)
  const removeTrack = useProjectStore((s) => s.removeTrack)
  const midi = useMidi()

  return (
    <div
      className="border-border/60 bg-panel/40 group/track flex flex-col gap-1 border-b px-2 py-1"
      style={{ height }}
    >
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                aria-label="Pick track color"
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ background: track.color }}
              />
            }
          />
          <DropdownMenuContent align="start" className="w-auto p-1.5">
            <div className="grid grid-cols-4 gap-1">
              {TRACK_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => updateTrack(track.id, { color })}
                  className={cn(
                    'size-5 rounded-sm border transition-transform hover:scale-110',
                    track.color === color ? 'border-foreground' : 'border-transparent',
                  )}
                  style={{ background: color }}
                  aria-label={`Color ${color}`}
                />
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          value={track.name}
          onChange={(e) => updateTrack(track.id, { name: e.target.value })}
          className="hover:bg-background/40 focus:bg-background/40 min-w-0 flex-1 truncate rounded-sm bg-transparent px-1 py-0.5 text-xs outline-none"
        />
        <div className="flex shrink-0 gap-0.5">
          {track.kind === 'midi' && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={() => updateTrack(track.id, { recordArm: !track.recordArm })}
                    className={cn(
                      'border-border flex size-5 items-center justify-center rounded-sm border',
                      track.recordArm
                        ? 'border-record bg-record/30 text-record'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                    aria-label="Arm for MIDI record"
                  >
                    <Circle className="size-2.5 fill-current" />
                  </button>
                }
              />
              <TooltipContent>Arm for MIDI recording</TooltipContent>
            </Tooltip>
          )}
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
            <TooltipContent>Delete track</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {track.kind === 'midi' && (
        // Two rows (IN + OUT) instead of one cramped strip: makes the
        // routing readable in the 200px header width and lets each side
        // have its own channel selector. Selectors tint green when a
        // port is assigned, dimmed when not.
        <div className="flex flex-col gap-0.5">
          <PortRow
            label="IN"
            port={track.midiInPortId ?? ''}
            channel={track.midiInChannel ?? 0}
            ports={midi.inputs}
            disabled={!midi.available || !midi.ready}
            onPortChange={(id) => updateTrack(track.id, { midiInPortId: id || undefined })}
            onChannelChange={(ch) => updateTrack(track.id, { midiInChannel: ch })}
          />
          <PortRow
            label="OUT"
            port={track.midiOutPortId ?? ''}
            channel={track.midiOutChannel ?? 0}
            ports={midi.outputs}
            disabled={!midi.available || !midi.ready}
            onPortChange={(id) => updateTrack(track.id, { midiOutPortId: id || undefined })}
            onChannelChange={(ch) => updateTrack(track.id, { midiOutChannel: ch })}
          />
        </div>
      )}
    </div>
  )
}

function PortRow({
  label,
  port,
  channel,
  ports,
  disabled,
  onPortChange,
  onChannelChange,
}: {
  label: string
  port: string
  channel: number
  ports: { id: string; name: string }[]
  disabled?: boolean
  onPortChange: (id: string) => void
  onChannelChange: (ch: number) => void
}) {
  const assigned = !!port
  return (
    <div
      className={cn(
        'flex items-center gap-1 text-[9px] tracking-wider uppercase',
        assigned ? 'text-foreground/80' : 'text-muted-foreground',
      )}
    >
      <span className={cn('w-6 shrink-0', assigned && 'text-monitor')}>{label}</span>
      <select
        value={port}
        onChange={(e) => onPortChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'bg-background border-border min-w-0 flex-1 truncate rounded-sm border px-1 py-0.5 text-[10px] tracking-normal normal-case',
          assigned && 'border-monitor/40',
        )}
      >
        <option value="">— none —</option>
        {ports.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        max={16}
        value={channel + 1}
        onChange={(e) => {
          const n = Math.max(1, Math.min(16, Number.parseInt(e.target.value, 10) || 1))
          onChannelChange(n - 1)
        }}
        title="MIDI channel"
        className="bg-background border-border w-7 shrink-0 rounded-sm border px-1 py-0.5 text-center text-[10px] tracking-normal normal-case"
      />
    </div>
  )
}
