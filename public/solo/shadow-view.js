import { WORLD, DIFFICULTIES, DISTRICTS, LEVELS, TOTAL_LEVELS, FIXED_STEP, createState, step, togglePause as pauseState, nextMission, missionDeadline, rayEnd, interactionTarget, guardSees, inShadow } from './shadow-engine.js';
import { gameKey, displayKey, getKeyboardLayout, subscribeKeyboardLayout } from '../keyboard-layout.js';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const copy = value => JSON.parse(JSON.stringify(value));
const node = (tag, name, text) => { const e = document.createElement(tag); e.className = name; if (text !== undefined) e.textContent = text; return e; };
const text = (e, value) => { if (e.textContent !== value) e.textContent = value; };
const isForm = e => e instanceof Element && Boolean(e.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'));
const KEY = { w: 'up', W: 'up', ArrowUp: 'up', s: 'down', S: 'down', ArrowDown: 'down', a: 'left', A: 'left', ArrowLeft: 'left', d: 'right', D: 'right', ArrowRight: 'right', Shift: 'sneak', e: 'interact', E: 'interact', ' ': 'smoke', q: 'kunai', Q: 'kunai' };
export function mount(container, { onUpdate = () => {} } = {}) {
  let difficulty = 'veteran', state = createState({ difficulty }), destroyed = false, raf = null, previous = null, accumulator = 0, published = -1, publishedPhase = '', artLevel = -1, stageArt = null;
  let viewport = { width: 960, height: 640 }, camera = { x: 0, y: 0 }, pointerAim = null, stickySneak = false, eventCursor = 0, particles = [];
  const held = new Map(), pointers = new Map(), queued = new Set(), reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const view = node('section', 'shadow-view'); view.setAttribute('aria-label', 'Shadow Lantern ninja stealth heist');
  const tierbar = node('div', 'shadow-tier-bar'), label = node('label', '', 'HEIST DIFFICULTY'), tier = node('select', 'shadow-tier-select'); tier.setAttribute('aria-label', 'Difficulty for a new Shadow Lantern heist');
  for (const [value, info] of Object.entries(DIFFICULTIES)) { const option = node('option', '', info.title); option.value = value; tier.append(option); } tier.value = difficulty; label.append(tier);
  const tierDetail = node('p', 'shadow-tier-detail'); tierbar.append(label, tierDetail);
  const journey = node('div', 'shadow-journey'); journey.setAttribute('aria-label', 'Nine fortress heists'); const badges = LEVELS.map((level, i) => { const b = node('span', 'shadow-mission-badge', String(i + 1).padStart(2, '0')); b.title = level.name; journey.append(b); return b; });
  const hud = node('div', 'shadow-hud'), title = node('div', 'shadow-title'), district = node('span', ''), mission = node('b', ''); title.append(district, mission);
  const numbers = node('div', 'shadow-numbers'), health = node('span', ''), scrolls = node('span', ''), alarm = node('span', ''), clock = node('span', ''); numbers.append(health, scrolls, alarm, clock); hud.append(title, numbers);
  const board = node('div', 'shadow-board'), canvas = node('canvas', 'shadow-canvas'); canvas.width = WORLD.width; canvas.height = WORLD.height; canvas.tabIndex = 0; canvas.dataset.soloFocus = ''; canvas.setAttribute('role', 'img');
  const overlay = node('div', 'shadow-overlay'); overlay.hidden = true; const card = node('div', 'shadow-overlay-card'), tag = node('span', 'shadow-overlay-tag'), heading = node('h3', ''), description = node('p', ''), action = node('button', 'shadow-continue'); action.type = 'button'; card.append(tag, heading, description, action); overlay.append(card); board.append(canvas, overlay);
  const equipment = node('div', 'shadow-equipment'), smokeCount = node('span', ''), kunaiCount = node('span', ''), concealment = node('b', ''); equipment.append(smokeCount, kunaiCount, concealment);
  const notes = node('div', 'shadow-notes'), noteTitle = node('b', '', 'MISSION INTELLIGENCE'), noteText = node('span', ''); notes.append(noteTitle, noteText);
  const status = node('p', 'shadow-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); const hint = node('p', 'shadow-hint');
  const controls = node('div', 'shadow-controls'); controls.setAttribute('aria-label', 'Shadow Lantern touch controls'); const buttons = new Map();
  for (const [id, symbol, name] of [['up', '↑', 'UP'], ['left', '←', 'LEFT'], ['down', '↓', 'DOWN'], ['right', '→', 'RIGHT'], ['sneak', '◐', 'SNEAK'], ['interact', '✦', 'INTERACT'], ['smoke', '☁', 'SMOKE'], ['kunai', '↗', 'DISTRACT']]) {
    const button = node('button', `shadow-control shadow-control-${id}`); button.type = 'button'; button.dataset.control = id; button.setAttribute('aria-label', id === 'sneak' ? 'Toggle quiet sneak mode' : id === 'interact' ? 'Hold to interact or quietly take down a guard from behind' : `Hold ${name.toLowerCase()}`); button.setAttribute('aria-pressed', 'false'); button.append(node('b', '', symbol), node('span', '', name)); controls.append(button); buttons.set(id, button);
  }
  view.append(tierbar, journey, hud, board, equipment, notes, status, hint, controls); container.append(view);
  let ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; const sprites = new Map();
  function layer(w, h, paint) { const img = document.createElement('canvas'); img.width = w; img.height = h; const prior = ctx; ctx = img.getContext('2d'); ctx.imageSmoothingEnabled = false; paint(); ctx = prior; return img; }
  function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function buildStage() {
    if (artLevel === state.level) return; artLevel = state.level; const level = LEVELS[state.level], theme = DISTRICTS[level.district];
    stageArt = layer(WORLD.width, WORLD.height, () => {
      rect(0, 0, 960, 640, theme.sky); rect(24, 34, 912, 586, '#10232b'); rect(38, 48, 884, 554, theme.ground);
      // The courtyard is one coherent tiled plane. Decorative seams are never obstacles.
      for (let y = 52; y < 602; y += 24) for (let x = 38; x < 922; x += 32) { const variant = (x * 7 + y * 3) % 5; rect(x + 1, y + 1, 30, 22, variant === 0 ? theme.dark : theme.ground); rect(x + 3, y + 20, 27, 1, '#223541'); }
      if (level.district === 0) for (let i = 0; i < 95; i++) rect(45 + (i * 97) % 865, 60 + (i * 137) % 526, 3, 2, i % 3 ? '#68856a' : '#b9aa70');
      if (level.district === 2) for (let i = 0; i < 135; i++) rect(45 + (i * 113) % 865, 60 + (i * 139) % 526, 4 + i % 5, 2, '#6e7e91');
      for (const r of level.shadows) { rect(r.x, r.y, r.w, r.h, theme.dark); for (let y = r.y + 7; y < r.y + r.h; y += 17) for (let x = r.x + 7; x < r.x + r.w; x += 23) rect(x, y, 4, 2, level.district === 0 ? '#365847' : '#35435b'); }
      for (const r of level.walls) {
        // Solid artwork shares the exact collision rectangle; its small shadow stays outside.
        rect(r.x + 4, r.y + 4, r.w, r.h, '#0f202980'); rect(r.x, r.y, r.w, r.h, '#152835'); rect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, theme.wall);
        if (r.kind === 'screen') { for (let x = r.x + 6; x < r.x + r.w - 3; x += 8) { rect(x, r.y + 4, 3, r.h - 8, '#aa936a'); rect(x + 1, r.y + 8, 1, r.h - 16, '#dbc393'); } rect(r.x + 3, r.y + 7, r.w - 6, 4, '#524647'); rect(r.x + 3, r.y + r.h - 11, r.w - 6, 4, '#524647'); }
        else {
          for (let y = r.y + 6; y < r.y + r.h - 3; y += 12) { rect(r.x + 5, y, r.w - 10, 3, '#343b50'); rect(r.x + 8, y + 3, r.w - 16, 2, level.district === 0 ? '#a97564' : '#8b91a4'); for (let x = r.x + 12; x < r.x + r.w - 8; x += 24) rect(x + (y % 24 ? 0 : 12), y, 2, 9, '#444359'); }
          rect(r.x + 5, r.y + r.h / 2 - 3, r.w - 10, 6, theme.trim); rect(r.x + 8, r.y + r.h / 2 - 1, r.w - 16, 2, '#f3ddba');
          for (const x of [r.x + 5, r.x + r.w - 10]) { rect(x, r.y + 5, 5, r.h - 10, '#242e40'); rect(x + 1, r.y + 6, 2, r.h - 12, theme.trim); }
          if (level.district === 2) { rect(r.x + 2, r.y + 2, r.w - 4, 4, '#d0dce3'); rect(r.x + 6, r.y + 6, r.w - 12, 2, '#9aafc5'); }
        }
      }
      // Enclosing walls exactly match the play boundary. Lantern brackets live on them.
      rect(24, 34, 912, 14, '#5c5263'); rect(24, 602, 912, 18, '#454356'); rect(24, 48, 14, 554, '#4c4557'); rect(922, 48, 14, 554, '#4c4557');
      for (let x = 60; x < 920; x += 120) { rect(x, 37, 76, 3, theme.trim); rect(x + 32, 40, 10, 4, '#262b3b'); rect(x + 31, 48, 12, 14, theme.accent); rect(x + 29, 45, 16, 4, '#413747'); rect(x + 29, 62, 16, 3, '#413747'); rect(x + 34, 50, 3, 10, '#ffe3ab'); }
      for (let y = 100; y < 590; y += 130) { rect(28, y, 7, 50, theme.trim); rect(925, y, 7, 50, theme.trim); }
      const [ex, ey] = level.exit; rect(ex - 22, ey - 18, 44, 36, '#163d3d'); rect(ex - 18, ey - 14, 36, 28, '#4e8070'); rect(ex - 14, ey - 10, 28, 20, '#234f47'); ctx.strokeStyle = '#b8d9ad'; ctx.lineWidth = 2; ctx.strokeRect(ex - 23, ey - 19, 46, 38);
    });
  }
  function sprite(kind, pose, facing) {
    const direction = ((Math.round(facing / (Math.PI / 4)) % 8) + 8) % 8, key = `${kind}:${pose}:${direction}`; if (sprites.has(key)) return sprites.get(key);
    const image = layer(36, 38, () => {
      ctx.translate(18, 19); const left = Math.cos(facing) < -.3; if (left) ctx.scale(-1, 1);
      if (pose === 'down') { rect(-12, 1, 22, 8, '#162735'); rect(-10, -1, 8, 8, '#ab806b'); rect(-2, 4, 14, 4, '#4b6476'); rect(-10, 6, 6, 2, '#d1bb96'); return; }
      const ninja = kind === 'ninja', body = ninja ? '#293747' : kind === 'alert' ? '#9c514d' : '#596f81', light = ninja ? '#55647a' : '#97acb5';
      rect(-7, -7, 14, 13, '#152634'); rect(-6, -6, 12, 11, body); rect(-5, -5, 3, 10, light); rect(-7, 3, 15, 4, ninja ? '#ac6870' : '#c4a46c'); rect(1, 4, 4, 2, '#e7c5a0');
      if (ninja) { rect(-6, -14, 12, 9, '#1d2939'); rect(-5, -15, 10, 5, '#39475c'); rect(-5, -11, 12, 3, '#d0baa2'); rect(0, -11, 3, 2, '#f6e3bd'); rect(-6, -7, 13, 3, '#ac6870'); rect(-12, -8, 6, 3, '#9b5562'); rect(-15, -7, 5, 2, '#d58f92'); rect(-9, -1, 3, 10, '#ccd4d3'); rect(-10, -3, 5, 2, '#596274'); }
      else { rect(-7, -13, 14, 8, '#a88668'); rect(-9, -14, 18, 5, '#30364b'); rect(-6, -17, 12, 4, '#57657a'); rect(-3, -18, 6, 3, '#c5ac7a'); rect(-5, -10, 11, 4, '#d1b598'); rect(2, -10, 3, 2, '#233044'); rect(7, -4, 3, 14, '#d2cabc'); rect(7, -7, 3, 4, '#716675'); }
      const gait = pose === 'walk1' ? 3 : pose === 'walk2' ? -3 : 0; rect(-5, 7, 5, 7, '#1a2a3d'); rect(1, 7, 5, 7, '#233347'); rect(-7 - gait, 12, 8, 4, ninja ? '#819197' : '#d1b79c'); rect(1 + gait, 12, 8, 4, ninja ? '#819197' : '#d1b79c');
      if (pose === 'sneak') { rect(-5, 10, 12, 4, '#26364b'); rect(-8, 13, 8, 3, '#819197'); rect(2, 13, 8, 3, '#819197'); }
      if (Math.sin(facing) < -.5) { rect(-5, -12, 10, 6, ninja ? '#263548' : '#3c4e62'); rect(-4, -13, 8, 2, ninja ? '#667485' : '#c4ac82'); }
    }); sprites.set(key, image); return image;
  }
  function input() { const result = { sneak: stickySneak }; for (const id of held.values()) result[id] = true; for (const item of pointers.values()) result[item.id] = true; for (const id of queued) result[id] = true; if (pointerAim) Object.assign(result, { aimX: pointerAim.x, aimY: pointerAim.y }); return result; }
  function syncButtons() { const controlsInput = input(); for (const [id, button] of buttons) button.setAttribute('aria-pressed', String(Boolean(controlsInput[id]))); }
  function release() { held.clear(); queued.clear(); for (const [id, item] of pointers) try { if (item.target.hasPointerCapture?.(id)) item.target.releasePointerCapture(id); } catch {} pointers.clear(); syncButtons(); }
  function consumeEvents() {
    for (const e of state.events) if (e.id > eventCursor) { eventCursor = e.id;
      const colors = { seal: '#edddac', takedown: '#a5d6bd', wound: '#ee9b98', smoke: '#b7c7d0', cache: '#97dacd', clear: '#cfe9b6' };
      if (colors[e.type] && !reduced.matches) for (let i = 0; i < 9; i++) particles.push({ x: e.x, y: e.y, vx: Math.cos(i * 2.4) * 42, vy: Math.sin(i * 2.4) * 42, life: .5, color: colors[e.type] });
      if (e.type === 'seal') text(status, 'Scroll seal secured. Carry every seal back to the green extraction marker.');
      if (e.type === 'alarm') text(status, `A patrol raised the alarm. ${Math.max(0, DIFFICULTIES[difficulty].alarms - state.alarm)} alarms remain across the whole campaign. Break sight behind solid cover.`);
      if (e.type === 'wound') text(status, `Guard blade connected. ${state.player.hp} ${state.player.hp === 1 ? 'wound remains' : 'wounds remain'}. The bright slash sector warns where the strike will land.`);
      if (e.type === 'takedown') text(status, 'Quiet rear takedown. This patrol stays down for the mission.');
      if (e.type === 'cache') text(status, 'Tool cache opened. These supplies carry into the next fortress.');
      if (e.type === 'smoke') text(status, 'Smoke hides sight for five seconds. Footsteps still draw nearby patrols.');
    } if (particles.length > 96) particles.splice(0, particles.length - 96);
  }
  function publish(force = false) {
    if (!force && state.elapsed - published < .1 && publishedPhase === state.phase) return; published = state.elapsed; publishedPhase = state.phase;
    const level = LEVELS[state.level], info = DIFFICULTIES[difficulty], p = state.player; text(tierDetail, info.description); text(district, `${DISTRICTS[level.district].name.toUpperCase()} · HEIST ${state.level + 1} / 9`); text(mission, level.name); text(health, `♥ ${p.hp} WOUNDS`); text(scrolls, `▤ ${state.scrolls.filter(Boolean).length}/${state.scrolls.length} SEALS`); text(alarm, `! ${state.alarm}/${info.alarms} ALARMS`); text(clock, `${Math.max(0, missionDeadline(state) - state.levelElapsed).toFixed(1)}s`); clock.dataset.urgent = String(missionDeadline(state) - state.levelElapsed < 15);
    text(smokeCount, `☁ ${state.smoke} SMOKE`); text(kunaiCount, `↗ ${state.kunai} DISTRACTIONS`); const target = interactionTarget(state); text(concealment, state.channel ? `${state.channel.label} · ${Math.round(state.channel.progress / state.channel.duration * 100)}%` : target ? `HOLD E · ${target.label.toUpperCase()}` : inShadow(level, p) ? p.sneaking ? 'QUIET IN SHADOW' : 'SHADOW · SNEAK TO HIDE' : p.sneaking ? 'QUIET FOOTSTEPS' : 'OPEN GROUND');
    text(noteText, level.hint); badges.forEach((b, i) => b.dataset.mission = i < state.level ? 'complete' : i === state.level ? 'current' : 'future'); overlay.hidden = state.phase === 'playing'; action.hidden = state.phase === 'paused';
    if (state.phase === 'paused') { text(tag, 'PATROLS & CLOCK HELD'); text(heading, 'Heist paused'); text(description, 'Study the cones and cover. Resume above or press P when your route is ready.'); }
    if (state.phase === 'mission-clear') { text(tag, 'SCROLLS EXTRACTED'); text(heading, `${state.level + 1} / 9 heists complete`); text(description, `${state.player.hp} wounds · ${state.smoke} smoke · ${state.kunai} distractions carry forward. Next: ${LEVELS[state.level + 1].name}.`); text(action, 'Enter the next fortress'); }
    if (state.phase === 'lost') { text(tag, 'FORTRESS SEALED'); text(heading, 'The lanterns found you'); text(description, `${state.reason} ${state.cleared}/9 heists complete. Only a full campaign sets a record.`); text(action, 'Plan a new heist'); }
    if (state.phase === 'won') { text(tag, 'NINE FORTRESSES · EVERY SEAL'); text(heading, 'The last lantern is yours'); text(description, `${state.score.toLocaleString()} heist points · ${state.player.hp} wounds left · ${state.alarm} alarms. Completed records stay separate by difficulty.`); text(action, 'Steal the night again'); }
    onUpdate({ phase: state.phase, score: state.score, scoreLabel: 'HEIST POINTS', recordLabel: 'BEST COMPLETE HEIST', record: state.phase === 'won' ? state.score : undefined, recordKey: state.recordKey, result: state.phase === 'won' ? 'campaign' : undefined, detail: `${state.cleared}/9 heists · ${state.player.hp} wounds · ${state.alarm}/${info.alarms} alarms` });
  }
  function cone(g, level) {
    if (g.mode === 'down') return; const range = (g.mode === 'alert' ? 250 : 195) * DIFFICULTIES[difficulty].sight, angle = g.mode === 'alert' ? .85 : .58;
    ctx.fillStyle = g.mode === 'alert' ? '#e17d7140' : g.suspicion > .1 ? '#edbd6b43' : '#ebd09b24'; ctx.beginPath(); ctx.moveTo(g.x, g.y);
    for (let i = 0; i <= 20; i++) { const end = rayEnd(level, g.x, g.y, g.facing - angle + i / 20 * angle * 2, range); ctx.lineTo(end.x, end.y); } ctx.closePath(); ctx.fill();
    for (const side of [-1, 1]) { const end = rayEnd(level, g.x, g.y, g.facing + angle * side, range); ctx.strokeStyle = g.mode === 'alert' ? '#ed9f8650' : '#e4c7924a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(end.x, end.y); ctx.stroke(); }
  }
  function draw() {
    buildStage(); const level = LEVELS[state.level], theme = DISTRICTS[level.district], p = state.player;
    camera.x = clamp(p.x - viewport.width * .5, 0, WORLD.width - viewport.width); camera.y = clamp(p.y - viewport.height * .55, 0, WORLD.height - viewport.height);
    ctx.clearRect(0, 0, viewport.width, viewport.height); ctx.imageSmoothingEnabled = false; ctx.save(); ctx.translate(-Math.round(camera.x), -Math.round(camera.y)); ctx.drawImage(stageArt, 0, 0);
    for (const g of state.guards) cone(g, level);
    for (let i = 0; i < level.seals.length; i++) { const item = level.seals[i]; if (state.scrolls[i]) { rect(item.x - 4, item.y - 3, 8, 6, '#53716b'); continue; } rect(item.x - 8, item.y - 10, 16, 20, '#1d3040'); rect(item.x - 6, item.y - 9, 12, 18, '#e7cf9e'); rect(item.x - 9, item.y - 9, 18, 3, '#9b6a59'); rect(item.x - 9, item.y + 6, 18, 3, '#9b6a59'); rect(item.x - 3, item.y - 4, 6, 7, '#b26066'); rect(item.x - 1, item.y - 3, 2, 5, '#f1dcad'); ctx.strokeStyle = '#e7c991'; ctx.lineWidth = 1; ctx.strokeRect(item.x - 13, item.y - 14, 26, 28); }
    for (let i = 0; i < level.caches.length; i++) { const item = level.caches[i]; rect(item.x - 10, item.y - 7, 20, 14, '#1c2e3c'); rect(item.x - 8, item.y - 5, 16, 10, state.caches[i] ? '#586568' : '#ad9977'); rect(item.x - 1, item.y - 5, 2, 10, '#cfceb2'); if (!state.caches[i]) rect(item.x - 3, item.y - 1, 6, 3, '#73bfa9'); }
    const exit = level.exit; if (state.scrolls.every(Boolean)) { ctx.strokeStyle = '#cbebba'; ctx.lineWidth = 3; ctx.strokeRect(exit[0] - 26, exit[1] - 22, 52, 44); rect(exit[0] - 5, exit[1] - 5, 10, 10, '#e1edb9'); }
    for (const n of state.noises) if (n.type === 'kunai') { ctx.globalAlpha = n.life; ctx.strokeStyle = '#9acfc5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(n.x, n.y, 10 + (1 - n.life / .35) * 30, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    for (const shot of state.projectiles) { ctx.strokeStyle = '#e1e4d8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(shot.x - shot.vx / 100, shot.y - shot.vy / 100); ctx.lineTo(shot.x, shot.y); ctx.stroke(); }
    const bodies = [...state.guards.map(g => ({ ...g, guard: true })), { ...p, guard: false }].sort((a, b) => a.y - b.y);
    for (const body of bodies) {
      rect(body.x - 10, body.y + 8, 20, 4, '#0d202b80'); const pose = body.mode === 'down' ? 'down' : !body.guard && body.sneaking ? 'sneak' : !body.guard && !body.moving ? 'idle' : Math.floor(state.elapsed * 9) % 2 ? 'walk1' : 'walk2';
      ctx.globalAlpha = !body.guard && p.invulnerable > 0 ? .62 : 1; ctx.drawImage(sprite(body.guard ? body.mode === 'alert' ? 'alert' : 'guard' : 'ninja', pose, body.facing), Math.round(body.x - 18), Math.round(body.y - 19)); ctx.globalAlpha = 1;
      if (body.guard && body.mode !== 'down') {
        if (body.suspicion > .01 || body.mode === 'alert') { rect(body.x - 12, body.y - 28, 24, 5, '#152938'); rect(body.x - 11, body.y - 27, 22 * body.suspicion, 3, body.mode === 'alert' ? '#ed968d' : '#e8c184'); }
        if (body.mode === 'investigate') { ctx.fillStyle = '#cce0d4'; ctx.font = 'bold 12px monospace'; ctx.fillText('?', body.x - 4, body.y - 27); }
        if (body.attack > 0) { const ready = body.attack <= .18; ctx.strokeStyle = ready ? '#fff1bf' : '#eea889'; ctx.fillStyle = ready ? '#efaa785c' : '#eea88926'; ctx.lineWidth = ready ? 4 : 2; ctx.beginPath(); ctx.moveTo(body.x, body.y); ctx.arc(body.x, body.y, 34, body.attackFacing - .8, body.attackFacing + .8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      }
    }
    for (const cloud of state.clouds) { const alpha = Math.min(.76, cloud.life / 2); ctx.fillStyle = '#b0bdc5'; ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = alpha * .55; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(cloud.x + Math.cos(i * 2.4) * 35, cloud.y + Math.sin(i * 2.4) * 35, 34, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; ctx.strokeStyle = '#d6dfde'; ctx.setLineDash([5, 8]); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    // The ninja stays readable inside its own smoke, without implying visibility to patrols.
    if (state.clouds.some(c => Math.hypot(p.x - c.x, p.y - c.y) < c.radius)) { ctx.globalAlpha = .7; ctx.drawImage(sprite('ninja', p.sneaking ? 'sneak' : 'idle', p.facing), Math.round(p.x - 18), Math.round(p.y - 19)); ctx.globalAlpha = 1; }
    if (state.channel) { ctx.strokeStyle = '#eddfaf'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.channel.progress / state.channel.duration); ctx.stroke(); }
    for (const fx of particles) { ctx.globalAlpha = Math.min(1, fx.life * 2); rect(fx.x, fx.y, 3, 3, fx.color); } ctx.globalAlpha = 1;
    if (!reduced.matches && level.district > 0) { ctx.globalAlpha = .18; ctx.strokeStyle = level.district === 1 ? '#aac8d7' : '#e1e5ef'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 20; i++) { const x = camera.x + (i * 113 + state.elapsed * (level.district === 1 ? 35 : 15)) % viewport.width, y = camera.y + (i * 137 + state.elapsed * (level.district === 1 ? 180 : 28)) % viewport.height; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + (level.district === 1 ? 10 : 2)); } ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.restore();
    if (viewport.width < WORLD.width) { const mw = 144, mh = 96, x = viewport.width - mw - 10, y = 10; rect(x - 3, y - 3, mw + 6, mh + 6, '#122738eb'); ctx.save(); ctx.translate(x, y); ctx.scale(mw / 960, mh / 640); rect(0, 0, 960, 640, theme.ground); for (const r of level.walls) rect(r.x, r.y, r.w, r.h, theme.trim); for (let i = 0; i < level.seals.length; i++) if (!state.scrolls[i]) rect(level.seals[i].x - 15, level.seals[i].y - 15, 30, 30, '#f4d397'); for (const g of state.guards) if (g.mode !== 'down') rect(g.x - 9, g.y - 9, 18, 18, '#dd8c81'); rect(exit[0] - 15, exit[1] - 15, 30, 30, '#9dddaf'); rect(p.x - 12, p.y - 12, 24, 24, '#e2eaf0'); ctx.strokeStyle = '#d3dce0'; ctx.lineWidth = 5; ctx.strokeRect(camera.x, camera.y, viewport.width, viewport.height); ctx.restore(); }
  }
  function schedule() { if (!destroyed && state.phase === 'playing' && raf === null) raf = requestAnimationFrame(frame); }
  function frame(now) { raf = null; if (destroyed) return; const dt = previous === null ? 0 : clamp((now - previous) / 1000, 0, .08); previous = now;
    if (state.phase === 'playing') { accumulator += dt; let ticks = 0; while (accumulator >= FIXED_STEP && ticks++ < 6 && state.phase === 'playing') { step(state, input(), FIXED_STEP); queued.clear(); accumulator -= FIXED_STEP; consumeEvents(); }
      if (!reduced.matches) { for (const fx of particles) { fx.x += fx.vx * dt; fx.y += fx.vy * dt; fx.life -= dt; } particles = particles.filter(fx => fx.life > 0); }
    } else accumulator = 0; publish(); draw(); schedule(); }
  function refresh() { if (state.phase !== 'playing' && raf !== null) { cancelAnimationFrame(raf); raf = null; } consumeEvents(); publish(true); draw(); schedule(); }
  function togglePause() { if (destroyed) return; release(); pauseState(state); previous = null; accumulator = 0; refresh(); }
  function restart() { if (destroyed) return; release(); stickySneak = false; state = createState({ difficulty }); previous = null; accumulator = 0; pointerAim = null; artLevel = -1; eventCursor = 0; particles = []; published = -1; text(status, 'Move between cover and shadows. Lift every scroll seal, then return to the green extraction marker.'); syncButtons(); refresh(); canvas.focus({ preventScroll: true }); }
  function continueGame() { if (state.phase === 'mission-clear') { nextMission(state); release(); previous = null; accumulator = 0; pointerAim = null; particles = []; refresh(); canvas.focus({ preventScroll: true }); } else if (['lost', 'won'].includes(state.phase)) restart(); }
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
