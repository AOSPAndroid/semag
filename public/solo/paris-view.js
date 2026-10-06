import {
  FIXED_DT, DISTRICTS, DIFFICULTIES,
  createState, step, togglePause as pauseState, getDistrict, getDifficulty, getSurvivalPace, recordScope,
} from './paris-engine.js';
import { createParisPerspective } from '../art/paris-perspective.js';
import { createParisRenderer } from './paris-renderer.js';

const W = 720, H = 520;
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
function formatAlive(milliseconds) {
  const hundredths = Math.floor(Math.max(0, milliseconds) / 10);
  return `${Math.floor(hundredths / 6000)}:${String(Math.floor(hundredths / 100) % 60).padStart(2, '0')}.${String(hundredths % 100).padStart(2, '0')}`;
}

export function mount(container, { onUpdate = () => {} } = {}) {
  let state = createState({ mode: 'survival', difficulty: 'veteran' });
  const sprites = createParisPerspective();
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
  for (const [id, title] of [['survival', 'Survival'], ['delivery', 'Five deliveries']]) {
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
  canvas.setAttribute('aria-label', 'Forward-facing, 3D-style Paris street. Ride behind the e-bike courier. Arrow keys or W A S D to ride. Space for electric assist; B rings the bell. P pauses.');
  const overlay = node('div', 'paris-overlay'); overlay.hidden = true;
  const overlayEyebrow = node('span', 'paris-overlay-eyebrow');
  const overlayTitle = node('strong', 'paris-overlay-title');
  const overlayDetail = node('span', 'paris-overlay-detail');
  const replay = node('button', 'paris-replay', 'Ride this route again ↗'); replay.type = 'button';
  overlay.append(overlayEyebrow, overlayTitle, overlayDetail, replay);
  const mobileHud = node('div', 'paris-mobile-hud');
  const mobileSpeed = node('strong', ''), mobileBattery = node('strong', ''),
    mobileHealth = node('strong', ''), mobileCombo = node('strong', '');
  const mobileFourthLabel = node('span', '', 'BRAKE');
  for (const [label, value] of [['KM/H', mobileSpeed], ['BATTERY', mobileBattery], ['RIDER', mobileHealth], [mobileFourthLabel, mobileCombo]]) {
    const item = node('div', ''); item.append(typeof label === 'string' ? node('span', '', label) : label, value); mobileHud.append(item);
  }
  board.append(canvas, mobileHud, overlay);
  const footer = node('div', 'paris-footer');
  const controls = node('div', 'paris-controls');
  const brakeMeter = node('span', 'paris-brake-meter'), brakeFill = node('i', '');
  brakeMeter.setAttribute('aria-hidden', 'true'); brakeMeter.append(brakeFill);
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
    if (control === 'brake') button.append(brakeMeter);
    buttons.set(control, button); controls.append(button);
  }
  const hint = node('p', 'paris-hint', '← → steer · ↑ pedal · ↓ brake · Space assist · B bell. Amber arrows show a merge; red stripes warn of a door.');
  const status = node('p', 'paris-status');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
  footer.append(controls, hint, status);
  view.append(choices, stage, board, footer); container.append(view);
  const ctx = canvas.getContext('2d');
  const renderer = createParisRenderer(ctx, { sprites, reducedMotion });
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
    if (state.mode === 'survival') {
      if (state.phase === 'lost') return `Survived ${formatAlive(Math.floor((state.finishTime ?? state.elapsed) * 1000))}. Three impacts ended your ${(state.distance / 1000).toFixed(2)} km ride.`;
      return 'Stay alive as Paris gets faster. Read the signals, use short brake bursts, and leave an escape gap.';
    }
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
    const survival = state.mode === 'survival';
    const elapsedMs = Math.floor(state.elapsed * 1000);
    const pace = Math.round(getSurvivalPace(state) * 3.6);
    const complete = state.phase === 'won';
    const portion = complete ? 100 : clamp(state.stageDistance / district.length * 100, 0, 100);
    setText(location, `${String((state.stageIndex % DISTRICTS.length) + 1).padStart(2, '0')} / ${district.title}`);
    const remaining = Math.max(0, Math.ceil(district.length - state.stageDistance));
    setText(routeDetail, survival ? `PACE ${pace} KM/H · ${remaining} m ahead` : complete ? 'ALL FIVE DELIVERED' : `${remaining} m to ${state.mode === 'delivery' ? 'delivery' : 'next quartier'}`);
    setText(clock, survival ? formatAlive(elapsedMs) : complete ? 'MERCI !' : state.timeLeft === null || state.timeLeft === undefined ? 'NO DEADLINE' : `${Math.max(0, state.timeLeft).toFixed(1)} s`);
    setAttr(clock, 'aria-label', survival ? `Time alive ${formatAlive(elapsedMs)}` : 'Delivery clock');
    setAttr(progress, 'aria-label', survival ? 'Current quartier progress' : 'Current delivery progress');
    stage.dataset.urgent = String(state.timeLeft !== null && state.timeLeft <= 6);
    stage.dataset.mode = state.mode;
    setText(mobileSpeed, String(Math.round(state.speed * 3.6)));
    setText(mobileBattery, `${Math.round(state.battery * 100)}%`);
    setText(mobileHealth, `${state.health}/3`);
    setText(mobileFourthLabel, survival ? 'BRAKE' : 'COMBO');
    setText(mobileCombo, survival ? state.brakeLocked ? 'WAIT' : `${Math.round(state.brakeCharge * 100)}%` : `${Math.max(1, state.combo)}×`);
    brakeMeter.hidden = !survival;
    brakeFill.style.width = `${Math.round(clamp(state.brakeCharge ?? 1, 0, 1) * 100)}%`;
    const brakeButton = buttons.get('brake');
    brakeButton.dataset.recharging = String(survival && state.brakeLocked);
    brakeButton.title = survival ? 'Short brake burst. Release to recharge; braking cannot stop the bike.' : 'Hold to brake.';
    setText(hint, survival
      ? '← → steer · ↑ pedal · Space assist · B bell. Speed rises automatically. ↓ is a short brake burst; release it to recharge.'
      : '← → steer · ↑ pedal · ↓ brake · Space assist · B bell. Amber arrows show a merge; red stripes warn of a door.');
    progressFill.style.width = `${portion}%`;
    setAttr(progress, 'aria-valuenow', String(Math.round(portion)));
    for (const button of modes.children) setAttr(button, 'aria-pressed', String(button.dataset.mode === state.mode));
    for (const button of difficulties.children) setAttr(button, 'aria-pressed', String(button.dataset.difficulty === state.difficulty));
    view.dataset.phase = state.phase; view.dataset.rideDifficulty = state.difficulty; view.dataset.mode = state.mode;
    overlay.hidden = state.phase === 'playing';
    if (!overlay.hidden) {
      setText(overlayEyebrow, state.phase === 'paused' ? 'UN PETIT MOMENT' : survival ? 'PARIS / SURVIVAL' : 'PARIS / FIN DE COURSE');
      setText(overlayTitle, state.phase === 'paused' ? 'Take a breather.' : survival ? `Survived ${formatAlive(Math.floor((state.finishTime ?? state.elapsed) * 1000))}.` : state.phase === 'won' ? 'Livraison réussie.' : 'End of the ride.');
      setText(overlayDetail, state.phase === 'paused' ? 'Press P or Resume when you are ready.' : survival
        ? `THREE IMPACTS · ${(state.distance / 1000).toFixed(2)} KM · ${Math.round(state.speed * 3.6)} KM/H · ${getDifficulty(state).title.toUpperCase()}`
        : `${(state.distance / 1000).toFixed(2)} KM · ${Math.round(state.score)} POINTS · ${getDifficulty(state).title.toUpperCase()}`);
      replay.hidden = state.phase === 'paused';
    }
    // Announce meaningful phase changes only; the fast HUD is deliberately not live.
    setText(status, details());
    onUpdate({ phase: state.phase, result: state.result, score: survival ? elapsedMs : Math.round(state.score),
      record: survival ? state.phase === 'lost' && state.result === 'crashed' && Number.isFinite(state.finishTime)
        ? Math.floor(state.finishTime * 1000) : null
        : state.mode === 'rush' || state.phase === 'won' ? Math.round(state.score) : null,
      recordKey: recordScope(state), recordLabel: survival ? 'LONGEST SURVIVAL' : state.mode === 'delivery' ? 'BEST DELIVERY' : 'BEST RIDE',
      scoreLabel: survival ? 'TIME ALIVE' : 'SCORE', detail: details() });
  }
  function rect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  }
  function text(value, x, y, size, color, align = 'left') {
    ctx.font = `bold ${size}px ui-monospace, monospace`; ctx.fillStyle = color;
    ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(value, x, y);
  }
  function hud() {
    // Keep instruments above the horizon so the rider and close gaps stay clear.
    rect(14, 14, 140, 73, '#214b4be8'); rect(17, 17, 134, 2, '#83bbaa');
    const survival = state.mode === 'survival';
    text(survival ? 'TIME ALIVE' : 'VÉLO ÉLECTRIQUE', 25, 32, 9, '#b5d4c3');
    if (survival) {
      const time = formatAlive(Math.floor(state.elapsed * 1000));
      text(time, 25, 62, Math.min(23, 120 / (time.length * 0.61)), '#faf1cf');
      text(`${Math.round(state.speed * 3.6)} KM/H${state.assistActive ? ' · ASSIST' : ''}`, 25, 77, 9, state.assistActive ? '#e9d48d' : '#b5d4c3');
    } else {
      text(String(Math.round(state.speed * 3.6)).padStart(2, '0'), 25, 63, 29, '#faf1cf');
      text('KM/H', 73, 61, 10, '#b5d4c3');
      text(state.assistActive ? 'ASSIST ON' : 'PACE YOURSELF', 25, 77, 9, state.assistActive ? '#e9d48d' : '#b5d4c3');
    }
    rect(W - 154, 14, 140, 73, '#214b4be8'); rect(W - 151, 17, 134, 2, '#83bbaa');
    text('BATTERY', W - 143, 32, 9, '#b5d4c3');
    text(`${Math.round(state.battery * 100)}%`, W - 25, 32, 10, '#faf1cf', 'right');
    rect(W - 143, 41, 118, 11, '#163c3d');
    rect(W - 141, 43, 114 * clamp(state.battery, 0, 1), 7, state.assistActive ? '#f3cf78' : '#9cc99f');
    text('RIDER', W - 143, 74, 9, '#b5d4c3');
    for (let i = 0; i < 3; i++) {
      rect(W - 82 + i * 18, 63, 12, 10, i < state.health ? '#efa776' : '#557575');
      if (i < state.health) rect(W - 80 + i * 18, 61, 8, 3, '#efa776');
    }
    rect(W / 2 - 78, 14, 156, 57, '#214b4be8');
    text(`${(state.distance / 1000).toFixed(2)} KM`, W / 2, 40, 18, '#faf1cf', 'center');
    text(survival ? `PACE ${Math.round(getSurvivalPace(state) * 3.6)} KM/H` : `${Math.max(1, state.combo)}× CLEAN COMBO`, W / 2, 58, 9, '#b5d4c3', 'center');
  }
  function drawMessage() {
    if (message && state.elapsed < message.until) {
      ctx.globalAlpha = Math.min(1, (message.until - state.elapsed) * 2);
      rect(W / 2 - 118, 94, 236, 29, '#214b4be8');
      text(message.text, W / 2, 114, 11, '#fff0ba', 'center'); ctx.globalAlpha = 1;
    }
  }
  function draw() {
    if (destroyed || !ctx) return;
    ctx.setTransform(backingRatio, 0, 0, backingRatio, 0, 0);
    ctx.imageSmoothingEnabled = false;
    renderer.draw(state, { bellPulseUntil });
    if (!mobile?.matches) hud();
    drawMessage();
  }
  function events() {
    for (const event of state.events || []) {
      if (event.id <= lastEventId) continue;
      lastEventId = event.id;
      if (event.type === 'bell') bellPulseUntil = state.elapsed + 0.65;
      if (state.mode === 'survival' && ['district', 'delivery', 'checkpoint'].includes(event.type))
        message = { text: `NEXT QUARTIER${event.district ? ` / ${event.district.toUpperCase()}` : ''}`, until: state.elapsed + 1.4 };
      else if (state.mode === 'survival' && event.type === 'pace')
        message = { text: 'FASTER STREETS / STAY SHARP', until: state.elapsed + 1.2 };
      else if (['delivery', 'district-clear', 'checkpoint', 'delivery-complete'].includes(event.type))
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
      releaseControls(); renderer.clear(); sprites.clear?.(); observer?.disconnect();
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
