// Approximate centres of the localities Luxarea works in. Used to place a new
// listing on the map before someone drops the exact pin. Order matters for
// matching: more specific names first.
export interface Place { name: string; city: 'Mumbai' | 'Alibaug' | 'Dubai'; lat: number; lng: number; aliases?: string[] }

export const PLACES: Place[] = [
  { name: 'Worli Sea Face', city: 'Mumbai', lat: 19.0108, lng: 72.8158 },
  { name: 'Worli', city: 'Mumbai', lat: 19.0176, lng: 72.8166 },
  { name: 'Malabar Hill', city: 'Mumbai', lat: 18.9548, lng: 72.804 },
  { name: 'Altamount Road', city: 'Mumbai', lat: 18.964, lng: 72.809, aliases: ['altamount'] },
  { name: 'Breach Candy', city: 'Mumbai', lat: 18.9701, lng: 72.8048 },
  { name: 'Cuffe Parade', city: 'Mumbai', lat: 18.915, lng: 72.82 },
  { name: 'Colaba', city: 'Mumbai', lat: 18.9067, lng: 72.8147 },
  { name: 'Nepean Sea Road', city: 'Mumbai', lat: 18.9595, lng: 72.8025, aliases: ['nepeansea', 'napean sea'] },
  { name: 'Tardeo', city: 'Mumbai', lat: 18.969, lng: 72.815 },
  { name: 'Mahalaxmi', city: 'Mumbai', lat: 18.9827, lng: 72.824 },
  { name: 'Lower Parel', city: 'Mumbai', lat: 18.9975, lng: 72.8302 },
  { name: 'Prabhadevi', city: 'Mumbai', lat: 19.0166, lng: 72.8287 },
  { name: 'Dadar', city: 'Mumbai', lat: 19.0178, lng: 72.8478 },
  { name: 'Bandra West', city: 'Mumbai', lat: 19.0596, lng: 72.8295, aliases: ['bandra w', 'pali hill', 'carter road', 'bandstand'] },
  { name: 'Bandra Kurla Complex', city: 'Mumbai', lat: 19.0662, lng: 72.8679, aliases: ['bkc'] },
  { name: 'Bandra', city: 'Mumbai', lat: 19.0596, lng: 72.8295 },
  { name: 'Khar West', city: 'Mumbai', lat: 19.0726, lng: 72.8366, aliases: ['khar'] },
  { name: 'Santacruz West', city: 'Mumbai', lat: 19.0815, lng: 72.8341, aliases: ['santacruz'] },
  { name: 'Juhu', city: 'Mumbai', lat: 19.1075, lng: 72.8263, aliases: ['jvpd'] },
  { name: 'Andheri West', city: 'Mumbai', lat: 19.1364, lng: 72.8296, aliases: ['andheri'] },
  { name: 'Powai', city: 'Mumbai', lat: 19.1176, lng: 72.906 },
  { name: 'Kihim', city: 'Alibaug', lat: 18.7228, lng: 72.8708 },
  { name: 'Mandwa', city: 'Alibaug', lat: 18.803, lng: 72.881 },
  { name: 'Awas', city: 'Alibaug', lat: 18.765, lng: 72.873 },
  { name: 'Alibaug', city: 'Alibaug', lat: 18.6414, lng: 72.8722, aliases: ['alibag'] },
  { name: 'Palm Jumeirah', city: 'Dubai', lat: 25.1124, lng: 55.139, aliases: ['the palm'] },
  { name: 'Downtown Dubai', city: 'Dubai', lat: 25.1972, lng: 55.2744, aliases: ['downtown', 'burj khalifa'] },
  { name: 'Dubai Hills', city: 'Dubai', lat: 25.1036, lng: 55.2453 },
  { name: 'Dubai Marina', city: 'Dubai', lat: 25.0805, lng: 55.1403, aliases: ['marina'] },
  { name: 'Emirates Hills', city: 'Dubai', lat: 25.0687, lng: 55.1713 },
  { name: 'Dubai', city: 'Dubai', lat: 25.2048, lng: 55.2708 },
  { name: 'Mumbai', city: 'Mumbai', lat: 19.03, lng: 72.83 },
]

export function findPlace(text: string): Place | null {
  const t = ` ${text.toLowerCase()} `
  for (const p of PLACES) {
    for (const n of [p.name, ...(p.aliases ?? [])]) {
      if (t.includes(n.toLowerCase())) return p
    }
  }
  return null
}
