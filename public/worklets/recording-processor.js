// AudioCake recording AudioWorklet processor.
//
// Captures every render quantum (128 frames per channel by default), batches
// them into ~1 s chunks and ships them to the main thread as transferable
// Float32Arrays. Uses a "done" handshake on stop so no audio is ever lost.

const CHUNK_SECONDS = 1

class RecordingProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    /** @type {Float32Array[][]} chunks per channel; each chunk is a flat Float32Array */
    this._buffers = []
    this._chunkSize = Math.ceil(CHUNK_SECONDS * sampleRate)
    this._numChannels = 0
    this._writeIndex = 0
    this._stopRequested = false

    this.port.onmessage = (e) => {
      const msg = e.data
      if (msg?.type === 'stop') {
        this._stopRequested = true
        this._flush(true)
        this.port.postMessage({ type: 'done' })
      }
    }
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
      this._buffers = Array.from({ length: numCh }, () => [new Float32Array(this._chunkSize)])
      this._writeIndex = 0
    }

    const frames = input[0].length // typically 128
    let written = 0
    while (written < frames) {
      const space = this._chunkSize - this._writeIndex
      const toCopy = Math.min(space, frames - written)
      for (let c = 0; c < numCh; c++) {
        const target = this._buffers[c][this._buffers[c].length - 1]
        target.set(input[c].subarray(written, written + toCopy), this._writeIndex)
      }
      this._writeIndex += toCopy
      written += toCopy
      if (this._writeIndex >= this._chunkSize) {
        this._flush(false)
      }
    }

    // Stay alive until explicitly stopped.
    return !this._stopRequested
  }

  _flush(final) {
    if (this._numChannels === 0) return

    const chunks = this._buffers.map((channelChunks) => {
      const last = channelChunks[channelChunks.length - 1]
      // Trim the in-flight chunk to actual bytes written.
      const trimmed = this._writeIndex < this._chunkSize ? last.slice(0, this._writeIndex) : last
      // Concatenate completed chunks (everything except the active one) with the trimmed tail.
      if (channelChunks.length === 1) return trimmed
      const total = channelChunks.slice(0, -1).reduce((n, b) => n + b.length, 0) + trimmed.length
      const out = new Float32Array(total)
      let offset = 0
      for (let i = 0; i < channelChunks.length - 1; i++) {
        out.set(channelChunks[i], offset)
        offset += channelChunks[i].length
      }
      out.set(trimmed, offset)
      return out
    })

    const transferables = chunks.map((c) => c.buffer)
    this.port.postMessage({ type: final ? 'final' : 'chunk', channels: chunks }, transferables)

    // Reset for next chunk.
    if (!final) {
      this._buffers = Array.from(
        { length: this._numChannels },
        () => [new Float32Array(this._chunkSize)],
      )
      this._writeIndex = 0
    }
  }
}

registerProcessor('audiocake-recorder', RecordingProcessor)
