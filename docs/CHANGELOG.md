# AudioCake — Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semver-ish (pre-1.0).

## [Unreleased]

## [0.1.0] — 2026-05-21 — Phase 1: foundation + audio capture

### Added

- Dark-first theme with AudioCake brand colors (warm amber primary, teal monitor, red record) in OKLCH.
- Inter + JetBrains Mono via `next/font`.
- App shell layout: topbar, resizable library / timeline / inspector columns, resizable mixer pane.
- Audio device picker with permission flow; selection persists across reloads.
- Recording AudioWorklet with ring-buffered chunks + stop handshake (no audio lost on stop).
- Metering AudioWorklet with peak + RMS + peak-hold envelope at 60 Hz.
- Segmented LED-style level meter UI.
- 1-bar count-in (toggleable in topbar).
- WAV encoder (16/24/32-bit) used for OPFS storage and future export.
- Recording pipeline: capture → mono-to-stereo upmix → WAV → OPFS → metadata to IndexedDB.
- Clip library sidebar with preview play, inline rename, delete confirm, mini canvas waveform.
- Single-asset preview player (Phase 2 will replace with Tone.js multi-track).
- Storage persistence requested on first record; storage helpers ready for Phase 4 soft-cap warnings.

## [0.0.1] — 2026-05-21 — Scaffold

### Added

- Initial Next.js 16 + Tailwind v4 + TypeScript strict scaffold.
- shadcn/ui (base-nova preset, neutral palette) with core components installed.
- Prettier + Tailwind plugin + ESLint flat config.
- Karpathy guidelines as a Cursor project rule.
- `docs/` folder seeded: VISION, ROADMAP, ARCHITECTURE, DECISIONS, DEV_LOG, CHANGELOG, KEYMAP, BROWSER_SUPPORT.
- Root `README.md` with quick-start and links.

### Notes

- Plan targeted Next 15; `create-next-app@latest` shipped Next 16. See ADR-015.
