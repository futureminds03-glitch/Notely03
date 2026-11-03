export interface OfflineNoteState<TNote> {
  notes: TNote[]
  pendingDeletes: string[]
}

const DB_NAME = 'notely-offline'
const STORE_NAME = 'states'
const DB_VERSION = 1
const writeQueues = new Map<string, Promise<void>>()

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open offline note storage'))
  })
}

function legacyKey(ownerKey: string) {
  return ownerKey === 'guest' ? 'notely_notes' : `notely_notes_${ownerKey}`
}

export async function readOfflineState<TNote>(ownerKey: string): Promise<OfflineNoteState<TNote>> {
  try {
    if (typeof indexedDB !== 'undefined') {
      const database = await openDatabase()
      const record = await new Promise<OfflineNoteState<TNote> | null>((resolve, reject) => {
        const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(ownerKey)
        request.onsuccess = () => resolve(request.result?.value ?? null)
        request.onerror = () => reject(request.error)
      })
      database.close()
      if (record) {
        if (ownerKey !== 'guest') return record
        const legacyRaw = localStorage.getItem(legacyKey(ownerKey))
        const legacyNotes = legacyRaw ? JSON.parse(legacyRaw) as TNote[] : []
        const merged = new Map<string, TNote>()
        for (const note of record.notes) {
          const id = (note as { id?: string }).id
          if (id) merged.set(id, note)
        }
        for (const note of legacyNotes) {
          const id = (note as { id?: string }).id
          if (!id) continue
          const existing = merged.get(id) as (TNote & { updated_at?: string }) | undefined
          const incoming = note as TNote & { updated_at?: string }
          if (!existing || Date.parse(incoming.updated_at ?? '') >= Date.parse(existing.updated_at ?? '')) merged.set(id, note)
        }
        return { notes: [...merged.values()], pendingDeletes: record.pendingDeletes }
      }
    }
  } catch (error) {
    console.warn('IndexedDB read failed; using local fallback:', error)
  }

  try {
    const raw = localStorage.getItem(legacyKey(ownerKey))
    return { notes: raw ? JSON.parse(raw) as TNote[] : [], pendingDeletes: [] }
  } catch {
    return { notes: [], pendingDeletes: [] }
  }
}

export async function writeOfflineState<TNote>(
  ownerKey: string,
  value: OfflineNoteState<TNote>
): Promise<void> {
  const previous = writeQueues.get(ownerKey) ?? Promise.resolve()
  const queued = previous.catch(() => undefined).then(async () => {
    let indexedDbError: unknown
    try {
      if (typeof indexedDB !== 'undefined') {
        const database = await openDatabase()
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(STORE_NAME, 'readwrite')
          transaction.objectStore(STORE_NAME).put({ key: ownerKey, value })
          transaction.oncomplete = () => resolve()
          transaction.onerror = () => reject(transaction.error)
          transaction.onabort = () => reject(transaction.error ?? new Error('Offline save was aborted'))
        })
        database.close()
        if (ownerKey === 'guest') localStorage.setItem(legacyKey(ownerKey), JSON.stringify(value.notes))
        return
      }
    } catch (error) {
      indexedDbError = error
    }

    try {
      localStorage.setItem(legacyKey(ownerKey), JSON.stringify(value.notes))
    } catch (error) {
      console.error('Unable to persist notes locally:', indexedDbError ?? error)
      throw new Error('Notely could not save this note on this device. Free up browser storage and try again.')
    }
  })
  writeQueues.set(ownerKey, queued)
  try {
    await queued
  } finally {
    if (writeQueues.get(ownerKey) === queued) writeQueues.delete(ownerKey)
  }
}
