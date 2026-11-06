import { useCallback, useEffect, useState } from 'react'
import { PROPERTIES, setProperties, type Property } from './data/listings'
import { getStore } from './data/store'
import ExploreView from './components/ExploreView'
import PropertyView from './components/PropertyView'

type Route = { view: 'explore' } | { view: 'property'; id: string; floor: number | null }

function parse(hash: string): Route {
  const m = hash.match(/^#\/p\/([\w-]+)(?:\/f\/(\d+))?/)
  if (m) return { view: 'property', id: m[1], floor: m[2] ? Number(m[2]) : null }
  return { view: 'explore' }
}

const INVITE_KEY = 'luxarea-invite-code'

function savedCode(): string | null {
  try {
    return sessionStorage.getItem(INVITE_KEY)
  } catch {
    return null
  }
}

/** Swap teasers for the full listings once a code is accepted. */
function mergePrivate(list: Property[]) {
  const byId = new Map(list.map((p) => [p.id, p]))
  setProperties([...PROPERTIES.filter((p) => !byId.has(p.id)), ...list])
}

async function tryUnlock(code: string): Promise<boolean> {
  try {
    const list = await (await getStore()).unlockPrivate(code)
    if (!list) return false
    mergePrivate(list)
    try {
      sessionStorage.setItem(INVITE_KEY, code.trim().toUpperCase())
    } catch {
      /* private mode: unlock lasts for this page only */
    }
    return true
  } catch {
    return false
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parse(location.hash))
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    const code = savedCode()
    if (code) tryUnlock(code).then((ok) => ok && setUnlocked(true))
    const onHash = () => {
      const inv = location.hash.match(/^#\/invite\/([\w-]+)/)
      if (inv) {
        tryUnlock(inv[1]).then((ok) => ok && setUnlocked(true))
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

  const unlock = useCallback(async (code: string) => {
    const ok = await tryUnlock(code)
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
