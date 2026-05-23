'use client'

import { Download, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import JSZip from 'jszip'
import {
  renderAndExport,
  renderStems,
  type ExportFormat,
  type ExportOptions,
} from '@/lib/audio/exporter'
import { encodeMp3 } from '@/lib/audio/encoders/mp3'
import { encodeWebCodecs } from '@/lib/audio/encoders/webcodecs'
import { encodeWav } from '@/lib/audio/wav-encoder'
import { useProjectStore } from '@/lib/state/project-store'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Multi-format mix export.
 *
 * Renders the full project to a single mixed file in the chosen format.
 * AAC encoding via WebCodecs is unavailable on Firefox; we detect that
 * up front and disable the option with an explanation.
 */
export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const projectName = useProjectStore((s) => s.projectName)
  const tracks = useProjectStore((s) => s.tracks)
  const clips = useProjectStore((s) => s.clips)
  const sampleRate = useProjectStore((s) => s.sampleRate)
  const bpm = useProjectStore((s) => s.bpm)
  const fx = useProjectStore((s) => s.fxSettings)

  const [format, setFormat] = useState<ExportFormat>('mp3')
  const [bitrateKbps, setBitrateKbps] = useState(192)
  const [wavBitDepth, setWavBitDepth] = useState<16 | 24>(16)
  const [normalize, setNormalize] = useState(true)
  const [exportStems, setExportStems] = useState(false)
  const [filename, setFilename] = useState(sanitize(projectName) || 'audiocake-mix')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState<'render' | 'encode'>('render')

  const aacAvailable = useMemo(() => typeof AudioEncoder !== 'undefined', [])

  useEffect(() => {
    if (!open) return
    // Defer the reset off the render path so React 19's lint is satisfied.
    queueMicrotask(() => {
      setFilename(sanitize(projectName) || 'audiocake-mix')
      setProgress(0)
    })
  }, [open, projectName])

  const totalSec = useMemo(
    () => clips.reduce((m, c) => Math.max(m, c.startTime + c.duration), 0),
    [clips],
  )

  const estimatedSize = useMemo(() => {
    if (format === 'wav') {
      const bytesPerSec = sampleRate * 2 * (wavBitDepth / 8)
      return totalSec * bytesPerSec
    }
    return (totalSec * bitrateKbps * 1000) / 8
  }, [format, sampleRate, wavBitDepth, bitrateKbps, totalSec])

  const handleExport = async () => {
    if (clips.length === 0) {
      toast.error('No clips on the timeline', {
        description: 'Drop something into a track first.',
      })
      return
    }
    setRunning(true)
    setProgress(0)
    setStage('render')
    try {
      if (exportStems) {
        await handleExportStems()
      } else {
        await handleExportMix()
      }
      onOpenChange(false)
    } catch (e) {
      toast.error('Export failed', { description: (e as Error).message })
    } finally {
      setRunning(false)
    }
  }

  const handleExportMix = async () => {
    const options: ExportOptions = {
      format,
      sampleRate,
      normalize,
      bitrateKbps,
      bitDepth: wavBitDepth,
      bpm,
      fx,
      onProgress: (frac, s) => {
        setProgress(frac)
        setStage(s)
      },
    }
    const result = await renderAndExport(tracks, clips, options)
    downloadBlob(result.blob, `${filename || 'audiocake-mix'}.${result.extension}`)
    toast.success('Export complete', {
      description: `${filename}.${result.extension}`,
    })
  }

  // Render mix + one stem per audio track, then bundle them into a zip
  // so the user gets a single download.
  const handleExportStems = async () => {
    const baseOptions: ExportOptions = {
      format,
      sampleRate,
      normalize,
      bitrateKbps,
      bitDepth: wavBitDepth,
      bpm,
      fx,
    }
    // Split overall progress into [0..0.5] mix render, [0.5..0.9] stems
    // render, [0.9..1] encoding+zipping so the bar reads as cumulative
    // work rather than restarting per item.
    setStage('render')
    const mixResult = await renderAndExport(tracks, clips, {
      ...baseOptions,
      onProgress: (frac) => setProgress(frac * 0.5),
    })

    const stems = await renderStems(tracks, clips, {
      ...baseOptions,
      onProgress: (frac) => setProgress(0.5 + frac * 0.4),
    })

    setStage('encode')
    setProgress(0.9)
    const zip = new JSZip()
    const baseFilename = filename || 'audiocake-mix'
    zip.file(`${baseFilename}.${mixResult.extension}`, mixResult.blob)
    const stemsDir = zip.folder('stems')!
    for (const s of stems) {
      const stemBlob = await encodeStemChannels(s.channels, sampleRate, {
        format,
        bitrateKbps,
        bitDepth: wavBitDepth,
      })
      stemsDir.file(
        `${sanitizeFilename(s.track.name) || s.track.id}.${mixResult.extension}`,
        stemBlob.blob,
      )
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' }, (meta) => {
      // generateAsync also reports its own progress; map it into [0.9..1].
      setProgress(0.9 + (meta.percent / 100) * 0.1)
    })
    setProgress(1)
    downloadBlob(zipBlob, `${baseFilename}-stems.zip`)
    toast.success('Stems exported', {
      description: `Mix + ${stems.length} stem${stems.length === 1 ? '' : 's'} in zip`,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export mix</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] tracking-wider uppercase">Filename</Label>
            <div className="flex items-center gap-1">
              <Input
                value={filename}
                onChange={(e) => setFilename(sanitize(e.target.value))}
                className="h-8 text-sm"
              />
              <span className="text-muted-foreground text-xs">
                .{format === 'aac' ? 'm4a' : format}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-[10px] tracking-wider uppercase">Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mp3">MP3 — small, universal</SelectItem>
                <SelectItem value="aac" disabled={!aacAvailable}>
                  AAC {!aacAvailable && '(not supported in this browser)'}
                </SelectItem>
                <SelectItem value="wav">WAV — lossless</SelectItem>
                <SelectItem value="opus" disabled={!aacAvailable}>
                  Opus — best quality per byte
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(format === 'mp3' || format === 'aac' || format === 'opus') && (
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] tracking-wider uppercase">Bitrate (kbps)</Label>
              <Select value={String(bitrateKbps)} onValueChange={(v) => setBitrateKbps(Number(v))}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(format === 'opus' ? [96, 128, 192] : [128, 192, 256, 320]).map((b) => (
                    <SelectItem key={b} value={String(b)}>
                      {b} kbps
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {format === 'wav' && (
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] tracking-wider uppercase">Bit depth</Label>
              <Select
                value={String(wavBitDepth)}
                onValueChange={(v) => setWavBitDepth(Number(v) as 16 | 24)}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16">16-bit PCM (CD quality)</SelectItem>
                  <SelectItem value="24">24-bit PCM (high quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <label className="flex items-center justify-between text-sm">
            <div className="flex flex-col">
              <span>Normalize to −1 dBFS</span>
              <span className="text-muted-foreground text-[10px]">
                Bring the loudest peak to just below clipping.
              </span>
            </div>
            <Switch checked={normalize} onCheckedChange={setNormalize} />
          </label>

          <label className="flex items-center justify-between text-sm">
            <div className="flex flex-col">
              <span>Export stems</span>
              <span className="text-muted-foreground text-[10px]">
                Bundle mix + one file per audio track in a zip.
              </span>
            </div>
            <Switch checked={exportStems} onCheckedChange={setExportStems} />
          </label>

          <div className="text-muted-foreground flex items-center justify-between text-[11px]">
            <span>Estimated size</span>
            <span className="font-mono-num text-foreground">
              {formatBytes(estimatedSize)} · {totalSec.toFixed(1)}s @ {sampleRate / 1000}kHz
            </span>
          </div>

          {running && (
            <div className="bg-background overflow-hidden rounded-sm border">
              <div
                className="bg-primary h-1 transition-[width] duration-100"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
              <div className="text-muted-foreground px-2 py-1 text-[10px]">
                {stage === 'render' ? 'Rendering mix…' : 'Encoding…'} {Math.round(progress * 100)}%
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={running}>
            {running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 64)
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b.toFixed(0)} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** File-safe variant: looser than `sanitize()` because we accept any
 *  character that's legal in a zip entry path. */
function sanitizeFilename(s: string): string {
  return s.replace(/[\/\\:*?"<>|]/g, '_').slice(0, 80)
}

/** Encode a stem's raw channels with the same format as the mix.
 *  Mirrors the `encode()` helper inside `exporter.ts` but inlined here
 *  so each stem can be encoded individually before being zipped. */
async function encodeStemChannels(
  channels: Float32Array[],
  sampleRate: number,
  opts: { format: ExportFormat; bitrateKbps: number; bitDepth: 16 | 24 },
): Promise<{ blob: Blob }> {
  switch (opts.format) {
    case 'wav':
      return { blob: encodeWav({ channels, sampleRate, bitDepth: opts.bitDepth }) }
    case 'mp3':
      return {
        blob: await encodeMp3({ channels, sampleRate, bitrateKbps: opts.bitrateKbps }),
      }
    case 'aac':
    case 'opus':
      return {
        blob: await encodeWebCodecs({
          channels,
          sampleRate,
          codec: opts.format,
          bitrateKbps: opts.bitrateKbps,
        }),
      }
  }
}
