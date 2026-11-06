// Daily scan, run by Vercel Cron (vercel.json) at 6:00 am India time.
// Vercel sends "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set;
// set it, so nobody else can trigger runs.
//
// Environment: CRON_SECRET, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// ANTHROPIC_API_KEY (optional: without it, rules only).
import { Db } from './_lib/db'
import { runScan } from './_lib/scan'
import { fillGaps } from './_lib/ai'

export const maxDuration = 60

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 })
  const db = Db.fromEnv()
  if (!db) return new Response('Scan is not configured yet', { status: 501 })

  const runId = await db.startScanRun()
  const report = await runScan({ db, fill: fillGaps })
  await db.finishScanRun(runId, { sources_checked: report.sourcesChecked, items_seen: report.itemsSeen, drafts_created: report.draftsCreated, errors: report.errors })
  return Response.json(report)
}
