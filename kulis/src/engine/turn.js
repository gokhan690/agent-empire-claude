// advanceMonth(S): the monthly orchestrator.
import { BAL, MONTHS } from './constants.js';
import { playMatchday } from './match.js';
import { squadIndex } from './selection.js';
import { developMonth } from './development.js';
import { refreshValues } from './valuation.js';
import { monthlyEconomy } from './economy.js';
import { endSeason } from './season.js';
import { myClients, energyMaxFor, hasUpgrade } from './selectors.js';
import { addRep } from './economy.js';
import * as market from './market.js';
import * as clients from './clients.js';
import * as rivals from './rivals.js';
import * as events from './events.js';
import * as goal from './goal.js';
import * as ending from './ending.js';

function snap(p) { const s = p.st; return { apps: s.apps, mins: s.mins, goals: s.goals, assists: s.assists, rs: s.ratingSum, ca: p.ca, value: p.value }; }

/**
 * Advance one month. Mutates S.
 * @param {object} S
 * @returns {object} MonthReport `{ok, season, month, matchdays, clients, finance, news, rivalMoves, events, seasonEnd, ending}` or `{ok:false,error}`.
 */
export function advanceMonth(S) {
  if (S.time.phase === 'over') return { ok: false, error: 'Kariyer sona erdi' };
  if (S.negotiation) return { ok: false, error: 'Açık bir masa var' };
  const { season, month } = S.time;
  const report = { ok: true, season, month, matchdays: [], clients: [], finance: null, news: [], rivalMoves: [], events: [], seasonEnd: null, ending: null };
  const before = new Map(myClients(S).map(p => [p.id, snap(p)]));

  // matchdays
  const idx = squadIndex(S);
  for (let k = 0; k < MONTHS[month].matchdays; k++) {
    for (const lid in S.leagues) {
      const r = playMatchday(S, lid, idx);
      if (r) report.matchdays.push(r);
    }
  }
  developMonth(S);
  refreshValues(S);
  // world systems
  report.events.push(...market.monthly(S));
  report.events.push(...clients.monthly(S));
  report.rivalMoves = rivals.monthly(S);
  // economy
  const fin = monthlyEconomy(S);
  report.finance = { items: fin.items, net: fin.net, cash: fin.cash };
  if (fin.loanOffer) report.events.push({ type: 'loanOffer' });
  if (fin.bankrupt) {
    report.ending = ending.build(S, 'iflas');
    finish(S, report, before);
    return report;
  }
  // narrative
  ending.track(S);
  report.events.push(...events.monthly(S));
  report.events.push(...goal.check(S));
  // zero clients: warning, then the career ends after BAL.econ.noClientMonthsEnd month ends in a row
  if (myClients(S).length === 0) {
    S.agency.noClientMonths = (S.agency.noClientMonths || 0) + 1;
    if (S.agency.noClientMonths >= BAL.econ.noClientMonthsEnd) {
      report.ending = ending.build(S, 'yalniz');
      finish(S, report, before);
      return report;
    }
    report.events.push({ type: 'noClients', left: BAL.econ.noClientMonthsEnd - S.agency.noClientMonths });
  } else S.agency.noClientMonths = 0;
  // season rollover
  if (month === 11) {
    clientRows(S, report, before);
    report.seasonEnd = endSeason(S);
    report.events.push(...report.seasonEnd.clientEvents);
    report.news = S.news.filter(n => n.season === season && n.month === month);
    if (season >= S.meta.careerSeasons) {
      S.time.season++; S.time.month = 0;
      report.ending = ending.build(S, 'kariyer');
      return report;
    }
    S.time.season++; S.time.month = 0;
    goal.assign(S);
    if (hasUpgrade(S, 'brand')) addRep(S, BAL.upgrade.brandRep);
  } else {
    finish(S, report, before);
    S.time.month++;
  }
  S.agency.energyMax = energyMaxFor(S);
  S.agency.energy = S.agency.energyMax;
  return report;
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
