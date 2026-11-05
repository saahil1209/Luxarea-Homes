// Turns HomeContent into the home page's <main> HTML and its JSON-LD.
// Used at build time (vite.config.ts) and by the admin's live preview, so
// what the team sees is exactly what ships. All text is escaped.
import type { HomeContent, Section } from './types'
import { CONTACT_FORM, FINDER_MAP, HERO_STAGE, SKYLINE } from './decor'

export function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Escaped text with **bold** support, nothing else. */
function rich(s: string): string {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

/**
 * A heading split into words for the mask-reveal animation. *Words in
 * asterisks* become the italic copper accent. Screen readers still read
 * the heading as one line of text.
 */
export function splitTitle(s: string): string {
  let i = 0
  return esc(s)
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part) => {
      const accent = part.startsWith('*') && part.endsWith('*')
      const words = (accent ? part.slice(1, -1) : part).split(/(\s+)/)
      return words
        .map((w) => (/^\s+$/.test(w) || !w ? w : `<span class="w"><span class="wi${accent ? ' accent' : ''}" style="--i:${i++}">${w}</span></span>`))
        .join('')
    })
    .join('')
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
}

function slug(s: string, i: number) {
  return (s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tab') + (i ? `-${i}` : '')
}

function head(id: string, eyebrow: string, title: string, lede?: string) {
  return `<div class="section-head reveal"><p class="eyebrow">${esc(eyebrow)}</p><h2 id="${id}-title" class="split">${splitTitle(title)}</h2>${lede ? `<p class="section-lede">${esc(lede)}</p>` : ''}</div>`
}

function renderSection(s: Section): string {
  const sid = esc(s.id)
  switch (s.type) {
    case 'hero':
      return `<section class="hero" data-section="${sid}" aria-labelledby="hero-title"><div class="hero-sky" aria-hidden="true"></div>${HERO_STAGE}<div class="hero-glow" aria-hidden="true"></div><div class="hero-copy"><p class="eyebrow intro" style="--d:0">${esc(s.eyebrow)}</p><h1 id="hero-title" class="split">${splitTitle(s.title)}</h1><p class="lede intro" style="--d:1">${esc(s.lede)}</p><div class="hero-actions intro" style="--d:2"><a class="btn btn-gold btn-lg magnetic" href="#contact">${esc(s.primaryCta)}</a><a class="btn btn-ghost btn-lg btn-arrow" href="/residences.html">${esc(s.secondaryCta)}</a></div><p class="reply-note intro" style="--d:3">${esc(s.replyNote)}</p><p class="hero-hint" aria-hidden="true">Hover a floor of the tower to preview it. Click to open it.</p></div>${SKYLINE}<a class="scroll-cue" href="#main-content" aria-hidden="true" tabindex="-1"><span>Scroll</span><i></i></a></section>`

    case 'proof': {
      const places = s.places.map((p) => `<span>${esc(p)}</span>`).join('')
      return `<section class="proof" data-section="${sid}" aria-label="About Luxarea in brief"><ul class="proof-list">${s.items.map((i) => `<li><strong>${esc(i.title)}</strong><span>${esc(i.text)}</span></li>`).join('')}</ul>${s.places.length ? `<div class="marquee" aria-hidden="true"><div class="marquee-track">${places}${places}</div></div>` : ''}</section>`
    }

    case 'services':
      return `<section class="section services" data-section="${sid}" aria-labelledby="${sid}-title">${head(sid, s.eyebrow, s.title, s.lede)}<div class="service-grid">${s.items
        .map((it, i) => `<article class="service reveal"${it.anchor ? ` id="${esc(it.anchor)}"` : ''}><p class="service-num">${String(i + 1).padStart(2, '0')}</p><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p>${it.bullets.length ? `<ul>${it.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}${it.forWho ? `<p class="for">${esc(it.forWho)}</p>` : ''}<a class="btn btn-outline" href="#contact" data-intent="${esc(it.intent || 'home')}">${esc(it.cta)}</a></article>`)
        .join('')}</div>${s.alsoNote ? `<p class="also-note">${rich(s.alsoNote)}</p>` : ''}</section>`

    case 'finder':
      return `<section class="section finder" id="finder" data-section="${sid}" aria-labelledby="${sid}-title"><div class="finder-copy reveal"><p class="eyebrow">${esc(s.eyebrow)}</p><h2 id="${sid}-title" class="split">${splitTitle(s.title)}</h2><p class="section-lede">${esc(s.lede)}</p>${s.areas.length ? `<ul class="finder-areas">${s.areas.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}<a class="btn btn-gold btn-lg btn-arrow" href="/residences.html">${esc(s.cta)}</a>${s.note ? `<p class="fine">${esc(s.note)}</p>` : ''}</div>${FINDER_MAP.replace('class="finder-map reveal"', 'class="finder-map reveal tilt"')}</section>`

    case 'process':
      return `<section class="section process" id="process" data-section="${sid}" aria-labelledby="${sid}-title">${head(sid, s.eyebrow, s.title, s.lede)}<ol class="steps">${s.steps.map((st) => `<li class="step reveal"><span class="step-time">${esc(st.time)}</span><h3>${esc(st.title)}</h3><p>${esc(st.text)}</p></li>`).join('')}</ol></section>`

    case 'verify': {
      const ids = s.tabs.map((t, i) => slug(t.label, i))
      return `<section class="section verify" id="verify" data-section="${sid}" aria-labelledby="${sid}-title">${head(sid, s.eyebrow, s.title, s.lede)}<div class="tabs reveal" data-tabs><div class="tab-list" role="tablist" aria-label="${esc(s.title.replace(/\*/g, ''))}">${s.tabs
        .map((t, i) => `<button type="button" role="tab" id="tab-${ids[i]}" aria-controls="panel-${ids[i]}" aria-selected="${i === 0}">${esc(t.label)}</button>`)
        .join('')}</div>${s.tabs
        .map((t, i) => `<div class="tab-panel" role="tabpanel" id="panel-${ids[i]}" aria-labelledby="tab-${ids[i]}"><h3 class="panel-title">${esc(t.title)}</h3><dl class="checks">${t.checks.map((c) => `<div><dt>${esc(c.term)}</dt><dd>${esc(c.text)}</dd></div>`).join('')}</dl></div>`)
        .join('')}</div></section>`
    }

    case 'discretion':
      return `<section class="section discretion" id="discretion" data-section="${sid}" aria-labelledby="${sid}-title"><svg class="watermark" data-speed="0.18" viewBox="0 0 564 517" aria-hidden="true" focusable="false"><path d="M0 220 281 0 564 220v37L281 37 0 257z"/><rect x="420" y="40" width="29" height="95"/><path d="M0 350 281 130 564 350v37L281 167 0 387z"/><path d="M0 480 281 260 564 480v37L281 297 0 517z"/></svg>${head(sid, s.eyebrow, s.title)}<ul class="pledges">${s.items.map((p) => `<li class="reveal"><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></li>`).join('')}</ul></section>`

    case 'about':
      return `<section class="section about" id="about" data-section="${sid}" aria-labelledby="${sid}-title">${head(sid, s.eyebrow, s.title, s.lede)}<div class="people">${s.people
        .map((p) => `<article class="person reveal"><div class="portrait"${p.photo ? ` style="background-image:url('${esc(p.photo)}')"` : ''} aria-hidden="true">${p.photo ? '' : `<span>${esc(initials(p.name))}</span>`}</div><h3>${esc(p.name)}</h3><p class="role">${esc(p.role)}</p><p>${esc(p.bio)}</p></article>`)
        .join('')}${s.showOffice ? `<aside class="office reveal" aria-label="Office and registration"><h3>Visit us</h3><address>Luxarea Homes Pvt Ltd<br />Parinee Crescenzo, 1B, 1st Floor, G Block<br />Bandra Kurla Complex, Bandra East<br />Mumbai 400051</address><p>%BRAND.hours%</p><p><a href="%BRAND.phoneLink%">%BRAND.phoneDisplay%</a><br /><a href="mailto:%BRAND.email%">%BRAND.email%</a></p><p class="rera">MahaRERA agent registration<br /><strong>%BRAND.reraAgent%</strong></p></aside>` : ''}</div></section>`

    case 'voices':
      return `<section class="section voices" data-section="${sid}" aria-labelledby="${sid}-title">${head(sid, s.eyebrow, s.title)}<div class="quotes">${s.quotes
        .map((q) => `<figure class="quote reveal">${q.sample ? '<span class="sample-tag">Sample</span>' : ''}<blockquote><p>“${esc(q.text.replace(/^[“"]|[”"]$/g, ''))}”</p></blockquote><figcaption>${esc(q.by)}</figcaption></figure>`)
        .join('')}</div></section>`

    case 'faq':
      return `<section class="section faq" id="faq" data-section="${sid}" aria-labelledby="${sid}-title">${head(sid, s.eyebrow, s.title)}<div class="faq-list">${s.items.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div></section>`

    case 'contact':
      return `<section class="section contact" id="contact" data-section="${sid}" aria-labelledby="contact-title"><div class="contact-copy reveal"><p class="eyebrow">${esc(s.eyebrow)}</p><h2 id="contact-title" class="split">${splitTitle(s.title)}</h2><p class="section-lede">${esc(s.lede)}</p><ul class="contact-direct"><li><a href="%BRAND.whatsappLink%" rel="noopener" target="_blank">WhatsApp %BRAND.phoneDisplay%</a></li><li><a href="%BRAND.phoneLink%">Call %BRAND.phoneDisplay%</a></li><li><a href="mailto:%BRAND.email%">%BRAND.email%</a></li></ul></div>${CONTACT_FORM.replace('{{REPLY_PROMISE}}', esc(s.replyPromise))}</section>`
  }
}

/** The sections inside <main>, in order. Hidden sections are left out. */
export function renderMain(content: HomeContent): string {
  const sections = [...content.sections]
  // The hero always comes first: it carries the 3D tower and the page's h1.
  sections.sort((a, b) => (a.type === 'hero' ? -1 : b.type === 'hero' ? 1 : 0))
  return sections
    .filter((s) => s.visible || s.type === 'hero' || s.type === 'contact')
    .map((s) => (s.type === 'hero' ? renderSection(s) + '<span id="main-content"></span>' : renderSection(s)))
    .join('\n')
}

/** Structured data for search engines and AI crawlers. */
export function renderJsonLd(content: HomeContent, site: string): string {
  const faq = content.sections.find((s) => s.type === 'faq' && s.visible)
  const graph: unknown[] = [
    {
      '@type': 'RealEstateAgent',
      '@id': `${site}/#agency`,
      name: 'Luxarea Homes',
      legalName: 'Luxarea Homes Pvt Ltd',
      url: `${site}/`,
      logo: `${site}/brand/luxarea-logo-on-green.png`,
      image: `${site}/og-image.jpg`,
      foundingDate: '1999',
      founder: { '@type': 'Person', name: 'Viivek Bathija' },
      openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], opens: '09:00', closes: '19:00' }],
      telephone: '%BRAND.phoneDisplay%',
      email: '%BRAND.email%',
      description: 'Real-estate advisory for luxury homes in Mumbai, land in and around Mumbai and Alibaug, and property in Dubai. Founded in 1999.',
      address: { '@type': 'PostalAddress', streetAddress: 'Parinee Crescenzo, 1B, 1st Floor, G Block, Bandra Kurla Complex, Bandra East', addressLocality: 'Mumbai', addressRegion: 'Maharashtra', postalCode: '400051', addressCountry: 'IN' },
      areaServed: [{ '@type': 'City', name: 'Mumbai' }, { '@type': 'Place', name: 'Alibaug' }, { '@type': 'City', name: 'Dubai' }],
      knowsAbout: ['Luxury apartments in Mumbai', 'Leasing advisory', 'Property management', 'Penthouses', 'Non-agricultural land in Maharashtra', 'Dubai property', 'UAE Golden Visa through property', 'NRI property purchase in India'],
    },
    { '@type': 'WebSite', '@id': `${site}/#website`, url: `${site}/`, name: 'Luxarea Homes', inLanguage: 'en-IN', publisher: { '@id': `${site}/#agency` } },
  ]
  if (faq && faq.type === 'faq' && faq.items.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${site}/#faq`,
      mainEntity: faq.items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    })
  }
  // "<" is escaped so no text can close the script tag.
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 1).replace(/</g, '\\u003c')}</script>`
}
