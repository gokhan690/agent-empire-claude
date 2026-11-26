// Usage: node tools/shots.mjs gallery hub [--dist]   -> dist/shots/<route>-390.png, <route>-1280.png
// Starts a static server for kulis/, opens #/<route> at 390x844@2x and 1280x800, saves full-page PNGs.
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const routes = args.filter((a) => !a.startsWith('--'));
if (!routes.length) routes.push('gallery');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(root, p);
    if (!file.startsWith(root)) throw new Error('bad path');
    const buf = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }); res.end(buf);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const out = join(root, 'dist/shots');
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const sizes = [{ tag: '390', width: 390, height: 844, dsf: 2 }, { tag: '1280', width: 1280, height: 800, dsf: 1 }];
for (const s of sizes) {
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.dsf, locale: 'tr-TR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  for (const r of routes) {
    await page.goto(`${base}#/${r}`, { waitUntil: 'load' });
    await page.waitForSelector('html.ready', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(700);
    const hscroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const small = await page.evaluate(() => [...document.querySelectorAll('button,a[href],[role=tab]')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.height < 43.5 || b.width < 43.5) && !e.closest('.sheet__grab'); }).map((e) => (e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)).slice(0, 8));
    await page.screenshot({ path: join(out, `${r}-${s.tag}.png`), fullPage: true });
    console.log(`${r}-${s.tag}.png  hscroll=${hscroll}px  small-targets=${small.length ? small.join(' | ') : 'none'}`);
  }
  if (errors.length) console.log('PAGE ERRORS:', [...new Set(errors)].join('\n'));
  await ctx.close();
}
await browser.close(); server.close();
