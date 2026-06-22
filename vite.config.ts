import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

/** Serves /api/flights during `npm run dev`, mirroring the Vercel function, so
 *  live flights work locally. Loads OPENSKY_* from .env.local into process.env
 *  (they're unprefixed, so Vite never exposes them to the client bundle). */
function flightsDevApi(mode: string): Plugin {
  return {
    name: 'flights-dev-api',
    apply: 'serve',
    configResolved() {
      const env = loadEnv(mode, process.cwd(), '')
      for (const key of ['OPENSKY_CLIENT_ID', 'OPENSKY_CLIENT_SECRET']) {
        if (env[key]) process.env[key] = env[key]
      }
    },
    configureServer(server) {
      server.middlewares.use('/api/flights', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/api/_opensky.ts')
          const getFlights = mod.getFlights as (
            bbox?: unknown,
          ) => Promise<{ status: number; body: unknown; retryAfter?: number }>
          const bboxFromQuery = mod.bboxFromQuery as (url: string) => unknown
          const result = await getFlights(bboxFromQuery(req.url ?? ''))
          if (result.retryAfter) {
            res.setHeader('Retry-After', String(result.retryAfter))
          }
          res.setHeader('Content-Type', 'application/json')
          res.statusCode = result.status
          res.end(JSON.stringify(result.body))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: (err as Error).message }))
        }
      })

      server.middlewares.use('/api/route', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/api/_adsbdb.ts')
          const getRoute = mod.getRoute as (cs: string) => Promise<unknown>
          const params = new URLSearchParams((req.url ?? '').split('?')[1] ?? '')
          const result = await getRoute(params.get('callsign') ?? '')
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ found: false, error: (err as Error).message }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    flightsDevApi(mode),
    VitePWA({
      registerType: 'autoUpdate',
      // The terminator/globe work offline once the shell + 4K maps are cached;
      // only flights need network. The 8K maps are runtime-cached, not precached.
      includeAssets: [
        'icons/icon.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/apple-touch-icon.png',
        'textures/earth-day.jpg',
        'textures/earth-night.jpg',
        'textures/night-sky.png',
      ],
      manifest: {
        name: 'Right Now on Earth',
        short_name: 'Right Now',
        description:
          'A live globe of planetary phenomena — the day/night terminator, city lights, and every aircraft in the air.',
        start_url: '/',
        display: 'standalone',
        background_color: '#070A12',
        theme_color: '#070A12',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/textures/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'earth-textures',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Never serve stale live data offline — fail and degrade gracefully.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
  resolve: {
    // Force single instances. three: so post-processing (EffectComposer /
    // UnrealBloomPass) works. react: so Vite's pre-bundling can't split React
    // in two and trip "Invalid hook call".
    dedupe: ['three', 'react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: [
      'three',
      'globe.gl',
      'react',
      'react-dom',
      'react/jsx-runtime',
      'framer-motion',
      'lucide-react',
      'zustand',
    ],
  },
}))
