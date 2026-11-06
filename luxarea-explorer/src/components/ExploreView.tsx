import { useMemo, useState, type FormEvent } from 'react'
import { availableCount, bhkRange, formatCr, fromPrice, googleMapsUrl, PROPERTIES, type Property } from '../data/listings'
import { BRAND } from '../config'
import { SampleBadge, SiteNav, Wordmark } from './Brand'
import MapView from './MapView'
import { DATA_MODE } from '../data/store'

/** Area chips come from the listings themselves ("Carter Road, Bandra West" → "Bandra West"). */
function localities(): string[] {
  const names = PROPERTIES.map((p) => (p.locality.split(',').pop() ?? p.locality).trim().replace(/ Sea Face$/, ''))
  return ['All', ...new Set(names)]
}
const BUDGETS = [
  { id: 'any', label: 'Any budget', test: () => true },
  { id: 'u15', label: 'Under ₹15 Cr', test: (cr: number | null) => cr != null && cr < 15 },
  { id: '15-30', label: '₹15–30 Cr', test: (cr: number | null) => cr != null && cr >= 15 && cr <= 30 },
  { id: '30', label: '₹30 Cr and above', test: (cr: number | null) => cr == null || cr > 30 },
]

interface Props {
  unlocked: boolean
  unlock: (code: string) => Promise<boolean>
  go: (hash: string) => void
}

export default function ExploreView({ unlocked, unlock, go }: Props) {
  const [locality, setLocality] = useState('All')
  const [budget, setBudget] = useState('any')
  const [bhk, setBhk] = useState(0)
  const [active, setActive] = useState<string | null>(null)

  const list = useMemo(() => {
    const b = BUDGETS.find((x) => x.id === budget)!
    return PROPERTIES.filter((p) => {
      if (locality !== 'All' && !p.locality.includes(locality)) return false
      if (bhk && !p.residences.some((r) => (bhk === 5 ? r.bhk >= 5 : r.bhk === bhk)) && p.form !== 'villa') return false
      if (bhk && p.form === 'villa' && bhk !== 4) return false
      const locked = p.confidential && !unlocked
      if (!locked && !b.test(fromPrice(p))) return false
      return true
    })
  }, [locality, budget, bhk, unlocked])

  const open = (p: Property) => go(`#/p/${p.id}`)

  return (
    <div className="explore">
      <header className="topbar topbar-light">
        <Wordmark />
        <SampleBadge />
        <SiteNav />
      </header>

      <main className="explore-body">
        <section className="explore-list" aria-label="Residences">
          <div className="explore-intro">
            <p className="eyebrow">Residences curated by Luxarea</p>
            <h1>Find the floor that feels like home.</h1>
            <p className="muted">Open any building to walk through it floor by floor, with live availability and floor plans.</p>
          </div>

          <div className="filters" role="group" aria-label="Filter residences">
            <div className="chips" role="radiogroup" aria-label="Locality">
              {localities().map((l) => (
                <button key={l} type="button" role="radio" aria-checked={locality === l} className="chip" onClick={() => setLocality(l)}>
                  {l}
                </button>
              ))}
            </div>
            <div className="selects">
              <label>
                <span className="sr-only">Budget</span>
                <select id="budget" value={budget} onChange={(e) => setBudget(e.target.value)}>
                  {BUDGETS.map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Bedrooms</span>
                <select id="bhk" value={bhk} onChange={(e) => setBhk(Number(e.target.value))}>
                  <option value={0}>Any size</option>
                  <option value={3}>3 BHK</option>
                  <option value={4}>4 BHK</option>
                  <option value={5}>5 BHK and penthouses</option>
                </select>
              </label>
            </div>
          </div>

          <p className="result-count">{list.length === 1 ? '1 residence' : `${list.length} residences`}</p>

          <ul className="cards">
            {list.map((p) =>
              p.confidential && !unlocked ? (
                <PrivateCard key={p.id} p={p} unlock={unlock} active={active === p.id} onHover={setActive} />
              ) : (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`card${active === p.id ? ' is-active' : ''}`}
                    onMouseEnter={() => setActive(p.id)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(p.id)}
                    onBlur={() => setActive(null)}
                    onClick={() => open(p)}
                  >
                    <TowerGlyph floors={p.totalFloors} villa={p.form === 'villa'} />
                    <span className="card-body">
                      <span className="card-meta">
                        {p.locality}
                        {p.confidential && <span className="tag-private">Private</span>}
                      </span>
                      <span className="card-title">{p.name}</span>
                      <span className="card-line">{bhkRange(p)} · {p.form === 'villa' ? 'Two levels' : `${p.totalFloors} floors`} · {p.possession}</span>
                      <span className="card-foot">
                        <span className="card-price">{fromPrice(p) == null ? 'Price on request' : `From ${formatCr(fromPrice(p))}`}</span>
                        <span className="card-avail">{availableCount(p)} available</span>
                      </span>
                    </span>
                  </button>
                  <a className="card-maps" href={googleMapsUrl(p)} target="_blank" rel="noopener noreferrer" aria-label={`Open the location of ${p.name} in Google Maps`}>
                    <PinIcon /> View on Google Maps <span aria-hidden="true">↗</span>
                  </a>
                </li>
              ),
            )}
          </ul>
          {list.length === 0 && (
            <div className="empty">
              <p>No residences match these filters.</p>
              <button type="button" className="link" onClick={() => { setLocality('All'); setBudget('any'); setBhk(0) }}>
                Clear filters
              </button>
            </div>
          )}

          <footer className="explore-foot">
            <p>{BRAND.name} · {BRAND.office}</p>
            <p>Visuals and floor plans are indicative and not to scale. Areas are RERA carpet areas. Prices exclude stamp duty, registration and GST.</p>
          </footer>
        </section>

        <MapView properties={list} unlocked={unlocked} activeId={active} onHover={setActive} onOpen={open} />
      </main>
    </div>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
    </svg>
  )
}

