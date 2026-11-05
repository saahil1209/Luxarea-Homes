import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { formatCr, fromPrice, type Property } from '../data/listings'

// OpenFreeMap: free, no API key, commercial use allowed. Attribution is kept on.
const STYLE = 'https://tiles.openfreemap.org/styles/positron'

interface Props {
  properties: Property[]
  unlocked: boolean
  activeId: string | null
  onHover: (id: string | null) => void
  onOpen: (p: Property) => void
}

export default function MapView({ properties, unlocked, activeId, onHover, onOpen }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef(new Map<string, { marker: maplibregl.Marker; el: HTMLElement }>())
  const handlers = useRef({ onHover, onOpen })
  handlers.current = { onHover, onOpen }

  useEffect(() => {
    if (!box.current) return
    const m = new maplibregl.Map({
      container: box.current,
      style: STYLE,
      center: [72.83, 19.03],
      zoom: 11,
      attributionControl: { compact: true },
      cooperativeGestures: false,
    })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    m.scrollZoom.setWheelZoomRate(1 / 600)
    map.current = m
    const ro = new ResizeObserver(() => m.resize())
    ro.observe(box.current)
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
      markers.current.clear()
    }
  }, [])

  // Sync markers with the filtered list.
  useEffect(() => {
    const m = map.current
    if (!m) return
    const keep = new Set(properties.map((p) => p.id))
    for (const [id, { marker }] of markers.current) {
      if (!keep.has(id)) {
        marker.remove()
        markers.current.delete(id)
      }
    }
    for (const p of properties) {
      const locked = !!p.confidential && !unlocked
      const existing = markers.current.get(p.id)
      if (existing && existing.el.dataset.locked === String(locked)) continue
      existing?.marker.remove()

      const el = document.createElement('button')
      el.type = 'button'
      el.dataset.locked = String(locked)
      el.className = locked ? 'pin pin-private' : 'pin'
      el.setAttribute('aria-label', locked ? `Private residence in ${p.locality}` : `${p.name}, ${p.locality}`)
      el.innerHTML = locked
        ? `<span class="pin-ring"></span><span class="pin-label">Private · ${p.locality}</span>`
        : `<span class="pin-price">${fromPrice(p) == null ? 'On request' : formatCr(fromPrice(p)) + '+'}</span><span class="pin-name">${p.name}</span>`
      el.addEventListener('mouseenter', () => handlers.current.onHover(p.id))
      el.addEventListener('mouseleave', () => handlers.current.onHover(null))
      el.addEventListener('click', () => {
        if (!locked) handlers.current.onOpen(p)
      })
      const marker = new maplibregl.Marker({ element: el, anchor: locked ? 'center' : 'bottom' }).setLngLat([p.lng, p.lat]).addTo(m)
      markers.current.set(p.id, { marker, el })
    }

    if (properties.length) {
      const b = new maplibregl.LngLatBounds()
      properties.forEach((p) => b.extend([p.lng, p.lat]))
      const fit = (animate: boolean) => {
        m.resize()
        const pad = m.getContainer().clientWidth < 600 ? 56 : 90
        m.fitBounds(b, { padding: pad, maxZoom: 14, duration: animate ? 700 : 0 })
      }
      if (m.loaded()) fit(true)
      else m.once('load', () => fit(false))
    }
  }, [properties, unlocked])

  useEffect(() => {
    for (const [id, { el }] of markers.current) el.classList.toggle('is-active', id === activeId)
  }, [activeId])

  return <div ref={box} className="map" role="region" aria-label="Map of residences" />
}
