export interface NoteImageStorageObject {
  name: string
  id: string | null
  created_at: string | null
}

export function findStaleNoteImagePaths(
  objects: NoteImageStorageObject[],
  folder: string,
  referencedPaths: ReadonlySet<string>,
  now = Date.now(),
  retentionMs = 24 * 60 * 60 * 1000
): string[] {
  const stale: string[] = []
  for (const object of objects) {
    if (!object.id || !object.created_at) continue
    const createdAt = Date.parse(object.created_at)
    if (!Number.isFinite(createdAt) || now - createdAt < retentionMs) continue
    const path = folder + '/' + object.name
    if (!referencedPaths.has(path)) stale.push(path)
  }
  return stale
}
