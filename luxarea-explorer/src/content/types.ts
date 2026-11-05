// The home page as data. The team edits this in /admin; the build turns it
// into static HTML (src/content/render.ts), so search engines still read
// plain HTML and the page stays fast.

export interface Pair { title: string; text: string }

export interface HeroSection { type: 'hero'; eyebrow: string; title: string; lede: string; primaryCta: string; secondaryCta: string; replyNote: string }
export interface ProofSection { type: 'proof'; items: Pair[]; places: string[] }
export interface ServiceItem { anchor: string; intent: string; title: string; text: string; bullets: string[]; forWho: string; cta: string }
export interface ServicesSection { type: 'services'; eyebrow: string; title: string; lede: string; items: ServiceItem[]; alsoNote: string }
export interface FinderSection { type: 'finder'; eyebrow: string; title: string; lede: string; areas: string[]; cta: string; note: string }
export interface Step { time: string; title: string; text: string }
export interface ProcessSection { type: 'process'; eyebrow: string; title: string; lede: string; steps: Step[] }
export interface Check { term: string; text: string }
export interface VerifyTab { label: string; title: string; checks: Check[] }
export interface VerifySection { type: 'verify'; eyebrow: string; title: string; lede: string; tabs: VerifyTab[] }
export interface DiscretionSection { type: 'discretion'; eyebrow: string; title: string; items: Pair[] }
export interface Person { name: string; role: string; bio: string; photo: string }
export interface AboutSection { type: 'about'; eyebrow: string; title: string; lede: string; people: Person[]; showOffice: boolean }
export interface Quote { text: string; by: string; sample: boolean }
export interface VoicesSection { type: 'voices'; eyebrow: string; title: string; quotes: Quote[] }
export interface Faq { q: string; a: string }
export interface FaqSection { type: 'faq'; eyebrow: string; title: string; items: Faq[] }
export interface ContactSection { type: 'contact'; eyebrow: string; title: string; lede: string; replyPromise: string }

export type SectionData =
  | HeroSection | ProofSection | ServicesSection | FinderSection | ProcessSection | VerifySection
  | DiscretionSection | AboutSection | VoicesSection | FaqSection | ContactSection

export type SectionType = SectionData['type']

export type Section = SectionData & { id: string; visible: boolean }

export interface HomeContent {
  version: number
  updatedAt: string
  updatedBy?: string
  sections: Section[]
}

// ---------- editor descriptors ----------
// Each section type lists its fields, so the admin can build its form
// without a hand-written screen per section.

export type Field =
  | { key: string; label: string; kind: 'text' | 'textarea'; hint?: string }
  | { key: string; label: string; kind: 'boolean'; hint?: string }
  | { key: string; label: string; kind: 'image'; hint?: string }
  | { key: string; label: string; kind: 'strings'; itemLabel: string; hint?: string }
  | { key: string; label: string; kind: 'list'; itemLabel: string; fields: Field[]; newItem: () => Record<string, unknown>; hint?: string }

export interface SectionMeta {
  name: string
  /** Hero stays first; it carries the 3D tower. */
  fixed?: boolean
  /** Some sections can't be hidden (the contact form is the point of the page). */
  required?: boolean
  fields: Field[]
}

const head: Field[] = [
  { key: 'eyebrow', label: 'Small label above the heading', kind: 'text' },
  { key: 'title', label: 'Heading', kind: 'text', hint: 'Put *asterisks* around a word or two to set them in copper italics.' },
]

