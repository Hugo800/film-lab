// Vite für die Engine-Prüfung: ohne HMR, damit Änderungen anderer Module die Testseite nicht neu laden.
import { defineConfig, mergeConfig } from 'vite';
import base from '../vite.config.ts';

export default mergeConfig(base, defineConfig({
  cacheDir: 'node_modules/.vite-engine-test', // eigener Vorbündel-Cache, stört die anderen Server nicht
  server: { hmr: false },
}));
