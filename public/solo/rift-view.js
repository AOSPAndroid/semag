import { ARENA, OBSTACLES, TOTAL_WAVES, UPGRADES, createState, step, togglePause as pauseState, chooseUpgrade } from './rift-engine.js';

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
const UPGRADE_ART = {
  repair: { category: 'RECOVERY', path: 'M13 6h6v7h7v6h-7v7h-6v-7H6v-6h7z' },
  damage: { category: 'FIREPOWER', path: 'M13 4h6v3h3v17h-3v4h-6v-4h-3V7h3zM7 10H4v12h3zm21 0h-3v12h3z' },
  cooling: { category: 'HEAT CONTROL', path: 'M14 4h4v7l6-4 2 4-6 4 6 4-2 4-6-4v9h-4v-9l-6 4-2-4 6-4-6-4 2-4 6 4z' },
  mobility: { category: 'MOVEMENT', path: 'M11 6h11v12h5v8H7v-5h4zm-5 5H2v3h4zm0 7H1v3h5z' },
  battery: { category: 'STAMINA', path: 'M13 3h6v4h7v22H6V7h7zm3 7-5 9h5l-1 7 6-10h-5z' },
  plating: { category: 'DEFENSE', path: 'M6 6h20v14l-4 5-6 4-6-4-4-5zm5 4v9l5 5 5-5v-9z' },
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
  let state = createState();
  let destroyed = false;
  let raf;
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
  let upgradeSignature = '';
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
  const waveLabel = node('span', '', `WAVE 01 / ${TOTAL_WAVES}`);
  const enemyLabel = node('span', 'rift-enemy-count', 'CLEAR THE RIFT');
  const sector = node('span', 'rift-sector', 'SECTOR 07');
  topline.append(sector, waveLabel, enemyLabel);
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
  upgradePanel.append(upgradeHeading, upgradeChoices);
  const build = node('div', 'rift-build');
  build.setAttribute('aria-label', 'Your upgrade build');
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
    sticks.set(id, { pad, knob });
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
  view.append(topline, meters, board, upgradePanel, build, status, hint, controls);
  container.append(view);
  const displayContext = canvas.getContext('2d');
  let ctx = displayContext;
  const floorLayer = document.createElement('canvas');
  floorLayer.width = W; floorLayer.height = H;

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
      button.dataset.held = String(held[id]);
      button.setAttribute('aria-pressed', String(held[id]));
    }
    for (const [id, { pad, knob }] of sticks) {
      const value = stickValues[id];
      const active = Math.hypot(value.x, value.y) > .16;
      pad.dataset.held = String(active);
      pad.setAttribute('aria-pressed', String(active));
      const travel = pad.getBoundingClientRect().width * .24;
      knob.style.transform = `translate(${value.x * travel}px, ${value.y * travel}px)`;
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
    if (state.phase === 'upgrade') return `Wave ${state.wavesCleared} cleared. Choose an upgrade below before the next wave.`;
    if (state.phase === 'won') return `All ${TOTAL_WAVES} waves cleared. Your build held the rift.`;
    if (state.phase === 'lost') return `Reached wave ${state.wave}. Read the windups and try a new build.`;
    if (state.player.overheated) return 'Weapon overheated. Keep moving while it cools.';
    if (state.enemies.some(enemy => enemy.type === 'boss')) return 'Rift guardian: dash through the gaps and watch for its next windup.';
    return 'Break line of sight with cover. Dash through danger; leave enough stamina for the next attack.';
  }
  function descriptor(id) {
    return UPGRADES[id] || { id, name: id, description: 'Improve your next wave.' };
  }
  function updateUpgrades() {
    const signature = state.upgradeChoices.join('|');
    if (signature !== upgradeSignature) {
      upgradeSignature = signature;
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
    upgradePanel.hidden = !awaiting;
    for (const button of upgradeChoices.children) button.disabled = state.phase !== 'upgrade';
    build.replaceChildren(node('span', 'rift-build-label', 'YOUR BUILD'));
    const chosen = Object.entries(state.upgrades).filter(([, count]) => count > 0);
    if (!chosen.length) build.append(node('span', 'rift-build-empty', 'Make your first choice after wave 1.'));
    for (const [id, count] of chosen) build.append(node('span', 'rift-build-chip', `${descriptor(id).name || descriptor(id).title || id}${count > 1 ? ` ×${count}` : ''}`));
  }
  function publish(force = false) {
    if (!force && state.elapsed - lastPublished < .1 && state.phase === lastPhase) return;
    const changedPhase = state.phase !== lastPhase;
    if (changedPhase) releaseControls();
    lastPublished = state.elapsed;
    lastPhase = state.phase;
    view.dataset.phase = state.phase;
    view.dataset.wave = String(state.wave);
    view.dataset.health = String(Math.round(state.player.hp));
    waveLabel.textContent = `WAVE ${String(state.wave).padStart(2, '0')} / ${TOTAL_WAVES}`;
    enemyLabel.textContent = state.phase === 'upgrade' ? 'ALL CLEAR' : `${state.enemies.length} HOSTILES`;
    const values = {
      health: [state.player.hp, state.player.maxHp, `${Math.ceil(state.player.hp)} / ${state.player.maxHp}`],
      stamina: [state.player.stamina, state.player.maxStamina, `${Math.round(state.player.stamina)} / ${state.player.maxStamina}`],
      heat: [state.player.heat, state.player.maxHeat, state.player.overheated ? 'HOT' : `${Math.round(state.player.heat)}%`],
    };
    for (const [id, [value, max, label]] of Object.entries(values)) {
      const meter = meterNodes[id];
      meter.value.textContent = label;
      meter.fill.style.width = `${clamp(value / max, 0, 1) * 100}%`;
      meter.rail.setAttribute('aria-valuemax', String(max));
      meter.rail.setAttribute('aria-valuenow', String(Math.round(value)));
    }
    meterNodes.heat.rail.dataset.hot = String(state.player.overheated);
    const detail = details();
    if (status.textContent !== detail) status.textContent = detail;
    overlay.hidden = state.phase === 'playing';
    if (!overlay.hidden) {
      overlayEyebrow.textContent = { paused: 'HOLD YOUR POSITION', upgrade: 'A MOMENT BETWEEN WAVES', won: 'THE RIFT IS SEALED', lost: 'ONE MORE RUN' }[state.phase];
      overlayTitle.textContent = { paused: 'Take a breather.', upgrade: 'Wave cleared.', won: 'You held the line.', lost: 'The rift fought back.' }[state.phase];
      overlayDetail.textContent = state.phase === 'paused' ? 'Press P or Resume to continue.' : state.phase === 'upgrade' ? 'Choose your next upgrade below.' : `${state.score} POINTS · ${state.kills} ENEMIES CLEARED`;
      replay.hidden = state.phase === 'paused' || state.phase === 'upgrade';
    }
    updateUpgrades();
    onUpdate({ phase: state.phase === 'upgrade' ? 'playing' : state.phase, score: state.score, record: state.score, recordLabel: 'BEST SCORE', scoreLabel: 'SCORE', detail });
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
  function floor() {
    rect(0, 0, W, H, '#10262c');
    rect(20, 20, W - 40, H - 40, '#233b3e');
    const stone = ['#2a4042', '#263e40', '#2c4344', '#284043', '#253d40'];
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
    ctx.font = 'bold 13px ui-monospace, monospace'; ctx.fillStyle = '#627967';
    ctx.textAlign = 'center'; ctx.fillText('07', W / 2, 58);
    ctx.font = '9px ui-monospace, monospace'; ctx.fillStyle = '#667e6b';
    ctx.fillText('CONTAINMENT CHAMBER', W / 2, H - 34); ctx.textAlign = 'left';
  }
  function cover() {
    for (const obstacle of OBSTACLES) {
      const { x, y, width, height } = obstacle;
      rect(x + 7, y + 8, width + 1, height + 2, '#132c31');
      rect(x, y, width, height, '#7c8971');
      rect(x + 3, y + 3, width - 6, height - 6, '#3b554b');
      rect(x + 4, y + 4, width - 8, height - 18, '#586f5d');
      rect(x + 4, y + height - 14, width - 8, 10, '#29463e');
      rect(x + 4, y + height - 14, width - 8, 2, '#70856b');
      rect(x + 5, y + 4, width - 10, 3, '#a9ad88');
      rect(x + 7, y + 10, width - 14, 1, '#7e9273');
      rect(x + 11, y + 15, width - 22, height - 40, '#3e594e');
      rect(x + 13, y + 17, width - 26, height - 44, '#4c6656');
      line(x + 17, y + 20, x + width - 17, y + height - 28, '#7c8d6f', 3);
      line(x + width - 17, y + 20, x + 17, y + height - 28, '#7c8d6f', 3);
      rect(x + width / 2 - 7, y + height / 2 - 8, 14, 10, '#29483e');
      rect(x + width / 2 - 4, y + height / 2 - 6, 8, 5, '#b4b68a');
      for (const ox of [7, width - 10]) for (const oy of [8, height - 10]) {
        rect(x + ox, y + oy, 4, 4, '#c8bd87'); rect(x + ox + 1, y + oy + 1, 2, 2, '#6a7358');
      }
      for (let stripe = 0; stripe < 4; stripe += 1) rect(x + 12 + stripe * 18, y + height - 9, 9, 3, '#7f8160');
    }
  }
  function telegraph(enemy) {
    if (enemy.phase !== 'windup') return;
    const angle = Math.atan2(enemy.aimY, enemy.aimX);
    const flash = reducedMotion.matches ? .7 : .62 + .1 * Math.sin(state.elapsed * 12);
    ctx.save(); ctx.globalAlpha = flash;
    if (enemy.type === 'brute') {
      const maximumReach = (350 + state.wave * 4) * .65;
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
    } else if (enemy.type === 'boss' && enemy.pattern % 2 === 0) {
      circle(enemy.x, enemy.y, enemy.radius + 42, '#b97191', true, 6);
      for (let i = 0; i < 12; i += 1) {
        const a = angle + (i - 5.5) / 12 * Math.PI * 2;
        line(enemy.x + Math.cos(a) * (enemy.radius + 12), enemy.y + Math.sin(a) * (enemy.radius + 12), enemy.x + Math.cos(a) * 122, enemy.y + Math.sin(a) * 122, '#f3aaca', 3);
      }
    } else {
      const spread = enemy.type === 'boss' ? .14 : .16;
      const count = enemy.type === 'boss' ? 5 : 3;
      for (let i = 0; i < count; i += 1) {
        const a = angle + (i - (count - 1) / 2) * spread;
        line(enemy.x + Math.cos(a) * enemy.radius, enemy.y + Math.sin(a) * enemy.radius, enemy.x + Math.cos(a) * 190, enemy.y + Math.sin(a) * 190, '#f3aaca', i === Math.floor(count / 2) ? 3 : 2);
      }
      circle(enemy.x, enemy.y, enemy.radius + 9, '#f3aaca', true, 3);
    }
    ctx.restore();
  }
  function enemySprite(enemy) {
    const x = Math.round(enemy.x); const y = Math.round(enemy.y);
    const r = enemy.radius;
    circle(x + 4, y + 6, r + 2, '#10282d');
    const winding = enemy.phase === 'windup';
    if (enemy.type === 'boss') {
      const sovereign = state.wave === 10;
      const armor = winding ? '#e4bad0' : sovereign ? '#a698cb' : '#c88898';
      const highlight = sovereign ? '#d7c6e4' : '#efbfaa';
      if (sovereign) {
        polygon([[x - 30, y - 24], [x - 18, y - 36], [x, y - 26], [x + 18, y - 36], [x + 30, y - 24], [x + 24, y + 23], [x, y + 33], [x - 24, y + 23]], '#4c4266');
        for (const sign of [-1, 1]) {
          polygon([[x + sign * 15, y - 23], [x + sign * 27, y - 39], [x + sign * 29, y - 8]], highlight);
          polygon([[x + sign * 15, y - 13], [x + sign * 31, y - 22], [x + sign * 27, y + 25], [x + sign * 16, y + 17]], armor);
        }
        polygon([[x, y - 31], [x + 16, y - 9], [x + 10, y + 25], [x, y + 31], [x - 10, y + 25], [x - 16, y - 9]], '#665781');
        rect(x - 10, y - 15, 20, 5, '#d8cae8'); rect(x - 8, y - 10, 16, 6, '#253847');
        rect(x - 5, y - 8, 10, 3, '#f0c7e0');
        polygon([[x, y], [x + 9, y + 11], [x, y + 23], [x - 9, y + 11]], '#c1d9c4');
        polygon([[x, y + 4], [x + 4, y + 11], [x, y + 17], [x - 4, y + 11]], '#e8efcb');
      } else {
        polygon([[x - 29, y - 20], [x - 18, y - 31], [x + 18, y - 31], [x + 29, y - 20], [x + 29, y + 19], [x + 17, y + 30], [x - 17, y + 30], [x - 29, y + 19]], '#593d4f');
        for (const sign of [-1, 1]) {
          rect(x + sign * 21 - 4, y - 36, 8, 20, '#ccb59b');
          rect(x + sign * 21 - 2, y - 38, 5, 8, '#ece0bc');
          rect(x + sign * 25 - 6, y - 17, 12, 29, armor);
          rect(x + sign * 25 - 5, y - 16, 10, 4, highlight);
          rect(x + sign * 21 - 5, y + 14, 10, 14, '#987481');
        }
        rect(x - 18, y - 23, 36, 45, armor); rect(x - 15, y - 23, 30, 4, highlight);
        rect(x - 13, y - 16, 26, 29, '#6a4a59');
        rect(x - 13, y - 15, 26, 4, '#3b3342'); rect(x - 10, y - 13, 7, 3, '#ffe4ba'); rect(x + 3, y - 13, 7, 3, '#ffe4ba');
        polygon([[x, y - 3], [x + 10, y + 9], [x, y + 21], [x - 10, y + 9]], '#e1a5a9');
        rect(x - 3, y + 5, 6, 9, '#f6d6bc');
      }
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
      ctx.restore();
    } else if (enemy.type === 'ranged') {
      polygon([[x, y - 19], [x + 11, y - 9], [x + 15, y + 11], [x + 8, y + 18], [x + 2, y + 11], [x - 4, y + 18], [x - 15, y + 11], [x - 11, y - 9]], '#655879');
      polygon([[x, y - 18], [x + 8, y - 9], [x + 11, y + 7], [x - 11, y + 7], [x - 8, y - 9]], winding ? '#c4b9df' : '#a092ba');
      rect(x - 8, y - 8, 16, 11, '#35404e'); rect(x - 4, y - 6, 8, 4, '#f0c5df');
      rect(x - 11, y + 7, 5, 8, '#9185a8'); rect(x + 6, y + 7, 5, 8, '#9185a8');
      rect(x - 3, y + 5, 6, 12, '#726681');
      circle(x + enemy.aimX * 16, y + enemy.aimY * 16, 5, '#edd1e3');
      circle(x + enemy.aimX * 16, y + enemy.aimY * 16, 2, '#fff2d8');
    } else {
      ctx.save(); ctx.translate(x, y);
      const facing = winding ? Math.atan2(enemy.aimY, enemy.aimX) : Math.atan2(state.player.y - y, state.player.x - x);
      ctx.rotate(facing);
      const stride = reducedMotion.matches || enemy.phase !== 'seeking' ? 0 : Math.sin(state.elapsed * 15 + enemy.id) * 2;
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
    }
    if (enemy.hp < enemy.maxHp || enemy.type === 'boss') {
      const barWidth = enemy.type === 'boss' ? 90 : Math.max(28, r * 2);
      rect(x - barWidth / 2, y - r - (enemy.type === 'boss' ? 25 : 11), barWidth, 4, '#132b31');
      rect(x - barWidth / 2, y - r - (enemy.type === 'boss' ? 25 : 11), barWidth * clamp(enemy.hp / enemy.maxHp, 0, 1), 4, enemy.type === 'boss' ? '#e7a5c0' : '#e2ac80');
    }
  }
  function playerSprite(player, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha;
    const x = Math.round(player.x); const y = Math.round(player.y);
    const angle = Math.atan2(player.aimY, player.aimX);
    const immune = player.invulnerable > 0 || player.damageCooldown > 0;
    const color = immune && (reducedMotion.matches || Math.floor(state.elapsed * 10) % 2) ? '#ffddb0' : '#ecab70';
    circle(x + 4, y + 6, 14, '#112b30');
    if (alpha === 1) circle(x, y, 16, '#d4c89a', true, 1);
    ctx.translate(x, y); ctx.rotate(angle);
    const stride = walking && !reducedMotion.matches ? Math.sin(gait) * 3 : 0;
    rect(-13 - stride, -10, 8, 6, '#182f32'); rect(-13 + stride, 4, 8, 6, '#182f32');
    rect(-10, -12, 12, 24, '#a86d49'); rect(-9, -12, 3, 24, '#eaba85');
    rect(-7, -10, 17, 20, color); rect(-7, -10, 17, 3, '#ffcea0');
    rect(-5, -5, 6, 10, '#bf784c'); rect(-4, -4, 4, 8, '#dc9b63');
    rect(1, -12, 8, 5, '#ffc28c'); rect(1, 7, 8, 5, '#c58255');
    rect(4, -8, 13, 16, '#f2bb82'); rect(5, -7, 11, 3, '#ffe0ad');
    rect(12, -5, 5, 10, '#394f4b'); rect(14, -3, 3, 6, '#dce4ba');
    rect(5, 3, 9, 3, '#cf8f60');
    rect(13, -4, 12, 8, '#c7c9a4'); rect(16, -3, 15, 6, '#e2d6a7');
    rect(18, -3, 4, 6, '#667966'); rect(29, -4, 4, 8, '#adbfa0');
    if (player.fireCooldown > player.fireInterval * .65) polygon([[34, -6], [42, -3], [37, 0], [42, 3], [34, 6]], '#ffe3a0');
    ctx.restore();
    if (alpha === 1 && player.dashTime > 0) circle(x, y, 22, '#a5e2bc', true, 2);
  }
  function draw() {
    if (!ctx || destroyed) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(floorLayer, 0, 0);
    for (const enemy of state.enemies) telegraph(enemy);
    cover();
    for (const ghost of ghosts) playerSprite(ghost, Math.max(0, ghost.life / .17) * .38);
    for (const ring of rings) {
      const progress = 1 - ring.life / ring.maxLife;
      ctx.globalAlpha = Math.max(0, 1 - progress) * .55;
      circle(ring.x, ring.y, ring.radius + progress * ring.growth, ring.color, true, 2);
    }
    ctx.globalAlpha = 1;
    for (const projectile of state.projectiles) {
      const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
      const trail = projectile.owner === 'player' ? 22 : 12;
      line(projectile.x - projectile.vx / speed * trail, projectile.y - projectile.vy / speed * trail, projectile.x, projectile.y, projectile.owner === 'player' ? '#b99966' : '#a56b99', projectile.owner === 'player' ? 3 : 4);
      if (projectile.owner === 'enemy') circle(projectile.x, projectile.y, projectile.radius + 2, '#6a3e67', true, 2);
      circle(projectile.x, projectile.y, Math.max(3, projectile.radius), projectile.owner === 'player' ? '#ffe7a1' : '#f3bdd4');
      if (projectile.owner === 'enemy') circle(projectile.x, projectile.y, Math.max(1.5, projectile.radius - 2), '#fff0dc');
    }
    for (const enemy of [...state.enemies].sort((a, b) => a.y - b.y)) enemySprite(enemy);
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
      circle(crosshair.x, crosshair.y, 9, '#e5d8a6', true, 1.5);
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
    if (state.enemies.some(enemy => enemy.type === 'boss')) ctx.fillText(state.wave === 10 ? 'RIFT SOVEREIGN' : 'THE GATEWARDEN', W - 38, H - 30);
    ctx.textAlign = 'left';
  }
  function effects(dt) {
    effectTime += dt;
    const traveled = Math.hypot(state.player.x - previousPlayer.x, state.player.y - previousPlayer.y);
    walking = traveled > .01;
    gait += traveled * .13;
    previousPlayer = { x: state.player.x, y: state.player.y };
    for (const event of state.events) {
      if (event.id <= lastEvent) continue;
      lastEvent = event.id;
      const isKill = event.type === 'kill' || event.type === 'enemy-killed';
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
    particles = particles.filter(particle => { particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; return particle.life > 0; }).slice(-160);
    ghosts = ghosts.filter(ghost => { ghost.life -= dt; return ghost.life > 0; }).slice(-12);
    rings = rings.filter(ring => { ring.life -= dt; return ring.life > 0; }).slice(-24);
    hitMarkers = hitMarkers.filter(marker => { marker.life -= dt; return marker.life > 0; }).slice(-20);
  }
  function frame(time) {
    if (destroyed) return;
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
    raf = requestAnimationFrame(frame);
  }
  function togglePause() {
    if (destroyed) return;
    releaseControls();
    pauseState(state);
    previousFrame = null; accumulator = 0;
    publish(true); draw();
  }
  function restart() {
    if (destroyed) return;
    releaseControls();
    state = createState(); previousFrame = null; accumulator = 0;
    lastEvent = -1; lastPublished = -Infinity; lastPhase = null;
    particles = []; ghosts = []; rings = []; hitMarkers = []; effectTime = 0; upgradeSignature = '';
    gait = 0; walking = false; previousPlayer = { x: state.player.x, y: state.player.y };
    aimPoint = null; aimVector = { x: 1, y: 0 };
    publish(true); draw(); canvas.focus({ preventScroll: true });
  }
  function keydown(event) {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || isForm(event.target)) return;
    const focused = event.target instanceof Element ? event.target.closest('button[data-control]') : null;
    const activation = event.code === 'Space' || event.key === ' ' || event.key === 'Enter';
    const focusedControl = activation && focused && controls.contains(focused) ? focused.dataset.control : null;
    const control = focusedControl || KEY_CONTROLS[event.key] || KEY_CONTROLS[event.code];
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
    const pad = sticks.get(id).pad;
    const box = pad.getBoundingClientRect();
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
    const result = chooseUpgrade(state, button.dataset.upgrade);
    if (!result.ok) return;
    previousFrame = null; accumulator = 0;
    publish(true); draw(); canvas.focus({ preventScroll: true });
  }
  const visibility = () => { if (document.hidden) releaseControls(); };
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
  ctx = floorLayer.getContext('2d');
  floor();
  ctx = displayContext;
  publish(true); draw();
  raf = requestAnimationFrame(frame);
  return {
    getState: () => copy(state), restart, togglePause,
    destroy() {
      if (destroyed) return;
      destroyed = true; cancelAnimationFrame(raf); releaseControls();
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
      view.remove();
    },
  };
}
