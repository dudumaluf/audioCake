/**
 * Minimal PCM WAV encoder.
 *
 * Supports two output forms:
 *   - 32-bit float (used internally to keep recordings bit-perfect in OPFS)
 *   - 16-bit signed integer (used for compact exports in Phase 4)
 *   - 24-bit signed integer (used for high-quality exports in Phase 4)
 *
 * Channels are de-interleaved Float32Arrays (one per channel). All channels
 * must have the same length.
 */

export type WavBitDepth = 16 | 24 | 32

interface EncodeOptions {
  channels: Float32Array[]
  sampleRate: number
  bitDepth: WavBitDepth
}

export function encodeWav({ channels, sampleRate, bitDepth }: EncodeOptions): Blob {
  if (channels.length === 0) throw new Error('encodeWav: at least one channel required')
  const numChannels = channels.length
  const numFrames = channels[0]!.length
  for (const ch of channels) {
    if (ch.length !== numFrames) {
      throw new Error('encodeWav: all channels must have the same length')
    }
  }

  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataBytes = numFrames * blockAlign
  const isFloat = bitDepth === 32

  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)

  // RIFF header.
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeString(view, 8, 'WAVE')

  // fmt chunk.
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, isFloat ? 3 : 1, true) // 1 = PCM, 3 = IEEE float
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)

  // data chunk.
  writeString(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  let offset = 44
  if (bitDepth === 32) {
    for (let i = 0; i < numFrames; i++) {
      for (let c = 0; c < numChannels; c++) {
        view.setFloat32(offset, channels[c]![i]!, true)
        offset += 4
      }
    }
  } else if (bitDepth === 16) {
    for (let i = 0; i < numFrames; i++) {
      for (let c = 0; c < numChannels; c++) {
        const s = Math.max(-1, Math.min(1, channels[c]![i]!))
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
        offset += 2
      }
    }
  } else {
    // 24-bit signed little-endian.
    for (let i = 0; i < numFrames; i++) {
      for (let c = 0; c < numChannels; c++) {
        const s = Math.max(-1, Math.min(1, channels[c]![i]!))
        const v = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff)
        view.setUint8(offset, v & 0xff)
        view.setUint8(offset + 1, (v >> 8) & 0xff)
        view.setUint8(offset + 2, (v >> 16) & 0xff)
        offset += 3
      }
    }
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, s: string): void {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
}
