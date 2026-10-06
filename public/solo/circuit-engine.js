export const WORLD = Object.freeze({ width: 1000, height: 680 });
export const ROAD_WIDTH = 90;
export const MAX_SPEED = 220;
export const LAPS = 3;
export const FIXED_DT = 1 / 120;
export const RESET_PENALTY = 3;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const anchors = [
  [460, 564], [665, 562], [822, 532], [888, 434], [870, 277], [836, 157],
  [731, 112], [612, 112], [545, 184], [475, 184], [409, 112], [269, 116],
  [153, 186], [115, 319], [142, 456], [244, 541],
].map(([x, y]) => ({ x, y }));

function spline(a, b, c, d, t) {
  const t2 = t * t, t3 = t2 * t;
  const coordinate = key => .5 * ((2 * b[key]) + (-a[key] + c[key]) * t
    + (2 * a[key] - 5 * b[key] + 4 * c[key] - d[key]) * t2
    + (-a[key] + 3 * b[key] - 3 * c[key] + d[key]) * t3);
  return { x: coordinate('x'), y: coordinate('y') };
}

// A sampled, closed Catmull–Rom centreline keeps rendering and race gates on
// exactly the same course. Points are resampled at roughly six pixel intervals.
const raw = [];
for (let i = 0; i < anchors.length; i += 1) {
  for (let j = 0; j < 36; j += 1) {
    raw.push(spline(anchors[(i + anchors.length - 1) % anchors.length], anchors[i],
      anchors[(i + 1) % anchors.length], anchors[(i + 2) % anchors.length], j / 36));
  }
}
const rawLengths = [0];
for (let i = 1; i <= raw.length; i += 1) {
  rawLengths.push(rawLengths[i - 1] + distance(raw[i - 1], raw[i % raw.length]));
}
export const TRACK_LENGTH = rawLengths.at(-1);
const samples = Math.ceil(TRACK_LENGTH / 6);
const points = [];
let rawIndex = 0;
for (let i = 0; i < samples; i += 1) {
  const s = TRACK_LENGTH * i / samples;
  while (rawLengths[rawIndex + 1] < s) rawIndex += 1;
  const a = raw[rawIndex], b = raw[(rawIndex + 1) % raw.length];
  const portion = (s - rawLengths[rawIndex]) / (rawLengths[rawIndex + 1] - rawLengths[rawIndex]);
  points.push({ x: a.x + (b.x - a.x) * portion, y: a.y + (b.y - a.y) * portion, s });
}
export const TRACK = Object.freeze(points.map((point, index) => {
  const before = points[(index + points.length - 1) % points.length];
  const after = points[(index + 1) % points.length];
  const length = distance(before, after);
  return Object.freeze({ ...point, tx: (after.x - before.x) / length, ty: (after.y - before.y) / length });
}));

