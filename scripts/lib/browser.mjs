// Headless Chrome für Browser-Tests (WSL ohne sudo). Der Wrapper ~/.local/bin/chrome-headless
// setzt LD_LIBRARY_PATH und SwiftShader (WebGL2 in Software, MAX_TEXTURE_SIZE 8192).
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

export const CHROME = process.env.CHROME_BIN ?? join(homedir(), '.local/bin/chrome-headless');

/**
 * Startet Chrome; `viewport` z. B. { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true }.
 * `log: false` schreibt die Konsole der Seite nicht mit.
 */
export async function launch({ viewport = { width: 1280, height: 800 }, log = true } = {}) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--ignore-gpu-blocklist', '--enable-webgl', '--disable-dev-shm-usage'],
    defaultViewport: viewport,
    protocolTimeout: 600_000,
  });
  const page = await browser.newPage();
  if (log) {
    page.on('console', (m) => console.log(`[browser:${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => console.log(`[browser:pageerror] ${e.message}`));
  }
  return { browser, page };
}

export const PORT = Number(process.env.TEST_PORT ?? 5190);

/** Vite-Dev-Server mit scripts/vite.test.config.mjs auf PORT (Prüfseiten unter /scripts/harness/, Fotos unter /testbilder/). */
export async function startDevServer() {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: new URL('../vite.test.config.mjs', import.meta.url).pathname,
    server: { port: PORT, strictPort: true },
    logLevel: 'warn',
  });
  await server.listen();
  return { url: `http://localhost:${PORT}`, close: () => server.close() };
}
