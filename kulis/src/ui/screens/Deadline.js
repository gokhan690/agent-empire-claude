// Son Gün — transfer deadline day (Ağustos / Ocak). Clock 18:00 → 24:00, panic calls, open interests, pitch shortcut, midnight summary.
import { html, useState, useEffect, useRef, Overlay, Sheet, Icon, Button, Badge, Avatar, Crest, PosChip, Chip, PipMeter, EmptyState, SectionTitle, store, useStore, openOverlay, audio, haptics, toast, cx, reducedMotion } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import { LEAGUE_DEFS, MONTHS } from '../../engine/constants.js';
import { KIND_LABEL, hourUntil } from './table/lib.js';

const NEED = ['', 'İhtiyaç', 'Acil ihtiyaç', 'PANİK'];
const pad = (n) => String(n).padStart(2, '0');

function useClock(hour, ended) {
  const target = (ended ? 24 : hour) * 60;
  const [m, setM] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    if (reducedMotion() || cur.current === target) { cur.current = target; setM(target); return undefined; }
    const a = cur.current, b = target, t0 = performance.now(), dur = Math.min(1500, 600 + Math.abs(b - a) * 8);
    let raf, last = a;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, v = a + (b - a) * e;
      cur.current = v; setM(v);
      if (Math.floor(v / 10) !== Math.floor(last / 10)) { audio.play('tick'); last = v; }
      if (k < 1) raf = requestAnimationFrame(step); else { cur.current = b; setM(b); }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return m;
}

function Clock({ hour, ended, actionsLeft, actionsMax }) {
  const m = useClock(hour, ended);
  const mm = Math.floor(m) % 1440, hh = Math.floor(mm / 60), mi = mm % 60;
  const hrs = [18, 19, 20, 21, 22, 23];
  return html`<section class=${cx('dlclock', `is-h${ended ? 24 : hour}`)} aria-label=${`Saat ${pad(hh)}:${pad(mi)}`}>
    <div class="dlclock__lbl"><span class="eyebrow">${ended ? 'Transfer dönemi kapandı' : 'Transfer dönemi kapanmasına'}</span>${ended ? null : html`<b class="num">${Math.max(0, 24 - hour)} saat</b>`}</div>
    <div class="dlclock__digits num" aria-hidden="true"><span>${pad(hh)}</span><i>:</i><span>${pad(mi)}</span></div>
    <div class="dlclock__rail" aria-hidden="true">${hrs.map((h) => html`<span class=${cx('dlclock__h', (ended || h < hour) && 'is-past', !ended && h === hour && 'is-now')}><b class="num">${h}</b></span>`)}<span class=${cx('dlclock__h is-end', ended && 'is-now')}><b class="num">00</b></span></div>
    ${ended ? html`<div class="dlclock__mid t-display">Gece yarısı</div>` : html`<div class="dlclock__act"><span>Bu saatin hakkı</span><${PipMeter} value=${actionsLeft} max=${actionsMax} variant="energy" label="Bu saatin hakkı" /></div>`}
  </section>`;
}

