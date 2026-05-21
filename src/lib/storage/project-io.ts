import JSZip from 'jszip'
import { getAudioAsset, putAudioAsset, putProject } from './idb'
import { readAudioBlob, writeAudioBlob } from './opfs'
import type { AudioAsset, Project } from '@/lib/types'

/**
 * `.acproj` is a zip with this structure:
 *
 *   project.json                  ← Project envelope (without audio data)
 *   assets.json                   ← Array of AudioAsset metadata (peaks etc.)
 *   audio/<assetId>.wav           ← PCM float WAV bytes from OPFS
 *
 * Round-trip writes both the OPFS blob and the IDB rows; the project list
 * UI just re-renders from IDB after import.
 */

interface AssetMetadata extends Omit<AudioAsset, 'peaks'> {
  peaksBase64: string
}

function peaksToBase64(peaks: Float32Array): string {
  const bytes = new Uint8Array(peaks.buffer, peaks.byteOffset, peaks.byteLength)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

function peaksFromBase64(b64: string): Float32Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Float32Array(bytes.buffer)
}

export async function exportProject(project: Project): Promise<Blob> {
  const zip = new JSZip()
  zip.file('project.json', JSON.stringify(project, null, 2))

  const metas: AssetMetadata[] = []
  for (const assetId of project.audioAssetIds) {
    const asset = await getAudioAsset(assetId)
    if (!asset) continue
    metas.push({
      ...asset,
      peaksBase64: peaksToBase64(asset.peaks),
      peaks: undefined as unknown as Float32Array, // strip; serialised via peaksBase64
    } as AssetMetadata)
    const blob = await readAudioBlob(assetId)
    if (blob) {
      zip.file(`audio/${assetId}.wav`, blob)
    }
  }
  zip.file('assets.json', JSON.stringify(metas, null, 2))

  return zip.generateAsync({ type: 'blob' })
}

export interface ImportedProject {
  project: Project
  importedAssets: number
}

/**
 * Read a `.acproj` zip and write its contents into OPFS + IndexedDB.
 *
 * Returns the imported Project + a count of assets we imported (in case
 * the caller wants to show a summary toast).
 */
export async function importProject(zipFile: Blob): Promise<ImportedProject> {
  const zip = await JSZip.loadAsync(zipFile)

  const projectFile = zip.file('project.json')
  if (!projectFile) throw new Error('Invalid .acproj: missing project.json')
  const project: Project = JSON.parse(await projectFile.async('string'))

  let importedAssets = 0
  const assetsFile = zip.file('assets.json')
  if (assetsFile) {
    const metas: AssetMetadata[] = JSON.parse(await assetsFile.async('string'))
    for (const m of metas) {
      const asset: AudioAsset = {
        id: m.id,
        name: m.name,
        durationSec: m.durationSec,
        sampleRate: m.sampleRate,
        channels: m.channels,
        peaks: peaksFromBase64(m.peaksBase64),
        createdAt: m.createdAt,
        sourceDevice: m.sourceDevice,
      }
      const audioFile = zip.file(`audio/${m.id}.wav`)
      if (audioFile) {
        const blob = new Blob([await audioFile.async('arraybuffer')], { type: 'audio/wav' })
        await writeAudioBlob(m.id, blob)
      }
      await putAudioAsset(asset)
      importedAssets++
    }
  }

  await putProject(project)
  return { project, importedAssets }
}
