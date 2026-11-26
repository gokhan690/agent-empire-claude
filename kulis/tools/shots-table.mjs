// Usage: node tools/shots-table.mjs [scenario ...]   (scenarios: market table bluff hesitate ceremony left deadline)
// Boots KULİS headlessly, drives the engine through the store and the Masa through real DOM clicks, saves screenshots to dist/shots/table-*.png
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const want = process.argv.slice(2);
const run = (s) => !want.length || want.includes(s);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(root, p);
    if (!file.startsWith(root)) throw new Error('bad');
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }); res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(4330, '127.0.0.1', r));
const base = 'http://127.0.0.1:4330/index.html';
const out = join(root, 'dist/shots');
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fresh(seed, size = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2, locale: 'tr-TR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[seed ${seed}] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(`[seed ${seed}] ${m.text()}`); });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForSelector('html.ready', { timeout: 8000 });
  return { ctx, page };
}
const E = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name, { tall = 0, full = false } = {}) => {
  const path = join(out, `table-${name}.png`);
  if (tall) {
    const vp = page.viewportSize();
    await page.setViewportSize({ width: vp.width, height: tall });
    await sleep(250);
    await page.screenshot({ path });
    await page.setViewportSize(vp);
    await sleep(200);
  } else await page.screenshot({ path, fullPage: full });
  console.log('saved', name);
};

/** new game + tutorial up to the guaranteed suitor. Returns the interest id. */
async function setup(page, seed) {
  return E(page, async (seed) => {
    const { store } = await import('/src/ui/store.js');
    const sel = await import('/src/engine/selectors.js');
    store.newGame({ seed, agentName: 'Gökhan Aydın', agencyName: 'Kulis Menajerlik' });
    store.ui.closeOverlay();
    const S = store.S;
    const c = S.inbox.find((x) => x.key === 'tut_welcome');
    store.act('answerInbox', { inboxId: c.id, optionId: c.options[0].id });
    const cl = sel.clientList(S);
    store.act('visitClient', { playerId: cl[0].id });
    store.act('scoutTrip', { leagueId: 'tr2', focus: 'any' });
    const cv = sel.clientView(S, cl[0].id);
    store.act('clubLunch', { clubId: sel.clubList(S, cv.league.id)[3].id });
    const it = sel.interestList(S).find((i) => i.negotiable);
    return it ? it.id : null;
  }, seed);
}
const openTable = (page, id) => E(page, async (id) => {
  const { store } = await import('/src/ui/store.js');
  const r = store.act('openNegotiation', { interestId: id });
  if (r.ok) store.ui.openOverlay('Negotiation', {});
  return r.ok;
}, id);
/** set a range input by its aria-label prefix */
const slide = (page, label, value) => page.evaluate(([label, value]) => {
  const el = [...document.querySelectorAll('.tslider__track input')].find((i) => i.getAttribute('aria-label').startsWith(label));
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(el, String(value)); el.dispatchEvent(new Event('input', { bubbles: true }));
}, [label, value]);
const sliderRange = (page, label) => page.evaluate((label) => { const el = [...document.querySelectorAll('.tslider__track input')].find((i) => i.getAttribute('aria-label').startsWith(label)); return { min: +el.min, max: +el.max, step: +el.step, v: +el.value }; }, label);
const click = async (page, sel_) => { await page.locator(sel_).first().click(); };
const clickText = async (page, text) => { await page.getByRole('button', { name: text }).first().click(); };

// ---------------------------------------------------------------- scenarios
if (run('market')) {
  const { ctx, page } = await fresh(1);
  await E(page, async () => { const { store } = await import('/src/ui/store.js'); store.newGame({ seed: 11, agentName: 'Gökhan', agencyName: 'Kulis' }); store.ui.closeOverlay(); location.hash = '#/market'; });
  await sleep(500); await shot(page, 'market-empty', { full: true });
  const id = await setup(page, 11);
  await E(page, () => { location.hash = '#/market'; });
  await sleep(500); await shot(page, 'market-offers', { full: true });
  await page.getByRole('tab', { name: 'Kulüpler' }).click(); await sleep(400); await shot(page, 'market-clubs', { full: true });
  await page.getByRole('tab', { name: 'Puan durumu' }).click(); await sleep(400); await shot(page, 'market-table', { full: true });
  await ctx.close();
}

