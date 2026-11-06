// The "no figure without source text" guard.
//
// Every value the AI returns is checked against the original message or page.
// Numbers must appear in the text (allowing for 29.5 Cr / 2,950 lakh / 4.2M
// style rewrites); names and places must appear as words. Anything that fails
// is dropped, so the field stays empty for a person to fill in, instead of
// carrying a figure nobody wrote.
import type { Extracted } from '../../src/data/store'

function normalise(text: string) {
  return ` ${text.toLowerCase().replace(/(\d),(?=\d)/g, '$1').replace(/\s+/g, ' ')} `
}

function fmt(n: number) {
  // 29.50 -> "29.5", 12.0 -> "12"
  return String(Math.round(n * 100) / 100)
}

/** Does this number (or an obvious rewrite of it) appear in the text? */
export function numberAppears(n: number, text: string, kind: 'plain' | 'crore' | 'aed' = 'plain'): boolean {
  const t = normalise(text)
  // Each variant may require a unit word after it: "3200" alone must not
  // count as 32 crore just because 32 Cr = 3,200 lakh.
  const variants: [string, string][] = [[fmt(n), '']]
  if (kind === 'crore') variants.push([fmt(n * 100), '\\s*(?:lakhs?|lacs?|l\\b)'])
  if (kind === 'aed') variants.push([fmt(n / 1e6), '\\s*(?:m\\b|mn\\b|million)'], [fmt(n / 1e3), '\\s*k\\b'])
  for (const [v, unit] of variants) {
    // Whole-number match: "12" must not match inside "120" or "3.12".
    const re = new RegExp(`(^|[^\\d.])${v.replace('.', '\\.')}(?![\\d]|\\.\\d)${unit}`)
    if (re.test(t)) return true
  }
  return false
}

/** Does a name or place appear as words in the text? */
export function phraseAppears(value: string, text: string): boolean {
  const t = normalise(text)
  const words = value.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3)
  if (!words.length) return false
  // The distinctive words must all be present (ignores filler like "the", "in").
  return words.every((w) => t.includes(w))
}

const NUMERIC: (keyof Extracted)[] = ['bhk', 'carpetSqft', 'floor', 'totalFloors']

export interface GuardResult {
  kept: Extracted
  dropped: string[]
}

export function guardAgainstSource(fields: Extracted, source: string): GuardResult {
  const kept: Extracted = {}
  const dropped: string[] = []
  const keep = <K extends keyof Extracted>(k: K, ok: boolean) => {
    if (fields[k] === undefined || fields[k] === null) return
    if (ok) kept[k] = fields[k]
    else dropped.push(k)
  }

  for (const k of NUMERIC) {
    const v = fields[k]
    if (typeof v === 'number') keep(k, numberAppears(v, source))
  }
  if (typeof fields.priceCr === 'number') keep('priceCr', numberAppears(fields.priceCr, source, 'crore'))
  if (typeof fields.priceAed === 'number') keep('priceAed', numberAppears(fields.priceAed, source, 'aed'))
  for (const k of ['name', 'developer', 'locality'] as const) {
    const v = fields[k]
    if (typeof v === 'string' && v.trim()) keep(k, phraseAppears(v, source))
  }
  if (fields.rera) keep('rera', normalise(source).includes(fields.rera.toLowerCase()))
  if (fields.possession) {
    const years = fields.possession.match(/\d{4}/g) ?? []
    keep('possession', years.every((y) => numberAppears(Number(y), source)) && (years.length > 0 || /ready|oc|rtm/i.test(source)))
  }
  // Inferred labels: allowed only when they follow from a kept place.
  if (fields.city && (kept.locality || phraseAppears(fields.city, source))) kept.city = fields.city
  if (fields.segment && (kept.locality || kept.city)) kept.segment = fields.segment
  if (fields.offMarket === true) keep('offMarket', /off[- ]?market|don'?t share|do not share|confidential|not to be shared|private/i.test(source))
  // The summary may not introduce numbers that aren't in the source.
  if (fields.summary) {
    const nums = fields.summary.match(/\d+(?:[.,]\d+)*/g) ?? []
    keep('summary', nums.every((x) => numberAppears(Number(x.replace(/,/g, '')), source)))
  }
  return { kept, dropped }
}
