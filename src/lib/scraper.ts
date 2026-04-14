import { load } from 'cheerio'
import type { ScrapeResult } from './types'

export async function scrapeCompany(url: string): Promise<ScrapeResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    const $ = load(html)

    // Remove noise
    $('script, style, nav, footer, header, noscript, iframe, svg').remove()

    const title = $('title').text().trim()
    const metaDescription =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      ''
    const ogTitle =
      $('meta[property="og:title"]').attr('content') || ''

    const companyName =
      ogTitle.split('|')[0].split('-')[0].trim() ||
      title.split('|')[0].split('-')[0].trim() ||
      new URL(url).hostname.replace('www.', '')

    // Extract meaningful text from key sections
    const contentSelectors = [
      'main',
      'article',
      '[class*="hero"]',
      '[class*="about"]',
      '[class*="product"]',
      '[class*="feature"]',
      '[class*="solution"]',
      '[class*="content"]',
      'section',
      'body',
    ]

    let mainText = ''
    for (const selector of contentSelectors) {
      const text = $(selector).first().text()
      if (text.trim().length > 200) {
        mainText = text
        break
      }
    }

    // Collect headings for structure
    const headings: string[] = []
    $('h1, h2, h3').each((_, el) => {
      const text = $(el).text().trim()
      if (text.length > 2 && text.length < 120) headings.push(text)
    })

    // Clean up whitespace
    const cleanText = (text: string) =>
      text.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

    const rawText = cleanText(
      [
        headings.slice(0, 15).join(' | '),
        mainText,
      ]
        .filter(Boolean)
        .join('\n\n')
    ).slice(0, 4000)

    return {
      companyName,
      description: metaDescription.slice(0, 300),
      rawText,
      url,
    }
  } catch (error) {
    // Graceful fallback — memo can still generate from file data + URL
    return {
      companyName: new URL(url).hostname.replace('www.', ''),
      description: '',
      rawText: '',
      url,
    }
  }
}
