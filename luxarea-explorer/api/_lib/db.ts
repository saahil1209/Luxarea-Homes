// Server-side Supabase access with the service-role key (bypasses row-level
// security, so it is only ever used inside api/ functions, never in the browser).
import type { Extracted } from '../../src/data/store'

export interface DraftInsert {
  source: 'whatsapp' | 'scan' | 'manual'
  external_id: string
  from_label?: string
  source_url?: string
  raw_text: string
  media?: string[]
  extracted: Extracted
  note?: string
}

export class Db {
  constructor(private url: string, private key: string, private fetchImpl: typeof fetch = fetch) {}

  static fromEnv(fetchImpl?: typeof fetch): Db | null {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    return url && key ? new Db(url.replace(/\/$/, ''), key, fetchImpl) : null
  }

  private async rest<T>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
    const res = await this.fetchImpl(`${this.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        ...(init.prefer ? { Prefer: init.prefer } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    })
    if (!res.ok) throw new Error(`Supabase ${init.method ?? 'GET'} ${path.split('?')[0]}: ${res.status} ${await res.text()}`)
    const text = await res.text()
    return (text ? JSON.parse(text) : null) as T
  }

  /** Insert a draft; returns null if one with the same external_id already exists. */
  async insertDraft(d: DraftInsert): Promise<{ id: string } | null> {
    const rows = await this.rest<{ id: string }[]>('drafts?on_conflict=external_id&select=id', {
      method: 'POST',
      prefer: 'resolution=ignore-duplicates,return=representation',
      body: JSON.stringify({ media: [], ...d }),
    })
    return rows?.[0] ?? null
  }

  /** The sender's most recent WhatsApp draft in the last few minutes (photos sent after the text attach to it). */
  async recentWhatsappDraft(fromLabel: string, withinMinutes = 15): Promise<{ id: string; media: string[] } | null> {
    const since = new Date(Date.now() - withinMinutes * 60_000).toISOString()
    const rows = await this.rest<{ id: string; media: string[] }[]>(
      `drafts?source=eq.whatsapp&from_label=eq.${encodeURIComponent(fromLabel)}&received_at=gte.${encodeURIComponent(since)}&order=received_at.desc&limit=1&select=id,media`,
    )
    return rows[0] ?? null
  }

  async appendMedia(draftId: string, media: string[]): Promise<void> {
    await this.rest(`drafts?id=eq.${draftId}`, { method: 'PATCH', body: JSON.stringify({ media }) })
  }

  async teamMemberByWhatsapp(number: string): Promise<{ name: string } | null> {
    const rows = await this.rest<{ name: string }[]>(`team_members?whatsapp=eq.${encodeURIComponent(number)}&select=name`)
    return rows[0] ?? null
  }

  async uploadMedia(path: string, bytes: ArrayBuffer, contentType: string): Promise<string> {
    const res = await this.fetchImpl(`${this.url}/storage/v1/object/media/${path}`, {
      method: 'POST',
      headers: { apikey: this.key, Authorization: `Bearer ${this.key}`, 'Content-Type': contentType, 'x-upsert': 'false' },
      body: bytes,
    })
    if (!res.ok) throw new Error(`Storage upload ${res.status}: ${await res.text()}`)
    return `${this.url}/storage/v1/object/public/media/${path}`
  }

  async insertLead(lead: Record<string, unknown>): Promise<void> {
    await this.rest('leads', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(lead) })
  }

  async startScanRun(): Promise<number> {
    const rows = await this.rest<{ id: number }[]>('scan_runs?select=id', { method: 'POST', prefer: 'return=representation', body: '{}' })
    return rows[0].id
  }

  async finishScanRun(id: number, stats: { sources_checked: number; items_seen: number; drafts_created: number; errors: string[] }): Promise<void> {
    await this.rest(`scan_runs?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ ...stats, finished_at: new Date().toISOString() }) })
  }

  /** For the publish endpoint: is this access token a team member? */
  async isTeamToken(accessToken: string): Promise<boolean> {
    const u = await this.fetchImpl(`${this.url}/auth/v1/user`, { headers: { apikey: this.key, Authorization: `Bearer ${accessToken}` } })
    if (!u.ok) return false
    const { id } = (await u.json()) as { id: string }
    const rows = await this.rest<unknown[]>(`team_members?user_id=eq.${encodeURIComponent(id)}&select=user_id`)
    return rows.length > 0
  }
}
