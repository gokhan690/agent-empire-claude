// Component gallery (#/gallery). Works without the engine — all data below is mock.
import { html, useState, ICON_NAMES, Icon, Button, IconButton, Card, SectionTitle, EmptyState, Badge, Chip, PosChip, Tabs, Stat, Money, NumberTicker,
  Meter, PipMeter, PotentialBand, Avatar, Crest, PlayerRow, PlayerCard, Sheet, toast, audio, confetti, haptics, fmtMoney } from '../ui-kit.js';

const CLUBS = [
  { name: 'Boğaz Spor', colors: ['#F5C451', '#14213D'], crest: 0 }, { name: 'Anadolu Yıldız', colors: ['#E5423B', '#EEF4EF'], crest: 1 },
  { name: 'Liman FK', colors: ['#2F7DE1', '#EEF4EF'], crest: 2 }, { name: 'Kızıltepe', colors: ['#C9183C', '#0A0F0C'], crest: 3 },
  { name: 'Yeşil Vadi', colors: ['#1FA463', '#F5C451'], crest: 4 }, { name: 'Demir Şehir', colors: ['#7A3FD1', '#EEF4EF'], crest: 5 },
];
const PLAYERS = [
  { id: 'p-emre', name: 'Emre Yıldırım', age: 17, pos: 'FV', ca: 58, band: { lo: 66, hi: 88, know: 22 }, club: 0, badges: [{ tone: 'gold', icon: 'star', text: 'Cevher' }, { tone: 'danger', icon: 'flame', text: 'Isı 64' }] },
  { id: 'p-kaan', name: 'Kaan Demirtaş', age: 27, pos: 'OS', ca: 61, band: { lo: 61, hi: 63, know: 90 }, club: 1, badges: [{ tone: 'info', icon: 'heart', text: 'Sadık' }] },
  { id: 'p-mert', name: 'Mert Aksoy', age: 24, pos: 'DF', ca: 56, band: { lo: 58, hi: 70, know: 55 }, club: 2, badges: [] },
  { id: 'p-selim', name: 'Selim Çakır', age: 31, pos: 'KL', ca: 66, band: { lo: 66, hi: 67, know: 100 }, club: 3, badges: [{ tone: 'lime', text: 'Sözleşme biter' }] },
];
const MUST = { title: 'Rakip ajans kapıda', body: 'Kaan’ın menajerlik sözleşmesi bitmek üzere. Kızıltepe’nin direktörü seninle yemek yemek istiyor, ama başka bir ajans da Kaan’a ulaşmış.' };

const Block = ({ title, children }) => html`<section class="gal-block"><${SectionTitle}>${title}</${SectionTitle}>${children}</section>`;
const Swatch = ({ n, v }) => html`<div class="gal-sw"><i style=${{ background: `var(${v})` }}></i><span>${n}</span></div>`;

