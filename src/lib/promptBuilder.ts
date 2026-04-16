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
      ? `Analyze from the uploaded financial document. Determine the business model type first (B2B SaaS → ACV, NRR, CAC, LTV, payback period; B2C → ARPU, DAU/MAU, retention, CAC). Report all available metrics with exact figures from the file. Flag any missing key metrics and explain why they matter for underwriting.`
      : '',

    'Financials': hasFile
      ? `Analyze from the uploaded financial document: ARR/revenue trajectory (YoY growth), gross margin, EBITDA margin, burn rate, and runway. Then focus on valuation: calculate EV/ARR (current or implied) and compare against the public and private peers from the Competitors section. Is the valuation premium or discount justified by growth rate, margin, or competitive position? State your view clearly.`
      : '',

    'Investment Returns Analysis': hasReturnsData
      ? `Generate a full returns analysis using these inputs: Investment Amount = $${investmentAmount}M, Pre-Money Valuation = $${valuation}M. Calculate post-money valuation, ownership %, and use the best available ARR/revenue data from the research or uploaded financials as entry revenue. Then generate exactly the following tables in clean markdown:

**Investment Assumptions**
| Assumption | Value |
|---|---|
| Investment Amount | $${investmentAmount}M |
| Pre-Money Valuation | $${valuation}M |
| Post-Money Valuation | $[pre + investment]M |
| Ownership % Acquired | [investment/(pre+investment) × 100]% |
| Entry ARR | $[best estimate]M |
| Entry EV/ARR Multiple | [post-money / entry ARR]x |
| Hold Period | 5 years |

**5-Year Revenue Projection**
| Case | Year 0 | Year 1 | Year 2 | Year 3 | Year 4 | Year 5 |
|---|---|---|---|---|---|---|
| Bear (25% CAGR) | $X | $X | $X | $X | $X | $X |
| Base (50% CAGR) | $X | $X | $X | $X | $X | $X |
| Bull (100% CAGR) | $X | $X | $X | $X | $X | $X |

**Investment Returns by Case**
| Metric | Bear | Base | Bull |
|---|---|---|---|
| Year 5 Revenue | $X | $X | $X |
| Exit Multiple | Xx | Xx | Xx |
| Exit Enterprise Value | $X | $X | $X |
| Investor Return | $X | $X | $X |
| MOIC | Xx | Xx | Xx |
| IRR | X% | X% | X% |

**Sensitivity Analysis — IRR by Revenue CAGR vs Exit Multiple**
| Exit Multiple ↓ / CAGR → | 25% | 50% | 75% | 100% | 125% |
|---|---|---|---|---|---|
| 8x | X% | X% | X% | X% | X% |
| 12x | X% | X% | X% | X% | X% |
| 15x | X% | X% | X% | X% | X% |
| 20x | X% | X% | X% | X% | X% |
| 25x | X% | X% | X% | X% | X% |

Calculate IRR using: IRR = (Exit Value / Investment)^(1/5) - 1. Label assumed figures with †.`
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
