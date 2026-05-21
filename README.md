# AudioCake

A local-first, browser-based mini-DAW for recording, layering, editing, and exporting music made with Roland Aira Compact devices (S-1, J-6, T-8) and any other USB or line-level audio source. Runs entirely in the browser — no accounts, no cloud, no install. Built for speed, clarity, and not getting in your way.

## Quick start

Requirements: Node 20+, pnpm 10+.

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. Plug a Roland Aira Compact (or any USB audio interface) into your Mac via USB-C — it'll appear as a class-compliant audio device with no driver needed.

## Scripts

| Command             | What it does                            |
| ------------------- | --------------------------------------- |
| `pnpm dev`          | Run the Next.js dev server (Turbopack). |
| `pnpm build`        | Production build.                       |
| `pnpm start`        | Serve the production build locally.     |
| `pnpm lint`         | ESLint check.                           |
| `pnpm format`       | Prettier write across the repo.         |
| `pnpm format:check` | Prettier check (CI-friendly).           |

## Docs

The full project source-of-truth lives in [`docs/`](./docs/).

| Doc                                          | What it's for                                             |
| -------------------------------------------- | --------------------------------------------------------- |
| [VISION](./docs/VISION.md)                   | Why AudioCake exists, who it's for, north-star use cases. |
| [ROADMAP](./docs/ROADMAP.md)                 | Phase-by-phase plan with status and future ideas.         |
| [ARCHITECTURE](./docs/ARCHITECTURE.md)       | Data model, audio graph, storage layout, diagrams.        |
| [DECISIONS](./docs/DECISIONS.md)             | Architecture Decision Records (ADRs), append-only.        |
| [DEV_LOG](./docs/DEV_LOG.md)                 | Engineering journal of what was built and why.            |
| [CHANGELOG](./docs/CHANGELOG.md)             | User-facing changes per release.                          |
| [KEYMAP](./docs/KEYMAP.md)                   | Keyboard shortcuts.                                       |
| [BROWSER_SUPPORT](./docs/BROWSER_SUPPORT.md) | Browser tier matrix and feature support.                  |

## Tech

- Next.js 16 (App Router) + React 19 + TypeScript strict + Turbopack
- Tailwind CSS v4 + shadcn/ui (base-nova preset)
- Tone.js + Web Audio AudioWorklets (recording + metering)
- WaveSurfer.js (waveforms)
- Web MIDI API + `@tonejs/midi`
- `@soundtouchjs/audio-worklet` for time-stretch / pitch-shift (LGPL)
- Zustand + Immer + Zundo (state)
- OPFS + Dexie/IndexedDB (storage)
- JSZip for `.acproj` project files
- Encoders: `@mediabunny/mp3-encoder` (MP3), WebCodecs (AAC/Opus), custom WAV encoder

## Coding rules

This repo follows the four [Karpathy guidelines](.cursor/rules/karpathy-guidelines.mdc) as a Cursor project rule:

1. Think before coding
2. Simplicity first
3. Surgical changes
4. Goal-driven execution

## License

MIT. Note: `@soundtouchjs/audio-worklet` is LGPL (dynamic link only, commercial-safe).
