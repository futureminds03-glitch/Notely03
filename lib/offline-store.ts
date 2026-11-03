export interface OfflineNoteState<TNote> {
  notes: TNote[]
  pendingDeletes: string[]
}

const DB_NAME = 'notely-offline'
const STORE_NAME = 'states'
const DB_VERSION = 1

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
      if (record) return record
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
}
