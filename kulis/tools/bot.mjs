#!/usr/bin/env node
// Headless bots playing whole KULİS careers through the public API only (game.js act/advance + selectors).
//   node tools/bot.mjs --bot sharp --seeds 20 --seasons 8
//   node tools/bot.mjs --bot all --seeds 30            (every bot, aggregate table)
//   node tools/bot.mjs --bot sharp --trace 7           (month-by-month story of seed 7)
// Options: --bot passive|casual|sharp|greedy|fuzz|all  --seeds N  --seed0 N  --seasons N  --trace [seed]  --seasons-table  --quiet
import { newGame, act, advance, serialize, deserialize } from '../src/engine/game.js';
import * as sel from '../src/engine/selectors.js';
import { MONTHS, BAL } from '../src/engine/constants.js';

// ------------------------------------------------------------------ tiny deterministic rng for the bots themselves
function mkRng(seed) {
  let s = (seed * 2654435761 + 12345) >>> 0;
  const r = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.chance = p => r() < p;
  return r;
}

const tidy = v => (v >= 20000 ? Math.round(v / 1000) * 1000 : Math.round(v / 100) * 100);
const GAP_MID = [0.03, 0.085, 0.17, 0.285, 0.45]; // midpoint of the director's tell levels (gap = (C-K)/K)

// ------------------------------------------------------------------ run context
function makeCtx(seed, opts) {
  const S = newGame({ seed, agentName: 'Bot', agencyName: 'Bot Ajans', archetype: opts.archetype || 'mahalle', careerSeasons: opts.seasons });
  const ctx = {
    S, seed, rnd: mkRng(seed), opts, log: [], trace: !!opts.trace, errors: [],
    tables: { won: 0, lost: 0, rounds: [], opened: 0, hesitated: 0, why: {} },
    seasonRows: [], last: { commission: 0, deals: 0, won: 0, lost: 0 }, month: 0, flags: {},
    exceptions: [], pacing: { energyLeft: 0, months: 0, cards: 0, inboxWaiting: 0 },
  };
  ctx.say = s => { if (ctx.trace) ctx.log.push(s); };
  ctx.do = (id, payload = {}) => {
    const r = act(S, id, payload);
    if (typeof r !== 'object' || typeof r.ok !== 'boolean') throw new Error('bad Result shape from ' + id);
    if (!r.ok && typeof r.error !== 'string') throw new Error('Result without error text from ' + id);
    if (ctx.trace && r.ok && !['negPropose', 'negPreview', 'recruitPreview', 'pitchPreview', 'upgradePreview', 'tripPreview'].includes(id)) ctx.say('  · ' + id + ' ' + brief(payload));
    return r;
  };
  return ctx;
}
function brief(p) { const o = {}; for (const k in p) { const v = p[k]; if (typeof v === 'object' && v) continue; o[k] = v; } return JSON.stringify(o); }
const pname = (S, id) => (S.players[id] ? S.players[id].name : id);
const cname = (S, id) => (S.clubs[id] ? S.clubs[id].name : id);

// ------------------------------------------------------------------ inbox
function optScore(S, o, p) {
  let s = 0;
  for (const e of o.preview || []) {
    const v = typeof e.value === 'number' ? e.value : 0;
    switch (e.key) {
      case 'cash': s += v / 2500; break;
      case 'rep': s += v * 4; break;
      case 'loyalty': s += v * (e.target === 'player' ? 0.5 : 0); break;
      case 'morale': s += v * 0.15; break;
      case 'hype': s += v * 0.1; break;
      case 'trust': s += v * 0.25; break;
      case 'interest': s += v * 0.15; break;
      case 'know': s += v * 0.1; break;
      case 'energy': s += v * 4; break;
      case 'promise': s += 1.5; break;
      case 'releaseClient': case 'sellTo': s -= 25; break;
      case 'injure': s -= 5; break;
      case 'heal': s += 3; break;
      case 'form': s += v * 0.5; break;
      case 'commission': s += v * 2; break;
      default: break;
    }
  }
  s -= (o.cost.cash || 0) / 2500 + (o.cost.energy || 0) * 6;
  if (o.risk) s -= o.risk.pct * 0.25;
  return s;
}
function answerCard(ctx, card, style) {
  const S = ctx.S;
  const afford = o => (o.cost.cash || 0) <= S.agency.cash - 8000 && (o.cost.energy || 0) <= S.agency.energy;
  const opts = card.options.filter(afford);
  if (!opts.length) return null;
  const free = opts.filter(o => !o.cost.cash && !o.cost.energy);
  if (style === 'passive') return (free.find(o => o.id === card.defaultOption) || free[0] || opts[0]).id;
  if (style === 'fuzz') return ctx.rnd.pick(card.options).id;
  if (style === 'greedy') {
    let best = null, bs = -1e9;
    for (const o of opts) { let c = 0; for (const e of o.preview || []) if (e.key === 'cash') c += e.value; c -= o.cost.cash || 0; c -= (o.cost.energy || 0) * 3000; if (c > bs) { bs = c; best = o; } }
    return best.id;
  }
  if (style === 'casual' && ctx.rnd.chance(0.35)) return ctx.rnd.pick(opts).id;
  const scored = opts.map(o => ({ o, s: optScore(S, o) })).sort((a, b) => b.s - a.s);
  // energy-costing answers only when something really pays
  const top = scored.find(x => !x.o.cost.energy || x.s > 4) || scored[0];
  return top.o.id;
}
function answerInbox(ctx, style) {
  const S = ctx.S;
  for (let guard = 0; guard < 20; guard++) {
    const cards = S.inbox.slice().sort((a, b) => (b.must ? 1 : 0) - (a.must ? 1 : 0));
    let did = false;
    for (const card of cards) {
      if (style === 'passive' && !card.must) continue;
      if (card.key && card.key.startsWith('tut_') && style !== 'fuzz') { if (tutorialCard(ctx, card, style)) { did = true; break; } continue; }
      if (!card.must && style === 'casual' && ctx.rnd.chance(0.2)) continue;
      const id = answerCard(ctx, card, style);
      if (!id) continue;
      const r = ctx.do('answerInbox', { inboxId: card.id, optionId: id });
      if (r.ok) { did = true; ctx.say('  · kart: ' + card.title + ' → ' + id); break; }
    }
    if (!did) break;
  }
}
function tutorialCard(ctx, card, style) {
  // acknowledgement steps are answered; action steps are completed by really playing (handled in plan)
  if (['tut_welcome', 'tut_promises', 'tut_ranking'].includes(card.key)) {
    const o = card.options.find(x => x.id !== 'skip') || card.options[0];
    const r = ctx.do('answerInbox', { inboxId: card.id, optionId: o.id });
    return r.ok;
  }
  return false;
}

// ------------------------------------------------------------------ negotiation
const KOZ_ORDER = ['rakip', 'sozlesme', 'songun', 'formda', 'taraftar', 'dostluk'];

