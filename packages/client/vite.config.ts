import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: r('.'),
  plugins: [react()],
  resolve: {
    // Only the client-safe entry is aliased. `@gla/shared/server` (which holds
    // the hidden scores) is deliberately NOT resolvable from the browser.
    alias: { '@gla/shared': r('../shared/src/index.ts') },
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
      '/healthz': 'http://localhost:3000',
    },
  },
  build: {
    outDir: r('./dist'),
    emptyOutDir: true,
  },
});
