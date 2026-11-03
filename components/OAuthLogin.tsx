'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function OAuthLogin({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError) {
      setError(signInError.message)
      setBusy(false)
      return
    }
    router.replace(redirectTo)
    router.refresh()
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--background, #f5f0e8)' }}>
      <section style={{ width: '100%', maxWidth: 420, padding: 28, borderRadius: 18, border: '1px solid var(--border, #ddd)', background: 'var(--surface, #fff)' }}>
        <p style={{ fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .65 }}>Notely</p>
        <h1>Sign in to continue</h1>
        <p>Sign in to your Notely account to review and approve this connection.</p>
        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
          <label style={{ display: 'grid', gap: 6 }}>Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </section>
    </main>
  )
}
