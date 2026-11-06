import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { guardAgainstSource, numberAppears } from '../api/_lib/guard'
import { fillGaps } from '../api/_lib/ai'
import { parseMessages, verifySignature } from '../api/_lib/whatsapp'
import { handleMessage, type IntakeDeps } from '../api/_lib/intake'
import { parseFeed, relevance, runScan } from '../api/_lib/scan'
import type { Db, DraftInsert } from '../api/_lib/db'
import type { WhatsApp } from '../api/_lib/whatsapp'
import type { Extracted } from '../src/data/store'
import * as whatsappRoute from '../api/whatsapp'
import * as leadRoute from '../api/lead'
import * as scanRoute from '../api/scan'

// ---------- the guard ----------
test('numbers must appear in the source, allowing obvious rewrites', () => {
  assert.equal(numberAppears(29.5, 'asking 29.5 Cr'), true)
  assert.equal(numberAppears(3450, 'carpet 3,450 sq ft'), true)
  assert.equal(numberAppears(2.95, 'price 295 lakh', 'crore'), true)
  assert.equal(numberAppears(4200000, 'AED 4.2M, handover 2027', 'aed'), true)
  assert.equal(numberAppears(12, 'floor 120'), false, '12 must not match inside 120')
  assert.equal(numberAppears(31, 'floor 3.1'), false)
})

test('guard drops invented figures and keeps stated ones', () => {
  const src = 'Pali Hill 4 BHK, 3200 carpet, asking 30 Cr. Developer: Sample Builders.'
  const { kept, dropped } = guardAgainstSource({ bhk: 4, carpetSqft: 3200, priceCr: 32, developer: 'Sample Builders', locality: 'Juhu', summary: 'A 4 BHK at 31 Cr.' }, src)
  assert.deepEqual(kept, { bhk: 4, carpetSqft: 3200, developer: 'Sample Builders' })
  assert.deepEqual(dropped.sort(), ['locality', 'priceCr', 'summary'])
})

// ---------- the AI gap-filler (Claude stubbed) ----------
const stubClient = (output: Record<string, unknown> | null, stop = 'end_turn', capture?: (p: unknown) => void) =>
  ({ beta: { messages: { parse: async (p: unknown) => (capture?.(p), { stop_reason: stop, parsed_output: output }) } } }) as never

test('AI fills only missing fields, never overwrites the rules, and is guarded', async () => {
  let sent: Record<string, unknown> = {}
  const src = 'Palm Jumeirah signature villa, 5 bed, AED 18M, by Sample Dev LLC'
  const res = await fillGaps(src, { locality: 'Palm Jumeirah', bhk: 5 }, {
    client: stubClient({ name: null, developer: 'Sample Dev LLC', locality: 'Downtown Dubai', city: 'Dubai', segment: null, bhk: 6, carpetSqft: 9000, floor: null, totalFloors: null, priceCr: null, priceAed: 18000000, possession: null, rera: null, offMarket: null, summary: 'Five-bed villa on the Palm at AED 18M.' }, 'end_turn', (p) => (sent = p as Record<string, unknown>)),
  })
  assert.equal(res.fields.locality, 'Palm Jumeirah', 'rule value kept')
  assert.equal(res.fields.bhk, 5, 'rule value kept')
  assert.equal(res.fields.priceAed, 18000000)
  assert.equal(res.fields.developer, 'Sample Dev LLC')
  assert.equal(res.fields.carpetSqft, undefined, 'invented carpet area dropped')
  assert.ok(res.dropped.includes('carpetSqft'))
  assert.equal(sent.model, 'claude-opus-5-5')
  assert.equal(sent.fallbacks, 'default')
  assert.deepEqual((sent.output_config as { effort: string }).effort, 'low')
})

test('AI refusal or outage falls back to rules only', async () => {
  const rules: Extracted = { bhk: 3 }
  assert.deepEqual((await fillGaps('3 BHK Worli', rules, { client: stubClient(null, 'refusal') })).fields, rules)
  const failing = { beta: { messages: { parse: async () => { throw new Error('network down') } } } } as never
  const r = await fillGaps('3 BHK Worli', rules, { client: failing })
  assert.deepEqual(r.fields, rules)
  assert.match(r.error ?? '', /network down/)
})

// ---------- WhatsApp parsing + signature ----------
const payload = (messages: unknown[]) => ({ entry: [{ changes: [{ value: { contacts: [{ wa_id: '919800000001', profile: { name: 'Shweta' } }], messages } }] }] })

