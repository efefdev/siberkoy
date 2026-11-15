import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

// Yerel admin uygulaması: build çıktısı admin-app/dist'e yazılır ve başlatıcı (server/launcher.mjs) tarafından servis edilir.
export default defineConfig({
  root: here,
  base: '/',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(here, '../src') },
  },
  css: { postcss: path.resolve(here, 'postcss.config.cjs') },
  build: {
    outDir: path.resolve(here, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      onwarn(warning, warn) {
        // Ortak bileşenlerdeki Next.js 'use client' yönergeleri burada anlamsız; uyarıyı gizle.
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
    },
  },
  logLevel: 'warn',
});
