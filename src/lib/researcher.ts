import { load } from 'cheerio'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function fetchSafe(url: string, opts: RequestInit = {}, timeoutMs = 8000): Promise<string> {
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

// ─── Website scraping ────────────────────────────────────────────────────────

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

async function scrapeCompanyDeep(baseUrl: string, homepageHtml: string): Promise<{ text: string; productUrl?: string; pricingUrl?: string }> {
  const base = new URL(baseUrl)
  const $ = load(homepageHtml)
  $('script, style, nav, footer, header, noscript').remove()

  const keyPattern = /\b(about|team|blog|pricing|plans?|subscribe|subscription|upgrade|buy|product|platform|solution|feature|how.it.works|press|news|investor|story|mission|customer|case.stud)\b/i
  const seen = new Set<string>([baseUrl])
  const toFetch: string[] = []
  let productUrl: string | undefined
  let pricingUrl: string | undefined

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const anchorText = $(el).text().trim().toLowerCase()
    const linkText = (anchorText + ' ' + href).toLowerCase()
    if (!keyPattern.test(linkText)) return
    try {
      const full = href.startsWith('http') ? href : new URL(href, baseUrl).toString()
      const parsed = new URL(full)
      if (parsed.hostname === base.hostname && !seen.has(full)) {
        seen.add(full)
        toFetch.push(full)
        if (!productUrl && /about|product|platform|feature|solution/i.test(parsed.pathname)) productUrl = full
        // Match pricing by path OR by anchor text (some sites use /buy, /subscribe, /upgrade, or hashed routes)
        const pricingPath = /pricing|plans|subscription|\/buy\b|subscribe|upgrade/i.test(parsed.pathname)
        const pricingAnchor = /^(pricing|plans|plan|buy|subscribe|upgrade|get started|start free)$/i.test(anchorText)
        if (!pricingUrl && (pricingPath || pricingAnchor)) pricingUrl = full
      }
    } catch {}
  })

  const subpageResults = await Promise.allSettled(toFetch.slice(0, 5).map(link => scrapePage(link)))
  const homepageText = $('main, article, [class*="content"], body').first().text().replace(/\s+/g, ' ').trim().slice(0, 2500)
  const subpageTexts = subpageResults.map(r => r.status === 'fulfilled' ? r.value : '').filter(Boolean).join('\n\n')
  const text = [homepageText, subpageTexts].filter(Boolean).join('\n\n').slice(0, 7000)
  return { text, productUrl, pricingUrl }
}

// ─── Wikipedia API ────────────────────────────────────────────────────────────
// Free, no API key. Returns the intro paragraph + infobox data for a company.

async function searchWikipedia(companyName: string): Promise<string> {
  try {
    // Step 1: find the page title
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(companyName + ' company')}&format=json&srlimit=1&utf8=1`
    const searchRaw = await fetchSafe(searchUrl)
    if (!searchRaw) return ''
    const searchData = JSON.parse(searchRaw)
    const title: string = searchData?.query?.search?.[0]?.title || ''
    if (!title) return ''

    // Step 2: fetch intro extract
    const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&exintro=true&explaintext=true&format=json&utf8=1`
    const extractRaw = await fetchSafe(extractUrl)
    if (!extractRaw) return ''
    const extractData = JSON.parse(extractRaw)
    const pages = extractData?.query?.pages || {}
    const extract: string = (Object.values(pages)[0] as any)?.extract || ''
    if (!extract) return ''
    return `Wikipedia — ${title}:\n${extract.slice(0, 2000)}`
  } catch {
    return ''
  }
}

// ─── DuckDuckGo Instant Answers ───────────────────────────────────────────────
// Free, no API key. Good for infobox data: founders, CEO, funding, headquarters.

async function searchDuckDuckGo(query: string): Promise<string> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    const raw = await fetchSafe(url)
    if (!raw) return ''
    const d = JSON.parse(raw)
    const parts: string[] = []

    if (d.AbstractText) parts.push(d.AbstractText)
    if (d.Answer) parts.push(`Answer: ${d.Answer}`)

    // Pull structured infobox fields (founders, funding, CEO, etc.)
    const infobox: any[] = d.Infobox?.content || []
    const wantedLabels = /founder|ceo|chief|funding|investor|raised|founded|headquarter|employee|valuation/i
    const infoItems = infobox
      .filter(item => item.label && item.value && wantedLabels.test(item.label))
      .map(item => `${item.label}: ${item.value}`)
    if (infoItems.length) parts.push(infoItems.join(' | '))

    return parts.length ? `DuckDuckGo — ${query}:\n${parts.join('\n')}` : ''
  } catch {
    return ''
  }
}

// ─── DuckDuckGo HTML search (snippet scrape) ──────────────────────────────────
// Free, no API key. Returns real web search snippets — much better than the
// Instant Answer API for things like founder bios that live in article snippets.

