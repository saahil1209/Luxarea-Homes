// SAMPLE LISTINGS. Every property below is fictional (names, developers,
// prices, RERA numbers). Only the neighbourhoods are real. Replace this file,
// or swap it for a Google Sheet / database feed, before showing buyers.

export type Segment = 'Luxury Residences' | 'Vacation Homes'
export type Status = 'available' | 'reserved' | 'sold'

export interface ResidenceType {
  id: string
  name: string
  planId: string
  bhk: number
  baths: number
  carpetSqft: number
  facing: string
  /** Inclusive floor range this type occupies. */
  floors: [number, number]
  /** Price at the lowest floor of the range, in crore. null = price on request. */
  basePriceCr: number | null
  highlights: string[]
}

export interface Property {
  id: string
  name: string
  locality: string
  city: string
  segment: Segment
  lat: number
  lng: number
  tagline: string
  developer: string
  possession: string
  rera: string
  totalFloors: number
  /** Footprint of the tower in scene units (width, depth). */
  footprint: [number, number]
  form: 'tower' | 'villa'
  confidential?: boolean
  amenities: string[]
  residences: ResidenceType[]
  /** Fictional demo data: availability is generated, not real. */
  sample?: boolean
  /** Per-floor status and price set by the team. Keys are floor numbers. */
  floorOverrides?: Record<string, { status?: Status; priceCr?: number | null }>
  /** Photo URLs (uploaded in /admin). */
  photos?: { url: string; caption: string }[]
}

export interface FloorInfo {
  floor: number
  residence: ResidenceType
  status: Status
  priceCr: number | null
}

