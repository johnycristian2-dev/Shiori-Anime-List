import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// base './' permite hospedar em qualquer subpasta (GitHub Pages, Vercel, Netlify)
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    // Torna o site instalável no celular (PWA) e guarda capas em cache
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Shiori 栞 — sua lista de animes',
        short_name: 'Shiori',
        description: 'Monte sua lista de animes por tops, temporadas, gêneros e recomendações.',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#0c0a1d',
        background_color: '#0c0a1d',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // versão nova assume na hora e apaga os arquivos velhos (evita tela travada depois de atualizar)
        navigateFallbackDenylist: [/\.zip$/, /^\/api\//],
        importScripts: ['push-sw.js'], // avisos de episódio novo
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/s4\.anilist\.co\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'anilist-imagens',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fontes' },
          },
        ],
      },
    }),
  ],
});
