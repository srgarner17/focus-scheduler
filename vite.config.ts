import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(() => ({
  // GitHub Pages serves this project at /focus-scheduler/, not the domain root.
  // Only the GitHub Pages workflow sets GITHUB_PAGES=true — every other build
  // target (Vercel, local dev, etc.) serves from the domain root instead.
  base: process.env.GITHUB_PAGES ? '/focus-scheduler/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // expose on the LAN so other devices (like an iPad) can reach it
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
}))
