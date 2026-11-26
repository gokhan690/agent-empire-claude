// Inbox event templates (Gündem). All player-facing Turkish text of the cards lives here.
//
// Template: {
//   key, kind, weight, cooldownMonths, once?, must?, heavy?, followUp?, clientOnly?, expiresIn, defaultOption,
//   when(S, X) → falsy | true | candidate | candidate[]      candidate = JSON-clean vars {playerId?, clubId?, rivalId?, amount?, …}
//       (X = events.whenCtx(S): clients, abs, month, season, window, str(clubId), interestsOf(playerId); never touches RNG)
//   from, title, body            text with {player} {club} {rival} {amount} {director} …  ({player:gen|dat|acc|loc|abl} = Turkish suffix)
//   options: [{ id, label, hint, cost:{energy,cash}|fn(S,c), risk:{pct,text}|fn(S,c)|null,
//               effects: [..] | fn(S,c,R), altEffects (when the risk fires), resultText, altResultText, show?(S,c), run?(S,c) }]
// }
// Effects use effects.js primitives plus the local ones handled in events.js: heal, scout, commission, sellTo, directorMove, queue.
// Every card has at least one option that costs nothing, and `defaultOption` is such an option (applied when the card expires).
import { BAL } from '../constants.js';
import { avgRecent, tableSorted } from '../selectors.js';
import { fairWage } from '../valuation.js';
import { tidy, clamp, hash01 } from '../util.js';
import { hpick } from './text.js';
import { takeLoan } from '../economy.js';

const JOURNALISTS = ['Tolga Berker', 'Melih Aksu', 'Ceren Aydoğan', 'Selim Tuncer', 'Pınar Doruk', 'Kaan Erdil'];
const BRANDS = ['Kortez Spor', 'Nova Boots', 'Atlas Wear', 'Pusula Athletic', 'Bora Sportswear'];
const SCOUTS = ['Cemal Usta', 'Nuri Başaran', 'Ferit Özkan', 'Mümtaz Kılınç'];

const P = (S, c) => S.players[c.playerId] || {};
const key = (S, extra) => S.seed + ':' + S.time.season + ':' + S.time.month + ':' + extra;
/** Due date `months` months from now. */
function due(S, months) { const t = S.time.month + months; return { dueSeason: S.time.season + Math.floor(t / 12), dueMonth: t % 12 }; }
/** Due date right after the next transfer window closes. */
function afterWindow(S) { return S.time.month < 6 ? { dueSeason: S.time.season, dueMonth: 6 } : { dueSeason: S.time.season + 1, dueMonth: 1 }; }
const league = (S, p) => { const c = S.clubs[p.clubId]; return c ? S.leagues[c.leagueId] : null; };
const sh = p => (p.st && typeof p.st.sh === 'number' ? p.st.sh : 0.5);

/** A club one step up (dir 'up') or down (dir 'down') from the player's, nearest to his level. */
function targetClub(S, X, p, dir) {
  const own = S.clubs[p.clubId];
  if (!own) return null;
  const cp = S.leagues[own.leagueId].prestige, ownStr = X.str(own.id);
  const goal = p.ca + (dir === 'up' ? 4 : -3);
  let best = null, bs = 1e9;
  for (const lid in S.leagues) {
    const L = S.leagues[lid];
    if (dir === 'up' ? !(L.prestige === cp || L.prestige === cp + 1) : !(L.prestige === cp || L.prestige === cp - 1)) continue;
    for (const cid of L.clubIds) {
      if (cid === own.id) continue;
      const s = X.str(cid);
      if (dir === 'up' ? s <= ownStr + 1 : s >= ownStr - 1) continue;
      const sc = Math.abs(s - goal) + hash01(cid + p.id);
      if (sc < bs) { bs = sc; best = cid; }
    }
  }
  return best;
}

const T = [];
const add = t => T.push({ cooldownMonths: 3, expiresIn: 2, ...t });

// ====================================================================== SAKATLIK / FORM / MUHTELİF OYUNCU KARTLARI
add({
  key: 'injury_visit', kind: 'sakatlik', weight: 12, cooldownMonths: 2, clientOnly: true, defaultOption: 'ignore',
  when: (S, X) => X.clients.filter(p => p.injured >= 1).map(p => ({ playerId: p.id, months: p.injured, amount: clamp(tidy(p.wage * 0.7), 1500, 12000) })),
  from: 'Kulüp doktoru',
  title: '{player} sakatlandı',
  body: `{player} antrenmanda ayağını burktu; doktor {months} ay süre veriyor. Sakat oyuncu en çok yalnız hisseder. Hastane odasında kimin yüzü görünecek?`,
  options: [
    { id: 'visit', label: 'Hastaneye git', hint: 'Yanında olduğunu hissettir.', cost: { energy: 1 }, effects: [{ morale: 8, loyalty: 6 }], resultText: `Odaya girince gözleri doldu. "Herkes kayboldu, bir sen geldin" dedi.` },
    { id: 'physio', label: 'Özel fizyoterapist tut', hint: 'Kulübün programından hızlı toparlar.', cost: (S, c) => ({ cash: c.amount }), effects: [{ heal: 1, morale: 4, loyalty: 4 }], resultText: `Özel fizyoterapist işe koyuldu; {player} bir ay erken sahaya dönecek.` },
    { id: 'ignore', label: 'Kulübün doktorlarına bırak', hint: 'Bedava, ama soğuk.', effects: [{ morale: -3, loyalty: -4 }], resultText: `Telefon çalmadı. {player} bunu not etti.` },
  ],
});

add({
  key: 'injury_rush', kind: 'sakatlik', weight: 7, cooldownMonths: 4, clientOnly: true, defaultOption: 'protect',
  when: (S, X) => X.clients.filter(p => p.injured >= 2 && S.clubs[p.clubId]).map(p => ({ playerId: p.id, clubId: p.clubId, months: p.injured })),
  from: 'Kulüp teknik heyeti',
  title: 'Hoca {player} için acele ediyor',
  body: `{club} kritik haftalara giriyor. Teknik heyet, {player:acc} {months} ay beklemeden sahaya sürmek istiyor. Doktor temkinli. Kararı oyuncu değil, sen veriyorsun.`,
  options: [
    { id: 'rush', label: 'Oynasın, takım zor durumda', hint: 'Kulüp minnettar olur; ama risk var.', risk: { pct: 35, text: 'Sakatlık nüksedebilir.' },
      effects: [{ heal: 1, trust: 6, morale: 2 }], altEffects: [{ heal: 1 }, { injure: 4, morale: -8, loyalty: -6, trust: -2 }],
      resultText: `Erken döndü; teknik direktör sana gülümsedi.`, altResultText: `Sakatlık nüksetti. Doktorlar "söylemiştik" der gibi baktı.` },
    { id: 'protect', label: 'Tam iyileşmeden hayır', hint: 'Oyuncu seni sevecek, hoca küsecek.', effects: [{ trust: -5, loyalty: 5, morale: 1 }], resultText: `Hoca kızgın, ama {player} sana minnettar.` },
  ],
});

add({
  key: 'form_slump', kind: 'form', weight: 10, cooldownMonths: 3, clientOnly: true, defaultOption: 'leave',
  when: (S, X) => X.clients.filter(p => p.form <= -3 && p.st.apps >= 3).map(p => ({ playerId: p.id, amount: clamp(tidy(p.wage * 0.8), 2000, 9000) })),
  from: 'Gazeteler',
  title: '{player} kötü günlerde',
  body: `Son maçlarda ayağına top yapışmıyor. Gazeteler "bitti" demeye başladı bile. {player} telefonlarını açmıyor.`,
  options: [
    { id: 'call', label: 'Arayıp moral ver', hint: 'Bir saatlik sohbet.', cost: { energy: 1 }, effects: [{ morale: 8, form: 1 }], resultText: `Telefonda uzun uzun konuştunuz. Sesi ilk kez güldü.` },
    { id: 'psych', label: 'Spor psikoloğuna götür', hint: 'Pahalı ama kalıcı.', cost: (S, c) => ({ cash: c.amount }), effects: [{ morale: 5, form: 2 }], resultText: `Psikolog "kafasındaki top" dedi; {player} biraz hafiflemiş çıktı.` },
    { id: 'leave', label: 'Kendi çıkışını bulsun', hint: 'Bazen yalnız kalmak iyidir, bazen değil.',
      effects: (S, c) => [{ morale: P(S, c).trait === 'yildiz' ? -8 : -3 }], resultText: `Sessizlik uzadı. {player} kendi başına mücadele ediyor.` },
  ],
});

add({
  key: 'benched', kind: 'dakika', weight: 11, cooldownMonths: 3, clientOnly: true, defaultOption: 'wait',
  when: (S, X) => X.clients.filter(p => sh(p) < 0.3 && (X.season > 1 || X.month >= 2) && p.age >= 17 && S.clubs[p.clubId])
    .map(p => ({ playerId: p.id, clubId: p.clubId, altId: targetClub(S, X, p, 'down'), w: p.trait === 'hirsli' || p.trait === 'yildiz' ? 1.6 : 1 })).filter(c => c.altId),
  from: '{player}',
  title: '{player} yedekte çürüyor',
  body: `{club} teknik direktörü, {player} için "şimdilik planlarımda yok" demiş. Kulübedeki her hafta, gelişimden bir parça götürüyor. Gözleri sende.`,
  options: [
    { id: 'talk', label: 'Teknik direktörle konuş', hint: 'Ona şans verdirmeye çalış.', cost: { energy: 1 }, risk: { pct: 40, text: 'Hoca ters tepebilir.' },
      effects: [{ morale: 6, loyalty: 3 }], altEffects: [{ trust: -5, morale: -4 }], resultText: `Hoca dinledi ve "bir bakarız" dedi. {player} umutlandı.`, altResultText: `Hoca sinirlendi: "Kadroyu ben kurarım." Güvenin sarsıldı.` },
    { id: 'move', label: 'Başka bir kulüp ara', hint: '{alt} ilgilenebilir: Piyasa sekmesinden masaya otur.', effects: (S, c) => [{ interest: { playerId: c.playerId, clubId: c.altId, level: 62, kind: 'transfer' }, morale: 3 }], resultText: `Rakamlar yazıya döküldü; {alt} ilgisini bildirdi.` },
    { id: 'promise', label: 'Süre sözü ver', hint: 'Bozarsan bağlılık −25, itibar −3.',
      effects: (S, c) => [{ loyalty: 10, morale: 5, promise: { type: 'minutes', target: 0.5, text: 'Dört ay içinde ilk 11\'de düzenli süre', ...due(S, 4) } }],
      resultText: `"Dört ay içinde yerini bulacağım" dedin. {player} sana inanmak istiyor.` },
    { id: 'wait', label: 'Sabretmesini söyle', hint: 'Bedava, ama güven aşınır.', effects: [{ morale: -5, loyalty: -3 }], resultText: `{player} başını salladı; ama gözlerindeki ışık söndü.` },
  ],
});

