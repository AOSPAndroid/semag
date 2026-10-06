/** Night Drive: kilometres/hour for speed, metres for longitudinal distance. */
export const LANES = Object.freeze([-.62, 0, .62]);
export const CAR_WIDTH = .36;
export const CAR_LENGTH = 4.4;
export const TRAFFIC_SPEED = 80;
export const HORIZON = 160;
export const MAX_STEP = 1 / 20;
export const MAX_HEALTH = 3;

const randomSources = new WeakMap();
const COLORS = ['#e4a972', '#8aadb7', '#b2be80', '#b38fb6', '#e5d2a1'];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const approach = (current, target, amount) => current < target
  ? Math.min(target, current + amount) : Math.max(target, current - amount);

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

// At maximum boost this gives over one second between rows, enough to cross
// both lanes. Every row leaves a full lane open. A shared traffic speed keeps
// those openings from collapsing as the rows approach the driver.
export function rowSpacing(speed) {
  return Math.max(36, (Math.max(220, speed) - TRAFFIC_SPEED) / 3.6 * 1.25 + 5);
}

function spawnRow(state, z) {
  const safeLane = Math.floor(random(state) * LANES.length);
  const candidates = [0, 1, 2].filter(lane => lane !== safeLane);
  const twoCars = random(state) > .45;
  if (!twoCars) candidates.splice(Math.floor(random(state) * candidates.length), 1);
  const row = ++state.rowId;
  for (const lane of candidates) {
    const wide = random(state) > .78;
    state.traffic.push({
      id: ++state.trafficId, row, lane, x: LANES[lane], z,
      speed: TRAFFIC_SPEED, width: wide ? .40 : .34,
      length: wide ? 5.3 : 4.3,
      color: COLORS[Math.floor(random(state) * COLORS.length)],
      passed: false, crashed: false,
    });
  }
}

function fillTraffic(state) {
  if (state.traffic.length >= 20) return;
  let furthest = state.traffic.reduce((max, car) => Math.max(max, car.z), -Infinity);
  if (!Number.isFinite(furthest)) furthest = HORIZON - rowSpacing(state.speed);
  while (furthest < HORIZON && state.traffic.length < 19) {
    furthest += rowSpacing(state.speed) + random(state) * 12;
    spawnRow(state, furthest);
  }
}

/** Mutable, serializable state; the random source itself stays outside it. */
export function createState({ random: source = Math.random } = {}) {
  if (typeof source !== 'function') throw new TypeError('random must be a function');
  const state = {
    gameId: 'night-drive', phase: 'playing', x: 0, steeringVelocity: 0,
    speed: 100, distance: 0, score: 0, overtakePoints: 0,
    health: MAX_HEALTH, boost: 1, boosting: false, boostLocked: false,
    shoulder: false, crashCooldown: 0, curve: 0,
    elapsed: 0, tick: 0, combo: 0, comboTimer: 0,
    traffic: [], trafficId: 0, rowId: 0, events: [], eventId: 0, result: null,
    car: { width: CAR_WIDTH, length: CAR_LENGTH },
  };
  randomSources.set(state, source);
  // An introductory single vehicle leaves either side immediately available.
  state.traffic.push({ id: ++state.trafficId, row: ++state.rowId, lane: 1,
    x: 0, z: 48, speed: TRAFFIC_SPEED, width: .34, length: 4.3,
    color: COLORS[0], passed: false, crashed: false });
  spawnRow(state, 104);
  fillTraffic(state);
  return state;
}

function advanceTraffic(state, distance, dt) {
  for (const car of state.traffic) {
    const previousZ = car.z;
    car.z += car.speed / 3.6 * dt - distance;
    const lateralGap = Math.abs(state.x - car.x);
    const collisionWidth = (CAR_WIDTH + car.width) / 2;
    const collisionLength = (CAR_LENGTH + car.length) / 2;
    // A swept longitudinal check catches fast cars even on a slower frame.
    const touches = Math.min(previousZ, car.z) <= collisionLength
      && Math.max(previousZ, car.z) >= -collisionLength;
    if (!car.crashed && !car.passed && lateralGap < collisionWidth && touches) {
      car.crashed = true;
      car.passed = true; // A damaged car can never become an overtake reward.
      if (state.crashCooldown <= 0) {
        state.health -= 1;
        state.crashCooldown = 1.2;
        state.speed = Math.max(45, state.speed * .48);
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
    if (!car.passed && previousZ > 0 && car.z <= 0) {
      car.passed = true;
      state.overtakePoints += 50;
      const nearMiss = lateralGap >= collisionWidth && lateralGap < collisionWidth + .15;
      if (nearMiss) {
        state.combo += 1;
        state.comboTimer = 8;
        state.overtakePoints += 25;
      }
      event(state, nearMiss ? 'near-miss' : 'pass', {
        x: car.x, z: car.z, trafficId: car.id, points: nearMiss ? 75 : 50, combo: state.combo,
      });
    }
  }
  state.traffic = state.traffic.filter(car => car.z > -24);
}

/** The view runs fixed 120 Hz updates. Longer frames are bounded to 50 ms. */
export function step(state, inputs = {}, dt = 1 / 120) {
  if (state.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return false;
  inputs ??= {};
  dt = Math.min(dt, MAX_STEP);
  state.elapsed += dt;
  state.tick += 1;
  state.crashCooldown = Math.max(0, state.crashCooldown - dt);
  state.comboTimer = Math.max(0, state.comboTimer - dt);
  if (!state.comboTimer) state.combo = 0;
  const left = inputs.left === true;
  const right = inputs.right === true;
  const brake = inputs.brake === true;
  const steer = Number(right) - Number(left);
  const steeringTarget = steer * (1.8 + .35 * clamp(state.speed / 180, 0, 1));
  state.steeringVelocity += (steeringTarget - state.steeringVelocity) * (1 - Math.exp(-14 * dt));
  state.x = clamp(state.x + state.steeringVelocity * dt, -1.18, 1.18);
  if (Math.abs(state.x) >= 1.18 && Math.sign(state.steeringVelocity) === Math.sign(state.x)) {
    state.steeringVelocity = 0;
  }
  const wasShoulder = state.shoulder;
  state.shoulder = Math.abs(state.x) > .90;
  if (state.shoulder && !wasShoulder) event(state, 'shoulder');
  if (inputs.boost !== true) state.boostLocked = false;
  state.boosting = inputs.boost === true && !brake && !state.shoulder
    && !state.boostLocked && state.boost > 0 && state.crashCooldown <= 0;
  if (state.boosting) {
    state.boost = Math.max(0, state.boost - dt * .25);
    if (state.boost === 0) state.boostLocked = true;
  } else {
    state.boost = Math.min(1, state.boost + dt * .11);
  }
  const target = state.shoulder ? 72 : brake ? 55 : state.boosting ? 220
    : inputs.throttle === true ? 180 : 130;
  const acceleration = target < state.speed ? (brake || state.shoulder ? 105 : 45)
    : state.boosting ? 72 : 32;
  state.speed = approach(state.speed, target, acceleration * dt);
  const distance = state.speed / 3.6 * dt;
  state.distance += distance;
  state.curve = Math.sin(state.distance / 520) * .32 + Math.sin(state.distance / 970) * .16;
  advanceTraffic(state, distance, dt);
  state.score = Math.floor(state.distance * .2) + state.overtakePoints;
  if (state.phase === 'playing') fillTraffic(state);
  return true;
}

export function togglePause(state) {
  if (state.phase === 'playing') state.phase = 'paused';
  else if (state.phase === 'paused') state.phase = 'playing';
  else return false;
  return true;
}
