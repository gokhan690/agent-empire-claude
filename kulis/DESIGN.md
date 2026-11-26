# KULİS — Design & Architecture Contract

KULİS is a from-scratch successor to "Agent Empire" (the old single-file game in the repo root —
do **not** read, copy or reuse its code). Same fantasy (you are a football agent), completely new
design and codebase. This document is the contract every contributor builds against. If something
here is ambiguous, pick the option that makes the game more *readable and fun for the player* and
note the decision in your final report. Do not silently change names/shapes defined here.

All player-facing text is **Turkish**. Code identifiers and comments are English.

---

## 1. Why this game exists (design pillars)

The old game was a spreadsheet: 42 "press Play" weeks per season, dice-roll negotiations, ten
departments, no way to win or lose. KULİS fixes that with five pillars:

1. **Every turn is a decision.** A turn is one *month*. You get a small Energy budget (4) and far
   more things worth doing than you can afford. No dead time: outside transfer windows you scout,
   build relationships, keep promises, set up deals.
2. **Negotiation is a game of reading people, not dice.** The club director has a hidden budget
   ceiling and visible patience. You read tells, play leverage cards ("Koz") earned from the real
   game state, and split a fixed pie between your client's wage and your own commission.
3. **Hidden potential.** A youngster's ceiling is shown as a band that narrows as you watch him.
   Rival agents are watching too (a visible "heat" meter). Betting on the unknown is the core thrill.
4. **People, not rows.** Clients have a trait, a dream, loyalty and promises you made to them.
   The right move for a career is often not the highest bid. Broken promises cost you.
5. **Stakes and an arc.** A career is 8 seasons. You can go bankrupt. Four named rival agencies are
   ranked against you all the time. The run ends with a ranking, a legacy score and epilogues.

Plus: **juice** (sound, animation, signing ceremonies, live match ticker) and a **mobile-first** UI.

Scope discipline: no departments, no staff directory, no work permits, no sub-reputations. If a
system is not in this document, do not add it.

---

## 2. Game structure

- Career: `careerSeasons` = 8 (option: 5). Season = 12 monthly turns, index `month` 0..11:

| month | name | window | matchdays | notes |
|---|---|---|---|---|
| 0 | Temmuz | open | 0 | pre-season |
| 1 | Ağustos | open | 2 | ends with **Son Gün** (deadline day) |
| 2 | Eylül | – | 2 | |
| 3 | Ekim | – | 2 | |
| 4 | Kasım | – | 2 | |
| 5 | Aralık | – | 2 | |
| 6 | Ocak | open | 1 | ends with **Son Gün** |
| 7 | Şubat | – | 2 | |
| 8 | Mart | – | 2 | |
| 9 | Nisan | – | 2 | |
| 10 | Mayıs | – | 1 | league finishes (18 matchdays) |
| 11 | Haziran | – | 0 | season end: awards, expiries, ageing, review |

- A turn: (1) read the **Gündem** (inbox cards), (2) spend **Enerji** on actions, (3) press
  **"Ayı Oynat"** → matches are simulated, world moves, report is shown.
- Lose: cash < 0 for 3 consecutive month-ends → bankruptcy (one bank-loan lifeline is offered the
  first time cash goes negative). Zero clients at a season end (from season 2 on) → career over.
- End: after June of the last season → final ranking among 5 agencies, legacy score, epilogues.
  Then the player may continue in endless mode.

### Resources
- **Para** `agency.cash` (€). In: transfer commissions (lump sums), monthly % of clients' wages,
  sponsorship cuts, objective rewards. Out: office upkeep, travel/action costs, loan instalments.
- **İtibar** `agency.rep` 0..100. Gates which players will sign with you and which clubs listen.
- **Enerji** `agency.energy`, refilled to `energyMax` (4 base, up to 6) every month.
- **Güven** `club.trust` 0..100 — your relationship with each club's director.
- **Bağlılık** `player.loyalty` 0..100 and **Moral** `player.morale` 0..100 for each client.

