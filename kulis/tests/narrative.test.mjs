import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, advance } from '../src/engine/game.js';
import { BAL } from '../src/engine/constants.js';
import { myClients } from '../src/engine/selectors.js';
import * as events from '../src/engine/events.js';
import * as tutorial from '../src/engine/tutorial.js';
import * as ending from '../src/engine/ending.js';
import * as news from '../src/engine/news.js';
import { EVENT_TEMPLATES, TUTORIAL_TEMPLATES } from '../src/engine/data/events.js';
import { TELLS, TELL_FACES, PERSONA_IDS, tellLine, LINES, directorLine } from '../src/engine/data/tells.js';
import { NEWS_KINDS, NEWS_TEMPLATES, newsText } from '../src/engine/data/news.js';
import { EPILOGUES, ENDING_TEXTS } from '../src/engine/data/ending.js';
import { ek, eur, fmt } from '../src/engine/data/text.js';
import { assertClean, play } from './helpers.mjs';

const clone = S => JSON.parse(JSON.stringify(S));
const EFFECT_KEYS = new Set(['cash', 'rep', 'energy', 'loyalty', 'morale', 'trust', 'hype', 'form', 'injure', 'know', 'promise', 'interest', 'news', 'flag', 'releaseClient', 'playerId', 'clubId', 'label', ...events.LOCAL_EFFECT_KEYS]);
const BAD = /[{}]|undefined|NaN|\bnull\b/;
const DRAWABLE = EVENT_TEMPLATES.filter(t => t.weight > 0 && !t.followUp);

// ------------------------------------------------------------------ helpers
/** Make as many templates as possible eligible at once; variant picks which flavour of conditions. */
function stress(S, variant, month) {
  S.time.month = month;
  S.agency.rep = 20;
  S.agency.cash = variant === 0 ? 12000 : 80000;
  let cs = myClients(S);
  for (const p of Object.values(S.players)) { if (cs.length >= 3) break; if (!p.agentId && p.age < 30) { p.agentId = 'you'; p.rep = { commissionPct: 7, endSeason: S.time.season + 2 }; cs = myClients(S); } }
  const nl = S.leagues.nl1.clubIds[0], tr = S.leagues.tr1.clubIds;
  cs.forEach((p, i) => {
    p.injured = 3; p.form = -5; p.st.apps = 8; p.st.sh = i === 2 ? 0.8 : 0.1; p.st.last = [8, 7.5, 8, 7.4];
    p.hype = variant === 2 ? 80 : 45; p.loyalty = i === 0 ? 20 : 50; p.morale = 40; p.value = 2e6; p.pa = p.ca + 20; p.nat = 'TR';
    p.contractEnd = S.time.season; p.wage = Math.round(p.wage * 0.5 / 100) * 100 + 100; p.rep = p.rep || { commissionPct: 8, endSeason: S.time.season + 1 };
    p.rep.commissionPct = 8;
    p.trait = ['hirsli', 'sadik', 'paraci', 'yildiz', 'profesyonel'][(i + variant) % 5];
    p.age = [18, 28, 32][(i + variant) % 3];
    if (variant === 1 && i === 0) { p.clubId = nl; p.age = 19; }
    if (variant === 2 && i === 1) { p.age = 27; p.trait = 'sadik'; }
    if (variant === 4) { p.age = 19; p.form = 1; p.hype = 80; p.trait = 'yildiz'; p.loyalty = 50; }
    if (variant === 3) { p.age = [17, 31, 27][i % 3]; p.trait = ['profesyonel', 'yildiz', 'hirsli'][i % 3]; }
  });
  // suitors, rich needy clubs, a friendly director, a poor club
  for (const p of cs) {
    const other = tr.find(c => c !== p.clubId);
    S.interests.push({ id: 'ix' + p.id, playerId: p.id, clubId: other, level: 60, kind: 'transfer', cooldown: 0 });
  }
  for (const cid in S.clubs) {
    const c = S.clubs[cid];
    c.needs = cs.map(p => ({ pos: p.pos, level: 3 }));
    if (variant === 3) c.trust = 55;
  }
  const first = S.clubs[cs[0].clubId];
  first.budget = 1000;
  const L = S.leagues[first.leagueId];
  for (const cid of L.clubIds) L.table[cid].pts = variant % 2 === 0 ? 20 : 5;
  L.table[first.id].pts = variant % 2 === 0 ? 0 : 40;
  const own2 = S.clubs[cs[1].clubId], L2 = S.leagues[own2.leagueId];
  for (const cid of L2.clubIds) L2.table[cid].pts = 5;
  L2.table[own2.id].pts = variant % 2 === 0 ? 40 : 0;
  S.promises = [];
}

function collect(S, seen) {
  const X = events.whenCtx(S);
  const hits = [];
  for (const tpl of EVENT_TEMPLATES) {
    const r = tpl.when(S, X);
    assert.ok(r === false || r === true || r === undefined || r === null || typeof r === 'object' || typeof r === 'number', tpl.key + ' when type');
    const cands = !r ? [] : r === true ? [{}] : Array.isArray(r) ? r : [r];
    for (const c of cands) { assertClean(c, tpl.key + '.cand'); hits.push({ tpl, cand: c }); seen.add(tpl.key); }
  }
  return hits;
}

