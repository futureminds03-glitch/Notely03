'use client'
import MemoryLoading from '@/components/MemoryLoading'
import DeploymentRefresh from '@/components/DeploymentRefresh'

import { memo, useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase-client'
import { cacheSyncedOfflineNote, getOfflineNotes, getPendingOfflineNotes, markOfflineNoteDeleted, markOfflineNoteSynced, removeOfflineNote, saveOfflineNote, updateCachedOfflineNote } from '@/lib/offline-notes'
import type { User } from '@supabase/supabase-js'
import NoteBodyEditor from '@/components/NoteBodyEditor'
import { getOfflineImage, removeOfflineImage } from '@/lib/offline-images'

interface NoteVersion { content: string; timestamp: number }

interface Note {
  id: string
  user_id?: string
  title: string
  body: string
  created_at: string
  updated_at: string
  started_at?: string
  history?: NoteVersion[]
  tags?: string[]
  synced?: boolean
  pendingCreate?: boolean
}

function fmtDate(iso: string) {
  const d = new Date(iso), diff = Date.now() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
}
function fmtFull(iso: string) {
  return new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}
function fmtShortTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
}

function toTimestampMs(iso: string | null | undefined) {
  if (!iso) return null
  const parsed = Date.parse(iso)
  return Number.isFinite(parsed) ? parsed : null
}

const GUEST_KEY = 'notely_notes'
function loadGuest(): Note[] {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY) || '[]') } catch { return [] }
}
function saveGuest(n: Note[]) { localStorage.setItem(GUEST_KEY, JSON.stringify(n)) }

