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
  let upgradeSignature = '';
  let aimPoint = null;
  let aimVector = { x: 1, y: 0 };
  let dashQueued = false;
  let fireQueued = false;
  const keys = new Map();
  const pointers = new Map();
  const stickValues = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 } };
  const view = node('section', 'rift-view');
  view.setAttribute('aria-label', 'Rift Survivor arena');
  const topline = node('div', 'rift-topline');
  const waveLabel = node('span', '', `WAVE 01 / ${TOTAL_WAVES}`);
  const enemyLabel = node('span', 'rift-enemy-count', 'CLEAR THE RIFT');
  topline.append(waveLabel, enemyLabel);
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
  upgradeHeading.append(node('strong', '', 'Shape your next wave.'), node('span', '', 'CHOOSE ONE'));
  const upgradeChoices = node('div', 'rift-upgrade-choices');
  upgradePanel.append(upgradeHeading, upgradeChoices);
  const build = node('div', 'rift-build');
  build.setAttribute('aria-label', 'Your upgrade build');
  const status = node('p', 'rift-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const hint = node('p', 'rift-hint', 'WASD moves · pointer aims · hold click / J fires · Space / Shift dashes. Read the windups and use cover.');
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
  const ctx = canvas.getContext('2d');

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
        button.append(node('span', 'rift-upgrade-kicker', id === 'repair' ? 'RECOVER' : 'BUILD'), node('strong', '', choice.name || choice.title || id), node('span', 'rift-upgrade-description', choice.description || choice.detail || ''), node('b', '', 'Choose ↗'));
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
    enemyLabel.textContent = state.phase === 'upgrade' ? 'WAVE CLEARED' : `${state.enemies.length} HOSTILES · ${state.kills} CLEARED`;
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
    rect(0, 0, W, H, '#172d34');
    rect(16, 16, W - 32, H - 32, '#243c42');
    for (let y = 28; y < H - 20; y += 40) {
      for (let x = 28; x < W - 20; x += 40) {
        const hash = ((x / 4 | 0) * 17 + (y / 4 | 0) * 7) % 9;
        rect(x, y, 37, 37, hash < 3 ? '#2a4146' : '#273e44');
        if (hash === 0) rect(x + 8, y + 12, 4, 2, '#354b4e');
      }
    }
    // The broken rift is a floor landmark, never a threat or an obstacle.
    ctx.save(); ctx.translate(W / 2, H / 2);
    ctx.strokeStyle = '#45605c'; ctx.lineWidth = 3; ctx.setLineDash([9, 12]);
    ctx.beginPath(); ctx.arc(0, 0, 102, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    polygon([[-41, -4], [-10, -24], [7, -8], [43, -31], [20, 11], [4, 18], [-18, 34]], '#3c5854');
    line(-28, 9, -6, -9, '#79ad91', 3); line(-6, -9, 6, 5, '#79ad91', 3); line(6, 5, 28, -13, '#79ad91', 3);
    ctx.restore();
    const corners = [[29, 29], [W - 68, 29], [29, H - 68], [W - 68, H - 68]];
    for (const [x, y] of corners) {
      rect(x, y, 39, 4, '#839a82'); rect(x, y, 4, 39, '#839a82');
      rect(x + 8, y + 8, 17, 2, '#476d62'); rect(x + 8, y + 8, 2, 17, '#476d62');
    }
    for (let x = 97; x < W - 70; x += 80) {
      rect(x, 7, 29, 4, '#6a947a'); rect(x, H - 11, 29, 4, '#6a947a');
    }
    for (let y = 98; y < H - 70; y += 80) {
      rect(7, y, 4, 26, '#6a947a'); rect(W - 11, y, 4, 26, '#6a947a');
    }
  }
  function cover() {
    for (const obstacle of OBSTACLES) {
      const { x, y, width, height } = obstacle;
      rect(x + 5, y + 6, width + 1, height, '#152a30');
      rect(x, y, width, height, '#60796b');
      rect(x + 4, y + 4, width - 8, height - 8, '#405950');
      rect(x + 4, y + 4, width - 8, 5, '#82947a');
      rect(x + 4, y + height - 10, width - 8, 6, '#304c43');
      rect(x + 9, y + 13, Math.max(8, width - 18), 2, '#6e8570');
      for (const ox of [9, width - 12]) for (const oy of [10, height - 12]) rect(x + ox, y + oy, 3, 3, '#b5b78b');
      if (height > 55) rect(x + width / 2 - 2, y + 24, 4, height - 43, '#6a7e69');
    }
  }
  function telegraph(enemy) {
    if (enemy.phase !== 'windup') return;
    const angle = Math.atan2(enemy.aimY, enemy.aimX);
    const flash = .55 + .12 * Math.sin(state.elapsed * 18);
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
    circle(x + 3, y + 5, r + 1, '#162d31');
    const winding = enemy.phase === 'windup';
    if (enemy.type === 'boss') {
      const body = winding ? '#eaa7ae' : '#b56b87';
      polygon([[x - r, y - r * .55], [x - r * .6, y - r], [x + r * .6, y - r], [x + r, y - r * .55], [x + r, y + r * .6], [x + r * .45, y + r], [x - r * .45, y + r], [x - r, y + r * .6]], body);
      rect(x - r + 4, y - r - 12, 8, 15, '#d9c5a0'); rect(x + r - 12, y - r - 12, 8, 15, '#d9c5a0');
      rect(x - r * .64, y - r * .55, r * 1.28, r * 1.08, '#573f59');
      rect(x - 18, y - 9, 12, 5, '#f8dab0'); rect(x + 6, y - 9, 12, 5, '#f8dab0');
      polygon([[x, y - 1], [x + 11, y + 12], [x, y + 25], [x - 11, y + 12]], '#de939f');
    } else if (enemy.type === 'brute') {
      rect(x - r, y - r, r * 2, r * 2, winding ? '#e1ba79' : '#b79b65');
      rect(x - r + 4, y - r + 4, r * 2 - 8, r * 2 - 8, '#645f49');
      rect(x - r - 4, y - 9, 7, 18, '#d7b678'); rect(x + r - 3, y - 9, 7, 18, '#d7b678');
      rect(x - 9, y - 6, 18, 5, '#f2d597'); rect(x - 5, y + 4, 10, 5, '#b2a16e');
    } else if (enemy.type === 'ranged') {
      polygon([[x, y - r - 5], [x + r + 3, y], [x, y + r + 5], [x - r - 3, y]], winding ? '#d5b9e0' : '#9e8cb5');
      polygon([[x, y - r + 2], [x + r - 4, y], [x, y + r - 2], [x - r + 4, y]], '#4d485e');
      rect(x - 6, y - 3, 12, 6, '#efc1d7');
    } else {
      rect(x - r + 3, y - r, r * 2 - 6, 5, '#d3a58c');
      rect(x - r, y - r + 5, r * 2, r * 2 - 10, winding ? '#e8b497' : '#b77e6b');
      rect(x - r + 3, y + r - 5, r * 2 - 6, 5, '#8b5c50');
      rect(x - 8, y - 5, 16, 7, '#593e3d'); rect(x - 5, y - 3, 3, 3, '#f8d19a'); rect(x + 2, y - 3, 3, 3, '#f8d19a');
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
    const color = immune && Math.floor(state.elapsed * 15) % 2 ? '#ffe5ae' : '#efad72';
    circle(x + 3, y + 5, 14, '#172f34');
    rect(x - 9, y - 14, 18, 5, '#ffc38a'); rect(x - 13, y - 9, 26, 18, color); rect(x - 9, y + 9, 18, 5, '#c88354');
    rect(x - 9, y - 5, 18, 8, '#644738'); rect(x - 6, y - 3, 12, 3, '#fff0b7');
    rect(x - 10, y + 10, 7, 5, '#2a3633'); rect(x + 3, y + 10, 7, 5, '#2a3633');
    ctx.translate(x, y); ctx.rotate(angle);
    rect(9, -4, 17, 8, '#c3ccb0'); rect(20, -3, 9, 6, '#e8dfb3'); rect(11, -4, 4, 8, '#687d68');
    if (player.fireCooldown > player.fireInterval * .65) polygon([[29, -6], [38, -2], [33, 0], [38, 2], [29, 6]], '#ffdfa0');
    ctx.restore();
    if (alpha === 1 && player.dashTime > 0) circle(x, y, 22, '#a5e2bc', true, 2);
  }
  function draw() {
    if (!ctx || destroyed) return;
    ctx.imageSmoothingEnabled = false;
    floor();
    for (const enemy of state.enemies) telegraph(enemy);
    cover();
    for (const ghost of ghosts) playerSprite(ghost, Math.max(0, ghost.life / .17) * .38);
    for (const projectile of state.projectiles) {
      const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
      const trail = projectile.owner === 'player' ? 16 : 9;
      line(projectile.x - projectile.vx / speed * trail, projectile.y - projectile.vy / speed * trail, projectile.x, projectile.y, projectile.owner === 'player' ? '#e5b579' : '#db92b4', projectile.owner === 'player' ? 3 : 4);
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
    if (state.player.damageCooldown > .32) {
      ctx.globalAlpha = Math.min(.1, (state.player.damageCooldown - .32) * .43);
      rect(0, 0, W, H, '#d47d70'); ctx.globalAlpha = 1;
    }
    ctx.font = 'bold 11px ui-monospace, monospace'; ctx.fillStyle = '#779b8a'; ctx.textAlign = 'left';
    ctx.fillText('RIFT // CONTAINMENT FIELD', 28, H - 30);
    ctx.textAlign = 'right'; ctx.fillStyle = '#bad0a4';
    ctx.fillText(state.enemies.some(enemy => enemy.type === 'boss') ? 'GUARDIAN DETECTED' : 'COVER IS YOUR ADVANTAGE', W - 28, H - 30);
    ctx.textAlign = 'left';
  }
  function effects(dt) {
    effectTime += dt;
    for (const event of state.events) {
      if (event.id <= lastEvent) continue;
      lastEvent = event.id;
      const isKill = event.type === 'kill' || event.type === 'enemy-killed';
      if (isKill || event.type === 'hurt' || event.type === 'hit') {
        for (let i = 0; i < (isKill ? 11 : 5); i += 1) {
          const a = i * 2.399 + event.id;
          const speed = 38 + i * 7;
          particles.push({ x: event.x ?? state.player.x, y: event.y ?? state.player.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, size: 3 + i % 2, life: .25 + i % 3 * .04, maxLife: .33, color: isKill ? '#d1bd92' : '#f0b986' });
        }
      }
    }
    if (state.player.dashTime > 0 && effectTime > .025) {
      ghosts.push({ ...state.player, life: .17 }); effectTime = 0;
    }
    particles = particles.filter(particle => { particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; return particle.life > 0; }).slice(-160);
    ghosts = ghosts.filter(ghost => { ghost.life -= dt; return ghost.life > 0; }).slice(-12);
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
    particles = []; ghosts = []; effectTime = 0; upgradeSignature = '';
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
