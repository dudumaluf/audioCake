# AudioCake — Keyboard shortcuts

Source of truth. Synced with `src/lib/utils/keymap.ts` (added in Phase 3).

## Transport

| Shortcut      | Action                           |
| ------------- | -------------------------------- |
| `Space`       | Play / Pause                     |
| `Shift+Space` | Play from start                  |
| `Return`      | Stop and return playhead to zero |
| `L`           | Toggle loop                      |
| `[`           | Set loop in at playhead          |
| `]`           | Set loop out at playhead         |

## Recording

| Shortcut  | Action                        |
| --------- | ----------------------------- |
| `R`       | Toggle record on armed tracks |
| `Shift+R` | Record into new track         |

## Editing

| Shortcut               | Action                           |
| ---------------------- | -------------------------------- |
| `S`                    | Split selected clips at playhead |
| `Cmd+D`                | Duplicate selected clip(s)       |
| `Backspace` / `Delete` | Delete selected clip(s)          |
| `Arrow Left/Right`     | Nudge ±1 grid unit               |
| `Shift+Arrow`          | Nudge ±10 grid units             |
| `Cmd+Z`                | Undo                             |
| `Cmd+Shift+Z`          | Redo                             |

## Mixer

| Shortcut  | Action             |
| --------- | ------------------ |
| `M`       | Mute focused track |
| `Shift+S` | Solo focused track |

## Project

| Shortcut | Action       |
| -------- | ------------ |
| `Cmd+S`  | Save project |
| `Cmd+E`  | Open export  |

## View

| Shortcut  | Action        |
| --------- | ------------- |
| `+` / `-` | Zoom timeline |
| `0`       | Zoom to fit   |

## Modifiers

| Modifier | Effect                                     |
| -------- | ------------------------------------------ |
| `Cmd`    | Hold while dragging to bypass snap-to-grid |
| `Shift`  | Hold to extend selection / multiply nudge  |
