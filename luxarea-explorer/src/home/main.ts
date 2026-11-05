// Home page enhancements. The page is complete without this script; everything
// here is progressive: scroll reveals, parallax, the lazy 3D hero, the map
// teaser pins, tabs, and the two-step contact form.
import { PROPERTIES, floorsOf, formatCr, fromPrice } from '../data/listings'
import { BRAND, LEAD_ENDPOINT } from '../config'

function init() {
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)]
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isPhone = () => window.innerWidth <= 760

// ---------- header + mobile bar ----------
const header = $('.site-header')!
const hero = $('.hero')!
const mobileBar = $('.mobile-bar')!
const contact = $('#contact')!
let pastHero = false
let contactInView = false
const syncBars = () => mobileBar.classList.toggle('is-on', pastHero && !contactInView)
new IntersectionObserver(([e]) => {
  pastHero = !e.isIntersecting
  syncBars()
}, { rootMargin: '-35% 0px 0px 0px' }).observe(hero)
new IntersectionObserver(([e]) => {
  contactInView = e.isIntersecting
  syncBars()
}).observe(contact)

// ---------- reveal on scroll ----------
const revealObs = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      e.target.classList.add('is-in')
      revealObs.unobserve(e.target)
    }
  },
  { rootMargin: '0px 0px -8% 0px' },
)
$$('.reveal').forEach((el) => {
  // Stagger siblings a little.
  const sibs = el.parentElement ? [...el.parentElement.children].filter((c) => c.classList.contains('reveal')) : []
  const idx = sibs.indexOf(el)
  if (idx > 0) el.style.transitionDelay = `${Math.min(idx, 4) * 80}ms`
  revealObs.observe(el)
})

// ---------- scroll-driven: header, parallax, process line ----------
const necklace = $('.necklace')
const sealink = $('.sealink')
const stage = $('#hero-stage')!
const steps = $('.steps')
let ticking = false
function onScroll() {
  ticking = false
  const y = window.scrollY
  header.classList.toggle('is-solid', y > 24)
  const heroH = hero.offsetHeight
  if (!reduceMotion && y < heroH * 1.2) {
    // Foreground moves faster than the page, the tower slower: depth.
    if (sealink) sealink.style.transform = `translate3d(0, ${-y * 0.35}px, 0)`
    if (necklace) necklace.style.transform = `translate3d(0, ${-y * 0.12}px, 0)`
    if (!isPhone()) stage.style.transform = `translate3d(0, ${y * 0.25}px, 0)`
  }
  if (steps) {
    const r = steps.getBoundingClientRect()
    const vh = window.innerHeight
    const p = Math.min(1, Math.max(0, (vh * 0.75 - r.top) / r.height))
    steps.style.setProperty('--progress', reduceMotion ? '1' : p.toFixed(3))
  }
}
window.addEventListener('scroll', () => {
  if (!ticking) {
    ticking = true
    requestAnimationFrame(onScroll)
  }
}, { passive: true })
onScroll()

// ---------- hero: lazy 3D tower ----------
const FLAGSHIP = PROPERTIES.find((p) => p.id === 'sea-ledger') ?? PROPERTIES.find((p) => !p.confidential)!
const startBtn = $<HTMLButtonElement>('#tower-start')!
const tip = $('#hero-tip')!
const card = $('#floor-card')!
const heroCopy = $('.hero-copy')!

type Scene = import('../three/TowerScene').TowerScene
let scene: Scene | null = null
let loading = false

function webglOK() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
const saveData = !!conn?.saveData
const finePointer = window.matchMedia('(pointer: fine)').matches

