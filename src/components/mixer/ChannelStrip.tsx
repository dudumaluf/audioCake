'use client'

import { Slider } from '@/components/ui/slider'
import { useProjectStore } from '@/lib/state/project-store'
import type { Track } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * One channel strip in the mixer pane.
 *
 * For audio tracks: pan slider, vertical dB gain fader, mute/solo buttons,
 * and a compact 3-band EQ ± 12 dB. MIDI tracks render a slimmer strip
 * (no gain/pan/eq — those don't apply to MIDI signal flow).
 */
export function ChannelStrip({ track }: { track: Track }) {
  const updateTrack = useProjectStore((s) => s.updateTrack)
  const eq = track.eq ?? { low: 0, mid: 0, high: 0 }
  const isMidi = track.kind === 'midi'

  return (
    <div className="border-border/60 bg-panel/30 flex h-full w-24 shrink-0 flex-col items-center gap-1 overflow-hidden border-r px-2 py-1.5">
      <div className="flex w-full shrink-0 items-center gap-1">
        <div className="size-2.5 shrink-0 rounded-[2px]" style={{ background: track.color }} />
        <div className="min-w-0 flex-1 truncate text-[11px]" title={track.name}>
          {track.name}
        </div>
      </div>

      {!isMidi && (
        <>
          <div className="w-full shrink-0">
            <EqBand
              label="HI"
              value={eq.high}
              onChange={(v) => updateTrack(track.id, { eq: { ...eq, high: v } })}
            />
            <EqBand
              label="MID"
              value={eq.mid}
              onChange={(v) => updateTrack(track.id, { eq: { ...eq, mid: v } })}
            />
            <EqBand
              label="LO"
              value={eq.low}
              onChange={(v) => updateTrack(track.id, { eq: { ...eq, low: v } })}
            />
          </div>

          <div className="w-full shrink-0">
            <SendBand
              label="REV"
              value={track.reverbSendDb ?? -60}
              onChange={(v) => updateTrack(track.id, { reverbSendDb: v })}
            />
            <SendBand
              label="DLY"
              value={track.delaySendDb ?? -60}
              onChange={(v) => updateTrack(track.id, { delaySendDb: v })}
            />
          </div>

          <div className="flex min-h-0 w-full flex-1 flex-col items-center">
            <div className="text-muted-foreground text-[9px] tracking-wider uppercase">Gain</div>
            <div className="flex min-h-0 w-full flex-1 items-center justify-center py-0.5">
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
            <div className="text-muted-foreground font-mono-num text-[9px]">
              {track.gainDb <= -60 ? '-∞' : `${track.gainDb.toFixed(1)} dB`}
            </div>
          </div>

          <div className="w-full shrink-0">
            <Slider
              min={-1}
              max={1}
              step={0.01}
              value={track.pan}
              onValueChange={(v) => updateTrack(track.id, { pan: scalarFromSlider(v) })}
              className="w-full"
            />
            <div className="text-muted-foreground text-center text-[9px]">
              PAN{' '}
              {track.pan === 0
                ? 'C'
                : track.pan > 0
                  ? `R${Math.round(track.pan * 100)}`
                  : `L${Math.round(-track.pan * 100)}`}
            </div>
          </div>
        </>
      )}
      {isMidi && <div className="text-muted-foreground my-auto text-center text-[10px]">MIDI</div>}

      <div className="flex w-full shrink-0 justify-center gap-1">
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

function EqBand({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="mb-1.5 flex flex-col items-center gap-0.5">
      <span className="text-muted-foreground text-[8px] tracking-wider uppercase">{label}</span>
      <Slider
        min={-12}
        max={12}
        step={0.5}
        value={value}
        onValueChange={(v) => onChange(scalarFromSlider(v))}
        className="w-full"
      />
      <span className="text-muted-foreground font-mono-num text-[9px]">
        {value === 0 ? '0' : value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)}
      </span>
    </div>
  )
}

/** Send slider: -60 dB = off, 0 dB = unity. Tinted differently from EQ. */
function SendBand({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="mb-1 flex flex-col items-center gap-0.5">
      <span className="text-monitor text-[8px] tracking-wider uppercase">{label}</span>
      <Slider
        min={-60}
        max={6}
        step={0.5}
        value={value}
        onValueChange={(v) => onChange(scalarFromSlider(v))}
        className="w-full"
      />
      <span className="text-muted-foreground font-mono-num text-[9px]">
        {value <= -60
          ? 'off'
          : value === 0
            ? '0'
            : value > 0
              ? `+${value.toFixed(0)}`
              : value.toFixed(0)}
      </span>
    </div>
  )
}
