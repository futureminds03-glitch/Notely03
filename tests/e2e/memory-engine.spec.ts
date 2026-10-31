import { test, expect } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'

test.describe('Notely memory engine', () => {
  test('requires an authenticated owner before backfilling memory insights', async ({ request }) => {
    const response = await request.post(new URL('/api/memory/reindex', baseURL).toString(), {
      data: { offset: 0 },
    })
    expect(response.status()).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Sign in to prepare your memory archive.',
    })
  })

  test('Memory Studio can prepare an existing archive in batches without semantic credentials', async ({ page }) => {
    const noteId = '123e4567-e89b-42d3-a456-426614174010'
    await page.route('**/api/notes', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: noteId,
        title: 'A memory about learning',
        body: 'I want to remember the important ideas from this book.',
        created_at: '2026-10-01T10:00:00.000Z',
        updated_at: '2026-10-02T10:00:00.000Z',
        tags: ['Study'],
        synced: true,
      }]),
    }))
    const offsets: number[] = []
    await page.route('**/api/memory/reindex', async route => {
      const payload = route.request().postDataJSON()
      offsets.push(payload.offset)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          processed: 1,
          indexed: 1,
          unchanged: 0,
          failed: 0,
          nextOffset: null,
          semanticEnabled: false,
          message: 'Your memory insights are up to date. Semantic embeddings remain disabled until an embedding provider is configured.',
        }),
      })
    })

    await page.goto(new URL('/memory', baseURL).toString())
    await page.getByRole('button', { name: 'Ask My Memory' }).click()
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Prepare my memory archive' }).click()
    await expect(page.locator('p[role="status"]')).toContainText('Your memory insights are up to date')
    expect(offsets).toEqual([0])
  })
})
