// Headless Chrome für Browser-Tests (WSL ohne sudo). Der Wrapper ~/.local/bin/chrome-headless
// setzt LD_LIBRARY_PATH und SwiftShader (WebGL2 in Software, MAX_TEXTURE_SIZE 8192).
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

export const CHROME = process.env.CHROME_BIN ?? join(homedir(), '.local/bin/chrome-headless');

/** Startet Chrome; `viewport` z. B. { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true }. */
export async function launch({ viewport = { width: 1280, height: 800 } } = {}) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--ignore-gpu-blocklist', '--enable-webgl', '--disable-dev-shm-usage'],
    defaultViewport: viewport,
    protocolTimeout: 600_000,
  });
  const page = await browser.newPage();
  page.on('console', (m) => console.log(`[browser:${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => console.log(`[browser:pageerror] ${e.message}`));
  return { browser, page };
}
