import { withSupabase } from 'npm:@supabase/server'

const RECENT_AUTH_WINDOW_SECONDS = 10 * 60

Deno.serve(
  withSupabase({ auth: 'user' }, async (request, context) => {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed.' }, { status: 405 })
    }

    const userId = context.userClaims?.sub
    if (typeof userId !== 'string' || !userId) {
      return Response.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const authTime = context.jwtClaims?.auth_time
    const now = Math.floor(Date.now() / 1000)
    if (typeof authTime !== 'number' || now - authTime > RECENT_AUTH_WINDOW_SECONDS || authTime > now + 60) {
      return Response.json({ error: 'Please re-authenticate before deleting your account.' }, { status: 403 })
    }

    const { error } = await context.supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) {
      console.error('Self-service account deletion failed:', error.message)
      return Response.json({ error: 'Account deletion could not be completed.' }, { status: 500 })
    }

    return Response.json({ success: true })
  }),
)
