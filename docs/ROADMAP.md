# AudioCake — Roadmap

Status legend: `planned` · `in-progress` · `done` · `deferred`

## Phase 0 — Repo + deployment + documentation scaffolding · `done`

- Clone `dudumaluf/audioCake`.
- Scaffold Next.js 16 (App Router, TS strict, Tailwind v4, Turbopack) with pnpm.
- Initialize shadcn/ui (base-nova preset, neutral palette) + sonner + lucide-react.
- Add ESLint flat + Prettier + Tailwind plugin.
- Copy Karpathy guidelines into `.cursor/rules/`.
- Create this `docs/` folder with seed content (eight files).
- Write root `README.md` with quick-start + doc links.
- Connect repo to Vercel.

**Verify**: `pnpm dev` runs locally; pushing `main` deploys to Vercel; Karpathy rule visible in Cursor; all docs files exist with seed content; `README.md` links resolve.

## Phase 1 — Foundation + audio capture · `done`

App shell, dark theme tokens, fonts, audio input device picker, recording + metering AudioWorklets, mono-to-stereo upmix, OPFS storage of recorded WAVs, clip library sidebar, software-monitoring toggle, 1-bar count-in, device disconnect handling, crash recovery.

**Verify**: plug Roland → see in picker → record → see waveform in library → preview → reload → assets persist; disconnect/reconnect handled; crash mid-record offers recovery.

## Phase 2 — Timeline + arrangement · `done`

Multi-track timeline with bars/beats ruler and snap-to-grid, drag-asset-to-track creates clips, WaveSurfer waveforms per clip, Tone.Transport master clock, per-track gain/pan/mute/solo, transport controls, playhead, master output meter.

**Verify**: drag 3 clips onto 3 tracks → play → hear layered → mute/solo/pan/gain real-time → loop region works.

## Phase 3 — Editing · `done`

Selection (click/shift/marquee), inspector panel, trim handles, fade handles, split at playhead, duplicate/delete/nudge, loop region, BPM input, snap toggle, undo/redo, full keymap.

**Verify**: trim/fade/split/duplicate/delete/undo all work; original assets remain intact after edits; every keymap entry fires.

## Phase 4 — Persistence + multi-format export · `done`

Autosave, project switcher, `.acproj` zip import/export, mix render via OfflineAudioContext, multi-format export (MP3 / AAC / WAV / Opus), per-clip preview render, storage soft-caps (warn @ 500 MB, block @ 1 GB).

**Verify**: project survives close/reopen; MP3/WAV/AAC export all play in Finder and match estimated sizes; `.acproj` round-trip works.

## Phase 5 — MIDI · `done` (bounce-to-audio deferred to Phase 6)

Web MIDI engine, MIDI tracks, MIDI clock master (24 PPQN + start/stop/continue), MIDI recording, playback to Roland output, mini piano-roll on timeline, inspector piano-roll editor, `.mid` export, bounce-MIDI-to-audio.

**Verify**: Roland's sequencer locks to project BPM via MIDI clock; MIDI recording + editing works; bounce produces equivalent audio clip; `.mid` opens in Logic/Ableton.

## Phase 6 — Effects + time/pitch · `done` (reverb/delay sends + bounce-MIDI-to-audio deferred to a focused patch)

SoundTouch AudioWorklet per-clip time-stretch and pitch-shift (linked or independent), reverse, per-track EQ + compressor, reverb/delay sends, master limiter, metronome.

**Verify**: time-stretch and pitch-shift work independently; reverse plays backwards; effects shape the sound; metronome clicks only during record and never appears in exports.

## Phase 7 — Polish + power · `done` (crossfades + File System Access + Quick-Capture deferred to a focused patch)

Color-coded tracks/clips, crossfades, tap tempo, project notes pad, Quick-Capture mode, PWA install (manifest + service worker), File System Access API (Chromium), drag-drop external audio import, touch-target audit for iPad.

**Verify**: crossfade boundary is click-free; PWA installs and runs offline; external audio drop works; iPad smoke test passes.

## Future ideas (Phase 8+, not yet committed)

- **Phase 8 — Punch recording**: punch-in / punch-out, pre-roll, loop-record with take comping.
- **Phase 9 — Project history**: visual undo timeline, named snapshots, branch from any past state.
- **Phase 10 — Cloud backup**: optional `.acproj` sync to user-chosen provider (Dropbox / iCloud / S3).
- **Phase 11 — Stem export**: per-track export alongside the master mix.
- **Phase 12 — Audio quantize**: transient detection + warp markers.
- **Phase 13 — Send to Ableton**: export `.als` / `.aaf` for opening in a real DAW with multitrack preserved.
- **Phase 14 — Collaboration**: shareable read-only project URLs; later, real-time co-editing via CRDTs.

## Explicitly not doing

Cloud sync as a default, accounts, real-time collaboration in v1, VST/AU plugin hosting (impossible in browser), score notation, mobile-first UI, automated test suite in v1.