add({
  key: 'loan_out', kind: 'dakika', weight: 7, cooldownMonths: 6, clientOnly: true, defaultOption: 'stay',
  when: (S, X) => X.clients.filter(p => p.age <= 21 && sh(p) < 0.3 && S.clubs[p.clubId]).map(p => ({ playerId: p.id, clubId: p.clubId, altId: targetClub(S, X, p, 'down') })).filter(c => c.altId),
  from: '{club} yönetimi',
  title: '{club}: "Kiralık gönderelim"',
  body: `{club} yönetimi, {player} için {alt} ekibinde kiralık fikrini attı: oynar, formu yükselir. Ama gözden uzak kalan oyuncu çabuk unutulur. Sen ne dersin?`,
  options: [
    { id: 'accept', label: 'Kiralığa evet', hint: 'Süre garantili, vitrin küçük.', effects: (S, c) => [{ interest: { playerId: c.playerId, clubId: c.altId, level: 75, kind: 'transfer' }, morale: 5, loyalty: 3 }], resultText: `{alt} ile görüşmeler başladı. Piyasa sekmesinden masaya oturabilirsin.` },
    { id: 'guarantee', label: 'Süre garantisi iste', hint: 'Burada kalsın, ama oynasın.', cost: { energy: 1 }, risk: { pct: 45, text: 'Kulüp geri çevirebilir.' },
      effects: [{ morale: 6, form: 1, trust: 3 }], altEffects: [{ trust: -4, morale: -3 }], resultText: `Hoca kabul etti: "Ona maçlarda süre vereceğim."`, altResultText: `Yönetim sertçe reddetti: "Kadro kararı bizim."` },
    { id: 'stay', label: 'Hayır, burada kalsın', hint: 'Bekleyecek, sabredecek.', effects: [{ morale: -4 }], resultText: `{player} kulübede beklemeye devam edecek.` },
  ],
});

add({
  key: 'fan_favourite', kind: 'sahne', weight: 8, cooldownMonths: 4, clientOnly: true, defaultOption: 'quiet',
  when: (S, X) => X.clients.filter(p => p.st.last.length >= 3 && avgRecent(p) >= 7.1).map(p => ({ playerId: p.id, amount: clamp(tidy(p.value * 0.004), 1000, 12000) })),
  from: 'Taraftar sayfaları',
  title: 'Tribünler {player} diyor',
  body: `Son maçlarda tribünler {player} adını haykırıyor, formaları tükeniyor. Bu parlak anı nasıl değerlendireceksin?`,
  options: [
    { id: 'media', label: 'Röportaj ayarla', hint: 'Sahnedeyken konuşturmak.', cost: { energy: 1 }, risk: { pct: 20, text: 'Ağzından kaçırabilir.' },
      effects: [{ hype: 10, morale: 4, rep: 1 }], altEffects: [{ hype: 4, morale: -3 }], resultText: `Röportaj tutuldu; {player} manşetlerde.`, altResultText: `Birkaç kelime yanlış çıktı; manşet istediğin gibi olmadı.` },
    { id: 'sponsor', label: 'Sponsorlara haber ver', hint: 'Forma satışından payın.', effects: (S, c) => [{ cash: c.amount, hype: 3 }], resultText: `Bir spor mağazası forma satışından sana pay verdi.` },
    { id: 'quiet', label: 'Sessiz kalsın', hint: 'Profesyonel kalmanın değeri.', effects: [{ morale: 3, loyalty: 2 }], resultText: `{player} ayaklarını yere bastı; bu hoşuna gitti.` },
  ],
});

add({
  key: 'national_callup', kind: 'sahne', weight: 5, cooldownMonths: 8, clientOnly: true, defaultOption: 'call',
  when: (S, X) => X.clients.filter(p => p.age <= 21 && p.nat === 'TR' && p.hype >= 20 && p.form >= 0 && p.ca >= 45).map(p => ({ playerId: p.id, clubId: p.clubId })),
  from: 'Federasyon',
  title: '{player} milli takım kampında',
  body: `Federasyon, {player:acc} 21 yaş altı kadrosuna çağırdı. Ailesi sevinçten ağlıyor; kulüp ise sakatlık korkusuyla bırakmak istemiyor.`,
  options: [
    { id: 'camp', label: 'Kampa eşlik et', hint: 'Basın seninle ve onunla.', cost: { energy: 1 }, effects: [{ morale: 10, hype: 10, loyalty: 5, rep: 1, trust: -2 }], resultText: `Milli formayla fotoğraf çektirdiniz. {player} hayatının en gurur dolu gününü yaşadı.` },
    { id: 'call', label: 'Telefonla tebrik et', hint: 'Basit ama içten.', effects: [{ morale: 6, hype: 6 }], resultText: `Mesajını okuyup sana uzun bir ses kaydı gönderdi.` },
    { id: 'block', label: 'Sakatlık riskini öne sür', hint: 'Kulüp sevinir; oyuncu kırılır.', effects: [{ morale: -8, loyalty: -6, trust: 4 }], resultText: `Kulüp memnun; {player} ise sana bir daha o gözle bakmadı.` },
  ],
});

add({
  key: 'client_birthday', kind: 'sahne', weight: 6, cooldownMonths: 4, clientOnly: true, defaultOption: 'forget',
  when: (S, X) => X.clients.map(p => ({ playerId: p.id, amount: clamp(tidy(p.wage * 0.12), 600, 3000) })),
  from: '{player}',
  title: '{player} yaş günü',
  body: `{player} bu hafta {age} yaşına giriyor. Takım arkadaşlarının sürpriz partisi hazır; senden de bir jest bekliyor.`,
  options: [
    { id: 'gift', label: 'Güzel bir hediye al', hint: 'İncelik karşılık bulur.', cost: (S, c) => ({ cash: c.amount }), effects: (S, c) => [{ loyalty: P(S, c).trait === 'sadik' ? 9 : 6, morale: 4 }], resultText: `Paketi açınca gülümsedi: "Bunu hatırlaman çok şey."` },
    { id: 'call', label: 'Ara, tebrik et', hint: 'Bedava ve samimi.', effects: [{ loyalty: 2, morale: 1 }], resultText: `Kısa ama sıcak bir konuşma oldu.` },
    { id: 'forget', label: 'Atla geç', hint: 'Unutmak da bir tavırdır.', effects: (S, c) => [{ loyalty: P(S, c).trait === 'sadik' ? -5 : -2 }], resultText: `Mesaj gelmeyince {player} sessizce başını salladı.` },
  ],
});

add({
  key: 'family_money', kind: 'aile', weight: 8, cooldownMonths: 5, clientOnly: true, defaultOption: 'refuse',
  when: (S, X) => X.clients.map(p => ({ playerId: p.id, amount: clamp(tidy(p.wage * 0.8), 1500, 15000), w: p.trait === 'ailebabasi' || p.trait === 'paraci' ? 1.7 : 1 })),
  from: '{player}',
  title: '{player:gen} ailesi borç istiyor',
  body: `{player} utanarak yanına geldi: babasının dükkânı için {amount} lazım. "Sana yük olmak istemem abi ama..." dedi. Gözlerinde kırgınlık var.`,
  options: [
    { id: 'lend', label: 'Tamamını ver', hint: 'Bir daha unutmaz.', cost: (S, c) => ({ cash: c.amount }), effects: [{ loyalty: 10, morale: 3 }], resultText: `Elini tuttu: "Bu iyiliği ömür boyu unutmam."` },
    { id: 'half', label: 'Yarısını avans ver', hint: 'Yarım yardım, tam saygı değil.', cost: (S, c) => ({ cash: Math.round(c.amount / 2) }), effects: [{ loyalty: 4, morale: 1 }], resultText: `"Yarısı bile çok" dedi; ama yüzü tam gülmedi.` },
    { id: 'refuse', label: 'Kibarca reddet', hint: 'İş iştir.', effects: (S, c) => [{ loyalty: P(S, c).trait === 'paraci' ? -9 : -6, morale: -3 }], resultText: `{player} sustu. Aile meselelerinde sabır kıt olur.` },
  ],
});

add({
  key: 'nightlife', kind: 'medya', weight: 7, cooldownMonths: 5, clientOnly: true, defaultOption: 'ride',
  when: (S, X) => X.clients.filter(p => p.hype >= 25 && (p.age <= 24 || p.trait === 'yildiz' || p.trait === 'hirsli')).map(p => ({ playerId: p.id, clubId: p.clubId, amount: clamp(tidy(p.value * 0.003), 3000, 12000) })),
  from: 'Magazin muhabiri',
  title: '{player} gece hayatında yakalandı',
  body: `Bir tabloid, {player:gen} fotoğraflarını yayımladı: gece yarısı, bir kulüpte, yanında şüpheli bir kalabalık. Telefonlar durmuyor; kulüp de haberi aldı.`,
  options: [
    { id: 'pr', label: 'PR firmasına ödeme yap', hint: 'Haberi küçültmeye çalışırlar.', cost: (S, c) => ({ cash: c.amount }), risk: { pct: 30, text: 'Haber büyüyebilir.' },
      effects: [{ loyalty: 3, morale: 3 }], altEffects: [{ rep: -2, hype: 4, morale: -4 }], resultText: `Haber ikinci sayfaya düştü; {player} derin bir nefes aldı.`, altResultText: `Tam tersi oldu: haber büyüdü, sen de bulaştın.` },
    { id: 'scold', label: 'Sert uyar', hint: 'Disiplin kulübü rahatlatır.', cost: { energy: 1 }, effects: [{ loyalty: -3, morale: -3, trust: 3 }], resultText: `"Bir daha olursa yollarımız ayrılır" dedin. {player} başını eğdi.` },
    { id: 'ride', label: 'Kendi haline bırak', hint: 'Şöhret artar, itibar zedelenir.', effects: [{ hype: 6, rep: -1, trust: -3 }], resultText: `Haber kendi yoluna gitti. Şöhret yükseldi, kulüp kaşlarını çattı.` },
  ],
});

add({
  key: 'social_gaffe', kind: 'medya', weight: 6, cooldownMonths: 5, clientOnly: true, defaultOption: 'delete',
  when: (S, X) => X.clients.filter(p => p.hype >= 30 && p.age <= 27).map(p => ({ playerId: p.id, clubId: p.clubId })),
  from: 'Basın sorumlusu',
  title: '{player:gen} paylaşımı ortalığı karıştırdı',
  body: `{player}, hakem kararlarına sosyal medyadan sert çıktı. Federasyon açıklama istiyor, {club} yönetimi kızgın, taraftar ikiye bölündü.`,
  options: [
    { id: 'apology', label: 'Özür metni yazdır', hint: 'Soğutur ama gururu zedeler.', cost: { energy: 1 }, effects: [{ trust: 2, morale: -2, hype: -3 }], resultText: `Özür metni yayımlandı. Fırtına dindi.` },
    { id: 'double', label: 'Arkasında dur', hint: 'Taraftar sever, kulüp sevmez.', risk: { pct: 40, text: 'Ceza gelebilir.' },
      effects: [{ hype: 12, loyalty: 4, morale: 3 }], altEffects: [{ trust: -6, morale: -6, rep: -1 }], resultText: `Taraftar {player:acc} alkışladı; hype fırladı.`, altResultText: `Federasyon ceza kesti, kulüp seni suçladı.` },
    { id: 'delete', label: 'Sildir ve sus', hint: 'Sessiz çözüm.', effects: [{ hype: -3, loyalty: -1 }], resultText: `Paylaşım silindi, ama ekran görüntüleri çoktan dolaşıyordu.` },
  ],
});

add({
  key: 'teammate_fight', kind: 'kulup', weight: 6, cooldownMonths: 5, clientOnly: true, defaultOption: 'apologize',
  when: (S, X) => X.clients.filter(p => (p.morale < 55 || p.trait === 'yildiz' || p.trait === 'hirsli') && p.st.apps >= 2).map(p => ({ playerId: p.id, clubId: p.clubId })),
  from: 'Kulüp sızıntısı',
  title: '{player} antrenmanda kavga etti',
  body: `{club} antrenmanında bir takım arkadaşıyla göğüs göğüse geldi. Hoca ikisine de baktı; basın çoktan haberi aldı. Ne yapacaksın?`,
  options: [
    { id: 'mediate', label: 'Aracı ol', hint: 'İkisini barıştır.', cost: { energy: 1 }, risk: { pct: 30, text: 'Taraflar barışmayabilir.' },
      effects: [{ trust: 4, morale: 3, loyalty: 3 }], altEffects: [{ trust: -4, morale: -3 }], resultText: `İkisi de elini sıktı; hoca rahatladı.`, altResultText: `Taraflar yine ters düştü. Sen de arada kaldın.` },
    { id: 'side', label: 'Oyuncunun yanında dur', hint: 'Sadakat kazandırır.', effects: [{ loyalty: 7, trust: -5 }], resultText: `"Hep arkanda" dedin. {player} bunu unutmayacak; hoca da.` },
    { id: 'apologize', label: 'Özür dilet', hint: 'Kulübün yanında.', effects: [{ loyalty: -3, trust: 4, morale: -2 }], resultText: `Özür dilemeyi kabul etti; ama gururu incindi.` },
  ],
});

