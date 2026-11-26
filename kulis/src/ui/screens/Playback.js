// Playback overlay: the month coming alive. A vertical timeline of four phases that reveal one after another
// (Maçlar -> Oyuncular -> Kasa -> Kulis). Tap a running phase to move on, "Atla" reveals everything, "Devam" closes.
import { html, cx, fmtMoney, MONTH_NAMES, clamp, useState, useEffect, useRef, Overlay, Card, Badge, Button, Avatar, Crest, Icon, Money, NumberTicker, audio, haptics, confetti, store, openOverlay, openSheet } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import { LEAGUE_DEFS } from '../../engine/constants.js';

const LEAGUE = Object.fromEntries(LEAGUE_DEFS.map((l) => [l.id, l.name]));
const rate = (r) => (Math.round(r * 10) / 10).toFixed(1).replace('.', ',');

/** Reveals n items one by one while `run`; everything at once when `full`. Calls onDone `after` ms after the last item. */
function useReveal(n, { run, full, gap, after, onDone }) {
  const [c, setC] = useState(0);
  const cb = useRef(onDone); cb.current = onDone;
  useEffect(() => {
    if (!run || full) return;
    if (c >= n) { const t = setTimeout(() => cb.current && cb.current(), after); return () => clearTimeout(t); }
    const t = setTimeout(() => setC(c + 1), c === 0 ? 260 : gap);
    return () => clearTimeout(t);
  }, [c, run, full, n]);
  return full ? n : c;
}

function Phase({ n, title, icon, state, onTap, children, tone }) {
  return html`<section class=${cx('playback-phase', `is-${state}`, tone && `playback-phase--${tone}`)} onClick=${state === 'run' ? onTap : undefined}>
    <header class="playback-phase__head"><span class="playback-phase__n num">${n}</span><${Icon} name=${icon} size=${18} /><h2 class="t-display">${title}</h2>
      ${state === 'run' ? html`<span class="playback-phase__tap small muted">dokun: ilerle</span>` : null}</header>
    ${children}
  </section>`;
}

