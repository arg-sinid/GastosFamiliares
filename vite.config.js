import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const REPO_NAME = 'GastosFamiliares'

export default defineConfig({
  base: `/${REPO_NAME}/`,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Control Gastos Familiar',
        short_name: 'Gastos',
        description: 'Control de gastos del hogar — Germán & Julieta',
        theme_color: '#1C2530',
        background_color: '#F6F4F0',
        display: 'standalone',
        start_url: `/${REPO_NAME}/`,
        icons: [
          { src:'icon-192.png', sizes:'192x192', type:'image/png' },
          { src:'icon-512.png', sizes:'512x512', type:'image/png', purpose:'any maskable' },
          { src:'icon.svg',     sizes:'any',     type:'image/svg+xml' }
        ]
      }
    })
  ]
})
