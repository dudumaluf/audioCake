'use client'

import { Circle, Loader2, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LevelMeter } from '@/components/io/LevelMeter'
import { DevicePicker } from '@/components/io/DevicePicker'
import { useRecorder } from '@/hooks/useRecorder'
import { useIOStore } from '@/lib/state/io-store'
import { cn } from '@/lib/utils'

/**
 * Topbar holds the project name, device picker, recording controls, and
 * the live input meter.
 *
 * The level meter is wired to a shared monitor stream; opening / closing
 * the stream is managed by `useRecorder` so the user only sees the meter
 * light up when their device is actually being read.
 */
export function Topbar() {
  const recorder = useRecorder()
  const { countIn, setCountIn } = useIOStore()

  const isRecording = recorder.state === 'recording'
  const isCountIn = recorder.state === 'count-in'
  const isSaving = recorder.state === 'saving'
  const isMonitoring = recorder.state === 'monitoring' || isCountIn

  return (
    <header className="border-border bg-panel/60 flex h-14 shrink-0 items-center gap-3 border-b px-3 backdrop-blur">
      <div className="flex items-center gap-2 pr-2">
        <div className="bg-primary size-3 rounded-sm" />
        <span className="font-semibold tracking-tight">AudioCake</span>
        <span className="text-muted-foreground hidden text-xs sm:inline">v0.1</span>
      </div>

      <div className="bg-border/80 h-6 w-px" />

      <DevicePicker />

      <Button
        variant={isMonitoring ? 'secondary' : 'outline'}
        size="sm"
        onClick={() => (isMonitoring ? recorder.stopMonitor() : recorder.startMonitor())}
        disabled={!recorder.selectedInputId || isRecording || isSaving}
      >
        {isMonitoring ? 'Stop monitor' : 'Start monitor'}
      </Button>

      <div className="ml-2 flex min-w-[180px] flex-1 items-center gap-3">
        <LevelMeter
          peaks={recorder.levels.peaks}
          heldPeaks={recorder.levels.heldPeaks}
          orientation="horizontal"
          segments={28}
          className="max-w-[260px]"
        />
        <span className="text-muted-foreground font-mono-num text-[10px]">
          {isMonitoring ? 'LIVE' : '---'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <label className="flex items-center gap-1.5 text-xs">
                <Switch
                  checked={countIn}
                  onCheckedChange={setCountIn}
                  aria-label="1-bar count-in"
                />
                <span className="text-muted-foreground">Count-in</span>
              </label>
            }
          />
          <TooltipContent>1-bar count-in before recording starts.</TooltipContent>
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
      </div>
    </header>
  )
}
