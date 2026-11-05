import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

/** Click (or tap) the map to place the listing's pin. Drag the pin to fine-tune. */
export default function MapPicker({ lat, lng, onPick }: { lat: number; lng: number; onPick: (lat: number, lng: number) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const pin = useRef<maplibregl.Marker | null>(null)
  const cb = useRef(onPick)
  cb.current = onPick

  useEffect(() => {
    if (!box.current) return
    const m = new maplibregl.Map({ container: box.current, style: 'https://tiles.openfreemap.org/styles/positron', center: [lng || 72.83, lat || 19.03], zoom: lat ? 14 : 10, attributionControl: { compact: true } })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    const marker = new maplibregl.Marker({ color: '#223f3e', draggable: true }).setLngLat([lng || 72.83, lat || 19.03]).addTo(m)
    marker.on('dragend', () => {
      const p = marker.getLngLat()
      cb.current(round(p.lat), round(p.lng))
    })
    m.on('click', (e) => {
      marker.setLngLat(e.lngLat)
      cb.current(round(e.lngLat.lat), round(e.lngLat.lng))
    })
    map.current = m
    pin.current = marker
    return () => m.remove()
  }, [])

  // Follow changes made elsewhere (typing coordinates, choosing a locality).
  useEffect(() => {
    if (!pin.current || !map.current || !lat || !lng) return
    const cur = pin.current.getLngLat()
    if (Math.abs(cur.lat - lat) > 1e-6 || Math.abs(cur.lng - lng) > 1e-6) {
      pin.current.setLngLat([lng, lat])
      map.current.easeTo({ center: [lng, lat], zoom: Math.max(map.current.getZoom(), 13) })
    }
  }, [lat, lng])

  return <div ref={box} className="picker" aria-label="Map: click to place the pin" />
}

const round = (n: number) => Math.round(n * 1e5) / 1e5
