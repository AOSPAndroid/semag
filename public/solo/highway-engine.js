/** Night Drive: kilometres/hour for speed, metres for longitudinal distance. */
export const LANES = Object.freeze([-0.62, 0, 0.62]);
export const CAR_WIDTH = 0.36;
export const CAR_LENGTH = 4.4;
export const TRAFFIC_SPEED = 80;
export const HORIZON = 160;
export const MAX_STEP = 1 / 20;
export const MAX_HEALTH = 3;

export const FIXED_DT = 1 / 120;
export const DISTRICT_LENGTH = 900;
export const DISTRICTS = Object.freeze([
  Object.freeze({
    id: 'city',
    title: 'Neon City',
    description: 'Three open lanes. Build a clean rhythm.',
    trafficSpeed: 80,
    density: 0.55,
    weather: 'clear',
    pattern: 'flow',
    sky: '#142932',
    ground: '#1b393c',
  }),
  Object.freeze({
    id: 'coast',
    title: 'Coastal Run',
    description: 'Crosswinds and signalling lane changes. Read the arrows.',
    trafficSpeed: 90,
    density: 0.3,
    weather: 'wind',
    pattern: 'merge',
    sky: '#203a53',
    ground: '#305c69',
  }),
  Object.freeze({
    id: 'works',
    title: 'Foundry Works',
    description: 'Stationary road barriers leave one clear corridor. Brake early.',
    trafficSpeed: 0,
    density: 1,
    weather: 'clear',
    pattern: 'barriers',
    sky: '#392e3e',
    ground: '#514648',
  }),
  Object.freeze({
    id: 'storm',
    title: 'Storm Crossing',
    description: 'Wet steering carries momentum. Keep boost for a clean gap.',
    trafficSpeed: 70,
    density: 0.65,
    weather: 'rain',
    pattern: 'flow',
    sky: '#202e41',
    ground: '#354b59',
  }),
  Object.freeze({
    id: 'summit',
    title: 'Summit Express',
    description: 'Alternating zipper gaps reward planned lane changes.',
    trafficSpeed: 95,
    density: 0.9,
    weather: 'clear',
    pattern: 'zipper',
    sky: '#3b3450',
    ground: '#424960',
  }),
]);
export const TOUR_DISTANCE = DISTRICT_LENGTH * DISTRICTS.length;
export const DIFFICULTIES = Object.freeze([
  Object.freeze({
    id: 'standard',
    title: 'Standard',
    rowGap: 1.35,
    densityBonus: 0,
    limits: null,
    boostStart: 1,
    boostDrain: 0.25,
    boostRegen: 0.11,
    nearBoost: 0.12,
    passBoost: 0.01,
    cellBoost: 0.3,
    checkpointBoost: 0.3,
    heal: true,
    bonusTime: 0,
    bonusCap: 0,
    cellEvery: 3,
  }),
  Object.freeze({
    id: 'veteran',
    title: 'Veteran',
    rowGap: 1.04,
    densityBonus: 0.38,
    limits: Object.freeze([20, 19.5, 19.5, 19.5, 19.5]),
    trafficWidth: 0.4,
    wideWidth: 0.44,
    barrierWidth: 0.45,
    windScale: 1.6,
    endlessStart: 180,
    endlessRamp: 100,
    boostStart: 0.65,
    boostDrain: 0.3,
    boostRegen: 0.022,
    nearBoost: 0.07,
    passBoost: 0.002,
    cellBoost: 0.16,
    checkpointBoost: 0.08,
    heal: false,
    bonusTime: 0.2,
    bonusCap: 1.5,
    cellEvery: 4,
  }),
  Object.freeze({
    id: 'nightmare',
    title: 'Nightmare',
    rowGap: 0.96,
    densityBonus: 0.5,
    limits: Object.freeze([19, 18, 18, 18.5, 18]),
    trafficWidth: 0.42,
    wideWidth: 0.46,
    barrierWidth: 0.48,
    windScale: 2.2,
    endlessStart: 190,
    endlessRamp: 120,
    boostStart: 0.55,
    boostDrain: 0.32,
    boostRegen: 0.012,
    nearBoost: 0.055,
    passBoost: 0,
    cellBoost: 0.12,
    checkpointBoost: 0.04,
    heal: false,
    bonusTime: 0.15,
    bonusCap: 1,
    cellEvery: 5,
  }),
]);
export function getDifficulty(value = 'standard') {
  const id = typeof value === 'object' && value !== null ? value.difficulty : value;
  return DIFFICULTIES.find((difficulty) => difficulty.id === id) || DIFFICULTIES[0];
}
export function getDistrict(state) {
  return DISTRICTS[state.districtIndex % DISTRICTS.length];
}
export function recordScope(state) {
  const scope = state.mode === 'tour' ? 'tour' : 'default';
  return getDifficulty(state).id === 'standard' ? scope : `${state.difficulty}-${scope}-${state.mode === 'endless' ? 'v4' : 'v3'}`;
}

