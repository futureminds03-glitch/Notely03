export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const origin = new URL(request.url).origin
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return Response.json({ error: 'OAuth resource metadata is not configured.' }, { status: 503 })

  const authServer = new URL('/auth/v1', supabaseUrl).toString().replace(/\/$/, '')
  return Response.json({
    resource: origin + '/api/mcp',
    authorization_servers: [authServer],
    bearer_methods_supported: ['header'],
    scopes_supported: ['openid', 'email', 'profile'],
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