/* ---------- phase 1: matches ---------- */
function Goal({ g, S, mine, side }) {
  const p = S.players[g.playerId], a = g.assistId && mine.has(g.assistId) && S.players[g.assistId];
  return html`<div class=${cx('playback-goal', `is-${side}`, mine.has(g.playerId) && 'is-mine')}>
    <span class="num">${g.minute}'</span><${Icon} name="ball" size=${12} /><b>${p ? p.name : 'Oyuncu'}</b>${a ? html`<em>asist ${a.name.split(' ').slice(-1)[0]}</em>` : null}</div>`;
}
function MatchCard({ m, S, mine, full, onGoal }) {
  const [clock, setClock] = useState(full ? 90 : 0);
  const ref = useRef(), heard = useRef(0);
  const goals = [...(m.scorers || [])].sort((a, b) => a.minute - b.minute);
  useEffect(() => {
    if (full) { setClock(90); return; }
    let c = 0; const t = setInterval(() => { c += 3; if (c >= 90) { c = 90; clearInterval(t); } setClock(c); }, 30);
    return () => clearInterval(t);
  }, [full]);
  const shown = goals.filter((g) => g.minute <= clock);
  const end = clock >= 90;
  const hs = end ? m.hg : shown.filter((g) => g.clubId === m.home).length, as = end ? m.ag : shown.filter((g) => g.clubId === m.away).length;
  useEffect(() => {
    if (full || shown.length <= heard.current) { heard.current = Math.max(heard.current, shown.length); return; }
    const g = shown[shown.length - 1]; heard.current = shown.length;
    if (mine.has(g.playerId)) { const r = ref.current && ref.current.getBoundingClientRect(); onGoal(r); }
  }, [shown.length]);
  const H = S.clubs[m.home], A = S.clubs[m.away];
  const mineGoal = goals.some((g) => mine.has(g.playerId));
  const side = (c, cls) => html`<div class=${cx('playback-side', cls, mine.has(c.id) && 'is-you')}><${Crest} colors=${c.colors} pattern=${c.crest} size=${38} /><span class="playback-side__n">${c.name}</span></div>`;
  return html`<div class=${cx('playback-match', mineGoal && end && 'has-goal', !end && 'is-live')} ref=${ref}>
    <div class="playback-match__meta"><span>${LEAGUE[m.leagueId] || ''} · ${m.md + 1}. hafta</span><span class=${cx('playback-clock num', end && 'is-ft')}>${end ? 'MS' : clock + "'"}</span></div>
    <div class="playback-match__score">${side(H, 'is-home')}<div class="playback-sc num"><b>${hs}</b><i>–</i><b>${as}</b></div>${side(A, 'is-away')}</div>
    ${shown.length ? html`<div class="playback-goals">${shown.map((g) => html`<${Goal} g=${g} S=${S} mine=${mine} side=${g.clubId === m.home ? 'home' : 'away'} />`)}</div>` : null}
  </div>`;
}
function Matches({ cards, leagues, S, mine, state, onDone }) {
  const full = state === 'done';
  const n = cards.length;
  const c = useReveal(n + 1, { run: state === 'run', full, gap: clamp(1800 / Math.max(1, n), 380, 800), after: 500, onDone });
  const onGoal = (r) => { audio.play('goal'); haptics.success(); if (r) confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 46, power: 8, duration: 1800 }); };
  return html`<div class="stack">
    ${n ? cards.slice(0, c).map((m) => html`<${MatchCard} key=${m.key} m=${m} S=${S} mine=${mine} full=${full} onGoal=${onGoal} />`) : html`<p class="muted small">Müşterilerinin kulüpleri bu ay maç oynamadı.</p>`}
    ${c > n ? html`<div class="playback-leagues">${leagues.map((l) => html`<div class="playback-lg"><b>${l.name}</b><span>Lider</span><${Crest} colors=${l.club.colors} pattern=${l.club.crest} size=${18} /><em>${l.club.name}</em><span class="num">${l.pts} puan</span></div>`)}</div>` : null}
  </div>`;
}

/* ---------- phase 2: players ---------- */
function Players({ rows, S, state, onDone }) {
  const full = state === 'done';
  const c = useReveal(rows.length, { run: state === 'run', full, gap: clamp(1200 / Math.max(1, rows.length), 120, 300), after: 350, onDone });
  const up = useRef(false);
  useEffect(() => {
    if (full || up.current) return;
    if (rows.slice(0, c).some((r) => r.caDelta > 0)) { up.current = true; audio.play('levelup'); haptics.success(); }
  }, [c]);
  return html`<div class="stack playback-rows">${rows.slice(0, c).map((r) => { const p = S.players[r.playerId]; if (!p) return null;
    const club = S.clubs[p.clubId];
    return html`<div class=${cx('playback-row', r.caDelta > 0 && 'is-up', r.caDelta < 0 && 'is-down')} key=${r.playerId}>
      <${Avatar} id=${p.id} size=${46} colors=${club && club.colors} />
      <div class="grow playback-row__main"><b class="playback-row__n">${p.name}</b>
        <div class="playback-row__meta">${r.apps ? html`<span>${r.apps} maç</span><${Badge} tone=${r.rating >= 7 ? 'lime' : r.rating < 6 ? 'danger' : 'muted'}>${rate(r.rating)}</${Badge}>` : html`<span class="muted">Forma giymedi</span>`}
          ${r.goals ? html`<${Badge} tone="gold" icon="ball">${r.goals} gol</${Badge}>` : null}${r.assists ? html`<${Badge} tone="info">${r.assists} asist</${Badge}>` : null}</div></div>
      <div class="playback-row__d">
        <div class=${cx('playback-ca num', r.caDelta > 0 ? 'lime' : r.caDelta < 0 ? 'danger' : 'muted')}>${r.caDelta > 0 ? '▲ +' + r.caDelta : r.caDelta < 0 ? '▼ ' + String(r.caDelta).replace('-', '−') : '–'}<small>GÜÇ ${p.ca}</small></div>
        ${r.valueDelta ? html`<span class=${cx('playback-vd num small', r.valueDelta > 0 ? 'lime' : 'danger')}>${fmtMoney(r.valueDelta, { sign: true })}</span>` : null}
      </div></div>`; })}</div>`;
}

