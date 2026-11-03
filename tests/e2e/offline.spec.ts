import { test, expect } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'

test.describe('Offline-first notes', () => {
  test('loads the cached app shell and preserves a guest draft without a network', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(new URL('/', baseURL).toString())
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) throw new Error('Service workers are unavailable')
      await navigator.serviceWorker.ready
    })
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))

    await context.setOffline(true)
    await page.reload()
    await expect(page.locator('.mobile-header')).toBeVisible()

    await page.locator('.mobile-btn').nth(1).click()
    await page.locator('.note-title:visible').fill('Offline capture')
    await page.locator('.note-body:visible').fill('This draft must survive closing and reopening Notely without internet.')
    await expect(page.getByRole('status').filter({ hasText: 'Offline' })).toBeVisible()
    await expect(page.locator('.save-status:visible').first()).toContainText('offline · saved on this device')

    await page.reload()
    await expect(page.locator('.note-title:visible')).toHaveValue('Offline capture')
    await expect(page.locator('.note-body:visible')).toHaveValue('This draft must survive closing and reopening Notely without internet.')
  })
})