function packageFor(ctx, v, total, o) {
  // split `total` club cost between wage / bonus / fee. o: {feeShare, bonusMult, minutes}
  const fair = v.fair, L = v.limits;
  const clauses = { minutes: !!o.minutes, release: false };
  const rate = 1 + (clauses.minutes ? BAL.neg.clause.minutes : 0);
  const T = total / rate;
  const years = fair.years;
  const bonus = Math.min(L.bonus[1], tidy(fair.bonus * (o.bonusMult ?? 1)));
  let fee = Math.min(L.fee[1], tidy(T * o.feeShare));
  let wage = Math.floor((T - bonus - fee) / (12 * years) / 100) * 100;
  wage = Math.max(L.wage[0], Math.min(L.wage[1], wage));
  return { wage, years, bonus, fee, clauses };
}
function satOf(ctx, pkg) { const r = ctx.do('negPreview', { package: pkg }); return r.ok ? r.preview : null; }

/** Make the client happy (≥ target) by shifting money from fee to wage if needed. Returns the package. */
function keepClientHappy(ctx, v, pkg, target) {
  let p = { ...pkg };
  for (let i = 0; i < 8; i++) {
    const pv = satOf(ctx, p);
    if (!pv || pv.satisfaction >= target || p.fee <= 0) break;
    const shift = Math.max(500, Math.round(p.fee * 0.25));
    p.fee = Math.max(0, p.fee - shift);
    p.wage = Math.min(v.limits.wage[1], p.wage + Math.ceil(shift / (12 * p.years) / 100) * 100);
  }
  return p;
}

function chooseKoz(v, style, used) {
  const hand = v.hand.filter(h => !h.used);
  if (!hand.length) return null;
  const free = KOZ_ORDER.map(id => hand.find(h => h.id === id)).filter(Boolean);
  if (style === 'greedy') { const b = hand.find(h => h.id === 'blof'); return (b || free[0] || {}).id || null; }
  if (style === 'sharp') {
    const f = free.find(h => !used.has(h.id) && h.kPct > 0) || free.find(h => !used.has(h.id));
    if (f) return f.id;
    const b = hand.find(h => h.id === 'blof');
    if (b && b.risk <= 20 && v.round >= 1) return b.id;
    return null;
  }
  if (style === 'casual') { const f = free[0]; return f && !used.has(f.id) ? f.id : null; }
  return null;
}

/** Smallest wage (with the given bonus, no fee) that keeps the client at ≥ `target` satisfaction; null when even the max wage fails. */
function needWage(ctx, v, bonus, years, minutes, target) {
  const L = v.limits;
  let lo = L.wage[0], hi = L.wage[1];
  const ok = w => { const pv = satOf(ctx, { wage: w, years, bonus, fee: 0, clauses: { minutes, release: false } }); return pv && pv.satisfaction >= target; };
  if (!ok(hi)) return null;
  for (let i = 0; i < 14; i++) { const mid = Math.round((lo + hi) / 2 / 100) * 100; if (mid <= lo || mid >= hi) break; if (ok(mid)) hi = mid; else lo = mid; }
  return hi;
}

/** Play the open table to its end. style: sharp | casual | greedy. Returns 'accepted' | 'lost'. */
function playTable(ctx, style) {
  const S = ctx.S;
  const T = ctx.tables;
  T.opened++;
  const used = new Set();
  let v = sel.negotiationView(S);
  let result = null, rounds = 0, why = '';
  const F = v.fair.wage * 12 * v.fair.years + v.fair.bonus + v.fair.fee;
  if (style === 'sharp') {
    const years = v.fair.years, bonus = v.fair.bonus;
    const nw = needWage(ctx, v, bonus, years, false, 52);
    if (nw === null) { ctx.do('negWalkAway'); result = 'lost'; why = 'client:unreachable'; }
    else {
      const FS = 0.115;
      const floorT = (nw * 12 * years + bonus) / (1 - FS); // cheapest package the client signs
      let Tt = F * 1.38;
      for (let round = 0; round < 9 && !result; round++) {
        v = sel.negotiationView(S);
        if (!v) break;
        rounds = Math.max(rounds, v.round + 1);
        const koz = round < 3 ? chooseKoz(v, 'sharp', used) : null;
        if (koz) { used.add(koz); const c = v.hand.find(h => h.id === koz); if (c && c.kPct) Tt = Math.min(Tt * (1 + c.kPct * 0.5), F * 1.35); }
        Tt = Math.max(Tt, floorT);
        const fee = Math.min(v.limits.fee[1], tidy(Tt * FS));
        const wage = Math.max(nw, Math.floor((Tt - bonus - fee) / (12 * years) / 100) * 100);
        const pkg = { wage, years, bonus, fee, clauses: { minutes: false, release: false } };
        const C = wage * 12 * years + bonus + fee;
        const r = ctx.do('negPropose', { package: pkg, koz });
        if (!r.ok) { why = 'client:' + r.error.slice(0, 24); ctx.do('negWalkAway'); result = 'lost'; break; }
        if (r.outcome === 'accepted') { result = 'accepted'; break; }
        if (r.outcome === 'left') { result = 'lost'; why = 'left@' + (v.round + 1); break; }
        if (r.outcome === 'hesitates') { const l = ctx.do('negLeanOnClient'); result = l.ok ? 'accepted' : 'lost'; break; }
        const lvl = r.tell ? r.tell.level : 2;
        const kTell = C / (1 + GAP_MID[lvl]);
        const c = r.counter;
        const kCounter = c ? c.cost / (0.8 + 0.05 * (v.round + 1)) : kTell;
        const Kest = Math.min(kTell * 1.03, (kTell + kCounter) / 2);
        if (c && c.clientOk && c.cost >= 0.95 * Kest && round >= 2) {
          const a = ctx.do('negAcceptCounter');
          if (a.ok && a.outcome === 'accepted') { result = 'accepted'; break; }
        }
        Tt = Kest * 0.985;
        if (Tt < floorT * 0.995) { result = 'lost'; why = 'nofee'; ctx.do('negWalkAway'); break; }
      }
    }
  } else {
    const feeShare = style === 'greedy' ? 0.26 : 0.09;
    let Kest = F * 1.05;
    let target = F * (style === 'greedy' ? 1.30 : 1.18);
    for (let round = 0; round < 9; round++) {
      v = sel.negotiationView(S);
      if (!v) break;
      rounds = Math.max(rounds, v.round + 1);
      const koz = round < 3 ? chooseKoz(v, style, used) : null;
      if (koz) used.add(koz);
      let pkg = packageFor(ctx, v, target, { feeShare, bonusMult: 1, minutes: false });
      pkg = keepClientHappy(ctx, v, pkg, style === 'greedy' ? 41 : 48);
      let r = ctx.do('negPropose', { package: pkg, koz });
      if (!r.ok) {
        const fix = { ...pkg, wage: Math.min(v.limits.wage[1], Math.round(pkg.wage * 1.12 / 100) * 100), fee: Math.round(pkg.fee * 0.7) };
        const r2 = ctx.do('negPropose', { package: fix, koz: null });
        if (!r2.ok) { why = 'client:' + r2.error.slice(0, 24); ctx.do('negWalkAway'); result = 'lost'; break; }
        r = r2;
      }
      if (r.outcome === 'accepted') { result = 'accepted'; break; }
      if (r.outcome === 'hesitates') { T.hesitated++; const l = ctx.do('negLeanOnClient'); result = l.ok ? 'accepted' : 'lost'; if (!l.ok) ctx.do('negWalkAway'); break; }
      if (r.outcome === 'left') { result = 'lost'; why = 'left@' + (v.round + 1) + (r.insult ? ' insult' : ''); break; }
      const c = r.counter;
      if (style === 'casual') {
        if (round >= 1 && c && (c.clientOk || c.clientLean)) {
          const a = ctx.do('negAcceptCounter');
          if (a.ok && a.outcome === 'accepted') { result = 'accepted'; break; }
          if (a.ok && a.outcome === 'hesitates') { const l = ctx.do('negLeanOnClient'); result = l.ok ? 'accepted' : 'lost'; break; }
        }
        target *= ctx.rnd.chance(0.5) ? 0.94 : 0.97;
      } else {
        if (c && c.clientOk && round >= 2) { const a = ctx.do('negAcceptCounter'); if (a.ok && a.outcome === 'accepted') { result = 'accepted'; break; } }
        target *= 0.93;
      }
    }
  }
  if (!result) { why = why || 'rounds'; result = 'lost'; }
  if (S.negotiation) ctx.do('negWalkAway');
  if (result === 'accepted') T.won++; else { T.lost++; T.why[why || '?'] = (T.why[why || '?'] || 0) + 1; }
  T.rounds.push(rounds);
  ctx.say('  ✦ masa: ' + result + ' (' + rounds + ' tur)');
  return result;
}

