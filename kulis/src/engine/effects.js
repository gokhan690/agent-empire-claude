// Effect primitives used by inbox options and other systems.
// An effects list is an array of plain objects. Each object may combine keys, e.g.
//   {loyalty: 5, morale: 3, playerId}  {trust: 10, clubId}  {cash: -5000}  {rep: 2}
// Player-targeted keys use effect.playerId ?? ctx.playerId; club keys use effect.clubId ?? ctx.clubId.
import { BAL, LEAGUE_DEFS } from './constants.js';
import { clamp } from './util.js';
import { spend, earn, addRep } from './economy.js';
import { uid, rint, pickWeighted } from './rng.js';
import { absMonth } from './selectors.js';
import { makeName } from './data/names.js';
import * as promises from './promises.js';
import * as news from './news.js';

const NON_KEYS = new Set(['playerId', 'clubId', 'label']);
/** Every effect key applyEffects understands (used by tests and by the inbox preview). */
export const EFFECT_KEYS = ['cash', 'rep', 'energy', 'loyalty', 'morale', 'hype', 'form', 'know', 'injure', 'trust', 'promise', 'interest', 'news', 'flag',
  'releaseClient', 'heal', 'scout', 'commission', 'sellTo', 'directorMove', 'queue'];

/**
 * Apply effects to S in place.
 * Keys: cash, rep, energy, loyalty, morale, trust, hype, form, injure(months), know,
 * promise({type,dueSeason,dueMonth,text}), interest({playerId,clubId,level,kind}), news({kind,text,...}),
 * flag(string key), releaseClient(playerId), heal(months), scout(know: reveals + knowledge), commission(±pct points on the
 * representation contract), sellTo(rivalId: client goes to that rival), directorMove({from,to} club ids), queue({key,months,ctx}: spawn a
 * follow-up inbox card later).
 * @param {object} S
 * @param {object[]|object} effects
 * @param {{playerId?:string, clubId?:string}} [ctx]
 * @returns {object[]} UI events [{type:'effect', key, value, playerId?, clubId?}]
 */
export function applyEffects(S, effects, ctx = {}) {
  const list = Array.isArray(effects) ? effects : (effects ? [effects] : []);
  const events = [];
  const A = S.agency;
  for (const ef of list) {
    const pid = ef.playerId ?? ctx.playerId;
    const cid = ef.clubId ?? ctx.clubId;
    const p = pid ? S.players[pid] : null;
    const c = cid ? S.clubs[cid] : null;
    const label = ef.label || 'Olay';
    for (const key in ef) {
      if (NON_KEYS.has(key)) continue;
      const v = ef[key];
      switch (key) {
        case 'cash': if (v > 0) earn(S, v, 'event', label); else if (v < 0) spend(S, -v, 'event', label); break;
        case 'rep': addRep(S, v); break;
        case 'energy': A.energy = clamp(A.energy + v, 0, A.energyMax); break;
        case 'loyalty': if (p) p.loyalty = clamp(p.loyalty + v, 0, 100); break;
        case 'morale': if (p) p.morale = clamp(p.morale + v, 0, 100); break;
        case 'hype': if (p) p.hype = clamp(p.hype + v, 0, 100); break;
        case 'form': if (p) p.form = clamp(p.form + v, -10, 10); break;
        case 'know': if (p) p.know = clamp(p.know + v, 0, 100); break;
        case 'injure': if (p) p.injured = Math.max(p.injured, v); break;
        case 'trust': if (c) c.trust = clamp(c.trust + v, 0, 100); break;
        case 'promise': if (p || v.playerId) promises.add(S, { playerId: pid, ...v }); break;
        case 'interest': {
          const t = { kind: 'transfer', ...v };
          const ex = S.interests.find(i => i.playerId === t.playerId && i.clubId === t.clubId);
          if (ex) ex.level = clamp(t.level, 0, 100);
          else S.interests.push({ id: uid(S, 'i'), playerId: t.playerId, clubId: t.clubId, level: clamp(t.level, 0, 100), kind: t.kind, cooldown: 0 });
          break;
        }
        case 'news': news.push(S, v); break;
        case 'flag': S.flags.seen[v] = true; break;
        case 'releaseClient': {
          const q = S.players[v];
          S.promises = S.promises.filter(x => !(x.playerId === v && x.status === 'open'));
          if (q && q.agentId === 'you') { q.agentId = null; q.rep = null; q.loyalty = 40; q.shortlisted = false; }
          break;
        }
        case 'heal': if (p) p.injured = Math.max(0, p.injured - v); break;
        case 'scout': if (p) { p.seen = true; p.know = clamp(p.know + v, 0, 100); } break;
        case 'commission': if (p && p.rep) p.rep.commissionPct = clamp(p.rep.commissionPct + v, 3, 12); break;
        case 'sellTo': {
          const rv = S.rivals.find(r => r.id === v);
          if (p && rv && p.agentId === 'you') {
            p.agentId = rv.id; p.rep = { commissionPct: rint(S, BAL.rivalCommission[0], BAL.rivalCommission[1]), endSeason: S.time.season + 2 };
            p.loyalty = 55; p.shortlisted = false;
            S.promises = S.promises.filter(q => !(q.playerId === p.id && q.status === 'open'));
          }
          break;
        }
        case 'directorMove': {
          const A = S.clubs[v.from], B = S.clubs[v.to];
          if (A && B && A !== B) {
            const nat = (LEAGUE_DEFS.find(d => d.id === A.leagueId) || LEAGUE_DEFS[0]).nat;
            B.director = A.director;
            A.director = { name: makeName(S, nat), persona: pickWeighted(S, BAL.persona.weights), info: 0 };
            B.trust = Math.max(B.trust, clamp(A.trust - 10, 0, 100));
            A.trust = clamp(A.trust - 15, 0, 100);
          }
          break;
        }
        case 'queue': {
          if (!S.flags.evQueue) S.flags.evQueue = [];
          S.flags.evQueue.push({ key: v.key, due: absMonth(S) + (v.months || 1), ctx: v.ctx || {} });
          break;
        }
        default: throw new Error('applyEffects: unknown effect key ' + key);
      }
      events.push({ type: 'effect', key, value: v, playerId: pid, clubId: cid });
    }
  }
  return events;
}