if (run('table')) {
  const { ctx, page } = await fresh(2);
  const id = await setup(page, 11);
  await openTable(page, id);
  await sleep(1800);
  await shot(page, 'masa-open');
  await shot(page, 'masa-open-full', { tall: 2300 });
  await click(page, '.ttip__ok'); await sleep(300);
  // pick a koz
  await page.locator('.tkoz:not(:disabled)').first().click(); await sleep(300);
  await page.locator('.tkoz.is-on').scrollIntoViewIfNeeded(); await sleep(200);
  await shot(page, 'masa-koz-selected');
  await page.locator('.tkoz.is-on').click(); await sleep(200);
  // overshoot the ceiling: high wage + high fee -> insult / angry / stand
  const w = await sliderRange(page, 'Oyuncu maaşı');
  await slide(page, 'Oyuncu maaşı', Math.round((w.min + (w.max - w.min) * 0.55) / w.step) * w.step);
  const f = await sliderRange(page, 'SENİN');
  await slide(page, 'SENİN', Math.round((f.min + (f.max - f.min) * 0.5) / f.step) * f.step);
  await sleep(400);
  await shot(page, 'masa-overshoot-preview', { tall: 2300 });
  await page.evaluate(() => document.querySelector('.overlay').scrollTo(0, 0));
  await click(page, '.table__go'); await sleep(450);
  await shot(page, 'masa-insult-stamp');
  await sleep(2600);
  await shot(page, 'masa-after-insult');
  await shot(page, 'masa-after-insult-full', { tall: 2500 });
  // a closer offer: fair-ish
  await slide(page, 'Oyuncu maaşı', Math.round((w.min + (w.max - w.min) * 0.22) / w.step) * w.step);
  await slide(page, 'SENİN', Math.round((f.min + (f.max - f.min) * 0.12) / f.step) * f.step);
  await sleep(400);
  await click(page, '.table__go'); await sleep(2200);
  await shot(page, 'masa-round2');
  await shot(page, 'masa-round2-full', { tall: 2600 });
  await ctx.close();
}

if (run('bluff')) {
  let found = false;
  for (let seed = 1; seed <= 40 && !found; seed++) {
    const { ctx, page } = await fresh(seed);
    const id = await setup(page, seed);
    if (!id || !(await openTable(page, id))) { await ctx.close(); continue; }
    await sleep(900);
    const bl = page.locator('.tkoz.is-bluff');
    if (!(await bl.count())) { await ctx.close(); continue; }
    await bl.first().click();
    const w = await sliderRange(page, 'Oyuncu maaşı');
    await slide(page, 'Oyuncu maaşı', Math.round((w.min + (w.max - w.min) * 0.3) / w.step) * w.step);
    await sleep(300);
    await click(page, '.table__go'); await sleep(500);
    const caught = await page.locator('.tstamp.is-danger b', { hasText: 'BLÖF' }).count();
    if (caught) { await shot(page, 'masa-bluff-caught'); await sleep(3000); await shot(page, 'masa-bluff-after'); found = true; console.log('bluff caught at seed', seed); }
    await ctx.close();
  }
  if (!found) console.log('no bluff caught in 40 seeds');
}

if (run('hesitate') || run('ceremony')) {
  let done = false;
  for (let seed = 11; seed <= 11 && !done; seed++) {
    const { ctx, page } = await fresh(seed);
    const id = await setup(page, seed);
    await openTable(page, id);
    await sleep(900);
    await click(page, '.ttip__ok').catch(() => {});
    // lowest sat-valid offer: scan wages upward with the live preview until satisfaction >= 40, fee 0
    const w = await sliderRange(page, 'Oyuncu maaşı');
    await slide(page, 'SENİN', 0);
    let hes = false;
    for (let k = 0; k <= 40 && !hes; k++) {
      const v = Math.round((w.min + (w.max - w.min) * (0.03 + k * 0.01)) / w.step) * w.step;
      await slide(page, 'Oyuncu maaşı', v); await sleep(260);
      const txt = await page.locator('.tsat__val').innerText();
      if (+txt >= 40) { hes = true; }
    }
    await sleep(300);
    await click(page, '.table__go'); await sleep(1500);
    const phase = await page.locator('.tpanel.is-gold').count();
    console.log('after first propose: hesitation panel =', phase);
    if (phase && run('hesitate')) { await shot(page, 'masa-hesitates'); await shot(page, 'masa-hesitates-full', { tall: 2300 }); }
    if (run('ceremony')) {
      if (phase) { await page.locator('.tpanel.is-gold .btn--gold').click(); }
      else {
        // try to accept the counter or keep raising
        for (let r = 0; r < 4; r++) {
          if (await page.locator('.tcounter .btn--gold:not(.is-off)').count()) { await page.locator('.tcounter .btn--gold').click(); break; }
          await click(page, '.table__go'); await sleep(900);
        }
      }
      await sleep(1900); await shot(page, 'ceremony-0-paper');
      await sleep(900); await shot(page, 'ceremony-1-signing');
      await sleep(900); await shot(page, 'ceremony-2-stamp');
      await sleep(900); await shot(page, 'ceremony-3-headline');
      await sleep(1000); await shot(page, 'ceremony-4-counters');
      await sleep(1800); await shot(page, 'ceremony-5-final');
      await shot(page, 'ceremony-full', { tall: 1700 });
      done = true;
    }
    await ctx.close();
  }
}

