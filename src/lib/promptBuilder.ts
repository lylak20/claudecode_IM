import type { MemoConfig } from './types'

const THUM_BASE = 'https://image.thum.io/get/width/1200/'

function screenshotImg(url: string, alt: string): string {
  return `\n![${alt}](${THUM_BASE}${url})\n`
}

export function buildMemoPrompt(config: MemoConfig): string {
  const { url, sections: rawSections, sectionNotes = {}, fileContent, scrapeResult, research, investmentAmount, valuation, screenshotUrls, tone = 'prose' } = config

  const companyName = scrapeResult?.companyName || (() => { try { return new URL(url).hostname.replace('www.', '') } catch { return '' } })()
  const hasFile = !!(fileContent?.trim())
  const hasReturnsData = !!(investmentAmount?.trim() && valuation?.trim())

  // Auto-filter sections based on available data
  const sections = rawSections.filter(s => {
    if ((s === 'Unit Economics' || s === 'Financials') && !hasFile) return false
    if (s === 'Investment Returns Analysis' && !hasReturnsData) return false
    return true
  })

  // Per-section instructions
  const SECTION_INSTRUCTIONS: Record<string, string> = {
    'Product': `Describe the product in concrete terms: what specific problem it solves, who the target customer is, key features, and how a user experiences it. Pull product names, feature names, and category language directly from the website research. Do NOT use generic descriptions.${screenshotUrls?.product ? screenshotImg(screenshotUrls.product, 'Product Overview') : ''}
If data is insufficient: > *Diligence required — Request a product demo recording and customer references to validate core use case.*`,

    'Technology': `Identify the technology moat specifically. Answer: (1) What is the core proprietary technology? (2) What data, model, or infrastructure advantage does the company have? (3) What would a well-funded competitor need to replicate this in 18 months? Focus on data network effects, proprietary training data, novel architecture, patents, exclusive partnerships, or infrastructure lock-in. If moat evidence is thin in the research, say so explicitly — do not invent a moat.
> *Diligence required — Request technical architecture review, patent filings, and model benchmarks vs. open-source alternatives if specifics are unclear.*`,

    'Business Model': `State clearly: B2B Enterprise SaaS / B2B SMB SaaS / B2C / Marketplace / Usage-based / Hybrid. Then cover: (1) Pricing model: monthly/annual subscription, per-seat, usage-based, freemium-to-paid, tiered — with specific price points from the research. (2) GTM motion: PLG, direct sales, channel. (3) Primary revenue streams. (4) Any evidence of contract sizes, ARPU, or conversion rates.${screenshotUrls?.pricing ? screenshotImg(screenshotUrls.pricing, 'Pricing Page') : ''}
If pricing details are missing: > *Diligence required — Request pricing deck, ACV range by segment, and current conversion rates from free to paid.*`,

    'Team': `Cover each founder/key executive with this structure: **[Name], [Title]** — [University, Degree if known]. Previously: [Company, Role, notable achievement]. Focus especially on CEO and CTO. Extract this from the company website "About" or "Team" page and from news articles in the research. What in their background is most relevant to THIS company succeeding? Be specific. If a founder's background is not in the research, say "Background not publicly available — LinkedIn verification required" rather than inventing details.`,

    'Market': `Be concise and lead with numbers. Structure as:

**TAM:** $XB — [one-line reasoning or source]
**SAM:** $XB — [what subset is actually addressable by this company]
**SOM:** $XM — [realistic 3–5 year capture, with reasoning]

Include a bottom-up sanity check where possible: e.g., "[# of target users] × [$ARPU] = $X market." State the market growth rate (X% CAGR) and the 1–2 most important macro tailwinds. If analyst estimates exist in the research, cite them. Do not write long paragraphs — use numbers.
> *Diligence required — Validate TAM/SAM sizing with primary market research if third-party estimates are unavailable.*`,

    'Competitors': `Output a markdown table with exactly these columns:

| Company | Founders | Total Funding | Valuation | Key Investors | Key Insight |

Include 5–8 direct competitors. Pull data from the research (news, Reddit, HN, company websites). For Key Insight: write 1–2 short bullet points (no full sentences) capturing something material from recent news — e.g. "• Pivoted to enterprise in 2024 • Lost key AI partnership". Use N/A for any cell where data is not available in the research — do not guess or fabricate figures.`,

    'Unit Economics': hasFile
      ? `Analyze from the uploaded financial document. First, output a chart data block using EXACTLY this XML format — valid JSON array inside the tags:

<ue-charts>
[
  {
    "title": "Chart Title Here",
    "type": "line",
    "yFormat": "dollarmillions",
    "xLabel": "optional x-axis label",
    "labels": ["Jan-25", "Feb-25"],
    "datasets": [{"label": "Revenue", "data": [1.2, 1.8]}]
  }
]
</ue-charts>

Rules for the chart block:
- CRITICAL: Only output a chart if you can find actual numbers for it in the uploaded document. If the data is not there, silently skip that chart — do NOT mention it anywhere, do NOT say "data unavailable" or "no data for X". Just omit it entirely.
- No invented or estimated numbers. Every data point must come directly from the file.
- Include up to 10 charts. More is better if the data exists.
- Chart types: "line" for time-series trends, "bar" for monthly/period comparisons. For combo charts (bars + a line overlay), set top-level "type":"bar" and add "chartType":"line" on the line dataset.
- yFormat options: "dollarmillions" ($M), "dollar" ($), "percent" (%), "thousands" (K), "number" (plain).
- For stacked bar charts: add "stacked": true.
- Labels: short date strings ("Mar-25", "Q1-25") for time series, or category names.

Look for and chart the following metrics — silently skip any that are missing from the document:

GROWTH & RETENTION (if time-series data exists):
- YoY ARR Growth — line, yFormat "percent"
- Gross New ARR Composition (new logo ARR, expansion ARR) — stacked bar, yFormat "dollarmillions"
- New Logo Velocity (new logos added per period) — bar, yFormat "number"
- Quick Ratio (new ARR / churned ARR) — line, yFormat "number"
- Gross Dollar Retention (GDR) — line, yFormat "percent"
- Net Dollar Retention / NRR — line, yFormat "percent"

OPERATIONAL EFFICIENCY (if data exists):
- Net Magic Number (net new ARR / S&M spend) — line, yFormat "number"
- Rule of 40 (ARR growth % + FCF margin %) — bar or line, yFormat "percent"
- CAC Payback Period (months) — line, yFormat "number", xLabel "Months"
- Burn Multiple (net burn / net new ARR) — line, yFormat "number"
- OpEx as % of Revenue — line or stacked area, yFormat "percent"

PROFITABILITY & CASH FLOW (if data exists):
- Gross Margin trend — line, yFormat "percent"
- FCF Margin trend — line, yFormat "percent"
- Revenue vs. Costs combo — bars for revenue & cost, line for gross profit, yFormat "dollarmillions"

HEADCOUNT (if data exists):
- Headcount Distribution by team/function — stacked bar, yFormat "number"
- ARR per FTE — line, yFormat "dollarmillions"
- OpEx per FTE — line, yFormat "dollarmillions"

OTHER (always include if data exists):
- Total revenue / MRR / ARR trend — bar, yFormat "dollarmillions"
- ARPU trend — line, yFormat "dollar"
- User or customer count / breakdown by segment — bar or stacked bar, yFormat "number" or "thousands"
- Engagement metric per user (e.g. videos/generations/sessions per user per month) — bar, yFormat "number"
- Retention cohort curves — if cohort data exists: multi-line chart, each dataset = one cohort labeled by acquisition month (e.g. "Apr-25"), x-axis labels = ["1","2","3"...] (months since acquisition), yFormat "percent", xLabel "Months Since Acquisition", all cohorts start at 100
- B2B vs B2C or channel revenue split — stacked bar, yFormat "dollarmillions"

- Output ONLY valid JSON inside the tags — no comments, no trailing commas.

After the chart block, write your text analysis:
Determine the business model type first (B2B SaaS → ACV, NRR, CAC, LTV, payback period; B2C → ARPU, DAU/MAU, retention, CAC). Report all available metrics with exact figures from the file. Flag any missing key metrics and explain why they matter for underwriting.`
      : '',

    'Financials': hasFile
      ? `Analyze from the uploaded financial document. First, output a financial chart block using EXACTLY this XML format:

<fin-charts>
[
  {
    "title": "Chart Title",
    "type": "bar",
    "yFormat": "dollarmillions",
    "labels": ["Jan-25", "Feb-25"],
    "datasets": [{"label": "ARR", "data": [1.2, 1.8]}]
  }
]
</fin-charts>

CRITICAL: Only include a chart if you found actual numbers in the document. If data is missing, silently omit that chart — no explanation, no mention.

Charts to include (silently skip any without data):
1. ARR or Revenue trend — bar, yFormat "dollarmillions"
2. Gross Margin % trend — line, yFormat "percent"
3. Cash balance or net burn trend — line, yFormat "dollarmillions"
4. Cash P&L waterfall (for the most recent period with full P&L data) — use type "waterfall", yFormat "dollar". Labels = each P&L line item (e.g. "Revenue", "COGS", "Gross Profit", "S&M", "R&D", "G&A", "Op Profit"). Data = signed dollar values (positive for revenue/inflows, negative for costs). Mark subtotals and totals (Gross Profit, Operating Profit/Loss, Net Income) with "totals": [false, false, true, ...] in the dataset. Example dataset: {"label":"Amount","data":[19435,-20298,-177,-78,-1118,-608,-9660,-828,-1706,-1147,-15067],"totals":[false,false,false,false,true,false,false,false,false,false,true]}
5. Operating expense breakdown by category — stacked bar, yFormat "dollarmillions"
6. Revenue vs Costs combo — bars for revenue & cost items, line for gross profit margin, yFormat "dollarmillions" for bars

Output ONLY valid JSON inside the tags — no comments, no trailing commas.

After the fin-charts block, output a peer valuation chart block. Use the competitor companies already identified in the Competitors section research. For each competitor, look through the research data for their valuation and ARR/revenue:

<peer-charts>
[
  {
    "title": "EV / Revenue Multiple of Peers",
    "type": "bar",
    "yFormat": "multiple",
    "yLabel": "EV / Revenue Multiple (x)",
    "labels": ["Peer1", "Peer2", ..., "TARGET_COMPANY (cARR $XM)"],
    "datasets": [
      {
        "label": "EV/Revenue",
        "data": [67, 150, ..., 13],
        "colors": ["#1e4d8c", "#1e4d8c", ..., "#9ca3af"]
      },
      {
        "label": "Average",
        "data": [AVG, AVG, ..., AVG],
        "chartType": "line",
        "isDashed": true,
        "lineColor": "#ef4444"
      }
    ]
  },
  {
    "title": "Valuation ($B) and ARR ($M) of Peers",
    "type": "bar",
    "yFormat": "dollarbillions",
    "yLabel": "Latest Valuation ($B)",
    "labels": ["Peer1", "Peer2", ..., "TARGET_COMPANY"],
    "datasets": [
      {
        "label": "Latest Valuation ($B)",
        "data": [10, 4.5, ..., 0.5],
        "colors": ["#1e4d8c", "#1e4d8c", ..., "#9ca3af"]
      },
      {
        "label": "Est. ARR ($M)",
        "data": [155, 30, ..., 5],
        "chartType": "line",
        "lineColor": "#ef4444"
      }
    ]
  }
]
</peer-charts>

CRITICAL rules for peer charts:
- ONLY include a company if you found its valuation OR ARR in the research data. Silently skip companies with no data — no mention anywhere.
- If fewer than 2 companies have any data at all, output: <peer-charts>[]</peer-charts>
- The target company (the one being analyzed) goes LAST in the labels array, shown in gray (#9ca3af). Label it as "CompanyName (cARR $XM)" if ARR is known. Use its post-money valuation from the investment inputs if provided.
- EV/Revenue = valuation / ARR. Only include this chart if you can compute it for at least 2 companies.
- For the average dashed line: compute average of peers only (exclude the target company from the average). The "data" array must repeat the same average value for every label position.
- "colors" array must have one color string per label, matching the labels array length exactly.
- Output ONLY valid JSON — no comments, no trailing commas.

After the peer-charts block, write your text analysis:
ARR/revenue trajectory (YoY growth), gross margin, EBITDA margin, burn rate, and runway. Then focus on valuation: calculate EV/ARR (current or implied) and compare against the public and private peers from the Competitors section. Is the valuation premium or discount justified by growth rate, margin, or competitive position? State your view clearly.`
      : '',

    'Investment Returns Analysis': hasReturnsData
      ? `Output ONLY the following single HTML comment — do NOT output any tables or prose (all financial tables are auto-generated interactively):

<!-- IRA_CALCULATOR:{"entryRevenue": X.X, "investmentAmount": ${investmentAmount}, "valuation": ${valuation}} -->

Replace X.X with your best estimate of the company's current annual revenue or ARR in $M, derived from the research or uploaded financials. If genuinely unknown, use 0. Output nothing else for this section.`
      : '',

    'Investment Highlight': `Summarize the top 3 investment thesis points as concise bullet points. Each must be specific, evidence-grounded, and a distinct reason to invest. No generic statements like "large market" or "strong team" — be specific to this company.`,

    'Investment Risk': `Summarize the top 3 most material risks as concise bullet points. For each, include a brief mitigant or the specific diligence question needed to get comfortable. Focus on risks most likely to impair returns (e.g., competitive displacement, unit economics not proven, regulatory, key-man).`,
  }

  const sectionInstructions = sections.map(s => {
    const userNote = sectionNotes[s]?.trim()
    const defaultInstruction = SECTION_INSTRUCTIONS[s] || `Write a thorough analysis of ${s}.`
    const instruction = userNote ? `USER OVERRIDE: ${userNote}` : defaultInstruction
    return `### ${s}\n${instruction}`
  }).join('\n\n')

  const researchBlock = research?.trim() ? `\n\n${research}` : ''
  const financialsBlock = hasFile ? `\n\n=== UPLOADED FINANCIAL / SUPPORTING DOCUMENTS ===\n${fileContent}` : ''

  return `You are a senior investment analyst at a top-tier growth equity firm writing an Investment Committee memo on ${companyName}. IC partners are former operators and seasoned investors — they will immediately call out vague claims, invented metrics, or boilerplate.

STRICT RULES:
1. Every factual claim must come from the research data provided. Do NOT invent numbers, quotes, or facts.
2. Where data is genuinely missing, write a blockquote: > *Diligence required — [specific question and why it matters for the investment decision]*
3. Be analytically skeptical — validate or challenge company claims where evidence is thin.
4. Use specific product names, customer names, funding amounts, dates, and dollar figures exactly as they appear in the research.
5. Community signals (Reddit, HN, news) are evidence of real-world reception — use them to validate or challenge the investment thesis.
6. Each section header must appear exactly once. Do not repeat sections.
7. For "Diligence required" items: always format as a blockquote with italic text: > *Diligence required — ...*

MEMO SECTIONS — write each exactly once, in this order:
${sections.map(s => `- ${s}`).join('\n')}

PER-SECTION INSTRUCTIONS:
${sectionInstructions}

WRITING STYLE — ${tone === 'bullets' ? 'BULLET BRIEF' : 'NARRATIVE MEMO'}:
${tone === 'bullets'
  ? `- Write in concise bullet points throughout. Lead every point with a number, fact, or finding — not a verb.
- No full paragraphs unless a table or list would genuinely be worse. Maximum 1–2 lines per bullet.
- Each section should be scannable in under 30 seconds.
- Executive Summary: 3 tight bullets (company, scale, key consideration). No prose.`
  : `- Write in complete, professional sentences. Develop arguments in coherent paragraphs.
- Use formal IC memo language — analytical, precise, no filler.
- Executive Summary: 2–3 full sentences. Confident and direct.
- Bullets and tables are still appropriate for lists of facts, competitors, or metrics.`}

FORMAT:
- Executive Summary first (no header), then each section with "## [Section Name]" header.
- Output clean markdown only. No boilerplate.

---

RESEARCH DATA — ${companyName.toUpperCase()}
Website: ${url}
${researchBlock}
${financialsBlock}

---

Write the memo now.`
}