function checkCard(card, tpl) {
  for (const f of ['title', 'body', 'from']) assert.ok(typeof card[f] === 'string' && card[f].length > 0 && !BAD.test(card[f]), tpl.key + ' ' + f + ': ' + card[f]);
  assert.ok(card.options.length >= 2, tpl.key + ' options');
  const free = card.options.filter(o => !o.cost.energy && !o.cost.cash);
  assert.ok(free.length >= 1, tpl.key + ' needs a free option');
  assert.ok(card.options.some(o => o.id === card.defaultOption) || !card.defaultOption, tpl.key + ' default option');
  if (card.defaultOption) { const d = card.options.find(o => o.id === card.defaultOption); assert.ok(d && !d.cost.energy && !d.cost.cash, tpl.key + ' default must be free'); }
  assert.equal(new Set(card.options.map(o => o.id)).size, card.options.length);
  for (const o of card.options) {
    for (const f of ['label', 'hint']) assert.ok(typeof o[f] === 'string' && !BAD.test(o[f]), tpl.key + '/' + o.id + ' ' + f + ': ' + o[f]);
    assert.ok(o.label.length > 0);
    if (o.risk) { assert.ok(o.risk.pct > 0 && o.risk.pct < 100 && o.risk.text && !BAD.test(o.risk.text), tpl.key + ' risk'); }
    for (const e of o.preview.concat(o.riskPreview || [])) assert.ok(Number.isFinite(e.value) || typeof e.value === 'string', tpl.key + ' preview');
  }
}

function checkEffectKeys(tpl, S, cand) {
  const c = JSON.parse(JSON.stringify(cand));
  const R = events.renderCtx(S, c);
  for (const o of tpl.options) {
    for (const f of ['effects', 'altEffects']) {
      const ef = o[f];
      if (!ef) continue;
      const list = typeof ef === 'function' ? ef(S, c, R) : ef;
      assert.ok(Array.isArray(list), tpl.key + '/' + o.id + ' ' + f + ' array');
      for (const e of list) for (const k in e) {
        assert.ok(EFFECT_KEYS.has(k), tpl.key + '/' + o.id + ' unknown effect key ' + k);
        if (typeof e[k] === 'number') assert.ok(Number.isFinite(e[k]), tpl.key + ' effect NaN ' + k);
      }
    }
    if (o.altEffects || o.risk) assert.ok(o.risk && o.altEffects !== undefined, tpl.key + '/' + o.id + ' risk needs altEffects');
  }
}

// ------------------------------------------------------------------ text helpers
test('turkish suffix helper and money format', () => {
  assert.equal(ek('Kerem', 'gen'), "Kerem'in");
  assert.equal(ek('Kerem', 'dat'), "Kerem'e");
  assert.equal(ek('Ali', 'acc'), "Ali'yi");
  assert.equal(ek('Burak', 'abl'), "Burak'tan");
  assert.equal(ek('Salih', 'gen'), "Salih'in");
  assert.equal(ek('Karadeniz Spor', 'gen'), "Karadeniz Spor'un");
  assert.equal(ek('Özkan', 'dat'), "Özkan'a");
  assert.equal(ek('İlhan', 'loc'), "İlhan'da");
  assert.equal(eur(850), '€850');
  assert.equal(eur(450000), '€450K');
  assert.equal(eur(1250000), '€1,25M');
  assert.equal(fmt('{a} ve {b:gen} {amount}', { a: 'x', b: 'Kemal', amount: 4000 }), "x ve Kemal'ın €4K");
});

// ------------------------------------------------------------------ templates
test('≥ 45 templates with unique keys and valid static structure', () => {
  assert.ok(DRAWABLE.length >= 45, 'drawable ' + DRAWABLE.length);
  const keys = new Set();
  for (const t of EVENT_TEMPLATES.concat(TUTORIAL_TEMPLATES)) {
    assert.ok(!keys.has(t.key), 'dup ' + t.key); keys.add(t.key);
    assert.equal(typeof t.when, 'function', t.key);
    assert.ok(t.kind && t.title && t.body && t.from, t.key);
    assert.ok(t.options.length >= 1 && t.expiresIn >= 1, t.key);
    assert.ok(t.options.some(o => o.id === t.defaultOption), t.key + ' defaultOption');
  }
  const kinds = new Set(DRAWABLE.map(t => t.kind));
  assert.ok(kinds.size >= 10, 'kinds ' + [...kinds]);
  assert.ok(DRAWABLE.some(t => t.heavy) && DRAWABLE.filter(t => t.options.some(o => o.risk)).length >= 12);
});

