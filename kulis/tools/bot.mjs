#!/usr/bin/env node
// Headless bots playing whole KULİS careers through the public API only (game.js act/advance + selectors).
//   node tools/bot.mjs --bot sharp --seeds 16 --seasons 5
//   node tools/bot.mjs --bot all --seeds 16 --par 4        (every bot, aggregate)
//   node tools/bot.mjs --bot sharp --trace 7               (month-by-month story of seed 7)
// Bots: passive (only presses "Ayı Oynat"), casual (sensible but sloppy), sharp (careful), fuzz (random valid/invalid calls: crash hunter).
// Options: --bot passive|casual|sharp|fuzz|all  --seeds N  --seed0 N  --seasons N  --par N  --trace [seed]
import { newGame, act, advance, serialize, deserialize } from '../src/engine/game.js';
import * as sel from '../src/engine/selectors.js';
import { BAL } from '../src/engine/constants.js';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function mkRng(seed) {
  let s = (seed * 2654435761 + 12345) >>> 0;
  const r = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.chance = p => r() < p;
  return r;
}
const tidy = v => (v >= 20000 ? Math.round(v / 1000) * 1000 : Math.round(v / 100) * 100);

function makeCtx(seed, opts) {
  const S = newGame({ seed, agentName: 'Bot', agencyName: 'Bot Ajans', careerSeasons: opts.seasons });
  const ctx = { S, seed, rnd: mkRng(seed), opts, log: [], trace: !!opts.trace, exceptions: [], tables: { opened: 0, won: 0, lost: 0, rounds: [], first: 0 }, cash: [], flags: {} };
  ctx.say = s => { if (ctx.trace) ctx.log.push(s); };
  ctx.do = (id, payload = {}) => {
    const r = act(S, id, payload);
    if (typeof r !== 'object' || typeof r.ok !== 'boolean') throw new Error('bad Result shape from ' + id);
    if (!r.ok && typeof r.error !== 'string') throw new Error('Result without error text from ' + id);
    if (ctx.trace && r.ok && id !== 'negPreview') ctx.say('  · ' + id + ' ' + JSON.stringify(payload).slice(0, 90));
    return r;
  };
  return ctx;
}

// ------------------------------------------------------------------ table play
// `style`: 'sharp' probes the hint (starts greedy, comes down until the hint stops saying Düşük); 'casual' offers a fixed greedy-ish fee and takes the first counter.
function playTable(ctx, style) {
  const S = ctx.S, rnd = ctx.rnd;
  const n = S.negotiation;
  ctx.tables.opened++;
  let rounds = 0, done = false;
  const L = n.limits;
  let fee = style === 'sharp' ? Math.min(L.fee[1], Math.round(n.fair.fee * 2.2)) : Math.round(n.fair.fee * (rnd.chance(0.5) ? 1.0 : 2.5));
  let wage = Math.max(L.wage[0], n.fair.wage);
  for (let guard = 0; guard < 8 && S.negotiation; guard++) {
    if (style === 'sharp') {
      for (let k = 0; k < 20; k++) {
        const pv = act(S, 'negPreview', { package: { wage, fee } }).preview;
        if (pv.hint !== 'Düşük' || fee <= 0) break;
        fee = Math.max(0, Math.round(fee * 0.85 / 100) * 100);
        if (pv.hint === 'Düşük' && k >= 8) wage = Math.max(L.wage[0], Math.round(wage * 0.97 / 100) * 100);
      }
    }
    const r = ctx.do('negPropose', { package: { wage, fee } });
    if (!r.ok) { ctx.exceptions.push({ message: 'negPropose failed: ' + r.error }); ctx.do('negWalkAway'); break; }
    rounds++;
    if (r.outcome === 'accepted') { done = true; break; }
    if (r.outcome === 'left') break;
    if (r.outcome === 'countered') {
      const take = style === 'sharp' ? (rounds >= 2 || rnd.chance(0.5)) : rnd.chance(0.6);
      if (take) { const a = ctx.do('negAcceptCounter'); if (a.ok && a.outcome === 'accepted') done = true; else if (!a.ok) ctx.exceptions.push({ message: 'acceptCounter failed: ' + a.error }); break; }
      if (style === 'sharp') { fee = Math.round(r.counter.package.fee); wage = r.counter.package.wage; } else fee = Math.round(Math.max(fee * 0.9, r.counter.package.fee * 1.3));
    }
  }
  if (S.negotiation) ctx.do('negWalkAway');
  ctx.tables.rounds.push(rounds);
  if (done) { ctx.tables.won++; if (S.deals.length === 1) ctx.tables.first = 1; } else ctx.tables.lost++;
  ctx.say('  table ' + (done ? 'WON' : 'lost') + ' in ' + rounds);
}

