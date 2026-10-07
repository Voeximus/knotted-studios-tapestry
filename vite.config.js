import { defineConfig } from 'vite';

export default defineConfig({
  // Project Pages URL: https://voeximus.github.io/knotted-studios-tapestry/
  base: '/knotted-studios-tapestry/',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: false,
  },
});
