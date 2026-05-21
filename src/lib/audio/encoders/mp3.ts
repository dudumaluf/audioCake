import mp3 from '@audio/encode-mp3'

interface EncodeMp3Options {
  channels: Float32Array[]
  sampleRate: number
  bitrateKbps: number
  onProgress?: (frac: number) => void
}

/**
 * MP3 encoder (LAME via WASM under the hood). Feeds the encoder in ~1 s
 * chunks so the UI can report progress.
 *
 * Mono inputs are encoded as mono MP3 (smaller files); stereo as joint
 * stereo. Reports progress as each chunk completes.
 */
export async function encodeMp3({
  channels,
  sampleRate,
  bitrateKbps,
  onProgress,
}: EncodeMp3Options): Promise<Blob> {
  const numChannels = Math.min(2, channels.length) as 1 | 2
  const numFrames = channels[0]?.length ?? 0

  const encoder = await mp3({
    sampleRate,
    channels: numChannels,
    bitrate: bitrateKbps,
  })

  const chunkFrames = sampleRate // ~1 s per chunk
  const out: Uint8Array[] = []

  for (let i = 0; i < numFrames; i += chunkFrames) {
    const end = Math.min(numFrames, i + chunkFrames)
    // The encoder expects one Float32Array per channel; if mono pass channel 0,
    // otherwise pass [L, R].
    const chunk: Float32Array | Float32Array[] =
      numChannels === 1
        ? channels[0]!.subarray(i, end)
        : [channels[0]!.subarray(i, end), channels[1]!.subarray(i, end)]
    const encoded = encoder.encode(chunk as never)
    if (encoded?.byteLength) out.push(encoded)
    onProgress?.(end / numFrames)
  }
  const tail = encoder.flush()
  if (tail?.byteLength) out.push(tail)
  if (typeof encoder.free === 'function') encoder.free()

  return new Blob(out as BlobPart[], { type: 'audio/mpeg' })
}
