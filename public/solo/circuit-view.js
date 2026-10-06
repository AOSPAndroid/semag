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
function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mount(container, { onUpdate = () => {} } = {}) {
  let state = createState();
  let course = getTrack(state),
    TRACK = course.points,
    TRACK_LENGTH = course.length,
    ROAD_WIDTH = course.roadWidth,
    GATES = course.gates;
  const trackInfo = (distance) => courseInfo(distance, state.trackId);
  const nearestTrack = (x, y) => projectTrack(x, y, state.trackId);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let destroyed = false;
  let frameId = 0;
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
    rect(terrainCtx, x + 4, y + size * 0.55, 6, size * 0.7, '#66745a');
    rect(terrainCtx, x - size * 0.5 + 5, y + 8, size, size * 0.6, '#637d54');
    rect(terrainCtx, x - size * 0.5, y, size, size * 0.6, '#385b43');
    rect(terrainCtx, x - size * 0.35, y - size * 0.2, size * 0.7, size * 0.45, '#42684a');
    rect(terrainCtx, x - size * 0.2, y - size * 0.32, size * 0.4, size * 0.3, '#537954');
    rect(terrainCtx, x - size * 0.32, y + 4, size * 0.23, 4, '#678b5c');
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
    if (course.surface === 'coastal') {
      rect(terrainCtx, 300, 300, 390, 136, '#537f88');
      for (let y = 311; y < 427; y += 17)
        for (let x = 311; x < 676; x += 43) rect(terrainCtx, x + (y % 3) * 5, y, 21, 3, '#79a6ab');
      rect(terrainCtx, 370, 429, 230, 14, '#a89b7b');
      for (let x = 385; x < 594; x += 18) rect(terrainCtx, x, 429, 3, 14, '#887e67');
    } else if (course.surface === 'rain') {
      for (let i = 0; i < 7; i += 1) {
        const x = 340 + i * 40;
        rect(terrainCtx, x, 320 + (i % 2) * 22, 29, 48, '#546e68');
        rect(terrainCtx, x + 6, 310 + (i % 2) * 22, 17, 22, '#78918a');
      }
    }
    terrainCtx.lineJoin = 'round';
    terrainCtx.lineCap = 'round';
    pathTrack(terrainCtx);
    terrainCtx.lineWidth = ROAD_WIDTH + 25;
    terrainCtx.strokeStyle = '#657b5c';
    terrainCtx.stroke();
    terrainCtx.lineWidth = ROAD_WIDTH + 10;
    terrainCtx.strokeStyle = '#e2ddc6';
    terrainCtx.stroke();
    terrainCtx.lineWidth = ROAD_WIDTH;
    terrainCtx.strokeStyle = COLORS.road;
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
        if (point.distance > ROAD_WIDTH / 2 + 48 && (x + y) % 5 < 3)
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
    overlay.hidden = !mode;
    overlay.dataset.mode = mode;
    continueRace.hidden = mode !== 'stage-clear';
    if (mode === 'stage-clear') {
      overlayEyebrow.textContent = `RACE ${state.trackIndex + 1} / 3 COMPLETE`;
      overlayTitle.textContent = `${state.medal.toUpperCase()} · ${seconds(state.elapsed)}`;
      overlayDetail.textContent = `CHAMPIONSHIP TOTAL ${seconds(state.seriesTime)}`;
    } else if (mode === 'won') {
      overlayEyebrow.textContent = 'CHEQUERED FLAG';
      overlayTitle.textContent = seconds(state.raceTime);
      overlayDetail.textContent =
        state.mode === 'championship'
          ? 'THREE CIRCUITS · NINE LAPS COMPLETE'
          : `${state.medal.toUpperCase()} MEDAL · BEST LAP ${seconds(state.bestLap)}`;
    } else if (mode === 'paused') {
      overlayEyebrow.textContent = 'PIT STOP';
      overlayTitle.textContent = 'RACE PAUSED';
      overlayDetail.textContent = 'P OR RESUME TO GET BACK ON TRACK';
    } else if (mode === 'ready') {
      overlayEyebrow.textContent = 'HOLD YOUR LINE';
      overlayTitle.textContent = String(Math.max(1, Math.ceil(state.startDelay)));
      overlayDetail.textContent = 'LIGHTS OUT. THREE LAPS. MAKE THEM COUNT.';
    }
  }
  function publish() {
    if (destroyed) return;
    const message = detail();
    courseName.textContent = `${course.title.toUpperCase()} · ${state.mode === 'championship' ? `RACE ${state.trackIndex + 1}/3` : '3 LAPS'}`;
    courseBrief.textContent = `${course.description} Gold ${seconds(course.targets[0])} · Silver ${seconds(course.targets[1])} · Bronze ${seconds(course.targets[2])}`;
    for (const button of modes.children)
      button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode));
    for (const button of trackChoices.children) {
      button.setAttribute('aria-pressed', String(button.dataset.track === state.trackId));
      button.disabled = state.mode === 'championship';
    }
    speedValue.textContent = String(Math.round(Math.abs(state.car.speed) * 0.7));
    lapValue.textContent = `${String(Math.min(3, state.lap)).padStart(2, '0')} / 03`;
    lapTimeValue.textContent = seconds(state.lapElapsed);
    bestLapValue.textContent = state.bestLap === null ? '—' : seconds(state.bestLap);
    const gateProgress = state.phase === 'won' ? GATES.length - 1 : state.gateProgress;
    checkpointValue.textContent = `${Math.min(GATES.length - 1, gateProgress)} / ${GATES.length - 1}`;
    for (const dot of checkpointNodes) {
      const index = Number(dot.dataset.gate);
      dot.dataset.state = index <= gateProgress ? 'passed' : index === state.nextGate ? 'next' : 'waiting';
    }
    reset.disabled =
      !['playing', 'paused'].includes(state.phase) ||
      state.pausedPhase === 'stage-clear' ||
      state.startDelay > 0;
    for (const button of controlButtons.values()) button.disabled = state.phase !== 'playing';
    warning.hidden = state.phase !== 'playing' || (!state.wrongWay && state.onRoad && !state.slick);
    warning.textContent = state.wrongWay
      ? '← WRONG WAY · FOLLOW THE ARROWS'
      : !state.onRoad
        ? 'OFF TRACK · EASE BACK ONTO THE ROAD'
        : 'SLICK ZONE · GENTLE STEERING';
    if (announcement) {
      status.textContent = announcement;
      announcement = '';
    } else if (status.dataset.message !== message) status.textContent = message;
    status.dataset.message = message;
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
    const cssWidth = canvas.getBoundingClientRect().width || WORLD.width;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(cssWidth * ratio));
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
    for (const particle of dust) {
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
    rect(ctx, -13, -6, 25, 12, '#b96a36');
    rect(ctx, -11, -7, 20, 14, COLORS.orange);
    rect(ctx, 8, -5, 5, 10, '#f5b365');
    rect(ctx, -7, -4, 11, 8, '#edbf72');
    rect(ctx, 2, -5, 4, 10, '#355751');
    rect(ctx, -7, -4, 3, 8, '#527164');
    rect(ctx, -3, -4, 4, 8, '#f4cf88');
    rect(ctx, -11, -5, 2, 10, '#e7ac62');
    rect(ctx, 11, -5, 2, 3, '#f9f0c2');
    rect(ctx, 11, 2, 2, 3, '#f9f0c2');
    rect(ctx, -13, -5, 2, 3, '#a8583b');
    rect(ctx, -13, 2, 2, 3, '#a8583b');
    rect(ctx, -10, -8, 3, 2, '#f3d394');
    rect(ctx, -10, 6, 3, 2, '#f3d394');
    ctx.restore();
  }
  function frame(now) {
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
    frameId = window.requestAnimationFrame(frame);
  }
  function togglePause() {
    if (destroyed || !pauseState(state)) return;
    releaseHeld();
    accumulator = 0;
    lastFrame = null;
    publish();
    draw();
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
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(draw) : null;
  if (resizeObserver) resizeObserver.observe(canvas);
  else window.addEventListener('resize', draw);
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
    canvas.focus({ preventScroll: true });
  }
  selection.addEventListener('click', newSelection);
  continueRace.addEventListener('click', nextRace);
  reset.addEventListener('click', resetVehicle);
  publish();
  draw();
  frameId = window.requestAnimationFrame(frame);
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
    },
    togglePause,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      releaseHeld();
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', draw);
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
