const { test, expect } = require('@playwright/test')

test.describe('Notely MCP endpoint', () => {
  test('rejects requests without a Notely access token', async ({ request }) => {
    const response = await request.post('/api/mcp', {
      data: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
    })
    expect(response.status()).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'A valid Notely Supabase access token is required.' })
  })

  test('rejects malformed authorization headers', async ({ request }) => {
    const response = await request.post('/api/mcp', {
      headers: { authorization: 'Basic not-a-token' },
      data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    })
    expect(response.status()).toBe(401)
  })

  test('exposes only the supported HTTP transport', async ({ request }) => {
    const response = await request.get('/api/mcp')
    expect(response.status()).toBe(405)
    expect(response.headers().allow).toContain('POST')
  })
})
