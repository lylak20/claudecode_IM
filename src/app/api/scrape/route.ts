import { scrapeCompany } from '@/lib/scraper'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return Response.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    const result = await scrapeCompany(url)
    return Response.json(result)
  } catch (error) {
    return Response.json(
      { error: 'Failed to scrape URL' },
      { status: 500 }
    )
  }
}