function openTables(ctx, style, max) {
  const S = ctx.S;
  let used = 0;
  for (const o of sel.offerList(S)) {
    if (used >= max || S.agency.energy < 1 || S.negotiation) break;
    if (style === 'sharp' && !o.plays) continue; // careful: only sell where he plays
    const r = ctx.do('openNegotiation', { interestId: o.id });
    if (r.ok) { playTable(ctx, style); used++; }
  }
  return used;
}

function bestPitch(S, p) { return sel.pitchOptions(S, p.id, 40).find(o => o.fit === 'İlgilenir' && !o.offered && !o.cooldown); }

// ------------------------------------------------------------------ monthly turns
const BOTS = {
  passive: { turn() {} },
  casual: {
    turn(ctx) {
      const S = ctx.S, rnd = ctx.rnd;
      const cl = sel.clientList(S);
      if (S.inbox[0]) { const c = S.inbox[0]; ctx.do('answerInbox', { inboxId: c.id, optionId: rnd.pick(c.options).id }); }
      if (S.agency.energy > 0) openTables(ctx, 'casual', rnd.chance(0.7) ? 1 : 0);
      if (S.agency.energy > 0 && rnd.chance(0.5)) {
        const c = sel.candidateList(S).find(x => x.canSign);
        if (c && cl.length < 6) ctx.do('signPlayer', { playerId: c.id });
      }
      if (S.agency.energy > 0 && rnd.chance(0.5) && cl.length) {
        const p = rnd.pick(cl);
        const o = bestPitch(S, p);
        if (o) ctx.do('pitchPlayer', { playerId: p.id, clubId: o.clubId });
      }
      if (S.agency.energy > 0 && rnd.chance(0.4)) ctx.do('searchPlayers');
      if (S.agency.cash > 300000 && rnd.chance(0.2)) { const u = sel.agencyView(S).upgrades.find(x => !x.owned && x.canAfford && S.agency.cash - x.price > 150000); if (u) ctx.do('buyUpgrade', { upgradeId: u.id }); }
    },
  },
  sharp: {
    turn(ctx) {
      const S = ctx.S;
      const cl = sel.clientList(S);
      if (S.inbox[0]) { const c = S.inbox[0]; const free = c.options.find(o => !o.cost.cash && !o.cost.energy) || c.options[0]; const good = c.options.find(o => o.cost.cash <= S.agency.cash * 0.05 && c.key !== 'tax' && o.cost.energy === 0 && o.cost.cash > 0); ctx.do('answerInbox', { inboxId: c.id, optionId: (good || free).id }); }
      // 1. tables first: that is where the money is
      openTables(ctx, 'sharp', 2);
      // 2. sign the best affordable candidate (potential, youth); keep ≤ 7 clients
      let c = sel.candidateList(S).filter(x => x.canSign && x.stars >= 2).sort((a, b) => (b.potential.hi * 2 + b.stars) - (a.potential.hi * 2 + a.stars) || a.age - b.age)[0];
      if (c && cl.length < 9 && S.agency.energy > 0) { if (!c.watched && S.agency.energy > 1 && c.potential.hi - c.potential.lo >= 1 && c.age <= 23) ctx.do('watchPlayer', { playerId: c.id }); ctx.do('signPlayer', { playerId: c.id }); }
      // 3. pitch clients that have no offer yet (best-fit club, where he plays)
      for (const p of sel.clientList(S)) {
        if (S.agency.energy < 1) break;
        if (p.offers > 0 || p.injured) continue;
        if (p.mood >= 75 && p.stars <= 2 && p.age <= 21) continue; // let the youngster grow
        const o = bestPitch(S, p);
        if (o) ctx.do('pitchPlayer', { playerId: p.id, clubId: o.clubId });
      }
      openTables(ctx, 'sharp', 1);
      // 4. look for more talent
      while (S.agency.energy > 0 && S.found.length < 4 && ctx.do('searchPlayers').ok) { /* search */ }
      // 5. upgrades when rich
      for (const u of sel.agencyView(S).upgrades) if (!u.owned && ['office', 'scouts', 'network'].includes(u.id) && u.canAfford && S.agency.cash - u.price > 100000) { ctx.do('buyUpgrade', { upgradeId: u.id }); break; }
    },
  },
  fuzz: {
    turn(ctx) {
      const S = ctx.S, rnd = ctx.rnd;
      const ids = Object.keys(S.players), cids = Object.keys(S.clubs);
      const ops = [
        () => ctx.do('searchPlayers'),
        () => ctx.do('watchPlayer', { playerId: rnd.pick(ids) }),
        () => ctx.do('watchPlayer', { playerId: 'nope' }),
        () => ctx.do('signPlayer', { playerId: rnd.pick(ids) }),
        () => { const f = S.found[0]; if (f) ctx.do('signPlayer', { playerId: f }); },
        () => ctx.do('releaseClient', { playerId: rnd.pick(ids) }),
        () => { const c = sel.myClients(S); if (c.length) ctx.do('pitchPlayer', { playerId: rnd.pick(c).id, clubId: rnd.pick(cids) }); },
        () => ctx.do('pitchPlayer', { playerId: rnd.pick(ids), clubId: 'zzz' }),
        () => { const o = sel.offerList(S)[0]; if (o) { ctx.do('openNegotiation', { interestId: o.id }); } },
        () => ctx.do('openNegotiation', { interestId: 'x' }),
        () => { if (S.negotiation) ctx.do('negPreview', { package: { wage: rnd.int(-5, 400000), fee: rnd.int(-5, 900000) } }); },
        () => { if (S.negotiation) ctx.do('negPropose', { package: { wage: rnd.pick([NaN, 'x', null, S.negotiation.minWage, S.negotiation.fair.wage * 2]), fee: rnd.int(0, 300000) } }); },
        () => { if (S.negotiation) ctx.do('negPropose', { package: { wage: S.negotiation.fair.wage, fee: rnd.int(0, S.negotiation.fair.fee * 3) } }); },
        () => { if (S.negotiation) { const s2 = deserialize(serialize(S)); if (JSON.stringify(s2.negotiation) !== JSON.stringify(S.negotiation)) throw new Error('save round-trip mismatch mid-table'); } },
        () => ctx.do('negAcceptCounter'),
        () => ctx.do('negWalkAway'),
        () => ctx.do('buyUpgrade', { upgradeId: rnd.pick(['office', 'scouts', 'lawyer', 'network', 'academy', 'brand', 'zzz']) }),
        () => { const c = S.inbox[0]; if (c) ctx.do('answerInbox', { inboxId: c.id, optionId: rnd.pick(c.options).id }); },
        () => ctx.do('answerInbox', { inboxId: 'zzz', optionId: 'a' }),
        () => ctx.do('takeLoan'),
        () => ctx.do('skipGuide'),
        () => ctx.do('nonsense'),
      ];
      for (let i = 0; i < 12; i++) rnd.pick(ops)();
      if (S.negotiation && rnd.chance(0.5)) ctx.do('negWalkAway');
      for (const f of [sel.hubSummary, sel.clientList, sel.candidateList, sel.offerList, sel.agencyView]) f(S);
      for (const c of sel.clientList(S)) sel.clientView(S, c.id);
    },
  },
};