export { PinIcon }

function PrivateCard({ p, unlock, active, onHover }: { p: Property; unlock: (c: string) => Promise<boolean>; active: boolean; onHover: (id: string | null) => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!(await unlock(code))) setError('That code didn’t match. Ask your Luxarea advisor for your invitation code.')
  }
  return (
    <li>
      <div className={`card card-private${active ? ' is-active' : ''}`} onMouseEnter={() => onHover(p.id)} onMouseLeave={() => onHover(null)}>
        <span className="lock-glyph" aria-hidden="true" />
        <span className="card-body">
          <span className="card-meta">{p.locality} <span className="tag-private">Private</span></span>
          <span className="card-title">Off-market residence</span>
          <span className="card-line">Shared by invitation only. Location shown approximately.</span>
          <form className="invite" onSubmit={submit}>
            <label htmlFor={`code-${p.id}`} className="sr-only">Invitation code</label>
            <input id={`code-${p.id}`} value={code} onChange={(e) => { setCode(e.target.value); setError('') }} placeholder="Invitation code" autoComplete="off" />
            <button type="submit">View</button>
          </form>
          {error ? <span className="invite-error" role="alert">{error}</span> : <span className="invite-hint">{DATA_MODE === 'local' ? 'Demo code: LUX-PRIVATE' : 'Your advisor shares this code with you.'}</span>}
        </span>
      </div>
    </li>
  )
}

function TowerGlyph({ floors, villa }: { floors: number; villa: boolean }) {
  if (villa) {
    return (
      <svg className="glyph" viewBox="0 0 48 64" aria-hidden="true">
        <rect x="6" y="40" width="36" height="10" rx="1.5" />
        <rect x="2" y="37" width="44" height="3" rx="1" className="g-slab" />
        <rect x="9" y="27" width="30" height="10" rx="1.5" />
        <rect x="5" y="24" width="38" height="3" rx="1" className="g-slab" />
        <rect x="0" y="50" width="48" height="2" className="g-ground" />
      </svg>
    )
  }
  const n = Math.min(Math.round(floors / 3), 18)
  const h = 52 / n
  return (
    <svg className="glyph" viewBox="0 0 48 64" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x="14" y={6 + i * h} width="20" height={h - 1.1} rx="2.5" />
      ))}
      <rect x="12" y="3" width="24" height="3" rx="1.5" className="g-crown" />
      <rect x="0" y="58" width="48" height="2" className="g-ground" />
    </svg>
  )
}
