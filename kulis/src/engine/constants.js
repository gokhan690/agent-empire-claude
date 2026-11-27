// All balance numbers and static labels. Turkish display strings live here / in data/.

export const LEAGUE_DEFS = [
  { id: 'tr2', name: '1. Lig', country: 'Türkiye', prestige: 1, nat: 'TR' },
  { id: 'tr1', name: 'Süper Lig', country: 'Türkiye', prestige: 2, nat: 'TR' },
  { id: 'nl1', name: 'Hollanda Ligi', country: 'Hollanda', prestige: 3, nat: 'NL' },
  { id: 'it1', name: 'İtalya Ligi', country: 'İtalya', prestige: 4, nat: 'IT' },
  { id: 'es1', name: 'İspanya Ligi', country: 'İspanya', prestige: 5, nat: 'ES' },
  { id: 'en1', name: 'İngiltere Ligi', country: 'İngiltere', prestige: 5, nat: 'EN' },
];

/** Month table (a season is 12 monthly turns; 18 matchdays in total). Transfers are possible in every month. */
export const MONTHS = [
  { name: 'Temmuz', short: 'Tem', matchdays: 0 },
  { name: 'Ağustos', short: 'Ağu', matchdays: 2 },
  { name: 'Eylül', short: 'Eyl', matchdays: 2 },
  { name: 'Ekim', short: 'Eki', matchdays: 2 },
  { name: 'Kasım', short: 'Kas', matchdays: 2 },
  { name: 'Aralık', short: 'Ara', matchdays: 2 },
  { name: 'Ocak', short: 'Oca', matchdays: 1 },
  { name: 'Şubat', short: 'Şub', matchdays: 2 },
  { name: 'Mart', short: 'Mar', matchdays: 2 },
  { name: 'Nisan', short: 'Nis', matchdays: 2 },
  { name: 'Mayıs', short: 'May', matchdays: 1 },
  { name: 'Haziran', short: 'Haz', matchdays: 0 },
];

/** Position lines. `slots` = starters in the 1-4-4-2. */
export const POS = {
  KL: { label: 'Kaleci', short: 'KL', slots: 1 },
  DF: { label: 'Defans', short: 'DF', slots: 4 },
  OS: { label: 'Orta Saha', short: 'OS', slots: 4 },
  FV: { label: 'Forvet', short: 'FV', slots: 2 },
};
export const POS_ORDER = ['KL', 'DF', 'OS', 'FV'];


