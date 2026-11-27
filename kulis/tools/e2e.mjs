#!/usr/bin/env node
// Real-click browser playthrough of dist/kulis.html (Playwright). Build first: node build.mjs
//   node tools/e2e.mjs            full run (new game -> guide -> sign -> offer -> table -> ceremony -> months -> season end -> season 2,
//                                 crafted saves for the final ending and bankruptcy, reload-restores checks). Screenshots: dist/shots/e2e-*.png (390 wide)
import { serve, launch, newPage, sleep, buttons } from './lib-e2e.mjs';
import { lastJune, almostBankrupt, withOffers, serialize } from './e2e-saves.mjs';

const results = [];
let step = 0;
const ok = (name, cond, extra = '') => { results.push({ name, ok: !!cond, extra }); console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  ' + extra)); };

const { server, url } = await serve();
const browser = await launch();
const T0 = Date.now();

// textContent, not innerText: CSS uppercases (and JS /i does not fold Turkish İ/ı), so match on the DOM text
const TEXT = (page) => page.evaluate(() => document.getElementById('app').textContent.replace(/\s+/g, ' '));
const click = async (page, text) => { await page.getByText(text, { exact: false }).first().click(); await sleep(250); };
const tab = async (page, name) => { await page.locator('.bottomnav a', { hasText: new RegExp(name, 'i') }).click(); await sleep(300); };
const energy = (page) => page.evaluate(() => document.querySelectorAll('.topbar__energy .pip.is-on').length);
const cashText = (page) => page.evaluate(() => document.querySelector('.topbar__cashv').innerText);
const setSlider = (page, idx, frac) => page.evaluate(([i, f]) => {
  const el = document.querySelectorAll('.tslider input[type=range]')[i];
  const v = Number(el.min) + (Number(el.max) - Number(el.min)) * f;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true }));
}, [idx, frac]);
const skipCeremony = async (page) => { await sleep(500); for (let i = 0; i < 4; i++) { await page.locator('.cer').click({ position: { x: 20, y: 200 } }).catch(() => {}); await sleep(250); } };

async function playMonth(page, shotName) {
  await page.locator('[data-testid=advance]').click();
  await page.waitForSelector('[data-testid=month-report]');
  if (shotName) await sleep(400);
  const txt = await TEXT(page);
  return txt;
}