add({
  key: 'wage_talk', kind: 'maas', weight: 9, cooldownMonths: 5, clientOnly: true, defaultOption: 'wait',
  when: (S, X) => X.clients.filter(p => S.clubs[p.clubId] && p.age >= 19 && (p.wage < fairWage(S, p, S.clubs[p.clubId].leagueId) * 0.85 || (p.trait === 'paraci' && p.morale < 65)))
    .map(p => ({ playerId: p.id, clubId: p.clubId, amount: Math.round(fairWage(S, p, S.clubs[p.clubId].leagueId) * 1.05 / 100) * 100 })),
  from: '{player}',
  title: '{player} zam istiyor',
  body: `{player}, maaşının emsallerinin altında olduğunu düşünüyor: "Ayda {amount} hak ediyorum." Paracı bir yanı var ama haksız da sayılmaz.`,
  options: [
    { id: 'promise', label: 'Söz ver: yeni maaş', hint: 'Tutamazsan bağlılık −25, itibar −3.',
      effects: (S, c) => [{ loyalty: 8, morale: 3, promise: { type: 'wage', target: c.amount, text: 'Aylık {amount} maaş', ...due(S, 6) } }], resultText: `"Yıl bitmeden maaşın {amount} olacak" dedin. Gözleri parladı.` },
    { id: 'club', label: 'Kulüple görüş', hint: 'Yenileme masası açılabilir.', cost: { energy: 1 }, risk: { pct: 50, text: 'Kulüp kapıyı kapatabilir.' },
      effects: (S, c) => [{ loyalty: 5, trust: 1, interest: { playerId: c.playerId, clubId: c.clubId, level: 62, kind: 'renewal' } }], altEffects: [{ trust: -4, loyalty: -3 }],
      resultText: `{club} yenileme için masaya oturmaya razı. Piyasa sekmesine bak.`, altResultText: `{club} yönetimi "bütçemiz belli" dedi ve konuyu kapattı.` },
    { id: 'wait', label: 'Şimdi sırası değil', hint: 'Sabır tavsiyesi.', effects: (S, c) => [{ loyalty: P(S, c).trait === 'paraci' ? -9 : -6, morale: -3 }], resultText: `{player} dudağını büktü. "Hep sonra, hep sonra..."` },
  ],
});

add({
  key: 'wants_move', kind: 'transfer', weight: 8, cooldownMonths: 6, clientOnly: true, defaultOption: 'refuse',
  when: (S, X) => X.clients.filter(p => (p.trait === 'hirsli' || p.trait === 'yildiz') && p.loyalty < 72 && p.ca >= 48).map(p => ({ playerId: p.id, clubId: p.clubId, bigId: targetClub(S, X, p, 'up') })).filter(c => c.bigId),
  from: '{player}',
  title: '{player} başka yere bakıyor',
  body: `{player} gece yarısı mesaj attı: "Burada tavanıma çarptım abi. {big} gibi bir kulüp lazım bana." Sabrı zayıf, hırsı büyük.`,
  options: [
    { id: 'promise', label: 'Söz ver: üst lige taşıyacağım', hint: 'Tutamazsan bağlılık −25, itibar −3.',
      effects: (S, c) => [{ loyalty: 10, morale: 4, promise: { type: 'transfer_up', text: 'Bir üst seviyeye transfer', ...afterWindow(S) } }], resultText: `"Bir sonraki pencerede" dedin. {player} bu sözü not defterine yazmış gibi baktı.` },
    { id: 'pitch', label: 'Kapıyı çal', hint: '{big} ile görüşme başlat.', cost: { energy: 1 }, effects: (S, c) => [{ interest: { playerId: c.playerId, clubId: c.bigId, level: 62, kind: 'transfer' }, morale: 4 }], resultText: `{big} yönetimi ilgilendi. Piyasa sekmesinden masaya oturabilirsin.` },
    { id: 'refuse', label: 'Kal ve kendini kanıtla', hint: 'Sert ama dürüst.', effects: [{ loyalty: -8, morale: -5 }], resultText: `{player} başını salladı; ama bu konuşma bitmedi.` },
  ],
});

add({
  key: 'wonderkid_parent', kind: 'aile', weight: 6, cooldownMonths: 8, clientOnly: true, defaultOption: 'wait',
  when: (S, X) => X.clients.filter(p => p.age <= 19 && (p.hype >= 35 || p.pa - p.ca >= 15)).map(p => ({ playerId: p.id, amount: 1500 })),
  from: '{player:gen} babası',
  title: '{player:gen} babası tereddütte',
  body: `{player:gen} babası seni kahveye çağırdı: "Oğlumun geleceği bir sürü ajansın oyuncağı olmaz. Beni ikna et." Başka ajanslar da kapıda bekliyor.`,
  options: [
    { id: 'dinner', label: 'Aileye yemek ver', hint: 'Sofraya otur, güven kazan.', cost: (S, c) => ({ energy: 1, cash: c.amount }), effects: [{ loyalty: 10, morale: 4 }], resultText: `Yemek uzadı, baba gülmeye başladı: "Tamam, senden şüphem kalmadı."` },
    { id: 'plan', label: 'Yazılı yol haritası sun', hint: 'Her yarı sezon ziyaret sözü: tutmak zorundasın.', cost: { energy: 1 },
      effects: (S, c) => [{ loyalty: 8, promise: { type: 'visit', text: 'Her yarı sezon ziyaret', ...due(S, 6) } }], resultText: `Kâğıdı okudu, kaşları çatık. Sonunda "iyi" dedi.` },
    { id: 'hard', label: 'Ya benimlesiniz ya değil', hint: 'Ya hep ya hiç.', risk: { pct: 40, text: 'Baba ikna olmaz, ajans değiştirir.' },
      effects: [{ loyalty: 6 }], altEffects: (S, c) => [{ releaseClient: c.playerId, playerId: c.playerId }], resultText: `Baba bir an sustu, sonra gülümsedi: "Cesaretini sevdim."`, altResultText: `Baba sandalyeyi iterek kalktı. {player} başka bir ajansla yoluna devam edecek.` },
    { id: 'wait', label: 'Zamana bırak', hint: 'Bedava ama bekleme zehirlidir.', effects: [{ loyalty: -5 }], resultText: `Baba cevabı beklemedi; başka ajanslarla görüşmeye devam etti.` },
  ],
});

add({
  key: 'rival_badmouth', kind: 'rakip', weight: 7, cooldownMonths: 5, clientOnly: true, defaultOption: 'ignore',
  when: (S, X) => X.clients.filter(p => p.loyalty <= 75 && p.ca >= 50).map(p => ({ playerId: p.id, rivalId: hpick(S.rivals, key(S, p.id)).id })),
  from: 'Kulis',
  title: '{rival} seni kötülüyor',
  body: `{rival} ({rivalAgency}), {player} için kulağına fısıldamış: "Menajerin küçük, kasası boş; sana bir yere kadar yetişir." Söz uçar, yara kalır.`,
  options: [
    { id: 'visit', label: 'Oyuncuyu ziyaret et', hint: 'Cevap vermeden güven tazele.', cost: { energy: 1 }, effects: [{ loyalty: 9, morale: 3 }], resultText: `Yüzüne baktın, gözünün içine: "Duyduklarının hepsi yalan." İnandı.` },
    { id: 'reply', label: 'Basında cevap ver', hint: 'Cesur bir hamle.', cost: { cash: 2500 }, risk: { pct: 45, text: 'Ters tepebilir.' },
      effects: [{ rep: 2, loyalty: 4 }], altEffects: [{ rep: -2, loyalty: -3 }], resultText: `Açıklaman beğenildi; kulisin tavrı sana döndü.`, altResultText: `Açıklama ters tepti: "Rakibine cevap yetiştirmekle uğraşıyor" dediler.` },
    { id: 'ignore', label: 'Görmezden gel', hint: 'Zaman her şeyi söyler. Belki.', effects: [{ loyalty: -6 }], resultText: `Sessizlik, söylentiye alan açtı. {player} kuşkulandı.` },
  ],
});

add({
  key: 'boot_sponsor', kind: 'sponsor', weight: 8, cooldownMonths: 6, clientOnly: true, defaultOption: 'decline',
  when: (S, X) => X.clients.filter(p => p.hype >= 25 || p.ca >= 55).map(p => ({ playerId: p.id, brand: hpick(BRANDS, key(S, p.id)), amount: clamp(tidy(p.value * 0.012), 2500, 60000) })),
  from: '{brand}',
  title: '{brand}, {player} için kapıda',
  body: `{brand}, {player} ile krampon sponsorluğu istiyor. İlk teklif: senin payına {amount}. Daha iyisi için pazarlık mümkün, ama marka aceleci.`,
  options: [
    { id: 'take', label: 'Hemen imzala', hint: 'Garanti ama vasat marka.', effects: (S, c) => [{ cash: c.amount, morale: 3, loyalty: 3, hype: 2, rep: -1 }], resultText: `İmzalar atıldı; {brand} ilk çeki gönderdi.` },
    { id: 'haggle', label: 'Pazarlık et', hint: 'Daha fazlasını iste.', cost: { energy: 1 }, risk: { pct: 40, text: 'Marka vazgeçebilir.' },
      effects: (S, c) => [{ cash: Math.round(c.amount * 1.7), hype: 5, rep: 1 }], altEffects: [{ morale: -3 }], resultText: `{brand} pazarlığı kabul etti: çok daha iyi bir paket!`, altResultText: `{brand} "başka isim buluruz" dedi ve masadan kalktı.` },
    { id: 'decline', label: 'Reddet', hint: 'Paracı oyuncu hoşlanmaz.', effects: (S, c) => [{ loyalty: P(S, c).trait === 'paraci' ? -6 : 1 }], resultText: `{brand} teşekkür etti ve gitti.` },
  ],
});

// ====================================================================== AJANS / MEDYA / PARA
add({
  key: 'gambling_sponsor', kind: 'sponsor', weight: 5, cooldownMonths: 8, defaultOption: 'refuse',
  when: (S, X) => S.agency.rep >= 14 && { amount: clamp(tidy(S.agency.rep * 1500), 12000, 80000) },
  from: 'Mavi Kupon Bahis',
  title: 'Bahis şirketinden sponsorluk',
  body: `Mavi Kupon, ajansının logosuna {amount} ödemek istiyor. Para iyi, ama bahis markası futbol dünyasında iyi bir yüz değil. Kulisten gelecek tepkiyi düşün.`,
  options: [
    { id: 'accept', label: 'Kabul et', hint: 'Kasa doldu, itibar azaldı.', effects: (S, c) => [{ cash: c.amount, rep: -3 }], resultText: `Logo web sitene geldi. Kulis alaycı: "Kim bahse girdi?"` },
    { id: 'partial', label: 'Sadece web sitesinde', hint: 'Yarım yol.', effects: (S, c) => [{ cash: Math.round(c.amount / 3), rep: -1 }], resultText: `Mütevazı bir anlaşma: az para, az gürültü.` },
    { id: 'refuse', label: 'Reddet', hint: 'Temiz kal.', effects: [{ rep: 1 }], resultText: `"Menajerlik güvendir" dedin. Birkaç kulüp başkanı senin hakkında olumlu konuştu.` },
  ],
});