### World
6 leagues × 10 clubs, **fictional club names** (no real club names, no real player names):

| id | name | country | prestige |
|---|---|---|---|
| tr2 | 1. Lig | Türkiye | 1 |
| tr1 | Süper Lig | Türkiye | 2 |
| nl1 | Hollanda Ligi | Hollanda | 3 |
| it1 | İtalya Ligi | İtalya | 4 |
| es1 | İspanya Ligi | İspanya | 5 |
| en1 | İngiltere Ligi | İngiltere | 5 |

Double round-robin = 18 matchdays. Bottom 2 of tr1 ↔ top 2 of tr2 swap each season.
Squads 18–22 players. Positions (4 lines): `KL` `DF` `OS` `FV`; line-up 1-4-4-2.
Club strength by prestige (average CA of XI): p1 ≈ 52, p2 ≈ 62, p3 ≈ 68, p4 ≈ 76, p5 ≈ 82, with
spread inside a league (title contenders vs relegation fodder).

### Players
`ca` (Güç, 1..99 current ability), hidden `pa` (potential), `age` 16..36, `form` (-10..+10),
`trait`, `dream`, contract with club (`wage` monthly €, `contractEnd` season number — expires in
June of that season), `value`, `hype` 0..100.

Traits (`trait`): `hirsli` (Hırslı — wants bigger clubs, hates the bench), `sadik` (Sadık — loyalty
decays slowly, dislikes moving), `paraci` (Paracı — wage matters most), `ailebabasi` (Aile Babası —
wants stability / home country), `yildiz` (Yıldız Adayı — loves hype, fragile morale),
`profesyonel` (Profesyonel — steady, develops well).

Dreams (`dream.type`): `top_league` (play in a prestige-5 league), `big_wage` (wage ≥ target),
`champion` (win a league title), `star` (reach CA ≥ 85), `hometown` (3 seasons as a starter at one
Turkish club). Fulfilling a client's dream: loyalty +30, rep +4, legacy points.

Reference curves (tune in balance pass, keep the orders of magnitude):
- value(€) ≈ 150_000 · e^(0.16·(ca−50)) · ageMult · potentialMult · contractMult · (1 + hype/400)
  (ca 50 → ~150K, 60 → ~750K, 70 → ~3.7M, 80 → ~18M, 90 → ~90M);
  ageMult: ≤21 1.5, 22–25 1.25, 26–28 1.0, 29–30 0.7, 31–32 0.45, 33+ 0.2.
- fair monthly wage(€) ≈ 2_000 · e^(0.12·(ca−50)) · leagueWageMult.
- Development: youngsters grow toward `pa` mainly through **minutes played**, then club
  `facilities`, morale and the `profesyonel` trait. Target: a 17-year-old with pa 90 who plays
  regularly is ~85 at 23; the same player rotting on a bench is ~74. Decline from 30+.
  **Minutes are the heart of the "right club vs highest bid" dilemma — make them matter.**

### The agent loop (actions, each costs Energy; costs shown before confirming)
| action id | cost | effect |
|---|---|---|
| `scoutTrip` {leagueId, focus} | 1 E + travel € | reveals 3 prospects from that league (focus: `u21`, `form`, `expiring`, `any`) |
| `watchPlayer` {playerId} | 1 E | knowledge +30 → narrower potential band; reveals trait at ≥60 |
| `recruit` {playerId, promises[]} | 1 E | signing pitch (see below) |
| `visitClient` {playerId} | 1 E | morale +10, loyalty +8, reveals dream/what he wants now |
| `clubLunch` {clubId} | 1 E + € | trust +10, reveals club needs & a budget hint |
| `pitchPlayer` {playerId, clubId} | 1 E | raises that club's interest by a shown, deterministic amount |
| `mediaPush` {playerId} | 1 E + € | hype +15 (value & interest up; `yildiz` morale +, `sadik` −) |
| `openNegotiation` {interestId} | 1 E | opens the Masa (below) |
| `buyUpgrade` {branch} | € | office upgrade |
| `answerInbox` {inboxId, optionId} | per option | resolve an inbox card |