// ------------------------------------------------------------------ one career
function runCareer(name, seed, opts) {
  const ctx = makeCtx(seed, opts);
  const S = ctx.S, bot = BOTS[name];
  const row = { bot: name, seed, seasons: [], end: null };
  let months = 0, endKind = null, bankruptSeason = null;
  try {
    for (let guard = 0; guard < 12 * (opts.seasons + 1) + 4; guard++) {
      if (S.time.phase === 'over') break;
      if (S.negotiation) ctx.do('negWalkAway');
      ctx.say(`# S${S.time.season} ${sel.monthName(S)} cash ${S.agency.cash} rep ${S.agency.rep.toFixed(1)} clients ${sel.myClients(S).length} offers ${sel.offerList(S).length}`);
      bot.turn(ctx);
      if (S.negotiation) ctx.do('negWalkAway');
      const rep = advance(S);
      if (!rep.ok) { ctx.exceptions.push({ message: 'advance failed: ' + rep.error }); break; }
      months++;
      if (rep.seasonEnd) {
        const mine = sel.myClients(S);
        row.seasons.push({ season: rep.season, cash: S.agency.cash, rep: S.agency.rep, clients: mine.length, rank: sel.myRank(S), deals: S.agency.stats.deals, commission: S.agency.stats.commission, stars: mine.filter(p => p.ca >= 70).length });
      }
      if (rep.ending) { endKind = rep.ending.kind; if (endKind === 'iflas') bankruptSeason = rep.season; break; }
    }
    if (name === 'fuzz') { const j = serialize(S); if (JSON.stringify(deserialize(j).time) !== JSON.stringify(S.time)) throw new Error('round trip'); }
  } catch (e) { ctx.exceptions.push({ message: e.message, stack: e.stack }); }
  row.end = { ending: endKind, rank: sel.myRank(S), cash: S.agency.cash, rep: S.agency.rep, clients: sel.myClients(S).length, deals: S.agency.stats.deals, commission: S.agency.stats.commission, legacy: S.ending ? S.ending.legacy : 0, months, my: (S.ranking.find(r => r.id === 'you') || {}).score || 0, top: S.ranking.find(r => r.id !== 'you').score, pf: sel.myClients(S).reduce((a, p) => a + p.value, 0), stars: sel.myClients(S).filter(p => p.ca >= 70).length };
  return { ...row, tables: ctx.tables, exceptions: ctx.exceptions, bankruptSeason, log: ctx.log };
}

