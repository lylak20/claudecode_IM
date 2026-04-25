import Anthropic from '@anthropic-ai/sdk'
import { buildMemoPrompt } from '@/lib/promptBuilder'
import type { MemoConfig } from '@/lib/types'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const config: MemoConfig = await request.json()

    if (!config.url || !config.sections?.length) {
      return Response.json(
        { error: 'URL and sections are required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return Response.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const client = new Anthropic({ apiKey })
    const prompt = buildMemoPrompt(config)

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    })

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              controller.enqueue(
                new TextEncoder().encode(chunk.delta.text)
              )
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
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    return Response.json(
      { error: 'Failed to generate memo' },
      { status: 500 }
    )
  }
}