test('every template renders and resolves on real states (fresh, simulated, stressed)', () => {
  const seen = new Set();
  const rendered = new Set();
  let cardsTried = 0;
  const check = (S) => {
    for (const { tpl, cand } of collect(S, seen)) {
      const C = clone(S);
      const card = events.spawn(C, tpl.key, cand);
      assert.ok(card, tpl.key);
      checkCard(card, tpl);
      if (rendered.has(tpl.key)) continue;
      rendered.add(tpl.key);
      checkEffectKeys(tpl, C, cand);
      // answer every option, both risk branches, on clones; the state must stay clean
      for (const opt of card.options) {
        for (const branch of opt.risk ? [0, 100] : [null]) {
          const D = clone(C);
          D.agency.energy = 6; D.agency.cash = Math.max(D.agency.cash, 500000);
          const dc = D.inbox.find(x => x.id === card.id);
          if (branch !== null) dc.options.find(o => o.id === opt.id).risk.pct = branch;
          const r = events.answerInbox(D, { inboxId: dc.id, optionId: opt.id });
          assert.ok(r.ok, tpl.key + '/' + opt.id + ': ' + r.error);
          assert.equal(typeof r.resultText, 'string');
          assert.ok(!BAD.test(r.resultText), tpl.key + '/' + opt.id + ' result: ' + r.resultText);
          if (branch !== null) assert.equal(r.riskFired, branch === 100);
          assert.ok(!D.inbox.some(x => x.id === card.id));
          assertClean(D);
          cardsTried++;
        }
      }
    }
  };
  for (const seed of [11, 12, 13]) {
    const S = newGame({ seed });
    S.agency.cash = 5e6;
    check(S);
    play(S, 14); check(S);
    play(S, 20); check(S);
    for (const variant of [0, 1, 2, 3, 4]) for (const month of [1, 6, 8, 3]) {
      const T = clone(S);
      if (T.time.phase !== 'plan') continue;
      stress(T, variant, month);
      check(T);
    }
  }
  const missing = DRAWABLE.map(t => t.key).filter(k => !seen.has(k));
  assert.deepEqual(missing, [], 'templates never eligible: ' + missing);
  const unrendered = EVENT_TEMPLATES.filter(t => !rendered.has(t.key)).map(t => t.key);
  assert.deepEqual(unrendered.filter(k => !['loan_due', 'loan_offer'].includes(k)), []);
  assert.ok(cardsTried > 100);
});

test('follow-up and special cards render with their own vars', () => {
  const S = newGame({ seed: 5 });
  S.inbox = [];
  for (const key of ['loan_due', 'loan_offer']) {
    const c = events.spawn(S, key, {});
    checkCard(c, events.TEMPLATES[key]);
    assert.ok(c.body.includes('€'));
  }
});

// ------------------------------------------------------------------ answerInbox
test('answerInbox: errors, cost checks, no side effects on failure', () => {
  const S = newGame({ seed: 3 });
  S.inbox = [];
  const p = myClients(S)[0];
  const card = events.spawn(S, 'injury_visit', { playerId: p.id, months: 2, amount: 5000 });
  assert.equal(act(S, 'answerInbox', {}).ok, false);
  assert.equal(events.answerInbox(S, { inboxId: 'nope', optionId: 'x' }).ok, false);
  assert.equal(events.answerInbox(S, { inboxId: card.id, optionId: 'zzz' }).ok, false);
  S.agency.energy = 0;
  const a = events.answerInbox(S, { inboxId: card.id, optionId: 'visit' });
  assert.equal(a.ok, false); assert.ok(a.error);
  S.agency.energy = 4; S.agency.cash = 100;
  const rng0 = S.rng, loy = p.loyalty;
  const b = events.answerInbox(S, { inboxId: card.id, optionId: 'physio' });
  assert.equal(b.ok, false);
  assert.equal(S.rng, rng0); assert.equal(p.loyalty, loy); assert.equal(S.inbox.length, 1);
  S.agency.cash = 20000;
  p.injured = 3;
  const c = events.answerInbox(S, { inboxId: card.id, optionId: 'physio' });
  assert.ok(c.ok && c.resultText.includes(p.name));
  assert.equal(S.agency.cash, 15000);
  assert.equal(p.injured, 2); // heal 1
  assert.equal(S.inbox.length, 0);
  const led = S.ledger[0].items.find(i => i.k === 'event');
  assert.ok(led && led.amt === -5000);
  // energy cost
  const card2 = events.spawn(S, 'injury_visit', { playerId: p.id, months: 2, amount: 5000 });
  const e0 = S.agency.energy, m0 = p.morale;
  assert.ok(events.answerInbox(S, { inboxId: card2.id, optionId: 'visit' }).ok);
  assert.equal(S.agency.energy, e0 - 1);
  assert.ok(p.morale > m0);
});

test('risk is rolled through the rng with the shown odds', () => {
  const S = newGame({ seed: 4 });
  const p = myClients(S)[0];
  let fired = 0; const N = 600;
  for (let i = 0; i < N; i++) {
    S.inbox = []; S.agency.energy = 4;
    const card = events.spawn(S, 'form_slump', { playerId: p.id, amount: 3000 });
    const sw = events.spawn(S, 'teammate_fight', { playerId: p.id, clubId: p.clubId });
    const opt = sw.options.find(o => o.id === 'mediate');
    assert.equal(opt.risk.pct, 30);
    const r = events.answerInbox(S, { inboxId: sw.id, optionId: 'mediate' });
    if (r.riskFired) fired++;
    void card;
  }
  assert.ok(Math.abs(fired / N - 0.3) < 0.06, 'rate ' + fired / N);
  // altEffects applied only when it fires
  S.inbox = [];
  const sw = events.spawn(S, 'teammate_fight', { playerId: p.id, clubId: p.clubId });
  sw.options.find(o => o.id === 'mediate').risk.pct = 100;
  const club = S.clubs[p.clubId], t0 = club.trust;
  const r = events.answerInbox(S, { inboxId: sw.id, optionId: 'mediate' });
  assert.ok(r.riskFired && club.trust === t0 - 4);
});