export const SAMPLE_PROPERTIES: Property[] = [
  {
    id: 'sea-ledger',
    name: 'The Sea Ledger',
    locality: 'Worli Sea Face',
    city: 'Mumbai',
    segment: 'Luxury Residences',
    lat: 19.0108,
    lng: 72.8158,
    tagline: 'Forty-two floors of uninterrupted Arabian Sea.',
    developer: 'Sample Developer A',
    possession: 'December 2027',
    rera: 'P51900000001 (sample)',
    totalFloors: 42,
    footprint: [7.2, 4.6],
    form: 'tower',
    amenities: ['Sky lounge on 40', '25 m lap pool', 'Valet & 4 car parks', 'Private lift lobbies', 'Spa & hammam'],
    residences: [
      { id: 'A', name: 'Residence A', planId: 'three', bhk: 3, baths: 4, carpetSqft: 2410, facing: 'West, sea view', floors: [4, 19], basePriceCr: 16.8, highlights: ['Sea-facing living room', 'Deck off the living room', 'Two car parks'] },
      { id: 'B', name: 'Residence B', planId: 'four', bhk: 4, baths: 5, carpetSqft: 3620, facing: 'West & north, sea view', floors: [20, 37], basePriceCr: 27.5, highlights: ['Wraparound deck', 'Staff room with separate entry', 'Three car parks'] },
      { id: 'P', name: 'Sky Penthouse', planId: 'penthouse', bhk: 5, baths: 7, carpetSqft: 6540, facing: '270° sea view', floors: [38, 42], basePriceCr: 58, highlights: ['Private infinity pool', 'Full-floor home', 'Four car parks & EV charging'] },
    ],
  },
  {
    id: 'aranya-house',
    name: 'Aranya House',
    locality: 'Malabar Hill',
    city: 'Mumbai',
    segment: 'Luxury Residences',
    lat: 18.9553,
    lng: 72.8046,
    tagline: 'An off-market residence above the Hanging Gardens.',
    developer: 'Sample Developer B',
    possession: 'Ready to move in',
    rera: 'P51900000002 (sample)',
    totalFloors: 28,
    footprint: [6.4, 4.4],
    form: 'tower',
    confidential: true,
    amenities: ['One home per floor', 'Garden podium', 'Concierge', 'Squash court'],
    residences: [
      { id: 'B', name: 'Residence B', planId: 'four', bhk: 4, baths: 5, carpetSqft: 3880, facing: 'Bay & city view', floors: [5, 24], basePriceCr: null, highlights: ['One home per floor', 'Bay view from every bedroom', 'Price shared on request'] },
      { id: 'P', name: 'Garden Penthouse', planId: 'penthouse', bhk: 5, baths: 6, carpetSqft: 6900, facing: 'Bay, city & garden', floors: [25, 28], basePriceCr: null, highlights: ['Private garden terrace', 'Pool deck', 'Price shared on request'] },
    ],
  },
  {
    id: 'carter-point',
    name: 'Carter Point',
    locality: 'Carter Road, Bandra West',
    city: 'Mumbai',
    segment: 'Luxury Residences',
    lat: 19.0662,
    lng: 72.8227,
    tagline: 'A boutique tower on the Bandra promenade.',
    developer: 'Sample Developer C',
    possession: 'June 2026, ready',
    rera: 'P51800000003 (sample)',
    totalFloors: 18,
    footprint: [5.4, 4.2],
    form: 'tower',
    amenities: ['Rooftop pool', 'Gym', 'Two car parks', 'Promenade-facing lobby'],
    residences: [
      { id: 'A', name: 'Residence A', planId: 'three', bhk: 3, baths: 3, carpetSqft: 2180, facing: 'West, sea view', floors: [3, 13], basePriceCr: 12.4, highlights: ['Sunset deck', 'Walk to Carter Road promenade'] },
      { id: 'B', name: 'Residence B', planId: 'four', bhk: 4, baths: 5, carpetSqft: 3240, facing: 'West & south', floors: [14, 18], basePriceCr: 21, highlights: ['Corner home', 'Double-height living (top floor)'] },
    ],
  },
  {
    id: 'tara-residences',
    name: 'Tara Residences',
    locality: 'Juhu',
    city: 'Mumbai',
    segment: 'Luxury Residences',
    lat: 19.1003,
    lng: 72.8268,
    tagline: 'Beach-facing homes five minutes from the airport.',
    developer: 'Sample Developer D',
    possession: 'March 2027',
    rera: 'P51800000004 (sample)',
    totalFloors: 24,
    footprint: [6, 4.2],
    form: 'tower',
    amenities: ['Beach access', 'Clubhouse', 'Kids’ studio', 'Three car parks'],
    residences: [
      { id: 'A', name: 'Residence A', planId: 'three', bhk: 3, baths: 4, carpetSqft: 2280, facing: 'West, beach view', floors: [3, 16], basePriceCr: 11.2, highlights: ['Beach-view living', 'Deck off master suite'] },
      { id: 'B', name: 'Residence B', planId: 'four', bhk: 4, baths: 5, carpetSqft: 3410, facing: 'West & north', floors: [17, 24], basePriceCr: 19.6, highlights: ['Wraparound deck', 'Staff room'] },
    ],
  },
  {
    id: 'parel-meridian',
    name: 'Parel Meridian',
    locality: 'Lower Parel',
    city: 'Mumbai',
    segment: 'Luxury Residences',
    lat: 18.9988,
    lng: 72.8292,
    tagline: 'Fifty-five floors above Mumbai’s business district.',
    developer: 'Sample Developer E',
    possession: 'September 2028',
    rera: 'P51900000005 (sample)',
    totalFloors: 55,
    footprint: [6.8, 5],
    form: 'tower',
    amenities: ['Sky club on 52', 'Business lounge', 'Indoor pool', 'Golf simulator'],
    residences: [
      { id: 'A', name: 'Residence A', planId: 'three', bhk: 3, baths: 3, carpetSqft: 1980, facing: 'City & racecourse', floors: [6, 30], basePriceCr: 8.4, highlights: ['Racecourse view from 20+', 'Smart-home ready'] },
      { id: 'B', name: 'Residence B', planId: 'four', bhk: 4, baths: 5, carpetSqft: 3150, facing: 'Sea & city', floors: [31, 51], basePriceCr: 15.8, highlights: ['Sea view from 35+', 'Staff room'] },
      { id: 'P', name: 'Sky Penthouse', planId: 'penthouse', bhk: 5, baths: 6, carpetSqft: 6120, facing: '360° city & sea', floors: [52, 55], basePriceCr: 39, highlights: ['Private pool deck', 'Full-floor home'] },
    ],
  },
  {
    id: 'villa-kihim',
    name: 'Villa Kihim',
    locality: 'Kihim, Alibaug',
    city: 'Alibaug',
    segment: 'Vacation Homes',
    lat: 18.7228,
    lng: 72.8708,
    tagline: 'A weekend villa 20 minutes by speedboat from the Gateway.',
    developer: 'Private owner',
    possession: 'Ready to move in',
    rera: 'Not required (resale villa)',
    totalFloors: 2,
    footprint: [7, 4.8],
    form: 'villa',
    amenities: ['Private pool', 'Half-acre garden', 'Beach 300 m', 'Staff quarters'],
    residences: [
      { id: 'G', name: 'Garden Level', planId: 'villaGround', bhk: 1, baths: 2, carpetSqft: 3100, facing: 'Garden & pool', floors: [1, 1], basePriceCr: 14.5, highlights: ['Pool terrace', 'Guest suite', 'Price is for the whole villa'] },
      { id: 'U', name: 'Upper Level', planId: 'villaUpper', bhk: 3, baths: 3, carpetSqft: 2400, facing: 'Sea glimpses', floors: [2, 2], basePriceCr: 14.5, highlights: ['Master suite with balcony', 'Price is for the whole villa'] },
    ],
  },
]