### Scouting & hidden potential
`player.know` 0..100 is *your* knowledge. Shown potential band width ≈ (100−know)·0.3 CA points;
the true `pa` is **always inside the band** but the band is randomly offset, so the centre is not
the truth. know ≥ 60 reveals trait; dream is revealed by visiting (clients) or know ≥ 85.
Each unrepresented prospect you have discovered has `heat` 0..100 (rival interest) that rises
every month — faster for obvious talents. At 100 a rival agency signs him. Heat is visible.

### Recruiting (signing a client) — no dice
`recruitScore = f(your rep vs player's level, know/visits, archetype bonus, promises offered)`
vs a visible threshold. The UI shows the meter and what each promise would add. Promises are real
obligations (see below). If score ≥ threshold the player signs a representation contract
(`rep: {commissionPct 5..10, endSeason}`). ~25% of world players start with a rival agent
(recruitable only when their rep contract is in its last season, at a higher threshold), ~10%
start as *your* potential pool via the intro; the rest are unrepresented.

### Promises (Söz)
`{id, playerId, type, text, dueSeason, dueMonth, status:'open'|'kept'|'broken'}`.
Types: `minutes` (≥50% minutes share over the period), `transfer_up` (move to a higher-prestige
league by due date), `wage` (wage ≥ target by due date), `stay` (no transfer before due date),
`visit` (visited at least once each half-season). Kept: loyalty +15, rep +2. Broken: loyalty −25,
rep −3, and a `hirsli`/`yildiz` client may walk out.

### Transfers & interest
Each month clubs compute **needs** (weak/thin positions) and build **interest** (0..100) in
players that fit level, age profile and budget. Interest in *your* clients is listed in
`S.interests`. Interest ≥ 60 during an open window → you may open a negotiation. Outside windows
you can still pitch, lunch and hype to build interest for the next window, and you may negotiate a
**pre-contract** (free transfer at season end) for clients whose contract ends this June, from
January on (the "Bosman" play: no fee, so a much bigger pie — but the current club is furious:
trust −20). AI clubs also trade among themselves in windows (0–2 signings per club) so the world
and the news feed stay alive. Your clients only move through you.

After a move, **career fit** is real: minutes at the new club come from the squad hierarchy and
`club.youthTrust`; development, morale and loyalty follow. A dream move to a giant where he never
plays will stall him and he will blame you.

### Masa — the negotiation mini-game (centerpiece)
One table per deal, kinds: `transfer`, `free` (pre-contract/free agent), `renewal` (with current
club), `sponsor` (simplified). You propose a **package**:

`{ wage (monthly €), years 1..5, bonus (signing bonus to player €), fee (your commission, lump sum €), clauses: { minutes: bool, release: bool } }`

- Club cost `C = wage·12·years + bonus + fee + clauseCosts` (`minutes` +8%, `release` +5%).
- The director has a hidden **ceiling** `K` and visible **patience** (3..6 pips). The transfer
  fee between clubs is settled automatically and shown ("Bonservis: €X"); for `free` deals part of
  the saved fee is added to K.
- `K = fairPackage · generosity`, generosity 0.85..1.35 from need level, interest, budget health,
  persona, and played Koz cards.
- Each round: adjust the package, optionally play **one** Koz, press "Teklif Et".
  - `C ≤ K` → accepted.
  - else patience −1 (−2 if C > 1.35·K: "hakaret"), the director gives a **tell** (5 levels by gap:
    ≤5%, ≤12%, ≤22%, ≤35%, >35%; each with a face + line) and a **counter-package** costing
    `K·(0.80 + 0.05·round)` — counters creep upward, so they leak information.
  - You may accept his counter, or walk away (no penalty). Patience 0 → he leaves: trust −10,
    that club is on cooldown for this player for 3 months.
