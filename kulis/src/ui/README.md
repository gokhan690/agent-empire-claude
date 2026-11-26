# KULİS UI — how to write a screen

Stack: Preact + htm (vendored). Dev: serve `kulis/` statically, open `index.html` (`npm run serve`). Build: `node build.mjs` → `dist/kulis.html`.
Look at `#/gallery` for every component live. Screenshots: `node tools/shots.mjs gallery hub` → `dist/shots/*.png` (390 and 1280 wide).

## Imports
One barrel: `import { html, Button, Card, store, useStore, toast, … } from '../ui-kit.js'` (from `src/ui/screens/`).
It re-exports `lib.js` (html, hooks, `cx`, `fmtMoney`, `fmtInt`, `fmtSigned`, `MONTH_NAMES`, `clamp`), `components/*`, store, router, `audio`, `confetti`, `haptics`.
Template syntax: html`<${Button} variant="ghost" onClick=${fn}>Metin</${Button}>`. Use `class=`, never inline `onclick` strings or innerHTML.

## Screen contract
`screens/Hub.js` etc. = `export default function Hub() { … }` rendered inside `<main class="screen">` (padding, gap and nav space already applied). Never edit `app.js`/`main.js`.
Overlays (`Onboarding Negotiation Deadline Playback Ceremony SeasonEnd Ending`) get props `{close, ...yourProps}` and return `<Overlay label onClose?>…</Overlay>`.
Sheets (`PlayerSheet ClubSheet`, plus built-in `Settings`) get `{close, ...yourProps}` and return `<Sheet title onClose=${close}>…</Sheet>`.

## Store (`store.js`)
- `store.S` engine state (null until a game exists; mutated in place). `useStore(s => s.S.agency.cash)` re-renders on change; call it at the top of the component, e.g. `const S = useStore(s => s.S)`.
- `store.act(id, payload)` → engine Result; autosaves, toasts the error on `ok:false` (do not toast it again). `store.advance({silent?})` → MonthReport; by default opens overlay `Deadline` (report.phase==='deadline') else `Playback {report}`.
- `store.newGame(opts)`, `load() hasSave() exportJSON() importJSON(txt) reset()`, `store.onEvents(fn)` (engine `events` after each successful act/advance; returns unsubscribe), `store.notify()`.
- Overlay manager: `store.ui.openOverlay(name, props)`, `closeOverlay()`, `openSheet(name, props)`, `closeSheet()`, `closeAllSheets()` (also exported as `openOverlay` … from ui-kit). Names = keys of `OVERLAYS` / `SHEETS` in app.js; to add one, create the file + add one line there.
- Router: `navigate('market')`, `useRoute()`; routes `hub players scout market agency gallery`.

## Components (all props optional unless marked *)
- `Button` variant primary|ghost|danger|gold, size sm|md|lg, loading, disabled, block, icon, **energy=n**, **cash=€** (cost badges), sfx (name|false), onClick. `IconButton` icon*, label*, onClick.
- `Card` tone must|gold|lime|rival|danger, chalk (corner ticks), glow, onClick (becomes button), eyebrow, title, action. `SectionTitle` right. `EmptyState` icon, title, body, action.
- `Badge` tone lime|gold|danger|info|rival|muted, icon. `Chip` active, onClick, icon. `PosChip` pos KL|DF|OS|FV.
- `Tabs`/`Segmented` items[{id,label,icon,badge}], value, onChange, variant underline|segmented. `Stat` label, value (node ok), delta, unit, big, icon, tone(gold|lime|danger), hint.
- `Money` value, sign, colored, count (animated), compact(true). `NumberTicker` value, format(fn), duration. Formatting helper `fmtMoney(n)` → "€450K", "€1,25M".
- `Meter` value, max, threshold, thresholdLabel, label, valueText, tone auto|lime|gold|danger|info|rival, hint, size sm|md|lg. `PipMeter` value, max, variant energy|patience|loyalty. `PotentialBand` ca, lo, hi, know, compact (40–99 scale).
- `Avatar` id* (deterministic face), size, colors[c1,c2] (kit), ring. `Crest` colors[c1,c2], pattern 0..5, size.
- `PlayerRow` p{id,name,age,pos,ca}, club{name,colors,crest}, band{lo,hi}, badges[{tone,icon,text}], right, onClick, selected. `PlayerCard` p, club, band{lo,hi,know}, stats[{label,value}], footer, onClick.
- `Sheet` title, onClose, tall, footer (drag/backdrop/Esc close, focus trap; mount only while open). `Overlay` label, tone night|gold|danger, onClose. `useFocusTrap(ref,onEsc)`.
- `toast(text,{tone,icon,duration,sfx})`, `toast.success|error|info|money`. `Icon` name, size, fill, title (`ICON_NAMES` lists the set). `TopBar`/`BottomNav` are used by the shell only.

## Audio / FX
`audio.play(name)`: click confirm error coin whoosh page sign goal tick levelup badnews. `audio.muted`, `audio.toggle()`, `audio.setMuted(b)`. Buttons already play `click`; play meaningful sounds yourself (`sign` on contract, `coin` on income, `goal` on goals, `tick` each Son Gün second).
`confetti({x,y,count,colors})` (no-op under reduced motion). `haptics.tap|success|warn|heavy()`.

## CSS conventions
- Tokens in `styles/tokens.css` (`--lime --gold --danger --info --rival --surface --raised --line --muted`, spacing `--s1..--s8`, radius `--r-*`, motion `--dur-*`/`--ease`, fonts `--font-display` for numbers/headings, `--font-text`). Never hard-code colours or px scales; use tokens.
- Your screen's CSS goes only in its own file (`hub.css players.css scout.css market.css agency.css table.css deadline.css playback.css season.css onboarding.css`), every class prefixed with the screen name (`.hub-feed`, `.table-patience`). Shared pieces: `.card .btn .row .col .stack .grid-2 .cols-2 .eyebrow .t-display .num .muted .lime .gold`, inbox card `.inbox .opt` (see gallery).
- Numbers/headlines: add class `num` (condensed, tabular). Headline = `t-display`. Touch targets ≥ 44px. Keep content ≤ 560px; use `.cols-2` for ≥ 900px two-column layouts.
- Respect reduced motion (global rule already shortens animations; don't rely on animation for meaning). Turkish uppercase works because `<html lang="tr">`.
- Dev vs build: index.html lists every CSS file; build.mjs inlines them in that order. Add new CSS files to index.html only if you must.
