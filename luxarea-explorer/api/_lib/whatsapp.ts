// WhatsApp Business Cloud API: webhook signature check, payload parsing,
// media download and replies. Docs: developers.facebook.com/docs/whatsapp/cloud-api
import { createHmac, timingSafeEqual } from 'node:crypto'

const GRAPH = () => `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || 'v23.0'}`

/** Meta signs every webhook with the app secret (X-Hub-Signature-256: sha256=<hex>). */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest()
  const given = Buffer.from(header.slice(7), 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export interface IncomingMessage {
  id: string
  from: string
  name: string
  timestamp: string
  type: string
  text: string
  /** WhatsApp media id for an image or document, if any. */
  mediaId?: string
  mimeType?: string
}

interface WebhookPayload {
  entry?: { changes?: { value?: { contacts?: { wa_id: string; profile?: { name?: string } }[]; messages?: Record<string, unknown>[] } }[] }[]
}

/** Flattens a webhook payload into the messages we care about (text, images, documents). */
export function parseMessages(payload: WebhookPayload): IncomingMessage[] {
  const out: IncomingMessage[] = []
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {}
      const names = new Map((v.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? c.wa_id]))
      for (const m of v.messages ?? []) {
        const type = String(m.type)
        const base = { id: String(m.id), from: String(m.from), name: names.get(String(m.from)) ?? String(m.from), timestamp: String(m.timestamp ?? ''), type }
        if (type === 'text') out.push({ ...base, text: String((m.text as { body?: string })?.body ?? '') })
        else if (type === 'image' || type === 'document') {
          const media = m[type] as { id?: string; caption?: string; mime_type?: string }
          out.push({ ...base, text: media?.caption ?? '', mediaId: media?.id, mimeType: media?.mime_type })
        }
        // Status updates, reactions, stickers etc. are ignored.
      }
    }
  }
  return out
}

export class WhatsApp {
  constructor(private token: string, private phoneNumberId: string, private fetchImpl: typeof fetch = fetch) {}

  static fromEnv(fetchImpl?: typeof fetch): WhatsApp | null {
    const token = process.env.WHATSAPP_TOKEN
    const id = process.env.WHATSAPP_PHONE_NUMBER_ID
    return token && id ? new WhatsApp(token, id, fetchImpl) : null
  }

  /** Downloads a media item: first its short-lived URL, then the bytes. */
  async download(mediaId: string): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
    const meta = await this.fetchImpl(`${GRAPH()}/${mediaId}`, { headers: { Authorization: `Bearer ${this.token}` } })
    if (!meta.ok) throw new Error(`media lookup ${meta.status}`)
    const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string }
    const file = await this.fetchImpl(url, { headers: { Authorization: `Bearer ${this.token}` } })
    if (!file.ok) throw new Error(`media download ${file.status}`)
    return { bytes: await file.arrayBuffer(), mimeType: mime_type }
  }

  /** Free-form replies are allowed within 24 hours of the team member's message. */
  async reply(to: string, body: string, contextMessageId?: string): Promise<void> {
    const res = await this.fetchImpl(`${GRAPH()}/${this.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body, preview_url: false }, ...(contextMessageId ? { context: { message_id: contextMessageId } } : {}) }),
    })
    if (!res.ok) throw new Error(`reply ${res.status}: ${await res.text()}`)
  }
}
