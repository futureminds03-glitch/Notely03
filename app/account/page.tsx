'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

export default function AccountPage() {
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      setEmail(data.user?.email ?? '')
      setLoading(false)
    }).catch(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [supabase])

  async function exportData() {
    setExporting(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/account/export', { cache: 'no-store' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Could not export your data.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'notely-data-export.json'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setMessage('Your data export has been prepared.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not export your data.')
    } finally {
      setExporting(false)
    }
  }

  async function deleteAccount() {
    if (!email || !password || confirmation !== 'DELETE' || deleting) return
    setDeleting(true)
    setError('')
    setMessage('')
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw new Error('Password verification failed. Your account has not been deleted.')
      const response = await fetch('/api/account/delete', { method: 'POST', cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Account deletion failed.')
      await supabase.auth.signOut({ scope: 'local' })
      window.location.assign('/')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account deletion failed.')
      setDeleting(false)
    }
  }

  if (loading) return <main className="account-page"><p role="status">Loading account…</p></main>
  if (!email) return <main className="account-page"><a href="/">← Back to Notely</a><h1>Sign in to manage your account</h1><p>Account export and deletion are available for signed-in accounts.</p><a className="account-action" href="/">Sign in</a></main>

  return (
    <main className="account-page">
      <a href="/" className="account-back">← Back to Notely</a>
      <div className="account-eyebrow">NOTELY · ACCOUNT & PRIVACY</div>
      <h1>Your account, your data.</h1>
      <p className="account-intro">Signed in as <strong>{email}</strong>. You can take a copy of your data or permanently delete your account.</p>

      <section className="account-card">
        <div className="account-card-copy"><h2>Export your data</h2><p>Download your notes, archived notes, note history, saved sources and memory insights as a JSON file.</p></div>
        <button className="account-action" onClick={exportData} disabled={exporting}>{exporting ? 'Preparing export…' : 'Download my data'}</button>
      </section>

      <section className="account-card account-danger">
        <div className="account-card-copy"><h2>Delete your account</h2><p>This permanently deletes your Notely account and the notes, versions, saved sources and derived memory records attached to it. This cannot be undone. Export your data first if you want to keep a copy.</p></div>
        <label htmlFor="account-password">Confirm your password</label>
        <input id="account-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Your current password" />
        <label htmlFor="account-confirm">Type DELETE to confirm</label>
        <input id="account-confirm" value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="DELETE" autoComplete="off" />
        <button className="account-delete" onClick={deleteAccount} disabled={deleting || !password || confirmation !== 'DELETE'}>{deleting ? 'Deleting account…' : 'Permanently delete account'}</button>
      </section>

      {message && <p className="account-message" role="status">{message}</p>}
      {error && <p className="account-error" role="alert">{error}</p>}
      <p className="account-footnote">Notely is currently free to use. There are no subscriptions or payment details to manage.</p>

      <style jsx>{`
        .account-page{max-width:760px;margin:0 auto;padding:clamp(24px,6vw,64px) 20px;color:var(--ink,#292821);min-height:100vh;background:var(--paper,#f8f6f0)}
        .account-back{display:inline-block;color:var(--muted,#777);text-decoration:none;font-size:13px;margin-bottom:34px}
        .account-eyebrow{font-size:10px;letter-spacing:.15em;font-weight:700;color:var(--accent,#6b8068)}
        h1{font:500 clamp(34px,6vw,52px)/1.08 Georgia,serif;letter-spacing:-.04em;margin:12px 0}
        .account-intro{color:var(--muted,#777);line-height:1.7;margin:0 0 26px}
        .account-card{border:1px solid var(--line,#e5e0d6);border-radius:16px;background:var(--panel,#fffdf8);padding:22px;margin:14px 0;display:grid;gap:12px}
        .account-card-copy h2{font:500 21px Georgia,serif;margin:0 0 7px}
        .account-card-copy p{font-size:13px;line-height:1.65;color:var(--muted,#777);margin:0}
        .account-card label{font-size:12px;font-weight:650;margin-top:5px}
        .account-card input{width:100%;box-sizing:border-box;padding:12px;border:1px solid var(--line,#ddd);border-radius:9px;background:var(--paper,#f8f6f0);color:inherit;font:inherit}
        .account-action,.account-delete{justify-self:start;border:0;border-radius:9px;padding:12px 16px;background:var(--accent,#687d65);color:white;font:600 13px/1.2 system-ui,sans-serif;cursor:pointer}
        .account-action:disabled,.account-delete:disabled{opacity:.55;cursor:not-allowed}
        .account-danger{border-color:#e6c9c4}
        .account-delete{background:#a4443b;margin-top:5px}
        .account-message,.account-error{font-size:13px;padding:12px;border-radius:9px}
        .account-message{background:#eaf1e7;color:#35533a}
        .account-error{background:#fae9e6;color:#8d3029}
        .account-footnote{font-size:12px;color:var(--muted,#777);margin-top:24px}
      `}</style>
    </main>
  )
}