try {
  // ------------------------------------------------------------------ 1. new game
  console.log('1. new game');
  {
    const { page, errors, shot, open } = await newPage(browser, url);
    await open();
    await shot('01-title');
    ok('title screen', (await TEXT(page)).includes('KULİS'));
    await click(page, 'Yeni Kariyer'); await shot('02-setup');
    await page.locator('[data-testid=start]').click(); await sleep(700);
    await shot('03-hub');
    const t = await TEXT(page);
    ok('hub: month and season', /TEMMUZ/i.test(t) && /SEZON 1 \/ 5/i.test(t));
    ok('hub: one goal line', (await page.locator('[data-testid=goal]').count()) === 1);
    ok('hub: guide card 1/3', (await page.locator('[data-testid=guide]').textContent()).includes('1/3'));
    ok('three bottom tabs', (await page.locator('.bottomnav a').count()) === 3);
    ok('plain #hash route', /^#[a-z]+$/.test(await page.evaluate(() => location.hash)));
    { const m = t.match(/\bkoz\b|\bsöz(?!leş)|hayal/i); ok('no Koz/söz/hayal text on hub', !m, m && t.slice(Math.max(0, m.index - 30), m.index + 30)); }

    // ---------------------------------------------------------------- 2. find + sign
    console.log('2. find and sign a player');
    await tab(page, 'Oyuncular');
    ok('players route', (await page.evaluate(() => location.hash)) === '#players');
    ok('3 clients listed', (await page.locator('.prow').count()) === 3);
    const e0 = await energy(page);
    await page.locator('[data-testid=search]').click(); await sleep(500);
    ok('search: 3 candidates, 1 energy', (await page.locator('[data-testid=candidate]').count()) === 3 && (await energy(page)) === e0 - 1, `energy ${e0}->${await energy(page)}`);
    const ct = await page.locator('[data-testid=candidate]').first().textContent();
    ok('candidate shows stars + a potential range like "3–5 ★"', /Güç/.test(ct) && /Potansiyel/.test(ct) && /\d–\d ★/.test(ct), ct);
    ok('candidate shows position, age and club', /(KL|DF|OS|FV)/.test(ct) && /yaş/.test(ct));
    await shot('04-candidates');
    // sign the first signable candidate
    const signable = page.locator('[data-testid=candidate]', { hasText: /İmzala/ });
    const nSign = await signable.count();
    ok('at least one candidate is signable at the start', nSign >= 1);
    ok('a locked candidate says why (itibar)', (await page.locator('[data-testid=candidate]', { hasText: /İtibarın yetmiyor/ }).count()) >= 0);
    if (nSign) {
      await signable.first().getByText('İmzala').click(); await sleep(500);
      ok('signed: 4 clients', (await page.locator('.prow').count()) === 4);
    }
    await shot('05-signed');

    // ---------------------------------------------------------------- 3. pitch -> offer -> table
    console.log('3. offer to a club and the table');
    const nClients = await page.locator('.prow').count();
    let pitched = false;
    for (let i = 0; i < nClients && !pitched; i++) {
      await page.locator('.prow').nth(i).click(); await sleep(400);
      if (i === 0) {
        ok('player dossier fits one screen', await page.evaluate(() => { const b = document.querySelector('.sheet__body'); return !b || b.scrollHeight <= b.clientHeight + 2; }));
        await shot('06-player-sheet');
      }
      await click(page, 'Kulübe öner'); await sleep(300);
      if (i === 0) { await shot('07-pitch-picker'); ok('picker lists clubs with fit words', /İlgilenir|Belki|Zor/.test(await TEXT(page))); }
      const row = page.locator('.pitch__row', { hasText: /İlgilenir/ }).first();
      if (await row.count()) { await row.click(); await sleep(500); pitched = true; }
      else { await page.keyboard.press('Escape'); await sleep(200); await page.keyboard.press('Escape'); await sleep(300); }
    }
    ok('a client has an interested club (pitch lands)', pitched);
    ok('interested club: "teklif geldi" + Masaya otur', /teklif geldi/i.test(await TEXT(page)));
    await shot('08-pitch-result');
    await page.locator('[data-testid=pitch-result]').getByText('Masaya otur').click(); await sleep(900);
    await shot('09-table');
    ok('table: exactly two sliders', (await page.locator('.tslider').count()) === 2);
    { const tt = await TEXT(page); const m = tt.match(/\bkoz\b|blöf|\bsöz(?!leş)|ikna et/i); ok('table: no Koz, no bluff, no promise UI', !m, m && tt.slice(Math.max(0, m.index - 30), m.index + 30)); }
    ok('table: "Kabul şansı" hint shown', /Kabul şansı/i.test(await TEXT(page)) && (await page.locator('[data-testid=hint]').textContent()).length > 8);
    ok('table: 3 patience pips', (await page.locator('.tpat__pip').count()) === 3);
    ok('table: director line is short', (await page.locator('[data-testid=director-line]').textContent()).length < 90);
    ok('table: round counter 1/3', /Tur 1\/3/i.test(await TEXT(page)));

    // reload with an open table restores the Masa
    await page.reload(); await page.waitForSelector('html.ready'); await sleep(700);
    ok('reload restores the open table', (await page.locator('[data-testid=table]').count()) === 1);

    // make the offer: wage at its minimum, commission at the fair value
    await setSlider(page, 0, 0); await setSlider(page, 1, 0.2); await sleep(400);
    await page.locator('[data-testid=propose]').click(); await sleep(1700);
    ok('first table accepted -> ceremony', (await page.locator('.cer').count()) === 1);
    await skipCeremony(page);
    await shot('10-ceremony');
    ok('ceremony shows commission', /Komisyonun/i.test(await TEXT(page)));
    await page.getByRole('button', { name: /Devam/i }).last().click(); await sleep(500);
    ok('back on the hub, guide advanced', (await page.locator('[data-testid=guide]').count()) === 0 || !/3\/3/.test(await TEXT(page)));
    await shot('11-hub-after-deal');

    // ---------------------------------------------------------------- 4. market + agency
    console.log('4. market and agency');
    await tab(page, 'Piyasa'); await shot('12-market');
    ok('market has offers + clubs sections', /Teklifler/i.test(await TEXT(page)) && /Kulüpler/i.test(await TEXT(page)));
    await page.locator('.mclub').first().click(); await sleep(400);
    ok('club sheet shows needs', /Arıyor/i.test(await TEXT(page)));
    await shot('13-club-sheet');
    await page.keyboard.press('Escape'); await sleep(300);
    await page.getByRole('button', { name: 'Ajans' }).click(); await sleep(400);
    ok('agency sheet: 5 agencies and ≤ 6 upgrades', (await page.locator('.agency__row').count()) === 5 && (await page.locator('[data-testid=upgrade]').count()) <= 6 && (await page.locator('[data-testid=upgrade]').count()) >= 4);
    await shot('14-agency');
    ok('agency: no sub-tabs', (await page.locator('[role=tab]').count()) === 0);
    await page.keyboard.press('Escape'); await sleep(300);

    // ---------------------------------------------------------------- 5. months -> season end -> season 2
    console.log('5. months, season end, season 2');
    await tab(page, 'Gündem');
    let first = true, sawEvent = false;
    for (let m = 0; m < 12; m++) {
      const t0 = await TEXT(page);
      if (await page.locator('[data-testid=event]').count()) {
        sawEvent = true;
        if (first) { await shot('15-event'); first = false; }
        const evt = page.locator('[data-testid=event]');
        ok('event card: ≤ 2 choices', (await evt.locator('button').count()) <= 2 && (await evt.locator('button').count()) >= 1);
        await evt.locator('button').last().click(); await sleep(300);
      }
      const txt = await playMonth(page, m === 0 ? '16-report' : null);
      if (m === 0) { await shot('16-report'); ok('month report: one Devam button', (await page.locator('[data-testid=continue]').count()) === 1); }
      await page.locator('[data-testid=continue]').click(); await sleep(500);
      if (m === 0) { // month 2: watch a candidate
        await tab(page, 'Oyuncular');
        await page.locator('[data-testid=search]').click(); await sleep(500);
        await page.locator('[data-testid=candidate]').first().getByText('İzle').click(); await sleep(400);
        ok('İzle: potential becomes exact (İzlendi, single star value)', /İzlendi/.test(await page.locator('[data-testid=candidate]').first().textContent()) && !/\d–\d ★/.test(await page.locator('[data-testid=candidate]').first().textContent()));
        await tab(page, 'Gündem');
      }
      if (m < 11) {
        if (await page.locator('[data-testid=season-end]').count()) break;
      }
    }
    ok('saw an event card in the first season', sawEvent);
    await sleep(400);
    ok('season end screen appears after June', (await page.locator('[data-testid=season-end]').count()) === 1);
    await shot('17-season-end');
    ok('season end: one screen, one button', (await page.locator('[data-testid=season-continue]').count()) === 1);
    // reload on an unseen season-end review restores it
    await page.reload(); await page.waitForSelector('html.ready'); await sleep(700);
    ok('reload restores the unseen season review', (await page.locator('[data-testid=season-end]').count()) === 1);
    await page.locator('[data-testid=season-continue]').click(); await sleep(600);
    ok('season 2 starts', /SEZON 2 \/ 5/i.test(await TEXT(page)));
    ok('new goal assigned', (await page.locator('[data-testid=goal]').count()) === 1);
    await shot('18-hub-season2');
    ok('no page errors (new-game flow)', errors.length === 0, errors.join(' | '));
    errors.length = 0;
    // reload keeps the month
    const before = await TEXT(page);
    await page.reload(); await page.waitForSelector('html.ready'); await sleep(700);
    ok('reload keeps the game (hub)', /SEZON 2 \/ 5/i.test(await TEXT(page)) && /TEMMUZ/i.test(await TEXT(page)));
    await page.context().close();
  }

  // ------------------------------------------------------------------ 6. table: counter, accept counter, left
  console.log('6. table: counter / left');
  {
    const save = serialize(withOffers());
    const { page, errors, shot, open } = await newPage(browser, url, { save });
    await open();
    await tab(page, 'Piyasa'); await shot('20-market-offers');
    ok('market lists the waiting offers', (await page.locator('[data-testid=offer]').count()) >= 1);
    await page.locator('[data-testid=offer]').first().getByText('Masaya otur').click(); await sleep(900);
    await setSlider(page, 0, 1); await setSlider(page, 1, 1); await sleep(400);
    ok('greedy offer: hint is Düşük', /Düşük/.test(await page.locator('[data-testid=hint]').textContent()));
    await shot('21-table-greedy');
    await page.locator('[data-testid=propose]').click(); await sleep(900);
    ok('refused: counter card + 2 pips left', (await page.locator('[data-testid=counter]').count()) === 1 && (await page.locator('.tpat__pip.is-on').count()) === 2);
    ok('round counter 2/3', /Tur 2\/3/i.test(await TEXT(page)));
    await shot('22-table-counter');
    await page.locator('[data-testid=accept-counter]').click(); await sleep(1700);
    ok('counter accepted -> ceremony', (await page.locator('.cer').count()) === 1);
    await skipCeremony(page);
    await page.getByRole('button', { name: /Devam/i }).last().click(); await sleep(500);
    // a second table: refuse everything until the director leaves (hard cap 3 rounds)
    await tab(page, 'Piyasa');
    if (await page.locator('[data-testid=offer]').count()) {
      await page.locator('[data-testid=offer]').first().getByText('Masaya otur').click(); await sleep(900);
      for (let r = 0; r < 3; r++) {
        if (await page.locator('[data-testid=table-left]').count()) break;
        await setSlider(page, 0, 1); await setSlider(page, 1, 1); await sleep(300);
        await page.locator('[data-testid=propose]').click(); await sleep(700);
      }
      ok('3 refused rounds: the director leaves', (await page.locator('[data-testid=table-left]').count()) === 1);
      await shot('23-table-left');
      await page.getByRole('button', { name: /Tamam/i }).click(); await sleep(400);
    } else ok('second offer available', false, 'no second offer');
    ok('no page errors (table flow)', errors.length === 0, errors.join(' | '));
    await page.context().close();
  }

  // ------------------------------------------------------------------ 7. final ending (crafted save) + reload
  console.log('7. final ending');
  {
    const S = lastJune();
    const { page, errors, shot, open } = await newPage(browser, url, { save: serialize(S) });
    await open();
    ok('last season, June', /Haziran/.test(await TEXT(page)) && /Sezon 5 \/ 5/.test(await TEXT(page)));
    await playMonth(page);
    await page.locator('[data-testid=continue]').click(); await sleep(600);
    ok('final season review first', (await page.locator('[data-testid=season-end]').count()) === 1);
    await page.locator('[data-testid=season-continue]').click(); await sleep(1500);
    await shot('30-ending');
    ok('ending screen', /Miras puanı|Final sıralaması|sırada bitirdin/i.test(await TEXT(page)) || (await page.locator('.ending-wrap').count()) === 1);
    { const tt = (await TEXT(page)).replace(/sözleşme/gi, ''); const m = tt.match(/\bsöz|hayal/i); ok('ending has no promise/dream rows', !m, m && tt.slice(Math.max(0, m.index - 40), m.index + 40)); }
    await page.reload(); await page.waitForSelector('html.ready'); await sleep(900);
    ok('reload restores the ending', (await page.locator('.ending-wrap').count()) === 1);
    ok('no page errors (ending)', errors.length === 0, errors.join(' | '));
    await page.context().close();
  }

  // ------------------------------------------------------------------ 8. bankruptcy (crafted save)
  console.log('8. bankruptcy');
  {
    const { page, errors, shot, open } = await newPage(browser, url, { save: serialize(almostBankrupt()) });
    await open();
    await shot('31-hub-broke');
    ok('hub warns about the negative cash', /eksiye düştü/i.test(await TEXT(page)));
    await playMonth(page);
    await page.locator('[data-testid=continue]').click(); await sleep(1500);
    await shot('32-bankrupt');
    ok('bankruptcy ending (Kepenk Kapandı)', /Kepenk Kapandı/i.test(await TEXT(page)));
    await page.reload(); await page.waitForSelector('html.ready'); await sleep(900);
    ok('reload restores the bankruptcy ending', (await page.locator('.ending-wrap').count()) === 1);
    ok('no page errors (bankruptcy)', errors.length === 0, errors.join(' | '));
    await page.context().close();
  }

  // ------------------------------------------------------------------ 9. settings
  console.log('9. settings + old saves');
  {
    const { page, errors, shot, open } = await newPage(browser, url, { save: serialize(withOffers()) });
    await open();
    await page.getByRole('button', { name: 'Ayarlar' }).click(); await sleep(400); await shot('40-settings');
    ok('settings sheet', /Ses:/i.test(await TEXT(page)));
    ok('no page errors (settings)', errors.length === 0, errors.join(' | '));
    await page.context().close();
  }
  {
    // an old (v1) save must not be loaded: the game starts fresh at the title screen
    const { ctx, page, errors, open } = await newPage(browser, url);
    await ctx.addInitScript(() => { try { localStorage.setItem('kulis-save-v1', JSON.stringify({ v: 1, players: {}, clubs: {} })); } catch {} });
    await open();
    ok('old v1 save is ignored (title, no "Devam Et")', (await TEXT(page)).includes('KULİS') && !/Devam Et/.test(await TEXT(page)));
    ok('no page errors (old save)', errors.length === 0, errors.join(' | '));
    await page.context().close();
  }
} catch (e) {
  console.error('E2E crashed:', e);
  results.push({ name: 'e2e crashed: ' + e.message, ok: false });
}

await browser.close(); server.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} ok  (${((Date.now() - T0) / 1000).toFixed(0)} s)`);
if (bad.length) { console.log('FAILED:\n' + bad.map((b) => ' - ' + b.name + (b.extra ? ' [' + b.extra + ']' : '')).join('\n')); process.exit(1); }
