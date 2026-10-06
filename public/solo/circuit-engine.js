export const WORLD = Object.freeze({ width: 1000, height: 680 });
export const ROAD_WIDTH = 90;
export const MAX_SPEED = 220;
export const LAPS = 3;
export const FIXED_DT = 1 / 120;
export const RESET_PENALTY = 3;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const TRACK_DEFINITIONS = [
  {
    id: 'meadow-loop',
    title: 'Meadow Loop',
    surface: 'dry',
    roadWidth: 90,
    grip: 1,
    topSpeed: 220,
    description: 'Open straights and a flowing chicane. Learn the racing line.',
    targets: [96, 115, 150],
    anchors: [
      [460, 564],
      [665, 562],
      [822, 532],
      [888, 434],
      [870, 277],
      [836, 157],
      [731, 112],
      [612, 112],
      [545, 184],
      [475, 184],
      [409, 112],
      [269, 116],
      [153, 186],
      [115, 319],
      [142, 456],
      [244, 541],
    ],
  },
  {
    id: 'harbor-ring',
    title: 'Harbor Ring',
    surface: 'coastal',
    roadWidth: 76,
    grip: 1.08,
    topSpeed: 220,
    description: 'Narrow dockside lanes, tight hairpins and a late apex.',
    targets: [110, 135, 175],
    anchors: [
      [460, 564],
      [710, 568],
      [868, 505],
      [905, 360],
      [838, 275],
      [852, 147],
      [712, 96],
      [555, 127],
      [500, 241],
      [380, 225],
      [327, 122],
      [195, 141],
      [103, 288],
      [130, 449],
      [247, 529],
    ],
  },
  {
    id: 'rain-pass',
    title: 'Rain Pass',
    surface: 'rain',
    roadWidth: 86,
    grip: 0.82,
    topSpeed: 205,
    description: 'Wet mountain switchbacks. Blue slick zones demand gentle throttle.',
    targets: [110, 140, 185],
    anchors: [
      [460, 566],
      [670, 566],
      [834, 505],
      [881, 378],
      [840, 246],
      [829, 144],
      [717, 100],
      [606, 122],
      [556, 200],
      [467, 205],
      [413, 121],
      [280, 119],
      [163, 191],
      [124, 315],
      [153, 453],
      [275, 542],
    ],
  },
];
function spline(a, b, c, d, t) {
  const t2 = t * t,
    t3 = t2 * t;
  const coordinate = (key) =>
    0.5 *
    (2 * b[key] +
      (-a[key] + c[key]) * t +
      (2 * a[key] - 5 * b[key] + 4 * c[key] - d[key]) * t2 +
      (-a[key] + 3 * b[key] - 3 * c[key] + d[key]) * t3);
  return { x: coordinate('x'), y: coordinate('y') };
}
function infoAt(track, courseDistance = 0) {
  const s = Number.isFinite(courseDistance)
    ? ((courseDistance % track.length) + track.length) % track.length
    : 0;
  const scaled = (s / track.length) * track.points.length,
    index = Math.floor(scaled),
    portion = scaled - index;
  const a = track.points[index],
    b = track.points[(index + 1) % track.points.length];
  const tx = a.tx + (b.tx - a.tx) * portion,
    ty = a.ty + (b.ty - a.ty) * portion,
    norm = Math.hypot(tx, ty);
  return {
    x: a.x + (b.x - a.x) * portion,
    y: a.y + (b.y - a.y) * portion,
    s,
    index,
    tx: tx / norm,
    ty: ty / norm,
    heading: Math.atan2(ty, tx),
  };
}
function buildTrack(definition) {
  const anchors = definition.anchors.map(([x, y]) => ({ x, y })),
    raw = [];
  for (let i = 0; i < anchors.length; i += 1)
    for (let j = 0; j < 36; j += 1)
      raw.push(
        spline(
          anchors[(i + anchors.length - 1) % anchors.length],
          anchors[i],
          anchors[(i + 1) % anchors.length],
          anchors[(i + 2) % anchors.length],
          j / 36,
        ),
      );
  const lengths = [0];
  for (let i = 1; i <= raw.length; i += 1)
    lengths.push(lengths[i - 1] + distance(raw[i - 1], raw[i % raw.length]));
  const length = lengths.at(-1),
    count = Math.ceil(length / 6),
    points = [];
  let index = 0;
  for (let i = 0; i < count; i += 1) {
    const s = (length * i) / count;
    while (lengths[index + 1] < s) index += 1;
    const a = raw[index],
      b = raw[(index + 1) % raw.length],
      portion = (s - lengths[index]) / (lengths[index + 1] - lengths[index]);
    points.push({ x: a.x + (b.x - a.x) * portion, y: a.y + (b.y - a.y) * portion, s });
  }
  const track = {
    ...definition,
    length,
    points: Object.freeze(
      points.map((point, index) => {
        const before = points[(index + points.length - 1) % points.length],
          after = points[(index + 1) % points.length],
          norm = distance(before, after);
        return Object.freeze({ ...point, tx: (after.x - before.x) / norm, ty: (after.y - before.y) / norm });
      }),
    ),
  };
  track.gates = Object.freeze(
    Array.from({ length: 12 }, (_, index) => {
      const info = infoAt(track, (length * index) / 12);
      return Object.freeze({ ...info, index, nx: -info.ty, ny: info.tx });
    }),
  );
  return Object.freeze(track);
}
export const TRACKS = Object.freeze(TRACK_DEFINITIONS.map(buildTrack));
/** Legacy exports retain the original default course. */
export const TRACK = TRACKS[0].points,
  TRACK_LENGTH = TRACKS[0].length,
  GATES = TRACKS[0].gates;