function fuzzTable(ctx) {
  const S = ctx.S;
  ctx.tables.opened++;
  for (let i = 0; i < 8 && S.negotiation; i++) {
    const v = sel.negotiationView(S);
    const R = ctx.rnd;
    const pick = R.int(0, 6);
    if (R.chance(0.1)) { const j = serialize(S); const S2 = deserialize(j); if (serialize(S2) !== j) throw new Error('save round trip mismatch (table)'); }
    if (pick === 0) { ctx.do('negWalkAway'); break; }
    if (pick === 1) { ctx.do('negAcceptCounter'); continue; }
    if (pick === 2) { ctx.do('negLeanOnClient'); continue; }
    const f = v.fair;
    const m = () => 0.5 + R() * 1.2;
    const pkg = { wage: Math.round(f.wage * m() / 100) * 100, years: R.int(1, 5), bonus: Math.round(f.bonus * m()), fee: Math.round(f.fee * m() * 2), clauses: { minutes: R.chance(0.3), release: R.chance(0.3) } };
    if (R.chance(0.1)) pkg.wage = -5;
    if (R.chance(0.05)) pkg.years = 9;
    const hand = v.hand.filter(h => !h.used);
    ctx.do('negPreview', { package: pkg });
    ctx.do('negPropose', { package: pkg, koz: hand.length && R.chance(0.6) ? R.pick(hand).id : null });
  }
  if (S.negotiation) ctx.do('negWalkAway');
}

// ------------------------------------------------------------------ shared planning helpers
const energy = ctx => ctx.S.agency.energy;
function negotiable(ctx) { return sel.interestList(ctx.S).filter(i => i.negotiable); }

/** How good is this interest for the client? Positive = take it. */
function interestValue(ctx, i, style) {
  const S = ctx.S;
  const p = S.players[i.playerId], club = S.clubs[i.clubId];
  if (!p || !club) return -99;
  const cur = S.clubs[p.clubId];
  const curPrest = cur ? S.leagues[cur.leagueId].prestige : 0;
  const newPrest = S.leagues[club.leagueId].prestige;
  if (style === 'sharp' && i.fitSat < 47) return -9;
  if (style === 'casual' && i.fitSat < 40 && ctx.rnd.chance(0.7)) return -9;
  if (style === 'greedy' && i.fitSat < 38) return -9;
  let v = i.level / 20;
  if (i.kind === 'renewal') v += 0.5;
  if (style === 'greedy') return v + Math.log10(Math.max(1e5, p.value)) + (newPrest > curPrest ? 1 : 0);
  const share = i.kind === 'renewal' ? sel.minutesShare(S, p) : null;
  const m = sel.projectMinutes(S, p, club.id);
  v += (m - 0.45) * 8 + (newPrest - curPrest) * (p.trait === 'hirsli' || p.trait === 'yildiz' ? 2 : 0.7);
  if (p.age <= 22) v += (m - 0.5) * 6; // youngsters live on minutes
  if (p.age >= 29 && newPrest < curPrest) v -= 1;
  return v;
}

function openAndPlay(ctx, style, cap = 1) {
  const S = ctx.S;
  const list = negotiable(ctx).map(i => ({ i, v: interestValue(ctx, i, style) })).sort((a, b) => b.v - a.v);
  let n = 0;
  for (const { i, v } of list) {
    if (n >= cap || energy(ctx) < 1) break;
    if (style === 'sharp' && v < 1.2) continue;
    if (style === 'casual' && v < -1) continue;
    const r = ctx.do('openNegotiation', { interestId: i.id });
    if (!r.ok) continue;
    ctx.say('  ✦ masa: ' + pname(S, i.playerId) + ' → ' + cname(S, i.clubId) + ' (' + i.kind + ')');
    playTable(ctx, style);
    n++;
  }
  return n;
}

