'use client'

import { Library as LibraryIcon } from 'lucide-react'
import { useEffect } from 'react'
import { LibraryItem } from './LibraryItem'
import { useAssetStore } from '@/lib/state/asset-store'

/**
 * Left-sidebar clip library.
 *
 * Loads existing assets from IndexedDB on first mount; further changes
 * (new recordings, renames, deletes) flow through `useAssetStore`.
 */
export function Library() {
  const assets = useAssetStore((s) => s.assets)
  const loaded = useAssetStore((s) => s.loaded)
  const load = useAssetStore((s) => s.load)

  useEffect(() => {
    if (!loaded) void load()
  }, [load, loaded])

  return (
    <aside className="bg-panel/40 flex h-full flex-col">
      <div className="border-border/60 flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <LibraryIcon className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">Library</span>
        <span className="text-muted-foreground ml-auto text-[11px]">{assets.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {assets.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-1.5">
            {assets.map((a) => (
              <LibraryItem key={a.id} asset={a} />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function EmptyState() {
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-xs">
      <div className="border-border bg-background/40 rounded-full border p-3">
        <LibraryIcon className="size-5 opacity-60" />
      </div>
      <p className="leading-relaxed">
        Recordings will appear here. Plug in your audio device, pick it in the top bar, then hit{' '}
        <span className="text-foreground font-medium">Record</span>.
      </p>
    </div>
  )
}
