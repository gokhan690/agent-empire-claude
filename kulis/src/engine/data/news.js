// News headline templates, tabloid sports style. `newsText(kind, ctx)` returns a Turkish headline.
// Variant choice is a pure hash of (kind, ctx): deterministic, no RNG touched. Every kind has ≥ 6 variants.
//
// ctx keys understood (all optional, with fallbacks and aliases so other modules can pass what they have):
//   name|player, from|fromClub|oldClub, to|toClub|newClub|club, fee (number; 0/absent = bedelsiz), league, goals,
//   agency|rival, award, months, objective|text, side ('you'|'ai'|'rival' for kind 'transfer').
import { ek, eur, hpick } from './text.js';

/** Normalised view of a ctx with Turkish fallbacks. */
function N(c) {
  const name = c.name || c.player || 'Genç yetenek';
  const to = c.to || c.toClub || c.newClub || c.club || 'yeni kulübü';
  const fee = Number(c.fee) > 0 ? eur(c.fee) : (typeof c.fee === 'string' && c.fee ? c.fee : '');
  return {
    name, to,
    from: c.from || c.fromClub || c.oldClub || 'eski kulübü',
    club: c.club || c.to || c.toClub || 'Kulüp',
    league: c.league || 'ligi',
    agency: c.agency || c.rival || 'Rakip ajans',
    goals: c.goals ?? 'bir sürü',
    award: c.award || 'sezonun ödülü',
    objective: c.objective || c.text || 'sezon hedefi',
    dur: c.months ? c.months + ' ay' : 'bir süre',
    bed: fee ? fee + ' bonservisle' : 'bedelsiz',
    fee,
  };
}
const V = {};
const def = (kind, ...fns) => { V[kind] = fns.map(f => c => f(N(c), c)); };

// ---- transfers ----
def('transferYou',
  n => `${n.name}, ${ek(n.to, 'dat')} imzayı attı: ${n.bed}!`,
  n => `${ek(n.from, 'abl')} ayrılan ${n.name} yeni adresini buldu: ${n.to}.`,
  n => `Kulis ajansından imza hamlesi: ${n.name}, ${ek(n.to, 'dat')} transfer oldu.`,
  n => `Kulislerde konuşulan oldu: ${n.name} ${ek(n.to, 'dat')} gidiyor (${n.bed}).`,
  n => `${n.name} için sürpriz son: ${ek(n.from, 'abl')} ${n.to} yolu!`,
  n => `İmza töreni tamam: ${n.name} artık ${ek(n.to, 'gen')} oyuncusu.`,
  n => `${ek(n.from, 'gen')} gözdesi ${n.name} ${ek(n.to, 'dat')} uçtu; masadaki rakam: ${n.fee || 'sıfır'}.`);
def('transferAI',
  n => `${n.name}, ${ek(n.from, 'abl')} ${ek(n.to, 'dat')} transfer oldu (${n.bed}).`,
  n => `Bomba transfer! ${n.to}, ${n.name} ile anlaştı.`,
  n => `${n.to} kulübü ${ek(n.name, 'gen')} transferini resmen duyurdu.`,
  n => `Transfer döneminde bir imza daha: ${n.name} → ${n.to}.`,
  n => `${ek(n.from, 'gen')} yıldızı ${n.name} bavulunu topladı: yeni adresi ${n.to}.`,
  n => `${n.to} cebi açtı: ${n.name} için ${n.bed} anlaşma sağlandı.`,
  n => `Sürpriz hamle! ${n.name} artık ${ek(n.to, 'gen')} formasını giyecek.`);
def('transferRival',
  n => `${n.agency} cephesinde transfer: ${n.name} ${ek(n.to, 'dat')} imza attı.`,
  n => `${n.agency} yine yaptı! ${n.name} ${ek(n.to, 'gen')} yeni transferi oldu.`,
  n => `Rakip ajans sahada: ${n.name} → ${n.to}. ${n.bed[0].toUpperCase()}${n.bed.slice(1)} el sıkışıldı.`,
  n => `${n.name} için ${n.agency} kolları sıvadı: ${ek(n.to, 'dat')} gidiyor.`,
  n => `Menajerlik savaşında rakip puan aldı: ${n.name}, ${ek(n.to, 'dat')} geçti.`,
  n => `${ek(n.agency, 'gen')} dosyası kapandı: ${n.name} yeni takımında.`);
def('rivalSign',
  n => `${n.agency}, ${n.name} ile anlaştı; genç yetenek kaçtı!`,
  n => `Rakip ajans ${n.agency} yeni cevherini buldu: ${n.name}.`,
  n => `${ek(n.name, 'acc')} ${n.agency} kaptı! Beklemeyenler kaybetti.`,
  n => `Menajerlik savaşı kızışıyor: ${n.agency}, ${n.name} için imzayı aldı.`,
  n => `Kulislerde ${n.agency} dönemi: ${n.name} artık onların oyuncusu.`,
  n => `Yeni müşteri: ${n.name} da ${ek(n.agency, 'gen')} listesine eklendi.`);
