// Usage: node tools/shots-agency.mjs   -> dist/shots/agency-*.png, season-*.png, ending-*.png (390 wide; agency also 1280)
// Boots a game, drives the engine through the store to mid/late-career states and screenshots the Agency screen and the SeasonEnd / Ending overlays.
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
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(root, p);
    if (!file.startsWith(root)) throw new Error('bad path');
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }); res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(4340, '127.0.0.1', r));
const base = 'http://127.0.0.1:4340/index.html';
const out = join(root, 'dist/shots'); await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const errors = [];
async function open(w, h, dsf = 2) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, locale: 'tr-TR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(base + '#/agency', { waitUntil: 'load' });
  await page.waitForSelector('html.ready', { timeout: 8000 }).catch(() => {});
  await page.evaluate(async () => {
    const { store } = await import('/src/ui/store.js');
    window.__k = { store, sel: await import('/src/engine/selectors.js') };
    await store.init();
  });
  return { ctx, page };
}

// in-page driver ------------------------------------------------------------------------------------------
const DRIVER = () => {
  const { store, sel } = window.__k;
  const D = {
    answer() {
      const S = store.S;
      for (let g = 0; g < 30; g++) {
        const card = S.inbox.find((c) => c.must) || S.inbox.find((c) => c.key && c.key.startsWith('tut_'));
        if (!card) break;
        const opts = card.options.filter((o) => (o.cost.cash || 0) <= S.agency.cash && (o.cost.energy || 0) <= S.agency.energy);
        const o = opts.find((x) => x.id === card.defaultOption) || opts[0] || card.options[0];
        const r = store.act('answerInbox', { inboxId: card.id, optionId: o.id });
        if (!r.ok) break;
      }
    },
    play() {
      const S = store.S;
      // spend energy: visits, then try the first negotiable interest at a fair price
      for (const c of sel.clientList(S)) if (S.agency.energy > 0) store.act('visitClient', { playerId: c.id });
      for (const i of sel.interestList(S).filter((x) => x.negotiable).slice(0, 2)) {
        if (S.agency.energy < 1) break;
        const r = store.act('openNegotiation', { interestId: i.id });
        if (!r.ok) continue;
        for (let k = 0; k < 6 && store.S.negotiation; k++) {
          const v = sel.negotiationView(store.S);
          const pr = store.act('negPropose', { package: { ...v.fair, clauses: { minutes: false, release: false } } });
          if (!pr.ok) { store.act('negWalkAway'); break; }
          if (pr.outcome === 'countered') { const a = store.act('negAcceptCounter'); if (!a.ok || !store.S.negotiation) break; }
          else if (pr.outcome === 'hesitates') store.act('negLeanOnClient');
        }
        if (store.S.negotiation) store.act('negWalkAway');
      }
    },
    month(opts = {}) {
      const S = store.S;
      if (opts.rich) S.agency.cash = Math.max(S.agency.cash, 500000);
      D.answer();
      if (!opts.idle) D.play();
      // objective + upgrades
      if (S.objectives.offered.length && !S.objectives.active) store.act('chooseObjective', { objectiveId: S.objectives.offered[1 % S.objectives.offered.length].id });
      let r = store.advance({ silent: true });
      if (r && r.phase === 'deadline') { store.act('deadlineFinish'); r = store.advance({ silent: true }); }
      return r;
    },
    // advance until a season end report arrives (or ending / failure); returns the last report
    toSeasonEnd(opts) {
      let r, guard = 0;
      while (guard++ < 40) {
        r = D.month(opts);
        if (!r || r.ok === false) { D.answer(); continue; }
        if (r.seasonEnd || r.ending) return r;
      }
      return r;
    },
    toMonth(n, opts) { while (store.S.time.month < n) D.month(opts); },
  };
  window.__D = D;
};

const shot = async (page, name) => { await page.waitForTimeout(450); await page.screenshot({ path: join(out, name + '.png'), fullPage: false }); };
const fullshot = async (page, name) => { await page.waitForTimeout(450); await page.screenshot({ path: join(out, name + '.png'), fullPage: true }); console.log('saved', name); };
const checks = (page) => page.evaluate(() => {
  const dw = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  const small = [...document.querySelectorAll('button,[role=tab]')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.height < 43.5) && !e.closest('.sheet__grab') && getComputedStyle(e).visibility !== 'hidden'; }).map((e) => (e.className || e.tagName).toString().slice(0, 30) + ' ' + Math.round(e.getBoundingClientRect().height));
  return { hscroll: dw, small: small.slice(0, 6) };
});
const newGame = (page, seed, extra = {}) => page.evaluate(async ({ seed, extra }) => {
  window.__k.store.newGame({ seed, agentName: 'Kerem Aksoy', agencyName: 'Aksoy Spor', archetype: 'mahalle', ...extra });
  window.__k.store.ui.closeOverlay(); window.__k.store.ui.closeAllSheets();
  location.hash = '#/agency';
}, { seed, extra });

