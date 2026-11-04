import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { matchesImageSignature } from '@/lib/image-signature'

const BUCKET = 'note-images'
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_MULTIPART_BYTES = MAX_IMAGE_BYTES + 64 * 1024
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

function parseStoragePath(value: string | null) {
  if (!value || value.length > 1024 || value.includes('..') || value.startsWith('/')) return null
  const parts = value.split('/')
  if (parts.length !== 3 || parts.some(part => !part || part.includes('\\'))) return null
  return parts
}

async function readBoundedForm(request: Request): Promise<FormData | null> {
  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) return null
  if (!request.body) return null

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_MULTIPART_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
    const buffer = new ArrayBuffer(total)
    const combined = new Uint8Array(buffer)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.byteLength
    }
    const body = new Blob([buffer])
    return await new Response(body, {
      headers: { 'content-type': request.headers.get('content-type') ?? '' },
    }).formData()
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await readBoundedForm(request)
  if (!form) return NextResponse.json({ error: 'Image upload exceeds the 8 MB limit or is invalid' }, { status: 413 })

  const noteId = form.get('noteId')
  const file = form.get('file')
  if (typeof noteId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(noteId) || !(file instanceof File)) {
    return NextResponse.json({ error: 'A valid note and image are required' }, { status: 400 })
  }

  const extension = MIME_EXTENSIONS[file.type]
  if (!extension || file.size < 1 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Use a PNG, JPEG, WebP, GIF or AVIF image up to 8 MB' }, { status: 413 })
  }
  const signature = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (!matchesImageSignature(file.type, signature)) {
    return NextResponse.json({ error: 'Image content does not match its declared file type' }, { status: 415 })
  }

  const { data: note, error: noteError } = await supabase
    .from('documents').select('id').eq('id', noteId).eq('user_id', user.id).eq('status', 'active').maybeSingle()
  if (noteError || !note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  const path = user.id + '/' + noteId + '/' + crypto.randomUUID() + '.' + extension
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (error) {
    console.error('Note image upload failed:', error)
    return NextResponse.json({ error: 'Image upload failed' }, { status: 500 })
  }
  return NextResponse.json({ path }, { status: 201 })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const parts = parseStoragePath(new URL(request.url).searchParams.get('path'))
  if (!parts || parts[0] !== user.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parts[1])) {
    return new NextResponse('Not found', { status: 404 })
  }
  const { data: note } = await supabase.from('documents').select('id')
    .eq('id', parts[1]).eq('user_id', user.id).maybeSingle()
  if (!note) return new NextResponse('Not found', { status: 404 })

  const { data, error } = await supabase.storage.from(BUCKET).download(parts.join('/'))
  if (error || !data) return new NextResponse('Not found', { status: 404 })
  return new NextResponse(data, {
    headers: {
      'Content-Type': data.type || 'application/octet-stream',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
