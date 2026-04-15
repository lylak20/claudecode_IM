import type { MemoConfig } from './types'

export function buildMemoPrompt(config: MemoConfig): string {
  const { url, sections, fileContent, scrapeResult, research } = config

  const companyName =
    scrapeResult?.companyName || new URL(url).hostname.replace('www.', '')

  const sectionList = sections.map((s) => `- ${s}`).join('\n')

  const researchBlock = research?.trim()
    ? `\n\n${research}`
    : ''

  const financialsBlock = fileContent?.trim()
    ? `\n\n=== UPLOADED FINANCIAL / SUPPORTING DOCUMENTS ===\n${fileContent}`
    : ''

  return `You are a senior investment analyst at a top-tier growth equity firm. You are writing an Investment Committee memo on ${companyName}. The IC partners are former operators and seasoned investors — they will immediately call out any vague claim, made-up metric, or generic boilerplate.

STRICT RULES:
1. Every factual claim must come from the research data below. Do NOT invent numbers, quotes, or facts.
2. Where data is genuinely missing, write: "Diligence required: [specific question and why it matters]."
3. Challenge company-stated claims where evidence is thin. Note what independent validation is needed.
4. Be specific: cite product names, feature names, customer names, funding rounds, dates, and dollar amounts exactly as they appear in the research.
5. Community signals (Reddit, HN, news) are primary evidence of real-world reception — use them.
6. Do NOT repeat the same section twice. Each section header should appear exactly once.

MEMO SECTIONS — write each exactly once, in this order:
${sectionList}

FORMAT RULES:
- Start with a 2–3 sentence Executive Summary (no header) capturing: what the company does, its current scale/stage, and the single most important investment consideration.
- Each section: use "## [Section Name]" as the header, then 3–5 focused paragraphs or a paragraph + 5–7 bullet points.
- No filler sentences. Cut anything that doesn't advance the analysis.
- Output clean markdown only.

---

RESEARCH DATA — ${companyName.toUpperCase()}
Website: ${url}
${researchBlock}
${financialsBlock}

---

Write the memo now. Be sharp, specific, and honest about what you know versus what requires further diligence.`
}