/** All balance numbers. Money is whole €. */
export const BAL = {
  careerSeasons: 5,
  start: { cash: 60000, rep: 12, upkeep: 4000, commissionPct: 7, gemAge: 17, clientMood: 65 },
  energy: { base: 4 }, // +1 with the "Büyük ofis" upgrade; every action costs exactly 1
  moodStart: [50, 70],

  strengthByPrestige: { 1: 52, 2: 62, 3: 68, 4: 76, 5: 82 },
  tierPattern: [5, 4, 4, 3, 3, 3, 2, 2, 2, 1],
  tierSpread: 3.2,
  strengthNoise: 1.2,
  leagueWageMult: { tr2: 1.0, tr1: 1.8, nl1: 2.2, it1: 3.2, es1: 4.5, en1: 5.0 },
  clubBudgetByPrestige: { 1: 1500000, 2: 6000000, 3: 12000000, 4: 35000000, 5: 90000000 },
  clubTrustBase: 30, clubTrustSd: 12,
  directorChangeChance: 0.08,

  squad: {
    base: { KL: 2, DF: 6, OS: 6, FV: 4 }, // 18
    extraMin: 1, extraMax: 4, extraWeights: { DF: 2, OS: 2, FV: 1.3 },
    minByPos: { KL: 2, DF: 5, OS: 5, FV: 3 },
    targetMin: 19, targetMax: 22, min: 18, max: 22,
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
  },
  rivalShare: 0.16, rivalEliteShare: 0.05, // share of players who start with a rival agent (stars: far fewer)

  // development
  dev: {
    rate: 0.0265,
    ageFactor: { 16: 1.15, 17: 1.15, 18: 1.15, 19: 1.15, 20: 1.0, 21: 1.0, 22: 1.0, 23: 0.75, 24: 0.75, 25: 0.75, 26: 0.4, 27: 0.4, 28: 0.4 },
    growthMaxAge: 28,
    minFloor: 0.44, minSlope: 0.56, minFull: 0.8,
    facBase: 0.85, facStep: 0.05,
    moodBase: 0.9, moodSlope: 0.2,
    noiseSd: 0.1,
    declinePerYear: { 30: 0.8, 31: 1.2, 32: 1.8, 33: 2.4, 34: 3.0, 35: 3.5 },
    shSmooth: 0.6,
    formDecay: 0.85,
    driftGain: 1.6, driftMin: 0.05, driftBoost: 0.8, driftBoostMax: 0.9,
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
  sel: { noiseSd: 1.0, formW: 0.5, youthStep: 1.8, youthMaxAge: 21, outOfPos: 12, subs: 3,
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
    upkeepUpgrade: 1200, // per bought upgrade, per month
    staff: { free: 5, perClient: 600, valueFrom: 5000000, valueShare: 0.0015 },
    repTier: [[20, 1000], [35, 3000], [50, 12000], [65, 30000], [80, 60000]],
    negMonthsBankrupt: 3, ledgerMax: 24,
    noClientMonthsEnd: 3,
    loan: { amount: 80000, rate: 0.15, months: 12 },
  },
  rep: { decay: 78, floor: 0.12 },
  rank: { clientW: 80000, cashW: 0.6, repW: 50000, topClients: 10 },

  season: {
    retire: { startAge: 33, base: 0.12, step: 0.16, force: 38, gkBonus: 2 },
    renewChance: 0.85, renewYears: [1, 4], youthContract: [2, 4],
    promotion: 2, youthAnchor: 0.75,
    formReset: 0.4, cullGap: 8, cullChance: 0.6, moveShift: 0.6, moveShiftMax: 5,
  },

  rivals: [
    { id: 'r1', name: 'Sedat Korkmaz', agency: 'Korkmaz Spor Menajerlik', rep: 12, cash: 100000, color: '#E0624A', eliteCap: 2 },
    { id: 'r2', name: 'Dr. Ayşe Tuna', agency: 'Tuna Akademi', rep: 10, cash: 80000, color: '#B48CFF', eliteCap: 3 },
    { id: 'r3', name: 'Hasan Usta', agency: 'Usta & Oğulları', rep: 27, cash: 200000, color: '#5AB0FF', eliteCap: 6 },
    { id: 'r4', name: 'Orhan Berk', agency: 'Berk Holding Sports', rep: 36, cash: 1000000, color: '#F5C451', eliteCap: 8 },
  ],
  rivalAI: {
    bgSign: 0.7, bgSample: 6, bgLose: 0.35, minPortfolio: 40, eliteCa: 68, eliteYouthPa: 82, renewChance: 0.55, renewChanceElite: 0.4,
    repPull: 0.05, repNoise: 0.4, repMin: 5, repMax: 95, cashFloor: 20000, upkeepBase: 3000, upkeepRep: 120, incomeShare: 0.02, cashGrowth: 0.12, cashPull: 0.08,
    commission: [5, 10],
    snipe: 0.14, // monthly chance a rival signs a candidate you found but did not sign
  },

  // ---- market ----
  market: {
    need: { gap: [1, 3.5, 7] },
    interest: {
      create: 35, pull: 0.45, noise: 2, decay: 12, drop: 6, perPlayer: 5, boostDecay: 0.75, boostMax: 30, open: 60,
      needW: 18, fitBase: 20, fitK: 2.2, fitMin: -30, fitMax: 26, formW: 1.2, hypeDiv: 10, trustDiv: 12,
      ageYoung: 6, ageMid: 4, age31: -8, age33: -16, budgetMinRatio: 0.8, budgetRich: 2, budgetBonus: 4, unaffordableCap: 20,
      moveLock: 11,
    },
    ai: { perClubMax: 2, needFactor: 0.3, noiseSd: 0.5, windowMonths: [0, 1, 6], monthFactor: { 0: 1, 1: 1, 6: 0.7 }, valueBudgetShare: 0.5, newsMinValue: 2000000, newsMax: 5, feeLo: 0.9, feeHi: 1.1, caWindow: [-4, 4], contract: [2, 4] },
    // "Kulübe öner": the club listens when its natural appetite is at least `listen` (then a table opens at level `offerLevel`)
    pitch: { listen: 40, maybe: 28, offerLevel: 66, weak: 14 },
    deal: {
      feeFactorBase: 0.95, feeFactorNeed: 0.05, repDiv: 200000, repMax: 3.0, repBase: 1.0, repLog: 0.65,
      oldClubTrust: -4, newClubTrust: 6,
      minutesMood: 30, moveMood: 4,
    },
  },
  // ---- Masa: two sliders (wage, commission); years/bonus come from the club's fair package ----
  neg: {
    minLevel: 60, rounds: 3,
    gen: { base: 1.02, need: 0.03, level: 0.0025, budget: 0.05, noise: 0.05, min: 0.97, max: 1.30 },
    fee: { valueShare: 0.115, valueDamp: 40000000, wageShare: 0.13 },
    feeFloor: { share: 0.03, min: 1500 },
    firstTable: { headroom: 1.12 }, // the very first table is meant to be won
    years: { default: 3, old: 2, oldAge: 31, young: 4, youngAge: 21 },
    bonusMonths: 2,
    maxWageMult: 4, maxFeeMult: 3,
    demandMult: 1.04, minWageShare: 0.96, // the player refuses a wage below 96% of what he asks (104% of the fair wage)
    happyWage: 1.12,                       // wage ≥ 112% of his ask makes him happy
    greedyShare: 0.17,                     // commission above 15% of the package annoys the player
    hint: { high: -0.04, mid: 0.10 },      // Kabul şansı: gap=(C−K)/K ≤ −4% Yüksek, ≤ +10% Orta, else Düşük
    tell: [0.05, 0.12, 0.22, 0.35],
    counter: { base: 0.90, step: 0.04, noise: 0.03, feeW: 0.6 },
    leave: { trust: -10, cooldown: 3 },
    mood: { happy: 8, greedy: -8 },
  },

  scout: { count: 3, qBase: 46, qRep: 0.5, qSd: 7, gemChance: 0.12, gemMinGap: 14, foundMax: 6, bandWidth: 18 },
  recruit: { repBase: 50, repSlope: 0.55, youth21: 6, youth24: 3 }, // signable when level ≤ 50 + 0.55·rep (level = CA + youth premium)
  mood: { target: 60, regress: 0.1, form: 0.4, minK: 14, minMin: -6, minMax: 3, wageLow: 0.88, wageHigh: 1.1, injured: -2, leave: 15, minutesRef: 0.5 },
  upgrades: [
    { id: 'office', name: 'Büyük ofis', text: '+1 enerji her ay', price: 90000 },
    { id: 'scouts', name: 'Gözlemci ağı', text: 'Oyuncu ara 4 aday getirir', price: 60000 },
    { id: 'lawyer', name: 'Avukat', text: 'Aylık komisyon payın %7 yerine %10', price: 150000 },
    { id: 'network', name: 'Kulüp ağı', text: 'Kulübe öner daha çok ilgi yaratır', price: 220000 },
    { id: 'academy', name: 'Akademi bağı', text: 'Aramada daha yüksek potansiyelli adaylar', price: 400000 },
    { id: 'brand', name: 'Marka', text: 'Her sezon başında +3 itibar', price: 800000 },
  ],
  upgrade: { lawyerPct: 10, networkBoost: 1.5, brandRep: 3, academyGem: 0.3 },

  goal: { reward: { rep: 4, cash: 40000 } },
  events: { chance: 0.7, cooldown: 3 },

  legacy: {
    commissionDiv: 10000, deal: 40, peakValueDiv: 1000000, peakValueW: 25, peakCount: 5,
    champion: 150, rank: { 1: 600, 2: 350, 3: 200, 4: 80, 5: 0 }, rep: 4, seasonSurvived: 25,
  },
  ending: {
    // 5-season career: a careful player lands ≈ 3400–4800 legacy, a casual one ≈ 1600–2500 (bots, 32 seeds)
    efsane: { rank: 1, min: 3400 },
    buyuk: { rank: 2, min: 2800 },
    saygin: { rank: 3, min: 1200 },
    epilogueMax: 5, minApps: 8,
  },
  limits: { newsMax: 80, careerMax: 12 },
};
