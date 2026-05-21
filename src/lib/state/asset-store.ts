import { create } from 'zustand'
import {
  deleteAudioAssetRecord,
  listAudioAssets,
  putAudioAsset,
  renameAudioAsset,
} from '@/lib/storage/idb'
import { deleteAudioBlob, writeAudioBlob } from '@/lib/storage/opfs'
import type { AudioAsset } from '@/lib/types'

/**
 * Library state: the list of recorded / imported audio assets.
 *
 * Source of truth is OPFS (binaries) + IndexedDB (metadata). This store
 * mirrors the metadata for fast UI reads and orchestrates the writes so
 * the OPFS file and the IDB row are always created/removed together.
 */

interface AssetState {
  assets: AudioAsset[]
  loaded: boolean
  load: () => Promise<void>
  /**
   * Persist a freshly recorded asset: encode WAV to OPFS, save metadata to
   * IDB, prepend to in-memory list.
   */
  addRecording: (params: { asset: AudioAsset; wavBlob: Blob }) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useAssetStore = create<AssetState>((set) => ({
  assets: [],
  loaded: false,
  load: async () => {
    const assets = await listAudioAssets()
    set({ assets, loaded: true })
  },
  addRecording: async ({ asset, wavBlob }) => {
    await writeAudioBlob(asset.id, wavBlob)
    await putAudioAsset(asset)
    set((s) => ({ assets: [asset, ...s.assets] }))
  },
  rename: async (id, name) => {
    await renameAudioAsset(id, name)
    set((s) => ({
      assets: s.assets.map((a) => (a.id === id ? { ...a, name } : a)),
    }))
  },
  remove: async (id) => {
    await deleteAudioBlob(id)
    await deleteAudioAssetRecord(id)
    set((s) => ({ assets: s.assets.filter((a) => a.id !== id) }))
  },
}))
