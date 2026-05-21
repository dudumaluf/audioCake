# AudioCake — Browser support

We design for Chromium-based browsers as the primary target. Safari is a strong secondary; Firefox is a tertiary fallback.

## Tier matrix

| Browser              | Tier      | Notes                                                                 |
| -------------------- | --------- | --------------------------------------------------------------------- |
| Chrome (desktop)     | Primary   | Full feature set.                                                     |
| Edge (desktop)       | Primary   | Equivalent to Chrome.                                                 |
| Arc                  | Primary   | Equivalent to Chrome.                                                 |
| Brave                | Primary   | Equivalent to Chrome.                                                 |
| Safari 17+ (desktop) | Secondary | Web MIDI supported. File System Access falls back to download/upload. |
| Safari (iPadOS 17+)  | Secondary | PWA install works; touch surfaces best-effort.                        |
| Firefox (desktop)    | Tertiary  | No Web MIDI (Firefox lacks it natively). Audio + export work.         |

## Feature matrix

| Feature                     | Chromium | Safari 17+ | Firefox |
| --------------------------- | -------- | ---------- | ------- |
| Web Audio + AudioWorklet    | ✓        | ✓          | ✓       |
| OPFS                        | ✓        | ✓          | ✓       |
| IndexedDB                   | ✓        | ✓          | ✓       |
| Web MIDI API                | ✓        | ✓          | —       |
| WebCodecs (AAC, Opus)       | ✓        | partial    | partial |
| File System Access API      | ✓        | —          | —       |
| PWA install                 | ✓        | ✓          | ✓       |
| `navigator.storage.persist` | ✓        | ✓          | ✓       |

## Runtime behavior

At boot the app detects available features and shows a clear, non-blocking banner if anything is missing. Example:

> "Web MIDI is unavailable in this browser — recording audio still works, but you cannot record MIDI or sync to your Roland devices."

The app never silently degrades; it always tells the user what's available.
