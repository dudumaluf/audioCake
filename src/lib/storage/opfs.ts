/**
 * OPFS (Origin Private File System) helpers.
 *
 * All audio binaries live here. OPFS is significantly faster than IndexedDB
 * for large files because there's no serialization tax — we just stream
 * bytes in and out of an opaque file handle.
 *
 * Layout under the OPFS root:
 *   audio/<assetId>.wav   — completed recordings / imports
 *   recovery/<id>.bin     — in-progress crash-recovery chunks (Phase 1)
 */

const AUDIO_DIR = 'audio'

let rootHandlePromise: Promise<FileSystemDirectoryHandle> | null = null

function getRoot(): Promise<FileSystemDirectoryHandle> {
  if (!rootHandlePromise) {
    rootHandlePromise = navigator.storage.getDirectory()
  }
  return rootHandlePromise
}

async function getDir(name: string): Promise<FileSystemDirectoryHandle> {
  const root = await getRoot()
  return root.getDirectoryHandle(name, { create: true })
}

/**
 * Best-effort request for persistent storage. Without this, browsers may
 * evict OPFS data under memory pressure. The result is informational; we
 * still proceed regardless.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function writeAudioBlob(assetId: string, blob: Blob): Promise<void> {
  const dir = await getDir(AUDIO_DIR)
  const file = await dir.getFileHandle(`${assetId}.wav`, { create: true })
  const writable = await file.createWritable()
  await writable.write(blob)
  await writable.close()
}

export async function readAudioBlob(assetId: string): Promise<Blob | null> {
  const dir = await getDir(AUDIO_DIR)
  try {
    const handle = await dir.getFileHandle(`${assetId}.wav`)
    const file = await handle.getFile()
    return file
  } catch {
    return null
  }
}

export async function deleteAudioBlob(assetId: string): Promise<void> {
  const dir = await getDir(AUDIO_DIR)
  try {
    await dir.removeEntry(`${assetId}.wav`)
  } catch {
    // Already gone is fine.
  }
}

export interface StorageEstimate {
  usageBytes: number
  quotaBytes: number
}

export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const e = await navigator.storage.estimate()
    return {
      usageBytes: e.usage ?? 0,
      quotaBytes: e.quota ?? 0,
    }
  } catch {
    return null
  }
}
