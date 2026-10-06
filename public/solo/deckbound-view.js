import { ACTS, CARDS, RELICS, cardInfo, createState, dispatch, togglePause as pauseState, intentDamage } from './deckbound-engine.js';
const copy = value => JSON.parse(JSON.stringify(value));
const ART_FAMILIES = {
  sword:'blade',axe:'blade',arrow:'blade',hammer:'blade',blades:'blade',forge:'blade',echo:'blade',
  shield:'root',thorn:'root',castle:'root',root:'root',mantle:'root',leaf:'root',boot:'root',bag:'root',
  flame:'ember',lantern:'ember',phoenix:'ember',choir:'ember',heart:'ember',
  eye:'arcane',moon:'arcane',sun:'arcane',wind:'arcane',gear:'arcane',crown:'arcane',coin:'arcane',
};
function node(tag, className = '', text) { const e = document.createElement(tag); e.className = className; if (text !== undefined) e.textContent = text; return e; }
function illustration(path, className) {
  const image = node('img', className); image.src = path; image.alt = ''; image.draggable = false; image.decoding = 'async'; return image;
}
function art(id) { return illustration(`/art/deckbound-card-${Object.hasOwn(ART_FAMILIES,id) ? id : 'leaf'}.svg`, 'deckbound-card-art'); }
function button(label, action, data = {}, className = '') { const b = node('button', className, label); b.type = 'button'; b.dataset.action = action; for (const [key, value] of Object.entries(data)) b.dataset[key] = value; return b; }
function cardView(c, action, data = {}, label = '') {
  const info = cardInfo(c); const b = button('', action, data, `deckbound-card deckbound-card-${info.kind}${c.upgraded ? ' is-upgraded' : ''}`);
  b.dataset.artFamily = ART_FAMILIES[info.art] || 'root';
  const header = node('span', 'deckbound-card-heading'); header.append(node('b', 'deckbound-card-cost', String(info.cost)), node('strong', '', info.name));
  b.append(header, art(info.art), node('span', 'deckbound-card-type', info.kind.toUpperCase()), node('span', 'deckbound-card-text', info.text));
  if (label) b.append(node('span', 'deckbound-card-foot', label));
  b.setAttribute('aria-label', `${info.name}. ${info.cost} energy. ${info.text}${label ? ` ${label}` : ''}`); return b;
}
function scene(act) { return illustration(`/art/deckbound-scene-${Math.max(1,Math.min(3,act))}.svg`, 'deckbound-scene'); }
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
    const focusData = focused?.dataset?.action ? { action: focused.dataset.action, uid: focused.dataset.uid, id: focused.dataset.id, target: focused.dataset.target } : null;
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
    if (focusData) { const candidates = [...view.querySelectorAll('button:not(:disabled)')]; const same = candidates.find(b => b.dataset.action === focusData.action && b.dataset.uid === focusData.uid && b.dataset.id === focusData.id && b.dataset.target === focusData.target); (same || candidates.find(b => b.dataset.action === 'play-card'))?.focus({ preventScroll: true }); }
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
      b.append(illustration(`/art/deckbound-enemy-${e.art}.svg`, 'deckbound-enemy-art'), node('strong', '', e.name), node('span', 'deckbound-enemy-health', `${e.hp} / ${e.maxHp} HP${e.block ? ` · ${e.block} block` : ''}`));
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
    if (action === 'target') {
      const next = Number(b.dataset.target);
      if (next === target) return;
      const previous = view.querySelector(`[data-action="target"][data-target="${target}"]`);
      previous?.classList.remove('is-target'); previous?.setAttribute('aria-pressed', 'false');
      target = next;
      b.classList.add('is-target'); b.setAttribute('aria-pressed', 'true');
      return;
    }
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
