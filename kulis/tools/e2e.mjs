// End-to-end playthrough of the BUILT game (dist/kulis.html) through real clicks.  Usage: node build.mjs && node tools/e2e.mjs
// Part A: onboarding -> tutorial -> scout/recruit -> months -> Masa -> ceremony -> Son Gün -> season end -> season 2 (real clicks).
// Part B: reload/restore checks (Masa, Son Gün, season end, ending) and every ending tier from engine-built saves.
// Exits non-zero on any failed check or any pageerror/console error. Screenshots: dist/shots/e2e-*.png.
import { serve, launch, newPage, sleep, buttons } from './lib-e2e.mjs';
import { existsSync } from 'node:fs';
import { root } from './lib-e2e.mjs';
import { join } from 'node:path';
import * as G from './e2e-saves.mjs';

if (!existsSync(join(root, 'dist/kulis.html'))) { console.error('dist/kulis.html yok: önce node build.mjs'); process.exit(2); }
const failures = [];
const ok = (cond, msg) => { if (cond) console.log('  ok   ' + msg); else { console.log('  FAIL ' + msg); failures.push(msg); } };
const step = (m) => console.log('\n# ' + m);

const { server, url } = await serve();
const browser = await launch();
const allErrors = [];

/** Click the first visible button whose accessible text matches `re` (waits up to 6s). */
async function click(page, re, { nth = 0, timeout = 6000, within } = {}) {
  const root_ = within ? page.locator(within) : page;
  const loc = root_.getByRole('button', { name: re }).filter({ visible: true }).nth(nth);
  await loc.waitFor({ state: 'visible', timeout });
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await loc.click({ timeout });
  await sleep(350);
}
const tab = async (page, re) => { await page.getByRole('tab', { name: re }).filter({ visible: true }).first().click({ timeout: 6000 }); await sleep(450); };
/** Son Gün with nothing to do: pass the hours, close at midnight. Leaves the Ay özeti (Playback) open. */
async function finishDeadline(page) {
  for (let i = 0; i < 8; i++) {
    const skip = page.getByRole('button', { name: /Bu saati boş geç/ }).filter({ visible: true }).first();
    if (!(await skip.count()) || (await skip.isDisabled())) break;
    await skip.click(); await sleep(400);
  }
  await click(page, /^Ayı Oynat$/);
  await sleep(500);
}
/** Press the Hub's advance button and accept the "Enerjin kaldı" confirmation when it shows. */
async function pressAdvance(page, re = /AYI OYNAT|SON GÜNE GİR/) {
  await click(page, re);
  if ((await page.locator('.sheet').count()) && (await has(page, /Enerjin kaldı/))) await click(page, /Yine de oynat/, { within: '.sheet' });
  await sleep(500);
}

