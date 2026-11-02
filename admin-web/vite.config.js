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
export default defineConfig(({ mode }) => ({
  root: projectRoot,
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 350,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('axios') || id.includes('jwt-decode')) {
              return 'vendor-utils';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'vendor-i18n';
            }
            if (id.includes('@react-google-maps')) {
              return 'vendor-maps';
            }
          }
        },
      },
    },
  },
}))
