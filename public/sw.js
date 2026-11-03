const CACHE = 'notely-v4-offline-shell'
const STATIC = ['/manifest.json', '/favicon.svg', '/icon.svg', '/offline.html']

function isCacheableStaticAsset(request) {
  if (request.method !== 'GET') return false
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return false
  if (STATIC.includes(url.pathname)) return true
  if (!url.pathname.startsWith('/_next/static/')) return false
  return /\\.(?:js|css|woff2?|ttf|otf|svg|png|webp|ico)$/i.test(url.pathname)
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE)
  await cache.addAll(STATIC)
  try {
    const response = await fetch('/', { cache: 'reload' })
    if (response.ok && response.type === 'basic') await cache.put('/', response.clone())
  } catch {
    // The install can still complete; the next successful navigation will seed the shell.
  }
}

self.addEventListener('install', event => {
  event.waitUntil(cacheAppShell())
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(key => key.startsWith('notely-') && key !== CACHE)
        .map(key => caches.delete(key)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok && response.type === 'basic' && url.pathname === '/') {
          const cache = await caches.open(CACHE)
          await cache.put('/', response.clone())
        }
        return response
      } catch {
        const cache = await caches.open(CACHE)
        if (url.pathname === '/') {
          const shell = await cache.match('/')
          if (shell) return shell
        }
        return (await cache.match('/offline.html')) || new Response('Notely is offline. Reconnect and try again.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
    })())
    return
  }

  if (!isCacheableStaticAsset(request)) return
  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const cached = await cache.match(request)
    if (cached) return cached

    try {
      const response = await fetch(request)
      const cacheControl = response.headers.get('cache-control') || ''
      const vary = response.headers.get('vary') || ''
      if (response.ok && response.type === 'basic' &&
          !/private|no-store|no-cache/i.test(cacheControl) && vary.trim() !== '*') {
        await cache.put(request, response.clone())
      }
      return response
    } catch {
      return (await cache.match(request)) || new Response('Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
  })())
})
