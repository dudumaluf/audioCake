'use client'

import { Sliders } from 'lucide-react'

/**
 * Inspector placeholder. Phase 3 surfaces selected-clip properties here
 * (trim, fade, gain, time-stretch).
 */
export function Inspector() {
  return (
    <aside className="bg-panel/40 flex h-full flex-col">
      <div className="border-border/60 flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <Sliders className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">Inspector</span>
      </div>
      <div className="text-muted-foreground flex flex-1 items-center justify-center px-4 text-center text-xs">
        Nothing selected.
      </div>
    </aside>
  )
}
