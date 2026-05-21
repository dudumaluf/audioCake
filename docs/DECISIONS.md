# AudioCake — Architecture Decision Records

Append-only log. One entry per non-trivial decision. Newest at the bottom.

Format: `ADR-NNN — Title (YYYY-MM-DD) — author`

---

## ADR-001 — Browser-based mini-DAW (2026-05-21)

**Context**: Need a fast tool for recording and arranging music from Roland Aira Compacts without firing up a full DAW.

**Decision**: Build as a local-first web app, not a native app.

**Alternatives considered**:

- Native macOS app (Swift/AVAudioEngine): best performance but slow to build and distribute.
- iPad app: limited by App Store and harder to develop.
- Electron desktop: heavier to build, no real advantage over a PWA in 2026.

**Why web**: Modern Web Audio + AudioWorklets + OPFS + Web MIDI + WebCodecs are sufficient. PWA install on Mac feels native. Runs on any device with a URL. Zero install friction.

---

## ADR-002 — Tech stack lock (2026-05-21)

**Context**: Need a stable, modern stack.

**Decision**: Next.js 16 (App Router) + React 19 + TypeScript strict + Turbopack + Tailwind v4 + shadcn/ui + Tone.js + WaveSurfer.js + Zustand + Dexie + OPFS. Package manager: pnpm.

**Alternatives considered**:

- Vite + React: simpler, but Next.js gives us routing, PWA-readiness, and Vercel deploy for free.
- Howler.js instead of Tone.js: Tone.js wins for transport scheduling and effects.
- Redux instead of Zustand: Zustand is smaller and ergonomically better for this scale.

---

## ADR-003 — Always stereo internally (2026-05-21)

**Context**: Roland Aira Compacts output mono via USB-C (1 channel).

**Decision**: Capture mono, upmix to dual-mono immediately after the recording worklet. Entire downstream engine is stereo-only.

**Alternatives considered**:

- Track-native channel count (mono stays mono): more flexible, smaller files, but every node downstream must handle both cases. Adds complexity without real-world payoff.
- Per-recording toggle: extra UI friction.

**Why upmix**: simplifies the engine end-to-end. Users can still pan the dual-mono signal in stereo field. Effects sends can add real stereo width.

---

## ADR-004 — OPFS for audio blobs, IndexedDB for metadata (2026-05-21)

**Context**: Need fast, persistent local storage for potentially large audio files.

**Decision**: Use OPFS for raw audio binaries; IndexedDB (via Dexie) for project state, MIDI data, settings.

**Alternatives considered**:

- IndexedDB only: ~3x slower for large files in benchmarks (serialization overhead).
- File System Access API only: not supported on Safari/Firefox; needs user permission per session.
- LocalStorage: limited to ~5 MB, useless for audio.

---

## ADR-005 — SoundTouch.js for time-stretch / pitch-shift (2026-05-21)

**Context**: Need time-stretch and pitch-shift without coupling the two.

**Decision**: Use `@soundtouchjs/audio-worklet` v2 (LGPL).

**Alternatives considered**:

- RubberBand WASM: best quality, but GPL — would force whole app to GPL.
- Web Audio `playbackRate`: free, zero deps, but couples pitch and time.
- Skip entirely: simpler but loses real DAW capability.

**Trade-off**: LGPL is dynamic-link only; commercial-safe. Document the dependency in README.

---

## ADR-006 — Vercel deployment from `main` (2026-05-21)

**Context**: Want easy access to the app from any device.

**Decision**: Auto-deploy `main` of `dudumaluf/audioCake` to Vercel.

**Alternatives considered**:

- Local-only: simplest, but no URL means no cross-device use.
- GitHub Pages: works but no edge functions, fewer features.
- Netlify: equivalent to Vercel; chose Vercel for Next.js first-party support.

---

## ADR-007 — Multi-format export (2026-05-21)

**Context**: WAV is too large for everyday sharing.

**Decision**: Support MP3 (default), AAC, WAV, Opus in a single export dialog.

**Encoders**:

- MP3: `@mediabunny/mp3-encoder` (WASM LAME, actively maintained).
- AAC, Opus: native WebCodecs `AudioEncoder` (zero deps, hardware-accelerated on macOS).
- WAV: custom `wav-encoder.ts` (~80 LoC).

**Alternatives considered**:

- WAV only: too big.
- `lamejs`: unmaintained since 2021.
- `mp3-mediarecorder`: requires switching recording pipeline; we want to keep recording independent of export.

