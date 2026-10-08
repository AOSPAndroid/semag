import { createRenderSampling } from './render-sampling.js';
import { tickFraction } from '../display-timing.js';
import { ARENA, HITBOX, DIFFICULTIES, STAGES, UPGRADES, createState, step, chooseUpgrade, togglePause as pauseState, recordKey } from './starfall-engine.js';
import { gameKey, displayKey, getKeyboardLayout, subscribeKeyboardLayout } from '../keyboard-layout.js';
import { blocksSoloShortcut } from './input-shortcuts.js';

const W = ARENA.width; const H = ARENA.height; const STEP = 1 / 120;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const copy = value => JSON.parse(JSON.stringify(value));
const node = (tag, className, text) => { const element = document.createElement(tag); element.className = className; if (text !== undefined) element.textContent = text; return element; };
const text = (element, value) => { if (element.textContent !== value) element.textContent = value; };
const KEY_CONTROLS = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', Shift: 'focus', c: 'fire', C: 'fire', j: 'fire', J: 'fire', ' ': 'bomb', e: 'bomb', E: 'bomb', k: 'bomb', K: 'bomb' };
const ICON_PATHS = {
  lance: 'M14 2h4v19h4l-6 9-6-9h4zM6 6h3v11H6zm17 0h3v11h-3z',
  wings: 'M14 3h4v24h-4zM3 12l8-6v18l-8-6zm26 0-8-6v18l8-6z',
  cadence: 'M3 4h7v6H3zm10 0h7v6h-7zm10 0h7v6h-7zM3 14h7v6H3zm10 0h7v6h-7zm10 0h7v6h-7zM3 24h7v6H3zm10 0h7v6h-7zm10 0h7v6h-7z',
  thrusters: 'M11 2h10v16H11zM6 10h5v14H6zm15 0h5v14h-5zM13 20h6v5h-6zm0 7h6v3h-6z',
  patch: 'M12 3h8v9h9v8h-9v9h-8v-9H3v-8h9z',
  bomb: 'M13 3h6v6h7v17H6V9h7zM10 14h12v4H10zm5 6h4v4h-4z',
  graze: 'M10 3h12v3h5v5h3v10h-3v5h-5v3H10v-3H5v-5H2V11h3V6h5zm2 7v4H8v5h4v4h8v-4h4v-5h-4v-4z',
};
function upgradeIcon(id) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 32 32'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('shape-rendering', 'crispEdges'); const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', ICON_PATHS[id]); path.setAttribute('fill', 'currentColor'); path.setAttribute('fill-rule', 'evenodd'); svg.append(path); return svg;
}
function layer(width, height) { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; }

/** Original ships are drawn once on a 2px grid; no network asset dependencies. */
function shipArt(type, region = 0, phase = 1) {
  const boss = !['player', 'drone', 'skiff', 'weaver'].includes(type);
  const size = boss ? 112 : type === 'weaver' ? 48 : 40;
  const canvas = layer(size, size); const c = canvas.getContext('2d'); c.translate(size / 2, size / 2);
  const paint = (color, rects) => { c.fillStyle = color; for (const [x, y, w, h] of rects) c.fillRect(x, y, w, h); };
  if (type === 'player') {
    paint('#071720', [[-7, -19, 14, 36], [-17, -4, 34, 18], [-13, 13, 8, 5], [5, 13, 8, 5]]);
    paint('#7bd9d2', [[-5, -17, 10, 29], [-15, 0, 10, 11], [5, 0, 10, 11], [-11, 12, 6, 3], [5, 12, 6, 3]]);
    paint('#d9f1df', [[-3, -17, 6, 8], [-3, -7, 6, 4], [-15, 0, 4, 7], [11, 0, 4, 7]]);
    paint('#1c4e64', [[-3, -9, 6, 8], [-9, 5, 4, 6], [5, 5, 4, 6]]);
    paint('#ebae58', [[-13, 10, 6, 2], [7, 10, 6, 2]]);
    paint('#ffebbf', [[-11, 15, 4, 2], [7, 15, 4, 2]]);
    return canvas;
  }
  const metal = ['#478d99', '#a16e59', '#9c83c0'][region];
  const light = ['#9ccfd1', '#f0bd82', '#dbcbf0'][region];
  const dark = ['#193c52', '#573748', '#3d315c'][region];
  if (boss) {
    const crown = type === 'crown';
    paint('#07131e', [[-34, -25, 68, 52], [-48, -13, 96, 27], [-39, 14, 78, 13], [-25, 26, 50, 8]]);
    paint(dark, [[-32, -23, 64, 47], [-46, -11, 92, 23], [-37, 14, 74, 11], [-23, 25, 46, 6]]);
    paint(metal, [[-25, -19, 50, 37], [-43, -7, 13, 16], [30, -7, 13, 16], [-33, 14, 22, 8], [11, 14, 22, 8]]);
    paint(light, [[-23, -19, 46, 4], [-43, -7, 13, 3], [30, -7, 13, 3], [-33, 14, 7, 8], [26, 14, 7, 8]]);
    paint('#192137', [[-19, -10, 38, 20], [-11, 10, 22, 12], [-33, -19, 7, 10], [26, -19, 7, 10]]);
    paint(phase === 3 ? '#ff8c95' : phase === 2 ? '#f7c477' : '#8cddd1', [[-12, -6, 24, 12], [-9, 8, 18, 4], [-39, 3, 5, 8], [34, 3, 5, 8]]);
    paint('#fff0d1', [[-6, -4, 12, 5], [-3, 3, 6, 3]]);
    paint('#091522', [[-2, -7, 4, 14]]);
    paint(light, [[-21, -23, 5, 6], [16, -23, 5, 6], [-17, 25, 6, 7], [11, 25, 6, 7]]);
    if (type === 'manta' || type === 'seraph') {
      paint(metal, [[-52, -19, 10, 22], [42, -19, 10, 22], [-48, -23, 6, 7], [42, -23, 6, 7]]);
      paint(light, [[-52, -19, 4, 18], [48, -19, 4, 18]]);
    }
    if (crown) {
      paint('#e7b889', [[-27, -32, 7, 13], [-12, -37, 8, 18], [4, -37, 8, 18], [20, -32, 7, 13]]);
      paint('#ffebc1', [[-27, -32, 7, 4], [-12, -37, 8, 4], [4, -37, 8, 4], [20, -32, 7, 4]]);
    }
  } else if (type === 'weaver') {
    paint('#091622', [[-20, -9, 40, 20], [-11, -17, 22, 34]]);
    paint(dark, [[-18, -7, 36, 16], [-9, -15, 18, 30]]);
    paint(metal, [[-18, -7, 8, 16], [10, -7, 8, 16], [-7, -13, 14, 24]]);
    paint(light, [[-18, -7, 8, 3], [10, -7, 8, 3], [-7, -13, 14, 3]]);
    paint('#eea38d', [[-5, -3, 10, 7]]); paint('#ffecd3', [[-3, -1, 6, 3]]);
  } else {
    paint('#091622', [[-14, -10, 28, 21], [-8, -16, 16, 31]]);
    paint(dark, [[-12, -8, 24, 17], [-6, -14, 12, 27]]);
    paint(metal, [[-12, -8, 8, 15], [4, -8, 8, 15], [-4, -12, 8, 23]]);
    paint(light, [[-12, -8, 8, 3], [4, -8, 8, 3], [-4, -12, 8, 3]]);
    paint(type === 'drone' ? '#f4c878' : '#f29ea3', [[-4, -2, 8, 6]]);
    paint('#fff2d8', [[-2, 0, 4, 2]]);
    if (type === 'skiff') paint(light, [[-15, 7, 5, 4], [10, 7, 5, 4]]);
  }
  return canvas;
}