export const SECTION_META: Record<SectionType, SectionMeta> = {
  hero: {
    name: 'Opening (hero)',
    fixed: true,
    required: true,
    fields: [
      ...head,
      { key: 'lede', label: 'Introduction', kind: 'textarea' },
      { key: 'primaryCta', label: 'Main button', kind: 'text' },
      { key: 'secondaryCta', label: 'Second button (opens the Finder)', kind: 'text' },
      { key: 'replyNote', label: 'Who replies, how and when', kind: 'textarea', hint: 'Only promise a reply time the team can keep.' },
    ],
  },
  proof: {
    name: 'Proof strip',
    fields: [
      { key: 'items', label: 'Facts', kind: 'list', itemLabel: 'Fact', fields: [{ key: 'title', label: 'Big text', kind: 'text' }, { key: 'text', label: 'Small text', kind: 'text' }], newItem: () => ({ title: '', text: '' }) },
      { key: 'places', label: 'Scrolling place names', kind: 'strings', itemLabel: 'Place' },
    ],
  },
  services: {
    name: 'Services',
    fields: [
      ...head,
      { key: 'lede', label: 'Introduction', kind: 'textarea' },
      {
        key: 'items', label: 'Services', kind: 'list', itemLabel: 'Service',
        fields: [
          { key: 'title', label: 'Name', kind: 'text' },
          { key: 'text', label: 'Description', kind: 'textarea' },
          { key: 'bullets', label: "What's included", kind: 'strings', itemLabel: 'Point' },
          { key: 'forWho', label: 'Who it is for', kind: 'text' },
          { key: 'cta', label: 'Button', kind: 'text' },
        ],
        newItem: () => ({ anchor: '', intent: 'home', title: 'New service', text: '', bullets: [], forWho: '', cta: 'Speak to an advisor' }),
      },
      { key: 'alsoNote', label: 'Other services line', kind: 'textarea', hint: 'Wrap words in **double asterisks** to make them bold.' },
    ],
  },
  finder: {
    name: 'Residence Finder teaser',
    fields: [...head, { key: 'lede', label: 'Introduction', kind: 'textarea' }, { key: 'areas', label: 'Areas', kind: 'strings', itemLabel: 'Area' }, { key: 'cta', label: 'Button', kind: 'text' }, { key: 'note', label: 'Small print', kind: 'text' }],
  },
  process: {
    name: 'Process',
    fields: [
      ...head,
      { key: 'lede', label: 'Introduction', kind: 'textarea' },
      { key: 'steps', label: 'Steps', kind: 'list', itemLabel: 'Step', fields: [{ key: 'time', label: 'When', kind: 'text' }, { key: 'title', label: 'Step', kind: 'text' }, { key: 'text', label: 'Description', kind: 'textarea' }], newItem: () => ({ time: '', title: 'New step', text: '' }) },
    ],
  },
  verify: {
    name: 'What we verify',
    fields: [
      ...head,
      { key: 'lede', label: 'Introduction', kind: 'textarea' },
      {
        key: 'tabs', label: 'Tabs', kind: 'list', itemLabel: 'Tab',
        fields: [
          { key: 'label', label: 'Tab name', kind: 'text' },
          { key: 'title', label: 'Full title', kind: 'text' },
          { key: 'checks', label: 'Checks', kind: 'list', itemLabel: 'Check', fields: [{ key: 'term', label: 'Check', kind: 'text' }, { key: 'text', label: 'Explanation', kind: 'textarea' }], newItem: () => ({ term: '', text: '' }) },
        ],
        newItem: () => ({ label: 'New', title: '', checks: [] }),
      },
    ],
  },
  discretion: {
    name: 'Discretion pledge',
    fields: [...head, { key: 'items', label: 'Pledges', kind: 'list', itemLabel: 'Pledge', fields: [{ key: 'title', label: 'Pledge', kind: 'text' }, { key: 'text', label: 'Explanation', kind: 'textarea' }], newItem: () => ({ title: '', text: '' }) }],
  },
  about: {
    name: 'About and team',
    fields: [
      ...head,
      { key: 'lede', label: 'Introduction', kind: 'textarea' },
      {
        key: 'people', label: 'Team', kind: 'list', itemLabel: 'Person',
        fields: [{ key: 'photo', label: 'Photo', kind: 'image', hint: 'Square, at least 400 × 400.' }, { key: 'name', label: 'Name', kind: 'text' }, { key: 'role', label: 'Role', kind: 'text' }, { key: 'bio', label: 'Short bio', kind: 'textarea' }],
        newItem: () => ({ name: 'New person', role: '', bio: '', photo: '' }),
      },
      { key: 'showOffice', label: 'Show the office address card', kind: 'boolean' },
    ],
  },
  voices: {
    name: 'Client voices',
    fields: [
      ...head,
      { key: 'quotes', label: 'Quotes', kind: 'list', itemLabel: 'Quote', fields: [{ key: 'text', label: 'Quote', kind: 'textarea' }, { key: 'by', label: 'Who said it', kind: 'text' }, { key: 'sample', label: 'Mark as sample (not a real client)', kind: 'boolean' }], newItem: () => ({ text: '', by: '', sample: false }), hint: 'Only publish real quotes with the client’s permission.' },
    ],
  },
  faq: {
    name: 'Questions (FAQ)',
    fields: [...head, { key: 'items', label: 'Questions', kind: 'list', itemLabel: 'Question', fields: [{ key: 'q', label: 'Question', kind: 'text' }, { key: 'a', label: 'Answer', kind: 'textarea' }], newItem: () => ({ q: '', a: '' }), hint: 'These also appear in Google results, so keep answers accurate.' }],
  },
  contact: {
    name: 'Contact form',
    required: true,
    fields: [...head, { key: 'lede', label: 'Introduction', kind: 'textarea' }, { key: 'replyPromise', label: 'Small print under the button', kind: 'textarea' }],
  },
}