add({
  key: 'journalist_leak', kind: 'medya', weight: 7, cooldownMonths: 5, clientOnly: true, defaultOption: 'refuse',
  when: (S, X) => {
    const out = [];
    for (const p of X.clients) for (const it of X.interestsOf(p.id)) if (it.level >= 50 && it.clubId !== p.clubId && S.clubs[it.clubId]) out.push({ playerId: p.id, clubId: it.clubId, journalist: hpick(JOURNALISTS, key(S, p.id)), amount: clamp(tidy(p.value * 0.004), 1500, 10000) });
    return out;
  },
  from: 'Sabah Spor · {journalist}',
  title: '{journalist} ağzını arıyor',
  body: `{journalist}, {player:gen} {club} ile görüştüğünü duymuş: "Ayrıntı ver, sana {amount} yazarım; adını da vermem." Haber çıkarsa ilgi artar, ama kulüp bu sızıntıdan hoşlanmaz.`,
  options: [
    { id: 'leak', label: 'Sızdır', hint: 'Para ve şöhret; ama iz bırakır.', risk: { pct: 35, text: 'Kaynak ortaya çıkabilir.' },
      effects: (S, c) => [{ cash: c.amount, hype: 10 }, { news: { kind: 'genel', text: '{club} kulübü {player} için masaya oturdu, kulis kaynayor.', playerId: c.playerId, clubId: c.clubId } }],
      altEffects: (S, c) => [{ cash: c.amount, hype: 10, trust: -10, rep: -3 }], resultText: `Haber ertesi gün manşetteydi. Para cebinde, ilgi artıyor.`, altResultText: `Sızıntının kaynağı sen çıktın; {club} yönetimi seni ekarte etti.` },
    { id: 'official', label: 'Resmi açıklama ver', hint: 'Kontrollü, temiz.', cost: { energy: 1 }, effects: [{ hype: 5, rep: 1, trust: 2 }], resultText: `Açıklaman kısa ve net oldu; gazeteci bile saygı duydu.` },
    { id: 'refuse', label: 'Reddet', hint: 'Boş ver.', effects: [], resultText: `Gazeteci omuz silkti: "Başkası konuşur."` },
  ],
});

add({
  key: 'interview_request', kind: 'medya', weight: 7, cooldownMonths: 4, clientOnly: true, defaultOption: 'decline',
  when: (S, X) => X.clients.filter(p => p.hype >= 30).map(p => ({ playerId: p.id, journalist: hpick(JOURNALISTS, key(S, p.id + 'i')) })),
  from: 'Haber Spor · {journalist}',
  title: '{player} için röportaj talebi',
  body: `{journalist}, {player} ile uzun bir portre röportajı istiyor: fotoğraf çekimi dahil. Güzel bir fırsat; ama {player} bazen ağzından kaçırır.`,
  options: [
    { id: 'attend', label: 'Yanında dur', hint: 'Her cümleyi sen yönlendir.', cost: { energy: 1 }, risk: { pct: 20, text: 'Yanlış cümle çıkabilir.' },
      effects: [{ hype: 10, rep: 1, morale: 3 }], altEffects: [{ hype: 4, morale: -5 }], resultText: `Portre dört sayfa çıktı; {player} parlıyor.`, altResultText: `Tek bir cümle manşet oldu; {player} bozuldu.` },
    { id: 'questions', label: 'Soru listesi iste', hint: 'Güvenli sular.', effects: [{ hype: 5, morale: 1 }], resultText: `Röportaj kontrollü bir şekilde yayımlandı.` },
    { id: 'decline', label: 'Reddet', hint: 'Şimdilik sessiz kalsın.', effects: [{ morale: -1 }], resultText: `{journalist} "tamam" dedi; ama bir kapı kapandı.` },
  ],
});

add({
  key: 'agent_conference', kind: 'ajans', weight: 6, cooldownMonths: 8, defaultOption: 'skip',
  when: (S, X) => S.agency.rep < 85 && { amount: clamp(tidy(1500 + S.agency.rep * 100), 2000, 12000) },
  from: 'Menajerler Derneği',
  title: 'Menajerler Zirvesi',
  body: `Yılın en büyük menajer buluşması bu ay. Kulüp başkanları, izciler, gazeteciler hep orada. Kayıt ücreti {amount}; bir günün de gider.`,
  options: [
    { id: 'attend', label: 'Katıl', hint: 'Yüz yüze görüş, adını duyur.', cost: (S, c) => ({ energy: 1, cash: c.amount }), effects: [{ rep: 3 }], resultText: `Lobide üç başkanla tanıştın, bir izciyle fikir alışverişi yaptın. İtibarın yükseldi.` },
    { id: 'online', label: 'Çevrimiçi izle', hint: 'Ucuz, etkisi az.', cost: (S, c) => ({ cash: Math.round(c.amount / 4) }), effects: [{ rep: 1 }], resultText: `Bir ekrandan izledin. İsmin listede yoktu ama not aldın.` },
    { id: 'skip', label: 'Geç', hint: 'Bu sefer olmaz.', effects: [], resultText: `Zirve sensiz yapıldı.` },
  ],
});

add({
  key: 'charity_match', kind: 'sahne', weight: 5, cooldownMonths: 8, defaultOption: 'pass',
  when: (S, X) => X.clients.length > 0 && X.clients.slice().sort((a, b) => b.hype - a.hype).slice(0, 1).map(p => ({ playerId: p.id, amount: 1500 })),
  from: 'Mahalle Vakfı',
  title: 'Hayır maçı daveti',
  body: `Bir vakıf, ünlüleri hayır maçında topluyor. {player} davetli. Kulüp izin verdi; ama senin de orada olman bekleniyor.`,
  options: [
    { id: 'go', label: 'Birlikte git', hint: 'Fotoğraflar çıkar, gönüller kazanılır.', cost: { energy: 1 }, effects: [{ hype: 8, loyalty: 3, rep: 1 }], resultText: `Çocuklarla maç yaptınız. Gülümsemeler her kareye yerleşti.` },
    { id: 'donate', label: 'Bağış yap', hint: 'Sessiz iyilik.', cost: (S, c) => ({ cash: c.amount }), effects: [{ rep: 1 }], resultText: `Vakıf teşekkür mektubu gönderdi.` },
    { id: 'pass', label: 'Geç', hint: 'Takvim dolu.', effects: [], resultText: `Daveti nazikçe reddettin.` },
  ],
});

// ====================================================================== KULÜP / DİREKTÖR / PİYASA
add({
  key: 'club_unpaid_wages', kind: 'kulup', weight: 6, cooldownMonths: 8, clientOnly: true, defaultOption: 'wait',
  when: (S, X) => X.clients.filter(p => {
    const c = S.clubs[p.clubId];
    return c && c.budget < BAL.clubBudgetByPrestige[S.leagues[c.leagueId].prestige] * 0.85;
  }).map(p => ({ playerId: p.id, clubId: p.clubId, amount: clamp(tidy(p.wage * 2), 2000, 30000) })),
  from: '{player}',
  title: '{club} maaşları geciktiriyor',
  body: `{club} üç aydır maaşları gün aşırı ödüyor. {player:gen} hesabı kuruyor; yönetim "kasa sıkıntısı" diyor. Oyuncu sana bakıyor: ne yapacaksın?`,
  options: [
    { id: 'advance', label: 'Maaşını sen avans öde', hint: 'Pahalı bir sadakat.', cost: (S, c) => ({ cash: c.amount }), effects: [{ loyalty: 12, morale: 5 }], resultText: `Kimse için bu kadar yapmamıştı. {player} gözlerini sildi.` },
    { id: 'meet', label: 'Yönetimle görüş', hint: 'Ödeme takvimi iste.', cost: { energy: 1 }, risk: { pct: 40, text: 'Yönetim kapıyı kapatabilir.' },
      effects: [{ loyalty: 4, morale: 3, trust: 5 }], altEffects: [{ morale: -5, loyalty: -3, trust: -3 }], resultText: `Başkan "ödeyeceğiz" dedi ve yazılı takvim verdi.`, altResultText: `Yönetim kapıyı yüzüne kapattı: "Bu iş sana düşmez."` },
    { id: 'wait', label: 'Sabretmesini söyle', hint: 'Bedava, ama can yakar.', effects: [{ morale: -8, loyalty: -4 }], resultText: `{player} "bir gün biter umarım" dedi. Sesi çıkmıyordu.` },
  ],
});

add({
  key: 'director_moves', kind: 'kulup', weight: 3, cooldownMonths: 10, defaultOption: 'ignore',
  when: (S, X) => {
    const out = [];
    const ids = Object.keys(S.clubs).filter(id => S.clubs[id].trust >= 50).sort((a, b) => S.clubs[b].trust - S.clubs[a].trust).slice(0, 3);
    for (const id of ids) {
      const A = S.clubs[id], pr = S.leagues[A.leagueId].prestige;
      const cands = Object.keys(S.clubs).filter(b => b !== id && Math.abs(S.leagues[S.clubs[b].leagueId].prestige - pr) <= 1);
      if (cands.length) out.push({ clubId: id, clubBId: hpick(cands, key(S, id)) });
    }
    return out;
  },
  from: '{director}',
  title: '{director} başka kulübe geçiyor',
  body: `Eski dostun {director}, {club} koltuğunu bırakıp {clubB} yönetimine geçiyor. {club} cephesinde gelecek yeni isim seni tanımıyor. Yeni masada yüzünü hatırlatmanın zamanı.`,
  options: [
    { id: 'dinner', label: 'Akşam yemeğine çağır', hint: 'Yeni kulübünde kapılar açılır.', cost: { energy: 1, cash: 1200 },
      effects: (S, c) => [{ directorMove: { from: c.clubId, to: c.clubBId } }, { trust: 14, clubId: c.clubBId }], resultText: `Yemekte omzuna vurdu: "{clubB} kapıları sana açık."` },
    { id: 'note', label: 'Tebrik mesajı at', hint: 'Küçük ama hesaplı.', effects: (S, c) => [{ directorMove: { from: c.clubId, to: c.clubBId } }, { trust: 5, clubId: c.clubBId }], resultText: `Kısa bir cevap geldi: "Unutma beni."` },
    { id: 'ignore', label: 'Boş ver', hint: 'Zaman yok.', effects: (S, c) => [{ directorMove: { from: c.clubId, to: c.clubBId } }], resultText: `Haber akıp gitti. {director} yeni koltuğunda seni hatırlamayacak.` },
  ],
});

add({
  key: 'director_fishing', kind: 'kulup', weight: 7, cooldownMonths: 5, clientOnly: true, defaultOption: 'decline',
  when: (S, X) => {
    const out = [];
    for (const p of X.clients) for (const it of X.interestsOf(p.id)) if (it.level >= 30 && it.clubId !== p.clubId && S.clubs[it.clubId]) out.push({ playerId: p.id, clubId: it.clubId, level: it.level, kind: it.kind });
    return out;
  },
  from: '{club} · {director}',
  title: '{director} bilgi avında',
  body: `{club} direktörü {director} seni yemeğe aradı: "{player} için başka teklifler var mı? Açık konuşursan masada kolaylık sağlarım." Gözlerinin içine bakıyor.`,
  options: [
    { id: 'truth', label: 'Gerçeği söyle', hint: 'Güven kazanırsın, pazarlık gücün azalır.', effects: (S, c) => [{ trust: 8, interest: { playerId: c.playerId, clubId: c.clubId, level: Math.max(10, c.level - 8), kind: c.kind } }], resultText: `{director} memnun: "Dürüst adamı severim."` },
    { id: 'bluff', label: 'Rakip var de', hint: 'Cesur bir blöf.', risk: (S, c) => ({ pct: clamp(20 + 8 * (S.clubs[c.clubId] ? S.clubs[c.clubId].director.info : 0), 20, 50), text: 'Direktör bilgi sahibiyse yakalanırsın.' }),
      effects: (S, c) => [{ interest: { playerId: c.playerId, clubId: c.clubId, level: Math.min(100, c.level + 15), kind: c.kind } }], altEffects: [{ trust: -10, rep: -1 }],
      resultText: `{director} kaşlarını çattı, sonra gülümsedi: "Rakamı yükseltmem gerekecek."`, altResultText: `{director} telefonu eline aldı: "Kimse aramamış. Neden yalan söyledin?"` },
    { id: 'decline', label: 'Kibarca geç', hint: 'Bilgi vermiyorum.', effects: [{ trust: -1 }], resultText: `"İşler masada konuşulur" dedin. {director} anlayışla gülümsedi.` },
  ],
});

