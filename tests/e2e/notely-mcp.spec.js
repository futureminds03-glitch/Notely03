const { test, expect } = require('@playwright/test')

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
const ORIGIN = new URL(BASE_URL).origin

test.describe('Notely MCP discovery and authentication', () => {
  test('rejects unauthenticated MCP requests with OAuth discovery challenge', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/mcp`, {
      data: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    })
    expect(response.status()).toBe(401)
    expect(response.headers()['www-authenticate']).toContain('/.well-known/oauth-protected-resource')
  })

  test('rejects malformed bearer credentials', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/mcp`, {
      headers: { authorization: 'Basic not-a-token' },
      data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    })
    expect(response.status()).toBe(401)
  })

  test('publishes protected-resource metadata for the MCP endpoint', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/.well-known/oauth-protected-resource`)
    expect(response.status()).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      resource: `${ORIGIN}/api/mcp`,
      authorization_servers: [ORIGIN],
      bearer_methods_supported: ['header'],
    })
  })

  test('publishes OAuth authorization-code and PKCE metadata', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/.well-known/oauth-authorization-server`)
    expect(response.status()).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/api/oauth/authorize`,
      token_endpoint: `${ORIGIN}/api/oauth/token`,
      registration_endpoint: `${ORIGIN}/api/oauth/register`,
      code_challenge_methods_supported: ['S256'],
    })
  })
})
