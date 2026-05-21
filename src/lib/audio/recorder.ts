import { ensureRunning, getAudioContext, loadWorklets } from './engine'

/**
 * Open a microphone-style getUserMedia stream tied to a specific input device.
 *
 * AudioCake records mono from Roland Aira Compacts; we ask for `channelCount: 1`
 * and disable all the auto-DSP browsers normally apply to "voice" streams.
 */
export async function openInputStream(deviceId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: { exact: deviceId },
      channelCount: { ideal: 1 },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  })
}

interface LiveMonitor {
  source: MediaStreamAudioSourceNode
  meter: AudioWorkletNode
  stop: () => void
}

/**
 * Wire an open input stream into the metering worklet so the UI can render
 * level meters live, before/during recording.
 *
 * Returns handles + a stop function; callers should stop the monitor before
 * starting a recording session that uses the same nodes.
 */
export async function startLiveMonitor(
  stream: MediaStream,
  onLevels: (peaks: number[], rms: number[], heldPeaks: number[]) => void,
): Promise<LiveMonitor> {
  await ensureRunning()
  await loadWorklets()
  const ctx = getAudioContext()

  const source = ctx.createMediaStreamSource(stream)
  const meter = new AudioWorkletNode(ctx, 'audiocake-meter', {
    numberOfInputs: 1,
    numberOfOutputs: 0,
  })

  meter.port.onmessage = (e) => {
    const msg = e.data
    if (msg?.type === 'levels') onLevels(msg.peaks, msg.rms, msg.heldPeaks)
  }

  source.connect(meter)

  return {
    source,
    meter,
    stop: () => {
      try {
        source.disconnect()
      } catch {
        /* already gone */
      }
      try {
        meter.disconnect()
      } catch {
        /* already gone */
      }
      meter.port.onmessage = null
    },
  }
}

export interface RecordResult {
  /** Captured channels (Float32Array per channel, source channel count preserved). */
  channels: Float32Array[]
  sampleRate: number
  durationSec: number
}

/**
 * Start a recording session attached to the given input stream.
 *
 * Returns `{ stop }`; calling `stop()` resolves with the captured audio
 * after the worklet drains and ACKs with a `done` message. A 1 s safety
 * timeout protects against a stuck worklet (already-stopped streams).
 */
export async function startRecording(stream: MediaStream): Promise<{
  stop: () => Promise<RecordResult>
}> {
  await ensureRunning()
  await loadWorklets()
  const ctx = getAudioContext()

  const source = ctx.createMediaStreamSource(stream)
  const recorder = new AudioWorkletNode(ctx, 'audiocake-recorder', {
    numberOfInputs: 1,
    numberOfOutputs: 0,
  })

  // Collected mid-recording chunks (per channel arrays of Float32Array).
  const chunkBuffers: Float32Array[][] = []
  let final: Float32Array[] | null = null
  let donePromiseResolve: (() => void) | null = null

  recorder.port.onmessage = (e) => {
    const msg = e.data
    if (msg?.type === 'chunk') {
      const channels: Float32Array[] = msg.channels
      if (chunkBuffers.length === 0) {
        for (let c = 0; c < channels.length; c++) chunkBuffers.push([])
      }
      for (let c = 0; c < channels.length; c++) chunkBuffers[c]!.push(channels[c]!)
    } else if (msg?.type === 'final') {
      final = msg.channels as Float32Array[]
    } else if (msg?.type === 'done') {
      donePromiseResolve?.()
    }
  }

  source.connect(recorder)
  const startedAt = ctx.currentTime

  return {
    stop: async (): Promise<RecordResult> => {
      const donePromise = new Promise<void>((resolve) => {
        donePromiseResolve = resolve
      })
      recorder.port.postMessage({ type: 'stop' })

      // Wait up to 1 second for the worklet to drain its tail.
      await Promise.race([donePromise, new Promise<void>((resolve) => setTimeout(resolve, 1000))])

      try {
        source.disconnect()
      } catch {
        /* */
      }
      try {
        recorder.disconnect()
      } catch {
        /* */
      }
      recorder.port.onmessage = null

      const numCh = final?.length ?? chunkBuffers.length
      const channels: Float32Array[] = []
      for (let c = 0; c < numCh; c++) {
        const mid = chunkBuffers[c] ?? []
        const tail = final?.[c] ?? new Float32Array(0)
        const totalLen = mid.reduce((n, b) => n + b.length, 0) + tail.length
        const out = new Float32Array(totalLen)
        let offset = 0
        for (const b of mid) {
          out.set(b, offset)
          offset += b.length
        }
        out.set(tail, offset)
        channels.push(out)
      }

      const sampleRate = ctx.sampleRate
      const durationSec = Math.max(0, ctx.currentTime - startedAt)
      return { channels, sampleRate, durationSec }
    },
  }
}

/**
 * Mono-to-stereo upmix used after capture (per ADR-003: app is always stereo
 * internally). For stereo inputs this is a no-op.
 */
export function upmixToStereo(channels: Float32Array[]): Float32Array[] {
  if (channels.length >= 2) return [channels[0]!, channels[1]!]
  if (channels.length === 1) {
    const mono = channels[0]!
    return [mono, new Float32Array(mono)]
  }
  return channels
}