async function searchDuckDuckGoHTML(query: string, maxResults = 8): Promise<string> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const html = await fetchSafe(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }, 10000)
    if (!html) return ''
    const $ = load(html)
    const items: string[] = []
    $('.result').slice(0, maxResults).each((_, el) => {
      const title = $(el).find('.result__title, .result__a').first().text().trim()
      const snippet = $(el).find('.result__snippet').first().text().replace(/\s+/g, ' ').trim()
      if (snippet && snippet.length > 30) {
        items.push(title ? `• ${title}\n  ${snippet}` : `• ${snippet}`)
      }
    })
    return items.length ? `Web snippets — "${query}":\n${items.join('\n\n')}` : ''
  } catch {
    return ''
  }
}

// ─── Team / Founder research ──────────────────────────────────────────────────
// Runs several targeted queries and concatenates snippets. Designed to surface
// the kind of bio info that appears in a Google knowledge panel (name, title,
// prior company, education) for the memo's Team section.

async function researchTeam(companyName: string): Promise<string> {
  const queries = [
    `${companyName} founders CEO CTO background`,
    `${companyName} founders previously worked at`,
    `"${companyName}" co-founder biography`,
  ]
  const results = await Promise.allSettled(queries.map(q => searchDuckDuckGoHTML(q, 6)))
  const combined = results
    .map(r => r.status === 'fulfilled' ? r.value : '')
    .filter(Boolean)
    .join('\n\n')
  return combined
}

// ─── Google News RSS ──────────────────────────────────────────────────────────

async function searchGoogleNews(query: string, maxItems = 6): Promise<string> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
    const xml = await fetchSafe(url)
    if (!xml) return ''
    const $ = load(xml, { xmlMode: true })
    const items: string[] = []
    $('item').slice(0, maxItems).each((_, el) => {
      const title = $(el).find('title').text().trim()
      const pubDate = $(el).find('pubDate').text().trim()
      const desc = $(el).find('description').text().replace(/<[^>]+>/g, '').trim().slice(0, 200)
      if (title) items.push(`• ${title}${pubDate ? ` (${pubDate})` : ''}\n  ${desc}`)
    })
    return items.length ? items.join('\n\n') : ''
  } catch {
    return ''
  }
}

// ─── Reddit ───────────────────────────────────────────────────────────────────

async function searchReddit(companyName: string): Promise<string> {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(companyName)}&sort=relevance&limit=10&type=link`
    const raw = await fetchSafe(url, { headers: { 'User-Agent': 'lyla-memo-researcher/1.0' } })
    if (!raw) return ''
    const data = JSON.parse(raw)
    const posts = (data?.data?.children || []).slice(0, 6)
    if (!posts.length) return ''
    const items = posts.map((post: any) => {
      const p = post.data
      const body = p.selftext?.trim().slice(0, 250) || '[link post]'
      return `• "${p.title}" — ${p.subreddit_name_prefixed} (${p.score} upvotes)\n  ${body}`
    })
    return `Reddit:\n${items.join('\n\n')}`
  } catch {
    return ''
  }
}

// ─── Hacker News ──────────────────────────────────────────────────────────────

async function searchHackerNews(companyName: string): Promise<string> {
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(companyName)}&tags=story&hitsPerPage=6`
    const raw = await fetchSafe(url)
    if (!raw) return ''
    const data = JSON.parse(raw)
    const hits = (data?.hits || []).slice(0, 6)
    if (!hits.length) return ''
    const items = hits.map((h: any) =>
      `• "${h.title}" — ${h.points ?? 0} pts, ${h.num_comments ?? 0} comments (${h.created_at?.slice(0, 10) || ''})`
    )
    return `Hacker News:\n${items.join('\n')}`
  } catch {
    return ''
  }
}

// ─── Competitor name extraction ───────────────────────────────────────────────
// Extracts likely competitor/company names from a block of research text.

function extractCompanyNames(text: string, excludeName: string): string[] {
  const found = new Map<string, number>()
  const excluded = new Set([
    excludeName.toLowerCase(),
    'google', 'microsoft', 'apple', 'amazon', 'meta', 'openai', 'anthropic',
    'the', 'this', 'that', 'with', 'from', 'their', 'have', 'been',
    'new', 'york', 'san', 'francisco', 'united', 'states',
  ])

  // Patterns that strongly signal a company name
  const patterns = [
    // "vs X" or "X vs"
    /\bvs\.?\s+([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]+)?)\b/g,
    /\b([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]+)?)\s+vs\b/g,
    // "competitor/rival/alternative X"
    /\b(?:competitor|rival|alternative)s?\s+(?:like|such as|including)?\s*([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]+)?)\b/g,
    // "X raised/funded/launched/backed"
    /\b([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]+)?)\s+(?:raised|secured|closed|launched|announced|backed|funded)\b/g,
    // "X, a [startup/company/platform]"
    /\b([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]+)?),\s+(?:a|an)\s+(?:AI|music|startup|company|platform|app)\b/g,
    // "[Company] AI" pattern
    /\b([A-Z][a-zA-Z]{3,})\s+AI\b/g,
  ]

  for (const pattern of patterns) {
    let match
    const re = new RegExp(pattern.source, pattern.flags)
    while ((match = re.exec(text)) !== null) {
      const name = match[1]?.trim()
      if (!name || name.length < 3 || excluded.has(name.toLowerCase())) continue
      // Skip obvious non-companies
      if (/^(The|This|That|These|Their|With|From|When|Where|What|How|Inc|LLC|Corp)$/i.test(name)) continue
      found.set(name, (found.get(name) || 0) + 1)
    }
  }

  return Array.from(found.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name)
}

