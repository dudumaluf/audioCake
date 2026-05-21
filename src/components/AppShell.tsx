'use client'

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Inspector } from '@/components/inspector/Inspector'
import { Library } from '@/components/library/Library'
import { Mixer } from '@/components/mixer/Mixer'
import { Timeline } from '@/components/timeline/Timeline'
import { Topbar } from '@/components/topbar/Topbar'
import { usePlaybackEngine } from '@/hooks/usePlaybackEngine'

/**
 * Top-level app layout: topbar across the top, then three resizable columns
 * (library / center / inspector) with a resizable mixer pinned to the
 * bottom of the center column.
 *
 * Owns the playback engine lifecycle (mounted once, drives all of
 * `projectStore` → engine reconciliation).
 */
export function AppShell() {
  const { play, pause, stop } = usePlaybackEngine()

  return (
    <div className="bg-background flex h-full flex-col">
      <Topbar
        onPlay={() => {
          void play()
        }}
        onPause={pause}
        onStop={stop}
      />
      <div className="min-h-0 flex-1">
        <ResizablePanelGroup orientation="horizontal" id="audiocake:cols">
          <ResizablePanel defaultSize={20} minSize={14} maxSize={35}>
            <Library />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={56} minSize={30}>
            <ResizablePanelGroup orientation="vertical" id="audiocake:center">
              <ResizablePanel defaultSize={70} minSize={30}>
                <Timeline />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={30} minSize={14}>
                <Mixer />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={24} minSize={16} maxSize={40}>
            <Inspector />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
