'use client'

import { useCallback } from 'react'
import { useProjectStore } from '@/lib/state/project-store'

/**
 * Convenience access to Zundo's temporal API attached to `useProjectStore`.
 *
 * Only structural project state is undo-tracked (see `partialize` in the
 * store) so undoing a clip move never restores a stale selection.
 */
export function useUndoRedo() {
  const undo = useCallback(() => {
    useProjectStore.temporal.getState().undo()
  }, [])
  const redo = useCallback(() => {
    useProjectStore.temporal.getState().redo()
  }, [])
  return { undo, redo }
}
