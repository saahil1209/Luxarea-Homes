import { useCallback, useEffect, useState } from 'react'
import { PROPERTIES } from './data/listings'
import { DEMO_INVITE_CODES } from './config'
import ExploreView from './components/ExploreView'
import PropertyView from './components/PropertyView'

type Route = { view: 'explore' } | { view: 'property'; id: string; floor: number | null }

function parse(hash: string): Route {
  const m = hash.match(/^#\/p\/([\w-]+)(?:\/f\/(\d+))?/)
  if (m) return { view: 'property', id: m[1], floor: m[2] ? Number(m[2]) : null }
  return { view: 'explore' }
}

const INVITE_KEY = 'luxarea-invite'

function readInvite(): boolean {
  try {
    return sessionStorage.getItem(INVITE_KEY) === '1'
  } catch {
    return false
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parse(location.hash))
  const [unlocked, setUnlocked] = useState<boolean>(readInvite)

  useEffect(() => {
    const onHash = () => {
      const inv = location.hash.match(/^#\/invite\/([\w-]+)/)
      if (inv) {
        if (tryUnlock(inv[1])) setUnlocked(true)
        history.replaceState(null, '', '#/')
      }
      setRoute(parse(location.hash))
    }
    onHash()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((hash: string, replace = false) => {
    if (replace) {
      history.replaceState(null, '', hash)
      setRoute(parse(hash))
    } else {
      location.hash = hash
    }
  }, [])

  const unlock = useCallback((code: string) => {
    const ok = tryUnlock(code)
    if (ok) setUnlocked(true)
    return ok
  }, [])

  if (route.view === 'property') {
    const p = PROPERTIES.find((x) => x.id === route.id)
    if (p && (!p.confidential || unlocked)) {
      return <PropertyView key={p.id} property={p} floor={route.floor} go={go} />
    }
  }
  return <ExploreView unlocked={unlocked} unlock={unlock} go={go} />
}

function tryUnlock(code: string): boolean {
  const ok = DEMO_INVITE_CODES.includes(code.trim().toUpperCase())
  if (ok) {
    try {
      sessionStorage.setItem(INVITE_KEY, '1')
    } catch {
      /* private mode: unlock lasts for this page only */
    }
  }
  return ok
}