def('dreamFulfilled',
  n => `Hayal gerçek oldu: ${n.name} sonunda istediğine kavuştu!`,
  n => `${n.name} gözyaşlarını tutamadı: yıllardır beklediği hayal gerçek oldu.`,
  n => `"Çocukluk hayalimdi" diyen ${n.name}, hedefine ulaştı.`,
  n => `Futbolda masal gibi bir an: ${ek(n.name, 'gen')} hayali gerçekleşti.`,
  n => `${n.name} mutluluktan uçuyor: hayal kuruldu, gerçek oldu.`,
  n => `Menajerin gururu: ${n.name} hayaline ulaştı.`);
def('promiseKept',
  n => `Söz verildi, söz tutuldu: ${ek(n.name, 'gen')} menajeri çizgisini bozmadı.`,
  n => `${n.name} memnun: menajeri sözünü tuttu.`,
  n => `Kulislerde güven artıyor: ${n.name} için verilen söz yerine geldi.`,
  n => `"Sözünün adamı" lafı ${ek(n.name, 'gen')} menajeri için söylenir oldu.`,
  n => `${n.name}: "Menajerim dediğini yaptı. Bu sektörde ender bir şey."`,
  n => `Futbol dünyası konuşuyor: ${ek(n.name, 'gen')} menajeri sözünü tuttu.`);
def('promiseBroken',
  n => `Verilen söz havada kaldı: ${n.name} menajerinden memnun değil.`,
  n => `${n.name} isyanda: "Bana söz vermişlerdi!"`,
  n => `Kulis çalkalanıyor: ${ek(n.name, 'gen')} menajeri sözünü tutamadı.`,
  n => `Güven sarsıldı: ${n.name} sessizliğini bozdu.`,
  n => `"Söz uçar" diye boşuna dememişler: ${n.name} hayal kırıklığında.`,
  n => `${ek(n.name, 'gen')} sabrı taştı: sözler tutulmayınca bağ da gevşiyor.`);
def('champion',
  n => `${n.club} ${n.league} şampiyonu oldu!`,
  n => `Şampiyon belli: ${n.club}! ${n.league} kupası ${ek(n.club, 'dat')} gitti.`,
  n => `${ek(n.league, 'gen')} zirvesinde bayram: şampiyon ${n.club}!`,
  n => `Kupayı ${n.club} kaldırdı: ${n.league} sezonu ${ek(n.club, 'dat')} güldü.`,
  n => `${n.club} sezona damga vurdu ve şampiyonluğunu ilan etti (${n.league}).`,
  n => `Taraftar sokaklarda: ${n.club}, ${n.league} şampiyonu!`);
def('promoted',
  n => `${n.club} ${n.league} bileti aldı!`,
  n => `Yükseliş zamanı: ${n.club}, ${n.league} yolcusu.`,
  n => `${ek(n.league, 'dat')} çıkış: ${n.club} büyüklerin arasında.`,
  n => `Sezonun sürprizi ${n.club}: ${n.league} kapısı açıldı.`,
  n => `${n.club} yeni sezonda ${n.league} kadrosunda; kutlamalar sürüyor.`,
  n => `Büyük başarı! ${n.club}, ${ek(n.league, 'dat')} yükseldi.`);
def('relegated',
  n => `${n.club} ${ek(n.league, 'dat')} düştü; taraftar yasta.`,
  n => `Acı veda: ${n.club} üst lige elveda dedi, yeni adres ${n.league}.`,
  n => `${n.club} için sezon hüzünle bitti: ${n.league} yolu göründü.`,
  n => `Kara gün: ${n.club} küme düştü, ${n.league} kapıda.`,
  n => `${n.club} taraftarı hüzünlü: ${n.league} sürgünü başlıyor.`,
  n => `Düşenlerin acısı: ${n.club} ${n.league} ekibi oldu.`);
def('award',
  n => `${n.name}, ${n.award} ödülünün sahibi oldu.`,
  n => `Ödül töreninde gecenin adamı: ${n.name} (${n.award}).`,
  n => `${n.award} ${ek(n.name, 'dat')} gitti.`,
  n => `Alkışlar ${ek(n.name, 'dat')}: ${n.award} onun oldu.`,
  n => `${n.name} ${n.award} ile sezona noktayı koydu.`,
  n => `Resmen açıklandı: ${n.award} ${ek(n.name, 'gen')} oldu.`);
def('injury',
  n => `${n.name} sakatlandı: ${n.dur} yok.`,
  n => `Kötü haber: ${n.name} sahalardan ${n.dur} uzak kalacak.`,
  n => `Sağlık raporu geldi: ${n.name} ${n.dur} oynayamayacak.`,
  n => `Acı tablo! ${n.name} sedyeyle çıktı, ${n.dur} yok.`,
  n => `Doktorlar konuştu: ${n.name} için ${n.dur} tedavi süreci.`,
  n => `${n.name} topa vuramıyor: sakatlık nedeniyle ${n.dur} yok.`);
