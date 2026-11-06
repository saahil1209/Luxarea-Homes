// Motion for the home page: smooth scroll, parallax (scroll + pointer),
// cursor glow, magnetic CTA, map tilt, card spotlights, count-up, tab ink,
// process progress, scrollspy and the auto-hiding header.
//
// One requestAnimationFrame loop drives everything that follows scroll or the
// pointer, with exponential smoothing so nothing snaps. Only transform and
// opacity change. Pointer effects need a real mouse; all movement is skipped
// under prefers-reduced-motion.
import Lenis from 'lenis'

type Lerp = { v: number; t: number }
const damp = (s: Lerp, k: number, dt: number) => {
  s.v += (s.t - s.v) * (1 - Math.exp(-k * dt))
  return Math.abs(s.t - s.v) > 0.01
}

export function initMotion() {
  const doc = document.documentElement
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
  const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)
  const $$ = <T extends Element = HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)]
  ;(window as unknown as { __lxMotion: boolean }).__lxMotion = true

  // ---------- smooth scrolling (desktop, mouse/trackpad) ----------
  let lenis: Lenis | null = null
  if (!reduce && fine) {
    lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true })
    // In-page links glide, and land below the fixed header.
    document.addEventListener('click', (e) => {
      const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]')
      if (!a || a.getAttribute('href') === '#') return
      const target = document.getElementById(a.getAttribute('href')!.slice(1))
      if (!target) return
      e.preventDefault()
      lenis!.scrollTo(target, { offset: -72, duration: 1.4 })
      history.replaceState(null, '', a.getAttribute('href'))
    })
  }

  // ---------- reveals ----------
  const revealObs = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.classList.add('is-in')
        revealObs.unobserve(e.target)
      }
    },
    { rootMargin: '0px 0px -10% 0px' },
  )
  $$('.reveal').forEach((el) => {
    const sibs = el.parentElement ? [...el.parentElement.children].filter((c) => c.classList.contains('reveal')) : []
    const idx = sibs.indexOf(el)
    if (idx > 0 && !el.classList.contains('section-head')) el.style.transitionDelay = `${Math.min(idx, 5) * 70}ms`
    revealObs.observe(el)
  })

  // ---------- count-up ("25 years") ----------
  const countObs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      countObs.unobserve(e.target)
      const el = e.target as HTMLElement
      const m = el.textContent!.match(/^(\d+)(.*)$/)
      if (!m || reduce) continue
      const to = Number(m[1])
      const rest = m[2]
      const t0 = performance.now()
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / 1600)
        const eased = 1 - Math.pow(1 - p, 4)
        el.textContent = `${Math.round(to * eased)}${rest}`
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
  }, { threshold: 0.6 })
  $$('.proof-list strong').forEach((el) => /^\d/.test(el.textContent ?? '') && countObs.observe(el))

  // ---------- card spotlight (sets the glow position on the hovered card only) ----------
  if (fine) {
    document.addEventListener('pointermove', (e) => {
      const card = (e.target as Element).closest<HTMLElement>('.service, .checks div, .quote, .person')
      if (!card) return
      const r = card.getBoundingClientRect()
      card.style.setProperty('--mx', `${e.clientX - r.left}px`)
      card.style.setProperty('--my', `${e.clientY - r.top}px`)
    }, { passive: true })
  }

  // ---------- tabs: sliding ink ----------
  for (const list of $$('.tab-list')) {
    const ink = document.createElement('span')
    ink.className = 'tab-ink'
    ink.setAttribute('aria-hidden', 'true')
    list.appendChild(ink)
    const place = () => {
      const sel = list.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!sel) return
      ink.style.transform = `translateX(${sel.offsetLeft - list.scrollLeft}px) scaleX(${sel.offsetWidth / 100})`
    }
    new MutationObserver(place).observe(list, { attributes: true, subtree: true, attributeFilter: ['aria-selected'] })
    addEventListener('resize', place)
    document.fonts?.ready.then(place)
    place()
  }

  // ---------- scrollspy for the main nav ----------
  const navLinks = $$<HTMLAnchorElement>('.nav a[href^="#"]')
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const link = navLinks.find((a) => a.getAttribute('href') === `#${e.target.id}`)
      link?.classList.toggle('is-active', e.isIntersecting)
    }
  }, { rootMargin: '-45% 0px -50% 0px' })
  navLinks.forEach((a) => {
    const t = document.getElementById(a.getAttribute('href')!.slice(1))
    if (t) spy.observe(t)
  })

  // ---------- the loop ----------
  const header = $('.site-header')!
  const hero = $('.hero')!
  const stage = $('#hero-stage')
  const copy = $('.hero-copy')
  const sky = $('.hero-sky')
  const necklace = $('.necklace')
  const sealink = $('.sealink')
  const glow = $('.hero-glow')
  const magnet = $('.magnetic')
  const tilt = $('.finder-map.tilt')
  const tiltSvg = tilt?.querySelector<HTMLElement>('.map-frame') ?? null
  const steps = $('.steps')
  const stepEls = $$('.step')
  const speedEls = $$('[data-speed]').map((el) => ({ el, speed: Number(el.dataset.speed), top: 0, h: 0 }))

  const scroll: Lerp = { v: scrollY, t: scrollY }
  const px: Lerp = { v: 0, t: 0 } // pointer, -1..1 across the viewport
  const py: Lerp = { v: 0, t: 0 }
  const gx: Lerp = { v: innerWidth / 2, t: innerWidth / 2 } // glow position in px
  const gy: Lerp = { v: innerHeight / 2, t: innerHeight / 2 }
  const mx: Lerp = { v: 0, t: 0 } // magnetic offset
  const my: Lerp = { v: 0, t: 0 }
  const tx: Lerp = { v: 0, t: 0 } // map tilt
  const ty: Lerp = { v: 0, t: 0 }
  const prog: Lerp = { v: 0, t: 0 }

  let heroH = hero.offsetHeight
  let lastY = scrollY
  let hideAcc = 0
  const measure = () => {
    heroH = hero.offsetHeight
    for (const s of speedEls) {
      s.el.style.transform = ''
      const r = s.el.getBoundingClientRect()
      s.top = r.top + scrollY
      s.h = r.height
    }
  }
  measure()
  addEventListener('resize', measure)
  addEventListener('load', measure)

  if (fine && !reduce) {
    addEventListener('pointermove', (e) => {
      px.t = (e.clientX / innerWidth) * 2 - 1
      py.t = (e.clientY / innerHeight) * 2 - 1
      const hr = hero.getBoundingClientRect()
      const inHero = e.clientY >= hr.top && e.clientY <= hr.bottom
      hero.classList.toggle('has-pointer', inHero)
      if (inHero) {
        gx.t = e.clientX - hr.left
        gy.t = e.clientY - hr.top
      }
      if (magnet) {
        const r = magnet.getBoundingClientRect()
        const dx = e.clientX - (r.left + r.width / 2)
        const dy = e.clientY - (r.top + r.height / 2)
        const near = Math.hypot(dx, dy) < Math.max(r.width, 120)
        mx.t = near ? dx * 0.22 : 0
        my.t = near ? dy * 0.3 : 0
      }
      if (tilt) {
        const r = tilt.getBoundingClientRect()
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
        tx.t = inside ? -(((e.clientY - r.top) / r.height) * 2 - 1) * 6 : 0
        ty.t = inside ? (((e.clientX - r.left) / r.width) * 2 - 1) * 8 : 0
      }
      wake()
    }, { passive: true })
    document.addEventListener('pointerleave', () => {
      px.t = py.t = mx.t = my.t = tx.t = ty.t = 0
      hero.classList.remove('has-pointer')
      wake()
    })
  }

  addEventListener('scroll', () => {
    scroll.t = scrollY
    wake()
  }, { passive: true })

  let raf = 0
  let last = performance.now()
  function wake() {
    if (!raf) {
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
  }

  function frame(now: number) {
    raf = 0
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    lenis?.raf(now)

    // Scroll is already smoothed by Lenis on desktop; follow it closely.
    let moving = damp(scroll, lenis ? 30 : 14, dt)
    moving = damp(px, 4, dt) || moving
    moving = damp(py, 4, dt) || moving
    moving = damp(gx, 7, dt) || moving
    moving = damp(gy, 7, dt) || moving
    moving = damp(mx, 9, dt) || moving
    moving = damp(my, 9, dt) || moving
    moving = damp(tx, 7, dt) || moving
    moving = damp(ty, 7, dt) || moving

    const y = scroll.v
    const vh = innerHeight

    // header: solid after the top; hides going down, returns going up
    header.classList.toggle('is-solid', y > 24)
    doc.classList.toggle('is-scrolled', y > 40)
    const dy = scrollY - lastY
    lastY = scrollY
    hideAcc = Math.sign(dy) === Math.sign(hideAcc) ? hideAcc + dy : dy
    if (scrollY < heroH * 0.6 || header.contains(document.activeElement)) header.classList.remove('is-hidden')
    else if (hideAcc > 60) header.classList.add('is-hidden')
    else if (hideAcc < -30) header.classList.remove('is-hidden')

    // hero layers: depth from scroll + pointer
    if (!reduce && y < heroH * 1.3) {
      const p = px.v
      const q = py.v
      const phone = innerWidth <= 760
      if (sky) sky.style.transform = `translate3d(${p * -10}px, ${y * 0.12 + q * -8}px, 0) scale(1.06)`
      if (necklace) necklace.style.transform = `translate3d(${p * -18}px, ${-y * 0.12 + q * -4}px, 0)`
      if (sealink) sealink.style.transform = `translate3d(${p * -34}px, ${-y * 0.35}px, 0)`
      if (stage && !phone) stage.style.transform = `translate3d(${p * 12}px, ${y * 0.22 + q * 8}px, 0)`
      if (copy && !phone) {
        const fade = Math.min(1, y / (heroH * 0.7))
        copy.style.transform = `translate3d(${p * 6}px, ${y * -0.08}px, 0)`
        copy.style.opacity = String(1 - fade * 0.85)
      }
      if (glow) glow.style.transform = `translate3d(${gx.v}px, ${gy.v}px, 0)`
    }
    if (magnet) magnet.style.transform = mx.v || my.v ? `translate3d(${mx.v}px, ${my.v}px, 0)` : ''
    if (tiltSvg) tiltSvg.style.transform = `rotateX(${tx.v}deg) rotateY(${ty.v}deg)`

    // generic parallax ([data-speed])
    if (!reduce) {
      for (const s of speedEls) {
        const center = s.top + s.h / 2 - (y + vh / 2)
        if (Math.abs(center) < vh * 1.5) s.el.style.transform = `translate3d(0, ${center * -s.speed}px, 0)`
      }
    }

    // process line + dots
    if (steps) {
      const r = steps.getBoundingClientRect()
      prog.t = reduce ? 1 : Math.min(1, Math.max(0, (vh * 0.72 - r.top) / r.height))
      moving = damp(prog, 8, dt) || moving
      steps.style.setProperty('--progress', prog.v.toFixed(4))
      const horizontal = getComputedStyle(steps).gridTemplateColumns.split(' ').length > 1
      stepEls.forEach((st, i) => {
        const at = horizontal ? i / stepEls.length : (st.offsetTop + 4) / steps.offsetHeight
        st.classList.toggle('is-passed', prog.v >= at - 0.001)
      })
    }

    // Keep running while anything is still settling (Lenis needs every frame while scrolling).
    if (moving || (lenis && (lenis.isScrolling || Math.abs(lenis.velocity) > 0.01))) raf = requestAnimationFrame(frame)
  }

  if (lenis) {
    // Wheel input starts Lenis; make sure the loop is awake for it.
    addEventListener('wheel', wake, { passive: true })
    addEventListener('keydown', wake)
  }
  wake()
}