- Director personas (`club.director.persona`): `durust` (true tells), `kurnaz` (tell shown one
  level angrier than reality unless trust ≥ 60 or table upgrade ≥ 2), `cimri` (K −8%, patience 6),
  `sabirsiz` (K +8%, patience 3), `gosterisci` (K +12% for players with hype ≥ 60, else −3%).
- **The client must agree too.** `satisfaction` 0..100 from wage vs his demand, bonus, expected
  minutes vs trait, dream match, league prestige. ≥ 50 → signs. 40..49 → you can lean on him
  ("İkna et": loyalty −8). Shown live as you move sliders. If your fee is > 12% of the package
  cost the client notices: loyalty −5 (warned in UI). **Wage vs. your fee vs. the ceiling is the
  three-way tension — never remove it.**
- **Koz cards** are generated from real state at table open (max 4 in hand, one per round):
  `rakip` (another club has interest ≥ 50: K +12%), `formda` (avg rating ≥ 7.2 over last 4 apps:
  K +8%), `taraftar` (hype ≥ 60: patience +1, K +4%), `sozlesme` (free/expiring: K +6%),
  `dostluk` (trust ≥ 60: reveals a band K ±8% and patience +1), `songun` (deadline day & club need
  high: K +10%), `blof` (always available when `rakip` is not: K +10% with a **shown** risk
  `15% + 8%·director.info − 5%·tableUpgrade`; caught → patience −2, trust −15, rep −2).
  Bluff is the only dice in the mini-game and its odds are always visible.

### Son Gün (deadline day)
Triggered when the player presses "Ayı Oynat" in Ağustos or Ocak. Six hourly slots 18:00…23:00,
one action per hour (two with the top `network` upgrade): take one of the incoming **panic calls**
(clubs with an unfilled need bid for your clients; each call has an expiry hour), run a quick Masa
(patience −1, K +10..25% by need, `songun` Koz), or pitch. At midnight everything open collapses
and the month simulation continues. If the player has no clients/interests it is skipped.

### Rivals
4 named rival agencies with personas: `kopekbaligi` (poaches unhappy clients), `akademisyen`
(snipes young prospects — heat rises faster on U21s), `eskidost` (fair, slow), `holding` (rich,
goes after stars). They hold portfolios (`player.agentId`), sign prospects when heat hits 100,
approach your clients whose loyalty < 35 (inbox event: match with a promise / pay a loyalty bonus
/ let go). **Ranking**: agencyScore = Σ(client value · 0.08) + cash·0.5 + rep·50_000, computed for
all five every month; shown as a ladder.

### Office upgrades (3 branches × 4 levels, cost € + monthly upkeep)
- `scout` Gözlem: L1 trips reveal 4 prospects; L2 starting knowledge +15; L3 passive discovery
  each month; L4 heat rises 30% slower on your shortlist.
- `table` Masa: L1 +1 patience; L2 kurnaz tells are true; L3 `blof` risk −10% and 5 Koz in hand;
  L4 see the ceiling band (±15%) at table open.
- `network` Ağ: L1 +1 energy; L2 lunches give +15 trust and loyalty decays slower; L3 +1 energy;
  L4 two actions per deadline hour.

### Season objectives
In July pick 1 of 3 offered goals (safe / balanced / bold) with rep/cash rewards, e.g.
"€300K komisyon kazan", "2 genç yetenek imzala", "Bir oyuncunu üst lige taşı", "Hiç söz bozma".

### Start
One onboarding screen: agent name, agency name, archetype — `mahalle` (Mahalle Abisi: loyalty
+, recruit bonus on Turkish youngsters, starts with a local gem), `eskifutbolcu` (Eski Futbolcu:
all club trust +15, rep +8), `hukukcu` (Hukukçu: +1 patience, client-noticed fee threshold 15%).
Start: cash €60K, rep 12, 3 clients in Türkiye (1 gem aged 17 with a wide band, 2 journeymen
CA 55–60), office upkeep €4K/month. The first months are a **playable tutorial** driven by scripted
inbox cards (first visit, first scout trip, first negotiation) — no wall of text.

