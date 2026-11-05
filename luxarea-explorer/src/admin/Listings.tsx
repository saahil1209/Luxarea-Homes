import { useEffect, useMemo, useState } from 'react'
import { availableCount, formatCr, fromPrice } from '../data/listings'
import type { Listing, ListingStatus, Store } from '../data/store'
import { timeAgo } from './ui'

export default function Listings({ store, go }: { store: Store; go: (h: string) => void }) {
  const [list, setList] = useState<Listing[] | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ListingStatus | 'all'>('all')

  useEffect(() => {
    store.listListings().then(setList)
  }, [store])

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (list ?? []).filter((l) => (status === 'all' || l.status === status) && (!t || `${l.name} ${l.locality} ${l.developer}`.toLowerCase().includes(t)))
  }, [list, q, status])

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Listings</h1>
          <p>Everything on Luxarea's register. Only <b>published</b> listings appear in the Residence Finder; off-market ones show only to people with an invitation code.</p>
        </div>
        <button type="button" className="b b-primary" onClick={() => go('#/listings/new')}>+ New listing</button>
      </div>
      <div className="actions" style={{ marginBottom: 14 }}>
        <input aria-label="Search listings" placeholder="Search by name, area or developer" value={q} onChange={(e) => setQ(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--rule)', borderRadius: 8, minWidth: 260, background: '#fff' }} />
        <div className="seg" role="group" aria-label="Status">
          {(['all', 'published', 'draft', 'archived'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
      </div>
      {list == null ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="card"><p className="muted">No listings match.</p></div>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Residence</th><th>Status</th><th className="hide-sm">From</th><th className="hide-sm">Available</th><th className="hide-sm">Updated</th></tr>
          </thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.id} onClick={() => go(`#/listings/${l.id}`)}>
                <td>
                  <a href={`#/listings/${l.id}`} className="t-name" style={{ color: 'inherit', textDecoration: 'none' }}>{l.name}</a>
                  <div className="small muted">
                    {l.locality} {l.confidential && <span className="tag tag-private">Off-market</span>} {l.sample && <span className="tag tag-sample">Sample</span>}
                  </div>
                </td>
                <td><span className={`status st-${l.status}`}>{l.status}</span></td>
                <td className="hide-sm">{formatCr(fromPrice(l))}</td>
                <td className="hide-sm">{availableCount(l)} floors</td>
                <td className="hide-sm small muted">{timeAgo(l.updatedAt)}{l.updatedBy ? ` · ${l.updatedBy}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
