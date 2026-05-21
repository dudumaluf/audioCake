'use client'

import { useMemo } from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Inspector } from '@/components/inspector/Inspector'
import { Library } from '@/components/library/Library'
import { Mixer } from '@/components/mixer/Mixer'
import { Timeline } from '@/components/timeline/Timeline'
import { Topbar } from '@/components/topbar/Topbar'
import { usePlaybackEngine } from '@/hooks/usePlaybackEngine'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { useProjectStore } from '@/lib/state/project-store'
import { useTransportStore } from '@/lib/state/transport-store'
import { snapSeconds } from '@/lib/utils/time'

/**
 * Top-level app layout: topbar across the top, then three resizable columns
 * (library / center / inspector) with a resizable mixer pinned to the
 * bottom of the center column.
 *
 * Owns the playback engine lifecycle (mounted once, drives all of
 * `projectStore` → engine reconciliation) and the global keyboard shortcuts.
 */
export function AppShell() {
  const { play, pause, stop } = usePlaybackEngine()
  const { undo, redo } = useUndoRedo()

  // Stable handler object so the shortcut effect doesn't re-bind every render.
  const handlers = useMemo(
    () => ({
      'transport.toggle': () => {
        const playing = useTransportStore.getState().isPlaying
        if (playing) pause()
        else void play()
      },
      'transport.playFromStart': () => {
        stop()
        void play()
      },
      'transport.stop': () => stop(),
      'transport.loopToggle': () => {
        const enabled = useProjectStore.getState().loopEnabled
        useProjectStore.getState().setLoopEnabled(!enabled)
      },
      'edit.split': () => {
        const playhead = useTransportStore.getState().playheadSec
        useProjectStore.getState().splitSelectedAt(playhead)
      },
      'edit.duplicate': () => useProjectStore.getState().duplicateSelected(),
      'edit.delete': () => useProjectStore.getState().deleteSelected(),
      'edit.nudgeLeft': () => {
        const { snap, bpm } = useProjectStore.getState()
        const step = snapSeconds(snap, bpm) || 0.05
        useProjectStore.getState().nudgeSelected(-step)
      },
      'edit.nudgeRight': () => {
        const { snap, bpm } = useProjectStore.getState()
        const step = snapSeconds(snap, bpm) || 0.05
        useProjectStore.getState().nudgeSelected(step)
      },
      'edit.nudgeLeftBig': () => {
        const { snap, bpm } = useProjectStore.getState()
        const step = (snapSeconds(snap, bpm) || 0.05) * 10
        useProjectStore.getState().nudgeSelected(-step)
      },
      'edit.nudgeRightBig': () => {
        const { snap, bpm } = useProjectStore.getState()
        const step = (snapSeconds(snap, bpm) || 0.05) * 10
        useProjectStore.getState().nudgeSelected(step)
      },
      'edit.undo': () => undo(),
      'edit.redo': () => redo(),
      'view.zoomIn': () => {
        const { pxPerSec, setPxPerSec } = useProjectStore.getState()
        setPxPerSec(pxPerSec * 1.25)
      },
      'view.zoomOut': () => {
        const { pxPerSec, setPxPerSec } = useProjectStore.getState()
        setPxPerSec(pxPerSec / 1.25)
      },
    }),
    [play, pause, stop, undo, redo],
  )

  useKeyboardShortcuts(handlers)

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
