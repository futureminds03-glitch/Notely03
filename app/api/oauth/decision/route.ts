import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  let form: FormData
  try { form = await request.formData() } catch {
    return NextResponse.json({ error: 'Invalid authorization decision.' }, { status: 400 })
  }

  const decision = form.get('decision')
  const authorizationId = form.get('authorization_id')
  if ((decision !== 'approve' && decision !== 'deny') || typeof authorizationId !== 'string' || !authorizationId || authorizationId.length > 256) {
    return NextResponse.json({ error: 'Invalid authorization decision.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Sign in to authorize this connection.' }, { status: 401 })

  const result = decision === 'approve'
    ? await supabase.auth.oauth.approveAuthorization(authorizationId)
    : await supabase.auth.oauth.denyAuthorization(authorizationId)

  if (result.error || !result.data?.redirect_url) {
    return NextResponse.json({ error: result.error?.message ?? 'Could not complete the authorization decision.' }, { status: 400 })
  }

  return NextResponse.redirect(result.data.redirect_url, { status: 303 })
}
