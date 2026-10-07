import { WORLD, DIFFICULTIES, DISTRICTS, LEVELS, TOTAL_LEVELS, FIXED_STEP, createState, step, togglePause as pauseState, nextMission, missionDeadline, rayEnd, segmentCircle, interactionTarget, guardSees, inShadow } from './shadow-engine.js';
import { gameKey, displayKey, getKeyboardLayout, subscribeKeyboardLayout } from '../keyboard-layout.js';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const copy = value => JSON.parse(JSON.stringify(value));
const node = (tag, name, text) => { const e = document.createElement(tag); e.className = name; if (text !== undefined) e.textContent = text; return e; };
const text = (e, value) => { if (e.textContent !== value) e.textContent = value; };
const isForm = e => e instanceof Element && Boolean(e.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'));
const KEY = { w: 'up', W: 'up', ArrowUp: 'up', s: 'down', S: 'down', ArrowDown: 'down', a: 'left', A: 'left', ArrowLeft: 'left', d: 'right', D: 'right', ArrowRight: 'right', Shift: 'sneak', e: 'interact', E: 'interact', ' ': 'smoke', q: 'kunai', Q: 'kunai' };
export function mount(container, { onUpdate = () => {} } = {}) {
  let difficulty = 'veteran', state = createState({ difficulty }), destroyed = false, raf = null, previous = null, accumulator = 0, published = -1, publishedPhase = '', artLevel = -1, stageArt = null;
  let viewport = { width: 960, height: 640 }, camera = { x: 0, y: 0 }, pointerAim = null, stickySneak = false, eventCursor = 0, particles = [], effects = [];
  const held = new Map(), pointers = new Map(), queued = new Set(), reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const view = node('section', 'shadow-view'); view.setAttribute('aria-label', 'Shadow Lantern ninja stealth heist');
  const tierbar = node('div', 'shadow-tier-bar'), label = node('label', '', 'HEIST DIFFICULTY'), tier = node('select', 'shadow-tier-select'); tier.setAttribute('aria-label', 'Difficulty for a new Shadow Lantern heist');
  for (const [value, info] of Object.entries(DIFFICULTIES)) { const option = node('option', '', info.title); option.value = value; tier.append(option); } tier.value = difficulty; label.append(tier);
  const tierDetail = node('p', 'shadow-tier-detail'); tierbar.append(label, tierDetail);
  const journey = node('div', 'shadow-journey'); journey.setAttribute('aria-label', 'Nine fortress heists'); const badges = LEVELS.map((level, i) => { const b = node('span', 'shadow-mission-badge', String(i + 1).padStart(2, '0')); b.title = level.name; journey.append(b); return b; });
  const hud = node('div', 'shadow-hud'), title = node('div', 'shadow-title'), district = node('span', ''), mission = node('b', ''); title.append(district, mission);
  const numbers = node('div', 'shadow-numbers'), health = node('span', 'shadow-health'), scrolls = node('span', 'shadow-seals'), alarm = node('span', 'shadow-alarms'), clock = node('span', 'shadow-clock'); numbers.append(health, scrolls, alarm, clock); hud.append(title, numbers);
  const objective = node('div', 'shadow-objective'), objectiveTag = node('b', ''), objectiveText = node('span', ''), objectivePips = node('div', 'shadow-objective-pips'); objectivePips.setAttribute('aria-hidden', 'true'); objective.append(objectiveTag, objectiveText, objectivePips);
  const board = node('div', 'shadow-board'), canvas = node('canvas', 'shadow-canvas'); canvas.width = WORLD.width; canvas.height = WORLD.height; canvas.tabIndex = 0; canvas.dataset.soloFocus = ''; canvas.setAttribute('role', 'img');
  const overlay = node('div', 'shadow-overlay'); overlay.hidden = true; const card = node('div', 'shadow-overlay-card'), tag = node('span', 'shadow-overlay-tag'), heading = node('h3', ''), description = node('p', ''), action = node('button', 'shadow-continue'); action.type = 'button'; card.append(tag, heading, description, action); overlay.append(card); board.append(canvas, overlay);
  const equipment = node('div', 'shadow-equipment'), smokeCount = node('span', ''), kunaiCount = node('span', ''), concealment = node('b', 'shadow-concealment'); equipment.append(smokeCount, kunaiCount, concealment);
  const legend = node('div', 'shadow-legend'); legend.setAttribute('aria-label', 'Map legend'); for (const [name, label] of [['cover', 'Solid cover'], ['shade', 'Shadow: sneak'], ['sight', 'Patrol sight'], ['seal', 'Scroll seal'], ['exit', 'Extraction']]) { const item = node('span', `shadow-legend-${name}`, label); item.prepend(node('i', '')); legend.append(item); }
  const notes = node('div', 'shadow-notes'), noteTitle = node('b', '', 'MISSION INTELLIGENCE'), noteText = node('span', ''); notes.append(noteTitle, noteText);
  const status = node('p', 'shadow-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); const hint = node('p', 'shadow-hint');
  const controls = node('div', 'shadow-controls'); controls.setAttribute('aria-label', 'Shadow Lantern touch controls'); const buttons = new Map();
  for (const [id, symbol, name] of [['up', '↑', 'UP'], ['left', '←', 'LEFT'], ['down', '↓', 'DOWN'], ['right', '→', 'RIGHT'], ['sneak', '◐', 'SNEAK'], ['interact', '✦', 'INTERACT'], ['smoke', '☁', 'SMOKE'], ['kunai', '↗', 'DISTRACT']]) {
    const button = node('button', `shadow-control shadow-control-${id}`); button.type = 'button'; button.dataset.control = id; button.setAttribute('aria-label', id === 'sneak' ? 'Toggle quiet sneak mode' : id === 'interact' ? 'Hold to interact or quietly take down a guard from behind' : `Hold ${name.toLowerCase()}`); button.setAttribute('aria-pressed', 'false');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); icon.setAttribute('viewBox', '0 0 20 20'); icon.setAttribute('aria-hidden', 'true'); icon.setAttribute('fill', 'none'); icon.setAttribute('stroke', 'currentColor'); icon.setAttribute('stroke-width', '1.5'); icon.setAttribute('stroke-linecap', 'round'); icon.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', { up: 'M10 17V3M4 9l6-6 6 6', left: 'M17 10H3M9 4l-6 6 6 6', down: 'M10 3v14M4 11l6 6 6-6', right: 'M3 10h14M11 4l6 6-6 6', sneak: 'M13 3a6 6 0 1 0 4 10 7 7 0 0 1-4-10Z', interact: 'M10 2l2.3 5.7L18 10l-5.7 2.3L10 18l-2.3-5.7L2 10l5.7-2.3Z', smoke: 'M4 15a3 3 0 1 1 0-6 5 5 0 0 1 9.6-1.8A4 4 0 1 1 15 15ZM6 18h2M12 18h2', kunai: 'M5 15l4-4M9 11l1-6 7-2-2 7-6 1ZM3 17l2-2M10 10l5-5' }[id]); icon.append(path); button.append(icon, node('span', '', name)); controls.append(button); buttons.set(id, button);
  }
  view.append(tierbar, journey, hud, objective, board, legend, equipment, notes, status, hint, controls); container.append(view);
  let ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; const sprites = new Map();
  function layer(w, h, paint) { const img = document.createElement('canvas'); img.width = w; img.height = h; const prior = ctx; ctx = img.getContext('2d'); ctx.imageSmoothingEnabled = false; paint(); ctx = prior; return img; }
  function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function buildStage() {
    if (artLevel === state.level) return; artLevel = state.level; const level = LEVELS[state.level], theme = DISTRICTS[level.district];
    stageArt = layer(WORLD.width, WORLD.height, () => {
      rect(0, 0, 960, 640, theme.sky); rect(20, 29, 920, 596, '#0d202c'); rect(38, 48, 884, 554, theme.ground);
      // Broad, subdued flagstones leave actors and sight cones as the brightest information.
      const floor = [['#30443d', '#20392f', '#536152'], ['#304559', '#22394c', '#506578'], ['#455367', '#354357', '#7c8b9c']][level.district];
      for (let y = 48, row = 0; y < 602; y += 32, row++) for (let x = 38 - row % 2 * 32; x < 922; x += 64) {
        const left = Math.max(38, x), right = Math.min(922, x + 64), bottom = Math.min(602, y + 32);
        rect(left, y, right - left, bottom - y, floor[1]); rect(left + 1, y + 1, Math.max(0, right - left - 2), Math.max(0, bottom - y - 2), (row + Math.floor(x / 64)) % 7 === 0 ? floor[0] : theme.ground);
        rect(left + 3, y + 2, Math.max(0, right - left - 6), 1, '#ffffff08');
      }
      if (level.district === 0) for (let i = 0; i < 38; i++) { const x = 46 + (i * 97) % 860, y = 64 + (i * 137) % 518; rect(x, y, 4, 2, '#a69c683d'); rect(x + 2, y - 2, 2, 2, '#87975a3d'); }
      if (level.district === 2) for (let i = 0; i < 70; i++) rect(45 + (i * 113) % 865, 60 + (i * 139) % 526, 3 + i % 4, 2, '#bfced62b');
      for (const r of level.shadows) {
        rect(r.x, r.y, r.w, r.h, theme.dark); rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, '#08192420');
        for (let y = r.y + 8; y < r.y + r.h - 4; y += 24) for (let x = r.x + 8; x < r.x + r.w - 4; x += 28) { rect(x, y, 5, 1, level.district === 0 ? '#486b53' : '#405570'); rect(x + 2, y - 2, 1, 5, '#ffffff0b'); }
        ctx.strokeStyle = '#85ab932f'; ctx.lineWidth = 1; ctx.setLineDash([3, 8]); ctx.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1); ctx.setLineDash([]);
      }
      for (const r of level.walls) {
        // Roof eaves and screen posts stop at the exact solid collider; only cast shade extends.
        rect(r.x + 5, r.y + 6, r.w, r.h, '#07172280'); rect(r.x, r.y, r.w, r.h, '#112431'); rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, theme.wall);
        if (r.kind === 'screen') {
          rect(r.x + 4, r.y + 4, r.w - 8, r.h - 8, '#4e594d');
          for (let x = r.x + 7; x < r.x + r.w - 5; x += 8) { rect(x, r.y + 4, 3, r.h - 8, '#a49468'); rect(x, r.y + 7, 1, r.h - 14, '#e6d0a0'); for (let y = r.y + 20; y < r.y + r.h - 10; y += 28) rect(x - 1, y, 5, 2, '#665944'); }
          for (const y of [r.y + 5, r.y + r.h - 10]) { rect(r.x + 2, y, r.w - 4, 5, '#574a43'); rect(r.x + 2, y, r.w - 4, 1, '#c3a881'); }
          for (const x of [r.x + 2, r.x + r.w - 6]) { rect(x, r.y + 1, 4, r.h - 2, '#443e3c'); rect(x, r.y + 2, 1, r.h - 4, '#b29976'); }
        }
        else {
          const roofLight = ['#ad7b60', '#8a99af', '#a7aec4'][level.district], roofShade = ['#563c3b', '#424c65', '#4b4c65'][level.district], ridge = r.y + Math.floor(r.h * .45);
          rect(r.x + 5, r.y + 5, r.w - 10, r.h - 10, roofShade);
          for (let y = r.y + 8; y < r.y + r.h - 8; y += 10) {
            rect(r.x + 7, y, r.w - 14, 2, roofLight); rect(r.x + 7, y + 2, r.w - 14, 5, y < ridge ? theme.wall : roofShade);
            for (let x = r.x + 12 + (Math.floor((y - r.y) / 10) % 2) * 12; x < r.x + r.w - 9; x += 24) rect(x, y + 2, 1, 5, '#10212b55');
          }
          rect(r.x + 3, ridge - 3, r.w - 6, 7, '#28313c'); rect(r.x + 3, ridge - 3, r.w - 6, 3, theme.trim); rect(r.x + 6, ridge - 3, r.w - 12, 1, '#f2d9b3');
          rect(r.x + 3, r.y + r.h - 8, r.w - 6, 5, '#2b2935'); rect(r.x + 4, r.y + r.h - 8, r.w - 8, 1, roofLight);
          for (const x of [r.x + 3, r.x + r.w - 7]) { rect(x, r.y + 3, 4, r.h - 6, '#33303b'); rect(x, r.y + 3, 1, r.h - 6, roofLight); }
          if (level.district === 0) { rect(r.x + r.w - 25, r.y + r.h - 23, 13, 11, '#624536'); rect(r.x + r.w - 22, r.y + r.h - 21, 7, 7, '#c6996d'); rect(r.x + r.w - 20, r.y + r.h - 19, 3, 3, '#71494a'); }
          if (level.district === 2) { rect(r.x + 3, r.y + 3, r.w - 6, 5, '#dce4e7'); rect(r.x + 5, r.y + 8, r.w - 10, 2, '#9aafc5'); for (let i = 0; i < r.w / 35; i++) rect(r.x + 10 + i * 35, r.y + 9, 3, 5 + i % 3, '#c0d1dc'); }
        }
      }
      // Enclosing walls exactly match the play boundary. Lantern brackets live on them.
      rect(24, 34, 912, 14, '#5c5263'); rect(24, 602, 912, 18, '#454356'); rect(24, 48, 14, 554, '#4c4557'); rect(922, 48, 14, 554, '#4c4557');
      for (let x = 60; x < 920; x += 120) {
        const glow = ctx.createRadialGradient(x + 37, 56, 2, x + 37, 56, 38); glow.addColorStop(0, '#edba7630'); glow.addColorStop(1, '#edba7600'); ctx.fillStyle = glow; ctx.fillRect(x - 2, 48, 78, 45);
        rect(x, 37, 76, 3, theme.trim); rect(x + 32, 40, 10, 4, '#262b3b'); rect(x + 31, 48, 12, 14, theme.accent); rect(x + 29, 45, 16, 4, '#413747'); rect(x + 29, 62, 16, 3, '#413747'); rect(x + 34, 50, 3, 10, '#ffe3ab'); rect(x + 37, 48, 1, 14, '#88663b');
      }
      for (let y = 100; y < 590; y += 130) { rect(28, y, 7, 50, theme.trim); rect(925, y, 7, 50, theme.trim); }
      const [ex, ey] = level.exit; rect(ex - 23, ey - 19, 46, 38, '#153c38'); rect(ex - 19, ey - 15, 38, 30, '#477d68'); rect(ex - 15, ey - 11, 30, 22, '#234f47'); rect(ex - 9, ey - 7, 18, 14, '#193d38'); ctx.strokeStyle = '#89b69a'; ctx.lineWidth = 1; ctx.strokeRect(ex - 23.5, ey - 19.5, 47, 39);
    });
  }
  function sprite(kind, pose, facing) {
    const direction = ((Math.round(facing / (Math.PI / 4)) % 8) + 8) % 8, key = `${kind}:${pose}:${direction}`; if (sprites.has(key)) return sprites.get(key);
    const image = layer(40, 44, () => {
      const angle = direction * Math.PI / 4, ninja = kind === 'ninja', left = Math.cos(angle) < -.3, back = Math.sin(angle) < -.5, side = Math.abs(Math.cos(angle)) > .7;
      ctx.translate(20, 23); if (left) ctx.scale(-1, 1);
      if (pose === 'down') { rect(-12, 1, 22, 8, '#142534'); rect(-10, -1, 8, 8, '#9d7e68'); rect(-2, 3, 14, 5, '#566c77'); rect(-8, 7, 6, 2, '#c3aa82'); rect(7, 0, 3, 10, '#8ca4a6'); return; }
      const body = ninja ? '#243347' : kind === 'alert' ? '#854b48' : '#52697c', light = ninja ? '#677d91' : '#a2b6bd', belt = ninja ? '#dcac67' : '#ccae78', gait = pose === 'walk1' ? 2 : pose === 'walk2' ? -2 : 0;
      // The grounded torso stays inside its circle; head height and scarf are decorative projection.
      rect(-7, -7, 14, 14, '#0d1e2d'); rect(-6, -6, 12, 12, body); rect(-5, -5, 3, 9, light); rect(4, -4, 2, 9, '#203147');
      rect(-9, -4, 3, 9, ninja ? '#24374a' : '#738b98'); rect(6, -4, 3, 9, '#263d50'); rect(-7, 4, 14, 3, belt); rect(-1, 4, 3, 3, '#efe2bd');
      rect(-6, 7, 5, 5, '#1a2a3d'); rect(1, 7, 5, 5, '#203348'); rect(-7 - gait, 11, 7, 3, ninja ? '#8ba8aa' : '#bcab8d'); rect(1 + gait, 11, 7, 3, ninja ? '#8ba8aa' : '#bcab8d');
      if (ninja) {
        rect(-7, -16, 14, 11, '#132536'); rect(-5, -18, 10, 3, '#547189'); rect(-6, -15, 12, 3, '#344d65');
        if (!back) { rect(side ? 1 : -5, -12, side ? 7 : 10, 3, '#efd7aa'); rect(side ? 4 : -3, -11, 2, 1, '#203348'); if (!side) rect(2, -11, 2, 1, '#203348'); }
        rect(-7, -8, 14, 3, '#dba566'); rect(-13, -8, 6, 3, '#bd7c52'); rect(-17, -7 + gait / 2, 5, 2, '#e9c18a'); // Loose scarf does not enlarge the body contact.
        rect(-8, -3, 2, 11, '#bdcbd1'); rect(-9, -5, 4, 2, '#6e889b'); if (back) { rect(-5, -13, 10, 7, '#293e53'); rect(-3, -14, 6, 1, '#7290a1'); }
      } else {
        rect(-7, -14, 14, 8, '#a88668'); rect(-9, -16, 18, 5, '#203145'); rect(-7, -19, 14, 5, '#738698'); rect(-4, -21, 8, 3, '#d2b581'); rect(-1, -20, 2, 5, '#efd9aa');
        if (!back) { rect(side ? 1 : -5, -11, side ? 6 : 10, 4, '#d9bc97'); rect(side ? 3 : -3, -10, 2, 2, '#213143'); if (!side) rect(2, -10, 2, 2, '#213143'); }
        else { rect(-6, -11, 12, 5, '#3f546a'); rect(-5, -7, 10, 2, '#93a7b2'); }
        rect(7, -3, 2, 13, '#d2d8cc'); rect(6, -5, 4, 2, '#a5ab9e'); rect(-4, -4, 8, 3, '#91a2a8'); rect(-3, 0, 6, 2, '#91a2a8');
      }
      if (pose === 'sneak') { rect(-7, 9, 14, 4, '#24364a'); rect(-8, 12, 7, 3, '#8ba8aa'); rect(2, 12, 7, 3, '#8ba8aa'); }
    }); sprites.set(key, image); return image;
  }
  function input() { const result = { sneak: stickySneak }; for (const id of held.values()) result[id] = true; for (const item of pointers.values()) result[item.id] = true; for (const id of queued) result[id] = true; if (pointerAim) Object.assign(result, { aimX: pointerAim.x, aimY: pointerAim.y }); return result; }
  function syncButtons() { const controlsInput = input(); for (const [id, button] of buttons) button.setAttribute('aria-pressed', String(Boolean(controlsInput[id]))); }
  function release() { held.clear(); queued.clear(); for (const [id, item] of pointers) try { if (item.target.hasPointerCapture?.(id)) item.target.releasePointerCapture(id); } catch {} pointers.clear(); syncButtons(); }
  function consumeEvents() {
    for (const e of state.events) if (e.id > eventCursor) { eventCursor = e.id;
      const colors = { seal: '#edddac', takedown: '#a5d6bd', wound: '#ee9b98', smoke: '#b7c7d0', cache: '#97dacd', clear: '#cfe9b6' };
      const x = Number.isFinite(e.x) ? e.x : state.player.x, y = Number.isFinite(e.y) ? e.y : state.player.y;
      if (colors[e.type]) effects.push({ type: e.type, x, y, until: state.elapsed + (e.type === 'wound' ? .55 : .9), color: colors[e.type] });
      if (colors[e.type] && !reduced.matches) for (let i = 0; i < 9; i++) particles.push({ x, y, vx: Math.cos(i * 2.4) * 42, vy: Math.sin(i * 2.4) * 42, life: .5, color: colors[e.type] });
      if (e.type === 'seal') text(status, 'Scroll seal secured. Carry every seal back to the green extraction marker.');
      if (e.type === 'alarm') text(status, `A patrol raised the alarm. ${Math.max(0, DIFFICULTIES[difficulty].alarms - state.alarm)} alarms remain across the whole campaign. Break sight behind solid cover.`);
      if (e.type === 'wound') text(status, `Guard blade connected. ${state.player.hp} ${state.player.hp === 1 ? 'wound remains' : 'wounds remain'}. The bright slash sector warns where the strike will land.`);
      if (e.type === 'takedown') text(status, 'Quiet rear takedown. This patrol stays down for the mission.');
      if (e.type === 'cache') text(status, 'Tool cache opened. These supplies carry into the next fortress.');
      if (e.type === 'smoke') text(status, 'Smoke hides sight for five seconds. Footsteps still draw nearby patrols.');
      if (e.type === 'throw') text(status, 'Distraction thrown. Its impact draws patrols within earshot; use the opening to cross behind them.');
      if (e.type === 'lost-sight') text(status, 'Sight broken. The patrol searches your last position; move quietly to different cover.');
      if (e.type === 'mission') text(status, `${LEVELS[state.level].name}. Recover ${state.scrolls.length} seals, then extract. Health, alarms and remaining tools carried forward.`);
    } if (particles.length > 96) particles.splice(0, particles.length - 96); if (effects.length > 12) effects.splice(0, effects.length - 12);
  }
  function publish(force = false) {
    if (!force && state.elapsed - published < .1 && publishedPhase === state.phase) return; published = state.elapsed; publishedPhase = state.phase;
    const level = LEVELS[state.level], info = DIFFICULTIES[difficulty], p = state.player, recovered = state.scrolls.filter(Boolean).length, ready = recovered === state.scrolls.length, remaining = Math.max(0, missionDeadline(state) - state.levelElapsed);
    text(tierDetail, info.description); text(district, `${DISTRICTS[level.district].name.toUpperCase()} · HEIST ${state.level + 1} / ${TOTAL_LEVELS}`); text(mission, level.name); text(health, `${p.hp} HP`); health.dataset.urgent = String(p.hp === 1); text(scrolls, `${recovered}/${state.scrolls.length} SEALS`); text(alarm, `${state.alarm}/${info.alarms} ALARMS`); text(clock, `${remaining < 15 ? remaining.toFixed(1) : Math.ceil(remaining)}s`); clock.dataset.urgent = String(remaining < 15);
    objective.dataset.ready = String(ready); text(objectiveTag, ready ? '02 / EXTRACT' : '01 / RECOVER'); text(objectiveText, ready ? 'Return to the green gate. Hold E to leave.' : `Lift ${state.scrolls.length - recovered} remaining scroll ${state.scrolls.length - recovered === 1 ? 'seal' : 'seals'}.`);
    if (objectivePips.children.length !== state.scrolls.length) objectivePips.replaceChildren(...state.scrolls.map(() => node('i', ''))); [...objectivePips.children].forEach((pip, i) => pip.dataset.secured = String(state.scrolls[i]));
    text(smokeCount, `${state.smoke} SMOKE`); text(kunaiCount, `${state.kunai} DISTRACTIONS`); buttons.get('smoke').dataset.empty = String(state.smoke === 0); buttons.get('kunai').dataset.empty = String(state.kunai === 0);
    const target = interactionTarget(state), seen = state.guards.filter(g => guardSees(state, g)), danger = seen.some(g => g.mode === 'alert') ? 'alert' : seen.length ? 'seen' : 'clear'; concealment.dataset.danger = danger;
    text(concealment, state.channel ? `${state.channel.label.toUpperCase()} · ${Math.round(state.channel.progress / state.channel.duration * 100)}%` : target ? `${p.moving && input().interact ? 'STOP, THEN HOLD E' : 'HOLD E'} · ${target.label.toUpperCase()}` : seen.length ? seen.some(g => g.mode === 'alert') ? 'SPOTTED · BREAK SIGHT' : 'IN PATROL SIGHT' : inShadow(level, p) ? p.sneaking ? 'SHADOW · REDUCED VISIBILITY' : 'SHADOW · SNEAK TO STAY QUIET' : p.sneaking ? 'QUIET · OPEN GROUND' : 'RUNNING FOOTSTEPS CARRY');
    text(noteText, level.hint); badges.forEach((b, i) => b.dataset.mission = i < state.level ? 'complete' : i === state.level ? 'current' : 'future'); overlay.hidden = state.phase === 'playing'; action.hidden = state.phase === 'paused';
    if (state.phase === 'paused') { text(tag, 'PATROLS & CLOCK HELD'); text(heading, 'Heist paused'); text(description, 'Study the cones and cover. Resume above or press Escape when your route is ready.'); }
    if (state.phase === 'mission-clear') { text(tag, 'SCROLLS EXTRACTED'); text(heading, `${state.level + 1} / 9 heists complete`); text(description, `${state.player.hp} wounds · ${state.smoke} smoke · ${state.kunai} distractions carry forward. Next: ${LEVELS[state.level + 1].name}.`); text(action, 'Enter the next fortress'); }
    if (state.phase === 'lost') { text(tag, 'FORTRESS SEALED'); text(heading, 'The lanterns found you'); text(description, `${state.reason} ${state.cleared}/9 heists complete. Only a full campaign sets a record.`); text(action, 'Plan a new heist'); }
    if (state.phase === 'won') { text(tag, 'NINE FORTRESSES · EVERY SEAL'); text(heading, 'The last lantern is yours'); text(description, `${state.score.toLocaleString()} heist points · ${state.player.hp} wounds left · ${state.alarm} alarms. Completed records stay separate by difficulty.`); text(action, 'Steal the night again'); }
    onUpdate({ phase: state.phase, score: state.score, scoreLabel: 'HEIST POINTS', recordLabel: 'BEST COMPLETE HEIST', record: state.phase === 'won' ? state.score : undefined, recordKey: state.recordKey, result: state.phase === 'won' ? 'campaign' : undefined, detail: `${state.cleared}/9 heists · ${state.player.hp} wounds · ${state.alarm}/${info.alarms} alarms` });
  }
  function cone(g, level) {
    if (g.mode === 'down') return; const range = (g.mode === 'alert' ? 250 : 195) * DIFFICULTIES[difficulty].sight, angle = g.mode === 'alert' ? .85 : .58;
    const endpoint = a => { const end = rayEnd(level, g.x, g.y, a, range); let time = 1; for (const cloud of state.clouds) { const hit = segmentCircle(g.x, g.y, end.x - g.x, end.y - g.y, cloud.x, cloud.y, cloud.radius); if (hit !== null) time = Math.min(time, hit); } return { x: g.x + (end.x - g.x) * time, y: g.y + (end.y - g.y) * time }; };
    ctx.fillStyle = g.mode === 'alert' ? '#e17d713d' : guardSees(state, g) ? '#edbd6b46' : '#ebd09b22'; ctx.beginPath(); ctx.moveTo(g.x, g.y);
    for (let i = 0; i <= 32; i++) { const end = endpoint(g.facing - angle + i / 32 * angle * 2); ctx.lineTo(end.x, end.y); } ctx.closePath(); ctx.fill();
    ctx.strokeStyle = g.mode === 'alert' ? '#ed9f8660' : '#e4c79240'; ctx.lineWidth = 1; ctx.stroke();
  }
  function mapLabel(x, y, value, color = '#e8dfbf') { if (x < camera.x - 24 || x > camera.x + viewport.width + 24 || y < camera.y - 16 || y > camera.y + viewport.height + 16) return; ctx.font = 'bold 9px monospace'; const width = Math.ceil(ctx.measureText(value).width) + 12; x = clamp(x, camera.x + width / 2 + 5, camera.x + viewport.width - width / 2 - 5); rect(x - width / 2, y - 10, width, 16, '#102631ec'); rect(x - width / 2, y - 10, 2, 16, color); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(value, Math.round(x), Math.round(y + 1)); ctx.textAlign = 'left'; }
  function draw() {
    buildStage(); const level = LEVELS[state.level], theme = DISTRICTS[level.district], p = state.player;
    camera.x = clamp(p.x - viewport.width * .5, 0, WORLD.width - viewport.width); camera.y = clamp(p.y - viewport.height * .55, 0, WORLD.height - viewport.height);
    ctx.clearRect(0, 0, viewport.width, viewport.height); ctx.imageSmoothingEnabled = false; ctx.save(); ctx.translate(-Math.round(camera.x), -Math.round(camera.y)); ctx.drawImage(stageArt, 0, 0);
    for (const g of state.guards) cone(g, level);
    for (let i = 0; i < level.seals.length; i++) { const item = level.seals[i]; if (state.scrolls[i]) { rect(item.x - 4, item.y - 3, 8, 6, '#53716b'); continue; } const glow = ctx.createRadialGradient(item.x, item.y, 5, item.x, item.y, 26); glow.addColorStop(0, '#e7c99138'); glow.addColorStop(1, '#e7c99100'); ctx.fillStyle = glow; ctx.fillRect(item.x - 26, item.y - 26, 52, 52); rect(item.x - 9, item.y + 9, 18, 3, '#10202b90'); rect(item.x - 8, item.y - 10, 16, 20, '#1d3040'); rect(item.x - 6, item.y - 9, 12, 18, '#e7cf9e'); rect(item.x - 9, item.y - 9, 18, 3, '#9b6a59'); rect(item.x - 9, item.y + 6, 18, 3, '#9b6a59'); rect(item.x - 3, item.y - 4, 6, 7, '#b26066'); rect(item.x - 1, item.y - 3, 2, 5, '#f1dcad'); for (const sx of [-1, 1]) for (const sy of [-1, 1]) { rect(item.x + sx * 13 - (sx < 0 ? 0 : 5), item.y + sy * 14, 6, 1, '#e7c991'); rect(item.x + sx * 13, item.y + sy * 14 - (sy < 0 ? 0 : 5), 1, 6, '#e7c991'); } mapLabel(item.x, item.y - 22, `SEAL ${i + 1}`, '#e7ce98'); }
    for (let i = 0; i < level.caches.length; i++) { const item = level.caches[i]; rect(item.x - 11, item.y + 5, 24, 5, '#0b202780'); rect(item.x - 11, item.y - 7, 22, 15, '#26313a'); rect(item.x - 9, item.y - 5, 18, 11, state.caches[i] ? '#596a64' : '#ad9977'); rect(item.x - 9, item.y + 2, 18, 2, '#726c5a'); rect(item.x - 6, item.y - 5, 2, 11, '#d0c7a4'); rect(item.x + 4, item.y - 5, 2, 11, '#d0c7a4'); if (!state.caches[i]) { rect(item.x - 3, item.y - 1, 6, 3, '#83d7b9'); rect(item.x - 1, item.y - 3, 2, 7, '#83d7b9'); } else { rect(item.x - 11, item.y - 11, 22, 5, '#7d8878'); rect(item.x - 9, item.y - 10, 18, 2, '#b4b79b'); } }
    const exit = level.exit, extractionReady = state.scrolls.every(Boolean); if (extractionReady) { ctx.strokeStyle = '#cbebba'; ctx.lineWidth = 2; ctx.strokeRect(exit[0] - 26, exit[1] - 22, 52, 44); rect(exit[0] - 5, exit[1] - 5, 10, 10, '#e1edb9'); } mapLabel(exit[0], exit[1] + 32, extractionReady ? 'EXTRACT' : 'RETURN HERE', extractionReady ? '#d6edb9' : '#a1c6aa');
    for (const n of state.noises) { ctx.globalAlpha = n.life * (n.type === 'kunai' ? .9 : .3); ctx.strokeStyle = n.type === 'kunai' ? '#9acfc5' : '#c0c9bd'; ctx.lineWidth = n.type === 'kunai' ? 2 : 1; ctx.beginPath(); ctx.arc(n.x, n.y, 8 + (1 - n.life / .35) * n.radius, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    for (const shot of state.projectiles) { ctx.strokeStyle = '#e1e4d8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(shot.x - shot.vx / 100, shot.y - shot.vy / 100); ctx.lineTo(shot.x, shot.y); ctx.stroke(); }
    const bodies = [...state.guards.map(g => ({ ...g, guard: true })), { ...p, guard: false }].sort((a, b) => a.y - b.y);
    for (const body of bodies) {
      rect(body.x - 10, body.y + 8, 20, 4, '#0d202b80'); const stationary = body.guard ? body.turnWait > 0 || body.attack > 0 || body.mode === 'investigate' && body.lastSeen && Math.hypot(body.x - body.lastSeen.x, body.y - body.lastSeen.y) < 16 : !body.moving, pose = body.mode === 'down' ? 'down' : !body.guard && body.sneaking ? 'sneak' : stationary ? 'idle' : Math.floor(state.elapsed * 9) % 2 ? 'walk1' : 'walk2';
      if (!body.guard) { ctx.strokeStyle = state.guards.some(g => guardSees(state, g)) ? '#edb077' : '#b7dcca'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(body.x, body.y + 3, 11, 7, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = !body.guard && p.invulnerable > 0 ? .62 : 1; ctx.drawImage(sprite(body.guard ? body.mode === 'alert' ? 'alert' : 'guard' : 'ninja', pose, body.facing), Math.round(body.x - 20), Math.round(body.y - 23)); ctx.globalAlpha = 1;
      if (body.guard && body.mode !== 'down') {
        if (body.suspicion > .01 || body.mode === 'alert') { rect(body.x - 12, body.y - 33, 24, 5, '#152938'); rect(body.x - 11, body.y - 32, 22 * body.suspicion, 3, body.mode === 'alert' ? '#ed968d' : '#e8c184'); }
        if (body.mode === 'investigate' || body.mode === 'alert') { rect(body.x - 5, body.y - 47, 10, 12, '#122634e0'); ctx.fillStyle = body.mode === 'alert' ? '#ffc0a0' : '#cce0d4'; ctx.font = 'bold 11px monospace'; ctx.fillText(body.mode === 'alert' ? '!' : '?', body.x - 3, body.y - 37); }
        if (body.attack > 0) { const ready = body.attack <= .18; ctx.strokeStyle = ready ? '#fff1bf' : '#eea889'; ctx.fillStyle = ready ? '#efaa785c' : '#eea88926'; ctx.lineWidth = ready ? 4 : 2; ctx.beginPath(); ctx.moveTo(body.x, body.y); ctx.arc(body.x, body.y, 34, body.attackFacing - .8, body.attackFacing + .8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      }
    }
    for (const cloud of state.clouds) { const alpha = Math.min(.76, cloud.life / 2); ctx.fillStyle = '#b0bdc5'; ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = alpha * .55; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(cloud.x + Math.cos(i * 2.4) * 35, cloud.y + Math.sin(i * 2.4) * 35, 34, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; ctx.strokeStyle = '#d6dfde'; ctx.setLineDash([5, 8]); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    // The ninja stays readable inside its own smoke, without implying visibility to patrols.
    if (state.clouds.some(c => Math.hypot(p.x - c.x, p.y - c.y) < c.radius)) { ctx.globalAlpha = .8; ctx.drawImage(sprite('ninja', p.sneaking ? 'sneak' : 'idle', p.facing), Math.round(p.x - 20), Math.round(p.y - 23)); ctx.globalAlpha = 1; }
    if (state.channel) { ctx.strokeStyle = '#eddfaf'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.channel.progress / state.channel.duration); ctx.stroke(); }
    const target = state.channel || interactionTarget(state); if (target) mapLabel(target.x, target.y - (target.type === 'guard' ? 58 : 38), state.channel ? `${Math.round(state.channel.progress / state.channel.duration * 100)}% · ${target.label.toUpperCase()}` : `HOLD E · ${target.label.toUpperCase()}`, '#efdfaa');
    effects = effects.filter(fx => fx.until > state.elapsed); for (const fx of effects) { const life = clamp((fx.until - state.elapsed) / .9, 0, 1); ctx.globalAlpha = life; ctx.strokeStyle = fx.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx.x, fx.y, reduced.matches ? 22 : 16 + (1 - life) * 22, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; if (fx.type !== 'wound' && fx.type !== 'smoke') mapLabel(fx.x, fx.y - 37 - (reduced.matches ? 0 : (1 - life) * 10), { seal: 'SEAL SECURED', takedown: 'QUIET TAKEDOWN', cache: 'TOOLS RESTOCKED', clear: 'EXTRACTED' }[fx.type], fx.color); }
    for (const fx of particles) { ctx.globalAlpha = Math.min(1, fx.life * 2); rect(fx.x, fx.y, 3, 3, fx.color); } ctx.globalAlpha = 1;
    if (!reduced.matches && level.district > 0) { ctx.globalAlpha = .18; ctx.strokeStyle = level.district === 1 ? '#aac8d7' : '#e1e5ef'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 20; i++) { const x = camera.x + (i * 113 + state.elapsed * (level.district === 1 ? 35 : 15)) % viewport.width, y = camera.y + (i * 137 + state.elapsed * (level.district === 1 ? 180 : 28)) % viewport.height; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + (level.district === 1 ? 10 : 2)); } ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.restore();
    if (effects.some(fx => fx.type === 'wound')) { ctx.strokeStyle = '#e19b8390'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, viewport.width - 6, viewport.height - 6); }
    if (viewport.width < WORLD.width) { const mw = 144, mh = 96, x = viewport.width - mw - 10, y = 10; rect(x - 3, y - 3, mw + 6, mh + 6, '#122738eb'); ctx.save(); ctx.translate(x, y); ctx.scale(mw / 960, mh / 640); rect(0, 0, 960, 640, theme.ground); for (const r of level.walls) rect(r.x, r.y, r.w, r.h, theme.trim); for (let i = 0; i < level.seals.length; i++) if (!state.scrolls[i]) rect(level.seals[i].x - 15, level.seals[i].y - 15, 30, 30, '#f4d397'); for (const g of state.guards) if (g.mode !== 'down') rect(g.x - 9, g.y - 9, 18, 18, '#dd8c81'); rect(exit[0] - 15, exit[1] - 15, 30, 30, '#9dddaf'); rect(p.x - 12, p.y - 12, 24, 24, '#e2eaf0'); ctx.strokeStyle = '#d3dce0'; ctx.lineWidth = 5; ctx.strokeRect(camera.x, camera.y, viewport.width, viewport.height); ctx.restore(); }
  }
  function schedule() { if (!destroyed && state.phase === 'playing' && raf === null) raf = requestAnimationFrame(frame); }
  function frame(now) { raf = null; if (destroyed) return; const dt = previous === null ? 0 : clamp((now - previous) / 1000, 0, .08); previous = now;
    if (state.phase === 'playing') { accumulator += dt; let ticks = 0; while (accumulator >= FIXED_STEP && ticks++ < 6 && state.phase === 'playing') { step(state, input(), FIXED_STEP); queued.clear(); accumulator -= FIXED_STEP; consumeEvents(); }
      if (!reduced.matches) { for (const fx of particles) { fx.x += fx.vx * dt; fx.y += fx.vy * dt; fx.life -= dt; } particles = particles.filter(fx => fx.life > 0); }
    } else accumulator = 0; publish(); draw(); schedule(); }
  function refresh() { if (state.phase !== 'playing' && raf !== null) { cancelAnimationFrame(raf); raf = null; } consumeEvents(); publish(true); draw(); schedule(); }
  function togglePause() { if (destroyed) return; release(); pauseState(state); previous = null; accumulator = 0; refresh(); }
  function restart() { if (destroyed) return; release(); stickySneak = false; state = createState({ difficulty }); previous = null; accumulator = 0; pointerAim = null; artLevel = -1; eventCursor = 0; particles = []; effects = []; published = -1; text(status, 'Move between cover and shadows. Lift every scroll seal, then return to the green extraction marker.'); syncButtons(); refresh(); canvas.focus({ preventScroll: true }); }
  function continueGame() { if (state.phase === 'mission-clear') { nextMission(state); release(); previous = null; accumulator = 0; pointerAim = null; particles = []; effects = []; refresh(); canvas.focus({ preventScroll: true }); } else if (['lost', 'won'].includes(state.phase)) restart(); }
  function keydown(event) { if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || isForm(event.target) || state.phase !== 'playing') return; const canonical = gameKey(event), activation = canonical === ' ' || canonical === 'Enter', target = event.target instanceof Element ? event.target.closest('button[data-control]') : null; let id = activation && target && controls.contains(target) ? target.dataset.control : KEY[canonical]; if (!id || activation && !target && event.target instanceof Element && event.target.closest('button,a,summary')) return; event.preventDefault(); if (id === 'sneak' && target && activation) { if (!event.repeat) { stickySneak = !stickySneak; syncButtons(); } return; } if (event.repeat && !held.has(event.code || event.key)) return; held.set(event.code || event.key, id); if (['smoke', 'kunai'].includes(id)) queued.add(id); syncButtons(); }
  function keyup(event) { if (held.delete(event.code || event.key)) syncButtons(); }
  function point(event) { const box = canvas.getBoundingClientRect(); return { x: camera.x + (event.clientX - box.left) / box.width * viewport.width, y: camera.y + (event.clientY - box.top) / box.height * viewport.height }; }
  function aim(event) { if (event.pointerType !== 'touch' && state.phase === 'playing') pointerAim = point(event); }
  function down(event) { if (state.phase !== 'playing' || event.button !== 0 && event.pointerType !== 'touch') return; const button = event.target instanceof Element ? event.target.closest('[data-control]') : null; if (!button || !controls.contains(button) || button.dataset.control === 'sneak') return; event.preventDefault(); const id = button.dataset.control; pointers.set(event.pointerId, { id, target: button }); try { button.setPointerCapture(event.pointerId); } catch {} if (['smoke', 'kunai'].includes(id)) queued.add(id); if (id === 'kunai' && event.pointerType === 'touch') pointerAim = null; syncButtons(); }
  function end(event) { const item = pointers.get(event.pointerId); if (!item) return; pointers.delete(event.pointerId); try { if (item.target.hasPointerCapture?.(event.pointerId)) item.target.releasePointerCapture(event.pointerId); } catch {} syncButtons(); }
  function sneakToggle() { if (state.phase !== 'playing') return; stickySneak = !stickySneak; syncButtons(); canvas.focus({ preventScroll: true }); }
  function tierChange() { difficulty = tier.value; restart(); }
  function keyboardHints() { view.dataset.keyboardLayout = getKeyboardLayout(); text(hint, `${displayKey('W A S D')} / arrows move · Shift sneak · Hold E interact / rear takedown · Space smoke · ${displayKey('Q')} distraction · Mouse aims kunai`); canvas.setAttribute('aria-label', `Ninja stealth courtyard. ${displayKey('W A S D')} or arrows move. Shift sneaks, hold E to lift seals or perform a rear takedown, Space releases smoke, ${displayKey('Q')} throws a distraction toward mouse or facing.`); }
  const unsubscribe = subscribeKeyboardLayout(() => { release(); pointerAim = null; keyboardHints(); });
  function visibility() { if (document.hidden) release(); }
  const resize = new ResizeObserver(entries => { const width = entries[0].contentRect.width, next = width < 580 ? { width: 480, height: 440 } : { width: 960, height: 640 }; if (next.width !== viewport.width) { viewport = next; canvas.width = next.width; canvas.height = next.height; board.style.aspectRatio = `${next.width}/${next.height}`; ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; draw(); } }); resize.observe(board);
  function motion() { if (reduced.matches) particles = []; if (state.phase !== 'playing') draw(); }
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', release); document.addEventListener('visibilitychange', visibility); canvas.addEventListener('pointermove', aim); controls.addEventListener('pointerdown', down); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end); view.addEventListener('lostpointercapture', end); buttons.get('sneak').addEventListener('click', sneakToggle); action.addEventListener('click', continueGame); tier.addEventListener('change', tierChange); reduced.addEventListener('change', motion);
  keyboardHints(); text(status, 'Move between cover and shadows. Lift every scroll seal, then return to the green extraction marker.'); refresh();
  return { getState: () => copy(state), restart, togglePause, destroy() { if (destroyed) return; destroyed = true; cancelAnimationFrame(raf); release(); unsubscribe(); resize.disconnect(); reduced.removeEventListener('change', motion); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', visibility); canvas.removeEventListener('pointermove', aim); controls.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); view.removeEventListener('lostpointercapture', end); buttons.get('sneak').removeEventListener('click', sneakToggle); action.removeEventListener('click', continueGame); tier.removeEventListener('change', tierChange); sprites.clear(); stageArt = null; view.remove(); } };
}
