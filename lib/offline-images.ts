export interface OfflineImage {
  id: string
  noteId: string
  blob: Blob
  createdAt: number
}

const DB_NAME = 'notely-local'
const IMAGE_STORE = 'imageBlobs'

function openImageDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is unavailable'))
    const request = indexedDB.open(DB_NAME, 4)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('workspace')) { const store = db.createObjectStore('workspace', { keyPath: 'key' }); store.createIndex('ownerId', 'ownerId', { unique: false }) }
      if (!db.objectStoreNames.contains('tagUpdates')) { const store = db.createObjectStore('tagUpdates', { keyPath: 'key' }); store.createIndex('ownerId', 'ownerId', { unique: false }) }
      if (!db.objectStoreNames.contains('notes')) { const store = db.createObjectStore('notes', { keyPath: 'key' }); store.createIndex('ownerId', 'ownerId', { unique: false }) }
      if (!db.objectStoreNames.contains(IMAGE_STORE)) db.createObjectStore(IMAGE_STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open local image storage'))
  })
}

export async function saveOfflineImage(noteId: string, blob: Blob): Promise<string> {
  const db = await openImageDatabase()
  const id = crypto.randomUUID()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(IMAGE_STORE, 'readwrite')
    transaction.objectStore(IMAGE_STORE).put({ id, noteId, blob, createdAt: Date.now() } satisfies OfflineImage)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save pasted image'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not save pasted image'))
  })
  db.close()
  return id
}

export async function getOfflineImage(id: string): Promise<OfflineImage | null> {
  const db = await openImageDatabase()
  const result = await new Promise<OfflineImage | undefined>((resolve, reject) => {
    const request = db.transaction(IMAGE_STORE, 'readonly').objectStore(IMAGE_STORE).get(id)
    request.onsuccess = () => resolve(request.result as OfflineImage | undefined)
    request.onerror = () => reject(request.error ?? new Error('Could not read pasted image'))
  })
  db.close()
  return result ?? null
}

export async function removeOfflineImage(id: string): Promise<void> {
  const db = await openImageDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(IMAGE_STORE, 'readwrite')
    transaction.objectStore(IMAGE_STORE).delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not remove local image'))
  })
  db.close()
}
