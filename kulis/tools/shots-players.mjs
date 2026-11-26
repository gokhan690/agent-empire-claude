// Usage: node tools/shots-players.mjs  -> dist/shots/pl-*.png  (Players, Scout, PlayerSheet, Recruit, ClubSheet)
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
    const file = join(root, p); if (!file.startsWith(root)) throw 0; const buf = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }); res.end(buf); } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(4320, '127.0.0.1', r));
const out = join(root, 'dist/shots'); await mkdir(out, { recursive: true });
const wide = process.argv.includes('--wide');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: wide ? { width: 1280, height: 900 } : { width: 390, height: 844 }, deviceScaleFactor: wide ? 1 : 2, locale: 'tr-TR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
const tag = wide ? 'w' : 'm';
const shot = async (n, full = false) => { await page.waitForTimeout(450); await page.screenshot({ path: join(out, `pl-${tag}-${n}.png`), fullPage: full }); console.log('shot', n); };
const click = async (sel, opt = {}) => { await page.locator(sel).first().click({ timeout: 4000, ...opt }); };
const scrollSheet = (y) => page.evaluate((y) => { const b = document.querySelector('.sheet__body'); if (b) b.scrollTop = y; }, y);
const hscroll = async (l) => console.log('hscroll', l, await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
const small = async (l) => console.log('small targets', l, await page.evaluate(() => [...document.querySelectorAll('button,a[href],[role=tab],[role=button]')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.height < 43 || b.width < 43) && !e.closest('.sheet__grab') && !e.closest('.topbar') && getComputedStyle(e).visibility !== 'hidden'; }).map((e) => (e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)).slice(0, 8)));

await page.goto('http://127.0.0.1:4320/index.html#/hub', { waitUntil: 'load' });
await page.waitForSelector('html.ready', { timeout: 8000 }).catch(() => {});
await page.evaluate(async () => {
  const m = await import('/src/ui/store.js');
  await m.store.init();
  m.store.newGame({ seed: 11, agentName: 'Ajan', agencyName: 'Kulis', archetype: 'mahalle' });
  const S = m.store.S; S.agency.rep = 45; S.agency.cash = 400000;
  for (let i = 0; i < 4; i++) { S.inbox.forEach((c) => { c.must = false; }); S.inbox.length = 0; const r = m.store.advance({ silent: true }); if (r && r.phase === 'deadline') { m.store.act('deadlineFinish'); m.store.advance({ silent: true }); } }
  S.agency.energy = S.agency.energyMax;
  m.store.ui.closeOverlay(); m.store.ui.closeAllSheets(); window.__m = m;
});
await page.evaluate(() => { location.hash = '#/players'; });
await page.waitForTimeout(600);
await shot('players', true); await hscroll('players'); await small('players');

// player sheet (client)
await click('.players-card');
await page.waitForSelector('.psheet');
await shot('sheet-client-0');
for (const [i, y] of [[1, 600], [2, 1200], [3, 1800]]) { await scrollSheet(y); await shot('sheet-client-' + i); }
await scrollSheet(0);
await small('sheet');
// visit
await click('.psheet-acts .btn:has-text("Ziyaret")');
await page.waitForTimeout(500);
await shot('sheet-visit');
// pitch picker
await click('.psheet-acts .btn:has-text("Kulübe öner")');
await page.waitForSelector('.pitch-row');
await page.waitForTimeout(500);
await shot('pitch');
await click('.pitch-row:not(.is-off)');
await shot('pitch-sel');
await click('.sheet__foot .btn:has-text("Öner")');
await page.waitForTimeout(600);
await shot('after-pitch');
await page.keyboard.press('Escape'); await page.waitForTimeout(400);

// scout
await page.evaluate(() => { location.hash = '#/scout'; });
await page.waitForTimeout(600);
await shot('scout-trip', true); await hscroll('scout'); await small('scout');
await click('.scout-focus__o:nth-child(1)');
await click('.scout-lg:nth-child(2)');
await page.waitForTimeout(300);
await shot('scout-trip-sel', true);
await click('.scout-cta .btn');
await page.waitForTimeout(600); await shot('scout-reveal-0');
await page.waitForTimeout(3400); await shot('scout-reveal-1');
await click('.tabs__tab:has-text("Radarım")');
await page.waitForTimeout(400);
await shot('radar-empty');
await click('.chip:has-text("Tümü")');
await page.waitForTimeout(500);
await shot('radar-all', true);
// shortlist 2
await page.locator('.scout-star').nth(0).click(); await page.locator('.scout-star').nth(1).click();
await page.waitForTimeout(300);
await click('.chip:has-text("Takip listesi")');
await shot('radar-short');
await hscroll('radar'); await small('radar');

// prospect sheet + recruit
await click('.chip:has-text("Tümü")'); await click('.scout-sort:has-text("İmzaya yakın")'); await page.waitForTimeout(300);
await click('.scout-row');
await page.waitForSelector('.psheet');
await shot('sheet-prospect-0');
await scrollSheet(700); await shot('sheet-prospect-1');
await scrollSheet(0);
await click('.psheet-act--main .btn');
await page.waitForSelector('.recruit-gauge');
await page.waitForTimeout(400);
await shot('recruit-0');
await scrollSheet(500); await shot('recruit-1');
await page.locator('.recruit-prom').nth(3).click(); await page.locator('.recruit-prom').nth(4).click(); await page.locator('.recruit-prom').nth(2).click();
await page.waitForTimeout(500);
await scrollSheet(500); await shot('recruit-2');
await scrollSheet(0); await shot('recruit-3');
await small('recruit');
await page.evaluate(() => { window.__m.store.S.agency.rep = 400; window.__m.store.notify(); });
await page.waitForTimeout(500); await shot('recruit-ok');
await click('.recruit-foot .btn:has-text("İmzala")');
await page.waitForTimeout(900);
await shot('signed');
await click('.recruit-done .btn');
await page.waitForTimeout(600);
await shot('signed-sheet');
await page.keyboard.press('Escape'); await page.waitForTimeout(400);

// club sheet
await page.evaluate(() => { const m = window.__m; const S = m.store.S; const id = Object.values(S.players).find((p) => p.agentId === 'you').clubId; m.store.ui.openSheet('ClubSheet', { clubId: id }); });
await page.waitForSelector('.club');
await shot('club-0'); await scrollSheet(600); await shot('club-1'); await scrollSheet(1200); await shot('club-2'); await scrollSheet(0);
await small('club');
await click('.club-dir .btn');
await page.waitForTimeout(700); await shot('club-lunch'); await scrollSheet(300); await shot('club-lunch2');
await page.keyboard.press('Escape'); await page.waitForTimeout(400);

await page.evaluate(() => { location.hash = '#/players'; });
await page.waitForTimeout(500); await shot('players-after', true);
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
await browser.close(); server.close();
