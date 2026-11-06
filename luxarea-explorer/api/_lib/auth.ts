// Admin sign-in without a database: the password is checked on the server
// against a scrypt hash kept in an environment variable, and a signed,
// expiring session token is returned. The password itself is never stored
// anywhere, and nothing secret is ever sent to the browser bundle.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const b64u = (b: Buffer) => b.toString('base64url')
const fromB64u = (s: string) => Buffer.from(s, 'base64url')

/** Format: scrypt:N:r:p:salt:hash (base64url). Generate with `npm run hash-password`. */
export function hashPassword(password: string, salt = randomBytes(16)): string {
  const N = 16384, r = 8, p = 1
  const key = scryptSync(password.normalize('NFKC'), salt, 32, { N, r, p })
  return `scrypt:${N}:${r}:${p}:${b64u(salt)}:${b64u(key)}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.trim().split(':')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, N, r, p, salt, hash] = parts
  const expected = fromB64u(hash)
  const key = scryptSync(password.normalize('NFKC'), fromB64u(salt), expected.length, { N: Number(N), r: Number(r), p: Number(p) })
  return key.length === expected.length && timingSafeEqual(key, expected)
}

export interface Session {
  email: string
  name: string
  exp: number // unix ms
}

export function signSession(s: Session, secret: string): string {
  const body = b64u(Buffer.from(JSON.stringify(s)))
  return `${body}.${b64u(createHmac('sha256', secret).update(body).digest())}`
}

export function verifySession(token: string, secret: string, now = Date.now()): Session | null {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHmac('sha256', secret).update(body).digest()
  const given = fromB64u(sig)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const s = JSON.parse(fromB64u(body).toString()) as Session
    return typeof s.exp === 'number' && s.exp > now ? s : null
  } catch {
    return null
  }
}

/** Admin accounts from the environment. One per line in ADMIN_ACCOUNTS: email|name|hash, or the single-account trio. */
export function adminAccounts(env = process.env): { email: string; name: string; hash: string }[] {
  const list: { email: string; name: string; hash: string }[] = []
  for (const line of (env.ADMIN_ACCOUNTS ?? '').split(/\n|;/)) {
    const [email, name, hash] = line.split('|').map((x) => x?.trim())
    if (email && hash) list.push({ email: email.toLowerCase(), name: name || email, hash })
  }
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD_HASH) list.push({ email: env.ADMIN_EMAIL.trim().toLowerCase(), name: env.ADMIN_NAME?.trim() || env.ADMIN_EMAIL.trim(), hash: env.ADMIN_PASSWORD_HASH.trim() })
  return list
}

export function sessionSecret(env = process.env): string | null {
  const s = env.ADMIN_SESSION_SECRET
  return s && s.length >= 32 ? s : null
}
