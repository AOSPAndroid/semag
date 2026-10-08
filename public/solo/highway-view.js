import { createRenderSampling } from './render-sampling.js';
import { tickFraction } from '../display-timing.js';
import {
  createState,
  step,
  togglePause as pauseState,
  CAR_WIDTH,
  DISTRICTS,
  DISTRICT_LENGTH,
  getDistrict,
  recordScope,
  DIFFICULTIES,
  getDifficulty,
  usesEndlessPace,
} from './highway-engine.js';
import { createDrivingSprites } from '../art/driving-sprites.js';
import { gameKey, getKeyboardLayout, displayKey, subscribeKeyboardLayout } from '../keyboard-layout.js';

const W = 720;
const H = 520;
const HORIZON = 178;
const ROAD_HALF = 268;
const CAR_Y = 474;
const COLORS = { cream: '#f8edcf', orange: '#f0a160', mint: '#77dfc9', ink: '#132c32' };
/** Road depth remains nonnegative; passing car bodies use a bounded near plane. */
export function highwayDepthScale(z, passingBody = false) {
  return 16 / ((passingBody ? Math.max(-8, z) : Math.max(0, z)) + 16);
}
export function isHighwayTrafficVisible(traffic, state) {
  const rearClearance = (state.car.length + traffic.length) / 2;
  const reach = usesEndlessPace(state) ? state.lookAheadDistance : 220;
  return traffic.z >= -rearClearance && traffic.z <= reach;
}
/** Extra distant road bands use screen scanlines, never an unbounded metre loop. */
export function getDistantRoadDepths(reach, out = []) {
  out.length = 0;
  if (!Number.isFinite(reach) || reach <= 400) return out;
  out.push(reach);
  const farY = HORIZON + (CAR_Y - HORIZON) * 16 / (reach + 16);
  const nearY = HORIZON + (CAR_Y - HORIZON) * 16 / 416;
  for (let y = Math.max(HORIZON + 1, Math.ceil(farY)); y < nearY; y++) {
    const z = 16 * (CAR_Y - HORIZON) / (y - HORIZON) - 16;
    if (z < reach && z > 400) out.push(z);
  }
  out.push(400);
  return out;
}