add({
  key: 'agency_buyout', kind: 'rakip', weight: 3, heavy: true, cooldownMonths: 12, clientOnly: true, defaultOption: 'refuse',
  when: (S, X) => {
    const rv = S.rivals.slice().sort((a, b) => b.cash - a.cash)[0];
    return rv ? X.clients.filter(p => p.value >= 400000 && p.age <= 31).map(p => ({ playerId: p.id, rivalId: rv.id, amount: tidy(clamp(p.value * 0.07, 25000, 1500000)) })) : [];
  },
  from: '{rival} · {rivalAgency}',
  title: '{rival}, {player} için kapında',
  body: `{rivalAgency}, {player} üzerindeki temsil hakkını devralmak için peşin {amount} veriyor. Oyuncu da ikna olmuş gibi. Kasa rahatlar; ama o senin en iyi kartın.`,
  options: [
    { id: 'sell', label: 'Sat', hint: 'Peşin para, müşteri gider.', effects: (S, c) => [{ cash: c.amount }, { sellTo: c.rivalId }, { rep: -1 }, { news: { kind: 'rivalSign', playerId: c.playerId, ctx: { name: '{player}', agency: '{rivalAgency}' } } }], resultText: `İmzalar atıldı. {player} gitti, kasa doldu.` },
    { id: 'counter', label: 'Yüzde 50 fazla iste', hint: 'Tepkiyi görmeden kimse bilmez.', cost: { energy: 1 }, risk: { pct: 55, text: 'Rakip çekilebilir.' },
      effects: (S, c) => [{ cash: Math.round(c.amount * 1.5) }, { sellTo: c.rivalId }, { rep: 1 }], altEffects: [{ loyalty: -4 }], resultText: `{rival} bir süre sustu, sonra kabul etti. Bu işin ustası sensin.`, altResultText: `{rival} masadan kalktı: "Başka zaman." {player} satılmaya çalışıldığını duydu.` },
    { id: 'refuse', label: 'Reddet', hint: 'Müşteri senin.', effects: [{ loyalty: 6, rep: 1 }], resultText: `"Satılık değil" dedin. {player} bu cümleyi duyunca omuzlarını dikleştirdi.` },
  ],
});

add({
  key: 'window_panic', kind: 'transfer', weight: 8, cooldownMonths: 4, clientOnly: true, defaultOption: 'pass',
  when: (S, X) => {
    if (!X.window) return false;
    const out = [];
    for (const p of X.clients) {
      const own = S.clubs[p.clubId];
      if (!own) continue;
      const cp = S.leagues[own.leagueId].prestige;
      let best = null, bs = 1e9;
      for (const cid in S.clubs) {
        const c = S.clubs[cid];
        if (cid === own.id) continue;
        const pr = S.leagues[c.leagueId].prestige;
        if (pr < cp || pr > cp + 1) continue;
        if (!c.needs.some(n => n.pos === p.pos && n.level >= 2)) continue;
        if (S.interests.some(i => i.playerId === p.id && i.clubId === cid)) continue;
        const sc = Math.abs(X.str(cid) - (p.ca + 4)) + hash01(cid + p.id);
        if (sc < bs) { bs = sc; best = cid; }
      }
      if (best) out.push({ playerId: p.id, clubId: best });
    }
    return out;
  },
  from: '{club} · {director}',
  title: '{club} paniğe kapıldı',
  body: `{club}, kadrosundaki boşluğu kapatamadı. {director} gece yarısı seni aradı: "{player} için bugün konuşabilir miyiz?" Panik iyi pazarlıktır, ama ip fazla gerilirse kopar.`,
  options: [
    { id: 'table', label: 'Hemen masaya otur', hint: 'İlgi seviyesi 72.', cost: { energy: 1 }, effects: (S, c) => [{ interest: { playerId: c.playerId, clubId: c.clubId, level: 72, kind: 'transfer' }, trust: 3 }], resultText: `{director} rahat bir nefes aldı. Piyasa sekmesinden masaya oturabilirsin.` },
    { id: 'squeeze', label: 'Fiyatı şişir', hint: 'Daha yüksek ilgi; ya da hiç.', risk: { pct: 35, text: 'Kulüp başka oyuncuya yönelebilir.' },
      effects: (S, c) => [{ interest: { playerId: c.playerId, clubId: c.clubId, level: 88, kind: 'transfer' } }], altEffects: (S, c) => [{ interest: { playerId: c.playerId, clubId: c.clubId, level: 25, kind: 'transfer' }, trust: -2 }],
      resultText: `{director} "ne kadar istiyorsun" dedi. Masa senin lehine eğildi.`, altResultText: `{director} telefonu kapattı: "Başka biri buldum."` },
    { id: 'pass', label: 'Geç', hint: 'Acelen yok.', effects: [], resultText: `Telefonu kapattın. {club} başka kapıya yöneldi.` },
  ],
});

add({
  key: 'tax_audit', kind: 'para', weight: 3, heavy: true, cooldownMonths: 18, defaultOption: 'wait',
  when: (S, X) => S.agency.cash >= 15000 && { amount: clamp(tidy(S.agency.cash * 0.08), 5000, 50000) },
  from: 'Vergi Dairesi',
  title: 'Vergi dairesi kapıda',
  body: `Müfettişler ajansın defterlerini istiyor: "Rutin denetim." Hesaplar düzgün; ama kâğıtlar dağınık. Her yol bir bedel ister: baz maliyet {amount}.`,
  options: [
    { id: 'accountant', label: 'Mali müşavir tut', hint: 'Güvenli ve temiz.', cost: (S, c) => ({ cash: c.amount }), effects: [], resultText: `Müşavir dosyaları düzenledi. Denetim temiz geçti.` },
    { id: 'self', label: 'Kendin hallet', hint: 'Zaman ve şans.', cost: { energy: 1 }, risk: { pct: 35, text: 'Hata bulunursa ceza ağır.' },
      effects: (S, c) => [{ cash: -Math.round(c.amount * 0.2) }], altEffects: (S, c) => [{ cash: -Math.round(c.amount * 2.5), rep: -2 }], resultText: `Evraklar yeterli çıktı; küçük bir harçla kurtuldun.`, altResultText: `Müfettiş birkaç eksik buldu: ceza ağır geldi.` },
    { id: 'wait', label: 'Bekle, olan olur', hint: 'Bedava, ama pahalıya patlar.', effects: (S, c) => [{ cash: -Math.round(c.amount * 1.4), rep: -1 }], resultText: `Ceza yazıldı; ödemeyi geciktirmedin.` },
  ],
});

add({
  key: 'youth_tip', kind: 'kesif', weight: 7, cooldownMonths: 4, defaultOption: 'pass',
  when: (S, X) => {
    const ps = [];
    for (const id in S.players) { const p = S.players[id]; if (!p.agentId && !p.seen && p.age <= 19 && p.pa >= 72) ps.push(p); }
    ps.sort((a, b) => b.pa - a.pa || (a.id < b.id ? -1 : 1));
    return ps.slice(0, 4).map(p => ({ playerId: p.id, clubId: p.clubId, scout: hpick(SCOUTS, key(S, p.id)), amount: 1200 }));
  },
  from: 'Eski izci {scout}',
  title: 'Genç turnuvadan ipucu',
  body: `{scout} aradı: "Gençler turnuvasında {player} diye bir çocuk gördüm, {club} altyapısından. Adını şimdiden yaz." Başkaları da duymuş olabilir; gecikme.`,
  options: [
    { id: 'go', label: 'Turnuvaya git', hint: 'Yakından izle: bilgi +35.', cost: (S, c) => ({ energy: 1, cash: c.amount }), effects: [{ scout: 35 }], resultText: `Çocuğun ilk yarıda iki dripling'ini kayda aldın. Dosyası açıldı.` },
    { id: 'video', label: 'Kayıt iste', hint: 'Bilgi +15.', effects: [{ scout: 15 }], resultText: `İzci birkaç dakikalık görüntü yolladı. Fena değil.` },
    { id: 'pass', label: 'Geç', hint: 'Başkası bulur.', effects: [], resultText: `İzci omuz silkti: "Sonra pişman olma."` },
  ],
});

add({
  key: 'expiring_tip', kind: 'kesif', weight: 6, cooldownMonths: 4, defaultOption: 'pass',
  when: (S, X) => {
    const ps = [];
    for (const id in S.players) { const p = S.players[id]; if (!p.agentId && !p.seen && p.age >= 20 && p.age <= 27 && p.contractEnd === S.time.season && p.ca >= 52) ps.push(p); }
    ps.sort((a, b) => b.ca - a.ca || (a.id < b.id ? -1 : 1));
    return ps.slice(0, 4).map(p => ({ playerId: p.id, clubId: p.clubId, scout: hpick(SCOUTS, key(S, p.id + 'e')) }));
  },
  from: 'Eski izci {scout}',
  title: 'Sözleşmesi biten bir isim',
  body: `{scout} kulağına eğildi: "{player}, {club} ile yeni sözleşme imzalamayacak. Haziran'da serbest kalıyor. Kimse peşinde değil, bir sen bir ben biliyorum."`,
  options: [
    { id: 'call', label: 'Hemen izle', hint: 'Bilgi +25.', cost: { energy: 1 }, effects: [{ scout: 25 }], resultText: `Üç maç izledin; dosya dolmaya başladı.` },
    { id: 'note', label: 'Not al', hint: 'Bilgi +10.', effects: [{ scout: 10 }], resultText: `Adı defterine yazdın. Zamanı gelince bakarsın.` },
    { id: 'pass', label: 'Geç', hint: 'Bu kez olmaz.', effects: [], resultText: `İzci "senin kaybın" dedi.` },
  ],
});

add({
  key: 'contract_renewal', kind: 'transfer', weight: 8, cooldownMonths: 6, clientOnly: true, defaultOption: 'wait',
  when: (S, X) => X.clients.filter(p => p.contractEnd === S.time.season && X.month >= 2 && X.month <= 8 && S.clubs[p.clubId]).map(p => ({ playerId: p.id, clubId: p.clubId })),
  from: '{club} yönetimi',
  title: '{club} yenileme istiyor',
  body: `{player:gen} sözleşmesi Haziran'da bitiyor. {club} ona yeni bir teklif hazırlamış; masaya oturup oturmamak sana kalmış. Bitiş yaklaştıkça elin zayıflar ya da güçlenir.`,
  options: [
    { id: 'table', label: 'Yenileme masasına otur', hint: 'İlgi seviyesi 66.', cost: { energy: 1 }, effects: (S, c) => [{ interest: { playerId: c.playerId, clubId: c.clubId, level: 66, kind: 'renewal' }, trust: 2 }], resultText: `{club} yönetimi "hadi görüşelim" dedi. Piyasa sekmesinden masaya oturabilirsin.` },
    { id: 'wait', label: 'Serbest kalmasını bekle', hint: 'Bosman hamlesi: kulüp kızar.', effects: [{ trust: -3 }], resultText: `{club} bu cevaba surat astı; ama kapı henüz kapanmadı.` },
  ],
});

