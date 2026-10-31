export const MAX_JSON_BODY_BYTES = 1024 * 1024
export const MAX_NOTE_TITLE_CHARS = 300
export const MAX_NOTE_BODY_CHARS = 500_000
export const MAX_NOTE_TAG_CHARS = 80

type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413; error: string }

export async function readJsonBody(request: Request): Promise<JsonBodyResult> {
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const declaredLength = Number(contentLength)
    if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
      return { ok: false, status: 413, error: 'Request body is too large' }
    }
  }

  if (!request.body) {
    return { ok: false, status: 400, error: 'Invalid JSON' }
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_JSON_BODY_BYTES) {
        await reader.cancel()
        return { ok: false, status: 413, error: 'Request body is too large' }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON' }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) as unknown }
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON' }
  }
}

export function exceedsNoteFieldLimits(value: {
  title?: string
  body?: string
  tags?: string[]
}): boolean {
  return (
    (value.title !== undefined && value.title.length > MAX_NOTE_TITLE_CHARS) ||
    (value.body !== undefined && value.body.length > MAX_NOTE_BODY_CHARS) ||
    (value.tags !== undefined && value.tags.some(tag => tag.length > MAX_NOTE_TAG_CHARS))
  )
}
