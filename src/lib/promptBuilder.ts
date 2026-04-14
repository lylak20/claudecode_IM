import type { MemoConfig } from './types'

export function buildMemoPrompt(config: MemoConfig): string {
  const { url, sections, fileContent, scrapeResult } = config

  const companyContext = scrapeResult?.rawText
    ? `Company Name: ${scrapeResult.companyName}
Website: ${url}
Description: ${scrapeResult.description}

Website Content:
${scrapeResult.rawText}`
    : `Company Website: ${url}
Company Name: ${scrapeResult?.companyName || new URL(url).hostname.replace('www.', '')}`

  const financialsContext = fileContent
    ? `\n\nFinancial / Supporting Data (from uploaded file):\n${fileContent}`
    : '\n\nNote: No financial documents were provided. Note where additional financial diligence is needed.'

  const sectionInstructions = sections.map((s) => `- ${s}`).join('\n')

  return `You are a senior analyst at a top-tier venture capital and growth equity firm. Write a professional investment memo for the company described below.

Include ONLY the following sections (in this order):
${sectionInstructions}

Instructions for each section:
- Use "## [Section Name]" as the header (H2 markdown, exactly as listed above)
- Write 2–4 focused paragraphs, OR a short paragraph followed by 4–6 bullet points
- Be analytical, precise, and insightful — not promotional
- Identify both opportunities and risks where relevant
- Cite specific data, product details, or market facts from the provided content wherever possible
- Where data is missing, state clearly what additional diligence is required
- Avoid generic filler language; every sentence should add analytical value

Tone: Professional VC/growth equity memo. Direct and substantive. Institutional quality.

---

COMPANY INFORMATION:
${companyContext}
${financialsContext}

---

Begin with a concise Executive Summary paragraph (2–3 sentences) before any section header. Do NOT include a document title — start directly with the executive summary. Format the entire output in clean markdown.`
}
