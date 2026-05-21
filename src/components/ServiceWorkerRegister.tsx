'use client'

import { useEffect } from 'react'

/**
 * Registers the AudioCake service worker so the app can be installed as a
 * PWA and load while offline.
 *
 * Registration is skipped during local dev (`NODE_ENV !== 'production'`)
 * to avoid stale-cache headaches when iterating.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    queueMicrotask(() => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Non-fatal; PWA installability simply won't engage.
      })
    })
  }, [])
  return null
}
