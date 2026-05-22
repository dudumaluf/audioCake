# AudioCake — Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semver-ish (pre-1.0).

## [Unreleased]

## [1.4.2] — 2026-05-21 — Fix: mixer controls had no effect on audio

### Fixed

- Mute / solo / gain / pan / EQ / sends in the mixer pane didn't actually change what you heard for clips on tracks loaded from a saved project. Root cause: a bootstrap race where `applyClips` ran before `applyTracks` had created the track-channels for the freshly-loaded project ids; `rewireClipRouting` then fell back to `Tone.getDestination()` and the clip stayed wired direct to the master output, bypassing the channel forever. Two fixes:
  - `ClipPlayer` now remembers if it was routed to the fallback master, and forces a re-route on the next `applyClips` once the proper channel exists.
  - `usePlaybackEngine` re-runs `applyClips` whenever tracks change so any newly-created channels can pick up their clips immediately.

## [1.4.1] — 2026-05-21 — Mixer channel strip rewrite

### Fixed

- Mixer channel strip's vertical gain fader was overlapping the horizontal pan slider when there wasn't enough vertical room (which was always, once the REV/DLY send rows from 1.3.0 were added). Eight stacked items in a ~250 px tall strip with a `flex-1` gain block meant the gain collapsed and visually clashed with its neighbours.

### Changed

- Channel strip restructured into header / scrollable body / pinned footer:
  - **Header** (color chip + name) pinned at the top with a border.
  - **Body** scrolls vertically if the strip is too short to fit everything.
  - **Footer** (M / S buttons) pinned at the bottom with a border.
- EQ and Sends grouped into two visually-distinct bordered sections instead of a vertical pile. Sends section gets a subtle teal accent so it reads as "wet" routing vs the dry EQ.
- EQ and Send bands are now **horizontal rows** (label / slider / value) instead of stacked, so each row is ~18 px instead of ~30 px.
- Gain fader has a hard `min-height: 100px` so it never collapses below a usable size.
- Strip widened 96 → 108 px so EQ/Send labels have room to breathe.

## [1.4.0] — 2026-05-21 — Tighter loop playback + draggable playhead + cleaner ruler gestures

### Fixed

- Loop iterations sometimes started late, dropped audio, or sounded quiet on the seam. Two culprits: (1) we were calling `Player.stop(time)` followed by `Player.start(time)` at the same audio-context time, which races with Tone's internal source teardown; (2) a global "stop everything at loop-end" scheduleRepeat ran 5 ms before loop-end and stepped on the next iteration's start. Both removed — `Player.start(time, offset, duration)` already handles re-trigger cleanly without an explicit stop.

### Changed

- Ruler interactions clarified:
  - **Click ruler** = seek + briefly audition (unchanged).
  - **Cmd-click ruler** = silent seek (no audition).
  - **Shift-drag ruler** = set loop region (was: any drag created a loop). This prevents accidental loop creation when you're trying to navigate.

### Added

- **Draggable playhead** — the diamond on top of the playhead line is now grabbable. Drag it to scrub through the arrangement; brief audition snippets fire at ~120 ms intervals so you hear what you're passing over.

## [1.3.0] — 2026-05-21 — Reverb + delay sends ("now it sounds like a record")

### Added

- Global reverb (`Tone.Reverb`, 2.4 s decay) and delay (`Tone.FeedbackDelay`, 3/8 dotted, 35% feedback) returns sit at the master bus, before the limiter so wet signal still respects -0.3 dBFS.
- Per-track `reverbSendDb` and `delaySendDb` (-60 = off, 0 = unity, +6 max). Tap post-channel so mute/solo silences the wet path too.
- Mixer channel strip now has compact REV / DLY send sliders next to the EQ bands. Teal tint to distinguish from EQ.
- Multi-format export builds the full effects chain offline (was previously a bare gain→pan→destination): every export now includes EQ, compressor, sends, limiter — what you hear is what you export.

### Note

- Reverb / delay parameters (decay, feedback, delay time) are fixed for v1. A "FX settings" panel is roadmap work — most users get 80% of the value from "turn it up / down" on the send.

## [1.2.0] — 2026-05-21 — Bounce MIDI to audio + auto-crossfades

### Added

- **Bounce MIDI to audio**: inspector's MIDI clip view now has a "Bounce to audio…" button. Opens a guided dialog that plays the MIDI clip through your chosen MIDI output port and simultaneously records the device's audio return into a new audio clip on a chosen target track. Original MIDI clip is untouched. Includes pre-roll silence + tail capture for clean edges.
- **Auto-crossfades** between overlapping same-track clips. When two audio clips on the same track overlap (by ≥ 5 ms), the engine and offline export automatically apply equal-power crossfades the length of the overlap. Per-clip explicit fadeIn/fadeOut still wins when larger. No destructive mutation of user values — fades are computed at playback / render time.

## [1.1.0] — 2026-05-21 — Loop region playback actually loops + click-to-audition on the ruler

### Fixed

- Setting a loop region and pressing Play didn't actually loop within the region. `transport.schedule()` events are one-shot — they don't refire when the transport jumps back from loopEnd to loopStart. `scheduleClips` now branches on `transport.loop`: when looping, each audio clip that overlaps the loop window is scheduled via `transport.scheduleRepeat()` at the loop length, with offsets/durations clamped to the region. Plus a final scheduleRepeat at loopEnd stops every active player so notes don't bleed across the seam.
- `usePlaybackEngine` now re-runs scheduling when the loop region or clip list changes during playback, so new clips and loop adjustments take effect on the next iteration.

