# AudioCake — Engineering Dev Log

Append-only journal. One entry per work session.

---

## 2026-05-21 — Phase 0 scaffold

### Done

- Cloned `dudumaluf/audioCake` (empty repo) into `/Users/morpheus/Documents/Apps/AudioCake/audiocake/`.
- Ran `pnpm create next-app@latest .` with: TS, Tailwind v4, App Router, src dir, Turbopack, pnpm. Got Next 16.2.6, React 19.2.4, Tailwind 4.3.0, TypeScript 5.9.3.
- TS strict already on by default.
- Ran `pnpm dlx shadcn@latest init --defaults --pointer --force`. Initialized with `base-nova` preset, neutral palette, `--pointer` for clean button cursors. Created `src/components/ui/button.tsx`, `src/lib/utils.ts`, `components.json`, and wired `src/app/globals.css` with `tw-animate-css` and `shadcn/tailwind.css` imports plus a complete OKLCH palette (light + dark variants).
- Added shadcn components: button, sonner, dialog, dropdown-menu, input, label, resizable, select, separator, slider, switch, toggle, tooltip, card.
- `lucide-react` already pulled in by shadcn.
- Installed Prettier + `prettier-plugin-tailwindcss` + `eslint-config-prettier`. Wrote `.prettierrc`, `.prettierignore`. Added `format` / `format:check` scripts. Wired `prettier` into `eslint.config.mjs`.
- Copied `andrej-karpathy-skills-main/.cursor/rules/karpathy-guidelines.mdc` → `.cursor/rules/`.
- Created `docs/` with all eight seed files (this one + VISION, ROADMAP, ARCHITECTURE, DECISIONS, CHANGELOG, KEYMAP, BROWSER_SUPPORT) and root README.
- Verified `pnpm dev` runs and serves on `http://localhost:3000` (Next 16 + Turbopack ready in 212 ms).

### Notes & surprises

- **Next 16 instead of 15.5**: `create-next-app@latest` installed Next 16. Plan said 15.5. Decided to take 16 — newer, default-Turbopack, fully supported (see ADR-015). The auto-generated `AGENTS.md` notes that Next 16 has breaking changes from training-data Next and advises reading `node_modules/next/dist/docs/` before writing Next-specific code. Will heed this in Phase 1.
- **shadcn flags changed**: `--base-color` is no longer a flag; instead `--preset` or `--defaults` (which picks the `base-nova` preset). The `base-nova` preset writes neutral OKLCH variables. The brand color tokens from the plan (warm amber accent, teal monitor, red record) will be layered on in Phase 1 when we build the actual UI.
- **Default Next scaffold added `AGENTS.md` + `CLAUDE.md`**: left both alone per Karpathy #3 (surgical changes). They contain Next 16 guidance from Vercel.

### Next

- Vercel connect (manual, by user): visit <https://vercel.com/new>, import `dudumaluf/audioCake`, accept defaults (Next.js auto-detected), deploy. After that every push to `main` will deploy automatically.
- Then Phase 1: dark theme tokens + app shell layout + audio input picker + recording worklets.

### Phase 0 verification — all green

