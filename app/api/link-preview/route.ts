import { NextRequest, NextResponse } from 'next/server'
import { safeFetchHtml } from '@/lib/safe-url-fetch'

function getMeta(html: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'))
    ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i'))
  return match ? (match[1] ?? null) : null
}

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
    const parsedUrl = new URL(finalUrl)
    const domain = parsedUrl.hostname.replace(/^www\./i, '')
    const title = getMeta(html, 'og:title') ||
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]*>/g, '').trim() ||
      'Webpage'
    const description = getMeta(html, 'og:description') || getMeta(html, 'description') || ''
    const image = getMeta(html, 'og:image') || ''
    const paragraphs = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || []
    const fullContent = paragraphs
      .map(paragraph => paragraph.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(paragraph => paragraph.length > 30)
      .join('\n\n')
      .slice(0, 8000)

    return NextResponse.json({
      title: title.slice(0, 300),
      description: description.slice(0, 2000),
      domain,
      url: finalUrl,
      fullContent,
      image: image.slice(0, 2048),
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UPSTREAM_FAILED'
    if (code === 'BLOCKED_TARGET' || code === 'DNS_FAILED') {
      return NextResponse.json({ error: 'URL is not allowed' }, { status: 400 })
    }
    if (code === 'UPSTREAM_TIMEOUT') {
      return NextResponse.json({ error: 'The website took too long to respond' }, { status: 504 })
    }
    if (code === 'RESPONSE_TOO_LARGE') {
      return NextResponse.json({ error: 'The website response is too large' }, { status: 413 })
    }
    if (code === 'UNSUPPORTED_CONTENT_TYPE') {
      return NextResponse.json({ error: 'The URL does not point to an HTML page' }, { status: 415 })
    }
    return NextResponse.json({ error: 'Could not fetch a preview for this URL' }, { status: 502 })
  }
}