// ---------------------------------------------------------------- para / borç zinciri
add({
  key: 'friend_loan', kind: 'para', weight: 14, cooldownMonths: 6, defaultOption: 'decline',
  when: (S, X) => S.agency.cash < 25000 && { amount: 25000, amount2: 28000 },
  from: 'Eski dost Selçuk',
  title: 'Dostun yardım eli',
  body: `Kasanın dibi görünüyor ve haber çabuk yayılıyor. Eski dostun Selçuk {amount} borç vermeye hazır: "Faiz yok, ama üç ay sonra {amount2} ödersin."`,
  options: [
    { id: 'take', label: 'Parayı al', hint: 'Üç ay sonra {amount2} ödeme günü.', effects: (S, c) => [{ cash: c.amount }, { queue: { key: 'loan_due', months: 3, ctx: { amount: c.amount2 } } }], resultText: `Selçuk zarfı uzattı: "Güvenim tam." Üç ay sonra hesap günü.` },
    { id: 'decline', label: 'Teşekkür et, reddet', hint: 'Kendi ayağında dur.', effects: [], resultText: `"Kendi başıma çıkacağım" dedin. Selçuk saygıyla başını eğdi.` },
  ],
});

add({
  key: 'loan_due', kind: 'para', weight: 0, followUp: true, cooldownMonths: 0, expiresIn: 2, defaultOption: 'late',
  when: () => false,
  vars: () => ({ amount: 28000 }),
  from: 'Eski dost Selçuk',
  title: 'Selçuk borcunu hatırlattı',
  body: `Üç ay doldu. Selçuk kahvede oturuyor: "Acelem yok, ama hesap hesaptır." Tutar {amount}. Dost sofrası, ama defter de defter.`,
  options: [
    { id: 'pay', label: 'Hemen öde', hint: 'Dostluğu koru.', cost: (S, c) => ({ cash: c.amount }), effects: [{ rep: 1 }], resultText: `Selçuk parayı saymadan cebine attı: "Sen adam gibi adamsın."` },
    { id: 'extend', label: 'Süre iste', hint: 'Faiz %8 artar.', risk: { pct: 50, text: 'Selçuk sabırsızlanabilir.' },
      effects: (S, c) => [{ queue: { key: 'loan_due', months: 2, ctx: { amount: Math.round(c.amount * 1.08) } } }], altEffects: (S, c) => [{ cash: -Math.round(c.amount * 1.15), rep: -3 }],
      resultText: `Selçuk "iki ay daha" dedi ama gözü sende.`, altResultText: `Selçuk sertleşti: borcu faiziyle tahsil etti. Mahallede söz yayıldı.` },
    { id: 'late', label: 'Biraz geciktirip öde', hint: 'Cezası var.', effects: (S, c) => [{ cash: -Math.round(c.amount * 1.2), rep: -2 }], resultText: `Gecikmeli ödedin. Selçuk bir şey demedi; ama bir daha borç vermez.` },
  ],
});

add({
  key: 'commission_complaint', kind: 'maas', weight: 7, cooldownMonths: 8, clientOnly: true, defaultOption: 'refuse',
  when: (S, X) => X.clients.filter(p => p.rep && p.rep.commissionPct >= 7 && (p.loyalty < 65 || p.trait === 'paraci')).map(p => ({ playerId: p.id, pct: p.rep.commissionPct })),
  from: '{player}',
  title: '{player} komisyonunu sorguluyor',
  body: `{player} hesap yapmış: sana ödediği komisyon %{pct}. "Başka ajanslar %5 diyor abi" dedi. Doğru ya da değil, kafasına takılmış.`,
  options: [
    { id: 'cut', label: '%1 düşür', hint: 'Gelirin azalır, güven artar.', effects: [{ commission: -1, loyalty: 10, morale: 2 }], resultText: `"Sen adamsın abi" dedi. Aylık gelirin biraz düştü; güven yükseldi.` },
    { id: 'explain', label: 'Emeklerini say', hint: 'Kapıları, telefonları, geceleri.', cost: { energy: 1 }, risk: { pct: 45, text: 'İkna olmayabilir.' },
      effects: [{ loyalty: 5 }], altEffects: [{ loyalty: -6 }], resultText: `Saydın, saydın... Sonunda "haklısın" dedi.`, altResultText: `Dinledi ama kafası değişmedi: "Bunlar zaten işin."` },
    { id: 'refuse', label: 'Reddet', hint: 'Sözleşme sözleşmedir.', effects: [{ loyalty: -8 }], resultText: `"Sözleşme ortada" dedin. {player} sustu; içinde bir şey kırıldı.` },
  ],
});

add({
  key: 'club_dinner', kind: 'kulup', weight: 6, cooldownMonths: 4, defaultOption: 'send',
  when: (S, X) => {
    const ids = new Set();
    for (const p of X.clients) { ids.add(p.clubId); for (const it of X.interestsOf(p.id)) ids.add(it.clubId); }
    return [...ids].filter(id => S.clubs[id] && S.clubs[id].trust >= 20 && S.clubs[id].trust <= 65).map(id => ({ clubId: id, amount: 1500 }));
  },
  from: '{club} · {director}',
  title: '{club} başkanı yemeğe çağırıyor',
  body: `{director} seni bir akşam yemeğine davet etti: "Tanışalım, yarın öbür gün iş yaparız." Samimi mi, yoksa bilgi mi topluyor? Bilmek zor; ama masaya oturmadan kimse bilemez.`,
  options: [
    { id: 'go', label: 'Yemeğe git', hint: 'Güven için en iyi yatırım.', cost: (S, c) => ({ energy: 1, cash: c.amount }), risk: { pct: 20, text: 'Sohbet boş geçebilir.' }, effects: [{ trust: 12 }], altEffects: [{ trust: 3 }], resultText: `Dört saat futboldan, iki saat işten konuştunuz. Güven yerleşti.`, altResultText: `Adam hep kendinden konuştu. Biraz ilerleme, çok sıkıntı.` },
    { id: 'send', label: 'Asistanını gönder', hint: 'Bedava ama soğuk.', effects: [{ trust: 3 }], resultText: `{director} temsilci gelince kaşını kaldırdı.` },
    { id: 'decline', label: 'Kibarca reddet', hint: 'Zaman yok.', effects: [{ trust: -2 }], resultText: `Davetin sahibi alındı ama göstermedi.` },
  ],
});

add({
  key: 'transfer_rumor', kind: 'medya', weight: 6, cooldownMonths: 5, clientOnly: true, defaultOption: 'ignore',
  when: (S, X) => X.clients.filter(p => p.hype >= 30).map(p => ({ playerId: p.id, clubId: p.clubId, bigId: targetClub(S, X, p, 'up') })).filter(c => c.bigId),
  from: 'Gazete manşeti',
  title: 'Gazete: "{player} → {big}"',
  body: `Bir gazete manşetinde "{player} → {big}" yazıyor. Doğru değil... henüz. {player} ise gülmekten yerinden kalkamıyor; {club} yönetimi ise kaşlarını çatmış.`,
  options: [
    { id: 'deny', label: 'Yalanla', hint: 'Kulübü rahatlat.', effects: [{ morale: -3, hype: -3, trust: 3 }], resultText: `"Asılsız" dedin. {club} yönetimi bir nefes aldı.` },
    { id: 'feed', label: 'Söylentiyi besle', hint: 'Ses getirir; kulüp bilir.', risk: { pct: 35, text: 'Kulüp kızabilir.' },
      effects: (S, c) => [{ hype: 10, morale: 5, interest: { playerId: c.playerId, clubId: c.bigId, level: 40, kind: 'transfer' } }], altEffects: [{ trust: -6, rep: -2 }],
      resultText: `Söylenti büyüdü; {big} cephesinde kıpırdanma başladı.`, altResultText: `{club} yönetimi senin işin olduğunu anladı. Güven sarsıldı.` },
    { id: 'ignore', label: 'Kendi haline bırak', hint: 'Zaten gelip geçer.', effects: [{ morale: 1 }], resultText: `Haber iki gün sonra unutuldu.` },
  ],
});

add({
  key: 'coach_praise', kind: 'sahne', weight: 6, cooldownMonths: 5, clientOnly: true, defaultOption: 'nothing',
  when: (S, X) => X.clients.filter(p => p.st.last.length >= 3 && avgRecent(p) >= 6.8 && sh(p) >= 0.6).map(p => ({ playerId: p.id, clubId: p.clubId })),
  from: '{club} basın toplantısı',
  title: 'Hoca {player} için ne dedi?',
  body: `Teknik direktör basın toplantısında {player} için "takımın en profesyoneli" dedi. Böyle sözler yılda bir kez çıkar. Bu iltifatı nasıl kullanırsın?`,
  options: [
    { id: 'celebrate', label: 'Birlikte kutlayın', hint: 'Moral ve bağlılık.', cost: { energy: 1 }, effects: [{ morale: 5, loyalty: 4 }], resultText: `Küçük bir akşam yemeği, bol kahkaha. {player} çok mutlu.` },
    { id: 'press', label: 'Cümleyi haberleştir', hint: 'Hype ve güven.', effects: [{ hype: 6, trust: 2 }], resultText: `Cümle bir hafta boyunca spor sayfalarındaydı.` },
    { id: 'nothing', label: 'Hiçbir şey yapma', hint: 'Mütevazı kal.', effects: [{ morale: 1 }], resultText: `Hoca da {player} da bu iltifatı yüksek sesle konuşmadı.` },
  ],
});

add({
  key: 'homesick', kind: 'aile', weight: 7, cooldownMonths: 6, clientOnly: true, defaultOption: 'toughen',
  when: (S, X) => X.clients.filter(p => p.age <= 21 && S.clubs[p.clubId] && S.leagues[S.clubs[p.clubId].leagueId].country !== 'Türkiye').map(p => ({ playerId: p.id, clubId: p.clubId, amount: 1800 })),
  from: '{player}',
  title: '{player} memleketini özledi',
  body: `{club} formasıyla ilk kışını geçiren {player}, geceleri annesini arıyor. Dil sorunu, soğuk hava, yalnızlık... sahaya da yansımaya başladı.`,
  options: [
    { id: 'visit', label: 'Yanına git', hint: 'Bilet ve yemek.', cost: (S, c) => ({ energy: 1, cash: c.amount }), effects: [{ morale: 10, loyalty: 8 }], resultText: `Türkçe konuştunuz, annesinin böreğini getirdin. Gözleri güldü.` },
    { id: 'leave', label: 'Kulüpten izin al', hint: 'Kısa bir mola.', effects: [{ morale: 6, trust: -3, form: -1 }], resultText: `Üç günlük izin koparttın. Döndüğünde daha dinç.` },
    { id: 'toughen', label: 'Sert ol, alışsın', hint: 'Futbol zor iştir.', effects: [{ morale: -5, loyalty: -3 }], resultText: `"Alışırsın" dedin. {player} bir şey demedi ama telefonu kapattı.` },
  ],
});

