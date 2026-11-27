# KULİS — Design & Architecture Contract

KULİS is a mobile-first, Turkish-language football-agent management game. All player-facing text is **Turkish**; code identifiers and comments are English. Fictional clubs and players only.

The core loop must be explainable in one sentence:

> **Find players, sign them, sell them to bigger clubs at the table, take your cut, grow your agency.**

Everything below serves that sentence. If a system does not, it does not exist (an earlier, much bigger version had promises, traits, dreams, bluffing cards, lunches, media pushes, scouting trips, rival heat meters, deadline day, three upgrade trees and eight seasons — all removed after play-testing: "make it more basic").

---

## 1. Game structure

- **Career**: `BAL.careerSeasons` = **5** seasons (one constant). A season is 12 monthly turns (Temmuz … Haziran); a league plays 18 matchdays (0–2 per month). After June of season 5 the game ends with a ranking among 5 agencies, a legacy score and a few epilogues; the player may then continue in endless mode.
- **A turn** (a month): read the Gündem, spend **Enerji** (4; 5 with the "Büyük ofis" upgrade; **every action costs exactly 1**), press **"Ayı Oynat"** → matches are simulated, the world moves, a one-screen month report with one "Devam" button is shown.
- **Lose**: cash < 0 for 3 consecutive month ends → bankruptcy (a one-time bank loan is offered as the first negative month's event card). No clients for 3 month ends → career over (`yalniz`).
- **Win-ish**: the final ranking. Endings `efsane` (rank 1, legacy ≥ 3400), `buyuk` (rank ≤ 2, ≥ 2800), `saygin` (rank ≤ 3, ≥ 1200), `siradan`; `iflas`, `yalniz` are the failure endings. Thresholds were set from bot runs (careful ≈ 3400–4800 legacy, casual ≈ 1600–2500).

### Resources
- **Para** `agency.cash`: in — a lump-sum commission per deal, 7 % (10 % with "Avukat") of every client's wage each month, goal rewards, event windfalls; out — office upkeep (base + upgrades + staff per client above 5 + a reputation-tier term), event prices, upgrade prices, loan instalments.
- **İtibar** `agency.rep` 0..100: gates which players will sign with you and counts for the ranking.
- **Enerji**: refilled every month.
- **Ruh hali** `player.mood` 0..100 — the only client feeling (shown as one dot + word): minutes played, form, wage, injuries; a generous wage at a deal +8, a greedy commission −8; low mood slows development, ≤ 15 → the client leaves.

### World
6 leagues × 10 clubs (Süper Lig, 1. Lig, Hollanda, İtalya, İspanya, İngiltere; fictional names). Squads 18–22, positions `KL DF OS FV`, line-up 1-4-4-2. Bottom 2 of Süper Lig ↔ top 2 of 1. Lig swap each season. Players have `ca` (current, 1..99), hidden `pa` (potential), age, form, a club contract (`contractEnd` = the season whose June ends it; clients are renewed automatically), a market `value` and `wage`. Development: growth toward `pa`, driven by minutes played, club facilities and mood; decline from 30+. **Minutes matter** — the offer list tells you whether he would play ("İlk 11" / "Yedek"). League strength is regulated so the world stays stable over a career.

### Stars (the only level language in the UI)
`1★` CA < 50, `2★` 50–59, `3★` 60–69, `4★` 70–79, `5★` 80+. A player's **potential** is a small range ("3–4 ★") until you spend one "İzle" action on him, then exact. The range is 2–3 stars wide and always contains the truth.

---

## 2. The agent loop (every action = 1 Enerji)
| action | what it does |
|---|---|
| **Oyuncu ara** | 3 new candidates (4 with "Gözlemci ağı") from anywhere in the world, quality tracking your reputation. Candidates wait in a list of at most 6; rivals may sign one you leave alone (14 %/month). |
| **İzle** | the candidate's potential becomes exact. |
| **İmzala** | the candidate becomes your client. Works whenever your reputation ≥ `repNeeded` (≈ (CA + youth premium − 50) / 0.55). No dice; the reason is shown when locked. |
| **Kulübe öner** | pick a club (the picker lists them best fit first: *İlgilenir / Belki / Zor*). An interested club makes an offer at once; a lukewarm one warms up. |
| **Masaya otur** | opens the Masa for an offer. |
| **Yükseltme** | no energy; one price each (see §4). |

Offers also appear on their own every month (clubs with a need at his position). They live in **Piyasa → Teklifler** and decay when ignored.

### Masa — the negotiation
Exactly **two sliders**: the player's monthly **wage** and your **commission** (lump sum). Contract years and signing bonus are the club's suggestion (the engine fills them when the UI omits them); there are no clauses, no cards, no bluffing, no persuasion button.
- The director has a hidden ceiling `K` on the total package cost (`wage·12·years + bonus + fee`), derived from his need, the player's level, the club's budget and a little noise. Every table can be closed at its minimum: the player refuses a wage below `minWage` (≈ what he asks), and `K ≥` the minimum package.
- The UI shows the director's face, **one short line**, **3 patience pips** (hard cap 3 rounds) and one honest line: **"Kabul şansı: Yüksek / Orta / Düşük"** — Yüksek = surely accepted, Düşük = surely refused, Orta = either way; the ceiling itself is never shown.
- Refused → patience −1, a face + line (how far you are) and a **counter-package** you can accept in one tap (it always closes the deal; it cuts your commission first, then the wage, never below the floors). Patience 0 → the director leaves: club trust −10 and a 3-month cooldown on that offer. Walking away is free.
- The client minds a **greedy commission** (> 17 % of the package): mood −8. A generous wage (≥ 112 % of his ask) cheers him up (+8).
- The first table of a career is generous (ceiling ≥ 112 % of the fair package) and the guide leads there.
- Close rates (bots, 32 seeds): a careful player's tables close ~100 % (he takes the counter by round 2), a sloppy one's ~88 %; typical tables take 1–2 rounds, 3 rounds only when the player digs in.

---

## 3. Rivals, goal, events, guide
- **Rivals**: 4 named agencies hold portfolios, sign unseen players in the background, lose some, and are ranked against you every month with `Σ top-10 client values (80 000·√€M) + 0.6·cash + 50 000·rep`. No heat meters, no poaching.
- **Goal**: exactly one auto-assigned goal per season, one line on the hub (sell a player / reach N clients / earn X commission / finish in the top 2). Completing it pays €40K + 4 rep; missing it costs nothing.
- **Events**: at most one Gündem card per month, ≤ 2 choices, ≤ 2 short sentences, always a free choice (~10 templates: sponsor offer, doctor, low mood, press, club president dinner, scout tip, windfall, insurance, social media, conference). Unanswered cards vanish.
- **Guide**: at most 3 short cards on the hub (Oyuncu bul → Kulüp bul → Masaya otur) driven by the real actions; skippable.

## 4. Upgrades (one list, ≤ 6, one-time purchases)
`Büyük ofis` (+1 enerji), `Gözlemci ağı` (4 candidates per search), `Avukat` (10 % instead of 7 % of wages), `Kulüp ağı` (pitches land more easily), `Akademi bağı` (more high-potential candidates), `Marka` (+3 rep every season). Each shows a one-line effect and a price.

## 5. Start
One onboarding screen: agent name + agency name (both with a "Rastgele" button). Start: cash €60K, rep 12, 3 Turkish clients (a 17-year-old with hidden upside and two journeymen), upkeep €4K/month, the guide, and a goal.

---

## 6. Architecture

```
kulis/
  index.html             dev entry (ES modules, <link> per CSS file) — served statically
  build.mjs              esbuild → dist/kulis.html (single self-contained file, CSS+JS inlined)
  src/engine/            PURE: no DOM, no Date, no Math.random, no globals. Deterministic per seed.
  src/ui/                Preact + htm (vendored at src/ui/vendor/preact-htm.js), no other deps
  tests/*.test.mjs       node --test
  tools/bot.mjs          headless bots (passive / casual / sharp / fuzz) for balance and crash testing
  tools/e2e.mjs          Playwright click-through of dist/kulis.html (+ e2e-saves.mjs crafted saves)
```

### Engine rules
- State `S` is one plain JSON-serialisable object. All randomness goes through `rng.js` (state in `S.rng`). Every balance number lives in `constants.js` as `BAL.*`.
- Engine functions mutate `S` and return `{ok:true, events:[…]}` or `{ok:false, error:'türkçe kısa mesaj'}`; they never throw for player mistakes.
- The UI imports only `game.js`, `selectors.js` (read-only views) and `constants.js`. See `src/engine/API.md`.

### Modules
`rng util constants` · `world` (leagues, clubs, squads, the 3 start clients) · `fixtures match selection development valuation` (the simulated football world) · `market` (club needs, interest, AI transfers, **pitch**, executing a transfer) · `negotiation` (the Masa) · `scouting` (search, watch) · `clients` (sign, release, mood) · `rivals` (portfolios, sniping, ranking) · `economy upgrades` · `events` + `data/events` (the monthly card) · `goal` · `guide` · `season` (June: awards, promotion/relegation, ageing, contracts, youth) · `ending` + `data/ending` · `news` + `data/news` (headlines) · `turn` (the monthly orchestrator) · `game` (facade) · `save` (compact JSON, `SAVE_VERSION` 2) · `views` + `selectors` (UI-facing read-only helpers).

### `advanceMonth(S)` order
1. Guard: open table → `ok:false`. 2. Matchdays for all leagues. 3. `developMonth`, `refreshValues`. 4. `market.monthly` (needs, AI transfers in July/August/January, interest in your clients). 5. `clients.monthly` (mood drift, leavers). 6. `rivals.monthly` (sniping, ranking). 7. `monthlyEconomy` (income, upkeep, loan, bankruptcy). 8. `events.monthly` (the one card), `goal.check`, no-clients check. 9. In June `endSeason`, then the next season (goal, "Marka" rep) or the ending. 10. Refill energy.

---

## 7. UI

- Preact + htm, hash router with **plain `#name` routes** (`#hub #players #market`), one global store (`store.js`): `store.act`, `store.advance`, autosave to `localStorage['kulis-save-v2']` after every successful action (try/catch), restore after reload (an open Masa, an unseen season review or the ending come back). No `alert/confirm/prompt`.
- **3 bottom tabs**: **Gündem** (headline, one-line goal, guide card, one event card, offer count, "AYI OYNAT"), **Oyuncular** (your clients — name, position, age, value, one mood dot — and "Yeni oyuncu bul": the search button and the candidate cards), **Piyasa** (offers with "Masaya otur", clubs of each league with what they need). **Ajans** is one scrolling sheet opened from the top bar (rank among the 5 agencies, money, the upgrade list).
- Sheets: player dossier (stars, club, contract end, value, mood, ≤ 3 buttons, fits one phone screen), club picker ("Kulübe öner"), club, agency, settings. Overlays: onboarding, Masa, signing ceremony, month report, season review, ending.
- Art direction — **"gece maçı"**: near-black pitch-green base, floodlight glow, chalk lines, big condensed numerals, warm gold for money, lime for positive. Tokens in `styles/tokens.css`. Procedural SVG avatars and crests, the director's procedural face (5 expressions), confetti, WebAudio sfx (muted until the first gesture), no emoji icons, `prefers-reduced-motion` respected.
- Text diet: a player row shows name, position, age, value and one mood indicator; month report and season review are one screen each; no traits/loyalty/dream breakdowns anywhere.

### Quality bar
- `npm test` green; `npm run sim` plays full careers (≥ 16 seeds per bot) with no exceptions: passive fails (bankrupt in season 2), casual finishes mid-table (rank 3–4) and almost never goes bankrupt, careful finishes rank 1–2 about 94 % of the time.
- A new player reaches the first Masa in their first month (4 energy: search, sign, pitch, table) and understands why they won or lost it.
