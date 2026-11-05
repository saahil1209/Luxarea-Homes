import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BRAND } from '../config'
import type { FloorInfo, Property } from '../data/listings'

interface Props {
  property: Property
  floor: FloorInfo | null
  onClose: () => void
}

// No server: the enquiry opens WhatsApp with the message filled in, so nothing
// is stored by this site. Swap for a server endpoint + CRM when Luxarea wants a lead log.
export default function EnquirySheet({ property: p, floor, onClose }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [when, setWhen] = useState('This weekend')
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const first = useRef<HTMLInputElement>(null)

  useEffect(() => {
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const what = floor
    ? `${floor.residence.name}, ${p.form === 'villa' ? 'level' : 'floor'} ${floor.floor} at ${p.name} (${p.locality})`
    : `${p.name} (${p.locality})`

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setError('Please enter your name.')
    if (phone.replace(/\D/g, '').length < 10) return setError('Please enter a phone number with at least 10 digits.')
    if (!consent) return setError('Please tick the box so we can contact you about this residence.')
    const lines = [
      `Hello Luxarea, I’d like a private viewing of ${what}.`,
      `Name: ${name.trim()}`,
      `Phone: ${phone.trim()}`,
      `Preferred time: ${when}`,
      note.trim() ? `Note: ${note.trim()}` : '',
      `Link: ${location.href}`,
    ].filter(Boolean)
    window.open(`https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener')
    onClose()
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="enq-title" onSubmit={submit} noValidate>
        <div className="sheet-head">
          <h2 id="enq-title">Request a private viewing</h2>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="sheet-what">{what}</p>
        <label htmlFor="enq-name">Your name</label>
        <input id="enq-name" ref={first} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <label htmlFor="enq-phone">Mobile number</label>
        <input id="enq-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+91" />
        <label htmlFor="enq-when">When suits you?</label>
        <select id="enq-when" value={when} onChange={(e) => setWhen(e.target.value)}>
          <option>This weekend</option>
          <option>A weekday evening</option>
          <option>Video walkthrough first</option>
          <option>I’ll discuss with my advisor</option>
        </select>
        <label htmlFor="enq-note">Anything we should know? <span className="opt">Optional</span></label>
        <textarea id="enq-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        <label className="consent" htmlFor="enq-consent">
          <input id="enq-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>Luxarea Homes may contact me about this residence. My details are used for this enquiry only.</span>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn-gold btn-block">Continue on WhatsApp</button>
        <p className="fine">Opens WhatsApp with your request filled in. Prefer a call? {BRAND.phoneDisplay}</p>
      </form>
    </div>
  )
}
