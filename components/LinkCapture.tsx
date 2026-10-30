'use client'

import { useState } from 'react'

type LinkResult = {
  sourceUrl: string
  canonicalUrl: string
  title: string
  description: string
  domain: string
  author: string | null
  publishedAt: string | null
  modifiedAt: string | null
  publisher: string | null
  fullContent: string
  image: string
  analysis: { summary: string; keyPoints: string[]; concepts: string[]; potentialTasks: string[] } | null
  warning: string | null
  extractedAt: string
}

function noteText(result: LinkResult) {
  const parts = [
    result.title,
    'Source URL: ' + result.sourceUrl,
    result.canonicalUrl !== result.sourceUrl ? 'Resolved URL: ' + result.canonicalUrl : '',
    'Publisher: ' + (result.publisher || result.domain),
    result.author ? 'Author: ' + result.author : '',
    result.publishedAt ? 'Published: ' + result.publishedAt : '',
    result.modifiedAt ? 'Modified: ' + result.modifiedAt : '',
    '',
    'Summary',
    result.analysis?.summary || result.description || 'No summary available.',
    '',
    'Key points',
    ...(result.analysis?.keyPoints ?? []).map(point => '- ' + point),
    '',
    'Concepts',
    ...(result.analysis?.concepts ?? []).map(point => '- ' + point),
    '',
    'Potential tasks (suggestions, not commitments)',
    ...(result.analysis?.potentialTasks ?? []).map(point => '- ' + point),
    '',
    'Extracted source content',
    result.fullContent,
    '',
    'Captured with Notely on ' + result.extractedAt,
  ]
  return parts.join('\n').trim()
}

