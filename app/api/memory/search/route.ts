import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

type RecallRow = { id: string; title: string; body: string; created_at: string; updated_at: string; tags: string[]; score: number }

function sources(rows: RecallRow[]) {
  return rows.map(row => ({
    id: row.id,
    title: row.title || 'Untitled memory',
    excerpt: row.body.slice(0, 420),
    created_at: row.created_at,
    updated_at: row.updated_at,
    tags: row.tags ?? [],
    score: Number(row.score) || 0,
  }))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to search your synced memories.' }, { status: 401 })

  let payload: unknown
  try {
    const raw = await request.text()
    if (raw.length > 4000) return NextResponse.json({ error: 'Search query is too long.' }, { status: 413 })
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Enter a valid search query.' }, { status: 400 })
  }

  const query = typeof payload === 'object' && payload !== null ? (payload as { query?: unknown }).query : null
  if (typeof query !== 'string' || query.trim().length < 2 || query.trim().length > 500) {
    return NextResponse.json({ error: 'Enter at least 2 characters (up to 500).' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('search_my_memories', {
    search_text: query.trim(),
    result_limit: 10,
    exclude_id: null,
  })
  if (error) {
    console.error('Smart Recall search failed:', error)
    return NextResponse.json({ error: 'Memory search is temporarily unavailable.' }, { status: 500 })
  }

  const rows = (data ?? []) as RecallRow[]
  return NextResponse.json({ query: query.trim(), count: rows.length, sources: sources(rows), mode: 'ranked-search' })
}