test('signature check accepts Meta-signed bodies only', () => {
  const body = JSON.stringify(payload([]))
  const sig = 'sha256=' + createHmac('sha256', 'app-secret').update(body).digest('hex')
  assert.equal(verifySignature(body, sig, 'app-secret'), true)
  assert.equal(verifySignature(body, sig, 'wrong-secret'), false)
  assert.equal(verifySignature(body + ' ', sig, 'app-secret'), false)
  assert.equal(verifySignature(body, null, 'app-secret'), false)
})

test('parses text and photo messages, ignores the rest', () => {
  const msgs = parseMessages(payload([
    { id: 'm1', from: '919800000001', type: 'text', text: { body: 'Worli 4 BHK 29.5 Cr' } },
    { id: 'm2', from: '919800000001', type: 'image', image: { id: 'media-1', mime_type: 'image/jpeg' } },
    { id: 'm3', from: '919800000001', type: 'reaction', reaction: { emoji: '👍' } },
  ]))
  assert.equal(msgs.length, 2)
  assert.equal(msgs[0].name, 'Shweta')
  assert.equal(msgs[1].mediaId, 'media-1')
})

// ---------- intake, with an in-memory database and WhatsApp ----------
function fakes() {
  const drafts: (DraftInsert & { id: string; received: number })[] = []
  const replies: string[] = []
  const db = {
    teamMemberByWhatsapp: async (n: string) => (n === '919800000001' ? { name: 'Shweta' } : null),
    insertDraft: async (d: DraftInsert) => {
      if (drafts.some((x) => x.external_id === d.external_id)) return null
      const row = { ...d, media: d.media ?? [], id: `d${drafts.length + 1}`, received: Date.now() }
      drafts.push(row)
      return { id: row.id }
    },
    recentWhatsappDraft: async (from: string) => {
      const d = [...drafts].reverse().find((x) => x.from_label === from)
      return d ? { id: d.id, media: d.media ?? [] } : null
    },
    appendMedia: async (id: string, media: string[]) => void (drafts.find((d) => d.id === id)!.media = media),
    uploadMedia: async (path: string) => `https://db.example/storage/v1/object/public/media/${path}`,
  } as unknown as Db
  const wa = {
    download: async () => ({ bytes: new ArrayBuffer(8), mimeType: 'image/jpeg' }),
    reply: async (_to: string, body: string) => void replies.push(body),
  } as unknown as WhatsApp
  const deps: IntakeDeps = { db, wa, fill: async (_t, rules) => ({ fields: rules, dropped: [], usedAI: false }), siteUrl: 'https://luxarea-homes.vercel.app' }
  return { drafts, replies, deps }
}

test('team forward becomes a draft, retries are ignored, photos attach, strangers are ignored', async () => {
  const { drafts, replies, deps } = fakes()
  const [text, photo] = parseMessages(payload([
    { id: 'm1', from: '919800000001', type: 'text', text: { body: 'Fresh resale Worli sea facing 4 BHK, 3,450 carpet, 31st floor. Asking 29.5 Cr. Dont share outside group' } },
    { id: 'm2', from: '919800000001', type: 'image', image: { id: 'media-1', mime_type: 'image/jpeg' } },
  ]))
  assert.equal(await handleMessage(text, deps), 'draft-created')
  assert.equal(drafts[0].extracted.priceCr, 29.5)
  assert.equal(drafts[0].extracted.offMarket, true)
  assert.match(replies[0], /4 BHK · Worli · 3,450 sq ft · floor 31 · ₹29.5 Cr/)
  assert.equal(await handleMessage(text, deps), 'duplicate', 'Meta retry is not saved twice')
  assert.equal(await handleMessage(photo, deps), 'photo-attached')
  assert.equal(drafts[0].media?.length, 1)
  const stranger = { ...text, id: 'm9', from: '910000000000' }
  assert.equal(await handleMessage(stranger, deps), 'ignored-not-team')
  assert.equal(drafts.length, 1)
})

// ---------- routes ----------
test('webhook: verification handshake, unconfigured and bad-signature responses', async () => {
  process.env.WHATSAPP_VERIFY_TOKEN = 'verify-me'
  const ok = whatsappRoute.GET(new Request('https://x/api/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345'))
  assert.equal(ok.status, 200)
  assert.equal(await ok.text(), '12345')
  assert.equal(whatsappRoute.GET(new Request('https://x/api/whatsapp?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1')).status, 403)
  assert.equal((await whatsappRoute.POST(new Request('https://x/api/whatsapp', { method: 'POST', body: '{}' }))).status, 501)
  process.env.WHATSAPP_APP_SECRET = 'app-secret'
  process.env.VITE_SUPABASE_URL = 'https://db.example'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  const bad = await whatsappRoute.POST(new Request('https://x/api/whatsapp', { method: 'POST', body: '{}', headers: { 'x-hub-signature-256': 'sha256=00' } }))
  assert.equal(bad.status, 401)
})

