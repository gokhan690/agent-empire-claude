// Shared helpers for Players / PlayerSheet / ClubSheet / Scout (UI-only; reads the engine only through selectors).
import { html, cx, MONTH_NAMES, fmtMoney, Crest, Icon } from '../../ui-kit.js';
import * as sel from '../../../engine/selectors.js';

export const TRAITS = {
  hirsli: ['Hırslı', 'Büyük kulüp ister, yedek kalmaya dayanamaz.'],
  sadik: ['Sadık', 'Bağlılığı yavaş azalır, taşınmayı sevmez.'],
  paraci: ['Paracı', 'En çok maaşa bakar.'],
  ailebabasi: ['Aile Babası', 'İstikrar ve ülkesine yakınlık ister.'],
  yildiz: ['Yıldız Adayı', 'Şöhreti sever; morali kırılgandır.'],
  profesyonel: ['Profesyonel', 'Dengeli, hızlı gelişir.'],
};
export const PERSONAS = {
  durust: 'Açık sözlü; mimikleri gerçeği söyler.',
  kurnaz: 'Yüzünü yalan söyletir; güven ≥ 60 olunca gerçek yüzü görürsün.',
  cimri: 'Bütçeyi sıkı tutar ama sabırlıdır.',
  sabirsiz: 'Hızlı karar verir, sabrı az; ama ceplerine bol.',
  gosterisci: 'Şöhretli oyuncuya bol keseden verir.',
};
export const POS_NAMES = { KL: 'Kaleci', DF: 'Defans', OS: 'Orta saha', FV: 'Forvet' };
export const FOCUS = {
  u21: ['Genç', 'U21 yetenekler; bant geniş, tavan yüksek.'],
  form: ['Formda', 'Son maçlarda parlayanlar.'],
  expiring: ['Sözleşmesi biten', 'Sezon sonu serbest kalacaklar.'],
  any: ['Serbest seçim', 'Lig genelinden karışık.'],
};
export const KIND_LABEL = { transfer: 'Transfer', free: 'Serbest', renewal: 'Yenileme' };

export const pct = (x) => '%' + Math.round((x || 0) * 100);
export const moodTone = (v) => (v < 35 ? 'danger' : v < 55 ? 'gold' : 'lime');
export const moodWord = (v) => (v >= 80 ? 'Çok yüksek' : v >= 60 ? 'Yüksek' : v >= 45 ? 'Orta' : v >= 30 ? 'Düşük' : 'Kritik');
export const minutesWord = (x) => (x >= 0.6 ? 'Oynuyor' : x >= 0.3 ? 'Rotasyon' : 'Yedek');
export const minutesTone = (x) => (x >= 0.6 ? 'lime' : x >= 0.3 ? 'gold' : 'danger');
export const needWord = (l) => (l >= 3 ? 'Acil' : l === 2 ? 'Orta' : 'Hafif');
export const trustWord = (v) => (v >= 80 ? 'Yakın dost' : v >= 60 ? 'Dost' : v >= 40 ? 'Tanıdık' : v >= 20 ? 'Soğuk' : 'Yabancı');

export const dueText = (d) => (d ? `${MONTH_NAMES[d.dueMonth ?? d.month] || ''} ${(d.dueSeason ?? d.season)}. sezon` : '');
export function monthsLeft(S, due) {
  return (due.dueSeason - S.time.season) * 12 + (due.dueMonth - S.time.month);
}
export const monthsText = (n) => (n <= 0 ? 'bu ay' : n === 1 ? '1 ay kaldı' : `${n} ay kaldı`);
export const heatMonths = (heat, per) => (per > 0 ? Math.max(0, Math.ceil((100 - heat) / per)) : 99);

export function clubInfo(S, id) {
  const c = id && S.clubs[id];
  if (!c) return null;
  const lg = S.leagues[c.leagueId];
  return { id: c.id, name: c.name, short: c.short, colors: c.colors, crest: c.crest, league: lg ? lg.name : '', prestige: lg ? lg.prestige : 0, leagueId: c.leagueId };
}
export const bandFor = (S, p) => (p ? sel.potentialBand(S, p) : { lo: 40, hi: 99 });

export function Stars({ n, max = 5 }) {
  return html`<span class="scout-stars" aria-label=${`Prestij ${n}/${max}`}>${Array.from({ length: max }, (_, i) => html`<${Icon} name="star" size=${12} class=${cx(i < n ? 'is-on' : 'is-off')} />`)}</span>`;
}
export function ClubTag({ club, onClick, size = 15 }) {
  if (!club) return html`<span class="players-club players-club--free">Kulüpsüz</span>`;
  const inner = html`<${Crest} colors=${club.colors} pattern=${club.crest} size=${size} /><span>${club.name}</span>`;
  return onClick ? html`<button type="button" class="players-club players-club--btn" onClick=${onClick}>${inner}</button>` : html`<span class="players-club">${inner}</span>`;
}
export const money = fmtMoney;

/** Words + reasons shown under morale / loyalty (derived from public dossier fields only). */
export function moodReasons(S, cv) {
  const out = [];
  const ms = cv.minutesShare, ex = cv.expectedShare;
  if (cv.injured > 0) out.push({ tone: 'bad', text: `Sakat (${cv.injured} ay) — oynayamıyor` });
  else if (ms >= ex - 0.08) out.push({ tone: 'good', text: `İlk 11'de: dakikaların ${pct(ms)}'si` });
  else out.push({ tone: 'bad', text: `Beklediğinden az oynuyor (${pct(ms)}, beklenen ${pct(ex)})` });
  if (cv.wageRatio < 0.85) out.push({ tone: 'bad', text: `Maaşı adil düzeyin altında (${pct(cv.wageRatio)})` });
  else if (cv.wageRatio >= 1.05) out.push({ tone: 'good', text: 'Maaşından memnun' });
  if (cv.visitedThisMonth) out.push({ tone: 'good', text: 'Bu ay ziyaret ettin' });
  else if (!cv.lastVisit || (S.time.season - cv.lastVisit.season) * 12 + S.time.month - cv.lastVisit.month >= 4) out.push({ tone: 'bad', text: 'Uzun süredir ziyaret edilmedi' });
  const broken = (S.promises || []).filter((x) => x.playerId === cv.id && x.status === 'broken').length;
  const kept = (S.promises || []).filter((x) => x.playerId === cv.id && x.status === 'kept').length;
  if (broken) out.push({ tone: 'bad', text: `${broken} söz tutulmadı` });
  if (kept) out.push({ tone: 'good', text: `${kept} söz tutuldu` });
  if (cv.contractYearsLeft <= 0 && !cv.flags.freeAgent) out.push({ tone: 'bad', text: 'Sözleşmesi bu sezon bitiyor' });
  if (cv.loyalty < 35) out.push({ tone: 'bad', text: 'Rakip ajanslar yaklaşabilir — bağlılığı tehlikede' });
  return out;
}

/** Sortable "attention" score for the Players list (higher = needs you more). */
export function attentionScore(S, c) {
  let s = 0;
  if (c.injured > 0) s += 3;
  if (c.loyalty < 35) s += 8; else if (c.loyalty < 50) s += 3;
  if (c.morale < 35) s += 4;
  if (c.hasPreContract) s += 1;
  const open = (S.promises || []).filter((p) => p.playerId === c.id && p.status === 'open');
  if (open.length) { const m = Math.min(...open.map((p) => monthsLeft(S, p))); s += m <= 1 ? 7 : m <= 3 ? 4 : 1; }
  s += Math.min(3, c.interestCount);
  if (!c.clubId) s += 6;
  return s;
}
