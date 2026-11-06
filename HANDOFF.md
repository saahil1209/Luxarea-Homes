# Luxarea website project: handoff

Everything a new Claude session (or developer) needs to pick this up. Written 5 Nov 2026; updated the same day after the home page was built (see section 0).

---

## 0. Status update (second session, 5 Nov 2026)

**Done since the first handoff:**
- **Finder tested** in a browser (desktop, laptop, phone) and fixed:
  - Deep links to a floor (`#/p/sea-ledger/f/24`) now frame the floor plan in the free space beside the panel. Before, the panel size was measured before the 3D scene existed, so it was ignored.
  - The floor plan fills the view and its labels no longer overlap. Villas get extra margin.
  - Overlapping map price pins shrink to dots; hover or tap a dot for its price (pricier homes keep the full pin).
  - The phone header now shows "Speak to an advisor". The logo wordmark is no longer underlined.
  - Room labels no longer draw on top of the floor panel on phones.
  - Sold floors no longer show "SOLD" twice.
  - The Finder menu matches the home page.
- **Home page built** (`index.html`, `src/home/main.ts`, `src/home/home.css`), with all 14 sections in 5a. Static HTML, no React. Works without JavaScript (one plain form, all tabs visible).
  - The 3D tower loads when the browser is idle on desktop, and on tap on phones or with Save-Data. It pauses when off screen.
  - Clicking a floor opens a card that links to that floor in the Finder, or prefills the contact form with that residence.
- **Brand tokens in HTML**: write `%BRAND.phoneDisplay%`, `%BRAND.reraAgent%` etc. in any HTML page, and the values come from `src/config.ts` at build time.
- **Lead destination**: `LEAD_ENDPOINT` in `src/config.ts`. If it's empty, the form opens WhatsApp prefilled. If it's set, the form POSTs JSON there.
- **SEO**: title, description, canonical, Open Graph and Twitter tags, JSON-LD (`RealEstateAgent`, `WebSite`, `FAQPage`), plus `public/robots.txt`, `public/sitemap.xml` and `public/llms.txt`.
- **`public/og-image.jpg`** is a stand-in (a render of the hero). Replace it with a real property photo.
- **Size**: the home page loads about 12 KB HTML, 6 KB CSS and 7 KB JS (gzipped) before the tower. Three.js (~129 KB gzipped) loads after.
- The project is now a git repository.

**Tested:** hero hover and click, floor card links, form validation and WhatsApp handoff, prefill from service buttons and floor cards, the phone tap-to-3D flow, and the no-JavaScript fallback. All passed with no console errors. The tests ran in a software-rendered headless browser, so check animation smoothness on a real phone.

**Third session (same day):**
- Official logo files added (`luxarea-explorer/public/brand/`). The redrawn SVG mark already matched them; two shades were corrected.
- Content taken from luxarea.in: the real team (Viivek Bathija, Shweta Jayakar, Saurabh Dwivedi), the full address and office hours, the extra services (leasing, property management, home loans, valuations), and two FAQs.
- The share image is now the terrace photo from Luxarea's own Wix uploads. Confirm it's theirs to use.
- New `privacy.html` and `terms.html` drafts for a lawyer to review. The old Terms page was copied from "Sai Realtors" (Khar office, RERA A51800039192), Luxarea has since confirmed A51800039192 is theirs, and it is now on the site.
- The old site's testimonials are Wix template text (Jane Smith etc.) and were not reused. Its images are stock.
- GitHub: `saahil1209/Luxarea-Homes` (private), branch `site-v1` (the default branch). Vercel project `luxarea-homes` (MESA team) deploys it from root directory `luxarea-explorer`; live test site: https://luxarea-homes.vercel.app

**Still open:**
- Remaining placeholders: team photos, real listings, real client stories, the reply-time promise, the 48-hour shortlist promise and fee wording. Search the code for `TODO(Luxarea)`.
- Section 5d (production).
- Luxarea's vector (SVG) logo originals, if they exist.

## 0b. Team backend and design pass (5 Nov 2026)

