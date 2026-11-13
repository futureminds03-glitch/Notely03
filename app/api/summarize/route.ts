import { NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/request-body'

export const runtime = 'nodejs'

const MAX_SUMMARY_CHARS = 4000

export async function POST(request: Request) {
  const bodyResult = await readJsonBody(request)
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status })
  }

  const payload = bodyResult.value
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { title, body, aiConsent } = payload as {
    title?: unknown
    body?: unknown
    aiConsent?: unknown
  }

  if (typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: 'No content' }, { status: 400 })
  }
  if (body.length > MAX_SUMMARY_CHARS) {
    return NextResponse.json({ error: 'This note is too long to summarize at once.' }, { status: 413 })
  }
  if (title !== undefined && typeof title !== 'string') {
    return NextResponse.json({ error: 'Invalid note title.' }, { status: 400 })
  }
  if (typeof title === 'string' && title.length > 300) {
    return NextResponse.json({ error: 'The note title is too long.' }, { status: 413 })
  }
  if (aiConsent !== true) {
    return NextResponse.json({ error: 'Confirm that your note may be sent to Groq for AI processing.' }, { status: 428 })
  }
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'AI summaries are not enabled yet.' }, { status: 503 })
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{
          role: 'user',
          content: `Summarize this note in 2-3 clear sentences. Capture key points only. No preamble.\n\nTitle: ${typeof title === 'string' ? title : ''}\n\nContent:\n${body}`,
        }],
        max_tokens: 200,
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'AI summary is temporarily unavailable.' }, { status: 502 })
    }

    const data: unknown = await response.json().catch(() => null)
    if (typeof data !== 'object' || data === null) {
      return NextResponse.json({ error: 'AI summary returned an invalid response.' }, { status: 502 })
    }
    const choices = (data as { choices?: unknown }).choices
    const firstChoice = Array.isArray(choices) ? choices[0] : null
    const message = typeof firstChoice === 'object' && firstChoice !== null
      ? (firstChoice as { message?: { content?: unknown } }).message
      : null
    const summary = typeof message?.content === 'string' ? message.content.trim() : ''
    if (!summary) {
      return NextResponse.json({ error: 'AI summary returned an empty response.' }, { status: 502 })
    }

    return NextResponse.json({ summary })
  } catch {
    return NextResponse.json({ error: 'AI summary is temporarily unavailable.' }, { status: 502 })
  }
}