test('expiry applies the default option; must cards stay; cooldown bookkeeping', () => {
  const S = newGame({ seed: 6 });
  S.inbox = [];
  const p = myClients(S)[0];
  const card = events.spawn(S, 'client_birthday', { playerId: p.id, amount: 1000 });
  const loy = p.loyalty;
  const must = events.spawn(S, 'client_birthday', { playerId: myClients(S)[1].id, amount: 1000 }, { must: true });
  const ev = events.monthly(S); // 2 → 1
  assert.ok(S.inbox.some(c => c.id === card.id));
  const ev2 = events.monthly(S); // 1 → 0: expire
  assert.ok(!S.inbox.some(c => c.id === card.id), 'expired');
  assert.ok(ev2.some(e => e.type === 'inboxExpired' && e.cardId === card.id));
  assert.ok(p.loyalty < loy || p.loyalty === 0);
  assert.ok(S.inbox.some(c => c.id === must.id), 'must card stays');
  assert.ok(ev.length >= 0);
  assert.ok(S.flags.evCool && Object.keys(S.flags.evCool).length >= 0);
  // monthly generation respects cooldowns, once, the cap and avoids the same player twice in a month
  const T = newGame({ seed: 8 });
  T.inbox = []; T.flags.tutorial.done = true;
  const abs = [];
  for (let i = 0; i < 20; i++) {
    const before = T.inbox.map(c => c.id);
    events.monthly(T);
    const fresh = T.inbox.filter(c => !before.includes(c.id));
    assert.ok(fresh.length <= 4);
    const pids = fresh.map(c => c.playerId).filter(Boolean);
    assert.equal(new Set(pids).size, pids.length, 'same player twice in one month');
    abs.push(...fresh.map(c => c.key));
    assert.ok(T.inbox.length <= BAL.events.inboxCap);
    T.time.month = (T.time.month + 1) % 12; if (T.time.month === 0) T.time.season++;
    T.inbox = T.inbox.slice(0, 4);
  }
  assert.ok(new Set(abs).size >= 8, 'variety ' + new Set(abs).size);
});

test('local effect primitives: heal, sellTo, queue follow-up, directorMove, commission, scout', () => {
  const S = newGame({ seed: 9 });
  S.inbox = [];
  const [p, q] = myClients(S);
  p.injured = 3; p.rep.commissionPct = 8;
  const rv = S.rivals[0];
  const card = events.spawn(S, 'agency_buyout', { playerId: p.id, rivalId: rv.id, amount: 100000 });
  const cash0 = S.agency.cash;
  assert.ok(events.answerInbox(S, { inboxId: card.id, optionId: 'sell' }).ok);
  assert.equal(p.agentId, rv.id); assert.equal(S.agency.cash, cash0 + 100000);
  assert.ok(S.news[0] && S.news[0].text.includes(p.name), S.news[0] && S.news[0].text);
  // queue → loan_due appears after 3 months
  S.agency.cash = 10000; S.inbox = [];
  const f = events.spawn(S, 'friend_loan', { amount: 25000, amount2: 28000 });
  assert.ok(events.answerInbox(S, { inboxId: f.id, optionId: 'take' }).ok);
  assert.equal(S.agency.cash, 35000);
  S.flags.tutorial.done = true;
  for (let i = 0; i < 4; i++) { events.monthly(S); S.time.month++; if (S.inbox.some(c => c.key === 'loan_due')) break; }
  assert.ok(S.inbox.some(c => c.key === 'loan_due'), 'follow-up appeared');
  // director move swaps directors
  const ids = Object.keys(S.clubs), A = S.clubs[ids[0]], B = S.clubs[ids[20]];
  const dirA = A.director.name;
  S.inbox = [];
  const dm = events.spawn(S, 'director_moves', { clubId: A.id, clubBId: B.id });
  assert.ok(events.answerInbox(S, { inboxId: dm.id, optionId: 'note' }).ok);
  assert.equal(B.director.name, dirA); assert.notEqual(A.director.name, dirA);
  // commission + scout
  S.inbox = [];
  const cc = events.spawn(S, 'commission_complaint', { playerId: q.id, pct: 8 });
  q.rep.commissionPct = 8;
  assert.ok(events.answerInbox(S, { inboxId: cc.id, optionId: 'cut' }).ok);
  assert.equal(q.rep.commissionPct, 7);
  const pr = Object.values(S.players).find(x => !x.agentId && !x.seen);
  const yt = events.spawn(S, 'youth_tip', { playerId: pr.id, clubId: pr.clubId, scout: 'Cemal Usta', amount: 1200 });
  S.agency.energy = 4; S.agency.cash = 50000;
  assert.ok(events.answerInbox(S, { inboxId: yt.id, optionId: 'go' }).ok);
  assert.ok(pr.seen && pr.know >= 35);
});

