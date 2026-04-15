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

    const research = await conductResearch(url, companyName, homepageHtml || '')
    return Response.json({ research })
  } catch {
    // Always return something so the memo can still generate
    return Response.json({ research: '' })
  }
}
