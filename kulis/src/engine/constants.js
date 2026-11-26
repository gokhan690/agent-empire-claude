// All balance numbers and static labels. Turkish display strings live here / in data/.

export const LEAGUE_DEFS = [
  { id: 'tr2', name: '1. Lig', country: 'Türkiye', prestige: 1, nat: 'TR' },
  { id: 'tr1', name: 'Süper Lig', country: 'Türkiye', prestige: 2, nat: 'TR' },
  { id: 'nl1', name: 'Hollanda Ligi', country: 'Hollanda', prestige: 3, nat: 'NL' },
  { id: 'it1', name: 'İtalya Ligi', country: 'İtalya', prestige: 4, nat: 'IT' },
  { id: 'es1', name: 'İspanya Ligi', country: 'İspanya', prestige: 5, nat: 'ES' },
  { id: 'en1', name: 'İngiltere Ligi', country: 'İngiltere', prestige: 5, nat: 'EN' },
];

/** Month table. `deadline`: Son Gün is played at the end of this month. */
export const MONTHS = [
  { name: 'Temmuz', short: 'Tem', window: true, matchdays: 0, deadline: false },
  { name: 'Ağustos', short: 'Ağu', window: true, matchdays: 2, deadline: true },
  { name: 'Eylül', short: 'Eyl', window: false, matchdays: 2, deadline: false },
  { name: 'Ekim', short: 'Eki', window: false, matchdays: 2, deadline: false },
  { name: 'Kasım', short: 'Kas', window: false, matchdays: 2, deadline: false },
  { name: 'Aralık', short: 'Ara', window: false, matchdays: 2, deadline: false },
  { name: 'Ocak', short: 'Oca', window: true, matchdays: 1, deadline: true },
  { name: 'Şubat', short: 'Şub', window: false, matchdays: 2, deadline: false },
  { name: 'Mart', short: 'Mar', window: false, matchdays: 2, deadline: false },
  { name: 'Nisan', short: 'Nis', window: false, matchdays: 2, deadline: false },
  { name: 'Mayıs', short: 'May', window: false, matchdays: 1, deadline: false },
  { name: 'Haziran', short: 'Haz', window: false, matchdays: 0, deadline: false },
];

/** Position lines. `slots` = starters in the 1-4-4-2. */
export const POS = {
  KL: { label: 'Kaleci', short: 'KL', slots: 1 },
  DF: { label: 'Defans', short: 'DF', slots: 4 },
  OS: { label: 'Orta Saha', short: 'OS', slots: 4 },
  FV: { label: 'Forvet', short: 'FV', slots: 2 },
};
export const POS_ORDER = ['KL', 'DF', 'OS', 'FV'];

export const TRAITS = {
  hirsli: { label: 'Hırslı', desc: 'Büyük kulüpler ister, yedek kalmaktan nefret eder.' },
  sadik: { label: 'Sadık', desc: 'Bağlılığı yavaş azalır, taşınmayı sevmez.' },
  paraci: { label: 'Paracı', desc: 'Onun için en önemlisi maaş.' },
  ailebabasi: { label: 'Aile Babası', desc: 'İstikrar ve memleket ister.' },
  yildiz: { label: 'Yıldız Adayı', desc: 'Şöhreti sever, morali kırılgandır.' },
  profesyonel: { label: 'Profesyonel', desc: 'Dengeli, istikrarlı, iyi gelişir.' },
};

export const DREAMS = {
  top_league: { label: 'Büyük Lig', text: 'Avrupa\'nın en büyük liglerinden birinde oynamak istiyor.' },
  big_wage: { label: 'Büyük Maaş', text: 'Ayda {target} € maaş almak istiyor.' },
  champion: { label: 'Şampiyonluk', text: 'Bir lig şampiyonluğu yaşamak istiyor.' },
  star: { label: 'Yıldız Olmak', text: 'Güç 85\'e ulaşıp yıldız olmak istiyor.' },
  hometown: { label: 'Memleket', text: 'Bir Türk kulübünde 3 sezon ilk 11\'de oynamak istiyor.' },
};

/** Club director personas (labels only; numbers in BAL.persona). */
export const PERSONAS = {
  durust: { label: 'Dürüst', desc: 'Sözü ve yüzü aynıdır; tepkileri gerçeği yansıtır.' },
  kurnaz: { label: 'Kurnaz', desc: 'Tepkisini olduğundan sert gösterir.' },
  cimri: { label: 'Cimri', desc: 'Kasası dardır ama sabırlıdır.' },
  sabirsiz: { label: 'Sabırsız', desc: 'Hızlı karar verir, cömert ama sabırsızdır.' },
  gosterisci: { label: 'Gösterişçi', desc: 'Şöhretli oyunculara fazla öder.' },
};