// ─── Per-competitor deep research ─────────────────────────────────────────────

async function researchCompetitor(name: string): Promise<string> {
  const [wiki, ddgFunding, ddgFounders, news] = await Promise.allSettled([
    searchWikipedia(name),
    searchDuckDuckGo(`${name} funding investors valuation`),
    searchDuckDuckGo(`${name} founders CEO`),
    searchGoogleNews(`"${name}" funding raised investors founders`, 4),
  ])

  const parts = [
    wiki.status === 'fulfilled' ? wiki.value : '',
    ddgFunding.status === 'fulfilled' ? ddgFunding.value : '',
    ddgFounders.status === 'fulfilled' ? ddgFounders.value : '',
    news.status === 'fulfilled' ? news.value : '',
  ].filter(Boolean)

  return parts.length ? `--- ${name} ---\n${parts.join('\n')}` : ''
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface ResearchResult {
  research: string
  screenshotUrls: { product?: string; pricing?: string }
}

export async function conductResearch(
  url: string,
  companyName: string,
  homepageHtml: string
): Promise<ResearchResult> {

  // Phase 1: Company research (all in parallel)
  const [deepScrape, wiki, ddg, team, newsGeneral, newsFunding, newsCompetitors, reddit, hn] =
    await Promise.allSettled([
      scrapeCompanyDeep(url, homepageHtml),
      searchWikipedia(companyName),
      searchDuckDuckGo(`${companyName} founders CEO funding investors`),
      researchTeam(companyName),
      searchGoogleNews(`"${companyName}"`, 6),
      searchGoogleNews(`"${companyName}" funding raised investors valuation`, 4),
      searchGoogleNews(`"${companyName}" competitors rival alternative`, 4),
      searchReddit(companyName),
      searchHackerNews(companyName),
    ])

  const deepScrapeResult = deepScrape.status === 'fulfilled'
    ? deepScrape.value
    : { text: '', productUrl: undefined, pricingUrl: undefined }

  // Collect all phase-1 text to extract competitor names
  const phase1Texts = [
    deepScrapeResult.text,
    wiki.status === 'fulfilled' ? wiki.value : '',
    newsGeneral.status === 'fulfilled' ? newsGeneral.value : '',
    newsFunding.status === 'fulfilled' ? newsFunding.value : '',
    newsCompetitors.status === 'fulfilled' ? newsCompetitors.value : '',
  ].join('\n')

  const competitorNames = extractCompanyNames(phase1Texts, companyName)

  // Phase 2: Research each identified competitor in parallel
  const competitorResults = competitorNames.length > 0
    ? await Promise.allSettled(competitorNames.map(name => researchCompetitor(name)))
    : []

  const competitorData = competitorResults
    .map(r => r.status === 'fulfilled' ? r.value : '')
    .filter(Boolean)
    .join('\n\n')

  // Assemble final research document
  const parts: { label: string; value: string }[] = [
    { label: 'COMPANY WEBSITE (homepage + subpages)', value: deepScrapeResult.text },
    { label: 'WIKIPEDIA', value: wiki.status === 'fulfilled' ? wiki.value : '' },
    { label: 'COMPANY FACTS (DuckDuckGo)', value: ddg.status === 'fulfilled' ? ddg.value : '' },
    { label: 'TEAM / FOUNDER BIOS (web snippets)', value: team.status === 'fulfilled' ? team.value : '' },
    {
      label: 'NEWS',
      value: [
        newsGeneral.status === 'fulfilled' ? newsGeneral.value : '',
        newsFunding.status === 'fulfilled' ? newsFunding.value : '',
        newsCompetitors.status === 'fulfilled' ? newsCompetitors.value : '',
      ].filter(Boolean).join('\n\n'),
    },
    { label: 'REDDIT', value: reddit.status === 'fulfilled' ? reddit.value : '' },
    { label: 'HACKER NEWS', value: hn.status === 'fulfilled' ? hn.value : '' },
    { label: `COMPETITOR INTELLIGENCE (${competitorNames.join(', ') || 'none found'})`, value: competitorData },
  ]

  const research = parts
    .filter(p => p.value.trim())
    .map(p => `=== ${p.label} ===\n${p.value}`)
    .join('\n\n')

  const screenshotUrls: { product?: string; pricing?: string } = {}
  if (deepScrapeResult.productUrl) screenshotUrls.product = deepScrapeResult.productUrl
  if (deepScrapeResult.pricingUrl) screenshotUrls.pricing = deepScrapeResult.pricingUrl

  return { research, screenshotUrls }
}