### Added

- Click the ruler to seek + briefly audition (250 ms preview) whatever audio sits at that position. Lets you navigate the arrangement aurally without firing the transport. Hold Shift while clicking for a silent seek (old behaviour).

## [1.0.9] — 2026-05-21 — Fix: starting playback mid-clip produced silence

### Fixed

- If you seeked the playhead to a position inside an existing clip (by clicking the ruler) and hit Play, the clip wouldn't sound. `scheduleClips` was using `Tone.getTransport().schedule(callback, clip.startTime)` to start each player, but Tone's transport silently skips scheduled events whose time has already passed — so any clip starting earlier than the current playhead was a no-op. Now detects when the playhead is _inside_ a clip's playable window and immediately starts the player with a partial offset, so playback from mid-clip works as you'd expect.

### Note

- True scrub-while-dragging-playhead playback isn't implemented yet (it needs a dedicated scrub buffer pipeline). The supported workflow is: click the ruler to seek, then hit Space to play from that point. Recorded in roadmap.

## [1.0.8] — 2026-05-21 — Fix: keyboard shortcuts (Cmd+D, Delete, etc.) silently not firing

### Fixed

- `matchShortcut` was using deprecated `navigator.platform` to decide between Cmd (Mac) and Ctrl (Windows/Linux). Modern Chrome returns an empty string for that property, so `isMac` evaluated false on Mac, and the matcher then required Ctrl instead of Cmd — meaning Cmd+D, Cmd+Z, etc. never matched on Mac and silently fell through to the browser's default (Cmd+D = bookmark this page). Replaced with `e.metaKey || e.ctrlKey` so either modifier works on any platform.
- Added a second binding for `Delete` (forward-delete) alongside `Backspace`, since Mac extended keyboards have a real Delete key separate from Backspace.

## [1.0.7] — 2026-05-21 — Fix: clip selection cleared on mouse-up

### Fixed

- Inspector was disappearing the moment you released a clip click because the bubbled `click` event hit `TrackLane`'s background handler, which then cleared the selection. The handler only checked `target.dataset.role !== 'clip-body'`, but the actual click target is the outer `data-role="clip"` element (or one of its inner SVG/handle children), not `clip-body`. Walks up the DOM looking for either role and bails out cleanly instead.

## [1.0.6] — 2026-05-21 — UX: clearer loop region

### Changed

- Loop region now stays visible on the ruler even when the loop toggle is off (dimmer styling) so users can re-enable the existing region instead of redragging from scratch.
- Added a small × clear button on the loop region that removes the region and disables the loop in one click.

## [1.0.5] — 2026-05-21 — Hotfix: Record button pushed off-screen

### Fixed

- On narrower viewports (≤ ~1280px) the Record and Export buttons were getting clipped off the right edge of the topbar. Two causes: (1) the DevicePicker's SelectTrigger had `min-w-[220px]` but no max-width, so when the browser returned an unlabeled device (a 64-character device-id hash, which happens before mic permission is granted) the trigger grew to ~500px and pushed everything past it off-screen; (2) the topbar lacked `overflow-hidden` and stable shrink semantics, so anything that overflowed simply disappeared.
- DevicePicker SelectTrigger now `w-[200px] max-w-[200px]` with the inner value truncated. The full label is still visible in the dropdown options.
- Topbar layout reorganised into three zones: a left "always-visible" cluster (project + device), an elastic meter zone in the middle (shrinks first), and a right "always-visible" cluster (transport + count-in + click + Record + Export). The recording/transport controls are now `shrink-0` so they're never clipped.
- Count-in / Click labels collapse to icon-only on viewports < 1280px; the switches stay always tappable.

## [1.0.4] — 2026-05-21 — Hotfix: mixer channel strip overflow

### Fixed

- Channel strip was overflowing the mixer pane's height: pan slider + label + mute/solo were getting clipped at the bottom. Caused by `flex-col gap-2 p-2` plus too many fixed-height blocks (color chip row, name row, 3 EQ bands, pan, gain, mute/solo). The gain fader had `flex-1` but its actual share collapsed because the cumulative natural heights of the surrounding blocks exceeded the strip height.
- Restructured: color chip + name merged into a single row; reordered to EQ → Gain (flex-1) → Pan → Mute/Solo (standard DAW layout); pan compressed to a single line ("PAN C" / "PAN L20" / "PAN R20"); `gap-1` and tighter padding; `overflow-hidden` on the strip; `shrink-0` on the fixed blocks plus `min-h-0` on the gain block so the fader properly absorbs spare space.
- Bumped the default mixer pane from 30% → 38% of the center column for a bit more breathing room.

## [1.0.3] — 2026-05-21 — Hotfix: panel sizes were in pixels, not percent

### Fixed

- The Library, Inspector, and Mixer panes were actually only 20–30 _pixels_ wide. `react-resizable-panels` v4 changed its `defaultSize` semantics: a bare `number` is now interpreted as raw CSS pixels (it gets piped straight into `flexBasis: <number>` which CSS reads as px), not a percentage. Switched every `defaultSize`/`minSize`/`maxSize` in `AppShell` to percentage strings (`"20%"` etc.) — now the layout is actually 20% / 56% / 24% with the mixer at 30% of the center column.
- Removed the now-unnecessary `min-h-0 min-w-0 overflow-hidden` from the `ResizablePanel` wrapper — the primitive already injects `min-width: 0` and `min-height: 0` inline, and `overflow: hidden` was fighting it.

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
