import { USING_SAMPLE_DATA } from '../config'

/** The Luxarea roof mark, redrawn from the logo. tone="light" for dark backgrounds. */
export function LogoMark({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const c = tone === 'light' ? ['#c49a6c', '#8f7c5f', '#5d6253'] : ['#1f3d3b', '#22625f', '#4e6a68']
  return (
    <svg viewBox="0 0 564 517" aria-hidden="true" focusable="false">
      <path fill={c[0]} d="M0 220 281 0 564 220v37L281 37 0 257z" />
      <rect fill={c[0]} x="420" y="40" width="29" height="95" />
      <path fill={c[1]} d="M0 350 281 130 564 350v37L281 167 0 387z" />
      <path fill={c[2]} d="M0 480 281 260 564 480v37L281 297 0 517z" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <a className="wordmark" href="/" aria-label="Luxarea Homes, home">
      <LogoMark />
      <span>LUXAREA</span>
    </a>
  )
}

export function SiteNav() {
  return (
    <nav className="topnav" aria-label="Main">
      <a href="/">Home</a>
      <a href="/residences.html" aria-current="page">Residence Finder</a>
      <a href="/#land">Mumbai Land</a>
      <a href="/#dubai">Dubai</a>
      <a className="topnav-cta" href="/#contact">
        Speak to an advisor
      </a>
    </nav>
  )
}

export function SampleBadge() {
  if (!USING_SAMPLE_DATA) return null
  return (
    <span className="sample-badge" title="Properties, prices and RERA numbers are fictional placeholders">
      Sample listings
    </span>
  )
}