const randomSources = new WeakMap();
const COLORS = ['#e4a972', '#8aadb7', '#b2be80', '#b38fb6', '#e5d2a1'];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const approach = (current, target, amount) =>
  current < target ? Math.min(target, current + amount) : Math.max(target, current - amount);

function random(state) {
  const value = (randomSources.get(state) || Math.random)();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('random must return a number from 0 up to, but not including, 1');
  }
  return value;
}

function event(state, type, details = {}) {
  state.events.push({ id: ++state.eventId, type, time: state.elapsed, x: state.x, z: 0, ...details });
  if (state.events.length > 12) state.events.splice(0, state.events.length - 12);
}

/** Strict Endless keeps accelerating while active, independent of driving inputs. */
export function usesEndlessPace(state) {
  return state.mode === 'endless' && state.difficulty !== 'standard';
}
export function getEndlessPace(value = 0, difficulty = 'veteran') {
  const elapsed = typeof value === 'object' && value !== null ? value.elapsed : value;
  const profile = getDifficulty(typeof value === 'object' && value !== null ? value : difficulty);
  return (profile.endlessStart ?? 130) + (profile.endlessRamp ?? 0) * (Math.sqrt(1 + Math.max(0, elapsed) / 60) - 1);
}
export function getEndlessPressure(state) {
  if (!usesEndlessPace(state)) return 0;
  // Fractional time pressure changes within districts; the steering budget
  // has a lower bound so a complete two-lane crossing remains achievable.
  return Math.min(5, Math.max(0, state.elapsed) / 90);
}
export function getDeliveryLimit(state, index = state.districtIndex) {
  const limits = getDifficulty(state).limits;
  return limits ? limits[index % DISTRICTS.length] - getEndlessPressure(state) * (state.difficulty === 'nightmare' ? 0.15 : 0.2) : null;
}
function peakSpeed(state) {
  // Include boost, pace gained while an approaching row is visible, and any
  // transient speed carried from the previous district or an expiring boost.
  return Math.max(state.speed, getEndlessPace(state.elapsed + 8, state.difficulty) + 40);
}
export function rowSpacing(speed, trafficSpeed = TRAFFIC_SPEED, difficulty = 'standard') {
  const pressure = typeof difficulty === 'object' ? getEndlessPressure(difficulty) : 0;
  const reaction = Math.max(0.91, getDifficulty(difficulty).rowGap - pressure * 0.02);
  const budget = typeof difficulty === 'object' && usesEndlessPace(difficulty)
    ? Math.max(220, speed, peakSpeed(difficulty)) : Math.max(220, speed);
  return Math.max(36, ((budget - trafficSpeed) / 3.6) * reaction + 5);
}
function updateEndlessReach(state) {
  if (!usesEndlessPace(state)) return;
  state.endlessPace = getEndlessPace(state);
  const district = getDistrict(state);
  const relativeSpeed = (peakSpeed(state) - district.trafficSpeed) / 3.6;
  state.rowGap = rowSpacing(state.speed, district.trafficSpeed, state);
  state.warningDistance = Math.max(90, relativeSpeed * 2.2 + 10);
  state.lookAheadDistance = Math.max(HORIZON, state.warningDistance + state.rowGap * 2 + 10);
}

