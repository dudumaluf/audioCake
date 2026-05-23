'use client'

import { Circle, Download, Loader2, Pause, Play, Repeat, SkipBack, Square } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LevelMeter } from '@/components/io/LevelMeter'
import { DevicePicker } from '@/components/io/DevicePicker'
import { ExportDialog } from './ExportDialog'
import { ProjectSwitcher } from './ProjectSwitcher'
import { TapTempo } from './TapTempo'
import { useRecorder } from '@/hooks/useRecorder'
import { useIOStore } from '@/lib/state/io-store'
import { useProjectStore } from '@/lib/state/project-store'
import { useTransportStore } from '@/lib/state/transport-store'
import { formatBarBeat } from '@/lib/utils/time'
import { formatTime } from '@/lib/utils/audio-math'
import { cn } from '@/lib/utils'

interface TopbarProps {
  onPlay: () => void
  onPause: () => void
  onStop: () => void
}

/**
 * Topbar holds the project label, device picker, recording controls, the
 * transport (play/pause/stop/loop + BPM + time readout), and the live
 * input meter.
 */
export function Topbar({ onPlay, onPause, onStop }: TopbarProps) {
  const recorder = useRecorder()
  const { countIn, setCountIn, metronomeOnPlay, setMetronomeOnPlay } = useIOStore()
  const bpm = useProjectStore((s) => s.bpm)
  const setBpm = useProjectStore((s) => s.setBpm)
  const loopEnabled = useProjectStore((s) => s.loopEnabled)
  const setLoopEnabled = useProjectStore((s) => s.setLoopEnabled)
  const isPlaying = useTransportStore((s) => s.isPlaying)
  const playheadSec = useTransportStore((s) => s.playheadSec)

  const isRecording = recorder.state === 'recording'
  const isCountIn = recorder.state === 'count-in'
  const isSaving = recorder.state === 'saving'
  const isMonitoring = recorder.state === 'monitoring' || isCountIn
  const [exportOpen, setExportOpen] = useState(false)

  return (
    <header className="border-border bg-panel/60 flex h-14 w-full shrink-0 items-center gap-3 overflow-hidden border-b px-3 backdrop-blur">
      <div className="flex shrink-0 items-center gap-2 pr-1">
        {/* Brand dot doubles as a glanceable REC state indicator: pulsing
            red while we're recording or counting in, calm amber otherwise. */}
        <div
          className={cn(
            'size-3 rounded-full',
            isRecording || isCountIn ? 'bg-record animate-rec-pulse' : 'bg-primary rounded-sm',
          )}
          title={isRecording ? 'Recording' : isCountIn ? 'Count-in…' : 'AudioCake'}
        />
        <ProjectSwitcher />
      </div>

      <div className="bg-border/80 h-6 w-px shrink-0" />

      <div className="flex min-w-0 shrink items-center gap-2">
        <DevicePicker />
        <Button
          variant={isMonitoring ? 'secondary' : 'outline'}
          size="sm"
          className="shrink-0"
          onClick={() => (isMonitoring ? recorder.stopMonitor() : recorder.startMonitor())}
          disabled={!recorder.selectedInputId || isRecording || isSaving}
        >
          {isMonitoring ? 'Stop monitor' : 'Start monitor'}
        </Button>
      </div>

      {/* Meter is the elastic zone: shrinks first when the topbar gets tight,
          so transport + record controls always stay visible. */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <LevelMeter
          peaks={recorder.levels.peaks}
          heldPeaks={recorder.levels.heldPeaks}
          orientation="horizontal"
          segments={22}
          className="max-w-[200px] min-w-0"
        />
        <span className="text-muted-foreground font-mono-num shrink-0 text-[10px]">
          {isMonitoring ? 'LIVE' : '---'}
        </span>
      </div>

      {/* Transport cluster — always full size */}
      <div className="bg-background/40 border-border/60 flex shrink-0 items-center gap-2 rounded-md border px-2 py-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={onStop}
                aria-label="Stop and return to zero"
              >
                <SkipBack className="size-3.5 fill-current" />
              </Button>
            }
          />
          <TooltipContent>Stop and return to zero</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon"
                onClick={isPlaying ? onPause : onPlay}
                className="size-8"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="size-4 fill-current" />
                ) : (
                  <Play className="size-4 fill-current" />
                )}
              </Button>
            }
          />
          <TooltipContent>{isPlaying ? 'Pause (Space)' : 'Play (Space)'}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={loopEnabled ? 'secondary' : 'ghost'}
                size="icon"
                className="size-7"
                onClick={() => setLoopEnabled(!loopEnabled)}
                aria-label="Loop"
              >
                <Repeat className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent>Loop region (L)</TooltipContent>
        </Tooltip>
        <div className="bg-border/80 mx-1 h-5 w-px" />
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-[10px] tracking-wider uppercase">BPM</span>
          <Input
            type="number"
            value={bpm}
            min={20}
            max={300}
            onChange={(e) => setBpm(Number.parseFloat(e.target.value) || bpm)}
            className="h-6 w-14 px-1 text-center text-xs"
          />
          <TapTempo />
        </div>
        <div className="bg-border/80 mx-1 h-5 w-px" />
        <div className="font-mono-num flex flex-col items-end leading-tight">
          <span className="text-foreground text-[11px]">{formatTime(playheadSec)}</span>
          <span className="text-muted-foreground text-[9px]">
            {formatBarBeat(playheadSec, bpm)}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <label className="flex items-center gap-1.5 text-xs">
                <Switch
                  checked={countIn}
                  onCheckedChange={setCountIn}
                  aria-label="1-bar count-in"
                />
                <span className="text-muted-foreground hidden xl:inline">Count-in</span>
              </label>
            }
          />
          <TooltipContent>1-bar count-in before recording starts.</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <label className="flex items-center gap-1.5 text-xs">
                <Switch
                  checked={metronomeOnPlay}
                  onCheckedChange={setMetronomeOnPlay}
                  aria-label="Metronome on play"
                />
                <span className="text-muted-foreground hidden xl:inline">Click</span>
              </label>
            }
          />
          <TooltipContent>Metronome click during playback (never in exports).</TooltipContent>
        </Tooltip>

        {isRecording || isCountIn ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => recorder.stopCapture()}
            className="font-medium"
          >
            <Square className="size-4 fill-current" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => recorder.startCapture()}
            disabled={!recorder.selectedInputId || isSaving}
            className={cn('font-medium', 'bg-record hover:bg-record/90 text-white')}
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Circle className="size-4 fill-current" />
            )}
            {isSaving ? 'Saving…' : 'Record'}
          </Button>
        )}

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportOpen(true)}
                aria-label="Export mix"
              >
                <Download className="size-4" />
                Export
              </Button>
            }
          />
          <TooltipContent>Export mix (⌘E)</TooltipContent>
        </Tooltip>
      </div>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </header>
  )
}
