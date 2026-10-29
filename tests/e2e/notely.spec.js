const { test, expect } = require('@playwright/test')

const baseURL = process.env.E2E_BASE_URL || 'https://notely03.vercel.app'

test.use({ baseURL, viewport: { width: 1440, height: 1000 } })

const runtimeErrors = new WeakMap()

async function expectGuestNoteSaved(page, title, body) {
  await expect.poll(async () => page.evaluate(() => {
    const notes = JSON.parse(localStorage.getItem('notely_notes') || '[]')
    return notes.some(note => note.title === title && note.body === body)
  }), { timeout: 8000 }).toBe(true)
}

test.beforeEach(async ({ page }) => {
  const errors = []
  runtimeErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('.brand')).toContainText('Notely')
})

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page) || []).toEqual([])
})

test('guest notes autosave, remain isolated, and survive reload', async ({ page }) => {
  await page.getByRole('button', { name: 'New note' }).click()
  const title = page.locator('.desktop-editor .note-title')
  const body = page.locator('.desktop-editor .note-body')
  await title.fill('E2E first note')
  await body.fill('Text typed into the first note must not disappear.')
  await expectGuestNoteSaved(page, 'E2E first note', 'Text typed into the first note must not disappear.')

  await page.getByRole('button', { name: 'New note' }).click()
  await title.fill('E2E second note')
  await body.fill('Second note has independent content.')
  await expectGuestNoteSaved(page, 'E2E second note', 'Second note has independent content.')

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
  await expectGuestNoteSaved(page, 'Keep searchable note', 'keep this content')

  await page.getByRole('button', { name: 'New note' }).click()
  await page.locator('.desktop-editor .note-title').fill('Remove this note')
  await page.locator('.desktop-editor .note-body').fill('delete target')
  await expectGuestNoteSaved(page, 'Remove this note', 'delete target')

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
  await expectGuestNoteSaved(page, 'Export verification', 'Export should contain this exact sentence.')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('export-verification.txt')
})

test('mobile guest editor keeps the draft when navigating back and reopening', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await page.locator('.mobile-header .mobile-btn').last().click()
  const title = page.locator('.mobile-editor .note-title')
  const body = page.locator('.mobile-editor .note-body')
  await title.fill('Mobile persistence')
  await body.fill('Mobile editor content stays saved.')
  await expectGuestNoteSaved(page, 'Mobile persistence', 'Mobile editor content stays saved.')
  await page.getByRole('button', { name: 'Notes' }).click()
  await page.locator('.mobile-notes-panel .note-item').filter({ hasText: 'Mobile persistence' }).click()
  await expect(page.locator('.mobile-editor .note-title')).toHaveValue('Mobile persistence')
  await expect(page.locator('.mobile-editor .note-body')).toHaveValue('Mobile editor content stays saved.')
})

test('version history can restore an earlier body without losing it on reload', async ({ page }) => {
  await page.getByRole('button', { name: 'New note' }).click()
  const title = page.locator('.desktop-editor .note-title')
  const body = page.locator('.desktop-editor .note-body')
  await title.fill('History restore')
  await body.fill('First durable version of the note.')
  await expectGuestNoteSaved(page, 'History restore', 'First durable version of the note.')
  await page.waitForTimeout(2200)

  await body.fill('Second version with different content.')
  await expectGuestNoteSaved(page, 'History restore', 'Second version with different content.')
  await page.waitForTimeout(2200)

  const slider = page.getByRole('slider', { name: 'Time travel history' })
  await expect(slider).toHaveAttribute('max', /[2-9]/)
  await slider.evaluate(element => {
    element.value = '1'
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(body).toHaveValue('First durable version of the note.')
  await expectGuestNoteSaved(page, 'History restore', 'First durable version of the note.')

  await page.reload()
  await expect(page.locator('.desktop-editor .note-body')).toHaveValue('First durable version of the note.')
})

test('private APIs reject anonymous access and link previews block local targets', async ({ request }) => {
  const listResponse = await request.get('/api/notes')
  expect(listResponse.status()).toBe(401)

  const createResponse = await request.post('/api/notes', { data: { title: 'unauthorized', body: 'must not persist' } })
  expect(createResponse.status()).toBe(401)

  const previewResponse = await request.post('/api/link-preview', {
    data: { url: 'http://127.0.0.1/' },
  })
  expect(previewResponse.status()).toBe(400)

  const manifest = await request.get('/manifest.json')
  expect(manifest.status()).toBe(200)
  expect((await manifest.json()).name).toBe('Notely')

  const serviceWorker = await request.get('/sw.js')
  expect(serviceWorker.status()).toBe(200)
})
