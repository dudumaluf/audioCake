// AudioCake service worker (minimal, app-shell only).
//
// Caches the app shell + AudioWorklets + manifest so the page loads when
// offline. Audio binaries (WAVs in OPFS) are already local-first, so they
// don't need to be cached here.

const SHELL_CACHE = 'audiocake-shell-v1'
const SHELL_URLS = [
  '/',
  '/worklets/recording-processor.js',
  '/worklets/meter-processor.js',
  '/worklets/soundtouch-processor.js',
  '/manifest.webmanifest',
  '/icon.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS).catch(() => {})),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

// Network-first for navigation (so deployed updates appear), cache-first
// for the chunked static assets and worklets.
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy))
          return res
        })
        .catch(() => caches.match('/').then((cached) => cached || Response.error())),
    )
    return
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/worklets/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached
        return fetch(req).then((res) => {
          const copy = res.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy))
          return res
        })
      }),
    )
  }
})