/* ---------- phase 3: money ---------- */
function Cash({ fin, state, onDone }) {
  const full = state === 'done';
  const n = fin.items.length;
  const c = useReveal(n + 2, { run: state === 'run', full, gap: 200, after: 450, onDone });
  const sound = useRef(false);
  useEffect(() => { if (full || sound.current || c <= n) return; sound.current = true; audio.play(fin.net >= 0 ? 'coin' : 'badnews'); if (fin.net < 0) haptics.warn(); }, [c]);
  return html`<div class="playback-cash stack">
    <div class="playback-items">${fin.items.slice(0, c).map((it) => html`<div class="playback-item"><span>${it.label}</span><${Money} value=${it.amt} sign colored /></div>`)}</div>
    ${c > n ? html`<div class=${cx('playback-net', fin.net < 0 && 'is-neg')}><span class="eyebrow">Bu ayın net sonucu</span>
      <b class="num playback-net__v"><${Money} value=${full ? fin.net : c > n ? fin.net : 0} sign colored count=${!full} /></b></div>` : null}
    ${c > n + 1 ? html`<div class="playback-cashnow"><span class="eyebrow">Kasa</span><b class=${cx('num', fin.cash < 0 && 'danger')}><${NumberTicker} value=${fin.cash} format=${(v) => fmtMoney(v)} duration=${full ? 1 : 700} /></b></div>` : null}
  </div>`;
}

/* ---------- phase 4: kulis ---------- */
function Kulis({ rows, state, onDone }) {
  const full = state === 'done';
  const c = useReveal(rows.length, { run: state === 'run', full, gap: 260, after: 350, onDone });
  const fx = useRef(false);
  useEffect(() => {
    if (full || fx.current) return;
    const r = rows.slice(0, c);
    if (r.some((x) => x.tone === 'gold')) { fx.current = true; audio.play('levelup'); confetti({ count: 70, power: 9 }); }
    else if (r.some((x) => x.tone === 'danger')) { fx.current = true; audio.play('badnews'); haptics.warn(); }
  }, [c]);
  return html`<div class="stack playback-news">${rows.slice(0, c).map((r) => html`<div class=${cx('playback-new', `is-${r.tone || 'muted'}`)}>
    <span class="playback-new__ico"><${Icon} name=${r.icon} size=${16} /></span><span>${r.head ? html`<b>${r.head}</b> ` : null}${r.text}</span></div>`)}</div>`;
}

