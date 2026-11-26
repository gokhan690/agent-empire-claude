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
    durust: { k: 0, patience: 4, noise: 0.05 },
    kurnaz: { k: 0, patience: 4, noise: 0.08 },
    cimri: { k: -0.08, patience: 6, noise: 0.06 },
    sabirsiz: { k: 0.08, patience: 3, noise: 0.09 },
    gosterisci: { k: 0, patience: 4, hypeBonus: 0.12, hypeMin: 60, otherMalus: -0.03, noise: 0.08 },
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
  rep: { decay: 100, floor: 0.15 },
  rank: { clientW: 70000, cashW: 0.5, repW: 50000, topClients: 10 },

  season: {
    retire: { startAge: 33, base: 0.12, step: 0.16, force: 38, gkBonus: 2 },
    renewChance: 0.85, renewYears: [1, 4], youthContract: [2, 4], wageRenewFloor: 0.9,
    newsMax: 80, promotion: 2, clubFormDrift: 0.4, youthAnchor: 0.75,
    formReset: 0.4, cullGap: 8, cullChance: 0.6,
  },

  rivals: [
    { id: 'r1', name: 'Sedat Korkmaz', agency: 'Korkmaz Spor Menajerlik', persona: 'kopekbaligi', rep: 28, cash: 220000, color: '#E0624A' },
    { id: 'r2', name: 'Dr. Ayşe Tuna', agency: 'Tuna Akademi', persona: 'akademisyen', rep: 24, cash: 160000, color: '#B48CFF' },
    { id: 'r3', name: 'Hasan Usta', agency: 'Usta & Oğulları', persona: 'eskidost', rep: 34, cash: 260000, color: '#5AB0FF' },
    { id: 'r4', name: 'Orhan Berk', agency: 'Berk Holding Sports', persona: 'holding', rep: 44, cash: 2000000, color: '#F5C451' },
  ],
  rivalCommission: [5, 10],

  // ---- market (phase 2b) ----
  market: {
    need: { gap: [1, 3.5, 7] },
    interest: {
      create: 35, pull: 0.45, noise: 2, decay: 12, drop: 6, perPlayer: 5, boostDecay: 0.75, boostMax: 30, open: 60,
      needW: 18, fitBase: 20, fitK: 2.2, fitMin: -30, fitMax: 26, formW: 1.2, hypeDiv: 10, trustDiv: 12,
      ageYoung: 6, ageMid: 4, age31: -8, age33: -16, budgetMinRatio: 0.8, budgetRich: 2, budgetBonus: 4, unaffordableCap: 20,
      renewalFrom: 3, freeFrom: 6, renewalBase: 45, renewalStarter: 70, renewalRank: 1,
      freeAgentBase: 20, moveLock: 11,
    },
    ai: { perClubMax: 2, needFactor: 0.3, noiseSd: 0.5, monthFactor: { 0: 1, 1: 1, 6: 0.7 }, valueBudgetShare: 0.5, newsMinValue: 2000000, newsMax: 5, feeLo: 0.9, feeHi: 1.1, caWindow: [-4, 4], contract: [2, 4] },
    pitch: { base: 4, perNeed: 4, fitMin: -4, fitMax: 8, fitW: 0.8, hypeDiv: 25, min: 3, max: 25, repeatMult: 0.5 },
    lunch: { cashBase: 1500, cashPerPrestige: 1500, trust: 10, trustL2: 15, band: 0.25 },
    media: { cashBase: 3000, valueShare: 0.004, min: 3000, max: 25000, hype: 15, yildizMorale: 8, sadikMorale: -5 },
    deal: {
      feeFactorBase: 0.95, feeFactorNeed: 0.05, repDiv: 200000, repMax: 3, repBase: 0.8, repLog: 0.6, repRenewal: 0.3,
      oldClubTrust: -4, oldClubTrustFree: -20, newClubTrust: 6, renewTrust: 4, releaseMult: 1.5,
      minutesMorale: 30, benchHirsliMorale: -6, benchHirsliLoyalty: -8, dreamMorale: 8, dreamLoyalty: 6, moveLoyalty: 4, renewLoyalty: 8,
      feeNoticeLoyalty: -5,
    },
    freeAgent: { chance: 0.4, minGap: 8, minAge: 30 },
  },
  neg: {
    minLevel: 60,
    gen: { base: 0.81, renewal: -0.06, need: 0.05, level: 0.0025, budget: 0.06, noise: 0.07, min: 0.72, max: 1.30 },
    fee: { valueShare: 0.08, valueDamp: 40000000, wageShare: 0.09, freeShare: 0.10, renewShare: 0.06 },
    tutorialK: 0.12, freeSaved: 0.30, saveFactor: 0.9,
    years: { default: 3, old: 2, oldAge: 31, young: 4, youngAge: 21, renew: 3 },
    bonusMonths: { transfer: 2, free: 6, renewal: 1.5 },
    clause: { minutes: 0.08, release: 0.05 },
    maxWageMult: 4, maxBonusMonths: 24, maxFeeShare: 0.6,
    tell: [0.05, 0.12, 0.22, 0.35],
    creep: { base: 0.80, step: 0.05, noise: 0.04 },
    insult: 1.35,
    sat: {
      demandMult: 1.04, base: 32, wageFair: 15, wageSlope: 75, wageMin: -30, wageMax: 28, paraci: 1.3,
      bonusSlope: 50, bonusMax: 8, paraciBonus: 1.5,
      minutesW: 20, hirsliMinutes: 1.5, profMinutes: 0.7,
      prestigeW: 3, hirsliPrestige: 1.6, sadikMove: -6,
      dream: { top_league: 10, big_wage: 10, champion: 6, star: 5, hometown: 6 },
      family: { away: -8, home: 4 }, yildiz: 4, release: 3,
      ok: 50, lean: 40, leanLoyalty: -8,
    },
    koz: { rakip: 0.12, formda: 0.08, taraftar: 0.04, sozlesme: 0.06, dostluk: 0.08, songun: 0.10, blof: 0.10,
      rakipMin: 50, formMin: 7.2, formApps: 3, hypeMin: 60, trustMin: 60, songunNeed: 2, handMax: 4, handMaxL3: 5 },
    bluff: { base: 0.15, info: 0.08, table: 0.05, min: 0.05, max: 0.6, patience: -2, trust: -15, rep: -2 },
    leave: { trust: -10, cooldown: 3 },
    table: { patience: 1, kurnazTrust: 60, kurnazTable: 2, bandTable: 4, band: 0.15 },
    counterW: {
      durust: { wage: 0.4, bonus: 0.2, fee: 0.4 },
      kurnaz: { wage: 0.2, bonus: 0.2, fee: 0.6 },
      cimri: { wage: 0.3, bonus: 0.4, fee: 0.3 },
      sabirsiz: { wage: 0.5, bonus: 0.1, fee: 0.4 },
      gosterisci: { wage: 0.2, bonus: 0.1, fee: 0.7 },
    },
  },
  deadline: {
    hours: [18, 23], maxCalls: 8, minLevel: 2, kBoost: [0, 0.05, 0.09, 0.13], patiencePenalty: 1,
    callLen: [1, 3], missedInterest: -30, hotLevel: 60,
  },

  limits: { newsMax: 80, ledgerMax: 24, careerMax: 12 },
};

