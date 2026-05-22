# AudioCake — Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semver-ish (pre-1.0).

## [Unreleased]

## [1.0.2] — 2026-05-21 — Hotfix: panel layout sizing

### Fixed

- Library and Inspector side panels were collapsing to single-character-wide strips because the shadcn `ResizablePanel` wrapper didn't enforce `min-w-0` / `min-h-0` on its flex item. Flexbox's default `min-width: auto` meant any wide inner content (mixer strips, inspector inputs) pushed the panel past its assigned share and squashed siblings. Wrapper now clamps both axes and applies `overflow-hidden`; the four pane root elements (Library, Inspector, Timeline, Mixer) all set `h-full w-full` so they fully fill their slot.

## [1.0.1] — 2026-05-21 — Hotfix: TrackLane snapshot stability

### Fixed

- Infinite re-render loop on the timeline ("The result of getServerSnapshot should be cached…"). `TrackLane` was selecting per-track clips with `.filter()` directly inside the Zustand selector, which returned a new array on every snapshot. Refactored to select the full `clips` array and derive the per-track slice via `useMemo`.

## [1.0.0] — 2026-05-21 — Phase 7: polish + PWA — v1 complete

### Added

- Tap-tempo button in the topbar BPM cluster (averages last 4 taps, resets after 2 s).
- Drag-and-drop external audio import (WAV / MP3 / AIFF / FLAC / M4A / OGG / Opus) onto the Library sidebar, with an upload button in the header. Imported files are decoded via `AudioContext.decodeAudioData`, re-encoded as 32-bit float WAV in OPFS, and appear as standard library assets.
- Track color picker (popover swatch grid) directly on the colored chip in each track header.
- PWA: `manifest.webmanifest`, branded SVG icon, and an app-shell service worker that caches the page, worklets, and manifest for offline use. Auto-registered in production.
- Project notes / lyrics pad shown in the Inspector when nothing is selected; saved with the project.
- Touch best-effort: minimum 32 px tap targets for the small icon buttons on coarse-pointer devices (iPad).

### Deferred to focused follow-ups

- Crossfades between adjacent same-track clips (engine + UX).
- File System Access API for direct "Save to folder" / "Open from folder".
- Quick-Capture one-button recording mode.
- Bounce-MIDI-to-audio and reverb/delay sends (carried over from Phase 6).

## [0.6.0] — 2026-05-21 — Phase 6: effects + time/pitch

### Added

- `Clip.timeStretch`, `Clip.pitchSemitones`, `Clip.reverse` (all optional, default to neutral).
- SoundTouch AudioWorklet integration (`@soundtouchjs/audio-worklet` v2). Per-clip stretch + pitch via `playbackRate` synced between `Tone.Player` and the SoundTouch node.
- Reverse playback via per-asset reversed-buffer cache (no destructive change to source).
- Inspector controls for audio clips: time stretch (0.5x..2x), pitch (-12..+12 semitones), reverse toggle.
- Per-track 3-band EQ (Tone.EQ3) + Compressor (Tone.Compressor) automatically inserted in every track chain; default values are flat / gentle so existing projects sound unchanged.
- Master limiter (Tone.Limiter at -0.3 dB) always-on between tracks and Tone.Destination so peaks never clip.
- Compact 3-band EQ controls in the mixer channel strip.
- Optional metronome with a "Click" toggle in the topbar; routes direct-to-destination (bypasses limiter, never appears in exports).
- Multi-format mix export now applies time-stretch / pitch / reverse offline so what you hear matches what you export.

### Deferred to a focused patch

- Reverb / delay sends (need shared FX returns + send sliders in the mixer).
- Bounce-MIDI-to-audio (architecture supports it via existing recorder + scheduler; UX wiring is a focused task).

## [0.5.0] — 2026-05-21 — Phase 5: MIDI

### Added

