import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { BRAND } from './src/config'
import { renderJsonLd, renderMain } from './src/content/render'
import type { HomeContent } from './src/content/types'
import { withNewSections } from './src/content/upgrade'

function replaceBrand(html: string) {
  return html.replace(/%BRAND\.(\w+)%/g, (m, key: string) => {
    const v = (BRAND as Record<string, string>)[key]
    if (v == null) throw new Error(`Unknown brand token ${m}`)
    return v
  })
}

/**
 * Published home-page content. With Supabase configured, the build reads what
 * the team last published in /admin; otherwise it uses content/home.json.
 */
async function loadHomeContent(env: Record<string, string>): Promise<HomeContent> {
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/site_content?id=eq.home:published&select=content`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      const rows = (await res.json()) as { content: HomeContent | null }[]
      if (res.ok && rows[0]?.content) return withNewSections(rows[0].content, JSON.parse(readFileSync(new URL('./content/home.json', import.meta.url), 'utf-8')))
      console.warn('[luxarea] No published content in Supabase yet; using content/home.json')
    } catch (e) {
      console.warn('[luxarea] Could not read content from Supabase; using content/home.json', e)
    }
  }
  return JSON.parse(readFileSync(new URL('./content/home.json', import.meta.url), 'utf-8'))
}

function luxareaHtml(env: Record<string, string>): Plugin {
  return {
    name: 'luxarea-html',
    transformIndexHtml: {
      // Run before Vite parses URLs in the HTML.
      order: 'pre',
      async handler(html) {
        if (html.includes('<!--HOME_MAIN')) {
          const content = await loadHomeContent(env)
          html = html.replace('<main id="main">', `<main id="main" data-updated="${content.updatedAt}">`).replace(/<!--HOME_MAIN[^>]*-->/, renderMain(content)).replace('<!--HOME_JSONLD-->', renderJsonLd(content, BRAND.website))
        }
        return replaceBrand(html)
      },
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') } as Record<string, string>
  return {
    plugins: [react(), luxareaHtml(env)],
    server: { port: 5183 },
    build: {
      target: 'es2020',
      rollupOptions: {
        input: {
          home: 'index.html',
          residences: 'residences.html',
          privacy: 'privacy.html',
          terms: 'terms.html',
          admin: 'admin.html',
        },
        output: {
          // Keep heavy libraries in their own cacheable chunks.
          manualChunks: {
            three: ['three'],
            maplibre: ['maplibre-gl'],
            react: ['react', 'react-dom'],
          },
        },
      },
    },
  }
})
