const { test, expect } = require('@playwright/test')

test.describe('Notely MCP discovery and authentication', () => {
  test('rejects unauthenticated MCP requests with OAuth discovery challenge', async ({ request }) => {
    const response = await request.post('/api/mcp', {
      data: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    })
    expect(response.status()).toBe(401)
    expect(response.headers()['www-authenticate']).toContain('/.well-known/oauth-protected-resource')
  })

  test('rejects malformed bearer credentials', async ({ request }) => {
    const response = await request.post('/api/mcp', {
      headers: { authorization: 'Basic not-a-token' },
      data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    })
    expect(response.status()).toBe(401)
  })

  test('publishes protected-resource metadata for the MCP endpoint', async ({ request }) => {
    const response = await request.get('/.well-known/oauth-protected-resource')
    expect(response.status()).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      resource: 'http://127.0.0.1:3000/api/mcp',
      authorization_servers: ['http://127.0.0.1:3000'],
      bearer_methods_supported: ['header'],
    })
  })

  test('publishes OAuth authorization-code and PKCE metadata', async ({ request }) => {
    const response = await request.get('/.well-known/oauth-authorization-server')
    expect(response.status()).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      issuer: 'http://127.0.0.1:3000',
      authorization_endpoint: 'http://127.0.0.1:3000/api/oauth/authorize',
      token_endpoint: 'http://127.0.0.1:3000/api/oauth/token',
      registration_endpoint: 'http://127.0.0.1:3000/api/oauth/register',
      code_challenge_methods_supported: ['S256'],
    })
  })
})
