// Derives everything the SeasonEnd overlay shows from engine state (read-only; selectors + allowed S fields).
import * as sel from '../../../engine/selectors.js';
import { BAL } from '../../../engine/constants.js';

export function computeSeason(S, seasonEnd, report) {
  const hist = S.history || [];
  const last = hist[hist.length - 1] || null;
  const se = seasonEnd || { season: last ? last.season : S.time.season, champions: (last && last.champions) || {}, awards: (last && last.awards) || [], promoted: [], relegated: [], retired: [], clientEvents: [] };
  const season = se.season;
  const cur = hist.find((h) => h.season === season) || last;
  const prev = hist.find((h) => h.season === season - 1) || null;
  const mine = sel.myClients(S);
  const views = mine.map((p) => sel.clientView(S, p.id)).filter(Boolean);
  // clubs each client played for in the season that just ended (career rows are written before moves/renewals)
  const playedFor = {};
  for (const v of views) { const row = (v.career || []).find((c) => c.season === season); if (row && row.apps > 0) playedFor[v.id] = row.clubId; }
  const champions = Object.entries(se.champions || {}).map(([leagueId, clubId]) => {
    const L = S.leagues[leagueId];
    return { leagueId, clubId, league: L ? L.name : leagueId, prestige: L ? L.prestige : 0, mine: views.filter((v) => playedFor[v.id] === clubId).map((v) => ({ id: v.id, name: v.name })) };
  }).sort((a, b) => b.prestige - a.prestige);
  const awards = (se.awards || []).filter((a) => a.kind === 'topscorer').map((a) => {
    const p = S.players[a.playerId];
    return p ? { playerId: a.playerId, name: p.name, goals: a.goals, clubId: p.clubId, league: (S.leagues[a.leagueId] || {}).name, mine: p.agentId === 'you' } : null;
  }).filter(Boolean).sort((a, b) => b.goals - a.goals);
  const clubHas = (cid) => views.filter((v) => playedFor[v.id] === cid).map((v) => v.name);
  const moves = {
    promoted: (se.promoted || []).map((id) => ({ id, mine: clubHas(id) })),
    relegated: (se.relegated || []).map((id) => ({ id, mine: clubHas(id) })),
  };
  const commission = (S.ledger || []).filter((e) => e.season === season).reduce((a, e) => a + e.items.filter((i) => i.k === 'commission' || i.k === 'wagecut').reduce((x, i) => x + i.amt, 0), 0);
  const deals = (S.deals || []).filter((d) => d.season === season);
  const rated = views.filter((v) => v.avgRating > 0).sort((a, b) => b.avgRating - a.avgRating)[0] || null;
  const jumps = ((report && report.clients) || []).filter((c) => c.caDelta > 0 && S.players[c.playerId]).sort((a, b) => b.caDelta - a.caDelta);
  const jump = jumps[0] ? { name: S.players[jumps[0].playerId].name, id: jumps[0].playerId, delta: jumps[0].caDelta } : null;
  const me = {
    rank: cur ? cur.rank : sel.hubSummary(S).rank, prevRank: prev ? prev.rank : null,
    cash: cur ? cur.cash : S.agency.cash, prevCash: prev ? prev.cash : BAL.start.cash,
    rep: cur ? cur.rep : S.agency.rep, prevRep: prev ? prev.rep : BAL.start.rep,
    clients: cur ? cur.clients : mine.length, commission, deals: deals.length, dealFees: deals.reduce((a, d) => a + (d.commission || 0), 0),
    best: rated ? { id: rated.id, name: rated.name, rating: rated.avgRating } : null, jump,
  };
  const nameOf = (id) => (S.players[id] ? S.players[id].name : null);
  const clients = {
    retired: (se.retired || []).filter((r) => r.client).map((r) => ({ id: r.id, name: r.name, age: r.age })),
    renewed: (se.clientEvents || []).filter((e) => e.type === 'renewed' && nameOf(e.playerId)).map((e) => ({ id: e.playerId, name: nameOf(e.playerId) })),
    lost: (S.news || []).filter((n) => n.season === season && (n.kind === 'clientLeft' || n.kind === 'release') && n.playerId).map((n) => ({ id: n.playerId, name: n.text })),
  };
  const lo = season * 12, hi = lo + 11;
  const pr = (S.promises || []).filter((q) => q.resolved >= lo && q.resolved <= hi + 1 && (q.status === 'kept' || q.status === 'broken'));
  const promises = { kept: pr.filter((q) => q.status === 'kept'), broken: pr.filter((q) => q.status === 'broken') };
  return { season, champions, myChamps: champions.filter((c) => c.mine.length), awards, moves, me, clients, promises };
}
