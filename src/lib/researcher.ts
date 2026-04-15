import { load } from 'cheerio'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function fetchSafe(url: string, opts: RequestInit = {}, timeoutMs = 7000): Promise<string> {
  try {
    const res = await fetch(url, {
      ...opts,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return ''
    return await res.text()
  } catch {
    return ''
  }
}

// Scrape a single page and return cleaned text
async function scrapePage(url: string, maxChars = 2500): Promise<string> {
  const html = await fetchSafe(url)
  if (!html) return ''
  const $ = load(html)
  $('script, style, nav, footer, header, noscript, iframe, svg, [class*="cookie"], [class*="banner"]').remove()
  const text = $('main, article, [class*="content"], [class*="about"], body')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, maxChars)
}

// Scrape homepage + key subpages (About, Blog, Team, Pricing, Product)
async function scrapeCompanyDeep(baseUrl: string, homepageHtml: string): Promise<string> {
  const base = new URL(baseUrl)
  const $ = load(homepageHtml)
  $('script, style, nav, footer, header, noscript').remove()

  // Find internal links that look like key pages
  const keyPattern = /\b(about|team|blog|pricing|product|platform|solution|feature|how.it.works|press|news|investor|story|mission|customer|case.stud)\b/i
  const seen = new Set<string>([baseUrl])
  const toFetch: string[] = []

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const linkText = ($(el).text() + ' ' + href).toLowerCase()
    if (!keyPattern.test(linkText)) return
    try {
      const full = href.startsWith('http') ? href : new URL(href, baseUrl).toString()
      const parsed = new URL(full)
      if (parsed.hostname === base.hostname && !seen.has(full)) {
        seen.add(full)
        toFetch.push(full)
      }
    } catch {}
  })

  // Fetch up to 5 subpages in parallel
  const subpageResults = await Promise.allSettled(
    toFetch.slice(0, 5).map((link) => scrapePage(link))
  )

  const homepageText = $('main, article, [class*="content"], body')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2500)

  const subpageTexts = subpageResults
    .map((r) => (r.status === 'fulfilled' ? r.value : ''))
    .filter(Boolean)
    .join('\n\n')

  return [homepageText, subpageTexts].filter(Boolean).join('\n\n').slice(0, 7000)
}

// Google News RSS — no API key needed
async function searchGoogleNews(companyName: string): Promise<string> {
  const q = encodeURIComponent(`"${companyName}"`)
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`
  const xml = await fetchSafe(url)
  if (!xml) return ''

  const $ = load(xml, { xmlMode: true })
  const items: string[] = []

  $('item').slice(0, 8).each((_, el) => {
    const title = $(el).find('title').text().trim()
    const pubDate = $(el).find('pubDate').text().trim()
    const desc = $(el).find('description').text().replace(/<[^>]+>/g, '').trim().slice(0, 180)
    if (title) items.push(`• ${title}${pubDate ? ` (${pubDate})` : ''}\n  ${desc}`)
  })

  return items.length ? `Recent News:\n${items.join('\n\n')}` : ''
}

// Reddit public search JSON — no API key needed
async function searchReddit(companyName: string): Promise<string> {
  const q = encodeURIComponent(companyName)
  const url = `https://www.reddit.com/search.json?q=${q}&sort=relevance&limit=10&type=link`
  const raw = await fetchSafe(url, { headers: { 'User-Agent': 'lyla-memo-researcher/1.0' } })
  if (!raw) return ''

  let data: any
  try { data = JSON.parse(raw) } catch { return '' }

  const posts = (data?.data?.children || []).slice(0, 6)
  if (!posts.length) return ''

  const items = posts.map((post: any) => {
    const p = post.data
    const body = p.selftext?.trim().slice(0, 250) || '[link post]'
    return `• "${p.title}" — ${p.subreddit_name_prefixed} (${p.score} upvotes)\n  ${body}`
  })

  return `Reddit Community Sentiment:\n${items.join('\n\n')}`
}

// Hacker News via Algolia API — no API key needed
async function searchHackerNews(companyName: string): Promise<string> {
  const q = encodeURIComponent(companyName)
  const url = `https://hn.algolia.com/api/v1/search?query=${q}&tags=story&hitsPerPage=6`
  const raw = await fetchSafe(url)
  if (!raw) return ''

  let data: any
  try { data = JSON.parse(raw) } catch { return '' }

  const hits = (data?.hits || []).slice(0, 6)
  if (!hits.length) return ''

  const items = hits.map((h: any) =>
    `• "${h.title}" — ${h.points ?? 0} pts, ${h.num_comments ?? 0} comments (${h.created_at?.slice(0, 10) || ''})`
  )

  return `Hacker News Discussions:\n${items.join('\n')}`
}

// Main entry point — runs all research in parallel
export async function conductResearch(
  url: string,
  companyName: string,
  homepageHtml: string
): Promise<string> {
  const [deepScrape, news, reddit, hn] = await Promise.allSettled([
    scrapeCompanyDeep(url, homepageHtml),
    searchGoogleNews(companyName),
    searchReddit(companyName),
    searchHackerNews(companyName),
  ])

  const parts: { label: string; value: string }[] = [
    { label: 'COMPANY WEBSITE (homepage + subpages)', value: deepScrape.status === 'fulfilled' ? deepScrape.value : '' },
    { label: 'NEWS', value: news.status === 'fulfilled' ? news.value : '' },
    { label: 'REDDIT', value: reddit.status === 'fulfilled' ? reddit.value : '' },
    { label: 'HACKER NEWS', value: hn.status === 'fulfilled' ? hn.value : '' },
  ]

  return parts
    .filter((p) => p.value.trim())
    .map((p) => `=== ${p.label} ===\n${p.value}`)
    .join('\n\n')
}
