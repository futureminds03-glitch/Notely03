import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

type ParkingInput = { text?: unknown }

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

  let payload: ParkingInput
  try { payload = await request.json() as ParkingInput } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  if (typeof payload.text !== 'string' || !payload.text.trim()) {
    return NextResponse.json({ error: 'Add a thought before parking it.' }, { status: 400 })
  }
  const text = payload.text.trim()
  if (text.length > 12000) {
    return NextResponse.json({ error: 'This thought is too long to park at once.' }, { status: 413 })
  }

  const title = text.split(/\r?\n/, 1)[0].replace(/\s+/g, ' ').slice(0, 72) || 'Parked thought'
  const { data, error } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      title,
      body: text,
      status: 'parking',
      tags: ['Parking Lot'],
      provenance: 'user_created',
    })
    .select('id,body,created_at')
    .single()

  if (error || !data) {
    console.error('Failed to save Parking Lot thought:', error)
    return NextResponse.json({ error: 'Could not save this thought. It is still on this device.' }, { status: 500 })
  }
  return NextResponse.json(toItem(data), { status: 201 })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'A parked thought ID is required.' }, { status: 400 })

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