add({
  key: 'veteran_contract', kind: 'maas', weight: 6, cooldownMonths: 8, clientOnly: true, defaultOption: 'plan',
  when: (S, X) => X.clients.filter(p => p.age >= 31 && p.contractEnd <= S.time.season + 1 && S.clubs[p.clubId]).map(p => ({ playerId: p.id, amount: Math.round(fairWage(S, p, S.clubs[p.clubId].leagueId) * 1.1 / 100) * 100 })),
  from: '{player}',
  title: '{player} son büyük sözleşmesini istiyor',
  body: `{age} yaşındaki {player}: "Bu belki son büyük sözleşmem. Kısa yıllar, dolu maaş." Kulüpler yaşlı oyuncuya temkinli bakıyor; ama kalkacak yeri de yok.`,
  options: [
    { id: 'promise', label: 'Söz ver: yeni maaş', hint: 'Tutamazsan bağlılık −25, itibar −3.', effects: (S, c) => [{ loyalty: 8, morale: 3, promise: { type: 'wage', target: c.amount, text: 'Aylık {amount} maaş', ...due(S, 6) } }], resultText: `"Bu yıl bitmeden" dedin. {player} bir omuz silkme ile teşekkür etti.` },
    { id: 'talk', label: 'Dürüstçe konuş', hint: 'Gerçekçi beklenti.', cost: { energy: 1 }, effects: [{ loyalty: 4, morale: 1 }], resultText: `Baş başa, çay içerek konuştunuz. Hayal ile hesap arasındaki mesafeyi gördü.` },
    { id: 'plan', label: 'Emeklilik sonrasını konuş', hint: 'Menajerlikten yardım.', effects: [{ loyalty: 2 }], resultText: `"Sonrası için hep yanındayım" dedin. Gülümsedi.` },
  ],
});

add({
  key: 'bosman_approach', kind: 'transfer', weight: 8, cooldownMonths: 6, clientOnly: true, defaultOption: 'reject',
  when: (S, X) => X.clients.filter(p => p.contractEnd === S.time.season && X.month >= 6 && X.month <= 10).map(p => ({ playerId: p.id, bigId: targetClub(S, X, p, 'up') })).filter(c => c.bigId),
  from: '{big} · {bigDir}',
  title: '{big} ön sözleşme istiyor',
  body: `{player:gen} sözleşmesi Haziran'da bitiyor. {big} bedelsiz transfer için kapıyı çaldı. Mevcut kulübün haberi yok; öğrenirse çok kızar. Yine de bedelsiz transferin pastası büyüktür.`,
  options: [
    { id: 'table', label: 'Gizli masaya otur', hint: 'Bedelsiz transfer: büyük pasta.', cost: { energy: 1 }, effects: (S, c) => [{ interest: { playerId: c.playerId, clubId: c.bigId, level: 70, kind: 'free' } }], resultText: `Gizli bir görüşmede ana hatlar çizildi. Piyasa sekmesinden devam edebilirsin.` },
    { id: 'reject', label: 'Kulübe saygı göster', hint: 'Güven kazan, fırsat kaç.', effects: [{ trust: 4, loyalty: -2 }], resultText: `{big} geri çekildi. Kulübün gözünde yükseldin.` },
  ],
});

add({
  key: 'scout_in_stands', kind: 'transfer', weight: 8, cooldownMonths: 4, clientOnly: true, defaultOption: 'none',
  when: (S, X) => X.clients.filter(p => (p.hype >= 40 || p.form >= 2) && S.clubs[p.clubId]).map(p => ({ playerId: p.id, bigId: targetClub(S, X, p, 'up'), amount: 1000 })).filter(c => c.bigId),
  from: 'Tribün kaynağı',
  title: 'Tribünde {big} izcisi var',
  body: `{player:gen} maçında {big} kulübünün izcisi görüldü. {player} fark etmedi, ama sen ettin. Bir davetle ya da bir telefonla ilgiyi büyütebilirsin.`,
  options: [
    { id: 'host', label: 'İzciyi ağırla', hint: 'İlgi seviyesi 55.', cost: (S, c) => ({ energy: 1, cash: c.amount }), effects: (S, c) => [{ interest: { playerId: c.playerId, clubId: c.bigId, level: 55, kind: 'transfer' } }], resultText: `Kahve içtiniz, {player:gen} videosunu izlettin. İzci notlarını çevirdi.` },
    { id: 'call', label: 'Telefon aç', hint: 'İlgi seviyesi 45.', effects: (S, c) => [{ interest: { playerId: c.playerId, clubId: c.bigId, level: 45, kind: 'transfer' } }], resultText: `Kısa ama etkili bir konuşma oldu.` },
    { id: 'none', label: 'Kendi haline bırak', hint: 'Performans konuşur.', effects: [], resultText: `İzci notlarını aldı ve gitti.` },
  ],
});

add({
  key: 'captaincy', kind: 'kulup', weight: 5, cooldownMonths: 10, clientOnly: true, defaultOption: 'decline',
  when: (S, X) => X.clients.filter(p => p.age >= 26 && (p.trait === 'sadik' || p.trait === 'profesyonel') && sh(p) >= 0.6 && S.clubs[p.clubId]).map(p => ({ playerId: p.id, clubId: p.clubId })),
  from: '{club} yönetimi',
  title: '{club}: "Kaptanımız olsun"',
  body: `{club} yönetimi, {player} için kaptanlık bandını ve dört yıllık yeni sözleşmeyi masaya koydu. Bağlılığı güçlenir, ama başka kapılar kapanır.`,
  options: [
    { id: 'accept', label: 'Kabul et', hint: 'Sadakat ödüllendirilir.', effects: [{ loyalty: 12, morale: 8, trust: 6 }], resultText: `Bandı koluna taktığında gözleri doldu. Tribünler ayakta.` },
    { id: 'negotiate', label: 'Daha yüksek maaş iste', hint: 'Fırsatı kullan.', cost: { energy: 1 }, risk: { pct: 40, text: 'Kulüp geri adım atabilir.' },
      effects: [{ loyalty: 10, morale: 8, trust: 2 }], altEffects: [{ trust: -6, morale: -5 }], resultText: `Yönetim biraz homurdandı ama kabul etti. Maaş da, band da onun.`, altResultText: `Başkan sinirlendi: "Kaptanlık para meselesi mi?" Teklif geri çekildi.` },
    { id: 'decline', label: 'Kaptanlığı reddet', hint: 'Kapıları açık tut.', effects: [{ loyalty: -3, trust: -5 }], resultText: `Yönetim yüz buruşturdu; {player} içinden bir şey söyledi.` },
  ],
});

add({
  key: 'hype_overload', kind: 'medya', weight: 5, cooldownMonths: 6, clientOnly: true, defaultOption: 'quiet',
  when: (S, X) => X.clients.filter(p => p.hype >= 70 && p.age <= 21).map(p => ({ playerId: p.id })),
  from: 'Spor gazeteleri',
  title: '{player:gen} omuzlarında dünya var',
  body: `Manşetler "Türk futbolunun yeni umudu" diyor; genç bir oyuncu için ağır bir lakap. {player} sahada serbest oynayamıyor, her pas bir sınav gibi.`,
  options: [
    { id: 'protect', label: 'Medyadan uzak tut', hint: 'Hype azalır, moral toparlanır.', cost: { energy: 1 }, effects: [{ hype: -10, morale: 6, loyalty: 4 }], resultText: `Telefonunu kapattırdın. {player} ilk kez rahat bir hafta geçirdi.` },
    { id: 'ride', label: 'Dalgayı sür', hint: 'Yıldızlar sever, kırılganlar ezilir.', risk: { pct: 30, text: 'Baskı formu bozabilir.' },
      effects: (S, c) => [{ hype: 8, morale: P(S, c).trait === 'yildiz' ? 6 : -4 }], altEffects: [{ form: -3, morale: -5 }], resultText: `Röportajlar, çekimler... {player} dalgayı sürüyor.`, altResultText: `Baskı sahaya yansıdı; {player} iki maçta kendini kaybetti.` },
    { id: 'quiet', label: 'Hiçbir şey yapma', hint: 'Zamana güven.', effects: [{ morale: -3 }], resultText: `{player} sessizce yükü taşımaya devam etti.` },
  ],
});

add({
  key: 'podcast', kind: 'medya', weight: 5, cooldownMonths: 8, defaultOption: 'decline',
  when: (S, X) => S.agency.rep >= 10,
  from: 'Kulis Sohbetleri',
  title: 'Podcast daveti',
  body: `Popüler bir futbol podcast'i seni konuk etmek istiyor: iki saat canlı yayın. Ağzından çıkan her laf yarın manşet olabilir.`,
  options: [
    { id: 'go', label: 'Canlı yayına katıl', hint: 'İtibar için sahne.', cost: { energy: 1 }, risk: { pct: 25, text: 'Bir yanlış laf manşet olur.' }, effects: [{ rep: 2 }], altEffects: [{ rep: -2 }], resultText: `Yayın güzel geçti; kulisin konuşma tarzı sana dönüştü.`, altResultText: `Bir şaka yanlış anlaşıldı; sosyal medya ayaklandı.` },
    { id: 'written', label: 'Yazılı soru-cevap yap', hint: 'Güvenli ve küçük.', effects: [{ rep: 1 }], resultText: `Editör cevapları düzenleyip yayımladı.` },
    { id: 'decline', label: 'Teşekkür et', hint: 'Zaman yok.', effects: [], resultText: `Başka bir konuk bulundu.` },
  ],
});

add({
  key: 'office_rent', kind: 'para', weight: 5, cooldownMonths: 10, defaultOption: 'pay',
  when: (S, X) => X.abs >= 2 && { amount: 2500 },
  from: 'Ev sahibi Nuri Bey',
  title: 'Kiraya zam geldi',
  body: `Ofisin sahibi kirayı artırıyor: "Mahalle değişti, fiyat değişti." Yer iyi, ama her zam kasadan gider. Pazarlık edebilirsin; adam inatçıdır.`,
  options: [
    { id: 'pay', label: 'Zammı kabul et', hint: 'Tek seferlik {amount}.', effects: (S, c) => [{ cash: -c.amount }], resultText: `Zamma boyun eğdin. Nuri Bey çayını ısmarladı.` },
    { id: 'haggle', label: 'Pazarlık et', hint: 'Zorlanabilirsin.', cost: { energy: 1 }, risk: { pct: 40, text: 'Nuri Bey sinirlenebilir.' }, effects: (S, c) => [{ cash: -Math.round(c.amount * 0.3) }], altEffects: (S, c) => [{ cash: -Math.round(c.amount * 1.6) }], resultText: `Nuri Bey "peki, peki" dedi; zammın çoğundan vazgeçti.`, altResultText: `Nuri Bey sinirlendi ve zamma bir de "taşınma payı" ekledi.` },
  ],
});

add({
  key: 'scam_reports', kind: 'kesif', weight: 4, cooldownMonths: 10, defaultOption: 'refuse',
  when: (S, X) => {
    const ps = [];
    for (const id in S.players) { const p = S.players[id]; if (!p.agentId && !p.seen && p.pa >= 70 && p.age <= 22) ps.push(p); }
    ps.sort((a, b) => b.pa - a.pa || (a.id < b.id ? -1 : 1));
    return ps.slice(0, 3).map(p => ({ playerId: p.id, amount: 3000 }));
  },
  from: 'Tanımadığın bir numara',
  title: 'Gizli izci raporu satılık',
  body: `Biri sana "Avrupa'nın altyapı raporları" diye bir dosya satmak istiyor: {amount}. Dosya altın değerinde olabilir... ya da çöp. Yüzünü görmediğin adam peşin istiyor.`,
  options: [
    { id: 'buy', label: 'Dosyayı satın al', hint: 'Parayı öde, kumar oyna.', cost: (S, c) => ({ cash: c.amount }), risk: { pct: 55, text: 'Dosya çöp çıkabilir.' }, effects: [{ scout: 28 }], altEffects: [], resultText: `Dosya gerçek çıktı: ilginç bir isim yakaladın.`, altResultText: `Dosyada tek bir doğru bilgi yoktu. Adam telefonu kapattı.` },
    { id: 'refuse', label: 'Reddet', hint: 'Dolandırıcı kokusu var.', effects: [], resultText: `"Gerekirse kendim bulurum" dedin.` },
  ],
});

