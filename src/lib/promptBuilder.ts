import type { MemoConfig } from './types'

// Default analytical instructions for each section.
// If the user provides notes, those override the default.
const SECTION_DEFAULTS: Record<string, string> = {
  'Product': `Describe the product(s) in detail based on the company website research: what problem it solves, key features, target customer segments, and notable differentiators. Use specific product names, feature names, and any pricing tiers mentioned. If the research contains a clear product description, quote or closely paraphrase it.`,

  'Technology': `Focus on the technology moat. What is the core proprietary technology? How is it differentiated from competitors — proprietary models, unique datasets, patented methods, infrastructure advantages? Be specific about what a well-funded competitor would need to replicate it. If moat evidence is thin in the research, state that explicitly.`,

  'Business Model': `Identify the revenue model: B2B Enterprise SaaS, B2C, marketplace, usage-based, or hybrid. Describe the pricing structure (monthly/annual subscription, per-seat, usage-based, freemium-to-paid). Identify primary revenue streams and the go-to-market motion (direct sales, PLG, channel). Note any evidence of contract sizes or ARPU from the research.`,

  'Team': `Cover the founding team with specifics on education (universities, degrees) and prior work experience (companies, titles, notable exits or achievements). Focus especially on CEO and CTO. Use any LinkedIn or biography data in the research. Where specific details are missing, note "LinkedIn verification required" rather than guessing.`,

  'Market': `Assess the market opportunity. Estimate TAM, SAM, and SOM with specific numbers and sources where available. Is this an existing market being disrupted, or a new category being created? Include market growth rate, key macro tailwinds, and any analyst estimates cited in the research. Where numbers are unavailable, acknowledge the gap and describe the qualitative opportunity.`,

  'Competitors': `Output a markdown table with the following columns: **Company** | **Founders** | **Total Funding** | **Valuation** | **Key Investors**. Include 5–8 direct competitors. Pull data from the research (news, Reddit, HN). Where LinkedIn or exact figures are unavailable, note "verify" in that cell rather than guessing.`,

  'Unit Economics': `For B2B SaaS: analyze ACV, NRR/GRR, CAC, LTV, LTV:CAC ratio, and payback period. For B2C: analyze ARPU, DAU/MAU, retention/churn, and CAC. Use data from uploaded financial documents if available. Flag any metrics that are missing and explain why they matter for underwriting the investment.`,

  'Financials': `Focus on ARR/revenue trajectory and current valuation. Calculate or estimate the EV/ARR multiple and compare it against the public and private peers identified in the Competitors section. Is the current valuation premium or discount justified by growth rate, margin profile, or competitive position? If revenue figures are unavailable, note what is required for diligence.`,

  'Investment Returns Analysis': `Generate a full returns analysis formatted as clean markdown tables. Structure it exactly as follows:

**Investment Assumptions**
| Assumption | Value |
|---|---|
| Investment Amount | $[X]M |
| Pre-Money Valuation | $[X]M |
| Round Size | $[X]M |
| Post-Money Valuation | $[X]M |
| Ownership % Acquired | X.X% |
| Entry Revenue (ARR) | $[X]M |
| Entry EV/Revenue Multiple | X.Xx |
| Hold Period | 5 years |

**5-Year Revenue Projection**
| Case | Entry (Year 0) | Year 1 | Year 2 | Year 3 | Year 4 | Year 5 |
|---|---|---|---|---|---|---|
| Bear (0% growth) | $X | $X | $X | $X | $X | $X |
| Base (50% growth) | $X | $X | $X | $X | $X | $X |
| Bull (100% growth) | $X | $X | $X | $X | $X | $X |

**Investment Return (Base Case)**
| Metric | Value |
|---|---|
| Year 5 Revenue | $X |
| Exit Multiple | X.Xx |
| Enterprise Value | $X |
| Return to Investor | $X |
| MOIC | X.Xx |
| IRR | XX% |

**Sensitivity Analysis — IRR by Revenue Growth Rate vs Exit Multiple**
| Exit Multiple ↓ / Growth → | 0% | 25% | 50% | 75% | 100% | 125% |
|---|---|---|---|---|---|---|
| 8.0x | X% | X% | X% | X% | X% | X% |
| 10.0x | X% | X% | X% | X% | X% | X% |
| 15.0x | X% | X% | X% | X% | X% | X% |
| 20.0x | X% | X% | X% | X% | X% | X% |
| 25.0x | X% | X% | X% | X% | X% | X% |

Use financial data from uploaded documents if provided. Otherwise, use the best available information about the company's funding round, valuation, and ARR to populate assumptions. Calculate IRR using the standard formula: IRR = (Exit Value / Investment)^(1/Years) - 1. Label any assumed figures clearly.`,

  'Investment Highlight': `Summarize the top 3 investment thesis points as concise, specific bullet points. Each should be a distinct and compelling reason to invest, grounded in the research. Avoid generic statements.`,

  'Investment Risk': `Summarize the top 3 most material risks as concise bullet points. For each risk, include a brief note on the mitigant or the diligence required to get comfortable. Focus on the risks most likely to impair returns.`,
}

export function buildMemoPrompt(config: MemoConfig): string {
  const { url, sections, sectionNotes = {}, fileContent, scrapeResult, research } = config

  const companyName =
    scrapeResult?.companyName || new URL(url).hostname.replace('www.', '')

  // Build per-section instruction block
  const sectionInstructions = sections.map((s) => {
    const userNote = sectionNotes[s]?.trim()
    const defaultInstruction = SECTION_DEFAULTS[s] || `Write a thorough analysis of ${s}.`
    const instruction = userNote
      ? `USER OVERRIDE: ${userNote}`
      : defaultInstruction
    return `### ${s}\n${instruction}`
  }).join('\n\n')

  const researchBlock = research?.trim()
    ? `\n\n${research}`
    : ''

  const financialsBlock = fileContent?.trim()
    ? `\n\n=== UPLOADED FINANCIAL / SUPPORTING DOCUMENTS ===\n${fileContent}`
    : ''

  return `You are a senior investment analyst at a top-tier growth equity firm writing an Investment Committee memo on ${companyName}. IC partners are former operators and seasoned investors — they will immediately call out vague claims, invented metrics, or boilerplate.

STRICT RULES:
1. Every factual claim must come from the research data provided. Do NOT invent numbers, quotes, or facts.
2. Where data is genuinely missing, write: "Diligence required: [specific question and why it matters]."
3. Be analytically skeptical — validate or challenge company claims where evidence is thin.
4. Use specific product names, customer names, funding amounts, dates, and dollar figures exactly as they appear in the research.
5. Community signals (Reddit, HN, news) are evidence of real-world reception — use them.
6. If you cannot find accurate information for something, leave it blank or note it as "data not available" — do NOT make something up.
7. Each section header must appear exactly once. Do not repeat sections.

MEMO SECTIONS — write each exactly once, in this order:
${sections.map(s => `- ${s}`).join('\n')}

PER-SECTION INSTRUCTIONS:
${sectionInstructions}

FORMAT:
- Start with a 2–3 sentence Executive Summary (no header): what the company does, current scale/stage, and the single most important investment consideration.
- Each section: "## [Section Name]" header, then follow the section instructions above.
- Output clean markdown only. No filler sentences.

---

RESEARCH DATA — ${companyName.toUpperCase()}
Website: ${url}
${researchBlock}
${financialsBlock}

---

Write the memo now.`
}
