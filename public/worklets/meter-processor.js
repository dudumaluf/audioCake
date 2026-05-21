// AudioCake metering AudioWorklet processor.
//
// Per-channel peak + RMS measurement. Posts to the main thread every
// ~16 ms (close to 60 Hz) with a peak-hold envelope so the UI can render
// classic LED-style meters without polling Tone.js.

const POST_INTERVAL_SEC = 1 / 60
const PEAK_HOLD_SEC = 1.5
const PEAK_DECAY_DB_PER_SEC = 20

class MeterProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._numChannels = 0
    /** @type {Float32Array} */
    this._peaks = new Float32Array(0)
    /** @type {Float32Array} */
    this._heldPeaks = new Float32Array(0)
    /** @type {Float32Array} */
    this._heldUntil = new Float32Array(0)
    /** @type {Float32Array} */
    this._rms = new Float32Array(0)
    this._lastPost = 0
  }

  /**
   * @param {Float32Array[][]} inputs
   */
  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true

    const numCh = input.length
    if (numCh !== this._numChannels) {
      this._numChannels = numCh
      this._peaks = new Float32Array(numCh)
      this._heldPeaks = new Float32Array(numCh)
      this._heldUntil = new Float32Array(numCh)
      this._rms = new Float32Array(numCh)
    }

    const frames = input[0].length

    for (let c = 0; c < numCh; c++) {
      const ch = input[c]
      let peak = 0
      let sumSq = 0
      for (let i = 0; i < frames; i++) {
        const v = Math.abs(ch[i])
        if (v > peak) peak = v
        sumSq += ch[i] * ch[i]
      }
      this._peaks[c] = peak
      this._rms[c] = Math.sqrt(sumSq / frames)

      // Peak-hold: capture, then decay.
      if (peak >= this._heldPeaks[c]) {
        this._heldPeaks[c] = peak
        this._heldUntil[c] = currentTime + PEAK_HOLD_SEC
      } else if (currentTime > this._heldUntil[c]) {
        // Decay in dB-linear space (multiply by linear factor per quantum).
        const dtSec = frames / sampleRate
        const decayLinear = Math.pow(10, (-PEAK_DECAY_DB_PER_SEC * dtSec) / 20)
        this._heldPeaks[c] = Math.max(peak, this._heldPeaks[c] * decayLinear)
      }
    }

    if (currentTime - this._lastPost >= POST_INTERVAL_SEC) {
      this._lastPost = currentTime
      this.port.postMessage({
        type: 'levels',
        peaks: Array.from(this._peaks),
        rms: Array.from(this._rms),
        heldPeaks: Array.from(this._heldPeaks),
      })
    }
    return true
  }
}

registerProcessor('audiocake-meter', MeterProcessor)
