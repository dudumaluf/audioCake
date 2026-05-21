'use client'

import { SlidersVertical } from 'lucide-react'

/**
 * Mixer placeholder. Phase 2 fills this with per-track channel strips.
 */
export function Mixer() {
  return (
    <div className="bg-panel/40 flex h-full flex-col">
      <div className="border-border/60 flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <SlidersVertical className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">Mixer</span>
        <span className="text-muted-foreground ml-2 text-[11px]">Phase 2</span>
      </div>
      <div className="text-muted-foreground flex flex-1 items-center px-4 text-center text-xs">
        Per-track channel strips will live here.
      </div>
    </div>
  )
}
