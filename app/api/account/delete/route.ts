import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RECENT_AUTH_WINDOW_MS = 10 * 60 * 1000

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lastSignInAt = Date.parse(user.last_sign_in_at ?? '')
  if (!Number.isFinite(lastSignInAt) || Date.now() - lastSignInAt > RECENT_AUTH_WINDOW_MS || lastSignInAt > Date.now() + 60_000) {
    return NextResponse.json({ error: 'Please re-enter your password before deleting your account.' }, { status: 403 })
  }

  const { error } = await supabase.rpc('delete_my_account')
  if (error) {
    console.error('Account deletion failed:', error.message)
    return NextResponse.json({ error: 'Account deletion could not be completed. Your account has not been intentionally changed; please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
