import { test, expect } from '@playwright/test'
import { extractLinkPage } from '../../lib/link-extractor'

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'

test.describe('Notely link capture', () => {
  test('extracts page metadata, JSON-LD publication details, and readable article text', () => {
    const html = `
      <!doctype html>
      <html><head>
        <title>Fallback title</title>
        <meta content="Research &amp; better workflows" property="og:title">
        <meta name="description" content="A useful article about working memory and focus.">
        <meta content="Mira &amp; Patel" name="author">
        <meta property="og:site_name" content="Example Journal">
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"NewsArticle","datePublished":"2026-09-15","dateModified":"2026-09-20","publisher":{"@type":"Organization","name":"Example Journal"}}
        </script>
      </head><body>
        <nav>Navigation noise should not be captured.</nav>
        <main>
          <h1>Working with less cognitive load</h1>
          <p>Externalizing the next action can make a complex project easier to resume after an interruption.</p>
          <p>Preserving the source context helps readers verify the original claims and return to the complete article later.</p>
        </main>
        <footer>Footer noise should not be captured.</footer>
      </body></html>`
    const page = extractLinkPage(html, 'https://www.example.com/research/article')
    expect(page).toMatchObject({
      title: 'Research & better workflows',
      description: 'A useful article about working memory and focus.',
      author: 'Mira & Patel',
      publishedAt: '2026-09-15',
      modifiedAt: '2026-09-20',
      publisher: 'Example Journal',
      domain: 'example.com',
    })
    expect(page.fullContent).toContain('Externalizing the next action')
    expect(page.fullContent).toContain('Preserving the source context')
    expect(page.fullContent).not.toContain('Navigation noise')
    expect(page.fullContent).not.toContain('Footer noise')
  })

  const extracted = {
    sourceUrl: 'https://example.com/research/adhd-workflows',
    canonicalUrl: 'https://www.example.com/research/adhd-workflows',
    title: 'Designing calmer workflows for distracted minds',
    description: 'A practical research article about reducing cognitive load.',
    domain: 'example.com',
    author: 'Mira Patel',
    publishedAt: '2026-10-12',
    modifiedAt: null,
    publisher: 'Example Research',
    fullContent: 'A useful article body with enough source text to preserve the context of the original research. The article explains how smaller steps and external reminders can reduce the amount of information a person needs to hold in working memory.',
    image: '',
    analysis: {
      summary: 'The article describes ways to reduce cognitive load by making work easier to resume.',
      keyPoints: ['Keep the next action visible.', 'Capture interruptions without switching tasks.', 'Use short, reversible planning steps.'],
      concepts: ['Cognitive load', 'Working memory', 'Context restoration'],
      potentialTasks: ['Choose one recurring workflow and make its next action visible.'],
    },
    warning: null,
    analysisMode: 'ai',
    extractedAt: '2026-10-30T12:00:00.000Z',
  }

  test('opens link capture from Flow and saves a source-traceable note', async ({ page }) => {
    await page.route('**/api/link-capture', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(extracted),
    }))
    await page.route('**/api/notes', route => {
      if (route.request().method() === 'GET') return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' })
      return route.continue()
    })

    await page.goto(new URL('/flow', baseURL).toString())
    await page.getByRole('link', { name: /Save a webpage/ }).click()
    await expect(page).toHaveURL(/\/flow\/links$/)
    await page.getByLabel('Webpage URL').fill(extracted.sourceUrl)
    await page.getByRole('button', { name: 'Read page' }).click()

    await expect(page.getByRole('heading', { name: extracted.title })).toBeVisible()
    await expect(page.getByText('Mira Patel')).toBeVisible()
    await expect(page.getByText('Example Research')).toBeVisible()
    await expect(page.getByText('Keep the next action visible.')).toBeVisible()
    await expect(page.getByText('Cognitive load', { exact: true })).toBeVisible()
    await expect(page.getByText(/Choose one recurring workflow/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open original' })).toHaveAttribute('href', extracted.sourceUrl)

    await page.getByRole('button', { name: 'Save to Notely' }).click()
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible()
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('notely_notes') || '[]')[0])
    expect(saved.title).toBe(extracted.title)
    expect(saved.tags).toContain('Links')
    expect(saved.body).toContain('Source URL: ' + extracted.sourceUrl)
    expect(saved.body).toContain('Resolved URL: ' + extracted.canonicalUrl)
    expect(saved.body).toContain('Mira Patel')
    expect(saved.body).toContain('Working memory')
    expect(saved.body).toContain('Extracted source content')
  })

  test('keeps extracted content available when cloud save fails', async ({ page }) => {
    await page.route('**/api/link-capture', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(extracted),
    }))
    await page.route('**/api/notes', route => {
      if (route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Database unavailable"}' })
    })
    await page.goto(new URL('/flow/links', baseURL).toString())
    await page.getByLabel('Webpage URL').fill(extracted.sourceUrl)
    await page.getByRole('button', { name: 'Read page' }).click()
    await expect(page.getByRole('heading', { name: extracted.title })).toBeVisible()
    await page.getByRole('button', { name: 'Save to Notely' }).click()
    await expect(page.getByText(/could not save this link to your account/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: extracted.title })).toBeVisible()
  })

  test('validates missing URLs and blocks private network targets', async ({ request }) => {
    const empty = await request.post(new URL('/api/link-capture', baseURL).toString(), { data: { url: ' ' } })
    expect(empty.status()).toBe(400)
    await expect(empty.json()).resolves.toMatchObject({ error: 'Paste a webpage URL to capture it.' })

    const privateTarget = await request.post(new URL('/api/link-capture', baseURL).toString(), { data: { url: 'http://127.0.0.1/' } })
    expect(privateTarget.status()).toBe(400)
    await expect(privateTarget.json()).resolves.toMatchObject({ error: 'This URL cannot be fetched safely. Check the address and try a public webpage.' })
  })


  test('can preserve a URL as a plain note when the publisher blocks extraction', async ({ page }) => {
    await page.route('**/api/link-capture', route => route.fulfill({
      status: 502, contentType: 'application/json',
      body: JSON.stringify({ error: 'Could not read this webpage. It may be private, unavailable, or blocking automated access.' }),
    }))
    await page.route('**/api/notes', route => route.fulfill({
      status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}',
    }))
    await page.goto(new URL('/flow/links', baseURL).toString())
    await page.getByLabel('Webpage URL').fill('example.com/blocked-article')
    await page.getByRole('button', { name: 'Read page' }).click()
    await expect(page.getByRole('alert')).toContainText('blocking automated access')
    await page.getByRole('button', { name: 'Save URL only' }).click()
    await expect(page.getByText(/URL saved to your Notely notes/)).toBeVisible()
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('notely_notes') || '[]')[0])
    expect(saved.title).toBe('Saved link')
    expect(saved.tags).toContain('Links')
    expect(saved.body).toContain('Source URL: example.com/blocked-article')
  })

  test('keeps the link capture layout usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(new URL('/flow/links', baseURL).toString())
    await expect(page.getByRole('heading', { name: 'Save the useful parts.' })).toBeVisible()
    await expect(page.getByLabel('Webpage URL')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
  })
})