function spawnRow(state, z) {
  const district = getDistrict(state);
  const difficulty = getDifficulty(state);
  let safeLane =
    district.pattern === 'zipper'
      ? (state.rowId + 1) % 3
      : district.pattern === 'barriers'
        ? (state.rowId + 2) % 3
        : Math.floor(random(state) * LANES.length);
  if (difficulty.id !== 'standard' && safeLane === state.lastSafeLane)
    safeLane = (safeLane + 1 + Math.floor(random(state) * 2)) % LANES.length;
  state.lastSafeLane = safeLane;
  const candidates = [0, 1, 2].filter((lane) => lane !== safeLane);
  const twoCars = random(state) < Math.min(1, district.density + difficulty.densityBonus + getEndlessPressure(state) * 0.06);
  if (!twoCars) candidates.splice(Math.floor(random(state) * candidates.length), 1);
  const row = ++state.rowId;
  for (const lane of candidates) {
    const wide = random(state) > 0.78;
    state.traffic.push({
      id: ++state.trafficId,
      row,
      lane,
      x: LANES[lane],
      z,
      speed: district.trafficSpeed,
      width: district.pattern === 'barriers' ? difficulty.barrierWidth ?? 0.42 : wide ? difficulty.wideWidth ?? 0.4 : difficulty.trafficWidth ?? 0.34,
      length: district.pattern === 'barriers' ? 2.8 : wide ? 5.3 : 4.3,
      color: COLORS[Math.floor(random(state) * COLORS.length)],
      passed: false,
      crashed: false,
      kind: district.pattern === 'barriers' ? 'barrier' : 'car',
      targetLane:
        district.pattern === 'merge' && !twoCars ? (lane + 1 + Math.floor(random(state) * 2)) % 3 : lane,
      changeTimer: null,
      signal: false,
    });
  }
  if (district.id !== 'city' && row % difficulty.cellEvery === 0 && state.pickups.length < 5)
    state.pickups.push({ id: ++state.pickupId, x: LANES[safeLane], z: z + 8, collected: false });
}

function fillTraffic(state) {
  if (state.traffic.length >= 20) return;
  const district = getDistrict(state);
  let furthest = state.traffic.reduce((max, car) => Math.max(max, car.z), -Infinity);
  const horizon = usesEndlessPace(state) ? state.lookAheadDistance : HORIZON;
  if (!Number.isFinite(furthest)) furthest = horizon - rowSpacing(state.speed, district.trafficSpeed, state);
  while (furthest < horizon && state.traffic.length < 19) {
    furthest += rowSpacing(state.speed, district.trafficSpeed, state) + random(state) * 12;
    spawnRow(state, furthest);
  }
}

/** Mutable, serializable state; the random source itself stays outside it. */
export function createState({
  random: source = Math.random,
  mode = 'endless',
  difficulty = 'standard',
} = {}) {
  if (typeof source !== 'function') throw new TypeError('random must be a function');
  if (!['endless', 'tour'].includes(mode)) throw new RangeError('Choose endless or tour mode.');
  if (!DIFFICULTIES.some((profile) => profile.id === difficulty))
    throw new RangeError('Choose an available difficulty.');
  const profile = getDifficulty(difficulty);
  const state = {
    gameId: 'night-drive',
    phase: 'playing',
    mode,
    difficulty,
    delivery: profile.limits
      ? { limit: profile.limits[0], remaining: profile.limits[0], startedAt: 0, bonus: 0, warned: false }
      : null,
    districtIndex: 0,
    districtId: 'city',
    districtProgress: 0,
    districtWarning: null,
    districtResults: [],
    districtCrashes: 0,
    totalCrashes: 0,
    checkpointPoints: 0,
    pickups: [],
    pickupId: 0,
    finishTime: null,
    x: 0,
    steeringVelocity: 0,
    speed: 100,
    distance: 0,
    score: 0,
    overtakePoints: 0,
    health: MAX_HEALTH,
    boost: profile.boostStart,
    boosting: false,
    boostLocked: false,
    shoulder: false,
    crashCooldown: 0,
    curve: 0,
    elapsed: 0,
    tick: 0,
    combo: 0,
    comboTimer: 0,
    traffic: [],
    trafficId: 0,
    rowId: 0,
    lastSafeLane: null,
    events: [],
    eventId: 0,
    result: null,
    car: { width: CAR_WIDTH, length: CAR_LENGTH },
  };
  if (usesEndlessPace(state)) {
    Object.assign(state, { endlessPace: getEndlessPace(state), brakeCharge: 1, brakeActive: false,
      brakeLocked: false, shoulderExposure: 0, warningDistance: 90, lookAheadDistance: HORIZON, rowGap: 0 });
    updateEndlessReach(state);
  }
  randomSources.set(state, source);
  // An introductory single vehicle leaves either side immediately available.
  state.traffic.push({
    id: ++state.trafficId,
    row: ++state.rowId,
    lane: 1,
    x: 0,
    z: 48,
    speed: TRAFFIC_SPEED,
    width: 0.34,
    length: 4.3,
    color: COLORS[0],
    passed: false,
    crashed: false,
  });
  spawnRow(state, 48 + rowSpacing(220, TRAFFIC_SPEED, state));
  fillTraffic(state);
  return state;
}