test('cards from other modules (no template) resolve from their own option effects', () => {
  const S = newGame({ seed: 12 });
  S.inbox = [];
  const p = myClients(S)[0];
  const card = events.addCard(S, {
    key: 'rival_poach', kind: 'rakip', title: 'Rakip kapıda', body: 'Test', playerId: p.id, defaultOption: 'let',
    options: [
      { id: 'match', label: 'Karşıla', hint: '', cost: { energy: 0, cash: 1000 }, risk: { pct: 100, text: 'x' }, effects: [{ loyalty: 20 }], altEffects: [{ loyalty: -20 }], resultText: 'iyi', altResultText: 'kötü' },
      { id: 'let', label: 'Bırak', hint: '', cost: { energy: 0, cash: 0 }, risk: null, effects: [{ releaseClient: p.id }], resultText: 'gitti' },
    ],
  });
  p.loyalty = 50; S.agency.cash = 5000;
  const r = events.answerInbox(S, { inboxId: card.id, optionId: 'match' });
  assert.ok(r.ok && r.riskFired && r.resultText === 'kötü' && p.loyalty === 30 && S.agency.cash === 4000);
  const c2 = events.addCard(S, { key: 'rival_poach', title: 'T', body: 'B', playerId: p.id, expiresIn: 1, defaultOption: 'let', options: [{ id: 'let', label: 'Bırak', hint: '', cost: { energy: 0, cash: 0 }, risk: null, effects: [{ releaseClient: p.id }] }] });
  S.flags.tutorial.done = true;
  events.monthly(S);
  assert.ok(!S.inbox.some(c => c.id === c2.id) && p.agentId === null);
});

test('bank loan card takes the loan through economy', () => {
  const S = newGame({ seed: 10 });
  S.inbox = []; S.flags.tutorial.done = true;
  S.agency.loanOffered = true; S.flags.loanOfferPending = true; S.agency.cash = -1000;
  events.monthly(S);
  const card = S.inbox.find(c => c.key === 'loan_offer');
  assert.ok(card);
  const r = events.answerInbox(S, { inboxId: card.id, optionId: 'take' });
  assert.ok(r.ok);
  assert.equal(S.agency.cash, -1000 + BAL.econ.loan.amount);
  assert.ok(S.agency.loan);
  S.flags.loanOfferPending = false;
  events.monthly(S);
  assert.ok(!S.inbox.some(c => c.key === 'loan_offer'));
});

// ------------------------------------------------------------------ tutorial
test('tutorial: scripted sequence progresses with the real actions', () => {
  const S = newGame({ seed: 21 });
  assert.equal(S.inbox.length, 1);
  assert.equal(S.inbox[0].key, 'tut_welcome');
  assert.ok(S.inbox.every(c => !c.must));
  const keys = () => S.inbox.map(c => c.key).filter(k => k.startsWith('tut_'));
  const words = c => c.body.split(/\s+/).length;
  assert.ok(words(S.inbox[0]) <= 45);
  assert.equal(act(S, 'answerInbox', { inboxId: S.inbox[0].id, optionId: 'ok' }).ok, true);
  assert.deepEqual(keys(), ['tut_visit']);
  assert.ok(words(S.inbox[0]) <= 45);
  tutorial.onAction(S, 'visitClient', { ok: false });
  assert.deepEqual(keys(), ['tut_visit'], 'failed actions do not advance');
  tutorial.onAction(S, 'visitClient', { ok: true, events: [] });
  assert.deepEqual(keys(), ['tut_scout']);
  tutorial.onAction(S, 'scoutTrip', { ok: true });
  assert.deepEqual(keys(), ['tut_market']);
  tutorial.onAction(S, 'clubLunch', { ok: true });
  assert.deepEqual(keys(), ['tut_interest']);
  const t = S.flags.tutorial;
  assert.ok(t.target);
  const it = S.interests.find(i => i.playerId === t.target.playerId && i.clubId === t.target.clubId);
  assert.ok(it && it.level >= BAL.neg.minLevel, 'guaranteed interest ≥ 60');
  assert.equal(S.clubs[t.target.clubId].director.persona, 'durust');
  assert.notEqual(S.players[t.target.playerId].clubId, t.target.clubId);
  const card = S.inbox.find(c => c.key === 'tut_interest');
  assert.ok(card.body.includes(S.clubs[t.target.clubId].name) && card.body.includes(S.clubs[t.target.clubId].director.name));
  assert.ok(words(card) <= 45);
  tutorial.onAction(S, 'openNegotiation', { ok: true });
  assert.deepEqual(keys(), []);
  assert.equal(tutorial.currentStep(S), 'promises');
  tutorial.monthly(S);
  assert.deepEqual(keys(), ['tut_promises']);
  assert.ok(words(S.inbox.find(c => c.key === 'tut_promises')) <= 45);
  assert.ok(events.answerInbox(S, { inboxId: S.inbox.find(c => c.key === 'tut_promises').id, optionId: 'ok' }).ok);
  assert.deepEqual(keys(), []);
  tutorial.monthly(S);
  assert.deepEqual(keys(), ['tut_ranking']);
  const cash = S.agency.cash;
  assert.ok(events.answerInbox(S, { inboxId: S.inbox.find(c => c.key === 'tut_ranking').id, optionId: 'ok' }).ok);
  assert.ok(S.flags.tutorial.done && S.agency.cash === cash + 3000);
  assert.ok(!tutorial.active(S));
  for (const tt of TUTORIAL_TEMPLATES) assert.ok(tt.body.length > 0);
});

