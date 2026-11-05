import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vercel serves the app from the domain root; the SPA rewrite in
  // vercel.json keeps deep links working.
  base: '/',
  worker: {
    // `audioWorklet.addModule()` requires an ES module; the default iife
    // worker format cannot be loaded by a worklet.
    format: 'es',
  },
});