function scoutAndRecruit(ctx, style) {
  const S = ctx.S;
  const clients = sel.myClients(S);
  const want = style === 'sharp' ? Math.min(14, 5 + Math.floor(S.agency.rep / 8)) : style === 'casual' ? 6 : 12;
  if (clients.length >= want) return;
  // 1. recruit anyone signable (best first)
  let prospects = sel.prospectList(S).filter(p => p.recruitable);
  const good = prospects.filter(p => (style === 'sharp' ? (p.age <= 21 ? p.band.hi >= 72 && p.know >= 55 : p.age <= 23 ? p.band.hi >= 70 : p.ca >= 56 && p.age <= 31) : p.ca >= 52)).sort((a, b) => (b.band.hi + b.ca) - (a.band.hi + a.ca));
  for (const p of good) {
    if (energy(ctx) < 1) break;
    const pv = ctx.do('recruitPreview', { playerId: p.id, promises: [] });
    if (!pv.ok) continue;
    const info = pv.preview;
    if (info.error) continue;
    let promises = [];
    if (style !== 'greedy' && info.score < info.threshold) {
      // add promises we can keep: visit first, then minutes for clubs where he starts
      const order = style === 'sharp' ? ['visit', 'minutes', 'stay'] : ['minutes', 'visit', 'wage', 'stay', 'transfer_up'];
      let sc = info.score;
      for (const t of order) { if (sc >= info.threshold || promises.length >= 3) break; const o = info.promiseOptions.find(x => x.type === t); if (o) { promises.push({ type: t }); sc += o.add; } }
      if (sc < info.threshold) continue;
    } else if (info.score < info.threshold) {
      promises = ['transfer_up', 'wage', 'minutes'].map(t => ({ type: t }));
    }
    const r = ctx.do('recruit', { playerId: p.id, promises });
    if (r.ok) { ctx.say('  ✚ imza: ' + p.name + ' (' + p.age + ', CA ' + p.ca + ')'); (ctx.recruits = ctx.recruits || []).push({ id: p.id, know: p.know, age: p.age, ca: p.ca, hi: p.band.hi, lo: p.band.lo, season: S.time.season }); }
  }
  // 2. watch the most interesting half-known prospects
  if (style === 'sharp') {
    prospects = sel.prospectList(S).filter(p => p.recruitable && p.know < 60 && p.heat < 75 && (p.age <= 21 ? p.band.hi >= 72 : false)).sort((a, b) => b.know - a.know);
    for (const p of prospects.slice(0, 2)) { if (energy(ctx) < 1) break; ctx.do('watchPlayer', { playerId: p.id }); }
  }
  // 3. scout trip when the pool is empty
  const pool = sel.prospectList(S).filter(p => p.recruitable && p.heat < 80);
  if (pool.length < 4 && energy(ctx) >= 1 && S.agency.cash > 15000) {
    const leagues = style === 'sharp' ? (S.agency.rep > 35 ? ['tr1', 'nl1', 'tr2'] : ['tr2', 'tr1']) : ['tr2', 'tr1'];
    const lid = ctx.rnd.pick(leagues);
    ctx.do('scoutTrip', { leagueId: lid, focus: style === 'sharp' ? 'u21' : 'any' });
  }
}

function visitClients(ctx, max, style) {
  const S = ctx.S;
  const list = sel.clientList(S).filter(c => !sel.clientView(S, c.id).visitedThisMonth).sort((a, b) => a.loyalty - b.loyalty);
  let n = 0;
  for (const c of list) {
    if (n >= max || energy(ctx) < 1) break;
    const cv = sel.clientView(S, c.id);
    const needs = c.loyalty < 62 || cv.promises.some(p => p.type === 'visit') || (S.time.month % 4 === 0);
    if (!needs && style !== 'passive') continue;
    if (ctx.do('visitClient', { playerId: c.id }).ok) n++;
  }
  return n;
}

function pitchRound(ctx, style) {
  const S = ctx.S;
  if (energy(ctx) < 1) return;
  const month = S.time.month;
  const lead = month === 11 || month === 0 || month === 1 || month === 5 || month === 6; // build interest ahead of windows
  if (!lead && style === 'sharp') return;
  const clients = sel.clientList(S).filter(c => !c.hasPreContract);
  for (const c of clients) {
    if (energy(ctx) < 1) return;
    const p = S.players[c.id];
    const open = S.interests.filter(i => i.playerId === c.id && i.level >= BAL.neg.minLevel && i.cooldown <= 0);
    if (open.length) continue;
    const wantsMove = c.minutesShare < 0.45 || p.trait === 'hirsli' || p.age <= 23 && p.ca >= 62 || p.contractEnd === S.time.season;
    if (!wantsMove) continue;
    // best club: needs his position, in the same or next league
    const cur = S.clubs[p.clubId];
    const curPrest = cur ? S.leagues[cur.leagueId].prestige : 0;
    let best = null, bs = -99;
    for (const cid in S.clubs) {
      const cl = S.clubs[cid];
      if (cid === p.clubId) continue;
      const pr = S.leagues[cl.leagueId].prestige;
      if (pr > curPrest + 1 || pr < curPrest) continue;
      const nl = (cl.needs.find(n => n.pos === p.pos) || { level: 0 }).level;
      const m = sel.projectMinutes(S, p, cid);
      const sc = nl * 2 + (m >= 0.88 ? 3 : 0) + cl.trust / 40 + (pr > curPrest ? 1 : 0);
      if (nl > 0 && sc > bs) { bs = sc; best = cid; }
    }
    if (!best) continue;
    const pv = ctx.do('pitchPreview', { playerId: c.id, clubId: best });
    if (!pv.ok || pv.preview.error) continue;
    ctx.do('pitchPlayer', { playerId: c.id, clubId: best });
    if (style === 'sharp' || ctx.rnd.chance(0.4)) return;
  }
}

function buyUpgrades(ctx, style) {
  const S = ctx.S;
  const A = S.agency;
  const order = style === 'sharp' ? ['table', 'network', 'scout', 'table', 'network', 'scout', 'table', 'network', 'scout', 'table', 'scout', 'network'] : ['table', 'network', 'scout', 'table'];
  const ups = A.upgrades;
  for (const b of order) {
    const pv = sel.upgradeView(S).find(x => x.branch === b);
    if (!pv || pv.maxed) continue;
    if (A.cash >= pv.cost * 2.2 + 25000 && (ups[b] + 1) === pv.nextLevel) {
      // only buy the next level of the first branch in the list that is behind the "round-robin" schedule
      const total = ups.table + ups.network + ups.scout;
      if (ups[b] <= Math.floor(total / 3) + (order.indexOf(b) % 3 === 0 ? 1 : 0)) { if (ctx.do('buyUpgrade', { branch: b }).ok) { ctx.say('  ⚙ yükseltme ' + b); } return; }
    }
  }
}

function lunchRound(ctx, style) {
  const S = ctx.S;
  if (energy(ctx) < 1 || S.agency.cash < 20000) return;
  // lunch with the club that is already interested in our best client and whose trust is low
  const best = sel.interestList(S).filter(i => i.cooldown <= 0 && i.level >= 40 && i.level < 75).sort((a, b) => b.level - a.level)[0];
  if (best && S.clubs[best.clubId].trust < 55) ctx.do('clubLunch', { clubId: best.clubId });
}

function mediaRound(ctx) {
  const S = ctx.S;
  if (energy(ctx) < 1 || S.agency.cash < 80000) return;
  const month = S.time.month;
  if (!(month === 11 || month === 5 || month === 0 || month === 6)) return;
  const c = sel.clientList(S).filter(x => x.value > 1500000).sort((a, b) => b.value - a.value)[0];
  if (c && S.players[c.id].hype < 60) ctx.do('mediaPush', { playerId: c.id });
}