test('tutorial: actions done early are skipped, dismissed cards come back, skip works', () => {
  const S = newGame({ seed: 22 });
  tutorial.onAction(S, 'scoutTrip', { ok: true });
  tutorial.onAction(S, 'visitClient', { ok: true });
  events.answerInbox(S, { inboxId: S.inbox[0].id, optionId: 'ok' });
  // visit and scout were already done → straight to the market step
  assert.equal(tutorial.currentStep(S), 'market');
  const c = S.inbox.find(x => x.key === 'tut_market');
  events.answerInbox(S, { inboxId: c.id, optionId: 'ok' }); // dismissed without doing it
  assert.equal(S.inbox.filter(x => x.key.startsWith('tut_')).length, 0);
  assert.equal(tutorial.currentStep(S), 'market');
  tutorial.monthly(S);
  assert.ok(S.inbox.some(x => x.key === 'tut_market'), 'nudged again');
  // skip
  const T = newGame({ seed: 23 });
  assert.ok(events.answerInbox(T, { inboxId: T.inbox[0].id, optionId: 'skip' }).ok);
  assert.ok(T.flags.tutorial.skipped && T.flags.tutorial.done);
  assert.equal(T.inbox.length, 0);
  assert.deepEqual(tutorial.monthly(T), []);
});

test('tutorial: first suitor survives the month and the real month loop is not blocked', () => {
  const S = newGame({ seed: 24 });
  events.answerInbox(S, { inboxId: S.inbox[0].id, optionId: 'ok' });
  tutorial.onAction(S, 'visitClient', { ok: true }); tutorial.onAction(S, 'scoutTrip', { ok: true }); tutorial.onAction(S, 'pitchPlayer', { ok: true });
  const t = S.flags.tutorial;
  S.interests = S.interests.filter(i => i.clubId !== t.target.clubId); // the market module dropped it
  S.time.month = 0;
  tutorial.monthly(S);
  assert.ok(S.interests.some(i => i.clubId === t.target.clubId && i.level >= 60));
  const r = advance(S);
  assert.ok(r.ok);
  assert.ok(S.inbox.filter(c => !c.key.startsWith('tut_')).length <= BAL.events.tutorialCards);
});

// ------------------------------------------------------------------ tells
test('tells: 5 personas × 5 levels × ≥3 variants, deterministic', () => {
  assert.deepEqual(PERSONA_IDS.slice().sort(), ['cimri', 'durust', 'gosterisci', 'kurnaz', 'sabirsiz']);
  for (const persona of PERSONA_IDS) {
    assert.equal(TELLS[persona].length, 5);
    for (let lv = 0; lv < 5; lv++) {
      const t = TELLS[persona][lv];
      assert.ok(t.lines.length >= 3, persona + lv);
      assert.ok(TELL_FACES.includes(t.face));
      assert.equal(new Set(t.lines).size, t.lines.length);
      const seen = new Set();
      for (let n = 0; n < t.lines.length; n++) {
        const a = tellLine(persona, lv, n), b = tellLine(persona, lv, n);
        assert.deepEqual(a, b);
        assert.equal(a.face, t.face); assert.ok(a.line.length > 3 && !BAD.test(a.line));
        seen.add(a.line);
      }
      assert.equal(seen.size, t.lines.length);
      assert.deepEqual(tellLine(persona, lv), tellLine(persona, lv, 0));
      assert.equal(tellLine(persona, lv, t.lines.length).line, t.lines[0]);
    }
    for (const kind of ['accept', 'counter', 'insult', 'walkout', 'bluffCaught', 'bluffWorked']) {
      assert.ok(LINES[kind][persona].length >= 3, kind + persona);
      assert.equal(directorLine(persona, kind, 1), LINES[kind][persona][1]);
    }
  }
  assert.deepEqual(new Set(PERSONA_IDS.flatMap(p => TELLS[p].map(t => t.face))), new Set(TELL_FACES));
  assert.equal(tellLine('bilinmeyen', 9, 2).face.length > 0, true);
});

