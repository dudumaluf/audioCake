import { create } from 'zustand'
import {
  deleteAudioAssetRecord,
  deleteMidiAsset as idbDeleteMidiAsset,
  listAudioAssets,
  listMidiAssets,
  putAudioAsset,
  putMidiAsset,
  renameAudioAsset,
  renameMidiAsset,
} from '@/lib/storage/idb'
import { deleteAudioBlob, writeAudioBlob } from '@/lib/storage/opfs'
import type { AudioAsset, MidiAsset } from '@/lib/types'

/**
 * Library state: the list of recorded / imported audio assets.
 *
 * Source of truth is OPFS (binaries) + IndexedDB (metadata). This store
 * mirrors the metadata for fast UI reads and orchestrates the writes so
 * the OPFS file and the IDB row are always created/removed together.
 */

interface AssetState {
  assets: AudioAsset[]
  midiAssets: MidiAsset[]
  loaded: boolean
  load: () => Promise<void>
  addRecording: (params: { asset: AudioAsset; wavBlob: Blob }) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
  addMidi: (asset: MidiAsset) => Promise<void>
  renameMidi: (id: string, name: string) => Promise<void>
  removeMidi: (id: string) => Promise<void>
}

export const useAssetStore = create<AssetState>((set) => ({
  assets: [],
  midiAssets: [],
  loaded: false,
  load: async () => {
    const [assets, midiAssets] = await Promise.all([listAudioAssets(), listMidiAssets()])
    set({ assets, midiAssets, loaded: true })
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

  addMidi: async (asset) => {
    await putMidiAsset(asset)
    set((s) => ({ midiAssets: [asset, ...s.midiAssets] }))
  },
  renameMidi: async (id, name) => {
    await renameMidiAsset(id, name)
    set((s) => ({
      midiAssets: s.midiAssets.map((a) => (a.id === id ? { ...a, name } : a)),
    }))
  },
  removeMidi: async (id) => {
    await idbDeleteMidiAsset(id)
    set((s) => ({ midiAssets: s.midiAssets.filter((a) => a.id !== id) }))
  },
}))
