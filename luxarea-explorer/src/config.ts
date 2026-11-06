// Everything a non-developer at Luxarea might need to change lives here.
export const BRAND = {
  name: 'Luxarea Homes',
  phoneDisplay: '+91 77189 61447',
  // WhatsApp number in international format, digits only.
  whatsapp: '917718961447',
  email: 'homes@luxarea.in',
  office: 'Parinee Crescenzo, 1B, 1st Floor, G Block, Bandra Kurla Complex, Bandra East, Mumbai 400051',
  hours: 'Monday to Saturday, 9 am to 7 pm',
  website: 'https://www.luxarea.in',
  whatsappLink: 'https://wa.me/917718961447',
  phoneLink: 'tel:+917718961447',
  // MahaRERA agent registration number, confirmed by Luxarea on 5 Nov 2026. Required on the site by law.
  reraAgent: 'A51800039192',
}

// Sample data switch. Set to false once real listings replace the samples
// in src/data/listings.ts, and the "Sample listings" badge disappears.
export const USING_SAMPLE_DATA = true

// Demo-only invite codes for private (off-market) listings.
// In production these must be checked on a server, not shipped in the app.
export const DEMO_INVITE_CODES = ['LUX-PRIVATE']

// Where the home-page contact form saves leads: set VITE_LEAD_ENDPOINT=/api/lead
// in Vercel once Supabase is connected (leads then appear in admin → Leads).
// Empty: the form only opens WhatsApp with the enquiry prefilled.
// (import.meta.env is undefined when vite.config.ts loads this file in Node.)
export const LEAD_ENDPOINT: string = import.meta.env?.VITE_LEAD_ENDPOINT ?? ''
