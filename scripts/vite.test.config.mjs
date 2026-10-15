// Vite für die Browser-Tests (Dev-Server): ohne HMR, damit Änderungen an Dateien die Testseite
// nicht mitten im Test neu laden. Die Prüfseiten werden beim Start mit durchsucht, damit keine
// Vorbündelung später nachläuft (die lädt sonst ebenfalls neu).
import { mergeConfig } from 'vite';
import base from '../vite.config.ts';

export default mergeConfig(base, {
  cacheDir: 'node_modules/.vite-test',
  server: { hmr: false },
  optimizeDeps: { entries: ['index.html', 'scripts/harness/*.html'] },
});
