import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { floorsOf, type ResidenceType, type Status } from '../data/listings'
import { newId, type Draft, type Listing, type Store, type User } from '../data/store'
import { findPlace } from '../data/places'
import { Check, Grip, Num, Sel, Sortable, StringList, Text, useToast } from './ui'
import { factsOf } from './Inbox'

const MapPicker = lazy(() => import('./MapPicker'))

const PLANS = [
  { value: 'three', label: '3 BHK layout' },
  { value: 'four', label: '4 BHK layout' },
  { value: 'penthouse', label: 'Penthouse layout' },
  { value: 'villaGround', label: 'Villa ground level' },
  { value: 'villaUpper', label: 'Villa upper level' },
]

function blankResidence(i: number, bhk = 3): ResidenceType {
  return { id: String.fromCharCode(65 + i), name: `Residence ${String.fromCharCode(65 + i)}`, planId: bhk >= 5 ? 'penthouse' : bhk >= 4 ? 'four' : 'three', bhk, baths: bhk + 1, carpetSqft: 0, facing: '', floors: [1, 1], basePriceCr: null, highlights: [] }
}

function blankListing(): Listing {
  return {
    id: newId('p-'), name: '', locality: '', city: 'Mumbai', segment: 'Luxury Residences', lat: 0, lng: 0, tagline: '', developer: '', possession: '', rera: '',
    totalFloors: 20, footprint: [6.4, 4.4], form: 'tower', confidential: false, amenities: [], residences: [blankResidence(0)], photos: [],
    status: 'draft', updatedAt: new Date().toISOString(),
  }
}

/** A first version of a listing from what the inbox message said. Everything is editable before saving. */
function fromDraft(d: Draft): Listing {
  const e = d.extracted
  const l = blankListing()
  const place = e.locality ? findPlace(e.locality) : null
  const bhk = e.bhk ?? 3
  const total = e.totalFloors ?? Math.max((e.floor ?? 0) + 4, 12)
  const r = blankResidence(0, bhk)
  r.carpetSqft = e.carpetSqft ?? 0
  r.floors = e.floor ? [e.floor, e.floor] : [1, total]
  r.basePriceCr = e.priceCr ?? null
  return {
    ...l,
    name: e.name ?? `${bhk} BHK${e.locality ? ` in ${e.locality}` : ''}`,
    locality: e.locality ?? '',
    city: e.city ?? place?.city ?? 'Mumbai',
    segment: e.segment ?? 'Luxury Residences',
    lat: place?.lat ?? 0,
    lng: place?.lng ?? 0,
    tagline: e.summary ?? '',
    developer: e.developer ?? '',
    possession: e.possession ?? '',
    rera: e.rera ?? '',
    totalFloors: total,
    confidential: !!e.offMarket,
    residences: [r],
    sourceDraftId: d.id,
  }
}

function validate(l: Listing): string[] {
  const errs: string[] = []
  if (!l.name.trim()) errs.push('Give the listing a name.')
  if (!l.locality.trim()) errs.push('Add the locality.')
  if (!l.lat || !l.lng) errs.push('Place the pin on the map.')
  if (!l.residences.length) errs.push('Add at least one residence type.')
  l.residences.forEach((r, i) => {
    const n = r.name || `Residence ${i + 1}`
    if (r.floors[0] < 1 || r.floors[1] < r.floors[0]) errs.push(`${n}: check the floor range.`)
    if (r.floors[1] > l.totalFloors) errs.push(`${n}: floors go above the building's ${l.totalFloors} floors.`)
    if (!r.carpetSqft) errs.push(`${n}: add the carpet area.`)
  })
  return errs
}

const NEXT: Record<Status, Status> = { available: 'reserved', reserved: 'sold', sold: 'available' }

