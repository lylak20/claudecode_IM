import { conductResearch } from '@/lib/researcher'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 45

export async function POST(request: NextRequest) {
  try {
    const { url, companyName, homepageHtml } = await request.json()
    if (!url || !companyName) {
      return Response.json({ error: 'url and companyName required' }, { status: 400 })
    }
    const result = await conductResearch(url, companyName, homepageHtml || '')
    return Response.json({ research: result.research, screenshotUrls: result.screenshotUrls })
  } catch {
    return Response.json({ research: '', screenshotUrls: {} })
  }
}
