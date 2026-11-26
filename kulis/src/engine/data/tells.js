// Director tells and table lines. TELLS[persona][level 0..4] = {face, lines[≥3]}.
// Level by the gap between your package and the director's ceiling: 0 ≤5%, 1 ≤12%, 2 ≤22%, 3 ≤35%, 4 >35%.
// Faces: 'smile' | 'neutral' | 'frown' | 'angry' | 'stand'. No placeholders: every line is ready to print.

export const TELL_FACES = ['smile', 'neutral', 'frown', 'angry', 'stand'];
export const PERSONA_IDS = ['durust', 'kurnaz', 'cimri', 'sabirsiz', 'gosterisci'];

const F = TELL_FACES;
const lv = (face, lines) => ({ face, lines });

export const TELLS = {
  durust: [
    lv(F[0], ['Çok yaklaştın. Bir tık daha ve işi bağlarız.', 'Rakamların makul, neredeyse oradayız.', 'İyi teklif. Küçük bir ayrıntı kaldı, o kadar.', 'Dürüst olayım: buna sıcak bakıyorum.']),
    lv(F[1], ['Fena değil ama biraz yukarıdasın.', 'Bütçemin sınırına yakın. Birkaç kalemi kısman lazım.', 'Konuşulur, ama bu haliyle değil.', 'Mesafe var ama kapanmayacak kadar değil.']),
    lv(F[2], ['Hayır, bu fazla. Bütçeyi biliyorsun.', 'Bu rakamı yönetim kuruluna götüremem.', 'Epey yukarıdasın; ciddi bir indirim lazım.', 'Bu paraya ikinci bir oyuncu alırım.']),
    lv(F[3], ['Bu teklif saygısızlık sınırında.', 'Ciddi misin? Kasada bu para yok.', 'Aramızdaki mesafe çok büyük; zaman kaybediyoruz.', 'Böyle devam edersek masadan kalkarım.']),
    lv(F[4], ['Bu kadar yeter. Ayağa kalktım, toplantı bitmek üzere.', 'Böyle bir rakamla masaya oturulmaz.', 'Vaktimi çalıyorsun. Ciddi bir teklifle gel.', 'Bunu duymamış sayıyorum.']),
  ],
  kurnaz: [
    lv(F[0], ['Hımm... çok yakın, ama yine de iç çekeyim. Ah ah.', 'Tatlı konuşuyorsun; az kaldı, bakalım ne kadar zorlarsın.', 'Gülümsüyorum ama sakın bunu zayıflık sanma.', 'Güzel, güzel... Ama ben hâlâ pazarlığın başındayım.']),
    lv(F[1], ['Ah, ah... bu rakamla bana zor bir gece yaşatacaksın.', 'Yönetim kurulu asıl bu paraya kızar, biliyorsun.', 'Yakın sayılır, ama benden öyle kolay ödün çıkmaz.', 'Bir de şu kalemlere baksak; gözüme batıyorlar.']),
    lv(F[2], ['Vallahi canımı sıkıyorsun. Bu fazla fazla.', 'Başkanı arasam çıldırır; sen yine de dene.', 'Gözlerim doldu... bu rakamı görünce.', 'Ben seni daha akıllı biliyordum.']),
    lv(F[3], ['Sen bizi kumbara mı sandın?', 'Bu kadarı artık şaka! Sakin kalmaya çalışıyorum.', 'Bu rakamı duyunca masadaki kahve soğudu.', 'Bana bunu söyleyen son kişi odadan hâlâ çıkamadı.']),
    lv(F[4], ['Yetti! Kapı orada, tarifini yapayım mı?', 'Böyle teklif olmaz, ben kalkıyorum.', 'Bir daha bu odada bu rakamı anma bile.', 'Şaka yapıyorsun, değil mi? Değil. O halde hoşça kal.']),
  ],
  cimri: [
    lv(F[0], ['Yaklaştın... ama kuruşlar da para, biliyorsun.', 'Şunu biraz daha yuvarlasak? Bir iki kuruş meselesi.', 'Neredeyse tamam. Şu bonus kalemini silersek.', 'Hesap tutmaya başladı; azıcık daha.']),
    lv(F[1], ['Kasa kasa... bu parayı ben bir yılda harcamam.', 'Bunun yarısını kendi cebimden vermiş gibi hissediyorum.', 'Biraz daha hesaplı bir şey düşünebilir misin?', 'Muhasebeci bunu görse yüzünü buruşturur.']),
    lv(F[2], ['Bu para ağaçta yetişmiyor!', 'Maaş listesini görsen ağlarsın, tamam mı?', 'Her kuruşu sayıyorum; bu hesap tutmuyor.', 'Bu rakamla bir sezon kömür alırım!']),
    lv(F[3], ['Yazık, yazık... bu para kasamı boşaltır.', 'Biz burada hayır kurumu değiliz!', 'Bu rakam yüzünden iki gece uyuyamam.', 'Cüzdanım titriyor, hayır diyor.']),
    lv(F[4], ['Hayır! Hayır! Bu rakamla kapıdan bile geçemezsin.', 'Cüzdanımı kapatıyorum, görüşmek üzere.', 'Böyle bir teklife cevap vermek bile zarar.', 'Çay parasını bile bu hesaptan çıkarırım, git.']),
  ],
  sabirsiz: [
    lv(F[0], ['Tamam, tamam, hadi bitirelim şunu!', 'Neredeyse oldu; bir cevap ver, vaktim yok.', 'Güzel, güzel. Hızlıca kapatalım.', 'Evet, bu iş yürür. Evet de çıkalım.']),
    lv(F[1], ['Hadi ama, bir sonraki toplantıya geç kalıyorum.', 'Biraz daha yaklaş, bekleyecek vaktim yok.', 'Fazla uzatma, rakamı düzelt.', 'Yakınız; ama saniyeler akıyor.']),
    lv(F[2], ['Saate bakıyorum, saate! Bu halde olmaz.', 'Beni oyalama, bu teklif olmaz.', 'Çabuk ol, ciddi bir rakam bekliyorum.', 'Her dakika para, sen de biliyorsun.']),
    lv(F[3], ['Yeter artık, dakikalardır aynı yerdeyiz!', 'Telefon çalıyor; başka ajanlarla da görüşeceğim.', 'Sabrımı taşırıyorsun!', 'Bu kadar konuşmaya değmez, hâlâ aynı rakam.']),
    lv(F[4], ['Bitti! Ben gidiyorum, asistanım çıkışı gösterir.', 'Böyle teklifle vaktimi harcayamam.', 'Kalktım bile, yarın ararsan dinlerim.', 'Ciddiyet yok, sabır da yok. İyi günler.']),
  ],
  gosterisci: [
    lv(F[0], ['Güzel teklif! Tam bir vitrin oyuncusuna yaraşır.', 'Hoşuma gitti; markamıza yakışır bir rakam.', 'Neredeyse hazırız; imza töreni için basın bile bekliyor.', 'Işıklar yanıyor, son bir cilâ kaldı.']),
    lv(F[1], ['Hımm, yıldız bir oyuncuya biraz mütevazı kalmış.', 'Taraftar bu rakamı duysa dalga geçer.', 'Bir tık daha parlaklık lazım.', 'Fotoğraf çekilecek bir sayı değil bu.']),
    lv(F[2], ['Bu isim için bu rakam mı? Manşet olmaz.', 'Lüks mağazada indirim yapmam ki!', 'Biraz daha cesaret, biraz daha şov istiyorum.', 'Kulüp vitrinine bu etiketi asamam.']),
    lv(F[3], ['Bunu duysam afişe asarlar, yazıklar olsun!', 'Kulübümün adını küçültüyorsun.', 'Benim vitrinime bu teklifle bakamazsın.', 'Bu rakam sahnede bile alkış almaz.']),
    lv(F[4], ['Rezalet! Fotoğrafçıları çağırmadan çık odadan.', 'Bu rakamı duyunca kravatım bile yamuldu.', 'Sahneyi terk ediyorum, perde kapandı.', 'Bu bir teklif değil, bir hakaret turu.']),
  ],
};

