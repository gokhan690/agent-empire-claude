// Shared helpers for tools/e2e.mjs: static server for dist/, browser/page factory with error collection, small DOM helpers.
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const shotDir = join(root, 'dist/shots');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function serve(port = 0) {
  const server = http.createServer(async (req, res) => {
    try {
      const p = new URL(req.url, 'http://x').pathname;
      if (p === '/' || p === '/kulis.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(await readFile(join(root, 'dist/kulis.html'))); return; }
      res.writeHead(404); res.end('nf');
    } catch { res.writeHead(500); res.end('err'); }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

export async function launch() { await mkdir(shotDir, { recursive: true }); return chromium.launch(); }

/** New context+page with error collection. Returns {ctx,page,errors,shot,open}. */
export async function newPage(browser, base, { width = 390, height = 844, dsf = 1, save } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, locale: 'tr-TR' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  if (save) await ctx.addInitScript((s) => { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem('kulis-save-v2', s); sessionStorage.setItem('__seeded', '1'); } }, save);
  const open = async () => { await page.goto(base, { waitUntil: 'load' }); await page.waitForSelector('html.ready', { timeout: 10000 }); await sleep(500); };
  const shot = async (name, full = false) => { await sleep(350); await page.screenshot({ path: join(shotDir, `e2e-${name}.png`), fullPage: full }); };
  return { ctx, page, errors, shot, open };
}

/** Texts of visible buttons (for debugging/driving). */
export const buttons = (page) => page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null || getComputedStyle(b).position === 'fixed').map((b) => (b.innerText || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
