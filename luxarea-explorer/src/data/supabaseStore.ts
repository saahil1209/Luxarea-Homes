// Supabase-backed store. Used when VITE_DATA_MODE=supabase.
// Schema and security rules: supabase/migrations/001_init.sql.
// NOTE: written against that schema but not yet run against a live project;
// test it once Luxarea's Supabase project exists.
import { createClient } from '@supabase/supabase-js'
import type { Property } from './listings'
import type { HomeContent } from '../content/types'
import homeJson from '../../content/home.json'
import { withNewSections } from '../content/upgrade'
import { newId, resizeImage, toProperty, type Draft, type Lead, type Listing, type Store, type User } from './store'

interface ListingRow { id: string; data: Property; status: Listing['status']; confidential: boolean; source_draft_id: string | null; updated_at: string; updated_by: string | null }
interface DraftRow { id: string; source: Draft['source']; received_at: string; from_label: string | null; source_url: string | null; raw_text: string; media: string[]; extracted: Draft['extracted']; status: Draft['status']; listing_id: string | null; note: string | null }

const fromListingRow = (r: ListingRow): Listing => ({ ...r.data, id: r.id, status: r.status, updatedAt: r.updated_at, updatedBy: r.updated_by ?? undefined, sourceDraftId: r.source_draft_id ?? undefined })
const fromDraftRow = (r: DraftRow): Draft => ({ id: r.id, source: r.source, receivedAt: r.received_at, from: r.from_label ?? undefined, sourceUrl: r.source_url ?? undefined, rawText: r.raw_text, media: r.media, extracted: r.extracted, status: r.status, listingId: r.listing_id ?? undefined, note: r.note ?? undefined })

