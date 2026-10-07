/** Paris Pedal. All positions and dimensions use metres, speed uses metres/second. */
export const FIXED_DT = 1 / 120;
export const ROAD_HALF = 5;
export const BIKE_WIDTH = 0.62;
export const BIKE_LENGTH = 1.8;
export const HORIZON = 90;
export const MAX_TRAFFIC = 28;
export const DISTRICTS = Object.freeze([
  Object.freeze({ id: 'bastille', title: 'Bastille', length: 500, description: 'Filter through the boulevard queue. Leave room for cyclists.', color: '#ecdab9', accent: '#c16847', trafficSpeed: 1.4 }),
  Object.freeze({ id: 'marais', title: 'Le Marais', length: 520, description: 'Narrow streets, parked doors, and unpredictable cycle traffic.', color: '#f1dfc5', accent: '#76814f', trafficSpeed: 1.2 }),
  Object.freeze({ id: 'rivoli', title: 'Rue de Rivoli', length: 560, description: 'Watch the amber signals before buses leave their stops.', color: '#e7dbc8', accent: '#a37c45', trafficSpeed: 1.6 }),
  Object.freeze({ id: 'seine', title: 'Seine Crossing', length: 480, description: 'Bridge works squeeze the route. Brake before committing.', color: '#dbe5dc', accent: '#608b8f', trafficSpeed: 1.1 }),
  Object.freeze({ id: 'montmartre', title: 'Montmartre', length: 540, description: 'The climb drains momentum. Save assist for your last delivery.', color: '#e7d6d0', accent: '#9d6470', trafficSpeed: 1.3 }),
]);
export const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: 'standard', title: 'Standard', description: 'A gentler start and slower survival acceleration.', deadlines: null, gap: 40, warning: 1.8, drain: 0.095, checkpointBattery: 0.30, startingBattery: 1, survivalStart: 9, survivalRamp: 7, transitionSeconds: 1.7 }),
  Object.freeze({ id: 'veteran', title: 'Veteran', description: 'Tight traffic gaps and a fast opening pace. Use precise steering and short brake bursts.', deadlines: Object.freeze([43, 44.5, 47.5, 41, 48.5]), gap: 32, warning: 1.55, drain: 0.13, checkpointBattery: 0.20, startingBattery: 0.85, survivalStart: 12.5, survivalRamp: 15, transitionSeconds: 1.15, corridorInset: 0.12 }),
  Object.freeze({ id: 'nightmare', title: 'Nightmare', description: 'Narrow corridors, sharper acceleration, and demanding delivery clocks.', deadlines: Object.freeze([41.8, 43.8, 47.2, 40.6, 48]), gap: 30.5, warning: 1.4, drain: 0.15, checkpointBattery: 0.18, startingBattery: 0.75, survivalStart: 14.5, survivalRamp: 19, transitionSeconds: 1.05, corridorInset: 0.185 }),
]);
const LANES = [-3.5, -1.75, 0, 1.75, 3.5];
const COLORS = ['#dfb668', '#bf6b5a', '#85a5a4', '#d5d6ce', '#888f9c', '#a58799'];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const approach = (n, target, amount) => n < target ? Math.min(target, n + amount) : Math.max(target, n - amount);
export function getDifficulty(value = 'veteran') {
  const id = typeof value === 'object' && value !== null ? value.difficulty : value;
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[1];
}
export function getDistrict(state) { return DISTRICTS[state.stageIndex % DISTRICTS.length]; }
export function recordScope(state) {
  return `${state.difficulty}-${state.mode}${state.difficulty === 'standard' ? state.mode === 'survival' ? '-v1' : '' : '-v3'}`;
}
export function usesAutomaticPace(state) {
  return state.mode === 'survival' || state.mode === 'rush' && state.difficulty !== 'standard';
}
export function getTrafficTransitionSeconds(state) {
  const profile = getDifficulty(state);
  if (!usesAutomaticPace(state) || profile.id === 'standard') return profile.transitionSeconds;
  const minimum = profile.id === 'nightmare' ? 1.03 : 1.06;
  return Math.max(minimum, profile.transitionSeconds - Math.min(1, state.elapsed / 180) * (profile.transitionSeconds - minimum));
}
/** Smooth, unbounded acceleration with a gradually slowing growth rate. Active seconds only. */
export function getSurvivalPace(value = 0, difficulty = 'veteran') {
  const elapsed = typeof value === 'object' && value !== null ? value.elapsed : value;
  const profile = getDifficulty(typeof value === 'object' && value !== null ? value : difficulty);
  return profile.survivalStart + profile.survivalRamp * (Math.sqrt(1 + Math.max(0, elapsed) / 60) - 1);
}
function random(state) {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 4294967296;
}
function emit(state, type, details = {}) {
  const event = { id: ++state.eventId, type, time: state.elapsed, x: state.x, z: state.distance, ...details };
  state.lastEvent = event;
  state.events.push(event);
  if (state.events.length > 12) state.events.shift();
}
function actor(state, row, kind, x, z, details = {}) {
  return { id: ++state.trafficId, row, kind, x, z, width: 1.75, length: 4.3, speed: getDistrict(state).trafficSpeed,
    color: COLORS[Math.floor(random(state) * COLORS.length)], targetX: x, targetWidth: 1.75,
    warningTimer: null, warningActive: false, turnSignal: 0, maneuverStarted: false,
    passed: false, crashed: false, alerted: false, ...details };
}
/** Every row reserves a bike-wide corridor, including the complete signalled envelope. */
function spawnRow(state, z) {
  const profile = getDifficulty(state), district = getDistrict(state);
  const row = ++state.rowId;
  const candidates = LANES.map((_, i) => i).filter((i) => i !== state.lastSafeLane && Math.abs(i - state.lastSafeLane) <= 2);
  const safe = candidates[Math.floor(random(state) * candidates.length)];
  state.lastSafeLane = safe;
  const blocked = LANES.map((_, i) => i).filter((i) => i !== safe);
  // The bridge and later rush circuits become busier, while the corridor remains intact.
  if (profile.id === 'standard' && row % 3 === 0) blocked.splice(Math.floor(random(state) * blocked.length), 1);
  for (const lane of blocked) {
    const x = LANES[lane], away = Math.sign(x - LANES[safe]);
    // The two cars beside the free lane sit a little closer to its edges.
    // Their body widths stay physical and neighboring blocked cars never overlap.
    const queuedX = x - (Math.abs(lane - safe) === 1 ? away * (profile.corridorInset ?? 0) : 0);
    // Queued Paris traffic sits bumper-to-bumper at different positions, rather
    // than forming a straight arcade gate. The hash consumes no routing RNG.
    const stagger = (((row * 5 + lane * 11) % 7) - 3) * 0.75;
    const slotZ = z + stagger + (row === 1 ? 2.25 : 0);
    let kind = 'car';
    if (row % 4 === 0 && Math.abs(lane - safe) >= 2 && lane === blocked[0]) kind = 'bus';
    else if (row % 3 === 0 && lane === blocked.at(-1)) kind = 'cyclist';
    else if (row % 5 === 0 && (lane === 0 || lane === 4) && Math.abs(lane - safe) >= 2) kind = 'door';
    else if (district.id === 'seine' && row % 2 === 0) kind = 'barrier';
    let item;
    if (kind === 'bus') item = actor(state, row, kind, x + away * 0.4, slotZ, { width: 2.15, targetWidth: 2.15, length: 8.6, targetX: x - away * 0.25, turnSignal: -away, color: '#789787' });
    else if (kind === 'cyclist') item = actor(state, row, kind, x + away * 0.35, slotZ, { width: 0.72, targetWidth: 0.72, length: 1.85, targetX: x - away * 0.36, turnSignal: -away, color: '#ce704d' });
    else if (kind === 'door') item = actor(state, row, kind, away * 4.35, slotZ - 3, { width: 1.1, targetWidth: 2.3, length: 2, speed: 0, targetX: away * 3.9, turnSignal: -away, color: '#a99179' });
    else if (kind === 'barrier') item = actor(state, row, kind, queuedX, slotZ, { length: 2.3, speed: 0, color: '#de9c59' });
    else item = actor(state, row, kind, queuedX, slotZ);
    state.traffic.push(item);
  }
}
function fillTraffic(state) {
  const profile = getDifficulty(state);
  const normalGap = Math.max(profile.id === 'standard' ? 29 : 28.5, profile.gap - Math.min(3, state.stageIndex * 0.6) - Math.min(2, Math.floor(state.stageIndex / 5)));
  // Preserve physical steering time between the complete bus/stagger envelopes.
  // The extra speed budget covers assist and pace gained before the next row arrives.
  const gap = usesAutomaticPace(state) ? Math.max(normalGap, (state.survivalPace + 3.5) * 1.08 * getTrafficTransitionSeconds(state) + 16) : normalGap;
  state.rowGap = gap;
  state.warningDistance = usesAutomaticPace(state) ? Math.max(36, (state.survivalPace + 3.5) * (profile.warning + 0.8) + 10) : 36;
  state.lookAheadDistance = usesAutomaticPace(state) ? Math.max(HORIZON, state.warningDistance + gap + 10, gap * 3) : HORIZON;
  while (state.nextRowZ < state.distance + state.lookAheadDistance && state.traffic.length <= MAX_TRAFFIC - 4) {
    spawnRow(state, state.nextRowZ);
    state.nextRowZ += gap + random(state) * 4;
  }
}
export function createState({ seed = 73129, mode = 'survival', difficulty = 'veteran' } = {}) {
  if (!['survival', 'delivery', 'rush'].includes(mode)) throw new RangeError('Choose survival, delivery or rush.');
  if (!DIFFICULTIES.some((d) => d.id === difficulty)) throw new RangeError('Choose an available difficulty.');
  if (!Number.isFinite(Number(seed))) throw new TypeError('Seed must be a finite number.');
  const normalizedSeed = Number(seed) >>> 0, profile = getDifficulty(difficulty);
  const state = { gameId: 'paris-pedal', seed: normalizedSeed, rng: normalizedSeed, mode, difficulty, phase: 'playing',
    elapsed: 0, tick: 0, distance: 0, speed: mode === 'survival' || mode === 'rush' && difficulty !== 'standard' ? profile.survivalStart : 8,
    survivalPace: mode === 'survival' || mode === 'rush' && difficulty !== 'standard' ? profile.survivalStart : null,
    x: 0, vx: 0, lean: 0, battery: profile.startingBattery,
    health: 3, score: 0, passPoints: 0, checkpointPoints: 0, combo: 0, comboTimer: 0, totalCrashes: 0,
    stageIndex: 0, stageDistance: 0, stageTotalDistance: DISTRICTS[0].length, stageStartedAt: 0,
    stageCrashes: 0, timeLeft: mode === 'delivery' && profile.deadlines ? profile.deadlines[0] : null,
    deliveries: 0, districtResults: [], traffic: [], trafficId: 0, rowId: 0, lastSafeLane: 2, nextRowZ: 48,
    assistActive: false, assistLocked: false, brakeCharge: 1, brakeActive: false, brakeLocked: false,
    bellCooldown: 0, bellHeld: false, crashCooldown: 0,
    slipstream: false, shoulder: false, eventId: 0, lastEvent: null, events: [], finishTime: null, result: null };
  fillTraffic(state);
  return state;
}
export function togglePause(state) {
  if (state.phase === 'playing') { state.phase = 'paused'; state.assistActive = false; state.bellHeld = false; }
  else if (state.phase === 'paused') state.phase = 'playing';
  return state;
}
function bell(state, input) {
  const held = input.bell === true;
  if (held && !state.bellHeld && state.bellCooldown === 0) {
    state.bellCooldown = 1.2;
    let count = 0;
    for (const item of state.traffic) if (item.kind === 'cyclist' && !item.passed && item.z - state.distance > 2 && item.z - state.distance < 30) {
      item.alerted = true;
      item.targetX = item.x;
      item.turnSignal = 0;
      item.warningActive = false;
      count++;
    }
    emit(state, 'bell', { count });
  }
  state.bellHeld = held;
}
// Continuous relative-motion slab test, including changing widths: no thin door tunnelling.
function sweptTouches(oldX, oldZ, newX, newZ, halfX, halfZ) {
  let enter = 0, exit = 1;
  for (const [start, end, half] of [[oldX, newX, halfX], [oldZ, newZ, halfZ]]) {
    const delta = end - start;
    if (Math.abs(delta) < 1e-12) { if (Math.abs(start) >= half) return false; continue; }
    const a = (-half - start) / delta, b = (half - start) / delta;
    enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
    if (enter >= exit) return false;
  }
  return exit > 0 && enter < 1;
}
function moveTraffic(state, oldDistance, oldBikeX, dt) {
  const profile = getDifficulty(state);
  for (const item of state.traffic) {
    const oldX = item.x, oldZ = item.z, oldWidth = item.width;
    const moving = Math.abs(item.targetX - item.x) > 0.001 || item.targetWidth > item.width + 0.001;
    const ahead = item.z - state.distance;
    if (moving && !item.passed && !item.alerted && item.warningTimer === null && ahead < state.warningDistance) {
      item.warningTimer = profile.warning;
      item.warningActive = true;
      emit(state, `${item.kind}-warning`, { actorId: item.id, x: item.x, z: item.z, targetX: item.targetX });
    }
    if (item.warningTimer !== null && !item.alerted) {
      item.warningTimer = Math.max(0, item.warningTimer - dt);
      if (item.warningTimer === 0) {
        item.maneuverStarted = true;
        item.x = approach(item.x, item.targetX, dt * (item.kind === 'cyclist' ? 0.65 : 0.8));
        item.width = approach(item.width, item.targetWidth, dt * 1.5);
        if (Math.abs(item.x - item.targetX) < 0.001 && Math.abs(item.width - item.targetWidth) < 0.001) {
          item.warningActive = false;
          item.turnSignal = 0;
        }
      }
    }
    item.z += item.speed * dt;
    const collided = !item.crashed && !item.passed && sweptTouches(oldBikeX - oldX, oldZ - oldDistance,
      state.x - item.x, item.z - state.distance, (BIKE_WIDTH + Math.max(item.width, oldWidth)) / 2,
      (BIKE_LENGTH + item.length) / 2);
    if (collided) {
      item.crashed = item.passed = true;
      if (state.crashCooldown === 0) {
        state.health--; state.totalCrashes++; state.stageCrashes++; state.crashCooldown = 1.1;
        state.speed = Math.max(3, state.speed * 0.5); state.combo = 0; state.comboTimer = 0;
        state.assistActive = false;
        emit(state, 'crash', { actorId: item.id, kind: item.kind, x: item.x, z: item.z, health: state.health });
        if (state.health <= 0) {
          state.phase = 'lost'; state.result = 'crashed'; state.assistActive = false; state.brakeActive = false;
          if (state.mode === 'survival') state.finishTime = state.elapsed;
          return;
        }
      }
    }
    // Reward only a completed clearance of the full actor length, never its midpoint.
    if (!item.passed && item.z + (item.length + BIKE_LENGTH) / 2 < state.distance) {
      item.passed = true;
      const clearance = Math.abs(state.x - item.x) - (BIKE_WIDTH + item.width) / 2;
      const near = clearance >= 0 && clearance < 0.50 && state.speed >= 10;
      if (near) { state.combo = Math.min(8, state.combo + 1); state.comboTimer = 6; state.battery = Math.min(1, state.battery + 0.024); }
      const points = 12 + (near ? state.combo * 15 : 0);
      state.passPoints += points;
      emit(state, near ? 'near-pass' : 'pass', { actorId: item.id, x: item.x, z: item.z, points, combo: state.combo });
    }
  }
  state.traffic = state.traffic.filter((item) => item.z > state.distance - 16);
}
function updateStage(state) {
  const profile = getDifficulty(state);
  while (state.stageDistance >= getDistrict(state).length && state.phase === 'playing') {
    const district = getDistrict(state), length = district.length;
    const clean = state.stageCrashes === 0;
    state.deliveries++; state.checkpointPoints += clean ? 500 : 200;
    state.districtResults.push({ id: district.id, title: district.title, clean, time: state.elapsed - state.stageStartedAt, timeLeft: state.timeLeft });
    if (state.districtResults.length > 10) state.districtResults.shift();
    emit(state, 'delivery', { district: district.title, clean, delivery: state.deliveries });
    state.battery = Math.min(1, state.battery + profile.checkpointBattery);
    if (profile.id === 'standard' && clean && state.mode !== 'survival') state.health = Math.min(3, state.health + 1);
    if (state.mode === 'delivery' && state.deliveries === DISTRICTS.length) {
      state.distance = DISTRICTS.reduce((sum, district) => sum + district.length, 0);
      state.stageDistance = length; state.phase = 'won'; state.finishTime = state.elapsed;
      state.result = 'deliveries-complete'; state.assistActive = false;
      state.checkpointPoints += state.health * 300;
      emit(state, 'complete'); return;
    }
    state.stageDistance -= length; state.stageIndex++; state.stageStartedAt = state.elapsed; state.stageCrashes = 0;
    state.stageTotalDistance = getDistrict(state).length;
    state.timeLeft = state.mode === 'delivery' && profile.deadlines ? profile.deadlines[state.stageIndex % DISTRICTS.length] : null;
    emit(state, 'district', { district: getDistrict(state).title, index: state.stageIndex });
  }
}
function integrate(state, input, dt) {
  const profile = getDifficulty(state), district = getDistrict(state);
  const oldX = state.x, oldDistance = state.distance;
  state.elapsed += dt; state.tick++;
  if (usesAutomaticPace(state)) {
    state.survivalPace = getSurvivalPace(state);
    // Holding the brake can buy one short reaction window, never a slower run.
    if (input.brake !== true) {
      state.brakeCharge = Math.min(1, state.brakeCharge + dt * 0.4);
      if (state.brakeCharge >= 0.35) state.brakeLocked = false;
    }
    state.brakeActive = input.brake === true && !state.brakeLocked && state.brakeCharge > 0;
    if (state.brakeActive) {
      state.brakeCharge = Math.max(0, state.brakeCharge - dt * 1.6);
      if (state.brakeCharge === 0) state.brakeLocked = true;
    }
  }
  state.crashCooldown = Math.max(0, state.crashCooldown - dt);
  state.bellCooldown = Math.max(0, state.bellCooldown - dt);
  state.comboTimer = Math.max(0, state.comboTimer - dt); if (!state.comboTimer) state.combo = 0;
  bell(state, input);
  const steer = Number(input.right === true) - Number(input.left === true);
  const targetVx = steer * (state.speed > 5 ? 3.6 : 2.5);
  state.vx += (targetVx - state.vx) * (1 - Math.exp(-18 * dt));
  state.x = clamp(state.x + state.vx * dt, -4.45, 4.45);
  if (Math.abs(state.x) === 4.45 && Math.sign(state.vx) === Math.sign(state.x)) state.vx = 0;
  state.lean = clamp(state.vx / 3.6, -1, 1);
  state.shoulder = Math.abs(state.x) > 4.1;
  state.slipstream = state.traffic.some((item) => !item.passed && (item.kind === 'car' || item.kind === 'bus') &&
    item.z - state.distance > item.length / 2 + BIKE_LENGTH / 2 + 1.5 && item.z - state.distance < 19 && Math.abs(state.x - item.x) < 0.75);
  if (input.assist !== true) state.assistLocked = false;
  state.assistActive = input.assist === true && input.brake !== true && !state.shoulder && !state.assistLocked && state.battery > 0 && state.crashCooldown === 0;
  if (state.assistActive) {
    state.battery = Math.max(0, state.battery - profile.drain * dt);
    if (state.battery === 0) state.assistLocked = true;
  } else {
    const regen = usesAutomaticPace(state)
      ? state.brakeActive ? 0.05 : state.slipstream ? 0.009 : 0.006
      : input.brake === true ? 0.05 : input.throttle !== true ? 0.028 : state.slipstream ? 0.009 : 0.002;
    state.battery = Math.min(1, state.battery + regen * dt);
  }
  const hill = district.id === 'montmartre' ? 0.65 : 0;
  const cruise = input.throttle === true ? 11.5 - hill : 7.4 - hill;
  const targetSpeed = usesAutomaticPace(state)
    ? state.brakeActive ? state.survivalPace * 0.78 : state.survivalPace + (state.assistActive ? 3.5 : input.throttle === true ? 0.65 : 0)
    : state.shoulder ? 5.4 : input.brake === true ? 2.2 : state.assistActive ? 16 - hill : cruise + (state.slipstream ? 0.5 : 0);
  const speedRate = usesAutomaticPace(state)
    ? targetSpeed < state.speed
      ? state.brakeActive ? Math.max(9, state.survivalPace * 0.8) : Math.max(3.5, state.survivalPace * 0.35)
      : Math.max(5.5, state.survivalPace * 0.55)
    : targetSpeed < state.speed ? input.brake === true ? 9 : 3.5 : state.assistActive ? 5 : 3;
  state.speed = approach(state.speed, targetSpeed, speedRate * dt);
  const travel = state.speed * dt; state.distance += travel; state.stageDistance += travel;
  // New rows belong to the same slowly moving queue as existing rows. Keeping
  // the spawn anchor in road coordinates avoids new traffic appearing inside it.
  state.nextRowZ += district.trafficSpeed * dt;
  moveTraffic(state, oldDistance, oldX, dt);
  if (state.phase !== 'playing') { state.score = state.mode === 'survival' ? Math.floor(state.elapsed * 1000) : Math.floor(state.distance) + state.passPoints + state.checkpointPoints; return; }
  if (state.timeLeft !== null) state.timeLeft = Math.max(0, profile.deadlines[state.stageIndex % DISTRICTS.length] - (state.elapsed - state.stageStartedAt));
  // Finishing a checkpoint exactly at the deadline is a valid delivery.
  if (state.timeLeft === 0 && state.stageDistance < district.length) {
    state.phase = 'lost'; state.result = 'delivery-late'; state.assistActive = false;
    emit(state, 'deadline');
  } else updateStage(state);
  fillTraffic(state);
  state.score = state.mode === 'survival' ? Math.floor(state.elapsed * 1000) : Math.floor(state.distance) + state.passPoints + state.checkpointPoints;
}
/** Larger frames are split into fixed-size collision steps; no elapsed time is simulated while paused. */
export function step(state, input = {}, dt = FIXED_DT) {
  if (state.phase !== 'playing') return state;
  if (!Number.isFinite(dt) || dt <= 0) return state;
  let remaining = Math.min(0.1, dt);
  while (remaining > 1e-10 && state.phase === 'playing') {
    const slice = Math.min(FIXED_DT, remaining);
    integrate(state, input, slice);
    remaining -= slice;
  }
  return state;
}
