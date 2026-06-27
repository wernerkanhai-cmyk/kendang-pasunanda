import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
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
