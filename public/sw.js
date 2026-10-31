const CACHE = 'notely-v3-static-only'
const STATIC = ['/manifest.json', '/favicon.svg', '/icon.svg']

function isCacheableStaticAsset(request) {
  if (request.method !== 'GET') return false
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return false
  if (STATIC.includes(url.pathname)) return true
  if (!url.pathname.startsWith('/_next/static/')) return false
  return /\.(?:js|css|woff2?|ttf|otf|svg|png|webp|ico)$/i.test(url.pathname)
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC)))
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