async function loadTower() {
  if (scene || loading || !webglOK()) return
  loading = true
  startBtn.hidden = true
  const { TowerScene } = await import('../three/TowerScene')
  const floors = floorsOf(FLAGSHIP)
  const byFloor = new Map(floors.map((f) => [f.floor, f]))
  const touch = !finePointer
  scene = new TowerScene(
    stage,
    tip,
    FLAGSHIP,
    floors,
    {
      onHover(floor) {
        const f = floor != null ? byFloor.get(floor) : null
        tip.innerHTML = f
          ? `<span class="tip-eyebrow">Floor ${f.floor} · ${FLAGSHIP.name}</span><span class="tip-name">${f.residence.name}</span><span class="tip-spec">${f.residence.bhk} BHK · ${f.residence.carpetSqft.toLocaleString('en-IN')} sq ft</span><span class="tip-status status-${f.status}">${statusLabel(f.status)}${f.status !== 'sold' ? ` · ${formatCr(f.priceCr)}` : ''}</span>`
          : ''
      },
      onSelect(floor) {
        openFloor(floor)
      },
    },
    { zoom: false, rotate: !touch },
  )
  stage.classList.add('is-live')
  fitScene()
  // Stop drawing when the hero is off screen.
  new IntersectionObserver(([e]) => scene?.setPaused(!e.isIntersecting)).observe(stage)
}

function statusLabel(s: string) {
  return s === 'available' ? 'Available' : s === 'reserved' ? 'Reserved' : 'Sold'
}

function fitScene() {
  if (!scene) return
  if (isPhone()) {
    scene.setInsets(0, 0, card.hidden ? 0 : card.offsetHeight + 24)
  } else {
    const left = heroCopy.getBoundingClientRect().right + 24
    const right = card.hidden ? 0 : card.offsetWidth + 48
    scene.setInsets(Math.max(0, left), right, 90)
  }
}
window.addEventListener('resize', fitScene)

function openFloor(floor: number | null) {
  if (!scene) return
  scene.select(floor)
  if (floor == null) {
    card.hidden = true
    fitScene()
    return
  }
  const info = floorsOf(FLAGSHIP).find((x) => x.floor === floor)
  if (!info) return
  {
    $('#fc-eyebrow')!.textContent = `Floor ${floor} of ${FLAGSHIP.totalFloors} · ${FLAGSHIP.locality}`
    $('#fc-name')!.textContent = `${info.residence.name}, ${FLAGSHIP.name}`
    $('#fc-spec')!.textContent = `${info.residence.bhk} BHK · ${info.residence.carpetSqft.toLocaleString('en-IN')} sq ft carpet · ${statusLabel(info.status)}${info.status !== 'sold' ? ` · ${formatCr(info.priceCr)}` : ''}`
    $<HTMLAnchorElement>('#fc-finder')!.href = `/residences.html#/p/${FLAGSHIP.id}/f/${floor}`
    const ask = $<HTMLAnchorElement>('#fc-ask')!
    ask.textContent = info.status === 'sold' ? 'Ask about similar homes' : 'Ask about this residence'
    ask.dataset.note = `${FLAGSHIP.name}, ${info.residence.name}, floor ${floor}`
    card.hidden = false
    fitScene()
  }
}

$('#fc-close')!.addEventListener('click', () => openFloor(null))
$('#fc-ask')!.addEventListener('click', (e) => {
  const note = (e.currentTarget as HTMLElement).dataset.note
  prefill({ intent: 'home', note: note ? `I'm interested in ${note} (seen on the home page).` : undefined })
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !card.hidden) openFloor(null)
})

// Desktop: load when the browser is idle. Phones and Save-Data: wait for a tap,
// so the page stays light and swipes keep scrolling.
if (webglOK()) {
  if (finePointer && !isPhone() && !saveData) {
    const idle = (cb: () => void) =>
      'requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 2500 }) : setTimeout(cb, 1200)
    if (document.readyState === 'complete') idle(loadTower)
    else window.addEventListener('load', () => idle(loadTower), { once: true })
  } else {
    startBtn.hidden = false
    startBtn.addEventListener('click', loadTower, { once: true })
  }
}