// ------------------------------------------------------------------ bots
function tutorialDrive(ctx, style) {
  const S = ctx.S;
  const step = sel.hubSummary(S).tutorialStep;
  if (!step || style === 'passive') return;
  if (step === 'visit') { const c = sel.clientList(S)[0]; if (c) ctx.do('visitClient', { playerId: c.id }); }
  else if (step === 'scout') ctx.do('scoutTrip', { leagueId: 'tr2', focus: 'u21' });
  else if (step === 'market') { const c = sel.clientList(S)[0]; const cl = c && S.interests.find(i => i.playerId === c.id); const club = cl ? cl.clubId : Object.keys(S.clubs).find(id => id !== S.players[c.id].clubId && S.clubs[id].leagueId === S.clubs[S.players[c.id].clubId].leagueId); ctx.do('clubLunch', { clubId: club }); }
}

const BOTS = {
  passive: {
    plan(ctx) { visitClients(ctx, 4, 'passive'); },
    inbox: 'passive',
    deadline(ctx) { /* nothing */ },
  },
  casual: {
    plan(ctx) {
      const S = ctx.S;
      tutorialDrive(ctx, 'casual');
      if (negotiable(ctx).length && ctx.rnd.chance(0.8)) openAndPlay(ctx, 'casual', 1);
      if (energy(ctx) > 0 && sel.clientList(S).some(c => c.loyalty < 50)) visitClients(ctx, 1, 'casual');
      if (energy(ctx) > 0 && ctx.rnd.chance(0.7)) scoutAndRecruit(ctx, 'casual');
      if (energy(ctx) > 0 && ctx.rnd.chance(0.3)) pitchRound(ctx, 'casual');
      if (energy(ctx) > 0) visitClients(ctx, 1, 'casual');
      if (energy(ctx) > 0 && S.agency.cash > 30000 && ctx.rnd.chance(0.6)) ctx.do('scoutTrip', { leagueId: ctx.rnd.pick(['tr2', 'tr1', 'tr1']), focus: 'any' });
      if (energy(ctx) > 0 && S.agency.cash > 40000 && ctx.rnd.chance(0.5)) lunchRound(ctx, 'casual');
      if (energy(ctx) > 0) scoutAndRecruit(ctx, 'casual');
      if (S.agency.cash > 250000) buyUpgrades(ctx, 'casual');
    },
    inbox: 'casual',
    deadline(ctx) { deadlineDay(ctx, 'casual'); },
  },
  sharp: {
    plan(ctx) {
      const S = ctx.S;
      tutorialDrive(ctx, 'sharp');
      openAndPlay(ctx, 'sharp', 2);
      if (energy(ctx) > 0) visitClients(ctx, 1, 'sharp');
      if (energy(ctx) > 0) scoutAndRecruit(ctx, 'sharp');
      if (energy(ctx) > 0) pitchRound(ctx, 'sharp');
      if (energy(ctx) > 0) lunchRound(ctx, 'sharp');
      if (energy(ctx) > 0) mediaRound(ctx);
      // spare energy: keep clients warm, then look for new talent, then lunches
      if (energy(ctx) > 0) visitClients(ctx, 2, 'sharp');
      if (energy(ctx) > 0 && S.agency.cash > 25000 && sel.prospectList(S).filter(p => p.recruitable).length < 12) ctx.do('scoutTrip', { leagueId: ctx.rnd.pick(S.agency.rep > 35 ? ['tr1', 'nl1', 'tr2'] : ['tr2', 'tr1']), focus: 'u21' });
      if (energy(ctx) > 0) { const c = sel.prospectList(S).filter(p => p.recruitable && p.know < 90 && p.heat < 80 && p.ca >= 55)[0]; if (c) ctx.do('watchPlayer', { playerId: c.id }); }
      if (energy(ctx) > 0 && S.agency.cash > 40000) { const club = sel.interestList(S).filter(i => i.cooldown <= 0)[0]; if (club) ctx.do('clubLunch', { clubId: club.clubId }); }
      buyUpgrades(ctx, 'sharp');
    },
    inbox: 'sharp',
    deadline(ctx) { deadlineDay(ctx, 'sharp'); },
  },
  greedy: {
    plan(ctx) {
      const S = ctx.S;
      tutorialDrive(ctx, 'greedy');
      openAndPlay(ctx, 'greedy', 2);
      if (energy(ctx) > 0) scoutAndRecruit(ctx, 'greedy');
      if (energy(ctx) > 0) pitchRound(ctx, 'greedy');
      if (S.agency.cash > 400000) buyUpgrades(ctx, 'greedy');
    },
    inbox: 'greedy',
    deadline(ctx) { deadlineDay(ctx, 'greedy'); },
  },
  fuzz: {
    plan(ctx) { fuzzMonth(ctx); },
    inbox: 'fuzz',
    deadline(ctx) { fuzzDeadline(ctx); },
  },
};

function deadlineDay(ctx, style) {
  const S = ctx.S;
  for (let guard = 0; guard < 40 && S.time.phase === 'deadline'; guard++) {
    if (S.negotiation) { playTable(ctx, style === 'greedy' ? 'greedy' : style); continue; }
    const dv = sel.deadlineView(S);
    if (!dv || dv.ended) break;
    const calls = dv.calls.filter(c => c.available).sort((a, b) => b.level - a.level);
    let acted = false;
    for (const c of calls) {
      const p = S.players[c.playerId];
      if (style === 'sharp' && ((p && sel.projectMinutes(S, p, c.clubId) < 0.45 && p.age <= 24) || c.fitSat < 47)) continue;
      if (style === 'greedy' && c.fitSat < 38) continue;
      const r = ctx.do('deadlineTakeCall', { callId: c.id });
      if (r.ok) { ctx.say('  ☎ ' + cname(S, c.clubId) + ' aradı'); acted = true; break; }
    }
    if (acted) continue;
    if (dv.actionsLeft > 0 && style !== 'casual') {
      const list = negotiable(ctx).map(i => ({ i, v: interestValue(ctx, i, style) })).filter(x => (style === 'sharp' ? x.v > 1.2 : true)).sort((a, b) => b.v - a.v);
      if (list.length && ctx.do('openNegotiation', { interestId: list[0].i.id }).ok) { continue; }
    }
    ctx.do('deadlineSkipHour');
  }
}

function fuzzDeadline(ctx) {
  const S = ctx.S;
  const R = ctx.rnd;
  for (let guard = 0; guard < 30 && S.time.phase === 'deadline'; guard++) {
    if (S.negotiation) { fuzzTable(ctx); continue; }
    const dv = sel.deadlineView(S);
    const k = R.int(0, 4);
    if (k === 0 && dv && dv.calls.length) ctx.do('deadlineTakeCall', { callId: R.pick(dv.calls).id });
    else if (k === 1) ctx.do('deadlineSkipHour');
    else if (k === 2 && S.interests.length) ctx.do('openNegotiation', { interestId: R.pick(S.interests).id });
    else if (k === 3) { const c = sel.myClients(S)[0]; if (c) ctx.do('pitchPlayer', { playerId: c.id, clubId: R.pick(Object.keys(S.clubs)) }); }
    else if (R.chance(0.15)) break;
    else ctx.do('deadlineSkipHour');
  }
}