// ------------------------------------------------------------------ news
test('news: ≥ 6 variants per kind, tabloid texts render cleanly, cap 80', () => {
  const required = ['transferYou', 'transferAI', 'transferRival', 'rivalSign', 'dreamFulfilled', 'promiseKept', 'promiseBroken', 'champion', 'promoted', 'relegated', 'award', 'injury', 'bankruptcyWarning', 'wonderkidBreakout', 'deadlineDrama', 'objectiveDone'];
  for (const k of required) assert.ok(NEWS_KINDS.includes(k), k);
  const ctx = { name: 'Kerem Yılmaz', from: 'Anadolu Gücü', to: 'Karadeniz Spor', club: 'Karadeniz Spor', league: 'Süper Lig', fee: 2500000, goals: 14, agency: 'Tuna Akademi', award: 'Yılın Genç Oyuncusu', months: 3, objective: '€300K komisyon kazan' };
  for (const k of NEWS_KINDS) {
    assert.ok(NEWS_TEMPLATES[k].length >= 6, k + ' ' + NEWS_TEMPLATES[k].length);
    const texts = new Set();
    for (const fn of NEWS_TEMPLATES[k]) {
      for (const c of [ctx, {}, { name: 'Ali' }, { ...ctx, fee: 0 }]) { const tx = fn(c); assert.ok(typeof tx === 'string' && tx.length > 8 && !BAD.test(tx), k + ': ' + tx); }
      texts.add(fn(ctx));
    }
    assert.ok(texts.size >= 6, k);
  }
  // transfer dispatch, determinism, variety across contexts
  assert.equal(newsText('transfer', { ...ctx, side: 'you' }), newsText('transferYou', ctx));
  assert.equal(newsText('transfer', { ...ctx, side: 'rival' }), newsText('transferRival', ctx));
  assert.equal(newsText('champion', ctx), newsText('champion', ctx));
  const variety = new Set();
  for (let i = 0; i < 40; i++) variety.add(newsText('transferAI', { ...ctx, name: 'Oyuncu ' + i }));
  assert.ok(variety.size >= 20);
  assert.equal(newsText('genel', { text: 'Haber' }), 'Haber');
  assert.ok(newsText('bilinmeyen', {}).length > 0);
  const S = newGame({ seed: 2 });
  for (let i = 0; i < 120; i++) news.push(S, { kind: 'injury', ctx: { name: 'N' + i, months: 2 } });
  assert.equal(S.news.length, 80);
  assert.ok(S.news[0].text.includes('N119'));
});

// ------------------------------------------------------------------ ending
function fakeCareer(S) {
  const ps = myClients(S);
  S.flags.cl = {};
  ps.forEach((p, i) => {
    S.flags.cl[p.id] = { id: p.id, name: p.name, since: 1, startCa: 50, peakCa: i === 0 ? 70 : 52, peakValue: [20e6, 3e6, 1e6][i % 3], titles: i === 0 ? 2 : 0, scorer: 0, apps: 80, goals: 20, clubs: [p.clubId], status: ['client', 'left', 'retired'][i % 3], trait: p.trait, loyalty: [75, 20, 50][i % 3], dream: { type: ['top_league', 'champion', 'star'][i % 3], done: i === 0 } };
  });
}
test('ending: legacy formula, tiers, epilogues, endless', () => {
  const S = newGame({ seed: 31 });
  fakeCareer(S);
  S.history = [{ season: 1 }, { season: 2 }];
  const base = ending.legacyScore(S);
  assert.ok(Number.isFinite(base) && base >= 0);
  S.agency.stats.dreams += 1; assert.equal(ending.legacyScore(S), base + BAL.legacy.dream);
  S.agency.stats.promisesBroken += 1; assert.equal(ending.legacyScore(S), base + BAL.legacy.dream + BAL.legacy.broken);
  S.agency.stats.promisesBroken -= 1; S.agency.stats.dreams -= 1;
  S.agency.stats.promisesKept += 4; S.agency.stats.commission += 500000;
  assert.ok(ending.legacyScore(S) > base);
  for (const kind of ['efsane', 'buyuk', 'saygin', 'siradan', 'iflas', 'yalniz']) {
    const T = clone(S);
    const e = ending.build(T, kind);
    assert.equal(e.kind, kind); assert.equal(T.ending, e); assert.equal(T.time.phase, 'over');
    assert.ok(e.title && e.text && !BAD.test(e.text), kind);
    assert.ok(e.rank >= 1 && e.rank <= 5 && Number.isFinite(e.legacy));
    assert.ok(e.stats.length >= 8 && e.stats.every(r => r.label && typeof r.value === 'string' && !BAD.test(r.value)));
    assert.ok(e.epilogues.length >= 1 && e.epilogues.length <= BAL.ending.epilogueMax);
    for (const ep of e.epilogues) { assert.ok(ep.playerId && ep.name && ep.text.length > 20 && !BAD.test(ep.text), ep.text); assert.ok(['good', 'neutral', 'bitter'].includes(ep.tone)); }
    assertClean(T);
    const cont = ending.continueEndless(T);
    assert.equal(cont.ok, !['iflas', 'yalniz'].includes(kind), kind);
    if (cont.ok) { assert.equal(T.time.phase, 'plan'); assert.equal(T.meta.careerSeasons, 999); }
  }
  // tiers from 'kariyer'
  const T = clone(S);
  T.ranking = [{ id: 'you' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }];
  T.agency.stats.commission = 5e7; T.agency.stats.dreams = 5;
  assert.equal(ending.build(T, 'kariyer').kind, 'efsane');
  const U = clone(S);
  U.ranking = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }, { id: 'you' }];
  U.agency.rep = 10; U.agency.stats = { deals: 0, commission: 0, promisesKept: 0, promisesBroken: 3, bluffsCaught: 0, dreams: 0 };
  assert.equal(ending.build(U, 'kariyer').kind, 'siradan');
  assert.equal(ending.build(clone(S), 'musterisiz').kind, 'yalniz');
  // epilogue data: ≥ 4 variants per tone, three tones occur for the fake career
  for (const tone of ['good', 'neutral', 'bitter']) assert.ok(EPILOGUES[tone].length >= 4);
  for (const k in ENDING_TEXTS) assert.ok(ENDING_TEXTS[k].length >= 3);
  const tones = new Set(ending.build(clone(S), 'siradan').epilogues.map(e => e.tone));
  assert.ok(tones.size >= 2, [...tones]);
  // every variant of every tone renders cleanly
  for (const tone in EPILOGUES) for (const tx of EPILOGUES[tone]) assert.ok(!BAD.test(fmt(tx, { name: 'Kerem', club: 'X Spor', peak: 70, dream: 'Hayal gerçek oldu.' })), tx);
  // continuing twice is refused
  const V = clone(S); ending.build(V, 'saygin'); assert.ok(ending.continueEndless(V).ok); assert.equal(ending.continueEndless(V).ok, false);
});

