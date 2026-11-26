import { html, useState, useStore, store, navigate, openSheet, cx, Avatar, Crest, PosChip, Badge, Chip, Meter, PotentialBand, Segmented, SectionTitle, EmptyState, Button, Icon, Money, MONTH_NAMES } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import { TRAITS, pct, moodTone, moodWord, minutesWord, minutesTone, monthsLeft, clubInfo, attentionScore } from './players/common.js';

const SORTS = [{ id: 'durum', label: 'Durum' }, { id: 'deger', label: 'Değer' }, { id: 'yas', label: 'Yaş' }];

function ClientCard({ S, c }) {
  const cv = sel.clientView(S, c.id);
  const club = clubInfo(S, c.clubId);
  const league = cv && cv.league;
  const open = (S.promises || []).filter((p) => p.playerId === c.id && p.status === 'open');
  const nearest = open.length ? open.reduce((a, b) => (monthsLeft(S, a) <= monthsLeft(S, b) ? a : b)) : null;
  const ml = nearest ? monthsLeft(S, nearest) : null;
  const danger = c.loyalty < 35 || c.morale < 30;
  const band = cv && cv.band;
  const flags = cv ? cv.flags : {};
  return html`<button type="button" class=${cx('players-card', danger && 'is-warn', c.injured > 0 && 'is-hurt')} onClick=${() => { openSheet('PlayerSheet', { playerId: c.id }); }}>
    <div class="players-card__top">
      <${Avatar} id=${c.id} size=${60} colors=${club && club.colors} ring />
      <div class="players-card__id">
        <div class="players-card__name">${c.name}</div>
        <div class="players-card__meta"><${PosChip} pos=${c.pos} /><span>${c.age} yaş</span>${c.trait && TRAITS[c.trait] ? html`<span class="players-card__trait">${TRAITS[c.trait][0]}</span>` : null}</div>
        <div class="players-card__club">${club ? html`<${Crest} colors=${club.colors} pattern=${club.crest} size=${14} /><span>${club.name}</span><em>${club.league}</em>` : html`<span class="gold">Kulüpsüz — serbest</span>`}</div>
      </div>
      <div class="players-card__ca"><b class="num">${c.ca}</b><small>GÜÇ</small></div>
    </div>
    ${band ? html`<div class="players-card__band"><${PotentialBand} ca=${c.ca} lo=${band.lo} hi=${band.hi} compact /><span class="players-card__bandtxt num">Tavan ${band.lo}–${band.hi}</span></div>` : null}
    <div class="players-card__minutes">
      <div class="players-card__minhead"><span>Süre</span><b class=${minutesTone(c.minutesShare)}>${minutesWord(c.minutesShare)}</b><em class="num">${pct(c.minutesShare)}</em></div>
      <${Meter} value=${c.minutesShare * 100} tone=${minutesTone(c.minutesShare)} size="sm" />
    </div>
    <div class="players-card__moods">
      <${Meter} label="Moral" valueText=${moodWord(c.morale)} value=${c.morale} tone=${moodTone(c.morale)} size="sm" />
      <${Meter} label="Bağlılık" valueText=${moodWord(c.loyalty)} value=${c.loyalty} tone=${moodTone(c.loyalty)} size="sm" />
    </div>
    <div class="players-card__badges">
      ${c.injured > 0 ? html`<${Badge} tone="danger" icon="alert">Sakat · ${c.injured} ay</${Badge}>` : null}
      ${flags.freeAgent ? html`<${Badge} tone="gold" icon="swap">Serbest oyuncu</${Badge}>` : null}
      ${flags.expiring && !flags.freeAgent ? html`<${Badge} tone="gold" icon="clock">Sözleşme bitiyor</${Badge}>` : null}
      ${c.hasPreContract ? html`<${Badge} tone="info" icon="pen">Ön sözleşme</${Badge}>` : null}
      ${c.loyalty < 35 ? html`<${Badge} tone="danger" icon="flame">Ayrılma riski</${Badge}>` : null}
      ${open.length ? html`<${Badge} tone=${ml <= 1 ? 'danger' : ml <= 3 ? 'gold' : 'muted'} icon="handshake">${open.length} söz · ${MONTH_NAMES[nearest.dueMonth]}${nearest.dueSeason !== S.time.season ? ` S${nearest.dueSeason}` : ''}</${Badge}>` : null}
      ${c.interestCount ? html`<${Badge} tone="lime" icon="eye">${c.interestCount} talip</${Badge}>` : null}
    </div>
  </button>`;
}

export default function Players() {
  const S = useStore((s) => s.S);
  const [sort, setSort] = useState('durum');
  const [onlyAttn, setOnlyAttn] = useState(false);
  if (!S) return html`<${EmptyState} icon="users" title="Oyun yok" body="Önce bir kariyer başlat." />`;
  const clients = sel.clientList(S);
  const hub = sel.hubSummary(S);
  const total = clients.reduce((a, c) => a + c.value, 0);
  const attn = (c) => attentionScore(S, c);
  let list = clients.slice();
  if (onlyAttn) list = list.filter((c) => attn(c) >= 4);
  if (sort === 'durum') list.sort((a, b) => attn(b) - attn(a) || b.value - a.value);
  else if (sort === 'deger') list.sort((a, b) => b.value - a.value);
  else list.sort((a, b) => a.age - b.age || b.ca - a.ca);
  const attnCount = clients.filter((c) => attn(c) >= 4).length;

  return html`<div class="players">
    <header class="players-head">
      <div class="eyebrow">Portföy</div>
      <h1 class="players-head__title t-display">Oyuncular</h1>
      <div class="players-sum">
        <div><span>Toplam değer</span><b class="num gold"><${Money} value=${total} count /></b></div>
        <div><span>Aylık komisyon</span><b class="num lime"><${Money} value=${hub.monthlyCommission} count /></b></div>
        <div><span>Müvekkil</span><b class="num">${clients.length}</b></div>
      </div>
    </header>
    ${clients.length === 0 ? html`<${EmptyState} icon="eye" title="Henüz müvekkilin yok"
      body="Bir ajanı ajan yapan müvekkilleridir. Keşif'e çık, genç yetenekleri izle, itibarın yettiğinde imzalat."
      action=${html`<${Button} icon="eye" size="lg" onClick=${() => navigate('scout')}>Keşfe git</${Button}>`} />` : html`
    <div class="players-tools">
      <${Segmented} items=${SORTS} value=${sort} onChange=${setSort} label="Sırala" />
      <${Chip} active=${onlyAttn} icon="alert" onClick=${() => setOnlyAttn(!onlyAttn)}>İlgi bekleyen${attnCount ? ` (${attnCount})` : ''}</${Chip}>
    </div>
    ${list.length ? html`<div class="players-list cols-2">${list.map((c) => html`<${ClientCard} key=${c.id} S=${S} c=${c} />`)}</div>`
      : html`<${EmptyState} icon="check" title="Her şey yolunda" body="Şu an acil ilgi bekleyen müvekkil yok." />`}
    <div class="players-foot"><${Button} variant="ghost" icon="eye" onClick=${() => navigate('scout')}>Yeni yetenek ara</${Button}></div>`}
  </div>`;
}
