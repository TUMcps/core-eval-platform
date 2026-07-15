import { defineConfig, type Plugin, type HtmlTagDescriptor } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Inject the active competition's branding into index.html at serve/build time so
// the first paint already has the correct title, favicon, and theme color — no flash
// of the neutral defaults before the runtime /api/competition/ fetch resolves. The
// backend is the single source of truth; on failure the client still fills it in.
function brandingInjector(): Plugin {
  const apiBase = process.env.VITE_API_URL || 'http://backend:8000'
  return {
    name: 'branding-injector',
    async transformIndexHtml(html) {
      let displayName = ''
      let branding: unknown = null
      try {
        const res = await fetch(`${apiBase}/api/competition/`)
        if (res.ok) {
          const data = (await res.json()) as any
          displayName = data.display_name || ''
          branding = data.presentation?.branding ?? null
        }
      } catch {
        return html // backend not reachable at this moment; client hydrates it
      }
      const b = branding as { favicon?: string } | null
      const out = displayName ? html.replace(/<title>.*?<\/title>/, `<title>${displayName}</title>`) : html
      const tags: HtmlTagDescriptor[] = []
      // Synchronous global read before the app module executes (avoids the theme flash).
      tags.push({ tag: 'script', injectTo: 'head-prepend', children: `window.__BRANDING__=${JSON.stringify({ display_name: displayName, branding })}` })
      if (b?.favicon) tags.push({ tag: 'link', injectTo: 'head', attrs: { rel: 'icon', href: b.favicon } })
      return { html: out, tags }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [brandingInjector(), react()],
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
