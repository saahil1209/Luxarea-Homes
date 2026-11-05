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
  // TODO(Luxarea): MahaRERA agent registration number for Luxarea Homes Pvt Ltd. Required on the site by law.
  // The old Terms page quotes A51800039192, but for "Sai Realtors", so it is not used until Luxarea confirms it.
  reraAgent: 'to be added',
}

// Sample data switch. Set to false once real listings replace the samples
// in src/data/listings.ts, and the "Sample listings" badge disappears.
export const USING_SAMPLE_DATA = true

// Demo-only invite codes for private (off-market) listings.
// In production these must be checked on a server, not shipped in the app.
export const DEMO_INVITE_CODES = ['LUX-PRIVATE']

// Where the home-page contact form sends leads. Leave empty to fall back to
// opening WhatsApp with the enquiry prefilled. Set to a CRM or form endpoint
// (it receives a JSON POST) once Luxarea has one.
export const LEAD_ENDPOINT = ''
