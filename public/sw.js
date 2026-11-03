const CACHE = 'notely-v4-local-first'
const STATIC = ['/manifest.json', '/favicon.svg', '/icon.svg']

function isCacheableStaticAsset(request) {
  if (request.method !== 'GET') return false
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return false
  if (STATIC.includes(url.pathname)) return true
  if (!url.pathname.startsWith('/_next/static/')) return false
  return /\.(?:js|css|woff2?|ttf|otf|svg|png|webp|ico)$/i.test(url.pathname)
}

async function cacheRouteShell(cache, path) {
  try {
    const response = await fetch(path)
    if (!response.ok || response.type !== 'basic') return
    await cache.put(path, response.clone())
    const html = await response.text()
    const assets = [...html.matchAll(/(?:src|href)=\"(\\/_next\\/static\\/[^\"]+)\"/g)].map(match => match[1])
    await Promise.all(assets.slice(0, 80).map(async asset => {
      try { const file = await fetch(asset); if (file.ok && file.type === 'basic') await cache.put(asset, file) } catch { /* Retry on first use. */ }
    }))
  } catch { /* A route can be cached after its first successful visit. */ }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    await cache.addAll(STATIC)
    await Promise.all(['/', '/flow', '/memory'].map(path => cacheRouteShell(cache, path)))
  })())
  self.skipWaiting()
})

self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_APP_ASSETS' || !Array.isArray(event.data.urls)) return
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    const urls = event.data.urls.slice(0, 200)
    await Promise.all(urls.map(async value => {
      try {
        const url = new URL(value, self.location.origin)
        if (url.origin !== self.location.origin || !url.pathname.startsWith('/_next/static/')) return
        const request = new Request(url.href, { credentials: 'same-origin' })
        const response = await fetch(request)
        if (response.ok && response.type === 'basic') await cache.put(request, response)
      } catch { /* A failed optional asset can be fetched again when online. */ }
    }))
  })())
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
  const url = new URL(request.url)

  // Keep the generic app shell available for a direct visit while offline.
  // API requests and authenticated data are deliberately never cached here.
  if (request.method === 'GET' && request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok && response.type === 'basic' && url.pathname === '/') {
          const cache = await caches.open(CACHE)
          await cache.put('/', response.clone())
        }
        return response
      } catch {
        const cached = await caches.match(url.pathname) || await caches.match('/')
        return cached || new Response('Notely is offline. Reconnect once to load the app, then your notes will be available offline.', {
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
