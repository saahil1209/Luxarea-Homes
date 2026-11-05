import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getStore, type Store, type User } from '../data/store'
import { ToastProvider } from './ui'
import Inbox from './Inbox'
import Listings from './Listings'
import ListingEditor from './ListingEditor'
import WebsiteEditor from './WebsiteEditor'

type Route = { page: 'inbox' } | { page: 'listings' } | { page: 'listing'; id: string; fromDraft?: string } | { page: 'website' }

function parse(hash: string): Route {
  const m = hash.match(/^#\/listings\/([\w-]+)(?:\?draft=([\w-]+))?/)
  if (m) return { page: 'listing', id: m[1], fromDraft: m[2] }
  if (hash.startsWith('#/listings')) return { page: 'listings' }
  if (hash.startsWith('#/website')) return { page: 'website' }
  return { page: 'inbox' }
}

export default function AdminApp() {
  const [store, setStore] = useState<Store | null>(null)
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [route, setRoute] = useState<Route>(() => parse(location.hash))
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    getStore().then(async (s) => {
      setStore(s)
      setUser(await s.currentUser())
    })
    const onHash = () => setRoute(parse(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const refreshCount = useCallback(async () => {
    if (!store) return
    const d = await store.listDrafts()
    setNewCount(d.filter((x) => x.status === 'new').length)
  }, [store])
  useEffect(() => {
    if (user) refreshCount()
  }, [user, refreshCount, route])

  if (!store || user === undefined) return <div className="login" aria-busy="true" />
  if (!user) return <Login store={store} onIn={setUser} />

  const go = (hash: string) => (location.hash = hash)
  const nav = (href: string, label: string, current: boolean, badge?: number) => (
    <a href={href} aria-current={current ? 'page' : undefined}>
      {label}
      {!!badge && <span className="count">{badge}</span>}
    </a>
  )

  return (
    <ToastProvider>
      <div className="shell">
        <aside className="side">
          <a className="brand" href="#/inbox">
            <svg viewBox="0 0 564 517" aria-hidden="true"><path fill="#c49a6c" d="M0 220 281 0 564 220v37L281 37 0 257z" /><rect fill="#c49a6c" x="420" y="40" width="29" height="95" /><path fill="#8f7c5f" d="M0 350 281 130 564 350v37L281 167 0 387z" /><path fill="#575d4e" d="M0 480 281 260 564 480v37L281 297 0 517z" /></svg>
            <div><b>LUXAREA</b><span>Team admin</span></div>
          </a>
          <nav aria-label="Admin">
            {nav('#/inbox', 'Inbox', route.page === 'inbox', newCount)}
            {nav('#/listings', 'Listings', route.page === 'listings' || route.page === 'listing')}
            {nav('#/website', 'Website', route.page === 'website')}
          </nav>
          <div className="side-foot">
            {store.mode === 'local' && <span className="mode-pill" title="Data is saved in this browser only">Demo data</span>}
            <span>{user.name}</span>
            <a href="/" target="_blank" rel="noopener">View the website ↗</a>
            <button type="button" onClick={async () => { await store.signOut(); setUser(null) }}>Sign out</button>
          </div>
        </aside>
        <main className="main">
          {store.mode === 'local' && (
            <p className="banner">
              <b>Demo mode.</b> Changes are saved in this browser only, so other people won't see them. This switches to Luxarea's shared database once it is set up.
            </p>
          )}
          {route.page === 'inbox' && <Inbox store={store} go={go} onChange={refreshCount} />}
          {route.page === 'listings' && <Listings store={store} go={go} />}
          {route.page === 'listing' && <ListingEditor key={route.id} store={store} id={route.id} fromDraft={route.fromDraft} go={go} user={user} />}
          {route.page === 'website' && <WebsiteEditor store={store} user={user} />}
        </main>
      </div>
    </ToastProvider>
  )
}

function Login({ store, onIn }: { store: Store; onIn: (u: User) => void }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter your work email.')
    try {
      const r = await store.signIn(email.trim())
      if (r === 'check-email') setSent(true)
      else {
        const u = await store.currentUser()
        if (u) onIn(u)
      }
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Could not sign in.')
    }
  }
  return (
    <div className="login">
      <form onSubmit={submit}>
        <h1>Luxarea team sign-in</h1>
        {sent ? (
          <p>Check your inbox: we sent a sign-in link to <b>{email}</b>.</p>
        ) : (
          <>
            <p className="muted">
              {store.mode === 'local' ? 'Demo mode: any email works, and nothing leaves this browser.' : 'We will email you a one-time sign-in link. Only team members can get in.'}
            </p>
            <label className="f">
              <span>Work email</span>
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@luxarea.in" autoFocus />
            </label>
            {err && <p className="req" role="alert">{err}</p>}
            <button className="b b-primary" type="submit">{store.mode === 'local' ? 'Enter the admin' : 'Email me a sign-in link'}</button>
          </>
        )}
      </form>
    </div>
  )
}