export function getTrack(value = 'meadow-loop') {
  const id = typeof value === 'object' && value !== null ? value.trackId : value;
  return TRACKS.find((track) => track.id === id) || TRACKS[0];
}
export function trackInfo(courseDistance = 0, track = 'meadow-loop') {
  return infoAt(getTrack(track), courseDistance);
}
export function nearestTrack(x, y, track = 'meadow-loop') {
  if (typeof x === 'object' && x !== null) ({ x, y } = x);
  const course = getTrack(track),
    points = course.points;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { ...infoAt(course, 0), distance: Infinity };
  let best = null,
    bestSquared = Infinity;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index],
      b = points[(index + 1) % points.length],
      dx = b.x - a.x,
      dy = b.y - a.y;
    const portion = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy), 0, 1),
      px = a.x + dx * portion,
      py = a.y + dy * portion,
      squared = (x - px) ** 2 + (y - py) ** 2;
    if (squared < bestSquared) {
      bestSquared = squared;
      best = { x: px, y: py, index, portion };
    }
  }
  const info = infoAt(course, (course.length * (best.index + best.portion)) / points.length);
  return { ...info, x: best.x, y: best.y, distance: Math.sqrt(bestSquared) };
}
export function medalForTime(time, track = 'meadow-loop') {
  if (!Number.isFinite(time) || time <= 0) return null;
  const targets = getTrack(track).targets;
  return time <= targets[0]
    ? 'gold'
    : time <= targets[1]
      ? 'silver'
      : time <= targets[2]
        ? 'bronze'
        : 'finish';
}
export function recordScope(state) {
  return state.mode === 'championship'
    ? 'championship'
    : state.trackId === 'meadow-loop'
      ? 'three-laps'
      : `${state.trackId}-three-laps`;
}

function carAt(s, track) {
  const point = trackInfo(s, track);
  return {
    x: point.x,
    y: point.y,
    heading: point.heading,
    vx: 0,
    vy: 0,
    speed: 0,
    angularVelocity: 0,
    slip: 0,
  };
}

export function createState({ trackId = 'meadow-loop', mode = 'time-trial' } = {}) {
  if (!TRACKS.some((track) => track.id === trackId)) throw new RangeError('Choose an available circuit.');
  if (!['time-trial', 'championship'].includes(mode))
    throw new RangeError('Choose time-trial or championship.');
  if (mode === 'championship') trackId = TRACKS[0].id;
  const track = getTrack(trackId),
    car = carAt(-18, trackId);
  return {
    gameId: 'apex-circuit',
    phase: 'playing',
    startDelay: 1,
    mode,
    trackId,
    trackIndex: 0,
    pausedPhase: null,
    seriesTime: 0,
    seriesResults: [],
    medal: null,
    surface: track.surface,
    slick: false,
    elapsed: 0,
    lapElapsed: 0,
    penalty: 0,
    lap: 1,
    lapsCompleted: 0,
    lapTimes: [],
    bestLap: null,
    raceTime: null,
    nextGate: 1,
    gateProgress: 0,
    lastCheckpoint: 0,
    car,
    onRoad: true,
    wrongWay: false,
    score: 0,
    result: null,
    course: { previous: { x: car.x, y: car.y }, lastS: track.length - 18, travel: 18, lapStart: 0 },
  };
}

