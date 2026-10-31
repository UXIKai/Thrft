import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/checkout': {
        target: 'http://127.0.0.1:8790',
        changeOrigin: true,
      },
      '/api/webhooks': {
        target: 'http://127.0.0.1:8790',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
    proxy: {
      '/api/checkout': {
        target: 'http://127.0.0.1:8790',
        changeOrigin: true,
      },
      '/api/webhooks': {
        target: 'http://127.0.0.1:8790',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