function fuzzMonth(ctx) {
  const S = ctx.S;
  const R = ctx.rnd;
  if (S.agency.cash < 150000) S.agency.cash += 400000; // fuzz may cheat cash so that it explores deep careers instead of going bankrupt
  const clients = () => sel.myClients(S);
  const clubIds = Object.keys(S.clubs);
  const pids = Object.keys(S.players);
  const n = R.int(2, 8);
  for (let k = 0; k < n; k++) {
    const c = clients();
    const myC = c.length ? R.pick(c) : null;
    const pl = sel.prospectList(S);
    const anyP = R.chance(0.6) && pl.length ? S.players[R.pick(pl).id] : S.players[R.pick(pids)];
    const kind = R.int(0, 16);
    switch (kind) {
      case 0: ctx.do('scoutTrip', { leagueId: R.pick(['tr1', 'tr2', 'nl1', 'it1', 'es1', 'en1', 'xx']), focus: R.pick(['any', 'u21', 'form', 'expiring', 'zzz']) }); break;
      case 1: ctx.do('watchPlayer', { playerId: anyP.id }); break;
      case 2: ctx.do('recruit', { playerId: anyP.id, promises: R.chance(0.5) ? [{ type: R.pick(['minutes', 'transfer_up', 'wage', 'stay', 'visit', 'bogus']) }, { type: 'visit' }] : [] }); break;
      case 3: if (myC) ctx.do('visitClient', { playerId: myC.id }); break;
      case 4: ctx.do('clubLunch', { clubId: R.pick(clubIds) }); break;
      case 5: if (myC) ctx.do('pitchPlayer', { playerId: myC.id, clubId: R.pick(clubIds) }); break;
      case 6: if (myC) ctx.do('mediaPush', { playerId: myC.id }); break;
      case 15: case 7: { const neg = negotiable(ctx); const list = neg.length && R.chance(0.7) ? neg : S.interests.filter(i => S.players[i.playerId] && S.players[i.playerId].agentId === 'you'); if (list.length) { const r = ctx.do('openNegotiation', { interestId: R.pick(list).id }); if (r.ok) fuzzTable(ctx); } break; }
      case 8: ctx.do('buyUpgrade', { branch: R.pick(['scout', 'table', 'network', 'x']) }); break;
      case 9: if (S.inbox.length) { const cd = R.pick(S.inbox); ctx.do('answerInbox', { inboxId: cd.id, optionId: R.chance(0.9) && cd.options.length ? R.pick(cd.options).id : 'zz' }); } break;
      case 10: if (S.objectives.offered.length) ctx.do('chooseObjective', { objectiveId: R.pick(S.objectives.offered).id }); break;
      case 11: ctx.do('toggleShortlist', { playerId: anyP.id }); break;
      case 12: if (R.chance(0.02) && myC) ctx.do('releaseClient', { playerId: myC.id }); break;
      case 13: ctx.do('takeLoan'); break;
      default: ctx.do('tripPreview', { leagueId: R.pick(['tr1', 'nl1']), focus: 'any' }); ctx.do('recruitPreview', { playerId: anyP.id, promises: [] }); ctx.do('upgradePreview', { branch: 'table' }); ctx.do('pitchPreview', { playerId: anyP.id, clubId: R.pick(clubIds) }); ctx.do('negPreview', {}); break;
    }
    if (S.negotiation) fuzzTable(ctx);
  }
  // exercise every view selector
  sel.hubSummary(S); sel.clientList(S); sel.rankingView(S); sel.financeSeries(S); sel.objectiveView(S); sel.upgradeView(S);
  if (myCl(S)) { sel.clientView(S, myCl(S).id); sel.availableActions(S, { playerId: myCl(S).id, clubId: R.pick(clubIds) }); }
  sel.clubView(S, R.pick(clubIds)); sel.prospectList(S); sel.availableActions(S, {}); sel.availableActions(S, { clubId: R.pick(clubIds) });
  if (R.chance(0.03)) { const j = serialize(S); const S2 = deserialize(j); if (serialize(S2) !== j) throw new Error('save round trip mismatch'); }
}
const myCl = S => sel.myClients(S)[0];

// ------------------------------------------------------------------ driver
function snapshotSeason(ctx, report) {
  const S = ctx.S;
  const A = S.agency;
  const last = S.history[S.history.length - 1];
  const clients = sel.myClients(S);
  const T = ctx.tables;
  const row = {
    season: last ? last.season : S.time.season, cash: last ? last.cash : A.cash, rep: last ? last.rep : A.rep, clients: last ? last.clients : clients.length, rank: last ? last.rank : sel.myRank(S),
    commission: A.stats.commission - ctx.last.commission, deals: A.stats.deals - ctx.last.deals, won: T.won - ctx.last.won, lost: T.lost - ctx.last.lost,
    kept: A.stats.promisesKept, broken: A.stats.promisesBroken, dreams: A.stats.dreams,
    stars: clients.filter(p => p.ca >= 82).length, top: clients.reduce((m, p) => Math.max(m, p.value), 0), maxCa: clients.reduce((m, p) => Math.max(m, p.ca), 0),
    pf: clients.reduce((s, p) => s + p.value, 0), rivalTop: S.ranking.filter(r => r.id !== 'you')[0] ? S.ranking.filter(r => r.id !== 'you')[0].score : 0, myScore: (S.ranking.find(r => r.id === 'you') || {}).score || 0,
    loy: clients.length ? clients.reduce((s, p) => s + p.loyalty, 0) / clients.length : 0,
  };
  ctx.last = { commission: A.stats.commission, deals: A.stats.deals, won: T.won, lost: T.lost };
  ctx.seasonRows.push(row);
}

