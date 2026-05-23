'use client'

import { useEffect, useMemo, useRef } from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Inspector } from '@/components/inspector/Inspector'
import { Library } from '@/components/library/Library'
import { Mixer } from '@/components/mixer/Mixer'
import { Onboarding } from '@/components/Onboarding'
import { StorageBanner } from '@/components/StorageBanner'
import { Timeline } from '@/components/timeline/Timeline'
import { Topbar } from '@/components/topbar/Topbar'
import { usePlaybackEngine } from '@/hooks/usePlaybackEngine'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { useAutosave } from '@/hooks/useAutosave'
import { useCrashRecovery } from '@/hooks/useCrashRecovery'
import { useMidiRecorder } from '@/hooks/useMidiRecorder'
import { useProjectStore } from '@/lib/state/project-store'
import { useTransportStore } from '@/lib/state/transport-store'
import { listProjects } from '@/lib/storage/idb'
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
  useAutosave()
  useMidiRecorder()
  useBootstrapProject()
  useCrashRecovery()

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

  // `record.toggle` is handled by `useRecorder` indirectly; we don't bind
  // it globally because the recorder needs its own ref-stable callback.
  // Record-via-keyboard arrives in a later phase.

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
        {/* react-resizable-panels v4 treats numeric `defaultSize` as raw CSS px
            (because internally it sets `flexBasis: defaultSize` with no unit).
            We want proportional layout, so pass percentage strings. */}
        <ResizablePanelGroup orientation="horizontal" id="audiocake:cols">
          <ResizablePanel defaultSize="20%" minSize="14%" maxSize="35%">
            <Library />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize="56%" minSize="30%">
            <ResizablePanelGroup orientation="vertical" id="audiocake:center">
              <ResizablePanel defaultSize="62%" minSize="30%">
                <Timeline />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize="38%" minSize="20%">
                <Mixer />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize="24%" minSize="16%" maxSize="40%">
            <Inspector />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <StorageBanner />
      <Onboarding />
    </div>
  )
}

/**
 * On first mount, load the most-recent saved project from IndexedDB so
 * the user picks up where they left off. If there are no saved projects,
 * leave the default "Untitled" state in place.
 */
function useBootstrapProject(): void {
  const loadProjectData = useProjectStore((s) => s.loadProjectData)
  const triedRef = useRef(false)

  useEffect(() => {
    if (triedRef.current) return
    triedRef.current = true
    void (async () => {
      try {
        const projects = await listProjects()
        const first = projects[0]
        if (first) loadProjectData(first)
      } catch {
        // Ignore — we still have the in-memory default project.
      }
    })()
  }, [loadProjectData])
}
