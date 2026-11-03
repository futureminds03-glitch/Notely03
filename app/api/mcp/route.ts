import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PROTOCOL_VERSION = '2025-03-26'
const MAX_REQUEST_BYTES = 64_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type JsonRpcRequest = { jsonrpc?: unknown; id?: string | number | null; method?: unknown; params?: unknown }
type ToolResult = { content: Array<{ type: 'text'; text: string }>; structuredContent?: unknown; isError?: boolean }

const tools = [
  { name: 'list_notes', description: 'List the authenticated user’s active Notely notes. Supports pagination and optional tag filtering.', inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 }, offset: { type: 'integer', minimum: 0, maximum: 10000, default: 0 }, tag: { type: 'string', maxLength: 80 } }, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: 'get_note', description: 'Retrieve one of the authenticated user’s notes, including its complete body and timestamps.', inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'], additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: 'create_note', description: 'Create a note in the authenticated user’s Notely account. The note is saved to the same collection used by the Notely app.', inputSchema: { type: 'object', properties: { title: { type: 'string', maxLength: 500 }, body: { type: 'string', maxLength: 100000 }, tags: { type: 'array', items: { type: 'string', maxLength: 80 }, maxItems: 20 } }, required: ['body'], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'update_note', description: 'Update an existing active note. Only supplied fields are changed. Body changes are recorded in Notely version history.', inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, title: { type: 'string', maxLength: 500 }, body: { type: 'string', maxLength: 100000 }, tags: { type: 'array', items: { type: 'string', maxLength: 80 }, maxItems: 20 } }, required: ['id'], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'archive_note', description: 'Archive an active note in the authenticated user’s account. This is reversible in the Notely data model but removes it from the active notes list.', inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false } },
  { name: 'search_notes', description: 'Search the authenticated user’s notes using Notely’s indexed full-text retrieval. Returns ranked, source-linked excerpts.', inputSchema: { type: 'object', properties: { query: { type: 'string', minLength: 2, maxLength: 500 }, limit: { type: 'integer', minimum: 1, maximum: 10, default: 10 } }, required: ['query'], additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: 'list_parking_lot', description: 'List the authenticated user’s synced Parking Lot thoughts.', inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 } }, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: 'park_thought', description: 'Save a thought to the authenticated user’s Notely Parking Lot without requiring organization.', inputSchema: { type: 'object', properties: { text: { type: 'string', minLength: 1, maxLength: 12000 } }, required: ['text'], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'remove_parked_thought', description: 'Permanently remove one thought from the authenticated user’s Parking Lot.', inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false } },
  { name: 'search_memories', description: 'Use Notely Smart Recall to find relevant memories with ranked retrieval. Returns source IDs, excerpts, tags and match reasons; does not send note content to an AI provider.', inputSchema: { type: 'object', properties: { query: { type: 'string', minLength: 2, maxLength: 500 }, limit: { type: 'integer', minimum: 1, maximum: 10, default: 10 } }, required: ['query'], additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false } },
] as const

function response(id: string | number | null | undefined, result: unknown, status = 200) {
  return Response.json({ jsonrpc: '2.0', id: id ?? null, result }, { status, headers: { 'MCP-Protocol-Version': PROTOCOL_VERSION, 'Access-Control-Allow-Origin': '*' } })
}
function rpcError(id: string | number | null | undefined, code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }, { status, headers: { 'MCP-Protocol-Version': PROTOCOL_VERSION, 'Access-Control-Allow-Origin': '*' } })
}
function toolResult(value: unknown): ToolResult {
  const text = JSON.stringify(value, null, 2)
  return { content: [{ type: 'text', text }], structuredContent: value }
}
function toolError(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}
function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function integer(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback
}
function validId(value: unknown): value is string { return typeof value === 'string' && UUID.test(value) }

async function authenticate(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+([A-Za-z0-9._~-]+)$/i.exec(authorization)
  if (!match) return { error: 'A valid Notely Supabase access token is required.' } as const
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { error: 'Notely authentication is not configured.' } as const
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: 'Bearer ' + match[1] } } })
  const { data, error } = await supabase.auth.getUser(match[1])
  if (error || !data.user) return { error: 'The Notely access token is invalid or expired.' } as const
  return { supabase, user: data.user } as const
}