/**
 * Director face + line for a tell level. Deterministic for (persona, level, n): `n` is the round (or any counter).
 * @param {string} persona durust|kurnaz|cimri|sabirsiz|gosterisci (unknown → durust)
 * @param {number} level 0..4
 * @param {number} [n=0]
 * @returns {{face:string, line:string}}
 */
export function tellLine(persona, level, n = 0) {
  const P = TELLS[persona] || TELLS.durust;
  const t = P[Math.max(0, Math.min(4, Math.round(level) || 0))];
  const i = Math.abs(Math.round(n) || 0) % t.lines.length;
  return { face: t.face, line: t.lines[i] };
}

// ---- table events (every persona ≥ 3 variants) ----
export const ACCEPT = {
  durust: ['Anlaştık. Elini sıkıyorum.', 'Bu rakam bana uyar. Evraka geçelim.', 'Tamamdır, imzayı atalım.'],
  kurnaz: ['Peki, peki... zor ikna ettin ama anlaştık.', 'İç çekerek imzalıyorum; kaybeden ben oldum sanırım.', 'Tamam, ama bunu duyan olursa inkâr ederim.'],
  cimri: ['Pekâlâ... bir kez olsun cüzdanımı açıyorum.', 'Bu fiyata imza atarım ama içim acıyor.', 'Tamam, anlaştık; kalemi bana ver, kendi kalemim bitti.'],
  sabirsiz: ['Süper, anlaştık! Evrakları getirin!', 'Hah, işte bu! İmza nerede?', 'Tamam, tamam, kapatıyoruz. Bir sonraki iş!'],
  gosterisci: ['Mükemmel! Basın toplantısını hemen ayarlıyorum.', 'Bu kulübün vitrinine yakışır. Anlaştık!', 'Fotoğrafçılar! İmza zamanı!'],
};
export const COUNTER = {
  durust: ['Benim önerim şu. Bundan fazlasını veremem.', 'Bu paketle yürüyebiliriz; bakalım.', 'Gerçekçi olalım: işte benim tarafım.'],
  kurnaz: ['Sana bir iyilik yapıyorum, şu paketi düşün.', 'Bu paketi kimseye göstermem ama sana gösteriyorum.', 'Gel, ortada buluşalım: ama ortası bana daha yakın.'],
  cimri: ['Şu paketi dene; her kalemini kontrol ettim.', 'Bana düşen bu kadar. Ne bir kuruş eksik, ne fazla.', 'Bütçeye en az zarar veren seçenek bu.'],
  sabirsiz: ['Hızlı çözelim: bu paket, evet ya da hayır.', 'İşte teklifim. Uzun uzun düşünme.', 'Şunu kabul et, kahvemizi içelim.'],
  gosterisci: ['Şöyle bir paket hazırladım: hem şık hem akılcı.', 'Bu rakamı basına yedirebilirim; ona göre.', 'İşte vitrinlik teklifim.'],
};
export const INSULT = {
  durust: ['Bu rakam bir hakaret. Daha ciddi bir şey getir.', 'Böyle bir teklif masaya konmaz.', 'Bunu duymamış sayacağım, ama sabrım azaldı.'],
  kurnaz: ['Sen şaka yapıyorsun, değil mi? Çünkü gülemiyorum.', 'Bu mu teklif? Torunum bile daha iyisini ister.', 'Ah, ah, ah... Sabrım ve mizah anlayışım tükendi.'],
  cimri: ['Bu paraya bir koltuk bile alamam ki!', 'Sen kasamı yağmalamaya mı geldin?', 'Bu teklifle benim tuvalet fayansım bile alınmaz.'],
  sabirsiz: ['Vaktimi çalıyorsun! Çabuk, ciddi bir şey söyle!', 'Bu rakamı söylerken saniyelerimi çaldın!', 'Dalga mı geçiyorsun? Çıkışı biliyorsun.'],
  gosterisci: ['Bu teklifle benim kulübümün adını anma bile.', 'Kameralar kapalıyken söylüyorum: utanç verici.', 'Bu bir teklif mi, yoksa başka bir masa mı arıyorsun?'],
};
export const WALKOUT = {
  durust: ['Konuşacak bir şey kalmadı. Hoşça kal.', 'Burada bitiyor. Başka bir zaman, başka bir rakamla.', 'Sabrım tükendi. Kapıyı kapatırken yavaş ol.'],
  kurnaz: ['Anladım. Bu kez kazanan olmayacak. İyi günler.', 'Peki... Seni kapıya kadar uğurlamayacağım.', 'Hayat uzun, futbol küçük. Görüşürüz.'],
  cimri: ['Daha fazla boşa para harcayamam, kalkıyorum.', 'Çayın parası bende, çık bakalım.', 'Bu kadar uzattık, bir kuruş eksik kalmadı. Ama bitti.'],
  sabirsiz: ['Yeter! Toplantı bitti!', 'Ben gidiyorum, kalanını asistanım halleder.', 'Zamanım doldu, bir daha ararsan yarın.'],
  gosterisci: ['Perde kapandı. Herkese iyi geceler.', 'Böyle bir performansla sahneye çıkılmaz.', 'Basına açıklamam hazır: görüşme sona erdi.'],
};
export const BLUFF_CAUGHT = {
  durust: ['Başka teklif yok. Biliyorum. Bunu bir daha yapma.', 'Yalan söyledin. Güvenim sarsıldı.', 'Dürüst olmayı seviyorum; sen sevmiyorsun galiba.'],
  kurnaz: ['Ah, ah, ah... Beni kandırmaya çalışmak ne cesaret!', 'Ben bu oyunu sen doğmadan oynuyorum, evlat.', 'Güzel numaraydı ama bana değil.'],
  cimri: ['Rakip teklif mi? Hesabını yaptım, yok öyle bir şey.', 'Yalan söyleyene kuruş vermem.', 'Beni kandırmak için biraz daha uğraşman lazım.'],
  sabirsiz: ['Yalan! Zamanımı yalanla harcama!', 'Anlıyorum, kandırmaya çalışıyorsun. Yeter!', 'Başka teklif yok, biliyorum. Sabrım bitti.'],
  gosterisci: ['Başka kulüp mü? Telefon bana çalar, sana değil.', 'Bu yalan bile gösterişsiz kalmış.', 'Basına çıkarsam bir manşet olur: yalancı menajer.'],
};
export const BLUFF_WORKED = {
  durust: ['Başka kulüp mü var? O zaman rakamı gözden geçirmem lazım.', 'Hmm, ciddiye alıyorum. Sana biraz daha esneyeyim.', 'Rakip olduğunu bilmiyordum. İşi uzatmayalım.'],
  kurnaz: ['Başka teklif mi? ...İnandım, ama gözümü senden ayırmayacağım.', 'Yoksa gerçekten rakip mi var? İç çekiyorum.', 'Peki, peki, bir adım atıyorum; bunu sakla.'],
  cimri: ['Başkası mı alacakmış? Eyvah! Kasamı biraz açayım o zaman.', 'Rakibe vermem şu parayı; sana vereyim.', 'Hesaplarımı yeniden yapmam lazım.'],
  sabirsiz: ['Rakip mi? Hadi hızlı! Rakamı güncelle!', 'Bekle bekle, başkası mı kapacak? Tamam, yaklaşalım.', 'Sana vaktim yok ama onlara hiç yok. Anlaş artık.'],
  gosterisci: ['Başka bir kulüp mü? Asla! Onlara göstermeyelim!', 'Bu oyuncuyu başkası mı giyecek forma? Hayır!', 'Rekabet hoşuma gider; rakamı yükseltiyorum.'],
};
export const LINES = { accept: ACCEPT, counter: COUNTER, insult: INSULT, walkout: WALKOUT, bluffCaught: BLUFF_CAUGHT, bluffWorked: BLUFF_WORKED };

/**
 * A table line for a persona. kind: accept | counter | insult | walkout | bluffCaught | bluffWorked.
 * Deterministic for (persona, kind, n).
 * @returns {string}
 */
export function directorLine(persona, kind, n = 0) {
  const set = LINES[kind] || LINES.counter;
  const arr = set[persona] || set.durust;
  return arr[Math.abs(Math.round(n) || 0) % arr.length];
}