export function runCareer(botName, seed, opts = {}) {
  const bot = BOTS[botName];
  const ctx = makeCtx(seed, { ...opts, seasons: opts.seasons || 8 });
  const S = ctx.S;
  let bankruptSeason = null;
  try {
    for (let guard = 0; guard < 12 * (opts.seasons || 8) + 12 && S.time.phase !== 'over'; guard++) {
      const before = { season: S.time.season, month: S.time.month };
      if (ctx.trace) ctx.say(`\n── ${before.season}. sezon ${MONTHS[before.month].name}  kasa €${Math.round(S.agency.cash).toLocaleString('tr-TR')}  itibar ${S.agency.rep.toFixed(1)}  müşteri ${sel.myClients(S).length}  sıra ${sel.myRank(S)}`);
      answerInbox(ctx, bot.inbox);
      if (!S.objectives.active && S.objectives.offered.length && botName !== 'passive') {
        const o = S.objectives.offered[botName === 'sharp' ? 1 : 0] || S.objectives.offered[0];
        if (o) ctx.do('chooseObjective', { objectiveId: o.id });
      }
      bot.plan(ctx);
      if (S.negotiation) ctx.do('negWalkAway');
      answerInbox(ctx, bot.inbox === 'passive' ? 'passive' : bot.inbox);
      ctx.pacing.energyLeft += S.agency.energy; ctx.pacing.months++;
      let r = advance(S);
      if (r.ok && r.phase === 'deadline') {
        ctx.say('  ⏰ SON GÜN');
        bot.deadline(ctx);
        if (S.negotiation) ctx.do('negWalkAway');
        const f = ctx.do('deadlineFinish');
        if (!f.ok) throw new Error('deadlineFinish failed: ' + f.error);
        r = advance(S);
      }
      if (!r.ok) {
        // blocked by a must card or similar: answer everything and retry once
        answerInbox(ctx, 'passive');
        for (const c of S.inbox.slice()) if (c.must) ctx.do('answerInbox', { inboxId: c.id, optionId: c.options[0].id });
        r = advance(S);
        if (!r.ok) throw new Error('advance blocked: ' + r.error);
      }
      if (r.ok && r.events) { ctx.pacing.cards += r.events.filter(e => e.type === 'inboxNew').length; ctx.pacing.inboxWaiting += S.inbox.length; }
      if (ctx.trace) traceReport(ctx, r);
      if (r.seasonEnd) snapshotSeason(ctx, r);
      if (r.ending) { if (r.ending.kind === 'iflas') bankruptSeason = before.season; }
    }
  } catch (e) {
    ctx.exceptions.push({ seed, bot: botName, season: S.time.season, month: S.time.month, message: e.message, stack: (e.stack || '').split('\n').slice(0, 5).join('\n') });
  }
  const A = S.agency;
  return {
    recruits: (ctx.recruits || []).map(x => ({ ...x, finalCa: S.players[x.id] ? S.players[x.id].ca : null, pa: S.players[x.id] ? S.players[x.id].pa : null })),
    pacing: ctx.pacing, bot: botName, seed, S, rows: ctx.seasonRows, ending: S.ending, exceptions: ctx.exceptions, log: ctx.log, tables: ctx.tables, bankruptSeason,
    end: { seasons: S.history.length, clients: sel.myClients(S).length, cash: A.cash, rep: A.rep, rank: sel.myRank(S), stats: { ...A.stats }, ending: S.ending ? S.ending.kind : null },
  };
}

function traceReport(ctx, r) {
  const S = ctx.S;
  if (r.phase === 'deadline') return;
  const f = r.finance;
  ctx.say(`  → ay sonu: net €${Math.round(f ? f.net : 0).toLocaleString('tr-TR')}  kasa €${Math.round(f ? f.cash : 0).toLocaleString('tr-TR')}`);
  for (const e of r.events || []) {
    if (e.type === 'dealDone') ctx.say(`  ★ ANLAŞMA ${pname(S, e.playerId)} → ${cname(S, e.toClubId)} (${e.kind}) komisyon €${e.commission.toLocaleString('tr-TR')}`);
    else if (e.type === 'dream') ctx.say(`  ✧ hayal: ${pname(S, e.playerId)}`);
    else if (e.type === 'clientLeft') ctx.say(`  ✗ ${e.name} ayrıldı`);
    else if (e.type === 'interest') ctx.say(`  ↗ ilgi: ${pname(S, e.playerId)} ← ${cname(S, e.clubId)}`);
  }
  for (const p of r.promises || []) ctx.say(`  söz ${p.status}: ${p.text}`);
  for (const m of (r.rivalMoves || []).slice(0, 3)) ctx.say('  rakip: ' + m.text);
  if (r.seasonEnd) ctx.say(`  ═ SEZON SONU: sıra ${S.history[S.history.length - 1].rank}`);
  if (r.ending) ctx.say(`  ■ KARİYER BİTTİ: ${r.ending.kind} (miras ${r.ending.legacy})`);
}

// ------------------------------------------------------------------ reporting
const fmtM = v => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e3 ? Math.round(v / 1e3) + 'K' : String(Math.round(v)));
const pad = (s, n) => String(s).padStart(n);

