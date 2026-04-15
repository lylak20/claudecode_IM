import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = (fileContent: string) => `You are a data visualization assistant. Your job is to read uploaded business/financial data and generate Chart.js v4 configuration objects based on the user's natural language request.

${fileContent ? `UPLOADED DATA:\n${fileContent.slice(0, 15000)}` : 'No file data was uploaded. If asked to chart something, explain that no data file is available and suggest uploading a Supporting Document on the configure page.'}

RULES:
1. ONLY use data that actually exists in the uploaded file. Never invent numbers.
2. If the requested data is not in the file, set chartConfig to null and explain clearly.
3. When the user asks to MODIFY an existing chart (e.g. "change the title", "make bars blue"), update only the requested property.
4. Use professional colors from this palette:
   - Blue: #3B82F6  Light blue: rgba(59,130,246,0.15)
   - Green: #10B981  Light green: rgba(16,185,129,0.15)
   - Purple: #8B5CF6  Light purple: rgba(139,92,246,0.15)
   - Amber: #F59E0B  Light amber: rgba(245,158,11,0.15)
   - Rose: #F43F5E  Light rose: rgba(244,63,94,0.15)
   - Stone: #78716C  Light stone: rgba(120,113,108,0.15)
5. Default chart options to include:
   - responsive: true
   - maintainAspectRatio: false
   - plugins.title: { display: true, text: "...", font: { size: 14, weight: "bold" } }
   - plugins.legend: { display: true, position: "top" }
6. For line charts: use tension: 0.3, fill with light background color
7. For bar charts: use borderRadius: 4
8. Format large numbers sensibly (e.g. "$1.2M" not "1200000")

RESPONSE FORMAT — always return exactly this JSON structure (no markdown, no code fences, just raw JSON):
{
  "message": "One sentence describing what the chart shows",
  "chartConfig": {
    "type": "line|bar|pie|doughnut|scatter",
    "data": {
      "labels": [...],
      "datasets": [{ "label": "...", "data": [...], "backgroundColor": "...", "borderColor": "...", ... }]
    },
    "options": { ... }
  }
}

If no relevant data: { "message": "Explanation of why chart cannot be generated", "chartConfig": null }`

export async function POST(request: NextRequest) {
  try {
    const { messages, fileContent } = await request.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT(fileContent || ''),
      messages,
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    // Strip any accidental markdown code fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

    try {
      const parsed = JSON.parse(cleaned)
      return Response.json(parsed)
    } catch {
      return Response.json({ message: raw, chartConfig: null })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Data assistant request failed'
    return Response.json({ error: msg }, { status: 500 })
  }
}
