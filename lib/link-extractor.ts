export type ExtractedLinkPage = {
  title: string
  description: string
  image: string
  author: string | null
  publishedAt: string | null
  modifiedAt: string | null
  publisher: string | null
  domain: string
  fullContent: string
}

function decodeCodePoint(value: number): string {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
    ? String.fromCodePoint(value)
    : '\uFFFD'
}

function decode(value: string): string {
  return value
    .replace(/&#x([\da-f]{1,6});?/gi, (_, n: string) => decodeCodePoint(parseInt(n, 16)))
    .replace(/&#(\d{1,7});?/g, (_, n: string) => decodeCodePoint(parseInt(n, 10)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function text(value: string): string {
  return decode(value.replace(/<[^>]*>/g, ' '))
    .replace(/[\u00a0\t\r ]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
  let match: RegExpExecArray | null
  while ((match = re.exec(tag))) {
    out[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return out
}

function meta(html: string, ...keys: string[]): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const values = attrs(tag)
    const key = (values.property || values.name || values.itemprop || '').toLowerCase()
    if (keys.some(candidate => candidate.toLowerCase() === key) && values.content?.trim()) return values.content.trim()
  }
  return null
}

function asText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object' && typeof (value as { name?: unknown }).name === 'string') {
    return (value as { name: string }).name.trim() || null
  }
  return null
}

function structuredData(html: string): Record<string, unknown>[] {
  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? []
  const objects: Record<string, unknown>[] = []
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== 'object') return
    const object = value as Record<string, unknown>
    objects.push(object)
    if (object['@graph']) visit(object['@graph'])
    if (object.mainEntity) visit(object.mainEntity)
  }
  for (const script of scripts) {
    const raw = script.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '').trim()
    try { visit(JSON.parse(raw)) } catch { /* malformed publisher markup is non-fatal */ }
  }
  return objects
}

export function extractLinkPage(html: string, finalUrl: string): ExtractedLinkPage {
  const title = meta(html, 'og:title', 'twitter:title') ||
    text(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '') || 'Saved webpage'
  const description = meta(html, 'og:description', 'description', 'twitter:description') || ''
  const data = structuredData(html)
  const article = data.find(object => /Article|NewsArticle|BlogPosting|Report/i.test(String(object['@type'] ?? ''))) ?? {}
  const author = meta(html, 'author', 'article:author', 'parsely-author') ||
    (Array.isArray(article.author) ? article.author.map(asText).filter(Boolean).join(', ') : asText(article.author))
  const publishedAt = meta(html, 'article:published_time', 'date', 'datepublished', 'parsely-pub-date') || asText(article.datePublished) || asText(article.dateCreated)
  const modifiedAt = meta(html, 'article:modified_time') || asText(article.dateModified)
  const publisher = meta(html, 'og:site_name', 'application-name') || asText(article.publisher)

  let main = html.match(/<(article|main)\b[^>]*>[\s\S]*?<\/\1>/i)?.[0] ?? html
  main = main
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|footer|header|aside|form|iframe|button)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(?:div|section)[^>]*(?:id|class)=["'][^"']*(?:cookie|consent|subscribe|advert|social|share|related|comment)[^"']*["'][^>]*>[\s\S]*?<\/(?:div|section)>/gi, ' ')
  const blocks = main.match(/<(?:h[1-6]|p|li|blockquote|pre)\b[^>]*>[\s\S]*?<\/(?:h[1-6]|p|li|blockquote|pre)>/gi) ?? []
  let fullContent = blocks.map(text).filter(value => value.length > 25).join('\n\n')
  if (fullContent.length < 300) fullContent = text(main)

  return {
    title: text(title).slice(0, 300),
    description: text(description).slice(0, 2000),
    image: (meta(html, 'og:image', 'twitter:image') || '').slice(0, 2048),
    author: author ? text(author).slice(0, 300) : null,
    publishedAt: publishedAt ? text(publishedAt).slice(0, 100) : null,
    modifiedAt: modifiedAt ? text(modifiedAt).slice(0, 100) : null,
    publisher: publisher ? text(publisher).slice(0, 200) : null,
    domain: new URL(finalUrl).hostname.replace(/^www\./i, ''),
    fullContent: fullContent.slice(0, 12000),
  }
}

export type ExtractedLinkAnalysis = {
  summary: string
  keyPoints: string[]
  concepts: string[]
  potentialTasks: string[]
}

export function buildExtractiveAnalysis(page: ExtractedLinkPage): ExtractedLinkAnalysis {
  const sentences = page.fullContent.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/)
    .map(value => value.trim()).filter(value => value.length >= 45)
  const keyPoints = sentences.slice(0, 5).map(value => value.slice(0, 280))
  const titleTerms = page.title.match(/\b[A-Z][A-Za-z0-9-]{2,}(?:\s+[A-Z][A-Za-z0-9-]{2,}){0,2}\b/g) ?? []
  const namedTerms = page.fullContent.match(/\b[A-Z][a-z]{3,}(?:\s+[A-Z][a-z]{3,})?\b/g) ?? []
  const concepts = [...new Set([...titleTerms, ...namedTerms])]
    .filter(value => !/^(The article|This article|In this|According to)$/i.test(value))
    .slice(0, 6)
  const potentialTasks = sentences
    .filter(value => /\b(consider|you should|you can|try|start by|make sure to|remember to|need to)\b/i.test(value))
    .slice(0, 4)
    .map(value => value.slice(0, 280))
  const summary = page.description || sentences.slice(0, 2).join(' ') ||
    ('A webpage from ' + page.domain + ' titled "' + page.title + '".')
  return { summary: summary.slice(0, 1200), keyPoints, concepts, potentialTasks }
}
