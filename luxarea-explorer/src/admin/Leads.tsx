import { useEffect, useState } from 'react'
import type { Lead, LeadStatus, Store } from '../data/store'
import { timeAgo, useToast } from './ui'

const STATUSES: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'closed', label: 'Closed' },
  { value: 'spam', label: 'Spam' },
]

const digits = (s: string) => s.replace(/\D/g, '')

export default function Leads({ store }: { store: Store }) {
  const toast = useToast()
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [filter, setFilter] = useState<LeadStatus | 'open'>('open')
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = () => store.listLeads().then(setLeads)
  useEffect(() => {
    load()
  }, [store])

  const update = async (l: Lead, patch: Partial<Pick<Lead, 'status' | 'teamNote'>>, msg: string) => {
    await store.updateLead(l.id, patch)
    await load()
    toast(msg)
  }

  const shown = (leads ?? []).filter((l) => (filter === 'open' ? l.status === 'new' || l.status === 'contacted' || l.status === 'qualified' : l.status === filter))

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Leads</h1>
          <p>Enquiries from the website form, newest first. Reply on the channel they chose, then move them along.</p>
        </div>
        <div className="seg" role="group" aria-label="Show">
          {(['open', 'new', 'closed', 'spam'] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'open' ? 'Open' : f[0].toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
      </div>

      {store.mode === 'local' && (
        <p className="banner">In demo mode the website form only opens WhatsApp, so no leads are saved here. Once Luxarea's database is connected, every enquiry lands on this page as well.</p>
      )}

      {leads == null ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="card"><p className="muted">No leads here.</p></div>
      ) : (
        <div className="inbox">
          {shown.map((l) => {
            const greeting = `Hello ${l.name.split(' ')[0]}, this is Luxarea Homes. Thank you for your enquiry${l.intent ? ` about ${l.intent.toLowerCase()}` : ''}.`
            return (
              <article key={l.id} className="card draft">
                <div className="draft-meta">
                  <span className={`status st-${l.status === 'new' ? 'new' : l.status === 'closed' || l.status === 'spam' ? 'rejected' : 'approved'}`}>{l.status}</span>
                  <span>{timeAgo(l.createdAt)}</span>
                  {l.channel && <span>· prefers {l.channel}</span>}
                  {l.page && <span>· from {l.page}</span>}
                </div>
                <p className="draft-summary">{l.name}{l.intent ? ` · ${l.intent}` : ''}</p>
                <div className="facts">
                  <span className="fact"><b>Phone</b>{l.phone}</span>
                  {l.budget && <span className="fact"><b>Budget</b>{l.budget}</span>}
                  {l.forWhom && <span className="fact"><b>For</b>{l.forWhom}</span>}
                  {l.utm && <span className="fact"><b>Campaign</b>{l.utm}</span>}
                </div>
                {l.note && <p className="raw">{l.note}</p>}
                <label className="f" style={{ gridColumn: '1 / -1' }}>
                  <span>Team note</span>
                  <textarea
                    value={notes[l.id] ?? l.teamNote ?? ''}
                    onChange={(e) => setNotes({ ...notes, [l.id]: e.target.value })}
                    onBlur={() => notes[l.id] !== undefined && notes[l.id] !== (l.teamNote ?? '') && update(l, { teamNote: notes[l.id] }, 'Note saved')}
                    placeholder="Who's following up, what was discussed"
                    style={{ minHeight: 56 }}
                  />
                </label>
                <div className="draft-actions">
                  <a className="b b-primary" href={`https://wa.me/${digits(l.phone)}?text=${encodeURIComponent(greeting)}`} target="_blank" rel="noopener">WhatsApp</a>
                  <a className="b" href={`tel:${l.phone.replace(/[^\d+]/g, '')}`}>Call</a>
                  <select aria-label="Status" value={l.status} onChange={(e) => update(l, { status: e.target.value as LeadStatus }, 'Updated')} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--rule)', background: '#fff', fontWeight: 700 }}>
                    {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
