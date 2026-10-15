// Produktions-Build der RAW-Testseite (nicht nach dist) und derselbe Browser-Test dagegen:
//   node scripts/raw-build-test.mjs      (Dev-Server auf Port 5182 vorher beenden)
import { spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { build, preview } from 'vite';

const outDir = 'test-output/raw-build';
await build({
  logLevel: 'warn',
  build: { outDir, emptyOutDir: true, rollupOptions: { input: 'scripts/harness/raw-decode.html' } },
});
for (const f of readdirSync(`${outDir}/assets`)) console.log('asset', f);

// Die Test-RAW liegt (gitignored) neben dem Build, damit der Preview-Server sie ausliefert.
mkdirSync(`${outDir}/testbilder/raw`, { recursive: true });
copyFileSync('testbilder/raw/DSC01542.ARW', `${outDir}/testbilder/raw/DSC01542.ARW`);

const server = await preview({ build: { outDir }, preview: { port: 5182, strictPort: true } });
// Asynchron starten: spawnSync würde den Preview-Server im selben Prozess blockieren.
const code = await new Promise((res) => spawn('node', ['scripts/raw-test.mjs', 'http://localhost:5182'], { stdio: 'inherit' }).on('exit', res));
await new Promise((res) => server.httpServer.close(res));
process.exit(code ?? 1);
