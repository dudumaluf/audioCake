/**
 * Keyboard shortcut map. Single source of truth for shortcuts; UI tooltips
 * and the `KEYMAP.md` doc both derive from this list.
 *
 * Match semantics:
 * - `code` matches `KeyboardEvent.code` (layout-independent).
 * - `mod` requires the platform meta key (Cmd on macOS, Ctrl elsewhere).
 * - `shift` is exact: missing = must NOT be held.
 *
 * The keymap is consumed by `useKeyboardShortcuts`.
 */

export type ShortcutId =
  | 'transport.toggle'
  | 'transport.playFromStart'
  | 'transport.stop'
  | 'transport.loopToggle'
  | 'record.toggle'
  | 'edit.split'
  | 'edit.duplicate'
  | 'edit.delete'
  | 'edit.nudgeLeft'
  | 'edit.nudgeRight'
  | 'edit.nudgeLeftBig'
  | 'edit.nudgeRightBig'
  | 'edit.undo'
  | 'edit.redo'
  | 'view.zoomIn'
  | 'view.zoomOut'
  | 'view.zoomFit'

export interface ShortcutBinding {
  id: ShortcutId
  code: string
  mod?: boolean
  shift?: boolean
  /** Description shown in tooltips / docs. */
  description: string
  /** Human-readable label like "Space" or "⌘D". */
  label: string
}

export const KEYMAP: ShortcutBinding[] = [
  { id: 'transport.toggle', code: 'Space', description: 'Play / Pause', label: 'Space' },
  {
    id: 'transport.playFromStart',
    code: 'Space',
    shift: true,
    description: 'Play from start',
    label: 'Shift+Space',
  },
  {
    id: 'transport.stop',
    code: 'Enter',
    description: 'Stop and return playhead to zero',
    label: 'Return',
  },
  { id: 'transport.loopToggle', code: 'KeyL', description: 'Toggle loop', label: 'L' },

  { id: 'record.toggle', code: 'KeyR', description: 'Start / stop recording', label: 'R' },

  { id: 'edit.split', code: 'KeyS', description: 'Split selected clips at playhead', label: 'S' },
  {
    id: 'edit.duplicate',
    code: 'KeyD',
    mod: true,
    description: 'Duplicate selected clip(s)',
    label: '⌘D',
  },
  {
    id: 'edit.delete',
    code: 'Backspace',
    description: 'Delete selected clip(s)',
    label: 'Backspace',
  },
  {
    id: 'edit.delete',
    code: 'Delete',
    description: 'Delete selected clip(s)',
    label: 'Delete',
  },
  { id: 'edit.nudgeLeft', code: 'ArrowLeft', description: 'Nudge selection left', label: '←' },
  {
    id: 'edit.nudgeRight',
    code: 'ArrowRight',
    description: 'Nudge selection right',
    label: '→',
  },
  {
    id: 'edit.nudgeLeftBig',
    code: 'ArrowLeft',
    shift: true,
    description: 'Nudge selection left x10',
    label: 'Shift+←',
  },
  {
    id: 'edit.nudgeRightBig',
    code: 'ArrowRight',
    shift: true,
    description: 'Nudge selection right x10',
    label: 'Shift+→',
  },

  { id: 'edit.undo', code: 'KeyZ', mod: true, description: 'Undo', label: '⌘Z' },
  { id: 'edit.redo', code: 'KeyZ', mod: true, shift: true, description: 'Redo', label: '⌘⇧Z' },

  { id: 'view.zoomIn', code: 'Equal', description: 'Zoom timeline in', label: '+' },
  { id: 'view.zoomOut', code: 'Minus', description: 'Zoom timeline out', label: '−' },
  { id: 'view.zoomFit', code: 'Digit0', description: 'Zoom to fit', label: '0' },
]

/**
 * Decide whether a given KeyboardEvent matches a binding. Modifier checks
 * are strict so e.g. `Space` won't fire while a tooltip-style Shift+Space
 * binding is also defined.
 *
 * Cross-platform mod: on macOS the mod key is Cmd (event.metaKey); on
 * Windows / Linux it's Ctrl. We accept either to be forgiving — users
 * with a Mac keyboard plugged into a non-Mac (or vice versa) still get
 * their expected behaviour. `navigator.platform` is deprecated and
 * returns "" on some modern browsers, so we don't rely on it.
 */
export function matchShortcut(e: KeyboardEvent, b: ShortcutBinding): boolean {
  if (e.code !== b.code) return false
  const modKey = e.metaKey || e.ctrlKey
  if ((b.mod ?? false) !== modKey) return false
  if ((b.shift ?? false) !== e.shiftKey) return false
  // Disallow Alt as a strict policy — we don't bind it currently.
  if (e.altKey) return false
  return true
}