function crossedGate(gate, before, after, roadWidth) {
  const beforeSide = (before.x - gate.x) * gate.tx + (before.y - gate.y) * gate.ty;
  const afterSide = (after.x - gate.x) * gate.tx + (after.y - gate.y) * gate.ty;
  if (beforeSide >= 0 || afterSide < 0 || afterSide <= beforeSide) return false;
  const portion = -beforeSide / (afterSide - beforeSide);
  const x = before.x + (after.x - before.x) * portion;
  const y = before.y + (after.y - before.y) * portion;
  return Math.abs((x - gate.x) * gate.nx + (y - gate.y) * gate.ny) <= roadWidth / 2;
}

function updateCourse(state, nearest, dt) {
  const track = getTrack(state),
    trackLength = track.length,
    gates = track.gates;
  const course = state.course,
    before = course.previous,
    after = state.car;
  const moved = distance(before, after);
  let advance = nearest.s - course.lastS;
  if (advance > trackLength / 2) advance -= trackLength;
  if (advance < -trackLength / 2) advance += trackLength;
  // Credit only continuous movement along the road. Teleporting between gates
  // or cutting across the infield cannot turn into a lap on the finish line.
  const continuous = moved <= MAX_SPEED * dt * 1.35 + 1;
  const alongRoad = state.onRoad && Math.abs(advance) <= moved * 1.8 + 0.25;
  if (!continuous) course.travel = 0;
  else if (alongRoad) course.travel = Math.max(0, course.travel + advance);
  state.wrongWay =
    Math.hypot(state.car.vx, state.car.vy) > 22 &&
    state.car.vx * nearest.tx + state.car.vy * nearest.ty < -12;
  const gate = gates[state.nextGate];
  if (
    continuous &&
    alongRoad &&
    course.travel >= (trackLength / gates.length) * 0.85 &&
    crossedGate(gate, before, after, track.roadWidth)
  ) {
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
        state.raceTime = state.elapsed;
        state.medal = medalForTime(state.raceTime, state.trackId);
        if (state.mode === 'championship') {
          state.seriesTime += state.raceTime;
          state.seriesResults.push({ trackId: state.trackId, time: state.raceTime, medal: state.medal });
          if (state.trackIndex < TRACKS.length - 1) {
            state.phase = 'stage-clear';
            state.result = 'race-complete';
          } else {
            state.phase = 'won';
            state.result = 'champion';
            state.raceTime = state.seriesTime;
          }
        } else {
          state.phase = 'won';
          state.result = 'finished';
        }
        state.score = state.mode === 'championship' ? state.seriesTime : state.elapsed;
      } else state.lap = state.lapsCompleted + 1;
      state.nextGate = 1;
    } else {
      state.gateProgress = state.nextGate;
      state.nextGate = (state.nextGate + 1) % gates.length;
    }
  }
  state.lapElapsed = ['won', 'stage-clear'].includes(state.phase)
    ? state.lapTimes.at(-1)
    : state.elapsed - course.lapStart;
  course.previous = { x: after.x, y: after.y };
  course.lastS = nearest.s;
}

