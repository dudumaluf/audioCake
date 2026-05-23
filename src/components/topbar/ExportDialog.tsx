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
import { renderAndExport, type ExportFormat, type ExportOptions } from '@/lib/audio/exporter'
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

  const [format, setFormat] = useState<ExportFormat>('mp3')
  const [bitrateKbps, setBitrateKbps] = useState(192)
  const [wavBitDepth, setWavBitDepth] = useState<16 | 24>(16)
  const [normalize, setNormalize] = useState(true)
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
      const options: ExportOptions = {
        format,
        sampleRate,
        normalize,
        bitrateKbps,
        bitDepth: wavBitDepth,
        bpm,
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
      onOpenChange(false)
    } catch (e) {
      toast.error('Export failed', { description: (e as Error).message })
    } finally {
      setRunning(false)
    }
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
