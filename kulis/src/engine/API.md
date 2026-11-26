# KULİS engine — UI-facing API

The UI imports only `game.js`, `selectors.js`, `constants.js`. All text the engine returns is Turkish. Money is whole €.
`S` is plain JSON (`serialize(S)` / `deserialize(json)`), mutated in place by `act` / `advance`. Never throw on player mistakes: failures are `{ok:false, error:'Türkçe mesaj'}`.

```js
import { newGame, act, advance, serialize, deserialize, ACTION_IDS } from '../engine/game.js';
import * as sel from '../engine/selectors.js';          // read-only views, safe every render, no RNG
const S = newGame({ seed, agentName, agencyName, archetype: 'mahalle'|'eskifutbolcu'|'hukukcu', careerSeasons: 8|5 });
```

## 1. Result shapes
- `act(S, id, payload)` → `{ok:true, events:[{type,…}], …extras}` | `{ok:false, error}`. Preview ids return `{ok:true, preview:{…}}`.
- `events` are for toasts/animation (`type` ∈ `signed scout watch visit lunch pitch media upgrade inbox tableOpen tell dealDone feeNoticed bluffCaught directorLeft walkAway leaned deadlineHour deadlineEnd negotiationCollapsed loan loanOffer objectiveChosen released shortlist effect …`). Unknown types: ignore.
- While `S.time.phase==='over'` every action fails except `continueEndless`. While `phase==='deadline'` the energy actions `scoutTrip watchPlayer recruit visitClient clubLunch mediaPush` fail ("Son Gün sürüyor…").
- Energy: `S.agency.energy / energyMax` (4, 5 or 6). A failed action never costs anything.

