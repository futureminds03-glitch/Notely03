import { withSupabase } from 'npm:@supabase/server'

Deno.serve(
  withSupabase({ auth: 'user' }, async (request, context) => {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed.' }, { status: 405 })
    }

    const userId = context.userClaims?.sub
    if (typeof userId !== 'string' || !userId) {
      return Response.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const { error } = await context.supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) {
      console.error('Self-service account deletion failed:', error.message)
      return Response.json({ error: 'Account deletion could not be completed.' }, { status: 500 })
    }

    return Response.json({ success: true })
  }),
)
