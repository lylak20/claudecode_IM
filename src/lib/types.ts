export interface ScrapeResult {
  companyName: string
  description: string
  rawText: string
  url: string
}

export interface MemoConfig {
  url: string
  sections: string[]
  fileContent?: string
  scrapeResult?: ScrapeResult
}

export const ALL_SECTIONS = [
  'Product',
  'Technology',
  'Business Model',
  'Team',
  'Market',
  'Competitors',
  'Financials',
  'Unit Economics',
  'Investment Highlight',
  'Investment Risk',
] as const

export type SectionName = (typeof ALL_SECTIONS)[number]
