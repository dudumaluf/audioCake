'use client'

import { Library as LibraryIcon, Music, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LibraryItem } from './LibraryItem'
import { MidiLibraryItem } from './MidiLibraryItem'
import { importAudioFile } from '@/lib/audio/import'
import { useAssetStore } from '@/lib/state/asset-store'
import { cn } from '@/lib/utils'

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

  const [dragOver, setDragOver] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    for (const f of Array.from(files)) {
      if (!/\.(wav|mp3|aiff?|flac|m4a|ogg|opus)$/i.test(f.name)) {
        toast.error('Unsupported file', { description: f.name })
        continue
      }
      try {
        await importAudioFile(f)
        toast.success('Imported', { description: f.name })
      } catch (e) {
        toast.error('Import failed', { description: (e as Error).message })
      }
    }
  }

  return (
    <aside
      className={cn(
        'bg-panel/40 flex h-full flex-col',
        dragOver && 'ring-primary ring-2 ring-inset',
      )}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes('Files')) {
          e.preventDefault()
          if (!dragOver) setDragOver(true)
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        void handleFiles(e.dataTransfer.files)
      }}
    >
      <div className="border-border/60 flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <LibraryIcon className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">Library</span>
        <label className="text-muted-foreground hover:text-foreground ml-auto cursor-pointer">
          <Upload className="size-3.5" />
          <input
            type="file"
            multiple
            accept="audio/*,.wav,.mp3,.aiff,.aif,.flac,.m4a,.ogg,.opus"
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <span className="text-muted-foreground text-[11px]">
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
      <p className="text-[11px] leading-relaxed opacity-80">
        Or drag an audio file (WAV, MP3, AIFF, FLAC…) into this panel to import it.
      </p>
    </div>
  )
}
