'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getStorageEstimate } from '@/lib/storage/opfs'
import { cn } from '@/lib/utils'

const SOFT_CAP_BYTES = 500 * 1024 * 1024 // 500 MB — warn at this point
const HARD_CAP_BYTES = 1024 * 1024 * 1024 // 1 GB — block new recordings (enforced in recorder)
const POLL_MS = 60_000

/**
 * Non-blocking banner that appears across the bottom of the screen when
 * OPFS usage crosses 500 MB. Stronger styling at 1 GB to communicate the
 * hard cap. Polls every minute (cheap; just `navigator.storage.estimate()`)
 * plus once on mount.
 */
export function StorageBanner() {
  const [usageBytes, setUsageBytes] = useState<number | null>(null)
  const [dismissedAtBytes, setDismissedAtBytes] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const est = await getStorageEstimate()
        if (cancelled) return
        setUsageBytes(est?.usageBytes ?? null)
      } catch {
        /* ignore */
      }
    }
    void poll()
    const t = window.setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [])

  if (usageBytes == null) return null
  if (usageBytes < SOFT_CAP_BYTES) return null
  // Dismissal is sticky for this session up to the next 100 MB crossed —
  // user gets reminded if they keep recording.
  if (dismissedAtBytes != null && usageBytes < dismissedAtBytes + 100 * 1024 * 1024) {
    return null
  }

  const overHard = usageBytes >= HARD_CAP_BYTES
  const usageMb = (usageBytes / 1024 / 1024).toFixed(0)

  return (
    <div
      className={cn(
        'pointer-events-auto fixed right-4 bottom-4 z-50 flex max-w-md items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-lg backdrop-blur',
        overHard
          ? 'border-destructive/60 bg-destructive/15 text-foreground'
          : 'border-primary/60 bg-panel/95 text-foreground',
      )}
    >
      <AlertTriangle
        className={cn('mt-0.5 size-4 shrink-0', overHard ? 'text-destructive' : 'text-primary')}
      />
      <div className="flex-1 leading-relaxed">
        <div className="font-medium">
          {overHard ? 'Storage limit reached' : 'Storage getting full'}
        </div>
        <div className="text-muted-foreground mt-0.5 text-xs">
          AudioCake is using {usageMb} MB of browser storage.{' '}
          {overHard
            ? 'New recordings are blocked until you clean up older projects or delete unused recordings from the library.'
            : 'Consider exporting + archiving older projects, or deleting recordings you no longer need.'}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground -mt-1 -mr-1 size-7 shrink-0"
        aria-label="Dismiss"
        onClick={() => setDismissedAtBytes(usageBytes)}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}
