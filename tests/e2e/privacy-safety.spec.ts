import { test, expect } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'

test.describe('Notely privacy and cache boundaries', () => {
  test('service worker caches public static assets only, never pages or user data', async ({ page }) => {
    await page.goto(baseURL)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

    await page.goto(new URL('/memory', baseURL).toString())
    const cachedUrls = await page.evaluate(async () => {
      const cacheNames = await caches.keys()
      const entries = await Promise.all(cacheNames.map(async name => {
        const cache = await caches.open(name)
        return (await cache.keys()).map(request => new URL(request.url).pathname)
      }))
      return entries.flat()
    })

    expect(cachedUrls.length).toBeGreaterThan(0)
    for (const pathname of cachedUrls) {
      const isPublicStaticAsset =
        pathname === '/manifest.json' ||
        pathname === '/favicon.svg' ||
        pathname === '/icon.svg' ||
        (pathname.startsWith('/_next/static/') &&
          /\.(?:js|css|woff2?|ttf|otf|svg|png|webp|ico)$/i.test(pathname))
      expect(pathname, 'only public immutable assets may be cached').toMatch(
        /^(?:\/manifest\.json|\/favicon\.svg|\/icon\.svg|\/_next\/static\/.*)$/
      )
      expect(isPublicStaticAsset, pathname).toBe(true)
      expect(pathname).not.toBe('/')
      expect(pathname).not.toBe('/memory')
      expect(pathname).not.toContain('/api/')
    }
  })

  test('private note and memory endpoints reject anonymous requests', async ({ request }) => {
    const checks = [
      request.get(new URL('/api/notes', baseURL).toString()),
      request.post(new URL('/api/notes', baseURL).toString(), { data: { title: 'private', body: 'must not persist' } }),
      request.post(new URL('/api/memory/search', baseURL).toString(), { data: { query: 'private note' } }),
      request.post(new URL('/api/memory/ask', baseURL).toString(), { data: { question: 'private note' } }),
      request.post(new URL('/api/memory/related', baseURL).toString(), { data: { noteId: '123e4567-e89b-42d3-a456-426614174000' } }),
      request.post(new URL('/api/memory/reindex', baseURL).toString(), { data: { offset: 0 } }),
      request.get(new URL('/api/parking-lot', baseURL).toString()),
      request.get(new URL('/api/account/export', baseURL).toString()),
      request.post(new URL('/api/account/delete', baseURL).toString()),
      request.get(new URL('/api/notes/trash', baseURL).toString()),
      request.delete(new URL('/api/notes/123e4567-e89b-42d3-a456-426614174000', baseURL).toString()),
    ]
    const responses = await Promise.all(checks)
    expect(responses.map(response => response.status())).toEqual([401, 401, 401, 401, 401, 401, 401, 401, 401, 401, 401])
  })
})


test.describe('Notely external AI consent boundaries', () => {
  test('AI text-processing endpoints never proceed without explicit consent', async ({ request }) => {
    const summarize = await request.post(new URL('/api/summarize', baseURL).toString(), {
      data: { title: 'Private note', body: 'Private content must not be sent without consent.' },
    })
    const organize = await request.post(new URL('/api/organize', baseURL).toString(), {
      data: { text: 'Private thought must not be sent without consent.' },
    })
    expect([428, 503]).toContain(summarize.status())
    expect([428, 503]).toContain(organize.status())
  })
})
