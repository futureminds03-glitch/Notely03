import { test, expect } from '@playwright/test'

test('the app shell and guest notes remain usable after going offline', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(process.env.E2E_BASE_URL || 'http://127.0.0.1:3000')
  await page.waitForFunction(() => 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller), null, { timeout: 10000 })
  await page.waitForFunction(async () => {
    const expected = performance.getEntriesByType('resource')
      .map(entry => entry.name)
      .filter(name => {
        try {
          const url = new URL(name)
          return url.origin === location.origin && url.pathname.startsWith('/_next/static/')
        } catch { return false }
      })
    if (expected.length === 0) return false
    const cache = await caches.open('notely-v4-local-first')
    const cached = new Set((await cache.keys()).map(request => request.url))
    return expected.every(url => cached.has(url))
  }, null, { timeout: 15000 })
  await page.getByRole('button', { name: 'New note' }).click()
  await page.locator('.desktop-editor textarea.note-title').fill('Offline thought')
  await page.locator('.desktop-editor textarea.note-body').fill('This note must survive a disconnected reload.')
  await expect(page.locator('.desktop-editor .save-status')).toContainText('saved')
  await page.waitForTimeout(500)

  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.brand')).toContainText('Notely')
  await expect(page.locator('.notes-list')).toContainText('Offline thought')
  await page.locator('.note-item').filter({ hasText: 'Offline thought' }).click()
  await expect(page.locator('.desktop-editor textarea.note-body')).toHaveValue('This note must survive a disconnected reload.')
  await expect(page.locator('.offline-status')).toContainText('Offline')

  await context.close()
})