---

## 3. Architecture

```
kulis/
  index.html             dev entry (ES modules, <link> per CSS file) — served statically
  build.mjs              esbuild → dist/kulis.html (single self-contained file, CSS+JS inlined)
  src/engine/            PURE: no DOM, no Date, no Math.random, no globals. Deterministic per seed.
  src/ui/                Preact + htm (vendored at src/ui/vendor/preact-htm.js), no other deps
  tests/*.test.mjs       node --test
  tools/bot.mjs          headless auto-player for balance & crash testing
```

### Engine rules
- State `S` is one plain JSON-serialisable object (no classes, Maps, Sets, functions, undefined).
- All randomness through `rng.js` with the generator state stored in `S.rng`.
- Engine functions **mutate S in place** and return a `Result`:
  `{ ok: true, events: [...] }` or `{ ok: false, error: 'türkçe kısa mesaj' }`.
  `events` are plain objects `{type, ...}` the UI turns into toasts/animations.
- Never throw for player mistakes (return `ok:false`); throw only for programmer errors.
- Every balance number lives in `constants.js` as `BAL.*` — no magic numbers in logic.
- All Turkish strings produced by the engine (event texts, tells, news) live in `data/` modules.

### State shape (authoritative)
```js
S = {
  v: 1, seed, rng,                       // rng: uint32 generator state
  meta: { agentName, agencyName, archetype, careerSeasons },
  time: { season: 1, month: 0, phase: 'plan' },   // phase: 'plan' | 'deadline' | 'over'
  agency: {
    cash, rep, energy, energyMax,
    upgrades: { scout: 0, table: 0, network: 0 },
    loan: null,                          // { principal, monthly, monthsLeft }
    negMonths: 0, loanOffered: false,
    stats: { deals: 0, commission: 0, promisesKept: 0, promisesBroken: 0, bluffsCaught: 0, dreams: 0 },
  },
  ledger: [ { season, month, items: [ { k, label, amt } ], net } ],        // last 24 months
  leagues: { [id]: { id, name, country, prestige, clubIds: [], fixtures: [ [ [homeId, awayId] ] ],
                     matchday: 0, table: { [clubId]: { p, w, d, l, gf, ga, pts } }, champions: [] } },
  clubs: { [id]: { id, name, short, leagueId, colors: [c1, c2], crest: 0..5,
                   budget, wageBudget, facilities: 1..5, youthTrust: 1..5,
                   director: { name, persona, info: 0..3 },
                   trust: 0..100, needs: [ { pos, level: 1..3 } ], lunchKnown: false } },
  players: { [id]: { id, name, age, nat, pos, ca, pa, form, trait, dream: { type, target, done },
                     clubId, wage, contractEnd, value, hype, injured: 0,
                     guarantee: false, releaseClause: 0,
                     st: { apps, mins, goals, assists, ratingSum, last: [ratings…max 4] },   // this season
                     career: [ { season, clubId, apps, goals, avg } ],
                     agentId: null | 'you' | rivalId,
                     rep: null | { commissionPct, endSeason },
                     loyalty: 50, morale: 60,
                     know: 0, seen: false, heat: 0, shortlisted: false, dreamKnown: false,
                     lastVisit: null } },
  rivals: [ { id, name, agency, persona, rep, cash, color, score } ],
  inbox: [ { id, key, kind, title, body, from, playerId, clubId, must: false, expiresIn: 2,
             options: [ { id, label, hint, cost: { energy, cash }, risk: null | { pct, text } } ] } ],
  promises: [ … ],
  interests: [ { id, playerId, clubId, level, kind: 'transfer' | 'free' | 'renewal', cooldown: 0 } ],
  negotiation: null | { … },             // owned by negotiation.js
  deadline: null | { … },                // owned by deadline.js
  objectives: { offered: [], active: null, history: [] },
  news: [ { season, month, kind, text, playerId, clubId } ],               // newest first, max 80
  deals: [ { season, month, playerId, fromClubId, toClubId, fee, commission, kind } ],
  ranking: [ { id, name, score } ],      // 5 agencies, sorted desc; id 'you' for the player
  history: [ { season, rank, cash, rep, clients, champions: { [leagueId]: clubId }, awards: [] } ],
  flags: { tutorial: 0, seen: {} },
  ending: null | { kind, rank, legacy, epilogues: [] },
}
```

