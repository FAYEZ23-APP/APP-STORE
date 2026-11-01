import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'

// Align process.cwd() with the resolved project root to avoid junction path mismatches in Vite/esbuild
const projectRoot = fileURLToPath(new URL('.', import.meta.url))
try {
  process.chdir(projectRoot)
} catch (_) {}

// https://vite.dev/config/
export default defineConfig({
  root: projectRoot,
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'axios'],
          icons: ['lucide-react'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
})
