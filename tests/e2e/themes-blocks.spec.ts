import { test, expect } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'

test('theme selector persists the warm and monochrome palettes', async ({ page }) => {
  await page.goto(new URL('/themes', baseURL).toString())
  const cards = page.locator('.theme-card')
  await expect(cards).toHaveCount(2)

  await cards.nth(1).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'mono')
  expect(await page.evaluate(() => localStorage.getItem('notely-theme'))).toBe('mono')

  await page.goto(new URL('/', baseURL).toString())
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'mono')
  expect(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--accent').trim())).toBe('#111')

  await page.goto(new URL('/themes', baseURL).toString())
  await cards.nth(0).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'warm')
  expect(await page.evaluate(() => localStorage.getItem('notely-theme'))).toBe('warm')
})

test('slash menu inserts working to-do, table, database and inline page blocks', async ({ page }) => {
  await page.goto(new URL('/', baseURL).toString())
  await page.locator('.sidebar .new-btn').click()
  const editor = page.getByRole('textbox', { name: 'Note body' })
  await expect(editor).toBeVisible()

  await editor.click()
  await editor.pressSequentially('/')
  await expect(page.getByRole('listbox', { name: 'Insert a block' })).toBeVisible()
  await page.getByRole('option', { name: /To-do list/ }).click()
  const checkbox = page.locator('.note-task-line input[type="checkbox"]:visible').first()
  await expect(checkbox).toBeVisible()
  await checkbox.check()
  await expect(checkbox).toBeChecked()

  await editor.press('Control+End')
  await editor.press('Enter')
  await editor.pressSequentially('/table')
  await page.getByRole('option', { name: /^Table/ }).click()
  await expect(page.locator('.note-inline-table:visible').first()).toBeVisible()

  await editor.press('Control+End')
  await editor.press('Enter')
  await editor.pressSequentially('/database')
  await page.getByRole('option', { name: /Inline database/ }).click()
  await expect(page.locator('.note-inline-table:visible')).toHaveCount(2)

  await editor.press('Control+End')
  await editor.press('Enter')
  await editor.pressSequentially('/page')
  await page.getByRole('option', { name: /Inline page/ }).click()
  await expect(page.locator('.note-inline-page:visible').first()).toContainText('New page')
})

test('Quick Capture capsule sits above the online-sync indicator', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(new URL('/', baseURL).toString())
  const capture = page.locator('.global-parking-launcher')
  const sync = page.locator('.offline-status')
  await expect(capture).toBeVisible()
  await expect(sync).toBeVisible()
  const captureBox = await capture.boundingBox()
  const syncBox = await sync.boundingBox()
  expect(captureBox).not.toBeNull()
  expect(syncBox).not.toBeNull()
  expect(captureBox!.y + captureBox!.height).toBeLessThan(syncBox!.y)
})

test('Time Machine explains capture-date browsing and version history', async ({ page }) => {
  await page.goto(new URL('/', baseURL).toString())
  await page.locator('.sidebar .studio-nav-link[aria-label="Time Machine"]').click()
  await expect(page.locator('.tm-guide')).toBeVisible()
  await expect(page.locator('.tm-guide')).toContainText('original capture date')
  await expect(page.locator('.tm-guide')).toContainText('earlier versions')
})
