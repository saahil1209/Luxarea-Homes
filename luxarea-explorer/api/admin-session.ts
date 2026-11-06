// GET /api/admin-session  (Authorization: Bearer <token>)  ->  { email, name } or 401
import { sessionSecret, verifySession } from './_lib/auth'

export function GET(request: Request): Response {
  const secret = sessionSecret()
  if (!secret) return new Response('Admin sign-in is not set up yet', { status: 501 })
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const s = token ? verifySession(token, secret) : null
  return s ? Response.json({ email: s.email, name: s.name, expiresAt: s.exp }) : new Response('Signed out', { status: 401 })
}
