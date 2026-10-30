import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export type MemoryDocument = { id: string; title: string; body: string; tags?: string[] | null }
export type MemoryInsights = { summary: string; key_topics: string[]; entities: string[]; action_items: string[] }

const STOP_WORDS = new Set(('about after again also among another because before being between both could does doing down during each either else even every few from further here how into itself just more most much must neither only other our out over same should some such than that their them then there these they this those through too under until very was were what when where which while who whom why will with would your have has had its the and for are but not you all any can her his him she use using used make made get got one two three per via etc').split(/\s+/))

function clean(value: string): string {
  return value.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim()
}

export function extractMemoryInsights(document: MemoryDocument): MemoryInsights {
  const title = clean(document.title || '')
  const body = clean(document.body || '')
  const source = (title + ' ' + body).slice(0, 30_000)
  const counts = new Map<string, number>()
  for (const match of source.toLocaleLowerCase().matchAll(/[\p{L}\p{N}][\p{L}\p{N}_'-]{2,}/gu)) {
    const word = match[0].replace(/^['-]+|['-]+$/g, '')
    if (word.length < 4 || STOP_WORDS.has(word) || /^\d+$/.test(word)) continue
    counts.set(word, (counts.get(word) ?? 0) + 1)
  }
  const topics = [...(document.tags ?? []).map(clean).filter(Boolean)]
  for (const [word] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    if (!topics.some(topic => topic.toLocaleLowerCase() === word)) topics.push(word)
    if (topics.length >= 10) break
  }
  const entityMatches = source.match(/\b(?:[A-Z][\p{L}\p{M}'-]{1,})(?:\s+(?:[A-Z][\p{L}\p{M}'-]{1,}|AI|API|CEO|UK|US)){0,3}\b/gu) ?? []
  const entities = [...new Set(entityMatches.map(clean).filter(value =>
    value.length >= 2 && value.length <= 80 && !/^(The|This|That|When|Where|What|Note|Today|Tomorrow|Yesterday)$/.test(value)
  ))].slice(0, 20)
  const actionMatches = body.match(/(?:^|\n)\s*(?:[-*•]\s*)?(?:\[ \]\s*)?(?:todo|to-do|next step|action item|remember to|need to|should|must|follow up|follow-up|task)\b[^\n.!?]{0,180}/gim) ?? []
  const checklistMatches = body.match(/(?:^|\n)\s*[-*•]\s*\[ \]\s*[^\n]{3,180}/g) ?? []
  const actionItems = [...new Set([...actionMatches, ...checklistMatches].map(value => clean(value.replace(/^[-*•\s]+/, ''))))].slice(0, 12)
  const firstSentence = body.split(/(?<=[.!?])\s+/)[0] || body
  return { summary: (firstSentence || title).slice(0, 280), key_topics: topics.slice(0, 10), entities, action_items: actionItems }
}

export function memorySourceHash(document: MemoryDocument): string {
  return createHash('sha256').update(JSON.stringify({
    title: document.title || '', body: document.body || '', tags: [...(document.tags ?? [])].sort(),
  })).digest('hex')
}

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

/** Optional embeddings. No external request is made without an explicit server-side key. */
export async function createMemoryEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({ model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS, input: clean(text).slice(0, 12_000), encoding_format: 'float' }),
    })
    if (!response.ok) {
      console.error('Memory embedding provider status:', response.status)
      return null
    }
    const payload = await response.json() as { data?: Array<{ embedding?: unknown }> }
    const vector = payload.data?.[0]?.embedding
    if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS ||
        !vector.every(value => typeof value === 'number' && Number.isFinite(value))) return null
    return vector as number[]
  } catch {
    return null
  }
}

export async function indexDocumentMemory(
  supabase: SupabaseClient,
  document: MemoryDocument,
  options: { includeEmbedding?: boolean } = {},
): Promise<'indexed' | 'unchanged' | 'failed'> {
  const sourceHash = memorySourceHash(document)
  const { data: existing, error: lookupError } = await supabase
    .from('document_insights').select('source_hash').eq('document_id', document.id).maybeSingle()
  if (lookupError) {
    console.error('Memory index lookup failed:', lookupError.message)
    return 'failed'
  }

  const embeddingEnabled = options.includeEmbedding === true && Boolean(process.env.OPENAI_API_KEY)
  let hasCurrentEmbedding = false
  if (embeddingEnabled && existing?.source_hash === sourceHash) {
    const { data: stored, error } = await supabase
      .from('document_embeddings').select('id').eq('document_id', document.id).limit(1).maybeSingle()
    if (error) {
      console.error('Memory embedding lookup failed:', error.message)
      return 'failed'
    }
    hasCurrentEmbedding = Boolean(stored)
  }
  if (existing?.source_hash === sourceHash && (!embeddingEnabled || hasCurrentEmbedding)) return 'unchanged'

  const insights = extractMemoryInsights(document)
  const embedding = embeddingEnabled
    ? await createMemoryEmbedding([document.title, ...(document.tags ?? []), document.body].join('\n'))
    : null

  const { error } = await supabase.rpc('upsert_document_memory', {
    p_document_id: document.id,
    p_source_hash: sourceHash,
    p_summary: insights.summary || null,
    p_key_topics: insights.key_topics,
    p_entities: insights.entities,
    p_action_items: insights.action_items,
    p_embedding: embedding ? '[' + embedding.join(',') + ']' : null,
    p_embedding_model: embedding ? EMBEDDING_MODEL : null,
    p_clear_embedding: existing?.source_hash !== sourceHash && !embedding,
  })
  if (error) {
    console.error('Memory indexing failed:', error.message)
    return 'failed'
  }
  return 'indexed'
}
