import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { TowerScene } from '../three/TowerScene'
import { floorsOf, formatCr, type FloorInfo, type Property, type Status } from '../data/listings'
import { SampleBadge } from './Brand'
import EnquirySheet from './EnquirySheet'

interface Props {
  property: Property
  floor: number | null
  go: (hash: string, replace?: boolean) => void
}

const STATUS_LABEL: Record<Status, string> = { available: 'Available', reserved: 'Reserved', sold: 'Sold' }

export default function PropertyView({ property: p, floor, go }: Props) {
  const stage = useRef<HTMLDivElement>(null)
  const tip = useRef<HTMLDivElement>(null)
  const scene = useRef<TowerScene | null>(null)
  const introRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [enquire, setEnquire] = useState(false)
  const [copied, setCopied] = useState(false)
  const floors = useMemo(() => floorsOf(p), [p])
  const byFloor = useMemo(() => new Map(floors.map((f) => [f.floor, f])), [floors])
  const selected = floor != null ? byFloor.get(floor) ?? null : null
  const isVilla = p.form === 'villa'
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches

  const openFloor = useCallback((f: number | null, replace = false) => go(f == null ? `#/p/${p.id}` : `#/p/${p.id}/f/${f}`, replace), [go, p.id])

  useEffect(() => {
    if (!stage.current || !tip.current) return
    const s = new TowerScene(stage.current, tip.current, p, floors, {
      onHover: setHovered,
      onSelect: (f) => openFloor(f),
    })
    scene.current = s
    return () => {
      s.dispose()
      scene.current = null
    }
  }, [p, floors, openFloor])

  useEffect(() => {
    scene.current?.select(selected ? selected.floor : null)
  }, [selected])

  // Tell the 3D scene how much of the screen the panels cover.
  useLayoutEffect(() => {
    const measure = () => {
      const s = scene.current
      if (!s) return
      const wide = window.innerWidth > 860
      const intro = introRef.current?.getBoundingClientRect()
      const panel = panelRef.current?.getBoundingClientRect()
      if (wide) {
        const left = intro ? intro.right + 8 : 0
        const right = panel ? window.innerWidth - panel.left + 40 : 40
        s.setInsets(left, right, 0)
      } else {
        const sheet = panel ?? intro
        s.setInsets(0, 0, sheet ? window.innerHeight - sheet.top : 0)
      }
    }
    measure()
    // The scene is created in a later effect, so measure again once it exists,
    // and whenever a panel changes size (fonts loading, content changing).
    const raf = requestAnimationFrame(measure)
    const ro = new ResizeObserver(measure)
    if (introRef.current) ro.observe(introRef.current)
    if (panelRef.current) ro.observe(panelRef.current)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [selected])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (enquire) return
      if (e.key === 'Escape' && selected) openFloor(null)
      if (selected && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        step(e.key === 'ArrowUp' ? 1 : -1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const step = (dir: 1 | -1) => {
    if (!selected) return
    const idx = floors.findIndex((f) => f.floor === selected.floor)
    const next = floors[idx + dir]
    if (next) openFloor(next.floor, true)
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const hoverInfo = hovered != null ? byFloor.get(hovered) : undefined
  const topFloor = floors.length ? floors[floors.length - 1].floor : p.totalFloors

  return (
    <div className={`property${selected ? ' has-floor' : ''}`}>
      <div ref={stage} className="stage" aria-label={`3D model of ${p.name}. Use the floor list to choose a floor.`} />

      <div ref={tip} className="tower-tip" aria-hidden="true">
        {hoverInfo && <TipContent f={hoverInfo} villa={isVilla} />}
      </div>

      <header className="topbar topbar-dark">
        <button type="button" className="back" onClick={() => go('#/')}>
          <span aria-hidden="true">←</span> All residences
        </button>
        <div className="topbar-title">
          <span className="topbar-name">{p.name}</span>
          <span className="topbar-loc">{p.locality}</span>
        </div>
        <SampleBadge />
        <button type="button" className="btn-gold" onClick={() => setEnquire(true)}>Private viewing</button>
      </header>

      {!selected && (
        <aside className="intro-panel" ref={introRef}>
          <p className="eyebrow">{p.segment} · {p.locality}</p>
          <h1>{p.name}</h1>
          <p className="tagline">{p.tagline}</p>
          <dl className="facts">
            <div><dt>Possession</dt><dd>{p.possession}</dd></div>
            <div><dt>{isVilla ? 'Levels' : 'Floors'}</dt><dd>{p.totalFloors}</dd></div>
            <div><dt>Developer</dt><dd>{p.developer}</dd></div>
            <div><dt>MahaRERA</dt><dd>{p.rera}</dd></div>
          </dl>
          <h2 className="types-head">{isVilla ? 'Levels' : 'Residences'}</h2>
          <ul className="types">
            {p.residences.map((r) => {
              const inType = floors.filter((f) => f.residence.id === r.id)
              const avail = inType.filter((f) => f.status === 'available')
              const first = avail[0] ?? inType[0]
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className="type"
                    onMouseEnter={() => scene.current?.highlightType(r.id)}
                    onMouseLeave={() => scene.current?.highlightType(null)}
                    onFocus={() => scene.current?.highlightType(r.id)}
                    onBlur={() => scene.current?.highlightType(null)}
                    onClick={() => first && openFloor(first.floor)}
                  >
                    <span className="type-name">{r.name}</span>
                    <span className="type-spec">
                      {isVilla ? `${r.carpetSqft.toLocaleString('en-IN')} sq ft` : `${r.bhk} BHK · ${r.carpetSqft.toLocaleString('en-IN')} sq ft`}
                    </span>
                    <span className="type-floors">{isVilla ? `Level ${r.floors[0]}` : `Floors ${r.floors[0]}–${r.floors[1]}`}</span>
                    <span className="type-avail">{isVilla ? formatCr(r.basePriceCr) : `${avail.length} of ${inType.length} available`}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="hint">{touch ? 'Tap a floor to open it.' : 'Hover a floor to preview it. Click to open the floor plan.'}</p>
        </aside>
      )}

      <nav className="floor-strip" aria-label="Floors">
        <ol>
          {[...floors].reverse().map((f) => (
            <li key={f.floor}>
              <button
                type="button"
                className={`tick tick-${f.status}${selected?.floor === f.floor ? ' is-sel' : ''}${hovered === f.floor ? ' is-hover' : ''}`}
                aria-label={`Floor ${f.floor}, ${f.residence.name}, ${STATUS_LABEL[f.status]}`}
                aria-current={selected?.floor === f.floor ? 'true' : undefined}
                onMouseEnter={() => scene.current?.hover(f.floor)}
                onMouseLeave={() => scene.current?.hover(null)}
                onClick={() => openFloor(f.floor, selected != null)}
              />
            </li>
          ))}
        </ol>
        <div className="strip-legend" aria-hidden="true">
          <span><i className="dot dot-available" />Available</span>
          <span><i className="dot dot-reserved" />Reserved</span>
          <span><i className="dot dot-sold" />Sold</span>
        </div>
      </nav>

      {selected && (
        <aside className="floor-panel" ref={panelRef} aria-label={`${selected.residence.name}, floor ${selected.floor}`}>
          <div className="fp-head">
            <p className="eyebrow">{isVilla ? `Level ${selected.floor} of ${topFloor}` : `Floor ${selected.floor} of ${p.totalFloors}`}</p>
            <div className="fp-nav">
              <button type="button" onClick={() => step(-1)} disabled={selected.floor === floors[0].floor} aria-label="Floor below">↓</button>
              <button type="button" onClick={() => step(1)} disabled={selected.floor === topFloor} aria-label="Floor above">↑</button>
              <button type="button" onClick={() => openFloor(null)} aria-label="Close floor and return to the building">✕</button>
            </div>
          </div>
          <h2>{selected.residence.name}</h2>
          <p className={`status status-${selected.status}`}>{STATUS_LABEL[selected.status]}</p>
          {selected.status !== 'sold' && <p className="fp-price">{formatCr(selected.priceCr)}</p>}
          <dl className="specs">
            {!isVilla && <div><dt>Configuration</dt><dd>{selected.residence.bhk} BHK</dd></div>}
            <div><dt>Carpet area (RERA)</dt><dd>{selected.residence.carpetSqft.toLocaleString('en-IN')} sq ft</dd></div>
            <div><dt>Bathrooms</dt><dd>{selected.residence.baths}</dd></div>
            <div><dt>Aspect</dt><dd>{selected.residence.facing}</dd></div>
          </dl>
          <ul className="highlights">
            {selected.residence.highlights.map((h) => <li key={h}>{h}</li>)}
          </ul>
          <div className="gallery" aria-label="Photos">
            {['Living room at dusk', 'Master suite', isVilla ? 'Pool terrace' : 'View from the deck'].map((t, i) => (
              <figure key={t} className={`ph ph-${i}`}>
                <figcaption>{t}</figcaption>
              </figure>
            ))}
          </div>
          <p className="ph-note">Photos and walkthrough video for this residence go here.</p>
          <div className="fp-actions">
            {selected.status !== 'sold' ? (
              <button type="button" className="btn-gold" onClick={() => setEnquire(true)}>Request a private viewing</button>
            ) : (
              <button type="button" className="btn-gold" onClick={() => setEnquire(true)}>Ask about similar homes</button>
            )}
            <button type="button" className="btn-ghost" onClick={share}>{copied ? 'Link copied' : 'Copy link to this floor'}</button>
          </div>
          <p className="fine">Floor plan is indicative and not to scale. Prices exclude stamp duty, registration and GST.</p>
        </aside>
      )}

      {enquire && <EnquirySheet property={p} floor={selected} onClose={() => setEnquire(false)} />}
    </div>
  )
}

function TipContent({ f, villa }: { f: FloorInfo; villa: boolean }) {
  return (
    <>
      <span className="tip-eyebrow">{villa ? `Level ${f.floor}` : `Floor ${f.floor}`}</span>
      <span className="tip-name">{f.residence.name}</span>
      <span className="tip-spec">{villa ? '' : `${f.residence.bhk} BHK · `}{f.residence.carpetSqft.toLocaleString('en-IN')} sq ft</span>
      <span className={`tip-status status-${f.status}`}>
        {STATUS_LABEL[f.status]}{f.status !== 'sold' ? ` · ${formatCr(f.priceCr)}` : ''}
      </span>
    </>
  )
}
