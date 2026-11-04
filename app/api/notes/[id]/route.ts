import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { indexDocumentMemory } from '@/lib/memory-engine'
import { exceedsNoteFieldLimits, readJsonBody } from '@/lib/request-body'

interface NoteUpdateRequest {
  title?: unknown
  body?: unknown
  started_at?: unknown
  tags?: unknown
}

interface DocumentRow {
  id: string
  user_id: string
  title: string
  body: string
  started_at: string | null
  created_at: string
  updated_at: string
  tags?: string[]
}

interface VersionRow {
  version_number: number
  body: string
  created_at: string
}

function parseId(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function parseUpdate(value: unknown): {
  title?: string
  body?: string
  startedAt?: string | null
  tags?: string[]
} | null {
  if (typeof value !== 'object' || value === null) return null

  const input = value as NoteUpdateRequest
  const result: { title?: string; body?: string; startedAt?: string | null; tags?: string[] } = {}

  if (input.title !== undefined) {
    if (typeof input.title !== 'string') return null
    result.title = input.title
  }

  if (input.body !== undefined) {
    if (typeof input.body !== 'string') return null
    result.body = input.body
  }

  if (input.started_at !== undefined) {
    if (input.started_at !== null && typeof input.started_at !== 'string') return null
    result.startedAt = input.started_at as string | null
  }

  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags) || input.tags.some(tag => typeof tag !== 'string')) return null
    result.tags = input.tags.map(tag => tag.trim()).filter(Boolean).slice(0, 20)
  }

  return result
}

async function cleanupUnreferencedNoteImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  noteId: string,
  currentBody: string
) {
  const { data: versions, error: versionsError } = await supabase
    .from('document_versions')
    .select('body')
    .eq('document_id', noteId)
  if (versionsError) {
    console.error('Could not inspect note image history for cleanup:', versionsError)
    return
  }

  const referenced = new Set<string>()
  const collectReferences = (body: string) => {
    for (const match of body.matchAll(/!\\[image\\]\\(notely-image:([^)]+)\\)/g)) {
      referenced.add(match[1])
    }
  }
  collectReferences(currentBody)
  for (const version of versions ?? []) collectReferences(version.body)

  const folder = userId + '/' + noteId
  const stalePaths: string[] = []
  const retentionMs = 24 * 60 * 60 * 1000
  let offset = 0
  while (true) {
    const { data: objects, error } = await supabase.storage.from('note-images')
      .list(folder, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) {
      console.error('Could not list note images for cleanup:', error)
      return
    }
    for (const object of objects ?? []) {
      if (!object.id || !object.created_at || Date.now() - Date.parse(object.created_at) < retentionMs) continue
      const path = folder + '/' + object.name
      if (!referenced.has(path)) stalePaths.push(path)
    }
    if (!objects || objects.length < 1000) break
    offset += objects.length
  }

  for (let index = 0; index < stalePaths.length; index += 1000) {
    const { error } = await supabase.storage.from('note-images').remove(stalePaths.slice(index, index + 1000))
    if (error) {
      console.error('Could not remove orphaned note images:', error)
      return
    }
  }
}

function toHistory(versions: VersionRow[], fallback: string, fallbackTimestamp: string | null) {
  if (versions.length > 0) {
    return versions
      .slice()
      .sort((a, b) => a.version_number - b.version_number)
      .map(version => ({
        content: version.body,
        timestamp: Date.parse(version.created_at),
      }))
  }

  return [{ content: fallback, timestamp: Date.parse(fallbackTimestamp ?? new Date().toISOString()) }]
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: rawId } = await params
  const id = parseId(rawId)

  if (!id) {
    return NextResponse.json({ error: 'Invalid note id' }, { status: 400 })
  }

  const bodyResult = await readJsonBody(request)
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status })
  }

  const parsed = parseUpdate(bodyResult.value)
  if (!parsed || Object.keys(parsed).length === 0) {
    return NextResponse.json({ error: 'No valid changes supplied' }, { status: 400 })
  }
  if (exceedsNoteFieldLimits(parsed)) {
    return NextResponse.json({ error: 'Note title, body, or tags exceed the allowed size' }, { status: 413 })
  }

  const { data: before, error: beforeError } = await supabase
    .from('documents')
    .select('id,user_id,title,body,started_at,created_at,updated_at,tags')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (beforeError || !before) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (parsed.title !== undefined) updates.title = parsed.title
  if (parsed.body !== undefined) updates.body = parsed.body
  if (parsed.startedAt !== undefined) updates.started_at = parsed.startedAt
  if (parsed.tags !== undefined) updates.tags = parsed.tags

  const { data, error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id,user_id,title,body,started_at,created_at,updated_at,tags')
    .single()

  if (error || !data) {
    console.error('Failed to update note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }

  const document = data as DocumentRow
  if (parsed.title !== undefined || parsed.body !== undefined || parsed.tags !== undefined) {
    await indexDocumentMemory(supabase, document).catch(() => 'failed')
  }
  const bodyChanged = document.body !== (before as DocumentRow).body

  if (bodyChanged) {
    const { data: latestVersion, error: versionLookupError } = await supabase
      .from('document_versions')
      .select('version_number')
      .eq('document_id', document.id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!versionLookupError) {
      const nextVersion = ((latestVersion as { version_number: number } | null)?.version_number ?? 0) + 1
      const { error: versionError } = await supabase
        .from('document_versions')
        .insert({
          document_id: document.id,
          version_number: nextVersion,
          body: document.body,
        })

      if (versionError) {
        console.error('Failed to persist note version:', versionError)
      }
    } else {
      console.error('Failed to read note version sequence:', versionLookupError)
    }
  }

  await cleanupUnreferencedNoteImages(supabase, user.id, document.id, document.body)

  const { data: versions } = await supabase
    .from('document_versions')
    .select('version_number,body,created_at')
    .eq('document_id', document.id)
    .order('version_number', { ascending: true })

  return NextResponse.json({
    id: document.id,
    user_id: document.user_id,
    title: document.title,
    body: document.body,
    created_at: document.created_at,
    updated_at: document.updated_at,
    started_at: document.started_at,
    tags: document.tags ?? [],
    history: toHistory(
      (versions ?? []) as VersionRow[],
      document.body,
      document.started_at ?? document.created_at
    ),
    synced: true,
  })
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: rawId } = await params
  const id = parseId(rawId)

  if (!id) {
    return NextResponse.json({ error: 'Invalid note id' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('documents')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .select('id')
    .single()

  if (error || !data) {
    console.error('Failed to archive note:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
