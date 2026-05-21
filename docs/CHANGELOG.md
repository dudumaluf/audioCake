# AudioCake — Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semver-ish (pre-1.0).

## [Unreleased]

## [0.2.0] — 2026-05-21 — Phase 2: timeline + arrangement

### Added

- `Track` and `Clip` domain types; non-destructive clip model (offset / duration / fadeIn / fadeOut / gainDb).
- `projectStore` (Zustand) with tracks, clips, BPM, snap, zoom, loop region, selection — plus actions for all CRUD.
- `transportStore` (Zustand) with playing/recording/playheadSec.
- Tone.js-based multi-track playback engine:
  - One `Tone.Channel` per track (volume, pan, mute, solo).
  - One `Tone.Player` per clip; on-demand asset decoding with per-asset cache.
  - `Tone.getTransport()` schedules `player.start(time, offset, duration)` for sample-accurate playback.
  - Master `Tone.Meter` exposed for UI metering.
- `usePlaybackEngine` hook: reconciles tracks/clips/bpm/loop into the engine and drives the playhead via rAF.
- Multi-track Timeline UI: bars/beats ruler, BPM-aware grid, track headers with name/mute/solo, snap-to-grid (off / bar / 1/4 / 1/8 / 1/16, Cmd to bypass), zoom in/out, +Track button, playhead overlay with diamond head.
- Clip drag (horizontal reposition) with pointer-capture and snap.
- Drag-from-library to track lane creates a Clip; library items now expose `dataTransfer` with the asset id.
- Mixer pane: horizontal channel strips with pan slider, vertical gain fader (dB), mute/solo, plus a master output meter with peak-hold.
- Topbar transport cluster: skip-to-zero, play/pause, loop toggle, BPM input, time readout (mm:ss.cs + bar.beat.tick), all using JetBrains Mono.

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
