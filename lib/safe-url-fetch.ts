import { lookup } from 'node:dns/promises'
import type { LookupFunction, LookupAddress } from 'node:dns'
import { isIP } from 'node:net'
import { request as httpRequest, type IncomingHttpHeaders, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'

const MAX_URL_LENGTH = 2048
const MAX_RESPONSE_BYTES = 1_000_000
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 8_000

type ValidatedTarget = { url: URL; addresses: LookupAddress[] }
type PinnedResponse = { status: number; headers: IncomingHttpHeaders; body: string }

function isPublicIPv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b, c] = parts
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) return false
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false
  if (a === 203 && b === 0 && c === 113) return false
  return true
}

function isPublicIPv6(address: string): boolean {
  const ip = address.toLowerCase().split('%')[0]
  if (ip.startsWith('::') || ip.startsWith('fc') || ip.startsWith('fd')) return false
  if (/^fe[89ab]/.test(ip) || ip.startsWith('fec') || ip.startsWith('ff')) return false
  if (ip.startsWith('2001:db8:') || ip.startsWith('2001:10:') || ip.startsWith('2001:2:') ||
      ip.startsWith('2001:20:') || ip.startsWith('2002:') || ip.startsWith('64:ff9b:')) return false
  return true
}

async function validateTarget(input: string): Promise<ValidatedTarget> {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_URL_LENGTH) {
    throw new Error('BLOCKED_TARGET')
  }

  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error('BLOCKED_TARGET')
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('BLOCKED_TARGET')
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new Error('BLOCKED_TARGET')
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') || hostname.endsWith('.internal') ||
      hostname.endsWith('.test') || hostname === 'metadata.google.internal') {
    throw new Error('BLOCKED_TARGET')
  }

  const ipVersion = isIP(hostname)
  let addresses: LookupAddress[]
  if (ipVersion === 4) {
    if (!isPublicIPv4(hostname)) throw new Error('BLOCKED_TARGET')
    addresses = [{ address: hostname, family: 4 }]
  } else if (ipVersion === 6) {
    if (!isPublicIPv6(hostname)) throw new Error('BLOCKED_TARGET')
    addresses = [{ address: hostname, family: 6 }]
  } else {
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
    // Prefer IPv4 where both families are available; every candidate is still validated and pinned.
    addresses.sort((a, b) => a.family - b.family)
  }

  url.hash = ''
  return { url, addresses }
}

function requestPinned(target: ValidatedTarget): Promise<PinnedResponse> {
  return new Promise((resolve, reject) => {
    let settled = false
    let timedOut = false
    let size = 0
    const chunks: Buffer[] = []

    const finishError = (error: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(timedOut ? new Error('UPSTREAM_TIMEOUT') : error)
    }

    const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
      if (typeof options === 'object' && options.all) {
        ;(callback as (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void)(
          null, target.addresses
        )
      } else {
        const first = target.addresses[0]
        ;(callback as (error: NodeJS.ErrnoException | null, address: string, family: number) => void)(
          null, first.address, first.family
        )
      }
    }

    const options = {
      method: 'GET',
      headers: {
        'User-Agent': 'NotelyLinkPreview/1.0 (+https://notely03.vercel.app)',
        'Accept': 'text/html,application/xhtml+xml;q=0.9',
      },
      lookup: pinnedLookup,
    }

    const onResponse = (response: IncomingMessage) => {
      const contentLength = Number(response.headers['content-length'] || 0)
      if (contentLength > MAX_RESPONSE_BYTES) {
        response.destroy()
        finishError(new Error('RESPONSE_TOO_LARGE'))
        return
      }

      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        size += buffer.byteLength
        if (size > MAX_RESPONSE_BYTES) {
          response.destroy()
          finishError(new Error('RESPONSE_TOO_LARGE'))
          return
        }
        chunks.push(buffer)
      })
      response.on('error', finishError)
      response.on('end', () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        resolve({
          status: response.statusCode ?? 502,
          headers: response.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      })
    }

    const request = target.url.protocol === 'https:'
      ? httpsRequest(target.url, { ...options, servername: target.url.hostname }, onResponse)
      : httpRequest(target.url, options, onResponse)

    const timeout = setTimeout(() => {
      timedOut = true
      request.destroy(new Error('UPSTREAM_TIMEOUT'))
    }, TIMEOUT_MS)

    request.on('error', finishError)
    request.end()
  })
}

export async function safeFetchHtml(input: string): Promise<{ url: string; html: string; status: number }> {
  let target = await validateTarget(input)

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const response = await requestPinned(target)

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.location
      if (!location || redirectCount === MAX_REDIRECTS) throw new Error('TOO_MANY_REDIRECTS')
      target = await validateTarget(new URL(location, target.url).toString())
      continue
    }

    if (response.status < 200 || response.status >= 300) throw new Error('UPSTREAM_FAILED')

    const contentType = String(response.headers['content-type'] ?? '').toLowerCase()
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error('UNSUPPORTED_CONTENT_TYPE')
    }

    return { url: target.url.toString(), html: response.body, status: response.status }
  }

  throw new Error('TOO_MANY_REDIRECTS')
}
