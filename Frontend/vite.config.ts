import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// PREDEPLOY_PROXY_TARGET (test-only): when set, the dev server proxies /graphql, /api, /uploads,
// /health to the backend so the browser sees ONE origin -- mirroring production (Traefik fronts
// frontend+backend on klubn.no). Unset for normal dev/build, so default behavior is unchanged.
const proxyTarget = process.env.PREDEPLOY_PROXY_TARGET
const sameOriginProxy = proxyTarget
  ? {
      '/graphql': { target: proxyTarget, changeOrigin: true, ws: true },
      '/api': { target: proxyTarget, changeOrigin: true },
      '/uploads': { target: proxyTarget, changeOrigin: true },
      '/health': { target: proxyTarget, changeOrigin: true },
    }
  : undefined

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 3000,
    strictPort: true,
    proxy: sameOriginProxy,
  },
  preview: {
    host: 'localhost',
    port: 3000,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-apollo': ['@apollo/client', 'graphql'],
'vendor-icons': ['lucide-react', '@heroicons/react'],
          'vendor-motion': ['framer-motion'],
        },
      },
    },
  },
})
