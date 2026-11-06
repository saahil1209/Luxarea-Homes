// POST /api/lead: the home-page contact form. Saves the enquiry for the team
// (admin → Leads). The browser also opens WhatsApp, so a lead is never lost
// if this endpoint is down.
//
// Environment: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { Db } from './_lib/db'

const MAX = 2000
const clean = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function POST(request: Request): Promise<Response> {
  const db = Db.fromEnv()
  if (!db) return new Response('Leads are not configured yet', { status: 501 })

  let body: Record<string, unknown>
  try {
    const text = await request.text()
    if (text.length > 20_000) return new Response('Too large', { status: 413 })
    body = JSON.parse(text)
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  // Honeypot: a hidden field real people never fill.
  if (clean(body.website)) return Response.json({ ok: true })

  const name = clean(body.name, 120)
  const phone = clean(body.phone, 40)
  if (!name || phone.replace(/\D/g, '').length < 8) return new Response('Name and phone are required', { status: 422 })
  if (body.consent !== 'yes' && body.consent !== true) return new Response('Consent is required', { status: 422 })

  await db.insertLead({
    name,
    phone,
    channel: clean(body.channel, 40),
    intent: clean(body.intent, 80),
    budget: clean(body.budget, 40),
    for_whom: clean(body.for, 60),
    note: clean(body.note, MAX),
    page: clean(body.page, 300),
    utm: clean(body.utm, 300),
    referrer: clean(body.referrer, 300),
    consent: true,
  })
  return Response.json({ ok: true })
}
