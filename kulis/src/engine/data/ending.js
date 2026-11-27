// Ending texts: the title/summary per ending kind and the per-client epilogue variants. Placeholders: see ending.js.

export const ENDING_TITLES = {
  efsane: 'Efsane Menajer',
  buyuk: 'Büyük Menajer',
  saygin: 'Saygın Bir İsim',
  siradan: 'Sıradan Bir Kariyer',
  iflas: 'Kepenk Kapandı',
  yalniz: 'Yalnız Ajans',
};

export const ENDING_TEXTS = {
  efsane: [
    '{agency}, {seasons} sezonun sonunda sektörün zirvesinde. Kulüp başkanları seni bekletmiyor, oyuncular imza için sıraya giriyor. {agent} artık bir marka.',
    'Kulis kapılarında artık yalnızca senin adın geçiyor: {commission} komisyon, {deals} transfer. {agent} efsane oldu.',
    'Rakip ajanslar rakip olmaktan çıktı, senden ders almaya başladı. {agency:gen} tarihi artık {agent} diye yazılıyor.',
  ],
  buyuk: [
    '{seasons} sezon sonra {agency} piyasanın en büyük isimlerinden. Zirve bir adım ötede kaldı, ama masalar senin sözünle kuruluyor.',
    '{agent}, sahaya hiç çıkmadan futbolun en çok konuşulan adlarından biri oldu. {commission} komisyon ve {deals} transferle büyük bir miras bıraktın.',
    'Kulislerde senin için "bu iş bu kadar iyi yapılır" diyorlar. Birincilik kaçtı, ama saygı yerli yerinde.',
  ],
  saygin: [
    '{agency}, {seasons} sezonu saygın biçimde tamamladı. Büyük hikâyeler yazmadın belki, ama imzan güven veriyor.',
    '{agent}, oyuncusunu dinleyen, sahaya değer katan bir menajer olarak anılıyor. Kasa sağlam, isim temiz.',
    'Zirveyi göremedin ama kimse seni küçümsemiyor. {deals} transfer: sağlam bir iş çıkardın.',
  ],
  siradan: [
    '{seasons} sezon bitti. {agency} ayakta kaldı, ama kulis hafızası kısa; çok geçmeden başka isimler konuşulacak.',
    'Ne büyük bir başarı, ne büyük bir felaket. {agent} futbolun kalabalığında kaybolan bir isim olmayı seçmedi, ama öyle oldu.',
    'Bir menajerin işi bu: bazen kazanırsın, bazen unutulursun. Yeni bir sayfa açmak için hiç geç değil.',
  ],
  iflas: [
    'Kasa sıfırın altına indi ve bankalar kapıyı kapattı. {agency} kepenk indirdi. Kulis seni unutmayacak; ders çıkarıp çıkarmamak sana kalmış.',
    'Defterler kapandı, alacaklılar sıraya girdi. {agent}, bu işte para sadece kazanmak değil, tutmak demekmiş.',
    '{seasons}. sezonu göremeden ofisin anahtarını teslim ettin. Müşterilerin başka kapılara yöneldi; bir sonraki sefer kasayı da kolla.',
  ],
  yalniz: [
    'Son müşterin de gitti. Ofiste telefon susuyor, duvarda eski formalar asılı. {agent}, bir sonraki hikâyeye hazırlan.',
    'Müşterisiz bir ajans, sadece bir tabeladır. {agency} sessizliğe gömüldü; ama kulis her zaman yeni bir yüzü bekler.',
    'Bir menajerin en büyük sermayesi insanlar. Sen onları kaybettin; şimdi sıfırdan başlamak zorundasın.',
  ],
};

export const EPILOGUES = {
  good: [
    '{name} zirveye {peak} gücüyle çıktı; her başarının ardından sana teşekkür etti.',
    '{club} formasıyla efsane olmaya çok yaklaştı {name}. Yanında hep aynı menajer vardı: sen.',
    '{name} bugün genç oyunculara senin adını öğütlüyor: "Beni dinleyen menajer."',
    'Tribünlerde {name} sloganları, cebinde senin numaran. Yıllar sonra bile her bayramda arıyor.',
    '{name}, kariyerinin en güzel yıllarını seninle geçirdi: {peak} güce ulaştı, hiç pişmanlığı yok.',
  ],
  neutral: [
    '{name} kariyerini {club} formasıyla sürdürdü. Ne büyük bir hikâye ne de bir pişmanlık; futbol da böyle bir şey.',
    '{name} ile yollar ayrılmadı, ama çok da kesişmedi. Arada bir mesaj atıyor, bayramda arıyor.',
    '{name:gen} kariyeri ortalama bir çizgide ilerledi: {peak} güce ulaştı, sonra yerini buldu.',
    'Sahada {name} işini yaptı, kulüpler gelip geçti. Sana düşen doğru zamanda doğru imzayı atmaktı; çoğu zaman bunu yaptın.',
    '{name}, kariyerini sakin bir limanda bitirmeyi seçti; belki de en akıllıcası buydu.',
  ],
  bitter: [
    '{name} seni anlatırken sesi sertleşiyor: "Beni hiç dinlemedi." Bir daha aranmadınız.',
    '{name}, başka bir ajansla yoluna devam etti ve adını anmaktan kaçınıyor.',
    '{name} için son telefon konuşması soğuktu. Kariyer bitti, defter kapandı; ama içindeki kırgınlık kaldı.',
    '{name}, yıllar sonra bir televizyon programında "doğru menajeri bulamadım" dedi. Kimi kastettiğini herkes anladı.',
    '{name} istediği kariyeri yapamadı ve suçlu aramakta zorlanmadı: ilk sırada senin adın vardı.',
  ],
};

export const TAIL = {
  retired: ' Kramponlarını astığında ilk aradığı sen oldun.',
  left: '',
};
