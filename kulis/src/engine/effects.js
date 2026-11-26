// Effect primitives used by inbox options and other systems.
// An effects list is an array of plain objects. Each object may combine keys, e.g.
//   {loyalty: 5, morale: 3, playerId}  {trust: 10, clubId}  {cash: -5000}  {rep: 2}
// Player-targeted keys use effect.playerId ?? ctx.playerId; club keys use effect.clubId ?? ctx.clubId.
import { clamp } from './util.js';
import { spend, earn } from './economy.js';
import { uid } from './rng.js';
import * as promises from './promises.js';
import * as news from './news.js';

const NON_KEYS = new Set(['playerId', 'clubId', 'label']);

/**
 * Apply effects to S in place.
 * Keys: cash, rep, energy, loyalty, morale, trust, hype, form, injure(months), know,
 * promise({type,dueSeason,dueMonth,text}), interest({playerId,clubId,level,kind}), news({kind,text,...}),
 * flag(string key), releaseClient(playerId).
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
        case 'rep': A.rep = clamp(A.rep + v, 0, 100); break;
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
          if (q && q.agentId === 'you') { q.agentId = null; q.rep = null; q.loyalty = 40; }
          break;
        }
        default: throw new Error('applyEffects: unknown effect key ' + key);
      }
      events.push({ type: 'effect', key, value: v, playerId: pid, clubId: cid });
    }
  }
  return events;
}
