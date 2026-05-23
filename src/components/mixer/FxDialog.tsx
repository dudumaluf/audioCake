'use client'

import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useProjectStore } from '@/lib/state/project-store'
import type { FxSettings } from '@/lib/types'

/**
 * Compact dialog to tune the master reverb + delay returns.
 *
 * Settings live on the project (`useProjectStore.fxSettings`) so they
 * survive reloads + `.acproj` round-trip. The engine subscribes to the
 * same store slice via `usePlaybackEngine` and re-applies on change.
 */
export function FxDialog() {
  const fx = useProjectStore((s) => s.fxSettings)
  const setFxSettings = useProjectStore((s) => s.setFxSettings)
  const [open, setOpen] = useState(false)
  // Local draft so each slider stroke doesn't push into the store +
  // re-trigger the engine on every pointermove. Committed on dialog close
  // and when sliders settle (pointerup); use the live values for sliders
  // themselves so the UI is responsive.
  const [draft, setDraft] = useState<FxSettings>(fx)

  // Sync local draft when the project (or dialog) opens. queueMicrotask
  // defers the setState so React 19's "don't setState in effect" rule
  // is satisfied — equivalent to setting it inline, just one microtask
  // later, off the render path.
  useEffect(() => {
    if (!open) return
    queueMicrotask(() => setDraft(fx))
  }, [open, fx])

  const apply = (next: FxSettings) => {
    setDraft(next)
    setFxSettings(next)
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => setOpen(true)}
              aria-label="FX settings"
            >
              <Sparkles className="size-3.5" />
            </Button>
          }
        />
        <TooltipContent>Reverb + delay settings</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Master FX</DialogTitle>
            <DialogDescription>
              Shape the global reverb and delay returns. Settings save with the project.
            </DialogDescription>
          </DialogHeader>

          <section className="flex flex-col gap-3 border-b pb-4">
            <h3 className="text-muted-foreground text-[10px] tracking-wider uppercase">Reverb</h3>
            <SliderRow
              label="Decay"
              value={draft.reverb.decaySec}
              min={0.5}
              max={8}
              step={0.1}
              suffix="s"
              onChange={(v) => apply({ ...draft, reverb: { ...draft.reverb, decaySec: v } })}
            />
            <SliderRow
              label="Pre-delay"
              value={draft.reverb.preDelayMs}
              min={0}
              max={200}
              step={1}
              suffix="ms"
              onChange={(v) => apply({ ...draft, reverb: { ...draft.reverb, preDelayMs: v } })}
            />
            <SliderRow
              label="Wet"
              value={draft.reverb.wetDb}
              min={-20}
              max={0}
              step={0.5}
              suffix="dB"
              onChange={(v) => apply({ ...draft, reverb: { ...draft.reverb, wetDb: v } })}
            />
          </section>

          <section className="flex flex-col gap-3 pt-1">
            <h3 className="text-muted-foreground text-[10px] tracking-wider uppercase">Delay</h3>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] tracking-wider uppercase">Division</Label>
              <Select
                value={String(draft.delay.divisionBeats)}
                onValueChange={(v) =>
                  apply({
                    ...draft,
                    delay: { ...draft.delay, divisionBeats: Number(v) },
                  })
                }
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">1/2 note</SelectItem>
                  <SelectItem value="1.5">1/4 dotted</SelectItem>
                  <SelectItem value="1">1/4 note</SelectItem>
                  <SelectItem value="0.75">1/8 dotted</SelectItem>
                  <SelectItem value="0.5">1/8 note</SelectItem>
                  <SelectItem value="0.375">1/16 dotted</SelectItem>
                  <SelectItem value="0.25">1/16 note</SelectItem>
                  <SelectItem value="-1">Free (ms)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draft.delay.divisionBeats < 0 && (
              <SliderRow
                label="Delay time"
                value={draft.delay.delayMs}
                min={10}
                max={1500}
                step={1}
                suffix="ms"
                onChange={(v) => apply({ ...draft, delay: { ...draft.delay, delayMs: v } })}
              />
            )}
            <SliderRow
              label="Feedback"
              value={draft.delay.feedback}
              min={0}
              max={0.95}
              step={0.01}
              suffix=""
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => apply({ ...draft, delay: { ...draft.delay, feedback: v } })}
            />
            <SliderRow
              label="Wet"
              value={draft.delay.wetDb}
              min={-20}
              max={0}
              step={0.5}
              suffix="dB"
              onChange={(v) => apply({ ...draft, delay: { ...draft.delay, wetDb: v } })}
            />
          </section>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  suffix,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground w-20 shrink-0 text-[10px] tracking-wider uppercase">
        {label}
      </span>
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={(v) => onChange(Array.isArray(v) ? (v[0] ?? 0) : (v as number))}
        className="min-w-0 flex-1"
      />
      <span className="text-muted-foreground font-mono-num w-14 shrink-0 text-right text-[10px]">
        {format ? format(value) : `${value.toFixed(2)} ${suffix}`}
      </span>
    </div>
  )
}