function CallCard({ c, S, hour, ended, canAct, onTake }) {
  const club = S.clubs[c.clubId], p = S.players[c.playerId];
  const expired = !c.taken && (ended || c.expiresHour < hour);
  const live = c.available && !ended;
  const fitTone = c.fitSat >= 50 ? 'lime' : c.fitSat >= 40 ? 'gold' : 'danger';
  return html`<article class=${cx('dlcall', live && 'is-ring', c.taken && 'is-taken', expired && 'is-expired', c.level >= 3 && 'is-panic')}>
    <div class="dlcall__phone"><${Icon} name="phone" size=${22} /></div>
    <div class="dlcall__body">
      <div class="dlcall__who"><${Crest} colors=${club.colors} pattern=${club.crest} size=${30} /><div><b class="t-display">${club.name}</b><span>${live ? 'arıyor' : c.taken ? 'ile konuştun' : 'aramıştı'}</span></div></div>
      <div class="dlcall__pl"><${Avatar} id=${p.id} size=${34} /><span><b>${c.playerName}</b> · <${PosChip} pos=${p.pos} /></span></div>
      <div class="dlcall__chips">
        <${Badge} tone=${c.level >= 3 ? 'danger' : c.level === 2 ? 'gold' : 'info'} icon="flame">${NEED[c.level] || 'İhtiyaç'}</${Badge}>
        <${Badge} tone="muted">${KIND_LABEL[c.kind] || c.kind}</${Badge}>
        <${Badge} tone=${fitTone}>${c.fitWord} · orada %${Math.round(c.expectedMinutes * 100)} oynar</${Badge}>
      </div>
      <div class="dlcall__foot">
        <span class=${cx('dlcall__exp', live && c.expiresHour - hour <= 0 && 'is-last')}><${Icon} name="clock" size=${14} /> ${c.taken ? 'Açıldı' : expired ? 'Kaçtı' : hourUntil(c.expiresHour)}</span>
        ${live ? html`<${Button} size="sm" variant="primary" icon="phone" disabled=${!canAct} onClick=${() => onTake(c)}>Aç</${Button}>` : null}
      </div>
      ${live ? html`<p class="dlcall__hint small muted">Açınca hızlı masa kurulur: sabır −1, ama kulüp esner.</p>` : null}
    </div>
  </article>`;
}

function PitchSheet({ close }) {
  const S = store.S;
  const clients = sel.clientList(S);
  const first = clients[0];
  const [pid, setPid] = useState(first ? first.id : null);
  const leagueOfClient = (id) => { const c = clients.find((x) => x.id === id); const cl = c && c.clubId ? S.clubs[c.clubId] : null; return cl ? cl.leagueId : 'tr1'; };
  const [lg, setLg] = useState(first ? leagueOfClient(first.id) : 'tr1');
  const [cid, setCid] = useState(null);
  const [pv, setPv] = useState(null);
  useEffect(() => {
    if (!pid || !cid) { setPv(null); return; }
    const r = store.preview('pitchPreview', { playerId: pid, clubId: cid });
    if (r.ok) setPv(r.preview);
  }, [pid, cid]);
  const cur = clients.find((c) => c.id === pid);
  const rows = sel.clubList(S, lg).filter((c) => !cur || c.id !== cur.clubId);
  const go = () => {
    const r = store.act('pitchPlayer', { playerId: pid, clubId: cid });
    if (r.ok) { toast.success('Öneri yapıldı', { icon: 'phone' }); close(); }
  };
  const pl = pid ? S.players[pid] : null;
  return html`<${Sheet} title="Kulübe öner" tall onClose=${close} footer=${html`<${Button} block variant="primary" disabled=${!pv || !!pv.error} onClick=${go}>Öneriyi yap · bu saatin hakkı</${Button}>`}>
    ${!clients.length ? html`<${EmptyState} icon="users" title="Müşterin yok" body="Önerilecek oyuncun yok." />` : html`<div class="stack">
      <div class="eyebrow">Hangi müşteri?</div>
      <div class="dlchips">${clients.map((c) => html`<${Chip} active=${c.id === pid} onClick=${() => { setPid(c.id); setLg(leagueOfClient(c.id)); setCid(null); }}>${c.name}</${Chip}>`)}</div>
      <div class="eyebrow">Hangi lig?</div>
      <div class="dlchips">${LEAGUE_DEFS.map((l) => html`<${Chip} active=${l.id === lg} onClick=${() => { setLg(l.id); setCid(null); }}>${l.name}</${Chip}>`)}</div>
      <div class="eyebrow">Hangi kulüp?</div>
      <div class="dlclubs">${rows.map((c) => {
        const cv = c.lunchKnown ? sel.clubView(S, c.id) : null;
        const need = cv && cv.needs && pl ? cv.needs.find((n) => n.pos === pl.pos) : null;
        return html`<button type="button" key=${c.id} class=${cx('dlclub', cid === c.id && 'is-on')} onClick=${() => setCid(c.id)}>
          <${Crest} colors=${c.colors} pattern=${c.crest} size=${32} /><span class="dlclub__n"><b>${c.name}</b><small>${c.position}. sırada${need ? ` · ${pl.pos} ihtiyacı ${need.level}/3` : ''}</small></span>${cid === c.id ? html`<${Icon} name="check" size=${18} />` : null}</button>`;
      })}</div>
      ${pv ? html`<div class=${cx('dlpv', pv.error && 'is-bad')}>${pv.error ? pv.error : html`İlgi <b class="num">${Math.round(pv.levelBefore)}</b> → <b class="num lime">${Math.round(pv.levelAfter)}</b> <span class="muted">(+${Math.round(pv.delta)})</span>`}</div>` : null}
    </div>`}
  </${Sheet}>`;
}

