// Rule-based reading of a listing message, e.g. a WhatsApp forward:
//   "Worli sea facing 4 BHK, 3,450 carpet, 31st floor, asking 29.5 Cr"
// It runs instantly and for free. The WhatsApp webhook uses it first and
// only asks the AI to fill what it could not find, which keeps AI costs low.
import type { Extracted } from './store'
import { findPlace } from './places'

const num = (s: string) => Number(s.replace(/,/g, ''))

export function extractListing(text: string): Extracted {
  const t = text.replace(/\s+/g, ' ')
  const out: Extracted = {}

  const place = findPlace(t)
  if (place) {
    out.locality = place.name
    out.city = place.city
    out.segment = place.city === 'Alibaug' ? 'Vacation Homes' : 'Luxury Residences'
  }

  const bhk = t.match(/(\d)\s*(?:\.5\s*)?bhk/i)
  if (bhk) out.bhk = Number(bhk[1])

  const area = t.match(/([\d,]{3,6})\s*(?:sq\.?\s*ft|sqft|sft|square feet|carpet|rera carpet)/i) ?? t.match(/carpet(?: area)?\s*(?:of|:|-)?\s*([\d,]{3,6})/i)
  if (area) out.carpetSqft = num(area[1])

  const floor = t.match(/(\d{1,3})(?:st|nd|rd|th)?\s*(?:floor|flr)\b/i) ?? t.match(/\bfloor\s*(?:no\.?|:)?\s*(\d{1,3})\b/i)
  if (floor) out.floor = Number(floor[1])

  const storeys = t.match(/(\d{2,3})\s*(?:storeys?|stories|storied|floors? tower|floor tower)/i)
  if (storeys) out.totalFloors = Number(storeys[1])

  // Price: "29.5 Cr", "₹29.5 crore", "AED 4.2M" is left for the AI.
  const cr = t.match(/(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:\.\d{1,2})?)\s*(?:cr|crore|crs)\b/i)
  if (cr) out.priceCr = Number(cr[1])
  else if (/price on request|p\.?o\.?r\.?|on request/i.test(t)) out.priceCr = null

  const rera = t.match(/\bP5\d{10}\b/i)
  if (rera) out.rera = rera[0].toUpperCase()

  if (/\boc (?:received|recd|in hand)|ready to move|\brtm\b/i.test(t)) out.possession = 'Ready to move in'
  const poss = t.match(/possession\s*(?:in|:|-)?\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{4})/i)
  if (poss) out.possession = poss[1]

  if (/off[- ]?market|don'?t share|do not share|confidential|not to be shared/i.test(t)) out.offMarket = true

  return out
}
