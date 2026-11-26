// Layout audit on a mid-game save: every route + the main sheets at 390 and 1280. Prints horizontal scroll, small tap targets (<40px), clipped text.
// Usage: node tools/audit.mjs   (needs dist/kulis.html).  Screenshots: dist/shots/audit-<route>-<w>.png
import { serve, launch, newPage, sleep } from './lib-e2e.mjs';
import * as G from './e2e-saves.mjs';
const { server, url } = await serve();
const browser = await launch();
const S = G.augustWithInterest();
G.act(S, 'mediaPush', { playerId: G.sel.myClients(S)[0].id });
const save = G.serialize(S);
const errors = [];
const probe = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const hs = document.documentElement.scrollWidth - vw;
  const root = document.querySelector('.overlay') || document.querySelector('.sheet') || document;
  const vis = (e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const small = [...root.querySelectorAll('button,a[href],[role=tab],[role=switch],[role=radio],input')].filter((e) => vis(e) && !e.closest('.sheet__grab') && !e.closest('[inert]')).filter((e) => { const b = e.getBoundingClientRect(); return b.height < 39.5 || b.width < 39.5; })
    .map((e) => `${(e.getAttribute('aria-label') || e.innerText || e.className).toString().replace(/\s+/g, ' ').trim().slice(0, 28)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
  const clipped = [...root.querySelectorAll('h1,h2,h3,h4,p,span,b,button,label,small,li')].filter((e) => vis(e) && e.children.length === 0 && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible' && !getComputedStyle(e).textOverflow.includes('ellipsis'))
    .map((e) => (e.innerText || '').trim().slice(0, 30));
  const wide = [...root.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return vis(e) && b.right > vw + 2 && !e.closest('.sheet__grab,.tstamp,.confetti') && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3).map((e) => e.className.toString().slice(0, 40));
  return { hs, small: [...new Set(small)].slice(0, 12), clipped: [...new Set(clipped)].slice(0, 8), wide };
});
for (const [w, h] of [[390, 844], [1280, 800]]) {
  const P = await newPage(browser, url, { width: w, height: h, dsf: 1, save }); await P.open();
  const { page } = P;
  const report = async (name) => { await P.shot(`audit-${name}-${w}`); const r = await probe(page); console.log(`${w} ${name.padEnd(14)} hscroll=${r.hs} small=[${r.small.join(' | ')}] clipped=[${r.clipped.join(' | ')}] wide=[${r.wide.join(' | ')}]`); };
  for (const route of ['hub', 'players', 'scout', 'market', 'agency']) {
    await page.evaluate((r) => { location.hash = '#/' + r; }, route); await sleep(700);
    await report(route);
  }
  // sub-tabs
  await page.evaluate(() => { location.hash = '#/market'; }); await sleep(500);
  for (const t of [/Kulüpler/, /Puan durumu/]) { await page.getByRole('tab', { name: t }).first().click(); await sleep(400); await report('market-' + String(t).replace(/\W/g, '').slice(0, 8)); }
  await page.evaluate(() => { location.hash = '#/agency'; }); await sleep(500);
  const tabs = await page.getByRole('tab').allInnerTexts();
  for (let i = 0; i < tabs.length; i++) { await page.getByRole('tab').nth(i).click().catch(() => {}); await sleep(400); await report('agency-' + i); }
  await page.evaluate(() => { location.hash = '#/scout'; }); await sleep(500);
  await page.getByRole('tab', { name: /Radarım/ }).first().click(); await sleep(400); await report('scout-radar');
  // player sheet (client) and club sheet
  await page.evaluate(() => { location.hash = '#/players'; }); await sleep(500);
  await page.locator('main button').filter({ hasText: /GÜÇ/ }).first().click(); await sleep(700); await report('sheet-client');
  await page.locator('.sheet__body').evaluate((e) => e.scrollTo(0, 99999)); await sleep(300); await report('sheet-client-b');
  await page.keyboard.press('Escape'); await sleep(400);
  await page.evaluate(() => { location.hash = '#/hub'; }); await sleep(400);
  await page.locator('.bottomnav a').filter({ hasText: /Ajans/ }).first().click(); await sleep(300);
  await page.locator('.topbar button[aria-label="Ayarlar"]').click(); await sleep(500); await report('settings');
  errors.push(...P.errors.map((e) => `[${w}] ${e}`)); await P.ctx.close();
}
await browser.close(); server.close();
if (errors.length) { console.log('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
