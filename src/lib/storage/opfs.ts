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
const RECOVERY_DIR = 'recovery'

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

// ---- Crash-recovery helpers ----
//
// In-progress recordings are flushed to `recovery/<sessionId>.wav` while
// the recorder is running. On normal stop we delete that file; on a
// crash + relaunch, the file remains and we offer to recover it.

export interface RecoveryEntry {
  sessionId: string
  /** Bytes — useful to show "recover a 4.2 MB take" rather than just an id. */
  size: number
  /** Last-modified ms epoch. */
  lastModified: number
}

export async function writeRecoveryBlob(sessionId: string, blob: Blob): Promise<void> {
  const dir = await getDir(RECOVERY_DIR)
  const file = await dir.getFileHandle(`${sessionId}.wav`, { create: true })
  const writable = await file.createWritable()
  await writable.write(blob)
  await writable.close()
}

export async function readRecoveryBlob(sessionId: string): Promise<Blob | null> {
  const dir = await getDir(RECOVERY_DIR)
  try {
    const handle = await dir.getFileHandle(`${sessionId}.wav`)
    return handle.getFile()
  } catch {
    return null
  }
}

export async function deleteRecoveryBlob(sessionId: string): Promise<void> {
  const dir = await getDir(RECOVERY_DIR)
  try {
    await dir.removeEntry(`${sessionId}.wav`)
  } catch {
    /* already gone */
  }
}

export async function listRecoveryEntries(): Promise<RecoveryEntry[]> {
  const dir = await getDir(RECOVERY_DIR)
  const out: RecoveryEntry[] = []
  // FileSystemDirectoryHandle implements an async iterator returning
  // [name, handle] tuples; iterate it directly.
  // @ts-expect-error: TS lib for OPFS doesn't model the iterator yet.
  for await (const [name, handle] of dir.entries()) {
    if (!name.endsWith('.wav')) continue
    if (handle.kind !== 'file') continue
    try {
      const file = await (handle as FileSystemFileHandle).getFile()
      out.push({
        sessionId: name.replace(/\.wav$/, ''),
        size: file.size,
        lastModified: file.lastModified,
      })
    } catch {
      /* skip */
    }
  }
  return out
}