- **Admin** at `/admin.html` (noindex), with four pages:
  - **Inbox:** listing drafts from WhatsApp, the scan or pasted by hand, each with the facts read from it; Create listing, Add to existing or Reject.
  - **Leads:** enquiries from the website form.
  - **Listings:** map-pin picker, residence types, a floor-availability grid, photos you drag to reorder, and validation before publishing.
  - **Website:** a structured drag-and-drop editor for the home page (reorder, show or hide, edit every text, list and team photo), with a live desktop and phone preview, an autosaved draft and **Publish**.
- **Home page from data.** Content lives in `content/home.json` (or Supabase). `src/content/render.ts` builds static HTML and JSON-LD at build time, and the editor's preview uses the same renderer. `*asterisks*` in a heading set those words in copper italics.
- **Data layer** (`src/data/store.ts`). Demo mode stores data in each browser (IndexedDB); Supabase mode shares it across the team. Schema: `supabase/migrations/001_init.sql`, `002_intake_leads.sql`.
- **Design and motion** (`src/home/motion.ts`, `motion.css`):
  - Lenis smooth scrolling on desktop.
  - Masked word reveals in the hero, parallax on scroll and mouse, and a cursor glow.
  - Card spotlights, a magnetic main button, a tilting Finder map and a count-up on "25 years".
  - Process dots that fill, sliding tab underlines, smooth FAQ answers and an auto-hiding header.
  - Everything respects reduced-motion settings and touch screens, and there's a no-JavaScript fallback.
- **New favicon set:** SVG, ICO, an Apple touch icon, 192/512 icons and a web manifest.

## 0c. Intake, scan, leads (6 Nov 2026)

Everything on the component map is built. What switches on with Luxarea's accounts is listed step by step in **`luxarea-explorer/docs/SETUP.md`**.