export function createSupabaseStore(): Store {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !key) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set for supabase mode')
  const sb = createClient(url, key)

  async function me(): Promise<User | null> {
    const { data } = await sb.auth.getUser()
    if (!data.user) return null
    const { data: row } = await sb.from('team_members').select('email,name,role').eq('user_id', data.user.id).maybeSingle()
    // Signed in but not on the team: treated as signed out for the admin.
    return row ? { email: row.email, name: row.name || row.email, role: row.role } : null
  }

  const must = <T>(r: { data: T | null; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message)
    return r.data as T
  }

  return {
    mode: 'supabase',
    currentUser: me,
    async signIn(email, password) {
      if (password) {
        const { error } = await sb.auth.signInWithPassword({ email, password })
        if (error) throw new Error('That email and password don’t match.')
        if (!(await me())) {
          await sb.auth.signOut()
          throw new Error('This account isn’t on the Luxarea team yet. Ask an admin to add you.')
        }
        return 'signed-in'
      }
      must(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/admin.html`, shouldCreateUser: false } }))
      return 'check-email'
    },
    async signOut() {
      await sb.auth.signOut()
    },

    async listListings() {
      const rows = must(await sb.from('listings').select('*').order('updated_at', { ascending: false })) as ListingRow[]
      return rows.map(fromListingRow)
    },
    async saveListing(l) {
      const user = await me()
      const row = { id: l.id || newId('p-'), data: toProperty(l), status: l.status, confidential: !!l.confidential, source_draft_id: l.sourceDraftId ?? null, updated_at: new Date().toISOString(), updated_by: user?.name ?? null }
      const saved = must(await sb.from('listings').upsert(row).select().single()) as ListingRow
      return fromListingRow(saved)
    },
    async deleteListing(id) {
      must(await sb.from('listings').delete().eq('id', id))
    },
    async listPublished() {
      // Off-market listings are hidden by row-level security; the public gets
      // only a teaser for each (area to ~1 km, no name, building or price).
      const rows = must(await sb.from('listings').select('id,data').eq('status', 'published')) as Pick<ListingRow, 'id' | 'data'>[]
      const teasers = (must(await sb.rpc('private_teasers')) ?? []) as { id: string; locality: string; city: string; segment: Property['segment']; lat: number; lng: number }[]
      return [
        ...rows.map((r) => ({ ...r.data, id: r.id })),
        ...teasers.map((t): Property => ({
          id: t.id, name: 'Off-market residence', locality: t.locality, city: t.city, segment: t.segment ?? 'Luxury Residences', lat: t.lat, lng: t.lng,
          tagline: '', developer: '', possession: '', rera: '', totalFloors: 1, footprint: [6, 4], form: 'tower', confidential: true, amenities: [], residences: [],
        })),
      ]
    },
    async unlockPrivate(code) {
      const { data, error } = await sb.rpc('unlock_private', { invite: code })
      if (error) throw new Error(error.message)
      const list = (data as Property[] | null) ?? []
      return list.length ? list : null
    },

    async listLeads() {
      const rows = must(await sb.from('leads').select('*').order('created_at', { ascending: false }).limit(300)) as Record<string, string>[]
      return rows.map((r): Lead => ({ id: r.id, createdAt: r.created_at, name: r.name, phone: r.phone, channel: r.channel, intent: r.intent, budget: r.budget, forWhom: r.for_whom, note: r.note, page: r.page, utm: r.utm, status: r.status as Lead['status'], teamNote: r.team_note }))
    },
    async updateLead(id, patch) {
      must(await sb.from('leads').update({ ...(patch.status ? { status: patch.status } : {}), ...(patch.teamNote !== undefined ? { team_note: patch.teamNote } : {}) }).eq('id', id))
    },

    async listDrafts() {
      const rows = must(await sb.from('drafts').select('*').order('received_at', { ascending: false }).limit(200)) as DraftRow[]
      return rows.map(fromDraftRow)
    },
    async saveDraft(d) {
      const row = { id: d.id, source: d.source, received_at: d.receivedAt, from_label: d.from ?? null, source_url: d.sourceUrl ?? null, raw_text: d.rawText, media: d.media, extracted: d.extracted, status: d.status, listing_id: d.listingId ?? null, note: d.note ?? null }
      return fromDraftRow(must(await sb.from('drafts').upsert(row).select().single()) as DraftRow)
    },

    async getContent() {
      const rows = must(await sb.from('site_content').select('id,content')) as { id: string; content: HomeContent }[]
      const fallback = homeJson as unknown as HomeContent
      const published = rows.find((r) => r.id === 'home:published')?.content ?? fallback
      const draft = rows.find((r) => r.id === 'home:draft')?.content ?? published
      return { draft: withNewSections(draft, fallback), published: withNewSections(published, fallback) }
    },
    async saveContentDraft(c) {
      const user = await me()
      must(await sb.from('site_content').upsert({ id: 'home:draft', content: c, updated_at: new Date().toISOString(), updated_by: user?.name ?? null }))
    },
    async publishContent(c) {
      const user = await me()
      const content = { ...c, updatedAt: new Date().toISOString(), updatedBy: user?.name }
      const stamp = { updated_at: content.updatedAt, updated_by: user?.name ?? null }
      must(await sb.from('site_content').upsert([{ id: 'home:draft', content, ...stamp }, { id: 'home:published', content, ...stamp }]))
      // Ask the site to rebuild so the static home page picks up the change.
      const { data } = await sb.auth.getSession()
      try {
        const res = await fetch('/api/publish', { method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` } })
        if (res.status === 501) return { rebuild: 'not-configured' }
        if (!res.ok) throw new Error(await res.text())
        return { rebuild: 'started' }
      } catch {
        return { rebuild: 'not-configured' }
      }
    },

    async uploadImage(file, folder) {
      const blob = await resizeImage(file)
      const path = `${folder}/${newId()}.jpg`
      must(await sb.storage.from('media').upload(path, blob, { contentType: 'image/jpeg', upsert: false }))
      return sb.storage.from('media').getPublicUrl(path).data.publicUrl
    },
  }
}
