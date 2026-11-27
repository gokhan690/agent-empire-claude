// Monthly event cards (Gündem): at most one per month, two choices, ≤ 2 short sentences. All Turkish text lives here.
// Template: { key, weight, when(S, X) → falsy | candidate{playerId?,clubId?,amount?}, title, body, options:[{ id, label, cost?:{energy,cash}, fx:[effects], result }] }
// Text placeholders: {player} {club} {amount} with Turkish suffixes ({player:gen}). Every card has a free option.
// Effects: {cash} {rep} {mood} {hype} {heal} {trust} {found} {loan} (mood/hype/heal on the card's player, trust on its club).
import { tidy } from '../util.js';

/** Price scale: grows with the cash you hold so late-game cards stay meaningful. */
const scale = S => Math.max(1, Math.min(8, 1 + (S.agency.cash - 300000) / 500000));
const money = (S, base) => tidy(base * scale(S));

export const EVENTS = [
  {
    key: 'sponsor', weight: 3,
    when: (S, X) => { const c = X.clients.filter(p => p.hype >= 25); return c.length ? { playerId: X.pick(c).id } : false; },
    title: 'Sponsor teklifi', body: '{player} için bir kramponcu sponsorluk önerdi. Ajansına komisyon bırakır.',
    amount: (S) => money(S, 10000),
    options: [
      { id: 'kabul', label: 'Kabul et', fx: [{ cash: 1 }], result: 'Sponsor anlaşması imzalandı: +{amount}.' },
      { id: 'red', label: 'Reddet', fx: [{ mood: 4 }], result: '{player} imajını korumana sevindi.' },
    ],
  },
  {
    key: 'doctor', weight: 3,
    when: (S, X) => { const c = X.clients.filter(p => p.injured >= 2); return c.length ? { playerId: X.pick(c).id } : false; },
    title: 'Sakatlık', body: '{player} uzun süre yok. Özel doktor sürecini kısaltabilir.',
    amount: (S) => money(S, 8000),
    options: [
      { id: 'doktor', label: 'Özel doktor', cost: { cash: 1 }, fx: [{ heal: 1 }, { mood: 3 }], result: 'Tedavi hızlandı.' },
      { id: 'bekle', label: 'Beklesin', fx: [], result: 'Normal sürece devam.' },
    ],
  },
  {
    key: 'homesick', weight: 3,
    when: (S, X) => { const c = X.clients.filter(p => p.mood < 45 && p.clubId); return c.length ? { playerId: X.pick(c).id } : false; },
    title: 'Moral bozuk', body: '{player} mutsuz görünüyor. Bir yemek ona iyi gelebilir.',
    options: [
      { id: 'yemek', label: 'Yemeğe çıkar', cost: { energy: 1 }, fx: [{ mood: 14 }], result: '{player} rahatladı.' },
      { id: 'gec', label: 'Geç', fx: [], result: 'Zamanla düzelir belki.' },
    ],
  },
  {
    key: 'press', weight: 3,
    when: (S, X) => { const c = X.clients.filter(p => p.form >= 3); return c.length ? { playerId: X.pick(c).id } : false; },
    title: 'Formda', body: '{player} gol yağdırıyor. Basın peşinde.',
    amount: (S) => money(S, 5000),
    options: [
      { id: 'basin', label: 'Röportaj ayarla', cost: { cash: 1 }, fx: [{ hype: 14 }, { rep: 0.5 }], result: '{player} manşetlerde.' },
      { id: 'gec', label: 'Geç', fx: [], result: 'Sessiz kaldın.' },
    ],
  },
  {
    key: 'president', weight: 3,
    when: (S, X) => { const c = X.clubs; return c.length ? { clubId: X.pick(c).id } : false; },
    title: 'Başkan yemeği', body: '{club} başkanı seni yemeğe çağırıyor.',
    amount: (S) => money(S, 3000),
    options: [
      { id: 'git', label: 'Git', cost: { cash: 1 }, fx: [{ trust: 15 }], result: '{club} ile aran düzeldi.' },
      { id: 'gec', label: 'Geç', fx: [], result: 'Davet cevapsız kaldı.' },
    ],
  },
  {
    key: 'tip', weight: 3,
    when: () => ({}),
    title: 'Gözlemci ihbarı', body: 'Eski bir gözlemci genç bir yetenek öneriyor. Bakmak ister misin?',
    options: [
      { id: 'bak', label: 'Bak', cost: { energy: 1 }, fx: [{ found: 1 }], result: 'Listene yeni bir aday eklendi.' },
      { id: 'gec', label: 'Geç', fx: [], result: 'İhbarı unuttun.' },
    ],
  },
  {
    key: 'bonus', weight: 2,
    when: () => ({}),
    title: 'Beklenmedik prim', body: 'Eski bir anlaşmadan ek bir ödeme geldi.',
    amount: (S) => money(S, 12000),
    options: [{ id: 'tamam', label: 'Harika', fx: [{ cash: 1 }], result: '+{amount} kasaya girdi.' }],
  },
  {
    key: 'insurance', weight: 2,
    when: (S) => S.agency.cash > 80000 ? {} : false,
    title: 'Sigorta paketi', body: 'Bir sigortacı, müşterilerin için paket öneriyor. Kabul edersen itibarın artar.',
    amount: (S) => money(S, 9000),
    options: [
      { id: 'al', label: 'Paketi al', cost: { cash: 1 }, fx: [{ rep: 1.5 }], result: 'Müşterilerin güvende, itibarın arttı.' },
      { id: 'gec', label: 'Geç', fx: [], result: 'Teklifi geri çevirdin.' },
    ],
  },
  {
    key: 'hype', weight: 2,
    when: (S, X) => { const c = X.clients.filter(p => p.age <= 22); return c.length ? { playerId: X.pick(c).id } : false; },
    title: 'Sosyal medya', body: '{player} sosyal medyada konuşuluyor. Fırsatı değerlendirebilirsin.',
    options: [
      { id: 'degerlendir', label: 'Değerlendir', cost: { energy: 1 }, fx: [{ hype: 12 }], result: '{player} daha çok tanındı.' },
      { id: 'gec', label: 'Geç', fx: [], result: 'Dalga geçti.' },
    ],
  },
  {
    key: 'rep', weight: 2,
    when: (S) => S.time.season >= 2 ? {} : false,
    title: 'Konferans daveti', body: 'Spor kulisleri zirvesi seni konuşmacı olarak istiyor.',
    amount: (S) => money(S, 6000),
    options: [
      { id: 'katil', label: 'Katıl', cost: { cash: 1 }, fx: [{ rep: 2 }], result: 'İtibarın biraz arttı.' },
      { id: 'gec', label: 'Katılma', fx: [], result: 'Boş ver.' },
    ],
  },
];

/** The bank's lifeline card (not part of the random deck). */
export const LOAN_CARD = {
  key: 'loan', title: 'Banka teklifi', body: 'Kasa eksiye düştü. Banka sana tek seferlik bir kredi veriyor.',
  options: [
    { id: 'al', label: 'Krediyi al', fx: [{ loan: 1 }], result: 'Kredi hesabına geçti.' },
    { id: 'red', label: 'Hayır', fx: [], result: 'Kendi başının çaresine bakacaksın.' },
  ],
};