function background(region) {
  const canvas = layer(W, 1200); const c = canvas.getContext('2d');
  const palettes = [['#071626', '#102c3a', '#1b3a45'], ['#1a1320', '#32232b', '#4a3031'], ['#15122a', '#29233e', '#39314e']];
  const [base, panel, edge] = palettes[region]; c.fillStyle = base; c.fillRect(0, 0, W, 1200);
  const rect = (color, x, y, w, h) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  for (let y = 0; y < 1200; y += 120) {
    rect(panel, 0, y + 9, W, 1); rect(panel, 31, y + 12, 1, 96); rect(panel, 447, y + 12, 1, 96);
    if (region === 0) {
      for (let i = 0; i < 4; i += 1) { const x = 49 + ((y / 120 * 71 + i * 103) % 380); rect('#102532', x, y + 30 + i * 13, 42, 2); rect('#173340', x + 8, y + 33 + i * 13, 27, 1); }
      rect('#132737', 0, y + 24, 25, 75); rect('#28424a', 5, y + 28, 14, 3); rect('#172c3b', 459, y + 54, 21, 49);
      rect('#275150', 9, y + 78, 4, 5); rect('#21464a', 465, y + 66, 5, 4);
    } else if (region === 1) {
      rect('#38242d', 0, y + 8, 25, 98); rect('#533937', 2, y + 13, 15, 4); rect('#533937', 2, y + 96, 15, 4);
      rect('#38242d', 452, y + 40, 28, 74); rect('#68463b', 460, y + 45, 12, 4);
      rect('#2a1e28', 61 + (y / 120 % 3) * 124, y + 18, 81, 79); rect('#39272d', 65 + (y / 120 % 3) * 124, y + 20, 73, 2);
      for (let i = 0; i < 5; i += 1) rect('#3a292e', 69 + (y / 120 % 3) * 124 + i * 14, y + 83, 7, 4);
      rect('#7a4b35', 8, y + 37, 5, 16); rect('#4d3433', 466, y + 78, 4, 13);
    } else {
      rect('#302641', 0, y + 8, 22, 98); rect('#5b4569', 4, y + 12, 10, 4); rect('#3f3153', 460, y + 32, 20, 80);
      c.fillStyle = '#231d37'; c.beginPath(); const x = 95 + y / 120 % 3 * 118; c.moveTo(x, y + 12); c.lineTo(x + 30, y + 48); c.lineTo(x, y + 93); c.lineTo(x - 30, y + 48); c.closePath(); c.fill();
      rect('#302940', x - 1, y + 18, 2, 66); rect('#493b59', 8, y + 72, 4, 8); rect('#725879', 466, y + 45, 4, 9);
    }
  }
  // Fixed specks add texture without per-frame random draws or visual collision clutter.
  for (let i = 0; i < 100; i += 1) rect(region === 0 ? '#254052' : region === 1 ? '#513437' : '#504160', 40 + i * 137 % 398, i * 199 % 1200, i % 7 ? 1 : 2, 1);
  return canvas;
}

export function createStarfallPresentation() {
  return createRenderSampling({ fields: ['time', 'stageTime'],
    objects: { player: { fields: ['x', 'y'], decays: ['invulnerable'], maxDistance: 32 } },
    collections: { enemies: { fields: ['x', 'y'], maxDistance: 32 },
      hostileShots: { fields: ['x', 'y'], maxDistance: 32, velocityGuard: true },
      friendlyShots: { fields: ['x', 'y'], maxDistance: 32, velocityGuard: true },
      warnings: { fields: ['x', 'y'], decays: ['remaining'], maxDistance: 32 } },
    continuity: state => state.stage });
}

