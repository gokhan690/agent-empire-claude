# KULİS UI — how to write a screen

Stack: Preact + htm (vendored). Dev: serve `kulis/` statically, open `index.html` (`npm run serve`). Build: `node build.mjs` → `dist/kulis.html`.
Real-click QA with screenshots at 390 px: `node build.mjs && node tools/e2e.mjs` → `dist/shots/e2e-*.png`.

## Imports
One barrel: `import { html, Button, Card, store, useStore, toast, … } from '../ui-kit.js'` (from `src/ui/screens/`).
It re-exports `lib.js` (html, hooks, `cx`, `fmtMoney`, `fmtInt`, `fmtSigned`, `MONTH_NAMES`, `clamp`), `components/*`, store, router, `audio`, `confetti`, `haptics`.
Template syntax: html`<${Button} variant="ghost" onClick=${fn}>Metin</${Button}>`. Use `class=`, never inline `onclick` strings or innerHTML. The UI imports the engine only through the store and `engine/selectors.js` / `constants.js`.

## Screens
- Routes (plain `#name` hashes): `#hub` (Gündem), `#players` (Oyuncular), `#market` (Piyasa) — `screens/Hub.js Players.js Market.js`, each `export default function X() { … }` rendered in `<main class="screen">`.
- Overlays (`Onboarding Negotiation Playback Ceremony SeasonEnd Ending`) get `{close, ...props}` and return `<Overlay label onClose?>…</Overlay>`.
- Sheets (`PlayerSheet PitchSheet ClubSheet AgencySheet`, built-in `Settings`) get `{close, ...props}` and return `<Sheet title onClose=${close}>…</Sheet>`. "Ajans" is a sheet opened from the top bar, not a route.
- Register an overlay/sheet by adding one line to `OVERLAYS` / `SHEETS` in `app.js`. `data-testid` attributes mark the elements the e2e drives.

## Store (`store.js`)
- `store.S` engine state (null until a game exists; mutated in place). `useStore(s => s.S)` re-renders on change.
- `store.act(id, payload)` → engine Result; autosaves, toasts the error on `ok:false` (do not toast it again). `store.preview('negPreview', …)` for slider previews (no save, no toast). `store.advance()` → MonthReport and opens overlay `Playback {report}`; its "Devam" continues to `SeasonEnd` / `Ending` when the report carries them.
- `store.restore()` after load/import puts the player back: Ending > open Masa > unseen season review (marker `kulis-ui-v2` next to the save `kulis-save-v2`).
- `store.newGame(opts)`, `load() hasSave() exportJSON() importJSON(txt) reset()`, `store.onEvents(fn)`, `store.notify()`.
- Overlay manager: `store.ui.openOverlay(name, props)`, `closeOverlay()`, `openSheet(name, props)`, `closeSheet()`.
- Router: `navigate('market')`, `useRoute()`; routes `hub players market`.

## Components
`Button` (variant primary|ghost|danger|gold, size, **energy=n**, **cash=€** cost badges), `IconButton`, `Card` (tone, chalk, glow, onClick), `SectionTitle`, `EmptyState`, `Badge`, `Chip`, `PosChip`, `Tabs`/`Segmented`, `Stat`, `Money`/`NumberTicker`, `Meter`, `PipMeter`, **`Stars`** (`value` or `lo`/`hi` for a potential range), `Avatar`, `Crest`, **`PlayerRow`** (name, position, age, value, one `MoodDot`), `Sheet`, `Overlay`, `toast.*`, `Icon`.
Audio/FX: `audio.play(name)` (click confirm error coin whoosh page sign goal tick levelup badnews), `confetti({…})`, `haptics.*`.

## CSS conventions
Tokens in `styles/tokens.css` (never hard-code colours/px scales). Each screen has its own file (`hub.css players.css market.css agency.css table.css playback.css season.css onboarding.css`), classes prefixed with the screen name. Numbers: class `num`; headlines: `t-display`. Touch targets ≥ 44 px, content column ≤ 560 px. CSS uppercases many labels and JS `/i` does not fold Turkish İ/ı: in tests match on `textContent` with the real casing (or ASCII-safe fragments).
