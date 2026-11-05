/* Worldbook service worker: makes the app installable and fully usable offline.
 * - App shell + hashed assets: cached on install, served cache-first.
 * - Page navigations: network-first (so a new deploy shows up on next load), cache as the offline fallback.
 * User data lives in IndexedDB and never goes through here. */
const CACHE = 'worldbook-shell-v1'
const BASE = self.registration.scope

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      const res = await fetch(BASE, { cache: 'reload' })
      const html = await res.clone().text()
      await cache.put(BASE, res)
      const found = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => new URL(m[1], BASE).href)
      const extra = ['manifest.webmanifest', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'].map((p) => new URL(p, BASE).href)
      await Promise.all([...new Set([...found, ...extra])].filter((u) => u.startsWith(BASE)).map((u) => cache.add(u).catch(() => undefined)))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin || !url.href.startsWith(BASE)) return
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE)
        try {
          const fresh = await fetch(req)
          if (fresh.ok) cache.put(BASE, fresh.clone())
          return fresh
        } catch {
          return (await cache.match(BASE)) || (await cache.match(req)) || Response.error()
        }
      })(),
    )
    return
  }
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const hit = await cache.match(req)
      if (hit) return hit
      const res = await fetch(req)
      if (res.ok) cache.put(req, res.clone())
      return res
    })(),
  )
})
