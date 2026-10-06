import {
  FIXED_DT, ROAD_HALF, BIKE_WIDTH, BIKE_LENGTH, DISTRICTS, DIFFICULTIES,
  createState, step, togglePause as pauseState, getDistrict, getDifficulty, recordScope,
} from './paris-engine.js';
import { createParisSprites } from '../art/paris-sprites.js';

const W = 720, H = 520, RIDER_Y = 439;
// A wider lateral scale makes the narrow gaps readable; distance remains linear.
const X_SCALE = 34, Z_SCALE = 17;
const ROAD_LEFT = W / 2 - ROAD_HALF * X_SCALE;
const ROAD_RIGHT = W / 2 + ROAD_HALF * X_SCALE;
const KEY_CONTROLS = {
  ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'throttle', w: 'throttle', W: 'throttle', ArrowDown: 'brake', s: 'brake', S: 'brake',
  ' ': 'assist', Space: 'assist', b: 'bell', B: 'bell',
};
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const isInteractive = (target) => target instanceof Element &&
  Boolean(target.closest('input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"])'));
function node(tag, className, text) {
  const result = document.createElement(tag);
  result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}
function setText(target, value) { if (target.textContent !== value) target.textContent = value; }
function setAttr(target, key, value) { if (target.getAttribute(key) !== value) target.setAttribute(key, value); }

