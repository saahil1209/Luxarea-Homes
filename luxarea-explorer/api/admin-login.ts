// POST /api/admin-login  { email, password }  ->  { token, email, name, expiresAt }
// Environment: ADMIN_EMAIL + ADMIN_PASSWORD_HASH (+ ADMIN_NAME), or ADMIN_ACCOUNTS
// for several people; ADMIN_SESSION_SECRET (32+ random characters).
// Make a hash with: npm run hash-password
import { adminAccounts, sessionSecret, signSession, verifyPassword } from './_lib/auth'

const HOURS = 12

export async function POST(request: Request): Promise<Response> {
  const secret = sessionSecret()
  const accounts = adminAccounts()
  if (!secret || !accounts.length) return new Response('Admin sign-in is not set up yet', { status: 501 })

  let email = ''
  let password = ''
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown }
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    password = typeof body.password === 'string' ? body.password : ''
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const account = accounts.find((a) => a.email === email)
  // Always run the hash check, so a wrong email takes as long as a wrong password.
  const ok = verifyPassword(password, account?.hash ?? accounts[0].hash) && !!account && password.length > 0
  if (!ok) {
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 400)) // slow down guessing
    return new Response('Email or password is incorrect', { status: 401 })
  }
  const expiresAt = Date.now() + HOURS * 3600_000
  const token = signSession({ email: account!.email, name: account!.name, exp: expiresAt }, secret)
  return Response.json({ token, email: account!.email, name: account!.name, expiresAt })
}