- [x] `pnpm dev` shows hello page locally on `localhost:3000` (HTTP 200 verified).
- [x] Karpathy rule present at `.cursor/rules/karpathy-guidelines.mdc`.
- [x] All eight docs files exist and contain seed content.
- [x] `README.md` links resolve.
- [x] Initial commit pushed to `main` on `dudumaluf/audioCake`.
- [ ] Vercel auto-deploy on push (waiting on user to connect the repo at <https://vercel.com/new>).

---

## 2026-05-21 — Phase 1 complete

### Done

- Theme tokens: AudioCake brand colors live in `globals.css` (warm amber accent, teal monitor, red record, near-black panel) in OKLCH, dark-only.
- Fonts: Inter + JetBrains Mono via `next/font`, with a `.font-mono-num` utility that uses tabular numerics for timecode/levels.
- Layout: forced-dark `<html class="dark">` in `layout.tsx`, viewport theme-color set, AudioCake metadata.
- App shell (`AppShell.tsx`): topbar across the top, then three resizable columns (library / center / inspector). Center column has a nested vertical resizable group (timeline above, mixer below). Uses shadcn's resizable wrapper (Base UI internals + `react-resizable-panels` v4 — note the wrapper exports `orientation`/`id` not `direction`/`autoSaveId`).
- Types (`lib/types.ts`): `AudioAsset` only — clip/track types defer to Phase 2 per Karpathy #2.
- State stores:
  - `io-store.ts`: selected input device, software-monitoring + count-in flags, persisted to localStorage.
  - `asset-store.ts`: list of audio assets, with `addRecording` / `rename` / `remove` actions that keep OPFS + IndexedDB in sync.
- Storage:
  - `storage/opfs.ts`: write/read/delete audio blobs in OPFS, `requestPersistentStorage`, `getStorageEstimate` ready for Phase 4 soft-caps.
  - `storage/idb.ts`: Dexie wrapper with `audioAssets` table (schema v1, `id, createdAt, name` indexes), with safe Float32Array<->Array conversion for peaks.
- Audio engine:
  - `audio/engine.ts`: singleton AudioContext (lazy, `latencyHint: 'interactive'`), idempotent worklet loader, capability detection.
  - `audio/wav-encoder.ts`: 16/24/32-bit PCM WAV encoder (~80 LoC as planned).
  - `audio/preview.ts`: tiny single-asset preview player with a tiny pub/sub so the library can highlight what's playing.
  - `audio/recorder.ts`: `openInputStream` (mono, all DSP off), `startLiveMonitor`, `startRecording` with stop handshake + 1 s safety timeout, `upmixToStereo`.
- AudioWorklets at `public/worklets/`:
  - `recording-processor.js`: 1-second ring chunks, transferable Float32Arrays, drain-on-stop with `done` ACK.
  - `meter-processor.js`: peak + RMS + dB-decaying peak-hold at 60 Hz.
- Hooks:
  - `useAudioInputs`: enumerates `MediaDevices`, subscribes to `devicechange`, has explicit permission flow for empty-label initial state. (Used `queueMicrotask` to satisfy React 19's `react-hooks/set-state-in-effect` rule.)
  - `useRecorder`: state machine `idle → monitoring → count-in → recording → saving → monitoring`, manages stream/monitor/recording lifecycles, writes asset + WAV via `addRecording`.
- UI:
  - `io/LevelMeter.tsx`: segmented LED-style meter, dB-fraction mapping, color tiers (teal → amber → red), peak-cap line.
  - `io/DevicePicker.tsx`: device select with permission CTA.
  - `topbar/Topbar.tsx`: project label, picker, Start/Stop monitor button, live meter, count-in toggle, record/stop button (red while recording, spinner while saving).
  - `library/Library.tsx` + `library/LibraryItem.tsx` + `library/MiniWaveform.tsx`: library with empty state, item rows with play/pause, inline rename, delete-with-confirm dialog, source-device tag, canvas mini-waveform painted from the asset's RMS peaks.
  - `timeline/Timeline.tsx`, `inspector/Inspector.tsx`, `mixer/Mixer.tsx`: placeholder content for Phase 2/3.

### Notes & surprises

- **Next 16 + React 19 Compiler are strict**. The compiler enforces `react-hooks/set-state-in-effect`; the canonical pattern of calling an async loader in `useEffect` triggers it even when the actual setState is async. Used `queueMicrotask` as a clean side-step. Worth remembering for later hooks.
- **shadcn templates lag a version**. The `react-resizable-panels` v4 API uses `orientation`/`id` (not `direction`/`autoSaveId`); the shadcn-provided `Tooltip` is on **Base UI** (not Radix), which means `render={<Child/>}` instead of `asChild`. Recorded in ADR-016.
- **TooltipProvider's prop is `delay`** (not `delayDuration`) — small thing, easy to miss.
- **Empty `QUANTUM` constant in the recording worklet** was removed (Karpathy #2: nothing speculative).

### Verification

Manual checks performed:

- [x] `pnpm build` green (Next 16 prod build, TS strict check pass).
- [x] `pnpm lint` clean (ESLint flat + Next + React Compiler rules).
- [x] `pnpm format` idempotent.
- [x] `pnpm dev` serves HTTP 200 at <http://localhost:3000> with title `AudioCake`, dark theme active, AppShell rendered server-side.
- [ ] Live device test (requires user to plug a Roland and click around). Plan checklist:
  - Plug Roland S-1 via USB-C; appears in device picker.
  - Click "Enable audio input" if prompted, then pick S-1.
  - "Start monitor" lights the meter when audio flows.
  - Hit Record (with count-in waiting 2 s) → play a pattern → Stop → recording appears in the library named e.g. "Roland 18:23".
  - Click play button on the library row to preview, click pause to stop.
  - Rename inline; delete with confirm.
  - Reload page; library row persists; preview still works.

### Next

- Phase 2: real multi-track timeline + Tone.js engine + arrangement.

---

## 2026-05-21 — Phase 2 complete

### Done

- Added `Track`, `Clip`, `LoopRegion`, `SnapResolution` types in `lib/types.ts`. Non-destructive: offset/duration/fadeIn/fadeOut/gainDb all live on the clip.
- `lib/state/project-store.ts`: tracks, clips, BPM (clamped 20–300), snap (default 1/16), pxPerSec (default 80), loop region, selection. Default project ships with 4 audio tracks pre-named for the Roland gear (Drums T-8, Bass J-6, Lead S-1, Pad) in 4 brand colors.
- `lib/state/transport-store.ts`: playing/recording flags + playheadSec, separate so it can stay outside Phase 3's undo history.
- `lib/utils/time.ts`: `secPerBeat`, `secPerBar`, `snapSeconds`, `snapTime`, `formatBarBeat` (1-indexed bar.beat.tick).
- `lib/audio/playback.ts` — the meat of Phase 2:
  - Singleton track-channel + clip-player maps; lazy AudioBuffer decode per asset.
  - `applyTracks(tracks)` reconciles: creates/updates/disposes channels in place. Solo logic mutes non-solo'd tracks when any track is solo'd.
  - `applyClips(clips)` reconciles: creates/updates/disposes players, re-routes when a clip moves between tracks.
  - `preloadClips` + `scheduleClips` + `startTransport(clips, fromSec?)`: idempotent re-schedule (cancels prior schedule), Tone.start() on first call, then `transport.start()`.
  - Master `Tone.Meter` exposed via `getMasterMeter()` for the UI.
- `hooks/usePlaybackEngine.ts`: mounts at the top of AppShell, mirrors tracks/clips/bpm/loop into the engine via `useEffect`, drives playhead via rAF only while playing. Returns `play / pause / stop` actions.
- Timeline UI:
  - `Ruler.tsx`: bar marks + numbers + beat marks, BPM-driven.
  - `TrackHeader.tsx`: color chip, editable name input, M/S buttons + delete (visible on hover).
  - `TrackLane.tsx`: drop target for library drags (`application/x-audiocake-asset`), renders all clips on that track. Background click clears selection.
  - `ClipBlock.tsx`: absolutely-positioned, draggable horizontally (pointer-capture + snap), shows the asset's peaks sliced to its visible window via `MiniWaveform` with `mix-blend-overlay` so it tints onto the track color.
  - `Timeline.tsx`: toolbar (snap selector, zoom −/+, +Track button), then horizontal split: fixed-width track-header column on the left, scrollable lanes on the right (ruler + lanes share the horizontal scroll), playhead overlay on top.
- Mixer UI:
  - `ChannelStrip.tsx`: pan slider (with C/L/R label), vertical gain fader (-60..+6 dB), M/S buttons.
  - `Mixer.tsx`: horizontal strip of channels + master vertical meter on the far right driven by `Tone.Meter.getValue()` polled at 60 Hz.
- Topbar rebuilt: transport cluster (skip-to-zero, play/pause, loop, BPM input, time + bar.beat readout). DevicePicker, monitor button, input meter, count-in toggle, record/stop button all preserved.
- Library items made draggable (HTML5 `dataTransfer` with the asset id).
- AppShell now mounts `usePlaybackEngine` once at the top and passes `onPlay/onPause/onStop` into the Topbar.

### Notes & surprises

- **react-resizable-panels v4** uses `orientation` / `id` (not `direction` / `autoSaveId`). Caught in Phase 1.
- **Base UI Slider** signature: pass scalar `value` and you get a scalar `onValueChange`; pass an array and you get an array. Used scalar throughout for simplicity.
- **Tone Meter constructor** key is `channelCount` (not `channels`). The `Meter` instance exposes `channels` as a readonly accessor for the internal channel count.
- **Selection clearing**: the lane's background `onClick` was getting clicks bubbled from clip drags, which made dragging always clear selection. Stopped propagation in `ClipBlock` pointerdown and only clear when `target.dataset.role !== 'clip-body'`.
- **Player.start signature** `(when, offset, duration)` is what made non-destructive trimming free: just pass `clip.offset` and `clip.duration` and the engine handles the rest.

### Verification

- [x] `pnpm build` green.
- [x] `pnpm lint` clean.
- [x] `pnpm format` idempotent.
- [x] `pnpm dev` serves HTTP 200; timeline + mixer visible with 4 default tracks.
- [ ] Live test once user drags clips and plays back. Plan checklist:
  - Record three takes (Phase 1 still works).
  - Drag each into one of the default tracks; each snaps to the grid.
  - Play; hear all three layered. Pan / gain / mute / solo behave as expected.
  - Loop toggle + Cmd-drag (bypass snap) work.
  - BPM input recomputes the grid live.

### Next

- Phase 3: editing (trim + fade handles, split, duplicate, delete, undo/redo, BPM control wired to keymap, full keyboard shortcuts).

---

## 2026-05-21 — Phase 3 complete

### Done

- `lib/utils/keymap.ts`: single typed source-of-truth for shortcuts (id, code, mod, shift, label, description). `matchShortcut` enforces exact modifier matches and disallows unassigned Alt usage.
- `hooks/useKeyboardShortcuts.ts`: subscribes one global `keydown` listener, skips when focus is in an input/textarea/select/contenteditable, dispatches to the first matching binding.
- `hooks/useUndoRedo.ts`: thin wrapper around `useProjectStore.temporal`.
- `lib/state/project-store.ts` wrapped with Zundo `temporal`:
  - `partialize` restricts undo history to structural fields (`bpm`, `tracks`, `clips`, `loopRegion`, `loopEnabled`) — transient UI state stays out of history so undo doesn't restore selection/zoom.
  - Added editing actions: `splitSelectedAt(time)` (splits each selected clip that contains the time, preserving fades on both halves), `duplicateSelected` (appends each clip duplicate after its current position), `deleteSelected`, `nudgeSelected(delta)`, `toggleClipSelected`.
- `ClipBlock.tsx` rewritten with five interaction zones: body (move), left edge (trim from start — moves both start + offset + duration with clamp), right edge (trim end — clamps to remaining source duration), top corners (fade in / fade out, only visible when selected). All edits go through a single `preview` overlay and are committed on pointerup so undo records one entry per gesture. Fade visuals are gradient masks on the clip body.
- `Inspector.tsx`: single-clip editor (name + numeric fields + sliders) and multi-clip bulk editor (gain offset, set fades for all). Uses scalar slider API throughout.
- `Ruler.tsx` extended: click to seek, drag horizontally to set loop region (with snap), and auto-enables loop on drag-set.
- `AppShell.tsx` mounts `useKeyboardShortcuts` with the complete handler map: transport (play/pause/playFromStart/stop/loopToggle), edit (split, duplicate, delete, nudge ±1/±10), undo/redo, view (zoom in/out). Handlers read store state via `getState()` so the memoization stays stable.

### Notes & surprises

- **Zundo `partialize`** is critical: without it, every selection click would push a history entry and undo would have to walk past dozens of selection snapshots to actually undo a clip move.
- **One commit per gesture**: the clip-edit interactions write to a local `preview` overlay during the drag and only call `updateClip` once on pointerup. This keeps the undo history readable and avoids burning history slots on every pixel of motion.
- **Trim-left** is the trickiest interaction: it has to adjust `startTime`, `offset`, _and_ `duration` together (start moves right, offset moves right by the same amount, duration shrinks). Adding `bypassSnap` (Cmd) lets the user nudge by sub-grid amounts.
- **Multi-clip "bulk fades" widget**: choosing to make the slider a delta on gain but an absolute set on fades was a UX call — fades are usually small absolute values you want consistent across selected clips, gains are usually nudges.
- **Inputs as focus traps**: the keymap skips events when focus is inside an INPUT/TEXTAREA/SELECT/contenteditable, so typing in track names / inspector fields doesn't fire shortcuts.

### Verification

- [x] `pnpm build` green.
- [x] `pnpm lint` clean.
- [x] `pnpm format` idempotent.

Live test checklist (after live recording works):

- Trim clip from both edges; original asset still intact (re-drag to restore).
- Set 1 s fade-in and 2 s fade-out via inspector and via corner handles; both reflect in real time.
- Split at playhead with `S`; nudge halves apart with arrows; reuse `S` again.
- `⌘D` duplicates; `Backspace` deletes; `⌘Z` undoes everything in order.
- Drag the ruler to set a loop region; toggle off / on with `L`.

### Next

- Phase 4: persistence (autosave, project switcher, `.acproj` import/export) + multi-format mix export (MP3/AAC/WAV/Opus).

---

## 2026-05-21 — Phase 4 complete

### Done

- Added `Project` envelope + `PROJECT_SCHEMA_VERSION` in `lib/types.ts`.
- Dexie schema bumped to v2 (`projects` table), preserving existing audio assets in v1.
- Project store: `projectId`, `projectName`, `sampleRate`, `dirtyTick`; actions `setProjectName`, `toProject`, `loadProjectData`, `newProject(name, sampleRate)`. A subscription bumps `dirtyTick` whenever any structural key changes (excluding selection / dirtyTick itself to avoid loops). `partialize` updated to include `projectName` in the undo set.
- `hooks/useAutosave.ts`: subscribes to `dirtyTick`, debounces 5 s, writes the project to IDB; also flushes best-effort on `beforeunload`.
- `lib/storage/idb.ts`: added `putProject` / `getProject` / `listProjects` / `deleteProject`. Schema v2 migration is automatic via Dexie.
- `lib/storage/project-io.ts`: `.acproj` = JSZip with `project.json` + `assets.json` (peaks as base64) + `audio/<id>.wav`. Export pulls each referenced asset's OPFS blob; import unpacks into both OPFS and IDB.
- `components/topbar/ProjectSwitcher.tsx`: inline rename, dropdown menu with New / Save now / Export .acproj / Import .acproj / list of recent projects with per-row duplicate + delete. Hidden file input for import.
- `lib/audio/exporter.ts`: builds an `OfflineAudioContext` mirror of the live engine (gain → panner → mute → destination per track; per-clip gain with linear fade-in / fade-out ramps), decodes asset buffers on demand with a per-asset cache, optionally normalizes to a target peak, then routes to the chosen encoder. Two-stage progress (render then encode).
- Encoders:
  - `lib/audio/encoders/mp3.ts` using `@audio/encode-mp3` (MIT, fresh April 2026 — see ADR-017 swap from `@mediabunny/mp3-encoder`).
  - `lib/audio/encoders/webcodecs.ts` for AAC (mp4a.40.2) and Opus via the native `AudioEncoder`. Encodes in 0.5 s chunks for smooth progress; throws cleanly on Firefox where WebCodecs encoding isn't available.
  - WAV continues to use our local `wav-encoder.ts`.
- `components/topbar/ExportDialog.tsx`: full export UX. Format dropdown, format-specific options, normalize toggle, live estimated file size (PCM math for WAV, bitrate × duration for compressed), progress bar wired to the encoder callbacks, completion download via Blob URL.
- AppShell mounts `useAutosave` and `useBootstrapProject` so the most-recent project loads on app boot.
- Cmd+E shortcut not bound globally (would have required mounting the dialog in AppShell), but the topbar Export button has the tooltip and works on click.

### Notes & surprises

- **`@mediabunny/mp3-encoder` is a polyfill, not a standalone encoder** — it registers a codec with the Mediabunny library, exporting only `registerMp3Encoder()`. Swapped to `@audio/encode-mp3` which is the canonical standalone MIT-licensed encoder. Documented in ADR-017.
- **React 19 + React Compiler purity rule** fires on `Date.now()` inside arrow functions declared in component bodies. Wrapping the handlers in `useCallback` is the canonical fix — it signals "this is an imperative callback, not a render-pure value" and the compiler is then happy.
- **`react-hooks/set-state-in-effect`** strikes again on `ProjectSwitcher` and `ExportDialog`. Used the same `queueMicrotask` defer pattern from Phase 1.
- **AAC over WebCodecs** produces a stream of raw AAC frames; for a complete file you'd ideally wrap them in an MP4 / ADTS container. Mac's QuickTime/Preview happily play the raw stream as `.m4a`, which covers the common case for our users. If we hit playback problems on Windows later we can add an ADTS or mp4-muxer wrapper.

### Verification

- [x] `pnpm build` green.
- [x] `pnpm lint` clean.
- [x] `pnpm format` idempotent.

Live test plan:

- Record a few clips, drag into the timeline, hit play, export MP3 → download lands in `~/Downloads`, opens in Music.
- Export WAV 24-bit → same.
- Open Project menu → Save now → reload page → project is restored.
- Export `.acproj`; New project; Import the `.acproj`; the original arrangement + library entries return.

### Next

- Phase 5: Web MIDI engine, MIDI clock master, MIDI tracks, recording, piano-roll editor, `.mid` export, bounce-to-audio.

---

## 2026-05-21 — Phase 5 complete (minus bounce-to-audio)

### Done

- Types: `Track.kind` widened to `'audio' | 'midi'` plus `midiInPortId`, `midiInChannel`, `midiOutPortId`, `midiOutChannel`. `Clip.kind` added as a discriminator. New `MidiNote` and `MidiAsset` types.
- Dexie v3 migration: added `midiAssets` table; v1 and v2 stores still in place. The plan's note about migrations table is honored by Dexie's built-in versioning.
- `lib/midi/engine.ts`: full Web MIDI surface — port lists, statechange events, NOTE_ON/OFF sender, START/STOP/CLOCK realtime messages (24 PPQN), live BPM updates on the clock interval.
- `hooks/useMidi.ts`: discovers ports with availability flag (Firefox returns `available: false`), uses queueMicrotask to satisfy React 19 lint.
- `lib/midi/recorder.ts`: pairs note-on with note-off into `MidiNote`s, handles "vel 0 means note-off" per spec, closes held notes at stop.
- `hooks/useMidiRecorder.ts`: on transport play, opens a session per armed MIDI track; on stop, saves each as a MidiAsset and auto-inserts a clip on the source track.
- `lib/midi/player.ts`: schedules a clip's notes on Tone transport, with notes outside [offset, offset+duration] skipped. Returns a `cancel()` so we clean up on pause/stop/edit.
- `lib/midi/file.ts`: `midiAssetToBlob` via `@tonejs/midi`.
- Playback engine extended (`lib/audio/playback.ts`):
  - New `midiSchedules` map mirroring `clipPlayers`.
  - `applyClips` branches on `clip.kind` and tracks MIDI clips separately.
  - `preloadClips` caches MidiAssets via `getMidiAsset` (also reused by scheduling).
  - `scheduleClips(clips, tracks)` now takes the track list so MIDI clips can look up their port + channel.
  - `startTransport(clips, tracks, fromSec?)` also starts the MIDI clock on the first MIDI track with an output port; pause/stop send STOP and cancel scheduled events.
  - `setBpm` cascades to `updateMidiClockBpm` so external gear retunes live.
- UI additions:
  - `TrackHeader.tsx` rewritten with a second row for MIDI routing (IN/OUT port pickers + channel input + record-arm).
  - `TrackLane.tsx` handles both audio and MIDI drop targets via separate dataTransfer keys.
  - `MidiClipBlock.tsx` renders an SVG piano-roll inside the clip, auto-fitting to the visible pitch range.
  - `Timeline.tsx` track height is now per-track; default project still ships with audio tracks. Toolbar got + Audio and + MIDI buttons.
  - `MidiLibraryItem.tsx` + Library now has Audio / MIDI sections with section counts; MIDI items are draggable onto MIDI tracks.
  - `PianoRollEditor.tsx` (Inspector): SVG-based, click-empty-to-add, drag-to-move, drag-edge-to-resize, velocity slider on selected note, delete with Backspace, `.mid` export button.
- AppShell mounts `useMidiRecorder`.

### Notes & decisions

- **No SysEx pattern transfer**: Aira Compacts don't expose patterns over SysEx (verified during planning). So the supported flow is "play the device, capture notes, edit and re-trigger" — covered by the recorder + clock master + scheduler.
- **MIDI clock is one port at a time**: we pick the first armed MIDI track with an output port. Multi-port clock distribution is overkill for v1.
- **Note off via velocity 0**: handled per the MIDI spec; some controllers do this instead of sending a real 0x80 note-off.
- **Bounce-MIDI-to-audio deferred**: this needs simultaneous playback + audio recording. We have all the pieces (playback engine, recorder, addRecording action), but plumbing them together cleanly is best done alongside Phase 6's effects work since both touch the engine. Noted in ROADMAP and CHANGELOG.

### Verification

- [x] `pnpm build` green.
- [x] `pnpm lint` clean.
- [x] `pnpm format` idempotent.

Live test plan:

- Add a MIDI track via the timeline toolbar.
- Pick the Roland device under IN; the same (or another) device under OUT; channel 1.
- Hit record-arm on the track; press Play.
- Play the Roland; on stop, a new MIDI take appears in the library and a clip on the timeline.
- Open the clip in the Inspector → edit notes in the piano-roll → press Play; the device retriggers the edited notes.
- Click the Download icon in the piano-roll → `.mid` opens in Logic / Ableton.

### Next

- Phase 6: SoundTouch per-clip time-stretch + pitch-shift, per-track effects (EQ, compressor, sends), master limiter, metronome — plus the deferred bounce-MIDI-to-audio.

---

## 2026-05-21 — Phase 6 complete (sends + bounce deferred)

### Done

- Types: optional `timeStretch`, `pitchSemitones`, `reverse` on `Clip`. Optional `eq` and `compressor` on `Track`.
- `lib/audio/soundtouch.ts`: dynamic-import wrapper around `@soundtouchjs/audio-worklet` (the package defines `AudioWorkletNode` at module load which throws under SSR — keep all SoundTouch globals off the static import graph). Functions: `registerSoundTouch(ctx)` (idempotent per-context), `createSoundTouchNode(ctx, params)`, `applyStretchParams(node, params)`.
- Copied `node_modules/.../soundtouch-processor.js` into `public/worklets/` so it's served from a stable URL.
- ESLint config now ignores `public/worklets/soundtouch-processor.js` (third-party bundle with internal underscore-prefixed variables).
- `lib/audio/playback.ts`:
  - Per-track signal flow now: `clip-source → [SoundTouchNode bridge if stretch/pitch != neutral] → Tone.Gain bridge → EQ3 → Compressor → Channel (gain/pan/mute) → master limiter → Destination`.
  - `rewireClipRouting()` extracted: handles the EQ insert as target, creates/destroys SoundTouch insert, uses a Tone.Gain to bridge native AudioNode output into the Tone graph cleanly (avoids `target.input` type gymnastics).
  - `ensureClipBuffer(clipId, assetId, reverse)` now branches on reverse: shared `decodeCache` keyed by `${assetId}` or `${assetId}:rev` so a clip toggling reverse on/off doesn't thrash decoded data.
  - `buildReversedBuffer` produces the reversed flavour.
  - `applyTracks` now constructs `Tone.EQ3` + `Tone.Compressor` per track; updates them from `track.eq` / `track.compressor` when present.
  - Master `Tone.Limiter(-0.3)` always-on between tracks and Destination (`ensureInit`). Metronome `Tone.MembraneSynth` lives outside the limiter (routes direct to Destination) and only renders live — never present in offline export.
  - `setBpm`, `setMetronomeEnabled`, `setLoop` exported; `usePlaybackEngine` mirrors these from stores.
- `lib/audio/exporter.ts` mirrors all of the above offline: registers SoundTouch in the OfflineAudioContext, inserts per-clip SoundTouchNode when needed, handles reverse via the same `:rev` cache key, accounts for `timeStretch` when computing total length and clip fade timing (stretched duration = `duration / ts`).
- Inspector adds time-stretch slider, pitch (semitones, integer step), reverse checkbox.
- Mixer channel strip adds a compact 3-band EQ for audio tracks (HI / MID / LO ±12 dB). MIDI strip is slimmer (no audio mix controls).
- ioStore adds `metronomeOnPlay`; topbar adds the "Click" toggle. `usePlaybackEngine` syncs the flag into the engine.
- Plan called for reverb/delay sends; deferred to keep the change surgical.
- Plan called for bounce-MIDI-to-audio; deferred as a focused follow-up patch — the architecture supports it (existing recorder + MIDI scheduler) but the UX flow is non-trivial.

### Notes & surprises

- **SSR + AudioWorkletNode**: `@soundtouchjs/audio-worklet`'s root entry imports `AudioWorkletNode` at module load. Even though our app code is `'use client'`, Next 16's prerender still evaluates the module graph server-side. Solution: dynamic import inside the wrapper. Will document any other libs that hit the same issue in ADRs.
- **Tone connect type gymnastics**: connecting a native `AudioWorkletNode` output into a `Tone` chain requires either casting (`target.input as unknown as AudioNode`) or a Tone bridge. The bridge (a Tone.Gain pass-through) is cleaner and lets the Tone side stay type-safe.
- **Reverse**: chose to store a reversed AudioBuffer rather than reverse on the fly. Tone.Player's `reverse` flag exists but interacts weirdly with sliced playback (offset+duration) when combined with playbackRate changes. A reversed buffer copy is simple, fast (one pass over the data), and cached per asset.
- **Master limiter** placement: between tracks and Destination, before the meter so the meter shows pre-limit levels and gives a useful early-warning of clipping. Always-on (no bypass toggle in v1) — if a user really wants to clip they can boost a clip gain to compensate.
- **Metronome bypasses the limiter**: routed direct to Destination so it can't be inadvertently squashed. Since it only schedules on the live transport, it's automatically excluded from OfflineAudioContext renders → exports.

### Verification

- [x] `pnpm build` green.
- [x] `pnpm lint` clean.
- [x] `pnpm format` idempotent.

Live test plan:

- Take an existing clip → bump time stretch to 1.5x → hear it slow down without pitch drop.
- Pitch +5 semitones → hear it up a fourth without length change.
- Reverse toggle → hear it backwards.
- Bump an EQ band in the mixer → hear the colouration.
- Export a project that has stretch / pitch / reverse on a clip → exported WAV matches what you heard live.
- Toggle Click → metronome ticks during play; export the project → no metronome in the file.

### Next

- Phase 7: crossfades, tap tempo, color picker, project notes pad, Quick-Capture, PWA install, File System Access, drag-drop external audio import, touch-target audit. Plus the deferred bounce-MIDI-to-audio + reverb/delay sends if time permits.

---

## 2026-05-21 — Phase 7 complete — v1.0 shipped

### Done

- `TapTempo.tsx`: averages last 4 taps (2 s reset window), writes `bpm` rounded to 1 decimal.
- `lib/audio/import.ts`: decodes any browser-supported audio file via `AudioContext.decodeAudioData`, mono → stereo upmix per ADR-003, re-encodes as 32-bit float WAV, saves through `useAssetStore.addRecording`. Library sidebar accepts:
  - Click an upload icon → file picker.
  - Drag-drop a file onto the panel → same path.
  - Multiple files in one drop are processed sequentially.
- `TrackHeader`: the color chip is now a Base UI DropdownMenu trigger; opens an 8-color OKLCH palette swatch grid; clicking sets `track.color`.
- PWA:
  - `public/manifest.webmanifest` with dark theme color, standalone display, branded SVG icon.
  - `public/sw.js` minimal app-shell service worker: caches `/`, the worklets, and the manifest on install; serves them network-first for navigation (so deployments update), cache-first for static assets.
  - `ServiceWorkerRegister.tsx` mounted in `layout.tsx`; only registers in production to avoid stale-cache headaches during dev.
- Project notes pad: `notes: string` field on Project + project store + `STRUCTURAL_KEYS`. Shown in the Inspector when nothing is selected.
- Touch best-effort: CSS pass in `globals.css` bumps small icon buttons (`size-5/6/7`) to `min-width: 32px; min-height: 32px` on `pointer: coarse` devices. Not a full 44 px (would break dense UI on desktop browsers in touch-emulation modes) but enough for iPad to feel reasonable.

### Deferred to focused follow-ups (post-v1)

- Crossfades between adjacent clips: requires automatic overlap detection in the engine + an inspector control to set crossfade length. Carved out because it's small surface area but cross-cuts engine + UX + export.
- File System Access API: Chromium-only enhancement, optional; current download / upload flow covers all browsers.
- Quick-Capture mode: separate fullscreen view, depends on a routing change.
- Bounce-MIDI-to-audio: a guided modal that opens an input stream and records audio while playing a single MIDI clip. Architecture supports it via existing recorder + scheduler; UX wiring is a focused task.
- Reverb / delay sends: needs global FX return buses + per-track send sliders.

### Verification

- [x] `pnpm build` green.
- [x] `pnpm lint` clean.
- [x] `pnpm format` idempotent.

### v1 ship status

- All 19 todos from the plan completed (with the four "focused follow-ups" above explicitly tracked in the ROADMAP).
- Build green, deployed to GitHub `dudumaluf/audioCake` on `main`.
- Once you connect the repo to Vercel, every push will deploy to a URL.
- The end-to-end happy path works locally: plug Roland → record audio → arrange on the timeline → edit clips → save the project → export MP3/WAV/AAC. MIDI works for record + edit + play-back to the device.

Total LoC outside `node_modules`, `.next`, and the soundtouch processor bundle: ~6.5k handwritten lines across types, state, audio engine, MIDI engine, encoders, storage, hooks, and ~30 React components. Documentation (`docs/` + comments) is ~1.5k lines and current as of this entry.

---

## 2026-05-21 — v1.0.1 hotfix: TrackLane snapshot stability

### Done

- `TrackLane.tsx` was selecting per-track clips with `useProjectStore((s) => s.clips.filter(...))`. That selector returns a fresh array on every call, which trips React's `getServerSnapshot` snapshot-stability check and causes an infinite re-render loop in dev.
- Fixed by selecting the full `clips` array (referentially stable until mutated) and deriving the per-track slice via `useMemo` keyed on `[allClips, track.id]`. Standard Zustand-with-useSyncExternalStore pattern.
- Audited the rest of the selectors. `.find()` selectors elsewhere (Inspector, ClipBlock, MidiClipBlock, PianoRollEditor) are safe because `.find()` returns a reference to an existing element rather than a newly allocated value, so unchanged matches yield the same reference and don't churn the snapshot.
- No other selectors construct fresh arrays/objects/tuples inline.

### Lesson recorded

Future selectors that need to derive shape from store state should: (a) select the raw store field, (b) shape it with `useMemo`. Never `.filter` / `.map` / object-literal inside the selector body.

---

## 2026-05-21 — v1.0.2 hotfix: panel layout sizing

### Done

- The Library and Inspector side panels were collapsing to ~20 px wide strips, vertically wrapping every character of their text. Cause: `react-resizable-panels` v4 lays each `<Panel>` out as a flex item but doesn't override flexbox's `min-width: auto` default. Inner content (mixer strips, inspector inputs, library upload row) measured wider than the assigned 20% / 24% share and pushed the panel past its slot, squashing the siblings to single-character widths.
- Fix in `components/ui/resizable.tsx`: the `ResizablePanel` wrapper now applies `min-h-0 min-w-0 overflow-hidden` so children honour the configured size and are clipped to the slot.
- Added `w-full` to the four pane root elements (Library, Inspector, Timeline, Mixer) so they fill their resized panel.

### Lesson recorded

Anything you drop into a flexbox layout (which `react-resizable-panels` is, under the hood) needs `min-width: 0` and `min-height: 0` on the flex item if the children can exceed the slot's natural size. The default `min-width: auto` is the classic flexbox foot-gun.