export default function Gallery() {
  const [tab, setTab] = useState('a');
  const [seg, setSeg] = useState('x');
  const [chip, setChip] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [cash, setCash] = useState(184000);
  const [en, setEn] = useState(3);
  const [muted, setMuted] = useState(audio.muted);
  const [loading, setLoading] = useState(false);
  const sfx = (n) => html`<${Button} size="sm" variant="ghost" sfx=${n} onClick=${() => { if (n === 'goal') confetti(); }}>${n}</${Button}>`;

  return html`<div class="gal">
    <div class="gal-hero">
      <div class="eyebrow">Tasarım sistemi</div>
      <h1 class="t-display gal-hero__t">Gece <span class="lime">Maçı</span></h1>
      <p class="muted">Floodlight, tebeşir çizgisi, iri yoğun rakamlar. KULİS bileşen galerisi — motor gerekmez.</p>
    </div>

    <${Block} title="Renkler">
      <div class="gal-swatches"><${Swatch} n="bg" v="--bg" /><${Swatch} n="surface" v="--surface" /><${Swatch} n="raised" v="--raised" /><${Swatch} n="line" v="--line" />
        <${Swatch} n="text" v="--text" /><${Swatch} n="muted" v="--muted" /><${Swatch} n="lime" v="--lime" /><${Swatch} n="gold" v="--gold" /><${Swatch} n="danger" v="--danger" /><${Swatch} n="info" v="--info" /><${Swatch} n="rival" v="--rival" /></div>
      <div class="gal-type">
        <div class="t-display" style="font-size:var(--fs-4xl)">€1,25M</div>
        <div class="t-display" style="font-size:var(--fs-2xl)">Başlık 32 / Condensed</div>
        <div style="font-size:var(--fs-lg);font-weight:700">Metin 18 — Figtree kalın</div>
        <div>Metin 15.5 — Gövde yazısı, rahat okunur, üç satıra kadar rahatça sığar.</div>
        <div class="muted small">Soluk 13.5 — ikincil bilgi</div>
      </div>
    </${Block}>

    <${Block} title="Düğmeler">
      <div class="row row--wrap">
        <${Button}>Birincil</${Button}><${Button} variant="ghost">Hayalet</${Button}><${Button} variant="danger">Tehlike</${Button}><${Button} variant="gold">Altın</${Button}>
      </div>
      <div class="row row--wrap">
        <${Button} size="sm">Küçük</${Button}><${Button} size="lg" icon="handshake">Masaya Otur</${Button}><${Button} disabled>Pasif</${Button}>
        <${Button} loading=${loading} onClick=${() => { setLoading(true); setTimeout(() => setLoading(false), 1500); }}>Yükle</${Button}>
      </div>
      <div class="row row--wrap">
        <${Button} icon="eye" energy=${1} cash=${2500}>Gözlem Gezisi</${Button}>
        <${Button} variant="ghost" icon="phone" energy=${1}>Ara</${Button}>
        <${Button} variant="gold" icon="news" cash=${15000}>Medya</${Button}>
      </div>
      <${Button} block size="lg" energy=${0}>Ayı Oynat</${Button}>
    </${Block}>

    <${Block} title="Gündem kartı (sahte)">
      <${Card} tone="must" chalk class="inbox">
        <div class="inbox__from"><${Avatar} id="dir-kizil" size=${44} colors=${CLUBS[3].colors} /><div class="grow"><div class="eyebrow">Kızıltepe · Direktör</div><div class="small muted">Yanıt şart</div></div><${Badge} tone="danger" icon="clock">2 ay</${Badge}></div>
        <h3 class="inbox__title">${MUST.title}</h3>
        <p class="inbox__body">${MUST.body}</p>
        <div class="inbox__opts">
          <button class="opt"><span><span class="opt__label">Yemeğe git</span><span class="opt__hint">Güven +10, kulübün ihtiyacını öğren</span></span><span class="opt__cost"><${Badge} tone="lime" icon="bolt">1</${Badge}><${Badge} tone="gold">€1,5K</${Badge}></span></button>
          <button class="opt"><span><span class="opt__label">Kaan’ı ara</span><span class="opt__hint">Bağlılık +8</span></span><span class="opt__cost"><${Badge} tone="lime" icon="bolt">1</${Badge}></span></button>
          <button class="opt"><span><span class="opt__label">Görmezden gel</span><span class="opt__hint">Rakip ajans avantaj kazanır</span></span><${Badge} tone="danger" icon="alert">Risk %30</${Badge}></button>
        </div>
      </${Card}>
      <div class="grid-2">
        <${Card} tone="gold"><${Stat} label="Komisyon" icon="cash" value=${html`<${Money} value=${420000} />`} delta=${12} hint="Bu sezon" /></${Card}>
        <${Card} tone="lime"><${Stat} label="Bağlılık" icon="heart" value="72" unit="/100" delta=${-4} hint="Son 3 ay" /></${Card}>
      </div>
    </${Block}>

    <${Block} title="Metreler">
      <${Card}><div class="stack">
        <${Meter} label="İkna skoru" value=${64} threshold=${70} valueText="64 / 70" hint="Eşiğe 6 puan kaldı — bir söz daha ekle." />
        <${Meter} label="Memnuniyet" value=${82} threshold=${50} thresholdLabel="İmza" />
        <${Meter} label="Rakip ısısı" value=${88} tone="danger" size="lg" hint="100’de rakip ajans imzalar." />
        <${Meter} label="Bilgi" value=${40} tone="info" size="sm" />
        <div class="row row--between"><span class="eyebrow">Enerji</span><${PipMeter} value=${en} max=${4} /></div>
        <div class="row row--between"><span class="eyebrow">Sabır</span><${PipMeter} value=${3} max=${5} variant="patience" /></div>
        <div class="row row--between"><span class="eyebrow">Sadakat</span><${PipMeter} value=${4} max=${6} variant="loyalty" /></div>
        <div class="row"><${Button} size="sm" variant="ghost" onClick=${() => setEn((en + 1) % 5)}>Enerji döngüsü</${Button}></div>
      </div></${Card}>
    </${Block}>

    <${Block} title="Sayılar & para">
      <${Card}><div class="grid-3">
        <${Stat} label="Kasa" value=${html`<${Money} value=${cash} count />`} />
        <${Stat} label="Kâr" value=${html`<${Money} value=${-32500} colored sign />`} />
        <${Stat} label="Gelir" value=${html`<${Money} value=${1250000} colored sign />`} />
      </div>
      <div class="row row--wrap" style="margin-top:12px"><${Button} size="sm" variant="gold" onClick=${() => setCash(cash + 250000)}>+250K</${Button}><${Button} size="sm" variant="ghost" onClick=${() => setCash(cash - 90000)}>−90K</${Button}>
        <span class="muted small">${[850, 4000, 12500, 450000, 1250000, 18000000].map((n) => fmtMoney(n)).join(' · ')}</span></div></${Card}>
      <${Card}><div class="row row--between"><span class="eyebrow">NumberTicker</span><b style="font-size:40px"><${NumberTicker} value=${cash / 1000} format=${(n) => Math.round(n) + ' bin'} /></b></div></${Card}>
    </${Block}>

    <${Block} title="Rozet · Chip · Pozisyon · Sekmeler">
      <div class="row row--wrap"><${Badge} tone="lime" icon="check">İmzalandı</${Badge}><${Badge} tone="gold" icon="star">Cevher</${Badge}><${Badge} tone="danger" icon="flame">Isı 82</${Badge}><${Badge} tone="info" icon="eye">İzlendi</${Badge}><${Badge} tone="rival" icon="users">Rakip</${Badge}><${Badge}>Nötr</${Badge}></div>
      <div class="row row--wrap"><${PosChip} pos="KL" /><${PosChip} pos="DF" /><${PosChip} pos="OS" /><${PosChip} pos="FV" />
        <${Chip} active=${chip} onClick=${() => setChip(!chip)}>U21</${Chip}><${Chip} active=${!chip} onClick=${() => setChip(!chip)} icon="clock">Sözleşmesi biten</${Chip}></div>
      <${Tabs} value=${tab} onChange=${setTab} items=${[{ id: 'a', label: 'Gelen' }, { id: 'b', label: 'Teklifler', badge: 2 }, { id: 'c', label: 'Geçmiş' }]} />
      <${Tabs} variant="segmented" value=${seg} onChange=${setSeg} items=${[{ id: 'x', label: 'Tümü' }, { id: 'y', label: 'Genç' }, { id: 'z', label: 'Serbest' }]} />
    </${Block}>

    <${Block} title="Avatar (id’den üretilir)">
      <div class="gal-grid">${Array.from({ length: 24 }, (_, i) => html`<${Avatar} id=${'demo-' + i} size=${56} />`)}</div>
      <div class="row"><${Avatar} id="p-emre" size=${96} ring /><${Avatar} id="p-emre" size=${48} colors=${CLUBS[1].colors} /><${Avatar} id="p-emre" size=${32} /><span class="muted small">Aynı id, aynı yüz — forma kulüp renginden</span></div>
    </${Block}>

    <${Block} title="Armalar (6 desen)">
      <div class="gal-grid gal-grid--crest">${CLUBS.map((c) => html`<div class="gal-cell"><${Crest} colors=${c.colors} pattern=${c.crest} size=${56} /><span>${c.name}</span></div>`)}</div>
      <div class="row">${[0, 1, 2, 3, 4, 5].map((p) => html`<${Crest} colors=${['#1FA463', '#F5C451']} pattern=${p} size=${28} />`)}</div>
    </${Block}>

    <${Block} title="Potansiyel bandı">
      <${Card}><div class="stack">
        ${PLAYERS.map((p) => html`<div><div class="row row--between small"><b>${p.name}</b><span class="muted">Bilgi %${p.band.know}</span></div><${PotentialBand} ca=${p.ca} lo=${p.band.lo} hi=${p.band.hi} know=${p.band.know} /></div>`)}
      </div></${Card}>
    </${Block}>

    <${Block} title="Oyuncu satırı & kartı">
      ${PLAYERS.map((p) => html`<${PlayerRow} p=${p} club=${CLUBS[p.club]} band=${p.band} badges=${p.badges} onClick=${() => toast.info(p.name + ' seçildi')} />`)}
      <${PlayerCard} p=${PLAYERS[0]} club=${CLUBS[PLAYERS[0].club]} band=${PLAYERS[0].band} stats=${[{ label: 'Maç', value: 14 }, { label: 'Gol', value: 6 }, { label: 'Puan', value: '7,2' }, { label: 'Değer', value: '€1,4M' }]}
        footer=${html`<div class="row" style="margin-top:14px"><${Button} block icon="handshake" energy=${1}>İmza Teklifi</${Button}></div>`} />
    </${Block}>

    <${Block} title="Toast · Sheet · Boş durum">
      <div class="row row--wrap"><${Button} size="sm" variant="ghost" onClick=${() => toast.success('Teklif kabul edildi')}>Başarı</${Button}><${Button} size="sm" variant="ghost" onClick=${() => toast.error('Yeterli enerjin yok')}>Hata</${Button}>
        <${Button} size="sm" variant="ghost" onClick=${() => toast.money('+€45K komisyon')}>Para</${Button}><${Button} size="sm" variant="ghost" onClick=${() => toast.info('Yeni haber geldi')}>Bilgi</${Button}>
        <${Button} size="sm" onClick=${() => setSheet(true)}>Sheet aç</${Button}></div>
      <${Card}><${EmptyState} icon="inbox" title="Gündem boş" body="Bu ay yanıt bekleyen bir şey yok. Enerjini keşfe harca." action=${html`<${Button} size="sm" variant="ghost" icon="eye">Keşfe git</${Button}>`} /></${Card}>
    </${Block}>

    <${Block} title="Ses · konfeti · titreşim">
      <div class="row row--wrap">${audio.names.map(sfx)}</div>
      <div class="row row--wrap"><${Button} size="sm" variant="gold" onClick=${() => { confetti({ count: 160 }); audio.play('levelup'); }}>Konfeti</${Button}>
        <${Button} size="sm" variant="ghost" onClick=${() => haptics.success()}>Titreşim</${Button}>
        <${Button} size="sm" variant="ghost" icon=${muted ? 'soundOff' : 'soundOn'} onClick=${() => { audio.toggle(); setMuted(audio.muted); }}>${muted ? 'Sessiz' : 'Ses açık'}</${Button}></div>
    </${Block}>

    <${Block} title="İkonlar">
      <div class="gal-icons">${ICON_NAMES.map((n) => html`<div class="gal-cell"><${Icon} name=${n} size=${24} /><span>${n}</span></div>`)}</div>
      <div class="row"><${IconButton} icon="settings" label="Ayarlar" /><${IconButton} icon="close" label="Kapat" /></div>
    </${Block}>

    ${sheet ? html`<${Sheet} title="Örnek sayfa" onClose=${() => setSheet(false)} footer=${html`<${Button} block onClick=${() => setSheet(false)}>Tamam</${Button}>`}>
      <div class="stack"><${PlayerRow} p=${PLAYERS[1]} club=${CLUBS[1]} band=${PLAYERS[1].band} />
        <p class="muted">Aşağı sürükle, arka plana dokun veya Esc ile kapat. Odak sayfanın içinde kalır.</p>
        <${Meter} label="Memnuniyet" value=${58} threshold=${50} /></div></${Sheet}>` : null}
  </div>`;
}