export default function ListingEditor({ store, id, fromDraft: draftId, go, user }: { store: Store; id: string; fromDraft?: string; go: (h: string) => void; user: User }) {
  const toast = useToast()
  const [l, setL] = useState<Listing | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openRes, setOpenRes] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      const drafts = draftId ? await store.listDrafts() : []
      const d = drafts.find((x) => x.id === draftId) ?? null
      setDraft(d)
      if (id === 'new') setL(d ? fromDraft(d) : blankListing())
      else {
        const found = (await store.listListings()).find((x) => x.id === id)
        setL(found ? structuredClone(found) : null)
      }
    })()
  }, [store, id, draftId])

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const floors = useMemo(() => (l ? floorsOf(l) : []), [l])

  if (l === null) return <p className="muted">{id === 'new' ? 'Loading…' : 'Listing not found.'} <a href="#/listings">Back to listings</a></p>

  const set = (patch: Partial<Listing>) => {
    setL({ ...l, ...patch })
    setDirty(true)
  }
  const setRes = (i: number, patch: Partial<ResidenceType>) => set({ residences: l.residences.map((r, j) => (j === i ? { ...r, ...patch } : r)) })

  const cycleFloor = (floor: number, status: Status) => {
    const o = { ...(l.floorOverrides ?? {}) }
    o[String(floor)] = { ...o[String(floor)], status: NEXT[status] }
    set({ floorOverrides: o })
  }
  const setAll = (status: Status) => {
    const o: NonNullable<Listing['floorOverrides']> = {}
    for (const f of floors) o[String(f.floor)] = { ...(l.floorOverrides?.[String(f.floor)] ?? {}), status }
    set({ floorOverrides: o })
  }

  const save = async (publish?: boolean) => {
    const next = { ...l, status: publish ? 'published' as const : l.status, updatedBy: user.name }
    const errs = next.status === 'published' ? validate(next) : next.name.trim() ? [] : ['Give the listing a name.']
    setErrors(errs)
    if (errs.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSaving(true)
    try {
      const saved = await store.saveListing(next)
      if (draft && draft.status === 'new') await store.saveDraft({ ...draft, status: 'approved', listingId: saved.id })
      setL(structuredClone(saved))
      setDirty(false)
      toast(saved.status === 'published' ? 'Saved and live in the Residence Finder' : 'Saved')
      if (id === 'new') go(`#/listings/${saved.id}`)
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Could not save.'])
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirm(`Delete "${l.name || 'this listing'}"? This cannot be undone. To hide it instead, set its status to Archived.`)) return
    await store.deleteListing(l.id)
    toast('Deleted')
    go('#/listings')
  }

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    toast('Uploading…')
    const urls: { url: string; caption: string }[] = []
    for (const f of [...files].filter((x) => x.type.startsWith('image/'))) {
      try {
        urls.push({ url: await store.uploadImage(f, `listings/${l.id}`), caption: '' })
      } catch {
        toast(`Could not read ${f.name}`)
      }
    }
    set({ photos: [...(l.photos ?? []), ...urls] })
    toast(`${urls.length} photo${urls.length === 1 ? '' : 's'} added`)
  }

  const isVilla = l.form === 'villa'

  return (
    <>
      <div className="page-head">
        <div>
          <p className="small"><a href="#/listings">← Listings</a></p>
          <h1>{l.name || 'New listing'}</h1>
          <p>
            <span className={`status st-${l.status}`}>{l.status}</span>{' '}
            {l.sample && <span className="tag tag-sample">Sample</span>}{' '}
            {dirty && <span className="dirty">Unsaved changes</span>}
          </p>
        </div>
        <div className="actions">
          {l.status === 'published' && id !== 'new' && <a className="b" href={`/residences.html#/p/${l.id}`} target="_blank" rel="noopener">View in Finder ↗</a>}
          {id !== 'new' && <button type="button" className="b b-danger" onClick={remove}>Delete</button>}
          <button type="button" className="b" onClick={() => save()} disabled={saving}>Save</button>
          {l.status !== 'published' && <button type="button" className="b b-gold" onClick={() => save(true)} disabled={saving}>Save and publish</button>}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="error-list" role="alert">
          <b>Before this can go live:</b>
          <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      {draft && (
        <section className="card" style={{ background: '#fbf8f0' }}>
          <div className="card-head"><h2>From the inbox</h2><span className={`src src-${draft.source}`}>{draft.source === 'whatsapp' ? 'WhatsApp' : draft.source === 'scan' ? 'Daily scan' : 'Pasted'}</span></div>
          <p className="raw" style={{ marginBottom: 10 }}>{draft.rawText}</p>
          <div className="facts">{factsOf(draft.extracted).map(([k, v]) => <span key={k} className="fact"><b>{k}</b>{v}</span>)}</div>
          <p className="hint" style={{ marginTop: 8 }}>The form below was filled in from this message. Check every field: messages are often incomplete.</p>
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2>Basics</h2></div>
        <div className="grid2">
          <Text label="Name" required value={l.name} onChange={(v) => set({ name: v })} hint="Building or project name, e.g. The Sea Ledger" />
          <Sel label="Status" value={l.status} onChange={(v) => set({ status: v })} options={[{ value: 'draft', label: 'Draft (not on the website)' }, { value: 'published', label: 'Published (in the Finder)' }, { value: 'archived', label: 'Archived (hidden)' }]} />
          <Text label="One-line description" value={l.tagline} onChange={(v) => set({ tagline: v })} hint="Shown under the name." />
          <Text label="Developer" value={l.developer} onChange={(v) => set({ developer: v })} />
          <Sel label="Type" value={l.form} onChange={(v) => set({ form: v, footprint: v === 'villa' ? [7, 4.8] : [6.4, 4.4], totalFloors: v === 'villa' ? 2 : l.totalFloors })} options={[{ value: 'tower', label: 'Apartment tower' }, { value: 'villa', label: 'Villa or bungalow' }]} />
          <Sel label="Category" value={l.segment} onChange={(v) => set({ segment: v })} options={[{ value: 'Luxury Residences', label: 'Luxury residence' }, { value: 'Vacation Homes', label: 'Vacation home' }]} />
          <Num label={isVilla ? 'Levels' : 'Floors in the building'} value={l.totalFloors} onChange={(v) => set({ totalFloors: Math.max(1, Math.min(120, v ?? 1)) })} />
          <Text label="Possession" value={l.possession} onChange={(v) => set({ possession: v })} hint="e.g. Ready to move in, or December 2027" />
          <Text label="MahaRERA project number" value={l.rera} onChange={(v) => set({ rera: v })} hint="Required for new projects in Maharashtra." />
          <Check label="Off-market: show only to people with an invitation code" value={!!l.confidential} onChange={(v) => set({ confidential: v })} />
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Location</h2></div>
        <div className="grid2" style={{ marginBottom: 12 }}>
          <Text
            label="Locality"
            required
            value={l.locality}
            onChange={(v) => {
              const p = findPlace(v)
              set({ locality: v, ...(p && !l.lat ? { lat: p.lat, lng: p.lng, city: p.city } : {}) })
            }}
            hint="e.g. Worli Sea Face. Known areas place the pin automatically."
          />
          <Text label="City" value={l.city} onChange={(v) => set({ city: v })} />
        </div>
        <Suspense fallback={<div className="picker" />}>
          <MapPicker lat={l.lat} lng={l.lng} onPick={(lat, lng) => set({ lat, lng })} />
        </Suspense>
        <p className="hint" style={{ marginTop: 6 }}>Click the map to place the pin, or drag it. {l.confidential && 'Off-market listings show only an approximate circle to the public.'}</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Residence types</h2>
          <button type="button" className="b b-sm" onClick={() => { set({ residences: [...l.residences, blankResidence(l.residences.length)] }); setOpenRes(l.residences.length) }}>+ Add type</button>
        </div>
        <p className="hint" style={{ marginBottom: 10 }}>One entry per layout, e.g. "Residence A, 3 BHK, floors 4 to 19". Drag to reorder.</p>
        <Sortable
          items={l.residences}
          onChange={(next) => set({ residences: next })}
          className="rep"
          render={(r, i, h) => (
            <div className="rep-item">
              <div className="rep-head">
                <Grip handle={h} label={`Move ${r.name}`} />
                <button type="button" className="rep-title" onClick={() => setOpenRes(openRes === i ? -1 : i)} aria-expanded={openRes === i}>
                  {r.name || 'Untitled'} · {r.bhk} BHK · floors {r.floors[0]}–{r.floors[1]}
                </button>
                <button type="button" className="icon-b" aria-label={`Remove ${r.name}`} onClick={() => set({ residences: l.residences.filter((_, j) => j !== i) })}>✕</button>
              </div>
              {openRes === i && (
                <div className="rep-body">
                  <div className="grid3">
                    <Text label="Name" value={r.name} onChange={(v) => setRes(i, { name: v })} />
                    <Num label="Bedrooms (BHK)" value={r.bhk} onChange={(v) => setRes(i, { bhk: v ?? 0 })} />
                    <Num label="Bathrooms" value={r.baths} onChange={(v) => setRes(i, { baths: v ?? 0 })} />
                    <Num label="Carpet area (sq ft)" required value={r.carpetSqft || null} onChange={(v) => setRes(i, { carpetSqft: v ?? 0 })} hint="RERA carpet area." />
                    <Num label="From floor" value={r.floors[0]} onChange={(v) => setRes(i, { floors: [v ?? 1, Math.max(v ?? 1, r.floors[1])] })} />
                    <Num label="To floor" value={r.floors[1]} onChange={(v) => setRes(i, { floors: [r.floors[0], v ?? r.floors[0]] })} />
                    <Num label="Price from (₹ Cr)" step={0.1} value={r.basePriceCr} onChange={(v) => setRes(i, { basePriceCr: v })} hint="Leave empty for 'Price on request'." placeholder="On request" />
                    <Text label="Aspect / view" value={r.facing} onChange={(v) => setRes(i, { facing: v })} />
                    <Sel label="3D floor plan" value={r.planId} onChange={(v) => setRes(i, { planId: v })} options={PLANS} />
                  </div>
                  <StringList label="Highlights" items={r.highlights} onChange={(v) => setRes(i, { highlights: v })} itemLabel="Highlight" />
                </div>
              )}
            </div>
          )}
        />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Floor availability</h2>
          <div className="actions">
            <button type="button" className="b b-sm" onClick={() => setAll('available')}>All available</button>
            <button type="button" className="b b-sm" onClick={() => setAll('sold')}>All sold</button>
          </div>
        </div>
        <p className="legend" style={{ marginBottom: 10 }}>
          Click a floor to change it:
          <span><i style={{ background: 'var(--ok)' }} />Available</span>
          <span><i style={{ background: 'var(--hold)' }} />Reserved</span>
          <span><i style={{ background: '#7d7c75' }} />Sold</span>
        </p>
        {floors.length === 0 ? (
          <p className="muted">Add a residence type with a floor range first.</p>
        ) : (
          <div className="floors">
            {floors.map((f) => (
              <button key={f.floor} type="button" className={`fl fl-${f.status}`} onClick={() => cycleFloor(f.floor, f.status)} title={`Floor ${f.floor}, ${f.residence.name}: ${f.status}`} aria-label={`Floor ${f.floor}, ${f.status}. Click to change.`}>
                {f.floor}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Photos</h2>
          <button type="button" className="b b-sm" onClick={() => fileInput.current?.click()}>+ Upload photos</button>
        </div>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = '' }} />
        {(l.photos ?? []).length === 0 ? (
          <div
            className="drop"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('is-over') }}
            onDragLeave={(e) => e.currentTarget.classList.remove('is-over')}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('is-over'); addPhotos(e.dataTransfer.files) }}
          >
            Drop photos here, or click to choose. The first photo is the cover.
          </div>
        ) : (
          <>
            <Sortable
              items={l.photos ?? []}
              ids={(l.photos ?? []).map((p, i) => `${i}-${p.url.slice(-24)}`)}
              onChange={(next) => set({ photos: next })}
              grid
              className="photos"
              render={(p, i, h) => (
                <figure className="photo" style={{ margin: 0 }}>
                  <img src={p.url} alt={p.caption || `Photo ${i + 1}`} ref={h.setActivatorNodeRef} {...h.attributes} {...h.listeners} />
                  <input aria-label={`Caption for photo ${i + 1}`} placeholder={i === 0 ? 'Cover photo caption' : 'Caption'} value={p.caption} onChange={(e) => set({ photos: (l.photos ?? []).map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)) })} />
                  <div className="row">
                    <span className="small muted">{i === 0 ? 'Cover' : `#${i + 1}`}</span>
                    <button type="button" className="b b-ghost b-sm b-danger" onClick={() => set({ photos: (l.photos ?? []).filter((_, j) => j !== i) })}>Remove</button>
                  </div>
                </figure>
              )}
            />
            <p className="hint" style={{ marginTop: 6 }}>Drag photos to reorder. The first one is the cover.</p>
          </>
        )}
      </section>

      <section className="card">
        <StringList label="Amenities" items={l.amenities} onChange={(v) => set({ amenities: v })} itemLabel="Amenity" />
      </section>

      <div className="actions" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
        <button type="button" className="b" onClick={() => save()} disabled={saving}>Save</button>
        {l.status !== 'published' && <button type="button" className="b b-gold" onClick={() => save(true)} disabled={saving}>Save and publish</button>}
      </div>
    </>
  )
}