function perSeasonTable(runs) {
  const maxS = Math.max(...runs.map(r => r.rows.length), 0);
  const lines = [];
  lines.push(pad('sezon', 5) + pad('hayatta', 8) + pad('kasa', 9) + pad('itibar', 7) + pad('müşt.', 6) + pad('sıra', 6) + pad('komis.', 8) + pad('anlş.', 6) + pad('masa+', 6) + pad('masa-', 6) + pad('söz✓', 6) + pad('söz✗', 6) + pad('hayal', 6) + pad('yıldız', 7) + pad('maxCA', 6) + pad('portföy', 9) + pad('rival1', 9) + pad('ben', 9));
  for (let s = 0; s < maxS; s++) {
    const rs = runs.map(r => r.rows[s]).filter(Boolean);
    if (!rs.length) continue;
    const avg = k => rs.reduce((a, x) => a + x[k], 0) / rs.length;
    const med = k => { const v = rs.map(x => x[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
    lines.push(pad(s + 1, 5) + pad(rs.length + '/' + runs.length, 8) + pad(fmtM(med('cash')), 9) + pad(avg('rep').toFixed(1), 7) + pad(avg('clients').toFixed(1), 6) + pad(avg('rank').toFixed(1), 6) + pad(fmtM(avg('commission')), 8) + pad(avg('deals').toFixed(1), 6)
      + pad(avg('won').toFixed(1), 6) + pad(avg('lost').toFixed(1), 6) + pad(avg('kept').toFixed(1), 6) + pad(avg('broken').toFixed(1), 6) + pad(avg('dreams').toFixed(1), 6) + pad(avg('stars').toFixed(1), 7) + pad(avg('maxCa').toFixed(0), 6) + pad(fmtM(avg('pf')), 9) + pad(fmtM(avg('rivalTop')), 9) + pad(fmtM(avg('myScore')), 9));
  }
  return lines.join('\n');
}

function aggregate(runs) {
  const n = runs.length;
  const ended = {};
  for (const r of runs) { const k = r.end.ending || 'bitmedi'; ended[k] = (ended[k] || 0) + 1; }
  const ranks = [0, 0, 0, 0, 0, 0];
  for (const r of runs) { const rk = r.end.ending === 'iflas' || r.end.ending === 'yalniz' ? 0 : r.end.rank; ranks[rk]++; }
  const won = runs.reduce((a, r) => a + r.tables.won, 0), lost = runs.reduce((a, r) => a + r.tables.lost, 0);
  const rounds = runs.reduce((a, r) => a + r.tables.rounds.length, 0);
  const s1 = runs.filter(r => r.bankruptSeason === 1).length;
  const bank = runs.filter(r => r.end.ending === 'iflas').length;
  const lonely = runs.filter(r => r.end.ending === 'yalniz').length;
  const first = (k, s) => runs.map(r => (r.rows[s] ? r.rows[s][k] : null)).filter(v => v !== null);
  const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return {
    avgRounds: runs.reduce((a, r) => a + r.tables.rounds.reduce((x, y) => x + y, 0), 0) / Math.max(1, rounds), why: runs.reduce((m, r) => { for (const k in r.tables.why) m[k] = (m[k] || 0) + r.tables.why[k]; return m; }, {}),
    pacing: (() => { const p = { e: 0, m: 0, c: 0, w: 0 }; for (const r of runs) { p.e += r.pacing.energyLeft; p.m += r.pacing.months; p.c += r.pacing.cards; p.w += r.pacing.inboxWaiting; } return { energyLeft: p.e / Math.max(1, p.m), cards: p.c / Math.max(1, p.m), waiting: p.w / Math.max(1, p.m) }; })(),
    opened: runs.reduce((a, r) => a + r.tables.opened, 0),
    n, ended, ranks, tableClosePct: won + lost ? Math.round(won / (won + lost) * 100) : 0, tables: won + lost, bankrupt: bank, bankruptS1: s1, clientless: lonely,
    finalCash: mean(runs.map(r => r.end.cash)), finalRep: mean(runs.map(r => r.end.rep)), exceptions: runs.reduce((a, r) => a + r.exceptions.length, 0),
    stars8: mean(first('stars', 7)), maxCa8: mean(first('maxCa', 7)), kept: mean(runs.map(r => r.end.stats.promisesKept)), broken: mean(runs.map(r => r.end.stats.promisesBroken)),
    legacy: mean(runs.map(r => (r.ending ? r.ending.legacy : 0))), loyalty8: mean(first('loy', 7)),
  };
}

function prospectReport(runs) {
  const rec = runs.flatMap(r => r.recruits).filter(x => x.age <= 21 && x.finalCa !== null && x.season <= 5);
  if (rec.length < 5) return '';
  const g = x => x.finalCa - x.ca;
  const grp = (f) => { const l = rec.filter(f); return l.length ? { n: l.length, gain: l.reduce((s, x) => s + g(x), 0) / l.length, boom: l.filter(x => g(x) >= 15).length / l.length, bust: l.filter(x => g(x) <= 4).length / l.length, hi: l.reduce((s, x) => s + x.pa, 0) / l.length } : null; };
  const fmt = (n, o) => o ? `${n}: n=${o.n} ort.CA artışı ${o.gain.toFixed(1)} (patlayan %${Math.round(o.boom * 100)}, sönen %${Math.round(o.bust * 100)}, gerçek pa ort. ${o.hi.toFixed(0)})` : '';
  return '  U21 adaylar — ' + [fmt('tanıma≥60', grp(x => x.know >= 60)), fmt('tanıma<60', grp(x => x.know < 60))].filter(Boolean).join(' | ');
}

function printAggregate(name, a, runs) {
  console.log(`\n== ${name}: ${a.n} kariyer ==`);
  console.log(`  bitiş: ${Object.entries(a.ended).map(([k, v]) => k + ' ' + v).join(', ')}`);
  console.log(`  sıralama dağılımı (1..5, 0=iflas/müşterisiz): ${a.ranks.map((v, i) => i + ':' + v).join('  ')}`);
  console.log(`  iflas ${a.bankrupt} (1. sezon: ${a.bankruptS1})  müşterisiz ${a.clientless}  istisna ${a.exceptions}`);
  console.log(`  masa: ${a.tables} adet (açılan ${a.opened}), kapanan %${a.tableClosePct}  | son kasa ort. €${fmtM(a.finalCash)}  itibar ${a.finalRep.toFixed(1)}  miras ${Math.round(a.legacy)}`);
  console.log(`  tempo: ay sonunda kullanılmayan enerji ${a.pacing.energyLeft.toFixed(2)}, aylık yeni kart ${a.pacing.cards.toFixed(1)}, bekleyen kart ${a.pacing.waiting.toFixed(1)}`);
  console.log(`  masa ort. tur ${a.avgRounds.toFixed(1)}; kayıp nedenleri: ${JSON.stringify(a.why)}`);
  if (runs) { const pr = prospectReport(runs); if (pr) console.log(pr); }
  console.log(`  söz tutulan ${a.kept.toFixed(1)} / bozulan ${a.broken.toFixed(1)}  | 8. sezon yıldız ${a.stars8.toFixed(2)}, maxCA ${a.maxCa8.toFixed(0)}, sadakat ${a.loyalty8.toFixed(0)}`);
}

function parseArgs(argv) {
  const o = { bot: 'sharp', seeds: 10, seed0: 1, seasons: 8, trace: null, quiet: false, table: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--bot') o.bot = argv[++i];
    else if (a === '--seeds') o.seeds = +argv[++i];
    else if (a === '--seed0') o.seed0 = +argv[++i];
    else if (a === '--seasons') o.seasons = +argv[++i];
    else if (a === '--trace') o.trace = /^\d+$/.test(argv[i + 1] || '') ? +argv[++i] : o.seed0;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--no-table') o.table = false;
    else if (a === '--archetype') o.archetype = argv[++i];
  }
  return o;
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  const names = o.bot === 'all' ? Object.keys(BOTS) : o.bot.split(',');
  for (const n of names) if (!BOTS[n]) { console.error('bilinmeyen bot: ' + n + ' (' + Object.keys(BOTS).join(', ') + ')'); process.exit(2); }
  let exitCode = 0;
  for (const name of names) {
    if (o.trace !== null) {
      const r = runCareer(name, o.trace, { seasons: o.seasons, trace: true, archetype: o.archetype });
      console.log(r.log.join('\n'));
      console.log('\n' + perSeasonTable([r]));
      if (r.exceptions.length) { console.log(r.exceptions[0].message + '\n' + r.exceptions[0].stack); exitCode = 1; }
      continue;
    }
    const runs = [];
    const t0 = Date.now();
    for (let i = 0; i < o.seeds; i++) runs.push(runCareer(name, o.seed0 + i, { seasons: o.seasons, archetype: o.archetype }));
    if (o.table && !o.quiet) { console.log(`\n--- ${name}: sezon sezon (ortalama; kasa=medyan) ---`); console.log(perSeasonTable(runs)); }
    printAggregate(name, aggregate(runs), runs);
    const bad = runs.filter(r => r.exceptions.length);
    for (const r of bad.slice(0, 3)) { console.log(`  !! seed ${r.seed}: ${r.exceptions[0].message}\n${r.exceptions[0].stack}`); }
    if (bad.length) exitCode = 1;
    if (!o.quiet) console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} sn)`);
  }
  process.exit(exitCode);
}

if (import.meta.url === 'file://' + process.argv[1]) main();
