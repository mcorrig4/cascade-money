import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
  plugins: [react()],
  worker: { format: 'es' },
  build: {
    target: 'es2023',
    rollupOptions: { output: { manualChunks: { globe: ['globe.gl', 'three'] } } },
  },
  server: { host: '127.0.0.1', strictPort: true },
  preview: { host: '127.0.0.1', strictPort: true },
});