- `Track.kind: 'audio' | 'midi'`, `Clip.kind`, `MidiNote`, `MidiAsset` types.
- Dexie schema v3 with `midiAssets` table.
- Web MIDI engine: `ensureMidiAccess`, port enumeration with live `statechange` updates, `sendNoteOn/Off`, MIDI clock master (24 PPQN) with `startMidiClock` / `continueMidiClock` / `stopMidiClock` / `updateMidiClockBpm`, `subscribeInput` for incoming messages.
- `useMidi` hook (Web MIDI port discovery with availability detection — Firefox returns `available: false`).
- MIDI recorder: pairs note-on/off into `MidiNote` objects with relative timestamps; closes any held notes at stop.
- `useMidiRecorder` hook auto-records from all record-armed MIDI tracks while transport plays, saves each take as a `MidiAsset`, and (by default) drops a clip on the source track.
- MIDI player schedules note on/off events onto `Tone.getTransport()` so external synths play in sync.
- Playback engine extended: schedules MIDI clips alongside audio, sends MIDI clock to the first armed MIDI output port, updates clock cadence when BPM changes.
- `addMidiTrack` action; MIDI track headers expose IN / OUT port pickers + channel input + record-arm.
- `MidiClipBlock` renders a mini SVG piano-roll on the timeline, with the same trim handles as audio clips.
- Library now has Audio and MIDI sections; MIDI items are draggable onto MIDI tracks.
- Inspector switches to a `PianoRollEditor` for selected MIDI clips: SVG roll with click-to-add, drag-to-move, drag-edge-to-resize, velocity slider, delete, and `.mid` export per pattern.
- `.mid` export via `@tonejs/midi`.

### Deferred to Phase 6

- Bounce-MIDI-to-audio (re-records the device's response into a new audio clip; depends on simultaneous play+record pipeline).

## [0.4.0] — 2026-05-21 — Phase 4: persistence + multi-format export

### Added

- `Project` envelope type (id / name / bpm / sampleRate / tracks / clips / loop / snap / pxPerSec / timestamps / schema version).
- Dexie schema bumped to v2 with a `projects` table; preserves existing audio assets.
- Project store actions: `setProjectName`, `toProject`, `loadProjectData`, `newProject` (with sample rate choice).
- `dirtyTick` driven by a Zustand subscription; autosave (5 s debounce) writes the current project to IndexedDB on change, plus a best-effort flush on `beforeunload`.
- `useAutosave` and `useBootstrapProject` hooks in AppShell; on first mount we open the most-recently-edited project.
- ProjectSwitcher in topbar: rename inline, dropdown with New / Save now / Export .acproj / Import .acproj / Open recent (with per-project duplicate + delete).
- `.acproj` file format: zip containing `project.json`, `assets.json` (with base64-encoded peaks), and `audio/<id>.wav` from OPFS.
- OfflineAudioContext mix render with per-track gain/pan/mute/solo and per-clip fades + gain.
- Multi-format export dialog with format (MP3 / AAC / WAV / Opus), bitrate / bit-depth selectors, normalize-to-−1 dBFS, live estimated file size, two-stage progress bar (render → encode).
- MP3 via `@audio/encode-mp3` (WASM LAME, MIT, fresh April 2026).
- AAC / Opus via native `WebCodecs.AudioEncoder` (gracefully degrades / disables on Firefox).
- Inspector inputs no longer trigger keyboard shortcuts (text-input focus skip).

## [0.3.0] — 2026-05-21 — Phase 3: editing + undo + shortcuts

### Added

- Trim handles on left/right edges of selected clips (non-destructive: adjusts `offset` + `duration` against the source asset, clamped to source bounds).
- Fade in / fade out handles on selected clips (top-corner triangles), with visual gradient overlays on the clip body.
- Inspector panel with single-clip editor (name, position, offset, duration, fade in/out, gain) and multi-clip bulk editor (gain offset, set fades for all).
- Split selected clips at playhead (`S`).
- Duplicate selected clips at offset (`⌘D`).
- Delete selected clips (`Backspace`).
- Nudge selected clips by snap step (arrow keys; `Shift` for ×10).
- Click ruler to seek playhead; drag ruler to set loop region (auto-enables loop).
- Zundo undo/redo wrapped around `projectStore` (structural fields only; selection/zoom excluded). `⌘Z` / `⌘⇧Z`.
- `useKeyboardShortcuts` + `KEYMAP` single source of truth, with proper text-input skip and exact modifier matching.
- BPM input in the topbar wired (Phase 2 prop; surfaced via keymap now).

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