test('lead endpoint validates, drops honeypot bots, and saves real enquiries', async () => {
  process.env.VITE_SUPABASE_URL = 'https://db.example'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  const saved: unknown[] = []
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    assert.match(String(url), /\/rest\/v1\/leads$/)
    saved.push(JSON.parse(String(init.body)))
    return new Response(null, { status: 201 })
  }) as typeof fetch
  try {
    const post = (b: unknown) => leadRoute.POST(new Request('https://x/api/lead', { method: 'POST', body: JSON.stringify(b) }))
    assert.equal((await post({ name: 'A', phone: '12', consent: 'yes' })).status, 422)
    assert.equal((await post({ name: 'Bot', phone: '+91 98200 00000', consent: 'yes', website: 'spam.example' })).status, 200)
    assert.equal(saved.length, 0, 'honeypot not saved')
    assert.equal((await post({ name: 'Priya Shah', phone: '+91 98200 00000', consent: 'yes', intent: 'A home in Mumbai', budget: '₹10–25 Cr', for: 'My family' })).status, 200)
    assert.equal(saved.length, 1)
    assert.equal((saved[0] as { for_whom: string }).for_whom, 'My family')
  } finally {
    globalThis.fetch = realFetch
  }
})

test('scan endpoint refuses callers without the cron secret', async () => {
  process.env.CRON_SECRET = 'cron-secret'
  assert.equal((await scanRoute.GET(new Request('https://x/api/scan'))).status, 401)
  assert.equal((await scanRoute.GET(new Request('https://x/api/scan', { headers: { authorization: 'Bearer wrong' } }))).status, 401)
})

// ---------- the scan, on two real feeds saved as fixtures ----------
test('feed parser reads RSS (with and without CDATA)', () => {
  const et = parseFeed(readFileSync('tests/fixtures/et-residential.xml', 'utf-8'))
  const ht = parseFeed(readFileSync('tests/fixtures/ht-real-estate.xml', 'utf-8'))
  assert.ok(et.length >= 10 && ht.length >= 10)
  assert.ok(ht.every((i) => !i.title.includes('CDATA') && i.link.startsWith('https://')))
})

test('relevance keeps Luxarea markets with a deal signal, skips the rest', () => {
  assert.ok(relevance({ title: 'Sample Realty launches 60-storey luxury tower in Worli', link: '', description: '' }) > 0)
  assert.ok(relevance({ title: 'Family buys sea-facing duplex in Juhu for ₹48 crore', link: '', description: '' }) > 0)
  assert.equal(relevance({ title: 'Haryana proposes FAR up to 264% for residential plots', link: '', description: '' }), 0)
  assert.equal(relevance({ title: 'Warehousing demand rises near Mumbai', link: '', description: 'industrial parks' }), 0)
  assert.equal(relevance({ title: 'NCLT voids ₹525-crore guarantee, Mumbai land transfer in dispute', link: '', description: '' }), 0)
  assert.equal(relevance({ title: 'Mumbai civic body clears ₹11.28-crore audit of air monitors', link: '', description: '' }), 0)
})

test('scan saves relevant items once, only from allow-listed hosts', async () => {
  const xml = `<rss><channel>
    <item><title>Sample Realty launches luxury tower in Worli with 4 BHK homes from ₹28 crore</title><link>https://feeds.example/a</link><description>The 55-storey project has MahaRERA number P51900099999.</description></item>
    <item><title>Delhi notifies slum policy</title><link>https://feeds.example/b</link><description>…</description></item>
    <item><title>Sea-facing penthouse in Bandra West sold</title><link>https://elsewhere.example/c</link><description>Luxury deal</description></item>
  </channel></rss>`
  const { drafts, deps } = fakes()
  const fetchImpl = (async () => new Response(xml, { status: 200 })) as unknown as typeof fetch
  const sources = [{ id: 't', label: 'Test feed', url: 'https://feeds.example/rss', allowHosts: ['feeds.example'] }]
  const first = await runScan({ db: deps.db, fill: deps.fill, fetchImpl, sources })
  assert.equal(first.relevant, 1, 'Delhi item skipped; off-list host skipped')
  assert.equal(first.draftsCreated, 1)
  assert.equal(drafts[0].extracted.locality, 'Worli')
  assert.equal(drafts[0].extracted.priceCr, 28)
  assert.equal(drafts[0].extracted.rera, 'P51900099999')
  assert.equal(drafts[0].source_url, 'https://feeds.example/a')
  const second = await runScan({ db: deps.db, fill: deps.fill, fetchImpl, sources })
  assert.equal(second.draftsCreated, 0)
  assert.equal(second.duplicates, 1, 'the next day the same story is not added again')
})
