// Makes the value for ADMIN_PASSWORD_HASH. The password is read from the
// terminal (not typed on the command line, so it doesn't land in shell history).
// Usage: npm run hash-password
import { randomBytes, scryptSync } from 'node:crypto'
import { createInterface } from 'node:readline'

const rl = createInterface({ input: process.stdin, output: process.stderr })
rl.question('Password to hash: ', (password) => {
  rl.close()
  if (password.length < 10) console.error('Tip: use at least 10 characters, ideally a passphrase.')
  const N = 16384, r = 8, p = 1
  const salt = randomBytes(16)
  const key = scryptSync(password.normalize('NFKC'), salt, 32, { N, r, p })
  console.log(`scrypt:${N}:${r}:${p}:${salt.toString('base64url')}:${key.toString('base64url')}`)
})
