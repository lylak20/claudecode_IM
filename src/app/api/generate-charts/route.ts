import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Dedicated chart-generation endpoint.
 *
 * The main memo stream generates NARRATIVE ONLY. This endpoint generates
 * ONLY chart JSON — isolated from the narrative's token budget and attention
 * context, so the model can focus entirely on producing well-formed JSON for
 * the financial charts + peer benchmarking charts.
 *
 * Returns: { finCharts: ChartSpec[], peerCharts: ChartSpec[] }
 */

interface Body {
  companyName: string
  fileContent: string
  research?: string
}

const CHART_PROMPT = (companyName: string, fileContent: string, research: string) => `You are a financial charts generator. Your ONLY job is to output two JSON arrays of chart specifications for an investment memo on ${companyName}.

You will be given: (1) an uploaded financial document with company data, and (2) research text that may contain competitor funding / valuation data.

OUTPUT FORMAT — output EXACTLY this structure with no prose, no preamble, no markdown fences:

<fin-charts>
[ ...array of financial chart objects... ]
</fin-charts>

<peer-charts>
[ ...array of peer benchmarking chart objects... ]
</peer-charts>

═══════════════════════════════════════════════════════════════
FIN-CHARTS (financial metrics from uploaded file)
═══════════════════════════════════════════════════════════════

First, classify the business model: B2B (Enterprise/SMB SaaS) or B2C (Consumer/PLG).

Each chart object has this shape:
{
  "title": "Chart Title",
  "type": "bar" | "line" | "waterfall",
  "yFormat": "dollarmillions" | "thousands" | "dollar" | "percent" | "number" | "multiple",
  "labels": ["Jan-25", "Feb-25", ...],
  "datasets": [{ "label": "Series", "data": [1.2, 1.8, ...] }],
  "stacked": true (optional, for stacked bars),
  "chartType": "line" (optional, on a dataset for combo charts)
}

Rules:
- Include a chart if you can produce its data — by reading directly from the file OR by deriving it using the formulas below. Both valid.
- DO derive: if inputs are in the file, CALCULATE the metric (LTV, CAC, NDR, Burn Multiple, FCF Margin, Gross Margin, Rule of 40, CAC Payback, etc.).
- DO NOT invent: if neither the metric nor its inputs are in the file, silently skip that chart.
- Output ONLY valid JSON. No comments, no trailing commas.

IF B2B — include these where data/derivation supports it:
- ARR trend — bar, yFormat matches scale
- ACV distribution or trend — bar, yFormat "dollar" [ARR / customers]
- YoY ARR Growth — line, "percent" [(ARR_t / ARR_t-12) - 1]
- Gross New ARR Composition (new logo vs expansion) — stacked bar
- New Logo Velocity — bar, "number"
- Quick Ratio — line, "number" [Gross New ARR / Gross Churned ARR]
- GDR — line, "percent" [1 + (Gross Churn ARR / avg BOP,EOP ARR)]
- NRR — line, "percent" [1 + ((Net New ARR - New Logo ARR) / avg BOP,EOP ARR)]
- Net Magic Number — line, "number" [Net New ARR / S&M]
- Rule of 40 — line or bar, "percent" [ARR Growth YoY + FCF Margin]
- CAC Payback — line, "number" months [CAC / (ARR per customer × GM)]
- Burn Multiple — line, "number" [Net Burn / Net New ARR]
- OpEx % of Revenue — line, "percent" [OpEx / Revenue]
- Gross Margin — line, "percent" [Gross Profit / Revenue]
- FCF Margin — line, "percent" [FCF / Revenue]
- Cash balance / burn trend — line
- Cash P&L waterfall — type "waterfall", "dollar", labels=P&L line items, data=signed values, mark subtotals in "totals":[bool,...]

IF B2C — include these where data/derivation supports it:
- Revenue or MRR trend — bar, match scale
- Revenue Growth % — line, "percent" [(Rev_t / Rev_t-1) - 1]
- GMV (if marketplace) — bar, match scale
- ARPU — line, "dollar" [Revenue / Active Users]
- User growth (DAU/MAU) — line or bar, "number" or "thousands"
- B2B vs B2C revenue split (if mixed) — stacked bar
- LTV — line, "dollar" [ARPU × (1 / monthly churn)]
- CAC — line, "dollar" [S&M / New Customers]
- LTV/CAC — line, "number"
- CAC Payback — line, "number" months
- Engagement per user — bar, "number"
- Retention cohorts — multi-line, each dataset = one cohort, x = ["1","2","3",...] months since acquisition, "percent", all start at 100
- Gross churn — line, "percent"
- NDR — line, "percent"
- Rule of 40 — line or bar, "percent"
- Burn Multiple — line, "number"
- OpEx % of Revenue — line, "percent"
- Gross Margin — line, "percent"
- FCF Margin — line, "percent"
- Cash balance / burn — line
- Cash P&L waterfall — as above

═══════════════════════════════════════════════════════════════
PEER-CHARTS (valuation benchmarking vs competitors from research)
═══════════════════════════════════════════════════════════════

Two charts, if and only if you found valuation or ARR/revenue data for ≥2 competitors in the research:

1. EV / Revenue Multiple of Peers
{
  "title": "EV / Revenue Multiple of Peers",
  "type": "bar",
  "yFormat": "multiple",
  "yLabel": "EV / Revenue Multiple (x)",
  "labels": ["Peer1", "Peer2", ..., "${companyName} (cARR $XM)"],
  "datasets": [
    { "label": "EV/Revenue", "data": [67, 150, ..., 13], "colors": ["#1e4d8c", "#1e4d8c", ..., "#9ca3af"] },
    { "label": "Average", "data": [AVG, AVG, ..., AVG], "chartType": "line", "isDashed": true, "lineColor": "#ef4444" }
  ]
}

2. Valuation ($B) and ARR ($M) of Peers
{
  "title": "Valuation ($B) and ARR ($M) of Peers",
  "type": "bar",
  "yFormat": "dollarbillions",
  "yLabel": "Latest Valuation ($B)",
  "labels": [...same as above...],
  "datasets": [
    { "label": "Latest Valuation ($B)", "data": [...], "colors": ["#1e4d8c", ..., "#9ca3af"] },
    { "label": "Est. ARR ($M)", "data": [...], "chartType": "line", "lineColor": "#ef4444" }
  ]
}

Peer chart rules:
- Target company goes LAST, gray (#9ca3af). Label: "${companyName} (cARR $XM)" if ARR known.
- Peers blue (#1e4d8c). "colors" length must equal "labels" length.
- Average dashed line excludes target — repeat the same average value at each position.
- If <2 peers have data, output: <peer-charts>[]</peer-charts>

═══════════════════════════════════════════════════════════════
UPLOADED FINANCIAL DOCUMENT:
═══════════════════════════════════════════════════════════════
${fileContent}

═══════════════════════════════════════════════════════════════
RESEARCH (for competitor data):
═══════════════════════════════════════════════════════════════
${research}

Now output the two XML blocks. Nothing else.`

