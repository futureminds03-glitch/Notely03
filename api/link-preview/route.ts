import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { safeFetchHtml } from '@/lib/safe-url-fetch'

// Legacy API route retained for compatibility; it uses the same SSRF protections
// as the App Router endpoint so no alternate path bypasses target validation.
export async function POST(req: NextRequest) {
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const url = typeof payload === 'object' && payload !== null && 'url' in payload
    ? (payload as { url?: unknown }).url
    : null
  if (typeof url !== 'string' || !url.trim()) {
    return NextResponse.json({ error: 'A valid URL is required' }, { status: 400 })
  }

  try {
    const { url: finalUrl, html } = await safeFetchHtml(url.trim())
    const getMeta = (name: string) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const first = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'))
      const second = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i'))
      return first?.[1] ?? second?.[1] ?? null
    }
    const title = getMeta('og:title') || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]*>/g, '').trim() || 'Link Preview'
    return NextResponse.json({
      title: title.slice(0, 300),
      description: (getMeta('og:description') || getMeta('description') || '').slice(0, 2000),
      image: (getMeta('og:image') || '').slice(0, 2048),
      domain: new URL(finalUrl).hostname.replace(/^www\./i, ''),
      url: finalUrl,
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UPSTREAM_FAILED'
    if (code === 'BLOCKED_TARGET' || code === 'DNS_FAILED') {
      return NextResponse.json({ error: 'URL is not allowed' }, { status: 400 })
    }
    if (code === 'UPSTREAM_TIMEOUT') return NextResponse.json({ error: 'The website timed out' }, { status: 504 })
    if (code === 'RESPONSE_TOO_LARGE') return NextResponse.json({ error: 'Response too large' }, { status: 413 })
    if (code === 'UNSUPPORTED_CONTENT_TYPE') return NextResponse.json({ error: 'HTML page required' }, { status: 415 })
    return NextResponse.json({ error: 'Could not fetch a preview' }, { status: 502 })
  }
}
