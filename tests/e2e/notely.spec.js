const { test, expect } = require('@playwright/test')
const fs = require('node:fs/promises')

const baseURL = process.env.E2E_BASE_URL || 'https://notely03.vercel.app'

test.use({ baseURL, viewport: { width: 1440, height: 1000 } })

const runtimeErrors = new WeakMap()

async function expectGuestNoteSaved(page, title, body) {
  await expect.poll(async () => page.evaluate(({ expectedTitle, expectedBody }) => {
    const notes = JSON.parse(localStorage.getItem('notely_notes') || '[]')
    return notes.some(note => note.title === expectedTitle && note.body === expectedBody)
  }, { expectedTitle: title, expectedBody: body }), { timeout: 8000 }).toBe(true)
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
  await body.pressSequentially('Text typed into the first note must not disappear.', { delay: 2 })

  // Switch before the debounce interval ends: the outgoing draft must flush first.
  await page.getByRole('button', { name: 'New note' }).click()
  await expectGuestNoteSaved(page, 'E2E first note', 'Text typed into the first note must not disappear.')
  await title.fill('E2E second note')
  await body.fill('Second note has independent content.')
  await expectGuestNoteSaved(page, 'E2E second note', 'Second note has independent content.')

  await page.locator('.note-item').filter({ hasText: 'E2E first note' }).first().click()
  await expect(title).toHaveValue('E2E first note')
  await expect(body).toHaveValue('Text typed into the first note must not disappear.')

  await page.reload()
  await page.locator('.note-item').filter({ hasText: 'E2E first note' }).first().click()
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

  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 })
  await page.getByRole('button', { name: 'Export' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('export-verification.txt')
  const downloadedPath = await download.path()
  const downloadedText = await fs.readFile(downloadedPath, 'utf8')
  expect(downloadedText).toContain('Export verification')
  expect(downloadedText).toContain('Export should contain this exact sentence.')
})

test('mobile guest editor keeps the draft when navigating back and reopening', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await page.locator('.mobile-header .mobile-btn').last().click()
  const title = page.locator('.mobile-editor .note-title')
  const body = page.locator('.mobile-editor .note-body')
  await title.fill('Mobile persistence')
  await body.pressSequentially('Mobile editor content stays saved.', { delay: 2 })
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
  await slider.focus()
  await slider.press('Home')
  await slider.press('ArrowRight')
  await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible()
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(body).toHaveValue('First durable version of the note.')
  await expectGuestNoteSaved(page, 'History restore', 'First durable version of the note.')

  await page.reload()
  await page.locator('.note-item').filter({ hasText: 'History restore' }).first().click()
  await expect(page.locator('.desktop-editor .note-body')).toHaveValue('First durable version of the note.')
})

test('private APIs reject anonymous access and link previews block local targets', async ({ request }) => {
  const listResponse = await request.get('/api/notes')
  expect(listResponse.status()).toBe(401)

  const createResponse = await request.post('/api/notes', { data: { title: 'unauthorized', body: 'must not persist' } })
  expect(createResponse.status()).toBe(401)

  const updateResponse = await request.patch('/api/notes/not-a-real-id', { data: { body: 'must not persist' } })
  expect(updateResponse.status()).toBe(401)
  const deleteResponse = await request.delete('/api/notes/not-a-real-id')
  expect(deleteResponse.status()).toBe(401)

  for (const url of [
    'http://127.0.0.1/',
    'http://10.0.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://localhost/',
    'http://example.com:8080/',
    'https://example.com:80/',
    'http://example.com:443/',
    'https://user:pass@example.com/',
    'file:///etc/passwd',
  ]) {
    const previewResponse = await request.post('/api/link-preview', { data: { url } })
    expect(previewResponse.status(), `should reject unsafe target: ${url}`).toBe(400)
  }

  const publicPreview = await request.post('/api/link-preview', {
    data: { url: 'https://example.com/' },
    timeout: 15_000,
  })
  expect(publicPreview.status()).toBe(200)
  expect((await publicPreview.json()).domain).toBe('example.com')

  const manifest = await request.get('/manifest.json')
  expect(manifest.status()).toBe(200)
  expect((await manifest.json()).name).toBe('Notely')

  const serviceWorker = await request.get('/sw.js')
  expect(serviceWorker.status()).toBe(200)
})

