/**
 * Thin wrapper around `@soundtouchjs/audio-worklet`.
 *
 * The package's main export defines `AudioWorkletNode` at module load,
 * which throws under Next.js prerender (SSR). We load it dynamically so
 * the module is only evaluated in the browser.
 *
 * The processor JS file is served from `/worklets/soundtouch-processor.js`
 * (copied from `node_modules` into `public/worklets/`).
 */

let SoundTouchNodeCtor: typeof import('@soundtouchjs/audio-worklet').SoundTouchNode | null = null

async function loadSoundTouchModule(): Promise<
  typeof import('@soundtouchjs/audio-worklet').SoundTouchNode
> {
  if (SoundTouchNodeCtor) return SoundTouchNodeCtor
  const mod = await import('@soundtouchjs/audio-worklet')
  SoundTouchNodeCtor = mod.SoundTouchNode
  return SoundTouchNodeCtor
}

const registered = new WeakSet<BaseAudioContext>()

export async function registerSoundTouch(ctx: BaseAudioContext): Promise<void> {
  if (registered.has(ctx)) return
  const Ctor = await loadSoundTouchModule()
  await Ctor.register(ctx, '/worklets/soundtouch-processor.js')
  registered.add(ctx)
}

export interface StretchParams {
  /** 0.5..2. 1 = no change. */
  timeStretch: number
  /** -12..+12. 0 = no change. */
  pitchSemitones: number
}

/**
 * Create a SoundTouchNode with the given params applied. Must be called
 * after `registerSoundTouch(ctx)` has completed.
 */
export function createSoundTouchNode(
  ctx: BaseAudioContext,
  { timeStretch, pitchSemitones }: StretchParams,
): import('@soundtouchjs/audio-worklet').SoundTouchNode {
  if (!SoundTouchNodeCtor) {
    throw new Error('SoundTouch worklet not loaded; call registerSoundTouch(ctx) first')
  }
  const node = new SoundTouchNodeCtor({ context: ctx, outputChannelCount: 2 })
  node.playbackRate.value = clamp(timeStretch || 1, 0.25, 4)
  node.pitchSemitones.value = clamp(pitchSemitones || 0, -24, 24)
  return node
}

export function applyStretchParams(
  node: import('@soundtouchjs/audio-worklet').SoundTouchNode,
  params: StretchParams,
): void {
  node.playbackRate.value = clamp(params.timeStretch || 1, 0.25, 4)
  node.pitchSemitones.value = clamp(params.pitchSemitones || 0, -24, 24)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