---

## ADR-008 — Manual verification, no automated tests in v1 (2026-05-21)

**Context**: Tests add up-front cost.

**Decision**: Per-phase manual click-through checklists. No unit or e2e tests in v1.

**Trade-off**: Slower regression detection later. Acceptable at this scale; will revisit if codebase grows. Recorded as risk.

---

## ADR-009 — Direct monitoring default (2026-05-21)

**Context**: Recording from the Roland: should the user hear the input through the Mac (software monitoring) or directly from the Roland's own headphone-out?

**Decision**: Direct monitoring by default. Software monitoring is an optional toggle with a visible latency badge.

**Why**: Browser audio round-trip is 20–50 ms; that's audibly distracting when playing live. The Roland's own output is zero-latency.

---

## ADR-010 — 1-bar count-in by default (2026-05-21)

**Context**: Standard DAW behavior; gives you a beat to prepare before recording starts.

**Decision**: 1-bar count-in on record by default; topbar toggle to disable.

---

## ADR-011 — Crash recovery via 5 s OPFS flush (2026-05-21)

**Context**: Browser tabs can crash mid-recording.

**Decision**: Recording worklet flushes its ring buffer to OPFS every 5 s. On reload, scan for orphaned chunks and offer "Recover unsaved recording from <time>?" before loading the project.

**Trade-off**: Tiny I/O overhead during record; massive data-loss protection.

---

## ADR-012 — Storage soft caps at 500 MB / 1 GB (2026-05-21)

**Context**: OPFS quotas can be revoked silently when over.

**Decision**: Non-blocking warning banner at 500 MB used; block new recordings at 1 GB with "clean up older projects" CTA.

---

## ADR-013 — Punch recording deferred to Phase 8 (2026-05-21)

**Context**: Punch-in / punch-out UI is non-trivial; the latency-compensated overdub already supports the technical capability.

**Decision**: Defer punch UX to Phase 8 (roadmap). Architecture is ready.

---

## ADR-014 — Documentation system in `docs/` (2026-05-21)

**Context**: Need a clear, evolving view of intent, decisions, and progress.

**Decision**: Living `docs/` folder with eight files (VISION, ROADMAP, ARCHITECTURE, DECISIONS, DEV_LOG, CHANGELOG, KEYMAP, BROWSER_SUPPORT) plus root README. Documentation discipline rules baked into the plan: update at start/during/end of each phase.

---

## ADR-017 — Swap MP3 encoder to `@audio/encode-mp3` (2026-05-21)

**Context**: Plan named `@mediabunny/mp3-encoder` for MP3 export. On integration we discovered that package only exports `registerMp3Encoder()` — it's a polyfill that registers a codec with the `mediabunny` library, not a standalone encoder. Pulling Mediabunny in would balloon our export pipeline for a single format.

**Decision**: Use `@audio/encode-mp3` (v1.1.1, MIT, published April 2026), which wraps `wasm-media-encoders` (LAME via WASM) with a clean `encoder.encode(chunk) → Uint8Array; encoder.flush()` API.

**Trade-offs**:
- MIT license, no GPL concerns.
- ~190 KB module size (acceptable; loaded only on first MP3 export).
- Mature underlying LAME implementation.

---

## ADR-016 — shadcn `base-nova` preset implies Base UI + react-resizable-panels v4 (2026-05-21)

**Context**: Phase 1 build surfaced several small API mismatches between the shadcn-installed components and the in-tree wrappers.

**Decision**: Adopt the actual library APIs as-shipped (Base UI for tooltips, react-resizable-panels v4) rather than monkey-patching the shadcn wrappers.

**Concrete consequences**:

- `<TooltipProvider delay={...}>` (not `delayDuration`).
- `<TooltipTrigger render={<Child/>} />` (not `asChild`).
- `<ResizablePanelGroup orientation="horizontal" id="...">` (not `direction` / `autoSaveId`).

These differ from older shadcn/Radix docs floating around online.

---

## ADR-015 — Next.js 16 instead of 15 (2026-05-21)

**Context**: Plan specified Next 15.5, but `create-next-app@latest` now installs Next 16.2.6.

**Decision**: Use Next 16. Newer, fully supported, default-Turbopack dev. Read `node_modules/next/dist/docs/` (per the auto-generated `AGENTS.md`) before doing anything Next-specific that might have changed.

**Trade-off**: Slightly less battle-tested than 15, but on a greenfield project the upgrade tax later would be worse than adopting now.

---
