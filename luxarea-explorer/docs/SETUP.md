# Switching on the shared database, WhatsApp intake, daily scan and leads

Everything below is already built and tested. It switches on with Luxarea's own accounts; no code changes are needed. Do the steps in order. Each one works on its own, so you can stop after any of them.

Where a step says **Vercel env**, that means Vercel → the project → Settings → Environment Variables (Production). Redeploy after adding variables.

---

## 1. Shared database (Supabase): about 20 minutes

Turns on: team logins, shared listings, inbox, website publishing, server-checked invite codes.

1. Luxarea creates a Supabase account and project. Choose region **Mumbai (ap-south-1)** and the Pro plan for production.
2. SQL editor: run `supabase/migrations/001_init.sql`, then `002_intake_leads.sql`.
3. Vercel env:
   | Variable | Value |
   |---|---|
   | `VITE_DATA_MODE` | `supabase` |
   | `VITE_SUPABASE_URL` | Project URL (Settings → API) |
   | `VITE_SUPABASE_ANON_KEY` | anon public key (safe in the browser; row-level security protects data) |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**secret, server only**) |
   | `SITE_URL` | `https://www.luxarea.in` (or the vercel.app address while testing) |
4. Supabase → Authentication → URL configuration: add the site URL and `<site>/admin.html` to the redirect URLs.
5. Open `/admin.html`, sign in with your email (a link arrives), then in the SQL editor make yourself admin:
   ```sql
   insert into public.team_members (user_id, email, name, role)
   select id, email, 'Your name', 'admin' from auth.users where email = 'you@luxarea.in';
   ```
   Repeat for each team member (`role` = `editor` for non-admins).
6. Invite codes for off-market homes:
   ```sql
   insert into public.invite_codes (code, note, expires_at) values ('LUX-SHAH-2026', 'Shah family', now() + interval '60 days');
   ```

## 2. Publish button rebuilds the site: 5 minutes

1. Vercel → Settings → Git → Deploy Hooks → create one for the production branch.
2. Vercel env: `VERCEL_DEPLOY_HOOK_URL` = that URL (**secret**).

From now on, **Publish** in admin → Website updates the live home page in about a minute.

## 3. Leads: 2 minutes

Vercel env: `VITE_LEAD_ENDPOINT` = `/api/lead`. Every enquiry from the home-page form then appears in admin → **Leads**. WhatsApp still opens for people who chose WhatsApp, so no enquiry is lost if the server is down.

## 4. WhatsApp intake: a few days (Meta verification), then 15 minutes

The team forwards listings to a dedicated Luxarea number. Each one becomes an inbox draft, with photos attached, and the sender gets a reply with a link.

1. A **new phone number** that isn't registered on WhatsApp (Meta moves it onto the business platform).
2. Meta Business account (business.facebook.com) → verify Luxarea Homes Pvt Ltd (GST or incorporation certificate).
3. developers.facebook.com → create an app (type Business) → add **WhatsApp** → add and verify the number.
4. Create a **System User** with a permanent token (permissions: `whatsapp_business_messaging`, `whatsapp_business_management`).
5. Vercel env:
   | Variable | Value |
   |---|---|
   | `WHATSAPP_TOKEN` | the permanent token (**secret**) |
   | `WHATSAPP_PHONE_NUMBER_ID` | from WhatsApp → API setup |
   | `WHATSAPP_APP_SECRET` | App settings → Basic → App secret (**secret**) |
   | `WHATSAPP_VERIFY_TOKEN` | any long random string you invent |
6. Meta app → WhatsApp → Configuration → Webhook: URL `https://<site>/api/whatsapp`, verify token = the same string, then subscribe to **messages**.
7. Register who may forward (digits only, with country code):
   ```sql
   update public.team_members set whatsapp = '919800000001' where email = 'shweta@luxarea.in';
   ```
   Messages from any other number are ignored.

**How the team uses it:** forward the listing text, then its photos within 15 minutes (they attach to the same draft). Messages from customers to this number are ignored, so keep it for team use.

## 5. AI reading (optional): 5 minutes

Without a key, messages are read by the built-in rules only (BHK, carpet area, floor, ₹ Cr, RERA, locality, off-market). With a key, Claude fills what the rules missed, such as AED prices and project names. Every figure it returns must appear in the original text, or it is left blank.

1. console.anthropic.com → create an API key, and set a monthly spend limit (₹1,000–2,000 is ample for this volume).
2. Vercel env: `ANTHROPIC_API_KEY` (**secret**).

## 6. Daily scan: 2 minutes

Runs at 6:00 am India time. It reads the feeds in `api/_lib/scan-sources.ts`, keeps stories about Luxarea's areas that mention a project, home or land deal, and adds each new one to the inbox once.

1. Vercel env: `CRON_SECRET` = a long random string (**secret**). Vercel sends it with each scheduled run; nobody else can trigger the scan.
2. To preview what it would find, without saving anything: `npm run scan:dry`.
3. To add a developer's newsroom feed, add it to `scan-sources.ts` with its host on `allowHosts`.

Not automated, by design: broker portals (their terms forbid scraping), MahaRERA (no public feed or API, captcha), and Dubai Land Department data (needs a Dubai Pulse key; add as a source once registered).

---

## Checks after switching on

- `npm test` runs the server tests (guard, AI gap-filler, webhook, intake, scan, leads) against stand-ins.
- Send a test forward from a registered number: it should appear in the inbox within seconds, with a WhatsApp reply.
- Submit the home-page form: it should appear in admin → Leads.
- Supabase → Table editor → `scan_runs`: one row per morning, with counts and any errors.