function extractBlock(text: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)
  const m = re.exec(text)
  return m ? m[1].trim() : ''
}

function tryParseJsonArray(raw: string): unknown[] {
  if (!raw) return []
  const trimmed = raw.trim().replace(/,\s*$/, '')
  const candidates = [
    trimmed,
    trimmed + ']',
    trimmed + '}]',
    trimmed.replace(/,\s*\{[^}]*$/, '') + ']',
  ]
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c)
      if (Array.isArray(parsed)) return parsed
    } catch {}
  }
  return []
}

export async function POST(request: NextRequest) {
  try {
    const { companyName, fileContent, research = '' }: Body = await request.json()

    if (!fileContent?.trim()) {
      return Response.json({ finCharts: [], peerCharts: [] })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

    const client = new Anthropic({ apiKey })

    // Limit input sizes to keep prompt manageable
    const file = fileContent.slice(0, 50000)
    const res = research.slice(0, 20000)

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: CHART_PROMPT(companyName, file, res) }],
    })

    const text = msg.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map(b => b.text)
      .join('')

    const finRaw = extractBlock(text, 'fin-charts')
    const peerRaw = extractBlock(text, 'peer-charts')

    const finCharts = tryParseJsonArray(finRaw)
    const peerCharts = tryParseJsonArray(peerRaw)

    return Response.json({ finCharts, peerCharts })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Chart generation failed', finCharts: [], peerCharts: [] },
      { status: 500 }
    )
  }
}
