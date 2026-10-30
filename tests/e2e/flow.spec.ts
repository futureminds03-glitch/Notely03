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
    await expect(page.getByText('Captured. You can come back to organize this whenever you want.')).toBeVisible()
  })

  test('keeps Parking Lot thoughts across reloads and promotes them to notes', async ({ page }) => {
    await page.goto(new URL('/flow', baseURL).toString())
    await page.getByRole('textbox', { name: 'Quick parking lot capture' }).fill('Book the dentist appointment')
    await page.getByRole('button', { name: '+' }).click()
    await page.getByRole('button', { name: /Parking Lot/ }).click()
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
})
