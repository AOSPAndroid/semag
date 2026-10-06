import {
  createState,
  step,
  togglePause as pauseState,
  resetCar,
  WORLD,
  TRACKS,
  getTrack,
  advanceStage,
  recordScope,
  nearestTrack as projectTrack,
  trackInfo as courseInfo,
} from './circuit-engine.js';
import { createDrivingSprites } from '../art/driving-sprites.js';

const STEP = 1 / 120;
const KEY_INPUTS = {
  ArrowUp: 'throttle',
  KeyW: 'throttle',
  ArrowDown: 'brake',
  KeyS: 'brake',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'handbrake',
};
const COLORS = {
  grass: '#879d71',
  darkGrass: '#798f65',
  paper: '#f0ead3',
  road: '#66716c',
  ink: '#243e31',
  orange: '#ed9b51',
};
const isForm = (target) =>
  target instanceof Element &&
  Boolean(target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'));
const seconds = (value) => `${Math.max(0, Number(value) || 0).toFixed(2)}s`;
function setValue(target, key, value) {
  if (target[key] !== value) target[key] = value;
}
function setAttribute(target, key, value) {
  if (target.getAttribute(key) !== value) target.setAttribute(key, value);
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mount(container, { onUpdate = () => {} } = {}) {
  let state = createState();
  const sprites = createDrivingSprites();
  let course = getTrack(state),
    TRACK = course.points,
    TRACK_LENGTH = course.length,
    ROAD_WIDTH = course.roadWidth,
    GATES = course.gates;
  const trackInfo = (distance) => courseInfo(distance, state.trackId);
  const nearestTrack = (x, y) => projectTrack(x, y, state.trackId);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let destroyed = false;
  let frameId = null;
  let canvasCssWidth = WORLD.width;
  let lastFrame = null;
  let accumulator = 0;
  let lastPublish = -Infinity;
  let lastSkid = null;
  let effectClock = 0;
  let effectSeed = 27;
  let announcement = '';
  const keyHeld = new Map();
  const pointers = new Map();
  const skidMarks = [];
  const dust = [];
  const view = element('section', 'circuit-view');
  view.setAttribute('aria-label', 'Apex Circuit driving game');
  const topline = element('div', 'circuit-topline');
  const courseName = element('span', 'circuit-course', 'MEADOW LOOP · 3 LAPS');
  topline.append(element('span', '', 'APEX CIRCUIT / TIME ATTACK'), courseName);
  const selection = element('div', 'circuit-selection');
  const modes = element('div', 'circuit-modes');
  modes.setAttribute('role', 'group');
  modes.setAttribute('aria-label', 'Choose race mode');
  for (const [mode, label] of [
    ['time-trial', 'Time trial'],
    ['championship', 'Championship'],
  ]) {
    const button = element('button', 'circuit-mode', label);
    button.type = 'button';
    button.dataset.mode = mode;
    modes.append(button);
  }
  const trackChoices = element('div', 'circuit-track-choices');
  trackChoices.setAttribute('role', 'group');
  trackChoices.setAttribute('aria-label', 'Choose circuit');
  for (const [index, track] of TRACKS.entries()) {
    const button = element('button', 'circuit-track');
    button.type = 'button';
    button.dataset.track = track.id;
    button.append(
      element('span', '', `0${index + 1} / ${track.surface.toUpperCase()}`),
      element('strong', '', track.title),
    );
    trackChoices.append(button);
  }
  const courseBrief = element('p', 'circuit-brief');
  selection.append(modes, trackChoices, courseBrief);
  const hud = element('div', 'circuit-hud');
  const speedBox = element('div', 'circuit-stat circuit-speed');
  const speedValue = element('strong', '', '0');
  speedBox.append(speedValue, element('span', '', 'KM/H'));
  const lapBox = element('div', 'circuit-stat');
  const lapValue = element('strong', '', '01 / 03');
  lapBox.append(element('span', '', 'LAP'), lapValue);
  const lapTimeBox = element('div', 'circuit-stat circuit-lap-time');
  const lapTimeValue = element('strong', '', '0.00s');
  lapTimeBox.append(element('span', '', 'LAP TIME'), lapTimeValue);
  const bestLapBox = element('div', 'circuit-stat circuit-best-lap');
  const bestLapValue = element('strong', '', '—');
  bestLapBox.append(element('span', '', 'BEST LAP'), bestLapValue);
  hud.append(speedBox, lapBox, lapTimeBox, bestLapBox);
  const board = element('div', 'circuit-board');
  const canvas = element('canvas', 'circuit-canvas');
  canvas.width = WORLD.width;
  canvas.height = WORLD.height;
  canvas.tabIndex = 0;
  canvas.dataset.soloFocus = '';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    'Apex Circuit. Follow the track arrows. W or Up accelerates, S or Down brakes and reverses, A and D or Left and Right steer, Space is the handbrake. Q resets your car with a three-second penalty.',
  );
  const warning = element('div', 'circuit-warning');
  warning.hidden = true;
  const overlay = element('div', 'circuit-overlay');
  const overlayCard = element('div', 'circuit-overlay-card');
  const overlayEyebrow = element('span', 'circuit-overlay-eyebrow');
  const overlayTitle = element('strong', 'circuit-overlay-title');
  const overlayDetail = element('span', 'circuit-overlay-detail');
  const continueRace = element('button', 'circuit-continue', 'Next circuit →');
  continueRace.type = 'button';
  continueRace.hidden = true;
  overlayCard.append(overlayEyebrow, overlayTitle, overlayDetail, continueRace);
  overlay.append(overlayCard);
  board.append(canvas, warning, overlay);
  const checkpoints = element('div', 'circuit-checkpoints');
  checkpoints.setAttribute('aria-label', 'Checkpoint progress this lap');
  const checkpointLabel = element('span', 'circuit-checkpoint-label', 'CHECKPOINTS');
  const checkpointDots = element('div', 'circuit-checkpoint-dots');
  const checkpointNodes = GATES.slice(1).map((gate) => {
    const dot = element('span', 'circuit-checkpoint-dot');
    dot.dataset.gate = String(gate.index);
    dot.setAttribute('aria-label', `Checkpoint ${gate.index}`);
    checkpointDots.append(dot);
    return dot;
  });
  const checkpointValue = element('span', 'circuit-checkpoint-value', `0 / ${GATES.length - 1}`);
  checkpoints.append(checkpointLabel, checkpointDots, checkpointValue);
  const footer = element('div', 'circuit-footer');
  const description = element('div', 'circuit-description');
  const status = element('p', 'circuit-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const hint = element(
    'p',
    'circuit-hint',
    'Follow the arrows. Brake before a corner; tap the handbrake to rotate, then accelerate out. Keep every checkpoint in order.',
  );
  description.append(status, hint);
  const reset = element('button', 'circuit-reset');
  reset.type = 'button';
  reset.dataset.action = 'reset-car';
  reset.append(element('span', '', '↺ Reset car'), element('b', '', '+3s · Q'));
  reset.setAttribute(
    'aria-label',
    'Reset car to the last checkpoint. Adds three seconds to your race and lap time.',
  );
  footer.append(description, reset);
  const controls = element('div', 'circuit-controls');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Driving controls. Hold a button to drive.');
  const controlDefinitions = [
    ['left', '←', 'LEFT', 'Steer left'],
    ['right', '→', 'RIGHT', 'Steer right'],
    ['handbrake', '◇', 'DRIFT', 'Handbrake'],
    ['brake', '↓', 'BRAKE', 'Brake and reverse'],
    ['throttle', '↑', 'GAS', 'Accelerate'],
  ];
  const controlButtons = new Map();
  for (const [input, icon, label, aria] of controlDefinitions) {
    const button = element('button', `circuit-control circuit-control-${input}`);
    button.type = 'button';
    button.dataset.input = input;
    button.setAttribute('aria-label', aria);
    button.setAttribute('aria-pressed', 'false');
    const symbol = element('b', '', icon);
    symbol.setAttribute('aria-hidden', 'true');
    button.append(symbol, element('span', '', label));
    controlButtons.set(input, button);
    controls.append(button);
  }
  view.append(topline, selection, hud, board, checkpoints, footer, controls);
  container.append(view);
  const ctx = canvas.getContext('2d');
  const terrain = document.createElement('canvas');
  terrain.width = WORLD.width;
  terrain.height = WORLD.height;
  const terrainCtx = terrain.getContext('2d');

  function pathTrack(context) {
    context.beginPath();
    TRACK.forEach((point, i) => (i ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)));
    context.closePath();
  }
  function rect(context, x, y, w, h, color) {
    context.fillStyle = color;
    context.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function drawTree(x, y, size) {
    rect(terrainCtx, x - size * 0.36 + 7, y + size * 0.52, size * 0.8, size * 0.36, '#50684c55');
    rect(terrainCtx, x - 2, y + size * 0.15, 5, size * 0.64, '#716c4c');
    rect(terrainCtx, x - 1, y + size * 0.2, 2, size * 0.5, '#b09c65');
    if (course.surface === 'coastal') {
      terrainCtx.fillStyle = '#4f7867';
      terrainCtx.beginPath();
      terrainCtx.moveTo(x, y);
      for (const [dx, dy] of [
        [-size * 0.7, -size * 0.2],
        [-size * 0.3, -size * 0.32],
        [-size * 0.1, -size * 0.1],
        [-size * 0.3, -size * 0.65],
        [size * 0.05, -size * 0.38],
        [size * 0.15, -size * 0.12],
        [size * 0.6, -size * 0.32],
        [size * 0.72, -size * 0.05],
        [size * 0.12, size * 0.08],
      ])
        terrainCtx.lineTo(x + dx, y + dy);
      terrainCtx.fill();
      rect(terrainCtx, x - size * 0.26, y - size * 0.29, size * 0.39, 3, '#88a97a');
      return;
    }
    const dark = course.surface === 'rain' ? '#36594c' : '#375d45',
      mid = course.surface === 'rain' ? '#507263' : '#4c784f';
    rect(terrainCtx, x - size * 0.48, y, size * 0.96, size * 0.44, dark);
    rect(terrainCtx, x - size * 0.37, y - size * 0.18, size * 0.74, size * 0.55, mid);
    rect(terrainCtx, x - size * 0.2, y - size * 0.31, size * 0.42, size * 0.33, '#6d9467');
    rect(terrainCtx, x - size * 0.36, y + size * 0.08, size * 0.19, size * 0.12, '#85a572');
    rect(terrainCtx, x + size * 0.1, y - size * 0.12, size * 0.15, size * 0.11, '#78985f');
    rect(terrainCtx, x - size * 0.21, y + size * 0.31, size * 0.5, 3, '#294e3c');
  }
  function drawPaddock() {
    const c = terrainCtx;
    rect(c, 319, 285, 227, 141, '#77866b');
    rect(c, 326, 292, 213, 126, '#9ba18a');
    rect(c, 327, 352, 211, 4, '#c9c7aa');
    for (let x = 337; x < 532; x += 31) {
      rect(c, x, 365, 2, 40, '#d1ccb0');
      rect(c, x, 404, 25, 2, '#d1ccb0');
    }
    rect(c, 338, 311, 160, 36, '#65725e');
    rect(c, 333, 299, 166, 36, '#c2c8ae');
    rect(c, 333, 296, 166, 6, '#e0d9b7');
    for (let x = 345; x < 493; x += 28) {
      rect(c, x, 319, 20, 26, '#344f44');
      rect(c, x + 2, 321, 16, 3, '#8ca18a');
      rect(c, x + 4, 329, 12, 3, '#657f6b');
    }
    rect(c, 343, 303, 150, 3, '#98aa8f');
    rect(c, 345, 308, 25, 4, '#e9d6a2');
    rect(c, 476, 301, 12, 8, '#8d9c80');
    for (let i = 0; i < 5; i++) {
      c.save();
      c.translate(349 + i * 36, 387);
      c.rotate(-Math.PI / 2);
      c.drawImage(
        sprites.raceCar(['#d5b57d', '#93aeb0', '#b39baf', '#dda577', '#a7ba87'][i]),
        -15,
        -10,
        30,
        20,
      );
      c.restore();
    }
    rect(c, 515, 295, 13, 46, '#526750');
    rect(c, 511, 289, 22, 12, '#e9d8aa');
    rect(c, 550, 314, 48, 37, '#657c5b');
    rect(c, 550, 302, 48, 30, '#d7ba8d');
    for (let x = 553; x < 596; x += 11) rect(c, x, 302, 5, 30, '#e6d6ab');
    rect(c, 554, 326, 40, 6, '#688776');
    for (let i = 0; i < 7; i++) {
      rect(c, 560 + i * 4, 344 + (i % 2) * 3, 3, 4, i % 2 ? '#d4a76f' : '#3e6654');
    }
  }
  function drawTerrain() {
    if (!terrainCtx) return;
    terrainCtx.imageSmoothingEnabled = false;
    const terrainColor =
      course.surface === 'coastal' ? '#8ba4a1' : course.surface === 'rain' ? '#738b80' : COLORS.grass;
    rect(terrainCtx, 0, 0, WORLD.width, WORLD.height, terrainColor);
    for (let y = 0; y < WORLD.height; y += 28) {
      for (let x = 0; x < WORLD.width; x += 28) {
        if ((x / 28 + y / 28) % 2 === 0)
          rect(
            terrainCtx,
            x,
            y,
            28,
            28,
            course.surface === 'coastal' ? '#849c98' : course.surface === 'rain' ? '#6d8579' : '#84996d',
          );
        if ((x * 7 + y * 13) % 9 < 3) {
          rect(terrainCtx, x + 7, y + 15, 4, 2, '#9cae7f');
          rect(terrainCtx, x + 19, y + 8, 2, 4, '#758d60');
        }
      }
    }
    for (let i = 0; i < 260; i++) {
      const x = (i * 137 + 31) % WORLD.width,
        y = (i * 73 + 57) % WORLD.height;
      if (nearestTrack(x, y).distance < ROAD_WIDTH / 2 + 25) continue;
      rect(terrainCtx, x, y, 3, 1, course.surface === 'rain' ? '#a4b0a055' : '#d4c98b66');
      if (i % 5 === 0) rect(terrainCtx, x + 2, y - 2, 1, 2, '#55754f');
    }
    if (course.surface === 'coastal') {
      rect(terrainCtx, 300, 300, 390, 136, '#537f88');
      for (let y = 311; y < 427; y += 17)
        for (let x = 311; x < 676; x += 43) rect(terrainCtx, x + (y % 3) * 5, y, 21, 3, '#79a6ab');
      rect(terrainCtx, 370, 429, 230, 14, '#a89b7b');
      for (let x = 385; x < 594; x += 18) rect(terrainCtx, x, 429, 3, 14, '#887e67');
      for (let i = 0; i < 9; i++) {
        rect(terrainCtx, 328 + i * 36, 325 + (i % 3) * 24, 27, 2, '#bed0bb44');
      }
      rect(terrainCtx, 465, 350, 46, 12, '#d8d0ae');
      rect(terrainCtx, 473, 346, 22, 8, '#a5b9aa');
      rect(terrainCtx, 480, 348, 8, 4, '#577b80');
      rect(terrainCtx, 703, 346, 64, 26, '#768d84');
      rect(terrainCtx, 703, 341, 64, 22, '#b9a987');
      for (let x = 709; x < 765; x += 9) rect(terrainCtx, x, 343, 2, 18, '#847c68');
      rect(terrainCtx, 711, 380, 56, 29, '#536f6c');
      rect(terrainCtx, 711, 376, 56, 25, '#6d958d');
      for (let x = 718; x < 763; x += 9) rect(terrainCtx, x, 378, 2, 21, '#9db3a2');
    } else if (course.surface === 'rain') {
      for (let i = 0; i < 7; i += 1) {
        const x = 340 + i * 40;
        rect(terrainCtx, x, 320 + (i % 2) * 22, 29, 48, '#546e68');
        rect(terrainCtx, x + 6, 310 + (i % 2) * 22, 17, 22, '#78918a');
        rect(terrainCtx, x + 8, 312 + (i % 2) * 22, 12, 3, '#a4b6a4');
        rect(terrainCtx, x + 3, 338 + (i % 2) * 22, 4, 18, '#3d5c54');
      }
      rect(terrainCtx, 685, 364, 83, 49, '#546c62');
      rect(terrainCtx, 679, 350, 91, 31, '#91a18a');
      rect(terrainCtx, 687, 352, 75, 4, '#bec6a7');
      rect(terrainCtx, 696, 385, 18, 24, '#35534e');
      rect(terrainCtx, 731, 384, 22, 13, '#b3c9b3');
    } else {
      drawPaddock();
    }
    terrainCtx.lineJoin = 'round';
    terrainCtx.lineCap = 'round';
    pathTrack(terrainCtx);
    terrainCtx.lineWidth = ROAD_WIDTH + 25;
    terrainCtx.strokeStyle = course.surface === 'rain' ? '#4c675c' : '#617651';
    terrainCtx.stroke();
    terrainCtx.lineWidth = ROAD_WIDTH + 10;
    terrainCtx.strokeStyle = '#e2ddc6';
    terrainCtx.stroke();
    terrainCtx.lineWidth = ROAD_WIDTH;
    terrainCtx.strokeStyle = course.surface === 'rain' ? '#4f6367' : '#515f59';
    terrainCtx.stroke();
    for (let s = 0; s < TRACK_LENGTH; s += 8) {
      const p = trackInfo(s);
      for (let offset = -ROAD_WIDTH / 2 + 10; offset < ROAD_WIDTH / 2 - 8; offset += 11) {
        rect(
          terrainCtx,
          p.x - p.ty * offset,
          p.y + p.tx * offset,
          2 + (Math.floor(s) % 3),
          1,
          Math.floor(s + offset) % 3 ? '#bdc5ab13' : '#203d381c',
        );
      }
    }
    pathTrack(terrainCtx);
    terrainCtx.lineWidth = ROAD_WIDTH * 0.42;
    terrainCtx.strokeStyle = '#273b3612';
    terrainCtx.stroke();
    if (course.surface === 'rain') {
      terrainCtx.strokeStyle = '#74949a';
      terrainCtx.lineWidth = ROAD_WIDTH - 12;
      for (const [start, end] of [
        [0.18, 0.32],
        [0.61, 0.75],
      ]) {
        terrainCtx.beginPath();
        for (let s = start * TRACK_LENGTH; s < end * TRACK_LENGTH; s += 6) {
          const p = trackInfo(s);
          if (s === start * TRACK_LENGTH) terrainCtx.moveTo(p.x, p.y);
          else terrainCtx.lineTo(p.x, p.y);
        }
        terrainCtx.stroke();
      }
    }
    terrainCtx.lineCap = 'butt';
    // The alternating kerb follows the exact simulation centreline.
    for (let distance = 0; distance < TRACK_LENGTH; distance += 15) {
      const a = trackInfo(distance);
      const b = trackInfo(Math.min(distance + 15, TRACK_LENGTH));
      const color = Math.floor(distance / 15) % 2 ? '#e8e4d5' : '#b86c53';
      for (const sign of [-1, 1]) {
        const edge = (ROAD_WIDTH / 2 - 3) * sign;
        terrainCtx.beginPath();
        terrainCtx.moveTo(a.x - a.ty * edge, a.y + a.tx * edge);
        terrainCtx.lineTo(b.x - b.ty * edge, b.y + b.tx * edge);
        terrainCtx.lineWidth = 6;
        terrainCtx.strokeStyle = color;
        terrainCtx.stroke();
      }
    }
    pathTrack(terrainCtx);
    terrainCtx.lineWidth = 2;
    terrainCtx.strokeStyle = '#b8b9a25c';
    terrainCtx.setLineDash([10, 17]);
    terrainCtx.stroke();
    terrainCtx.setLineDash([]);
    for (let distance = 150; distance < TRACK_LENGTH; distance += 180) {
      const point = trackInfo(distance);
      terrainCtx.save();
      terrainCtx.translate(point.x, point.y);
      terrainCtx.rotate(point.heading);
      terrainCtx.beginPath();
      terrainCtx.moveTo(-8, -7);
      terrainCtx.lineTo(1, 0);
      terrainCtx.lineTo(-8, 7);
      terrainCtx.strokeStyle = '#e6ddbb96';
      terrainCtx.lineWidth = 3;
      terrainCtx.lineJoin = 'miter';
      terrainCtx.stroke();
      terrainCtx.restore();
    }
    for (const gate of GATES.slice(1)) {
      terrainCtx.beginPath();
      terrainCtx.moveTo(gate.x - gate.nx * (ROAD_WIDTH / 2 - 8), gate.y - gate.ny * (ROAD_WIDTH / 2 - 8));
      terrainCtx.lineTo(gate.x + gate.nx * (ROAD_WIDTH / 2 - 8), gate.y + gate.ny * (ROAD_WIDTH / 2 - 8));
      terrainCtx.strokeStyle = '#e4e2d543';
      terrainCtx.setLineDash([5, 5]);
      terrainCtx.lineWidth = 2;
      terrainCtx.stroke();
      terrainCtx.setLineDash([]);
    }
    const finish = GATES[0];
    terrainCtx.save();
    terrainCtx.translate(finish.x, finish.y);
    terrainCtx.rotate(Math.atan2(finish.ty, finish.tx));
    for (let row = 0; row < 12; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        rect(terrainCtx, column * 6 - 9, row * 6 - 36, 6, 6, (row + column) % 2 ? '#eae8d8' : '#263c32');
      }
    }
    terrainCtx.restore();
    for (let y = 36; y < WORLD.height - 22; y += 59) {
      for (let x = 38; x < WORLD.width - 22; x += 65) {
        const dx = ((x * 13 + y * 3) % 29) - 14;
        const dy = ((x * 7 + y * 11) % 21) - 10;
        const point = nearestTrack(x + dx, y + dy);
        if (
          point.distance > ROAD_WIDTH / 2 + 48 &&
          (x + y) % 5 < 3 &&
          !(course.surface === 'dry' && x > 290 && x < 625 && y > 263 && y < 450) &&
          !(course.surface === 'coastal' && x > 280 && x < 790 && y > 280 && y < 450)
        )
          drawTree(x + dx, y + dy, 19 + ((x + y) % 13));
      }
    }
    // Small orange cones make checkpoint gates readable from above.
    for (const gate of GATES.slice(1)) {
      for (const side of [-1, 1]) {
        const x = gate.x + gate.nx * (ROAD_WIDTH / 2 + 9) * side;
        const y = gate.y + gate.ny * (ROAD_WIDTH / 2 + 9) * side;
        rect(terrainCtx, x - 5, y - 1, 12, 7, '#617456');
        rect(terrainCtx, x - 4, y - 5, 8, 9, '#d48d56');
        rect(terrainCtx, x - 2, y - 8, 4, 6, '#f0b575');
        rect(terrainCtx, x - 3, y - 2, 6, 2, '#eee8d4');
      }
    }
  }
  drawTerrain();

  function held(input) {
    if ([...keyHeld.values()].includes(input)) return true;
    return [...pointers.values()].some((pointer) => pointer.input === input);
  }
  function inputs() {
    return {
      throttle: held('throttle'),
      brake: held('brake'),
      left: held('left'),
      right: held('right'),
      handbrake: held('handbrake'),
    };
  }
  function paintHeld() {
    for (const [input, button] of controlButtons) button.setAttribute('aria-pressed', String(held(input)));
  }
  function releaseHeld() {
    keyHeld.clear();
    const captured = [...pointers.entries()];
    pointers.clear();
    for (const [id, pointer] of captured) {
      if (pointer.button.hasPointerCapture?.(id)) pointer.button.releasePointerCapture(id);
    }
    paintHeld();
    lastSkid = null;
  }
  function detail() {
    if (state.phase === 'stage-clear')
      return `${course.title} complete in ${seconds(state.elapsed)}. ${state.medal.toUpperCase()} medal. Continue to the next circuit.`;
    if (state.phase === 'won' && state.mode === 'championship')
      return `Championship complete: ${seconds(state.raceTime)} across three circuits and nine laps.`;
    if (state.phase === 'won')
      return `Three clean laps. Race ${seconds(state.raceTime)}, best lap ${seconds(state.bestLap)}. Start a new race to chase your record.`;
    if (state.phase === 'paused') return 'Paused. Your race clock is stopped. Resume when you are ready.';
    if (state.startDelay > 0)
      return 'Get ready. Three laps, every checkpoint in order. Accelerate when the lights go out.';
    if (state.wrongWay) return 'Wrong way. Follow the track arrows and pass each checkpoint in order.';
    if (!state.onRoad)
      return 'Grass slows you down. Ease back onto the circuit, or reset your car for a +3s penalty.';
    return `Lap ${Math.min(3, state.lap)} of 3. ${state.nextGate === 0 ? 'All checkpoints clear — cross the finish line.' : `Follow the arrows to checkpoint ${state.nextGate}.`} Brake early, accelerate out.`;
  }
  function updateOverlay() {
    const mode =
      state.phase === 'stage-clear'
        ? 'stage-clear'
        : state.phase === 'won'
          ? 'won'
          : state.phase === 'paused'
            ? 'paused'
            : state.startDelay > 0
              ? 'ready'
              : '';
    setValue(overlay, 'hidden', !mode);
    setValue(overlay.dataset, 'mode', mode);
    setValue(continueRace, 'hidden', mode !== 'stage-clear');
    if (mode === 'stage-clear') {
      setValue(overlayEyebrow, 'textContent', `RACE ${state.trackIndex + 1} / 3 COMPLETE`);
      setValue(overlayTitle, 'textContent', `${state.medal.toUpperCase()} · ${seconds(state.elapsed)}`);
      setValue(overlayDetail, 'textContent', `CHAMPIONSHIP TOTAL ${seconds(state.seriesTime)}`);
    } else if (mode === 'won') {
      setValue(overlayEyebrow, 'textContent', 'CHEQUERED FLAG');
      setValue(overlayTitle, 'textContent', seconds(state.raceTime));
      setValue(
        overlayDetail,
        'textContent',
        state.mode === 'championship'
          ? 'THREE CIRCUITS · NINE LAPS COMPLETE'
          : `${state.medal.toUpperCase()} MEDAL · BEST LAP ${seconds(state.bestLap)}`,
      );
    } else if (mode === 'paused') {
      setValue(overlayEyebrow, 'textContent', 'PIT STOP');
      setValue(overlayTitle, 'textContent', 'RACE PAUSED');
      setValue(overlayDetail, 'textContent', 'P OR RESUME TO GET BACK ON TRACK');
    } else if (mode === 'ready') {
      setValue(overlayEyebrow, 'textContent', 'HOLD YOUR LINE');
      setValue(overlayTitle, 'textContent', String(Math.max(1, Math.ceil(state.startDelay))));
      setValue(overlayDetail, 'textContent', 'LIGHTS OUT. THREE LAPS. MAKE THEM COUNT.');
    }
  }
  function publish() {
    if (destroyed) return;
    const message = detail();
    setValue(
      courseName,
      'textContent',
      `${course.title.toUpperCase()} · ${state.mode === 'championship' ? `RACE ${state.trackIndex + 1}/3` : '3 LAPS'}`,
    );
    setValue(
      courseBrief,
      'textContent',
      `${course.description} Gold ${seconds(course.targets[0])} · Silver ${seconds(course.targets[1])} · Bronze ${seconds(course.targets[2])}`,
    );
    for (const button of modes.children)
      setAttribute(button, 'aria-pressed', String(button.dataset.mode === state.mode));
    for (const button of trackChoices.children) {
      setAttribute(button, 'aria-pressed', String(button.dataset.track === state.trackId));
      setValue(button, 'disabled', state.mode === 'championship');
    }
    setValue(speedValue, 'textContent', String(Math.round(Math.abs(state.car.speed) * 0.7)));
    setValue(lapValue, 'textContent', `${String(Math.min(3, state.lap)).padStart(2, '0')} / 03`);
    setValue(lapTimeValue, 'textContent', seconds(state.lapElapsed));
    setValue(bestLapValue, 'textContent', state.bestLap === null ? '—' : seconds(state.bestLap));
    const gateProgress = state.phase === 'won' ? GATES.length - 1 : state.gateProgress;
    setValue(
      checkpointValue,
      'textContent',
      `${Math.min(GATES.length - 1, gateProgress)} / ${GATES.length - 1}`,
    );
    for (const dot of checkpointNodes) {
      const index = Number(dot.dataset.gate);
      setValue(
        dot.dataset,
        'state',
        index <= gateProgress ? 'passed' : index === state.nextGate ? 'next' : 'waiting',
      );
    }
    setValue(
      reset,
      'disabled',
      !['playing', 'paused'].includes(state.phase) ||
        state.pausedPhase === 'stage-clear' ||
        state.startDelay > 0,
    );
    for (const button of controlButtons.values()) setValue(button, 'disabled', state.phase !== 'playing');
    setValue(
      warning,
      'hidden',
      state.phase !== 'playing' || (!state.wrongWay && state.onRoad && !state.slick),
    );
    setValue(
      warning,
      'textContent',
      state.wrongWay
        ? '← WRONG WAY · FOLLOW THE ARROWS'
        : !state.onRoad
          ? 'OFF TRACK · EASE BACK ONTO THE ROAD'
          : 'SLICK ZONE · GENTLE STEERING',
    );
    if (announcement) {
      setValue(status, 'textContent', announcement);
      announcement = '';
    } else if (status.dataset.message !== message) setValue(status, 'textContent', message);
    setValue(status.dataset, 'message', message);
    updateOverlay();
    onUpdate({
      phase: state.phase === 'stage-clear' ? 'playing' : state.phase,
      score:
        Math.round(
          (state.mode === 'championship'
            ? state.seriesTime +
              (['playing', 'paused'].includes(state.phase) && state.pausedPhase !== 'stage-clear'
                ? state.elapsed
                : 0)
            : state.elapsed) * 100,
        ) / 100,
      scoreLabel: state.mode === 'championship' ? 'SERIES TIME' : 'RACE TIME',
      scoreDigits: 2,
      record: state.phase === 'won' ? state.raceTime : null,
      recordDirection: 'min',
      recordKey: recordScope(state),
      recordLabel: state.mode === 'championship' ? 'BEST SERIES' : 'BEST RACE',
      detail: message,
    });
  }
  function nextEffectRandom() {
    effectSeed = (Math.imul(effectSeed, 1664525) + 1013904223) >>> 0;
    return effectSeed / 4294967296;
  }
  function updateEffects(delta) {
    const car = state.car;
    const lateral = -Math.sin(car.heading) * car.vx + Math.cos(car.heading) * car.vy;
    const sliding =
      state.phase === 'playing' &&
      state.startDelay <= 0 &&
      Math.abs(car.speed) > 45 &&
      (Math.abs(lateral) > 20 || held('handbrake'));
    if (sliding) {
      const current = [-1, 1].map((side) => ({
        x: car.x - Math.cos(car.heading) * 8 - Math.sin(car.heading) * side * 8,
        y: car.y - Math.sin(car.heading) * 8 + Math.cos(car.heading) * side * 8,
      }));
      if (lastSkid && Math.hypot(current[0].x - lastSkid[0].x, current[0].y - lastSkid[0].y) < 15) {
        for (let i = 0; i < 2; i += 1) skidMarks.push({ a: lastSkid[i], b: current[i] });
        if (skidMarks.length > 360) skidMarks.splice(0, skidMarks.length - 360);
      }
      lastSkid = current;
    } else lastSkid = null;
    effectClock += delta;
    if (
      state.phase === 'playing' &&
      state.startDelay <= 0 &&
      !state.onRoad &&
      !reducedMotion?.matches &&
      Math.abs(car.speed) > 30 &&
      effectClock > 0.055
    ) {
      effectClock = 0;
      dust.push({
        x: car.x - Math.cos(car.heading) * 13,
        y: car.y - Math.sin(car.heading) * 13,
        life: 0.55,
        vx: (nextEffectRandom() - 0.5) * 18,
        vy: (nextEffectRandom() - 0.5) * 18,
      });
      if (dust.length > 24) dust.shift();
    }
    if (state.phase !== 'paused') {
      for (let i = dust.length - 1; i >= 0; i -= 1) {
        dust[i].life -= delta;
        dust[i].x += dust[i].vx * delta;
        dust[i].y += dust[i].vy * delta;
        if (dust[i].life <= 0) dust.splice(i, 1);
      }
    }
  }
  function draw() {
    if (destroyed || !ctx) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(canvasCssWidth * ratio));
    const pixelHeight = Math.max(1, Math.round((pixelWidth * WORLD.height) / WORLD.width));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    ctx.setTransform(pixelWidth / WORLD.width, 0, 0, pixelHeight / WORLD.height, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(terrain, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = '#283d324d';
    for (const mark of skidMarks) {
      ctx.beginPath();
      ctx.moveTo(mark.a.x, mark.a.y);
      ctx.lineTo(mark.b.x, mark.b.y);
      ctx.stroke();
    }
    for (const particle of reducedMotion?.matches ? [] : dust) {
      ctx.globalAlpha = Math.min(0.6, particle.life);
      rect(ctx, particle.x, particle.y, 4, 4, '#d9cfaa');
    }
    ctx.globalAlpha = 1;
    if (course.surface === 'rain' && !reducedMotion?.matches) {
      for (let i = 0; i < 42; i += 1) {
        const x = (i * 97 + state.elapsed * 38) % WORLD.width,
          y = (i * 71 + state.elapsed * 95) % WORLD.height;
        rect(ctx, x, y, 2, 7, '#c1d4cf66');
      }
    }
    if (!['won', 'stage-clear'].includes(state.phase)) {
      const gate = GATES[state.nextGate];
      ctx.beginPath();
      ctx.moveTo(gate.x - gate.nx * (ROAD_WIDTH / 2 - 8), gate.y - gate.ny * (ROAD_WIDTH / 2 - 8));
      ctx.lineTo(gate.x + gate.nx * (ROAD_WIDTH / 2 - 8), gate.y + gate.ny * (ROAD_WIDTH / 2 - 8));
      ctx.lineWidth = 4;
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = '#e5b76bc7';
      ctx.stroke();
      ctx.setLineDash([]);
      const labelX = gate.x + gate.nx * (ROAD_WIDTH / 2 + 24);
      const labelY = gate.y + gate.ny * (ROAD_WIDTH / 2 + 24);
      rect(ctx, labelX - 10, labelY - 10, 20, 20, '#ecd4a8');
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillStyle = '#62492d';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.nextGate === 0 ? 'F' : String(state.nextGate), labelX, labelY + 1);
    }
    const car = state.car;
    ctx.save();
    ctx.translate(car.x + 3, car.y + 4);
    ctx.rotate(car.heading);
    rect(ctx, -13, -8, 27, 17, '#293e3a66');
    ctx.restore();
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.heading);
    if (course.surface === 'rain') {
      ctx.fillStyle = '#e1eac713';
      ctx.beginPath();
      ctx.moveTo(12, -4);
      ctx.lineTo(57, -20);
      ctx.lineTo(57, 20);
      ctx.lineTo(12, 4);
      ctx.fill();
    }
    const steering = held('left') === held('right') ? 0 : held('left') ? -0.3 : 0.3;
    for (const x of [-8, 8]) {
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(x, side * 8);
        if (x > 0) ctx.rotate(steering);
        rect(ctx, -4, -2, 8, 4, '#26332c');
        ctx.restore();
      }
    }
    ctx.drawImage(sprites.raceCar(COLORS.orange), -14, -9, 28, 18);
    if (held('brake') || held('handbrake')) {
      rect(ctx, -13, -5, 2, 3, '#f7b078');
      rect(ctx, -13, 2, 2, 3, '#f7b078');
    }
    ctx.strokeStyle = '#e5deb784';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-11, -6, 21, 12);
    ctx.restore();
  }
  function frame(now) {
    frameId = null;
    if (destroyed) return;
    const delta = lastFrame === null ? 0 : Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    const previousPhase = state.phase;
    const previousGate = state.nextGate;
    const previousLap = state.lap;
    const wasReady = state.startDelay > 0;
    if (state.phase === 'playing') {
      accumulator = Math.min(accumulator + delta, STEP * 12);
      let ticks = 0;
      while (accumulator >= STEP && ticks < 12 && state.phase === 'playing') {
        step(state, inputs(), STEP);
        accumulator -= STEP;
        ticks += 1;
      }
    } else accumulator = 0;
    if (state.phase !== previousPhase) releaseHeld();
    updateEffects(delta);
    if (
      now - lastPublish >= 100 ||
      previousPhase !== state.phase ||
      previousGate !== state.nextGate ||
      previousLap !== state.lap ||
      wasReady !== state.startDelay > 0
    ) {
      lastPublish = now;
      publish();
    }
    draw();
    syncAnimation();
  }
  function syncAnimation() {
    const finishingDust = state.phase !== 'paused' && !reducedMotion?.matches && dust.length > 0;
    if (destroyed || (state.phase !== 'playing' && !finishingDust)) {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
    } else if (frameId === null) frameId = window.requestAnimationFrame(frame);
  }
  function resizeCanvas() {
    canvasCssWidth = canvas.getBoundingClientRect().width || WORLD.width;
    draw();
  }
  function motionChanged() {
    draw();
    syncAnimation();
  }
  function togglePause() {
    if (destroyed || !pauseState(state)) return;
    releaseHeld();
    accumulator = 0;
    lastFrame = null;
    publish();
    draw();
    syncAnimation();
  }
  function autoPause() {
    releaseHeld();
    if (state.phase === 'playing') togglePause();
  }
  function resetVehicle() {
    if (destroyed || !resetCar(state)) return;
    releaseHeld();
    lastSkid = null;
    dust.length = 0;
    announcement = 'Car reset to your last checkpoint. Three seconds added to your race and lap time.';
    publish();
    draw();
  }
  function keydown(event) {
    if (
      destroyed ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      isForm(event.target)
    )
      return;
    const control = event.target instanceof Element ? event.target.closest('button[data-input]') : null;
    const input =
      control && controls.contains(control) && ['Space', 'Enter'].includes(event.code)
        ? control.dataset.input
        : KEY_INPUTS[event.code];
    if (input) {
      if (
        !control &&
        event.code === 'Space' &&
        event.target instanceof Element &&
        event.target.closest('button,a')
      )
        return;
      event.preventDefault();
      if (state.phase !== 'playing') return;
      keyHeld.set(event.code, input);
      paintHeld();
    } else if (event.code === 'KeyQ' && !event.repeat) {
      event.preventDefault();
      resetVehicle();
    }
  }
  function keyup(event) {
    if (!KEY_INPUTS[event.code] && !keyHeld.has(event.code)) return;
    keyHeld.delete(event.code);
    paintHeld();
  }
  function pointerdown(event) {
    const button = event.target.closest('button[data-input]');
    if (!button || !controls.contains(button) || event.button !== 0 || state.phase !== 'playing') return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { input: button.dataset.input, button });
    paintHeld();
    canvas.focus({ preventScroll: true });
  }
  function pointerend(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    pointers.delete(event.pointerId);
    if (pointer.button.hasPointerCapture?.(event.pointerId))
      pointer.button.releasePointerCapture(event.pointerId);
    paintHeld();
  }
  const focusCanvas = () => canvas.focus({ preventScroll: true });
  const visibility = () => {
    if (document.hidden) autoPause();
  };
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resizeCanvas) : null;
  if (resizeObserver) resizeObserver.observe(canvas);
  window.addEventListener('resize', resizeCanvas);
  reducedMotion?.addEventListener('change', motionChanged);
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', autoPause);
  document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('pointerdown', focusCanvas);
  controls.addEventListener('pointerdown', pointerdown);
  controls.addEventListener('pointerup', pointerend);
  controls.addEventListener('pointercancel', pointerend);
  controls.addEventListener('lostpointercapture', pointerend);
  function newSelection(event) {
    const button = event.target.closest('button[data-track],button[data-mode]');
    if (!button || !selection.contains(button)) return;
    const mode = button.dataset.mode || state.mode,
      trackId = button.dataset.track || state.trackId;
    releaseHeld();
    state = createState({ mode, trackId });
    course = getTrack(state);
    TRACK = course.points;
    TRACK_LENGTH = course.length;
    ROAD_WIDTH = course.roadWidth;
    GATES = course.gates;
    skidMarks.length = 0;
    dust.length = 0;
    lastFrame = null;
    accumulator = 0;
    lastPublish = -Infinity;
    drawTerrain();
    publish();
    draw();
    syncAnimation();
    canvas.focus({ preventScroll: true });
  }
  function nextRace() {
    if (!advanceStage(state)) return;
    releaseHeld();
    course = getTrack(state);
    TRACK = course.points;
    TRACK_LENGTH = course.length;
    ROAD_WIDTH = course.roadWidth;
    GATES = course.gates;
    skidMarks.length = 0;
    dust.length = 0;
    lastFrame = null;
    accumulator = 0;
    lastPublish = -Infinity;
    drawTerrain();
    publish();
    draw();
    syncAnimation();
    canvas.focus({ preventScroll: true });
  }
  selection.addEventListener('click', newSelection);
  continueRace.addEventListener('click', nextRace);
  reset.addEventListener('click', resetVehicle);
  publish();
  resizeCanvas();
  syncAnimation();
  return {
    getState: () => JSON.parse(JSON.stringify(state)),
    restart() {
      if (destroyed) return;
      releaseHeld();
      state = createState({ trackId: state.trackId, mode: state.mode });
      course = getTrack(state);
      TRACK = course.points;
      TRACK_LENGTH = course.length;
      ROAD_WIDTH = course.roadWidth;
      GATES = course.gates;
      drawTerrain();
      skidMarks.length = 0;
      dust.length = 0;
      effectClock = 0;
      accumulator = 0;
      lastFrame = null;
      lastPublish = -Infinity;
      announcement = '';
      publish();
      draw();
      syncAnimation();
    },
    togglePause,
    destroy() {
      if (destroyed) return;
      sprites.clear();
      destroyed = true;
      releaseHeld();
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resizeCanvas);
      reducedMotion?.removeEventListener('change', motionChanged);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', autoPause);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointerdown', focusCanvas);
      controls.removeEventListener('pointerdown', pointerdown);
      controls.removeEventListener('pointerup', pointerend);
      controls.removeEventListener('pointercancel', pointerend);
      controls.removeEventListener('lostpointercapture', pointerend);
      selection.removeEventListener('click', newSelection);
      continueRace.removeEventListener('click', nextRace);
      reset.removeEventListener('click', resetVehicle);
      view.remove();
    },
  };
}
