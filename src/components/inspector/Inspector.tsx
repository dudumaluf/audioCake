'use client'

import { Sliders } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { useAssetStore } from '@/lib/state/asset-store'
import { useProjectStore } from '@/lib/state/project-store'
import { formatTime } from '@/lib/utils/audio-math'
import type { Clip } from '@/lib/types'

/**
 * Inspector for the currently-selected clip(s).
 *
 * For a single selection we show the full editing panel (name, position,
 * trim, fades, gain). For multi-selection we show a summary plus a couple
 * of bulk actions (gain + fades). Empty state when nothing is selected.
 */
export function Inspector() {
  const selectedIds = useProjectStore((s) => s.selectedClipIds)
  const clips = useProjectStore((s) => s.clips)
  const selected = clips.filter((c) => selectedIds.includes(c.id))

  return (
    <aside className="bg-panel/40 flex h-full flex-col">
      <div className="border-border/60 flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <Sliders className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">Inspector</span>
        {selected.length > 0 && (
          <span className="text-muted-foreground ml-auto text-[11px]">
            {selected.length === 1 ? '1 clip' : `${selected.length} clips`}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {selected.length === 0 ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-center text-xs">
            Click a clip to inspect.
          </div>
        ) : selected.length === 1 ? (
          <SingleClipInspector clip={selected[0]!} />
        ) : (
          <MultiClipInspector clips={selected} />
        )}
      </div>
    </aside>
  )
}

function SingleClipInspector({ clip }: { clip: Clip }) {
  const updateClip = useProjectStore((s) => s.updateClip)
  const asset = useAssetStore((s) => s.assets.find((a) => a.id === clip.assetId))
  const maxFade = Math.max(0.01, clip.duration)
  const maxDuration = asset ? asset.durationSec - clip.offset : clip.duration

  return (
    <div className="flex flex-col gap-4">
      <Field label="Name">
        <Input
          value={clip.name}
          onChange={(e) => updateClip(clip.id, { name: e.target.value })}
          className="h-7 px-2 text-xs"
        />
      </Field>

      {asset && (
        <Field label="Source">
          <div className="text-muted-foreground text-xs">
            {asset.name} · {formatTime(asset.durationSec)}
          </div>
        </Field>
      )}

      <NumberField
        label="Position"
        suffix="s"
        value={clip.startTime}
        min={0}
        step={0.01}
        onChange={(v) => updateClip(clip.id, { startTime: Math.max(0, v) })}
      />

      <NumberField
        label="Offset"
        suffix="s"
        value={clip.offset}
        min={0}
        max={asset ? asset.durationSec - 0.05 : undefined}
        step={0.01}
        onChange={(v) => updateClip(clip.id, { offset: Math.max(0, v) })}
      />

      <NumberField
        label="Duration"
        suffix="s"
        value={clip.duration}
        min={0.05}
        max={maxDuration}
        step={0.01}
        onChange={(v) =>
          updateClip(clip.id, { duration: Math.max(0.05, Math.min(maxDuration, v)) })
        }
      />

      <SliderField
        label="Fade in"
        valueLabel={`${clip.fadeIn.toFixed(2)} s`}
        value={clip.fadeIn}
        min={0}
        max={maxFade}
        step={0.01}
        onChange={(v) => updateClip(clip.id, { fadeIn: v })}
      />

      <SliderField
        label="Fade out"
        valueLabel={`${clip.fadeOut.toFixed(2)} s`}
        value={clip.fadeOut}
        min={0}
        max={maxFade}
        step={0.01}
        onChange={(v) => updateClip(clip.id, { fadeOut: v })}
      />

      <SliderField
        label="Gain"
        valueLabel={clip.gainDb <= -60 ? '-∞ dB' : `${clip.gainDb.toFixed(1)} dB`}
        value={clip.gainDb}
        min={-60}
        max={12}
        step={0.1}
        onChange={(v) => updateClip(clip.id, { gainDb: v })}
      />
    </div>
  )
}

function MultiClipInspector({ clips }: { clips: Clip[] }) {
  const updateClip = useProjectStore((s) => s.updateClip)

  // For multi-selection, only expose bulk actions where it makes sense.
  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground text-xs">
        Editing {clips.length} clips. Per-clip values are preserved; sliders apply a delta.
      </div>
      <SliderField
        label="Gain offset"
        valueLabel="apply"
        value={0}
        min={-12}
        max={12}
        step={0.5}
        onChange={(v) => {
          for (const c of clips) {
            updateClip(c.id, { gainDb: Math.max(-60, Math.min(12, c.gainDb + v)) })
          }
        }}
      />
      <SliderField
        label="Set fade in (all)"
        valueLabel="s"
        value={0}
        min={0}
        max={2}
        step={0.01}
        onChange={(v) => {
          for (const c of clips) {
            updateClip(c.id, { fadeIn: Math.min(c.duration, v) })
          }
        }}
      />
      <SliderField
        label="Set fade out (all)"
        valueLabel="s"
        value={0}
        min={0}
        max={2}
        step={0.01}
        onChange={(v) => {
          for (const c of clips) {
            updateClip(c.id, { fadeOut: Math.min(c.duration, v) })
          }
        }}
      />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-muted-foreground text-[10px] tracking-wider uppercase">{label}</div>
      {children}
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value.toFixed(2)}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number.parseFloat(e.target.value)
            if (Number.isFinite(n)) onChange(n)
          }}
          className="h-7 px-2 text-xs"
        />
        {suffix && <span className="text-muted-foreground text-[10px]">{suffix}</span>}
      </div>
    </Field>
  )
}

function SliderField({
  label,
  value,
  valueLabel,
  onChange,
  min,
  max,
  step,
}: {
  label: string
  value: number
  valueLabel: string
  onChange: (v: number) => void
  min: number
  max: number
  step: number
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <Slider
          value={value}
          min={min}
          max={max}
          step={step}
          onValueChange={(v) => onChange(Array.isArray(v) ? (v[0] ?? 0) : (v as number))}
          className="w-full"
        />
        <span className="text-muted-foreground font-mono-num w-14 text-right text-[10px]">
          {valueLabel}
        </span>
      </div>
    </Field>
  )
}