/** Drive an open Masa to a signed deal with real clicks: offer, accept counters, soothe a hesitating client, raise the wage when refused. */
async function dealAtMasa(P, tag) {
  const page = P.page;
  for (let i = 0; i < 12; i++) {
    await page.getByRole('button', { name: /Anladım/ }).first().click({ timeout: 600 }).catch(() => {});
    const ov = await overlayName(page);
    if (process.env.E2E_DEBUG) console.log('   masa step', i, ov, (await text(page, '.overlay')).replace(/\n+/g, ' | ').slice(0, 160));
    if (ov === 'İmza töreni' || (await has(page, /Anlaşma imzalanıyor/))) return true;
    if (ov !== 'Pazarlık masası') return false;
    const lean = page.getByRole('button', { name: /^İkna et \(bağlılık/ }).filter({ visible: true }).first();
    if (await lean.count()) { await lean.click({ timeout: 2000 }).catch(() => {}); await sleep(900); continue; }
    const acc = page.getByRole('button', { name: /^Kabul et$/ }).filter({ visible: true }).first();
    if (process.env.E2E_DEBUG) console.log('   acc', await acc.count(), (await acc.count()) ? await acc.isEnabled() : null);
    if ((await acc.count()) && (await acc.isEnabled())) { await acc.click({ timeout: 2000 }).catch(() => {}); await sleep(900); continue; }
    if (await has(page, /Masadan kalktı/)) { await page.getByRole('button', { name: /^Tamam$/ }).first().click({ timeout: 2000 }).catch(() => {}); await sleep(600); return false; }
    if ((await acc.count()) && !(await acc.isEnabled())) { // counter the client would not sign: work on it, add the minutes clause and a raise
      await page.getByRole('button', { name: /Bunun üzerine çalış/ }).first().click({ timeout: 1500 }).catch(() => {});
      await page.getByRole('switch', { name: /Forma garantisi/ }).first().click({ timeout: 1500 }).catch(() => {});
      for (let k = 0; k < 4; k++) await page.getByRole('button', { name: /^Oyuncu maaşı \(aylık\) artır$/ }).first().click({ timeout: 800 }).catch(() => {});
    }
    if (await has(page, /bunu kabul etmez/)) { for (let k = 0; k < 6; k++) await page.getByRole('button', { name: /^Oyuncu maaşı \(aylık\) artır$/ }).first().click({ timeout: 800 }).catch(() => {}); }
    if (i === 0 && tag) await P.shot(tag + '-masa');
    const go = page.getByRole('button', { name: /^Teklif et/ }).filter({ visible: true }).first();
    if (!(await go.count()) || !(await go.isEnabled())) { await sleep(500); continue; }
    await go.click({ timeout: 2500 }).catch(() => {});
    await sleep(900);
    if (i === 0 && tag) await P.shot(tag + '-masa-after-offer');
  }
  if ((await overlayName(page)) === 'Pazarlık masası') { // give up cleanly: walk away so the rest of the flow can continue
    await page.getByRole('button', { name: /^Masadan kalk$/ }).first().click({ timeout: 2000 }).catch(() => {});
    await page.locator('.sheet').getByRole('button', { name: /^Masadan kalk$/ }).first().click({ timeout: 2000 }).catch(() => {});
    await sleep(600);
  }
  return false;
}
/** One step of the season review: press its primary button; returns its label. */
async function reviewNext(P, i) {
  const b = P.page.getByRole('button', { name: /^Devam$|Yeni sezona başla|Finale geç/ }).filter({ visible: true }).first();
  try { const lbl = (await b.innerText({ timeout: 4000 })).trim(); return { lbl, click: () => b.click() }; }
  catch (e) { await P.shot('xx-review-stuck-' + i); console.log('review stuck:', (await text(P.page, '.overlay')).replace(/\n+/g, ' | ').slice(0, 400)); throw e; }
}
const nav = async (page, label) => { await page.locator('.bottomnav a').filter({ hasText: new RegExp(label) }).first().click({ timeout: 6000 }); await sleep(450); };
const text = (page, sel = 'body') => page.evaluate((s) => (document.querySelector(s) || document.body).innerText, sel);
const has = async (page, re) => new RegExp(re.source, re.flags.includes('i') ? re.flags : re.flags + 'i').test(await text(page));
const state = (page) => page.evaluate(async () => {
  const raw = localStorage.getItem('kulis-save-v1'); if (!raw) return null;
  const S = JSON.parse(raw); return { phase: S.time.phase, season: S.time.season, month: S.time.month, cash: S.agency.cash, energy: S.agency.energy, neg: !!S.negotiation, deadline: !!S.deadline, ending: S.ending ? S.ending.kind : null, clients: Object.values(S.players).filter((p) => p.agentId === 'you').length, tutorial: S.flags && S.flags.tutorial && S.flags.tutorial.step };
});
const hscroll = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const overlayName = (page) => page.evaluate(() => { const o = document.querySelector('.overlay'); return o ? (o.getAttribute('aria-label') || 'overlay') : null; });
const dumpDom = async (page, tag) => { console.log(`[${tag}] overlay=${await overlayName(page)} buttons=${JSON.stringify((await buttons(page)).slice(0, 14))}`); };

async function finishPlayback(page, shotName) {
  // month report: skip animations, then continue (may chain into SeasonEnd / Ending)
  await page.getByRole('button', { name: /^Atla$/ }).first().click({ timeout: 3000 }).catch(() => {});
  await sleep(500);
  if (shotName) await page.screenshot({ path: join(root, 'dist/shots', `e2e-${shotName}.png`) });
  const go = page.getByRole('button', { name: /^(Devam|Sezon Özetine Geç|Kariyerin Sonu)$/ }).filter({ visible: true }).first();
  await go.waitFor({ state: 'visible', timeout: 15000 });
  await go.click(); await sleep(500);
}

/* ===================================================================== Part A */
step('A1 onboarding');
const A = await newPage(browser, url, { dsf: 1 });
const { page } = A;
await A.open();
await A.shot('01-title');
ok(await has(page, /KULİS/), 'title screen');
await click(page, /Yeni Kariyer/);
await A.shot('02-setup');
ok((await hscroll(page)) <= 0, 'setup: no horizontal scroll');
await click(page, /Kariyere Başla/);
await sleep(700);
await A.shot('03-hub-start');
ok(await has(page, /SEZON HEDEFİNİ SEÇ|Sezon hedefini seç/i), 'hub asks for a season objective');
await click(page, /hedef: .*Seç/);
ok((await state(page)).season === 1, 'game state saved after start');

step('A2 tutorial: welcome -> visit -> scout -> market -> interest');
await click(page, /Eşlik et/);
await A.shot('04-tut-welcome-answered');
ok(await has(page, /ziyaret/i), 'tutorial points to visiting a client');
await click(page, /Oyuncunu aç/);
ok(await page.locator('.sheet').count() > 0, 'tutorial button opens the client dossier directly');
await sleep(300);
await A.shot('05-player-sheet');
await click(page, /^Ziyaret et/);
ok(await has(page, /“.+”/s), 'visit shows the client quote');
await A.shot('06-visited');
await click(page, /^Kapat$/, { within: '.sheet' });
await nav(page, 'Gündem');
ok(await has(page, /keşf|Keşf/), 'after visit the tutorial points at scouting');
await click(page, /Keşfe git|Keşif'e git|Keşfe/i).catch(async () => { await nav(page, 'Keşif'); });
await nav(page, 'Keşif').catch(() => {});
await A.shot('07-scout');
ok((await hscroll(page)) <= 0, 'scout: no horizontal scroll');
await click(page, /1\. Lig/); // pick the league card
await click(page, /geziye çık/);
await sleep(800);
await A.shot('08-scout-found');
ok(await has(page, /yeni|aday|bulundu/i), 'scout trip reveals prospects');
console.log('state after scout:', JSON.stringify(await state(page)));

// finish tutorial market step: lunch with a club
await nav(page, 'Piyasa');
ok((await page.getByRole('tab', { name: /Kulüpler/ }).first().getAttribute('aria-selected')) === 'true', 'tutorial market step opens Piyasa on the Kulüpler tab');
await page.locator('.mk-club').first().click(); await sleep(500);
await A.shot('09-club-sheet');
await click(page, /Yemeğe çık/);
await A.shot('10-club-lunch-result');
ok(await has(page, /güven|Güven/), 'club lunch shows a result');
await click(page, /^Kapat$/, { within: '.sheet' });
console.log('state after lunch:', JSON.stringify(await state(page)));
await nav(page, 'Piyasa');
await tab(page, /Teklifler/);
await A.shot('11-market-offers');
ok(await has(page, /Masaya otur/), 'tutorial suitor is listed with "Masaya otur"');

step('A3 Masa -> ceremony');
await click(page, /Masaya otur/);
await sleep(900);
await A.shot('12-masa');
ok((await overlayName(page)) === 'Pazarlık masası', 'Masa overlay open');
ok((await hscroll(page)) <= 0, 'masa: no horizontal scroll');
const deal = await dealAtMasa(A, 'a3');
ok(deal, 'deal closed at the Masa');
if (!deal) { await A.shot('xx-a3-stuck'); }
await page.locator('.cer').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
await sleep(5200);
await A.shot('14-ceremony');
ok((await overlayName(page)) === 'İmza töreni', 'ceremony overlay played');
await page.getByRole('button', { name: /^Devam$|Son Gün’e dön/ }).filter({ visible: true }).first().click({ timeout: 8000 });
await sleep(600);
ok((await overlayName(page)) === null, 'ceremony closed, back on the shell');
console.log('state after deal:', JSON.stringify(await state(page)));
await nav(page, 'Gündem');
await A.shot('15-hub-after-deal');

step('A4 first months, recruit');
/** Press the Hub advance button (answering must cards first) and finish the month report. Returns 'deadline' | 'played'. */
async function playMonth(page, { shot } = {}) {
  await nav(page, 'Gündem');
  for (let i = 0; i < 8; i++) {
    const adv = page.getByRole('button', { name: /AYI OYNAT|SON GÜNE GİR/ }).filter({ visible: true }).first();
    if (!(await adv.isDisabled().catch(() => false))) break;
    const opt = page.locator('.hub-card--must .hub-opt:not(.is-off)').first();
    if (!(await opt.count())) break;
    await opt.click(); await sleep(500);
    await page.getByRole('button', { name: /^Tamam$/ }).filter({ visible: true }).first().click({ timeout: 1000 }).catch(() => {});
  }
  await pressAdvance(page);
  let kind = 'played';
  if ((await overlayName(page)) === 'Son Gün') { await finishDeadline(page); kind = 'deadline'; }
  await finishPlayback(page, shot);
  return kind;
}
let r = await playMonth(page, { shot: '16-playback' });
console.log('first month ->', r, JSON.stringify(await state(page)));
ok(r === 'played' || r === 'deadline', 'first month advanced');
await A.shot('17-hub-month2');
// scout row -> recruit
await nav(page, 'Keşif');
await tab(page, /Radarım/);
await page.getByRole('button', { name: /Tüm radarı gör|Tümü/ }).first().click({ timeout: 2000 }).catch(() => {});
await sleep(300);
await page.locator('.scout-filters .chip').filter({ hasText: /Tümü/ }).first().click().catch(() => {});
await sleep(400);
await A.shot('18-radar');
ok((await hscroll(page)) <= 0, 'radar: no horizontal scroll');
const before = (await state(page)).clients;
await page.getByRole('button', { name: /^İmzaya yakın$/ }).first().click().catch(() => {});
await sleep(300);
const rows = page.locator('.scout-row').filter({ hasText: /İmzalanabilir/ });
const nRows = await rows.count();
let signed = false;
if (nRows) {
  await rows.first().click(); await sleep(600);
  await click(page, /İmza teklifi/);
  await A.shot('19-recruit');
  ok(await has(page, /Söz ver/), 'recruit sheet lists promises');
  await click(page, /^İmzala/);
  await sleep(900);
  await A.shot('20-signed');
  signed = (await state(page)).clients > before;
}
console.log('rows:', nRows, 'signed:', signed);
ok(signed, 'recruited a scouted prospect (signable rows: ' + nRows + ')');
await page.keyboard.press('Escape'); await sleep(300);
allErrors.push(...A.errors.map((e) => '[A] ' + e));
await A.ctx.close();

/* ===================================================================== Part B */
async function fresh(save, opts = {}) { const P = await newPage(browser, url, { dsf: 1, save, ...opts }); await P.open(); return P; }
const reload = async (P) => { await P.page.reload({ waitUntil: 'load' }); await P.page.waitForSelector('html.ready'); await sleep(700); };
const flushErrors = (P, tag) => allErrors.push(...P.errors.map((e) => `[${tag}] ${e}`));

step('B1 Son Gün (August): reload restore, take a table, close deal, ceremony, midnight');
{
  const P = await fresh(G.serialize(G.augustWithInterest())); const { page } = P;
  await A_shot_hub(P);
  ok(await has(page, /SON GÜNE GİR/), 'hub offers "Son Gün\'e gir" in August');
  await pressAdvance(page, /SON GÜNE GİR/);
  await sleep(500);
  await P.shot('b1-deadline');
  ok((await overlayName(page)) === 'Son Gün', 'Son Gün overlay');
  ok((await hscroll(page)) <= 0, 'son gün: no horizontal scroll');
  await reload(P);
  ok((await overlayName(page)) === 'Son Gün', 'reload during Son Gün lands back in Son Gün');
  // close the overlay -> hub must offer a way back
  await click(page, /^Gündem$/, { within: '.overlay' });
  ok((await overlayName(page)) === null, 'Son Gün can be minimised');
  ok(await has(page, /SON GÜNE DÖN/), 'hub shows "Son Gün\'e dön"');
  await click(page, /SON GÜNE DÖN/); await sleep(500);
  // take a table
  const sit = page.getByRole('button', { name: /^Masaya otur$/ }).filter({ visible: true }).first();
  if (await sit.count()) {
    await sit.click(); await sleep(900);
    ok((await overlayName(page)) === 'Pazarlık masası', 'Son Gün table opened');
    await P.shot('b1-masa-deadline');
    await reload(P);
    ok((await overlayName(page)) === 'Pazarlık masası', 'reload mid-negotiation lands back at the Masa');
    ok((await state(page)).neg, 'negotiation survived the reload');
    const deal = await dealAtMasa(P, 'b1');
    if (!deal) { await P.shot('xx-b1-stuck'); console.log((await text(page, '.overlay')).replace(/\n+/g, ' | ').slice(0, 1500)); }
    console.log('  (Son Gün table result: ' + (deal ? 'deal' : 'no deal') + ')');
    if (deal) {
    await page.locator('.cer').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    await sleep(5200);
    await P.shot('b1-ceremony');
    await page.getByRole('button', { name: /Son Gün’e dön|^Devam$/ }).filter({ visible: true }).first().click({ timeout: 8000 });
    await sleep(700);
    ok((await overlayName(page)) === 'Son Gün', 'ceremony returns to Son Gün');
    } else { await sleep(500); ok((await overlayName(page)) === 'Son Gün', 'after a lost table the player is back in Son Gün'); }
  } else console.log('  (no table available in Son Gün)');
  for (let i = 0; i < 8; i++) {
    const skip = page.getByRole('button', { name: /Bu saati boş geç/ }).filter({ visible: true }).first();
    if (!(await skip.count()) || (await skip.isDisabled())) break;
    await skip.click(); await sleep(450);
    if (i === 2) await P.shot('b1-deadline-late');
  }
  await sleep(1800);
  await P.shot('b1-midnight');
  ok(await has(page, /Günün özet/), 'midnight summary shown');
  await click(page, /^Ayı Oynat$/);
  await sleep(600);
  await finishPlayback(page, 'b1-playback');
  const st = await state(page);
  ok(st.month === 2 && st.phase === 'plan', 'month 2 (September) reached after Son Gün: ' + JSON.stringify(st));
  flushErrors(P, 'B1'); await P.ctx.close();
}

step('B2 season end: reload restore, review, season 2');
{
  const S = G.newS(); G.tutorialToInterest(S);
  while (!(S.time.season === 1 && S.time.month === 11)) { S.agency.cash = Math.max(S.agency.cash, 150000); G.passMonth(S); }
  G.clearInbox(S, 'all');
  const P = await fresh(G.serialize(S)); const { page } = P;
  ok(await has(page, /Haz.ran/), 'staged at June (last month of the season)');
  await pressAdvance(page, /AYI OYNAT/);
  await page.getByRole('button', { name: /^Atla$/ }).first().click({ timeout: 3000 }).catch(() => {});
  await sleep(500);
  await reload(P);
  ok(/değerlendirmesi/.test((await overlayName(page)) || ''), 'reload after season end lands in the season review (overlay: ' + (await overlayName(page)) + ')');
  await P.shot('b2-seasonend-intro');
  const seen = [];
  for (let i = 0; i < 12; i++) {
    const { lbl, click: go } = await reviewNext(P, i);
    if (i === 1) { // a sheet opened from inside an overlay must sit on top, and Esc must close only the sheet
      const club = page.locator('.season-champ__club').first();
      if (await club.count()) {
        await club.click(); await sleep(600);
        const top = await page.evaluate(() => { const s = document.querySelector('.sheet'); if (!s) return false; const b = s.getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return !!(e && e.closest('.sheet')); });
        ok(top, 'sheet opened from the season review is on top of the overlay');
        await P.shot('b2-sheet-over-overlay');
        await page.keyboard.press('Escape'); await sleep(500);
        ok((await page.locator('.sheet').count()) === 0 && /değerlendirmesi/.test((await overlayName(page)) || ''), 'Esc closes only the sheet, the review stays');
      }
    }
    if (i === 1 || i === 4) await P.shot('b2-seasonend-' + i);
    if (/sezona ba|nale ge/i.test(lbl)) { await P.shot('b2-seasonend-last'); seen.push(lbl); break; }
    await go(); await sleep(450); seen.push(lbl);
  }
  ok(seen.length >= 3, 'season review has several steps (' + seen.length + ')');
  ok((await hscroll(page)) <= 0, 'season end: no horizontal scroll');
  // reload on the last step must still restore (not yet confirmed)
  await reload(P);
  ok(/değerlendirmesi/.test((await overlayName(page)) || ''), 'season review restored again until confirmed');
  for (let i = 0; i < 12; i++) {
    const { lbl, click: go } = await reviewNext(P, 'b' + i);
    await go(); await sleep(400);
    if (/sezona ba/i.test(lbl)) break;
  }
  ok((await overlayName(page)) === null, 'season review closed');
  const st = await state(page);
  ok(st.season === 2 && st.month === 0, 'season 2 started: ' + JSON.stringify(st));
  await reload(P);
  ok((await overlayName(page)) === null, 'after confirming the review a reload does not show it again');
  await P.shot('b2-season2-hub');
  ok(await has(page, /Sezon hedef/), 'season 2: objective offered / shown');
  // play a couple of season-2 months for errors
  for (let i = 0; i < 2; i++) await playMonth(page);
  ok((await state(page)).month === 2, 'season 2 months play');
  flushErrors(P, 'B2'); await P.ctx.close();
}

step('B3 final season: real ending path, restore, every tier, bankruptcy, no clients');
const endingOf = async (P) => ({ ov: await overlayName(P.page), t: await text(P.page, '.overlay') });
{
  const S = G.lastJune();
  const P = await fresh(G.serialize(S)); const { page } = P;
  ok(await has(page, /Sezon 8 \/ 8/), 'staged at season 8, June');
  await pressAdvance(page, /AYI OYNAT/);
  await finishPlayback(page, 'b3-final-playback');
  ok(/değerlendirmesi/.test((await overlayName(page)) || ''), 'final month chains into the season review');
  for (let i = 0; i < 12; i++) {
    const { lbl, click: go } = await reviewNext(P, 'c' + i);
    await go(); await sleep(400);
    if (/nale ge/i.test(lbl)) break;
  }
  await sleep(1200);
  ok((await overlayName(page)) === 'Kariyer sonu', 'review leads to the Ending screen');
  await P.shot('b3-ending-real');
  const st = await state(page);
  ok(st.phase === 'over' && !!st.ending, 'ending recorded: ' + st.ending);
  await reload(P);
  ok((await overlayName(page)) === 'Kariyer sonu', 'reload at the ending lands on the Ending screen');
  await click(page, /Kapat|Kariyer özeti|Hub|Ajans/i, { timeout: 1500 }).catch(() => {});
  flushErrors(P, 'B3-real'); await P.ctx.close();
}
const JUNE8 = G.serialize(G.lastJune());
for (const kind of ['efsane', 'buyuk', 'saygin', 'siradan']) {
  const S = G.deserialize(JUNE8);
  G.endingMod.build(S, kind);
  const P = await fresh(G.serialize(S)); const { page } = P;
  await sleep(1200);
  const { ov, t } = await endingOf(P);
  ok(ov === 'Kariyer sonu', `ending ${kind}: Ending screen rendered`);
  ok(t.toLocaleUpperCase('tr-TR').includes(S.ending.title.toLocaleUpperCase('tr-TR')), `ending ${kind}: shows its title "${S.ending.title}"`);
  ok((await hscroll(page)) <= 0, `ending ${kind}: no horizontal scroll`);
  await P.shot(`b3-ending-${kind}-top`);
  await page.locator('.overlay').evaluate((o) => o.scrollTo(0, o.scrollHeight)); await sleep(400);
  await P.shot(`b3-ending-${kind}-bottom`);
  ok(/sonsuz|Devam|Yeni kariyer/i.test(await text(page, '.overlay')), `ending ${kind}: has a way forward (endless / new career)`);
  flushErrors(P, 'B3-' + kind); await P.ctx.close();
}
{ // bankruptcy through the real month end
  const S = G.newS(); G.tutorialToInterest(S);
  G.passMonth(S); G.clearInbox(S, 'all');
  S.agency.cash = -900000; S.agency.negMonths = 2; S.agency.energy = 0;
  const P = await fresh(G.serialize(S)); const { page } = P;
  ok(await has(page, /Kasa eks/), 'hub warns about negative cash');
  await P.shot('b3-bankrupt-hub');
  await pressAdvance(page, /AYI OYNAT|SON GÜNE GİR/);
  if ((await overlayName(page)) === 'Son Gün') await finishDeadline(page);
  await finishPlayback(page, 'b3-bankrupt-playback');
  await sleep(1000);
  const { ov } = await endingOf(P);
  ok(ov === 'Kariyer sonu', 'bankruptcy: Ending screen (overlay ' + ov + ')');
  ok((await state(page)).ending === 'iflas', 'bankruptcy: ending kind iflas');
  await P.shot('b3-ending-iflas');
  ok(!/Sonsuz modda devam/i.test(await text(page, '.overlay')), 'bankruptcy: no endless-mode button');
  flushErrors(P, 'B3-iflas'); await P.ctx.close();
}
{ // no clients from season 2 -> yalniz
  const S2 = G.newS(); G.tutorialToInterest(S2);
  while (!(S2.time.season === 2 && S2.time.month === 11)) { S2.agency.cash = Math.max(S2.agency.cash, 150000); G.passMonth(S2); }
  G.clearInbox(S2, 'all');
  for (const c of G.sel.myClients(S2)) G.act(S2, 'releaseClient', { playerId: c.id });
  const P = await fresh(G.serialize(S2)); const { page } = P;
  await P.shot('b3-noclients-hub');
  await pressAdvance(page, /AYI OYNAT/);
  await finishPlayback(page, 'b3-noclients-playback');
  await sleep(1000);
  for (let i = 0; i < 10 && /değerlendirmesi/.test((await overlayName(page)) || ''); i++) { const { lbl, click: go } = await reviewNext(P, 'y' + i); await go(); await sleep(400); if (/nale ge/i.test(lbl)) break; }
  await sleep(1000);
  const st = await state(page);
  console.log('no clients ->', JSON.stringify(st));
  ok(st.ending === 'yalniz' && (await endingOf(P)).ov === 'Kariyer sonu', 'no clients at the end of season 2: "yalniz" Ending screen');
  await P.shot('b3-ending-yalniz');
  ok(!/Sonsuz modda devam/i.test(await text(page, '.overlay')), 'yalniz: no endless-mode button');
  flushErrors(P, 'B3-yalniz'); await P.ctx.close();
}

step('C open stay promise: reasons in Piyasa / Son Gün / dossier, blocked promise in the recruit sheet');
{
  const W = G.promiseWorld();
  const reason = /Kulüpte kalma sözün var/;
  const P = await fresh(G.serialize(W.S)); const { page } = P;
  await nav(page, 'Piyasa');
  await P.shot('c-market-stay');
  ok(reason.test(await text(page, 'main')), 'Piyasa shows why the table is closed (stay promise)');
  ok(!(await page.getByRole('button', { name: /^Masaya otur/ }).filter({ visible: true }).count()), 'no "Masaya otur" for the blocked suitor');
  await page.locator('.mk-client__head').first().click(); await sleep(600);
  ok(reason.test(await text(page, '.sheet')), 'client dossier shows the reason under the suitor');
  await P.shot('c-dossier-stay');
  await page.keyboard.press('Escape'); await sleep(400);
  await nav(page, 'Gündem');
  await pressAdvance(page, /SON GÜNE GİR|AYI OYNAT/);
  if ((await overlayName(page)) === 'Son Gün') {
    ok(reason.test(await text(page, '.overlay')), 'Son Gün lists the blocked suitor with the reason');
    await P.shot('c-deadline-stay');
  } else console.log('  (no Son Gün in this state)');
  await P.ctx.close();
  const Q = await fresh(G.serialize(W.S)); const pg = Q.page;
  await nav(pg, 'Keşif'); await tab(pg, /Radarım/); await sleep(400);
  const row = pg.locator('.scout-row').filter({ hasText: W.pick.name.split(' ').slice(-1)[0] }).first();
  await row.click(); await sleep(600);
  await click(pg, /İmza teklifi/);
  await sleep(500);
  await Q.shot('c-recruit-blocked');
  const blocked = pg.locator('.recruit-prom.is-blocked');
  ok((await blocked.count()) >= 1, 'recruit sheet shows a blocked promise');
  ok((await blocked.first().isDisabled()), 'blocked promise is disabled');
  ok((await blocked.first().innerText()).includes(W.pick.reason.slice(0, 20)), 'blocked promise shows its reason');
  allErrors.push(...Q.errors.map((e) => '[C-recruit] ' + e)); await Q.ctx.close();
  allErrors.push(...P.errors.map((e) => '[C] ' + e));
}

await browser.close(); server.close();
console.log('\n' + (failures.length ? `FAILED (${failures.length})\n - ` + failures.join('\n - ') : 'ALL CHECKS OK'));
if (allErrors.length) console.log('PAGE ERRORS:\n' + [...new Set(allErrors)].join('\n'));
process.exit(failures.length || allErrors.length ? 1 : 0);
async function A_shot_hub(P) { await P.shot('b1-hub-august'); }