// ------------------------------------------------------------------ report
const fmtM = v => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.round(v / 1000) + 'K');
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0; };
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
function report(name, runs) {
  const kinds = {}, ranks = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of runs) { kinds[r.end.ending || 'bitmedi'] = (kinds[r.end.ending || 'bitmedi'] || 0) + 1; ranks[r.end.ending === 'iflas' || r.end.ending === 'yalniz' ? 0 : r.end.rank]++; }
  const T = runs.reduce((a, r) => { a.opened += r.tables.opened; a.won += r.tables.won; a.rounds.push(...r.tables.rounds); return a; }, { opened: 0, won: 0, rounds: [] });
  const hist = {}; for (const x of T.rounds) hist[x] = (hist[x] || 0) + 1;
  console.log(`\n== ${name}: ${runs.length} kariyer ==`);
  console.log('  bitiş: ' + Object.entries(kinds).map(([k, v]) => k + ' ' + v).join(', '));
  console.log('  sıralama (0=iflas/müşterisiz, 1..5): ' + Object.entries(ranks).map(([k, v]) => k + ':' + v).join('  '));
  console.log(`  masa: ${T.opened} açıldı, kapanan %${Math.round(T.won / Math.max(1, T.opened) * 100)}, ort. tur ${mean(T.rounds).toFixed(2)} | tur dağılımı (kapanış ya da ayrılma turu) ` + Object.keys(hist).sort().map(k => k + ':' + Math.round(hist[k] / T.rounds.length * 100) + '%').join(' '));
  const maxS = Math.max(...runs.map(r => r.seasons.length));
  console.log('  sezon: kasa(medyan) itibar müşteri sıra anlaşma');
  for (let i = 0; i < maxS; i++) {
    const rows = runs.map(r => r.seasons[i]).filter(Boolean);
    const cs = rows.map(x => x.cash).sort((a, b) => a - b);
    console.log(`   ${i + 1}  hayatta ${rows.length}/${runs.length}  ${fmtM(cs[Math.floor(cs.length / 2)] || 0).padStart(6)}  ${mean(rows.map(x => x.rep)).toFixed(1).padStart(5)}  ${mean(rows.map(x => x.clients)).toFixed(1).padStart(4)}  ${mean(rows.map(x => x.rank)).toFixed(1).padStart(4)}  ${mean(rows.map(x => x.deals)).toFixed(1).padStart(5)}`);
  }
  console.log(`  son: kasa ${fmtM(mean(runs.map(r => r.end.cash)))} itibar ${mean(runs.map(r => r.end.rep)).toFixed(1)} komisyon ${fmtM(mean(runs.map(r => r.end.commission)))} portföy ${fmtM(mean(runs.map(r => r.end.pf)))} yıldız ${mean(runs.map(r => r.end.stars)).toFixed(1)} | puan ben ${fmtM(mean(runs.map(r => r.end.my)))} / en iyi rakip ${fmtM(mean(runs.map(r => r.end.top)))} | miras ort. ${Math.round(mean(runs.map(r => r.end.legacy)))} (p10/p50/p90 ${pct(runs.map(r => r.end.legacy), 0.1)}/${pct(runs.map(r => r.end.legacy), 0.5)}/${pct(runs.map(r => r.end.legacy), 0.9)})`);
  const bk = runs.filter(r => r.end.ending === 'iflas');
  if (bk.length) console.log('  iflas: ' + bk.map(r => 'seed ' + r.seed + ' (sezon ' + r.bankruptSeason + ')').join(', '));
  const bad = runs.filter(r => r.exceptions.length);
  console.log(`  istisna: ${bad.length}`);
  for (const r of bad.slice(0, 3)) console.log(`  !! seed ${r.seed}: ${r.exceptions[0].message}\n${r.exceptions[0].stack || ''}`);
  return bad.length;
}

