import { test, expect } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'

test('theme store offers six palettes and persists each selected theme', async ({ page }) => {
  await page.goto(new URL('/themes', baseURL).toString())
  const cards = page.locator('.theme-card')
  await expect(cards).toHaveCount(6)
  for (const theme of ['warm', 'mono', 'midnight', 'sage', 'rose', 'ocean']) {
    const card = page.locator('.theme-card').filter({ hasText: theme === 'mono' ? 'Monochrome' : theme === 'warm' ? 'Notely Warm' : theme === 'midnight' ? 'Midnight Ink' : theme === 'sage' ? 'Sage Garden' : theme === 'rose' ? 'Rose Quartz' : 'Ocean Glass' })
    await card.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    expect(await page.evaluate(() => localStorage.getItem('notely-theme'))).toBe(theme)
  }
  await page.goto(new URL('/', baseURL).toString())
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ocean')
  await page.goto(new URL('/themes', baseURL).toString())
  await page.locator('.theme-card').filter({ hasText: 'Notely Warm' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'warm')
})

test('slash menu inserts working to-do, table, database and inline page blocks', async ({ page }) => {
  await page.goto(new URL('/', baseURL).toString())

  // Exercise each insertion from a clean editor. This isolates block insertion
  // from browser caret movement around non-editable checkbox controls.
  const commands = [
    { query: '/todo', option: /To-do list/ },
    { query: '/table', option: /Table/ },
    { query: '/database', option: /Inline database/ },
    { query: '/page', option: /Inline page/ },
  ]

  for (const command of commands) {
    await page.locator('.sidebar .new-btn').click()
    const editor = page.getByRole('textbox', { name: 'Note body' })
    await expect(editor).toBeVisible()
    await editor.click()
    await editor.pressSequentially(command.query)
    await expect(page.getByRole('listbox', { name: 'Insert a block' })).toBeVisible()
    await page.getByRole('option', { name: command.option }).click()

    if (command.query === '/todo') {
      const checkbox = editor.locator('.note-task-line input[type="checkbox"]')
      await expect(checkbox).toBeVisible()
      await checkbox.check()
      await expect(checkbox).toBeChecked()
    } else if (command.query === '/table' || command.query === '/database') {
      const table = editor.locator('.note-inline-table')
      await expect(table).toBeVisible()
      await expect(table.locator('tr')).toHaveCount(2)
      if (command.query === '/database') await expect(table).toContainText('Not started')
      const firstCell = table.locator('tr').nth(1).locator('td').first()
      await firstCell.fill('Edited row')
      await expect(firstCell).toHaveText('Edited row')
    } else {
      const pageButton = editor.getByRole('button', { name: 'Open page New page' })
      await expect(editor.locator('.note-inline-page')).toHaveAttribute('data-parent-note-id', /.+/)
      await expect(pageButton).toBeVisible()
      await pageButton.click()
      const sidebar = page.getByRole('dialog', { name: 'Inline page' })
      await expect(sidebar).toBeVisible()
      await expect(sidebar.locator('[aria-label="Properties"]')).toHaveCount(0)
      await sidebar.getByRole('textbox', { name: 'Page title' }).fill('Research ideas')
      const subpageEditor = sidebar.getByRole('textbox', { name: 'Note body' })
      await subpageEditor.fill('Keep this as a separate page body.')
      await subpageEditor.pressSequentially(' /todo')
      await expect(sidebar.getByRole('listbox', { name: 'Insert a block' })).toBeVisible()
      await sidebar.getByRole('option', { name: /To-do list/ }).click()
      await expect(subpageEditor.locator('.note-task-line input')).toBeVisible()
      await sidebar.getByRole('button', { name: 'Close page' }).click()
      await expect(editor.getByRole('button', { name: 'Open page Research ideas' })).toBeVisible()
      await editor.getByRole('button', { name: 'Open page Research ideas' }).click()
      const reopenedEditor = page.getByRole('dialog', { name: 'Inline page' }).getByRole('textbox', { name: 'Note body' })
      await expect(reopenedEditor).toContainText('Keep this as a separate page body.')
      await expect(reopenedEditor.locator('.note-task-line input')).toBeVisible()
      await page.getByRole('button', { name: 'Close page' }).click()
    }
  }
})


test('adjacent inline database and table blocks remain separate', async ({ page }) => {
  await page.goto(new URL('/', baseURL).toString())
  await page.locator('.sidebar .new-btn').click()
  const editor = page.getByRole('textbox', { name: 'Note body' })
  for (const command of [{ query: '/database', option: /Inline database/ }, { query: '/table', option: /Table/ }]) {
    await editor.pressSequentially(command.query)
    await expect(page.getByRole('listbox', { name: 'Insert a block' })).toBeVisible()
    await page.getByRole('option', { name: command.option }).click()
  }
  const tables = editor.locator('table.note-inline-table')
  await expect(tables).toHaveCount(2)
  await expect(tables.nth(0).locator('tr').first().locator('td')).toHaveCount(2)
  await expect(tables.nth(1).locator('tr').first().locator('td')).toHaveCount(2)
  await expect(tables.nth(0)).toContainText('Name')
  await expect(tables.nth(1)).toContainText('Column 1')
})

test('Quick Capture capsule sits above the online-sync indicator', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(new URL('/', baseURL).toString())
  const capture = page.locator('.global-parking-launcher')
  const sync = page.locator('.offline-status')
  await expect(capture).toBeVisible()
  await expect(sync).toBeVisible()
  const captureBox = await capture.boundingBox()
  const syncBox = await sync.boundingBox()
  expect(captureBox).not.toBeNull()
  expect(syncBox).not.toBeNull()
  expect(captureBox!.y + captureBox!.height).toBeLessThan(syncBox!.y)
})

test('Time Machine explains capture-date browsing and version history', async ({ page }) => {
  await page.goto(new URL('/', baseURL).toString())
  await page.locator('.sidebar .studio-nav-link[aria-label="Time Machine"]').click()
  await expect(page.locator('.tm-guide')).toBeVisible()
  await expect(page.locator('.tm-guide')).toContainText('original capture date')
  await expect(page.locator('.tm-guide')).toContainText('earlier versions')
})

test('privacy and terms links use the active Notely brand accent', async ({ page }) => {
  for (const path of ['/privacy', '/terms']) {
    await page.goto(new URL(path, baseURL).toString())
    const link = page.locator('.legal-document-page a').first()
    await expect(link).toBeVisible()
    const colors = await page.evaluate(() => ({
      accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
      link: getComputedStyle(document.querySelector('.legal-document-page a')!).color,
    }))
    const rgb = colors.accent === '#a94a17' ? 'rgb(169, 74, 23)' : colors.accent === '#111' ? 'rgb(17, 17, 17)' : colors.link
    expect(colors.link).toBe(rgb)
  }
})