add({
  key: 'luxury_car', kind: 'sahne', weight: 5, cooldownMonths: 8, clientOnly: true, defaultOption: 'refuse',
  when: (S, X) => X.clients.filter(p => (p.trait === 'paraci' || p.trait === 'yildiz') && p.wage >= 3500).map(p => ({ playerId: p.id, amount: clamp(tidy(p.wage * 1.2), 3000, 25000) })),
  from: '{player}',
  title: '{player} araba istiyor',
  body: `{player} yeni bir spor araba görmüş: "Menajerim yardım ederse alırım abi." Maaşıyla alamayacak değil; mesele ilgi görmek. Kapora {amount}.`,
  options: [
    { id: 'finance', label: 'Kaporayı karşıla', hint: 'Pahalı bir sevgi.', cost: (S, c) => ({ cash: c.amount }), effects: [{ loyalty: 12, morale: 8, hype: 3 }], resultText: `Anahtarı eline aldığında çocuk gibi sevindi.` },
    { id: 'counter', label: 'Daha ucuz bir araç öner', hint: 'Orta yol.', effects: [{ loyalty: 1, morale: -1 }], resultText: `"Olur abi" dedi; ama gözü hâlâ spor arabada.` },
    { id: 'refuse', label: 'Reddet', hint: 'Futbol önce.', effects: [{ loyalty: -7, morale: -4 }], resultText: `"Sen böylesin" dedi; yüzü düştü.` },
  ],
});

add({
  key: 'loyalty_crisis', kind: 'aile', weight: 9, cooldownMonths: 5, clientOnly: true, defaultOption: 'wait',
  when: (S, X) => X.clients.filter(p => p.loyalty < 28).map(p => ({ playerId: p.id, amount: 3000 })),
  from: '{player}',
  title: '{player} seninle konuşmak istemiyor',
  body: `{player} üç haftadır telefonlarını açmıyor. Menajerler arasında "ayrılacak" söylentisi dolaşıyor. Hâlâ vaktin var; ama son çağrı.`,
  options: [
    { id: 'heart', label: 'Kapısına git', hint: 'Yüz yüze konuş.', cost: { energy: 1 }, effects: [{ loyalty: 14, morale: 5 }], resultText: `Kapıyı açtığında şaşırdı. Üç saat konuştunuz; buz çözüldü.` },
    { id: 'gift', label: 'Hediye gönder', hint: 'Para konuşur mu?', cost: (S, c) => ({ cash: c.amount }), effects: [{ loyalty: 9, morale: 4 }], resultText: `Hediyeyi kabul etti; "teşekkürler" mesajı yarım ağızla geldi.` },
    { id: 'release', label: 'Yolunu aç', hint: 'Müşteri ayrılır.', effects: (S, c) => [{ releaseClient: c.playerId, playerId: c.playerId }, { rep: -1 }], resultText: `Anlaşmayı karşılıklı feshettiniz. Soğuk bir tokalaşma.` },
    { id: 'wait', label: 'Zaman verelim', hint: 'Bedava, ama saat işliyor.', effects: [{ loyalty: -4 }], resultText: `Telefon çalmadı. İkiniz de beklediniz.` },
  ],
});

add({
  key: 'relegation_battle', kind: 'kulup', weight: 8, cooldownMonths: 6, clientOnly: true, defaultOption: 'wait',
  when: (S, X) => {
    if (X.month < 6 || X.month > 10) return false;
    return X.clients.filter(p => {
      const c = S.clubs[p.clubId];
      if (!c) return false;
      const rows = tableSorted(S, c.leagueId);
      return rows.findIndex(r => r.clubId === c.id) >= 7;
    }).map(p => ({ playerId: p.id, clubId: p.clubId, altId: targetClub(S, X, p, 'up') })).filter(c => c.altId);
  },
  from: '{player}',
  title: '{club} küme hattında',
  body: `{club} puan tablosunun kritik bölgesinde; kasa, moral ve taraftarın sinirleri gergin. {player} sana "burada battım mı?" diye soruyor.`,
  options: [
    { id: 'stand', label: 'Maçlara git', hint: 'Yanında ol.', cost: { energy: 1 }, effects: [{ morale: 7, loyalty: 6 }], resultText: `Tribünde senin yüzünü görünce {player} gözlerini kaldırdı.` },
    { id: 'exit', label: 'Çıkış yolu ara', hint: '{alt} ile ilgi seviyesi 60.', effects: (S, c) => [{ interest: { playerId: c.playerId, clubId: c.altId, level: 60, kind: 'transfer' }, morale: 2, trust: -2 }], resultText: `Telefonlar açıldı; {alt} dosyayı tarttığını söyledi.` },
    { id: 'wait', label: 'Beklesin', hint: 'Sabır.', effects: [{ morale: -5, loyalty: -2 }], resultText: `{player} içinden bir şey söyledi.` },
  ],
});

add({
  key: 'title_race', kind: 'sahne', weight: 6, cooldownMonths: 8, clientOnly: true, defaultOption: 'focus',
  when: (S, X) => {
    if (X.month < 7) return false;
    return X.clients.filter(p => {
      const c = S.clubs[p.clubId];
      if (!c) return false;
      const rows = tableSorted(S, c.leagueId);
      return rows.findIndex(r => r.clubId === c.id) <= 1 && p.st.apps >= 6;
    }).map(p => ({ playerId: p.id, clubId: p.clubId }));
  },
  from: '{player}',
  title: '{club} şampiyonluk yarışında',
  body: `Son haftalar: {club} zirvede ya da hemen yanında. {player}: "Bu sezon kupayı alacağız abi." Şampiyonluk, bir futbolcunun ömür boyu hatırlayacağı bir şeydir.`,
  options: [
    { id: 'celebrate', label: 'Moral ver, kutla', hint: 'İlham zamanı.', cost: { energy: 1 }, effects: [{ morale: 8, loyalty: 4, hype: 4 }], resultText: `Soyunma odasında bile seni andı: "Hep yanımızdaydın."` },
    { id: 'hype', label: 'Medyada büyüt', hint: 'Şöhret fırsatı.', cost: { cash: 1500 }, effects: [{ hype: 10, rep: 1 }], resultText: `Haberi iki gazeteye sundun; hikâye kendi yoluna gitti.` },
    { id: 'focus', label: 'Odağı bozma', hint: 'Mütevazı kal.', effects: [{ form: 1 }], resultText: `"Kupa kazanıldığında konuşuruz" dedin. {player} gülümsedi.` },
  ],
});

// ====================================================================== ÖZEL KARTLAR (rastgele çekilmez)
add({
  key: 'loan_offer', kind: 'banka', weight: 0, followUp: true, cooldownMonths: 0, expiresIn: 3, defaultOption: 'no',
  when: () => false,
  vars: () => ({ amount: BAL.econ.loan.amount, amount2: Math.ceil(BAL.econ.loan.amount * (1 + BAL.econ.loan.rate) / BAL.econ.loan.months), months: BAL.econ.loan.months }),
  from: 'Banka',
  title: 'Bankadan kredi teklifi',
  body: `Kasan eksiye düştü, ama banka ajansına güveniyor: {amount} kredi, {months} ay vade, aylık taksit {amount2}. Bu yolu bir kez kullanabilirsin; üç ay üst üste eksi kalırsan iflas.`,
  options: [
    { id: 'take', label: 'Krediyi al', hint: 'Taksitler maaşından değil, kasadan çıkar.', effects: [], run: S => takeLoan(S), resultText: `Para hesabına yattı. Taksit takvimi masanda.` },
    { id: 'no', label: 'Şimdilik hayır', hint: 'Bankaya sonra da başvurabilirsin.', effects: [], resultText: `Teklifi kenara koydun; banka kapıyı açık bıraktı.` },
  ],
});

// ====================================================================== REHBER KARTLARI (tutorial)
const TUT = [];
const tut = t => TUT.push({ kind: 'rehber', weight: 0, cooldownMonths: 0, expiresIn: 99, defaultOption: 'ok', when: () => false, from: 'Rıza Abi', ...t });
tut({
  key: 'tut_welcome', title: 'Hoş geldin, evlat',
  body: `Mahalle kahvesinden Rıza Abi: "Üç müşterin var, kasan dar. Menajerlik güven işidir; önce adamlarının yüzüne bak. Dilersen yol boyunca ipucu veririm, dilersen yalnız yürürsün."`,
  options: [
    { id: 'ok', label: 'Eşlik et, abi', hint: 'Kısa ipuçlarıyla ilerle.', effects: [], resultText: `Rıza Abi gülümsedi: "Önce cevherini ziyaret et."` },
    { id: 'skip', label: 'Ben bilirim, atla', hint: 'Rehber kartlar kalkar.', effects: [], resultText: `"Bildiğin gibi yap" dedi Rıza Abi. "Ama kahveye uğra."` },
  ],
});
tut({
  key: 'tut_visit', title: 'Önce cevherini ziyaret et',
  body: `{player} senin en büyük kozun, ama henüz yolun başında ve yalnız. Oyuncular sekmesinden "Ziyaret Et"e bas: moral ve bağlılık yükselir, ne istediğini öğrenirsin. Bir enerji.`,
  options: [{ id: 'ok', label: 'Tamam', hint: 'Ziyareti yapınca kart kalkar.', effects: [], resultText: '' }],
});
tut({
  key: 'tut_scout', title: 'İlk keşif gezisi',
  body: `Yeni müşteri, yeni gelir. Keşif sekmesinden bir lig seç ve "Keşif Gezisi"ne çık: yetenekli üç isim ortaya çıkar. Rakipler de izliyor; ısı çubuğuna dikkat et. Bir enerji ve yol parası.`,
  options: [{ id: 'ok', label: 'Tamam', hint: 'Geziyi yapınca kart kalkar.', effects: [], resultText: '' }],
});
tut({
  key: 'tut_market', title: 'Kulüplerin kapısını çal',
  body: `Teklif gelsin istiyorsan kulüplerle ilişkin olmalı. Piyasa sekmesinden bir kulüple yemek ye: güven ve bilgi kazanırsın. Ya da bir oyuncunu kulübe öner. Bir enerji.`,
  options: [{ id: 'ok', label: 'Tamam', hint: 'Yemek ya da öneriyi yapınca kart kalkar.', effects: [], resultText: '' }],
});
tut({
  key: 'tut_interest', title: 'İlk ilgi geldi!',
  body: `{club} kulübü {player} ile ilgileniyor. Piyasa sekmesinde teklifi aç ve masaya otur. Direktör {director} dürüst biri: yüzü ne düşündüğünü gösterir. Yüzünü oku, rakamı ona göre ayarla.`,
  options: [{ id: 'ok', label: 'Tamam', hint: 'Masayı açınca kart kalkar.', effects: [], resultText: '' }],
});
tut({
  key: 'tut_promises', title: 'Söz ver, ama tut',
  body: `Sözler müşteriyi bağlar, ama bozarsan bağlılık yirmi beş puan düşer, itibarın da zedelenir. Vermeden önce iki kez düşün; vadesi gelince sözünü tutmaya bak.`,
  options: [{ id: 'ok', label: 'Anladım', hint: 'Sözler oyuncu kartında görünür.', effects: [], resultText: `Rıza Abi başını salladı: "Sözünü tutan kazanır."` }],
});
tut({
  key: 'tut_ranking', title: 'Sıralama ve miras',
  body: `Beş ajans yarışıyor: sen ve dört rakip. Puanı müşteri değeri, kasa ve itibar belirler. Ajans sekmesindeki merdivenden yerini izle; sekiz sezon sonunda miras puanın hesaplanır. Bol şans, evlat.`,
  options: [{ id: 'ok', label: 'Teşekkürler, abi', hint: 'Rehber biter. Küçük bir harçlık.', effects: [{ cash: 3000, rep: 1 }], resultText: `Rıza Abi cebine bir zarf soktu: "Kahve benden."` }],
});

/** Every drawable template plus follow-up cards (loan_due, loan_offer). */
export const EVENT_TEMPLATES = T;
/** Scripted first-months cards (never drawn at random). */
export const TUTORIAL_TEMPLATES = TUT;
