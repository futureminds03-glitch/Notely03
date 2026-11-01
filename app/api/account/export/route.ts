import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function readAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = []
  const pageSize = 500
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const documents = await readAll((from, to) => supabase
      .from('documents').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: true }).range(from, to))
    const sources = await readAll((from, to) => supabase
      .from('sources').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: true }).range(from, to))
    const legalAcceptances = await readAll((from, to) => supabase
      .from('legal_acceptances').select('*').eq('user_id', user.id)
      .order('accepted_at', { ascending: true }).range(from, to))

    const documentIds = documents.map((document: { id: string }) => document.id)
    const versions: unknown[] = []
    const insights: unknown[] = []
    const documentSources: unknown[] = []
    for (let index = 0; index < documentIds.length; index += 100) {
      const ids = documentIds.slice(index, index + 100)
      const [versionResult, insightResult, sourceResult] = await Promise.all([
        supabase.from('document_versions').select('*').in('document_id', ids).order('created_at', { ascending: true }),
        supabase.from('document_insights').select('*').in('document_id', ids),
        supabase.from('document_sources').select('*').in('document_id', ids),
      ])
      for (const result of [versionResult, insightResult, sourceResult]) {
        if (result.error) throw new Error(result.error.message)
      }
      versions.push(...(versionResult.data ?? []))
      insights.push(...(insightResult.data ?? []))
      documentSources.push(...(sourceResult.data ?? []))
    }

    const exportedAt = new Date().toISOString()
    const payload = {
      product: 'Notely',
      formatVersion: 1,
      exportedAt,
      account: { id: user.id, email: user.email ?? null, createdAt: user.created_at ?? null },
      data: { documents, documentVersions: versions, sources, documentSources, documentInsights: insights, legalAcceptances },
      exclusions: ['Authentication credentials and active session tokens are never exported.', 'Derived vector embeddings are omitted because they can be regenerated from your notes.'],
    }
    const date = exportedAt.slice(0, 10)
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="notely-data-export-${date}.json"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Account data export failed:', error)
    return NextResponse.json({ error: 'Could not prepare your data export. Please try again.' }, { status: 500 })
  }
}
