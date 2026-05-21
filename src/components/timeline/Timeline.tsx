'use client'

import { Layers } from 'lucide-react'

/**
 * Timeline placeholder. Phase 2 replaces this with the real multi-track
 * arranger (ruler, tracks, clips, playhead).
 */
export function Timeline() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-border/60 flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <Layers className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">Timeline</span>
        <span className="text-muted-foreground ml-2 text-[11px]">Phase 2</span>
      </div>
      <div className="text-muted-foreground flex flex-1 items-center justify-center px-8 text-center text-sm">
        <div className="max-w-sm space-y-2">
          <p>
            The multi-track timeline lands in Phase 2. For now you can record into the library and
            play recordings back individually.
          </p>
        </div>
      </div>
    </div>
  )
}