/* ---------- build the view-model from the report ---------- */
function build(S, report) {
  const mine = new Set(report.clients.map((c) => c.playerId));
  const myClubs = new Set([...mine].map((id) => S.players[id] && S.players[id].clubId).filter(Boolean));
  const cards = [], lg = new Map();
  for (const day of report.matchdays || []) {
    for (const r of day.results) if (myClubs.has(r.home) || myClubs.has(r.away)) cards.push({ ...r, leagueId: day.leagueId, md: day.md, key: day.leagueId + day.md + r.home });
    lg.set(day.leagueId, true);
  }
  const mineLeagues = new Set([...myClubs].map((id) => S.clubs[id].leagueId));
  const leagues = [...lg.keys()].filter((id) => !mineLeagues.has(id)).map((id) => { const t = sel.tableSorted(S, id)[0]; return { name: LEAGUE[id], club: S.clubs[t.clubId], pts: t.pts }; });
  const hasMatches = (report.matchdays || []).length > 0;

  const k = [];
  const pName = (id) => (S.players[id] ? S.players[id].name : 'Oyuncu');
  const cName = (id) => (S.clubs[id] ? S.clubs[id].name : 'Kulüp');
  for (const ev of report.events || []) {
    if (ev.type === 'objective') k.push(ev.status === 'done' ? { icon: 'trophy', tone: 'gold', head: 'Hedef tamam!', text: `${ev.title}${ev.reward ? ' · ödül ' + [ev.reward.cash ? fmtMoney(ev.reward.cash) : '', ev.reward.rep ? '+' + ev.reward.rep + ' itibar' : ''].filter(Boolean).join(' ') : ''}` } : { icon: 'alert', tone: 'danger', head: 'Hedef kaçtı.', text: ev.title });
    else if (ev.type === 'dream') k.push({ icon: 'star', tone: 'gold', head: 'Hayal gerçek oldu!', text: `${pName(ev.playerId)} hayaline kavuştu: bağlılık +30, itibar +4.` });
    else if (ev.type === 'clientLeft') k.push({ icon: 'alert', tone: 'danger', head: 'Müşteri ayrıldı.', text: `${ev.name || pName(ev.playerId)} ${ev.expired ? 'temsil sözleşmesi bittiği için' : 'seninle çalışmayı bıraktı'}.` });
    else if (ev.type === 'interest') k.push({ icon: 'swap', tone: 'info', head: 'Yeni talip:', text: `${cName(ev.clubId)}, ${pName(ev.playerId)} için kapıda (ilgi ${Math.round(ev.level)}).` });
    else if (ev.type === 'repExpiring') k.push({ icon: 'pen', tone: 'gold', head: 'Sözleşme uyarısı:', text: `${pName(ev.playerId)} ile temsil sözleşmen bitmek üzere.` });
    else if (ev.type === 'freeAgentPlaced') k.push({ icon: 'building', tone: 'muted', text: `${pName(ev.playerId)}, ${cName(ev.clubId)} ile anlaştı.` });
    else if (ev.type === 'loanOffer') k.push({ icon: 'building', tone: 'gold', head: 'Banka devrede:', text: 'Kredi teklifi Gündem\'de seni bekliyor.' });
  }
  for (const pr of report.promises || []) {
    if (pr.type === 'walkout') k.push({ icon: 'alert', tone: 'danger', head: 'Küstü.', text: pr.text || 'Bir müşterin tutulmayan söz yüzünden gitti.' });
    else k.push(pr.status === 'kept' ? { icon: 'check', tone: 'lime', head: 'Söz tutuldu:', text: `${pName(pr.playerId)} — ${pr.text}` } : { icon: 'alert', tone: 'danger', head: 'Söz bozuldu:', text: `${pName(pr.playerId)} — ${pr.text}` });
  }
  for (const rm of report.rivalMoves || []) k.push({ icon: 'shield', tone: rm.poached ? 'danger' : 'rival', head: rm.poached ? 'Rakip kaptı:' : 'Rakip hamlesi:', text: rm.text });
  const newCards = (report.events || []).filter((e) => e.type === 'inboxNew').length;
  const rivalTexts = new Set((report.rivalMoves || []).map((r) => r.text));
  const news = (report.news || []).filter((n) => !rivalTexts.has(n.text)).sort((a, b) => (mine.has(b.playerId) ? 1 : 0) - (mine.has(a.playerId) ? 1 : 0)).slice(0, 4);
  for (const n of news) k.push({ icon: 'news', tone: mine.has(n.playerId) ? 'lime' : 'muted', text: n.text });
  if (newCards) k.push({ icon: 'inbox', tone: 'info', text: `Gündem'de ${newCards} yeni kart seni bekliyor.` });
  return { mine, cards, leagues, hasMatches, kulis: k };
}

