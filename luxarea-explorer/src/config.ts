// Everything a non-developer at Luxarea might need to change lives here.
export const BRAND = {
  name: 'Luxarea Homes',
  phoneDisplay: '+91 77189 61447',
  // WhatsApp number in international format, digits only.
  whatsapp: '917718961447',
  email: 'homes@luxarea.in',
  office: 'Parinee Crescenzo, 1B, G Block, BKC, Mumbai 400051',
  website: 'https://www.luxarea.in',
  // TODO(Luxarea): MahaRERA agent registration number. Required on the site by law.
  reraAgent: 'A519000XXXXX',
}

// Sample data switch. Set to false once real listings replace the samples
// in src/data/listings.ts, and the "Sample listings" badge disappears.
export const USING_SAMPLE_DATA = true

// Demo-only invite codes for private (off-market) listings.
// In production these must be checked on a server, not shipped in the app.
export const DEMO_INVITE_CODES = ['LUX-PRIVATE']
