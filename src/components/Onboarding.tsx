'use client'

import { Download, Music, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const FIRST_LAUNCH_KEY = 'audiocake.firstLaunchSeen'
const INSTALL_DISMISSED_KEY = 'audiocake.installDismissed'

// Chrome / Edge / Brave fire `beforeinstallprompt` with a `prompt()`
// method we can call later. Typed minimally; the official type isn't in
// lib.dom yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Bottom-left cluster that combines two first-launch concerns:
 *
 * 1. A welcome hint shown once on the very first visit (any future visit
 *    is silent). Explains the three quick wins: pick an input, hit
 *    record, drop the take onto the timeline.
 * 2. A PWA install banner that appears when the browser fires
 *    `beforeinstallprompt` and the user hasn't dismissed it before.
 *    Clicking Install triggers the deferred prompt; dismissing remembers
 *    that decision in localStorage so we don't pester them.
 *
 * Both live in the same cluster so the layout is predictable and they
 * don't fight for screen space with the StorageBanner (bottom-right).
 */
export function Onboarding() {
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  // Welcome flag check + capture install prompt.
  useEffect(() => {
    queueMicrotask(() => {
      try {
        if (!localStorage.getItem(FIRST_LAUNCH_KEY)) {
          setWelcomeOpen(true)
          localStorage.setItem(FIRST_LAUNCH_KEY, '1')
        }
      } catch {
        /* private mode etc — silently skip */
      }
    })

    const handler = (e: Event) => {
      try {
        if (localStorage.getItem(INSTALL_DISMISSED_KEY)) return
      } catch {
        return
      }
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    try {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (choice.outcome === 'dismissed') {
        try {
          localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
        } catch {
          /* */
        }
      }
    } catch {
      /* */
    } finally {
      setInstallPrompt(null)
    }
  }

  const handleDismissInstall = () => {
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
    } catch {
      /* */
    }
    setInstallPrompt(null)
  }

  if (!welcomeOpen && !installPrompt) return null

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-50 flex flex-col items-start gap-2">
      {welcomeOpen && (
        <div
          className={cn(
            'border-primary/40 bg-panel/95 pointer-events-auto flex max-w-sm items-start gap-3 rounded-md border px-3 py-2 text-sm shadow-lg backdrop-blur',
          )}
        >
          <Music className="text-primary mt-0.5 size-4 shrink-0" />
          <div className="flex-1 leading-relaxed">
            <div className="font-medium">Welcome to AudioCake</div>
            <ul className="text-muted-foreground mt-1 flex list-inside list-disc flex-col gap-0.5 text-xs">
              <li>Pick your audio device in the top bar</li>
              <li>Hit Start monitor → Record to capture a take</li>
              <li>Drag library takes onto the timeline to arrange</li>
            </ul>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground -mt-1 -mr-1 size-7 shrink-0"
            aria-label="Dismiss"
            onClick={() => setWelcomeOpen(false)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}
      {installPrompt && (
        <div
          className={cn(
            'border-monitor/40 bg-panel/95 pointer-events-auto flex max-w-sm items-start gap-3 rounded-md border px-3 py-2 text-sm shadow-lg backdrop-blur',
          )}
        >
          <Download className="text-monitor mt-0.5 size-4 shrink-0" />
          <div className="flex-1 leading-relaxed">
            <div className="font-medium">Install AudioCake</div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              Pin it to your Mac dock for one-click access — works offline.
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => void handleInstall()}>
                Install
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismissInstall}>
                Not now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