function advanceTraffic(state, distance, dt) {
  const difficulty = getDifficulty(state);
  for (const car of state.traffic) {
    const previousZ = car.z;
    if (car.targetLane !== undefined && car.targetLane !== car.lane && !car.passed && !car.crashed) {
      if (car.changeTimer === null && car.z < (usesEndlessPace(state) ? state.warningDistance : 90)) {
        car.changeTimer = 1.2;
        car.signal = true;
        event(state, 'merge-warning', { x: car.x, z: car.z, trafficId: car.id });
      }
      if (car.changeTimer !== null) {
        car.changeTimer = Math.max(0, car.changeTimer - dt);
        if (car.changeTimer === 0) {
          car.x = approach(car.x, LANES[car.targetLane], dt * 0.85);
          if (Math.abs(car.x - LANES[car.targetLane]) < 0.001) {
            car.lane = car.targetLane;
            car.x = LANES[car.lane];
            car.signal = false;
          }
        }
      }
    }
    car.z += (car.speed / 3.6) * dt - distance;
    const lateralGap = Math.abs(state.x - car.x);
    const collisionWidth = (CAR_WIDTH + car.width) / 2;
    const collisionLength = (CAR_LENGTH + car.length) / 2;
    // A swept longitudinal check catches fast cars even on a slower frame.
    const touches =
      Math.min(previousZ, car.z) <= collisionLength && Math.max(previousZ, car.z) >= -collisionLength;
    if (!car.crashed && !car.passed && lateralGap < collisionWidth && touches) {
      car.crashed = true;
      car.passed = true; // A damaged car can never become an overtake reward.
      if (state.crashCooldown <= 0) {
        state.health -= 1;
        state.totalCrashes += 1;
        state.districtCrashes += 1;
        state.crashCooldown = 1.2;
        state.speed = Math.max(45, state.speed * 0.48);
        state.boosting = false;
        state.combo = 0;
        state.comboTimer = 0;
        event(state, 'crash', { x: car.x, z: car.z, trafficId: car.id, health: state.health });
        if (state.health <= 0) {
          state.phase = 'lost';
          state.result = 'crashed';
        }
      }
    }
    if (!car.passed && previousZ > -collisionLength && car.z <= -collisionLength) {
      car.passed = true;
      const base = car.kind === 'barrier' ? 30 : 50;
      let points = base;
      const nearMiss = lateralGap >= collisionWidth && lateralGap < collisionWidth + 0.15;
      if (nearMiss) {
        state.combo = Math.min(5, state.combo + 1);
        state.comboTimer = 8;
        points += 25 * state.combo;
        state.boost = Math.min(1, state.boost + difficulty.nearBoost);
        if (state.delivery && state.speed >= 165)
          state.delivery.bonus = Math.min(difficulty.bonusCap, state.delivery.bonus + difficulty.bonusTime);
      } else state.boost = Math.min(1, state.boost + difficulty.passBoost);
      state.overtakePoints += points;
      event(state, nearMiss ? 'near-miss' : 'pass', {
        x: car.x,
        z: car.z,
        trafficId: car.id,
        points,
        combo: state.combo,
      });
    }
  }
  state.traffic = state.traffic.filter((car) => car.z > -24);
  for (const pickup of state.pickups) {
    const before = pickup.z;
    pickup.z -= distance;
    if (!pickup.collected && before > 0 && pickup.z <= 0 && Math.abs(state.x - pickup.x) < 0.23) {
      pickup.collected = true;
      state.boost = Math.min(1, state.boost + difficulty.cellBoost);
      state.overtakePoints += 35;
      event(state, 'pickup', { x: pickup.x, z: 0, points: 35 });
    }
  }
  state.pickups = state.pickups.filter((pickup) => !pickup.collected && pickup.z > -24);
}
function updateDistrict(state) {
  const reached = Math.floor(state.distance / DISTRICT_LENGTH);
  if (reached > state.districtIndex) {
    const clean = state.districtCrashes === 0,
      district = getDistrict(state),
      difficulty = getDifficulty(state);
    const points = clean ? 600 : 300;
    state.checkpointPoints += points;
    state.districtResults.push({
      id: district.id,
      distance: DISTRICT_LENGTH,
      clean,
      points,
      time: state.elapsed,
      timeLeft: state.delivery?.remaining ?? null,
    });
    if (state.districtResults.length > 10) state.districtResults.splice(0, state.districtResults.length - 10);
    state.boost = Math.min(1, state.boost + difficulty.checkpointBoost);
    if (clean && difficulty.heal) state.health = Math.min(MAX_HEALTH, state.health + 1);
    event(state, 'district-clear', { district: district.title, clean, points });
    if (state.mode === 'tour' && reached >= DISTRICTS.length) {
      state.phase = 'won';
      state.result = 'tour-complete';
      state.distance = TOUR_DISTANCE;
      state.districtProgress = DISTRICT_LENGTH;
      state.finishTime = state.elapsed;
      state.checkpointPoints += state.health * 500 + Math.max(0, Math.round((180 - state.elapsed) * 10));
      state.boosting = false;
      return;
    }
    state.districtIndex = reached;
    state.districtId = getDistrict(state).id;
    state.districtCrashes = 0;
    if (state.delivery) {
      const limit = getDeliveryLimit(state);
      state.delivery = { limit, remaining: limit, startedAt: state.elapsed, bonus: 0, warned: false };
    }
    state.traffic = [];
    state.pickups = [];
    updateEndlessReach(state);
    fillTraffic(state);
    event(state, 'district', { district: getDistrict(state).title, index: state.districtIndex });
  }
  state.districtProgress = state.distance % DISTRICT_LENGTH;
  state.districtWarning =
    state.districtProgress > DISTRICT_LENGTH - 180 &&
    (state.mode === 'endless' || state.districtIndex < DISTRICTS.length - 1)
      ? DISTRICTS[(state.districtIndex + 1) % DISTRICTS.length].id
      : null;
}