// ---- 1. Agency screen after a season and a half --------------------------------------------------------
{
  const { ctx, page } = await open(390, 844);
  await newGame(page, 7);
  await page.evaluate(DRIVER);
  await page.evaluate(() => { window.__D.toSeasonEnd(); window.__D.toMonth(7); });
  await page.waitForTimeout(500);
  const tabs = ['race', 'office', 'cash', 'goal', 'news'], names = ['Sıralama', 'Ofis', 'Kasa', 'Hedef', 'Haberler'];
  for (let i = 0; i < tabs.length; i++) {
    await page.getByRole('tab', { name: names[i] }).click();
    await fullshot(page, 'agency-' + tabs[i] + '-390');
    console.log(tabs[i], JSON.stringify(await checks(page)));
  }
  // interactions: buy an upgrade, tap a bar
  await page.evaluate(() => { window.__k.store.S.agency.cash += 500000; window.__k.store.notify(); });
  await page.getByRole('tab', { name: 'Ofis' }).click();
  await page.getByRole('button', { name: /Yükselt/ }).last().click();
  await page.waitForTimeout(300);
  await fullshot(page, 'agency-office-bought-390');
  await page.getByRole('tab', { name: 'Kasa' }).click();
  await page.locator('.agency-chart__bar').nth(2).click({ force: true });
  await shot(page, 'agency-cash-pick-390');
  await ctx.close();
}
{
  const { ctx, page } = await open(1280, 900, 1);
  await newGame(page, 7);
  await page.evaluate(DRIVER);
  await page.evaluate(() => { window.__D.toSeasonEnd(); window.__D.toMonth(7); });
  for (const n of ['Sıralama', 'Ofis', 'Kasa', 'Hedef', 'Haberler']) { await page.getByRole('tab', { name: n }).click(); await fullshot(page, 'agency-' + n.toLowerCase().replace('ı', 'i').replace('ü', 'u') + '-1280'); }
  await ctx.close();
}

// ---- 2. SeasonEnd overlay ------------------------------------------------------------------------------
{
  const { ctx, page } = await open(390, 844);
  await newGame(page, 7);
  await page.evaluate(DRIVER);
  await page.evaluate(() => { const r = window.__D.toSeasonEnd(); window.__k.store.ui.openOverlay('SeasonEnd', { seasonEnd: r.seasonEnd, report: r }); });
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(out, `season-step${i}-390.png`) });
    const done = await page.evaluate(() => !document.querySelector('.season-wrap'));
    if (done) break;
    console.log('season step', i, JSON.stringify(await checks(page)));
    const next = page.locator('.season-next');
    if (!(await next.count())) break;
    const label = await next.first().innerText();
    if (/başla/i.test(label) || /Finale/i.test(label)) break;
    await next.first().click();
  }
  await ctx.close();
}

// ---- 3. Endings --------------------------------------------------------------------------------------
async function ending(tag, setup, w = 390, h = 844) {
  const { ctx, page } = await open(w, h);
  await newGame(page, tag === 'efsane' ? 11 : 5, { careerSeasons: 5 });
  await page.evaluate(DRIVER);
  await page.evaluate(setup);
  await page.evaluate(() => { const S = window.__k.store.S; if (S.ending) window.__k.store.ui.openOverlay('Ending', {}); });
  await page.waitForTimeout(3800);
  const kind = await page.evaluate(() => window.__k.store.S.ending && window.__k.store.S.ending.kind);
  console.log('ending', tag, '->', kind, JSON.stringify(await checks(page)));
  await page.evaluate(() => { const o = document.querySelector('.overlay'); if (o) o.scrollTo(0, 0); });
  await page.screenshot({ path: join(out, `ending-${tag}-top-${w}.png`) });
  // scroll through, revealing the epilogues, then capture the whole overlay
  for (let y = 0; y < 8; y++) { await page.evaluate((y) => { const o = document.querySelector('.overlay'); if (o) o.scrollTo(0, y * 700); }, y); await page.waitForTimeout(350); }
  await page.evaluate(() => { const o = document.querySelector('.overlay'); const el = o && o.firstElementChild; if (o) { o.style.height = 'auto'; o.style.position = 'absolute'; } window.scrollTo(0, 0); });
  await page.screenshot({ path: join(out, `ending-${tag}-full-${w}.png`), fullPage: true });
  await page.evaluate(() => { const o = document.querySelector('.overlay'); if (o) { o.style.position = ''; o.style.height = ''; } });
  await page.evaluate(() => { const o = document.querySelector('.overlay'); if (o) o.scrollTo(0, 99999); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, `ending-${tag}-bottom-${w}.png`) });
  await ctx.close();
}
await ending('career', () => { const D = window.__D; let r; for (let s = 0; s < 8 && !window.__k.store.S.ending; s++) r = D.toSeasonEnd({ rich: true }); });
await ending('iflas', () => { const D = window.__D, S = window.__k.store.S; D.month(); S.agency.cash = -900000; for (let i = 0; i < 6 && !S.ending; i++) { S.agency.cash = Math.min(S.agency.cash, -900000); D.month({ idle: true }); } });
await ending('yalniz', () => { const D = window.__D, S = window.__k.store.S; D.toSeasonEnd({ rich: true }); for (const c of window.__k.sel.clientList(S)) window.__k.store.act('releaseClient', { playerId: c.id }); D.toSeasonEnd({ idle: true }); });
await ending('career', () => { const D = window.__D; for (let s = 0; s < 8 && !window.__k.store.S.ending; s++) D.toSeasonEnd({ rich: true }); }, 1280, 900);

console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
await browser.close(); server.close();
