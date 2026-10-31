import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    let payload: unknown
    try { payload = await request.json() } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }
    const text = typeof payload === 'object' && payload !== null ? (payload as { text?: unknown }).text : null
    const aiConsent = typeof payload === 'object' && payload !== null ? (payload as { aiConsent?: unknown }).aiConsent : false
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Add a thought before asking Notely to organize it.' }, { status: 400 })
    }
    if (text.length > 12000) {
      return NextResponse.json({ error: 'This thought is too long to organize at once. Try a smaller section.' }, { status: 413 })
    }
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'AI organization is not enabled yet. Your original thought is safe.' }, { status: 503 })
    }
    if (aiConsent !== true) {
      return NextResponse.json({ error: 'Confirm that this thought may be sent to Groq for AI processing.' }, { status: 428 })
    }
      return NextResponse.json({ error: 'Confirm that this thought may be sent to Groq for AI processing.' }, { status: 428 })
    }
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.GROQ_API_KEY },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0.25,
        max_tokens: 900,
        messages: [
          { role: 'system', content: 'You are a calm, practical thinking assistant. Organize messy notes without judging the writer or inventing facts. Preserve uncertainty. Do not turn every sentence into a task. Return concise Markdown with these sections only when relevant: What this is about; Key points; Possible next steps; Open questions. Keep it easy to scan and under 350 words. Never claim you saved, scheduled, or completed anything.' },
          { role: 'user', content: 'Please organize this brain dump. Keep the meaning and important details:\n\n' + text },
        ],
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error('AI organization provider returned status:', response.status)
      return NextResponse.json({ error: 'AI organization is temporarily unavailable. Your original thought is safe.' }, { status: 502 })
    }
    const organized = data.choices?.[0]?.message?.content
    if (typeof organized !== 'string' || !organized.trim()) {
      return NextResponse.json({ error: 'The organizer returned an empty result. Your original thought is safe.' }, { status: 502 })
    }
    return NextResponse.json({ organized: organized.trim() })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    return NextResponse.json({ error: timedOut ? 'AI organization took too long. Your original thought is safe; try again.' : 'Could not reach AI organization. Your original thought is safe; try again.' }, { status: 502 })
  }
}
