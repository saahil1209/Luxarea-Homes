import { useEffect, useState } from 'react'
import { newId, type Draft, type DraftStatus, type Extracted, type Listing, type Store } from '../data/store'
import { extractListing } from '../data/extract'
import { timeAgo, useToast } from './ui'

const SOURCE_LABEL = { whatsapp: 'WhatsApp', scan: 'Daily scan', manual: 'Pasted' } as const

export function factsOf(e: Extracted): [string, string][] {
  const out: [string, string][] = []
  if (e.locality) out.push(['Where', e.locality])
  if (e.bhk) out.push(['Size', `${e.bhk} BHK`])
  if (e.carpetSqft) out.push(['Carpet', `${e.carpetSqft.toLocaleString('en-IN')} sq ft`])
  if (e.floor) out.push(['Floor', String(e.floor)])
  if (e.totalFloors) out.push(['Storeys', String(e.totalFloors)])
  if (e.priceCr !== undefined) out.push(['Price', e.priceCr == null ? 'On request' : `₹${e.priceCr} Cr`])
  if (e.possession) out.push(['Possession', e.possession])
  if (e.developer) out.push(['Developer', e.developer])
  if (e.rera) out.push(['RERA', e.rera])
  if (e.offMarket) out.push(['Note', 'Off-market'])
  return out
}

export default function Inbox({ store, go, onChange }: { store: Store; go: (h: string) => void; onChange: () => void }) {
  const toast = useToast()
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [filter, setFilter] = useState<DraftStatus | 'all'>('new')
  const [paste, setPaste] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [attach, setAttach] = useState<string | null>(null)

  const load = async () => {
    setDrafts(await store.listDrafts())
    setListings(await store.listListings())
  }
  useEffect(() => {
    load()
  }, [])

  const update = async (d: Draft, patch: Partial<Draft>, msg: string) => {
    await store.saveDraft({ ...d, ...patch })
    await load()
    onChange()
    toast(msg)
  }

  const addPasted = async () => {
    const text = paste.trim()
    if (!text) return
    const d: Draft = { id: crypto.randomUUID?.() ?? newId('d-'), source: 'manual', receivedAt: new Date().toISOString(), from: 'Pasted in the admin', rawText: text, media: [], extracted: extractListing(text), status: 'new' }
    await store.saveDraft(d)
    setPaste('')
    setFilter('new')
    await load()
    onChange()
    toast('Added to the inbox')
  }

  const shown = (drafts ?? []).filter((d) => filter === 'all' || d.status === filter)
  const counts = { new: 0, approved: 0, rejected: 0, all: drafts?.length ?? 0 }
  for (const d of drafts ?? []) counts[d.status]++

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inbox</h1>
          <p>New listings forwarded on WhatsApp and new launches found by the daily scan. Nothing here is on the website until you turn it into a listing and publish it.</p>
        </div>
        <div className="seg" role="group" aria-label="Show">
          {(['new', 'approved', 'rejected', 'all'] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'new' ? 'To review' : f[0].toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      <div className="card paste" style={{ marginBottom: 16 }}>
        <label className="f">
          <span>Paste a listing message</span>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="e.g. Worli sea-facing 4 BHK, 3,450 carpet, 31st floor, asking 29.5 Cr" />
          <small>Size, floor, price and area are picked out automatically. Once the WhatsApp number is connected, forwarded messages arrive here on their own.</small>
        </label>
        <div><button type="button" className="b b-primary" onClick={addPasted} disabled={!paste.trim()}>Add to inbox</button></div>
      </div>

      {drafts == null ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="card"><p className="muted">{filter === 'new' ? 'All caught up. Nothing waiting for review.' : 'Nothing here.'}</p></div>
      ) : (
        <div className="inbox">
          {shown.map((d) => {
            const facts = factsOf(d.extracted)
            const linked = d.listingId ? listings.find((l) => l.id === d.listingId) : null
            return (
              <article key={d.id} className="card draft">
                <div className="draft-meta">
                  <span className={`src src-${d.source}`}>{SOURCE_LABEL[d.source]}</span>
                  <span className={`status st-${d.status}`}>{d.status === 'new' ? 'To review' : d.status}</span>
                  {d.sample && <span className="tag tag-sample">Sample</span>}
                  <span>{d.from}</span>
                  <span>· {timeAgo(d.receivedAt)}</span>
                  {d.sourceUrl && <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer">Source ↗</a>}
                </div>
                <p className="draft-summary">{d.extracted.summary || d.extracted.name || facts.slice(0, 3).map((f) => f[1]).join(' · ') || 'Listing message'}</p>
                {facts.length > 0 && (
                  <div className="facts">{facts.map(([k, v]) => <span key={k} className="fact"><b>{k}</b>{v}</span>)}</div>
                )}
                {(open[d.id] || !d.extracted.summary) && <p className="raw">{d.rawText}</p>}
                {d.extracted.summary && (
                  <button type="button" className="b b-ghost b-sm" style={{ justifySelf: 'start' }} onClick={() => setOpen({ ...open, [d.id]: !open[d.id] })}>
                    {open[d.id] ? 'Hide original message' : 'Show original message'}
                  </button>
                )}
                {linked && <p className="small">Linked to <a href={`#/listings/${linked.id}`}>{linked.name}</a></p>}
                <div className="draft-actions">
                  {d.status === 'new' && (
                    <>
                      <button type="button" className="b b-primary" onClick={() => go(`#/listings/new?draft=${d.id}`)}>Create listing</button>
                      <button type="button" className="b" onClick={() => setAttach(attach === d.id ? null : d.id)} aria-expanded={attach === d.id}>Add to existing…</button>
                      <button type="button" className="b b-danger" onClick={() => update(d, { status: 'rejected' }, 'Rejected')}>Reject</button>
                    </>
                  )}
                  {d.status !== 'new' && <button type="button" className="b" onClick={() => update(d, { status: 'new' }, 'Moved back to review')}>Undo</button>}
                </div>
                {attach === d.id && (
                  <label className="f" style={{ gridColumn: '1 / -1' }}>
                    <span>Which listing is this about?</span>
                    <select defaultValue="" onChange={(e) => e.target.value && go(`#/listings/${e.target.value}?draft=${d.id}`)}>
                      <option value="" disabled>Choose a listing</option>
                      {listings.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.locality}</option>)}
                    </select>
                    <small>Opens that listing with this message beside it, so you can update the price or availability.</small>
                  </label>
                )}
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
