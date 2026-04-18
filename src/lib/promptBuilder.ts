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
- Include a chart if you can produce its data points — either by reading them directly from the file OR by deriving/calculating them from other numbers in the file using the formulas below. Both are valid.
- DERIVE AND CALCULATE: if a metric is not explicitly stated but its inputs are present, compute it. For example: if S&M spend and new customer count are both in the file, calculate CAC. If revenue and COGS are present, calculate Gross Margin %. If net burn and net new revenue are present, calculate Burn Multiple. Do this for every metric where inputs exist.
- Do NOT invent or estimate numbers that cannot be derived from data in the file. If neither the metric nor its inputs are present, silently skip that chart — no mention, no explanation.
- Chart types: "line" for trends, "bar" for period comparisons. Combo: top-level "type":"bar" + "chartType":"line" on the overlay dataset.
- yFormat: "dollarmillions" ($M), "thousands" ($K), "dollar" ($), "percent" (%), "number" (plain), "multiple" (x).
- Stacked bars: add "stacked": true.
- Labels: short date strings ("Mar-25", "Q1-25") for time series; category names for breakdowns.
- Output ONLY valid JSON inside the tags — no comments, no trailing commas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IF B2B (Enterprise / SMB SaaS):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Include these charts (include if data exists OR if derivable from inputs using the formula shown):

SALES:
- ARR trend (Run-Rate ARR over time) — bar, match yFormat to scale ("thousands" if $K, "dollarmillions" if $M)
- ACV distribution or ACV trend — bar, yFormat "dollar" [derive: ARR / number of customers]

GROWTH & RETENTION:
- YoY ARR Growth — line, yFormat "percent" [formula: (ARR_t / ARR_t-12mo) - 1; derive from ARR trend data]
- Gross New ARR Composition: new logo ARR vs expansion ARR — stacked bar, match yFormat to scale
- New Logo Velocity — bar, yFormat "number" [new logos added per period, or % growth in logo count]
- Quick Ratio — line, yFormat "number" [formula: Gross New ARR / Gross Churned ARR; derive from cohort/ARR waterfall data]
- Gross Dollar Retention (GDR) — line, yFormat "percent" [formula: 1 + (Gross Churn ARR / avg(BOP ARR, EOP ARR)); derive from churn data]
- Net Dollar Retention (NRR) — line, yFormat "percent" [formula: 1 + ((Net New ARR - New Logo ARR) / avg(BOP ARR, EOP ARR)); derive from expansion/churn data]

OPERATIONAL EFFICIENCY:
- Net Magic Number — line, yFormat "number" [formula: Net New ARR / S&M Expense; derive if both present]
- Rule of 40 — bar or line, yFormat "percent" [formula: ARR Growth YoY % + FCF Margin %; derive if both computable]
- CAC Payback — line, yFormat "number" [formula: CAC / (ARR per customer × Gross Margin); months; derive if inputs present]
- Burn Multiple — line, yFormat "number" [formula: Net Burn / Net New ARR; derive from cash flow + ARR data]
- OpEx as % of Revenue — line, yFormat "percent" [formula: Total OpEx / Revenue; derive from P&L data]

PROFITABILITY & CASH FLOW:
- Gross Margin — line, yFormat "percent" [formula: Gross Profit / Revenue; derive if Revenue and COGS present]
- FCF Margin — line, yFormat "percent" [formula: FCF / Revenue; derive if operating cash flow and capex present]
- Cash balance or net burn trend — line, match yFormat to scale
- Cash P&L waterfall (most recent period with full P&L data) — type "waterfall", yFormat "dollar". Labels = P&L line items. Data = signed values (positive for revenue/inflows, negative for costs). Mark subtotals/totals with "totals":[...]. Example dataset: {"label":"Amount","data":[500000,-120000,-80000,300000,-80000,-60000,-40000,120000],"totals":[false,false,false,true,false,false,false,true]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IF B2C (Consumer Tech / PLG):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Include these charts (include if data exists OR if derivable from inputs using the formula shown):

SALES METRICS:
- Revenue or MRR trend — bar, match yFormat to scale ("thousands" if $K, "dollarmillions" if $M)
- Revenue Growth rate (MoM or YoY %) — line, yFormat "percent" [formula: (Rev_t / Rev_t-1) - 1; derive from revenue trend]
- GMV trend (if marketplace) — bar, match yFormat to scale
- ARPU trend — line, yFormat "dollar" [formula: Revenue / Active Users; derive if both present]

UNIT ECONOMICS:
- User growth (total users, DAU, MAU over time) — line or bar, yFormat "number" or "thousands"
- B2B vs B2C or channel revenue split (if mixed model) — stacked bar, match yFormat to scale
- LTV — line, yFormat "dollar" [formula: ARPU × (1 / monthly churn rate); derive if ARPU and churn rate available]
- CAC — line, yFormat "dollar" [formula: S&M Expense / New Customers Acquired; derive if both present]
- LTV/CAC ratio — line, yFormat "number" [derive from LTV and CAC above; target >3x]
- CAC Payback Period — line, yFormat "number" [formula: CAC / (ARPU × Gross Margin %); months; derive if inputs present]
- Engagement metric per user (e.g. videos/generations/sessions per user per month) — bar, yFormat "number"
- Retention cohort curves — if cohort data exists: multi-line, each dataset = one cohort labeled by acquisition month (e.g. "Apr-25"), x-axis = ["1","2","3"...] months since acquisition, yFormat "percent", xLabel "Months Since Acquisition", all cohorts start at 100

RETENTION:
- Gross churn rate — line, yFormat "percent" [derive from cohort or subscriber data: lost users / beginning users]
- NDR / NRR — line, yFormat "percent" [formula: (Beg Rev + Expansion - Contraction - Churn) / Beg Rev; derive from revenue waterfall or cohort data]

OPERATIONAL EFFICIENCY:
- Rule of 40 — bar or line, yFormat "percent" [formula: Revenue Growth YoY % + FCF Margin %; derive if both computable]
- Burn Multiple — line, yFormat "number" [formula: Net Burn / Net New Revenue; derive from cash flow + revenue data]
- OpEx as % of Revenue — line, yFormat "percent" [formula: Total OpEx / Revenue; derive from P&L data]

PROFITABILITY & CASH FLOW:
- Gross Margin — line, yFormat "percent" [formula: Gross Profit / Revenue; derive if Revenue and COGS present]
- FCF Margin — line, yFormat "percent" [formula: FCF / Revenue; derive if operating cash flow and capex present]
- Cash balance or net burn trend — line, match yFormat to scale
- Cash P&L waterfall (most recent period with full P&L data) — type "waterfall", yFormat "dollar". Labels = P&L line items. Data = signed values (positive for revenue/inflows, negative for costs). Mark subtotals/totals with "totals":[...].

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
