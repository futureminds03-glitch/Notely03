import { test, expect } from '@playwright/test'
import { matchesImageSignature } from '../../lib/image-signature'
import { findStaleNoteImagePaths } from '../../lib/note-image-cleanup'

test('image upload validation accepts supported file signatures and rejects MIME spoofing', () => {
  const cases: Array<{ mime: string; bytes: number[] }> = [
    { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff, 0x00] },
    { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50] },
    { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },
    { mime: 'image/avif', bytes: [0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66] },
  ]
  for (const item of cases) {
    expect(matchesImageSignature(item.mime, Uint8Array.from(item.bytes))).toBe(true)
    expect(matchesImageSignature(item.mime, Uint8Array.from([0x3c, 0x73, 0x76, 0x67]))).toBe(false)
  }
  expect(matchesImageSignature('image/png', new Uint8Array([0x89, 0x50]))).toBe(false)
  expect(matchesImageSignature('image/svg+xml', new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBe(false)
})

test('anonymous image upload is rejected before parsing or storing file data', async ({ browser }) => {
  const page = await browser.newPage()
  await page.goto(process.env.E2E_BASE_URL || 'http://127.0.0.1:3000')
  const status = await page.evaluate(async () => {
    const form = new FormData()
    form.set('noteId', '00000000-0000-4000-8000-000000000000')
    form.set('file', new File(['not-an-image'], 'spoof.png', { type: 'image/png' }))
    return (await fetch('/api/note-images', { method: 'POST', body: form })).status
  })
  expect(status).toBe(401)
  await page.close()
})

test('image cleanup preserves current and historical references and honors its grace period', () => {
  const now = Date.parse('2026-11-04T00:00:00.000Z')
  const folder = 'owner-id/note-id'
  const referenced = new Set([folder + '/current.png', folder + '/history.gif'])
  const stale = findStaleNoteImagePaths([
    { id: '1', name: 'current.png', created_at: '2026-11-01T00:00:00.000Z' },
    { id: '2', name: 'history.gif', created_at: '2026-11-01T00:00:00.000Z' },
    { id: '3', name: 'orphan.png', created_at: '2026-11-01T00:00:00.000Z' },
    { id: '4', name: 'recent.png', created_at: '2026-11-03T12:00:00.000Z' },
    { id: null, name: 'folder', created_at: null },
  ], folder, referenced, now)
  expect(stale).toEqual([folder + '/orphan.png'])
})

test('authenticated users can sync an offline pasted image and retrieve it privately', async ({ browser }) => {
  const email = process.env.E2E_AUTH_EMAIL
  const password = process.env.E2E_AUTH_PASSWORD
  test.skip(!email || !password, 'Set E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD to run authenticated Storage E2E')

  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(process.env.E2E_BASE_URL || 'http://127.0.0.1:3000')
  await page.getByRole('button', { name: /sign in/i }).first().click()
  await page.locator('.modal input[type="email"]').fill(email!)
  await page.locator('.modal input[type="password"]').fill(password!)
  await page.locator('.modal-submit').click()
  await expect(page.locator('.user-email')).not.toBeEmpty({ timeout: 15000 })

  await page.getByRole('button', { name: 'New note' }).click()
  const createResponse = await page.waitForResponse(response =>
    response.url().endsWith('/api/notes') && response.request().method() === 'POST' && response.ok()
  )
  const createdNote = await createResponse.json() as { id: string }
  await page.locator('.desktop-editor textarea.note-title').fill('Authenticated offline image sync E2E')
  const editor = page.locator('.desktop-editor [contenteditable="true"]')
  await editor.fill('A signed-in note with an offline image.')
  await expect(page.locator('.desktop-editor .save-status')).toContainText('saved')
  await page.waitForResponse(response =>
    response.url().includes('/api/notes/' + createdNote.id) && response.request().method() === 'PATCH' && response.ok()
  )

  const spoofStatus = await page.evaluate(async noteId => {
    const form = new FormData()
    form.set('noteId', noteId)
    form.set('file', new File(['<svg onload=alert(1)>'], 'spoof.png', { type: 'image/png' }))
    return (await fetch('/api/note-images', { method: 'POST', body: form })).status
  }, createdNote.id)
  expect(spoofStatus).toBe(415)

  const oversizedStatus = await page.evaluate(async noteId => {
    const form = new FormData()
    form.set('noteId', noteId)
    form.set('file', new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))
    return (await fetch('/api/note-images', { method: 'POST', body: form })).status
  }, createdNote.id)
  expect(oversizedStatus).toBe(413)

  const unknownNoteStatus = await page.evaluate(async () => {
    const form = new FormData()
    form.set('noteId', '00000000-0000-4000-8000-000000000000')
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/K3sAAAAASUVORK5CYII='), character => character.charCodeAt(0))
    form.set('file', new File([bytes], 'valid.png', { type: 'image/png' }))
    return (await fetch('/api/note-images', { method: 'POST', body: form })).status
  })
  expect(unknownNoteStatus).toBe(404)

  await editor.evaluate(element => {
    element.focus()
    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    const encoded = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/K3sAAAAASUVORK5CYII='
    const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0))
    const transfer = new DataTransfer()
    transfer.items.add(new File([bytes], 'authenticated.png', { type: 'image/png' }))
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }))
  })
  await expect(editor.locator('img.note-inline-image')).toHaveCount(1)
  await expect(page.locator('.desktop-editor .save-status')).toContainText('saved')

  await context.setOffline(true)
  await page.reload()
  const offlineEditor = page.locator('.desktop-editor [contenteditable="true"]')
  await expect(offlineEditor.locator('img.note-inline-image')).toHaveCount(1)
  await expect(offlineEditor).toContainText('A signed-in note with an offline image.')

  const uploadPromise = page.waitForResponse(response =>
    response.url().includes('/api/note-images') && response.request().method() === 'POST' && response.status() === 201,
    { timeout: 30000 }
  )
  await context.setOffline(false)
  const upload = await uploadPromise
  const uploaded = await upload.json() as { path: string }
  expect(uploaded.path).toMatch(/^[0-9a-f-]+\/[0-9a-f-]+\/[0-9a-f-]+\.png$/i)

  await expect.poll(async () => offlineEditor.locator('img.note-inline-image').getAttribute('src'), { timeout: 30000 })
    .toContain('/api/note-images?path=')
  const imageSrc = await offlineEditor.locator('img.note-inline-image').getAttribute('src')
  if (!imageSrc) throw new Error('Synced image URL was not rendered')
  const imageResponse = await page.evaluate(async src => {
    const response = await fetch(src)
    return { status: response.status, type: response.headers.get('content-type'), bytes: (await response.arrayBuffer()).byteLength }
  }, imageSrc)
  expect(imageResponse.status).toBe(200)
  expect(imageResponse.type).toContain('image/png')
  expect(imageResponse.bytes).toBeGreaterThan(0)

  const ownPath = '/api/note-images?path=' + encodeURIComponent(uploaded.path)
  const ownImageStatus = await page.evaluate(async path => (await fetch(path)).status, ownPath)
  expect(ownImageStatus).toBe(200)
  const foreignPath = '/api/note-images?path=' + encodeURIComponent('00000000-0000-4000-8000-000000000000/' + uploaded.path.split('/').slice(1).join('/'))
  const foreignImageStatus = await page.evaluate(async path => (await fetch(path)).status, foreignPath)
  expect(foreignImageStatus).toBe(404)
  await context.close()
})
