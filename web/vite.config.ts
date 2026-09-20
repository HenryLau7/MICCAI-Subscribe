/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // We author public/manifest.webmanifest by hand (single source of truth,
      // easy to unit-test as plain JSON) and link it ourselves in index.html.
      manifest: false,
      workbox: {
        // App-shell only: JS/CSS/HTML/fonts/icons. Ruling B — src/data/load.ts
        // already owns a hand-rolled stale-while-revalidate cache for
        // /data/program.min.json under the "miccai-program-v1" Cache Storage
        // bucket. A second writer (Workbox precache or runtimeCaching) to
        // that same file would double-cache a ~390 KB file and risk serving
        // a stale program after a data refresh. Do NOT add .json here and do
        // NOT add a runtimeCaching rule for program.min.json.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/data/**'],
      },
    }),
  ],
  build: { target: 'es2022' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
