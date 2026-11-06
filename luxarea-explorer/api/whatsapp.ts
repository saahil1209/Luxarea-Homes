// WhatsApp webhook for Luxarea's business number.
//   GET  /api/whatsapp  Meta's one-time verification handshake.
//   POST /api/whatsapp  Incoming messages: team forwards become inbox drafts.
//
// Environment (Vercel → Project → Settings → Environment Variables):
//   WHATSAPP_VERIFY_TOKEN     any long random string, also entered in Meta's webhook settings
//   WHATSAPP_APP_SECRET       Meta app secret (signature check)
//   WHATSAPP_TOKEN            permanent system-user access token
//   WHATSAPP_PHONE_NUMBER_ID  the business number's id
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   ANTHROPIC_API_KEY         optional: without it, rules only
//   SITE_URL                  e.g. https://www.luxarea.in (for the link in replies)
import { Db } from './_lib/db'
import { WhatsApp, parseMessages, verifySignature } from './_lib/whatsapp'
import { handleMessage } from './_lib/intake'
import { fillGaps } from './_lib/ai'

export function GET(request: Request): Response {
  const u = new URL(request.url)
  const ok = u.searchParams.get('hub.mode') === 'subscribe' && !!process.env.WHATSAPP_VERIFY_TOKEN && u.searchParams.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN
  return ok ? new Response(u.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('Forbidden', { status: 403 })
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.WHATSAPP_APP_SECRET
  const db = Db.fromEnv()
  if (!secret || !db) return new Response('WhatsApp intake is not configured yet', { status: 501 })

  const raw = await request.text()
  if (!verifySignature(raw, request.headers.get('x-hub-signature-256'), secret)) return new Response('Bad signature', { status: 401 })

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const deps = { db, wa: WhatsApp.fromEnv(), fill: fillGaps, siteUrl: (process.env.SITE_URL || 'https://www.luxarea.in').replace(/\/$/, '') }
  const outcomes: string[] = []
  // Texts first, then photos, so a photo sent right after its text finds the draft.
  const messages = parseMessages(payload as Parameters<typeof parseMessages>[0]).sort((a, b) => Number(!!a.mediaId) - Number(!!b.mediaId))
  for (const m of messages) outcomes.push(await handleMessage(m, deps))
  // Always 200 once the signature is valid, or Meta keeps retrying.
  return Response.json({ received: messages.length, outcomes })
}
