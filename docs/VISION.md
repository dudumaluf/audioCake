# AudioCake — Vision

## What it is

AudioCake is a local-first, browser-based mini-DAW for recording, layering, editing, and exporting music made with Roland Aira Compact devices (S-1, J-6, T-8) and any other USB or line-level audio source. It runs entirely in the browser, persists projects locally, and exports portable project files plus mixed audio in multiple formats.

## Who it's for

- Musicians using Roland Aira Compact devices who want to capture and arrange ideas quickly without firing up a full DAW.
- Anyone who needs a focused, minimal, fast tool for short-form music — jingles, sketches, beat-making, song demos.
- People who do not want to set up accounts, install plugins, or upload audio to a cloud service to start working.

## North-star use cases

1. **The 30-minute jingle**: plug a Roland S-1 in via USB-C, record a few patterns, drag them onto a timeline, trim and layer, hit export, hand off the MP3.
2. **The portable session**: capture ideas while travelling with the Aira Compacts; later return to AudioCake to arrange and polish.
3. **The MIDI workshop**: record both audio and MIDI from a hardware sequencer; edit notes in the piano-roll; re-render to audio with the device or to a new arrangement.

## Principles

- **Local-first**: no accounts, no required network, no cloud. The web is just the runtime.
- **Non-destructive**: the original recording is never modified. Trim, fade, stretch, pitch are properties of clips, not assets.
- **Hardware-respectful**: the app is MIDI clock master by default so external devices stay in sync; direct monitoring is default to avoid latency.
- **Minimal, not minimalist**: small surface area, but every feature is real. No half-features.
- **Cutting-edge web**: Web Audio AudioWorklets, OPFS, WebCodecs, Web MIDI, PWA. Treat the browser as the platform it actually is in 2026.

## Out of scope (and why)

- Cloud sync, accounts, real-time collaboration: explicitly local-first.
- VST/AU plugin hosting: not possible in the browser.
- Score notation: different audience, different app.
- Mobile-first UI: works on iPad best-effort, but desktop-first.
- Automated test suite (in v1): manual verification per phase is sufficient at this scale. Tests will be added later if the codebase warrants it.
