import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // O frontend chama /api e o Vite repassa ao Laravel, sem problema de CORS no desenvolvimento.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