export default function Deadline({ close }) {
  const st = useStore();
  const S = st.S;
  const dl = S ? sel.deadlineView(S) : null;
  const [pitch, setPitch] = useState(false);
  const [busy, setBusy] = useState(false);
  const hour = dl ? dl.hour : 24;
  const prevHour = useRef(hour);
  useEffect(() => { if (hour !== prevHour.current) { haptics.warn(); prevHour.current = hour; } }, [hour]);

  if (!S) return html`<${Overlay} label="Son Gün" onClose=${close}><div class="screen-pad"><${EmptyState} icon="clock" title="Son Gün" body="Oyun başlamadı." action=${html`<${Button} variant="ghost" onClick=${close}>Kapat</${Button}>`} /></div></${Overlay}>`;

  const month = MONTHS[S.time.month].name;
  const playMonth = () => { const r = store.advance(); if (r && r.ok === false) setBusy(false); };
  if (!dl) {
    return html`<${Overlay} label="Son Gün" onClose=${close}><div class="dl"><${EmptyState} icon="clock" title="Son Gün bitti" body=${`${month} ayının transfer son günü tamamlandı.`}
      action=${html`<${Button} variant="gold" size="lg" onClick=${playMonth}>Ayı oynat</${Button}>`} /></div></${Overlay}>`;
  }
  const ended = dl.ended;
  const canAct = !ended && dl.actionsLeft > 0 && !dl.hasTable;
  const take = (c) => { const r = store.act('deadlineTakeCall', { callId: c.id }); if (r.ok) openOverlay('Negotiation', {}); };
  const openI = (i) => { const r = store.act('openNegotiation', { interestId: i.id }); if (r.ok) openOverlay('Negotiation', {}); };
  const skip = () => { audio.play('whoosh'); store.act('deadlineSkipHour'); };
  const finish = () => { if (busy) return; setBusy(true); const r = store.act('deadlineFinish'); if (r.ok) playMonth(); else setBusy(false); };
  const visible = dl.calls.filter((c) => c.fromHour <= dl.hour || c.taken || ended);
  const order = (c) => (c.available ? 0 : c.taken ? 2 : 1);
  visible.sort((a, b) => order(a) - order(b) || a.expiresHour - b.expiresHour);
  const live = visible.filter((c) => c.available);
  const missed = dl.calls.filter((c) => !c.taken).length;
  const dealLog = dl.log.filter((l) => l.kind === 'deal');
  const ringing = live.length;
  const shut = sel.interestList(S).filter((i) => !i.negotiable && i.level >= 60);
  return html`<${Overlay} label="Son Gün" tone=${dl.hour >= 22 || ended ? 'danger' : undefined} onClose=${close}>
    <div class=${cx('dl', `is-h${ended ? 24 : dl.hour}`)}>
      <header class="dl__top">
        <div><div class="eyebrow">Transfer son günü · ${month}</div><h1 class="t-display dl__title">Son Gün</h1></div>
        <button type="button" class="dl__min" onClick=${close}>Gündem</button>
      </header>
      <${Clock} hour=${dl.hour} ended=${ended} actionsLeft=${dl.actionsLeft} actionsMax=${dl.actionsMax} />

      ${dl.hasTable ? html`<section class="dlbanner"><${Icon} name="handshake" size=${22} /><div><b>Açık bir masan var</b><span>${ended ? 'Gece yarısında kapanacak.' : 'Önce onu bitir ya da masadan kalk.'}</span></div><${Button} size="sm" variant="gold" onClick=${() => openOverlay('Negotiation', {})}>Masaya dön</${Button}></section>` : null}

      ${ended ? html`<section class="dlend">
        <h2 class="t-display">Günün özeti</h2>
        <div class="dlend__stats"><div><span class="eyebrow">Anlaşma</span><b class="num lime">${dl.deals}</b></div><div><span class="eyebrow">Kaçan arama</span><b class=${cx('num', missed ? 'danger' : 'muted')}>${missed}</b></div></div>
        ${dealLog.length ? html`<ul class="dlend__deals">${dealLog.map((l) => html`<li><${Icon} name="check" size=${16} /> ${l.text}</li>`)}</ul>` : html`<p class="muted">Bu Son Gün’de imza atılmadı. Kaçan aramalar kulüplerin ilgisini düşürdü.</p>`}
      </section>` : html`<${SectionTitle} right=${ringing ? html`<span class="danger">${ringing} çalıyor</span>` : ''}>Gelen aramalar</${SectionTitle}>
        ${visible.length ? html`<div class="dlcalls">${visible.map((c) => html`<${CallCard} key=${c.id} c=${c} S=${S} hour=${dl.hour} ended=${ended} canAct=${canAct} onTake=${take} />`)}</div>`
          : html`<div class="dlquiet"><${Icon} name="phone" size=${22} /> Telefon sessiz. Yeni aramalar sonraki saatlerde gelebilir.</div>`}

        ${dl.interests.length || shut.length ? html`<${SectionTitle}>Açık ilgiler</${SectionTitle}>
          <div class="dlints">${dl.interests.map((i) => {
            const club = S.clubs[i.clubId];
            return html`<div class="dlint" key=${i.id}><${Crest} colors=${club.colors} pattern=${club.crest} size=${34} />
              <div class="dlint__t"><b>${i.playerName}</b><span>${club.name} · ${KIND_LABEL[i.kind]} · ${i.fitWord} · orada %${Math.round(i.expectedMinutes * 100)}</span><div class="dlint__lvl"><i style=${{ width: i.level + '%' }}></i><u style=${{ left: '60%' }}></u></div></div>
              <${Button} size="sm" variant="ghost" disabled=${!canAct} onClick=${() => openI(i)}>Masaya otur</${Button}></div>`;
          })}
            ${shut.map((i) => { const club = S.clubs[i.clubId];
              return html`<div class="dlint is-shut" key=${i.id}><${Crest} colors=${club.colors} pattern=${club.crest} size=${34} />
                <div class="dlint__t"><b>${i.playerName}</b><span>${club.name} · ${KIND_LABEL[i.kind]}</span><span class="dlint__why"><${Icon} name="lock" size=${13} /> ${i.reason}</span></div></div>`; })}</div>` : null}`}

      <${SectionTitle}>Telefon kaydı</${SectionTitle}>
      <ol class="dllog">${[...dl.log].reverse().map((l, i) => html`<li key=${i} class=${`is-${l.kind}`}><b class="num">${pad(Math.min(l.hour, 24) % 24)}:00</b><span>${l.text}</span></li>`)}</ol>

      <footer class="dl__bar">
        ${ended ? html`<${Button} variant="gold" size="lg" block loading=${busy} onClick=${finish}>Ayı Oynat</${Button}>`
          : html`<${Button} variant="ghost" disabled=${!canAct} onClick=${skip}>Bu saati boş geç</${Button}><${Button} variant="ghost" icon="target" disabled=${!canAct} onClick=${() => setPitch(true)}>Kulübe öner</${Button}>`}
      </footer>
    </div>
    ${pitch ? html`<${PitchSheet} close=${() => setPitch(false)} />` : null}
  </${Overlay}>`;
}
