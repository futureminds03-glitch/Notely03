import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

type ParkingInput = { text?: unknown; client_id?: unknown }

function toItem(row: { id: string; body: string; created_at: string }) {
  return { id: row.id, text: row.body, createdAt: row.created_at, synced: true }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('documents')
    .select('id,body,created_at')
    .eq('user_id', user.id)
    .eq('status', 'parking')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Failed to load Parking Lot:', error)
    return NextResponse.json({ error: 'Could not load your Parking Lot.' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(toItem))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let payload: unknown
  try { payload = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const inputText = typeof payload === 'object' && payload !== null ? (payload as ParkingInput).text : null
  if (typeof inputText !== 'string' || !inputText.trim()) {
    return NextResponse.json({ error: 'Add a thought before parking it.' }, { status: 400 })
  }
  const text = inputText.trim()
  if (text.length > 12000) {
    return NextResponse.json({ error: 'This thought is too long to park at once.' }, { status: 413 })
  }

  const clientId = typeof (payload as ParkingInput).client_id === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test((payload as ParkingInput).client_id as string) ? (payload as ParkingInput).client_id as string : null
  const marker = clientId ? 'offline-client:' + clientId : null
  if (marker) { const existing = await supabase.from('documents').select('id,body,created_at').eq('user_id', user.id).eq('status', 'parking').contains('tags', [marker]).maybeSingle(); if (existing.data) return NextResponse.json(toItem(existing.data), { status: 200 }) }
  const title = text.split(/\r?\n/, 1)[0].replace(/\s+/g, ' ').slice(0, 72) || 'Parked thought'
  const { data, error } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      title,
      body: text,
      status: 'parking',
      tags: marker ? ['Parking Lot', marker] : ['Parking Lot'],
      provenance: 'user_created',
    })
    .select('id,body,created_at')
    .single()

  if (error || !data) {
    console.error('Failed to save Parking Lot thought:', error)
    return NextResponse.json({ error: 'Could not sync this thought. Please try again.' }, { status: 500 })
  }
  if (marker) await supabase.from('documents').update({ tags: ['Parking Lot'] }).eq('id', data.id).eq('user_id', user.id).eq('status', 'parking')
  return NextResponse.json(toItem(data), { status: 201 })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'A parked thought ID is required.' }, { status: 400 })
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid parked thought ID.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'parking')
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('Failed to remove Parking Lot thought:', error)
    return NextResponse.json({ error: 'Could not remove this parked thought.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Parked thought not found.' }, { status: 404 })
  return NextResponse.json({ deleted: true, id: data.id })
}