test('ending: career tracking records peaks, titles and departures', () => {
  const S = newGame({ seed: 32 });
  S.inbox = []; S.flags.tutorial.done = true;
  const [p, q] = myClients(S);
  p.value = 9e6; events.monthly(S);
  assert.equal(S.flags.cl[p.id].peakValue, 9e6);
  p.value = 1e6; events.monthly(S);
  assert.equal(S.flags.cl[p.id].peakValue, 9e6);
  q.agentId = null; q.rep = null; events.monthly(S);
  assert.equal(S.flags.cl[q.id].status, 'left');
  delete S.players[q.id]; S.flags.cl[q.id].status = 'client'; events.monthly(S);
  assert.equal(S.flags.cl[q.id].status, 'retired');
  // title in June counts only with enough appearances
  S.time.month = 11; p.st.apps = 12;
  const L = S.leagues[S.clubs[p.clubId].leagueId];
  for (const cid of L.clubIds) L.table[cid].pts = 3;
  L.table[p.clubId].pts = 99;
  events.monthly(S);
  assert.equal(S.flags.cl[p.id].titles, 1);
  events.monthly(S);
  assert.equal(S.flags.cl[p.id].titles, 1, 'counted once per season');
});

// ------------------------------------------------------------------ long run
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

for (const seed of [101, 202, 303]) {
  test('8-season run answering a random option on every card, seed ' + seed, () => {
    const S = newGame({ seed });
    const r = lcg(seed * 7 + 1);
    const log = [];
    let answered = 0, maxInbox = 0, fired = 0;
    const kinds = new Set();
    for (let m = 0; m < 96 && S.time.phase !== 'over'; m++) {
      for (const card of S.inbox.slice()) {
        S.agency.energy = Math.max(S.agency.energy, 2);
        const opts = card.options.slice().sort(() => r() - 0.5);
        let res = null;
        for (const o of opts) { res = events.answerInbox(S, { inboxId: card.id, optionId: o.id }); if (res.ok) break; }
        if (!res || !res.ok) res = events.answerInbox(S, { inboxId: card.id, optionId: card.defaultOption || card.options[0].id });
        if (res.ok) { answered++; kinds.add(card.key); if (res.riskFired) fired++; assert.ok(!BAD.test(res.resultText), res.resultText); }
        else S.inbox = S.inbox.filter(c => c.id !== card.id);
      }
      play(S, 1);
      assertClean(S);
      maxInbox = Math.max(maxInbox, S.inbox.length);
      assert.ok(S.inbox.length <= BAL.events.inboxCap, 'inbox ' + S.inbox.length);
      for (const c of S.inbox) { assert.ok(c.options.length >= 1 && c.title && !BAD.test(c.body), c.key); assert.ok(Number.isFinite(c.expiresIn)); }
      assert.ok(Number.isFinite(S.agency.cash) && Number.isFinite(S.agency.rep) && S.agency.rep >= 0 && S.agency.rep <= 100);
      log.push(S.inbox.map(c => c.key).join(','));
    }
    assert.ok(answered >= 60, 'answered ' + answered);
    assert.ok(kinds.size >= 15, 'variety ' + kinds.size);
    assert.equal(S.time.phase, 'over');
    assert.ok(S.ending && ['efsane', 'buyuk', 'saygin', 'siradan', 'yalniz'].includes(S.ending.kind), S.ending && S.ending.kind);
    assert.ok(S.ending.epilogues.length >= 1, 'epilogues');
    for (const c of Object.values(S.players)) assert.ok(c.loyalty >= 0 && c.loyalty <= 100 && c.morale >= 0 && c.morale <= 100 && c.hype >= 0 && c.hype <= 100);
    assert.ok(maxInbox <= 8);
    assert.ok(S.news.length <= 80);
    void fired;
  });
}

test('narrative is deterministic per seed', () => {
  const run = () => {
    const S = newGame({ seed: 77 });
    const out = [];
    for (let m = 0; m < 30; m++) {
      for (const c of S.inbox.slice()) events.answerInbox(S, { inboxId: c.id, optionId: c.defaultOption || c.options[0].id });
      play(S, 1);
      out.push(S.inbox.map(c => c.key + ':' + c.body.length).join('|'));
    }
    return out.join('\n') + JSON.stringify(S.news.slice(0, 5));
  };
  assert.equal(run(), run());
});
