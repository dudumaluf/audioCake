'use client'

import { Check, CloudUpload, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAutosaveStore } from '@/lib/state/autosave-store'
import { cn } from '@/lib/utils'

/**
 * Tiny topbar indicator that says whether the project is saved, queued
 * for save, or actively writing to IndexedDB. Updates the "X ago" label
 * every 15 s so it doesn't get stale.
 */
export function AutosaveIndicator() {
  const status = useAutosaveStore((s) => s.status)
  const lastSavedAt = useAutosaveStore((s) => s.lastSavedAt)
  // The React 19 Compiler considers `Date.now()` impure, so we lift the
  // "now" value into state and refresh it every 15s — that gives us a
  // moving relative timestamp while keeping the render itself pure.
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(t)
  }, [])

  const label =
    status === 'saving'
      ? 'Saving…'
      : status === 'pending'
        ? 'Unsaved changes'
        : lastSavedAt
          ? `Saved ${formatAgo(now - lastSavedAt)}`
          : 'Saved'

  const Icon = status === 'saving' ? CloudUpload : status === 'pending' ? Pencil : Check

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              'text-muted-foreground flex shrink-0 items-center gap-1 text-[10px] tracking-wide tabular-nums select-none',
              status === 'pending' && 'text-primary',
              status === 'saving' && 'text-monitor',
            )}
            aria-live="polite"
          >
            <Icon className="size-3" />
            <span className="hidden md:inline">{label}</span>
          </div>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function formatAgo(ms: number): string {
  if (ms < 5_000) return 'just now'
  if (ms < 60_000) return `${Math.round(ms / 1000)} s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min ago`
  return `${Math.round(ms / 3_600_000)} h ago`
}
