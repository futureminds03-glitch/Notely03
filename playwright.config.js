const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 25_000,
  expect: { timeout: 7_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
