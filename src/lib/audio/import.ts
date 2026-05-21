import { ulid } from 'ulid'
import { ensureRunning, getAudioContext } from './engine'
import { encodeWav } from './wav-encoder'
import { useAssetStore } from '@/lib/state/asset-store'
import type { AudioAsset } from '@/lib/types'
import { buildPeaks } from '@/lib/utils/audio-math'

/**
 * Import an external audio file (WAV / MP3 / AIFF / FLAC / etc.) into the
 * library.
 *
 * We decode via the browser's `AudioContext.decodeAudioData`, re-encode to
 * 32-bit float PCM WAV at the source sample rate, and save through the
 * standard asset-store pipeline. Stereo is preserved; mono is upmixed to
 * dual-mono per the global "internal audio is always stereo" rule.
 */
export async function importAudioFile(file: File): Promise<AudioAsset> {
  await ensureRunning()
  const ctx = getAudioContext()
  const arrayBuffer = await file.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))

  const channels: Float32Array[] = []
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    channels.push(audioBuffer.getChannelData(c).slice())
  }
  // Mono → stereo upmix.
  const stereo =
    channels.length === 1 ? [channels[0]!, new Float32Array(channels[0]!)] : channels.slice(0, 2)

  const sampleRate = audioBuffer.sampleRate as 44100 | 48000
  const peaks = buildPeaks(stereo, sampleRate)
  const wav = encodeWav({ channels: stereo, sampleRate, bitDepth: 32 })

  const asset: AudioAsset = {
    id: ulid(),
    name: file.name.replace(/\.[^.]+$/, ''),
    durationSec: audioBuffer.duration,
    sampleRate,
    channels: 2,
    peaks,
    createdAt: Date.now(),
    sourceDevice: 'Imported',
  }

  await useAssetStore.getState().addRecording({ asset, wavBlob: wav })
  return asset
}