def('bankruptcyWarning',
  () => `Banka kapıda: ajansın kasası alarm veriyor.`,
  () => `Kulislerde iflas fısıltıları: nakit akışı daralıyor.`,
  () => `Kırmızı alarm! Ajansın hesabı ekside, defterler çalkalanıyor.`,
  () => `Para bitiyor, borçlar yükseliyor: menajerlik ofisi zor günlerde.`,
  () => `"Bu gidişle kepenk kapanır" diyorlar: ajans iflasın eşiğinde.`,
  () => `Alacaklılar sıraya girdi: menajerlik dünyasında büyük endişe.`);
def('wonderkidBreakout',
  n => `${n.name} patladı! Genç yetenek herkesi şaşırttı.`,
  n => `Yeni bir yıldız doğuyor: ${n.name} adını ezberleyin.`,
  n => `${n.name} fırtına gibi: kulüpler kapısında sıraya girdi.`,
  n => `Futbolun parlayan ismi ${n.name}${n.goals ? ': ' + n.goals + ' golle ligi salladı' : ': ligi salladı'}.`,
  n => `Menajerlerin yeni gözdesi ${n.name}: Avrupa izliyor.`,
  n => `"Bu çocuk bir başka" diyorlar: ${n.name} gündemi sarstı.`);
def('deadlineDrama',
  n => `Son Gün'de olaylı saatler: ${n.name} dosyası nefes kesti.`,
  n => `Saat ilerledi, telefonlar kızıştı: ${n.name} için son dakika pazarlığı!`,
  n => `Kapanışa dakikalar kala ${n.name} hamlesi gündemi altüst etti.`,
  n => `Menajerler ofisten çıkmadı: ${n.name} için gece yarısı mesaisi.`,
  n => `Transfer döneminin son saatleri: ${n.name} için tansiyon yüksek.`,
  n => `Son Gün, son saat, son hamle: ${n.name} sahnede.`);
def('objectiveDone',
  n => `Hedef tamam: ${n.objective}.`,
  n => `Sözünü tuttu: "${n.objective}" hedefi başarıyla tamamlandı.`,
  n => `Ajans cephesinde sevinç: ${n.objective} gerçekleşti.`,
  n => `Defter kapandı, hedef vuruldu: ${n.objective}.`,
  n => `Kulislerde alkış: "${n.objective}" artık geçmişte kaldı.`,
  n => `Sezonun hedeflerinden biri daha tamam: ${n.objective}.`);
def('retire',
  n => `${n.name} futbola veda etti.`,
  n => `Bir devir kapandı: ${n.name} kramponlarını astı.`,
  n => `${n.name} gözyaşlarıyla veda etti; kramponlar çivide.`,
  n => `Sahalara elveda: ${n.name} emekli oldu.`,
  n => `${ek(n.name, 'gen')} kariyeri sona erdi, alkışlar eşliğinde.`,
  n => `Futbol bir efsanesini uğurluyor: ${n.name} bıraktı.`);
def('topscorer',
  n => `${n.name} ${n.league} gol kralı oldu (${n.goals} gol).`,
  n => `Gol krallığı ${ek(n.name, 'dat')} gitti: ${n.goals} golle zirve.`,
  n => `${n.league} sezonunun en golcüsü ${n.name}: ${n.goals} gol!`,
  n => `Ağları sallayan adam: ${n.name}, ${n.goals} golle taç giydi.`,
  n => `${n.name}, ${n.goals} golle gol krallığını kimseye bırakmadı.`,
  n => `Kral belli: ${n.name} (${n.goals} gol) ${n.league} tarihine yazıldı.`);
V.genel = [c => c.text || 'Futbol dünyasından haberler.'];

const ALIAS = { transfer: 'transferAI', transferYours: 'transferYou', transferAi: 'transferAI', promotion: 'promoted', relegation: 'relegated', rivalSigned: 'rivalSign', promise_kept: 'promiseKept', promise_broken: 'promiseBroken' };

/** All kinds that have ≥ 6 variants (the test checks this). */
export const NEWS_KINDS = Object.keys(V).filter(k => k !== 'genel');
/** @type {Record<string, Array<(ctx:object)=>string>>} */
export const NEWS_TEMPLATES = V;

/**
 * Headline for a kind. kind 'transfer' dispatches on ctx.side ('you'|'ai'|'rival'; default 'ai').
 * @param {string} kind @param {object} ctx @returns {string}
 */
export function newsText(kind, ctx) {
  ctx = ctx || {};
  let k = kind;
  if (k === 'transfer') k = ctx.side === 'you' || ctx.yours ? 'transferYou' : ctx.side === 'rival' ? 'transferRival' : 'transferAI';
  k = ALIAS[k] || k;
  const list = V[k] || V.genel;
  if (k === 'genel') return list[0](ctx);
  const key = k + '|' + (ctx.name || ctx.player || '') + '|' + (ctx.club || ctx.to || '') + '|' + (ctx.from || '') + '|' + (ctx.league || '') + '|' + (ctx.agency || ctx.rival || '') + '|' + (ctx.objective || ctx.text || '') + '|' + (ctx.n || 0);
  return hpick(list, key)(ctx);
}
