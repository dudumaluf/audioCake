'use client'

import { useEffect, useRef } from 'react'
import { useAutosaveStore } from '@/lib/state/autosave-store'
import { putProject } from '@/lib/storage/idb'
import { useProjectStore } from '@/lib/state/project-store'

const DEBOUNCE_MS = 5_000

/**
 * Autosave the current project to IndexedDB whenever structural state
 * changes, debounced to 5 s so we don't churn on every keystroke.
 *
 * On `beforeunload` we flush synchronously (best effort) so the user
 * doesn't lose the last few seconds of edits if they close the tab.
 *
 * Also pushes lifecycle status into `useAutosaveStore` so the topbar
 * can show "Saving…" / "Saved 5 s ago" / "Unsaved changes".
 */
export function useAutosave(): void {
  const dirtyTick = useProjectStore((s) => s.dirtyTick)
  const lastSavedTickRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const setStatus = useAutosaveStore((s) => s.setStatus)
  const markSaved = useAutosaveStore((s) => s.markSaved)

  useEffect(() => {
    if (dirtyTick === lastSavedTickRef.current) return
    // Dirty change detected: schedule a save. Use queueMicrotask so we
    // don't satisfy React 19's "no setState in effect" rule — the status
    // flip itself is just UI signalling, off the render path.
    queueMicrotask(() => setStatus('pending'))
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(async () => {
      const tickAtStart = useProjectStore.getState().dirtyTick
      setStatus('saving')
      const project = useProjectStore.getState().toProject()
      project.updatedAt = Date.now()
      try {
        await putProject(project)
        lastSavedTickRef.current = tickAtStart
        // Only call "saved" if nothing changed during the IDB write —
        // otherwise we'd lie about being up to date.
        if (useProjectStore.getState().dirtyTick === tickAtStart) {
          markSaved()
        } else {
          setStatus('pending')
        }
      } catch {
        setStatus('pending')
      } finally {
        timerRef.current = null
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [dirtyTick, setStatus, markSaved])

  // Flush on tab close. Best-effort; the IDB write may not complete.
  useEffect(() => {
    const flush = () => {
      const tick = useProjectStore.getState().dirtyTick
      if (tick === lastSavedTickRef.current) return
      const project = useProjectStore.getState().toProject()
      project.updatedAt = Date.now()
      void putProject(project)
      lastSavedTickRef.current = tick
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])
}
