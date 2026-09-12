import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const modelVersions = Object.fromEntries(['apple-park', 'fifth-avenue'].map(id => {
  const file = new URL(`./public/models/${id}.glb`, import.meta.url);
  return [id, existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16) : 'missing'];
}));

export default defineConfig({
  base: '/',
  define: { __SITE_MODEL_VERSIONS__: JSON.stringify(modelVersions) },
  plugins: [react()],
  worker: { format: 'es' },
  build: {
    target: 'es2023',
    rollupOptions: { output: { manualChunks: { globe: ['globe.gl', 'three'] } } },
  },
  server: { host: '127.0.0.1', strictPort: true },
  preview: { host: '127.0.0.1', strictPort: true },
});
