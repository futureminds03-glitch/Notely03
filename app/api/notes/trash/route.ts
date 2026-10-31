import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data: { id: string; title: string; body: string; archived_at: string | null; updated_at: string }[] = []
  for (let offset = 0; ; offset += 500) {
    const { data: page, error } = await supabase
      .from('documents')
      .select('id,title,body,archived_at,updated_at')
      .eq('user_id', user.id)
      .eq('status', 'archived')
      .order('archived_at', { ascending: false })
      .range(offset, offset + 499)
    if (error) {
      console.error('Failed to load archived notes:', error.message)
      return NextResponse.json({ error: 'Could not load archived notes.' }, { status: 500 })
    }
    data.push(...(page ?? []))
    if ((page ?? []).length < 500) break
  }
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let payload: unknown
  try { payload = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  const id = typeof payload === 'object' && payload !== null ? (payload as { id?: unknown }).id : null
  if (typeof id !== 'string' || !UUID.test(id)) return NextResponse.json({ error: 'Invalid note ID.' }, { status: 400 })

  const { data, error } = await supabase
    .from('documents')
    .update({ status: 'active', archived_at: null })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'archived')
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('Failed to restore archived note:', error.message)
    return NextResponse.json({ error: 'Could not restore this note.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Archived note not found.' }, { status: 404 })
  return NextResponse.json({ restored: true, id: data.id })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id || !UUID.test(id)) return NextResponse.json({ error: 'Invalid note ID.' }, { status: 400 })

  const { data, error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'archived')
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('Failed to permanently delete archived note:', error.message)
    return NextResponse.json({ error: 'Could not permanently delete this note.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Archived note not found.' }, { status: 404 })
  return NextResponse.json({ deleted: true, id: data.id })
}
