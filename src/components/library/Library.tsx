'use client'

import { Library as LibraryIcon, Music } from 'lucide-react'
import { useEffect } from 'react'
import { LibraryItem } from './LibraryItem'
import { MidiLibraryItem } from './MidiLibraryItem'
import { useAssetStore } from '@/lib/state/asset-store'

/**
 * Left-sidebar clip library.
 *
 * Loads existing assets from IndexedDB on first mount; further changes
 * (new recordings, renames, deletes) flow through `useAssetStore`.
 */
export function Library() {
  const assets = useAssetStore((s) => s.assets)
  const midiAssets = useAssetStore((s) => s.midiAssets)
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
        <span className="text-muted-foreground ml-auto text-[11px]">
          {assets.length + midiAssets.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {assets.length === 0 && midiAssets.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {assets.length > 0 && (
              <section>
                <SectionHeader label="Audio" count={assets.length} />
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {assets.map((a) => (
                    <LibraryItem key={a.id} asset={a} />
                  ))}
                </div>
              </section>
            )}
            {midiAssets.length > 0 && (
              <section>
                <SectionHeader
                  label="MIDI"
                  count={midiAssets.length}
                  icon={<Music className="size-3" />}
                />
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {midiAssets.map((a) => (
                    <MidiLibraryItem key={a.id} asset={a} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

function SectionHeader({
  label,
  count,
  icon,
}: {
  label: string
  count: number
  icon?: React.ReactNode
}) {
  return (
    <div className="text-muted-foreground flex items-center gap-1 text-[10px] tracking-wider uppercase">
      {icon}
      <span>{label}</span>
      <span className="ml-auto">{count}</span>
    </div>
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
