interface EncodeWebCodecsOptions {
  channels: Float32Array[]
  sampleRate: number
  codec: 'aac' | 'opus'
  bitrateKbps: number
  onProgress?: (frac: number) => void
}

/**
 * Encode using the native WebCodecs `AudioEncoder`. Produces raw codec
 * frames concatenated into a single Blob; for AAC/Opus this works fine
 * for download playback in macOS Preview / QuickTime.
 *
 * Note: Firefox lacks AAC encoding support; the export dialog disables
 * the AAC option with an explanation when the codec is unavailable.
 */
export async function encodeWebCodecs({
  channels,
  sampleRate,
  codec,
  bitrateKbps,
  onProgress,
}: EncodeWebCodecsOptions): Promise<Blob> {
  if (typeof AudioEncoder === 'undefined') {
    throw new Error('WebCodecs AudioEncoder is not supported in this browser.')
  }

  const numChannels = Math.min(2, channels.length)
  const numFrames = channels[0]?.length ?? 0
  const codecString = codec === 'aac' ? 'mp4a.40.2' : 'opus'

  const chunks: Uint8Array[] = []
  let firstError: Error | null = null

  const encoder = new AudioEncoder({
    output: (chunk) => {
      const buf = new Uint8Array(chunk.byteLength)
      chunk.copyTo(buf)
      chunks.push(buf)
    },
    error: (e) => {
      firstError = e instanceof Error ? e : new Error(String(e))
    },
  })

  encoder.configure({
    codec: codecString,
    sampleRate,
    numberOfChannels: numChannels,
    bitrate: bitrateKbps * 1000,
  })

  // WebCodecs expects interleaved frames in an `AudioData` object. Feed
  // in 0.5 s chunks so progress updates are smooth.
  const chunkFrames = Math.floor(sampleRate * 0.5)
  for (let i = 0; i < numFrames; i += chunkFrames) {
    const end = Math.min(numFrames, i + chunkFrames)
    const len = end - i
    const interleaved = new Float32Array(len * numChannels)
    for (let f = 0; f < len; f++) {
      for (let c = 0; c < numChannels; c++) {
        interleaved[f * numChannels + c] = channels[c]![i + f]!
      }
    }
    const data = new AudioData({
      format: 'f32',
      sampleRate,
      numberOfFrames: len,
      numberOfChannels: numChannels,
      timestamp: Math.round((i / sampleRate) * 1_000_000),
      data: interleaved,
    })
    encoder.encode(data)
    data.close()
    onProgress?.(end / numFrames)
    if (firstError) throw firstError
  }

  await encoder.flush()
  encoder.close()
  if (firstError) throw firstError

  const totalLen = chunks.reduce((n, c) => n + c.byteLength, 0)
  const out = new Uint8Array(totalLen)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return new Blob([out], { type: codec === 'aac' ? 'audio/mp4' : 'audio/ogg' })
}
