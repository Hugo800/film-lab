// Produktionsbuild nur für den IO-Browsertest (Eintrag: Testseite statt index.html).
import { defineConfig, mergeConfig } from 'vite';
import base from '../vite.config.ts';

export default mergeConfig(base, defineConfig({
  root: new URL('..', import.meta.url).pathname,
  build: {
    outDir: 'test-output/io-build',
    emptyOutDir: true,
    rollupOptions: { input: 'scripts/harness/io-test.html' },
  },
}));
