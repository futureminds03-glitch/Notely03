import { test, expect } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'

test.describe('Notely Flow', () => {
  test('captures a brain dump without requiring a title or folder', async ({ page }) => {
    await page.goto(new URL('/flow', baseURL).toString())
    await expect(page.getByRole('heading', { name: 'Make room to think.' })).toBeVisible()
    await page.getByRole('textbox', { name: 'Brain dump' }).fill('A loose idea I need to remember later')
    await page.getByRole('button', { name: 'Save thought' }).click()
    await expect.poll(async () => page.evaluate(() => {
      const notes = JSON.parse(localStorage.getItem('notely_notes') || '[]')
      return notes.some((note: { body?: string }) => note.body?.includes('A loose idea I need to remember later'))
    })).toBe(true)
    await expect(page.getByText('Captured. Come back to organize this whenever you want.')).toBeVisible()
    const noteId = await page.evaluate(() => JSON.parse(localStorage.getItem('notely_notes') || '[]')[0].id)
    await page.goto(new URL('/?note=' + encodeURIComponent(noteId), baseURL).toString())
    await expect(page.locator('.note-body')).toHaveValue('A loose idea I need to remember later')
  })

  test('keeps Parking Lot thoughts across reloads and promotes them to notes', async ({ page }) => {
    await page.goto(new URL('/flow', baseURL).toString())
    await page.getByRole('textbox', { name: 'Quick parking lot capture' }).fill('Book the dentist appointment')
    await page.getByRole('button', { name: '+' }).click()
    await page.locator('.flow-tabs').getByRole('button', { name: /Parking Lot/ }).click()
    await expect(page.getByText('Book the dentist appointment')).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: /Parking Lot/ }).click()
    await expect(page.getByText('Book the dentist appointment')).toBeVisible()
    await page.getByRole('button', { name: 'Move to notes' }).click()
    await expect.poll(async () => page.evaluate(() => {
      const notes = JSON.parse(localStorage.getItem('notely_notes') || '[]')
      return notes.some((note: { body?: string }) => note.body === 'Book the dentist appointment')
    })).toBe(true)
    await expect(page.getByText('Nothing parked right now.')).toBeVisible()
  })

  test('organizer rejects empty content without calling the AI provider', async ({ request }) => {
    const response = await request.post(new URL('/api/organize', baseURL).toString(), {
      data: { text: '   ' },
    })
    expect(response.status()).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Add a thought before asking Notely to organize it.' })
  })

  test('offers focus durations and resurfaced memory layouts', async ({ page }) => {
    await page.goto(new URL('/flow', baseURL).toString())
    await page.getByRole('button', { name: 'Focus', exact: true }).click()
    await expect(page.getByText('Choose a small window.')).toBeVisible()
    await expect(page.getByRole('button', { name: '15 min' })).toBeVisible()
    await page.getByRole('button', { name: 'Resurfaced', exact: true }).click()
    await expect(page.getByText('Bring an old thought back.')).toBeVisible()
    await page.getByRole('button', { name: 'Outline' }).click()
    await expect(page.locator('.flow-memory-list.outline')).toBeVisible()
  })

  test('opens Notely Flow from the main navigation', async ({ page }) => {
    await page.goto(new URL('/', baseURL).toString())
    await page.getByRole('link', { name: /Notely Flow/ }).click()
    await expect(page).toHaveURL(/\/flow$/)
    await expect(page.getByRole('heading', { name: 'Make room to think.' })).toBeVisible()
  })

  test('AI De-Clutter leaves the original brain dump untouched', async ({ page }) => {
    await page.route('**/api/organize', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ organized: '## Key points\\n- Keep the original idea\\n- Choose one next step' }),
    }))
    await page.goto(new URL('/flow', baseURL).toString())
    const original = 'A messy thought with several ideas and no clear order'
    await page.getByRole('textbox', { name: 'Brain dump' }).fill(original)
    await page.getByRole('button', { name: /De-clutter/ }).click()
    await expect(page.getByText('One clearer version')).toBeVisible()
    await expect(page.locator('.flow-textarea')).toHaveValue(original)
    await page.getByRole('button', { name: /Save as a new note/ }).click()
    await expect.poll(async () => page.evaluate(() => {
      const notes = JSON.parse(localStorage.getItem('notely_notes') || '[]')
      return notes.some((note: { body?: string }) => note.body?.includes('Original thought') && note.body.includes('Organized version'))
    })).toBe(true)
    await expect(page.locator('.flow-textarea')).toHaveValue(original)
  })

  test('Parking Lot cloud API never exposes data to signed-out visitors', async ({ request }) => {
    const read = await request.get(new URL('/api/parking-lot', baseURL).toString())
    expect(read.status()).toBe(401)
    const write = await request.post(new URL('/api/parking-lot', baseURL).toString(), {
      data: { text: 'A private thought' },
    })
    expect(write.status()).toBe(401)
    const remove = await request.delete(new URL('/api/parking-lot?id=00000000-0000-4000-8000-000000000000', baseURL).toString())
    expect(remove.status()).toBe(401)
  })

  test('organizer enforces the brain-dump size limit', async ({ request }) => {
    const response = await request.post(new URL('/api/organize', baseURL).toString(), {
      data: { text: 'x'.repeat(12001) },
    })
    expect(response.status()).toBe(413)
    await expect(response.json()).resolves.toMatchObject({ error: 'This thought is too long to organize at once. Try a smaller section.' })
  })

})
