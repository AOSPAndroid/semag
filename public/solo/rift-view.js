import { ARENA, OBSTACLES, TOTAL_WAVES, UPGRADES, SECTORS, DIFFICULTIES, threatPace, chargeSpeed, enemyShotPattern, createState, step, togglePause as pauseState, chooseUpgrade } from './rift-engine.js';
import { gameKey, getKeyboardLayout, displayKey, subscribeKeyboardLayout } from '../keyboard-layout.js';

const W = ARENA.width;
const H = ARENA.height;
const STEP = 1 / 120;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const KEY_CONTROLS = {
  ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
  j: 'fire', J: 'fire', ' ': 'dash', Space: 'dash', Shift: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
};
const isForm = target => target instanceof Element && Boolean(target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'));
const copy = value => JSON.parse(JSON.stringify(value));
const textIfChanged = (element, value) => { if (element.textContent !== value) element.textContent = value; };
const attrIfChanged = (element, name, value) => { if (element.getAttribute(name) !== value) element.setAttribute(name, value); };
const dataIfChanged = (element, name, value) => { if (element.dataset[name] !== value) element.dataset[name] = value; };
const propIfChanged = (element, name, value) => { if (element[name] !== value) element[name] = value; };
const UPGRADE_ART = {
  repair: { category: 'RECOVERY', path: 'M13 6h6v7h7v6h-7v7h-6v-7H6v-6h7z' },
  damage: { category: 'FIREPOWER', path: 'M13 4h6v3h3v17h-3v4h-6v-4h-3V7h3zM7 10H4v12h3zm21 0h-3v12h3z' },
  cooling: { category: 'HEAT CONTROL', path: 'M14 4h4v7l6-4 2 4-6 4 6 4-2 4-6-4v9h-4v-9l-6 4-2-4 6-4-6-4 2-4 6 4z' },
  mobility: { category: 'MOVEMENT', path: 'M11 6h11v12h5v8H7v-5h4zm-5 5H2v3h4zm0 7H1v3h5z' },
  battery: { category: 'STAMINA', path: 'M13 3h6v4h7v22H6V7h7zm3 7-5 9h5l-1 7 6-10h-5z' },
  plating: { category: 'DEFENSE', path: 'M6 6h20v14l-4 5-6 4-6-4-4-5zm5 4v9l5 5 5-5v-9z' },
  ricochet: { category: 'TRICK SHOTS', path: 'M3 4h4v24H3zm7 19 10-10-5-5h13v13l-5-5-10 10z' },
  chain: { category: 'ARC / FROST', path: 'm17 2-9 15h8l-1 13 10-18h-8zM3 8h4v4H3zm24 14h4v4h-4z' },
  siphon: { category: 'KILL RECOVERY', path: 'm16 2 10 15v7l-5 5H11l-5-5v-7zm-2 13v5h-5v4h5v5h4v-5h5v-4h-5v-5z' },
  frost: { category: 'CROWD CONTROL', path: 'M14 2h4v9l7-6 3 3-8 6h10v4H20l8 6-3 3-7-7v10h-4V20l-7 7-3-3 8-6H2v-4h10L4 8l3-3 7 6z' },
  pulse: { category: 'DASH / FROST', path: 'M13 13h6v6h-6zM3 3h8v3H6v5H3zm18 0h8v8h-3V6h-5zM3 21h3v5h5v3H3zm23 0h3v8h-8v-3h5z' },
  focus: { category: 'DASH / HEAT', path: 'M2 13h8v6H2zm20 0h8v6h-8zM13 2h6v8h-6zm0 20h6v8h-6zM12 12h8v8h-8z' },
  scatter: { category: 'FIRE / ARC', path: 'M13 3h6v12h-6zM3 7h5v11H3zm21 0h5v11h-5zM13 20h6v9h-6zM5 23h5v6H5zm17 0h5v6h-5z' },
};
function upgradeIcon(id) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('shape-rendering', 'crispEdges');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', UPGRADE_ART[id]?.path || UPGRADE_ART.plating.path);
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('fill-rule', 'evenodd');
  svg.append(path);
  return svg;
}
function node(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function mount(container, { onUpdate = () => {} } = {}) {
  let difficulty = 'veteran';
  let state = createState({ difficulty });
  let destroyed = false;
  let raf = null;
  let previousFrame = null;
  let accumulator = 0;
  let lastPublished = -Infinity;
  let lastPhase = null;
  let lastEvent = -1;
  let effectTime = 0;
  let particles = [];
  let ghosts = [];
  let rings = [];
  let hitMarkers = [];
  let arcs = [];
  let fragments = [];
  let enemyFlashes = [];
  let upgradeSignature = '';
  let buildSignature = null;
  let aimPoint = null;
  let aimVector = { x: 1, y: 0 };
  let dashQueued = false;
  let fireQueued = false;
  let gait = 0;
  let walking = false;
  let previousPlayer = { x: state.player.x, y: state.player.y };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const keys = new Map();
  const pointers = new Map();
  const stickValues = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 } };
  const view = node('section', 'rift-view');
  view.setAttribute('aria-label', 'Rift Survivor arena');
  const topline = node('div', 'rift-topline');
  const waveLabel = node('span', '');
  const waveCaption = node('span', '', `WAVE 01 / ${TOTAL_WAVES}`);
  const enemyLabel = node('span', 'rift-enemy-count', 'CLEAR THE RIFT');
  const sector = node('span', 'rift-sector', 'SECTOR 01');
  const paceLabel = node('small', 'rift-threat-pace', 'THREAT 100%');
  paceLabel.style.display = 'block'; paceLabel.style.marginTop = '3px';
  waveLabel.append(waveCaption, paceLabel);
  topline.append(sector, waveLabel, enemyLabel);
  const journey = node('div', 'rift-journey');
  journey.setAttribute('aria-label', 'Expedition sectors');
  const sectorBadges = SECTORS.map((item, index) => {
    const badge = node('span', 'rift-sector-badge');
    badge.append(node('b', '', String(index + 1).padStart(2, '0')), node('span', 'rift-sector-name', item.name),
      node('span', 'rift-sector-short', ['Contain', 'Foundry', 'Growth', 'Core'][index]));
    journey.append(badge); return badge;
  });
  const tierBar = node('div', 'rift-tier-bar');
  const tierLabel = node('label', 'rift-tier-label', 'NEW RUN');
  const tierSelect = node('select', 'rift-tier-select');
  tierSelect.setAttribute('aria-label', 'Difficulty for a new expedition');
  for (const [id, value] of Object.entries(DIFFICULTIES)) { const option = node('option', '', value.title); option.value = id; tierSelect.append(option); }
  tierSelect.value = difficulty;
  tierLabel.append(tierSelect);
  const tierDetail = node('span', 'rift-tier-detail', '20 waves · 4 guardians · build synergies');
  tierBar.append(tierLabel, tierDetail);
  const meters = node('div', 'rift-meters');
  const meterNodes = {};
  for (const [id, label] of [['health', 'HEALTH'], ['stamina', 'DASH'], ['heat', 'HEAT']]) {
    const wrapper = node('div', `rift-meter rift-meter-${id}`);
    const line = node('div', 'rift-meter-label');
    const value = node('b', '', '');
    line.append(node('span', '', label), value);
    const rail = node('div', 'rift-meter-rail');
    rail.setAttribute('role', 'progressbar');
    rail.setAttribute('aria-label', label === 'DASH' ? 'Dash stamina' : label === 'HEAT' ? 'Weapon heat' : 'Health');
    rail.setAttribute('aria-valuemin', '0');
    const fill = node('i', '');
    rail.append(fill);
    wrapper.append(line, rail);
    meterNodes[id] = { rail, fill, value };
    meters.append(wrapper);
  }
  const board = node('div', 'rift-board');
  const canvas = node('canvas', 'rift-canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.tabIndex = 0;
  canvas.dataset.soloFocus = '';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Rift arena. Move with WASD or arrow keys, aim with the pointer, hold click or J to fire, Space or Shift to dash.');
  const overlay = node('div', 'rift-overlay');
  overlay.hidden = true;
  const overlayEyebrow = node('span', 'rift-overlay-eyebrow');
  const overlayTitle = node('strong', 'rift-overlay-title');
  const overlayDetail = node('span', 'rift-overlay-detail');
  const replay = node('button', 'rift-replay', 'Enter the rift again ↗');
  replay.type = 'button';
  overlay.append(overlayEyebrow, overlayTitle, overlayDetail, replay);
  board.append(canvas, overlay);
  const upgradePanel = node('section', 'rift-upgrades');
  upgradePanel.hidden = true;
  upgradePanel.setAttribute('aria-label', 'Choose one upgrade for the next wave');
  const upgradeHeading = node('div', 'rift-upgrade-heading');
  upgradeHeading.append(node('strong', '', 'A choice that changes your run.'), node('span', '', 'TAKE ONE'));
  const upgradeChoices = node('div', 'rift-upgrade-choices');
  const riskLabel = node('label', 'rift-risk');
  const riskInput = node('input', ''); riskInput.type = 'checkbox'; riskInput.dataset.riftRisk = '';
  riskLabel.append(riskInput, node('span', '', 'Overcharge the next wave'), node('small', '', '+1 weaver · +2 elites · 15% heavier hits · 35% more points'));
  upgradePanel.append(upgradeHeading, upgradeChoices, riskLabel);
  const build = node('div', 'rift-build');
  build.setAttribute('aria-label', 'Your upgrade build');
  const synergies = node('div', 'rift-synergies');
  synergies.setAttribute('aria-label', 'Active upgrade synergies');
  const status = node('p', 'rift-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const hint = node('p', 'rift-hint');
  for (const [key, label] of [['WASD', 'Move'], ['Mouse', 'Aim'], ['Click / J', 'Fire'], ['Space', 'Dash']]) {
    const item = node('span', '');
    item.append(node('kbd', '', key), document.createTextNode(label));
    hint.append(item);
  }
  const controls = node('div', 'rift-controls');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Touch arena controls');
  const sticks = new Map();
  for (const [id, label, subtitle] of [['move', 'MOVE', 'LEFT THUMB'], ['aim', 'AIM + FIRE', 'RIGHT THUMB']]) {
    const group = node('div', 'rift-stick-group');
    const pad = node('button', `rift-stick rift-stick-${id}`);
    pad.type = 'button';
    pad.dataset.stick = id;
    pad.setAttribute('aria-label', id === 'move' ? 'Drag to move in any direction' : 'Drag to aim and fire in any direction');
    pad.setAttribute('aria-pressed', 'false');
    const knob = node('span', 'rift-stick-knob', id === 'move' ? '✥' : '⊕');
    pad.append(node('i', 'rift-stick-axis rift-stick-axis-x'), node('i', 'rift-stick-axis rift-stick-axis-y'), knob);
    group.append(pad, node('b', '', label), node('small', '', subtitle));
    controls.append(group);
      sticks.set(id, { pad, knob, travel: 0, transform: null });
  }
  const actions = node('div', 'rift-actions');
  const buttons = new Map();
  for (const [id, symbol, label] of [['dash', '↗', 'DASH'], ['fire', '⊙', 'FIRE']]) {
    const button = node('button', `rift-action rift-action-${id}`);
    button.type = 'button';
    button.dataset.control = id;
    button.setAttribute('aria-label', id === 'dash' ? 'Tap to dash when stamina is available' : 'Hold to fire toward your last aim');
    button.setAttribute('aria-pressed', 'false');
    button.append(node('b', '', symbol), node('span', '', label));
    actions.append(button);
    buttons.set(id, button);
  }
  controls.insertBefore(actions, controls.lastChild);
  view.append(tierBar, journey, topline, meters, board, upgradePanel, build, synergies, status, hint, controls);
  container.append(view);
  const displayContext = canvas.getContext('2d');
  let ctx = displayContext;
  const floorLayers = SECTORS.map(() => {
    const layer = document.createElement('canvas'); layer.width = W; layer.height = H; return layer;
  });
  const coverLayers = SECTORS.map(() => {
    const layer = document.createElement('canvas'); layer.width = W; layer.height = H; return layer;
  });
  // Integer gait positions keep the authored pixel poses while reusing their
  // body paint: at most 20 enemy textures and two pilot armor textures.
  const enemyBodyLayers = new Map();
  const playerArmorLayers = new Map();
  let enemyDrawOrder = [];
  let enemyOrderDirty = true;
  function bodyLayer(paint) {
    const layer = document.createElement('canvas'); layer.width = 128; layer.height = 128;
    const display = ctx;
    ctx = layer.getContext('2d'); ctx.translate(64, 64); ctx.scale(2, 2);
    paint(); ctx = display;
    return layer;
  }

  function input() {
    const result = { up: false, down: false, left: false, right: false, fire: fireQueued, dash: dashQueued };
    for (const control of keys.values()) result[control] = true;
    for (const pointer of pointers.values()) if (pointer.control) result[pointer.control] = true;
    const move = stickValues.move;
    result.left ||= move.x < -.16;
    result.right ||= move.x > .16;
    result.up ||= move.y < -.16;
    result.down ||= move.y > .16;
    // The analog values let the simulation retain precise twin-stick movement;
    // digital keys continue to use its regular normalized keyboard movement.
    if (Math.hypot(move.x, move.y) > .16) { result.moveX = move.x; result.moveY = move.y; }
    const aim = stickValues.aim;
    if (Math.hypot(aim.x, aim.y) > .16) {
      aimPoint = null;
      aimVector = { x: aim.x, y: aim.y };
      result.fire = true;
    }
    if (aimPoint) aimVector = { x: aimPoint.x - state.player.x, y: aimPoint.y - state.player.y };
    result.aimX = aimVector.x;
    result.aimY = aimVector.y;
    return result;
  }
  function syncControls() {
    const held = input();
    for (const [id, button] of buttons) {
      dataIfChanged(button, 'held', String(held[id]));
      attrIfChanged(button, 'aria-pressed', String(held[id]));
    }
    for (const [id, stick] of sticks) {
      const { pad, knob } = stick;
      const value = stickValues[id];
      const active = Math.hypot(value.x, value.y) > .16;
      dataIfChanged(pad, 'held', String(active));
      attrIfChanged(pad, 'aria-pressed', String(active));
      const transform = `translate(${value.x * stick.travel}px, ${value.y * stick.travel}px)`;
      if (transform !== stick.transform) { knob.style.transform = transform; stick.transform = transform; }
    }
  }
  function releaseControls() {
    keys.clear();
    dashQueued = false;
    fireQueued = false;
    const captured = [...pointers.entries()];
    pointers.clear();
    stickValues.move = { x: 0, y: 0 };
    stickValues.aim = { x: 0, y: 0 };
    for (const [id, pointer] of captured) {
      try { if (pointer.target.hasPointerCapture?.(id)) pointer.target.releasePointerCapture(id); } catch {}
    }
    syncControls();
  }
  function details() {
    if (state.phase === 'paused') return state.pausedPhase === 'upgrade' ? 'Your upgrade is waiting. Resume to choose.' : 'The rift is paused. Resume when you are ready.';
    if (state.phase === 'upgrade') return state.wave % 5 === 0
      ? `${SECTORS[state.sector].boss} defeated. Choose your build for ${SECTORS[state.sector + 1]?.name || 'the final rift'}.`
      : `Wave ${state.wavesCleared} cleared. Choose an upgrade, and decide whether to overcharge the next wave.`;
    if (state.phase === 'won') return `All ${TOTAL_WAVES} waves cleared. Your build held the rift.`;
    if (state.phase === 'lost') return `Reached wave ${state.wave}. Read the windups and try a new build.`;
    if (state.player.overheated) return state.difficulty === 'standard' ? 'Weapon overheated. Keep moving while it cools.' : 'Weapon overheated. Release fire to cool faster; keep moving until it unlocks.';
    const guardian = state.enemies.find(enemy => enemy.boss);
    if (guardian) return `${guardian.bossName}${state.difficulty !== 'standard' && guardian.hp < guardian.maxHp / 2 ? ' · PHASE II' : ''}: ${guardian.attackName.replaceAll('-', ' ')}. Read the windup and the marked floor.`;
    if (state.waveRisk) return 'Overcharged wave: heavier hits and extra elites. Clear it for 35% more points.';
    const profile = DIFFICULTIES[state.difficulty];
    if (state.player.siphon && profile.healingBudget !== null) return `Blood circuit: ${Math.max(0, profile.healingBudget - state.waveHealing).toFixed(1)} health left this wave. Reverse after the locked aim; preserve your dash.`;
    if (profile.lead) return 'Fire in bursts; release fire to cool faster. Reverse after locked shots and leave suppression marks before they strike.';
    return 'Break line of sight with cover. Dash through danger; leave enough stamina for the next attack.';
  }
  function descriptor(id) {
    const profile = DIFFICULTIES[state.difficulty];
    if (id === 'repair') return { ...UPGRADES[id], description: `Restore ${profile.repair} health. Your scars carry between waves.` };
    if (id === 'plating') return { ...UPGRADES[id], description: `+10 maximum health and restore ${profile.plating} health, up to 130.` };
    if (id === 'cooling' && state.difficulty !== 'standard') return { ...UPGRADES[id], description: '+8 cooling per second and less heat per shot. Release fire for full cooling; held fire cools more slowly.' };
    if (id === 'frost' && state.difficulty !== 'standard') return { ...UPGRADES[id], description: 'Hits slow enemies for 1.2 seconds. Elites resist deep chill; guardians resist slowing and shake it off sooner. Arcs inherit frost.' };
    if (id === 'siphon' && profile.healingBudget !== null) return { ...UPGRADES[id], description: `Kills restore ${profile.siphon} health per rank, up to ${profile.healingBudget} health per wave. Arcs and shocks share that limit.` };
    return UPGRADES[id] || { id, name: id, description: 'Improve your next wave.' };
  }
  function updateUpgrades() {
    const signature = state.upgradeChoices.join('|');
    if (signature !== upgradeSignature) {
      upgradeSignature = signature;
      riskInput.checked = false;
      upgradeChoices.replaceChildren();
      for (const id of state.upgradeChoices) {
        const choice = descriptor(id);
        const button = node('button', 'rift-upgrade');
        button.type = 'button';
        button.dataset.upgrade = id;
        const mark = node('span', 'rift-upgrade-mark');
        mark.append(upgradeIcon(id));
        button.append(mark, node('span', 'rift-upgrade-kicker', UPGRADE_ART[id]?.category || 'BUILD'), node('strong', '', choice.name || choice.title || id), node('span', 'rift-upgrade-description', choice.description || choice.detail || ''), node('b', '', 'Take this upgrade ↗'));
        upgradeChoices.append(button);
      }
    }
    const awaiting = state.phase === 'upgrade' || state.phase === 'paused' && state.pausedPhase === 'upgrade';
    propIfChanged(upgradePanel, 'hidden', !awaiting);
    propIfChanged(riskInput, 'disabled', state.phase !== 'upgrade');
    for (const button of upgradeChoices.children) propIfChanged(button, 'disabled', state.phase !== 'upgrade');
    const signatureBuild = Object.entries(state.upgrades).map(([id, count]) => `${id}:${count}`).join('|');
    if (signatureBuild === buildSignature) return;
    buildSignature = signatureBuild;
    build.replaceChildren(node('span', 'rift-build-label', `BUILD · ${Object.values(state.upgrades).reduce((sum, count) => sum + count, 0)} / 19`));
    const chosen = Object.entries(state.upgrades).filter(([, count]) => count > 0);
    if (!chosen.length) build.append(node('span', 'rift-build-empty', 'Make your first choice after wave 1.'));
    for (const [id, count] of chosen) build.append(node('span', 'rift-build-chip', `${descriptor(id).name || descriptor(id).title || id}${count > 1 ? ` ×${count}` : ''}`));
    const active = [];
    if (state.player.chain && state.player.frost) active.push('Cryo arcs · chained enemies inherit slow');
    if (state.player.pulse && state.player.frost) active.push('Shatter dash · +50% shock damage to frozen foes');
    if (state.player.focus) active.push('Afterimage · dash primes a cool, heavy first shot');
    if (state.player.scatter && state.player.chain) active.push('Triad storm · side rounds conduct arcs');
    if (state.player.ricochet && state.player.scatter) active.push('Mirror fan · side rounds bounce around cover');
    if (state.player.siphon && (state.player.chain || state.player.pulse)) active.push(`Blood circuit · arcs and shocks heal${DIFFICULTIES[state.difficulty].healingBudget === null ? '' : ` · ${DIFFICULTIES[state.difficulty].healingBudget} per wave`}`);
    synergies.replaceChildren(...active.map(text => node('span', '', text)));
    synergies.hidden = !active.length;
  }
  function publish(force = false) {
    if (!force && state.elapsed - lastPublished < .1 && state.phase === lastPhase) return;
    const changedPhase = state.phase !== lastPhase;
    if (changedPhase) releaseControls();
    lastPublished = state.elapsed;
    lastPhase = state.phase;
    dataIfChanged(view, 'phase', state.phase);
    dataIfChanged(view, 'wave', String(state.wave));
    dataIfChanged(view, 'health', String(Math.round(state.player.hp)));
    dataIfChanged(view, 'sector', String(state.sector));
    dataIfChanged(view, 'difficulty', state.difficulty);
    textIfChanged(sector, `SECTOR ${String(state.sector + 1).padStart(2, '0')}`);
    textIfChanged(tierDetail, state.waveRisk ? 'OVERCHARGED · +35% points' : DIFFICULTIES[state.difficulty].description);
    propIfChanged(paceLabel, 'hidden', state.difficulty === 'standard');
    if (paceLabel.style.display !== (state.difficulty === 'standard' ? 'none' : 'block')) paceLabel.style.display = state.difficulty === 'standard' ? 'none' : 'block';
    textIfChanged(paceLabel, `THREAT ${Math.round(threatPace(state) * 100)}%`);
    attrIfChanged(paceLabel, 'aria-label', `Threat speed ${Math.round(threatPace(state) * 100)} percent. Rises only during active combat, up to 125 percent.`);
    sectorBadges.forEach((badge, index) => {
      dataIfChanged(badge, 'current', String(index === state.sector));
      dataIfChanged(badge, 'cleared', String(state.wavesCleared >= (index + 1) * 5));
      attrIfChanged(badge, 'aria-label', `${SECTORS[index].name}: ${state.wavesCleared >= (index + 1) * 5 ? 'cleared' : index === state.sector ? 'current sector' : 'ahead'}`);
    });
    textIfChanged(waveCaption, `WAVE ${String(state.wave).padStart(2, '0')} / ${TOTAL_WAVES}`);
    const eliteCount = state.enemies.filter(enemy => enemy.elite).length;
    textIfChanged(enemyLabel, state.phase === 'upgrade' ? 'ALL CLEAR' : `${state.enemies.length} HOSTILES${eliteCount ? ` · ${eliteCount} ELITE` : ''}`);
    const values = {
      health: [state.player.hp, state.player.maxHp, `${Math.ceil(state.player.hp)} / ${state.player.maxHp}`],
      stamina: [state.player.stamina, state.player.maxStamina, `${Math.round(state.player.stamina)} / ${state.player.maxStamina}`],
      heat: [state.player.heat, state.player.maxHeat, state.player.overheated ? 'HOT' : `${Math.round(state.player.heat)}%`],
    };
    for (const [id, [value, max, label]] of Object.entries(values)) {
      const meter = meterNodes[id];
      textIfChanged(meter.value, label);
      const width = `${Math.round(clamp(value / max, 0, 1) * 10000) / 100}%`;
      if (meter.fill.style.width !== width) meter.fill.style.width = width;
      attrIfChanged(meter.rail, 'aria-valuemax', String(max));
      attrIfChanged(meter.rail, 'aria-valuenow', String(Math.round(value)));
    }
    dataIfChanged(meterNodes.heat.rail, 'hot', String(state.player.overheated));
    const detail = details();
    if (status.textContent !== detail) status.textContent = detail;
    propIfChanged(overlay, 'hidden', state.phase === 'playing');
    if (!overlay.hidden) {
      textIfChanged(overlayEyebrow, { paused: 'HOLD YOUR POSITION', upgrade: 'A MOMENT BETWEEN WAVES', won: 'THE RIFT IS SEALED', lost: 'ONE MORE RUN' }[state.phase]);
      textIfChanged(overlayTitle, { paused: 'Take a breather.', upgrade: 'Wave cleared.', won: 'You held the line.', lost: 'The rift fought back.' }[state.phase]);
      textIfChanged(overlayDetail, state.phase === 'paused' ? 'Press P or Resume to continue.' : state.phase === 'upgrade' ? 'Choose your next upgrade below.' : `${state.score} POINTS · ${state.kills} ENEMIES CLEARED`);
      propIfChanged(replay, 'hidden', state.phase === 'paused' || state.phase === 'upgrade');
    }
    updateUpgrades();
    onUpdate({ phase: state.phase === 'upgrade' ? 'playing' : state.phase, score: state.score, record: state.score,
      recordKey: { standard: 'default', veteran: 'veteran-v4', nightmare: 'nightmare-v4' }[state.difficulty],
      recordLabel: { standard: 'EXPEDITION BEST', veteran: 'VETERAN BEST', nightmare: 'NIGHTMARE BEST' }[state.difficulty], scoreLabel: 'SCORE', detail });
    if (changedPhase && state.phase === 'upgrade') upgradeChoices.querySelector('button')?.focus({ preventScroll: true });
  }

  function rect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }
  function line(x1, y1, x2, y2, color, width = 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function circle(x, y, radius, color, outline = false, width = 2) {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (outline) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }
    else { ctx.fillStyle = color; ctx.fill(); }
  }
  function polygon(points, color) {
    ctx.fillStyle = color; ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(Math.round(x), Math.round(y)) : ctx.moveTo(Math.round(x), Math.round(y)));
    ctx.closePath(); ctx.fill();
  }
  function floor(sectorIndex = 0) {
    const palette = SECTORS[sectorIndex];
    rect(0, 0, W, H, '#10262c');
    rect(20, 20, W - 40, H - 40, palette.floor);
    const stone = [palette.tile, palette.floor, palette.tile, palette.floor, palette.floor];
    for (let y = 25, row = 0; y < H - 20; y += 52, row += 1) {
      for (let x = 24 - row % 2 * 42; x < W - 20; x += 84) {
        const hash = Math.abs((x * 17 + y * 7) % 31);
        const left = Math.max(21, x); const right = Math.min(W - 21, x + 81);
        if (right <= left) continue;
        rect(left, y, right - left, Math.min(49, H - 21 - y), stone[hash % stone.length]);
        rect(left + 2, y + 1, Math.max(0, right - left - 4), 1, '#354b4c');
        if (hash < 8) {
          rect(left + 10, y + 31, 16, 2, '#344b4b');
          rect(left + 25, y + 33, 8, 1, '#1f3539');
        }
        if (hash % 9 === 0) {
          line(left + 39, y + 6, left + 35, y + 16, '#20383c', 2);
          line(left + 35, y + 16, left + 43, y + 24, '#20383c', 2);
        }
      }
    }
    // Inlaid floor conduits and broken stone stay below the contrast of threats.
    for (const x of [187, W - 191]) {
      rect(x, 82, 7, H - 164, '#1b3338'); rect(x + 2, 84, 2, H - 168, '#45605b');
      for (let y = 105; y < H - 95; y += 69) rect(x - 2, y, 11, 4, '#536d60');
    }
    for (const y of [96, H - 100]) {
      rect(189, y, W - 378, 5, '#1b3338'); rect(191, y + 1, W - 382, 1, '#45605b');
      for (let x = 246; x < W - 190; x += 88) rect(x, y - 3, 4, 11, '#536d60');
    }
    for (const [x, y] of [[38, 38], [W - 147, 38], [38, H - 81], [W - 147, H - 81]]) {
      rect(x, y, 109, 43, '#1c3337'); rect(x + 3, y + 3, 103, 37, '#43584f');
      rect(x + 6, y + 6, 97, 30, '#1b3337');
      for (let gx = x + 10; gx < x + 101; gx += 11) rect(gx, y + 7, 3, 28, '#526457');
      rect(x + 5, y + 5, 99, 2, '#8b9272');
      rect(x + 8, y + 38, 93, 2, '#142c31');
    }
    // This seal is painted flush with the floor, so its geometry remains walkable.
    ctx.save(); ctx.translate(W / 2, H / 2);
    const seal = Array.from({ length: 12 }, (_, index) => {
      const angle = index * Math.PI / 6 + Math.PI / 12;
      return [Math.cos(angle) * 110, Math.sin(angle) * 110];
    });
    polygon(seal, '#1d3538');
    const inner = seal.map(([x, y]) => [x * .92, y * .92]);
    polygon(inner, '#304d48');
    polygon(inner.map(([x, y]) => [x * .95, y * .95]), '#233e3e');
    circle(0, 0, 75, '#3d5b51', true, 2);
    circle(0, 0, 63, '#385247', true, 1);
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4;
      ctx.save(); ctx.rotate(angle);
      rect(81, -4, 10, 7, '#6e8064'); rect(93, -2, 8, 3, '#536b58');
      ctx.restore();
    }
    polygon([[-54, -3], [-28, -18], [-9, -43], [2, -10], [33, -27], [49, -48], [38, -7], [14, 6], [24, 32], [-6, 22], [-29, 44], [-16, 12]], '#152f34');
    line(-38, 0, -14, -17, '#547d68', 4); line(-14, -17, -7, -33, '#547d68', 4);
    line(-14, -17, 0, 5, '#547d68', 4); line(0, 5, 26, -13, '#547d68', 4);
    line(26, -13, 37, -31, '#547d68', 3); line(0, 5, -19, 28, '#547d68', 3);
    rect(-12, -15, 3, 12, '#7ea687'); rect(13, -6, 9, 2, '#7ea687');
    ctx.restore();
    // Thick outer stonework frames the arena without adding collision objects.
    rect(0, 0, W, 14, '#0c2028'); rect(0, H - 14, W, 14, '#0c2028');
    rect(0, 0, 14, H, '#0c2028'); rect(W - 14, 0, 14, H, '#0c2028');
    rect(14, 14, W - 28, 3, '#65806d'); rect(14, H - 17, W - 28, 3, '#314c47');
    rect(14, 17, 3, H - 34, '#516e60'); rect(W - 17, 17, 3, H - 34, '#314c47');
    for (let x = 52; x < W - 25; x += 68) {
      rect(x, 2, 36, 8, '#263f42'); rect(x + 4, 3, 28, 2, '#607862');
      rect(x, H - 10, 36, 8, '#263f42'); rect(x + 4, H - 7, 28, 2, '#496655');
    }
    for (let y = 88; y < H - 25; y += 72) {
      rect(2, y, 8, 40, '#263f42'); rect(W - 10, y, 8, 40, '#263f42');
      rect(4, y + 4, 2, 32, '#607862'); rect(W - 7, y + 4, 2, 32, '#496655');
    }
    for (const [x, y] of [[32, 108], [W - 47, 108], [32, H - 128], [W - 47, H - 128]]) {
      rect(x - 5, y - 5, 23, 26, '#1a3236');
      rect(x, y, 13, 18, '#678971'); rect(x + 3, y + 2, 7, 14, '#aad0a3');
      rect(x + 4, y + 3, 5, 4, '#e3dcac'); rect(x + 3, y + 19, 7, 3, '#152f33');
      rect(x - 13, y + 4, 5, 11, '#2e4944'); rect(x + 20, y + 4, 5, 11, '#2e4944');
    }
    if (sectorIndex > 0) {
      ctx.globalAlpha = .12;
      rect(20, 20, W - 40, H - 40, palette.accent);
      ctx.globalAlpha = .4;
      if (sectorIndex === 1) {
        for (const [x, y] of [[78, 155], [900, 480], [68, 510], [910, 140]]) {
          polygon([[x, y - 24], [x + 13, y - 4], [x + 7, y + 22], [x - 10, y + 15], [x - 15, y - 4]], '#99bcc9');
          line(x, y - 18, x - 2, y + 16, '#d3e1d9', 2);
        }
      } else if (sectorIndex === 2) {
        for (let y = 152; y < H - 105; y += 40) for (const x of [53, W - 60]) {
          line(x, y, x + 10, y + 30, '#95a461', 4);
          polygon([[x + 4, y + 8], [x - 9, y + 2], [x - 5, y + 18]], '#abb775');
          polygon([[x + 7, y + 18], [x + 23, y + 12], [x + 15, y + 29]], '#7d995f');
        }
      } else {
        for (let index = 0; index < 80; index += 1) {
          const x = 60 + index * 97 % 880; const y = 90 + index * 71 % 485;
          rect(x, y, index % 7 ? 2 : 4, index % 7 ? 2 : 4, '#d7b8d5');
        }
        circle(W / 2, H / 2, 146, '#b8a1c5', true, 1);
        circle(W / 2, H / 2, 151, '#8973a8', true, 1);
      }
      ctx.globalAlpha = 1;
    }
    // Recessed service equipment belongs to the floor, never to collision.
    for (const sign of [-1, 1]) {
      const x = sign < 0 ? 78 : W - 138;
      for (const y of [244, 366]) {
        rect(x, y, 60, 48, '#142d32'); rect(x + 2, y + 2, 56, 44, palette.tile);
        rect(x + 5, y + 4, 50, 2, palette.edge);
        for (let i = 0; i < 5; i += 1) rect(x + 8 + i * 9, y + 11, 4, 17, '#173438');
        rect(x + 9, y + 35, 22, 2, palette.accent); rect(x + 42, y + 34, 6, 4, '#203c40');
      }
    }
    ctx.globalAlpha = .3;
    if (sectorIndex === 1) {
      for (const sign of [-1, 1]) {
        const x = sign < 0 ? 91 : W - 91;
        polygon([[x - 33, 170], [x + 22, 143], [x + 44, 180], [x + 24, 205], [x - 22, 204]], '#7097a2');
        line(x - 20, 176, x + 23, 181, '#b1ccd0', 2);
      }
      for (const y of [55, H - 55]) for (let x = 220; x < W - 180; x += 106) {
        line(x, y, x + 41, y + 13, '#86b7bf', 2); line(x + 41, y + 13, x + 56, y + 9, '#86b7bf');
      }
    } else if (sectorIndex === 2) {
      for (const sign of [-1, 1]) for (const y of [183, 482]) {
        const x = sign < 0 ? 82 : W - 82;
        for (let i = 0; i < 5; i += 1) {
          const a = i * 1.26;
          polygon([[x, y], [x + Math.cos(a) * 31, y + Math.sin(a) * 31], [x + Math.cos(a + .45) * 27, y + Math.sin(a + .45) * 27]], i % 2 ? '#7f9b67' : '#526f4d');
        }
        circle(x, y, 7, '#afb573');
      }
    } else if (sectorIndex === 3) {
      for (const x of [107, W - 107]) for (const y of [179, 504]) {
        circle(x, y, 31, '#a491b7', true); circle(x, y, 23, '#a491b7', true);
        polygon([[x, y - 18], [x + 12, y], [x, y + 18], [x - 12, y]], '#a899b7');
        line(x - 37, y, x + 37, y, '#a491b7');
      }
    } else {
      for (const y of [154, H - 154]) {
        line(212, y, 258, y, '#a3ae80', 2); line(W - 258, y, W - 212, y, '#a3ae80', 2);
        rect(231, y - 4, 8, 8, '#859f7d'); rect(W - 239, y - 4, 8, 8, '#859f7d');
      }
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 13px ui-monospace, monospace'; ctx.fillStyle = palette.edge;
    ctx.textAlign = 'center'; ctx.fillText(String(sectorIndex + 1).padStart(2, '0'), W / 2, 58);
    ctx.font = '9px ui-monospace, monospace'; ctx.fillStyle = palette.edge;
    ctx.fillText(palette.name.toUpperCase(), W / 2, H - 34); ctx.textAlign = 'left';
  }
  function cover(sectorIndex = 0) {
    const materials = [
      { frame: '#899680', light: '#d2cba0', panel: '#516b5b', inset: '#29443e', trim: '#ada174' },
      { frame: '#82a2ad', light: '#d4e5dc', panel: '#4b727e', inset: '#294956', trim: '#9bd0d2' },
      { frame: '#879271', light: '#c5c69a', panel: '#637351', inset: '#394b39', trim: '#b9b886' },
      { frame: '#9e91b3', light: '#dfcbe0', panel: '#66597e', inset: '#3d3957', trim: '#c9b0d5' },
    ];
    const material = materials[sectorIndex];
    for (const obstacle of OBSTACLES) {
      const { x, y, width, height } = obstacle;
      rect(x + 7, y + 8, width + 1, height + 2, '#132c31');
      rect(x, y, width, height, material.frame);
      rect(x + 3, y + 3, width - 6, height - 6, material.inset);
      rect(x + 4, y + 4, width - 8, height - 18, material.panel);
      rect(x + 4, y + height - 14, width - 8, 10, material.inset);
      rect(x + 4, y + height - 14, width - 8, 2, '#70856b');
      rect(x + 5, y + 4, width - 10, 3, material.light);
      rect(x + 7, y + 10, width - 14, 1, '#7e9273');
      rect(x + 11, y + 15, width - 22, height - 40, material.inset);
      rect(x + 13, y + 17, width - 26, height - 44, material.panel);
      if (sectorIndex === 0) {
        for (let offset = 18; offset < width - 15; offset += 9) rect(x + offset, y + 20, 4, height - 43, '#203b36');
      } else if (sectorIndex === 1) {
        polygon([[x + 28, y + 20], [x + 46, y + 14], [x + 62, y + 28], [x + 48, y + 45], [x + 29, y + 38]], '#8cb4bf');
        line(x + 46, y + 18, x + 42, y + 40, '#e0eeeb', 2);
      } else if (sectorIndex === 2) {
        line(x + 17, y + 20, x + width - 17, y + height - 28, '#97a170', 4);
        line(x + width - 17, y + 20, x + 17, y + height - 28, '#77865c', 3);
      } else {
        polygon([[x + 45, y + 14], [x + 64, y + 30], [x + 45, y + 47], [x + 26, y + 30]], '#a291b4');
        polygon([[x + 45, y + 20], [x + 57, y + 30], [x + 45, y + 41], [x + 33, y + 30]], '#4e486b');
      }
      rect(x + width / 2 - 7, y + height / 2 - 8, 14, 10, '#29483e');
      rect(x + width / 2 - 4, y + height / 2 - 6, 8, 5, material.light);
      for (const ox of [7, width - 10]) for (const oy of [8, height - 10]) {
        rect(x + ox, y + oy, 4, 4, '#c8bd87'); rect(x + ox + 1, y + oy + 1, 2, 2, '#6a7358');
      }
      for (let stripe = 0; stripe < 4; stripe += 1) rect(x + 12 + stripe * 18, y + height - 9, 9, 3, material.trim);
      if (sectorIndex === 2) {
        line(x + 8, y + 6, x + 18, y + 48, '#3b573d', 4);
        polygon([[x + 12, y + 18], [x + 23, y + 13], [x + 18, y + 26]], '#a6b583');
        polygon([[x + 17, y + 32], [x + 5, y + 31], [x + 12, y + 43]], '#7b9567');
      }
    }
  }
  function telegraph(enemy) {
    if (enemy.phase !== 'windup') return;
    const angle = Math.atan2(enemy.aimY, enemy.aimX);
    const flash = reducedMotion.matches ? .7 : .62 + .1 * Math.sin(state.elapsed * 12);
    ctx.save(); ctx.globalAlpha = flash;
    if (enemy.type === 'brute') {
      const maximumReach = chargeSpeed(state, enemy) * .65;
      let reach = maximumReach;
      const half = enemy.radius + 7;
      const dx = Math.cos(angle); const dy = Math.sin(angle);
      for (let distance = 4; distance <= maximumReach; distance += 4) {
        const x = enemy.x + dx * distance; const y = enemy.y + dy * distance;
        const obstructed = x < enemy.radius || x > W - enemy.radius || y < enemy.radius || y > H - enemy.radius || OBSTACLES.some(obstacle => Math.hypot(x - clamp(x, obstacle.x, obstacle.x + obstacle.width), y - clamp(y, obstacle.y, obstacle.y + obstacle.height)) < enemy.radius);
        if (obstructed) { reach = distance; break; }
      }
      polygon([[enemy.x - dy * half, enemy.y + dx * half], [enemy.x + dy * half, enemy.y - dx * half], [enemy.x + dx * reach + dy * half, enemy.y + dy * reach - dx * half], [enemy.x + dx * reach - dy * half, enemy.y + dy * reach + dx * half]], '#c99250');
      ctx.globalAlpha = .85;
      ctx.setLineDash([12, 9]);
      line(enemy.x, enemy.y, enemy.x + dx * reach, enemy.y + dy * reach, '#ffe0a0', 3);
    } else if (enemy.type === 'chaser') {
      circle(enemy.x, enemy.y, 57, '#ce7866');
      ctx.globalAlpha = .85;
      circle(enemy.x, enemy.y, 57, '#ffd29a', true, 3);
    } else if (enemy.boss) {
      const name = enemy.attackName;
      const spoke = (a, color = '#f3aaca', reach = 132) => line(enemy.x + Math.cos(a) * (enemy.radius + 10), enemy.y + Math.sin(a) * (enemy.radius + 10), enemy.x + Math.cos(a) * reach, enemy.y + Math.sin(a) * reach, color, 3);
      circle(enemy.x, enemy.y, enemy.radius + 37, SECTORS[enemy.bossSector].accent, true, 5);
      if (name === 'radial' || name === 'double-ring') {
        const count = name === 'radial' ? 12 : 10;
        for (let i = 0; i < count; i += 1) {
          spoke(angle + (i - (count - 1) / 2) * Math.PI * 2 / count);
          if (name === 'double-ring') spoke(angle + (i - (count - 1) / 2) * Math.PI * 2 / count + Math.PI / count, '#d3c0e3', 104);
        }
      } else if (name === 'crown') {
        for (let i = 2; i < 17; i += 1) spoke(angle + i * Math.PI * 2 / 18);
        spoke(angle - Math.PI / 6, '#b8e0b6', 150); spoke(angle + Math.PI / 6, '#b8e0b6', 150);
      } else if (name === 'cross') {
        for (let direction = 0; direction < 4; direction += 1) for (let i = -1; i <= 1; i += 1) spoke(angle + direction * Math.PI / 2 + i * .09, '#f3aaca', 160);
      } else if (name === 'fan' || name === 'fan-mines' || name === 'rift-lanes') {
        const count = name === 'fan-mines' ? 7 : 5;
        const spread = name === 'fan' ? .14 : name === 'fan-mines' ? .13 : .2;
        for (let i = 0; i < count; i += 1) spoke(angle + (i - (count - 1) / 2) * spread, '#f3aaca', 190);
        if (name !== 'fan') circle(enemy.x, enemy.y, enemy.radius + 54, '#e5a780', true, 2);
      } else {
        for (let i = 0; i < 3; i += 1) circle(enemy.x + (i - 1) * 38, enemy.y - 60, 9, '#e5a780', true, 3);
      }
    } else {
      const { count, spread } = enemyShotPattern(state, enemy);
      for (let i = 0; i < count; i += 1) {
        const a = angle + (i - (count - 1) / 2) * spread;
        line(enemy.x + Math.cos(a) * enemy.radius, enemy.y + Math.sin(a) * enemy.radius, enemy.x + Math.cos(a) * 190, enemy.y + Math.sin(a) * 190, '#f3aaca', i === Math.floor(count / 2) ? 3 : 2);
      }
      circle(enemy.x, enemy.y, enemy.radius + 9, '#f3aaca', true, 3);
    }
    ctx.restore();
  }
  function guardianSprite(enemy, x, y) {
    const sectorIndex = enemy.bossSector;
    const winding = enemy.phase === 'windup' || enemy.phase === 'burst';
    const pulse = reducedMotion.matches ? 0 : Math.sin(state.elapsed * 4) * 1.5;
    ctx.save(); ctx.translate(x, y);
    const face = Math.atan2(enemy.aimY, enemy.aimX);
    if (sectorIndex === 0) {
      // The Warden: a compact horned siege suit with a split faceplate.
      polygon([[-29, -16], [-19, -30], [19, -30], [29, -16], [29, 17], [17, 29], [-17, 29], [-29, 17]], '#422f41');
      for (const sign of [-1, 1]) {
        polygon([[sign * 14, -18], [sign * 22, -37], [sign * 29, -26], [sign * 24, -7]], '#cab49b');
        polygon([[sign * 13, -17], [sign * 30, -11], [sign * 29, 14], [sign * 19, 22]], winding ? '#e3b4c4' : '#bf8195');
        line(sign * 17, -13, sign * 26, -9, '#f0c6b0', 3);
        rect(sign * 20 - 5, 17, 10, 13, '#735367');
        rect(sign * 20 - 5, 17, 10, 3, '#dca6ad');
      }
      polygon([[-16, -23], [16, -23], [21, 11], [10, 24], [-10, 24], [-21, 11]], '#a97187');
      polygon([[-13, -18], [13, -18], [14, 8], [0, 19], [-14, 8]], '#574052');
      rect(-11, -15, 22, 5, '#251f34'); rect(-10, -14, 8, 2, '#ffe3b3'); rect(2, -14, 8, 2, '#ffe3b3');
      polygon([[0, -2], [9, 8], [0, 20], [-9, 8]], winding ? '#ffe5bb' : '#e6abaf');
      rect(-2, 3, 4, 9, '#fff0cd');
    } else if (sectorIndex === 1) {
      // The Archivist: an icy central prism between two mechanical folios.
      for (const sign of [-1, 1]) {
        polygon([[sign * 12, -21], [sign * 29, -28], [sign * 35, -9], [sign * 29, 22], [sign * 11, 12]], '#335565');
        polygon([[sign * 14, -20], [sign * 27, -25], [sign * 31, -8], [sign * 26, 18], [sign * 14, 9]], winding ? '#d9eff1' : '#97c2d0');
        for (let row = 0; row < 4; row += 1) line(sign * 17, -14 + row * 7, sign * 27, -17 + row * 7, '#466c80', 2);
        polygon([[sign * 13, 20], [sign * 22, 28], [sign * 14, 33], [sign * 8, 23]], '#95b9cb');
      }
      polygon([[0, -34 - pulse], [14, -12], [11, 19], [0, 33 + pulse], [-11, 19], [-14, -12]], '#c6e6e5');
      polygon([[0, -28], [8, -10], [5, 19], [0, 27], [-7, 11], [-8, -10]], '#5f8aa3');
      polygon([[0, -23], [3, -6], [0, 20], [-4, 0]], winding ? '#fff7d8' : '#c5eff2');
      rect(-8, -10, 16, 5, '#264958'); rect(-5, -9, 10, 2, '#e4fcf4');
    } else if (sectorIndex === 2) {
      // The Thorn Regent: a living seed pod with four hooked bark limbs.
      for (let i = 0; i < 4; i += 1) {
        ctx.save(); ctx.rotate(Math.PI / 4 + i * Math.PI / 2);
        polygon([[12, -8], [32, -14], [37, -3], [25, 10], [14, 9]], '#48513a');
        polygon([[14, -6], [29, -11], [31, -4], [22, 6], [14, 7]], winding ? '#d5d99e' : '#91a970');
        polygon([[26, -9], [38, -15], [32, 0]], '#d5c594');
        ctx.restore();
      }
      polygon([[0, -29], [20, -20], [27, 1], [15, 25], [0, 31], [-15, 25], [-27, 1], [-20, -20]], '#40533d');
      polygon([[0, -26], [15, -16], [20, 2], [10, 21], [0, 26], [-13, 19], [-20, 0], [-15, -16]], '#9eac76');
      polygon([[0, -19], [10, -8], [9, 15], [0, 23], [-9, 15], [-10, -8]], '#617d55');
      polygon([[0, -10], [7, 2], [0, 16], [-7, 2]], winding ? '#ffedb3' : '#d9ca90');
      for (const sign of [-1, 1]) line(sign * 5, -16, sign * 15, -21, '#e0d4a6', 3);
      rect(-12, -10, 8, 3, '#253b32'); rect(4, -10, 8, 3, '#253b32');
      rect(-10, -9, 5, 1, '#eff6bd'); rect(5, -9, 5, 1, '#eff6bd');
    } else {
      // The Crown of Glass: eight angular plates around a suspended star core.
      for (let i = 0; i < 8; i += 1) {
        ctx.save(); ctx.rotate(i * Math.PI / 4 + (reducedMotion.matches ? 0 : Math.sin(state.elapsed * .7) * .04));
        polygon([[15, -6], [28, -11], [36 + pulse, 0], [28, 11], [15, 6]], '#65517f');
        polygon([[18, -4], [28, -8], [32 + pulse, 0], [27, 6], [20, 4]], winding ? '#ead8ed' : i % 2 ? '#c3acd7' : '#a58abf');
        line(25, -5, 30, 0, '#f2dae7', 2); ctx.restore();
      }
      polygon([[0, -25], [17, -17], [25, 0], [17, 17], [0, 25], [-17, 17], [-25, 0], [-17, -17]], '#3c355b');
      polygon([[0, -20], [12, -12], [18, 0], [12, 12], [0, 20], [-12, 12], [-18, 0], [-12, -12]], '#997dac');
      polygon([[0, -14], [5, -4], [15, 0], [5, 4], [0, 15], [-5, 4], [-15, 0], [-5, -4]], winding ? '#fff0db' : '#e7c2de');
      circle(0, 0, 4, '#fbf1cd');
    }
    // The small face mark follows the actual locked attack direction.
    ctx.rotate(face); polygon([[enemy.radius - 4, -3], [enemy.radius + 2, 0], [enemy.radius - 4, 3]], '#fff0bd');
    ctx.restore();
  }
  function paintEnemyBody(enemy, x, y) {
    const winding = enemy.phase === 'windup';
    if (enemy.type === 'boss') {
      guardianSprite(enemy, x, y);
    } else if (enemy.type === 'brute') {
      ctx.save(); ctx.translate(x, y);
      ctx.rotate(Math.atan2(enemy.aimY, enemy.aimX));
      rect(-20, -18, 10, 36, '#b4905d'); rect(-20, -18, 4, 36, '#ddbd7a');
      rect(-12, -20, 27, 40, '#665c44'); rect(-12, -20, 27, 4, '#d0ac6c');
      rect(-9, -15, 22, 30, winding ? '#c1a577' : '#9c8358');
      rect(-16, -24, 11, 12, '#c3a16d'); rect(-16, 12, 11, 12, '#c3a16d');
      rect(-14, -24, 7, 3, '#e0c690'); rect(-14, 12, 7, 3, '#e0c690');
      rect(-7, -9, 22, 18, '#485145'); rect(7, -7, 9, 14, '#d9ba7e');
      rect(12, -4, 5, 8, winding ? '#fff0c3' : '#f0cd93');
      rect(-6, -13, 4, 5, '#c9b47d'); rect(-6, 8, 4, 5, '#c9b47d');
      for (const sign of [-1, 1]) {
        polygon([[9, sign * 9], [18, sign * 14], [24, sign * 7], [20, sign * 3]], '#ead19a');
        rect(-17, sign * 18 - 2, 15, 4, '#293e3b');
        for (let i = 0; i < 3; i += 1) rect(-15 + i * 5, sign * 18 - 1, 2, 2, '#d2b984');
      }
      rect(-10, -3, 13, 6, '#718067'); rect(-7, -1, 7, 2, '#e9d2a4');
      ctx.restore();
    } else if (enemy.type === 'weaver') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(enemy.aimY, enemy.aimX));
      polygon([[-17, -10], [-4, -13], [16, 0], [-4, 13], [-17, 10], [-10, 0]], winding ? '#bce4dc' : '#68a49b');
      const wing = enemy.spritePose;
      for (const sign of [-1, 1]) {
        polygon([[-9, sign * 8], [-20, sign * (16 + wing)], [-5, sign * (22 + wing)], [5, sign * 9]], '#386b70');
        line(-14, sign * (15 + wing), -5, sign * (18 + wing), '#9ed9c7', 2);
      }
      polygon([[-9, -6], [7, 0], [-9, 6]], '#314f54');
      rect(6, -3, 9, 6, '#e6dab5'); rect(-18, -13, 5, 5, '#8bc3ad'); rect(-18, 8, 5, 5, '#8bc3ad');
      ctx.restore();
    } else if (enemy.type === 'ranged') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(enemy.aimY, enemy.aimX));
      polygon([[-16, -5], [-9, -16], [5, -11], [13, -7], [13, 7], [5, 11], [-9, 16], [-16, 5]], '#493f62');
      polygon([[-13, -3], [-7, -13], [3, -8], [10, 0], [3, 8], [-7, 13], [-13, 3]], winding ? '#cfc2e0' : '#a497c1');
      rect(-11, -5, 14, 10, '#55516f'); rect(-8, -4, 7, 8, '#d0b2cf');
      polygon([[0, -6], [9, -5], [15, 0], [9, 5], [0, 6]], '#384251');
      for (const offset of [-.16, 0, .16]) {
        ctx.save(); ctx.rotate(offset); rect(10, -2, 10, 4, '#8c6c98'); rect(17, -2, 3, 4, winding ? '#fff1d9' : '#eed0e3'); ctx.restore();
      }
      line(-10, -11, -4, -9, '#e8d4da', 2); line(-10, 11, -4, 9, '#b19bc3', 2);
      ctx.restore();
    } else {
      ctx.save(); ctx.translate(x, y);
      const facing = 0;
      ctx.rotate(facing);
      const stride = enemy.spritePose;
      for (const sign of [-1, 1]) {
        rect(-10 + sign * stride, sign * 10 - 2, 5, 8, '#855454');
        rect(-4 - sign * stride, sign * 12 - 2, 5, 7, '#c98b78');
      }
      polygon([[-14, -7], [-8, -13], [6, -12], [14, -5], [14, 5], [6, 12], [-8, 13], [-14, 7]], '#72484b');
      rect(-9, -10, 15, 20, winding ? '#e5b39b' : '#c58a79');
      rect(-9, -10, 4, 20, '#995e59'); rect(-5, -10, 11, 3, '#e6b7a0');
      polygon([[1, -8], [13, -7], [17, -2], [17, 2], [13, 7], [1, 8]], '#dfab91');
      rect(7, -5, 8, 10, '#593b42'); rect(12, -3, 3, 6, '#ffe2aa');
      rect(-13, -5, 5, 10, '#a66559'); ctx.restore();
      ctx.save(); ctx.translate(x, y); ctx.rotate(facing);
      for (const sign of [-1, 1]) {
        polygon([[3, sign * 8], [12, sign * 15], [19, sign * 11], [11, sign * 10]], winding ? '#ffe0ba' : '#e6b294');
        line(-9, sign * 10, -2, sign * 12, '#f0c5a8', 2);
      }
      ctx.restore();
    }
  }
  function enemySprite(enemy) {
    const x = Math.round(enemy.x); const y = Math.round(enemy.y);
    const r = enemy.radius;
    circle(x + 4, y + 6, r + 2, '#10282d');
    if (enemy.boss) guardianSprite(enemy, x, y);
    else {
      const winding = enemy.phase === 'windup';
      const facing = enemy.type === 'chaser' && !winding
        ? Math.atan2(state.player.y - y, state.player.x - x) : Math.atan2(enemy.aimY, enemy.aimX);
      const pose = reducedMotion.matches ? 0 : enemy.type === 'weaver'
        ? Math.round(Math.sin(state.elapsed * 9 + enemy.id) * 2)
        : enemy.type === 'chaser' && enemy.phase === 'seeking' ? Math.round(Math.sin(state.elapsed * 15 + enemy.id) * 2) : 0;
      const key = `${enemy.type}:${winding}:${pose}`;
      let layer = enemyBodyLayers.get(key);
      if (!layer) {
        layer = bodyLayer(() => paintEnemyBody({ ...enemy, aimX: 1, aimY: 0, spritePose: pose }, 0, 0));
        enemyBodyLayers.set(key, layer);
      }
      ctx.save(); ctx.translate(x, y); ctx.rotate(facing); ctx.imageSmoothingEnabled = true;
      ctx.drawImage(layer, -32, -32, 64, 64); ctx.restore();
    }
    if (enemy.elite) {
      const eliteColor = { swift: '#87d1cb', armored: '#f2cd87', volatile: '#ed9b8d' }[enemy.affix];
      circle(x, y, r + 7, eliteColor, true, 2);
      const symbol = enemy.affix === 'swift' ? '»' : enemy.affix === 'armored' ? '▣' : '✦';
      ctx.font = 'bold 12px ui-monospace, monospace'; ctx.fillStyle = eliteColor; ctx.textAlign = 'center';
      ctx.fillText(symbol, x, y - r - 12); ctx.textAlign = 'left';
    }
    if (enemy.slowTime > 0) circle(x, y, r + 3, '#99dce0', true, 1.5);
    const flash = enemyFlashes.find(item => item.id === enemy.id);
    if (flash) {
      ctx.save(); ctx.globalAlpha = flash.life / .1;
      circle(x, y, Math.max(6, r * .55), '#ffebc3', true, 3); ctx.restore();
    }
    if (enemy.hp < enemy.maxHp || enemy.type === 'boss') {
      const barWidth = enemy.type === 'boss' ? 90 : Math.max(28, r * 2);
      rect(x - barWidth / 2, y - r - (enemy.type === 'boss' ? 25 : 11), barWidth, 4, '#132b31');
      rect(x - barWidth / 2, y - r - (enemy.type === 'boss' ? 25 : 11), barWidth * clamp(enemy.hp / enemy.maxHp, 0, 1), 4, enemy.type === 'boss' ? '#e7a5c0' : '#e2ac80');
    }
  }
  function paintPlayerArmor(color) {
    polygon([[-13, -6], [-6, -12], [6, -11], [12, -5], [12, 5], [6, 11], [-6, 12], [-13, 6]], '#16333a');
    rect(-12, -5, 7, 10, '#7a8b80'); rect(-11, -4, 4, 2, '#dee0b4'); rect(-11, 2, 4, 2, '#deac75');
    for (const sign of [-1, 1]) {
      polygon([[-6, sign * 7], [-1, sign * 12], [8, sign * 9], [7, sign * 5]], color);
      line(-2, sign * 9, 6, sign * 7, '#ffe0ad', 2);
    }
    polygon([[-4, -8], [7, -7], [12, -3], [12, 3], [7, 7], [-4, 8]], color);
    polygon([[2, -5], [10, -4], [12, 0], [10, 4], [2, 5]], '#284d54');
    line(6, -3, 10, -2, '#a5d9cf', 2); line(10, -2, 10, 2, '#e8f3d5', 2);
    rect(-2, -7, 6, 2, '#ffdda2'); rect(-2, 5, 6, 2, '#b37451');
  }
  function playerSprite(player, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha;
    const x = Math.round(player.x); const y = Math.round(player.y);
    const angle = Math.atan2(player.aimY, player.aimX);
    const immune = player.invulnerable > 0 || player.damageCooldown > 0;
    const color = immune && (reducedMotion.matches || Math.floor(state.elapsed * 10) % 2) ? '#ffddb0' : '#ecab70';
    circle(x + 4, y + 6, 14, '#112b30');
    if (alpha === 1) circle(x, y, player.radius, '#d4c89a55', true, 1);
    ctx.translate(x, y); ctx.rotate(angle);
    const stride = walking && !reducedMotion.matches ? Math.sin(gait) * 3 : 0;
    rect(-13 - stride, -10, 8, 6, '#182f32'); rect(-13 + stride, 4, 8, 6, '#182f32');
    let armor = playerArmorLayers.get(color);
    if (!armor) { armor = bodyLayer(() => paintPlayerArmor(color)); playerArmorLayers.set(color, armor); }
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(armor, -32, -32, 64, 64); ctx.restore();
    const recoil = player.fireCooldown > player.fireInterval * .75 ? 2 : 0;
    rect(8 - recoil, -4, 14, 8, '#284a4e'); rect(10 - recoil, -4, 11, 2, '#ecddb3');
    rect(14 - recoil, -2, 4, 4, player.overheated ? '#e69674' : '#8ebdb0');
    rect(21 - recoil, -3, 7, 6, '#9bac9c'); rect(25 - recoil, -4, 3, 8, '#e8dfb7');
    if (player.fireCooldown > player.fireInterval * .78) polygon([[29, -5], [39, -2], [33, 0], [39, 2], [29, 5]], '#ffecb6');
    ctx.restore();
    if (alpha === 1 && player.dashTime > 0) circle(x, y, 22, '#a5e2bc', true, 2);
    if (alpha === 1 && player.focusReady) circle(x, y, 20, '#e9c493', true, 2);
  }
  function hazardMarks() {
    for (const hazard of state.hazards) {
      ctx.save();
      const warning = hazard.warning > 0;
      ctx.globalAlpha = warning ? .2 : .5;
      if (hazard.kind === 'blast') circle(hazard.x, hazard.y, hazard.radius, '#df946f');
      else if (hazard.kind === 'vertical') rect(hazard.x - hazard.width / 2, 0, hazard.width, H, '#ce89b3');
      else rect(0, hazard.y - hazard.width / 2, W, hazard.width, '#ce89b3');
      ctx.globalAlpha = warning ? .85 : 1;
      ctx.setLineDash(warning ? [8, 6] : []);
      if (hazard.kind === 'blast') {
        circle(hazard.x, hazard.y, hazard.radius, '#ffd1a1', true, 2);
        ctx.setLineDash([]);
        circle(hazard.x, hazard.y, Math.max(3, hazard.radius * (1 - clamp(hazard.warning, 0, 1))), '#eec79b', true, 1);
        line(hazard.x - 7, hazard.y, hazard.x + 7, hazard.y, '#ffe0b2', 2);
        line(hazard.x, hazard.y - 7, hazard.x, hazard.y + 7, '#ffe0b2', 2);
      } else if (hazard.kind === 'vertical') {
        line(hazard.x - hazard.width / 2, 0, hazard.x - hazard.width / 2, H, '#f3c7dd', 2);
        line(hazard.x + hazard.width / 2, 0, hazard.x + hazard.width / 2, H, '#f3c7dd', 2);
      } else {
        line(0, hazard.y - hazard.width / 2, W, hazard.y - hazard.width / 2, '#f3c7dd', 2);
        line(0, hazard.y + hazard.width / 2, W, hazard.y + hazard.width / 2, '#f3c7dd', 2);
      }
      ctx.restore();
    }
  }
  function draw() {
    if (!ctx || destroyed) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(floorLayers[state.sector], 0, 0);
    for (const fragment of fragments) {
      ctx.save(); ctx.translate(fragment.x, fragment.y); ctx.rotate(fragment.angle);
      ctx.globalAlpha = Math.min(.55, fragment.life / .7);
      for (let i = 0; i < 4; i += 1) {
        ctx.rotate(Math.PI / 2);
        polygon([[7, -2], [13, -4], [17, 1], [9, 3]], fragment.color);
      }
      circle(0, 0, 6, '#122c30'); ctx.restore();
    }
    for (const enemy of state.enemies) telegraph(enemy);
    hazardMarks();
    ctx.drawImage(coverLayers[state.sector], 0, 0);
    for (const arc of arcs) {
      ctx.globalAlpha = clamp(arc.life / .16, 0, 1);
      const midX = (arc.x + arc.toX) / 2 + 4;
      const midY = (arc.y + arc.toY) / 2 - 6;
      line(arc.x, arc.y, midX, midY, '#c1ecdf', 3);
      line(midX, midY, arc.toX, arc.toY, '#c1ecdf', 3);
    }
    ctx.globalAlpha = 1;
    for (const ghost of ghosts) playerSprite(ghost, Math.max(0, ghost.life / .17) * .38);
    for (const ring of rings) {
      const progress = 1 - ring.life / ring.maxLife;
      ctx.globalAlpha = Math.max(0, 1 - progress) * .55;
      circle(ring.x, ring.y, ring.radius + (reducedMotion.matches ? 0 : progress * ring.growth), ring.color, true, 2);
    }
    ctx.globalAlpha = 1;
    for (const projectile of state.projectiles) {
      const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
      const trail = projectile.owner === 'player' ? 22 : 12;
      const hue = projectile.owner === 'player' ? state.player.frost ? '#a8e5df' : '#ffe7a1' : '#f3bdd4';
      line(projectile.x - projectile.vx / speed * trail, projectile.y - projectile.vy / speed * trail, projectile.x, projectile.y, '#10272f', 6);
      line(projectile.x - projectile.vx / speed * trail, projectile.y - projectile.vy / speed * trail, projectile.x, projectile.y, projectile.owner === 'player' ? '#c5ad7a' : '#ac78a8', projectile.owner === 'player' ? 2 : 3);
      if (projectile.owner === 'enemy') circle(projectile.x, projectile.y, projectile.radius + 2, '#6a3e67', true, 2);
      circle(projectile.x, projectile.y, Math.max(3, projectile.radius), hue);
      if (projectile.owner === 'enemy') circle(projectile.x, projectile.y, Math.max(1.5, projectile.radius - 2), '#fff0dc');
      else circle(projectile.x, projectile.y, 1.5, '#fff4d6');
    }
    if (enemyOrderDirty || enemyDrawOrder.length !== state.enemies.length) {
      enemyDrawOrder = state.enemies.slice(); enemyOrderDirty = false;
    }
    enemyDrawOrder.sort((a, b) => a.y - b.y);
    for (const enemy of enemyDrawOrder) enemySprite(enemy);
    playerSprite(state.player);
    for (const particle of particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      rect(particle.x, particle.y, particle.size, particle.size, particle.color);
    }
    ctx.globalAlpha = 1;
    for (const marker of hitMarkers) {
      ctx.globalAlpha = marker.life / marker.maxLife;
      const gap = marker.kill ? 6 : 3;
      const size = marker.kill ? 12 : 7;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) line(marker.x + sx * gap, marker.y + sy * gap, marker.x + sx * size, marker.y + sy * size, marker.kill ? '#f9deb0' : '#eed6a5', 2);
    }
    ctx.globalAlpha = 1;
    const aim = input();
    const length = Math.hypot(aim.aimX, aim.aimY) || 1;
    const crosshair = aimPoint || { x: state.player.x + aim.aimX / length * 95, y: state.player.y + aim.aimY / length * 95 };
    if (state.phase === 'playing') {
      circle(crosshair.x, crosshair.y, 9, '#102832', true, 4);
      circle(crosshair.x, crosshair.y, 9, state.player.overheated ? '#e8997e' : '#e5d8a6', true, 1.5);
      for (const sign of [-1, 1]) {
        line(crosshair.x + sign * 12, crosshair.y, crosshair.x + sign * 5, crosshair.y, '#ffe1a1', 2);
        line(crosshair.x, crosshair.y + sign * 12, crosshair.x, crosshair.y + sign * 5, '#ffe1a1', 2);
      }
    }
    if (!reducedMotion.matches && state.player.damageCooldown > .32) {
      ctx.globalAlpha = Math.min(.1, (state.player.damageCooldown - .32) * .43);
      rect(0, 0, W, H, '#d47d70'); ctx.globalAlpha = 1;
    }
    ctx.font = 'bold 11px ui-monospace, monospace'; ctx.fillStyle = '#829c7f'; ctx.textAlign = 'left';
    ctx.fillText(`${String(state.kills).padStart(2, '0')} CLEARED`, 38, H - 30);
    ctx.textAlign = 'right'; ctx.fillStyle = '#c6b9a0';
    const boss = state.enemies.find(enemy => enemy.boss);
    if (boss) ctx.fillText(boss.bossName.toUpperCase(), W - 38, H - 30);
    ctx.textAlign = 'left';
  }
  function effects(dt) {
    if (reducedMotion.matches) { particles = []; ghosts = []; }
    effectTime += dt;
    const traveled = Math.hypot(state.player.x - previousPlayer.x, state.player.y - previousPlayer.y);
    walking = traveled > .01;
    gait += traveled * .13;
    previousPlayer = { x: state.player.x, y: state.player.y };
    for (const event of state.events) {
      if (event.id <= lastEvent) continue;
      lastEvent = event.id;
      if (event.type === 'arc') arcs.push({ ...event, life: .16 });
      if (event.type === 'pulse') rings.push({ x: event.x, y: event.y, radius: reducedMotion.matches ? event.radius : 0, growth: reducedMotion.matches ? 0 : event.radius, life: .22, maxLife: .22, color: '#b0ded0' });
      if (event.type === 'hit') enemyFlashes.push({ id: event.enemyId, life: .1 });
      if (event.type === 'bounce') {
        hitMarkers.push({ x: event.x, y: event.y, kill: false, life: .12, maxLife: .12 });
        if (!reducedMotion.matches) for (let i = 0; i < 4; i += 1) {
          const a = i * 1.57 + event.id;
          particles.push({ x: event.x, y: event.y, vx: Math.cos(a) * 75, vy: Math.sin(a) * 75, size: 2, life: .12, maxLife: .12, color: '#b7e0db' });
        }
      }
      const isKill = event.type === 'kill' || event.type === 'enemy-killed';
      if (isKill || event.type === 'wave') enemyOrderDirty = true;
      if (isKill) fragments.push({ x: event.x, y: event.y, angle: event.id * .73, life: .9,
        color: { chaser: '#bd8b79', ranged: '#a997b9', brute: '#c2a071', weaver: '#83b8a7', boss: '#d7b9c4' }[event.enemyType] || '#bd8b79' });
      if (isKill || event.type === 'hurt' || event.type === 'hit') {
        hitMarkers.push({ x: event.x ?? state.player.x, y: event.y ?? state.player.y, kill: isKill, life: isKill ? .22 : .1, maxLife: isKill ? .22 : .1 });
        for (let i = 0; i < (reducedMotion.matches ? 0 : isKill ? 14 : 6); i += 1) {
          const a = i * 2.399 + event.id;
          const speed = 38 + i * 7;
          particles.push({ x: event.x ?? state.player.x, y: event.y ?? state.player.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, size: 2 + i % 3, life: .25 + i % 3 * .04, maxLife: .33, color: isKill ? i % 3 ? '#ca9e89' : '#ecd2a2' : '#f0b986' });
        }
      }
      if (!reducedMotion.matches && (isKill || event.type === 'dash')) rings.push({ x: event.x, y: event.y, radius: isKill ? 7 : 13, growth: isKill ? 24 : 17, life: .24, maxLife: .24, color: isKill ? '#b9ae88' : '#a4d6b2' });
    }
    if (!reducedMotion.matches && state.player.dashTime > 0 && effectTime > .025) {
      ghosts.push({ ...state.player, life: .17 }); effectTime = 0;
    }
    advanceEffects(particles, dt, 160, true);
    advanceEffects(ghosts, dt, 12);
    advanceEffects(rings, dt, 24);
    advanceEffects(hitMarkers, dt, 20);
    advanceEffects(arcs, dt, 30);
    advanceEffects(fragments, dt, 16);
    advanceEffects(enemyFlashes, dt, 30);
  }
  function advanceEffects(list, dt, maximum, moving = false) {
    let write = 0;
    for (const effect of list) {
      effect.life -= dt;
      if (moving) { effect.x += effect.vx * dt; effect.y += effect.vy * dt; }
      if (effect.life > 0) list[write++] = effect;
    }
    list.length = write;
    if (write > maximum) list.splice(0, write - maximum);
  }
  function frame(time) {
    if (destroyed) return;
    raf = null;
    const dt = previousFrame === null ? 0 : clamp((time - previousFrame) / 1000, 0, .08);
    previousFrame = time;
    if (state.phase === 'playing') {
      accumulator += dt;
      let ticks = 0;
      while (accumulator >= STEP && ticks < 10 && state.phase === 'playing') {
        step(state, input(), STEP);
        if (dashQueued || fireQueued) {
          dashQueued = false; fireQueued = false; syncControls();
        }
        effects(STEP);
        accumulator -= STEP;
        ticks += 1;
      }
    } else accumulator = 0;
    publish();
    draw();
    scheduleFrame();
  }
  function scheduleFrame() {
    if (!destroyed && state.phase === 'playing' && raf === null) raf = requestAnimationFrame(frame);
  }
  function refresh() {
    if (state.phase !== 'playing' && raf !== null) { cancelAnimationFrame(raf); raf = null; }
    publish(true); draw(); scheduleFrame();
  }
  function togglePause() {
    if (destroyed) return;
    releaseControls();
    pauseState(state);
    previousFrame = null; accumulator = 0;
    refresh();
  }
  function restart() {
    if (destroyed) return;
    releaseControls();
    state = createState({ difficulty }); previousFrame = null; accumulator = 0;
    enemyOrderDirty = true;
    lastEvent = -1; lastPublished = -Infinity; lastPhase = null;
    particles = []; ghosts = []; rings = []; hitMarkers = []; arcs = []; fragments = []; enemyFlashes = []; effectTime = 0; upgradeSignature = ''; buildSignature = null;
    gait = 0; walking = false; previousPlayer = { x: state.player.x, y: state.player.y };
    aimPoint = null; aimVector = { x: 1, y: 0 };
    refresh(); canvas.focus({ preventScroll: true });
  }
  function keydown(event) {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || isForm(event.target)) return;
    const focused = event.target instanceof Element ? event.target.closest('button[data-control]') : null;
    const activation = event.code === 'Space' || event.key === ' ' || event.key === 'Enter';
    const focusedControl = activation && focused && controls.contains(focused) ? focused.dataset.control : null;
    const control = focusedControl || KEY_CONTROLS[gameKey(event)];
    if (!control || state.phase !== 'playing') return;
    if (!focusedControl && activation && event.target instanceof Element && event.target.closest('button,a')) return;
    event.preventDefault();
    if (event.repeat && !keys.has(event.code || event.key)) return;
    keys.set(event.code || event.key, control);
    if (control === 'dash') dashQueued = true;
    if (control === 'fire') fireQueued = true;
    syncControls();
  }
  function keyup(event) { if (keys.delete(event.code || event.key)) syncControls(); }
  function canvasPoint(event) {
    const box = canvas.getBoundingClientRect();
    return { x: (event.clientX - box.left) / box.width * W, y: (event.clientY - box.top) / box.height * H };
  }
  function canvasMove(event) {
    if (state.phase !== 'playing' || event.pointerType === 'touch' && !pointers.has(event.pointerId)) return;
    aimPoint = canvasPoint(event);
  }
  function canvasDown(event) {
    if (state.phase !== 'playing' || event.button !== 0 && event.pointerType !== 'touch') return;
    event.preventDefault(); canvas.focus({ preventScroll: true });
    aimPoint = canvasPoint(event);
    fireQueued = true;
    pointers.set(event.pointerId, { target: canvas, control: 'fire' });
    try { canvas.setPointerCapture(event.pointerId); } catch {}
    syncControls();
  }
  function stickPosition(event, id) {
    const stick = sticks.get(id);
    const pad = stick.pad;
    const box = pad.getBoundingClientRect();
    stick.travel = box.width * .24;
    const radius = Math.max(1, box.width * .38);
    let x = (event.clientX - box.left - box.width / 2) / radius;
    let y = (event.clientY - box.top - box.height / 2) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    stickValues[id] = { x, y };
    if (id === 'aim' && Math.hypot(x, y) > .16) fireQueued = true;
    syncControls();
  }
  function controlDown(event) {
    const target = event.target instanceof Element ? event.target.closest('[data-stick],[data-control]') : null;
    if (!target || !controls.contains(target) || state.phase !== 'playing' || event.button !== 0 && event.pointerType !== 'touch') return;
    const id = target.dataset.stick;
    if (id && [...pointers.values()].some(pointer => pointer.stick === id)) return;
    event.preventDefault();
    pointers.set(event.pointerId, { target, stick: id, control: target.dataset.control });
    if (target.dataset.control === 'dash') dashQueued = true;
    if (target.dataset.control === 'fire') fireQueued = true;
    try { target.setPointerCapture(event.pointerId); } catch {}
    if (id) stickPosition(event, id);
    else syncControls();
  }
  function controlMove(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer?.stick) return;
    event.preventDefault(); stickPosition(event, pointer.stick);
  }
  function pointerEnd(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    pointers.delete(event.pointerId);
    if (pointer.stick) stickValues[pointer.stick] = { x: 0, y: 0 };
    try { if (pointer.target.hasPointerCapture?.(event.pointerId)) pointer.target.releasePointerCapture(event.pointerId); } catch {}
    syncControls();
  }
  function upgradeClick(event) {
    const button = event.target instanceof Element ? event.target.closest('[data-upgrade]') : null;
    if (!button || !upgradeChoices.contains(button) || state.phase !== 'upgrade') return;
    releaseControls();
    const result = chooseUpgrade(state, button.dataset.upgrade, { risk: riskInput.checked });
    if (!result.ok) return;
    previousFrame = null; accumulator = 0;
    refresh(); canvas.focus({ preventScroll: true });
  }
  const visibility = () => { if (document.hidden) releaseControls(); };
  const changeTier = () => { difficulty = tierSelect.value; restart(); };
  const controlResize = new ResizeObserver(entries => {
    for (const entry of entries) {
      const stick = sticks.get(entry.target.dataset.stick);
      stick.travel = (entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width + 2) * .24;
    }
    syncControls();
  });
  for (const { pad } of sticks.values()) controlResize.observe(pad);
  const motionChange = () => {
    if (reducedMotion.matches) { particles = []; ghosts = []; }
    if (state.phase !== 'playing') draw();
  };
  reducedMotion.addEventListener('change', motionChange);
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', releaseControls);
  document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('pointermove', canvasMove);
  canvas.addEventListener('pointerdown', canvasDown);
  controls.addEventListener('pointerdown', controlDown);
  window.addEventListener('pointermove', controlMove);
  window.addEventListener('pointerup', pointerEnd);
  window.addEventListener('pointercancel', pointerEnd);
  view.addEventListener('lostpointercapture', pointerEnd);
  upgradeChoices.addEventListener('click', upgradeClick);
  replay.addEventListener('click', restart);
  tierSelect.addEventListener('change', changeTier);
  floorLayers.forEach((layer, index) => { ctx = layer.getContext('2d'); floor(index); });
  coverLayers.forEach((layer, index) => { ctx = layer.getContext('2d'); cover(index); });
  ctx = displayContext;
  function updateKeyboardHints() {
    view.dataset.keyboardLayout = getKeyboardLayout();
    hint.querySelector('kbd').textContent = displayKey('WASD');
    canvas.setAttribute('aria-label', `Rift arena. Move with ${displayKey('WASD')} or arrow keys, aim with the pointer, hold click or J to fire, Space or Shift to dash.`);
  }
  const unsubscribeKeyboardLayout = subscribeKeyboardLayout(() => { releaseControls(); updateKeyboardHints(); });
  updateKeyboardHints();
  publish(true); draw();
  scheduleFrame();
  return {
    getState: () => copy(state), restart, togglePause,
    destroy() {
      if (destroyed) return;
      unsubscribeKeyboardLayout();
      destroyed = true; cancelAnimationFrame(raf); releaseControls();
      controlResize.disconnect(); reducedMotion.removeEventListener('change', motionChange);
      enemyBodyLayers.clear(); playerArmorLayers.clear(); enemyDrawOrder = [];
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', releaseControls);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointermove', canvasMove);
      canvas.removeEventListener('pointerdown', canvasDown);
      controls.removeEventListener('pointerdown', controlDown);
      window.removeEventListener('pointermove', controlMove);
      window.removeEventListener('pointerup', pointerEnd);
      window.removeEventListener('pointercancel', pointerEnd);
      view.removeEventListener('lostpointercapture', pointerEnd);
      upgradeChoices.removeEventListener('click', upgradeClick);
      replay.removeEventListener('click', restart);
      tierSelect.removeEventListener('change', changeTier);
      view.remove();
    },
  };
}
