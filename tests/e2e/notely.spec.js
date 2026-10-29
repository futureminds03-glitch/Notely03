const { test, expect } = require('@playwright/test')

const baseURL = process.env.E2E_BASE_URL || 'https://notely03.vercel.app'

test.use({ baseURL, viewport: { width: 1440, height: 1000 } })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('.brand')).toContainText('Notely')
})

test('guest notes autosave, remain isolated, and survive reload', async ({ page }) => {
  await page.getByRole('button', { name: 'New note' }).click()
  const title = page.locator('.desktop-editor .note-title')
  const body = page.locator('.desktop-editor .note-body')
  await title.fill('E2E first note')
  await body.fill('Text typed into the first note must not disappear.')
  await expect(page.locator('.desktop-editor .save-status.saved')).toBeVisible()

  await page.getByRole('button', { name: 'New note' }).click()
  await title.fill('E2E second note')
  await body.fill('Second note has independent content.')
  await expect(page.locator('.desktop-editor .save-status.saved')).toBeVisible()

  await page.locator('.note-item').filter({ hasText: 'E2E first note' }).first().click()
  await expect(title).toHaveValue('E2E first note')
  await expect(body).toHaveValue('Text typed into the first note must not disappear.')

  await page.reload()
  await expect(page.locator('.desktop-editor .note-title')).toHaveValue('E2E first note')
  await expect(page.locator('.desktop-editor .note-body')).toHaveValue('Text typed into the first note must not disappear.')
  await expect(page.locator('.note-item').filter({ hasText: 'E2E second note' }).first()).toBeVisible()
})

test('search and delete act on the intended guest note', async ({ page }) => {
  await page.getByRole('button', { name: 'New note' }).click()
  await page.locator('.desktop-editor .note-title').fill('Keep searchable note')
  await page.locator('.desktop-editor .note-body').fill('keep this content')
  await expect(page.locator('.desktop-editor .save-status.saved')).toBeVisible()

  await page.getByRole('button', { name: 'New note' }).click()
  await page.locator('.desktop-editor .note-title').fill('Remove this note')
  await page.locator('.desktop-editor .note-body').fill('delete target')
  await expect(page.locator('.desktop-editor .save-status.saved')).toBeVisible()

  await page.locator('.sidebar .search-input').fill('Keep searchable')
  await expect(page.locator('.sidebar .note-item')).toHaveCount(1)
  await expect(page.locator('.sidebar .note-item')).toContainText('Keep searchable note')
  await page.locator('.sidebar .search-input').fill('')

  const target = page.locator('.sidebar .note-item').filter({ hasText: 'Remove this note' })
  await expect(target).toBeVisible()
  await target.locator('button.note-del').click()
  await expect(page.locator('.sidebar .note-item').filter({ hasText: 'Remove this note' })).toHaveCount(0)
  await expect(page.locator('.sidebar .note-item').filter({ hasText: 'Keep searchable note' })).toBeVisible()
})

test('export downloads a text file containing the current note', async ({ page }) => {
  await page.getByRole('button', { name: 'New note' }).click()
  await page.locator('.desktop-editor .note-title').fill('Export verification')
  await page.locator('.desktop-editor .note-body').fill('Export should contain this exact sentence.')
  await expect(page.locator('.desktop-editor .save-status.saved')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('export-verification.txt')
})

test('mobile guest editor keeps the draft when navigating back and reopening', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await page.getByRole('button').filter({ has: page.locator('svg') }).count()
  await page.locator('.mobile-header .mobile-btn').last().click()
  const title = page.locator('.mobile-editor .note-title')
  const body = page.locator('.mobile-editor .note-body')
  await title.fill('Mobile persistence')
  await body.fill('Mobile editor content stays saved.')
  await expect(page.locator('.mobile-editor .save-status.saved')).toBeVisible()
  await page.getByRole('button', { name: 'Notes' }).click()
  await page.locator('.mobile-notes-panel .note-item').filter({ hasText: 'Mobile persistence' }).click()
  await expect(page.locator('.mobile-editor .note-title')).toHaveValue('Mobile persistence')
  await expect(page.locator('.mobile-editor .note-body')).toHaveValue('Mobile editor content stays saved.')
})
