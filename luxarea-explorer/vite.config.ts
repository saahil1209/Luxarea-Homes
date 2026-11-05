import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5183 },
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        home: 'index.html',
        residences: 'residences.html',
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
