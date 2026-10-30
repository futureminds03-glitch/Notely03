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
    await expect(page.locator('.note-body').first()).toHaveValue('A loose idea I need to remember later')
  })

  test('keeps Parking Lot thoughts across reloads and promotes them to notes', async ({ page }) => {
    await page.goto(new URL('/flow', baseURL).toString())
    await page.getByRole('textbox', { name: 'Quick parking lot capture' }).fill('Book the dentist appointment')
    await page.getByRole('button', { name: '+' }).click()
    await page.locator('.flow-tabs').getByRole('button', { name: /Parking Lot/ }).click()
    await expect(page.getByText('Book the dentist appointment')).toBeVisible()
    await page.reload()
    await page.locator('.flow-tabs').getByRole('button', { name: /Parking Lot/ }).click()
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

  test('keeps the Flow shortcut visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(new URL('/', baseURL).toString())
    await page.locator('.mobile-studio-nav').getByRole('link', { name: /Notely Flow/ }).click()
    await expect(page).toHaveURL(/\/flow$/)
    await expect(page.getByRole('heading', { name: 'Make room to think.' })).toBeVisible()
  })

  test('AI De-Clutter leaves the original brain dump untouched', async ({ page }) => {
    await page.route('**/api/organize', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ organized: '## Key points\n- Keep the original idea\n- Choose one next step' }),
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


  test('global quick capture parks a thought without leaving the current screen', async ({ page }) => {
    await page.goto(new URL('/flow', baseURL).toString())
    await page.getByRole('button', { name: 'Quick capture' }).click()
    await expect(page.getByRole('dialog', { name: 'Park it. Keep going.' })).toBeVisible()
    await page.getByRole('textbox', { name: 'Quick thought' }).fill('Remember to send the project update')
    await page.getByRole('button', { name: /Park thought/ }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect.poll(async () => page.evaluate(() => {
      const items = JSON.parse(localStorage.getItem('notely_parking_lot_v1') || '[]')
      return items.some((item: { text?: string }) => item.text === 'Remember to send the project update')
    })).toBe(true)
    await page.locator('.flow-tabs').getByRole('button', { name: /Parking Lot/ }).click()
    await expect(page.getByText('Remember to send the project update')).toBeVisible()
  })

  test('global quick capture opens with the keyboard shortcut on Memory Studio', async ({ page }) => {
    await page.goto(new URL('/memory', baseURL).toString())
    await page.keyboard.press('Control+Shift+Space')
    await expect(page.getByRole('dialog', { name: 'Park it. Keep going.' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Quick thought' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })


  test('Smart Recall APIs reject unsigned requests and forged browser note payloads', async ({ request }) => {
    const ask = await request.post(new URL('/api/memory/ask', baseURL).toString(), {
      data: { question: 'What was my hiring plan?', notes: [{ id: 'forged', title: 'Injected', body: 'Not a real private note' }] },
    })
    expect(ask.status()).toBe(401)
    const search = await request.post(new URL('/api/memory/search', baseURL).toString(), { data: { query: 'hiring engineers' } })
    expect(search.status()).toBe(401)
    const related = await request.post(new URL('/api/memory/related', baseURL).toString(), { data: { noteId: '00000000-0000-4000-8000-000000000000' } })
    expect(related.status()).toBe(401)
  })

  test('Ask My Memory returns source-linked answers from server retrieval', async ({ page }) => {
    const noteId = '123e4567-e89b-42d3-a456-426614174000'
    await page.route('**/api/notes', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: noteId, title: 'Pakistan engineering talent plan', body: 'Build a trusted recruiting network for AI engineers.', created_at: '2026-10-01T10:00:00.000Z', updated_at: '2026-10-02T10:00:00.000Z', tags: ['Work'], synced: true }]),
    }))
    await page.route('**/api/memory/ask', async route => {
      const payload = route.request().postDataJSON()
      expect(payload).toEqual({ question: 'What was my plan for hiring AI engineers?' })
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          answer: 'You planned a trusted recruiting network for AI engineers. [Source 1]',
          mode: 'ai-grounded',
          sources: [{ id: noteId, title: 'Pakistan engineering talent plan', excerpt: 'Build a trusted recruiting network for AI engineers.', created_at: '2026-10-01T10:00:00.000Z', tags: ['Work'], score: 0.82 }],
        }),
      })
    })
    await page.goto(new URL('/memory', baseURL).toString())
    await page.getByRole('button', { name: 'Ask My Memory' }).click()
    await page.getByPlaceholder('What did I write about hiring engineers or starting a business?').fill('What was my plan for hiring AI engineers?')
    await page.getByRole('button', { name: 'Ask my memory' }).click()
    await expect(page.getByText(/trusted recruiting network/)).toBeVisible()
    await expect(page.getByText('SOURCE MEMORIES · 1')).toBeVisible()
    await page.getByRole('button', { name: /Pakistan engineering talent plan/ }).click()
    await expect(page).toHaveURL(new RegExp('note=' + noteId))
  })

  test('Ranked archive search returns source memories and opens the original note', async ({ page }) => {
    const noteId = '123e4567-e89b-42d3-a456-426614174001'
    await page.route('**/api/notes', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: noteId, title: 'AI hiring network', body: 'Recruiting and evaluating software engineers.', created_at: '2026-10-01T10:00:00.000Z', updated_at: '2026-10-02T10:00:00.000Z', tags: ['Work'], synced: true }]),
    }))
    await page.route('**/api/memory/search', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ query: 'recruiting engineers', count: 1, mode: 'ranked-search', sources: [{ id: noteId, title: 'AI hiring network', excerpt: 'Recruiting and evaluating software engineers.', created_at: '2026-10-01T10:00:00.000Z', tags: ['Work'], score: 0.6 }] }),
    }))
    await page.goto(new URL('/memory', baseURL).toString())
    await page.getByPlaceholder('Search by phrase, project, person, or idea…').fill('recruiting engineers')
    await page.keyboard.press('Enter')
    await expect(page.getByText('RANKED RECALL · 1 MATCHES')).toBeVisible()
    await page.getByRole('button', { name: /AI hiring network/ }).click()
    await expect(page).toHaveURL(new RegExp('note=' + noteId))
  })

  test('Related memory recommendations use the selected source note', async ({ page }) => {
    const sourceId = '123e4567-e89b-42d3-a456-426614174002'
    const relatedId = '123e4567-e89b-42d3-a456-426614174003'
    await page.route('**/api/notes', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: sourceId, title: 'AI hiring network', body: 'Recruiting AI engineers.', created_at: '2026-10-01T10:00:00.000Z', updated_at: '2026-10-02T10:00:00.000Z', tags: ['Work'], synced: true },
        { id: relatedId, title: 'Engineering assessment framework', body: 'Evaluate AI engineers with practical projects.', created_at: '2026-10-03T10:00:00.000Z', updated_at: '2026-10-03T10:00:00.000Z', tags: ['Work'], synced: true },
      ]),
    }))
    await page.route('**/api/memory/related', async route => {
      expect(route.request().postDataJSON()).toEqual({ noteId: sourceId })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ source: { id: sourceId, title: 'AI hiring network' }, count: 1, sources: [{ id: relatedId, title: 'Engineering assessment framework', excerpt: 'Evaluate AI engineers with practical projects.', created_at: '2026-10-03T10:00:00.000Z', tags: ['Work'], score: 0.55 }] }) })
    })
    await page.goto(new URL('/memory', baseURL).toString())
    await page.getByRole('button', { name: 'Thought Connections' }).click()
    await page.getByRole('combobox', { name: 'Source memory' }).selectOption(sourceId)
    await page.getByRole('button', { name: 'Find related' }).click()
    await expect(page.getByRole('button', { name: /Engineering assessment framework/ })).toBeVisible()
  })

})
