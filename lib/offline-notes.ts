export interface OfflineNote {
  id: string
  title: string
  body: string
  created_at: string
  updated_at: string
  started_at?: string
  tags?: string[]
  history?: { content: string; timestamp: number }[]
  user_id?: string
  synced?: boolean
  pendingCreate?: boolean
}

interface StoredNote {
  key: string
  ownerId: string
  note: OfflineNote
  pendingCreate: boolean
  pendingUpdate: boolean
  pendingDelete: boolean
}

const DB_NAME = 'notely-local'
const DB_VERSION = 1
const STORE_NAME = 'notes'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        store.createIndex('ownerId', 'ownerId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open local notes'))
  })
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const request = action(transaction.objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Local notes operation failed'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => {
      db.close()
      reject(transaction.error ?? new Error('Local notes transaction failed'))
    }
  })
}

function storageKey(ownerId: string, noteId: string) {
  return ownerId + ':' + noteId
}

export async function getOfflineNotes(ownerId: string): Promise<OfflineNote[]> {
  const records = await withStore<StoredNote[]>('readonly', store =>
    store.index('ownerId').getAll(ownerId)
  )
  return records
    .filter(record => !record.pendingDelete)
    .map(record => record.note)
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
}

export async function getPendingOfflineNotes(ownerId: string): Promise<StoredNote[]> {
  const records = await withStore<StoredNote[]>('readonly', store =>
    store.index('ownerId').getAll(ownerId)
  )
  return records.filter(record => record.pendingCreate || record.pendingUpdate || record.pendingDelete)
}

export async function saveOfflineNote(
  ownerId: string,
  note: OfflineNote,
  options: { pendingCreate?: boolean } = {}
): Promise<void> {
  const key = storageKey(ownerId, note.id)
  const existing = await withStore<StoredNote | undefined>('readonly', store => store.get(key))
  const pendingCreate = options.pendingCreate ?? existing?.pendingCreate ?? false
  const record: StoredNote = {
    key,
    ownerId,
    note: { ...note, synced: false, pendingCreate },
    pendingCreate,
    pendingUpdate: !pendingCreate,
    pendingDelete: false,
  }
  await withStore<IDBValidKey>('readwrite', store => store.put(record))
}

export async function cacheSyncedOfflineNote(ownerId: string, note: OfflineNote): Promise<void> {
  const key = storageKey(ownerId, note.id)
  const existing = await withStore<StoredNote | undefined>('readonly', store => store.get(key))
  if (existing?.pendingCreate || existing?.pendingUpdate || existing?.pendingDelete) return
  await withStore<IDBValidKey>('readwrite', store => store.put({
    key,
    ownerId,
    note: { ...note, synced: true, pendingCreate: false },
    pendingCreate: false,
    pendingUpdate: false,
    pendingDelete: false,
  } satisfies StoredNote))
}

export async function markOfflineNoteSynced(ownerId: string, note: OfflineNote): Promise<void> {
  const key = storageKey(ownerId, note.id)
  const existing = await withStore<StoredNote | undefined>('readonly', store => store.get(key))
  const latest = existing?.note
  const changedDuringSync = Boolean(latest && (
    latest.title !== note.title ||
    latest.body !== note.body ||
    latest.updated_at !== note.updated_at ||
    JSON.stringify(latest.tags ?? []) !== JSON.stringify(note.tags ?? [])
  ))
  const nextNote = changedDuringSync
    ? { ...latest!, synced: false, pendingCreate: false }
    : { ...note, synced: true, pendingCreate: false }
  await withStore<IDBValidKey>('readwrite', store => store.put({
    key,
    ownerId,
    note: nextNote,
    pendingCreate: false,
    pendingUpdate: changedDuringSync,
    pendingDelete: existing?.pendingDelete ?? false,
  } satisfies StoredNote))
}

export async function markOfflineNoteDeleted(ownerId: string, noteId: string): Promise<void> {
  const key = storageKey(ownerId, noteId)
  const existing = await withStore<StoredNote | undefined>('readonly', store => store.get(key))
  if (!existing) return
  // Keep a tombstone even for an in-flight create. Once the create settles,
  // the sync loop will observe this flag and issue the delete afterward.
  await withStore<IDBValidKey>('readwrite', store => store.put({
    ...existing,
    pendingUpdate: false,
    pendingDelete: true,
  }))
}

export async function removeOfflineNote(ownerId: string, noteId: string): Promise<void> {
  await withStore<undefined>('readwrite', store => store.delete(storageKey(ownerId, noteId)))
}
