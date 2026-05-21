/**
 * AudioCake audio engine — Phase 1 scope.
 *
 * Owns the shared AudioContext and registers worklet modules. Future phases
 * extend this module with Tone.Transport wiring and a mixer graph; for now
 * it's just the bare minimum to support recording + metering.
 *
 * The context is created lazily on first call to `getAudioContext()` because
 * browsers require a user gesture before audio can be initialized.
 */

let ctx: AudioContext | null = null
let workletsLoadedPromise: Promise<void> | null = null

export interface AudioEngineCapabilities {
  hasAudioContext: boolean
  hasMediaDevices: boolean
  hasOPFS: boolean
  hasWebMidi: boolean
}

export function detectCapabilities(): AudioEngineCapabilities {
  if (typeof window === 'undefined') {
    return {
      hasAudioContext: false,
      hasMediaDevices: false,
      hasOPFS: false,
      hasWebMidi: false,
    }
  }
  return {
    hasAudioContext: typeof window.AudioContext !== 'undefined',
    hasMediaDevices: !!navigator.mediaDevices?.getUserMedia,
    hasOPFS: !!navigator.storage?.getDirectory,
    hasWebMidi: typeof navigator.requestMIDIAccess === 'function',
  }
}

export function getAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'interactive' })
  }
  return ctx
}

/** Resume a possibly-suspended context (e.g. after the page was hidden). */
export async function ensureRunning(): Promise<AudioContext> {
  const c = getAudioContext()
  if (c.state !== 'running') {
    await c.resume()
  }
  return c
}

/** Idempotent worklet loader. Safe to call before any node construction. */
export async function loadWorklets(): Promise<void> {
  const c = getAudioContext()
  if (!workletsLoadedPromise) {
    workletsLoadedPromise = Promise.all([
      c.audioWorklet.addModule('/worklets/recording-processor.js'),
      c.audioWorklet.addModule('/worklets/meter-processor.js'),
    ]).then(() => undefined)
  }
  return workletsLoadedPromise
}