/** Event births are immediate. Motion and fading use the same sampled clock
 * as ships/shots, including frames with no new physics tick. */
export function createStarfallEffects() {
  const particles = [], rings = [], flashes = new Map(), poses = new WeakMap();
  const frame = { particles: [], rings: [], flashes: new Set(), bombGlow: 0 };
  let cursor = 0, bomb = null;
  return {
    capture(state, reducedMotion = false) {
      const born = state.time;
      // Expiration is monotonic and bounded; no display frame advances state.
      for (let index = particles.length - 1; index >= 0; index--)
        if (born - particles[index].born > particles[index].life + STEP) particles.splice(index, 1);
      for (const event of state.events) {
        if (event.id <= cursor) continue; cursor = event.id;
        if (event.type === 'bomb') { bomb = { born, life: reducedMotion ? .10 : .48 }; rings.push({ x: event.x, y: event.y, born, life: .7, radius: 24, color: '#a8ece0' }); }
        if (event.type === 'hit') rings.push({ x: event.x, y: event.y, born, life: .45, radius: 9, color: '#ffd29c' });
        if (['destroy', 'phase', 'guardian'].includes(event.type)) rings.push({ x: event.x, y: event.y, born, life: event.boss ? .7 : .4, radius: event.boss ? 32 : 12, color: event.type === 'phase' ? '#e8badb' : '#f5cf93' });
        if (event.type === 'spark') { const enemy = state.enemies.find(item => Math.hypot(item.x - event.x, item.y - event.y) < item.radius + 10); if (enemy) flashes.set(enemy.id, born); }
        const count = event.type === 'destroy' ? event.boss ? 20 : 9 : event.type === 'hit' ? 10 : event.type === 'spark' ? 2 : event.type === 'graze' ? 1 : 0;
        if (!reducedMotion) for (let index = 0; index < count && particles.length < 96; index++) {
          const direction = ((event.id * 13 + index * 7) % 31) / 31 * Math.PI * 2;
          const speed = event.type === 'spark' ? 22 : 28 + index % 5 * 11;
          particles.push({ x: event.x, y: event.y, vx: Math.cos(direction) * speed, vy: Math.sin(direction) * speed,
            born, life: event.type === 'graze' ? .18 : .32 + index % 3 * .06,
            color: event.type === 'graze' ? '#a3efe0' : '#f6cc91', size: event.type === 'destroy' ? 3 : 2 });
        }
      }
      if (rings.length > 12) rings.splice(0, rings.length - 12);
    },
    sample(time) {
      frame.particles.length = 0; frame.rings.length = 0; frame.flashes.clear();
      for (const source of particles) {
        const age = Math.max(0, time - source.born);
        if (age >= source.life) continue;
        let pose = poses.get(source); if (!pose) { pose = {}; poses.set(source, pose); }
        Object.assign(pose, source, { age, x: source.x + source.vx * age, y: source.y + source.vy * age });
        frame.particles.push(pose);
      }
      for (let index = rings.length - 1; index >= 0; index--) if (time - rings[index].born >= rings[index].life) rings.splice(index, 1);
      for (const source of rings) {
        let pose = poses.get(source); if (!pose) { pose = {}; poses.set(source, pose); }
        Object.assign(pose, source, { age: Math.max(0, time - source.born) }); frame.rings.push(pose);
      }
      for (const [id, born] of flashes) { if (time - born >= .08) flashes.delete(id); else frame.flashes.add(id); }
      frame.bombGlow = bomb ? Math.max(0, bomb.life - Math.max(0, time - bomb.born)) : 0;
      return frame;
    },
    reset(nextCursor = cursor) { cursor = nextCursor; particles.length = 0; rings.length = 0; flashes.clear(); bomb = null; frame.particles.length = 0; frame.rings.length = 0; frame.flashes.clear(); frame.bombGlow = 0; },
    reduceMotion() { particles.length = 0; rings.length = 0; },
  };
}

