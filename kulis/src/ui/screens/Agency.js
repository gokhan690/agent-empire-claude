import { html, useState, useStore, Segmented, Card, Button, Badge, store, openOverlay } from '../ui-kit.js';
import * as sel from '../../engine/selectors.js';
import Race from './agency/Race.js';
import Office from './agency/Office.js';
import Cash from './agency/Cash.js';
import Goal from './agency/Goal.js';
import News from './agency/News.js';

const SECTIONS = [{ id: 'race', label: 'Sıralama' }, { id: 'office', label: 'Ofis' }, { id: 'cash', label: 'Kasa' }, { id: 'goal', label: 'Hedef' }, { id: 'news', label: 'Haberler' }];
const VIEWS = { race: Race, office: Office, cash: Cash, goal: Goal, news: News };
let remembered = 'race';

export default function Agency() {
  const S = useStore((s) => s.S);
  const [sec, setSec] = useState(remembered);
  if (!S) return null;
  const hub = sel.hubSummary(S);
  const go = (id) => { remembered = id; setSec(id); };
  const need = sel.objectiveView(S).offered.length > 0 && !S.objectives.active;
  const items = SECTIONS.map((t) => (t.id === 'goal' && need ? { ...t, badge: '!' } : t));
  const View = VIEWS[sec];
  return html`<div class="agency stack">
    <header class="agency-head">
      <div><div class="eyebrow">${S.meta.agentName}</div><h1 class="t-display agency-head__title">${S.meta.agencyName}</h1></div>
      <${Badge} tone="muted">Sezon ${hub.season}${hub.seasons < 900 ? ' / ' + hub.seasons : ''}</${Badge}>
    </header>
    ${S.time.phase === 'over' && S.ending ? html`<${Card} tone="gold" class="agency-over"><div class="row row--between"><div><div class="eyebrow">Kariyer bitti</div><b>${S.ending.title}</b></div>
      <${Button} size="sm" variant="gold" onClick=${() => openOverlay('Ending', {})}>Finali aç</${Button}></div></${Card}>` : null}
    <${Segmented} items=${items} value=${sec} onChange=${go} class="agency-tabs" label="Ajans bölümleri" />
    <${View} S=${S} hub=${hub} key=${sec} />
  </div>`;
}
