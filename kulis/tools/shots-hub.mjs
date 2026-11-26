// Usage: node tools/shots-hub.mjs   -> dist/shots/hub-*.png, onboarding-*.png, playback-*.png
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const file = join(root, p); if (!file.startsWith(root)) throw 0;
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }); res.end(await readFile(file)); } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(4310, '127.0.0.1', r));
const base = 'http://127.0.0.1:4310/index.html';
const out = join(root, 'dist/shots'); await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const shot = (page, n) => page.screenshot({ path: join(out, n + '.png'), fullPage: false });
const full = (page, n) => page.screenshot({ path: join(out, n + '.png'), fullPage: true });

async function run(tag, vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: vp.width < 600 ? 2 : 1, locale: 'tr-TR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(tag + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(tag + ' console: ' + m.text()); });
  await page.goto(base + '#/hub', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('html.ready'); await page.waitForTimeout(1200);
  await shot(page, `onboarding-title-${tag}`);
  await page.click('text=Yeni Kariyer'); await page.waitForTimeout(600);
  await shot(page, `onboarding-setup-${tag}`);
  await full(page, `onboarding-setup-full-${tag}`);
  await page.click('text=Eski Futbolcu'); await page.waitForTimeout(300);
  await page.click('text=Kariyere Başla'); await page.waitForTimeout(900);
  await shot(page, `hub-start-${tag}`); await full(page, `hub-start-full-${tag}`);
  // pick objective, answer welcome card
  await page.click('text=Bu hedefi seç >> nth=1'); await page.waitForTimeout(400);
  await page.click('.hub-card .opt >> nth=0'); await page.waitForTimeout(700);
  await shot(page, `hub-result-${tag}`);
  await page.waitForTimeout(5000);
  // play months; answer must-cards with the first affordable option
  const st = (fn) => page.evaluate(async (src) => { const { store } = await import('/src/ui/store.js'); return (new Function('store', 'return (' + src + ')(store)'))(store); }, fn.toString());
  for (let i = 0; i < 9; i++) {
    for (let k = 0; k < 8; k++) { const must = await page.$('.hub-card--must:not(.is-result) .opt:not(.is-off)'); if (!must) break; await must.click(); await page.waitForTimeout(250); }
    await page.waitForTimeout(500);
    if (i === 2) { await full(page, `hub-mid-full-${tag}`); await shot(page, `hub-mid-${tag}`); }
    const btn = await page.$('.hub-adv .btn:not(.is-off)');
    if (!btn) { await shot(page, `hub-blocked-${tag}`); break; }
    await btn.click(); await page.waitForTimeout(900);
    if (await page.$('.sheet')) { if (i === 0) await shot(page, `hub-confirm-${tag}`); await page.click('.sheet__foot .btn'); await page.waitForTimeout(500); }
    if (!(await page.$('.playback'))) { // Son Gün (other agent's overlay): finish it quickly
      await shot(page, `deadline-${i}-${tag}`);
      await st((store) => { store.act('deadlineFinish'); store.ui.closeOverlay(); store.advance(); });
      await page.waitForTimeout(500);
    }
    if (i === 1 || i === 3 || i === 4) {
      await page.waitForTimeout(1200); await shot(page, `playback-a-${i}-${tag}`);
      await page.waitForTimeout(1800); await shot(page, `playback-b-${i}-${tag}`);
      await page.waitForTimeout(6500); await shot(page, `playback-end-${i}-${tag}`);
    } else { await page.click('text=Atla').catch(() => {}); await page.waitForTimeout(500); if (i === 2) await shot(page, `playback-skip-${i}-${tag}`); }
    if (!(await page.$('.playback-foot.is-on'))) { await shot(page, `pb-stuck-${i}-${tag}`); break; }
    await page.click('.playback-foot .btn'); await page.waitForTimeout(700);
    if (await page.$('.overlay')) { await shot(page, `overlay-${i}-${tag}`); break; }
  }
  await ctx.close();
}
await run('390', { width: 390, height: 844 });
await run('1280', { width: 1280, height: 800 });
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
await browser.close(); server.close();
