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


test('Thought Inbox remains usable offline and survives a disconnected reload', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(new URL('/flow', process.env.E2E_BASE_URL || 'http://127.0.0.1:3000').toString())
  await expect(page.getByRole('heading', { name: 'Make room to think.' })).toBeVisible()
  await page.waitForFunction(() => 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Make room to think.' })).toBeVisible()
  await page.waitForFunction(async () => { const urls = performance.getEntriesByType('resource').map(entry => entry.name).filter(name => { try { const url = new URL(name); return url.origin === location.origin && url.pathname.startsWith('/_next/static/') } catch { return false } }); const cache = await caches.open('notely-v4-local-first'); const cached = new Set((await cache.keys()).map(request => request.url)); return urls.length > 0 && urls.every(url => cached.has(url)) })
  await context.setOffline(true)
  await page.getByRole('textbox', { name: 'Quick parking lot capture' }).fill('Offline inbox thought')
  await page.getByRole('button', { name: '+' }).click()
  await page.locator('.flow-tabs').getByRole('button', { name: /Thought Inbox/ }).click()
  await expect(page.getByText('Offline inbox thought')).toBeVisible()
  await page.reload()
  await page.locator('.flow-tabs').getByRole('button', { name: /Thought Inbox/ }).click()
  await expect(page.getByText('Offline inbox thought')).toBeVisible()
  await context.close()
})

test('Memory Studio can browse and search cached guest memories offline', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(new URL('/memory', process.env.E2E_BASE_URL || 'http://127.0.0.1:3000').toString())
  await page.waitForFunction(() => 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller))
  await page.reload()
  await page.waitForSelector('.memory-studio-scroll')
  await page.waitForFunction(async () => { const urls = performance.getEntriesByType('resource').map(entry => entry.name).filter(name => { try { const url = new URL(name); return url.origin === location.origin && url.pathname.startsWith('/_next/static/') } catch { return false } }); const cache = await caches.open('notely-v4-local-first'); const cached = new Set((await cache.keys()).map(request => request.url)); return urls.length > 0 && urls.every(url => cached.has(url)) })
  await page.evaluate(() => localStorage.setItem('notely_notes', JSON.stringify([{
    id: 'offline-memory-1', title: 'Offline research idea', body: 'A cached thought about local-first writing and memory.',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: ['New Idea']
  }])))
  await page.reload()
  await page.waitForSelector('.memory-studio-scroll')
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('Offline research idea')).toBeVisible()
  await page.getByPlaceholder('Search by phrase, project, person, or idea…').fill('local-first writing')
  await expect(page.getByText('Offline research idea')).toBeVisible()
  await context.close()
})
