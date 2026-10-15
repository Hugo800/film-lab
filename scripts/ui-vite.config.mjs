// Dev-Server für UI-Browsertests: ohne HMR (kein WebSocket), damit parallele Änderungen
// in anderen Ordnern die Seite nicht mitten im Test neu laden.
// UI_MOCK_ENGINE=1 ersetzt src/engine durch scripts/harness/ui-mock-engine.ts.
import { resolve } from 'node:path';
import { mergeConfig } from 'vite';
import base from '../vite.config.ts';

const mock = process.env.UI_MOCK_ENGINE === '1';

export default mergeConfig(base, {
  server: { hmr: false },
  plugins: mock
    ? [
        {
          name: 'ui-mock-engine',
          enforce: 'pre',
          resolveId(source, importer) {
            if (!importer || !/src\/ui\//.test(importer)) return null;
            if (/\/engine$|\/engine\/index(\.ts)?$/.test(source)) return resolve('scripts/harness/ui-mock-engine.ts');
            return null;
          },
        },
      ]
    : [],
});
