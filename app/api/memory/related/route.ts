import { createClient } from '@/lib/supabase-server'
import { createMemoryEmbedding } from '@/lib/memory-engine'
import { NextResponse } from 'next/server'

type RecallRow = {
  id: string; title: string; body: string; created_at: string; updated_at: string
  tags: string[]; score: number; key_topics?: string[]; entities?: string[]
  action_items?: string[]; match_reasons?: string[]
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to find related memories.' }, { status: 401 })

  let payload: unknown
  try {
    const raw = await request.text()
    if (raw.length > 2000) return NextResponse.json({ error: 'Invalid note reference.' }, { status: 413 })
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  const noteId = typeof payload === 'object' && payload !== null ? (payload as { noteId?: unknown }).noteId : null
  if (typeof noteId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(noteId)) {
    return NextResponse.json({ error: 'Choose a valid source note.' }, { status: 400 })
  }

  const { data: note, error: noteError } = await supabase
    .from('documents').select('id,title,body,tags')
    .eq('id', noteId).eq('user_id', user.id).eq('status', 'active').maybeSingle()
  if (noteError || !note) return NextResponse.json({ error: 'Source note not found.' }, { status: 404 })

  const seed = [note.title, ...(note.tags ?? []), note.body.slice(0, 1200)].filter(Boolean).join(' ')
  const queryEmbedding = await createMemoryEmbedding(seed)
  const { data, error } = await supabase.rpc('search_my_memories_hybrid', {
    p_search_text: seed.slice(0, 1800),
    p_query_embedding: queryEmbedding ? '[' + queryEmbedding.join(',') + ']' : null,
    p_result_limit: 6,
    p_exclude_id: note.id,
  })
  if (error) {
    console.error('Related memory retrieval failed:', error.message)
    return NextResponse.json({ error: 'Related memory search is temporarily unavailable.' }, { status: 500 })
  }
  const sources = ((data ?? []) as RecallRow[]).map(row => ({
    id: row.id,
    title: row.title || 'Untitled memory',
    excerpt: row.body.slice(0, 420),
    created_at: row.created_at,
    tags: row.tags ?? [],
    score: Number(row.score) || 0,
    key_topics: row.key_topics ?? [],
    match_reasons: row.match_reasons ?? [],
  }))
  return NextResponse.json({
    source: { id: note.id, title: note.title },
    count: sources.length,
    sources,
    mode: queryEmbedding ? 'hybrid-search' : 'ranked-search',
  })
}
