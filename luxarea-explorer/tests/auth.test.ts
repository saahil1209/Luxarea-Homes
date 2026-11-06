import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, signSession, verifyPassword, verifySession } from '../api/_lib/auth'
import * as login from '../api/admin-login'
import * as session from '../api/admin-session'

test('password hashes verify only the right password', () => {
  const h = hashPassword('correct horse battery')
  assert.match(h, /^scrypt:16384:8:1:/)
  assert.equal(verifyPassword('correct horse battery', h), true)
  assert.equal(verifyPassword('correct horse batterY', h), false)
  assert.equal(verifyPassword('', h), false)
  assert.notEqual(hashPassword('same'), hashPassword('same'), 'salted: same password, different hash')
})

test('sessions are signed and expire', () => {
  const secret = 'x'.repeat(40)
  const t = signSession({ email: 'a@luxarea.in', name: 'A', exp: Date.now() + 1000 }, secret)
  assert.equal(verifySession(t, secret)?.email, 'a@luxarea.in')
  assert.equal(verifySession(t, 'y'.repeat(40)), null, 'wrong secret')
  const [body, sig] = t.split('.')
  const forged = Buffer.from(JSON.stringify({ email: 'a@luxarea.in', name: 'A', exp: Date.now() + 9e9 })).toString('base64url')
  assert.equal(verifySession(`${forged}.${sig}`, secret), null, 'tampered body')
  assert.equal(verifySession(`${body}.${sig}`, secret, Date.now() + 5000), null, 'expired')
})

test('admin login endpoint: locked until configured, then checks email and password', async () => {
  delete process.env.ADMIN_EMAIL
  delete process.env.ADMIN_ACCOUNTS
  const post = (b: unknown) => login.POST(new Request('https://x/api/admin-login', { method: 'POST', body: JSON.stringify(b) }))
  assert.equal((await post({ email: 'a@b.c', password: 'x' })).status, 501)

  process.env.ADMIN_EMAIL = 'Viivek@Luxarea.in'
  process.env.ADMIN_NAME = 'Viivek'
  process.env.ADMIN_PASSWORD_HASH = hashPassword('a long test passphrase')
  process.env.ADMIN_SESSION_SECRET = 's'.repeat(48)

  assert.equal((await post({ email: 'viivek@luxarea.in', password: 'wrong' })).status, 401)
  assert.equal((await post({ email: 'someone@else.com', password: 'a long test passphrase' })).status, 401)
  const ok = await post({ email: 'viivek@luxarea.in', password: 'a long test passphrase' })
  assert.equal(ok.status, 200)
  const { token, name } = (await ok.json()) as { token: string; name: string }
  assert.equal(name, 'Viivek')

  const check = (t: string) => session.GET(new Request('https://x/api/admin-session', { headers: { authorization: `Bearer ${t}` } }))
  assert.equal(check(token).status, 200)
  assert.equal(check(token.slice(0, -2) + 'xx').status, 401)
})