### Engine modules (file → owner phase → exports)
Foundation (phase 1):
- `rng.js` — `seedRng(S, seed)`, `rnd(S)`, `rint(S,a,b)`, `pick(S,arr)`, `chance(S,p)`, `gauss(S,m,sd)`, `shuffle(S,arr)`, `uid(S,prefix)`.
- `constants.js` — `BAL`, `MONTHS` (names, window, matchdays), `POS`, `TRAITS`, `DREAMS`, `PERSONAS`, `ARCHETYPES`.
- `data/names.js`, `data/clubs.js` — name pools per nationality, 60 fictional clubs with colours.
- `world.js` — `createWorld(S)`; `fixtures.js` — round robin; `match.js` — `playMatchday(S, leagueId)` → results; `selection.js` — line-ups/minutes; `development.js` — `developMonth(S)`; `valuation.js` — `playerValue(S,p)`, `fairWage(S,p,leagueId)`, `refreshValues(S)`.
- `effects.js` — `applyEffects(S, effects, ctx)` → events. Effect primitives used by inbox options
  and others: `{cash}`, `{rep}`, `{energy}`, `{loyalty, playerId}`, `{morale, playerId}`,
  `{trust, clubId}`, `{hype, playerId}`, `{form, playerId}`, `{injure, playerId, months}`,
  `{know, playerId}`, `{promise: {...}}`, `{interest: {playerId, clubId, level}}`, `{news: {...}}`,
  `{flag: key}`, `{releaseClient: playerId}`.
- `economy.js` — `monthlyEconomy(S)` (ledger, loan, bankruptcy check), `spend(S, amt, k, label)`, `earn(S, amt, k, label)`.
- `season.js` — `endSeason(S)` (table awards, promotion/relegation, ageing, retirements, youth
  intake, contract expiries/renewals for AI players, history row, new fixtures).
- `turn.js` — `advanceMonth(S)` orchestrator (order in §4) → `MonthReport`.
- `selectors.js` — read-only helpers: `myClients(S)`, `clubOf(S,p)`, `leagueOf(S,club)`,
  `potentialBand(S,p)` → `{lo, hi}`, `minutesShare(S,p)`, `tableSorted(S,leagueId)`,
  `isWindowOpen(S)`, `monthName(S)`, `canAfford(S, cost)`, `avgRating(p)`.
- `game.js` — facade: `newGame(opts)` → S, `act(S, actionId, payload)` → Result,
  `advance(S)` → MonthReport, `serialize(S)`, `deserialize(json)`. **The UI only imports
  `game.js`, `selectors.js` and `constants.js`.**

Agency systems (phase 2a): `scouting.js`, `clients.js` (recruit, visit, loyalty/morale drift,
dreams), `promises.js`, `upgrades.js`, `rivals.js` (heat, poaching, AI portfolios, ranking),
`objectives.js`.

Market (phase 2b): `market.js` (needs, interest, AI transfers, pitch, lunch, media, executing a
transfer: move, fee, commission, fit effects), `negotiation.js`, `deadline.js`.

Narrative (phase 2c): `events.js` (inbox deck: conditions, generation, expiry, `answerInbox`),
`data/events.js` (≥ 40 Turkish event templates), `news.js` + `data/news.js` (headline generator),
`tutorial.js` (scripted first-months cards), `ending.js` (legacy score, ranking tier, epilogues),
`data/tells.js` (director lines per persona × tell level — exported for negotiation.js).

