import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_URL_LENGTH = 2048
const MAX_RESPONSE_BYTES = 1_000_000
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 8_000

function isPublicIPv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b, c] = parts
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2))) return false
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false
  if (a === 203 && b === 0 && c === 113) return false
  return true
}

function isPublicIPv6(address: string): boolean {
  const ip = address.toLowerCase().split('%')[0]
  if (ip === '::' || ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd')) return false
  if (/^fe[89ab]/.test(ip) || ip.startsWith('ff') || ip.startsWith('::ffff:')) return false
  if (ip.startsWith('2001:db8:') || ip.startsWith('2001:10:')) return false
  return true
}

async function validateTarget(input: string): Promise<URL> {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_URL_LENGTH) {
    throw new Error('BLOCKED_TARGET')
  }

  let target: URL
  try {
    target = new URL(input)
  } catch {
    throw new Error('BLOCKED_TARGET')
  }

  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
    throw new Error('BLOCKED_TARGET')
  }
  if (target.port && target.port !== '80' && target.port !== '443') {
    throw new Error('BLOCKED_TARGET')
  }

  const hostname = target.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') || hostname.endsWith('.internal') ||
      hostname.endsWith('.test') || hostname === 'metadata.google.internal') {
    throw new Error('BLOCKED_TARGET')
  }

  const ipVersion = isIP(hostname)
  if (ipVersion === 4) {
    if (!isPublicIPv4(hostname)) throw new Error('BLOCKED_TARGET')
  } else if (ipVersion === 6) {
    if (!isPublicIPv6(hostname)) throw new Error('BLOCKED_TARGET')
  } else {
    let addresses: { address: string; family: number }[]
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true })
    } catch {
      throw new Error('DNS_FAILED')
    }
    if (!addresses.length || addresses.some(({ address, family }) =>
      family === 4 ? !isPublicIPv4(address) : !isPublicIPv6(address)
    )) {
      throw new Error('BLOCKED_TARGET')
    }
  }

  target.hash = ''
  return target
}

export async function safeFetchHtml(input: string): Promise<{ url: string; html: string; status: number }> {
  let target = await validateTarget(input)

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(target, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'NotelyLinkPreview/1.0 (+https://notely03.vercel.app)',
          'Accept': 'text/html,application/xhtml+xml;q=0.9',
        },
      })
    } catch (error) {
      if (controller.signal.aborted) throw new Error('UPSTREAM_TIMEOUT')
      throw new Error('UPSTREAM_FAILED')
    } finally {
      clearTimeout(timeout)
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location || redirectCount === MAX_REDIRECTS) throw new Error('TOO_MANY_REDIRECTS')
      target = await validateTarget(new URL(location, target).toString())
      continue
    }

    if (!response.ok) {
      await response.body?.cancel()
      throw new Error('UPSTREAM_FAILED')
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      await response.body?.cancel()
      throw new Error('UNSUPPORTED_CONTENT_TYPE')
    }

    if (!response.body) return { url: target.toString(), html: '', status: response.status }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let size = 0
    let html = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > MAX_RESPONSE_BYTES) {
          await reader.cancel()
          throw new Error('RESPONSE_TOO_LARGE')
        }
        html += decoder.decode(value, { stream: true })
      }
      html += decoder.decode()
    } finally {
      reader.releaseLock()
    }
    return { url: target.toString(), html, status: response.status }
  }

  throw new Error('TOO_MANY_REDIRECTS')
}