if (run('left')) {
  const { ctx, page } = await fresh(5);
  const id = await setup(page, 11);
  await openTable(page, id);
  await sleep(900); await click(page, '.ttip__ok').catch(() => {});
  const w = await sliderRange(page, 'Oyuncu maaşı');
  await slide(page, 'Oyuncu maaşı', w.max); const f = await sliderRange(page, 'SENİN'); await slide(page, 'SENİN', f.max);
  for (let r = 0; r < 8; r++) {
    await sleep(350);
    if (await page.locator('.tpanel--left').count()) break;
    await click(page, '.table__go'); await sleep(700);
    if (r === 0) await shot(page, 'masa-angry-1');
  }
  await sleep(300); await shot(page, 'masa-left-stand');
  await sleep(1700); await shot(page, 'masa-left-gone');
  await shot(page, 'masa-left-full', { tall: 2000 });
  await ctx.close();
}

if (run('deadline')) {
  const { ctx, page } = await fresh(7);
  await setup(page, 8);
  const phase = await E(page, async () => {
    const { store } = await import('/src/ui/store.js');
    const S = store.S;
    S.agency.cash = 900000;
    const clear = () => { for (const c of [...S.inbox]) if (c.must) store.act('answerInbox', { inboxId: c.id, optionId: c.defaultOption || c.options[0].id }); };
    clear();
    let r = store.advance({ silent: true }); clear();
    // now month 1 (Ağustos): the next advance starts Son Gün
    for (const c of S.inbox) if (c.must) store.act('answerInbox', { inboxId: c.id, optionId: c.defaultOption || c.options[0].id });
    S.agency.energy = S.agency.energyMax;
    r = store.advance();
    return { month: S.time.month, phase: S.time.phase, r: r.phase || r.error };
  });
  console.log('deadline setup', phase);
  await sleep(2200);
  await shot(page, 'deadline-1800');
  await shot(page, 'deadline-1800-full', { tall: 1900 });
  // take the first available call
  const callBtn = page.locator('.dlcall.is-ring .btn').first();
  if (await callBtn.count()) {
    await callBtn.click(); await sleep(1500);
    await shot(page, 'deadline-call-table');
    // walk away -> back to Son Gün
    await click(page, '.table__x'); await sleep(300);
    await page.getByRole('button', { name: 'Masadan kalk' }).last().click(); await sleep(1800);
    await shot(page, 'deadline-after-call');
  }
  for (const h of [19, 20, 21, 22, 23]) {
    const skip = page.getByRole('button', { name: 'Bu saati boş geç' });
    if (!(await skip.count())) break;
    await skip.click(); await sleep(2300);
    if (h >= 21) await shot(page, `deadline-${h}00`);
  }
  await sleep(2300);
  await shot(page, 'deadline-midnight');
  await shot(page, 'deadline-midnight-full', { tall: 1500 });
  await ctx.close();

  // reload mid-deadline
  const c2 = await fresh(8);
  await setup(c2.page, 11);
  await E(c2.page, async () => {
    const { store } = await import('/src/ui/store.js');
    const S = store.S; S.agency.cash = 900000;
    for (let k = 0; k < 2; k++) { for (const c of [...S.inbox]) if (c.must) store.act('answerInbox', { inboxId: c.id, optionId: c.defaultOption || c.options[0].id }); S.agency.energy = S.agency.energyMax; store.advance({ silent: true }); if (S.time.phase === 'deadline') break; }
  });
  await sleep(300);
  await c2.page.reload({ waitUntil: 'load' }); await c2.page.waitForSelector('html.ready');
  await E(c2.page, async () => { const { store } = await import('/src/ui/store.js'); const { sel } = {}; store.ui.openOverlay('Deadline', {}); return store.S.time.phase; }).then((p) => console.log('after reload phase', p));
  await sleep(1500);
  await shot(c2.page, 'deadline-after-reload');
  await c2.ctx.close();
}

console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'console: no errors');
await browser.close(); server.close();
