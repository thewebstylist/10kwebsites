import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// Relative base so the built folder works from any sub-path or static host.
export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
  build: {
    target: 'es2020',
    // three.js is ~550 kB minified (137 kB gzip) and lazy-loaded with the first scene.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Keep three.js in its own chunk: it is only fetched when the first
        // 3D scene approaches the viewport.
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/gsap')) return 'gsap';
        },
      },
    },
  },
});