/** A centreline position and forward tangent at a wrapped course distance. */
export function trackInfo(courseDistance = 0) {
  const s = Number.isFinite(courseDistance) ? ((courseDistance % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH : 0;
  const scaled = s / TRACK_LENGTH * TRACK.length;
  const index = Math.floor(scaled), portion = scaled - index;
  const a = TRACK[index], b = TRACK[(index + 1) % TRACK.length];
  const tx = a.tx + (b.tx - a.tx) * portion, ty = a.ty + (b.ty - a.ty) * portion;
  const norm = Math.hypot(tx, ty);
  return { x: a.x + (b.x - a.x) * portion, y: a.y + (b.y - a.y) * portion,
    s, index, tx: tx / norm, ty: ty / norm, heading: Math.atan2(ty, tx) };
}

/** Closest projection onto the actual road, rather than an approximate ellipse. */
export function nearestTrack(x, y) {
  if (typeof x === 'object' && x !== null) ({ x, y } = x);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { ...trackInfo(0), distance: Infinity };
  let best = null, bestSquared = Infinity;
  for (let index = 0; index < TRACK.length; index += 1) {
    const a = TRACK[index], b = TRACK[(index + 1) % TRACK.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const portion = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
    const px = a.x + dx * portion, py = a.y + dy * portion;
    const squared = (x - px) ** 2 + (y - py) ** 2;
    if (squared < bestSquared) {
      bestSquared = squared;
      best = { x: px, y: py, index, portion };
    }
  }
  const info = trackInfo(TRACK_LENGTH * (best.index + best.portion) / TRACK.length);
  return { ...info, x: best.x, y: best.y, distance: Math.sqrt(bestSquared) };
}

export const GATES = Object.freeze(Array.from({ length: 12 }, (_, index) => {
  const info = trackInfo(TRACK_LENGTH * index / 12);
  return Object.freeze({ ...info, index, nx: -info.ty, ny: info.tx });
}));

function carAt(s) {
  const point = trackInfo(s);
  return { x: point.x, y: point.y, heading: point.heading, vx: 0, vy: 0,
    speed: 0, angularVelocity: 0, slip: 0 };
}

export function createState() {
  const car = carAt(-18);
  return {
    gameId: 'apex-circuit', phase: 'playing', startDelay: 1,
    elapsed: 0, lapElapsed: 0, penalty: 0, lap: 1, lapsCompleted: 0,
    lapTimes: [], bestLap: null, raceTime: null,
    nextGate: 1, gateProgress: 0, lastCheckpoint: 0,
    car, onRoad: true, wrongWay: false, score: 0, result: null,
    course: { previous: { x: car.x, y: car.y }, lastS: TRACK_LENGTH - 18,
      travel: 18, lapStart: 0 },
  };
}

function crossedGate(gate, before, after) {
  const beforeSide = (before.x - gate.x) * gate.tx + (before.y - gate.y) * gate.ty;
  const afterSide = (after.x - gate.x) * gate.tx + (after.y - gate.y) * gate.ty;
  if (beforeSide >= 0 || afterSide < 0 || afterSide <= beforeSide) return false;
  const portion = -beforeSide / (afterSide - beforeSide);
  const x = before.x + (after.x - before.x) * portion;
  const y = before.y + (after.y - before.y) * portion;
  return Math.abs((x - gate.x) * gate.nx + (y - gate.y) * gate.ny) <= ROAD_WIDTH / 2;
}

function updateCourse(state, nearest, dt) {
  const course = state.course, before = course.previous, after = state.car;
  const moved = distance(before, after);
  let advance = nearest.s - course.lastS;
  if (advance > TRACK_LENGTH / 2) advance -= TRACK_LENGTH;
  if (advance < -TRACK_LENGTH / 2) advance += TRACK_LENGTH;
  // Credit only continuous movement along the road. Teleporting between gates
  // or cutting across the infield cannot turn into a lap on the finish line.
  const continuous = moved <= MAX_SPEED * dt * 1.35 + 1;
  const alongRoad = state.onRoad && Math.abs(advance) <= moved * 1.8 + .25;
  if (!continuous) course.travel = 0;
  else if (alongRoad) course.travel = Math.max(0, course.travel + advance);
  state.wrongWay = Math.hypot(state.car.vx, state.car.vy) > 22
    && state.car.vx * nearest.tx + state.car.vy * nearest.ty < -12;
  const gate = GATES[state.nextGate];
  if (continuous && alongRoad && course.travel >= TRACK_LENGTH / GATES.length * .85
    && crossedGate(gate, before, after)) {
    state.lastCheckpoint = state.nextGate;
    course.travel = 0;
    if (state.nextGate === 0) {
      const lapTime = state.elapsed - course.lapStart;
      state.lapTimes.push(lapTime);
      state.bestLap = state.bestLap === null ? lapTime : Math.min(state.bestLap, lapTime);
      state.lapsCompleted += 1;
      state.gateProgress = 0;
      course.lapStart = state.elapsed;
      if (state.lapsCompleted === LAPS) {
        state.phase = 'won';
        state.result = 'finished';
        state.raceTime = state.elapsed;
        state.score = state.elapsed;
      } else state.lap = state.lapsCompleted + 1;
      state.nextGate = 1;
    } else {
      state.gateProgress = state.nextGate;
      state.nextGate = (state.nextGate + 1) % GATES.length;
    }
  }
  state.lapElapsed = state.phase === 'won' ? state.lapTimes.at(-1) : state.elapsed - course.lapStart;
  course.previous = { x: after.x, y: after.y };
  course.lastS = nearest.s;
}

function integrate(state, controls, dt) {
  const car = state.car;
  const nearest = nearestTrack(car.x, car.y);
  const offRoad = clamp((nearest.distance - ROAD_WIDTH / 2 + 3) / 23, 0, 1);
  const cosine = Math.cos(car.heading), sine = Math.sin(car.heading);
  let forward = car.vx * cosine + car.vy * sine;
  let lateral = -car.vx * sine + car.vy * cosine;
  const steering = Number(controls.right) - Number(controls.left);
  const steerAngle = .69 - .22 * Math.min(Math.abs(forward) / MAX_SPEED, 1);
  const targetYaw = clamp(steering * forward / 43 * Math.tan(steerAngle)
    * (controls.handbrake ? 1.22 : 1), -3.8, 3.8);
  car.angularVelocity += (targetYaw - car.angularVelocity) * (1 - Math.exp(-10 * dt));
  if (Math.abs(forward) < .5 && Math.abs(lateral) < .5) car.angularVelocity = 0;
  car.heading = wrapAngle(car.heading + car.angularVelocity * dt);
  const thrust = controls.brake ? (forward > 5 ? -265 : -100) : controls.throttle ? 170 : 0;
  const drag = forward * (.3 + offRoad * 1.65) + Math.sign(forward) * (13 + offRoad * 16);
  const previousForward = forward;
  forward += (thrust - drag - (controls.handbrake ? forward * .8 : 0)) * dt;
  if (thrust === 0 && Math.sign(forward) !== Math.sign(previousForward)) forward = 0;
  forward = clamp(forward, -65, MAX_SPEED - offRoad * 145);
  // Turning changes the body axis; preserve world momentum before tyre grip
  // removes lateral velocity. The handbrake relaxes that grip into a slide.
  const yawDelta = car.angularVelocity * dt;
  const retainedForward = forward * Math.cos(yawDelta) + lateral * Math.sin(yawDelta);
  lateral = lateral * Math.cos(yawDelta) - forward * Math.sin(yawDelta);
  forward = retainedForward;
  lateral *= Math.exp(-(controls.handbrake ? 1.7 : 8.5 + offRoad * 4) * dt);
  const newCos = Math.cos(car.heading), newSin = Math.sin(car.heading);
  car.vx = forward * newCos - lateral * newSin;
  car.vy = forward * newSin + lateral * newCos;
  const velocity = Math.hypot(car.vx, car.vy);
  if (velocity > MAX_SPEED) { car.vx *= MAX_SPEED / velocity; car.vy *= MAX_SPEED / velocity; }
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  if (car.x < 12 || car.x > WORLD.width - 12) {
    car.x = clamp(car.x, 12, WORLD.width - 12); car.vx *= -.15;
  }
  if (car.y < 12 || car.y > WORLD.height - 12) {
    car.y = clamp(car.y, 12, WORLD.height - 12); car.vy *= -.15;
  }
  car.speed = car.vx * newCos + car.vy * newSin;
  car.slip = -car.vx * newSin + car.vy * newCos;
  const after = nearestTrack(car.x, car.y);
  state.onRoad = after.distance <= ROAD_WIDTH / 2;
  updateCourse(state, after, dt);
}

/** Fixed-substep, mutable simulation. Only literal true is a held control. */
export function step(state, input = {}, dt = FIXED_DT) {
  if (state.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return false;
  const controls = {};
  for (const key of ['throttle', 'brake', 'left', 'right', 'handbrake']) controls[key] = input?.[key] === true;
  let remaining = Math.min(dt, .1);
  while (remaining > 1e-8 && state.phase === 'playing') {
    let tick = Math.min(FIXED_DT, remaining);
    remaining -= tick;
    if (state.startDelay > 0) {
      const consumed = Math.min(state.startDelay, tick);
      state.startDelay = Math.max(0, state.startDelay - consumed);
      if (state.startDelay < 1e-9) state.startDelay = 0;
      tick -= consumed;
      if (tick <= 1e-8) continue;
    }
    state.elapsed += tick;
    integrate(state, controls, tick);
  }
  return true;
}

export function togglePause(state) {
  if (state.phase === 'playing') state.phase = 'paused';
  else if (state.phase === 'paused') state.phase = 'playing';
  else return false;
  return true;
}

/** Return to the last earned gate without resetting progress or the clock. */
export function resetCar(state) {
  if (!['playing', 'paused'].includes(state.phase) || state.startDelay > 0) return false;
  const s = state.lastCheckpoint === 0 && state.lapsCompleted === 0
    ? -18 : GATES[state.lastCheckpoint].s + 12;
  state.car = carAt(s);
  state.elapsed += RESET_PENALTY;
  state.penalty += RESET_PENALTY;
  state.lapElapsed = state.elapsed - state.course.lapStart;
  state.onRoad = true;
  state.wrongWay = false;
  state.course.previous = { x: state.car.x, y: state.car.y };
  state.course.lastS = trackInfo(s).s;
  state.course.travel = s < 0 ? 18 : 12;
  return true;
}
