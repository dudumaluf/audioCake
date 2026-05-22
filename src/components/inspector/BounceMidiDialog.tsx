'use client'

import { Disc3, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAudioInputs } from '@/hooks/useAudioInputs'
import { useMidi } from '@/hooks/useMidi'
import { bounceMidiClip } from '@/lib/midi/bounce'
import { useAssetStore } from '@/lib/state/asset-store'
import { useIOStore } from '@/lib/state/io-store'
import { useProjectStore } from '@/lib/state/project-store'
import type { Clip } from '@/lib/types'

interface BounceMidiDialogProps {
  clip: Clip
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Guided modal that bounces a MIDI clip into a fresh audio clip by playing
 * its notes out to the hardware synth and recording the returning audio.
 *
 * Defaults try to be sensible: input is the user's last selected device,
 * MIDI output is the same as the source MIDI track's, target track is the
 * first audio track in the project.
 */
export function BounceMidiDialog({ clip, open, onOpenChange }: BounceMidiDialogProps) {
  const tracks = useProjectStore((s) => s.tracks)
  const midiAssets = useAssetStore((s) => s.midiAssets)
  const sourceTrack = tracks.find((t) => t.id === clip.trackId)
  const audioTracks = useMemo(() => tracks.filter((t) => t.kind === 'audio'), [tracks])
  const midi = useMidi()
  const audio = useAudioInputs()
  const ioSelectedInput = useIOStore((s) => s.selectedInputId)

  const [audioInputId, setAudioInputId] = useState<string>(ioSelectedInput ?? '')
  const [midiOutPortId, setMidiOutPortId] = useState<string>(sourceTrack?.midiOutPortId ?? '')
  const [midiOutChannel, setMidiOutChannel] = useState<number>(sourceTrack?.midiOutChannel ?? 0)
  const [targetTrackId, setTargetTrackId] = useState<string>(audioTracks[0]?.id ?? '')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!open) return
    // Defer to satisfy React 19's "don't setState directly in effect" rule.
    queueMicrotask(() => {
      setProgress(0)
      if (!audioInputId && ioSelectedInput) setAudioInputId(ioSelectedInput)
      if (!midiOutPortId && sourceTrack?.midiOutPortId) setMidiOutPortId(sourceTrack.midiOutPortId)
      if (!targetTrackId && audioTracks[0]) setTargetTrackId(audioTracks[0].id)
    })
  }, [
    open,
    ioSelectedInput,
    sourceTrack?.midiOutPortId,
    audioTracks,
    audioInputId,
    midiOutPortId,
    targetTrackId,
  ])

  const asset = midiAssets.find((a) => a.id === clip.assetId)

  const handleStart = async () => {
    if (!asset) {
      toast.error('MIDI asset missing')
      return
    }
    if (!midiOutPortId) {
      toast.error('Pick a MIDI output port')
      return
    }
    if (!audioInputId) {
      toast.error('Pick an audio input')
      return
    }
    if (!targetTrackId) {
      toast.error('Pick a target audio track')
      return
    }
    setRunning(true)
    try {
      await bounceMidiClip({
        midiClip: clip,
        midiAsset: asset,
        midiOutPortId,
        midiOutChannel,
        audioInputId,
        targetTrackId,
        onProgress: setProgress,
      })
      toast.success('Bounced to audio', {
        description: `${audioTracks.find((t) => t.id === targetTrackId)?.name ?? 'track'}`,
      })
      onOpenChange(false)
    } catch (e) {
      toast.error('Bounce failed', { description: (e as Error).message })
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bounce MIDI to audio</DialogTitle>
          <DialogDescription>
            AudioCake will play the MIDI clip out to your synth and record what comes back as a new
            audio clip. Make sure the device is connected and its audio is routed to your chosen
            input.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label="MIDI output">
            <Select value={midiOutPortId} onValueChange={(v) => setMidiOutPortId(v ?? '')}>
              <SelectTrigger size="sm">
                <SelectValue placeholder="MIDI output port" />
              </SelectTrigger>
              <SelectContent>
                {midi.outputs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="MIDI channel">
            <input
              type="number"
              min={1}
              max={16}
              value={midiOutChannel + 1}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10) || 1
                setMidiOutChannel(Math.max(0, Math.min(15, n - 1)))
              }}
              className="bg-background border-border w-16 rounded-md border px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Audio input">
            <Select value={audioInputId} onValueChange={(v) => setAudioInputId(v ?? '')}>
              <SelectTrigger size="sm">
                <SelectValue placeholder="Where the synth returns to" />
              </SelectTrigger>
              <SelectContent>
                {audio.devices.map((d) => (
                  <SelectItem key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Target audio track">
            <Select value={targetTrackId} onValueChange={(v) => setTargetTrackId(v ?? '')}>
              <SelectTrigger size="sm">
                <SelectValue placeholder="Pick a track" />
              </SelectTrigger>
              <SelectContent>
                {audioTracks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {running && (
            <div className="bg-background overflow-hidden rounded-sm border">
              <div
                className="bg-primary h-1 transition-[width] duration-100"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
              <div className="text-muted-foreground px-2 py-1 text-[10px]">
                Recording bounce… {Math.round(progress * 100)}%
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Cancel
          </Button>
          <Button onClick={handleStart} disabled={running}>
            {running ? <Loader2 className="size-4 animate-spin" /> : <Disc3 className="size-4" />}
            Start bounce
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] tracking-wider uppercase">{label}</Label>
      {children}
    </div>
  )
}
