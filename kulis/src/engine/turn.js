// advanceMonth(S): the monthly orchestrator (DESIGN §4).
import { BAL, MONTHS } from './constants.js';
import { playMatchday } from './match.js';
import { squadIndex } from './selection.js';
import { developMonth } from './development.js';
import { refreshValues } from './valuation.js';
import { monthlyEconomy } from './economy.js';
import { endSeason } from './season.js';
import { myClients, energyMaxFor } from './selectors.js';
import * as market from './market.js';
import * as clients from './clients.js';
import * as promises from './promises.js';
import * as rivals from './rivals.js';
import * as scouting from './scouting.js';
import * as events from './events.js';
import * as objectives from './objectives.js';
import * as tutorial from './tutorial.js';
import * as deadline from './deadline.js';
import * as ending from './ending.js';

function snap(p) { const s = p.st; return { apps: s.apps, mins: s.mins, goals: s.goals, assists: s.assists, rs: s.ratingSum, ca: p.ca, value: p.value }; }

/**
 * Advance one month (see DESIGN §4 for order). Mutates S.
 * @param {object} S
 * @returns {object} MonthReport `{ok, season, month, matchdays, clients, finance, news, promises, rivalMoves, events, seasonEnd, ending}`
 *   or `{ok:true, phase:'deadline'}` when Son Gün starts, or `{ok:false,error}`.
 */
export function advanceMonth(S) {
  if (S.time.phase === 'over') return { ok: false, error: 'Kariyer sona erdi' };
  if (S.time.phase === 'deadline') return { ok: false, error: 'Son Gün sürüyor' };
  if (S.negotiation) return { ok: false, error: 'Açık bir masa var' };
  if (S.inbox.some(c => c.must)) return { ok: false, error: 'Önce zorunlu kartı yanıtla' };
  const { season, month } = S.time;
  const key = season + ':' + month;
  if (MONTHS[month].deadline && S.flags.deadlineDone !== key) {
    if (deadline.start(S)) { S.time.phase = 'deadline'; return { ok: true, phase: 'deadline', season, month }; }
  }
  const report = { ok: true, season, month, matchdays: [], clients: [], finance: null, news: [], promises: [], rivalMoves: [], events: [], seasonEnd: null, ending: null };
  const mine = myClients(S);
  const before = new Map(mine.map(p => [p.id, snap(p)]));

  // 3. matchdays
  const idx = squadIndex(S);
  for (let k = 0; k < MONTHS[month].matchdays; k++) {
    for (const lid in S.leagues) {
      const r = playMatchday(S, lid, idx);
      if (r) report.matchdays.push(r);
    }
  }
  // 4. development + values
  developMonth(S);
  refreshValues(S);
  // 5-8. world systems
  report.events.push(...market.monthly(S));
  report.events.push(...clients.monthly(S));
  report.promises = promises.check(S);
  report.rivalMoves = rivals.monthly(S);
  report.events.push(...scouting.monthly(S));
  // 9. economy
  const fin = monthlyEconomy(S);
  report.finance = { items: fin.items, net: fin.net, cash: fin.cash };
  if (fin.loanOffer) report.events.push({ type: 'loanOffer' });
  if (fin.bankrupt) {
    report.ending = ending.build(S, 'iflas');
    finish(S, report, before);
    return report;
  }
  // 10. narrative
  report.events.push(...events.monthly(S));
  report.events.push(...tutorial.monthly(S));
  report.events.push(...objectives.check(S));
  // 10b. zero-client grace: warning card each month, career ends after BAL.econ.noClientMonthsEnd month ends in a row
  if (myClients(S).length === 0) {
    S.agency.noClientMonths = (S.agency.noClientMonths || 0) + 1;
    if (S.agency.noClientMonths >= BAL.econ.noClientMonthsEnd && !(month === 11 && season >= 2)) { // June of season 2+ keeps its own season-end check below
      report.ending = ending.build(S, 'yalniz');
      finish(S, report, before);
      return report;
    }
    report.events.push(...noClientWarning(S));
  } else S.agency.noClientMonths = 0;
  // 11. season rollover
  if (month === 11) {
    clientRows(S, report, before); // before endSeason resets stats / retires players
    report.seasonEnd = endSeason(S);
    report.events.push(...report.seasonEnd.clientEvents);
    report.news = S.news.filter(n => n.season === season && n.month === month);
    if (season >= 2 && myClients(S).length === 0) { report.ending = ending.build(S, 'musterisiz'); return report; }
    if (season >= S.meta.careerSeasons) {
      S.time.season++; S.time.month = 0;
      report.ending = ending.build(S, 'kariyer');
      return report;
    }
    S.time.season++; S.time.month = 0;
    objectives.offer(S);
  } else {
    finish(S, report, before);
    S.time.month++;
  }
  S.agency.energyMax = energyMaxFor(S);
  S.agency.energy = S.agency.energyMax;
  return report;
}

function noClientWarning(S) {
  const left = Math.max(0, BAL.econ.noClientMonthsEnd - S.agency.noClientMonths);
  S.inbox = S.inbox.filter(c => c.key !== 'no_clients');
  const card = events.addCard(S, {
    key: 'no_clients', kind: 'ajans', title: 'Hiç müşterin kalmadı', from: 'Rıza Abi', expiresIn: 1,
    body: left > 0
      ? `Ajansın şu an tek bir oyuncuyu bile temsil etmiyor. Böyle giderse ${left} ay içinde kapıya kilit vurulur. Bir keşif gezisine çık, yetenek bul, ya da bir oyuncuyu ikna et.`
      : 'Ajansın hâlâ tek bir oyuncuyu bile temsil etmiyor.',
    options: [{ id: 'tamam', label: 'Tamam', hint: 'Müşteri bulmalısın', cost: { energy: 0, cash: 0 }, risk: null, effects: [] }],
    defaultOption: 'tamam',
  });
  return [{ type: 'inboxNew', cardId: card.id, key: card.key, title: card.title }];
}

function finish(S, report, before) {
  const { season, month } = report;
  clientRows(S, report, before);
  report.news = S.news.filter(n => n.season === season && n.month === month);
}

function clientRows(S, report, before) {
  for (const [id, b] of before) {
    const p = S.players[id];
    if (!p || p.agentId !== 'you') continue;
    const s = p.st;
    const dApps = s.apps - b.apps;
    report.clients.push({
      playerId: id, apps: dApps, mins: s.mins - b.mins, goals: s.goals - b.goals, assists: s.assists - b.assists,
      rating: dApps ? Math.round((s.ratingSum - b.rs) / dApps * 10) / 10 : 0, caDelta: p.ca - b.ca, valueDelta: p.value - b.value,
    });
  }
}
