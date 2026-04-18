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
    if (s === 'Financials' && !hasFile) return false
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

    'Financials': hasFile
      ? `Analyze from the uploaded financial document.

STEP 1 — CLASSIFY THE BUSINESS MODEL:
Read the research and financials carefully. Classify the company as either:
- B2B (Enterprise / SMB SaaS): sells to businesses, ARR/ACV-based, logo-level retention metrics
- B2C (Consumer Tech / PLG): sells to consumers or has product-led growth, ARPU/DAU/MAU metrics

STEP 2 — OUTPUT CHARTS using EXACTLY this XML format:

<fin-charts>
[
  {
    "title": "Chart Title",
    "type": "bar",
    "yFormat": "dollarmillions",
    "labels": ["Jan-25", "Feb-25"],
    "datasets": [{"label": "Series", "data": [1.2, 1.8]}]
  }
]
</fin-charts>

CRITICAL chart rules (apply to ALL charts):
- ONLY include a chart if actual numbers for it exist in the uploaded document. Silently skip any chart without data — no mention, no explanation.
- No invented numbers. Every data point must come directly from the file.
- Chart types: "line" for trends, "bar" for period comparisons. Combo: top-level "type":"bar" + "chartType":"line" on the overlay dataset.
- yFormat: "dollarmillions" ($M), "thousands" ($K), "dollar" ($), "percent" (%), "number" (plain), "multiple" (x).
- Stacked bars: add "stacked": true.
- Labels: short date strings ("Mar-25", "Q1-25") for time series; category names for breakdowns.
- Output ONLY valid JSON inside the tags — no comments, no trailing commas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IF B2B (Enterprise / SMB SaaS):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Include these charts (silently skip any without data):

SALES:
- ARR trend (Run-Rate ARR over time) — bar, match yFormat to scale ("thousands" if $K, "dollarmillions" if $M)
- ACV distribution or ACV trend if available — bar, yFormat "dollar"

GROWTH & RETENTION:
- YoY ARR Growth (Year 2 ARR / Year 1 ARR - 1) — line, yFormat "percent"
- Gross New ARR Composition: new logo ARR vs expansion ARR — stacked bar, match yFormat to scale
- New Logo Velocity (new logos added per period, or growth rate) — bar, yFormat "number" or "percent"
- Quick Ratio (Gross New ARR / Gross Churned ARR) — line, yFormat "number"
- Gross Dollar Retention (GDR) — line, yFormat "percent"
- Net Dollar Retention (NRR) — line, yFormat "percent"

OPERATIONAL EFFICIENCY:
- Net Magic Number (Net New ARR / S&M Expense) — line, yFormat "number"
- Rule of 40 (ARR Growth YoY % + FCF Margin %) — bar or line, yFormat "percent"
- CAC Payback (CAC / (ARR Per Customer × Gross Margin)) in months — line, yFormat "number"
- Burn Multiple (Net Burn / Net New ARR) — line, yFormat "number"
- OpEx as % of Revenue — line, yFormat "percent"

PROFITABILITY & CASH FLOW:
- Gross Margin (Gross Profit / Revenue) — line, yFormat "percent"
- FCF Margin (FCF / Revenue) — line, yFormat "percent"
- Cash balance or net burn trend — line, match yFormat to scale
- Cash P&L waterfall (most recent period with full P&L data) — type "waterfall", yFormat "dollar". Labels = P&L line items. Data = signed values (positive for revenue/inflows, negative for costs). Mark subtotals/totals with "totals":[...]. Example dataset: {"label":"Amount","data":[500000,-120000,-80000,300000,-80000,-60000,-40000,120000],"totals":[false,false,false,true,false,false,false,true]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IF B2C (Consumer Tech / PLG):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Include these charts (silently skip any without data):

SALES METRICS:
- Revenue or MRR trend — bar, match yFormat to scale ("thousands" if $K, "dollarmillions" if $M)
- Revenue Growth rate (MoM or YoY %) — line, yFormat "percent"
- GMV trend (if marketplace) — bar, match yFormat to scale
- ARPU trend (avg revenue per user per month) — line, yFormat "dollar"

UNIT ECONOMICS:
- User growth (total users, DAU, MAU over time) — line or bar, yFormat "number" or "thousands"
- B2B vs B2C or channel revenue split if mixed model — stacked bar, match yFormat to scale
- LTV trend (if calculable from data) — line, yFormat "dollar"
- CAC trend (S&M spend / new customers acquired) — line, yFormat "dollar"
- LTV/CAC ratio — line, yFormat "number"
- CAC Payback Period (months) — line, yFormat "number"
- Engagement metric per user (e.g. videos/generations/sessions per user per month) — bar, yFormat "number"
- Retention cohort curves — if cohort data exists: multi-line, each dataset = one cohort labeled by acquisition month (e.g. "Apr-25"), x-axis = ["1","2","3"...] months since acquisition, yFormat "percent", xLabel "Months Since Acquisition", all start at 100

RETENTION:
- Gross churn rate (monthly or annual) — line, yFormat "percent"
- NDR / NRR — line, yFormat "percent"

OPERATIONAL EFFICIENCY:
- Rule of 40 (Revenue Growth YoY % + FCF Margin %) — bar or line, yFormat "percent"
- Burn Multiple (Net Burn / Net New Revenue) — line, yFormat "number"
- OpEx as % of Revenue — line, yFormat "percent"

PROFITABILITY & CASH FLOW:
- Gross Margin (Gross Profit / Revenue) — line, yFormat "percent"
- FCF Margin (FCF / Revenue) — line, yFormat "percent"
- Cash balance or net burn trend — line, match yFormat to scale
- Cash P&L waterfall (most recent period with full P&L data) — type "waterfall", yFormat "dollar". Labels = P&L line items. Data = signed values. Mark subtotals/totals with "totals":[...].

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 3 — PEER VALUATION CHARTS:
After </fin-charts>, output peer valuation charts using competitor data from the Competitors section:

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

CRITICAL peer chart rules:
- ONLY include a company if you found its valuation OR ARR/revenue in the research data. Silently skip any with no data.
- If fewer than 2 companies have any data, output: <peer-charts>[]</peer-charts>
- Target company goes LAST, shown in gray (#9ca3af). Label as "CompanyName (cARR $XM)" if ARR is known.
- EV/Revenue chart only if computable for ≥2 companies.
- Average dashed line: peers only (exclude target). Repeat same average value for every label position.
- "colors" array must have exactly one color string per label.
- Output ONLY valid JSON — no comments, no trailing commas.

STEP 4 — TEXT ANALYSIS:
After the peer-charts block, write your analysis. State upfront whether this is a B2B or B2C company and why. Then cover:
- B2B: ARR trajectory, logo retention, expansion motion, NRR vs GDR, magic number, burn efficiency, CAC payback
- B2C: revenue/MRR growth, user growth, ARPU trajectory, retention (cohorts + churn), LTV/CAC, engagement depth
- Both: gross margin, FCF margin, burn rate and runway, missing key metrics and why they matter for underwriting
- Valuation: EV/ARR vs peers — is the premium or discount justified by growth rate, margins, or competitive position?`
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
