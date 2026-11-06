// The daily scan reads only these feeds. Add a developer's newsroom or
// project feed here (with its host on allowHosts) and redeploy.
//
// Deliberately NOT here:
//  - Broker portals (99acres, MagicBricks, Housing.com, Square Yards): their
//    terms forbid scraping and the listings are their content.
//  - MahaRERA: no public feed or API, and its search is behind a captcha. Check
//    new registrations by hand, or add a feed if MahaRERA publishes one.
//  - Dubai Land Department open data: needs a Dubai Pulse API key; add it as a
//    source once Luxarea registers.
export interface ScanSource {
  id: string
  label: string
  url: string
  /** Hosts the feed and its article links may come from. */
  allowHosts: string[]
}

export const SOURCES: ScanSource[] = [
  {
    id: 'et-realty-residential',
    label: 'ET Realty · Residential',
    url: 'https://realty.economictimes.indiatimes.com/rss/residential',
    allowHosts: ['realty.economictimes.indiatimes.com'],
  },
  {
    id: 'et-realty-top',
    label: 'ET Realty · Top stories',
    url: 'https://realty.economictimes.indiatimes.com/rss/topstories',
    allowHosts: ['realty.economictimes.indiatimes.com'],
  },
  {
    id: 'ht-real-estate',
    label: 'Hindustan Times · Real estate',
    url: 'https://www.hindustantimes.com/feeds/rss/real-estate/rssfeed.xml',
    allowHosts: ['hindustantimes.com'],
  },
]
