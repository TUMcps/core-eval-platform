import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Listen on all network interfaces for Docker
    port: 5173,
    // Allow public dev tunnels (Cloudflare/ngrok) to reach the dev server for remote demos.
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io'],
    // Windows-host Docker bind mounts don't emit fs events into the container, so the
    // default watcher never sees edits (no HMR). Poll when VITE_USE_POLLING is set.
    watch: process.env.VITE_USE_POLLING ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://backend:8000',
        changeOrigin: true,
      },
      '/update': {
        target: process.env.VITE_API_URL || 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0', // Listen on all network interfaces for Docker
    port: 5173,
    allowedHosts: ['.ngrok-free.app', '.ngrok.io'], // Allow ngrok tunnels
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://backend:8000',
        changeOrigin: true,
      },
      '/update': {
        target: process.env.VITE_API_URL || 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',  // Build to dist folder (served by npm run preview)
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
