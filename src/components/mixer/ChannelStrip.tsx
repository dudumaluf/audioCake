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
    <div className="border-border/60 bg-panel/30 flex h-full w-[108px] shrink-0 flex-col overflow-hidden border-r">
      {/* Header — fixed at top */}
      <div className="bg-panel/60 border-border/60 flex w-full shrink-0 items-center gap-1 border-b px-2 py-1.5">
        <div className="size-2.5 shrink-0 rounded-[2px]" style={{ background: track.color }} />
        <div className="min-w-0 flex-1 truncate text-[11px]" title={track.name}>
          {track.name}
        </div>
      </div>

      {/* Body — scrolls vertically if the strip is too short for everything. */}
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto px-2 py-2">
        {!isMidi && (
          <>
            <Section label="EQ">
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
            </Section>

            <Section label="Sends" accent="monitor">
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
            </Section>

            {/* Gain — vertical fader with a hard minimum so it never
                collapses under the EQ/Sends pressure. */}
            <div className="flex w-full shrink-0 flex-col items-center">
              <div className="text-muted-foreground text-[9px] tracking-wider uppercase">Gain</div>
              <div className="flex min-h-[100px] w-full items-center justify-center py-0.5">
                <Slider
                  min={-60}
                  max={6}
                  step={0.1}
                  value={track.gainDb}
                  onValueChange={(v) => updateTrack(track.id, { gainDb: scalarFromSlider(v) })}
                  orientation="vertical"
                  className="h-[100px]"
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
        {isMidi && (
          <div className="text-muted-foreground my-auto text-center text-[10px]">MIDI</div>
        )}
      </div>

      {/* Mute / Solo — pinned to the bottom so they're always visible. */}
      <div className="border-border/60 flex w-full shrink-0 justify-center gap-1 border-t px-2 py-1.5">
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

/**
 * Lightly bordered group around a set of compact sliders so EQ and Sends
 * read as two visually distinct sections rather than a vertical pile.
 */
function Section({
  label,
  accent,
  children,
}: {
  label: string
  accent?: 'monitor'
  children: React.ReactNode
}) {
  return (
    <div className="border-border/40 bg-background/30 w-full shrink-0 rounded-sm border px-1.5 pt-0.5 pb-1">
      <div
        className={cn(
          'text-muted-foreground mb-1 text-center text-[8px] tracking-wider uppercase',
          accent === 'monitor' && 'text-monitor/80',
        )}
      >
        {label}
      </div>
      {children}
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
    <div className="mb-1 flex items-center gap-1.5">
      <span className="text-muted-foreground w-7 shrink-0 text-[8px] tracking-wider uppercase">
        {label}
      </span>
      <Slider
        min={-12}
        max={12}
        step={0.5}
        value={value}
        onValueChange={(v) => onChange(scalarFromSlider(v))}
        className="min-w-0 flex-1"
      />
      <span className="text-muted-foreground font-mono-num w-8 shrink-0 text-right text-[9px]">
        {value === 0 ? '0' : value > 0 ? `+${value.toFixed(0)}` : value.toFixed(0)}
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
    <div className="mb-1 flex items-center gap-1.5">
      <span className="text-monitor/80 w-7 shrink-0 text-[8px] tracking-wider uppercase">
        {label}
      </span>
      <Slider
        min={-60}
        max={6}
        step={0.5}
        value={value}
        onValueChange={(v) => onChange(scalarFromSlider(v))}
        className="min-w-0 flex-1"
      />
      <span className="text-muted-foreground font-mono-num w-8 shrink-0 text-right text-[9px]">
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
