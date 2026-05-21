'use client'

import { useEffect, useRef } from 'react'
import { putProject } from '@/lib/storage/idb'
import { useProjectStore } from '@/lib/state/project-store'

const DEBOUNCE_MS = 5_000

/**
 * Autosave the current project to IndexedDB whenever structural state
 * changes, debounced to 5 s so we don't churn on every keystroke.
 *
 * On `beforeunload` we flush synchronously (best effort) so the user
 * doesn't lose the last few seconds of edits if they close the tab.
 */
export function useAutosave(): void {
  const dirtyTick = useProjectStore((s) => s.dirtyTick)
  const lastSavedTickRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (dirtyTick === lastSavedTickRef.current) return
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      const project = useProjectStore.getState().toProject()
      project.updatedAt = Date.now()
      void putProject(project)
      lastSavedTickRef.current = dirtyTick
      timerRef.current = null
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [dirtyTick])

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