export const DEADLINE_MONTHS = MONTHS.map((m, i) => (m.deadline ? i : -1)).filter(i => i >= 0);

// ---- Phase 2a (agency systems) balance numbers: scouting, recruiting, promises, upgrades, rivals, objectives ----
Object.assign(BAL, {
  scout: {
    travel: { 1: 2500, 2: 5000, 3: 9000, 4: 15000, 5: 24000 }, // € per trip by league prestige
    count: 3, startKnow: 10, gemChance: 0.12, gemMinGap: 14,
    qBase: { 1: 46, 2: 54, 3: 60, 4: 66, 5: 70 }, qRep: 0.15, qSd: 7,   // target level of offered prospects
    watchKnow: 30, traitKnow: 60, dreamKnow: 85, shortlistMax: 40,
  },
  recruit: {
    repW: 1.6, knowW: 0.15, base: 6, mahalleYouth: 12, expiring: 4,
    thrBase: 15, thrFrom: 40, thrSlope: 1.8, thrHigh: 70, thrSlope2: 2.0, thrRival: 18, thrHype: 0.04,
    maxPromises: 3, commission: [5, 10], commissionStep: 5, contractYears: 2,
    promiseAdd: 9, promiseFit: 1.5, promiseOffFit: 0.6,
    fit: { minutes: ['hirsli', 'yildiz', 'profesyonel'], transfer_up: ['hirsli', 'yildiz'], wage: ['paraci'], stay: ['sadik', 'ailebabasi'], visit: ['ailebabasi', 'yildiz', 'sadik'] },
    startLoyalty: 55, startMorale: 62, startKnow: 60,
  },
  clientDrift: {
    minExp: { hirsli: 0.7, yildiz: 0.6, profesyonel: 0.5, ailebabasi: 0.5, paraci: 0.45, sadik: 0.35 },
    moraleBase: 60, moraleRegress: 0.1, moraleForm: 0.4, moraleMinK: 14, moraleMinMin: -6, moraleMinMax: 3,
    loyMinK: 8, loyBase: -0.5, sadikDecay: 0.5, network2Decay: 0.65, visitGrace: 3, visitDecay: 0.3, visitDecayMax: 1.5,
    wageLow: 0.88, wageHigh: 1.1, injuredMorale: -2,
    leaveLoyalty: 10, renewLoyalty: 55, repBonusCashK: 1.0, hometownShare: 0.55, championApps: 8,
    dreamLoyalty: 30, dreamRep: 4, dreamMorale: 15,
  },
  promise: {
    kept: { loyalty: 15, rep: 2, morale: 5 }, broken: { loyalty: -25, rep: -3, morale: -10 },
    minutesShare: 0.5, minWindow: 4, walkoutLoyalty: 25, wageMult: 1.25, wageFairMult: 1.15, keepMonths: 24,
  },
  upgrade: {
    cost: { scout: [40000, 120000, 350000, 900000], table: [40000, 120000, 350000, 900000], network: [50000, 150000, 400000, 1000000] },
    names: { scout: 'Gözlem', table: 'Masa', network: 'Ağ' },
    scoutPassiveKnow: 10, heatSlow: 0.7, lunchTrust: 15, loyaltyDecayMult: 0.65,
    text: {
      scout: ['Geziler 4 aday gösterir', 'Yeni keşiflerde başlangıç bilgisi +15', 'Her ay pasif olarak bir yeni aday keşfedilir', 'Takip listendeki oyuncuların rakip ilgisi %30 yavaş artar'],
      table: ['Masada +1 sabır', 'Kurnaz müdürlerin tepkileri gerçeği gösterir', 'Blöf riski -%10, elinde 5 Koz', 'Masa açılışında tavan bandı (±%15) görünür'],
      network: ['+1 enerji', 'Öğle yemeği +15 güven, bağlılık daha yavaş düşer', '+1 enerji', 'Son Gün\'de saat başı iki eylem'],
    },
  },
  rivalAI: {
    heatBase: 3, heatObv: 9, heatHype: 0.03, heatObvFrom: 45, heatObvSpan: 35, akademisyenU21: 1.4,
    bgSign: 0.7, bgSample: 6, bgLose: 0.35, minPortfolio: 40, commission: [5, 10],
    repPull: 0.05, repNoise: 0.4, repMin: 5, repMax: 95, cashFloor: 20000, upkeepBase: 3000, upkeepRep: 120, incomeShare: 0.02, cashGrowth: 0.25, cashPull: 0.08,
    poachLoyalty: 35, poachChance: 0.55, poachCooldown: 4, poachBonusK: 2, poachBonusMin: 4000, poachBonusMax: 60000,
    poachPromiseLoyalty: 22, poachBonusLoyalty: 25, poachMaxPending: 3,
  },
  objective: {
    reward: { safe: { rep: 2, cash: 10000 }, balanced: { rep: 4, cash: 25000 }, bold: { rep: 7, cash: 60000 } },
    cashSeasonGrowth: 0.25, failRepPenalty: 0,
  },
});

