import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function OAuthConsentPage({ searchParams }: { searchParams: Promise<{ authorization_id?: string }> }) {
  const { authorization_id: authorizationId } = await searchParams
  if (!authorizationId || authorizationId.length > 256) {
    return <main style={{ maxWidth: 560, margin: '12vh auto', padding: 24 }}><h1>Invalid authorization request</h1><p>This connection request is missing a valid authorization identifier. Return to the app that initiated the connection and try again.</p></main>
  }

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims) {
    const returnTo = '/oauth/consent?authorization_id=' + encodeURIComponent(authorizationId)
    redirect('/login?redirect=' + encodeURIComponent(returnTo))
  }

  const { data: details, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
  if (error || !details) {
    return <main style={{ maxWidth: 560, margin: '12vh auto', padding: 24 }}><h1>Could not verify connection</h1><p>{error?.message ?? 'This authorization request is invalid or expired.'}</p></main>
  }

  if (!('authorization_id' in details)) redirect(details.redirect_url)

  const scopes = typeof details.scope === 'string' ? details.scope.split(' ').filter(Boolean) : []
  return (
    <main style={{ maxWidth: 560, margin: '10vh auto', padding: 28, border: '1px solid var(--border, #ddd)', borderRadius: 18, background: 'var(--surface, #fff)' }}>
      <p style={{ fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .65 }}>Notely account connection</p>
      <h1 style={{ marginBottom: 8 }}>Connect {details.client.name} to Notely?</h1>
      <p>This application is requesting access to your Notely account. Review the destination and permissions before approving.</p>
      <section style={{ padding: 16, margin: '20px 0', borderRadius: 12, background: 'var(--background, #f5f0e8)' }}>
        <p><strong>Application</strong><br />{details.client.name}</p>
        <p><strong>Redirect destination</strong><br /><span style={{ overflowWrap: 'anywhere' }}>{details.redirect_uri}</span></p>
        <p><strong>Requested permissions</strong></p>
        {scopes.length ? <ul>{scopes.map(scope => <li key={scope}>{scope}</li>)}</ul> : <p>No additional profile scopes requested.</p>}
        <p style={{ fontSize: 13, opacity: .7 }}>Your Notely notes remain protected by your account permissions and database access policies.</p>
      </section>
      <form action="/api/oauth/decision" method="POST" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <input type="hidden" name="authorization_id" value={authorizationId} />
        <button type="submit" name="decision" value="approve" style={{ padding: '11px 18px', borderRadius: 10, border: 0, cursor: 'pointer' }}>Approve connection</button>
        <button type="submit" name="decision" value="deny" style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid var(--border, #ddd)', background: 'transparent', cursor: 'pointer' }}>Deny</button>
      </form>
    </main>
  )
}
