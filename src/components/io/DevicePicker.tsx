'use client'

import { Mic, MicOff } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAudioInputs } from '@/hooks/useAudioInputs'
import { useIOStore } from '@/lib/state/io-store'

/**
 * Audio input device picker for the topbar.
 *
 * Before permission is granted, browsers report empty device labels — so
 * we render an explicit "Enable audio input" button that triggers a
 * one-shot getUserMedia just to get the permission grant.
 *
 * Once a device is chosen, the selection is persisted via ioStore so it
 * survives reloads.
 */
export function DevicePicker() {
  const { devices, labelsAvailable, error, requestPermission, refresh } = useAudioInputs()
  const { selectedInputId, selectedInputLabel, setSelectedInput } = useIOStore()

  // If the saved device disappears (e.g. unplugged), keep the label visible
  // so the user knows what they had selected, but don't try to use it.
  useEffect(() => {
    if (!selectedInputId) return
    const present = devices.some((d) => d.deviceId === selectedInputId)
    if (!present && devices.length === 0) return // probably just an enumeration timing
    if (!present) {
      // Auto-reselect by label if a matching device reappears.
      const byLabel = devices.find((d) => d.label === selectedInputLabel)
      if (byLabel) setSelectedInput(byLabel.deviceId, byLabel.label)
    }
  }, [devices, selectedInputId, selectedInputLabel, setSelectedInput])

  if (!labelsAvailable && devices.length === 0 && !error) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await requestPermission()
        }}
      >
        <MicOff className="size-4" />
        Enable audio input
      </Button>
    )
  }

  if (!labelsAvailable) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await requestPermission()
          refresh()
        }}
      >
        <MicOff className="size-4" />
        Allow microphone to see devices
      </Button>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Mic className="text-muted-foreground size-4 shrink-0" />
      <Select
        value={selectedInputId ?? undefined}
        onValueChange={(id) => {
          const d = devices.find((x) => x.deviceId === id)
          if (d) setSelectedInput(d.deviceId, d.label)
        }}
      >
        {/* Cap the trigger width so a long unlabeled device-id (which browsers
            return before mic permission is granted) doesn't push the topbar's
            right-side controls off-screen. */}
        <SelectTrigger size="sm" className="w-[200px] max-w-[200px] min-w-0">
          <span className="block truncate text-left">
            <SelectValue placeholder="Select audio input" />
          </span>
        </SelectTrigger>
        <SelectContent>
          {devices.map((d) => (
            <SelectItem key={d.deviceId} value={d.deviceId}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
