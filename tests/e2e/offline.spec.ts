import { test, expect } from '@playwright/test'

test('the app shell and guest notes remain usable after going offline', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(process.env.E2E_BASE_URL || 'http://127.0.0.1:3000')
  await page.waitForFunction(() => 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller), null, { timeout: 10000 })
  await page.getByRole('button', { name: 'New note' }).click()
  await page.locator('textarea.note-title').fill('Offline thought')
  await page.locator('textarea.note-body').fill('This note must survive a disconnected reload.')
  await expect(page.locator('.save-status')).toContainText('saved')
  await page.waitForTimeout(500)

  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.brand')).toContainText('Notely')
  await expect(page.locator('.notes-list')).toContainText('Offline thought')
  await page.locator('.note-item').filter({ hasText: 'Offline thought' }).click()
  await expect(page.locator('textarea.note-body')).toHaveValue('This note must survive a disconnected reload.')
  await expect(page.getByRole('status')).toContainText('Offline')

  await context.close()
})
