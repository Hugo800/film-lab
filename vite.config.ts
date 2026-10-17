import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Absolute base: Der Editor liegt unter /lab, seine Dateien müssen auch von dort (und /lab/) gefunden werden.
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Bewusst ohne autoUpdate: Das lädt die Seite neu und würde laufende Bearbeitungen verwerfen
      // (Fotos liegen nur im Speicher). Ohne Oberfläche greift die neue Version beim nächsten Start.
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // jpg: Beispielfotos der Startseite (public/beispiele), damit sie auch offline vollständig ist.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,wasm,webmanifest}'],
        // Ausnahme: die großen Editor-Fassungen (beispiele/gross, je bis ~2,5 MB) erst beim Öffnen im Editor laden.
        globIgnores: ['**/node_modules/**/*', 'beispiele/gross/**'],
        // Danach aus dem Cache, damit ein schon geöffnetes Beispielfoto auch offline in voller Größe kommt.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/beispiele/gross/'),
            handler: 'CacheFirst',
            options: { cacheName: 'beispiele-gross', expiration: { maxEntries: 8 } },
          },
        ],
        // libraw.wasm hat 1,4 MB, der Rest bleibt darunter.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
      manifest: {
        id: './',
        name: 'Film Lab',
        short_name: 'Film Lab',
        description: 'Filmlooks von Fujifilm, Leica, Kodak und Ricoh für deine Fotos – im Browser',
        lang: 'de',
        // App auf dem Homescreen: schlichte Upload-Seite statt Startseite.
        start_url: './app',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0b0b0c',
        theme_color: '#0b0b0c',
        icons: [
          { src: './favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: './icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: './maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // Bringen eigene Worker/WASM-Dateien mit, die der Vorbündler nicht findet.
    exclude: ['libraw-wasm', '@jsquash/jpeg'],
  },
  build: {
    target: 'es2022',
  },
});