export default function LinkCapture() {
  const [url, setUrl] = useState('')
  const [result, setResult] = useState<LinkResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function extract(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!url.trim() || loading) return
    setLoading(true)
    setError('')
    setResult(null)
    setSaved(false)
    try {
      const response = await fetch('/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not read this link.')
      setResult(data as LinkResult)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read this link. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!result || saving || saved) return
    setSaving(true)
    setError('')
    const title = result.title || 'Saved link'
    const body = noteText(result)
    try {
      const remote = await fetch('/api/notes', { cache: 'no-store' })
      if (remote.ok) {
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, tags: ['Links'], started_at: result.extractedAt }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not save this link to your account. Your extracted content is still here.')
      } else if (remote.status === 401) {
        const key = 'notely_notes'
        let existing: unknown[] = []
        try {
          const parsed = JSON.parse(localStorage.getItem(key) || '[]')
          if (Array.isArray(parsed)) existing = parsed
        } catch { /* recover with a fresh guest collection */ }
        const now = new Date().toISOString()
        const note = {
          id: 'local-link-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
          title, body, created_at: now, updated_at: now, started_at: result.extractedAt,
          tags: ['Links'], synced: false,
        }
        localStorage.setItem(key, JSON.stringify([note, ...existing]))
      } else {
        throw new Error('Could not check your Notely account. Your extracted content is still here.')
      }
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this link. Your extracted content is still here.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="link-capture-page">
      <div className="link-capture-shell">
        <a className="link-capture-back" href="/flow">← Back to Notely Flow</a>
        <div className="link-capture-eyebrow">NOTELY · FRICTIONLESS CAPTURE</div>
        <h1>Save the useful parts.</h1>
        <p className="link-capture-intro">Paste a link. Notely will read the page, pull out what matters, and keep the original source attached.</p>
        <form className="link-capture-form" onSubmit={extract}>
          <label htmlFor="link-capture-url">Webpage URL</label>
          <div className="link-capture-input-row">
            <input id="link-capture-url" type="url" inputMode="url" autoComplete="url" placeholder="https://example.com/article" value={url} onChange={event => setUrl(event.target.value)} required />
            <button type="submit" disabled={!url.trim() || loading}>{loading ? 'Reading…' : 'Read page →'}</button>
          </div>
          <small>Public webpages only. Private pages and sign-in protected content are not accessed.</small>
        </form>
        {loading && <div className="link-capture-loading" role="status" aria-live="polite"><span className="link-capture-spinner" /> Reading the page and finding the useful parts…</div>}
        {error && <p className="link-capture-error" role="alert">{error}</p>}
        {result && <section className="link-capture-result" aria-label="Extracted webpage">
          <div className="link-capture-source"><span>{result.domain}</span><a href={result.sourceUrl} target="_blank" rel="noreferrer">Open original ↗</a></div>
          <h2>{result.title}</h2>
          {result.description && <p className="link-capture-description">{result.description}</p>}
          <dl className="link-capture-meta">
            {result.author && <div><dt>Author</dt><dd>{result.author}</dd></div>}
            {result.publisher && <div><dt>Publisher</dt><dd>{result.publisher}</dd></div>}
            {result.publishedAt && <div><dt>Published</dt><dd>{result.publishedAt}</dd></div>}
          </dl>
          {result.warning && <p className="link-capture-warning" role="status">{result.warning}</p>}
          {result.analysis && <>
            <div className="link-capture-section"><span>THE SHORT VERSION</span><p>{result.analysis.summary}</p></div>
            {result.analysis.keyPoints.length > 0 && <div className="link-capture-section"><span>IMPORTANT POINTS</span><ul>{result.analysis.keyPoints.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
            {result.analysis.concepts.length > 0 && <div className="link-capture-section"><span>CONCEPTS TO REMEMBER</span><div className="link-capture-chips">{result.analysis.concepts.map(item => <span key={item}>{item}</span>)}</div></div>}
            {result.analysis.potentialTasks.length > 0 && <div className="link-capture-section"><span>POSSIBLE NEXT STEPS</span><ul>{result.analysis.potentialTasks.map((item, index) => <li key={index}>{item}</li>)}</ul><small>Suggestions only — nothing is added to your task list automatically.</small></div>}
          </>}
          <details className="link-capture-content"><summary>View extracted source text</summary><p>{result.fullContent || 'No readable page text was found.'}</p></details>
          <div className="link-capture-save"><span>{saved ? 'Saved to your Notely notes.' : 'The original URL and extracted source will be saved together.'}</span><button type="button" onClick={save} disabled={saving || saved}>{saved ? '✓ Saved' : saving ? 'Saving…' : 'Save to Notely →'}</button></div>
        </section>}
      </div>
      <style jsx>{`
        .link-capture-page{min-height:100vh;background:var(--bg,#f7f7f4);color:var(--text,#20211f);padding:clamp(24px,5vw,64px) 18px}
        .link-capture-shell{max-width:760px;margin:0 auto}
        .link-capture-back{display:inline-block;color:var(--muted,#777);text-decoration:none;font-size:13px;margin-bottom:38px}
        .link-capture-eyebrow,.link-capture-section>span{font-size:10px;letter-spacing:.15em;font-weight:700;color:var(--accent,#71856f)}
        h1{font-size:clamp(34px,6vw,54px);letter-spacing:-.045em;margin:12px 0}
        .link-capture-intro{color:var(--muted,#777);line-height:1.7;max-width:560px;margin:0 0 32px}
        .link-capture-form,.link-capture-result{background:var(--panel,#fff);border:1px solid var(--line,#e8e8e2);border-radius:18px;padding:22px}
        .link-capture-form label{display:block;font-size:12px;font-weight:650;margin-bottom:10px}
        .link-capture-input-row{display:flex;gap:9px}
        .link-capture-input-row input{min-width:0;flex:1;border:1px solid var(--line,#ddd);border-radius:10px;padding:13px 14px;background:var(--bg,#fff);color:inherit;font:inherit}
        button{border:0;border-radius:10px;padding:0 18px;background:var(--accent,#647b63);color:white;font:inherit;font-size:13px;font-weight:650;cursor:pointer}
        button:disabled{opacity:.55;cursor:not-allowed}
        .link-capture-form small,.link-capture-section small{display:block;color:var(--muted,#888);font-size:11px;margin-top:10px}
        .link-capture-loading{display:flex;align-items:center;gap:12px;padding:22px;color:var(--muted,#777);font-size:13px}
        .link-capture-spinner{width:18px;height:18px;border:2px solid var(--line,#ddd);border-top-color:var(--accent,#71856f);border-radius:50%;animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .link-capture-error,.link-capture-warning{padding:12px 14px;border-radius:10px;background:#fff4e8;color:#805324;font-size:13px;line-height:1.5}
        .link-capture-result{margin-top:22px}
        .link-capture-source{display:flex;justify-content:space-between;gap:12px;color:var(--muted,#888);font-size:11px}
        .link-capture-source a{color:var(--accent,#647b63);text-decoration:none}
        h2{font-size:25px;line-height:1.25;letter-spacing:-.025em;margin:18px 0 8px}
        .link-capture-description{color:var(--muted,#777);font-size:14px;line-height:1.65}
        .link-capture-meta{display:flex;flex-wrap:wrap;gap:14px 24px;padding:15px 0;border-top:1px solid var(--line,#eee);border-bottom:1px solid var(--line,#eee)}
        .link-capture-meta div{min-width:100px}.link-capture-meta dt{font-size:10px;color:var(--muted,#888);text-transform:uppercase;letter-spacing:.08em}.link-capture-meta dd{margin:4px 0 0;font-size:12px}
        .link-capture-section{padding:19px 0;border-bottom:1px solid var(--line,#eee)}
        .link-capture-section p,.link-capture-section li{font-size:14px;line-height:1.7;color:var(--text,#333)}
        .link-capture-section ul{padding-left:20px;margin-bottom:0}
        .link-capture-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.link-capture-chips span{font-size:11px;padding:6px 10px;border-radius:30px;background:var(--bg,#f3f3ef);color:var(--muted,#666)}
        .link-capture-content{padding:16px 0;color:var(--muted,#777);font-size:12px}.link-capture-content summary{cursor:pointer;color:var(--accent,#647b63)}.link-capture-content p{white-space:pre-wrap;line-height:1.7;max-height:340px;overflow:auto}
        .link-capture-save{display:flex;justify-content:space-between;align-items:center;gap:14px;padding-top:18px;font-size:12px;color:var(--muted,#777)}.link-capture-save button{min-height:42px}
        @media(max-width:560px){.link-capture-form,.link-capture-result{padding:17px}.link-capture-input-row{flex-direction:column}.link-capture-input-row button{min-height:44px}.link-capture-save{align-items:stretch;flex-direction:column}.link-capture-save button{min-height:46px}}
      `}</style>
    </main>
  )
}