/** The view runs fixed 120 Hz updates. Longer frames are bounded to 50 ms. */
function integrate(state, inputs, dt) {
  const district = getDistrict(state);
  const difficulty = getDifficulty(state);
  state.elapsed += dt;
  state.tick += 1;
  const paced = usesEndlessPace(state);
  if (paced) {
    updateEndlessReach(state);
    if (inputs.brake !== true) {
      state.brakeCharge = Math.min(1, state.brakeCharge + dt * 0.4);
      if (state.brakeCharge >= 0.35) state.brakeLocked = false;
    }
    state.brakeActive = inputs.brake === true && !state.brakeLocked && state.brakeCharge > 0;
    if (state.brakeActive) {
      state.brakeCharge = Math.max(0, state.brakeCharge - dt * 1.6);
      if (state.brakeCharge === 0) state.brakeLocked = true;
    }
  }
  state.crashCooldown = Math.max(0, state.crashCooldown - dt);
  state.comboTimer = Math.max(0, state.comboTimer - dt);
  if (!state.comboTimer) state.combo = 0;
  const left = inputs.left === true;
  const right = inputs.right === true;
  const brake = paced ? state.brakeActive : inputs.brake === true;
  const steer = Number(right) - Number(left);
  const steeringTarget = steer * (1.8 + 0.35 * clamp(state.speed / 180, 0, 1));
  state.steeringVelocity +=
    (steeringTarget - state.steeringVelocity) * (1 - Math.exp(-(district.weather === 'rain' ? 8 : 14) * dt));
  const wind =
    district.weather === 'wind'
      ? Math.sin(state.distance / 110) * 0.07
      : district.weather === 'rain'
        ? Math.sin(state.distance / 170) * 0.055
        : 0;
  state.x = clamp(state.x + (state.steeringVelocity + wind * (difficulty.windScale ?? 1)) * dt, -1.18, 1.18);
  if (Math.abs(state.x) >= 1.18 && Math.sign(state.steeringVelocity) === Math.sign(state.x)) {
    state.steeringVelocity = 0;
  }
  const wasShoulder = state.shoulder;
  state.shoulder = Math.abs(state.x) > 0.9;
  if (state.shoulder && !wasShoulder) event(state, 'shoulder');
  if (paced) {
    state.shoulderExposure = state.shoulder ? Math.min(1.4, state.shoulderExposure + dt) : 0;
    if (state.shoulderExposure >= 1.4 && state.crashCooldown === 0) {
      state.shoulderExposure = 0;
      state.health--; state.totalCrashes++; state.districtCrashes++; state.crashCooldown = 1.2;
      state.speed = Math.max(45, state.speed * 0.48); state.combo = 0; state.comboTimer = 0;
      state.boosting = false;
      event(state, 'crash', { kind: 'shoulder', health: state.health });
      if (state.health <= 0) { state.phase = 'lost'; state.result = 'crashed'; state.brakeActive = false; }
    }
  }
  if (inputs.boost !== true) state.boostLocked = false;
  state.boosting =
    inputs.boost === true &&
    inputs.brake !== true &&
    !state.shoulder &&
    !state.boostLocked &&
    state.boost > 0 &&
    state.crashCooldown <= 0;
  if (state.boosting) {
    state.boost = Math.max(0, state.boost - dt * difficulty.boostDrain);
    if (state.boost === 0) state.boostLocked = true;
  } else {
    state.boost = Math.min(1, state.boost + dt * difficulty.boostRegen);
  }
  const target = paced
    ? state.brakeActive ? state.endlessPace * 0.78 : state.endlessPace + (state.boosting ? 40 : inputs.throttle === true ? 10 : 0)
    : state.shoulder
    ? 72
    : brake
      ? 55
      : state.boosting
        ? 220
        : inputs.throttle === true
          ? 180
          : 130;
  const acceleration = paced
    ? target < state.speed ? state.brakeActive ? Math.max(105, state.endlessPace * 0.8) : Math.max(45, state.endlessPace * 0.35)
      : Math.max(state.boosting ? 72 : 60, state.endlessPace * 0.55)
    : target < state.speed ? (brake || state.shoulder ? 105 : 45) : state.boosting ? 72 : 32;
  state.speed = approach(state.speed, target, acceleration * dt);
  const distance = (state.speed / 3.6) * dt;
  state.distance += distance;
  state.curve =
    Math.sin(state.distance / (district.id === 'coast' ? 340 : 520)) *
      (district.id === 'coast' ? 0.48 : 0.32) +
    Math.sin(state.distance / 970) * 0.16;
  advanceTraffic(state, distance, dt);
  if (state.delivery && state.phase === 'playing') {
    state.delivery.remaining = Math.max(
      0,
      state.delivery.limit + state.delivery.bonus - (state.elapsed - state.delivery.startedAt),
    );
    if (state.delivery.remaining <= 4 && !state.delivery.warned) {
      state.delivery.warned = true;
      event(state, 'deadline-warning');
    }
    if (state.elapsed - state.delivery.startedAt > state.delivery.limit + state.delivery.bonus + 1e-9) {
      state.phase = 'lost';
      state.result = 'delivery-missed';
      state.boosting = false;
      event(state, 'deadline-missed');
    }
  }
  if (state.phase === 'playing') updateDistrict(state);
  state.score = Math.floor(state.distance * 0.2) + state.overtakePoints + state.checkpointPoints;
  if (state.phase === 'playing') fillTraffic(state);
  return true;
}

export function step(state, inputs = {}, dt = FIXED_DT) {
  if (state.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return false;
  inputs ??= {};
  let remaining = Math.min(dt, MAX_STEP);
  while (remaining > 1e-9 && state.phase === 'playing') {
    const tick = Math.min(FIXED_DT, remaining);
    remaining -= tick;
    integrate(state, inputs, tick);
  }
  return true;
}

export function togglePause(state) {
  if (state.phase === 'playing') state.phase = 'paused';
  else if (state.phase === 'paused') state.phase = 'playing';
  else return false;
  return true;
}
