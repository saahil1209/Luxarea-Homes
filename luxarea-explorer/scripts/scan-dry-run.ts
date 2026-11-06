// Runs the daily scan against the live feeds WITHOUT saving anything, and
// prints what it would add to the inbox. Usage: npm run scan:dry
import { runScan } from '../api/_lib/scan'
import type { Db, DraftInsert } from '../api/_lib/db'

const drafts: DraftInsert[] = []
const db = { insertDraft: async (d: DraftInsert) => (drafts.push(d), { id: String(drafts.length) }) } as unknown as Db
const r = await runScan({ db, fill: async (_t, rules) => ({ fields: rules, dropped: [], usedAI: false }) })
console.log(`Feeds read: ${r.sourcesChecked} · stories: ${r.itemsSeen} · kept: ${r.relevant}${r.errors.length ? ` · errors: ${r.errors.join('; ')}` : ''}\n`)
for (const d of drafts) console.log(`• [${d.from_label}] ${d.extracted.summary}\n  ${JSON.stringify({ ...d.extracted, summary: undefined })}\n  ${d.source_url}\n`)
