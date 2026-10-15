import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Relative base -> funktioniert unter jedem Unterpfad ohne Rebuild.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
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
