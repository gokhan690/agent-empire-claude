# KULİS engine — UI-facing API

The UI imports only `game.js`, `selectors.js`, `constants.js`. All text the engine returns is Turkish. Money is whole €.
`S` is plain JSON (`serialize(S)` / `deserialize(json)`, save version `SAVE_VERSION` = 2; older saves are rejected), mutated in place by `act` / `advance`. Never throw on player mistakes: failures are `{ok:false, error:'Türkçe mesaj'}`.

```js
import { newGame, act, advance, serialize, deserialize, ACTION_IDS } from '../engine/game.js';
import * as sel from '../engine/selectors.js';          // read-only views, safe every render, no RNG
const S = newGame({ seed, agentName, agencyName, careerSeasons: 5 });   // careerSeasons defaults to BAL.careerSeasons (5)
```

## 1. The game in one sentence
Find players, sign them, sell them to bigger clubs at the table, take your cut, grow your agency.
Month = one turn: spend **Enerji** (4, 5 with "Büyük ofis"; every action costs exactly 1), then `advance`. 12 months × 5 seasons.

## 2. Actions (`act(S, id, payload)` → `{ok:true, events:[…], …extras}` | `{ok:false, error}`)
| id | payload | cost | result extras |
|---|---|---|---|
| `searchPlayers` | `{}` | 1E | `candidates:[playerId]` (3, or 4 with "Gözlemci ağı"); they are added to `S.found` (newest first, max 6) |
| `watchPlayer` | `{playerId}` | 1E | potential becomes exact (`know=100`) |
| `signPlayer` | `{playerId}` | 1E | needs `S.agency.rep ≥ sel.repNeeded(p)`; no dice |
| `releaseClient` | `{playerId}` | free | – |
| `pitchPlayer` | `{playerId, clubId}` | 1E | `offer:boolean`, `interestId`. A club whose appetite is high enough ("İlgilenir") makes an offer at once; "Belki" warms up; "Zor" barely moves |
| `openNegotiation` | `{interestId}` | 1E | `negotiation` (= `negotiationView`) |
| `negPreview` | `{package:{wage,fee}}` | – | `{preview:{cost, hint:'Yüksek'\|'Orta'\|'Düşük', happy, greedy, feeSharePct, transferFee, error?}}` |
| `negPropose` | `{package:{wage,fee}}` | patience | see §4 |
| `negAcceptCounter` / `negWalkAway` | `{}` | – | – |
| `buyUpgrade` | `{upgradeId}` | € | one of `BAL.upgrades` (≤ 6) |
| `answerInbox` | `{inboxId, optionId}` | per option | `resultText`, `title` |
| `skipGuide` | `{}` | – | – |
| `takeLoan` | `{}` | – | only after the bank offer |
| `continueEndless` | `{}` | – | after a finished career that was not `iflas`/`yalniz` |

While `S.time.phase==='over'` every action fails except `continueEndless`. A failed action never costs anything. `events` are for toasts/animation (`signed scout watch pitch tableOpen tell dealDone feeNoticed directorLeft walkAway upgrade effect …`); unknown types: ignore.
There is no Son Gün, no transfer window (offers can be answered in any month), no promises, no traits/dreams, no lunch/media/visit, no Koz/bluff, no clauses, no free agents / pre-contracts / renewal tables (contracts of clients are renewed automatically in June).

