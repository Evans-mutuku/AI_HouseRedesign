import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import process from 'node:process'

// The client never talks to Anthropic directly. It calls the Express backend,
// which we proxy in dev so the browser sees a single same-origin API.
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:5000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
    },
  },
})