export function drawStarfallEffects(context, frame, reducedMotion = false) {
  for (const particle of frame.particles) {
    context.globalAlpha = 1 - particle.age / particle.life; context.fillStyle = particle.color;
    context.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  for (const ring of frame.rings) {
    context.globalAlpha = (1 - ring.age / ring.life) * .7; context.strokeStyle = ring.color; context.lineWidth = 2;
    context.beginPath(); context.arc(ring.x, ring.y, ring.radius + ring.age * (reducedMotion ? 0 : 95), 0, Math.PI * 2); context.stroke();
  }
  if (frame.bombGlow > 0) {
    context.globalAlpha = Math.min(.22, frame.bombGlow * .44); context.fillStyle = '#b9f8e5'; context.fillRect(0, 0, W, H);
  }
  context.globalAlpha = 1;
}

export function mount(container, { onUpdate = () => {} } = {}) {
  const presentation = createStarfallPresentation(), effects = createStarfallEffects();
  let displayState;
  let difficulty = 'veteran'; let state = createState({ difficulty }); let destroyed = false;
  let raf = null; let previous = null; let accumulator = 0; let lastPublished = -1; let lastPhase = null;
  let upgradeSignature = ''; let buildSignature = '';
  let bombQueued = false; let stick = { x: 0, y: 0 }; const keys = new Map(); const pointers = new Map();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const view = node('section', 'starfall-view'); view.setAttribute('aria-label', 'Starfall Squadron campaign');
  const header = node('div', 'starfall-heading'); const heading = node('div', '');
  const regionLabel = node('small', 'starfall-region'); const stageLabel = node('strong', 'starfall-stage'); heading.append(regionLabel, stageLabel);
  const tierLabel = node('label', 'starfall-tier', 'NEW RUN '); const tierSelect = node('select', ''); tierSelect.dataset.starfallDifficulty = ''; tierSelect.setAttribute('aria-label', 'Difficulty for a new Starfall campaign');
  for (const [id, value] of Object.entries(DIFFICULTIES)) { const option = node('option', '', value.title); option.value = id; tierSelect.append(option); } tierSelect.value = difficulty; tierLabel.append(tierSelect); header.append(heading, tierLabel);
  const route = node('ol', 'starfall-route'); route.setAttribute('aria-label', 'Six-stage campaign');
  const routeBadges = STAGES.map((stage, index) => { const badge = node('li', ''); badge.append(node('b', '', String(index + 1).padStart(2, '0')), node('span', '', stage.name)); route.append(badge); return badge; });
  const hud = node('div', 'starfall-hud'); const hullLabel = node('div', 'starfall-stat starfall-hull'); const hullCount = node('b', ''); hullLabel.append(node('small', '', 'HULL'), hullCount);
  const bombLabel = node('div', 'starfall-stat'); const bombCount = node('b', ''); bombLabel.append(node('small', '', 'NOVA'), bombCount);
  const scoreLabel = node('div', 'starfall-stat starfall-score'); const scoreCount = node('b', ''); scoreLabel.append(node('small', '', 'SCORE'), scoreCount);
  const chainLabel = node('div', 'starfall-stat'); const chainCount = node('b', ''); chainLabel.append(node('small', '', 'GRAZE'), chainCount); hud.append(hullLabel, bombLabel, scoreLabel, chainLabel);
  const board = node('div', 'starfall-board'); const canvas = node('canvas', 'starfall-canvas'); canvas.width = W; canvas.height = H; canvas.tabIndex = 0; canvas.dataset.soloFocus = ''; canvas.setAttribute('role', 'img');
  const bossHud = node('div', 'starfall-boss'); bossHud.hidden = true; const bossLine = node('div', 'starfall-boss-line'); const bossName = node('b', ''); const bossPhase = node('span', ''); bossLine.append(bossName, bossPhase);
  const bossRail = node('div', 'starfall-boss-rail'); bossRail.setAttribute('role', 'progressbar'); bossRail.setAttribute('aria-label', 'Guardian hull'); bossRail.setAttribute('aria-valuemin', '0'); const bossFill = node('i', ''); bossRail.append(bossFill); bossHud.append(bossLine, bossRail);
  const overlay = node('div', 'starfall-overlay'); overlay.hidden = true; const overlayIcon = node('span', 'starfall-overlay-icon', '✦'); overlayIcon.setAttribute('aria-hidden', 'true');
  const overlayKicker = node('small', ''); const overlayTitle = node('strong', ''); const overlayDetail = node('p', ''); const replay = node('button', 'starfall-replay'); replay.type = 'button'; replay.dataset.starfallReplay = ''; overlay.append(overlayIcon, overlayKicker, overlayTitle, overlayDetail, replay); board.append(canvas, bossHud, overlay);
  const hint = node('div', 'starfall-flight-note'); const core = node('span', '', '● 3 PX CORE'); const focusHint = node('span', ''); focusHint.append(node('kbd', '', 'Click / C'), document.createTextNode(' fire · '), node('kbd', '', 'Shift'), document.createTextNode(' focus · '), node('kbd', '', 'Space / E'), document.createTextNode(' nova')); hint.append(core, focusHint);
  const controls = node('div', 'starfall-controls'); const movePad = node('div', 'starfall-stick'); movePad.dataset.starfallStick = ''; movePad.setAttribute('role', 'group'); movePad.setAttribute('aria-label', 'Touch movement joystick');
  const stickRing = node('span', 'starfall-stick-ring'); const stickThumb = node('span', 'starfall-stick-thumb'); const stickCaption = node('small', '', 'MOVE'); movePad.append(stickRing, stickThumb, stickCaption);
  const actionButtons = node('div', 'starfall-actions'); const focusButton = node('button', 'starfall-control', '◎ FOCUS'); focusButton.type = 'button'; focusButton.dataset.starfallControl = 'focus'; focusButton.setAttribute('aria-label', 'Hold focus: precise movement and narrow lance'); focusButton.setAttribute('aria-pressed', 'false');
  const bombButton = node('button', 'starfall-control starfall-nova', '✦ NOVA'); bombButton.type = 'button'; bombButton.dataset.starfallControl = 'bomb'; bombButton.setAttribute('aria-label', 'Use one finite Nova bomb'); actionButtons.append(focusButton, bombButton);
  const autoLabel = node('label', 'starfall-auto'); const autoInput = node('input', ''); autoInput.type = 'checkbox'; autoInput.checked = true; autoInput.dataset.starfallAuto = ''; autoLabel.append(autoInput, node('span', '', 'Auto-fire'), node('small', '', 'Drag the field to fly')); controls.append(movePad, actionButtons, autoLabel);
  const upgradePanel = node('section', 'starfall-upgrades'); upgradePanel.hidden = true; upgradePanel.setAttribute('aria-label', 'Choose one upgrade for the next stage'); const upgradeHead = node('div', 'starfall-upgrade-heading'); upgradeHead.append(node('small', '', 'HANGAR / PICK ONE'), node('strong', '', 'Make your next flight count.'));
  const upgradeChoices = node('div', 'starfall-upgrade-choices'); upgradePanel.append(upgradeHead, upgradeChoices);
  const build = node('div', 'starfall-build'); build.setAttribute('aria-label', 'Installed upgrades'); const status = node('p', 'starfall-status'); status.setAttribute('aria-live', 'polite');
  view.append(header, route, hud, board, hint, controls, upgradePanel, build, status); container.append(view);
  const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false;
  const backgrounds = [0, 1, 2].map(background); const playerArt = shipArt('player'); const sprites = new Map();
  for (let region = 0; region < 3; region += 1) for (const type of ['drone', 'skiff', 'weaver']) sprites.set(`${type}-${region}-1`, shipArt(type, region));
  for (const stage of STAGES) for (let phase = 1; phase <= 3; phase += 1) sprites.set(`${stage.bossType}-${stage.regionId}-${phase}`, shipArt(stage.bossType, stage.regionId, phase));

  function releaseControls() {
    keys.clear(); bombQueued = false; stick = { x: 0, y: 0 };
    for (const [id, pointer] of pointers) { try { if (pointer.target.hasPointerCapture?.(id)) pointer.target.releasePointerCapture(id); } catch {} }
    pointers.clear(); syncControls();
  }
  function held(control) { return [...keys.values()].includes(control) || [...pointers.values()].some(pointer => pointer.control === control); }
  function syncControls() {
    const focused = held('focus'); focusButton.setAttribute('aria-pressed', String(focused)); focusButton.dataset.held = String(focused);
    stickThumb.style.transform = `translate(${stick.x * 18}px, ${stick.y * 18}px)`;
    bombButton.disabled = state.player.bombs === 0 || state.phase !== 'playing';
    focusButton.disabled = state.phase !== 'playing';
  }
  function input() {
    const mx = stick.x || (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    const my = stick.y || (held('down') ? 1 : 0) - (held('up') ? 1 : 0);
    const value = { moveX: mx, moveY: my, focus: held('focus'), fire: autoInput.checked || held('fire'), bomb: bombQueued || held('bomb') };
    const drag = [...pointers.values()].find(pointer => pointer.control === 'drag');
    // Relative touch movement obeys the same focused/free-flight speed as keys.
    if (drag?.targetX !== undefined) {
      const dx = drag.targetX - state.player.x; const dy = drag.targetY - state.player.y;
      const speed = value.focus ? 105 * (1 + state.build.thrusters * .08) : 245 * (1 + state.build.thrusters * .12);
      const distance = Math.hypot(dx, dy); const amount = Math.min(1, distance / (speed * STEP));
      value.moveX = distance ? dx / distance * amount : 0; value.moveY = distance ? dy / distance * amount : 0;
    }
    return value;
  }
  function detail() {
    if (state.phase === 'won') return `Six guardians defeated · ${state.grazes} grazes · best chain ${state.bestChain}. Completed ${DIFFICULTIES[difficulty].title} score saved.`;
    if (state.phase === 'lost') return `${state.stagesCleared}/6 stages cleared · ${state.grazes} grazes. Completed campaigns earn records. Try a different route through the next volley.`;
    if (state.phase === 'paused') return 'Flight is paused. Hull, shots and the campaign clock are frozen.';
    if (state.phase === 'upgrade') return 'Hull and bombs carry forward. Choose one upgrade below; nothing moves while you decide.';
    const boss = state.enemies.find(enemy => enemy.boss);
    return boss ? `${STAGES[state.stage - 1].guardian} · phase ${boss.phase}${state.stage === 6 ? '/3' : '/2'}. Move after aim locks; focus through gaps.` : 'Orange shots are hostile. Only your bright 3 px core can be hit. Move after warnings lock; graze once per shot for score.';
  }
  function publish(force = false) {
    if (!force && state.time - lastPublished < .1 && state.phase === lastPhase) return;
    const changed = state.phase !== lastPhase; if (changed) releaseControls(); lastPhase = state.phase; lastPublished = state.time;
    view.dataset.phase = state.phase; view.dataset.stage = String(state.stage); view.dataset.difficulty = difficulty;
    const stage = STAGES[state.stage - 1]; text(regionLabel, `0${stage.regionId + 1} / ${stage.region}`); text(stageLabel, `${String(state.stage).padStart(2, '0')} · ${stage.name}`);
    routeBadges.forEach((badge, index) => { badge.dataset.current = String(index + 1 === state.stage); badge.dataset.cleared = String(index < state.stagesCleared); badge.setAttribute('aria-label', `${index + 1}. ${STAGES[index].name}: ${index < state.stagesCleared ? 'cleared' : index + 1 === state.stage ? 'current' : 'ahead'}`); });
    text(hullCount, `${'▮'.repeat(state.player.hull)}${'▯'.repeat(state.player.maxHull - state.player.hull)}`); hullCount.setAttribute('aria-label', `${state.player.hull} of ${state.player.maxHull} hull`);
    hullLabel.dataset.low = String(state.player.hull === 1); text(bombCount, `${state.player.bombs} ×`); text(scoreCount, state.score.toLocaleString('en-US')); text(chainCount, state.chain ? `${state.chain} ×${Math.min(5, 1 + Math.floor(state.chain / 8))}` : '—');
    const boss = state.enemies.find(enemy => enemy.boss); bossHud.hidden = !boss;
    if (boss) { text(bossName, stage.guardian); text(bossPhase, `PHASE ${boss.phase} / ${state.stage === 6 ? 3 : 2}`); bossFill.style.width = `${clamp(boss.hp / boss.maxHp, 0, 1) * 100}%`; bossRail.setAttribute('aria-valuemax', String(boss.maxHp)); bossRail.setAttribute('aria-valuenow', String(Math.max(0, Math.ceil(boss.hp)))); }
    overlay.hidden = state.phase === 'playing';
    if (!overlay.hidden) {
      text(overlayKicker, { upgrade: 'A QUIET MOMENT IN THE HANGAR', paused: 'FLIGHT HOLD', won: 'BEACON REACHED / CAMPAIGN COMPLETE', lost: 'FLIGHT RECORDER / SIGNAL LOST' }[state.phase]);
      text(overlayTitle, { upgrade: `${stage.name} cleared.`, paused: 'Hold your course.', won: 'The sky is yours.', lost: 'One more flight.' }[state.phase]);
      text(overlayDetail, state.phase === 'upgrade' ? 'Choose one upgrade below. Your remaining hull and Nova cartridges carry forward.' : state.phase === 'paused' ? 'Resume when you are ready. The field is exactly where you left it.' : `${state.score.toLocaleString('en-US')} points · ${state.stagesCleared}/6 stages · ${state.grazes} grazes`);
      replay.hidden = state.phase === 'upgrade'; text(replay, state.phase === 'paused' ? 'Resume flight →' : 'Launch another squadron →');
    }
    upgradePanel.hidden = state.phase !== 'upgrade';
    const signature = `${state.phase}-${state.stage}-${state.upgradeChoices.join('-')}`;
    if (signature !== upgradeSignature) {
      upgradeSignature = signature; upgradeChoices.replaceChildren();
      if (state.phase === 'upgrade') for (const id of state.upgradeChoices) {
        const info = UPGRADES[id]; const button = node('button', 'starfall-upgrade'); button.type = 'button'; button.dataset.starfallUpgrade = id;
        const icon = node('span', 'starfall-upgrade-icon'); icon.append(upgradeIcon(id)); const body = node('span', 'starfall-upgrade-body'); body.append(node('small', '', info.label), node('strong', '', info.title), node('span', '', info.detail)); button.append(icon, body, node('b', 'starfall-upgrade-arrow', '↗')); upgradeChoices.append(button);
      }
    }
    const currentBuild = Object.entries(state.build).filter(([, count]) => count > 0); const newBuild = JSON.stringify(currentBuild);
    if (newBuild !== buildSignature) { buildSignature = newBuild; build.replaceChildren(); if (!currentBuild.length) build.append(node('span', 'starfall-build-empty', 'STOCK SQUADRON · YOUR BUILD BEGINS AFTER STAGE 01'));
      for (const [id, count] of currentBuild) { const chip = node('span', 'starfall-build-chip'); chip.append(upgradeIcon(id), document.createTextNode(`${UPGRADES[id].title}${count > 1 ? ` ×${count}` : ''}`)); build.append(chip); }
    }
    text(status, detail()); syncControls();
    onUpdate({ phase: state.phase, result: state.result, score: state.score, record: state.phase === 'won' ? state.score : null, recordKey: recordKey(state), recordLabel: `${DIFFICULTIES[difficulty].title.toUpperCase()} CLEAR`, scoreLabel: 'SCORE', detail: detail() });
    if (changed && state.phase === 'upgrade') upgradeChoices.querySelector('button')?.focus({ preventScroll: true });
  }
  function draw(fraction = 1) {
    displayState = presentation.sample(state, fraction);
    const effectFrame = effects.sample(displayState.time), { flashes } = effectFrame;
    const c = context; const stage = STAGES[displayState.stage - 1]; const bg = backgrounds[stage.regionId]; const scroll = reducedMotion.matches ? 0 : displayState.time * 38 % 1200;
    c.globalAlpha = 1; c.drawImage(bg, 0, scroll - 1200); c.drawImage(bg, 0, scroll);
    if (displayState.stageTime < 3) { c.fillStyle = '#a2c1c0'; c.font = 'bold 11px monospace'; c.textAlign = 'center'; c.fillText(`${stage.region} / ${String(displayState.stage).padStart(2, '0')}`, W / 2, 210); c.fillStyle = '#e9e3cf'; c.font = 'bold 21px monospace'; c.fillText(stage.name.toUpperCase(), W / 2, 242); c.textAlign = 'start'; }
    // Telegraphs and shots use identical source positions and direction arrays.
    for (const warning of displayState.warnings) {
      const progress = 1 - warning.remaining / warning.duration; c.strokeStyle = '#eac383'; c.lineWidth = 1.5; c.globalAlpha = .24 + progress * .26;
      c.beginPath(); c.arc(warning.x, warning.y, warning.boss ? 39 : 23, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); c.stroke();
      if (warning.kind === 'aim') { c.globalAlpha = .15 + progress * .16; c.setLineDash([5, 7]); for (const angle of warning.directions) { c.beginPath(); c.moveTo(warning.x, warning.y); c.lineTo(warning.x + Math.cos(angle) * 650, warning.y + Math.sin(angle) * 650); c.stroke(); } c.setLineDash([]); }
      else { c.globalAlpha = .28 + progress * .25; for (const angle of warning.directions) { c.beginPath(); c.moveTo(warning.x + Math.cos(angle) * 23, warning.y + Math.sin(angle) * 23); c.lineTo(warning.x + Math.cos(angle) * 42, warning.y + Math.sin(angle) * 42); c.stroke(); } }
    }
    c.globalAlpha = 1;
    for (const bullet of displayState.friendlyShots) { c.fillStyle = bullet.focus ? '#c4f8e6' : '#69c9d4'; c.fillRect(bullet.x - 1.5, bullet.y - 4, 3, 8); c.fillStyle = '#edf8e4'; c.fillRect(bullet.x - 1, bullet.y - 4, 2, 3); }
    for (const enemy of displayState.enemies) {
      const art = sprites.get(`${enemy.type}-${stage.regionId}-${enemy.phase}`) || sprites.get(`${enemy.type}-${stage.regionId}-1`); if (!art) continue;
      c.fillStyle = '#08111c'; c.globalAlpha = .36; c.beginPath(); c.ellipse(enemy.x + 2, enemy.y + 6, enemy.radius + 3, enemy.radius * .58, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
      c.drawImage(art, enemy.x - art.width / 2, enemy.y - art.height / 2);
      if (flashes.has(enemy.id)) { c.fillStyle = '#fff0bf'; c.globalAlpha = .38; c.beginPath(); c.arc(enemy.x, enemy.y, enemy.radius * .68, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
      if (!enemy.boss && enemy.hp < enemy.maxHp) { c.fillStyle = '#192332'; c.fillRect(enemy.x - 13, enemy.y - enemy.radius - 8, 26, 2); c.fillStyle = '#f0bd86'; c.fillRect(enemy.x - 13, enemy.y - enemy.radius - 8, 26 * Math.max(0, enemy.hp / enemy.maxHp), 2); }
    }
    for (const bullet of displayState.hostileShots) {
      c.fillStyle = '#271b29'; c.beginPath(); c.arc(bullet.x, bullet.y, bullet.radius + 1, 0, Math.PI * 2); c.fill();
      c.fillStyle = bullet.kind === 'cross' ? '#f799bc' : '#ffb27a'; c.beginPath(); c.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffeaca'; c.beginPath(); c.arc(bullet.x, bullet.y, Math.max(1.5, bullet.radius * .43), 0, Math.PI * 2); c.fill();
    }
    if (displayState.phase !== 'lost') {
      const p = displayState.player; const shimmer = p.invulnerable > 0 && !reducedMotion.matches ? Math.floor(displayState.time * 14) % 2 ? .45 : 1 : 1;
      c.globalAlpha = shimmer;
      if (!reducedMotion.matches) { c.fillStyle = '#64bfc2'; const length = 7 + Math.floor(displayState.time * 24) % 3 * 2; c.fillRect(p.x - 11, p.y + 17, 4, length); c.fillRect(p.x + 7, p.y + 17, 4, length); c.fillStyle = '#d6e6b4'; c.fillRect(p.x - 10, p.y + 17, 2, length - 3); c.fillRect(p.x + 8, p.y + 17, 2, length - 3); }
      c.drawImage(playerArt, p.x - 20, p.y - 20); c.globalAlpha = 1;
      if (p.focus) { c.strokeStyle = '#84d9cf'; c.lineWidth = 1; c.globalAlpha = .64; c.beginPath(); c.arc(p.x, p.y, 19, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }
      // The always-visible white circle is the exact physical pilot hitbox.
      c.fillStyle = '#091723'; c.beginPath(); c.arc(p.x, p.y, HITBOX + 1.4, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff4cf'; c.beginPath(); c.arc(p.x, p.y, HITBOX, 0, Math.PI * 2); c.fill();
    }
    drawStarfallEffects(c, effectFrame, reducedMotion.matches);
    // Constant inset keeps hostile shots distinguishable from the decorative background.
    c.strokeStyle = '#718c8b'; c.globalAlpha = .25; c.strokeRect(1.5, 1.5, W - 3, H - 3); c.globalAlpha = 1;
  }
  function schedule() { if (!destroyed && state.phase === 'playing' && raf === null) raf = requestAnimationFrame(frame); }
  function refresh() { if (state.phase !== 'playing' && raf !== null) { cancelAnimationFrame(raf); raf = null; } publish(true); effects.capture(state, reducedMotion.matches); draw(); schedule(); }
  function frame(now) {
    raf = null; const dt = previous === null ? 0 : clamp((now - previous) / 1000, 0, .08); previous = now; accumulator += dt;
    let ticks = 0;
    while (state.phase === 'playing' && accumulator >= STEP && ticks < 10) { presentation.capture(state); step(state, input(), STEP); bombQueued = false; effects.capture(state, reducedMotion.matches); accumulator -= STEP; ticks += 1; }
    if (state.phase !== 'playing') { accumulator = 0; presentation.reset(); }
    publish(); draw(tickFraction(accumulator, STEP)); schedule();
  }
  function togglePause() { if (destroyed) return; releaseControls(); pauseState(state); previous = null; accumulator = 0; presentation.reset(); refresh(); }
  function restart() { if (destroyed) return; releaseControls(); state = createState({ difficulty }); previous = null; accumulator = 0; presentation.reset(); lastPublished = -1; lastPhase = null; effects.reset(0); upgradeSignature = ''; buildSignature = ''; refresh(); canvas.focus({ preventScroll: true }); }
  function keydown(event) {
    if (blocksSoloShortcut(event, { allowRepeat: true }) || state.phase !== 'playing') return;
    const target = event.target instanceof Element ? event.target.closest('button,a,summary') : null;
    const activation = event.key === ' ' || event.key === 'Enter';
    let control = KEY_CONTROLS[gameKey(event)];
    if (activation && target) { if (!target.dataset.starfallControl) return; control = target.dataset.starfallControl; }
    if (!control) return; event.preventDefault(); if (event.repeat && !keys.has(event.code || event.key)) return;
    keys.set(event.code || event.key, control); if (control === 'bomb' && !event.repeat) bombQueued = true; syncControls();
  }
  function keyup(event) { if (keys.delete(event.code || event.key)) syncControls(); }
  function controlDown(event) {
    if (state.phase !== 'playing' || event.button !== 0 && event.pointerType !== 'touch') return;
    const target = event.target instanceof Element ? event.target.closest('[data-starfall-control],[data-starfall-stick]') : null;
    if (!target || !controls.contains(target) || target.disabled) return;
    if (target === movePad && [...pointers.values()].some(pointer => pointer.control === 'move')) return;
    event.preventDefault(); const control = target === movePad ? 'move' : target.dataset.starfallControl;
    pointers.set(event.pointerId, { target, control }); if (control === 'bomb') bombQueued = true;
    try { target.setPointerCapture(event.pointerId); } catch {} if (control === 'move') moveStick(event); syncControls();
  }
  function moveStick(event) { const rect = movePad.getBoundingClientRect(); const radius = Math.max(1, rect.width * .37); let x = (event.clientX - rect.left - rect.width / 2) / radius; let y = (event.clientY - rect.top - rect.height / 2) / radius; const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; } stick = { x, y }; syncControls(); }
  function canvasDown(event) {
    if (state.phase !== 'playing' || event.button !== 0 && event.pointerType !== 'touch') return; if ([...pointers.values()].some(pointer => pointer.control === 'drag')) return;
    event.preventDefault(); canvas.focus({ preventScroll: true });
    pointers.set(event.pointerId, { target: canvas, control: event.pointerType === 'touch' ? 'drag' : 'fire', lastX: event.clientX, lastY: event.clientY });
    try { canvas.setPointerCapture(event.pointerId); } catch {}
  }
  function pointerMove(event) {
    const pointer = pointers.get(event.pointerId); if (!pointer || state.phase !== 'playing') return; event.preventDefault();
    if (pointer.control === 'move') moveStick(event);
    if (pointer.control === 'drag') {
      const box = canvas.getBoundingClientRect(); const dx = (event.clientX - pointer.lastX) * W / box.width; const dy = (event.clientY - pointer.lastY) * H / box.height;
      // Queue a target instead of mutating physics: the engine covers the actual travelled path.
      pointer.targetX = clamp((pointer.targetX ?? state.player.x) + dx, 14, W - 14);
      pointer.targetY = clamp((pointer.targetY ?? state.player.y) + dy, 38, H - 22);
      pointer.lastX = event.clientX; pointer.lastY = event.clientY;
    }
  }
  function pointerEnd(event) { const pointer = pointers.get(event.pointerId); if (!pointer) return; pointers.delete(event.pointerId); if (pointer.control === 'move') stick = { x: 0, y: 0 }; try { if (pointer.target.hasPointerCapture?.(event.pointerId)) pointer.target.releasePointerCapture(event.pointerId); } catch {} syncControls(); }
  function upgradeClick(event) { const button = event.target instanceof Element ? event.target.closest('[data-starfall-upgrade]') : null; if (!button || !upgradeChoices.contains(button)) return; releaseControls(); if (!chooseUpgrade(state, button.dataset.starfallUpgrade).ok) return; previous = null; accumulator = 0; presentation.reset(); effects.reset(); refresh(); canvas.focus({ preventScroll: true }); }
  function replayClick() { if (state.phase === 'paused') togglePause(); else restart(); }
  function tierChange() { difficulty = Object.hasOwn(DIFFICULTIES, tierSelect.value) ? tierSelect.value : 'veteran'; restart(); }
  function autoChange() { releaseControls(); publish(true); }
  function hidden() { if (document.hidden) releaseControls(); }
  function motionChange() { if (reducedMotion.matches) effects.reduceMotion(); if (state.phase !== 'playing') draw(); }
  function keyboardHints() { view.dataset.keyboardLayout = getKeyboardLayout(); canvas.setAttribute('aria-label', `Starfall Squadron. Move with ${displayKey('WASD')} or arrow keys; Shift focuses your visible three-pixel core, click or C fires, Space or E uses a finite bomb. Touch: drag to move, hold Focus, tap Nova.`); }
  const unsubscribe = subscribeKeyboardLayout(() => { releaseControls(); keyboardHints(); }); keyboardHints();
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', releaseControls); document.addEventListener('visibilitychange', hidden);
  controls.addEventListener('pointerdown', controlDown); canvas.addEventListener('pointerdown', canvasDown); window.addEventListener('pointermove', pointerMove); window.addEventListener('pointerup', pointerEnd); window.addEventListener('pointercancel', pointerEnd); view.addEventListener('lostpointercapture', pointerEnd);
  upgradeChoices.addEventListener('click', upgradeClick); replay.addEventListener('click', replayClick); tierSelect.addEventListener('change', tierChange); autoInput.addEventListener('change', autoChange); reducedMotion.addEventListener('change', motionChange);
  refresh();
  return { getDisplayTiming: () => presentation.getStats(), getState: () => copy(state), restart, togglePause,
    destroy() { if (destroyed) return; destroyed = true; if (raf !== null) cancelAnimationFrame(raf); releaseControls(); unsubscribe();
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', releaseControls); document.removeEventListener('visibilitychange', hidden);
      controls.removeEventListener('pointerdown', controlDown); canvas.removeEventListener('pointerdown', canvasDown); window.removeEventListener('pointermove', pointerMove); window.removeEventListener('pointerup', pointerEnd); window.removeEventListener('pointercancel', pointerEnd); view.removeEventListener('lostpointercapture', pointerEnd);
      upgradeChoices.removeEventListener('click', upgradeClick); replay.removeEventListener('click', replayClick); tierSelect.removeEventListener('change', tierChange); autoInput.removeEventListener('change', autoChange); reducedMotion.removeEventListener('change', motionChange); sprites.clear(); effects.reset(); view.remove();
    },
  };
}