// ---------- finder teaser map ----------
const pinLayer = $('#teaser-pins')
const mapFig = $('.finder-map')
if (pinLayer && mapFig) {
  const SVGNS = 'http://www.w3.org/2000/svg'
  // Same projection the SVG coastline was drawn with.
  const project = (lat: number, lng: number) => ({ x: 58 + (lng - 72.795) * 1091, y: (19.16 - lat) * 1154 })
  const el = (tag: string, attrs: Record<string, string | number>, parent?: Element) => {
    const n = document.createElementNS(SVGNS, tag)
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v))
    parent?.appendChild(n)
    return n
  }
  PROPERTIES.forEach((p, i) => {
    const { x, y } = project(p.lat, p.lng)
    const locked = !!p.confidential
    const a = el('a', {
      href: locked ? '/residences.html' : `/residences.html#/p/${p.id}`,
      class: 'tpin',
      'aria-label': locked ? `Private residence in ${p.locality}, by invitation` : `${p.name}, ${p.locality}, from ${formatCr(fromPrice(p))}`,
      style: `transition-delay:${i * 90}ms`,
    }, pinLayer)
    el('circle', { class: 'halo', cx: x, cy: y, r: locked ? 16 : 11 }, a)
    el('circle', { class: 'dot', cx: x, cy: y, r: locked ? 4 : 5.5 }, a)
    const flip = x > 150
    const lx = flip ? x - 124 : x + 12
    const g = el('g', { class: 'tlabel' }, a)
    el('rect', { x: lx, y: y - 22, width: 112, height: 36, rx: 6 }, g)
    const t1 = el('text', { x: lx + 9, y: y - 8, class: 'tname' }, g)
    t1.textContent = locked ? `Private · ${p.locality.split(',')[0]}` : p.name
    const t2 = el('text', { x: lx + 9, y: y + 7 }, g)
    t2.textContent = locked ? 'By invitation' : `from ${formatCr(fromPrice(p))}`
  })
  new IntersectionObserver(([e], obs) => {
    if (e.isIntersecting) {
      mapFig.classList.add('is-in')
      obs.disconnect()
    }
  }, { threshold: 0.3 }).observe(mapFig)
}

// ---------- tabs ----------
for (const root of $$('[data-tabs]')) {
  const tabs = $$<HTMLButtonElement>('[role="tab"]', root)
  const panels = $$('[role="tabpanel"]', root)
  const select = (i: number, focus = false) => {
    tabs.forEach((t, j) => {
      t.setAttribute('aria-selected', String(i === j))
      t.tabIndex = i === j ? 0 : -1
    })
    panels.forEach((p, j) => (p.hidden = i !== j))
    if (focus) tabs[i].focus()
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i))
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      if (d) {
        e.preventDefault()
        select((i + d + tabs.length) % tabs.length, true)
      }
    })
  })
  select(0)
}

// ---------- contact form ----------
const form = $<HTMLFormElement>('#lead-form')!
const stepEls = $$<HTMLFieldSetElement>('.form-step', form)
const progress = $$('.form-progress li', form)
const errorEl = $('#form-error', form)!
const done = $('#form-done', form)!

function showStep(n: number, focus = true) {
  stepEls.forEach((s) => (s.dataset.active = String(s.dataset.step === String(n))))
  progress.forEach((li, i) => li.classList.toggle('is-on', i < n))
  if (focus) {
    const first = $<HTMLElement>(`.form-step[data-step="${n}"] input:not([type=hidden])`, form)
    first?.focus({ preventScroll: true })
  }
}
showStep(1, false)

$('.next-step', form)!.addEventListener('click', () => {
  if (!form.querySelector('input[name="intent"]:checked')) {
    const first = $<HTMLInputElement>('input[name="intent"]', form)!
    first.focus()
    errorEl.textContent = 'Please choose what you are looking for.'
    // Error sits in step 2; show it near step 1 instead.
    $('.next-step', form)!.insertAdjacentElement('beforebegin', errorEl)
    return
  }
  errorEl.textContent = ''
  $('.form-actions', form)!.insertAdjacentElement('beforebegin', errorEl)
  showStep(2)
})
$('.prev-step', form)!.addEventListener('click', () => showStep(1))

// Hidden context fields.
const params = new URLSearchParams(location.search)
const utm = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
  .map((k) => (params.get(k) ? `${k}=${params.get(k)}` : ''))
  .filter(Boolean)
  .join('&')
