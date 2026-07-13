import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/icon.svg', 'assets/icon-192.png', 'assets/icon-512.png'],
      manifest: {
        name: 'stock-temp.',
        short_name: 'stock-temp',
        description: '台股資金溫度、ETF 持股進出、法人籌碼與績效比較工具。',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#eef1f4',
        theme_color: '#eef1f4',
        icons: [
          {
            src: 'assets/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: 'assets/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'assets/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'market-flow-api',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 2 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/data/latest.json'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sector-latest-data',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 6 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