export function mount(container, { onUpdate = () => {} } = {}) {
  let state = createState({ mode: 'delivery', difficulty: 'veteran' });
  const sprites = createParisSprites();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia?.('(min-width:951px) and (pointer:fine)');
  const mobile = window.matchMedia?.('(max-width:600px)');
  const keys = new Map(), pointers = new Map(), buttons = new Map();
  let destroyed = false, raf = null, previousFrame = null, accumulator = 0;
  let lastPublished = -Infinity, lastPhase = null, lastEventId = -1;
  let message = null, bellPulseUntil = 0;
  const view = node('section', 'paris-view');
  view.setAttribute('aria-label', 'Paris Pedal e-bike courier game');
  const choices = node('div', 'paris-choices');
  const modes = node('div', 'paris-modes');
  modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', 'Choose ride mode');
  for (const [id, title] of [['delivery', 'Five deliveries'], ['rush', 'City Rush']]) {
    const button = node('button', 'paris-choice', title);
    button.type = 'button'; button.dataset.mode = id;
    button.title = 'Changing mode starts a fresh ride with the same seed.';
    modes.append(button);
  }
  const difficulties = node('div', 'paris-difficulties');
  difficulties.setAttribute('role', 'group'); difficulties.setAttribute('aria-label', 'Choose difficulty');
  for (const difficulty of DIFFICULTIES) {
    const button = node('button', 'paris-choice', difficulty.title);
    button.type = 'button'; button.dataset.difficulty = difficulty.id;
    button.title = 'Changing difficulty starts a fresh ride with the same seed.';
    difficulties.append(button);
  }
  choices.append(modes, difficulties);
  const stage = node('div', 'paris-stage');
  const route = node('div', 'paris-route');
  const location = node('strong', 'paris-location');
  const routeDetail = node('span', 'paris-route-detail');
  route.append(location, routeDetail);
  const clock = node('strong', 'paris-clock');
  const progress = node('div', 'paris-progress');
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', 'Current delivery progress');
  progress.setAttribute('aria-valuemin', '0'); progress.setAttribute('aria-valuemax', '100');
  const progressFill = node('i', ''); progress.append(progressFill);
  stage.append(route, clock, progress);
  const board = node('div', 'paris-board');
  const canvas = node('canvas', 'paris-canvas');
  canvas.width = W; canvas.height = H; canvas.tabIndex = 0; canvas.dataset.soloFocus = '';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Top-down Paris street. Arrow keys or W A S D to ride. Space for electric assist; B rings the bell. P pauses.');
  const overlay = node('div', 'paris-overlay'); overlay.hidden = true;
  const overlayEyebrow = node('span', 'paris-overlay-eyebrow');
  const overlayTitle = node('strong', 'paris-overlay-title');
  const overlayDetail = node('span', 'paris-overlay-detail');
  const replay = node('button', 'paris-replay', 'Ride this route again ↗'); replay.type = 'button';
  overlay.append(overlayEyebrow, overlayTitle, overlayDetail, replay);
  const mobileHud = node('div', 'paris-mobile-hud');
  const mobileSpeed = node('strong', ''), mobileBattery = node('strong', ''),
    mobileHealth = node('strong', ''), mobileCombo = node('strong', '');
  for (const [label, value] of [['KM/H', mobileSpeed], ['BATTERY', mobileBattery], ['RIDER', mobileHealth], ['COMBO', mobileCombo]]) {
    const item = node('div', ''); item.append(node('span', '', label), value); mobileHud.append(item);
  }
  board.append(canvas, mobileHud, overlay);
  const footer = node('div', 'paris-footer');
  const controls = node('div', 'paris-controls');
  controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Hold to ride');
  for (const [control, symbol, title] of [
    ['left', '←', 'Left'], ['right', '→', 'Right'], ['brake', '↓', 'Brake'],
    ['throttle', '↑', 'Pedal'], ['assist', '⚡', 'Assist'], ['bell', '◉', 'Bell'],
  ]) {
    const button = node('button', `paris-control paris-control-${control}`);
    button.type = 'button'; button.dataset.control = control;
    button.setAttribute('aria-label', control === 'bell' ? 'Ring bell' : `Hold to ${title.toLowerCase()}`);
    button.setAttribute('aria-pressed', 'false');
    button.append(node('b', '', symbol), node('span', '', title.toUpperCase()));
    buttons.set(control, button); controls.append(button);
  }
  const hint = node('p', 'paris-hint', '← → steer · ↑ pedal · ↓ brake · Space assist · B bell. Amber arrows show a merge; red stripes warn of a door.');
  const status = node('p', 'paris-status');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
  footer.append(controls, hint, status);
  view.append(choices, stage, board, footer); container.append(view);
  const ctx = canvas.getContext('2d');
  let backingRatio = 1;

  function input() {
    const held = { left: false, right: false, throttle: false, brake: false, assist: false, bell: false };
    for (const value of keys.values()) held[value] = true;
    for (const pointer of pointers.values()) held[pointer.control] = true;
    return held;
  }
  function syncButtons() {
    const held = input();
    for (const [control, button] of buttons) {
      setAttr(button, 'aria-pressed', String(held[control]));
      button.dataset.held = String(held[control]);
    }
  }
  function releaseControls() {
    keys.clear();
    const captures = [...pointers]; pointers.clear();
    for (const [id, pointer] of captures) {
      try { if (pointer.button.hasPointerCapture?.(id)) pointer.button.releasePointerCapture(id); } catch {}
    }
    syncButtons();
  }
  function details() {
    if (state.phase === 'paused') return 'Ride paused. Press P or Resume to continue.';
    if (state.phase === 'won') return `Five deliveries across Paris. ${state.totalCrashes === 0 ? 'A clean ride.' : `${state.totalCrashes} impacts.`} ${Math.round(state.score)} points.`;
    if (state.phase === 'lost') return state.result === 'delivery-late'
      ? 'Delivery missed. Carry speed through open gaps and save assist for the next clear stretch.'
      : 'Your ride ends here. Brake early, watch the signals, and leave an escape gap.';
    return 'Read the signals. Thread the gaps. Ring your bell near cyclists; buses and cars keep their line.';
  }
  function publish(force = false) {
    if (!force && state.elapsed - lastPublished < 0.1 && state.phase === lastPhase) return;
    lastPublished = state.elapsed; lastPhase = state.phase;
    const district = getDistrict(state);
    const complete = state.phase === 'won';
    const portion = complete ? 100 : clamp(state.stageDistance / district.length * 100, 0, 100);
    setText(location, `${String((state.stageIndex % DISTRICTS.length) + 1).padStart(2, '0')} / ${district.title}`);
    setText(routeDetail, complete ? 'ALL FIVE DELIVERED' : `${Math.max(0, Math.ceil(district.length - state.stageDistance))} m to ${state.mode === 'delivery' ? 'delivery' : 'next quartier'}`);
    setText(clock, complete ? 'MERCI !' : state.timeLeft === null || state.timeLeft === undefined ? 'NO DEADLINE' : `${Math.max(0, state.timeLeft).toFixed(1)} s`);
    stage.dataset.urgent = String(state.timeLeft !== null && state.timeLeft <= 6);
    setText(mobileSpeed, String(Math.round(state.speed * 3.6)));
    setText(mobileBattery, `${Math.round(state.battery * 100)}%`);
    setText(mobileHealth, `${state.health}/3`);
    setText(mobileCombo, `${Math.max(1, state.combo)}×`);
    progressFill.style.width = `${portion}%`;
    setAttr(progress, 'aria-valuenow', String(Math.round(portion)));
    for (const button of modes.children) setAttr(button, 'aria-pressed', String(button.dataset.mode === state.mode));
    for (const button of difficulties.children) setAttr(button, 'aria-pressed', String(button.dataset.difficulty === state.difficulty));
    view.dataset.phase = state.phase; view.dataset.rideDifficulty = state.difficulty;
    overlay.hidden = state.phase === 'playing';
    if (!overlay.hidden) {
      setText(overlayEyebrow, state.phase === 'paused' ? 'UN PETIT MOMENT' : 'PARIS / FIN DE COURSE');
      setText(overlayTitle, state.phase === 'paused' ? 'Take a breather.' : state.phase === 'won' ? 'Livraison réussie.' : 'End of the ride.');
      setText(overlayDetail, state.phase === 'paused' ? 'Press P or Resume when you are ready.' : `${(state.distance / 1000).toFixed(2)} KM · ${Math.round(state.score)} POINTS · ${getDifficulty(state).title.toUpperCase()}`);
      replay.hidden = state.phase === 'paused';
    }
    // Announce meaningful phase changes only; the fast HUD is deliberately not live.
    setText(status, details());
    onUpdate({ phase: state.phase, score: Math.round(state.score),
      record: state.mode === 'rush' || state.phase === 'won' ? Math.round(state.score) : null,
      recordKey: recordScope(state), recordLabel: state.mode === 'delivery' ? 'BEST DELIVERY' : 'BEST RIDE',
      scoreLabel: 'SCORE', detail: details() });
  }
  function rect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  }
  function text(value, x, y, size, color, align = 'left') {
    ctx.font = `bold ${size}px ui-monospace, monospace`; ctx.fillStyle = color;
    ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(value, x, y);
  }
  function projection(actor) { return { x: W / 2 + actor.x * X_SCALE, y: RIDER_Y - (actor.z - state.distance) * Z_SCALE }; }
  function warning(actor, point, width, height) {
    if (!actor.warningActive && !actor.turnSignal && !(actor.kind === 'door' && actor.maneuverStarted)) return;
    const target = W / 2 + (Number.isFinite(actor.targetX) ? actor.targetX : actor.x) * X_SCALE;
    const door = actor.kind === 'door';
    const color = door ? '#e37c45' : '#f4c567';
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(point.x - width / 2 - 4, point.y - height / 2 - 4, width + 8, height + 8);
    if (target !== point.x) {
      ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.lineTo(target, point.y); ctx.stroke();
      ctx.setLineDash([]);
      const direction = target > point.x ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(target - direction * 9, point.y - 6); ctx.lineTo(target, point.y); ctx.lineTo(target - direction * 9, point.y + 6); ctx.stroke();
    }
    ctx.restore();
    text(door ? 'DOOR' : actor.kind === 'cyclist' ? 'DRIFT' : 'MERGE', point.x, point.y - height / 2 - 12, 10, color, 'center');
  }
  function drawActor(actor) {
    const point = projection(actor), width = actor.width * X_SCALE, height = actor.length * Z_SCALE;
    if (point.y + height / 2 < -35 || point.y - height / 2 > H + 25) return;
    if (actor.kind === 'door') {
      const active = actor.maneuverStarted;
      // Parked body and door are drawn in the engine's occupied footprint.
      rect(point.x - width / 2, point.y - height / 2, width, height, active ? '#b6754d' : '#a99179');
      rect(point.x - width / 2 + 3, point.y - height / 2 + 3, Math.max(3, width - 6), 7, '#bad0c9');
      rect(point.x - width / 2 + 3, point.y + height / 2 - 10, Math.max(3, width - 6), 7, '#788f8f');
      rect(point.x - width / 2 + 3, point.y - 2, Math.max(3, width - 6), 3, '#68574b');
      if (active) {
        ctx.save(); ctx.beginPath(); ctx.rect(point.x - width / 2, point.y - height / 2, width, height); ctx.clip();
        ctx.strokeStyle = '#ffe2a3'; ctx.lineWidth = 2;
        for (let offset = -height; offset < width + height; offset += 10) {
          ctx.beginPath(); ctx.moveTo(point.x - width / 2 + offset, point.y + height / 2); ctx.lineTo(point.x - width / 2 + offset + height, point.y - height / 2); ctx.stroke();
        }
        ctx.restore();
      }
    } else if (actor.kind === 'barrier') {
      rect(point.x - width / 2, point.y - height / 2, width, height, '#edbb64');
      for (let i = 0; i < width; i += 12) rect(point.x - width / 2 + i, point.y - height / 2, 5, height, '#625442');
      rect(point.x - width / 2 + 2, point.y - height / 2 - 3, 6, 6, '#f58a4d');
      rect(point.x + width / 2 - 8, point.y - height / 2 - 3, 6, 6, '#f58a4d');
    } else sprites.drawActor(ctx, actor, point.x, point.y, { width, height });
    warning(actor, point, width, height);
  }
  function aheadMarkers() {
    // Four nearest upcoming vehicles at most. Exact road x and text expose the
    // intent before the compressed camera brings the full sprite into view.
    const upcoming = state.traffic.filter(actor => !actor.passed && actor.z - state.distance < 55 &&
      projection(actor).y + actor.length * Z_SCALE / 2 < 3).sort((a, b) => a.z - b.z);
    const occupied = [];
    for (const actor of upcoming) {
      if (occupied.length >= 4) break;
      const x = clamp(W / 2 + actor.x * X_SCALE, ROAD_LEFT + 29, ROAD_RIGHT - 29);
      if (occupied.some(position => Math.abs(position - x) < 54)) continue;
      occupied.push(x);
      const warning = actor.warningActive || actor.turnSignal;
      const type = actor.kind === 'cyclist' ? 'CYCLE' : actor.kind === 'barrier' ? 'WORKS' : actor.kind.toUpperCase();
      rect(x - 27, 5, 54, 34, warning ? '#695744' : '#34534f');
      rect(x - 27, 5, 54, 2, actor.kind === 'door' ? '#e98e54' : warning ? '#ecc374' : '#a8c4b3');
      text(type, x, 19, 9, '#f4efd4', 'center');
      const arrow = warning ? actor.turnSignal < 0 ? '← ' : actor.turnSignal > 0 ? '→ ' : '! ' : '';
      text(`${arrow}${Math.ceil(actor.z - state.distance)}m`, x, 32, 10, warning ? '#f4cf81' : '#c7d9c4', 'center');
    }
  }
  function hud() {
    // Instruments sit over the pavements, away from the next traffic gap.
    rect(14, 16, 153, 97, '#214b4b'); rect(17, 19, 147, 3, '#83bbaa');
    text('VÉLO ÉLECTRIQUE', 26, 37, 10, '#b5d4c3');
    text(String(Math.round(state.speed * 3.6)).padStart(2, '0'), 25, 77, 36, '#faf1cf');
    text('KM/H', 80, 73, 11, '#b5d4c3');
    text(state.assistActive ? 'ASSIST ON' : 'PACE YOURSELF', 26, 99, 10, state.assistActive ? '#e9d48d' : '#b5d4c3');
    rect(W - 167, 16, 153, 97, '#214b4b'); rect(W - 164, 19, 147, 3, '#83bbaa');
    text('BATTERY', W - 155, 37, 10, '#b5d4c3');
    rect(W - 155, 47, 124, 13, '#163c3d');
    rect(W - 153, 49, 120 * clamp(state.battery, 0, 1), 9, state.assistActive ? '#f3cf78' : '#9cc99f');
    text(`${Math.round(state.battery * 100)}%`, W - 155, 79, 13, '#faf1cf');
    for (let i = 0; i < 3; i++) {
      rect(W - 86 + i * 18, 69, 12, 10, i < state.health ? '#efa776' : '#557575');
      if (i < state.health) rect(W - 84 + i * 18, 67, 8, 3, '#efa776');
    }
    text('RIDER', W - 86, 99, 9, '#b5d4c3');
    rect(14, H - 71, 153, 57, '#214b4be8');
    text('DISTANCE', 26, H - 51, 9, '#b5d4c3');
    text(`${(state.distance / 1000).toFixed(2)} KM`, 26, H - 29, 18, '#faf1cf');
    rect(W - 167, H - 71, 153, 57, '#214b4be8');
    text('CLEAN PASSES', W - 155, H - 51, 9, '#b5d4c3');
    text(`${Math.max(1, state.combo)}× COMBO`, W - 155, H - 29, 18, '#faf1cf');
  }
  function drawMessage() {
    if (message && state.elapsed < message.until) {
      ctx.globalAlpha = Math.min(1, (message.until - state.elapsed) * 2);
      rect(W / 2 - 118, 24, 236, 33, '#214b4be8');
      text(message.text, W / 2, 46, 12, '#fff0ba', 'center'); ctx.globalAlpha = 1;
    }
  }
  function draw() {
    if (destroyed || !ctx) return;
    ctx.setTransform(backingRatio, 0, 0, backingRatio, 0, 0); ctx.imageSmoothingEnabled = false;
    sprites.drawStreet(ctx, { width: W, height: H, distance: state.distance * Z_SCALE,
      district: state.stageIndex % DISTRICTS.length, time: state.elapsed, roadLeft: ROAD_LEFT, roadRight: ROAD_RIGHT, laneCount: 4 });
    for (const actor of state.traffic) drawActor(actor);
    const playerX = W / 2 + state.x * X_SCALE;
    if (state.assistActive && !reducedMotion?.matches) {
      for (let i = 0; i < 3; i++) {
        const y = RIDER_Y + 24 + i * 13;
        rect(playerX - 9 + i, y, 3, 8, '#dcdb92'); rect(playerX + 6 - i, y, 3, 8, '#dcdb92');
      }
    }
    sprites.drawRider(ctx, playerX, RIDER_Y, {
      width: BIKE_WIDTH * X_SCALE, height: BIKE_LENGTH * Z_SCALE,
      lean: state.lean || 0,
      pedal: state.elapsed * Math.max(0, state.speed) * 0.25,
      assist: state.assistActive,
      damaged: state.crashCooldown > 0,
    });
    if (state.elapsed < bellPulseUntil) {
      const duration = 0.65, progress = 1 - (bellPulseUntil - state.elapsed) / duration;
      ctx.save(); ctx.strokeStyle = '#f8dc92'; ctx.globalAlpha = 1 - progress; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(playerX, RIDER_Y, 25 + progress * 45, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); ctx.restore();
    }
    aheadMarkers();
    if (!mobile?.matches) hud();
    drawMessage();
  }
  function events() {
    for (const event of state.events || []) {
      if (event.id <= lastEventId) continue;
      lastEventId = event.id;
      if (event.type === 'bell') bellPulseUntil = state.elapsed + 0.65;
      if (['delivery', 'district-clear', 'checkpoint', 'delivery-complete'].includes(event.type))
        message = { text: 'LIVRÉ ! / KEEP RIDING', until: state.elapsed + 1.4 };
      else if (event.type === 'near-pass') message = { text: 'A TIGHT, CLEAN PASS', until: state.elapsed + 0.9 };
      else if (event.type === 'crash') message = { text: 'FIND THE NEXT GAP', until: state.elapsed + 1.2 };
    }
  }
  function frame(time) {
    raf = null;
    if (destroyed || state.phase !== 'playing') return;
    const elapsed = previousFrame === null ? 0 : clamp((time - previousFrame) / 1000, 0, 0.075);
    previousFrame = time; accumulator += elapsed;
    const held = input();
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < 9 && state.phase === 'playing') {
      step(state, held, FIXED_DT); events(); accumulator -= FIXED_DT; steps++;
    }
    if (steps === 9) accumulator = Math.min(accumulator, FIXED_DT);
    if (state.phase !== 'playing') releaseControls();
    publish(); draw(); syncAnimation();
  }
  function syncAnimation() {
    if (destroyed || state.phase !== 'playing') {
      if (raf !== null) cancelAnimationFrame(raf); raf = null;
    } else if (raf === null) raf = requestAnimationFrame(frame);
  }
  function fitViewport() {
    if (destroyed) return;
    const bounds = canvas.getBoundingClientRect();
    const maximum = desktop?.matches ? `${Math.max(300, (window.innerHeight - bounds.top - 16) * W / H)}px` : '';
    if (canvas.style.maxWidth !== maximum) canvas.style.maxWidth = maximum;
    // Match the backing store to the display on layout changes, never in the frame loop.
    const displayWidth = Math.min(bounds.width || W, parseFloat(maximum) || W);
    const nextRatio = clamp(displayWidth / W * Math.min(2, window.devicePixelRatio || 1), 0.45, 2);
    const nextWidth = Math.round(W * nextRatio), nextHeight = Math.round(H * nextRatio);
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth; canvas.height = nextHeight; backingRatio = nextWidth / W;
    }
    draw();
  }
  function togglePause() {
    if (destroyed) return;
    releaseControls();
    if (!pauseState(state)) return;
    previousFrame = null; accumulator = 0; publish(true); draw(); syncAnimation();
  }
  function restart(options = {}) {
    if (destroyed) return;
    releaseControls();
    state = createState({ seed: state.seed, mode: options.mode || state.mode, difficulty: options.difficulty || state.difficulty });
    previousFrame = null; accumulator = 0; lastPublished = -Infinity; lastPhase = null;
    lastEventId = -1; message = null; bellPulseUntil = 0;
    publish(true); draw(); syncAnimation();
  }
  function keydown(event) {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Tab') { releaseControls(); return; }
    const focused = event.target instanceof Element ? event.target.closest('button[data-control]') : null;
    const activation = event.key === ' ' || event.code === 'Space' || event.key === 'Enter';
    const focusedControl = activation && focused && controls.contains(focused) ? focused.dataset.control : null;
    if (isInteractive(event.target) && !focusedControl) return;
    const control = focusedControl || KEY_CONTROLS[event.key] || KEY_CONTROLS[event.code];
    if (!control || state.phase !== 'playing') return;
    const key = event.code || event.key;
    if (event.repeat && !keys.has(key)) return;
    event.preventDefault(); keys.set(key, control); syncButtons();
  }
  function keyup(event) { if (keys.delete(event.code || event.key)) syncButtons(); }
  function pointerdown(event) {
    const button = event.target instanceof Element ? event.target.closest('button[data-control]') : null;
    if (!button || !controls.contains(button) || state.phase !== 'playing' || (event.button !== 0 && event.pointerType !== 'touch')) return;
    event.preventDefault(); pointers.set(event.pointerId, { control: button.dataset.control, button });
    try { button.setPointerCapture(event.pointerId); } catch {}
    syncButtons();
  }
  function pointerend(event) { if (pointers.delete(event.pointerId)) syncButtons(); }
  function chooseMode(event) {
    const button = event.target instanceof Element ? event.target.closest('button[data-mode]') : null;
    if (button && modes.contains(button) && button.dataset.mode !== state.mode) restart({ mode: button.dataset.mode });
  }
  function chooseDifficulty(event) {
    const button = event.target instanceof Element ? event.target.closest('button[data-difficulty]') : null;
    if (button && difficulties.contains(button) && button.dataset.difficulty !== state.difficulty) restart({ difficulty: button.dataset.difficulty });
  }
  const replayRide = () => { restart(); canvas.focus({ preventScroll: true }); };
  const focusCanvas = () => canvas.focus({ preventScroll: true });
  const visibility = () => { if (document.hidden) releaseControls(); };
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
  window.addEventListener('blur', releaseControls); window.addEventListener('resize', fitViewport);
  document.addEventListener('visibilitychange', visibility);
  controls.addEventListener('pointerdown', pointerdown);
  window.addEventListener('pointerup', pointerend); window.addEventListener('pointercancel', pointerend);
  controls.addEventListener('lostpointercapture', pointerend);
  canvas.addEventListener('pointerdown', focusCanvas); replay.addEventListener('click', replayRide);
  modes.addEventListener('click', chooseMode); difficulties.addEventListener('click', chooseDifficulty);
  reducedMotion?.addEventListener('change', draw); desktop?.addEventListener('change', fitViewport);
  mobile?.addEventListener('change', fitViewport);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fitViewport) : null;
  observer?.observe(canvas); observer?.observe(view);
  publish(true); fitViewport(); draw(); syncAnimation();
  return {
    getState: () => JSON.parse(JSON.stringify(state)), restart, togglePause,
    destroy() {
      if (destroyed) return;
      destroyed = true; if (raf !== null) cancelAnimationFrame(raf); raf = null;
      releaseControls(); sprites.clear?.(); observer?.disconnect();
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', releaseControls); window.removeEventListener('resize', fitViewport);
      document.removeEventListener('visibilitychange', visibility);
      controls.removeEventListener('pointerdown', pointerdown);
      window.removeEventListener('pointerup', pointerend); window.removeEventListener('pointercancel', pointerend);
      controls.removeEventListener('lostpointercapture', pointerend);
      canvas.removeEventListener('pointerdown', focusCanvas); replay.removeEventListener('click', replayRide);
      modes.removeEventListener('click', chooseMode); difficulties.removeEventListener('click', chooseDifficulty);
      reducedMotion?.removeEventListener('change', draw); desktop?.removeEventListener('change', fitViewport);
      mobile?.removeEventListener('change', fitViewport);
      view.remove();
    },
  };
}