async function callTool(name: string, args: Record<string, unknown>, supabase: ReturnType<typeof createClient>, userId: string): Promise<ToolResult> {
  if (name === 'list_notes') {
    const limit = integer(args.limit, 20, 1, 50), offset = integer(args.offset, 0, 0, 10000)
    let query = supabase.from('documents').select('id,title,body,tags,created_at,updated_at,started_at').eq('user_id', userId).eq('status', 'active').order('updated_at', { ascending: false }).range(offset, offset + limit - 1)
    if (typeof args.tag === 'string' && args.tag.trim()) query = query.contains('tags', [args.tag.trim()])
    const { data, error } = await query
    if (error) return toolError('Could not list notes.')
    return toolResult({ count: data?.length ?? 0, limit, offset, notes: (data ?? []).map(n => ({ ...n, excerpt: n.body.slice(0, 500), body: undefined })) })
  }
  if (name === 'get_note') {
    if (!validId(args.id)) return toolError('A valid note UUID is required.')
    const { data, error } = await supabase.from('documents').select('id,title,body,tags,status,created_at,updated_at,started_at').eq('id', args.id).eq('user_id', userId).eq('status', 'active').maybeSingle()
    if (error || !data) return toolError('Note not found.')
    return toolResult(data)
  }
  if (name === 'create_note') {
    if (typeof args.body !== 'string' || args.body.length > 100000) return toolError('Note body must be a string up to 100,000 characters.')
    const title = typeof args.title === 'string' ? args.title : ''
    if (title.length > 500) return toolError('Note title is too long.')
    const tags = Array.isArray(args.tags) ? args.tags.filter((v): v is string => typeof v === 'string').map(v => v.trim()).filter(Boolean).slice(0, 20) : []
    const { data, error } = await supabase.from('documents').insert({ user_id: userId, title, body: args.body, tags, status: 'active', provenance: 'user_created' }).select('id,title,body,tags,created_at,updated_at').single()
    if (error || !data) return toolError('Could not create note.')
    await supabase.from('document_versions').insert({ document_id: data.id, version_number: 1, title: data.title, body: data.body })
    return toolResult(data)
  }
  if (name === 'update_note') {
    if (!validId(args.id)) return toolError('A valid note UUID is required.')
    const updates: Record<string, unknown> = {}
    if (args.title !== undefined) { if (typeof args.title !== 'string' || args.title.length > 500) return toolError('Invalid title.'); updates.title = args.title }
    if (args.body !== undefined) { if (typeof args.body !== 'string' || args.body.length > 100000) return toolError('Invalid body.'); updates.body = args.body }
    if (args.tags !== undefined) { if (!Array.isArray(args.tags) || args.tags.some(v => typeof v !== 'string')) return toolError('Tags must be an array of strings.'); updates.tags = args.tags.map(v => (v as string).trim()).filter(Boolean).slice(0, 20) }
    if (!Object.keys(updates).length) return toolError('Provide at least one field to update.')
    const { data: before } = await supabase.from('documents').select('body').eq('id', args.id).eq('user_id', userId).eq('status', 'active').maybeSingle()
    if (!before) return toolError('Note not found.')
    const { data, error } = await supabase.from('documents').update(updates).eq('id', args.id).eq('user_id', userId).eq('status', 'active').select('id,title,body,tags,created_at,updated_at').maybeSingle()
    if (error || !data) return toolError('Could not update note.')
    if (typeof updates.body === 'string' && updates.body !== before.body) {
      const { data: latest } = await supabase.from('document_versions').select('version_number').eq('document_id', args.id).order('version_number', { ascending: false }).limit(1).maybeSingle()
      await supabase.from('document_versions').insert({ document_id: args.id, version_number: (latest?.version_number ?? 0) + 1, body: data.body })
    }
    return toolResult(data)
  }
  if (name === 'archive_note') {
    if (!validId(args.id)) return toolError('A valid note UUID is required.')
    const { data, error } = await supabase.from('documents').update({ status: 'archived', archived_at: new Date().toISOString() }).eq('id', args.id).eq('user_id', userId).eq('status', 'active').select('id').maybeSingle()
    if (error || !data) return toolError('Note not found or could not be archived.')
    return toolResult({ archived: true, id: data.id })
  }
  if (name === 'search_notes' || name === 'search_memories') {
    if (typeof args.query !== 'string' || args.query.trim().length < 2 || args.query.trim().length > 500) return toolError('Search query must contain 2–500 characters.')
    const limit = integer(args.limit, 10, 1, 10)
    const { data, error } = await supabase.rpc('search_my_memories_hybrid', { p_search_text: args.query.trim(), p_query_embedding: null, p_result_limit: limit, p_exclude_id: null })
    if (error) return toolError('Notely Smart Recall is temporarily unavailable.')
    return toolResult({ query: args.query.trim(), count: data?.length ?? 0, mode: 'ranked-search', sources: data ?? [] })
  }
  if (name === 'list_parking_lot') {
    const limit = integer(args.limit, 50, 1, 100)
    const { data, error } = await supabase.from('documents').select('id,body,created_at').eq('user_id', userId).eq('status', 'parking').order('created_at', { ascending: false }).limit(limit)
    if (error) return toolError('Could not load Parking Lot.')
    return toolResult({ count: data?.length ?? 0, thoughts: (data ?? []).map(row => ({ id: row.id, text: row.body, createdAt: row.created_at })) })
  }
  if (name === 'park_thought') {
    if (typeof args.text !== 'string' || !args.text.trim() || args.text.length > 12000) return toolError('Thought must contain 1–12,000 characters.')
    const text = args.text.trim()
    const title = text.split(/\r?\n/, 1)[0].replace(/\s+/g, ' ').slice(0, 72) || 'Parked thought'
    const { data, error } = await supabase.from('documents').insert({ user_id: userId, title, body: text, status: 'parking', tags: ['Parking Lot'], provenance: 'user_created' }).select('id,body,created_at').single()
    if (error || !data) return toolError('Could not save this thought to Parking Lot.')
    return toolResult({ id: data.id, text: data.body, createdAt: data.created_at })
  }
  if (name === 'remove_parked_thought') {
    if (!validId(args.id)) return toolError('A valid thought UUID is required.')
    const { data, error } = await supabase.from('documents').delete().eq('id', args.id).eq('user_id', userId).eq('status', 'parking').select('id').maybeSingle()
    if (error || !data) return toolError('Parked thought not found.')
    return toolResult({ removed: true, id: data.id })
  }
  return toolError('Unknown Notely tool.')
}