## 3. Reading state (selectors)
- `sel.hubSummary(S)` → `{season, seasons, month, monthName, phase, energy, energyMax, cash, rep, rank, rankScore, clients, offers, monthlyCommission, upkeep, loan, negMonths, loanOffered, goal:{title,kind,progress,target,status:'active'|'done'|'failed',reward}|null, guide:{step:'search'|'pitch'|'deal',title,text,index,total}|null, card:EventCard|null, advanceBlock, alert, noClients}`.
- `sel.clientList(S)` → rows `{id,name,age,pos,stars,value,mood,moodTone:'good'|'mid'|'bad',moodWord,injured,clubName,offers}` (value desc).
- `sel.clientView(S,id)` → dossier `{id,name,age,pos,stars,potential:{lo,hi,exact},club,league,value,wage,contractEnd,contractYearsLeft,mood,moodTone,moodWord,injured,form,minutesShare,avgRecent,offers:[offer]}`.
- `sel.candidateList(S)` → `S.found` still unsigned: `{id,name,age,pos,clubName,leagueName,stars,potential:{lo,hi,exact},watched,value,repNeeded,canSign,block}`. **Stars**: `sel.starsOf(ca)` = 1 (<50) … 5 (80+). Potential of an unwatched player is a range 2–3 stars wide (`lo<hi`) that always contains the truth; after `watchPlayer` it is exact (`lo===hi`, `exact:true`).
- `sel.offerList(S[,playerId])` → negotiable interests (level ≥ 60, no cooldown) `{id,playerId,playerName,pos,clubId,clubName,colors,crest,leagueName,level,fee,wage,plays,playsWord:'İlk 11'|'Yedek'|'Kadro dışı'}` best first.
- `sel.pitchOptions(S,playerId,limit)` → clubs to pitch to `{clubId,name,leagueName,prestige,fit:'İlgilenir'|'Belki'|'Zor',needs:[pos],cooldown,offered}`.
- `sel.clubList(S,leagueId)`, `sel.clubView(S,clubId)` (needs, your clients' fit), `sel.rankingView(S)` (5 agencies), `sel.agencyView(S)` (`{name,cash,rep,income,upkeep,loan,ranking,upgrades:[{id,name,text,price,owned,canAfford}],goal}`), `sel.negotiationView(S)`.
- Also: `sel.myClients`, `sel.myRank`, `sel.tableSorted`, `sel.monthName`, `sel.potentialStars`, `sel.repNeeded`, `sel.signLevel`, `sel.hasUpgrade`, `sel.energyMaxFor`, `sel.monthlyCommission`, `sel.officeUpkeep`.

## 4. The Masa (negotiation)
1. A suitor is an offer (`offerList`). `act('openNegotiation',{interestId})` costs 1 energy; `advance` is blocked while `S.negotiation` exists.
2. `sel.negotiationView(S)` → `{id,interestId,playerId,clubId,fromClubId,round,patience,patienceMax:3,fair:{wage,years,bonus,fee},years,bonus,minWage,limits:{wage:[lo,hi],fee:[lo,hi]},transferFee,demandWage,package,counter:{package,cost}|null,lastTell:{level,face,line}|null,log,first,openLine}`. The director's ceiling lives in `S.negotiation.hidden` and is **never** readable by the UI.
3. **Two sliders only**: the player's monthly `wage` (from `minWage` — he refuses less — to `limits.wage[1]`) and your commission `fee` (lump sum, € ≥ 0). `years` and signing `bonus` are filled by the engine from the club's fair package whenever the UI omits them.
4. `negPreview` → `hint` "Kabul şansı": `Yüksek` = surely accepted (cost ≤ 96 % of the ceiling), `Düşük` = surely refused (> 110 %), `Orta` = could go either way. The exact ceiling is never shown. `happy` = wage ≥ 112 % of his ask; `greedy` = commission > 17 % of the package (the client's mood drops when you close such a deal).
5. `negPropose({package:{wage,fee}})` → `{ok, outcome, round, patience, tell?, counter?, line, events}`:
   - `accepted`: the deal is executed; `events[0]` is `dealDone {playerId,fromClubId,toClubId,fee,commission,wage,years,bonus,repGain,expectedMinutes}` (+`feeNoticed`). Play the ceremony.
   - `countered`: patience −1; `tell {level 0..4, face:'smile'|'neutral'|'frown'|'angry'|'stand', line}`; `counter {package:{wage,fee,years,bonus},cost}` (cost ≤ the ceiling and wage ≥ `minWage`: accepting it always closes the deal).
   - `left`: patience reached 0 (**hard cap 3 rounds**): trust −10, 3-month cooldown on that offer; table closed.
   `negAcceptCounter` → `{outcome:'accepted', …}`. `negWalkAway` closes without penalty. Every table can be closed at its minimum (min wage + a small fee). The very first table of a game is generous (ceiling ≥ 112 % of the fair package).

## 5. advance(S) → MonthReport
Blocked by an open table or `phase==='over'`. Otherwise
`{ok, season, month, matchdays:[…], clients:[{playerId,apps,mins,goals,assists,rating,caDelta,valueDelta}], finance:{items,net,cash}, news:[…], rivalMoves:[{type:'rival',rivalId,text,playerId?,sniped?}], events:[…], seasonEnd:null|SeasonEnd, ending:null|Ending}`.
Report `events`: `interest {interestId,playerId,clubId,level}` (new suitor), `aiTransfer`, `loanOffer`, `inboxNew`, `goal {status:'done'|'failed',title,reward}`, `clientLeft {name}`, `retire`, `renewed`, `noClients {left}`.
`SeasonEnd` (June): `{season, champions:{leagueId:clubId}, promoted, relegated, retired, released, renewed, awards, clientEvents}`; `S.history` gets `{season,rank,cash,rep,clients,champions,awards}`; the next season's goal is assigned.

## 6. Inbox (Gündem), goal, guide
- `S.inbox` holds 0 or 1 card per month: `{id,key,title,body,playerId,clubId,amount,options:[{id,label,cost:{energy,cash}}]}` — ≤ 2 options, ≤ 2 short sentences, always a free option. Unanswered cards simply vanish at month end (no hidden penalty). The bank's `loan` card appears the first time cash goes negative.
- Goal: exactly one per season, auto-assigned (`deals`, `clients`, `commission`, `rank`), shown on one line; reward €40K + 4 rep when completed, no penalty when missed.
- Guide: `hubSummary.guide` = the first open of 3 steps (`search` → `pitch` → `deal`), driven by the real actions; `skipGuide` ends it.

## 7. Rules that matter
- **Mood** (`p.mood` 0–100, the only client feeling): drifts with minutes played, form, wage vs fair, injuries; +8 for a generous wage at a deal, −8 for a greedy commission. Low mood slows development; mood ≤ 15 → the client leaves you.
- **Money**: you earn 7 % of every client's wage each month (10 % with "Avukat") plus the commission of each deal; office upkeep grows with clients, upgrades and reputation. Cash < 0 for 3 month ends → bankruptcy (one bank loan is offered first). Zero clients for 3 month ends → `yalniz`.
- **Rivals** (4 agencies) hold portfolios, sign unseen players in the background, may snipe a candidate you found but did not sign (flat 14 %/month, no meters) and are ranked against you (`rankingView`).
- **Ending**: after June of season 5 (or bankruptcy / no clients) `report.ending` and `S.ending = {kind:'efsane'|'buyuk'|'saygin'|'siradan'|'iflas'|'yalniz', rank, legacy, title, text, stats, epilogues, careerOver:true}`; `phase==='over'`. `continueEndless` (not after `iflas`/`yalniz`) removes the season cap.

## 8. State fields: may read / must not read
May read (preferably through selectors): `S.time`, `S.meta`, `S.agency` (cash, rep, energy, energyMax, upgrades, loan, stats), `S.leagues[*]`, `S.clubs[*]` (name, colors, crest, leagueId, needs, director.name), `S.players[*]` basic fields (`name age nat pos ca form injured clubId wage contractEnd value hype st`) and, for your clients, `mood`, `S.found`, `S.inbox`, `S.news`, `S.deals`, `S.ranking`, `S.history`, `S.goal`, `S.rivals`, `S.ending`.
Must NOT read: `S.negotiation.hidden`, `p.pa`, `p.cf`, `S.rng`, `S.seed`, `S.seq`, `S.flags` (internal; guide/goal come via `hubSummary`), `S.interests[*].boost`.
