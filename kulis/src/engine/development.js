// Monthly player development: growth toward `pa` driven by minutes, facilities, morale, trait;
// decline from 30+; form decay; hype drift; injuries tick down.
import { BAL, MONTHS } from './constants.js';
import { gauss } from './rng.js';
import { clamp, r1, r2 } from './util.js';

/** Monthly growth rate multiplier from recent minutes share (0..1). */
export function minutesFactor(sh) {
  const D = BAL.dev;
  return D.minFloor + D.minSlope * Math.min(1, sh / D.minFull);
}

/**
 * Advance development one month for every player. Resets per-month minute counters.
 * @param {object} S
 */
export function developMonth(S) {
  const D = BAL.dev;
  const md = MONTHS[S.time.month].matchdays;
  for (const id in S.players) {
    const p = S.players[id];
    const st = p.st;
    const played = st.m > 0;
    if (md > 0) {
      const share = clamp(st.m / (md * 90), 0, 1);
      st.sh = r2(st.sh * D.shSmooth + share * (1 - D.shSmooth));
    }
    st.m = 0;
    if (p.injured > 0) p.injured--;
    if (!played) p.form = r1(p.form * D.formDecay);

    let cf = p.cf;
    if (p.age <= D.growthMaxAge) {
      if (cf < p.pa) {
        const club = S.clubs[p.clubId];
        const fac = D.facBase + D.facStep * (club ? club.facilities : 2);
        const mor = D.moraleBase + D.moraleSlope * (p.morale / 100);
        const tr = p.trait === 'profesyonel' ? D.profesyonel : 1;
        const rate = D.rate * (D.ageFactor[p.age] || 0.4) * minutesFactor(st.sh) * fac * mor * tr;
        cf += (p.pa - cf) * rate;
      }
      cf += gauss(S, 0, D.noiseSd * (p.age < 24 ? 1 : 0.5));
    } else {
      const yr = D.declinePerYear[Math.min(35, p.age)] || 0;
      cf -= (yr / 12) * (p.trait === 'profesyonel' ? D.profDecline : 1);
      cf += gauss(S, 0, D.noiseSd * 0.5);
    }
    cf = clamp(cf, 1, p.pa);
    p.cf = r2(cf);
    p.ca = Math.round(cf);

    // hype drifts toward a target set by level and form
    const tgt = clamp((p.ca - D.hypeBaseFrom) * D.hypeBase, 0, D.hypeBaseMax) + p.form * D.hypeForm;
    p.hype = Math.round(clamp(p.hype + (tgt - p.hype) * D.hypeStep, 0, 100));
  }
}
