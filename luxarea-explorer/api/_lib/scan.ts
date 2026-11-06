// Daily scan: reads an allow-list of public news and developer feeds, keeps
// items about the places and kinds of deals Luxarea works in, and saves each
// new one as an inbox draft (facts and a link, never copied photos).
// Nothing is published: the team decides in the admin.
import { createHash } from 'node:crypto'
import { extractListing } from '../../src/data/extract'
import { findPlace } from '../../src/data/places'
import type { Extracted } from '../../src/data/store'
import type { Db } from './db'
import type { FillResult } from './ai'
import { SOURCES, type ScanSource } from './scan-sources'

export interface FeedItem {
  title: string
  link: string
  description: string
  published?: string
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()

/** Minimal RSS 2.0 and Atom reader (no dependencies). */
export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = []
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) ?? []
  const tag = (b: string, t: string) => {
    const m = b.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`))
    return m ? decode(m[1]) : ''
  }
  for (const b of blocks) {
    const atomLink = b.match(/<link[^>]*href="([^"]+)"/)
    const link = tag(b, 'link') || atomLink?.[1] || tag(b, 'guid')
    const title = tag(b, 'title')
    if (!title || !link) continue
    items.push({ title, link, description: tag(b, 'description') || tag(b, 'summary') || tag(b, 'content'), published: tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published') })
  }
  return items
}

// Strong signals: an actual project, home or land deal.
const DEAL = /\b(launch(?:es|ed)?|new project|tower|residences?|luxury|premium|ultra[- ]luxury|sea[- ]facing|penthouse|villa|bungalow|duplex|apartments?|flats?|plot(?:ted)?|land parcel|acres?|redevelopment|joint development|jda|bhk|acquires?|buys?|bought|sold)\b/i
// Weak signal: money alone ("₹11 crore audit") isn't a property story.
const MONEY = /\b(crore|cr|aed|dirhams?)\b/i
const NOISE = /\b(warehous\w*|industrial|office space|co-?working|retail mall|data cent\w*|logistics|stamp duty collection|repo rate|nclt|tribunal|court|dispute|insolvency|civic|audit|bmc|mhada|cidco|slum|affordable|pmay|metro line|traffic)\b/i

/** Is this item about a place Luxarea covers AND a property signal? Returns a score (0 = skip). */
export function relevance(item: FeedItem): number {
  const text = `${item.title} ${item.description}`
  const place = findPlace(text)
  if (!place) return 0
  if (NOISE.test(item.title)) return 0
  let score = place.name === 'Mumbai' ? 1 : 2 // a specific locality beats just "Mumbai"
  if (DEAL.test(item.title)) score += 2
  else if (DEAL.test(item.description)) score += 1
  if (MONEY.test(item.title)) score += 1
  return score >= 3 && (DEAL.test(item.title) || DEAL.test(item.description)) ? score : 0
}

export interface ScanDeps {
  db: Db
  fill: (text: string, rules: Extracted) => Promise<FillResult>
  fetchImpl?: typeof fetch
  sources?: ScanSource[]
  /** Upper bound on AI calls per run, to keep costs predictable. */
  maxAiCalls?: number
}

export interface ScanReport {
  sourcesChecked: number
  itemsSeen: number
  relevant: number
  draftsCreated: number
  duplicates: number
  errors: string[]
}

const hostAllowed = (url: string, src: ScanSource) => {
  try {
    const h = new URL(url).hostname
    return src.allowHosts.some((a) => h === a || h.endsWith(`.${a}`))
  } catch {
    return false
  }
}

export async function runScan(deps: ScanDeps): Promise<ScanReport> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const sources = deps.sources ?? SOURCES
  const report: ScanReport = { sourcesChecked: 0, itemsSeen: 0, relevant: 0, draftsCreated: 0, duplicates: 0, errors: [] }
  let aiCalls = 0
  const maxAi = deps.maxAiCalls ?? 25

  for (const src of sources) {
    // Allow-list: only fetch the source's own host.
    if (!hostAllowed(src.url, src)) {
      report.errors.push(`${src.id}: feed URL is not on its allow-list`)
      continue
    }
    try {
      const res = await fetchImpl(src.url, { headers: { 'User-Agent': 'LuxareaScan/1.0 (+https://www.luxarea.in)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const items = parseFeed(await res.text())
      report.sourcesChecked++
      report.itemsSeen += items.length
      for (const item of items) {
        if (!hostAllowed(item.link, src) || relevance(item) === 0) continue
        report.relevant++
        const text = `${item.title}. ${item.description}`
        const rules = extractListing(text)
        const filled = aiCalls < maxAi ? (aiCalls++, await deps.fill(text, rules)) : { fields: rules, dropped: [], usedAI: false }
        const row = await deps.db.insertDraft({
          source: 'scan',
          external_id: `scan:${createHash('sha1').update(item.link).digest('hex')}`,
          from_label: src.label,
          source_url: item.link,
          raw_text: text,
          extracted: { ...filled.fields, summary: filled.fields.summary ?? item.title },
          note: filled.dropped.length ? `AI suggestions not in the source, left blank: ${filled.dropped.join(', ')}` : undefined,
        })
        if (row) report.draftsCreated++
        else report.duplicates++
      }
    } catch (e) {
      report.errors.push(`${src.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return report
}
