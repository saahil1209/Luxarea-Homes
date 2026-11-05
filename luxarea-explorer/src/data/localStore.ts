// Browser-only store for demos (IndexedDB). See store.ts.
import { SAMPLE_PROPERTIES } from './listings'
import homeJson from '../../content/home.json'
import type { HomeContent } from '../content/types'
import { resizeImage, toProperty, type Draft, type Listing, type Store, type User } from './store'

const DB = 'luxarea-demo'
const OS = 'kv'

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(OS)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function get<T>(key: string): Promise<T | undefined> {
  const db = await idb()
  return new Promise((resolve, reject) => {
    const r = db.transaction(OS).objectStore(OS).get(key)
    r.onsuccess = () => resolve(r.result as T | undefined)
    r.onerror = () => reject(r.error)
  })
}

async function set(key: string, value: unknown): Promise<void> {
  const db = await idb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OS, 'readwrite')
    tx.objectStore(OS).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Lets the public home page know there is locally published demo content to show. */
export const DEMO_CONTENT_FLAG = 'luxarea-demo-content'

const USER_KEY = 'luxarea-demo-user'

function now() {
  return new Date().toISOString()
}

function seedListings(): Listing[] {
  return SAMPLE_PROPERTIES.map((p) => ({ ...structuredClone(p), status: 'published', updatedAt: '2026-11-05T00:00:00.000Z', updatedBy: 'sample data' }))
}

function seedDrafts(): Draft[] {
  const h = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600_000).toISOString()
  return [
    {
      id: 'demo-wa-1', source: 'whatsapp', receivedAt: h(2), from: 'Shweta (forwarded)', sample: true, status: 'new', media: [],
      rawText: 'Fresh resale 🔥 Worli, sea facing 4 BHK, 3,450 carpet, 31st floor, 3 parking. Asking 29.5 Cr negotiable. OC received. Owner wants quick close. Pls dont share outside group',
      extracted: { locality: 'Worli', city: 'Mumbai', segment: 'Luxury Residences', bhk: 4, carpetSqft: 3450, floor: 31, priceCr: 29.5, possession: 'Ready (OC received)', offMarket: true, summary: 'Sea-facing 4 BHK resale on the 31st floor, 3 car parks, owner wants a quick close.' },
    },
    {
      id: 'demo-wa-2', source: 'whatsapp', receivedAt: h(20), from: 'Saurabh (forwarded)', sample: true, status: 'new', media: [],
      rawText: 'Alibaug Mandwa — 1 acre NA plot, 7/12 clear, 600m from jetty. 11 Cr. CRZ to be checked.',
      extracted: { locality: 'Mandwa, Alibaug', city: 'Alibaug', segment: 'Vacation Homes', priceCr: 11, summary: 'One-acre NA plot 600 m from Mandwa jetty. CRZ status still to be checked.' },
    },
    {
      id: 'demo-scan-1', source: 'scan', receivedAt: h(9), from: 'MahaRERA new registrations', sourceUrl: 'https://maharera.maharashtra.gov.in', sample: true, status: 'new', media: [],
      rawText: 'New project registered: sample tower, Prabhadevi, Mumbai City. 48 storeys. Proposed completion: Dec 2030.',
      extracted: { name: 'Sample tower (Prabhadevi)', locality: 'Prabhadevi', city: 'Mumbai', segment: 'Luxury Residences', totalFloors: 48, possession: 'December 2030', rera: 'P519000000XX (sample)', summary: 'New 48-storey project registered on MahaRERA. Developer pricing not yet public.' },
    },
    {
      id: 'demo-scan-2', source: 'scan', receivedAt: h(30), from: 'Developer press release', sourceUrl: 'https://example.com/press', sample: true, status: 'new', media: [],
      rawText: 'Sample Developer F announces the launch of a 3 and 4 BHK residential tower in Bandra West, with homes from ₹14 Cr.',
      extracted: { name: 'Sample Developer F tower', developer: 'Sample Developer F', locality: 'Bandra West', city: 'Mumbai', segment: 'Luxury Residences', bhk: 4, priceCr: 14, summary: 'Launch announced: 3 and 4 BHK homes in Bandra West, from ₹14 Cr.' },
    },
  ]
}

export async function createLocalStore(): Promise<Store> {
  if (!(await get('seeded'))) {
    await set('listings', seedListings())
    await set('drafts', seedDrafts())
    const c = homeJson as unknown as HomeContent
    await set('content', { draft: c, published: c })
    await set('seeded', true)
  }

  return {
    mode: 'local',

    async currentUser() {
      try {
        const raw = localStorage.getItem(USER_KEY)
        return raw ? (JSON.parse(raw) as User) : null
      } catch {
        return null
      }
    },
    async signIn(email) {
      const name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      try {
        localStorage.setItem(USER_KEY, JSON.stringify({ email, name, role: 'admin' } satisfies User))
      } catch {
        /* private mode: signed in for this page only */
      }
      return 'signed-in'
    },
    async signOut() {
      try {
        localStorage.removeItem(USER_KEY)
      } catch {
        /* ignore */
      }
    },

    async listListings() {
      return (await get<Listing[]>('listings')) ?? []
    },
    async saveListing(l) {
      const list = (await get<Listing[]>('listings')) ?? []
      const saved = { ...l, updatedAt: now() }
      const i = list.findIndex((x) => x.id === l.id)
      if (i >= 0) list[i] = saved
      else list.unshift(saved)
      await set('listings', list)
      return saved
    },
    async deleteListing(id) {
      const list = (await get<Listing[]>('listings')) ?? []
      await set('listings', list.filter((x) => x.id !== id))
    },
    async listPublished() {
      const list = (await get<Listing[]>('listings')) ?? []
      return list.filter((l) => l.status === 'published').map(toProperty)
    },

    async listDrafts() {
      const d = (await get<Draft[]>('drafts')) ?? []
      return d.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    },
    async saveDraft(d) {
      const list = (await get<Draft[]>('drafts')) ?? []
      const i = list.findIndex((x) => x.id === d.id)
      if (i >= 0) list[i] = d
      else list.unshift(d)
      await set('drafts', list)
      return d
    },

    async getContent() {
      return (await get<{ draft: HomeContent; published: HomeContent }>('content'))!
    },
    async saveContentDraft(c) {
      const cur = (await get<{ draft: HomeContent; published: HomeContent }>('content'))!
      await set('content', { ...cur, draft: c })
    },
    async publishContent(c) {
      const published = { ...c, updatedAt: now() }
      await set('content', { draft: published, published })
      try {
        localStorage.setItem(DEMO_CONTENT_FLAG, published.updatedAt)
      } catch {
        /* ignore */
      }
      return { rebuild: 'local' }
    },

    async uploadImage(file) {
      const blob = await resizeImage(file)
      return new Promise<string>((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result))
        fr.onerror = () => reject(fr.error)
        fr.readAsDataURL(blob)
      })
    },
  }
}

/** For the public home page in demo mode: the locally published content, if any. */
export async function readLocalPublished(): Promise<HomeContent | null> {
  try {
    if (!localStorage.getItem(DEMO_CONTENT_FLAG)) return null
  } catch {
    return null
  }
  const c = await get<{ published: HomeContent }>('content')
  return c?.published ?? null
}