// ---- Phase 2c (narrative): inbox deck, legacy score, endings ----
Object.assign(BAL, {
  events: {
    perMonth: { 2: 35, 3: 45, 4: 20 },   // cards generated per month (weights)
    inboxCap: 8,                          // hard cap on cards waiting in the Gündem
    playerCooldown: 2,                    // months before the same player gets another random card
    kindPenalty: 0.4,                     // weight multiplier for a kind already drawn this month
    tutorialCards: 1,                     // max random cards per month while tutorial cards are active
    heavyFromSeason: 2,                   // `heavy` (high-stakes) cards never appear in season 1
    loanDefaultDays: 3,
  },
  // legacy score = Σ of the terms below (see ending.legacyScore)
  legacy: {
    commissionDiv: 10000,                 // + commission earned / 10K
    deal: 30,                             // + per completed transfer
    dream: 200,                           // + per fulfilled client dream
    kept: 35, broken: -60,                // promises
    peakValueDiv: 1000000, peakValueW: 25, peakCount: 5, // + 25 per €1M of the 5 most valuable client peaks
    champion: 150,                        // + per league title won by a client's club (client with ≥ 8 apps)
    rank: { 1: 600, 2: 350, 3: 200, 4: 80, 5: 0 },
    rep: 4,                               // + rep · 4
    seasonSurvived: 20,
  },
  ending: {
    efsane: { rank: 1, min: 2200 },
    buyuk: { rank: 2, min: 1300 },
    saygin: { rank: 3, min: 700 },
    epilogueMax: 8,
    minApps: 8,
  },
});
