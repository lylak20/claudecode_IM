import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { messages, memoText, companyName } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
    }

    const client = new Anthropic({ apiKey })

    const systemPrompt = `You are an analytical AI assistant helping to refine and explore an investment memo for ${companyName || 'a company'}.

The current investment memo is provided below for context:
---
${(memoText || '').slice(0, 12000)}
---

Your role:
- Answer questions about the memo content with precision
- Suggest specific improvements to sections when asked
- Provide additional analysis, market context, or competitive insight
- Help refine language and sharpen arguments
- If asked to rewrite a section, provide the improved text directly in markdown
- Be concise and analytically rigorous — no filler`

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    })

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              controller.enqueue(new TextEncoder().encode(chunk.delta.text))
            }
          }
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    return Response.json({ error: 'Chat request failed' }, { status: 500 })
  }
}
