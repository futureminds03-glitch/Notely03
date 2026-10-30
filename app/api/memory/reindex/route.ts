import { createClient } from '@/lib/supabase-server'
import { indexDocumentMemory } from '@/lib/memory-engine'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to prepare your memory archive.' }, { status: 401 })

  let offset = 0
  try {
    const raw = await request.text()
    if (raw.length > 1000) return NextResponse.json({ error: 'Invalid batch request.' }, { status: 413 })
    if (raw.trim()) {
      const payload = JSON.parse(raw) as { offset?: unknown }
      if (payload.offset !== undefined) {
        if (!Number.isInteger(payload.offset) || Number(payload.offset) < 0 || Number(payload.offset) > 10000) {
          return NextResponse.json({ error: 'Invalid batch offset.' }, { status: 400 })
        }
        offset = Number(payload.offset)
      }
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const batchSize = 25
  const { data: documents, error } = await supabase
    .from('documents').select('id,title,body,tags')
    .eq('user_id', user.id).eq('status', 'active')
    .order('updated_at', { ascending: false }).order('id', { ascending: false })
    .range(offset, offset + batchSize - 1)

  if (error) {
    console.error('Memory backfill query failed:', error.message)
    return NextResponse.json({ error: 'Could not load your memories for indexing.' }, { status: 500 })
  }

  let indexed = 0
  let unchanged = 0
  let failed = 0
  for (const document of documents ?? []) {
    const result = await indexDocumentMemory(supabase, document, { includeEmbedding: true })
    if (result === 'indexed') indexed++
    else if (result === 'unchanged') unchanged++
    else failed++
  }

  const count = documents?.length ?? 0
  return NextResponse.json({
    processed: count, indexed, unchanged, failed,
    nextOffset: count === batchSize ? offset + batchSize : null,
    semanticEnabled: Boolean(process.env.OPENAI_API_KEY),
    message: process.env.OPENAI_API_KEY
      ? 'Memory insights and available semantic vectors have been prepared.'
      : 'Memory insights are prepared. Semantic embeddings remain disabled until an embedding provider is configured.',
  })
}
