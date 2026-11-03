import { test, expect } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'

test.describe('Notely privacy and cache boundaries', () => {
  test('service worker caches only generic app route shells and public static assets, never private user data', async ({ page }) => {
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
        pathname === '/' || pathname === '/flow' || pathname === '/memory' ||
        pathname === '/manifest.json' ||
        pathname === '/favicon.svg' ||
        pathname === '/icon.svg' ||
        (pathname.startsWith('/_next/static/') &&
          /\.(?:js|css|woff2?|ttf|otf|svg|png|webp|ico)$/i.test(pathname))
      expect(pathname, 'only the generic app shell or public immutable assets may be cached').toMatch(
        /^(?:\/|\/flow|\/memory|\/manifest\.json|\/favicon\.svg|\/icon\.svg|\/_next\/static\/.*)$/
      )
      expect(isPublicStaticAsset, pathname).toBe(true)
      if (pathname === '/' || pathname === '/flow' || pathname === '/memory') {
        const shell = await page.evaluate(async (path) => {
          const response = await caches.match(path)
          return response ? response.clone().text() : ''
        }, pathname)
        expect(shell).toContain('Notely')
        expect(shell).not.toContain('Private note')
        expect(shell).not.toContain('Offline thought')
      }
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


test('serves baseline browser security headers', async ({ request }) => {
  const response = await request.get(baseURL)
  const headers = response.headers()
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(headers['permissions-policy']).toContain('microphone=(self)')
})

test('privacy and terms pages remain readable on mobile and keyboard navigable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(new URL('/privacy', baseURL).toString())
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  await page.keyboard.press('Tab')
  await expect(page.locator('a').first()).toBeFocused()

  await page.goto(new URL('/terms', baseURL).toString())
  await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
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


test('key interface text colors meet WCAG AA contrast against their surfaces', async ({ page }) => {
  await page.goto(baseURL)
  const ratios = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const parse = (value: string) => {
      const hex = value.trim().match(/^#([0-9a-f]{6})$/i)?.[1]
      if (!hex) throw new Error('Expected a six-digit hex color: ' + value)
      return [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    }
    const luminance = (value: string) => {
      const channels = parse(value).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
    }
    const contrast = (foreground: string, background: string) => {
      const a = luminance(foreground)
      const b = luminance(background)
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    }
    const paper = root.getPropertyValue('--paper').trim()
    const paperDeep = root.getPropertyValue('--paper-deep').trim()
    const accent = root.getPropertyValue('--accent').trim()
    const accentWarm = root.getPropertyValue('--accent-warm').trim()
    const accentFaint = root.getPropertyValue('--accent-faint').trim()
    const inkFaint = root.getPropertyValue('--ink-faint').trim()
    return {
      mutedOnPaper: contrast(inkFaint, paper),
      mutedOnSidebar: contrast(inkFaint, paperDeep),
      accentOnPaper: contrast(accent, paper),
      accentOnAccentSurface: contrast(accent, accentFaint),
      whiteOnAccentHover: contrast('#ffffff', accentWarm),
      savedStatusOnPaper: contrast('#526b3a', paper),
      flowErrorOnPaper: contrast('#a84d43', paper),
    }
  })
  for (const [name, ratio] of Object.entries(ratios)) {
    expect(ratio, name + ' contrast ratio').toBeGreaterThanOrEqual(4.5)
  }
})
