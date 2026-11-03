import { admin, getOAuthClient, hashToken, json } from '@/lib/mcp/oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  let form: FormData
  try { form = await request.formData() } catch { return json({ error: 'invalid_request' }, { status: 400 }) }
  const token = form.get('token')
  const clientId = form.get('client_id')
  if (typeof token !== 'string' || !token || token.length > 4096 || typeof clientId !== 'string' || !clientId) {
    return json({ error: 'invalid_request' }, { status: 400 })
  }

  const client = await getOAuthClient(clientId).catch(() => null)
  if (!client || client.token_endpoint_auth_method !== 'none') return json({ error: 'invalid_client' }, { status: 401 })

  try {
    const supabase = admin()
    const tokenHash = hashToken(token)
    {
      const { data: refresh } = await supabase.from('mcp_oauth_refresh_tokens')
        .select('user_id,client_id').eq('token_hash', tokenHash).eq('client_id', clientId).maybeSingle()
      if (refresh) {
        const revokedAt = new Date().toISOString()
        const { error: refreshError } = await supabase.from('mcp_oauth_refresh_tokens').update({ revoked_at: revokedAt })
          .eq('token_hash', tokenHash).eq('client_id', clientId).is('revoked_at', null)
        const { error: grantError } = await supabase.from('mcp_oauth_grants').update({ revoked_at: revokedAt, updated_at: revokedAt })
          .eq('user_id', refresh.user_id).eq('client_id', clientId)
        const { error: accessError } = await supabase.from('mcp_oauth_tokens').update({ revoked_at: revokedAt })
          .eq('user_id', refresh.user_id).eq('client_id', clientId).is('revoked_at', null)
        if (refreshError || grantError || accessError) throw new Error('TOKEN_REVOCATION_FAILED')
        return new Response(null, { status: 200, headers: { 'Cache-Control': 'no-store' } })
      }
    }

    const { error: accessError } = await supabase.from('mcp_oauth_tokens').update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', tokenHash).eq('client_id', clientId).is('revoked_at', null)
    if (accessError) throw new Error('TOKEN_REVOCATION_FAILED')
  } catch {
    return json({ error: 'server_error' }, { status: 500 })
  }

  return new Response(null, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
