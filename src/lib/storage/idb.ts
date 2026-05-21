import Dexie, { type Table } from 'dexie'
import type { AudioAsset } from '@/lib/types'

/**
 * Dexie-wrapped IndexedDB for structured project + asset metadata.
 *
 * Audio binaries do NOT live here — they're in OPFS for speed. This db
 * only holds the small, queryable records that index those blobs.
 */

/**
 * Stored shape of an audio asset. Peaks are serialised as a regular array
 * so structured cloning is predictable; we convert back to Float32Array
 * on read.
 */
interface StoredAudioAsset {
  id: string
  name: string
  durationSec: number
  sampleRate: number
  channels: 1 | 2
  peaks: number[]
  createdAt: number
  sourceDevice?: string
}

class AudioCakeDB extends Dexie {
  audioAssets!: Table<StoredAudioAsset, string>

  constructor() {
    super('audiocake')
    this.version(1).stores({
      audioAssets: 'id, createdAt, name',
    })
  }
}

const db = new AudioCakeDB()

function toAudioAsset(s: StoredAudioAsset): AudioAsset {
  return {
    id: s.id,
    name: s.name,
    durationSec: s.durationSec,
    sampleRate: s.sampleRate as 44100 | 48000,
    channels: s.channels,
    peaks: new Float32Array(s.peaks),
    createdAt: s.createdAt,
    sourceDevice: s.sourceDevice,
  }
}

function toStored(a: AudioAsset): StoredAudioAsset {
  return {
    id: a.id,
    name: a.name,
    durationSec: a.durationSec,
    sampleRate: a.sampleRate,
    channels: a.channels,
    peaks: Array.from(a.peaks),
    createdAt: a.createdAt,
    sourceDevice: a.sourceDevice,
  }
}

export async function putAudioAsset(asset: AudioAsset): Promise<void> {
  await db.audioAssets.put(toStored(asset))
}

export async function getAudioAsset(id: string): Promise<AudioAsset | null> {
  const s = await db.audioAssets.get(id)
  return s ? toAudioAsset(s) : null
}

export async function listAudioAssets(): Promise<AudioAsset[]> {
  const rows = await db.audioAssets.orderBy('createdAt').reverse().toArray()
  return rows.map(toAudioAsset)
}

export async function renameAudioAsset(id: string, name: string): Promise<void> {
  await db.audioAssets.update(id, { name })
}

export async function deleteAudioAssetRecord(id: string): Promise<void> {
  await db.audioAssets.delete(id)
}
