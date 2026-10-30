'use client'

import { useEffect, useState } from 'react'

const PARKING_KEY = 'notely_parking_lot_v1'

type ParkingItem = { id: string; text: string; createdAt: string }

function readLocalParking(): ParkingItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(PARKING_KEY) || '[]')
    return Array.isArray(value) ? value.filter((item) => item && typeof item.text === 'string') : []
  } catch {
    return []
  }
}

export default function GlobalParkingCapture() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === 'Space') {
        event.preventDefault()
        setOpen(true)
        setError('')
      } else if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const thought = text.trim()
    if (!thought || saving) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/parking-lot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: thought }),
      })

      if (response.status === 401) {
        const next = [{
          id: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
          text: thought,
          createdAt: new Date().toISOString(),
        }, ...readLocalParking()]
        localStorage.setItem(PARKING_KEY, JSON.stringify(next))
      } else if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not save this thought. Please try again.')
      }

      setText('')
      setOpen(false)
      setNotice('Thought parked. You can find it in Notely Flow.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this thought. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="flow-launcher global-parking-launcher"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setOpen(true); setError('') }}
      >
        <span aria-hidden="true">✳</span><span>Quick capture</span>
      </button>

      {open && (
        <div className="global-capture-backdrop">
          <section className="global-capture-dialog" role="dialog" aria-modal="true" aria-labelledby="global-capture-title">
            <div className="global-capture-heading">
              <div>
                <div className="global-capture-eyebrow">A THOUGHT INTERRUPTED YOU?</div>
                <h2 id="global-capture-title">Park it. Keep going.</h2>
                <p>Get it out of your head without leaving the page you are on.</p>
              </div>
              <button type="button" className="global-capture-close" aria-label="Close quick capture" onClick={() => setOpen(false)}>×</button>
            </div>
            <form onSubmit={save}>
              <textarea
                autoFocus
                className="global-capture-textarea"
                aria-label="Quick thought"
                placeholder="Type the thought. Messy is fine."
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={12000}
              />
              {error && <p className="global-capture-error" role="alert">{error}</p>}
              <div className="global-capture-footer">
                <span>Saved to your Parking Lot · <kbd>Esc</kbd> to close</span>
                <div>
                  <a href="/flow">Open Flow</a>
                  <button type="submit" className="flow-primary" disabled={!text.trim() || saving}>
                    {saving ? 'Parking…' : 'Park thought →'}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
      <span className="global-capture-announcement" role="status" aria-live="polite">{notice}</span>
    </>
  )
}
