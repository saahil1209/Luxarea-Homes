// Bundles tests/*.test.ts with esbuild and runs them with Node's built-in test runner.
import { build } from 'esbuild'
import { readdirSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const out = 'test-build'
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
const files = readdirSync('tests').filter((f) => f.endsWith('.test.ts')).map((f) => `tests/${f}`)
await build({ entryPoints: files, bundle: true, platform: 'node', format: 'esm', target: 'node20', outdir: out, outExtension: { '.js': '.mjs' }, packages: 'external', logLevel: 'error', define: { 'import.meta.env': '{}' } })
const r = spawnSync(process.execPath, ['--test', ...readdirSync(out).map((f) => `${out}/${f}`)], { stdio: 'inherit' })
process.exit(r.status ?? 1)
