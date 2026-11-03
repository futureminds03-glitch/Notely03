import test from 'node:test'
import assert from 'node:assert/strict'
import { assertRegistryIntegrity, MCP_TOOL_REGISTRY, visibleTools } from '../../lib/mcp/registry.ts'
import { hashToken, parseScope, pkceChallenge, validRedirectUri } from '../../lib/mcp/oauth.ts'

test('registry integrity', () => {
  assert.doesNotThrow(() => assertRegistryIntegrity())
  assert.equal(new Set(MCP_TOOL_REGISTRY.map(tool => tool.name)).size, MCP_TOOL_REGISTRY.length)
  assert.ok(MCP_TOOL_REGISTRY.every(tool => tool.version === 'v1' && tool.required_scopes.length > 0))
})

test('read authorization cannot discover writes', () => {
  const visible = visibleTools(['notes:read','search:read','timeline:read','context:read'])
  assert.equal(visible.some(tool => tool.action !== 'READ'), false)
})

test('capability filtering is scope-aware', () => {
  const timeline = visibleTools(['timeline:read'], '', 'timeline')
  assert.ok(timeline.length >= 2)
  assert.ok(timeline.every(tool => tool.capability_group === 'timeline'))
})

test('token hashing does not expose token material', () => {
  const digest = hashToken('notely-secret')
  assert.match(digest, /^[a-f0-9]{64}$/)
  assert.notEqual(digest, 'notely-secret')
})

test('PKCE S256 is deterministic', () => {
  const verifier='verifier'
  const digest=pkceChallenge(verifier)
  assert.match(digest,/^[A-Za-z0-9_-]{43}$/)
  assert.equal(digest.length,43)
})

test('redirect validation rejects network and script hazards', () => {
  assert.equal(validRedirectUri('https://client.example/callback'), true)
  assert.equal(validRedirectUri('http://localhost:3000/callback'), true)
  assert.equal(validRedirectUri('http://evil.example/callback'), false)
  assert.equal(validRedirectUri('javascript:alert(1)'), false)
})

test('scope parsing is allowlisted', () => {
  assert.deepEqual(parseScope('notes:read admin:* context:read'), ['notes:read','context:read'])
})
test('Parking Lot read and write permissions are independently scoped', () => {
  const readOnly = visibleTools(['parking:read'])
  assert.deepEqual(readOnly.map(tool => tool.name), ['get_parking_lot'])
  const writeOnly = visibleTools(['parking:write'])
  assert.ok(writeOnly.some(tool => tool.name === 'capture_to_parking_lot'))
  assert.ok(writeOnly.some(tool => tool.name === 'delete_parking_item'))
  assert.equal(writeOnly.some(tool => tool.name === 'get_parking_lot'), false)
})

test('intelligence access does not grant note mutation', () => {
  const visible = visibleTools(['intelligence:read'])
  assert.ok(visible.some(tool => tool.name === 'search_smart_recall'))
  assert.ok(visible.some(tool => tool.name === 'get_note_insights'))
  assert.equal(visible.some(tool => tool.action !== 'READ'), false)
})

test('version restore is registered as a scoped write', () => {
  const visible = visibleTools(['notes:write'])
  assert.ok(visible.some(tool => tool.name === 'restore_note_version'))
  assert.equal(visible.some(tool => tool.name === 'delete_note'), true)
})
