// Turns forwarded WhatsApp messages into inbox drafts.
//  - Only registered team numbers are accepted; anything else is ignored.
//  - Text: rule reader first, AI only for gaps, every AI value checked against the text.
//  - Photos: stored, and attached to the sender's draft from the last 15 minutes
//    (forward the text, then the photos), or saved as their own draft if captioned.
//  - Each WhatsApp message id is processed once, even if Meta retries.
import { extractListing } from '../../src/data/extract'
import type { Extracted } from '../../src/data/store'
import type { Db } from './db'
import type { IncomingMessage, WhatsApp } from './whatsapp'
import type { FillResult } from './ai'

export interface IntakeDeps {
  db: Db
  wa: WhatsApp | null
  fill: (text: string, rules: Extracted) => Promise<FillResult>
  siteUrl: string
}

export type IntakeOutcome = 'draft-created' | 'duplicate' | 'photo-attached' | 'ignored-not-team' | 'ignored-empty' | 'error'

function describe(e: Extracted): string {
  const bits = [
    e.bhk && `${e.bhk} BHK`,
    e.locality,
    e.carpetSqft && `${e.carpetSqft.toLocaleString('en-IN')} sq ft`,
    e.floor && `floor ${e.floor}`,
    e.priceCr != null && e.priceCr !== undefined ? `₹${e.priceCr} Cr` : e.priceAed ? `AED ${e.priceAed.toLocaleString('en-IN')}` : null,
  ].filter(Boolean)
  return bits.length ? bits.join(' · ') : 'details still to fill in'
}

export async function handleMessage(m: IncomingMessage, deps: IntakeDeps): Promise<IntakeOutcome> {
  const { db, wa } = deps
  const member = await db.teamMemberByWhatsapp(m.from)
  if (!member) return 'ignored-not-team'
  const fromLabel = `${member.name} (WhatsApp)`

  try {
    // A photo, possibly with a caption.
    let mediaUrl: string | null = null
    if (m.mediaId && wa) {
      const { bytes, mimeType } = await wa.download(m.mediaId)
      const ext = mimeType.includes('png') ? 'png' : mimeType.includes('pdf') ? 'pdf' : 'jpg'
      mediaUrl = await db.uploadMedia(`whatsapp/${m.id}.${ext}`, bytes, mimeType)
    }
    if (mediaUrl && !m.text.trim()) {
      const recent = await db.recentWhatsappDraft(fromLabel)
      if (recent) {
        await db.appendMedia(recent.id, [...recent.media, mediaUrl])
        return 'photo-attached'
      }
    }
    if (!m.text.trim() && !mediaUrl) return 'ignored-empty'

    const rules = extractListing(m.text)
    const filled = m.text.trim() ? await deps.fill(m.text, rules) : { fields: rules, dropped: [], usedAI: false }
    const notes = [
      filled.dropped.length ? `AI suggestions not found in the message, left blank: ${filled.dropped.join(', ')}` : '',
      filled.error && filled.usedAI ? `AI unavailable (${filled.error}); rules only` : '',
    ].filter(Boolean)

    const row = await db.insertDraft({
      source: 'whatsapp',
      external_id: `wa:${m.id}`,
      from_label: fromLabel,
      raw_text: m.text || '(photo)',
      media: mediaUrl ? [mediaUrl] : [],
      extracted: filled.fields,
      note: notes.join(' · ') || undefined,
    })
    if (!row) return 'duplicate'
    await wa?.reply(m.from, `Saved to the Luxarea inbox: ${describe(filled.fields)}.\nReview it here: ${deps.siteUrl}/admin.html#/inbox\nForward photos within 15 minutes and they'll attach to this listing.`, m.id).catch(() => {})
    return 'draft-created'
  } catch (e) {
    console.error('[whatsapp intake]', m.id, e)
    await wa?.reply(m.from, 'Sorry, that message could not be saved. Please paste it into the inbox at /admin.html for now.', m.id).catch(() => {})
    return 'error'
  }
}
