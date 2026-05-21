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