/** Rival agency personas. */
export const RIVAL_PERSONAS = {
  kopekbaligi: { label: 'Köpekbalığı', desc: 'Mutsuz müşterilerini kapar.' },
  akademisyen: { label: 'Akademisyen', desc: 'Genç yetenekleri kapıp götürür.' },
  eskidost: { label: 'Eskidost', desc: 'Adil ve yavaştır.' },
  holding: { label: 'Holding', desc: 'Zengindir, yıldızların peşindedir.' },
};

export const ARCHETYPES = {
  mahalle: { label: 'Mahalle Abisi', desc: 'Sadakat artı, Türk gençlerini ikna etmek kolay, yanında yerel bir cevher var.' },
  eskifutbolcu: { label: 'Eski Futbolcu', desc: 'Tüm kulüplerde +15 güven, +8 itibar.' },
  hukukcu: { label: 'Hukukçu', desc: 'Masada +1 sabır, komisyon uyarı eşiği %15.' },
};

export const BAL = {
  careerSeasons: 8,
  start: { cash: 60000, rep: 12, upkeep: 4000, commissionPct: 7, gemAge: 17, gemKnow: 25, clientKnow: 70, clientLoyalty: 55, clientMorale: 65, poolShare: 0.10, poolKnow: 20 },
  energy: { base: 4, max: 6 },
  loyaltyStart: 50, moraleStart: 60,

  archetype: {
    mahalle: { loyaltyBonus: 10, gemPaBonus: 4, recruitTrYouth: 12 },
    eskifutbolcu: { trust: 15, rep: 8 },
    hukukcu: { patience: 1, feeThreshold: 0.15 },
  },
  persona: {
    durust: { k: 0, patience: 4 },
    kurnaz: { k: 0, patience: 4 },
    cimri: { k: -0.08, patience: 6 },
    sabirsiz: { k: 0.08, patience: 3 },
    gosterisci: { k: 0, patience: 4, hypeBonus: 0.12, hypeMin: 60, otherMalus: -0.03 },
    weights: { durust: 30, kurnaz: 22, cimri: 18, sabirsiz: 15, gosterisci: 15 },
  },

  strengthByPrestige: { 1: 52, 2: 62, 3: 68, 4: 76, 5: 82 },
  tierPattern: [5, 4, 4, 3, 3, 3, 2, 2, 2, 1],
  tierSpread: 3.2,
  strengthNoise: 1.2,
  leagueWageMult: { tr2: 1.0, tr1: 1.8, nl1: 2.2, it1: 3.2, es1: 4.5, en1: 5.0 },
  clubBudgetByPrestige: { 1: 1500000, 2: 6000000, 3: 12000000, 4: 35000000, 5: 90000000 },
  clubBudgetTierStep: 0.18,
  clubTrustBase: 30, clubTrustSd: 12,
  directorInfoWeights: { 0: 40, 1: 30, 2: 20, 3: 10 },
  directorChangeChance: 0.08,

  squad: {
    base: { KL: 2, DF: 6, OS: 6, FV: 4 }, // 18
    extraMin: 1, extraMax: 4, extraWeights: { DF: 2, OS: 2, FV: 1.3 },
    minByPos: { KL: 2, DF: 5, OS: 5, FV: 3 },
    targetMin: 19, targetMax: 22, min: 18, max: 22, hardMin: 16, hardMax: 24,
  },
  gen: {
    starterSd: 4, benchDrop: 8, benchSd: 3.5, youthBenchShare: 0.45, youngStarterChance: 0.08,
    starterAgeMean: 26.5, starterAgeSd: 3.5,
    ageDiscount: { 16: 17, 17: 15, 18: 12, 19: 9, 20: 7, 21: 5, 22: 3, 23: 1 },
    discountFactor: 0.6,
    gapMean: { 16: 21, 17: 20, 18: 19, 19: 15, 20: 12, 21: 9, 22: 7, 23: 5, 24: 4, 25: 3, 26: 2, 27: 1 },
    gapSdFactor: 0.55, gemChance: 0.035, gemExtra: [14, 28], paCap: 97, caMin: 22, caMax: 95,
    youthDrop: 22, youthSd: 4, youthAge: [16, 18],
    wageSpread: 0.18, contractMax: 4,
    foreignMixTR: 0.22,
  },
  rivalShare: 0.25,

  // development
  dev: {
    rate: 0.0265,
    ageFactor: { 16: 1.15, 17: 1.15, 18: 1.15, 19: 1.15, 20: 1.0, 21: 1.0, 22: 1.0, 23: 0.75, 24: 0.75, 25: 0.75, 26: 0.4, 27: 0.4, 28: 0.4 },
    growthMaxAge: 28,
    minFloor: 0.44, minSlope: 0.56, minFull: 0.8,
    facBase: 0.85, facStep: 0.05,
    moraleBase: 0.9, moraleSlope: 0.2,
    profesyonel: 1.12, profDecline: 0.75,
    noiseSd: 0.1,
    declinePerYear: { 30: 0.8, 31: 1.2, 32: 1.8, 33: 2.4, 34: 3.0, 35: 3.5 },
    shSmooth: 0.6,
    formDecay: 0.85,
    hypeStep: 0.15, hypeBase: 1.2, hypeBaseFrom: 60, hypeBaseMax: 60, hypeForm: 2,
  },
  // matches
  match: {
    goalBase: 1.30, goalK: 0.034, homeMult: 1.15, awayMult: 0.90,
    attW: { FV: 0.55, OS: 0.35, DF: 0.10 }, defW: { DF: 0.50, KL: 0.20, OS: 0.30 },
    scorerW: { FV: 5, OS: 2.2, DF: 0.7, KL: 0 }, assistW: { FV: 2, OS: 3, DF: 1, KL: 0 },
    assistChance: 0.7, scorerCaPow: 2, scorerCaRef: 60,
    injuryChance: 0.012, injuryMonths: [1, 1, 1, 2, 2, 3, 5],
    subsUsed: [0, 1, 2, 3, 3, 3], subMin: [55, 85], minRated: 15,
    rating: { base: 6.0, win: 0.35, loss: -0.3, goal: 0.9, assist: 0.5, cleanSheet: 0.4, concede: -0.25, caW: 0.012, sd: 0.55, min: 3, max: 10 },
    formKeep: 0.75, formRef: 6.4, formGain: 8, formMax: 10, lastKeep: 4,
    points: { w: 3, d: 1 },
  },
  sel: { noiseSd: 1.0, formW: 0.5, guarantee: 10, youthStep: 1.8, youthMaxAge: 21, outOfPos: 12, subs: 3,
         proj: { starter: 0.88, bench1: 0.22, bench2: 0.12, other: 0.03 } },

  // valuation
  value: {
    base: 150000, k: 0.16, ref: 50,
    ageMult: [[21, 1.5], [25, 1.25], [28, 1.0], [30, 0.7], [32, 0.45], [99, 0.2]],
    potW: 0.012, potMaxAge: 23, hypeDiv: 400,
    contractMult: [0.6, 0.8, 0.95, 1.0],
    cap: 400000000, min: 10000,
  },
  wage: { base: 2000, k: 0.12, ref: 50, min: 600 },

  // economy
  econ: {
    upkeepUpgrade: [0, 1500, 3500, 7000, 12000],
    negMonthsBankrupt: 3, ledgerMax: 24,
    loan: { amount: 80000, rate: 0.15, months: 12 },
  },
  rank: { clientW: 0.08, cashW: 0.5, repW: 50000, topClients: 10 },

  season: {
    retire: { startAge: 33, base: 0.12, step: 0.16, force: 38, gkBonus: 2 },
    renewChance: 0.85, renewYears: [1, 4], youthContract: [2, 4], wageRenewFloor: 0.9,
    newsMax: 80, promotion: 2, clubFormDrift: 0.4,
    formReset: 0.4, cullGap: 8, cullChance: 0.6,
  },

  rivals: [
    { id: 'r1', name: 'Sedat Korkmaz', agency: 'Korkmaz Spor Menajerlik', persona: 'kopekbaligi', rep: 28, cash: 220000, color: '#E0624A' },
    { id: 'r2', name: 'Dr. Ayşe Tuna', agency: 'Tuna Akademi', persona: 'akademisyen', rep: 24, cash: 160000, color: '#B48CFF' },
    { id: 'r3', name: 'Hasan Usta', agency: 'Usta & Oğulları', persona: 'eskidost', rep: 34, cash: 260000, color: '#5AB0FF' },
    { id: 'r4', name: 'Orhan Berk', agency: 'Berk Holding Sports', persona: 'holding', rep: 44, cash: 2000000, color: '#F5C451' },
  ],
  rivalCommission: [5, 10],

  limits: { newsMax: 80, ledgerMax: 24, careerMax: 12 },
};

export const DEADLINE_MONTHS = MONTHS.map((m, i) => (m.deadline ? i : -1)).filter(i => i >= 0);
