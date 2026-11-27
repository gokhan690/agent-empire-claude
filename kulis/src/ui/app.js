// App shell: TopBar + routed screen + BottomNav + overlay host + toast host.
// Screen authors never edit this file: register nothing here — overlays/sheets are opened by name via store.ui.
import { html, useEffect } from './lib.js';
import { store, useStore } from './store.js';
import { useRoute, navigate } from './router.js';
import { TopBar, BottomNav, ToastHost } from './components/index.js';
import SettingsSheet from './components/SettingsSheet.js';
import { audio } from './fx/audio.js';
import * as sel from '../engine/selectors.js';

import Hub from './screens/Hub.js';
import Players from './screens/Players.js';
import Market from './screens/Market.js';
import Onboarding from './screens/Onboarding.js';
import Negotiation from './screens/Negotiation.js';
import Playback from './screens/Playback.js';
import Ceremony from './screens/Ceremony.js';
import SeasonEnd from './screens/SeasonEnd.js';
import Ending from './screens/Ending.js';
import PlayerSheet from './screens/PlayerSheet.js';
import PitchSheet from './screens/PitchSheet.js';
import ClubSheet from './screens/ClubSheet.js';
import AgencySheet from './screens/AgencySheet.js';

const SCREENS = { hub: Hub, players: Players, market: Market };
export const OVERLAYS = { Onboarding, Negotiation, Playback, Ceremony, SeasonEnd, Ending };
export const SHEETS = { PlayerSheet, PitchSheet, ClubSheet, AgencySheet, Settings: SettingsSheet };

export function App() {
  const st = useStore(); const S0 = st.S && 1;
  const route = useRoute('hub');
  const S = st.S, ui = st.ui;
  const Screen = SCREENS[route] || Hub;
  const [A, T] = S ? [S.agency, S.time] : [null, null];
  const bar = A ? { cash: A.cash, rep: A.rep, energy: A.energy, energyMax: A.energyMax, season: T.season, month: T.month } : { cash: null };
  const badges = S ? { hub: (S.inbox || []).length, market: sel.offerList(S).length } : {};
  const Ov = ui.overlay && OVERLAYS[ui.overlay.name];
  const blocked = !!(Ov || ui.sheets.length);

  useEffect(() => { window.scrollTo(0, 0); }, [route]);

  return html`<div class="app">
    <div class="app__shell" inert=${blocked}>
      <${TopBar} ...${bar} muted=${audio.muted} onMute=${() => { audio.toggle(); store.notify(); }} onSettings=${() => store.ui.openSheet('Settings')} onAgency=${S ? () => store.ui.openSheet('AgencySheet') : null} />
      <main class=${`screen screen--${route}`} key=${route} id="main"><${Screen} /></main>
      <${BottomNav} route=${route} onNavigate=${navigate} badges=${badges} />
    </div>
    ${Ov ? html`<${Ov} key=${ui.overlay.key} ...${ui.overlay.props} close=${() => store.ui.closeOverlay()} />` : null}
    ${ui.sheets.map((sh, i) => { const C = SHEETS[sh.name]; return C ? html`<${C} key=${sh.key} ...${sh.props} close=${() => store.ui.closeSheet()} />` : null; })}
    <${ToastHost} />
  </div>`;
}
