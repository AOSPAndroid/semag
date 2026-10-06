import { ACTS, CARDS, RELICS, cardInfo, createState, dispatch, togglePause as pauseState, intentDamage } from './deckbound-engine.js';
const copy = value => JSON.parse(JSON.stringify(value));
const SVG = 'http://www.w3.org/2000/svg';
const ART = {
  sword: '<path d="M24 61 69 15l9 9-45 46z" fill="#e6dfbc"/><path d="m67 17 7 7-41 42-4-4z" fill="#94aca1"/><path d="m20 55 18 18-6 6-18-18z" fill="#c49b54"/><path d="m13 68 9 9-10 10-9-9z" fill="#527365"/>',
  shield: '<path d="M22 20h56v35c0 15-18 29-28 34-10-5-28-19-28-34z" fill="#648573"/><path d="M29 27h42v27c0 10-13 22-21 27-8-5-21-17-21-27z" fill="#e6dfbc"/><path d="M46 33h8v38h-8zM34 48h32v8H34z" fill="#b59050"/>',
  flame: '<path d="M50 12c6 19 24 25 24 47 0 16-11 28-26 28S23 77 23 63c0-11 8-25 18-36-1 14 6 18 9 18 6-8 6-20 0-33z" fill="#bf754c"/><path d="M48 48c2 12 14 17 14 25 0 9-6 14-13 14-8 0-13-6-13-12 0-8 8-15 12-27z" fill="#ecc773"/>',
  boot: '<path d="M35 17h28v36l13 8 8 17H23v-9l12-14z" fill="#527365"/><path d="M28 76h58v9H23v-9z" fill="#bc9653"/><path d="M39 24h19v24H39z" fill="#9aac91"/><path d="M11 36h17M8 46h18M13 56h13" stroke="#b59050" stroke-width="4"/>',
  axe: '<path d="m22 79 43-57 7 6-43 57z" fill="#b28e53"/><path d="M61 14c15-5 23 1 24 13-9 15-25 14-31 8l-10 7-7-9 15-9z" fill="#e1ddbd"/><path d="m58 19 20 10-8 7-20-9z" fill="#8ea699"/>',
  arrow: '<path d="M18 73 70 21M19 59l15 15M13 66l15 15" stroke="#ba9554" stroke-width="5"/><path d="m58 19 27-5-5 27-9-14z" fill="#e8e0bc"/><path d="M40 25c-24 24-19 52 12 51" fill="none" stroke="#547767" stroke-width="6"/>',
  hammer: '<path d="m20 79 37-48 10 8-36 47z" fill="#607969"/><path d="m41 13 40 28-15 22-40-28z" fill="#b49a65"/><path d="m38 17 28 19-9 14-28-19z" fill="#e5ddbd"/><path d="m21 37-8 7M77 69l8 6" stroke="#b59050" stroke-width="3"/>',
  thorn: '<path d="M49 89c-1-30-17-37-6-63 4-10 14-13 14-19M44 42 25 30M48 63 72 43M50 76 28 63" fill="none" stroke="#547b5e" stroke-width="8"/><path d="m35 35-11-17 2 16M58 56l22-16-11 21M36 69l-15-9 8 17" fill="#b49354"/>',
  castle: '<path d="M18 40h64v45H18zM14 23h10v17H14zM30 23h10v17H30zM60 23h10v17H60zM76 23h10v17H76z" fill="#809584"/><path d="M39 17h22v68H39z" fill="#e2d7ae"/><path d="M44 62q6-11 12 0v23H44zM46 29h8v11h-8z" fill="#486350"/><path d="M23 54h8v11h-8zm46 0h8v11h-8z" fill="#bd9554"/>',
  forge: '<path d="M20 52h65l-16 16H43l-9 15H18l16-19z" fill="#65816e"/><path d="M34 26h39v18H34z" fill="#b88e4e"/><path d="M58 7v14M82 26l8-8M30 19l-8-7" stroke="#bf754c" stroke-width="4"/><path d="M9 88h78" stroke="#b59050" stroke-width="3"/>',
  root: '<path d="M45 18h12v39l13 24-8 6-12-18-8 16-10-4 10-26z" fill="#587858"/><path d="M21 34c2-20 18-23 29-18 6-20 28-11 30 4 18 8 11 29-9 29H30c-14 0-20-11-9-15z" fill="#8fa07a"/><path d="M49 40v21M49 59 30 74M52 65l24 18" stroke="#b59151" stroke-width="4"/>',
  blades: '<path d="m11 66 38-51 8 6-38 51zM33 74l38-51 8 6-38 51zM55 80l30-40 8 6-30 40z" fill="#e5ddbd"/><path d="m8 68 16 12m7-4 16 12m7-4 16 12" stroke="#b59050" stroke-width="5"/>',
  lantern: '<path d="M36 12q14-14 28 0v13M28 29h44v49H28zM23 24h54v8H23zM23 77h54v8H23z" fill="none" stroke="#577762" stroke-width="6"/><path d="M40 36h20v32H40z" fill="#e8c36d"/><path d="m50 42 8 16-8 11-8-11z" fill="#bf754c"/>',
  phoenix: '<path d="m50 27 11-18 4 24 22-12-9 25 16 11-29 6-15 29-13-29-29-6 16-11-9-25 22 12 4-24z" fill="#ba764b"/><path d="m50 40 12 14-12 24-12-24z" fill="#edc773"/><path d="M38 53 22 41M62 53l16-12" stroke="#e5b35c" stroke-width="4"/>',
  heart: '<path d="M50 82 23 54C0 27 38 8 50 31 65 5 99 28 78 54z" fill="#a76d59"/><path d="M50 32v39M33 43l35 16" stroke="#e7d7ab" stroke-width="4"/><path d="M12 73 7 84m76-12 9 9" stroke="#b78f50" stroke-width="3"/>',
  eye: '<path d="M8 52q42-47 84 0-42 43-84 0z" fill="#e4ddbd" stroke="#56745f" stroke-width="4"/><circle cx="50" cy="51" r="19" fill="#8ba181"/><circle cx="50" cy="51" r="10" fill="#365c47"/><path d="M48 9v14M21 19l8 10M78 19l-8 10" stroke="#b59050" stroke-width="3"/>',
  gear: '<path d="m44 12 13 0 4 12 12 3 10-6 9 11-9 10 1 13 11 7-6 12-13-3-10 8-1 13H50l-4-13-12-4-10 7-10-12 9-10-1-13-11-7 7-12 13 3 10-8z" fill="#b59354"/><circle cx="52" cy="51" r="20" fill="#64836e"/><circle cx="52" cy="51" r="10" fill="#e5ddbd"/>',
  moon: '<path d="M71 14c-33-4-59 22-48 49 10 23 40 31 64 10-31 8-56-25-16-59z" fill="#9ba890"/><path d="m79 22 4 9 10 2-9 5 1 11-7-8-10 3 5-9-6-7 10 1z" fill="#c49d56"/>',
  mantle: '<path d="M32 20h36l22 57-40 14-40-14z" fill="#648167"/><path d="M34 24 50 69l16-45M17 66l24-8M81 66l-22-8" fill="none" stroke="#bcc19a" stroke-width="4"/><path d="m20 63-10-14 2 20m61-8 16-15-9 22M47 34l-12-11 7 18" fill="#b99052"/>',
  sun: '<circle cx="50" cy="47" r="23" fill="#e5bf6e"/><path d="M50 8v10M50 76v14M10 47h12M79 47h12M22 19l8 9M70 68l9 10M21 76l9-10M72 26l8-9" stroke="#b59050" stroke-width="4"/><path d="m35 64 14-29 7 7-13 29z" fill="#e7e2c8"/>',
  wind: '<path d="M12 37h57q24 0 18-17-6-12-17-2M8 52h64q21 0 14 16-5 9-14 6M22 67h24q16 0 12 16" fill="none" stroke="#789681" stroke-width="7"/><path d="M15 23h24M6 81h26" stroke="#bc9b5a" stroke-width="3"/>',
  choir: '<path d="M19 37h18v44H19zM41 23h18v58H41zM63 37h18v44H63z" fill="#6f8670"/><path d="m28 31-7-11 7-16 7 16zm22-14-7-10 7-7 7 7zm22 14-7-11 7-16 7 16z" fill="#c7834b"/><path d="M13 84h74" stroke="#b99956" stroke-width="5"/>',
  echo: '<path d="m28 77 36-60 10 7-36 60z" fill="#e7e0bd"/><path d="m13 64 28-46M49 82l30-49M77 74l12-20" fill="none" stroke="#7d9a85" stroke-width="4" stroke-dasharray="4 3"/><path d="m21 73 21 13" stroke="#b68f51" stroke-width="6"/>',
  leaf: '<path d="M23 72C2 29 47 9 83 18c1 39-18 68-49 62z" fill="#779575"/><path d="M15 89 72 28M37 65l-1-24M51 51l21 2" stroke="#e1d5a9" stroke-width="4"/><path d="m23 15 2-9m58 65 9 2" stroke="#b79051" stroke-width="3"/>',
  bag: '<path d="M24 29h52v53H24z" fill="#7d8b68"/><path d="M33 31V15h34v16M21 34h58v15H21z" fill="none" stroke="#b39459" stroke-width="6"/><path d="M37 47h26v23H37z" fill="#ddd0a4"/><path d="M47 40h6v20h-6z" fill="#526a4f"/>',
  crown: '<path d="m16 30 21 16 13-27 13 27 21-16-9 46H25z" fill="#c1a160"/><path d="M27 69h46v13H27z" fill="#d7bb73"/><path d="m50 48 7 10-7 10-7-10z" fill="#5c7e65"/>',
  coin: '<circle cx="50" cy="48" r="31" fill="#c6a360" stroke="#e4cc85" stroke-width="5"/><path d="m31 35 13 8 6-12 6 12 13-8-6 23-13 10-13-10z" fill="#6f7854"/><path d="M29 87h43" stroke="#68816a" stroke-width="4"/>',
};
const ENEMY_ART = {
  imp: '<path d="m31 55-13-28 26 13m34 15 14-28-27 13" fill="#81916b"/><path d="M27 54h50v40H27zM36 90h13v36H36zM57 90h13v36H57z" fill="#687d5c"/><path d="M19 78h16v13H19zM69 75h18v13H69z" fill="#8d9a6d"/><path d="M37 60h10v8H37zm24 0h10v8H61z" fill="#e5ca75"/><path d="M40 80h22v6H40z" fill="#39533e"/><path d="m78 83 19-15 6 7-20 17" fill="#a88c51"/>',
  moth: '<path d="M48 48C12-1-13 48 25 90l25-12M61 48c36-49 61 0 23 42L59 78" fill="#b58665"/><path d="M25 40 15 59l20 19 9-15M84 40l10 19-20 19-9-15" fill="#dab66d"/><path d="M45 47h18v46H45zM47 35h14v17H47z" fill="#627560"/><path d="M49 36 36 20M59 36l14-16" stroke="#5e7359" stroke-width="4"/>',
  sentinel: '<path d="M32 40h47v36H32zM23 73h65v40H23zM28 109h19v18H28zm38 0h18v18H66z" fill="#b69b64"/><path d="M37 49h36v16H37z" fill="#48635d"/><path d="M46 52h8v6h-8zm14 0h8v6h-8z" fill="#e4ca7a"/><circle cx="56" cy="92" r="13" fill="#5f7a6a"/><circle cx="56" cy="92" r="6" fill="#d7bd74"/><path d="M11 76h15v30H11zM87 68h13v43H87z" fill="#87957d"/>',
  scribe: '<path d="m53 18 25 41-10 22 18 45H20l16-46-8-21z" fill="#567564"/><path d="M37 52h33v24H37z" fill="#d6ccb0"/><path d="M45 60h6v5h-6zm14 0h6v5h-6z" fill="#3c5545"/><path d="m80 46 9 4-21 58-9-3z" fill="#bc985b"/><path d="M10 84h36v28H10z" fill="#d7cda7"/><path d="M16 91h21M16 100h19" stroke="#9c8353" stroke-width="2"/>',
  hound: '<path d="m16 74 19-22 39 4 19 24-17 22H30zM30 99h13v29H30zm37 0h13v29H67z" fill="#6b7d63"/><path d="m69 52 17-20 13 5-9 17 14 12-7 24-24-6z" fill="#8f946d"/><path d="m83 34-8-17 17 14" fill="#b89455"/><path d="M88 58h9v7h-9z" fill="#e4c375"/><path d="M95 77h12v8H95zM26 63 8 46l-6 5 18 22" fill="#a88652"/>',
  giant: '<path d="m28 25 51 4 13 46-12 34H28L13 74z" fill="#81917b"/><path d="M26 108h23v22H26zm37 0h23v22H63zM3 63h23v39H3zm80 0h23v39H83z" fill="#62765e"/><path d="M33 41h13v8H33zm28 0h13v8H61z" fill="#daca89"/><path d="m53 29-8 27 17 10-10 31" fill="none" stroke="#b9a77c" stroke-width="5"/><path d="M28 80h48v11H28z" fill="#5e715a"/>',
  warden: '<path d="M40 29 24 3l-7 5 17 25M68 29 85 3l7 5-16 25M31 17 5 11v7l28 8M76 18l29-7v7l-29 8" fill="#7d8762"/><path d="m30 34 48 0 9 68-17 25H39l-17-25z" fill="#647d58"/><path d="M38 44h12v11H38zm21 0h12v11H59z" fill="#e7c86d"/><path d="M43 72h22v7H43z" fill="#3e573c"/><path d="m24 66-20 19 6 8 19-12M83 65l22 19-6 9-18-15" fill="#8e9269"/><path d="m40 97-8 31m35-31 8 31M46 16h20v22H46z" fill="#a49156"/>',
  curator: '<path d="M20 62h69v51H20zM33 110h17v19H33zm30 0h17v19H63z" fill="#b19962"/><circle cx="55" cy="41" r="27" fill="#8f9c86" stroke="#cbb579" stroke-width="7"/><circle cx="55" cy="41" r="18" fill="#e0d4ad"/><path d="M55 25v17l11 7" stroke="#4d6c58" stroke-width="4"/><path d="M10 71h13v36H10zm77 0h16v36H87z" fill="#738771"/><path d="M40 74h30v26H40z" fill="#4f705f"/><path d="m55 77 8 10-8 10-8-10z" fill="#cfb372"/>',
  regent: '<path d="m28 35 26-17 26 17 19 89H9z" fill="#4d685a"/><path d="m35 41 19 70 20-70 12 73-32 15-31-15z" fill="#80927b"/><path d="M37 28h36v29H37z" fill="#d3c59e"/><path d="M42 40h10v8H42zm17 0h10v8H59z" fill="#47604f"/><path d="m35 15 10 9 10-16 10 16 12-10-5 20H38z" fill="#c3a15d"/><path d="M8 55h7v74H8zM2 47h19v13H2z" fill="#b69759"/><path d="m45 70 10-10 10 10-10 18z" fill="#d9bc72"/>',
};
function node(tag, className = '', text) { const e = document.createElement(tag); e.className = className; if (text !== undefined) e.textContent = text; return e; }
function svg(markup, box = '0 0 100 100', className = '') { const e = document.createElementNS(SVG, 'svg'); e.setAttribute('viewBox', box); e.setAttribute('aria-hidden', 'true'); e.setAttribute('class', className); e.innerHTML = markup; return e; }
function art(id) { return svg(`<path d="M9 12h82v77H9z" fill="#ede6cd"/><path d="M13 17h74v67H13z" fill="none" stroke="#d2c5a2" stroke-width="1"/><circle cx="50" cy="48" r="34" fill="#e1ddc1"/>${ART[id] || ART.leaf}`, '0 0 100 100', 'deckbound-card-art'); }
function button(label, action, data = {}, className = '') { const b = node('button', className, label); b.type = 'button'; b.dataset.action = action; for (const [key, value] of Object.entries(data)) b.dataset[key] = value; return b; }
function cardView(c, action, data = {}, label = '') {
  const info = cardInfo(c); const b = button('', action, data, `deckbound-card deckbound-card-${info.kind}${c.upgraded ? ' is-upgraded' : ''}`);
  const header = node('span', 'deckbound-card-heading'); header.append(node('b', 'deckbound-card-cost', String(info.cost)), node('strong', '', info.name));
  b.append(header, art(info.art), node('span', 'deckbound-card-type', info.kind.toUpperCase()), node('span', 'deckbound-card-text', info.text));
  if (label) b.append(node('span', 'deckbound-card-foot', label));
  b.setAttribute('aria-label', `${info.name}. ${info.cost} energy. ${info.text}${label ? ` ${label}` : ''}`); return b;
}
function scene(act) {
  const bg = act === 1 ? '<path d="M0 124 67 69l57 34 48-59 85 75 79-60 55 60 107-67 71 54 51-31v135H0z" fill="#8c9f80"/><path d="M26 19h19v157H26zm102-4h14v159h-14zm421-8h23v176h-23zm-77 32h14v131h-14z" fill="#658569"/><path d="m-3 41 43-38 71 57-64 7zm486-27 80-14 57 58-82 7z" fill="#779473"/>' : act === 2 ? '<path d="M35 18h82v166H35zm163 0h84v166h-84zm168 0h84v166h-84zm163 0h70v166h-70z" fill="#b2ac87"/><path d="M43 32h65v130H43zm163 0h68v130h-68zm168 0h68v130h-68zm163 0h54v130h-54z" fill="#8b927a"/><path d="M47 62h58M47 95h58M47 126h58M210 62h59M210 95h59M210 126h59M378 62h59M378 95h59M378 126h59M541 62h45M541 95h45M541 126h45" stroke="#d2bd88" stroke-width="7"/>' : '<path d="M25 0h36v190H25zm126 0h27v190h-27zm303 0h27v190h-27zm108 0h38v190h-38z" fill="#778675"/><path d="M204 185V46q106-88 211 0v139z" fill="#506c5c"/><path d="M222 183V52q88-71 175 0v131z" fill="#87957b"/><path d="M287 101h48v82h-48zM276 82h70v22h-70z" fill="#c0a772"/>';
  const picture = svg(`<path d="M0 0h620v220H0z" fill="${act === 1 ? '#d6ddc6' : act === 2 ? '#dcd5b4' : '#c6cdb9'}"/>${bg}<path d="M0 175h620v45H0z" fill="#74816a"/><path d="M0 183h620M0 216h620" stroke="#a6ab89" stroke-width="2"/><path d="m0 219 81-36m75 36 27-36m148 36-7-36m166 36-39-36m158 36-52-36" stroke="#5c715c" stroke-width="2"/>`, '0 0 620 220', 'deckbound-scene'); picture.setAttribute('preserveAspectRatio', 'xMidYMid slice'); return picture;
}
export function mount(container, { onUpdate = () => {} } = {}) {
  const requestedSeed = new URLSearchParams(location.search).get('seed');
  const seed = requestedSeed !== null && /^\d{1,10}$/.test(requestedSeed) && Number(requestedSeed) <= 0xffffffff ? Number(requestedSeed) : undefined;
  let state = createState({ seed }); let target = 0; let destroyed = false; let showDeck = false; let choosingUpgrade = false; let choosingRemoval = false;
  const view = node('section', 'deckbound-view'); view.tabIndex = 0; view.dataset.soloFocus = ''; view.setAttribute('aria-label', 'Deckbound card adventure'); container.append(view);
  function publish() {
    onUpdate({ phase: ['paused', 'won', 'lost'].includes(state.phase) ? state.phase : 'playing', score: state.score,
      detail: state.phase === 'paused' ? 'Your road waits. Resume to continue this exact encounter.' : state.phase === 'won' ? 'Three gates opened. The Hollow Crown is quiet.' : state.phase === 'lost' ? state.result : `Act ${state.act} · encounter ${state.floor}/6 · ${state.deck.length} cards · ${state.gold} gold`, scoreLabel: 'RENOWN', recordLabel: 'BEST RENOWN' });
  }
  function run(action, payload = {}) { if (destroyed) return; const r = dispatch(state, action, payload); if (!r.ok) return; choosingUpgrade = false; choosingRemoval = false; if (!state.enemies[target] || state.enemies[target].hp <= 0) target = state.enemies.findIndex(e => e.hp > 0); target = Math.max(0, target); render(); }
  function relicRow() {
    const row = node('div', 'deckbound-relics'); row.setAttribute('aria-label', 'Run relics');
    for (const id of state.relics) { const def = RELICS[id]; const item = node('span', 'deckbound-relic'); item.title = def.text; item.setAttribute('role', 'img'); item.setAttribute('aria-label', `${def.name}: ${def.text}`); item.append(art(def.art), node('span', '', def.name)); row.append(item); }
    return row;
  }
  function resourceLine() {
    const row = node('div', 'deckbound-resources');
    for (const [title, value, type] of [['HEALTH', `${state.hp} / ${state.maxHp}`, 'hp'], ['GOLD', state.gold, 'gold'], ['DECK', state.deck.length, 'deck']]) { const item = node('span', `deckbound-resource deckbound-resource-${type}`); item.append(node('small', '', title), node('strong', '', String(value))); row.append(item); }
    row.append(button(showDeck ? 'Close deck' : 'Inspect deck', 'inspect', {}, 'deckbound-small-button')); return row;
  }
  function choices(title, subtitle) { const panel = node('section', 'deckbound-decision'); panel.append(node('small', 'deckbound-eyebrow', subtitle), node('h2', '', title)); return panel; }
  function render() {
    if (destroyed) return;
    const focused = view.contains(document.activeElement) ? document.activeElement : null;
    const focusData = focused?.dataset?.action ? { action: focused.dataset.action, uid: focused.dataset.uid, id: focused.dataset.id } : null;
    view.replaceChildren(); view.dataset.phase = state.phase;
    const top = node('div', 'deckbound-topline'); top.append(node('span', '', `ACT ${String(Math.min(3, state.act)).padStart(2, '0')} / 03`), node('strong', '', ACTS[Math.min(2, state.act - 1)]), node('span', 'deckbound-seed', `SEED ${state.seed}`));
    view.append(top, resourceLine(), relicRow());
    const route = node('div', 'deckbound-progress'); route.setAttribute('aria-label', `Encounter ${Math.min(6, state.floor)} of six`);
    for (let i = 1; i <= 6; i++) { const step = node('span', `${state.phase === 'won' ? 'is-done' : i === state.floor ? 'is-current' : i < state.floor ? 'is-done' : ''}`, i === 6 ? 'B' : String(i)); step.title = i === 6 ? 'Gatekeeper' : `Encounter ${i}`; route.append(step); }
    view.append(route);
    const phase = state.phase === 'paused' ? state.pausedPhase : state.phase;
    if (phase === 'battle') renderBattle();
    else if (phase === 'route') renderRoute();
    else if (phase === 'reward') renderReward();
    else if (phase === 'relic') renderRelic();
    else if (phase === 'rest') renderRest();
    else if (phase === 'shop') renderShop();
    else if (phase === 'event') renderEvent();
    else renderEnd();
    if (showDeck) renderDeck();
    const status = node('p', 'deckbound-status', state.message); status.setAttribute('role', 'status'); view.append(status);
    if (state.phase === 'paused') {
      for (const b of view.querySelectorAll('button')) b.disabled = true;
      const overlay = node('div', 'deckbound-pause'); overlay.append(node('small', '', 'YOUR ROAD WAITS'), node('strong', '', 'Take a breath.'), button('Resume this encounter →', 'resume', {}, 'deckbound-primary')); view.append(overlay);
    }
    if (focusData) { const candidates = [...view.querySelectorAll('button:not(:disabled)')]; const same = candidates.find(b => b.dataset.action === focusData.action && b.dataset.uid === focusData.uid && b.dataset.id === focusData.id); (same || candidates.find(b => b.dataset.action === 'play-card'))?.focus({ preventScroll: true }); }
    publish();
  }
  function renderRoute() {
    const panel = choices('Every road has a price.', 'CHOOSE YOUR NEXT ENCOUNTER');
    const panorama = node('div', 'deckbound-panorama'); panorama.append(scene(state.act)); panel.append(panorama);
    const row = node('div', 'deckbound-paths');
    for (const o of state.routeOptions) {
      const b = button('', 'choose-route', { id: o.id }, `deckbound-path deckbound-path-${o.kind}`);
      b.append(art({ combat: 'sword', elite: 'mantle', rest: 'lantern', shop: 'coin', event: 'eye', boss: 'crown' }[o.kind]), node('small', '', o.kind === 'boss' ? 'GATEKEEPER' : o.kind.toUpperCase()), node('strong', '', o.title), node('span', '', o.text), node('b', 'deckbound-path-arrow', 'Take this road →')); row.append(b);
    }
    panel.append(row); view.append(panel);
  }
  function renderBattle() {
    const stage = node('div', 'deckbound-battle-stage'); stage.append(scene(state.act));
    const enemies = node('div', 'deckbound-enemies');
    state.enemies.forEach((e, i) => {
      const b = button('', 'target', { target: i }, `deckbound-enemy${target === i ? ' is-target' : ''}${e.hp <= 0 ? ' is-defeated' : ''}`); b.disabled = e.hp <= 0;
      b.append(svg(ENEMY_ART[e.art], '0 0 110 140', 'deckbound-enemy-art'), node('strong', '', e.name), node('span', 'deckbound-enemy-health', `${e.hp} / ${e.maxHp} HP${e.block ? ` · ${e.block} block` : ''}`));
      const intent = node('span', 'deckbound-intent'); intent.append(node('b', '', e.hp > 0 ? `${e.intent.damage ? `${intentDamage(e)}${e.intent.hits > 1 ? ` × ${e.intent.hits}` : ''} DAMAGE` : e.intent.block ? `${e.intent.block} BLOCK` : 'DEBUFF'}` : 'DEFEATED'), node('span', '', e.hp > 0 ? e.intent.label : 'The road is clear.'));
      if (e.hp > 0) { const effects = []; if (e.intent.weak) effects.push(`${e.intent.weak} weak`); if (e.intent.vulnerable) effects.push(`${e.intent.vulnerable} vulnerable`); if (e.intent.poison) effects.push(`${e.intent.poison} poison`); if (e.intent.strength) effects.push(`+${e.intent.strength} strength`); if (effects.length) intent.append(node('small', '', effects.join(' · '))); }
      b.append(intent);
      const status = [e.burn ? `${e.burn} burn` : '', e.weak ? `${e.weak} weak` : '', e.vulnerable ? `${e.vulnerable} vulnerable` : ''].filter(Boolean).join(' · ');
      if (status) b.append(node('span', 'deckbound-enemy-status', status));
      b.setAttribute('aria-pressed', String(target === i)); b.setAttribute('aria-label', `${e.name}, ${e.hp} HP. ${e.hp > 0 ? `Next: ${e.intent.label}, ${e.intent.damage ? `${intentDamage(e)} damage ${e.intent.hits || 1} times` : ''}. ${status}. Select as target.` : 'Defeated.'}`); enemies.append(b);
    });
    stage.append(enemies); view.append(stage);
    const tools = node('div', 'deckbound-battle-tools');
    const energy = node('span', 'deckbound-energy'); energy.append(node('b', '', String(state.energy)), node('span', '', `ENERGY · TURN ${state.turn}`)); tools.append(energy);
    const status = node('span', 'deckbound-player-status');
    const stats = [`${state.player.block} block`, state.player.strength ? `${state.player.strength} strength` : '', state.player.dexterity ? `${state.player.dexterity} dexterity` : '', state.player.thorns ? `${state.player.thorns} thorns` : '', state.player.weak ? `${state.player.weak} weak` : '', state.player.vulnerable ? `${state.player.vulnerable} vulnerable` : '', state.player.poison ? `${state.player.poison} poison` : ''].filter(Boolean);
    status.textContent = stats.join(' · '); tools.append(status, button('End turn →', 'end-turn', {}, 'deckbound-primary')); view.append(tools);
    const hand = node('div', 'deckbound-hand'); hand.setAttribute('aria-label', 'Cards in your hand');
    state.hand.forEach((c, i) => { const b = cardView(c, 'play-card', { uid: c.uid }, `${i < 9 ? `[${i + 1}] · ` : ''}${CARDS[c.id].exhaust ? 'Exhausts' : 'Discard after use'}`); b.disabled = CARDS[c.id].cost > state.energy; hand.append(b); });
    if (!state.hand.length) hand.append(node('p', 'deckbound-empty', 'Your hand is empty. End your turn to draw five new cards.'));
    view.append(hand, node('p', 'deckbound-piles', `Draw ${state.draw.length} · Discard ${state.discard.length} · Exhaust ${state.exhaust.length} · Block expires next turn. Burn hits before the enemy acts.`));
  }
  function renderReward() {
    const panel = choices('Make the next hand yours.', 'VICTORY · TAKE ONE CARD'); const row = node('div', 'deckbound-reward-cards');
    for (const id of state.rewardCards) row.append(cardView({ id, upgraded: false }, 'choose-reward', { id }, 'Add to your deck →'));
    panel.append(row, button('Skip · keep a lean deck', 'choose-reward', { id: 'skip' }, 'deckbound-secondary')); view.append(panel);
  }
  function renderRelic() {
    const panel = choices('A little power for the long road.', 'TAKE ONE RELIC'); const row = node('div', 'deckbound-paths');
    for (const id of state.relicChoices) { const def = RELICS[id]; const b = button('', 'claim-relic', { id }, 'deckbound-path'); b.append(art(def.art), node('strong', '', def.name), node('span', '', def.text), node('b', 'deckbound-path-arrow', 'Carry this relic →')); row.append(b); }
    panel.append(row); view.append(panel);
  }
  function renderRest() {
    const panel = choices('A warm fire. One useful choice.', 'WAYSIDE HEARTH'); const artPanel = node('div', 'deckbound-encounter-art'); artPanel.append(scene(state.act), art('lantern')); panel.append(artPanel);
    const row = node('div', 'deckbound-simple-choices'); const heal = button(`Rest · recover 25 HP (${Math.min(state.maxHp, state.hp + 25)} / ${state.maxHp})`, 'rest', { kind: 'heal' }, 'deckbound-primary'); const upgrade = button('Tend your tools · upgrade one card', 'show-upgrades', {}, 'deckbound-secondary'); upgrade.disabled = !state.deck.some(c => !c.upgraded); row.append(heal, upgrade); panel.append(row);
    if (choosingUpgrade) { panel.append(node('p', '', 'Choose a card. Upgrades last for the whole run.'), selectionGrid('rest')); }
    view.append(panel);
  }
  function selectionGrid(action) {
    const grid = node('div', 'deckbound-selection-grid');
    for (const c of state.deck) { if (action === 'rest' && c.upgraded) continue; grid.append(cardView(action === 'rest' ? { ...c, upgraded: true } : c, action, { uid: c.uid, kind: 'upgrade' }, action === 'rest' ? 'Upgrade to this version →' : 'Remove for 40 gold →')); }
    return grid;
  }
  function renderShop() {
    const panel = choices('The merchant remembers every road.', 'THE TRAVELLING MARKET'); const row = node('div', 'deckbound-shop-offers');
    for (const offer of state.shopOffers) {
      let b;
      if (offer.kind === 'card') b = cardView({ id: offer.cardId, upgraded: false }, 'buy', { id: offer.id }, offer.sold ? 'SOLD' : `${offer.cost} gold · buy →`);
      else { const def = RELICS[offer.relicId]; b = button('', 'buy', { id: offer.id }, 'deckbound-shop-relic'); b.append(art(def.art), node('strong', '', def.name), node('span', '', def.text), node('b', '', offer.sold ? 'SOLD' : `${offer.cost} gold · buy →`)); }
      b.disabled = offer.sold || state.gold < offer.cost; row.append(b);
    }
    const actions = node('div', 'deckbound-simple-choices'); const remove = button(state.shopRemoved ? 'Removal used' : 'Lighten your pack · remove a card (40 gold)', 'show-removal', {}, 'deckbound-secondary'); remove.disabled = state.shopRemoved || state.gold < 40 || state.deck.length <= 5;
    actions.append(remove, button('Continue the road →', 'leave-shop', {}, 'deckbound-primary')); panel.append(row, actions);
    if (choosingRemoval) panel.append(selectionGrid('remove-card')); view.append(panel);
  }
  function renderEvent() {
    const panel = choices(state.event.name, 'A BARGAIN BESIDE THE ROAD'); const picture = node('div', 'deckbound-encounter-art'); picture.append(scene(state.act), art(state.act === 1 ? 'eye' : state.act === 2 ? 'gear' : 'root')); panel.append(picture);
    const row = node('div', 'deckbound-paths');
    for (const choice of state.event.choices) { const b = button('', 'choose-event', { id: choice.id }, 'deckbound-event-choice'); b.append(node('strong', '', choice.title), node('span', '', choice.text), node('b', '', 'Choose →')); b.disabled = choice.id === 'gift' && state.hp <= 8 || choice.id === 'renew' && state.gold < 25; row.append(b); }
    panel.append(row); view.append(panel);
  }
  function renderEnd() {
    const panel = choices(state.phase === 'won' ? 'The crown is quiet.' : 'A road worth remembering.', state.phase === 'won' ? 'THREE ACTS COMPLETE' : 'YOUR RUN IS COMPLETE'); panel.append(art(state.phase === 'won' ? 'crown' : 'lantern'), node('p', '', state.result), node('strong', 'deckbound-final-score', `${state.score} renown`), button('Start a new road →', 'restart', {}, 'deckbound-primary'), button(`Replay seed ${state.seed}`, 'replay-seed', {}, 'deckbound-secondary')); view.append(panel);
  }
  function renderDeck() {
    const panel = node('details', 'deckbound-deck-panel'); panel.open = true; panel.append(node('summary', '', `Your pack · ${state.deck.length} cards`)); const row = node('div', 'deckbound-deck-list');
    const groups = new Map(); for (const c of state.deck) { const key = `${c.id}-${c.upgraded}`; if (!groups.has(key)) groups.set(key, { c, count: 0 }); groups.get(key).count++; }
    for (const { c, count } of groups.values()) { const info = cardInfo(c); const item = node('div', ''); item.append(node('b', '', `${count} × ${info.name}`), node('span', '', `${info.cost} energy · ${info.text}`)); row.append(item); } panel.append(row);
    const effects = node('div', 'deckbound-effect-reference'); effects.append(node('strong', '', 'Read your build'), node('p', '', 'Strength adds damage to every hit. Dexterity adds block to each block effect. Weak lowers attack damage by 25%; vulnerable raises incoming attack damage by 50%. Burn hits before enemies act, then loses 1. Poison bypasses block after their turn, then loses 1. Exhaust removes a card until the next battle.'));
    for (const id of state.relics) effects.append(node('p', '', `${RELICS[id].name}: ${RELICS[id].text}`));
    panel.append(effects); view.append(panel);
  }
  function clicked(event) {
    const b = event.target.closest('button[data-action]'); if (!b || !view.contains(b) || b.disabled) return;
    const action = b.dataset.action;
    if (action === 'resume') { controller.togglePause(); return; }
    if (action === 'restart') { controller.restart(); return; }
    if (action === 'replay-seed') { state = createState({ seed: state.seed }); target = 0; showDeck = false; choosingUpgrade = false; choosingRemoval = false; render(); return; }
    if (state.phase === 'paused') return;
    if (action === 'inspect') { showDeck = !showDeck; render(); return; }
    if (action === 'target') { target = Number(b.dataset.target); render(); return; }
    if (action === 'show-upgrades') { choosingUpgrade = !choosingUpgrade; render(); return; }
    if (action === 'show-removal') { choosingRemoval = !choosingRemoval; render(); return; }
    run(action, { id: b.dataset.id, uid: Number(b.dataset.uid), kind: b.dataset.kind, target });
  }
  function keydown(event) {
    if (destroyed || event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || state.phase !== 'battle') return;
    if (event.target instanceof Element && event.target.closest('button,summary,input,select,textarea,[contenteditable="true"]')) return;
    if (/^[1-9]$/.test(event.key)) { const c = state.hand[Number(event.key) - 1]; if (c) { event.preventDefault(); run('play-card', { uid: c.uid, target }); } }
    else if (event.key.toLowerCase() === 'e') { event.preventDefault(); run('end-turn'); }
  }
  function blur() { if (!destroyed && !['paused', 'won', 'lost'].includes(state.phase)) controller.togglePause(); }
  function visibility() { if (document.hidden) blur(); }
  view.addEventListener('click', clicked); window.addEventListener('keydown', keydown); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
  const controller = {
    getState: () => copy(state),
    restart() { if (destroyed) return; state = createState(); target = 0; showDeck = false; choosingUpgrade = false; choosingRemoval = false; render(); },
    togglePause() { if (!destroyed && pauseState(state)) render(); },
    destroy() { if (destroyed) return; destroyed = true; view.removeEventListener('click', clicked); window.removeEventListener('keydown', keydown); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); view.remove(); },
  };
  render(); return controller;
}