The foundation phase creates **stub files** for every later module with the exact export names
used by `turn.js`/`game.js` (no-op bodies + JSDoc), so later phases only fill in their own files.

### 4. `advanceMonth(S)` order
1. Guards: active negotiation → `ok:false`; any inbox card with `must:true` → `ok:false`.
2. If month ∈ {1, 6} and phase is `plan` and deadline not yet played this month →
   `deadline.start(S)`; if it started, return `{ok:true, phase:'deadline'}` (UI runs Son Gün; when
   it ends, `deadline.finish(S)` sets a flag and the UI calls `advance` again).
3. Matchdays for the month (all leagues) → results, stats, form.
4. `developMonth`, `refreshValues`.
5. `market.monthly` (needs, interest, AI transfers in windows).
6. `clients.monthly` (morale/loyalty drift, dreams), `promises.check`.
7. `rivals.monthly` (heat, signings, poaching approaches, ranking).
8. `scouting.monthly` (passive discovery).
9. `monthlyEconomy` (ledger; bankruptcy → phase `over`, ending kind `iflas`).
10. `events.monthly` (expire, then generate next month's inbox), `objectives.check`.
11. If month == 11: `endSeason(S)`; season++ ; if season > careerSeasons → `ending.build(S)`,
    phase `over` (endless mode flips it back). Else month++. Refill energy.
12. Return `MonthReport { ok, season, month, matchdays: [ { leagueId, md, results: [ { home, away, hg, ag,
    scorers: [ { playerId, minute, clubId } ] } ] } ], clients: [ { playerId, apps, mins, goals,
    assists, rating, caDelta, valueDelta } ], finance: { items, net, cash }, news: [], promises: [],
    rivalMoves: [], seasonEnd: null | {…}, ending: null | {…} }`.

### UI
- Preact + htm, hash router, one global store (`store.js`): holds `S`, `act(id, payload)`,
  `advance()`, subscribe; autosave to `localStorage['kulis-save-v1']` after every successful
  action (wrapped in try/catch — storage may be unavailable), export/import JSON.
- Mobile-first. Content column max 560px, centred; ≥ 900px may use two columns. Touch targets ≥ 44px.
- Bottom nav, 5 tabs: **Gündem** (hub: inbox cards, energy, "Ayı Oynat"), **Oyuncular** (clients),
  **Keşif** (scouting, shortlist, recruit), **Piyasa** (interest/offers, clubs, tables),
  **Ajans** (upgrades, finance, ranking ladder, objectives, news).
- Full-screen overlays: Masa (negotiation), Son Gün, month playback, signing ceremony, season end,
  ending, onboarding.
- Art direction — **"gece maçı"**: near-black pitch green base, floodlight glow, chalk-line motifs,
  big condensed numerals, warm gold for money, lime for positive. Tokens:
  `--bg:#0A0F0C; --surface:#121A15; --raised:#1A2620; --line:#26352D; --text:#EEF4EF;
  --muted:#8DA397; --lime:#3DDC84; --gold:#F5C451; --danger:#FF5D5D; --info:#5AB0FF; --rival:#B48CFF`.
  Procedural SVG player avatars (deterministic from id) and club crests (from `colors`+`crest`).
  No emoji as icons — inline SVG icon set. Respect `prefers-reduced-motion`.
- Audio: WebAudio-synthesised SFX only (no audio files), muted by default until first user gesture,
  toggle in settings.
- No inline `onclick` strings, no `innerHTML` with game data.

### Quality bar
- `npm test` green; `npm run sim` plays full careers on many seeds without exceptions.
- A new player must reach their first negotiation within ~5 minutes and understand why they won
  or lost it.
- Every number the player is asked to gamble on is visible (costs, odds, meters).
