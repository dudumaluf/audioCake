'use client'

import { useEffect } from 'react'
import { KEYMAP, matchShortcut, type ShortcutId } from '@/lib/utils/keymap'

type Handler = (e: KeyboardEvent) => void

/**
 * Bind a map of shortcut ids → handlers globally.
 *
 * Skips firing while focus is inside a text input, textarea, contenteditable,
 * or select — otherwise typing project / clip names would trigger shortcuts.
 */
export function useKeyboardShortcuts(handlers: Partial<Record<ShortcutId, Handler>>): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextEditingTarget(e.target)) return
      for (const binding of KEYMAP) {
        if (!matchShortcut(e, binding)) continue
        const handler = handlers[binding.id]
        if (handler) {
          e.preventDefault()
          handler(e)
        }
        // Match the first matching binding only.
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers])
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return false
}
