import OAuthLogin from '@/components/OAuthLogin'

export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const { redirect: requestedRedirect } = await searchParams
  const redirectTo = typeof requestedRedirect === 'string' && requestedRedirect.startsWith('/oauth/consent?authorization_id=') && !requestedRedirect.startsWith('//')
    ? requestedRedirect
    : '/'
  return <OAuthLogin redirectTo={redirectTo} />
}