function integrate(state, controls, dt) {
  const car = state.car,
    track = getTrack(state);
  const nearest = nearestTrack(car.x, car.y, track.id);
  const offRoad = clamp((nearest.distance - track.roadWidth / 2 + 3) / 23, 0, 1);
  const cosine = Math.cos(car.heading),
    sine = Math.sin(car.heading);
  let forward = car.vx * cosine + car.vy * sine;
  let lateral = -car.vx * sine + car.vy * cosine;
  const steering = Number(controls.right) - Number(controls.left);
  const steerAngle = 0.69 - 0.22 * Math.min(Math.abs(forward) / MAX_SPEED, 1);
  const targetYaw = clamp(
    ((steering * forward) / 43) * Math.tan(steerAngle) * (controls.handbrake ? 1.22 : 1),
    -3.8,
    3.8,
  );
  car.angularVelocity += (targetYaw - car.angularVelocity) * (1 - Math.exp(-10 * dt));
  if (Math.abs(forward) < 0.5 && Math.abs(lateral) < 0.5) car.angularVelocity = 0;
  car.heading = wrapAngle(car.heading + car.angularVelocity * dt);
  const thrust = controls.brake ? (forward > 5 ? -265 : -100) : controls.throttle ? 170 : 0;
  const drag = forward * (0.3 + offRoad * 1.65) + Math.sign(forward) * (13 + offRoad * 16);
  const previousForward = forward;
  forward += (thrust - drag - (controls.handbrake ? forward * 0.8 : 0)) * dt;
  if (thrust === 0 && Math.sign(forward) !== Math.sign(previousForward)) forward = 0;
  forward = clamp(forward, -65, track.topSpeed - offRoad * 145);
  // Turning changes the body axis; preserve world momentum before tyre grip
  // removes lateral velocity. The handbrake relaxes that grip into a slide.
  const yawDelta = car.angularVelocity * dt;
  const retainedForward = forward * Math.cos(yawDelta) + lateral * Math.sin(yawDelta);
  lateral = lateral * Math.cos(yawDelta) - forward * Math.sin(yawDelta);
  forward = retainedForward;
  const fraction = nearest.s / track.length;
  state.slick =
    track.surface === 'rain' &&
    ((fraction > 0.18 && fraction < 0.32) || (fraction > 0.61 && fraction < 0.75));
  const grip = track.grip * (state.slick ? 0.76 : 1);
  lateral *= Math.exp(-(controls.handbrake ? 1.7 * grip : 8.5 * grip + offRoad * 4) * dt);
  const newCos = Math.cos(car.heading),
    newSin = Math.sin(car.heading);
  car.vx = forward * newCos - lateral * newSin;
  car.vy = forward * newSin + lateral * newCos;
  const velocity = Math.hypot(car.vx, car.vy);
  if (velocity > track.topSpeed) {
    car.vx *= track.topSpeed / velocity;
    car.vy *= track.topSpeed / velocity;
  }
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  if (car.x < 12 || car.x > WORLD.width - 12) {
    car.x = clamp(car.x, 12, WORLD.width - 12);
    car.vx *= -0.15;
  }
  if (car.y < 12 || car.y > WORLD.height - 12) {
    car.y = clamp(car.y, 12, WORLD.height - 12);
    car.vy *= -0.15;
  }
  car.speed = car.vx * newCos + car.vy * newSin;
  car.slip = -car.vx * newSin + car.vy * newCos;
  const after = nearestTrack(car.x, car.y, track.id);
  state.onRoad = after.distance <= track.roadWidth / 2;
  updateCourse(state, after, dt);
}

/** Fixed-substep, mutable simulation. Only literal true is a held control. */
export function step(state, input = {}, dt = FIXED_DT) {
  if (state.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return false;
  const controls = {};
  for (const key of ['throttle', 'brake', 'left', 'right', 'handbrake'])
    controls[key] = input?.[key] === true;
  let remaining = Math.min(dt, 0.1);
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
  if (['playing', 'stage-clear'].includes(state.phase)) {
    state.pausedPhase = state.phase;
    state.phase = 'paused';
  } else if (state.phase === 'paused') {
    state.phase = state.pausedPhase || 'playing';
    state.pausedPhase = null;
  } else return false;
  return true;
}

/** Return to the last earned gate without resetting progress or the clock. */
export function resetCar(state) {
  if (
    !(state.phase === 'playing' || (state.phase === 'paused' && state.pausedPhase === 'playing')) ||
    state.startDelay > 0
  )
    return false;
  const gates = getTrack(state).gates;
  const s =
    state.lastCheckpoint === 0 && state.lapsCompleted === 0 ? -18 : gates[state.lastCheckpoint].s + 12;
  state.car = carAt(s, state.trackId);
  state.elapsed += RESET_PENALTY;
  state.penalty += RESET_PENALTY;
  state.lapElapsed = state.elapsed - state.course.lapStart;
  state.onRoad = true;
  state.wrongWay = false;
  state.course.previous = { x: state.car.x, y: state.car.y };
  state.course.lastS = trackInfo(s, state.trackId).s;
  state.course.travel = s < 0 ? 18 : 12;
  return true;
}

/** Explicit continuation preserves the championship total and completed races. */
export function advanceStage(state) {
  if (state.mode !== 'championship' || state.phase !== 'stage-clear' || state.trackIndex >= TRACKS.length - 1)
    return false;
  const trackIndex = state.trackIndex + 1,
    seriesTime = state.seriesTime,
    seriesResults = state.seriesResults;
  const next = createState({ trackId: TRACKS[trackIndex].id });
  Object.assign(state, next, { mode: 'championship', trackIndex, seriesTime, seriesResults });
  return true;
}