const KEY_CONTROLS = {
  ArrowLeft: 'left',
  a: 'left',
  A: 'left',
  ArrowRight: 'right',
  d: 'right',
  D: 'right',
  ArrowUp: 'throttle',
  w: 'throttle',
  W: 'throttle',
  ArrowDown: 'brake',
  s: 'brake',
  S: 'brake',
  ' ': 'boost',
  Space: 'boost',
};
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;
const isForm = (target) =>
  target instanceof Element &&
  Boolean(target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'));
function setValue(target, key, value) {
  if (target[key] !== value) target[key] = value;
}
function setAttribute(target, key, value) {
  if (target.getAttribute(key) !== value) target.setAttribute(key, value);
}
function node(tag, className, text) {
  const result = document.createElement(tag);
  result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

export function mount(container, { onUpdate = () => {} } = {}) {
  const presentation = createRenderSampling({ fields: ['x', 'distance', 'curve', 'elapsed'], limits: { x: 1.5, distance: 10 }, collections: { traffic: { fields: ['x', 'z'], limits: { x: 1.5, z: 10 } }, pickups: { fields: ['x', 'z'], limits: { z: 10 } } }, continuity: s => s.districtIndex });
  let displayState;
  let state = createState({ difficulty: 'veteran' });
  const sprites = createDrivingSprites();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const desktopLayout = window.matchMedia?.('(min-width: 951px) and (pointer: fine)');
  let destroyed = false;
  let raf = null;
  let previousFrame = null;
  let accumulator = 0;
  let lastPublished = -Infinity;
  let lastPhase = null;
  let lastEventId = -1;
  let message = null;
  let particles = [];
  let exhaustTime = 0;
  const keys = new Map();
  const touches = new Map();
  const view = node('section', 'highway-view');
  view.setAttribute('aria-label', 'Night Drive highway game');
  const topline = node('div', 'highway-topline');
  const location = node('span', 'highway-location', 'NEON CITY / ENDLESS');
  topline.append(node('span', '', 'NIGHT DRIVE'), location);
  const modeChoices = node('div', 'highway-modes');
  modeChoices.setAttribute('role', 'group');
  modeChoices.setAttribute('aria-label', 'Choose drive mode');
  for (const [mode, label] of [
    ['endless', 'Endless shift'],
    ['tour', 'Five-district tour'],
  ]) {
    const button = node('button', 'highway-mode', label);
    button.type = 'button';
    button.dataset.mode = mode;
    modeChoices.append(button);
  }
  const difficultyChoices = node('div', 'highway-difficulties');
  difficultyChoices.setAttribute('role', 'group');
  difficultyChoices.setAttribute('aria-label', 'Choose difficulty');
  for (const difficulty of DIFFICULTIES) {
    const button = node(
      'button',
      'highway-difficulty',
      difficulty.id === 'standard' ? 'Standard · practice' : difficulty.title,
    );
    button.type = 'button';
    button.dataset.difficulty = difficulty.id;
    difficultyChoices.append(button);
  }
  const stagePanel = node('div', 'highway-stage');
  const stageLabel = node('span', 'highway-stage-label'),
    stageTitle = node('strong', 'highway-stage-title'),
    stageGoal = node('span', 'highway-stage-goal');
  const progress = node('div', 'highway-progress'),
    progressFill = node('i', '');
  progress.append(progressFill);
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', '900');
  const stageDescription = node('p', 'highway-stage-description');
  const delivery = node('div', 'highway-delivery');
  const deliveryClock = node('strong', 'highway-delivery-clock');
  const deliveryRules = node('span', 'highway-delivery-rules');
  delivery.append(deliveryClock, deliveryRules);
  stagePanel.append(stageLabel, stageTitle, stageGoal, progress, stageDescription, delivery);
  const board = node('div', 'highway-board');
  const canvas = node('canvas', 'highway-canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.tabIndex = 0;
  canvas.dataset.soloFocus = '';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    'Night highway. Arrow keys or W A S D to drive, Space to boost, Escape to pause.',
  );
  const overlay = node('div', 'highway-overlay');
  overlay.hidden = true;
  const overlayEyebrow = node('span', 'highway-overlay-eyebrow');
  const overlayTitle = node('strong', 'highway-overlay-title');
  const overlayDetail = node('span', 'highway-overlay-detail');
  const replay = node('button', 'highway-replay', 'Drive again ↗');
  replay.type = 'button';
  overlay.append(overlayEyebrow, overlayTitle, overlayDetail, replay);
  board.append(canvas, overlay);
  const footer = node('div', 'highway-footer');
  const description = node('div', 'highway-description');
  const status = node('p', 'highway-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const hint = node(
    'p',
    'highway-hint',
    'A / D or ← / → steer · W accelerates · S brakes · Space boosts. Skim past traffic to build a combo.',
  );
  description.append(status, hint);
  const controls = node('div', 'highway-controls');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Hold to drive');
  const buttons = new Map();
  for (const [control, symbol, label] of [
    ['left', '←', 'Steer left'],
    ['right', '→', 'Steer right'],
    ['brake', '↓', 'Brake'],
    ['throttle', '↑', 'Accelerate'],
    ['boost', '↗', 'Boost'],
  ]) {
    const button = node('button', `highway-control highway-control-${control}`);
    button.type = 'button';
    button.dataset.control = control;
    button.setAttribute('aria-label', `Hold to ${label.toLowerCase()}`);
    button.setAttribute('aria-pressed', 'false');
    button.append(
      node('b', '', symbol),
      node('span', '', control === 'throttle' ? 'GAS' : label.toUpperCase().replace('STEER ', '')),
    );
    buttons.set(control, button);
    controls.append(button);
  }
  footer.append(description, controls);
  view.append(topline, modeChoices, difficultyChoices, stagePanel, board, footer);
  container.append(view);
  const ctx = canvas.getContext('2d');
  const skylines = new Map(
    DISTRICTS.map((district) => {
      const image = new Image();
      image.onload = () => {
        if (!destroyed) draw();
      };
      image.src = `/art/night-${district.id}.svg`;
      return [district.id, image];
    }),
  );

  function input() {
    const result = { left: false, right: false, throttle: false, brake: false, boost: false };
    for (const control of keys.values()) result[control] = true;
    for (const control of touches.values()) result[control] = true;
    return result;
  }
  function syncButtons() {
    const held = input();
    for (const [control, button] of buttons) {
      button.dataset.held = String(held[control]);
      button.setAttribute('aria-pressed', String(held[control]));
    }
  }
  function releaseControls() {
    keys.clear();
    touches.clear();
    for (const button of buttons.values()) {
      // Releasing capture is optional: clearing the pointer map immediately
      // prevents a held accelerator surviving a pause, tab change, or restart.
      button.dataset.held = 'false';
      button.setAttribute('aria-pressed', 'false');
    }
  }
  function details() {
    if (state.result === 'delivery-missed')
      return 'Delivery missed. Carry more speed, read the next gap early, and save boost for recovery. Standard practice has no deadline.';
    if (state.phase === 'paused') return 'Cruise paused. Resume when you are ready.';
    if (state.phase === 'won')
      return `Five districts complete in ${state.finishTime.toFixed(1)}s. ${state.totalCrashes === 0 ? 'A flawless tour.' : 'Your car made it through.'} ${state.score} points.`;
    if (state.districtWarning) {
      const next = DISTRICTS.find((d) => d.id === state.districtWarning);
      return `${next.title} ahead: ${next.description}`;
    }
    if (state.phase === 'lost')
      return `${(state.distance / 1000).toFixed(2)} km on the night shift. Take another lap.`;
    if (state.shoulder) return usesEndlessPace(state)
      ? `Return to the road: ${(1.4 - state.shoulderExposure).toFixed(1)}s of shoulder grace left before damage.`
      : 'Ease back onto the road. The shoulder slows you down.';
    if (state.crashCooldown > 0) return 'A close call. Find a gap while your car recovers.';
    return usesEndlessPace(state)
      ? 'Speed rises with every active second. Read the next gap and release short brake bursts to recharge.'
      : 'Stay smooth. Clean overtakes score points; near misses build your combo.';
  }
  function publish(force = false) {
    if (!force && state.elapsed - lastPublished < 0.1 && state.phase === lastPhase) return;
    lastPublished = state.elapsed;
    lastPhase = state.phase;
    const detail = details(),
      district = getDistrict(state),
      difficulty = getDifficulty(state),
      paced = usesEndlessPace(state);
    setValue(
      location,
      'textContent',
      `${district.title.toUpperCase()} / ${state.mode === 'tour' ? 'TOUR' : 'ENDLESS'}`,
    );
    for (const button of modeChoices.children)
      setAttribute(button, 'aria-pressed', String(button.dataset.mode === state.mode));
    for (const button of difficultyChoices.children)
      setAttribute(button, 'aria-pressed', String(button.dataset.difficulty === state.difficulty));
    setValue(view.dataset, 'driveDifficulty', state.difficulty);
    setValue(delivery, 'hidden', !state.delivery);
    if (state.delivery) {
      setValue(deliveryClock, 'textContent', `${state.delivery.remaining.toFixed(1)}s LEFT`);
      setValue(
        deliveryRules,
        'textContent',
        paced
          ? `${difficulty.title} · PACE ${Math.round(state.endlessPace)} KM/H · BRAKE ${state.brakeLocked ? 'RELEASE TO CHARGE' : `${Math.round(state.brakeCharge * 100)}%`} · speed rises with active time · shoulders damage after 1.4s`
          : `${difficulty.title} · ${state.delivery.limit.toFixed(1)}s / district · no repairs · fast near misses add time`,
      );
      setValue(delivery.dataset, 'urgent', String(state.delivery.remaining <= 4));
    }
    setValue(hint, 'textContent', paced
      ? `${displayKey('A / D')} or ← / → steer · ${displayKey('W')} adds speed · S is a short brake burst; release it to recharge · Space boosts. Pace keeps rising. Shoulder grace: 1.4s.`
      : `${displayKey('A / D')} or ← / → steer · ${displayKey('W')} accelerates · S brakes · Space boosts. Skim past traffic to build a combo.`);
    setValue(buttons.get('brake'), 'title', paced ? 'Short brake burst. Release to recharge; holding brake cannot stop the pace.' : 'Hold to brake.');
    setAttribute(buttons.get('brake'), 'data-recharging', String(paced && state.brakeLocked));
    setValue(stageLabel, 'textContent', `DISTRICT ${(state.districtIndex % DISTRICTS.length) + 1} / 5`);
    setValue(stageTitle, 'textContent', district.title);
    setValue(
      stageGoal,
      'textContent',
      state.phase === 'won'
        ? '4.5 KM TOUR COMPLETE'
        : `${Math.ceil(DISTRICT_LENGTH - state.districtProgress)}m to checkpoint`,
    );
    setValue(
      stageDescription,
      'textContent',
      state.districtWarning
        ? `Ahead: ${DISTRICTS.find((d) => d.id === state.districtWarning).description}`
        : district.description,
    );
    setValue(stagePanel.dataset, 'warning', String(Boolean(state.districtWarning)));
    setValue(
      progressFill.style,
      'width',
      `${state.phase === 'won' ? 100 : (state.districtProgress / DISTRICT_LENGTH) * 100}%`,
    );
    setAttribute(progress, 'aria-valuenow', String(Math.round(state.districtProgress)));
    if (status.textContent !== detail) setValue(status, 'textContent', detail);
    setValue(view.dataset, 'phase', state.phase);
    setValue(view.dataset, 'speed', String(Math.round(state.speed)));
    setValue(overlay, 'hidden', state.phase === 'playing');
    if (!overlay.hidden) {
      setValue(
        overlayEyebrow,
        'textContent',
        state.phase === 'paused' ? 'PULL OVER FOR A MOMENT' : 'THE NIGHT IS YOURS',
      );
      setValue(
        overlayTitle,
        'textContent',
        state.phase === 'paused'
          ? 'Take a breather.'
          : state.phase === 'won'
            ? 'Tour complete.'
            : state.result === 'delivery-missed'
              ? 'Delivery missed.'
              : 'End of the road.',
      );
      setValue(
        overlayDetail,
        'textContent',
        state.phase === 'paused'
          ? 'Press Escape or Resume to keep driving.'
          : `${(state.distance / 1000).toFixed(2)} KM  ·  ${state.score} POINTS`,
      );
      setValue(replay, 'hidden', state.phase === 'paused');
    }
    onUpdate({
      phase: state.phase,
      score: state.score,
      record:
        state.mode === 'tour' && state.difficulty !== 'standard' && state.phase !== 'won'
          ? null
          : state.score,
      recordKey: recordScope(state),
      recordLabel: state.mode === 'tour' ? 'BEST TOUR' : 'BEST SCORE',
      scoreLabel: 'SCORE',
      detail,
    });
  }

  function projection(z, passingBody = false) {
    const p = highwayDepthScale(z, passingBody);
    return {
      p,
      x: W / 2 + displayState.curve * (1 - p) ** 2 * 142,
      y: HORIZON + (CAR_Y - HORIZON) * p,
      half: ROAD_HALF * p,
    };
  }
  function rect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.round(x),
      Math.round(y),
      Math.max(1, Math.round(width)),
      Math.max(1, Math.round(height)),
    );
  }
  function polygon(points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], index) =>
      index ? ctx.lineTo(Math.round(x), Math.round(y)) : ctx.moveTo(Math.round(x), Math.round(y)),
    );
    ctx.closePath();
    ctx.fill();
  }
  function roadStrip(a, b, left, right, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(Math.round(a.x + a.half * left), Math.round(a.y));
    ctx.lineTo(Math.round(a.x + a.half * right), Math.round(a.y));
    ctx.lineTo(Math.round(b.x + b.half * right), Math.round(b.y));
    ctx.lineTo(Math.round(b.x + b.half * left), Math.round(b.y));
    ctx.closePath();
    ctx.fill();
  }
  function sky() {
    const district = getDistrict(displayState);
    const skyline = skylines.get(district.id);
    if (skyline?.complete && skyline.naturalWidth) {
      rect(0, 0, W, HORIZON, district.sky);
      ctx.drawImage(skyline, -8 - displayState.x * 4, 0, W + 16, HORIZON);
      return;
    }
    rect(0, 0, W, HORIZON, district.sky);
    rect(0, 78, W, 44, '#1a333c');
    rect(0, 122, W, 34, '#234249');
    rect(0, 156, W, 24, '#30565a');
    for (let i = 0; i < 48; i += 1) {
      const x = mod(i * 137 + 43, W);
      const y = mod(i * 71 + 23, 130) + 8;
      rect(x, y, i % 9 ? 2 : 3, 2, i % 3 ? '#659895' : '#cfddba');
    }
    const mx = 480 - displayState.x * 5;
    rect(mx + 12, 35, 28, 6, '#f2dcab');
    rect(mx + 6, 41, 40, 6, '#f2dcab');
    rect(mx, 47, 52, 28, '#f2dcab');
    rect(mx + 6, 75, 40, 6, '#f2dcab');
    rect(mx + 12, 81, 28, 6, '#f2dcab');
    rect(mx + 29, 44, 13, 10, '#dac898');
    rect(mx + 9, 66, 10, 8, '#dac898');
    if (district.id === 'coast') {
      polygon(
        [
          [0, 130],
          [120, 94],
          [260, 116],
          [400, 77],
          [540, 123],
          [720, 89],
          [720, HORIZON],
          [0, HORIZON],
        ],
        '#3e677d',
      );
      rect(0, HORIZON - 24, W, 24, '#4b8492');
      for (let i = 0; i < 18; i += 1) rect(i * 45 + 9, HORIZON - 14 + (i % 3) * 3, 23, 2, '#78afb7');
      return;
    }
    if (district.id === 'works') {
      for (let i = 0; i < 7; i += 1) {
        rect(i * 115 - 12, 130 - (i % 2) * 25, 90, 50, '#4f4554');
        rect(i * 115 + 20, 62, 15, 90, '#675763');
        rect(i * 115 + 25, 58, 19, 8, '#8b7a78');
      }
      rect(120, 63, 260, 7, '#aa997e');
      rect(189, 63, 7, 99, '#aa997e');
      rect(376, 63, 3, 48, '#b19b75');
      return;
    }
    if (district.id === 'summit') {
      polygon(
        [
          [0, HORIZON],
          [110, 68],
          [225, 131],
          [365, 42],
          [500, 136],
          [623, 73],
          [720, HORIZON],
        ],
        '#5e647e',
      );
      polygon(
        [
          [326, 72],
          [365, 42],
          [401, 74],
          [375, 68],
          [367, 82],
          [354, 63],
        ],
        '#c8d7d0',
      );
      polygon(
        [
          [0, HORIZON],
          [80, 120],
          [190, 165],
          [300, 117],
          [475, 161],
          [600, 128],
          [720, HORIZON],
        ],
        '#354d61',
      );
      return;
    }
    if (district.id === 'storm') {
      for (let i = 0; i < 12; i += 1) {
        rect(i * 68 - 9, 30 + (i % 3) * 13, 93, 25, '#425468');
        rect(i * 68 + 14, 21 + (i % 3) * 13, 58, 13, '#425468');
      }
    }
    // Stable, hand-sized windows keep the city pixelated without flicker.
    for (let layer = 0; layer < 2; layer += 1) {
      for (let i = -1; i < 19; i += 1) {
        const bw = 32 + mod(i * 13 + 70, 25);
        const height = 25 + mod(i * 31 + 130 + layer * 19, layer ? 83 : 57);
        const x = i * 43 - displayState.x * (layer ? 10 : 4);
        const y = HORIZON - height;
        rect(x, y, bw, height, layer ? '#15343a' : '#24494b');
        if (i % 4 === 0) rect(x + bw * 0.5, y - 10, 2, 10, '#386465');
        if (layer) {
          for (let wy = y + 10; wy < HORIZON - 4; wy += 12) {
            for (let wx = x + 7; wx < x + bw - 6; wx += 10) {
              if (mod(Math.round(wx + wy * 3), 5) < 2)
                rect(wx, wy, 3, 5, mod(Math.round(wx), 3) ? '#549884' : '#bd9c63');
            }
          }
        }
      }
    }
    rect(0, HORIZON - 2, W, 5, '#67a28d');
  }
  const distantRoadDepths = [];
  function roadSlice(z, far, near) {
    if (Math.round(far.y) === Math.round(near.y)) return;
    const world = z + displayState.distance;
    roadStrip(far, near, -1.1, 1.1, mod(Math.floor(world / 5), 2) ? '#365750' : '#3b5d54');
    roadStrip(far, near, -1, 1, mod(Math.floor(world / 12), 2) ? '#33494c' : '#354b4e');
    const curb = mod(world, 8) < 4 ? '#d1c394' : '#487367';
    roadStrip(far, near, -1.07, -1.02, curb);
    roadStrip(far, near, 1.02, 1.07, curb);
    roadStrip(far, near, -0.985, -0.976, '#8ba498');
    roadStrip(far, near, 0.976, 0.985, '#8ba498');
    if (mod(world, 12) < 5.5) {
      roadStrip(far, near, -0.337, -0.323, '#bfcbb8');
      roadStrip(far, near, 0.323, 0.337, '#bfcbb8');
    }
  }
  function road() {
    rect(0, HORIZON + 3, W, H - HORIZON, getDistrict(displayState).ground);
    polygon(
      [
        [W / 2 + displayState.curve * 142, HORIZON + (usesEndlessPace(displayState) ? 0 : 3)],
        [W / 2 + ROAD_HALF, CAR_Y],
        [W / 2 - ROAD_HALF, CAR_Y],
      ],
      '#33494c',
    );
    // The close road continues below the car; traffic z=0 lines up with its rear.
    const nearest = projection(0);
    polygon(
      [
        [nearest.x - nearest.half, nearest.y],
        [nearest.x + nearest.half, nearest.y],
        [W / 2 + ROAD_HALF * 1.16, H],
        [W / 2 - ROAD_HALF * 1.16, H],
      ],
      '#33484b',
    );
    roadStrip(nearest, { x: W / 2, y: H, half: ROAD_HALF * 1.16 }, -1.075, -1, '#597068');
    roadStrip(nearest, { x: W / 2, y: H, half: ROAD_HALF * 1.16 }, 1, 1.075, '#597068');
    if (usesEndlessPace(displayState)) {
      getDistantRoadDepths(displayState.lookAheadDistance, distantRoadDepths);
      for (let i = 0; i < distantRoadDepths.length - 1; i++) {
        const z = distantRoadDepths[i];
        roadSlice(z, projection(z), projection(distantRoadDepths[i + 1]));
      }
    }
    // Nearby road retains its 2m detail. At most twelve coarse screen bands
    // bridge its 400m edge to the same far reach used by visible traffic.
    for (let z = 400; z > 0; z -= 2)
      roadSlice(z, projection(z), projection(Math.max(0, z - 2)));
    // A few close lane lines continue beneath the bumper.
    const close = { x: W / 2, y: H, half: ROAD_HALF * 1.16 };
    if (mod(displayState.distance, 12) < 5.5) {
      roadStrip(nearest, close, -0.337, -0.323, '#bfcbb8');
      roadStrip(nearest, close, 0.323, 0.337, '#bfcbb8');
    }
    const wet = getDistrict(displayState).weather === 'rain';
    for (let i = 0; i < 22; i++) {
      const z = mod(i * 13 - displayState.distance, 230) + 2,
        p = projection(z);
      const lane = mod(i * 17, 9) / 5 - 0.8;
      rect(
        p.x + p.half * lane,
        p.y,
        Math.max(1, p.p * 12),
        Math.max(1, p.p * 1.5),
        wet ? '#aac6ca25' : '#9fbbad13',
      );
    }
    const playerX = W / 2 + displayState.x * ROAD_HALF,
      beamEnd = projection(27);
    polygon(
      [
        [playerX - 36, CAR_Y - 86],
        [playerX - 15, CAR_Y - 86],
        [beamEnd.x + displayState.x * beamEnd.half + 48, beamEnd.y],
        [beamEnd.x + displayState.x * beamEnd.half - 63, beamEnd.y],
      ],
      wet ? '#c8e1c218' : '#c8e1c210',
    );
    polygon(
      [
        [playerX + 15, CAR_Y - 86],
        [playerX + 36, CAR_Y - 86],
        [beamEnd.x + displayState.x * beamEnd.half + 63, beamEnd.y],
        [beamEnd.x + displayState.x * beamEnd.half - 48, beamEnd.y],
      ],
      wet ? '#c8e1c218' : '#c8e1c210',
    );
  }
  function lamp(z, side) {
    const point = projection(z);
    const x = point.x + side * point.half * 1.29;
    const height = 175 * point.p;
    const top = point.y - height;
    rect(x, top, Math.max(1, 5 * point.p), height, '#49746b');
    rect(x - side * 29 * point.p, top, 32 * point.p, Math.max(1, 4 * point.p), '#73aa96');
    rect(x - side * 29 * point.p, top + 4 * point.p, 14 * point.p, Math.max(2, 5 * point.p), '#c5efc4');
    ctx.globalAlpha = 0.09;
    polygon(
      [
        [x - side * 23 * point.p, top],
        [x - 32 * point.p, point.y],
        [x + 35 * point.p, point.y],
      ],
      '#bceac0',
    );
    ctx.globalAlpha = 1;
  }
  function car(x, y, width, color, player = false) {
    const height = width * 1.17;
    const top = y - height * (73 / 76);
    rect(x - width * 0.48, y - height * 0.09, width * 0.96, height * 0.13, '#10263066');
    if (getDistrict(displayState).weather === 'rain') {
      rect(x - width * 0.32, y + width * 0.05, width * 0.16, width * 0.05, '#d89c7744');
      rect(x + width * 0.16, y + width * 0.05, width * 0.16, width * 0.05, '#d89c7744');
    }
    ctx.drawImage(sprites.rearCar(color, player), x - width / 2, top, width, height);
    if (player && (usesEndlessPace(displayState) ? displayState.brakeActive : input().brake)) {
      rect(x - width * (23 / 64), top + height * (53 / 76), width * (11 / 64), height * (3 / 76), '#ffd4a7');
      rect(x + width * (12 / 64), top + height * (53 / 76), width * (11 / 64), height * (3 / 76), '#ffd4a7');
    }
  }
  function hud() {
    ctx.globalAlpha = 0.83;
    rect(18, 18, 149, 61, '#142e33');
    rect(W - 161, 18, 143, 61, '#142e33');
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 28px ui-monospace, monospace';
    ctx.fillStyle = COLORS.cream;
    ctx.fillText(String(Math.round(displayState.speed)).padStart(3, '0'), 30, 54);
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.fillStyle = '#8fc2ad';
    ctx.fillText('KM/H', 102, 52);
    ctx.fillText(usesEndlessPace(displayState) ? `PACE ${Math.round(displayState.endlessPace)} KM/H` : 'NIGHT SHIFT', 30, 68);
    ctx.fillText('DISTANCE', W - 149, 36);
    ctx.font = 'bold 21px ui-monospace, monospace';
    ctx.fillStyle = COLORS.cream;
    ctx.fillText(`${(displayState.distance / 1000).toFixed(2)} KM`, W - 149, 62);
    if (displayState.delivery) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 17px ui-monospace, monospace';
      ctx.fillStyle = displayState.delivery.remaining <= 4 ? '#ffd09a' : '#d4e9bc';
      ctx.fillText(`${displayState.delivery.remaining.toFixed(1)}s`, W / 2, 54);
      ctx.font = 'bold 9px ui-monospace, monospace';
      ctx.fillText('DELIVERY CLOCK', W / 2, 69);
      ctx.textAlign = 'left';
    }
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.fillStyle = '#b2c7ad';
    ctx.fillText('BODY', 22, H - 38);
    for (let i = 0; i < 3; i += 1) {
      rect(22 + i * 25, H - 27, 19, 9, i < displayState.health ? COLORS.orange : '#506465');
      if (i < displayState.health) rect(24 + i * 25, H - 25, 15, 2, '#ffd9a0');
    }
    const bx = W - 207;
    ctx.fillStyle = displayState.boosting ? '#b6f5db' : '#9ec0b0';
    ctx.fillText(displayState.boosting ? 'BOOST ACTIVE' : 'BOOST · SPACE', bx, H - 38);
    rect(bx, H - 27, 185, 9, '#294b4a');
    rect(bx + 1, H - 26, 183 * clamp(displayState.boost, 0, 1), 7, displayState.boosting ? '#c5f6c9' : '#78bba2');
    if (usesEndlessPace(displayState)) {
      ctx.textAlign = 'center';
      ctx.fillStyle = displayState.shoulder ? '#ffd09a' : '#b2c7ad';
      ctx.fillText(displayState.shoulder ? 'RETURN TO ROAD' : displayState.brakeLocked ? 'BRAKE · RELEASE' : 'BRAKE BURST', W / 2, H - 38);
      rect(W / 2 - 45, H - 27, 90, 9, '#294b4a');
      rect(W / 2 - 44, H - 26, 88 * clamp(displayState.brakeCharge, 0, 1), 7, displayState.brakeActive ? '#ffd09a' : '#78bba2');
      ctx.textAlign = 'left';
    }
    if (displayState.combo > 1) {
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.cream;
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillText(`${displayState.combo}× CLEAN STREAK`, W / 2, 29);
    }
    if (message && displayState.elapsed < message.until) {
      const fade = clamp((message.until - displayState.elapsed) * 2, 0, 1);
      ctx.globalAlpha = fade;
      ctx.textAlign = 'center';
      ctx.font = 'bold 19px ui-monospace, monospace';
      ctx.fillStyle = message.color;
      ctx.fillText(message.text, W / 2, HORIZON + 49);
      ctx.globalAlpha = 1;
    }
  }
  function draw(fraction = 1) {
    displayState = presentation.sample(state, fraction);
    if (destroyed || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    sky();
    road();
    const scenery = [];
    const offset = mod(displayState.distance, 25);
    for (let z = 300 - offset; z > 1; z -= 25) {
      scenery.push({
        z,
        draw: () => {
          if (Math.floor((z + displayState.distance) / 25) % 2 === 0) {
            for (const side of [-1, 1]) {
              const p = projection(z),
                art = sprites.roadside(getDistrict(displayState).id, side, Math.floor((z + displayState.distance) / 50));
              const width = 96 * p.p,
                height = 160 * p.p,
                x = p.x + side * p.half * 1.6;
              ctx.drawImage(art, x - width / 2, p.y - height * (154 / 160), width, height);
            }
          }
          // Lamps stand nearer the road than the building foundation.
          lamp(z, -1);
          lamp(z, 1);
        },
      });
    }
    for (const traffic of displayState.traffic) {
      if (!isHighwayTrafficVisible(traffic, displayState)) continue;
      scenery.push({
        z: traffic.z - traffic.length / 2,
        draw: () => {
          const rear = projection(traffic.z - traffic.length / 2, true);
          const front = projection(traffic.z + traffic.length / 2, true);
          const halfWidth = traffic.width / 2;
          const leftRear = rear.x + (traffic.x - halfWidth) * rear.half;
          const rightRear = rear.x + (traffic.x + halfWidth) * rear.half;
          const leftFront = front.x + (traffic.x - halfWidth) * front.half;
          const rightFront = front.x + (traffic.x + halfWidth) * front.half;
          // Ground contact shows the full physical width/length, while the
          // detailed pixel body stays anchored to its actual rear tire contact.
          polygon([[leftRear, rear.y], [leftFront, front.y],
            [rightFront, front.y], [rightRear, rear.y]], '#102c3040');
          const p = rear;
          const x = p.x + traffic.x * p.half,
            width = traffic.width * p.half;
          if (traffic.kind === 'barrier') {
            rect(x - width / 2, p.y - width * 0.42, width, width * 0.26, '#d8ad67');
            for (let i = 0; i < 5; i += 1)
              rect(x - width / 2 + (i * width) / 5, p.y - width * 0.42, width / 10, width * 0.26, '#493d3f');
            rect(x - width * 0.37, p.y - width * 0.16, width * 0.1, width * 0.18, '#cbc8b2');
            rect(x + width * 0.27, p.y - width * 0.16, width * 0.1, width * 0.18, '#cbc8b2');
            rect(x - width * 0.45, p.y - width * 0.44, width * 0.9, Math.max(1, width * 0.035), '#efd6a1');
            rect(x - width * 0.05, p.y - width * 0.55, width * 0.1, width * 0.09, '#ffe09a');
          } else {
            const color = traffic.crashed ? '#819084' : traffic.color;
            car(x, p.y, width, color);
          }
          if (traffic.signal) {
            ctx.textAlign = 'center';
            ctx.font = `bold ${Math.max(9, Math.round(18 * p.p))}px monospace`;
            ctx.fillStyle = '#ffe09d';
            ctx.fillText(traffic.targetLane > traffic.lane ? '→' : '←', x, p.y - width * 1.7);
          }
        },
      });
    }
    for (const pickup of displayState.pickups) {
      if (pickup.z < 0 || pickup.z > (usesEndlessPace(displayState) ? displayState.lookAheadDistance : 220)) continue;
      scenery.push({
        z: pickup.z,
        draw: () => {
          const p = projection(pickup.z),
            x = p.x + pickup.x * p.half,
            size = Math.max(3, p.p * 22);
          rect(x - size / 2, p.y - size, size, size, '#a4e6bc');
          rect(x - size * 0.35, p.y - size * 0.88, size * 0.7, size * 0.68, '#295b57');
          rect(x - size * 0.12, p.y - size * 0.78, size * 0.24, size * 0.47, '#cfe9ad');
          rect(x - size * 0.32, p.y - size * 0.18, size * 0.64, Math.max(1, size * 0.08), '#e5edbc');
        },
      });
    }
    scenery.sort((a, b) => b.z - a.z).forEach((item) => item.draw());
    const playerX = W / 2 + displayState.x * ROAD_HALF;
    for (const particle of reducedMotion?.matches ? [] : particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      rect(particle.x, particle.y, particle.size, particle.size, particle.color);
    }
    ctx.globalAlpha = 1;
    if (displayState.boosting && !reducedMotion?.matches) {
      const pulse = Math.floor(displayState.elapsed * 24) % 2;
      polygon(
        [
          [playerX - 25, CAR_Y - 2],
          [playerX - 18, CAR_Y - 2],
          [playerX - 22, CAR_Y + 20 + pulse * 8],
        ],
        '#a7e8c3',
      );
      polygon(
        [
          [playerX + 18, CAR_Y - 2],
          [playerX + 25, CAR_Y - 2],
          [playerX + 22, CAR_Y + 20 + pulse * 8],
        ],
        '#a7e8c3',
      );
    }
    // Flash only the body during damage immunity; its position stays readable.
    const immune = !reducedMotion?.matches && displayState.crashCooldown > 0 && Math.floor(displayState.elapsed * 12) % 2;
    car(playerX, CAR_Y, CAR_WIDTH * ROAD_HALF, immune ? '#f7d5a0' : COLORS.orange, true);
    if (displayState.crashCooldown > 1.1 && !reducedMotion?.matches) {
      ctx.globalAlpha = Math.min(0.18, (displayState.crashCooldown - 1.1) * 0.18);
      rect(0, 0, W, H, '#ed815f');
      ctx.globalAlpha = 1;
    }
    // Fast streaks stay on the shoulder, where they cannot obscure traffic.
    if (displayState.speed > 160 && !reducedMotion?.matches) {
      ctx.globalAlpha = (displayState.speed - 160) / 300;
      for (let i = 0; i < 10; i += 1) {
        const side = i % 2 ? 1 : -1;
        const y = HORIZON + mod(i * 79 + displayState.distance * 5, H - HORIZON);
        const spread = (y - HORIZON) / (H - HORIZON);
        polygon(
          [
            [W / 2 + side * (ROAD_HALF + 40) * spread, y],
            [W / 2 + side * (ROAD_HALF + 43) * spread, y],
            [W / 2 + side * (ROAD_HALF + 50) * (spread + 0.09), y + 26],
          ],
          '#a8c8b0',
        );
      }
      ctx.globalAlpha = 1;
    }
    if (getDistrict(displayState).weather === 'rain' && !reducedMotion?.matches) {
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 34; i += 1)
        rect(mod(i * 97 + displayState.elapsed * 45, W), mod(i * 59 + displayState.elapsed * 110, H), 2, 10, '#bcceda');
      ctx.globalAlpha = 1;
    }
    hud();
  }
  function effects(dt) {
    for (const event of state.events) {
      if (event.id <= lastEventId) continue;
      lastEventId = event.id;
      if (event.type === 'district')
        message = { text: event.district.toUpperCase(), color: '#d7e6bf', until: state.elapsed + 2 };
      else if (event.type === 'pickup')
        message = { text: 'BOOST CELL +35', color: '#bdf4cd', until: state.elapsed + 1 };
      else if (event.type === 'district-clear')
        message = {
          text: `${event.clean ? 'CLEAN CHECKPOINT' : 'CHECKPOINT'} +${event.points}`,
          color: '#d7e6bf',
          until: state.elapsed + 2,
        };
      else if (event.type === 'near-miss')
        message = {
          text: `NEAR MISS${event.points ? ` +${event.points}` : ''}`,
          color: '#bdf4cd',
          until: state.elapsed + 1.3,
        };
      else if (event.type === 'deadline-warning')
        message = { text: '4s TO CHECKPOINT', color: '#ffd8ac', until: state.elapsed + 1.3 };
      else if (event.type === 'crash') {
        const obstacle = { car: 'CAR', barrier: 'ROAD BARRIER', shoulder: 'SHOULDER' }[event.kind] || 'TRAFFIC';
        message = { text: `${obstacle} IMPACT / ${event.health} ${event.health === 1 ? 'HIT' : 'HITS'} LEFT`,
          color: '#ffd8ac', until: state.elapsed + 1.2 };
        for (let i = 0; !reducedMotion?.matches && i < 16; i += 1)
          particles.push({
            x: W / 2 + state.x * ROAD_HALF,
            y: CAR_Y - 28,
            vx: (i - 7.5) * 25,
            vy: -110 + mod(i * 33, 150),
            life: 0.55,
            maxLife: 0.55,
            size: 3 + (i % 3),
            color: i % 2 ? '#f7d49a' : '#e18d5c',
          });
      }
    }
    exhaustTime += dt;
    if (state.boosting && exhaustTime > 0.035 && !reducedMotion?.matches) {
      exhaustTime = 0;
      for (const side of [-1, 1])
        particles.push({
          x: W / 2 + state.x * ROAD_HALF + side * 22,
          y: CAR_Y + 7,
          vx: side * 7,
          vy: 65,
          life: 0.28,
          maxLife: 0.28,
          size: 5,
          color: '#99d4ad',
        });
    }
    particles = particles
      .filter((particle) => {
        particle.life -= dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        return particle.life > 0;
      })
      .slice(-90);
  }
  function frame(time) {
    raf = null;
    if (destroyed) return;
    const elapsed = previousFrame === null ? 0 : Math.min(0.08, Math.max(0, (time - previousFrame) / 1000));
    previousFrame = time;
    if (state.phase === 'playing') {
      accumulator += elapsed;
      let steps = 0;
      while (accumulator >= 1 / 120 && steps < 10 && state.phase === 'playing') {
        presentation.capture(state); step(state, input(), 1 / 120);
        effects(1 / 120);
        accumulator -= 1 / 120;
        steps += 1;
      }
      if (state.phase !== 'playing') releaseControls();
      publish();
    } else { accumulator = 0; presentation.reset(); }
    draw(tickFraction(accumulator, 1 / 120));
    syncAnimation();
  }
  function syncAnimation() {
    if (destroyed || state.phase !== 'playing') {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    } else if (raf === null) raf = requestAnimationFrame(frame);
  }
  function motionChanged() {
    draw();
  }
  function fitViewport() {
    const top = canvas.getBoundingClientRect().top;
    const maximum = desktopLayout?.matches
      ? `${Math.max(160, ((window.innerHeight - top - 18) * W) / H)}px`
      : '';
    setValue(canvas.style, 'maxWidth', maximum);
  }
  function togglePause() {
    if (destroyed) return;
    releaseControls();
    if (!pauseState(state)) return;
    previousFrame = null;
    accumulator = 0; presentation.reset();
    publish(true);
    draw();
    syncAnimation();
  }
  function restart() {
    if (destroyed) return;
    releaseControls();
    state = createState({ mode: state.mode, difficulty: state.difficulty });
    previousFrame = null;
    accumulator = 0; presentation.reset();
    lastEventId = -1;
    lastPublished = -Infinity;
    particles = [];
    message = null;
    exhaustTime = 0;
    publish(true);
    draw();
    syncAnimation();
    canvas.focus({ preventScroll: true });
  }
  function keydown(event) {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || isForm(event.target)) return;
    const focused = event.target instanceof Element ? event.target.closest('button[data-control]') : null;
    const activation = event.code === 'Space' || event.key === ' ' || event.key === 'Enter';
    const focusedControl =
      activation && focused && controls.contains(focused) ? focused.dataset.control : null;
    const control = focusedControl || KEY_CONTROLS[gameKey(event)];
    if (!control || state.phase !== 'playing') return;
    if (
      !focusedControl &&
      control === 'boost' &&
      event.target instanceof Element &&
      event.target.closest('button,a')
    )
      return;
    event.preventDefault();
    if (event.repeat && !keys.has(event.code || event.key)) return;
    keys.set(event.code || event.key, control);
    syncButtons();
  }
  function keyup(event) {
    if (!keys.has(event.code || event.key)) return;
    keys.delete(event.code || event.key);
    syncButtons();
  }
  function pointerdown(event) {
    const button = event.target.closest('button[data-control]');
    if (!button || !controls.contains(button) || state.phase !== 'playing') return;
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    event.preventDefault();
    touches.set(event.pointerId, button.dataset.control);
    try {
      button.setPointerCapture?.(event.pointerId);
    } catch {}
    syncButtons();
  }
  function pointerend(event) {
    if (!touches.delete(event.pointerId)) return;
    syncButtons();
  }
  const focus = () => canvas.focus({ preventScroll: true });
  const visibility = () => {
    if (document.hidden) releaseControls();
  };
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', releaseControls);
  reducedMotion?.addEventListener('change', motionChanged);
  desktopLayout?.addEventListener('change', fitViewport);
  window.addEventListener('resize', fitViewport);
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(fitViewport) : null;
  resizeObserver?.observe(view);
  document.addEventListener('visibilitychange', visibility);
  controls.addEventListener('pointerdown', pointerdown);
  window.addEventListener('pointerup', pointerend);
  window.addEventListener('pointercancel', pointerend);
  controls.addEventListener('lostpointercapture', pointerend);
  canvas.addEventListener('pointerdown', focus);
  function chooseMode(event) {
    const button = event.target.closest('button[data-mode]');
    if (!button || !modeChoices.contains(button)) return;
    state.mode = button.dataset.mode;
    restart();
  }
  function chooseDifficulty(event) {
    const button = event.target.closest('button[data-difficulty]');
    if (!button || !difficultyChoices.contains(button) || button.dataset.difficulty === state.difficulty)
      return;
    state.difficulty = button.dataset.difficulty;
    restart();
  }
  modeChoices.addEventListener('click', chooseMode);
  difficultyChoices.addEventListener('click', chooseDifficulty);
  replay.addEventListener('click', restart);
  function updateKeyboardHints() {
    view.dataset.keyboardLayout = getKeyboardLayout();
    canvas.setAttribute('aria-label', `Night highway. Arrow keys or ${displayKey('W A S D')} to drive, Space to boost, Escape to pause.`);
  }
  const unsubscribeKeyboardLayout = subscribeKeyboardLayout(() => { releaseControls(); updateKeyboardHints(); publish(true); });
  updateKeyboardHints();
  publish(true);
  fitViewport();
  draw();
  syncAnimation();

  return {
    getDisplayTiming: () => presentation.getStats(), getState: () => JSON.parse(JSON.stringify(state)),
    restart,
    togglePause,
    destroy() {
      if (destroyed) return;
      unsubscribeKeyboardLayout();
      sprites.clear();
      for (const image of skylines.values()) image.onload = null;
      skylines.clear();
      destroyed = true;
      cancelAnimationFrame(raf);
      releaseControls();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', releaseControls);
      reducedMotion?.removeEventListener('change', motionChanged);
      desktopLayout?.removeEventListener('change', fitViewport);
      window.removeEventListener('resize', fitViewport);
      resizeObserver?.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      controls.removeEventListener('pointerdown', pointerdown);
      window.removeEventListener('pointerup', pointerend);
      window.removeEventListener('pointercancel', pointerend);
      controls.removeEventListener('lostpointercapture', pointerend);
      canvas.removeEventListener('pointerdown', focus);
      modeChoices.removeEventListener('click', chooseMode);
      difficultyChoices.removeEventListener('click', chooseDifficulty);
      replay.removeEventListener('click', restart);
      view.remove();
    },
  };
}
