'use client'

import { Slider } from '@/components/ui/slider'
import { useProjectStore } from '@/lib/state/project-store'
import type { Track } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * One channel strip in the mixer pane.
 *
 * Shows track name, pan slider, gain fader (in dB), mute/solo buttons.
 * Wires directly to `projectStore.updateTrack`; the playback engine
 * picks up the change via `applyTracks` in `usePlaybackEngine`.
 */
export function ChannelStrip({ track }: { track: Track }) {
  const updateTrack = useProjectStore((s) => s.updateTrack)

  return (
    <div className="border-border/60 bg-panel/30 flex h-full w-24 shrink-0 flex-col items-center gap-2 border-r p-2">
      <div className="size-2.5 shrink-0 rounded-[2px]" style={{ background: track.color }} />
      <div className="w-full truncate text-center text-[11px]" title={track.name}>
        {track.name}
      </div>

      <div className="w-full">
        <div className="text-muted-foreground text-center text-[9px] tracking-wider uppercase">
          Pan
        </div>
        <Slider
          min={-1}
          max={1}
          step={0.01}
          value={track.pan}
          onValueChange={(v) => updateTrack(track.id, { pan: scalarFromSlider(v) })}
          className="mt-1 w-full"
        />
        <div className="text-muted-foreground mt-0.5 text-center text-[9px]">
          {track.pan === 0
            ? 'C'
            : track.pan > 0
              ? `R${Math.round(track.pan * 100)}`
              : `L${Math.round(-track.pan * 100)}`}
        </div>
      </div>

      <div className="flex w-full flex-1 flex-col items-center">
        <div className="text-muted-foreground text-[9px] tracking-wider uppercase">Gain</div>
        <div className="flex h-full w-full items-center justify-center">
          <Slider
            min={-60}
            max={6}
            step={0.1}
            value={track.gainDb}
            onValueChange={(v) => updateTrack(track.id, { gainDb: scalarFromSlider(v) })}
            orientation="vertical"
            className="h-full"
          />
        </div>
        <div className="text-muted-foreground font-mono-num mt-1 text-[10px]">
          {track.gainDb <= -60 ? '-∞' : `${track.gainDb.toFixed(1)} dB`}
        </div>
      </div>

      <div className="flex w-full justify-center gap-1">
        <button
          onClick={() => updateTrack(track.id, { mute: !track.mute })}
          className={cn(
            'border-border h-5 w-7 rounded-sm border text-[10px] font-bold',
            track.mute
              ? 'border-record bg-record/30 text-record'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-label="Mute"
        >
          M
        </button>
        <button
          onClick={() => updateTrack(track.id, { solo: !track.solo })}
          className={cn(
            'border-border h-5 w-7 rounded-sm border text-[10px] font-bold',
            track.solo
              ? 'border-primary bg-primary/30 text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-label="Solo"
        >
          S
        </button>
      </div>
    </div>
  )
}

function scalarFromSlider(v: number | readonly number[]): number {
  return Array.isArray(v) ? (v[0] ?? 0) : (v as number)
}