function exportTxt(title: string, body: string, startedAt: string | null) {
  const ts = startedAt ? `Started: ${fmtFull(startedAt)}\n\n` : ''
  const content = `${title || 'Untitled'}\n${'─'.repeat(40)}\n${ts}${body}`
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(title || 'note').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

// ── OUTSIDE COMPONENT ──

interface NotesListProps {
  notes: Note[]
  activeId: string | null
  onOpen: (n: Note) => void
  onDelete: (id: string, e: React.MouseEvent) => void
  className?: string
}

const NotesList = memo(function NotesList({ notes, activeId, onOpen, onDelete, className }: NotesListProps) {
  return (
    <div className={className}>
      {notes.length === 0
        ? <div className="empty-list">No notes yet.<br />Hit + to begin.</div>
        : notes.map(n => (
          <div key={n.id} className={`note-item ${n.id === activeId ? 'active' : ''}`} onClick={() => onOpen(n)}>
            <div className="note-item-title">{n.title || 'Untitled'}</div>
            <div className="note-item-preview">{n.body.slice(0, 60) || '—'}</div>
            <div className="note-item-date">
              {n.started_at && <span style={{ marginRight: 6 }}>⏱ {fmtTime(n.started_at)}</span>}
              {fmtDate(n.updated_at)}
            </div>
            {n.tags?.length ? <div className="note-item-tags">{n.tags.slice(0,3).map(tag => <span key={tag}>{tag}</span>)}</div> : null}
            <button className="note-del" onClick={e => onDelete(n.id, e)} title="Archive note">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ))
      }
    </div>
  )
})

interface EditorProps {
  activeId: string | null
  title: string
  body: string
  startedAt: string | null
  saveStatus: 'saved' | 'saving' | 'error'
  wordCount: number
  aiStatus: string
  isOnline: boolean
  history: NoteVersion[]
  travelIndex: number
  onTitleChange: (v: string) => void
  onBodyChange: (v: string) => void
  onTitleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onDelete: (id: string, e: React.MouseEvent) => void
  onSummarize: () => void
  onExport: () => void
  onTravel: (idx: number) => void
  onRestoreVersion: () => void
  bodyRef: React.RefObject<HTMLDivElement | null>
  titleRef: React.RefObject<HTMLTextAreaElement | null>
}

function Editor({
  activeId, title, body, startedAt, saveStatus, wordCount, aiStatus, isOnline,
  history, travelIndex,
  onTitleChange, onBodyChange, onTitleKeyDown, onDelete,
  onSummarize, onExport, onTravel, onRestoreVersion,
  bodyRef, titleRef
}: EditorProps) {
  useEffect(() => {
    const resizeTitle = () => {
      const field = titleRef.current
      if (!field) return
      field.style.height = 'auto'
      field.style.height = `${field.scrollHeight}px`
    }
    resizeTitle()
    window.addEventListener('resize', resizeTitle)
    return () => window.removeEventListener('resize', resizeTitle)
  }, [title, activeId, titleRef])
  if (!activeId) {
    return (
      <div className="empty-editor">
        <svg width="48" height="48" viewBox="0 0 52 52" fill="none">
          <rect x="10" y="8" width="32" height="36" rx="3" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M17 18h18M17 24h18M17 30h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <p>Select a note or create one</p>
      </div>
    )
  }

  const displayBody = travelIndex >= 0 && history[travelIndex]
    ? history[travelIndex].content
    : body

  return (
    <div className="editor-wrap">
      <div className="toolbar">
        <button className="tool-btn" title="Archive note" onClick={e => onDelete(activeId, e)}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 3.5h9M5 3.5V2.5h3v1M5.5 6v4M7.5 6v4M3 3.5l.7 7h5.6l.7-7"
              stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="tool-sep" />
        <button className="tool-btn ai-btn" title={isOnline ? 'Summarize with AI' : 'AI summaries require an internet connection'} onClick={onSummarize} disabled={!body.trim() || !isOnline}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1.5l1 2.5h2.5l-2 1.5.8 2.5-2.3-1.5-2.3 1.5.8-2.5-2-1.5H5.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
            <path d="M2 10h9M3.5 12h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span>{isOnline ? 'Summarize' : 'AI offline'}</span>
        </button>
        <button className="tool-btn ai-btn" title="Export as .txt" onClick={onExport}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M8 1.5H4a1 1 0 00-1 1v8a1 1 0 001 1h5a1 1 0 001-1V4.5L8 1.5z" stroke="currentColor" strokeWidth="1.1"/>
            <path d="M8 1.5V4.5H11M4.5 7h4M4.5 9h2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
          <span>Export</span>
        </button>
        <div className="tool-sep" />
        <span className="word-count" style={{ marginLeft: 'auto' }}>{wordCount}w</span>
        <span className="character-count" aria-label={`${displayBody.length} characters`}>{displayBody.length} chars</span>
        <span className={`save-status ${saveStatus}`} aria-live="polite">
          {saveStatus === 'saved' ? '● saved' : saveStatus === 'error' ? '● save failed' : '○ saving…'}
        </span>
      </div>

      {aiStatus && <div className="ai-status-bar" role="status" aria-live="polite" aria-busy={aiStatus.toLowerCase().includes('summariz')}>{aiStatus}</div>}
      <div className="note-timestamp" aria-label="Capture timestamp">
        <span className="note-timestamp-label">Captured</span>
        <strong>{fmtTime(startedAt || new Date().toISOString())}</strong>
        <span>· {fmtFull(startedAt || new Date().toISOString())}</span>
      </div>

      <textarea
        ref={titleRef}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        className="note-title"
        placeholder="Untitled"
        value={title}
        onChange={e => onTitleChange(e.target.value)}
        onKeyDown={onTitleKeyDown}
        rows={1}
      />
      <NoteBodyEditor
        editorRef={bodyRef}
        noteId={activeId}
        value={displayBody}
        onChange={value => {
          if (travelIndex >= 0) onTravel(-1)
          onBodyChange(value)
        }}
      />

      {history.length > 1 && (
        <div className="time-travel-bar">
          <span className="tt-label">Time Travel</span>
          <div className="tt-scrubber-wrap">
            <input
              type="range"
              className="tt-scrubber"
              min={0}
              max={Math.max(0, history.length - 1)}
              value={travelIndex >= 0 ? travelIndex : Math.max(0, history.length - 1)}
              style={{
                background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${history.length > 1 ? ((travelIndex >= 0 ? travelIndex : history.length - 1) / (history.length - 1)) * 100 : 100}%, var(--line) ${history.length > 1 ? ((travelIndex >= 0 ? travelIndex : history.length - 1) / (history.length - 1)) * 100 : 100}%, var(--line) 100%)`
              }}
              onChange={e => onTravel(parseInt(e.currentTarget.value))}
              aria-label="Time travel history"
            />
          </div>
          <span className="tt-time">
            {travelIndex >= 0 && history[travelIndex]
              ? fmtShortTime(history[travelIndex].timestamp)
              : history.length === 1
                ? 'Captured'
                : fmtShortTime(history[history.length - 1]?.timestamp || Date.now())}
          </span>
          {travelIndex >= 0 && travelIndex < history.length - 1 && (
            <button className="tt-restore" onClick={onRestoreVersion}>Restore</button>
          )}
        </div>
      )}
    </div>
  )
}


interface TimeMachineProps { notes: Note[]; onOpen: (note: Note) => void; onBack: () => void }

function noteMoment(note: Note) {
  const timestamp = Date.parse(note.started_at || note.created_at)
  return Number.isFinite(timestamp) ? timestamp : Date.parse(note.created_at)
}

function localDateKey(date: Date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
}

function TimeMachine({ notes, onOpen, onBack }: TimeMachineProps) {
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('week')
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()))
  const period = useMemo(() => {
    const parts = selectedDate.split('-').map(Number)
    const start = new Date(parts[0], parts[1] - 1, parts[2])
    if (granularity === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    if (granularity === 'month') start.setDate(1)
    const end = new Date(start)
    if (granularity === 'day') end.setDate(end.getDate() + 1)
    if (granularity === 'week') end.setDate(end.getDate() + 7)
    if (granularity === 'month') end.setMonth(end.getMonth() + 1)
    return { start, end }
  }, [selectedDate, granularity])
  const entries = useMemo(() => notes.map(note => ({ note, timestamp: noteMoment(note) }))
    .filter(item => item.timestamp >= period.start.getTime() && item.timestamp < period.end.getTime())
    .sort((a, b) => b.timestamp - a.timestamp), [notes, period])
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof entries>()
    for (const entry of entries) {
      const key = localDateKey(new Date(entry.timestamp))
      groups.set(key, [...(groups.get(key) ?? []), entry])
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [entries])
  const periodLabel = granularity === 'day'
    ? period.start.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : granularity === 'week'
      ? period.start.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' – ' + new Date(period.end.getTime() - 1).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
      : period.start.toLocaleDateString([], { month: 'long', year: 'numeric' })
  function movePeriod(direction: number) {
    const next = new Date(period.start)
    if (granularity === 'day') next.setDate(next.getDate() + direction)
    if (granularity === 'week') next.setDate(next.getDate() + 7 * direction)
    if (granularity === 'month') next.setMonth(next.getMonth() + direction)
    setSelectedDate(localDateKey(next))
  }
  return (
    <section className="time-machine" aria-label="Time Machine">
      <div className="time-machine-heading">
        <div><button className="tm-back" onClick={onBack}>← Back to notes</button><div className="time-machine-eyebrow">YOUR NOTES, IN TIME</div><h1>Time Machine</h1><p>Find a note by when you first captured the thought — not by when you last edited it.</p></div>
        <button className="tm-today" onClick={() => setSelectedDate(localDateKey(new Date()))}>Today</button>
      </div>
      <section className="tm-guide" aria-label="How Time Machine works"><div className="tm-guide-title"><span>HOW TO USE IT</span><strong>Your personal timeline</strong><p>Time Machine answers “What was I thinking around that time?” It groups notes by their original capture date.</p></div><div className="tm-guide-steps"><div><b>01</b><strong>Choose a scale</strong><span>Day for a specific moment, week for a stretch of days, or month for the bigger picture.</span></div><div><b>02</b><strong>Move through time</strong><span>Use the arrows or jump straight to a date. The timeline updates to that period.</span></div><div><b>03</b><strong>Reopen a thought</strong><span>Read a preview, then open any note to continue writing where you left off.</span></div></div><div className="tm-guide-footer"><span>{notes.length} notes in your library</span><span>Time Machine = when you captured it · Time Travel = earlier versions of one note</span></div></section>
      <div className="tm-controls">
        <div className="tm-zoom" role="group" aria-label="Timeline scale">
          {(['day', 'week', 'month'] as const).map(value => <button key={value} className={granularity === value ? 'active' : ''} aria-pressed={granularity === value} onClick={() => setGranularity(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
        </div>
        <label className="tm-date-label"><span>Jump to date</span><input aria-label="Jump to date" type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} /></label>
      </div>
      <div className="tm-period-nav"><button aria-label="Previous period" onClick={() => movePeriod(-1)}>←</button><strong>{periodLabel}</strong><button aria-label="Next period" onClick={() => movePeriod(1)}>→</button></div>
      <div className="tm-results" aria-live="polite">
        {grouped.length === 0 ? <div className="tm-empty"><span>Nothing captured in this stretch of time.</span><p>Try another date, or zoom out to see a whole month.</p></div> : grouped.map(([day, dayEntries]) => (
          <section className="tm-day" key={day}>
            <h2>{new Date(day + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
            <div className="tm-day-entries">
              {dayEntries.map(({ note, timestamp }) => <article className="tm-entry" key={note.id}>
                <time dateTime={new Date(timestamp).toISOString()}>{new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                <div className="tm-entry-copy"><button className="tm-entry-title" onClick={() => onOpen(note)}>{note.title.trim() || 'Untitled'}</button><p>{note.body.trim().replace(/\s+/g, ' ').slice(0, 180) || 'An empty note — a thought captured before the words arrived.'}</p></div>
                <button className="tm-open" onClick={() => onOpen(note)} aria-label={'Open ' + (note.title.trim() || 'Untitled')}>Open ↗</button>
              </article>)}
            </div>
          </section>
        ))}
      </div>
      <div className="tm-footnote">Showing {entries.length} {entries.length === 1 ? 'note' : 'notes'} from this {granularity} · Sorted by original capture time</div>
    </section>
  )
}

// ── MAIN COMPONENT ──

export default function NotelyApp() {
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [history, setHistory] = useState<NoteVersion[]>([])
  const [travelIndex, setTravelIndex] = useState(-1)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [wordCount, setWordCount] = useState(0)
  const [aiStatus, setAiStatus] = useState('')
  const [search, setSearch] = useState('')
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list')
  const [showTimeMachine, setShowTimeMachine] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  const bodyRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const mobileBodyRef = useRef<HTMLDivElement>(null)
  const mobileTitleRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const historyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const userRef = useRef<User | null>(null)
  const startedAtRef = useRef<string | null>(null)
  const notesRef = useRef<Note[]>([])
  const localWritesRef = useRef(new Map<string, number>())
  const saveSequenceRef = useRef<Record<string, number>>({})
  const saveQueueRef = useRef<Record<string, Promise<void>>>({})
  const activeDraftRef = useRef({ title: '', body: '' })
  const draftByIdRef = useRef<Record<string, { title: string; body: string }>>({})
  const creationInFlightRef = useRef(false)
  const authGenerationRef = useRef(0)
  const dirtyFieldsRef = useRef({ title: false, body: false })
  const deepLinkOpenedRef = useRef(false)
  const syncInFlightRef = useRef(false)

  useEffect(() => { activeIdRef.current = activeId }, [activeId])
  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { startedAtRef.current = startedAt }, [startedAt])
  useEffect(() => { notesRef.current = notes }, [notes])

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine)
    updateOnline()
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    const sync = () => { if (navigator.onLine) void syncPendingNotes(user.id) }
    window.addEventListener('online', sync)
    if (navigator.onLine) sync()
    return () => window.removeEventListener('online', sync)
  }, [user])

  useEffect(() => {
    const flushDraft = () => {
      const id = activeIdRef.current
      if (!id) return
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      if (userRef.current) {
        const existing = notesRef.current.find(note => note.id === id)
        if (!existing) return
        const ownerId = userRef.current.id
        const localNote = {
          ...existing,
          ...activeDraftRef.current,
          updated_at: new Date().toISOString(),
          synced: false,
        }
        void saveOfflineNote(ownerId, localNote, { pendingCreate: existing.pendingCreate })
          .then(() => { if (navigator.onLine) void syncPendingNotes(ownerId) })
          .catch(error => console.error('Could not flush local draft:', error))
      } else {
        flushGuestDraft(id)
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushDraft()
    }
    window.addEventListener('pagehide', flushDraft)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flushDraft)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (deepLinkOpenedRef.current) return
    const requestedNoteId = new URLSearchParams(window.location.search).get('note')
    if (!requestedNoteId) return
    const requestedNote = notes.find(note => note.id === requestedNoteId)
    if (!requestedNote) return
    deepLinkOpenedRef.current = true
    openNote(requestedNote)
  }, [notes])
  useEffect(() => { activeDraftRef.current = { title, body } }, [title, body])

  useEffect(() => {
    const initialAuthGeneration = authGenerationRef.current
    supabase.auth.getUser().then(({ data }) => {
      // The auth event listener wins if auth changed while getUser was pending.
      if (authGenerationRef.current !== initialAuthGeneration) return
      userRef.current = data.user
      setUser(data.user)
      setAuthReady(true)
    }).catch(() => setAuthReady(true))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      authGenerationRef.current += 1
      userRef.current = session?.user ?? null
      setUser(session?.user ?? null)
      setAuthReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const noteId = new URLSearchParams(window.location.search).get('note')
    if (!noteId) return
    const target = notes.find(note => note.id === noteId)
    if (target) { openNote(target); window.history.replaceState({}, '', '/') }
  }, [notes])

  useEffect(() => {
    if (!authReady) return
    let active = true
    setWorkspaceReady(false)
    if (user) {
      void fetchCloud(user.id).finally(() => { if (active) setWorkspaceReady(true) })
    } else {
      const gn = loadGuest()
      setNotes(gn)
      if (gn.length > 0) openNote(gn[0])
      else clearEditor()
      setWorkspaceReady(true)
    }
    return () => { active = false }
  }, [user?.id, authReady])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`documents:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${user.id}`,
        },
        payload => {
          const row = payload.new as Partial<Note> & { status?: string }
          if (!row.id) return

          if (payload.eventType === 'DELETE' || row.status === 'archived') {
            setNotes(prev => prev.filter(note => note.id !== row.id))
            if (activeIdRef.current === row.id) {
              clearEditor()
              setMobileView('list')
            }
            return
          }

          const incoming: Note = {
            id: row.id,
            user_id: row.user_id,
            title: row.title ?? '',
            body: row.body ?? '',
            created_at: row.created_at ?? new Date().toISOString(),
            updated_at: row.updated_at ?? new Date().toISOString(),
            started_at: row.started_at ?? undefined,
          }

          if (localWritesRef.current.has(row.id)) return
          const locallyPending = notesRef.current.find(note => note.id === row.id)
          if (locallyPending?.synced === false) return

          setNotes(prev => {
            const exists = prev.some(note => note.id === row.id)
            return exists
              ? prev.map(note => note.id === row.id ? { ...note, ...incoming, synced: true } : note)
              : [incoming, ...prev]
          })

          if (activeIdRef.current === row.id && !dirtyFieldsRef.current.title && !dirtyFieldsRef.current.body && saveStatus !== 'saving') {
            setActiveId(row.id)
            activeIdRef.current = row.id
            setTitle(incoming.title)
            setBody(incoming.body)
            activeDraftRef.current = { title: incoming.title, body: incoming.body }
            startedAtRef.current = incoming.started_at ?? null
            setStartedAt(incoming.started_at ?? null)
            setHistory(prev => {
              const timestamp = Date.parse(incoming.updated_at)
              const last = prev[prev.length - 1]
              if (last?.content === incoming.body) return prev
              return [...prev, { content: incoming.body, timestamp }]
            })
            setWordCount(incoming.body.trim() ? incoming.body.trim().split(/\s+/).length : 0)
            setSaveStatus('saved')
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user])

  function clearEditor() {
    activeIdRef.current = null
    startedAtRef.current = null
    setActiveId(null); setTitle(''); setBody(''); setStartedAt(null)
    setWordCount(0); setAiStatus(''); setHistory([]); setTravelIndex(-1)
  }

  async function fetchCloud(requestedUserId: string) {
    const generation = authGenerationRef.current
    try {
      const cached = await getOfflineNotes(requestedUserId)
      if (generation === authGenerationRef.current && userRef.current?.id === requestedUserId) {
        setNotes(cached)
        notesRef.current = cached
        if (cached.length > 0 && !cached.some(note => note.id === activeIdRef.current)) openNote(cached[0])
        if (cached.length === 0) clearEditor()
      }
    } catch (error) { console.error('Could not read local notes:', error) }
    try {
      const res = await fetch('/api/notes', { cache: 'no-store' })
      if (!res.ok) return
      const data: Note[] = await res.json()

      // Ignore stale cloud responses after account changes or sign-out.
      if (
        generation !== authGenerationRef.current ||
        userRef.current?.id !== requestedUserId
      ) return

      const pending = await getPendingOfflineNotes(requestedUserId).catch(() => [])
      const pendingById = new Map(pending.filter(item => !item.pendingDelete).map(item => [item.note.id, item.note]))
      const merged = data.map(note => pendingById.get(note.id) ?? { ...note, synced: true })
      const cloudIds = new Set(merged.map(note => note.id))
      for (const item of pending) {
        if (!item.pendingDelete && !cloudIds.has(item.note.id)) merged.push(item.note)
      }
      for (const note of data) await cacheSyncedOfflineNote(requestedUserId, note).catch(() => undefined)
      setNotes(merged)
      notesRef.current = merged
      if (merged.length > 0 && !merged.some(note => note.id === activeIdRef.current)) openNote(merged[0])
      if (navigator.onLine) void syncPendingNotes(requestedUserId)
      if (merged.length === 0) clearEditor()
    } catch (error) {
      console.error('Failed to load cloud notes:', error)
    }
  }

  async function syncPendingNotes(ownerId: string) {
    if (!navigator.onLine || syncInFlightRef.current || userRef.current?.id !== ownerId) return
    syncInFlightRef.current = true
    let completedAll = true
    let shouldRunAgain = false
    try {
      const pending = await getPendingOfflineNotes(ownerId)
      for (const item of pending) {
        if (!navigator.onLine || userRef.current?.id !== ownerId) break
        const note = item.note
        if (item.pendingDelete) {
          const response = await fetch('/api/notes/' + note.id, { method: 'DELETE' })
          if (!response.ok && response.status !== 404) { completedAll = false; break }
          await removeOfflineNote(ownerId, note.id)
          setNotes(prev => {
            const next = prev.filter(existing => existing.id !== note.id)
            notesRef.current = next
            return next
          })
          continue
        }

        const resolveImages = async (sourceBody: string) => {
          let resolvedBody = sourceBody
          const ids = [...new Set([...sourceBody.matchAll(/!\[image\]\(notely-local:([0-9a-f-]+)\)/gi)].map(match => match[1]))]
          for (const imageId of ids) {
            const image = await getOfflineImage(imageId)
            if (!image) throw new Error('A locally pasted image is missing from this device. Reconnect the original device to sync it.')
            const form = new FormData()
            form.set('noteId', note.id)
            form.set('file', image.blob, 'pasted-image')
            const upload = await fetch('/api/note-images', { method: 'POST', body: form })
            if (!upload.ok) throw new Error('Pasted image upload failed')
            const result = await upload.json() as { path: string }
            resolvedBody = resolvedBody.replaceAll('![image](notely-local:' + imageId + ')', '![image](notely-image:' + result.path + ')')
          }
          return resolvedBody
        }
        const cleanupUploadedImages = async () => {
          const ids = [...new Set([...note.body.matchAll(/!\[image\]\(notely-local:([0-9a-f-]+)\)/gi)].map(match => match[1]))]
          await Promise.all(ids.map(removeOfflineImage))
        }
        const finalizeSyncedImages = async (bodyValue: string) => {
          const latest = (await getOfflineNotes(ownerId)).find(existing => existing.id === note.id)
          const activeDraftUnchanged = activeIdRef.current !== note.id ||
            (activeDraftRef.current.title === note.title && activeDraftRef.current.body === note.body)
          const unchanged = Boolean(latest &&
            latest.title === note.title &&
            latest.body === note.body &&
            latest.updated_at === note.updated_at &&
            JSON.stringify(latest.tags ?? []) === JSON.stringify(note.tags ?? []) &&
            activeDraftUnchanged)
          if (!unchanged || !latest) return

          const previousMarkers = [...note.body.matchAll(/!\[image\]\(notely-(image|local):([^)]+)\)/g)]
          const resolvedMarkers = [...bodyValue.matchAll(/!\[image\]\(notely-image:([^)]+)\)/g)]
          const replacements = new Map<string, string>()
          previousMarkers.forEach((marker, index) => {
            if (marker[1] === 'local' && resolvedMarkers[index]?.[1]) replacements.set(marker[2], resolvedMarkers[index][1])
          })
          const replaceHistoryMarkers = (content: string) => {
            let updated = content
            for (const [localId, path] of replacements) {
              updated = updated.replaceAll('![image](notely-local:' + localId + ')', '![image](notely-image:' + path + ')')
            }
            return updated
          }
          const updatedHistory = latest.history?.map(version => ({ ...version, content: replaceHistoryMarkers(version.content) }))
          await updateCachedOfflineNote(ownerId, { ...note, body: bodyValue, ...(updatedHistory ? { history: updatedHistory } : {}) })
          await cleanupUploadedImages()
          if (activeIdRef.current === note.id) {
            setBody(bodyValue)
            activeDraftRef.current = { ...activeDraftRef.current, body: bodyValue }
            draftByIdRef.current[note.id] = { ...activeDraftRef.current }
            setHistory(previous => previous.map(version => ({ ...version, content: replaceHistoryMarkers(version.content) })))
          }
        }
        let syncedBody = note.body
        let response: Response
        const payloadFor = (bodyValue: string) => JSON.stringify({
          id: note.id,
          title: note.title,
          body: bodyValue,
          started_at: note.started_at ?? null,
          tags: note.tags ?? [],
        })
        if (item.pendingCreate) {
          response = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payloadFor(note.body.replace(/!\[image\]\(notely-local:[0-9a-f-]+\)/gi, '')),
          })
          if (response.status === 409) {
            response = await fetch('/api/notes/' + note.id, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: payloadFor(note.body),
            })
          }
          if (!response.ok) { completedAll = false; break }
          await response.json().catch(() => null)
          syncedBody = await resolveImages(note.body)
          if (syncedBody !== note.body) {
            response = await fetch('/api/notes/' + note.id, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: payloadFor(syncedBody),
            })
            if (!response.ok) { completedAll = false; break }
          }
          await finalizeSyncedImages(syncedBody)
          const syncedNote: Note = { ...note, body: syncedBody, synced: true, pendingCreate: false }
          await markOfflineNoteSynced(ownerId, syncedNote)
          const latestLocal = (await getOfflineNotes(ownerId)).find(existing => existing.id === note.id) ?? syncedNote
          setNotes(prev => {
            const next = prev.map(existing => existing.id === note.id ? latestLocal as Note : existing)
            notesRef.current = next
            return next
          })
          continue
        } else {
          syncedBody = await resolveImages(note.body)
          response = await fetch('/api/notes/' + note.id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: payloadFor(syncedBody),
          })
        }
        if (!response.ok) { completedAll = false; break }
        await finalizeSyncedImages(syncedBody)
        const syncedNote: Note = { ...note, body: syncedBody, synced: true, pendingCreate: false }
        await markOfflineNoteSynced(ownerId, syncedNote)
        const latestLocal = (await getOfflineNotes(ownerId)).find(existing => existing.id === note.id) ?? syncedNote
        setNotes(prev => {
          const next = prev.map(existing => existing.id === note.id ? latestLocal as Note : existing)
          notesRef.current = next
          return next
        })
      }
      if (completedAll) {
        shouldRunAgain = (await getPendingOfflineNotes(ownerId)).length > 0
        window.dispatchEvent(new CustomEvent('notely:sync-requested'))
      }
    } catch (error) {
      completedAll = false
      console.error('Offline note sync paused:', error)
    } finally {
      syncInFlightRef.current = false
      if (shouldRunAgain && navigator.onLine && userRef.current?.id === ownerId) void syncPendingNotes(ownerId)
    }
  }

  function flushGuestDraft(id: string) {
    const draft = activeDraftRef.current
    saveSequenceRef.current[id] = (saveSequenceRef.current[id] ?? 0) + 1
    const flushed = notesRef.current.map(existing => existing.id === id
      ? { ...existing, ...draft, updated_at: new Date().toISOString(), synced: false }
      : existing
    )
    notesRef.current = flushed
    setNotes(flushed)
    saveGuest(flushed)
  }

  function openNote(note: Note) {
    const previousId = activeIdRef.current
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
      if (previousId?.startsWith('temp-') && !userRef.current) {
        flushGuestDraft(previousId)
      } else if (previousId && !previousId.startsWith('temp-')) {
        void doSave(previousId, activeDraftRef.current.title, activeDraftRef.current.body, startedAtRef.current)
      }
    }
    if (historyTimer.current) { clearTimeout(historyTimer.current); historyTimer.current = null }
    dirtyFieldsRef.current = { title: false, body: false }
    activeIdRef.current = note.id
    startedAtRef.current = note.started_at || null
    setActiveId(note.id)
    setTitle(note.title)
    setBody(note.body)
    activeDraftRef.current = { title: note.title, body: note.body }
    draftByIdRef.current[note.id] = { title: note.title, body: note.body }
    setStartedAt(note.started_at || null)
    setWordCount(note.body.trim() ? note.body.trim().split(/\s+/).length : 0)
    const capturedAt = toTimestampMs(note.started_at)
    setHistory(note.history?.length ? note.history : [{
      content: note.body,
      timestamp: capturedAt ?? toTimestampMs(note.created_at) ?? Date.now(),
    }])
    setTravelIndex(-1)
    setSaveStatus('saved')
    setAiStatus('')
    setSidebarOpen(false)
    setMobileView('editor')
  }

  // ── INSTANT NEW NOTE ──
  async function newNote() {
    if (creationInFlightRef.current) return
    setShowTimeMachine(false)
    creationInFlightRef.current = true
    const now = new Date().toISOString()
    const tempId = userRef.current ? crypto.randomUUID() : `temp-${Date.now()}`
    const captureTimestamp = Date.now()
    // Let openNote flush the previous note's pending autosave before switching IDs.
    const tempNote: Note = {
      id: tempId,
      title: '',
      body: '',
      created_at: now,
      updated_at: now,
      started_at: now,
      history: [{ content: '', timestamp: captureTimestamp }],
      synced: false,
      pendingCreate: Boolean(userRef.current),
    }
    draftByIdRef.current[tempId] = { title: '', body: '' }
    const updated = [tempNote, ...notesRef.current]
    notesRef.current = updated
    setNotes(updated)
    if (!userRef.current) saveGuest(updated)
    else void saveOfflineNote(userRef.current.id, tempNote, { pendingCreate: true }).then(() => syncPendingNotes(userRef.current!.id)).catch(error => console.error('Could not queue new note:', error))
    openNote(tempNote)
    setTimeout(() => {
      // The editor may already be focused by the time this deferred focus runs.
      // Never steal focus from a field the user has started typing into.
      if (activeIdRef.current !== tempId) return
      const activeElement = document.activeElement
      const userIsEditing = activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        Boolean(activeElement && (activeElement as HTMLElement).isContentEditable)
      if (userIsEditing) return

      const titleField = window.matchMedia('(max-width: 640px)').matches
        ? mobileTitleRef.current
        : titleRef.current
      titleField?.focus()
    }, 50)

    creationInFlightRef.current = false
  }

  const doSave = useCallback(async (id: string, t: string, b: string, sa: string | null) => {
    if (!id || (id.startsWith('temp-') && userRef.current)) return

    const sequence = (saveSequenceRef.current[id] ?? 0) + 1
    saveSequenceRef.current[id] = sequence

    const runSave = async () => {
      const now = new Date().toISOString()

      if (userRef.current) {
        const ownerId = userRef.current.id
        const existing = notesRef.current.find(note => note.id === id)
        const pendingCreate = Boolean(existing?.pendingCreate)
        const localNote: Note = {
          ...(existing ?? { id, created_at: now, tags: [], history: [] }),
          title: t,
          body: b,
          started_at: sa ?? undefined,
          updated_at: now,
          synced: false,
          pendingCreate,
        }
        await saveOfflineNote(ownerId, localNote, { pendingCreate })
        setNotes(prev => {
          const updated = prev.map(note => note.id === id ? localNote : note)
          notesRef.current = updated
          return updated
        })
        if (navigator.onLine) void syncPendingNotes(ownerId)
      }
      // Serialize writes per note so an older request can never finish after and overwrite a newer draft.
      if (sequence !== saveSequenceRef.current[id]) return
      setNotes(prev => {
        const updated = prev.map(n =>
          n.id === id
            ? { ...n, title: t, body: b, started_at: sa ?? undefined, updated_at: now, synced: !userRef.current }
            : n
        )
        notesRef.current = updated
        if (!userRef.current) saveGuest(updated)
        return updated
      })
      if (activeIdRef.current === id) {
        setSaveStatus('saved')
        if (activeDraftRef.current.title === t && activeDraftRef.current.body === b) {
          dirtyFieldsRef.current = { title: false, body: false }
        }
      }
    }

    const previous = saveQueueRef.current[id] ?? Promise.resolve()
    const queued = previous.catch(() => undefined).then(runSave)
    saveQueueRef.current[id] = queued
    try {
      await queued
    } finally {
      if (saveQueueRef.current[id] === queued) delete saveQueueRef.current[id]
    }
  }, [])

  function scheduleSave(t: string, b: string, sa: string | null) {
    const id = activeIdRef.current
    if (!id) return
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void doSave(id, t, b, sa) }, 300)
  }

  function addToHistory(b: string) {
    const noteId = activeIdRef.current
    if (!noteId) return
    if (historyTimer.current) clearTimeout(historyTimer.current)
    historyTimer.current = setTimeout(() => {
      setHistory(prev => {
        const last = prev[prev.length - 1]
        if (last?.content === b) return prev
        const next = [...prev, { content: b, timestamp: Date.now() }]
        const updated = notesRef.current.map(note =>
          note.id === noteId ? { ...note, history: next } : note
        )
        notesRef.current = updated
        setNotes(updated)
        if (!userRef.current) saveGuest(updated)
        return next
      })
    }, 1000)
  }

  function onTitleChange(v: string) {
    let sa = startedAtRef.current
    if (!sa) {
      sa = new Date().toISOString()
      startedAtRef.current = sa
      setStartedAt(sa)
    }
    setTitle(v)
    dirtyFieldsRef.current.title = true
    activeDraftRef.current.title = v
    const draftId = activeIdRef.current
    if (draftId) draftByIdRef.current[draftId] = { ...activeDraftRef.current }
    scheduleSave(v, activeDraftRef.current.body, sa)
  }

  function onBodyChange(v: string) {
    let sa = startedAtRef.current
    if (!sa) {
      sa = new Date().toISOString()
      startedAtRef.current = sa
      setStartedAt(sa)
    }
    setBody(v)
    dirtyFieldsRef.current.body = true
    activeDraftRef.current.body = v
    const draftId = activeIdRef.current
    if (draftId) draftByIdRef.current[draftId] = { ...activeDraftRef.current }
    setWordCount(v.trim() ? v.trim().split(/\s+/).length : 0)
    scheduleSave(activeDraftRef.current.title, v, sa)
    addToHistory(v)
    setTravelIndex(-1)
  }

  function onTravel(idx: number) {
    if (history.length === 0) return
    setTravelIndex(Math.max(0, Math.min(idx, history.length - 1)))
  }

  function onRestoreVersion() {
    if (travelIndex < 0 || !history[travelIndex]) return
    const restored = history[travelIndex].content
    setBody(restored)
    activeDraftRef.current.body = restored
    dirtyFieldsRef.current.body = true
    const draftId = activeIdRef.current
    if (draftId) draftByIdRef.current[draftId] = { ...activeDraftRef.current }
    setWordCount(restored.trim() ? restored.trim().split(/\s+/).length : 0)
    setTravelIndex(-1)
    scheduleSave(activeDraftRef.current.title, restored, startedAtRef.current)
    addToHistory(restored)
  }

  const onTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches) {
        mobileBodyRef.current?.focus()
      } else {
        bodyRef.current?.focus()
      }
    }
  }, [])

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()

    const wasActive = activeIdRef.current === id
    if (wasActive) {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = null
      if (historyTimer.current) clearTimeout(historyTimer.current)
      historyTimer.current = null
    }
    const previousNotes = notesRef.current
    const deletedNote = previousNotes.find(note => note.id === id)
    if (!deletedNote) return

    const updated = previousNotes.filter(note => note.id !== id)

    // Optimistic UI: remove immediately and move the editor without waiting on the network.
    notesRef.current = updated
    setNotes(updated)
    if (!userRef.current) saveGuest(updated)

    if (wasActive) {
      if (updated.length > 0) openNote(updated[0])
      else {
        clearEditor()
        setMobileView('list')
      }
    }

    if (!userRef.current || id.startsWith('temp-')) return

    try {
      await markOfflineNoteDeleted(userRef.current.id, id)
      if (navigator.onLine) void syncPendingNotes(userRef.current.id)
    } catch (error) {
      console.error('Could not queue note deletion:', error)
      setSaveStatus('error')
    }
  }, [])

  async function handleSummarize() {
    if (!body.trim()) return
    const approved = window.confirm('AI summary privacy notice: if AI is enabled, Notely sends this note title and text to Groq to generate the summary. Continue?')
    if (!approved) return
    const noteId = activeIdRef.current
    const sourceTitle = title
    const sourceBody = body
    const sourceStartedAt = startedAtRef.current
    if (!noteId) return
    setAiStatus('✦ Summarizing…')
    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: sourceTitle, body: sourceBody, aiConsent: true })
      })
      const data = await response.json().catch(() => ({}))
      if (activeIdRef.current !== noteId) return
      if (!response.ok) {
        const message = response.status === 503
          ? '✦ AI summaries are paused for now.'
          : (typeof data.error === 'string' ? data.error : '✦ Could not generate summary. Try again.')
        setAiStatus(message)
        setTimeout(() => setAiStatus(''), 4000)
        return
      }
      if (activeDraftRef.current.title !== sourceTitle || activeDraftRef.current.body !== sourceBody) {
        setAiStatus('✦ Note changed while summarizing. Try again.')
        setTimeout(() => setAiStatus(''), 4000)
        return
      }
      const summary = data.summary || 'Could not generate summary.'
      const newBody = sourceBody + '\n\n─── AI Summary ───\n' + summary
      setBody(newBody)
      activeDraftRef.current = { title: sourceTitle, body: newBody }
      dirtyFieldsRef.current.body = true
      draftByIdRef.current[noteId] = { title: sourceTitle, body: newBody }
      setWordCount(newBody.trim().split(/\s+/).length)
      scheduleSave(sourceTitle, newBody, sourceStartedAt)
      addToHistory(newBody)
      setAiStatus('✦ Summary added below your note')
      setTimeout(() => setAiStatus(''), 3000)
    } catch {
      if (activeIdRef.current === noteId) {
        setAiStatus('✦ Could not connect. Try again.')
        setTimeout(() => setAiStatus(''), 3000)
      }
    }
  }

  function handleExport() { exportTxt(title, body, startedAt) }

  async function handleAuth() {
    setAuthError('')
    if (authMode === 'signup' && !termsAccepted) {
      setAuthError('Please accept the Terms of Service and acknowledge the Privacy Policy to create an account.')
      return
    }
    setAuthLoading(true)
    let error
    if (authMode === 'signup') {
      ;({ error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            legal_terms_accepted: true,
            legal_terms_version: '2026-11-01',
            privacy_policy_version: '2026-11-01-r2',
          },
        },
      }))
    } else {
      ;({ error } = await supabase.auth.signInWithPassword({ email, password }))
    }
    setAuthLoading(false)
    if (error) { setAuthError(error.message); return }
    setShowModal(false); setEmail(''); setPassword(''); setTermsAccepted(false)
  }

  async function signOut() {
    // Invalidate any in-flight cloud-note request before changing modes.
    authGenerationRef.current += 1
    userRef.current = null
    const { error } = await supabase.auth.signOut()
    if (error) {
      const { data } = await supabase.auth.getUser()
      userRef.current = data.user
      setUser(data.user)
      setAuthError(error.message)
      return
    }
    setNotes(loadGuest())
    notesRef.current = loadGuest()
    clearEditor()
    setMobileView('list')
  }

  const handleOpen = useCallback((n: Note) => { setShowTimeMachine(false); openNote(n) }, [])

  const filteredNotes = useMemo(() => {
    const query = search.toLowerCase()
    return notes.filter(n =>
      !query || n.title.toLowerCase().includes(query) ||
      n.body.toLowerCase().includes(query)
    )
  }, [notes, search])

  if (!workspaceReady) return <MemoryLoading title="Opening Notely" detail={isOnline ? "Getting your notes ready" : "Restoring your offline notes"} />

  const editorProps = {
    activeId, title, body, startedAt, saveStatus, wordCount, aiStatus, isOnline,
    history, travelIndex,
    onTitleChange, onBodyChange, onTitleKeyDown, onDelete: handleDelete,
    onSummarize: handleSummarize, onExport: handleExport,
    onTravel, onRestoreVersion,
  }

  return (
    <>
      {/* MOBILE HEADER */}
      <div className="mobile-header">
        {mobileView === 'list' ? (
          <>
            <div className="mobile-header-brand"><span className="brand-mark" aria-hidden="true">✳</span>Notely<span>.</span><DeploymentRefresh /></div>
            <div style={{ display: 'flex', gap: 2 }}>
              <button className="mobile-btn" aria-label={user ? 'Account and privacy settings' : 'Sign in'} onClick={() => user ? window.location.assign('/account') : setShowModal(true)}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M3 17c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
              <button className="mobile-btn" onClick={newNote}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </>
        ) : (
          <>
            <button className="mobile-back-btn" onClick={() => {
              const id = activeIdRef.current
              const hadPendingSave = Boolean(saveTimer.current)
              if (saveTimer.current) {
                clearTimeout(saveTimer.current)
                saveTimer.current = null
              }
              if (id?.startsWith('temp-') && !userRef.current) {
                flushGuestDraft(id)
              } else if (hadPendingSave && id) {
                void doSave(id, activeDraftRef.current.title, activeDraftRef.current.body, startedAtRef.current)
              }
              setMobileView('list')
            }}>
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                <path d="M11 3.5L6 8.5l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Notes
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className={`save-status ${saveStatus}`} style={{ fontSize: 10 }}>
                {saveStatus === 'saved' ? '● saved' : '○ saving…'}
              </span>
              {activeId && (
                <button className="mobile-btn" onClick={e => { handleDelete(activeId, e); setMobileView('list') }}>
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                    <path d="M3 5h11M6.5 5V4h4v1M7 8v5M10 8v5M3.5 5l1 9h7l1-9"
                      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div
        className="offline-status"
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          right: 12,
          bottom: 12,
          zIndex: 9999,
          padding: '7px 11px',
          borderRadius: 999,
          background: isOnline ? 'var(--paper-deep)' : 'var(--accent)',
          color: isOnline ? 'var(--ink)' : '#fff',
          border: '1px solid var(--line)',
          boxShadow: 'var(--shadow)',
          fontSize: 11,
          pointerEvents: 'none',
        }}
      >
        {isOnline ? 'Online · sync enabled' : 'Offline · saved on this device'}
      </div>
      <div className="app">
        <div className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <div className="brand"><span className="brand-mark" aria-hidden="true">✳</span>Notely<span className="brand-dot">.</span><DeploymentRefresh /></div>
            <div className="brand-sub">just write — nothing else</div>
            <button className="new-btn" onClick={newNote}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              New note
            </button>
          </div>
          <div className="studio-nav" aria-label="Explore Notely">
            <a className="studio-nav-link" href="/flow">
              <span className="studio-nav-icon memory" aria-hidden="true">✳</span><span><strong>Notely Flow</strong><small>Capture, focus and clear your mind</small></span><span className="studio-nav-arrow">↗</span>
            </a>
            <button aria-label="Time Machine" className={`studio-nav-link ${showTimeMachine ? "active" : ""}`} onClick={() => setShowTimeMachine(value => !value)} aria-pressed={showTimeMachine}>
              <span className="studio-nav-icon" aria-hidden="true">◷</span><span><strong>Time Machine</strong><small>Explore your notes over time</small></span><span className="studio-nav-arrow">↗</span>
            </button>
            <a className="studio-nav-link" href="/memory">
              <span className="studio-nav-icon memory" aria-hidden="true">✧</span><span><strong>Memory Studio</strong><small>Connect ideas and find thoughts</small></span><span className="studio-nav-arrow">↗</span>
            </a>
            <a className="studio-nav-link" href="/themes"><span className="studio-nav-icon" aria-hidden="true">◐</span><span><strong>Themes</strong><small>Choose your writing atmosphere</small></span><span className="studio-nav-arrow">↗</span></a>
          </div>
          <div className="search-wrap">
            <input
              className="search-input"
              placeholder="Search notes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="notes-count">
            {filteredNotes.length > 0 ? `${filteredNotes.length} note${filteredNotes.length !== 1 ? 's' : ''}` : ''}
          </div>
          <NotesList notes={filteredNotes} activeId={activeId} onOpen={handleOpen} onDelete={handleDelete} className="notes-list" />
          <div className="sidebar-footer">
            <div className="user-badge">
              {user ? <span className="user-email">{user.email?.split('@')[0]}</span> : 'guest mode'}
            </div>
            {user
              ? <><a className="auth-btn" href="/account">account & privacy</a><button className="auth-btn" onClick={signOut}>sign out</button></>
              : <button className="auth-btn" onClick={() => setShowModal(true)}>sign in</button>
            }
            <nav aria-label="Legal" style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '10px 0 2px', fontSize: 10 }}><a href="/privacy">privacy</a><a href="/terms">terms</a></nav>
          </div>
        </aside>

        <main className="editor-area">
          {showTimeMachine ? <TimeMachine notes={notes} onOpen={handleOpen} onBack={() => setShowTimeMachine(false)} /> : (
            <>
          {mobileView === 'list' && (
            <>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', background: 'var(--paper)', flexShrink: 0 }}>
                <input
                  className="search-input"
                  placeholder="Search notes…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="mobile-studio-nav" aria-label="Explore Notely">
                <a className="studio-nav-link" href="/flow">
                  <span className="studio-nav-icon memory" aria-hidden="true">✳</span><span><strong>Notely Flow</strong><small>Capture and focus</small></span>
                </a>
                <button aria-label="Time Machine" className={`studio-nav-link ${showTimeMachine ? "active" : ""}`} onClick={() => setShowTimeMachine(value => !value)} aria-pressed={showTimeMachine}>
                  <span className="studio-nav-icon" aria-hidden="true">◷</span><span><strong>Time Machine</strong><small>Browse your timeline</small></span>
                </button>
                <a className="studio-nav-link" href="/memory">
                  <span className="studio-nav-icon memory" aria-hidden="true">✧</span><span><strong>Memory Studio</strong><small>Explore connected thoughts</small></span>
                </a>
                <a className="studio-nav-link" href="/themes"><span className="studio-nav-icon" aria-hidden="true">◐</span><span><strong>Themes</strong><small>Choose your theme</small></span></a>
              </div>
              <NotesList notes={filteredNotes} activeId={activeId} onOpen={handleOpen} onDelete={handleDelete} className="mobile-notes-panel" />
            </>
          )}
          {mobileView === 'editor' && (
            <div className="mobile-editor">
              <Editor {...editorProps} bodyRef={mobileBodyRef} titleRef={mobileTitleRef} />
            </div>
          )}
          <div className="desktop-editor">
            <Editor {...editorProps} bodyRef={bodyRef} titleRef={titleRef} />
          </div>
            </>
          )}
        </main>
      </div>

      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            <div className="modal-title">Welcome back.</div>
            <div className="modal-sub">Your notes, wherever you are.</div>
            <div className="modal-tabs">
              <button className={`modal-tab ${authMode === 'signin' ? 'active' : ''}`}
                onClick={() => { setAuthMode('signin'); setAuthError(''); setTermsAccepted(false) }}>Sign in</button>
              <button className={`modal-tab ${authMode === 'signup' ? 'active' : ''}`}
                onClick={() => { setAuthMode('signup'); setAuthError(''); setTermsAccepted(false) }}>Sign up</button>
            </div>
            <div className="field">
              <label>EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" autoComplete="email" />
            </div>
            <div className="field">
              <label>PASSWORD</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                onKeyDown={e => e.key === 'Enter' && handleAuth()} />
            </div>
            {authMode === 'signup' && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, margin: '14px 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.5, textAlign: 'left' }}>
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={event => setTermsAccepted(event.target.checked)}
                  style={{ marginTop: 2, flex: '0 0 auto' }}
                />
                <span>I agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a> and acknowledge the <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</span>
              </label>
            )}
            {authError && <div className="auth-error" role="alert">{authError}</div>}
            <button className="modal-submit" onClick={handleAuth} disabled={authLoading || (authMode === 'signup' && !termsAccepted)}>
              {authLoading ? 'Loading…' : authMode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
            <div className="modal-divider">or continue without an account</div>
            <button className="modal-guest" onClick={() => setShowModal(false)}>
              Continue as guest — saves in this browser
            </button>
          </div>
        </div>
      )}
    </>
  )
}