test('sign-in and sign-up modal modes return cleanly to guest mode', async ({ page }) => {
  await page.locator('.sidebar-footer .auth-btn').click()
  await expect(page.locator('.modal-title')).toHaveText('Welcome back.')
  await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
  await expect(page.getByPlaceholder('••••••••')).toBeVisible()

  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
  await page.locator('.modal-tabs .modal-tab').filter({ hasText: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Sign in' }).last()).toBeVisible()

  await page.getByRole('button', { name: /Continue as guest/ }).click()
  await expect(page.locator('.modal')).toHaveCount(0)
  await expect(page.locator('.sidebar-footer')).toContainText('guest mode')
})

test('long titles wrap without horizontal overflow and mobile editor focus stays visible', async ({ page }) => {
  await page.getByRole('button', { name: 'New note' }).click()
  const desktopTitle = page.locator('.desktop-editor .note-title')
  const longTitle = 'LongTitleWithoutSpaces'.repeat(10)
  await desktopTitle.fill(longTitle)
  await expect.poll(async () => desktopTitle.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(70)

  const desktopMetrics = await desktopTitle.evaluate(element => ({
    height: element.getBoundingClientRect().height,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }))
  expect(desktopMetrics.scrollWidth).toBeLessThanOrEqual(desktopMetrics.clientWidth + 1)
  expect(desktopMetrics.scrollHeight).toBeLessThanOrEqual(desktopMetrics.clientHeight + 2)
  await expectGuestNoteSaved(page, longTitle, '')

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileTitle = page.locator('.mobile-editor .note-title')
  await expect(mobileTitle).toBeVisible()
  await expect.poll(async () => mobileTitle.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(70)
  const mobileMetrics = await mobileTitle.evaluate(element => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }))
  expect(mobileMetrics.scrollWidth).toBeLessThanOrEqual(mobileMetrics.clientWidth + 1)
  expect(mobileMetrics.scrollHeight).toBeLessThanOrEqual(mobileMetrics.clientHeight + 2)

  await page.locator('.mobile-back-btn').click()
  await page.locator('.mobile-header .mobile-btn').last().click()
  await expect.poll(async () => mobileTitle.evaluate(element => element === document.activeElement)).toBe(true)
  await mobileTitle.press('Enter')
  await expect.poll(async () => page.locator('.mobile-editor .note-body').evaluate(element => element === document.activeElement)).toBe(true)
})

test('Time Machine browses notes by day, week, and month and opens the original note', async ({ page }) => {
  await page.getByRole('button', { name: 'New note' }).click()
  const title = page.locator('.desktop-editor .note-title')
  const body = page.locator('.desktop-editor .note-body')
  await title.fill('Thought from the timeline')
  await body.fill('This thought must be findable by the day it was captured.')
  await expectGuestNoteSaved(page, 'Thought from the timeline', 'This thought must be findable by the day it was captured.')
  await page.getByRole('button', { name: 'Time Machine' }).first().click()
  await expect(page.getByRole('heading', { name: 'Time Machine' })).toBeVisible()
  await page.getByRole('button', { name: 'Day', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Thought from the timeline', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Month', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Thought from the timeline', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Open Thought from the timeline' }).click()
  await expect(page.locator('.desktop-editor .note-title')).toHaveValue('Thought from the timeline')
  await expect(page.locator('.desktop-editor .note-body')).toHaveValue('This thought must be findable by the day it was captured.')
})

test('Memory Studio captures thoughts, tags them, resurfaces notes, and finds connections', async ({ page }) => {
  await page.goto('/memory')
  const capture = page.getByPlaceholder('A thought, an idea, something to remember…')
  await capture.fill('Build a thoughtful personal knowledge system for collecting ideas.')
  await page.getByRole('button', { name: 'Capture thought' }).click()
  await expect(page.getByText('Thought captured in this browser.')).toBeVisible()
  await expect.poll(async () => page.evaluate(() => {
    const notes = JSON.parse(localStorage.getItem('notely_notes') || '[]')
    return notes.some(note => note.body.includes('personal knowledge system') && note.tags?.includes('Brain Dump'))
  })).toBe(true)

  await page.getByPlaceholder('A thought, an idea, something to remember…').fill('Personal knowledge system connections should help ideas grow.')
  await page.getByRole('button', { name: 'Capture thought' }).click()
  await page.getByRole('button', { name: 'Thought Connections' }).click()
  await expect(page.getByText('Thoughts that may belong together')).toBeVisible()
  await expect(page.getByRole('button', { name: /Build a thoughtful personal knowledge system/ })).toBeVisible()

  await page.getByRole('button', { name: 'Thought Inbox' }).click()
  await expect(page.getByText('A thought from before')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Another memory' })).toBeVisible()
})