export async function POST(request: Request) {
  const auth = await authenticate(request)
  if ('error' in auth) return Response.json({ error: auth.error }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } })

  const raw = await request.text()
  if (raw.length > MAX_REQUEST_BYTES) return Response.json({ error: 'Request too large.' }, { status: 413, headers: { 'Access-Control-Allow-Origin': '*' } })
  let message: JsonRpcRequest
  try { message = JSON.parse(raw) as JsonRpcRequest } catch { return rpcError(null, -32700, 'Parse error.') }
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') return rpcError(message.id, -32600, 'Invalid Request.')
  const params = record(message.params)

  if (message.method === 'notifications/initialized' || message.method === 'notifications/cancelled') return new Response(null, { status: 202 })
  if (message.method === 'initialize') {
    return response(message.id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'notely-mcp', version: '0.1.0' }, instructions: 'Notely MCP provides authenticated access to the current user’s notes, Parking Lot, and Smart Recall. Every operation is scoped to the Supabase-authenticated user.' })
  }
  if (message.method === 'ping') return response(message.id, {})
  if (message.method === 'tools/list') return response(message.id, { tools })
  if (message.method === 'tools/call') {
    if (typeof params.name !== 'string') return rpcError(message.id, -32602, 'Tool name is required.')
    const tool = tools.find(item => item.name === params.name)
    if (!tool) return rpcError(message.id, -32602, 'Unknown tool.')
    const result = await callTool(params.name, record(params.arguments), auth.supabase, auth.user.id)
    return response(message.id, result)
  }
  return rpcError(message.id, -32601, 'Method not found.')
}

export async function GET() {
  return new Response('Notely MCP endpoint. Use Streamable HTTP POST with a Notely Supabase access token.', { status: 405, headers: { Allow: 'POST, OPTIONS' } })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, content-type, mcp-protocol-version', 'Access-Control-Expose-Headers': 'MCP-Protocol-Version', 'Access-Control-Max-Age': '86400' } })
}
