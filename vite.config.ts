import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves this project at /focus-scheduler/, not the domain root
  base: command === 'build' ? '/focus-scheduler/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // expose on the LAN so other devices (like an iPad) can reach it
  },
}))
