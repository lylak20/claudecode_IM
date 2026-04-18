export interface ScrapeResult {
  companyName: string
  description: string
  rawText: string
  url: string
}

export interface MemoConfig {
  url: string
  sections: string[]
  sectionNotes?: Record<string, string>
  fileContent?: string
  scrapeResult?: ScrapeResult
  research?: string
  investmentAmount?: string
  valuation?: string
  screenshotUrls?: { product?: string; pricing?: string }
  tone?: 'bullets' | 'prose'
}

export const ALL_SECTIONS = [
  'Product',
  'Technology',
  'Business Model',
  'Team',
  'Market',
  'Competitors',
  'Financials',
  'Investment Returns Analysis',
  'Investment Highlight',
  'Investment Risk',
] as const

export type SectionName = (typeof ALL_SECTIONS)[number]