function parseArgs(argv) {
  const o = { bot: 'sharp', seeds: 16, seed0: 1, seasons: BAL.careerSeasons, trace: null, par: 1, raw: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--bot') o.bot = argv[++i];
    else if (a === '--seeds') o.seeds = +argv[++i];
    else if (a === '--seed0') o.seed0 = +argv[++i];
    else if (a === '--seasons') o.seasons = +argv[++i];
    else if (a === '--trace') o.trace = /^\d+$/.test(argv[i + 1] || '') ? +argv[++i] : o.seed0;
    else if (a === '--par') o.par = +argv[++i];
    else if (a === '--raw') o.raw = true;
  }
  return o;
}
function runSlice(name, o, seed0, seeds) {
  return new Promise((res, rej) => {
    const args = [fileURLToPath(import.meta.url), '--bot', name, '--seed0', String(seed0), '--seeds', String(seeds), '--seasons', String(o.seasons), '--raw'];
    const ch = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 30 });
    let out = '';
    ch.stdout.on('data', d => { out += d; });
    ch.on('close', () => { try { res(JSON.parse(out)); } catch (e) { rej(new Error('bad child output: ' + out.slice(0, 300))); } });
  });
}
async function main() {
  const o = parseArgs(process.argv.slice(2));
  const names = o.bot === 'all' ? Object.keys(BOTS) : o.bot.split(',');
  for (const n of names) if (!BOTS[n]) { console.error('bilinmeyen bot: ' + n + ' (' + Object.keys(BOTS).join(', ') + ')'); process.exit(2); }
  let bad = 0;
  for (const name of names) {
    if (o.trace !== null) { const r = runCareer(name, o.trace, { seasons: o.seasons, trace: true }); console.log(r.log.join('\n')); if (r.exceptions.length) { console.log(r.exceptions[0].message + '\n' + (r.exceptions[0].stack || '')); bad++; } continue; }
    if (o.raw) { const runs = []; for (let i = 0; i < o.seeds; i++) { const r = runCareer(name, o.seed0 + i, { seasons: o.seasons }); delete r.log; runs.push(r); } process.stdout.write(JSON.stringify(runs)); process.exit(0); }
    let runs = [];
    if (o.par > 1) {
      const per = Math.ceil(o.seeds / o.par), jobs = [];
      for (let k = 0; k < o.par; k++) { const a = k * per, n = Math.min(per, o.seeds - a); if (n > 0) jobs.push(runSlice(name, o, o.seed0 + a, n)); }
      runs = (await Promise.all(jobs)).flat();
    } else for (let i = 0; i < o.seeds; i++) { const r = runCareer(name, o.seed0 + i, { seasons: o.seasons }); delete r.log; runs.push(r); }
    bad += report(name, runs);
  }
  process.exit(bad ? 1 : 0);
}
export { runCareer, BOTS, makeCtx };
if (import.meta.url === "file://" + process.argv[1]) main();