- **WhatsApp intake** (`api/whatsapp.ts`, `api/_lib/intake.ts`). It checks Meta's signature and accepts team numbers only (`team_members.whatsapp`). Each message id is processed once, even when Meta retries. Photos sent within 15 minutes attach to the sender's last draft, and the sender gets a WhatsApp reply with a summary and a link.
- **AI gap-filler** (`api/_lib/ai.ts`): Claude Opus 5.5 at low effort, structured output, with server-side refusal fallbacks. It fills only fields the rule reader left empty and never overwrites them. If the key is missing or the call fails, the draft is saved with rules only.
- **Guard** (`api/_lib/guard.ts`): every number, name or place the AI returns must appear in the source text, allowing for crore/lakh and AED M/k rewrites (with the unit word required). Otherwise it's dropped and noted on the draft. The tests caught and fixed a case where "3200 sq ft" let an invented ₹32 Cr through.
- **Daily scan** (`api/scan.ts`; `vercel.json` cron 00:30 UTC = 6:00 IST). It reads the allow-listed feeds (`api/_lib/scan-sources.ts`: ET Realty, HT real estate) and applies a relevance filter: a Luxarea locality plus a project, home or land signal, with legal, civic and affordable-housing stories excluded. Stories are deduped by link, and runs are logged in `scan_runs`. The live dry run on 6 Nov kept 4 of 44 stories, all relevant (`npm run scan:dry`). Not automated: broker portals, MahaRERA (no feed, captcha) and DLD (needs a key).
- **Leads** (`api/lead.ts`, admin → Leads). The form saves the lead with a background request and still opens WhatsApp for WhatsApp-preferring visitors, or whenever saving fails. It includes a honeypot for spam. Leads have a status and a team note.
- **Off-market:** in Supabase mode, invite codes are checked on the server (`unlock_private`). The public sees only teasers (`private_teasers`: area to about 1 km, no name or price). The code is remembered for the browser session.
- **Tests:** `npm test` runs 13 server tests against stand-ins for WhatsApp, Supabase and Claude, plus two real feeds saved as fixtures. The browser checks (admin end to end, Finder unlock, Leads) also pass.
- **Fixes along the way:** admin form hints are now linked as descriptions (screen readers had read them as part of each field's name), and `src/config.ts` no longer crashes the build config.

## 0d. Map, developers, sign-in (6 Nov 2026)

- **Finder teaser:** the heading is now "Explore every residence, *floor by floor*", the copy is left-aligned on desktop, and the map is a real one. `scripts/render-teaser-map.mjs` renders OpenFreeMap/OSM data in brand colours to `public/maps/teaser-mumbai.webp` (34 KB) plus `src/content/teaserMap.ts` (bounds and projection). Pins are placed by real coordinates, listings outside the map (Dubai) are skipped, and the OSM credit is shown.
- **Developers we work with:** a new `partners` section with 10 Mumbai developers, editable and draggable in admin → Website. **Luxarea must confirm** which of these it really works with directly before launch. Saved content gets new sections merged in automatically (`src/content/upgrade.ts`).
- **Admin sign-in:** email and password, checked on the server (`api/admin-login.ts`, `api/admin-session.ts`, scrypt hash and HMAC session in Vercel env; see SETUP.md step 0). With Supabase it uses Supabase password accounts. The password is never stored in code or the repo.

---

## 1. Starter prompt for the new account

Open this folder in Claude Code and paste:

> I'm continuing the Luxarea Homes website (luxarea.in, a luxury real-estate advisory in BKC, Mumbai). Read `HANDOFF.md` first (sections 0, 0b, 0c), then `luxarea-explorer/docs/SETUP.md` and `luxarea-explorer/docs/buyer-psychology.md`. Everything on the component map (`luxarea-explorer/docs/Luxarea-component-map.pdf`) is built. The next step is switching on Luxarea's accounts as described in SETUP.md. Run `npm install` in `luxarea-explorer`, then `npm test` and `npm run build`. Don't push or deploy without asking me first.

---

## 2. What's in this package

| Path | What it is |
|---|---|
| `HANDOFF.md` | This file |
| `mapz-launch-audit.html` | Launch audit of mapz.in (licensing, security, Indian legal, APIs, AI guardrails). Open in a browser; it's self-contained |
| `luxarea-explorer/` | The Luxarea website project (Vite + React + TypeScript) |
| `luxarea-explorer/docs/buyer-psychology.md` | Buyer psychology and conversion strategy, which drives every design decision |
| `.claude/launch.json` | Dev-server config for the Claude desktop app preview |
| `transcript/` | Export of the original conversation, if included (see section 8) |

---

## 3. The brief (from the user, in their words where possible)

**Client:** Luxarea Homes Pvt Ltd, Parinee Crescenzo, 1B, G Block, BKC, Mumbai 400051. +91 77189 61447, homes@luxarea.in. 25 years in business. Their current site is on Wix and the listings page says "Coming soon": listings are shared through a WhatsApp community.

**What they sell:** luxury homes in Bombay, land in Bombay, and Dubai real estate.

**What to build:**
1. **A new main website.** "Fun interactive website… make me a render. Add parallax and scrolling effects and dynamic elements." Inspired by this Short: https://youtube.com/shorts/UVqiWRHLVCo ("Velaris" concept tower: hover a floor, click it, the tower splits open to show that home's floor plan, details and interior gallery).
2. **Opening page** with the pitch, then **the MapZ-style feature as a section below it**. That section links to **a separate page, also in the top menu**, that works like mapz.in (searchable map of the property database).
3. **Use their brand colours and fonts.** Logos supplied as images (see section 6).
4. **Optimise for** SEO, AI search, loading time, token usage (if any), and *most importantly* **consumer psychology**: who visits vs who views the property vs who decides, what they look for, where they drop off, what makes them trust Luxarea. Nothing is bought online. **Main site goal: build trust so people fill the contact form.** **Finder goal: make it easy to search the database, then contact Luxarea.**

---

## 4. What's built

### Residence Finder (`residences.html` → `src/main.tsx` → `src/App.tsx`)
- **Map view** (`ExploreView.tsx`, `MapView.tsx`): filters (locality chips, budget, BHK), property cards, MapLibre map with price pins. Basemap is OpenFreeMap (free, no key, commercial use OK).
- **Private / off-market listings**: shown as an approximate circle until an invite code is entered (demo code `LUX-PRIVATE`, set in `src/config.ts`). **Client-side only. Production needs a server check.**
- **3D tower view** (`PropertyView.tsx`, `src/three/TowerScene.ts`): procedural Three.js tower at dusk. Hover a floor for a tooltip (residence, BHK, sq ft, status, price). Click and the floors above lift away, revealing a 3D floor plan with labelled rooms and real dimensions. Side panel with specs, highlights, photo placeholders, "Request a private viewing" and "Copy link to this floor". A floor strip on the right edge shows availability colours. The keyboard works (↑/↓ change floor, Esc closes). Villas (Alibaug) render as two levels with a pool.
- **Deep links**: `residences.html#/p/sea-ledger/f/24` opens straight to a floor (made for WhatsApp sharing).
- **Enquiry** (`EnquirySheet.tsx`): name, mobile, timing, note, consent checkbox. Opens WhatsApp with the message prefilled. No server.
- **Data** (`src/data/listings.ts`, `floorplans.ts`): 6 **fictional sample** properties in real localities (Worli, Malabar Hill, Bandra, Juhu, Lower Parel, Alibaug). The "Sample listings" badge comes from `USING_SAMPLE_DATA` in `config.ts`.

### Brand (`src/styles.css`, `src/components/Brand.tsx`, `public/favicon.svg`)
- Colours from the logo: forest `#223f3e`, copper `#c49a6c`, teal `#22625f`, sage `#4e6a68`, ivory `#f5f1e8`, ink `#102120`.
- Fonts: **Caudex** (headings) and **Quicksand** (UI), the same as luxarea.in. **Marcellus**, loaded only for the letters L-U-X-A-R-E-A, approximates the logo wordmark.
- Logo mark redrawn as SVG (`LogoMark` in `Brand.tsx`, `public/favicon.svg`). Replace with the official vector files if Luxarea has them.

### Strategy
- `docs/buyer-psychology.md`: the personas (principal, researcher, elders/advisers, NRI/Dubai buyer), the risk-reduction approach, drop-off fixes, and what Luxarea must supply.

### How to run
```bash
cd luxarea-explorer
npm install
npm run dev        # http://localhost:5183  → /residences.html is the Finder
npm run build      # type-check + production build into dist/
```

---

## 5. What was left at the first handoff (5a–5c now done; see section 0)

### 5a. Home page (`index.html` + `src/home/main.ts` + `src/home/home.css`)
**Current state:** `index.html` is still the *old* entry and loads the React app. Replace it with a **static, content-rich HTML page** (no React) so search engines and AI crawlers read everything. Enhance it with small vanilla TypeScript. `vite.config.ts` already builds both `index.html` and `residences.html`.

Planned sections:
1. **Header**: logo, menu (Home · Residence Finder → `/residences.html` · Mumbai Homes `#homes` · Land `#land` · Dubai `#dubai` · About `#about`), copper "Speak to an advisor" button on every page.
2. **Hero**: full-bleed 3D tower render (reuse `TowerScene` with the flagship sample property, pass `{ zoom: false }`, and `rotate: false` on touch screens so the page still scrolls). Copy on the left, tower centred in the remaining space via `scene.setInsets(left, right, bottom)`. Show a **static SVG poster tower first**, then lazy-load Three.js with `import()` when idle on desktop, or on tap on mobile and with Save-Data on. Hovering a floor shows a tooltip. Clicking opens the floor with a small card: "See this floor in the Residence Finder" plus "Ask about this residence". Foreground parallax: Bandra–Worli Sea Link silhouette and Queen's Necklace lights moving faster than the tower on scroll.
   - Headline direction: discretion and seniority, not hype. Example: "Mumbai's finest homes, found quietly." Sub: 25 years, find / verify / negotiate, homes, land and Dubai. Under the buttons: who replies, on which channel, when.
3. **Proof strip**: 25 years · BKC office · Mumbai · Alibaug · Dubai · off-market register. Plus a slow marquee of micro-markets. **No invented numbers.**
4. **Three ways we help** (`#homes`, `#land`, `#dubai`): what's included and who it's for. Each button prefills the contact form's intent.
5. **Residence Finder teaser** (`#finder`): stylised SVG map of Mumbai and Alibaug with pins generated from `listings.ts`, popping in on scroll, with hover prices. Links to `/residences.html#/p/{id}`, plus a big "Open the Residence Finder" button.
6. **Process** (5 real steps with time frames, scroll-driven progress line): 20-min brief → private shortlist (48 h, **client to confirm**) → viewings or video walkthroughs → due diligence → negotiation to registration.
7. **What we verify** (tabs): Homes (title chain, RERA, OC/CC, society NOC, encumbrance, measured carpet area) · Land (7/12 extract, title search, DP remarks, CRZ, NA order, FSI/TDR) · Dubai (DLD title deed, escrow, developer track record, Golden Visa eligibility, LRS limits).
8. **Discretion pledge** (dark section): number never shared with developers; off-market by invitation or NDA; one senior advisor; we tell you when not to buy.
9. **About / people**: founder cards (placeholders), MahaRERA agent number, BKC office.
10. **Client voices**: clearly labelled samples until real, permissioned stories arrive.
11. **FAQ** (`<details>`, also as FAQPage JSON-LD). Accurate answers drafted:
    - NRIs/OCIs can buy residential and commercial property in India without RBI approval. They can't buy agricultural land, plantation property or farmhouses. Payment goes through NRE/NRO/FCNR.
    - Resident Indians can remit up to **USD 250,000 per financial year** under LRS (per person, so family members can pool). TCS applies above ₹10 lakh a year.
    - Dubai property of **AED 2 million+** can qualify for the 10-year Golden Visa (rules at the time of application).
    - Maharashtra agricultural land can generally be bought only by agriculturists, so most buyers take **NA (non-agricultural) plots**. Verify the NA order, 7/12 and CRZ.
    - How we keep your search private. How we're paid ("explained in writing at the first meeting").
12. **Contact form** (`#contact`), two steps: (1) tap chips: what (home in Mumbai / land / Dubai / selling or leasing), budget band, **who it's for (me / my family / someone I represent)**; (2) name, WhatsApp number, preferred channel, consent. Hidden fields: page, UTM, referrer. Without a lead endpoint it falls back to WhatsApp prefill, then a success state. Without JavaScript it shows as one plain form.
13. **Mobile sticky bar** after the hero: WhatsApp · Request a call.
14. **Footer**: address, MahaRERA agent number, privacy, terms.

Motion rules: content must be visible without JavaScript (reveal classes only added under `.js`), and everything respects `prefers-reduced-motion`.

### 5b. SEO, AI search, speed
- `<title>` and meta description per page, canonical, Open Graph and Twitter tags, `lang="en-IN"`.
- JSON-LD: `RealEstateAgent` (name, address, phone, email, areaServed: Mumbai, Alibaug, Dubai), `WebSite`, `FAQPage`.
- `public/robots.txt`, `public/sitemap.xml`, `public/llms.txt` (plain-language business summary, services, areas, FAQs, contact).
- Speed: home ships no React. Three.js (about 150 KB gzipped) loads only after first paint. MapLibre loads only on the Finder. Chunks are already split in `vite.config.ts`. Preconnect to fonts and tiles. Marcellus is subset to 7 letters.
- An Open Graph image (1200×630) is needed. Use a real property photo from Luxarea.
- Tokens: the site makes **no AI calls**, so there is no token cost. If an AI concierge is added later, follow the guardrails in the MapZ audit (schema-only prompts, rule-based fast path, caching, quotas).

### 5c. Test and fix
- Not run since the last changes: the rebrand, panel-aware tower framing (`setInsets`), and the two-page split. Run `npm run dev` and check `/residences.html` (map and tower) at desktop and phone widths.
- Known issues: map price pins overlap at the zoom level that fits both Mumbai and Alibaug. The tower intro panel can cover the tower on narrow laptop screens (`setInsets` should fix this; verify).

### 5d. Production (later)
Real listings feed (Google Sheet or Supabase), a lead endpoint and CRM, server-checked invite codes, per-property static pages for SEO, analytics with consent, hosting on Vercel **Pro** (Hobby forbids commercial use).

---

## 6. Things you must bring across manually
- **The two logo images** (green on light grey, and copper on forest green). They were pasted into the chat, not saved as files. Re-attach them in the new account, and ask Luxarea for SVG originals.
- **Live artifact link**: the MapZ audit was published at https://claude.ai/artifact/1YAmSGihCmM1uRgkLDZB7p on the old account. The new account can only open it if you share it from the old account's Share menu. The same page is included here as `mapz-launch-audit.html`.

## 7. Placeholders Luxarea must supply before launch
Real listings and photos · founder names, photos and bios · MahaRERA agent registration number (`BRAND.reraAgent` in `src/config.ts`) · client stories with permission · the reply-time promise they can keep · fee wording · a lead destination (CRM or email) · OG image.

## 8. Original conversation
If a `transcript/` folder is in this package, it holds the full export of the original session. Treat it as reference only.
