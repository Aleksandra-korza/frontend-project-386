/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // В режиме разработки запросы /api проксируются на backend (apps/backend).
    proxy: {
      '/api': 'http://127.0.0.1:4000',
    },
  },
  // Тесты страниц (Vitest): лёгкое DOM-окружение; относительные адреса — как в dev.
  test: {
    environment: 'happy-dom',
    environmentOptions: {
      happyDOM: { url: 'http://localhost:5173' },
    },
  },
})