export default function Playback({ close, report }) {
  const S = store.S;
  if (!report || !S) return html`<${Overlay} label="Ay özeti" onClose=${close}><div class="screen-pad"><${Button} onClick=${close}>Kapat</${Button}></div></${Overlay}>`;
  const [vm] = useState(() => build(S, report));
  const phases = [];
  if (vm.hasMatches) phases.push('match');
  if (report.clients.length) phases.push('players');
  phases.push('cash');
  if (vm.kulis.length) phases.push('kulis');
  const [step, setStep] = useState(0);
  const [skip, setSkip] = useState(false);
  const el = useRef();
  const finished = skip || step >= phases.length;
  const next = (i) => setStep((s) => (s === i ? s + 1 : s));
  useEffect(() => { audio.play('whoosh'); }, []);
  useEffect(() => { // follow the action
    if (finished) return;
    const t = setInterval(() => { const o = el.current; if (o) o.scrollTo({ top: o.scrollHeight, behavior: 'smooth' }); }, 350);
    return () => clearInterval(t);
  }, [finished]);

  const finish = () => {
    audio.play('confirm');
    close();
    try { window.scrollTo(0, 0); } catch {}
    if (report.seasonEnd) openOverlay('SeasonEnd', { seasonEnd: report.seasonEnd, report });
    else if (report.ending) openOverlay('Ending', {});
  };
  const stateOf = (i) => (skip || i < step ? 'done' : i === step ? 'run' : 'wait');
  const idx = (k) => phases.indexOf(k);
  const common = (k) => ({ state: stateOf(idx(k)), onDone: () => next(idx(k)) });
  const show = (k) => idx(k) >= 0 && (skip || idx(k) <= step);
  const PH = { match: ['Maçlar', 'ball'], players: ['Oyuncularım', 'users'], cash: ['Kasa', 'cash'], kulis: ['Kulis', 'news'] };
  const wrap = (k, body) => show(k) ? html`<${Phase} n=${idx(k) + 1} title=${PH[k][0]} icon=${PH[k][1]} state=${stateOf(idx(k))} onTap=${() => next(idx(k))}>${body}</${Phase}>` : null;

  return html`<${Overlay} label="Ay özeti" tone="night" onClose=${finish} class="playback">
    <div class="playback-wrap" ref=${(n) => { if (n) el.current = n.parentElement; }}>
      <header class="playback-top">
        <div><div class="eyebrow">Sezon ${report.season} · ay özeti</div><h1 class="t-display playback-title">${MONTH_NAMES[report.month]} bitti</h1></div>
        ${finished ? null : html`<${Button} size="sm" variant="ghost" onClick=${() => { setSkip(true); audio.play('whoosh'); }}>Atla</${Button}>`}
      </header>
      <div class="playback-dots" aria-hidden="true">${phases.map((p, i) => html`<i class=${cx(stateOf(i) === 'done' && 'is-done', stateOf(i) === 'run' && 'is-now')}></i>`)}</div>
      ${wrap('match', html`<${Matches} cards=${vm.cards} leagues=${vm.leagues} S=${S} mine=${vm.mine} ...${common('match')} />`)}
      ${wrap('players', html`<${Players} rows=${report.clients} S=${S} ...${common('players')} />`)}
      ${wrap('cash', html`<${Cash} fin=${report.finance} ...${common('cash')} />`)}
      ${wrap('kulis', html`<${Kulis} rows=${vm.kulis} ...${common('kulis')} />`)}
      <div class=${cx('playback-foot', finished && 'is-on')}>
        <${Button} size="lg" block icon="arrowRight" onClick=${finish} disabled=${!finished}>${report.seasonEnd ? 'Sezon Özetine Geç' : report.ending ? 'Kariyerin Sonu' : 'Devam'}</${Button}>
      </div>
    </div>
  </${Overlay}>`;
}
