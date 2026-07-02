import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// The app lives in web/; the framework-free solver core stays in src/ and is
// imported through the `@core` alias (same code the Web Worker runs).
export default defineConfig({
  root: 'web',
  // Served at root locally and on a custom domain; under /<repo>/ on GitHub
  // Pages project sites. The deploy workflow sets VITE_BASE accordingly.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('./dist-web', import.meta.url)),
    emptyOutDir: true,
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
