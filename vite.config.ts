import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Site estático: build gera a pasta dist/ para enviar ao servidor.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_BASE_PATH || '/'

  return {
    plugins: [react()],
    base,
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
    },
    preview: {
      host: '127.0.0.1',
      port: 4199,
      strictPort: true,
      open: true,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5199,
      strictPort: false,
      open: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
    },
  }
})
