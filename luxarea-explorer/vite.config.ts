import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { BRAND } from './src/config'

// Lets static HTML use %BRAND.phoneDisplay% etc., so src/config.ts stays the one place to edit.
function brandTokens(): Plugin {
  return {
    name: 'luxarea-brand-tokens',
    transformIndexHtml: {
      // Run before Vite parses URLs in the HTML.
      order: 'pre',
      handler: (html) =>
        html.replace(/%BRAND\.(\w+)%/g, (m, key: string) => {
          const v = (BRAND as Record<string, string>)[key]
          if (v == null) throw new Error(`Unknown brand token ${m}`)
          return v
        }),
    },
  }
}

export default defineConfig({
  plugins: [react(), brandTokens()],
  server: { port: 5183 },
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        home: 'index.html',
        residences: 'residences.html',
        privacy: 'privacy.html',
        terms: 'terms.html',
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
})
