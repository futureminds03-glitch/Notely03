'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { getPendingOfflineTagUpdates, getPendingParking, remapOfflineParking, removeOfflineParking, removeOfflineTagUpdate, saveOfflineParking } from '@/lib/offline-workspace'
import { getOfflineNotes, getPendingOfflineNotes, markOfflineNoteSynced, removeOfflineNote, updateCachedOfflineNote } from '@/lib/offline-notes'
import { getOfflineImage, removeOfflineImage } from '@/lib/offline-images'

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
  const [ownerId, setOwnerId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => { if (active) setOwnerId(data.session?.user.id ?? null) }).catch(() => undefined)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setOwnerId(session?.user.id ?? null)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!ownerId) return
    const sync = async () => {
      if (!navigator.onLine) return
      for (const update of await getPendingOfflineTagUpdates(ownerId).catch(() => [])) {
        try { const response = await fetch('/api/notes/' + encodeURIComponent(update.noteId), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags: update.tags }) }); if (!response.ok) break; await removeOfflineTagUpdate(ownerId, update.noteId) } catch { break }
      }
      // The home editor owns its richer sync flow while mounted. On every other route,
      // flush the same durable note queue here so reconnects never depend on returning home.
      if (window.location.pathname !== '/') {
        for (const record of await getPendingOfflineNotes(ownerId).catch(() => [])) {
          if (!navigator.onLine) break
          const note = record.note
          try {
            if (record.pendingDelete) {
              const response = await fetch('/api/notes/' + encodeURIComponent(note.id), { method: 'DELETE' })
              if (!response.ok && response.status !== 404) break
              await removeOfflineNote(ownerId, note.id)
              continue
            }
            let resolvedBody = note.body
            const localIds = [...new Set([...note.body.matchAll(/!\[image\]\(notely-local:([0-9a-f-]+)\)/gi)].map(match => match[1]))]
            const replaceImageMarkers = (content: string, replacements: Map<string, string>) => {
              let updated = content
              for (const [localId, path] of replacements) updated = updated.replaceAll('![image](notely-local:' + localId + ')', '![image](notely-image:' + path + ')')
              return updated
            }
            const payload = (body: string) => JSON.stringify({ id: note.id, title: note.title, body, started_at: note.started_at ?? null, tags: note.tags ?? [] })
            if (record.pendingCreate) {
              const createBody = note.body.replace(/!\[image\]\(notely-local:[0-9a-f-]+\)/gi, '')
              let response = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload(createBody) })
              if (response.status === 409) response = await fetch('/api/notes/' + encodeURIComponent(note.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: payload(createBody) })
              if (!response.ok) break
            }
            const replacements = new Map<string, string>()
            for (const imageId of localIds) {
              const image = await getOfflineImage(imageId)
              if (!image) throw new Error('Offline image is not available on this device')
              const form = new FormData()
              form.set('noteId', note.id)
              form.set('file', image.blob, 'pasted-image')
              const upload = await fetch('/api/note-images', { method: 'POST', body: form })
              if (!upload.ok) throw new Error('Offline image upload failed')
              const result = await upload.json() as { path: string }
              replacements.set(imageId, result.path)
            }
            resolvedBody = replaceImageMarkers(note.body, replacements)
            const updatedHistory = note.history?.map(version => ({ ...version, content: replaceImageMarkers(version.content, replacements) }))
            const needsUpdate = !record.pendingCreate || resolvedBody !== note.body
            if (needsUpdate) {
              const response = await fetch('/api/notes/' + encodeURIComponent(note.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: payload(resolvedBody) })
              if (!response.ok) break
            }
            const latest = (await getOfflineNotes(ownerId)).find(item => item.id === note.id)
            if (!latest || latest.title !== note.title || latest.body !== note.body || latest.updated_at !== note.updated_at) break
            const syncedVersion = { ...note, body: resolvedBody, ...(updatedHistory ? { history: updatedHistory } : {}) }
            await updateCachedOfflineNote(ownerId, syncedVersion)
            await markOfflineNoteSynced(ownerId, { ...syncedVersion, synced: true, pendingCreate: false })
            await Promise.all(localIds.map(removeOfflineImage))
          } catch { break }
        }
      }
      for (const record of await getPendingParking(ownerId).catch(() => [])) {
        if (record.pendingDelete) { try { if (!record.item.id.startsWith('local-')) { const response = await fetch('/api/parking-lot?id=' + encodeURIComponent(record.item.id), { method: 'DELETE' }); if (!response.ok && response.status !== 404) break } await removeOfflineParking(ownerId, record.item.id); continue } catch { break } }
        try { const response = await fetch('/api/parking-lot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: record.item.text, client_id: record.item.id }) }); if (!response.ok) break; const saved = await response.json() as ParkingItem; await remapOfflineParking(ownerId, record.item.id, saved); window.dispatchEvent(new CustomEvent('notely:parking-updated', { detail: saved })) } catch { break }
      }
    }
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('notely:sync-requested', sync)
    return () => { window.removeEventListener('online', sync); window.removeEventListener('notely:sync-requested', sync) }
  }, [ownerId])

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
    const item: ParkingItem = { id: 'local-' + crypto.randomUUID(), text: thought, createdAt: new Date().toISOString() }
    let queuedOffline = false
    let effectiveOwnerId = ownerId
    try {
      if (!effectiveOwnerId) { try { const session = await createClient().auth.getSession(); effectiveOwnerId = session.data.session?.user.id ?? null; if (effectiveOwnerId) setOwnerId(effectiveOwnerId) } catch { /* Guest capture remains available without auth configuration. */ } }
      if (effectiveOwnerId) {
        await saveOfflineParking(effectiveOwnerId, item)
        if (navigator.onLine) {
          try {
            const response = await fetch('/api/parking-lot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: thought, client_id: item.id }) })
            if (!response.ok) throw new Error('Your thought is saved here and will sync when you reconnect.')
            const savedItem = await response.json() as ParkingItem
            await remapOfflineParking(effectiveOwnerId, item.id, savedItem)
            window.dispatchEvent(new CustomEvent('notely:parking-updated', { detail: savedItem }))
          } catch {
            window.dispatchEvent(new CustomEvent('notely:parking-updated', { detail: item }))
            queuedOffline = true
          }
        } else {
          window.dispatchEvent(new CustomEvent('notely:parking-updated', { detail: item }))
          queuedOffline = true
        }
      } else {
        let savedItem = item
        if (navigator.onLine) {
          const response = await fetch('/api/parking-lot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: thought }) })
          if (response.status !== 401 && !response.ok) throw new Error('Could not save this thought. Please try again.')
          if (response.ok) savedItem = await response.json() as ParkingItem
        }
        localStorage.setItem(PARKING_KEY, JSON.stringify([savedItem, ...readLocalParking()]))
        window.dispatchEvent(new CustomEvent('notely:parking-updated', { detail: savedItem }))
      }
      setText('')
      setOpen(false)
      setNotice(queuedOffline ? 'Thought saved on this device. It will sync when you reconnect.' : 'Thought parked. You can find it in Notely Flow.')
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