;(form.elements.namedItem('page') as HTMLInputElement).value = location.pathname + location.hash
;(form.elements.namedItem('utm') as HTMLInputElement).value = utm
;(form.elements.namedItem('referrer') as HTMLInputElement).value = document.referrer

function prefill({ intent, channel, note }: { intent?: string; channel?: string; note?: string }) {
  if (intent) {
    const r = $<HTMLInputElement>(`input[name="intent"][data-intent="${intent}"]`, form)
    if (r) r.checked = true
  }
  if (channel) {
    const r = $<HTMLInputElement>(`input[name="channel"][value="${channel}"]`, form)
    if (r) r.checked = true
  }
  if (note) (form.elements.namedItem('note') as HTMLTextAreaElement).value = note
}
$$<HTMLAnchorElement>('[data-intent]').forEach((a) => {
  if (a.tagName === 'A') a.addEventListener('click', () => prefill({ intent: a.dataset.intent }))
})
$$<HTMLAnchorElement>('[data-channel]').forEach((a) => a.addEventListener('click', () => prefill({ channel: a.dataset.channel })))

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const data = new FormData(form)
  const name = String(data.get('name') || '').trim()
  const phone = String(data.get('phone') || '').trim()
  const nameEl = form.elements.namedItem('name') as HTMLInputElement
  const phoneEl = form.elements.namedItem('phone') as HTMLInputElement
  nameEl.removeAttribute('aria-invalid')
  phoneEl.removeAttribute('aria-invalid')
  let problem = ''
  if (!name) {
    problem = 'Please add your name.'
    nameEl.setAttribute('aria-invalid', 'true')
    nameEl.focus()
  } else if (phone.replace(/\D/g, '').length < 8) {
    problem = 'Please add a WhatsApp or mobile number we can reach you on.'
    phoneEl.setAttribute('aria-invalid', 'true')
    phoneEl.focus()
  } else if (!data.get('consent')) {
    problem = 'Please tick the box so we can contact you.'
  }
  errorEl.textContent = problem
  if (problem) return

  const lead = Object.fromEntries([...data.entries()].map(([k, v]) => [k, String(v)]))
  const channel = lead.channel || 'WhatsApp'
  const message = [
    `Hello Luxarea, I'm ${name}.`,
    `Looking for: ${lead.intent || 'not specified'}`,
    lead.budget ? `Budget: ${lead.budget}` : '',
    lead.for ? `For: ${lead.for}` : '',
    `Best way to reach me: ${channel} on ${phone}`,
    lead.note ? `Note: ${lead.note}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  if (LEAD_ENDPOINT) {
    const btn = $<HTMLButtonElement>('button[type=submit]', form)!
    btn.disabled = true
    try {
      const res = await fetch(LEAD_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...lead, message }) })
      if (!res.ok) throw new Error(String(res.status))
    } catch {
      btn.disabled = false
      errorEl.innerHTML = `Sorry, that didn't go through. Please message us on <a href="${BRAND.whatsappLink}" target="_blank" rel="noopener">WhatsApp</a> or call ${BRAND.phoneDisplay}.`
      return
    }
  } else {
    // No lead endpoint yet: hand the enquiry to WhatsApp, prefilled.
    window.open(`https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(message)}`, '_blank', 'noopener')
  }

  stepEls.forEach((s) => (s.dataset.active = 'false'))
  $('.form-progress', form)!.hidden = true
  $('#done-channel', form)!.textContent = channel === 'Phone call' ? 'a phone call' : channel
  done.hidden = false
  done.focus()
})
}

// Demo mode only: if the team published content from /admin in this browser,
// show it in place of the built-in page. In Supabase mode the build already
// contains the published content, so this never runs.
let demoFlag: string | null = null
try {
  demoFlag = import.meta.env.VITE_DATA_MODE !== 'supabase' ? localStorage.getItem('luxarea-demo-content') : null
} catch {
  /* storage blocked */
}
if (demoFlag) {
  import('./demoContent')
    .then((m) => m.applyDemoContent())
    .catch(() => {})
    .finally(init)
} else {
  init()
}