for (const p of SAMPLE_PROPERTIES) p.sample = true

/** What the Finder shows. Starts as the samples; replaced by setProperties() with data from the store. */
export const PROPERTIES: Property[] = [...SAMPLE_PROPERTIES]

export function setProperties(list: Property[]) {
  PROPERTIES.splice(0, PROPERTIES.length, ...list)
  floorCache = new WeakMap()
}

// Deterministic pseudo-random so the sample availability doesn't change between reloads.
function seeded(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Keyed by the object, so an edited copy of a listing is recalculated.
let floorCache = new WeakMap<Property, FloorInfo[]>()

/** Every sellable floor of a property, lowest first. */
export function floorsOf(p: Property): FloorInfo[] {
  const cached = floorCache.get(p)
  if (cached) return cached
  const rand = seeded(p.id)
  const out: FloorInfo[] = []
  for (const r of p.residences) {
    for (let f = r.floors[0]; f <= r.floors[1]; f++) {
      const roll = rand()
      const generated: Status = !p.sample || p.form === 'villa' ? 'available' : roll < 0.34 ? 'sold' : roll < 0.44 ? 'reserved' : 'available'
      // Floor-rise premium of about 0.8% per floor above the band's first floor.
      const generatedPrice = r.basePriceCr == null ? null : p.form === 'villa' ? r.basePriceCr : Math.round(r.basePriceCr * (1 + 0.008 * (f - r.floors[0])) * 10) / 10
      const o = p.floorOverrides?.[String(f)]
      const status = o?.status ?? generated
      const priceCr = o && 'priceCr' in o && o.priceCr !== undefined ? o.priceCr : generatedPrice
      out.push({ floor: f, residence: r, status, priceCr })
    }
  }
  out.sort((a, b) => a.floor - b.floor)
  floorCache.set(p, out)
  return out
}

export function fromPrice(p: Property): number | null {
  const prices = floorsOf(p).filter((f) => f.status !== 'sold' && f.priceCr != null).map((f) => f.priceCr as number)
  return prices.length ? Math.min(...prices) : null
}

export function availableCount(p: Property): number {
  return floorsOf(p).filter((f) => f.status === 'available').length
}

/**
 * Opens the residence's location in Google Maps (the app on phones). Uses the
 * map pin, so it works without an API key and without exposing a street address.
 */
export function googleMapsUrl(p: Pick<Property, 'lat' | 'lng'>): string {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(5)},${p.lng.toFixed(5)}`
}

export function formatCr(cr: number | null): string {
  if (cr == null) return 'Price on request'
  return `₹${cr.toFixed(cr % 1 === 0 ? 0 : 1)} Cr`
}

export function bhkRange(p: Property): string {
  const b = [...new Set(p.residences.map((r) => r.bhk))].sort((a, c) => a - c)
  if (p.form === 'villa') return '4 BHK villa'
  return b.length > 1 ? `${b[0]}–${b[b.length - 1]} BHK` : `${b[0]} BHK`
}
