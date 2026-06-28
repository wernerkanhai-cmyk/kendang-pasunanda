import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  // Vitest: alleen unit-tests in src/ draaien; de Playwright-specs in e2e/ horen
  // bij `npm run test:e2e`, niet bij vitest.
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
  build: {
    rollupOptions: {
      output: {
        // Splits stabiele vendor-libs in eigen chunks (betere caching + kleinere
        // app-chunk). jsPDF/html2canvas worden NIET genoemd: die blijven async
        // (dynamische import() in utils/export.js) en mogen niet statisch worden.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor'
            if (id.includes('@supabase')) return 'supabase-vendor'
          }
        },
      },
    },
  },
})