## 2. Actions (`act(S, id, payload)`)
| id | payload | cost | result extras |
|---|---|---|---|
| `tripPreview` | `{leagueId, focus}` | – | preview `{energy:1, cash, count, available, startKnow}` (+`error`) |
| `scoutTrip` | `{leagueId:'tr2'…'en1', focus:'any'\|'u21'\|'form'\|'expiring'}` | 1E + travel € | `prospects:[playerId]` (now `seen`; show via `prospectList`) |
| `watchPlayer` | `{playerId}` | 1E | event `watch {know, delta, traitRevealed, band}` |
| `toggleShortlist` | `{playerId}` | free | event `shortlist {on}` (max 40) |
| `recruitPreview` | `{playerId, promises:[{type}]}` | – | preview `{score, threshold, parts:[{label,value}], thresholdParts, promiseOptions:[{type,label,add,text,due,target,fit,chosen,keepable,blocked,warning}], promiseBonus, canSign, cost, rival, gap}` (+`error`). `fit` = trait fit AND realistically keepable; new optional `keepable` / `blocked` / `warning` (Turkish reason or null): a `blocked` option adds nothing, makes `canSign` false and sets `error` to its `warning` |
| `recruit` | `{playerId, promises:[{type:'minutes'\|'transfer_up'\|'wage'\|'stay'\|'visit'}] ≤3}` | 1E | event `signed {commissionPct,endSeason,promiseIds,fromRival}`; fails with the score gap text |
| `visitClient` | `{playerId}` | 1E (1/client/month) | `line` (what he wants now) |
| `releaseClient` | `{playerId}` | free | – |
| `clubLunch` | `{clubId}` | 1E + € (`clubView.lunch.cash`) | event `lunch {trust, gain, needs, budgetHint}` |
| `pitchPreview` | `{playerId, clubId}` | – | preview `{energy, cash, delta, levelBefore, levelAfter, deadlineAction}` (+`error`) |
| `pitchPlayer` | `{playerId, clubId}` | 1E (on Son Gün: the hour's action) | `delta, interestId` |
| `mediaPush` | `{playerId}` | 1E + € | event `media {hype, cash, value}` |
| `openNegotiation` | `{interestId}` | 1E (Son Gün: the hour's action) | `negotiation` (= `negotiationView`) |
| `negPreview` | `{package, koz?}` | – | preview `{cost, satisfaction, satisfactionParts, feeSharePct, feeWarning, clientOk, clientLean, transferFee, expectedMinutes, demandWage, promiseChecks:[{id,type,text,ok,note}]}` (+`error`); `promiseChecks` (new, optional) lists open wage/stay promises this package would keep (`ok`) or break |
| `negPropose` | `{package, koz?:'rakip'\|…}` | patience | see §4 |
| `negAcceptCounter` / `negWalkAway` / `negLeanOnClient` | `{}` | – | see §4 |
| `upgradePreview` | `{branch:'scout'\|'table'\|'network'}` | – | preview `{name, level, nextLevel, maxed, cost, upkeep, upkeepDelta, text, currentText, canAfford}` |
| `buyUpgrade` | `{branch}` | € | event `upgrade` |
| `answerInbox` | `{inboxId, optionId}` | per option | `resultText, riskFired, title` |
| `chooseObjective` | `{objectiveId}` | free | – |
| `deadlineTakeCall` / `deadlineSkipHour` / `deadlineFinish` | `{callId}` / `{}` / `{}` | – | see §5 |
| `takeLoan` | `{}` | – | only after the bank offer (`hub.loanOffered`) |
| `continueEndless` | `{}` | – | only after a finished career that was not `iflas`/`yalniz` |

Package: `{wage (monthly €), years 1..5, bonus, fee (your commission, lump sum), clauses:{minutes:bool, release:bool}}`; bounds in `negotiation.limits`.

## 3. Reading state (selectors)
`sel.hubSummary(S)` → `{season, seasons, month, monthName, window, deadlineMonth, phase, energy, energyMax, cash, rep, rank, rankScore, clients, inbox, must, openInterests, monthlyCommission, upkeep, loan, negMonths, loanOffered, objective, objectivesOffered, tutorialStep, advanceBlock, alerts:[{kind,text,playerId?}]}`. `advanceBlock` is the Turkish reason "Ayı Oynat" is disabled (or null).
`sel.clientList(S)` → rows `{id,name,age,pos,ca,form,value,loyalty,morale,injured,clubId,clubName,minutesShare,openPromises,interestCount,trait,hasPreContract}`.
`sel.clientView(S,id)` → full dossier `{…, trait/traitLabel, dream:{type,label,text,target,done}, wage, fairWage, wageRatio, value, hype, morale/loyalty (+Word), club, league, minutesShare, expectedShare, avgRating, avgRecent, stats, career, band:{lo,hi,width}, contractEnd, contractYearsLeft, preContract, rep:{commissionPct,endSeason}, promises:[{…, progress:{value,target,text}}], interests, visitedThisMonth, flags:{expiring,freeAgent,unhappy}}` (null if not your client).
`sel.prospectList(S,{shortlistedOnly?,leagueId?})` → discovered, recruitable players `{id,name,age,nat,pos,ca,form,hype,value,clubName,leagueName,contractEnd,know,band,trait|null,dream|null,heat,heatPerMonth,shortlisted,level,rival:{id,agency}|null,score,threshold,canSign,gap}`. `trait` appears at know≥60, `dream` at ≥85; `band` always contains the true potential.
`sel.clubView(S,id)` / `sel.clubList(S,leagueId)`; `needs`, `director.persona`, `budgetHint` are `null` until `lunchKnown` (reset every July).
`sel.interestList(S[,playerId])` → your clients' interests `{id,playerId,clubId,level,kind:'transfer'|'free'|'renewal',cooldown,negotiable,reason,clubName,playerName,fitSat,fitWord,expectedMinutes}`. `negotiable` = level≥60 and window/contract rules satisfied; `reason` is Turkish when not (also when an open `stay` promise would be broken by the move); `fitSat<40` = the client will refuse a realistic package ("Reddeder").
`sel.financeSeries(S)` (oldest first `{season,month,label,net,cash,items:[{k,label,amt}]}`), `sel.rankingView(S)` (5 rows `{rank,id,name,owner,score,isYou,personaLabel,rep,clients,color}`), `sel.upgradeView(S)` (3 previews), `sel.objectiveView(S)` (`{offered,active:{progress,target,pct,reward,failed,endOnly,…},history}`), `sel.deadlineView(S)`, `sel.negotiationView(S)`, `sel.tableSorted(S,leagueId)`, `sel.monthName(S)`, `sel.isWindowOpen(S)`, `sel.myClients(S)`, `sel.upgradeEffects(S)`.
`sel.availableActions(S,{playerId?,clubId?})` → `[{id,label,payload,cost:{energy,cash},ok,reason}]`; `{playerId}` of a client → visit/media/(pitch with `clubId`)/release, of a prospect → watch/recruit/shortlist, `{clubId}` → lunch, `{}` → scout trip per league, upgrades, loan. `reason` is the Turkish disabled text ("Enerjin yok", "Bu ay zaten ziyaret ettin", "Yeterli paran yok", …).
Also: `sel.advanceBlock`, `sel.potentialBand`, `sel.minutesShare`, `sel.avgRating`, `sel.canAfford`, `sel.deadlineCalls`.

## 4. The Masa (negotiation)
1. `interestList` → pick a `negotiable` row → `act('openNegotiation',{interestId})`. `S.time.phase` stays; `advance` is blocked while `S.negotiation` exists.
2. Render `sel.negotiationView(S)`: `{id,interestId,kind,kindLabel,playerId,clubId,fromClubId,round,patience,patienceMax,insults,fair,limits:{wage:[lo,hi],years,bonus,fee},transferFee,demandWage,feeThreshold,hand:[Koz],package,counter,lastTell,ceilingBand:{lo,hi,source}|null,pending,log,deadline}`. Koz = `{id:'rakip'|'formda'|'taraftar'|'sozlesme'|'dostluk'|'songun'|'blof',label,text,effect,kPct,patience,risk:null|pct,clubId?,used}`; one per round; `blof` shows its real catch chance in `risk`.
3. Sliders → `negPreview` each change (client mood `satisfaction` 0..100: ≥50 signs, 40..49 "İkna et", <40 refuses; `feeWarning` when your fee share > `feeThreshold`).
4. "Teklif Et" → `negPropose({package, koz})` → `{ok, outcome, round, patience, tell?, counter?, insult?, koz?, line, events}`:
   - `accepted`: deal executed; `events[0]` is `dealDone {playerId,fromClubId,toClubId,fee,commission,wage,years,kind,bonus,preContract,repGain,expectedMinutes,fit:{morale,loyalty,notes[]},clauses}` (+`feeNoticed`). Table is closed → play the ceremony.
   - `countered`: `tell {level 0..4, face:'smile'|'neutral'|'frown'|'angry'|'stand', line}`, `counter {package,cost,satisfaction,clientOk,clientLean}`, `insult` (patience −2). Counters creep upward with `round`; a counter never cuts your `fee` below `BAL.neg.feeFloor` unless your own offer asked for less.
   - `hesitates`: club said yes but client satisfaction 40..49 → `negLeanOnClient` (loyalty −8) signs, or change the package.
   - `left`: patience 0 / bluff caught at 0 → director walked (`directorLeft`, trust −10, 3-month cooldown); table closed.
   - Client refusal (<40) is `ok:false` with a message; nothing is spent.
5. `negAcceptCounter` → `{outcome:'accepted'|'hesitates', …}` (same as above). `negWalkAway` closes without penalty. `S.negotiation.hidden` (ceiling) is **never** readable by the UI.
`feeThreshold` shrinks on very big packages (up to half the base 12 %/15 %). Promise rules (keepable types, `minutes` window restart, `stay`): see DESIGN.md §Promises.
Kinds: `transfer` (window open or Son Gün), `free` (pre-contract from January for a client whose contract ends this season → commission now, move at season end; or a clubless free agent), `renewal` (contract ends this season, from October). There is no sponsor table.

## 5. Son Gün (deadline day) — Ağustos & Ocak
1. `advance(S)` in month 1 or 6 → `{ok:true, phase:'deadline', season, month}` **only if** there are panic calls or an open transfer interest, else the month simply plays. `S.time.phase==='deadline'`.
2. `sel.deadlineView(S)` → `{hour 18..23, hoursLeft, actionsLeft, actionsMax(1|2), ended, deals, calls:[{id,clubId,clubName,playerId,playerName,fromHour,expiresHour,level,taken,available,kind,fitSat,fitWord,expectedMinutes}], log, hasTable, interests}`.
3. Per hour: `deadlineTakeCall({callId})` (opens a quick table: patience −1, K +3..9 %, `songun` Koz; result like `openNegotiation`), or `openNegotiation({interestId})`, or `pitchPlayer`, or `deadlineSkipHour`. Each uses the hour's action (two with network L4); the hour advances automatically (`deadlineHour` event). A table opened stays playable even when the clock passes 23:00.
4. When `deadlineView.ended` (or any time) → `act('deadlineFinish')` collapses open talks (`negotiationCollapsed`), clears `S.deadline`, sets phase `plan` → call `advance(S)` again for the month report. `deadlineFinish` outside Son Gün fails.

## 6. advance(S) → MonthReport
Blocked (`{ok:false,error}`) by an open table, a `must` inbox card, `phase` deadline/over. Otherwise
`{ok, season, month, matchdays:[{leagueId, md, results:[{home,away,hg,ag,scorers:[{playerId,minute,clubId,assistId}]}]}], clients:[{playerId,apps,mins,goals,assists,rating,caDelta,valueDelta}], finance:{items:[{k,label,amt}],net,cash}, news:[{season,month,kind,text,playerId,clubId}], promises:[{type:'promise',id,playerId,status:'kept'|'broken',promiseType,text}|{type:'walkout'}], rivalMoves:[{type:'rival',rivalId,text,playerId?,poached?,approach?}], events:[…], seasonEnd:null|SeasonEnd, ending:null|Ending}`.
Month report `events` include `interest {interestId,playerId,clubId,level,kind}` (new ≥60 suitor), `aiTransfer`, `dream`, `clientLeft`, `repRenewed`, `repExpiring`, `inboxNew`, `inboxExpired`, `objective {status:'done'|'failed',title,reward}`, `loanOffer`, `freeAgentPlaced`.
`SeasonEnd` (June, before the counter moves to July of next season): `{season, champions:{leagueId:clubId}, promoted, relegated, retired:[{id,name,age,client}], released, renewed, awards:[{kind:'champion'|'topscorer',leagueId,clubId|playerId,goals?}], clientEvents:[{type:'retire'|'renewed',playerId}]}`. `S.history` gets `{season,rank,cash,rep,clients,champions,awards}`. A new objective set is offered (`S.objectives.offered`).

## 7. Inbox (Gündem)
`S.inbox` cards: `{id,key,kind,title,body,from,playerId,clubId,must,expiresIn,defaultOption,pinned?,ctx,options:[{id,label,hint,cost:{energy,cash},risk:null|{pct,text},preview:[{key,label,value,target:'you'|'player'|'club',playerId,clubId}],summary,riskPreview,riskSummary}]}`. Kinds: `sakatlik form dakika sahne aile medya kulup maas transfer rakip sponsor ajans para kesif banka rehber`. `must` cards block `advance`. Unanswered cards expire after `expiresIn` months and apply `defaultOption` (a free option). 2–4 new cards per month (fewer in the tutorial, ≤8 waiting). `answerInbox` returns `resultText` to show; if `riskFired` the `risk.text` outcome happened. Card keys `tut_*` are tutorial cards (pinned), `poach:<playerId>` rival approach, `repend:<id>` contract renewal, `loan_offer`.

## 8. Flows
- **Start**: `newGame` → 3 clients (gem 17y with wide band, 2 journeymen), `tut_welcome` card, objectives offered (pick one with `chooseObjective`), phase `plan`, July.
- **Tutorial** (`S.flags.tutorial` object; use `hub.tutorialStep`): welcome(answer card) → `visit` (visitClient) → `scout` (scoutTrip) → `market` (clubLunch or pitchPlayer) → `interest` (a guaranteed suitor with an honest director appears in `interestList`, level 72 — open the Masa; this table is slightly generous; the suitor is the club where the client plays most, expected minutes ≥55%, and the fair package is accepted without "İkna et") → promises/ranking cards next months → done. Doing the steps in July leaves 1 energy for the table in the same month. The `skip` option on the welcome card ends it.
- **Month**: read `hubSummary` + inbox → spend energy (`availableActions`) → `advance` → show MonthReport (matchdays ticker, clients, finance, news) → next month. Refill happens at the end of `advance`.
- **Season end**: month 11 `advance` returns `seasonEnd` (awards, promotions, retirements) → show the season-review sheet; `S.time` is now month 0 of the next season. Contracts: your client's club contract ends in June (renewed automatically, or a pre-contract executes, or he may become a clubless free agent until the August deadline). Representation contracts ending in June auto-renew at loyalty ≥55, else a `repend:` card.
- **Ending**: when the last season ends (or bankruptcy: cash<0 three month-ends; or zero clients at a season end from season 2, or zero clients for `BAL.econ.noClientMonthsEnd` month ends in a row (3; a `no_clients` inbox card, kind `ajans`, warns in each such month; counter `S.agency.noClientMonths`)) `report.ending` and `S.ending` = `{kind:'efsane'|'buyuk'|'saygin'|'siradan'|'iflas'|'yalniz', rank, legacy, title, text, stats:[{label,value,raw?}], epilogues:[{playerId,name,tone:'good'|'neutral'|'bitter',text}], careerOver:true}`; `phase==='over'`. `act('continueEndless')` (not after `iflas`/`yalniz`) sets phase `plan` and removes the season cap.
- **Poaching/loyalty**: clients with loyalty <35 may get a rival approach card (`poach:`); ignore it and he leaves after ~3 months. Visits (+8 loyalty) and kept promises protect them.
- **Free agent client**: `clientView.flags.freeAgent`, `club:null`; `interestList` rows of kind `free` can be negotiated in July/Ağustos; otherwise a club signs him after the August deadline (no commission).

## 9. State fields: may read / must not read
May read (via the listed selectors preferably): `S.time`, `S.meta`, `S.agency` (cash, rep, energy, energyMax, upgrades, loan, negMonths, stats), `S.ledger`, `S.leagues[*]` (name, prestige, clubIds, matchday, table, champions), `S.clubs[*]` (name, short, colors, crest, leagueId, trust, facilities, youthTrust, director.name), `S.players[*]` basic: `name age nat pos ca form injured clubId wage contractEnd value hype st` and — for **your clients only** — `trait dream loyalty morale rep promises`; `S.inbox`, `S.promises`, `S.news`, `S.deals`, `S.ranking`, `S.history`, `S.objectives`, `S.rivals` (name, agency, persona, rep, color), `S.ending`, `S.deadline`.
Must NOT read: `S.negotiation.hidden`, `p.pa`, `p.cf` (true potential/fraction), `p.trait/dream` of players you have not scouted enough, `club.director.persona/info`, `club.needs`, `club.budget` before lunch (use `clubView`), `S.rng`, `S.seed`, `S.seq`, `S.flags` (internal bookkeeping; `S.flags.tutorial` via `hubSummary`), `S.interests[*].boost`.
Persist with `serialize(S)` (~0.6 MB) and restore with `deserialize(json)`; both are lossless mid-negotiation and mid-Son Gün.
