// One data interface for the admin, the Finder and the home page.
//
//  - "local" mode (default): everything lives in this browser (IndexedDB),
//    seeded with the sample listings. Good for demos and for trying /admin
//    before Luxarea's database exists. Nothing is shared between devices.
//  - "supabase" mode: set VITE_DATA_MODE=supabase plus VITE_SUPABASE_URL and
//    VITE_SUPABASE_ANON_KEY. Schema: supabase/migrations/001_init.sql.
import type { Property } from './listings'
import type { HomeContent } from '../content/types'

export type ListingStatus = 'draft' | 'published' | 'archived'

export interface Listing extends Property {
  status: ListingStatus
  updatedAt: string
  updatedBy?: string
  /** Where it came from, e.g. a WhatsApp draft id. */
  sourceDraftId?: string
}

export type DraftSource = 'whatsapp' | 'scan' | 'manual'
export type DraftStatus = 'new' | 'approved' | 'rejected'

/** What the AI (or a person) pulled out of a message or web page. All optional. */
export interface Extracted {
  name?: string
  developer?: string
  locality?: string
  city?: string
  segment?: 'Luxury Residences' | 'Vacation Homes'
  bhk?: number
  carpetSqft?: number
  floor?: number
  totalFloors?: number
  priceCr?: number | null
  possession?: string
  rera?: string
  offMarket?: boolean
  summary?: string
}

export interface Draft {
  id: string
  source: DraftSource
  receivedAt: string
  /** WhatsApp sender name/number, or the website the scan found it on. */
  from?: string
  sourceUrl?: string
  rawText: string
  media: string[]
  extracted: Extracted
  status: DraftStatus
  listingId?: string
  note?: string
  /** True for the demo items seeded in local mode. */
  sample?: boolean
}

export interface User {
  email: string
  name: string
  role: 'admin' | 'editor'
}

export interface Store {
  mode: 'local' | 'supabase'
  currentUser(): Promise<User | null>
  signIn(email: string): Promise<'signed-in' | 'check-email'>
  signOut(): Promise<void>

  listListings(): Promise<Listing[]>
  saveListing(l: Listing): Promise<Listing>
  deleteListing(id: string): Promise<void>
  /** Published listings, for the public Finder. */
  listPublished(): Promise<Property[]>

  listDrafts(): Promise<Draft[]>
  saveDraft(d: Draft): Promise<Draft>

  /** The home page: the team's working copy and what is live. */
  getContent(): Promise<{ draft: HomeContent; published: HomeContent }>
  saveContentDraft(c: HomeContent): Promise<void>
  publishContent(c: HomeContent): Promise<{ rebuild: 'started' | 'local' | 'not-configured' }>

  /** Resizes and stores an image, returns its URL. */
  uploadImage(file: File, folder: string): Promise<string>
}

export const DATA_MODE: 'local' | 'supabase' = import.meta.env.VITE_DATA_MODE === 'supabase' ? 'supabase' : 'local'

let storePromise: Promise<Store> | null = null

export function getStore(): Promise<Store> {
  storePromise ??= DATA_MODE === 'supabase'
    ? import('./supabaseStore').then((m) => m.createSupabaseStore())
    : import('./localStore').then((m) => m.createLocalStore())
  return storePromise
}

/** Strips admin-only fields so the public Finder gets plain Property objects. */
export function toProperty(l: Listing): Property {
  const { status: _s, updatedAt: _u, updatedBy: _b, sourceDraftId: _d, ...p } = l
  return p
}

export function newId(prefix = '') {
  const r = crypto.getRandomValues(new Uint32Array(2))
  return prefix + r[0].toString(36) + r[1].toString(36)
}

/** Downscale an image in the browser before storing it (max 1600px, JPEG). */
export async function resizeImage(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read image'))), 'image/jpeg', 0.84))
}
