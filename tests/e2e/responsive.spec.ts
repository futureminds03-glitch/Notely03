import { test, expect } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
const viewports = [
  { name: 'small phone', width: 320, height: 568 },
  { name: 'phone', width: 360, height: 800 },
  { name: 'large phone', width: 430, height: 932 },
  { name: 'mobile breakpoint', width: 640, height: 800 },
  { name: 'desktop breakpoint', width: 641, height: 800 },
  { name: 'phone landscape', width: 844, height: 390 },
  { name: 'small tablet', width: 768, height: 1024 },
  { name: 'tablet landscape', width: 1024, height: 768 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1920, height: 1080 },
]

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page, scope = 'document') {
  const dimensions = await page.evaluate((selector) => {
    const target = selector === 'document'
      ? document.documentElement
      : Array.from(document.querySelectorAll(selector)).find((element) => {
          const rect = element.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0
        }) as HTMLElement | undefined ?? null
    if (!target) return null
    return { clientWidth: target.clientWidth, scrollWidth: target.scrollWidth }
  }, scope)
  expect(dimensions, `Expected ${scope} to exist`).not.toBeNull()
  expect(dimensions!.scrollWidth, `${scope} overflows horizontally at ${page.viewportSize()?.width}px`).toBeLessThanOrEqual(dimensions!.clientWidth + 1)
}

test.describe('Responsive product experience', () => {
  for (const viewport of viewports) {
    test(`keeps all primary workspaces usable at ${viewport.name} (${viewport.width}×${viewport.height})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      await page.goto(new URL('/', baseURL).toString())
      await expect(page.locator('.app')).toBeVisible()
      await expectNoHorizontalOverflow(page)
      await expectNoHorizontalOverflow(page, '.editor-area')
      const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content')
      expect(viewportMeta).not.toMatch(/user-scalable=no|maximum-scale=1/)

      const timeMachine = page.locator(viewport.width <= 640
        ? '.mobile-studio-nav .studio-nav-link[aria-label="Time Machine"]'
        : '.sidebar .studio-nav-link[aria-label="Time Machine"]')
      await timeMachine.click()
      await expect(page.locator('.time-machine')).toBeVisible()
      await expectNoHorizontalOverflow(page, '.time-machine')

      await page.goto(new URL('/', baseURL).toString())
      if (viewport.width <= 640) await page.locator('.mobile-header .mobile-btn').last().click()
      else await page.locator('.sidebar .new-btn').click()
      await expect(page.locator('.note-title:visible').first()).toBeVisible()
      await expectNoHorizontalOverflow(page, '.toolbar')

      await page.goto(new URL('/flow', baseURL).toString())
      await expect(page.getByRole('heading', { name: 'Make room to think.' })).toBeVisible()
      await expect(page.getByRole('link', { name: /Save a webpage/ })).toBeVisible()
      await expectNoHorizontalOverflow(page)
      await expectNoHorizontalOverflow(page, '.flow-page')

      await page.goto(new URL('/flow/links', baseURL).toString())
      await expect(page.getByRole('heading', { name: 'Save the useful parts.' })).toBeVisible()
      await expect(page.locator('.link-capture-page')).toHaveCSS('overflow-y', 'auto')
      await expectNoHorizontalOverflow(page)
      await expectNoHorizontalOverflow(page, '.link-capture-page')

      await page.goto(new URL('/memory', baseURL).toString())
      await expect(page.getByRole('heading', { name: 'A little more room to think.' })).toBeVisible()
      await expectNoHorizontalOverflow(page)
      await expectNoHorizontalOverflow(page, '.memory-studio-scroll')
    })
  }

  test('keeps Flow and Link Capture vertically scrollable on a short phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 400 })
    await page.goto(new URL('/flow', baseURL).toString())
    const flow = page.locator('.flow-page')
    await expect(flow).toHaveCSS('overflow-y', 'auto')
    const flowCanScroll = await flow.evaluate(el => el.scrollHeight > el.clientHeight)
    expect(flowCanScroll).toBe(true)

    await page.goto(new URL('/flow/links', baseURL).toString())
    const links = page.locator('.link-capture-page')
    await expect(links).toHaveCSS('overflow-y', 'auto')
    const linksCanScroll = await links.evaluate(el => el.scrollHeight > el.clientHeight)
    expect(linksCanScroll).toBe(true)
  })
})
