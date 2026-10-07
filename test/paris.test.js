import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BIKE_LENGTH, BIKE_WIDTH, DISTRICTS, DIFFICULTIES, FIXED_DT, HORIZON, MAX_TRAFFIC, ROAD_HALF,
  createState, getDifficulty, getDistrict, getSurvivalPace, getTrafficTransitionSeconds, usesAutomaticPace, recordScope, step, togglePause,
} from '../public/solo/paris-engine.js';

const TOTAL = DISTRICTS.reduce((sum, district) => sum + district.length, 0);
function drive(state, seconds, input = {}) {
  for (let tick = 0; tick < Math.ceil(seconds / FIXED_DT) && state.phase === 'playing'; tick++)
    step(state, typeof input === 'function' ? input(state) : input);
  return state;
}
function emptyRoad(state) {
  state.traffic = [];
  state.nextRowZ = 1e9;
  return state;
}
function threat(overrides = {}) {
  return { id: 1000, row: 1000, kind: 'car', x: 0, z: 8, width: 1.75, targetWidth: 1.75,
    length: 4.3, speed: 0, color: '#ccc', targetX: 0, warningTimer: null, warningActive: false,
    turnSignal: 0, maneuverStarted: false, passed: false, crashed: false, alerted: false, ...overrides };
}

/** A controller reading visible actor envelopes at 15 Hz; it never moves or edits the game. */
function rider({ precise = false, assist = true } = {}) {
  let assistHeld = false;
  return (state) => {
    if (state.battery < 0.015) assistHeld = false;
    else if (state.battery > 0.17) assistHeld = true;
    const forward = state.traffic.filter((actor) => !actor.passed && actor.z + (actor.length + BIKE_LENGTH) / 2 > state.distance)
      .sort((a, b) => a.z - b.z);
    let target = state.x;
    if (forward.length) {
      // Keep the whole row's geometry until its last long bus/vehicle is cleared.
      const row = state.traffic.filter((actor) => actor.row === forward[0].row);
      const intervals = row.map((actor) => {
        const half = (Math.max(actor.width, actor.targetWidth) + BIKE_WIDTH) / 2 + 0.10;
        return [Math.min(actor.x, actor.targetX) - half, Math.max(actor.x, actor.targetX) + half];
      }).sort((a, b) => a[0] - b[0]);
      let from = -4.05;
      const gaps = [];
      for (const [lo, hi] of intervals) {
        if (lo > from) gaps.push([from, Math.min(lo, 4.05)]);
        from = Math.max(from, hi);
      }
      if (from < 4.05) gaps.push([from, 4.05]);
      const cost = ([lo, hi]) => Math.abs((lo + hi) / 2 - state.x) - (hi - lo) * 0.20;
      const valid = gaps.filter(([lo, hi]) => hi > lo).sort((a, b) => cost(a) - cost(b));
      if (valid.length) {
        const [lo, hi] = valid[0];
        target = precise ? (lo < -4 ? hi - 0.24 : lo + 0.24) : (lo + hi) / 2;
        target = Math.max(lo + 0.10, Math.min(hi - 0.10, target));
      }
    }
    const error = target - state.x - state.vx * 0.10;
    return { left: error < -0.085, right: error > 0.085, throttle: true,
      assist: assist && assistHeld, bell: state.tick % 240 === 0 };
  };
}
function route(state, controller = rider()) {
  let input = {};
  for (let tick = 0; tick < 120 * 290 && state.phase === 'playing'; tick++) {
    if (tick % 8 === 0) input = controller(state);
    step(state, input);
  }
  return state;
}

test('Legacy Paris Pedal starts as a seeded Veteran delivery with readable physical units', () => {
  const state = createState({ mode: 'delivery', seed: 19 });
  assert.equal(state.gameId, 'paris-pedal');
  assert.equal(state.phase, 'playing');
  assert.equal(state.mode, 'delivery');
  assert.equal(state.difficulty, 'veteran');
  assert.equal(state.health, 3);
  assert.equal(state.stageTotalDistance, 500);
  assert.equal(state.timeLeft, 43);
  assert.equal(state.speed, 8);
  assert.equal(getDistrict(state).title, 'Bastille');
  assert.equal(ROAD_HALF, 5);
  assert.ok(BIKE_WIDTH < 1 && BIKE_LENGTH < 2 && HORIZON >= 80);
  assert.ok(state.traffic.every((actor) => actor.z >= 48));
});

test('mode, difficulty and seed validation prevents impossible cabinet configurations', () => {
  assert.throws(() => createState({ mode: 'race' }), RangeError);
  assert.throws(() => createState({ mode: 'delivery', difficulty: 'impossible' }), RangeError);
  assert.throws(() => createState({ mode: 'delivery', seed: 'bad' }), TypeError);
  assert.equal(createState({ mode: 'delivery', seed: 0 }).seed, 0);
  assert.equal(createState({ mode: 'delivery', seed: -1 }).seed, 4294967295);
});

test('all six difficulty and mode combinations have independent explicit record scopes', () => {
  const scopes = new Set();
  for (const profile of DIFFICULTIES) for (const mode of ['delivery', 'rush']) {
    const state = createState({ mode: 'delivery', difficulty: profile.id, mode });
    assert.equal(recordScope(state), `${profile.id}-${mode}${profile.id === 'standard' ? '' : '-v3'}`);
    assert.equal(getDifficulty(state), profile);
    scopes.add(recordScope(state));
    if (mode === 'rush' || profile.id === 'standard') assert.equal(state.timeLeft, null);
  }
  assert.equal(scopes.size, 6);
});

test('seed replay remains deterministic through generated rows, warnings and inputs', () => {
  const a = createState({ seed: 37, mode: 'rush' }), b = createState({ seed: 37, mode: 'rush' });
  const input = (state) => ({ throttle: true, right: state.tick % 350 < 170, left: state.tick % 350 > 230, bell: state.tick % 190 === 0 });
  drive(a, 35, input); drive(b, 35, input);
  assert.deepEqual(a, b);
  assert.notDeepEqual(createState({ mode: 'delivery', seed: 37 }).traffic, createState({ mode: 'delivery', seed: 38 }).traffic);
});

test('the queue staggers physical vehicle positions instead of drawing straight traffic gates', () => {
  const state = createState({ mode: 'delivery', seed: 19 });
  for (const row of new Set(state.traffic.map((actor) => actor.row))) {
    const actors = state.traffic.filter((actor) => actor.row === row);
    assert.ok(new Set(actors.map((actor) => actor.z)).size >= 3);
    assert.ok(Math.max(...actors.map((actor) => actor.z)) - Math.min(...actors.map((actor) => actor.z)) <= 4.5);
  }
});

test('paused and terminal runs freeze every simulation field and cannot be revived by pause', () => {
  const state = createState({ mode: 'delivery' });
  togglePause(state);
  const frozen = structuredClone(state);
  for (let i = 0; i < 100; i++) step(state, { throttle: true, right: true, assist: true, bell: true });
  assert.deepEqual(state, frozen);
  togglePause(state);
  assert.equal(state.phase, 'playing');
  for (const phase of ['lost', 'won']) {
    state.phase = phase;
    const terminal = structuredClone(state);
    togglePause(state); step(state, { throttle: true }, 0.1);
    assert.deepEqual(state, terminal);
  }
});

test('steering is immediately responsive, damped, bounded and cancels opposite keys', () => {
  const state = emptyRoad(createState({ mode: 'delivery' }));
  step(state, { right: true });
  assert.ok(state.x > 0 && state.x < 0.01);
  drive(state, 0.4, { right: true });
  assert.ok(state.x > 1 && state.vx > 3);
  drive(state, 0.5, { left: true, right: true });
  assert.ok(Math.abs(state.vx) < 0.001);
  drive(state, 4, { left: true });
  assert.equal(state.x, -4.45);
  assert.equal(state.vx, 0);
  assert.equal(state.shoulder, true);
  assert.ok(state.speed < 6);
});

test('throttle, deliberate braking and coast regeneration have distinct useful effects', () => {
  const state = emptyRoad(createState({ mode: 'delivery' }));
  drive(state, 2, { throttle: true });
  assert.equal(state.speed, 11.5);
  drive(state, 1, { throttle: true, brake: true });
  assert.ok(state.speed < 3);
  state.battery = 0.2;
  drive(state, 2, { throttle: true });
  const throttleGain = state.battery - 0.2;
  state.battery = 0.2;
  drive(state, 2, {});
  const coastGain = state.battery - 0.2;
  state.battery = 0.2;
  drive(state, 2, { brake: true });
  assert.ok(coastGain > throttleGain * 10);
  assert.ok(state.battery - 0.2 > coastGain);
});

test('assist spends finite battery, locks when exhausted, and braking takes priority', () => {
  const state = emptyRoad(createState({ mode: 'delivery' }));
  drive(state, 1.7, { throttle: true, assist: true });
  assert.equal(state.speed, 16);
  assert.ok(state.battery < 0.65);
  state.battery = 0.01;
  drive(state, 1, { throttle: true, assist: true });
  assert.equal(state.assistActive, false);
  assert.equal(state.assistLocked, true);
  step(state, { assist: false });
  assert.equal(state.assistLocked, false);
  step(state, { assist: true, brake: true });
  assert.equal(state.assistActive, false);
});

test('slipstream rewards following distance but never the occupied collision envelope', () => {
  const state = emptyRoad(createState({ mode: 'rush' }));
  state.traffic = [threat({ z: 15, speed: 11.5 })];
  step(state, { throttle: true });
  assert.equal(state.slipstream, true);
  const gain = state.battery;
  state.traffic[0].x = 3;
  step(state, { throttle: true });
  assert.equal(state.slipstream, false);
  assert.ok(gain > getDifficulty(state).startingBattery);
});

test('bell is edge triggered, has a cooldown, and warns cyclists rather than buses or doors', () => {
  const state = emptyRoad(createState({ mode: 'rush' }));
  state.traffic = [threat({ kind: 'cyclist', id: 1, z: 20, x: 2, targetX: 1.5, width: 0.72, targetWidth: 0.72 }),
    threat({ kind: 'bus', id: 2, z: 22, x: -3, targetX: -2 }),
    threat({ kind: 'door', id: 3, z: 25, x: 4.3, targetX: 3.9 })];
  step(state, { bell: true });
  assert.equal(state.traffic[0].alerted, true);
  assert.equal(state.traffic[0].targetX, 2);
  assert.equal(state.traffic[1].alerted, false);
  assert.equal(state.traffic[2].alerted, false);
  const count = state.events.filter((event) => event.type === 'bell').length;
  drive(state, 0.8, { bell: true });
  assert.equal(state.events.filter((event) => event.type === 'bell').length, count);
  step(state, { bell: false }); step(state, { bell: true });
  assert.equal(state.events.filter((event) => event.type === 'bell').length, count);
  drive(state, 0.5, { bell: false }); step(state, { bell: true });
  assert.equal(state.events.filter((event) => event.type === 'bell').length, count + 1);
});

test('bus pullouts, cyclist veers and parked doors warn before any lateral movement', () => {
  for (const difficulty of ['standard', 'veteran', 'nightmare']) for (const kind of ['bus', 'cyclist', 'door']) {
    const state = emptyRoad(createState({ difficulty, mode: 'rush' }));
    state.traffic = [threat({ kind, z: 32, x: -3.5, targetX: -2.8, targetWidth: kind === 'door' ? 2.3 : 1.75 })];
    step(state, { brake: true });
    const actor = state.traffic[0];
    assert.equal(actor.warningActive, true);
    assert.ok(actor.warningTimer >= 1.39);
    assert.equal(actor.x, -3.5);
    const duration = actor.warningTimer;
    drive(state, duration - FIXED_DT * 2, { brake: true });
    assert.equal(actor.x, -3.5);
    assert.equal(actor.maneuverStarted, false);
    drive(state, FIXED_DT * 4, { brake: true });
    assert.ok(actor.x > -3.5);
    assert.equal(actor.maneuverStarted, true);
  }
});

test('generated corridors remain bike-wide through each complete signalled hazard envelope', () => {
  const seen = new Set(), checked = new Set();
  for (const difficulty of ['veteran', 'nightmare']) for (const seed of [1, 7, 31]) {
    const state = createState({ mode: 'delivery', seed, difficulty }), control = rider({ precise: difficulty === 'nightmare' });
    let input = {};
    for (let tick = 0; tick < 120 * 290 && state.phase === 'playing'; tick++) {
      if (tick % 8 === 0) input = control(state);
      step(state, input);
      if (tick % 120 !== 0) continue;
      assert.ok(state.traffic.length <= MAX_TRAFFIC);
      for (const actor of state.traffic) seen.add(actor.kind);
      const rows = new Set(state.traffic.map((actor) => actor.row));
      for (const row of rows) {
        const key = `${difficulty}:${seed}:${row}`;
        if (checked.has(key)) continue;
        checked.add(key);
        const actors = state.traffic.filter((actor) => actor.row === row);
        const safe = [-3.5, -1.75, 0, 1.75, 3.5].some((x) => actors.every((actor) =>
          Math.min(Math.abs(x - actor.x), Math.abs(x - actor.targetX)) >= (BIKE_WIDTH + Math.max(actor.width, actor.targetWidth)) / 2 + 0.15));
        assert.ok(safe, `${key} has no safe corridor`);
      }
    }
  }
  assert.deepEqual([...seen].sort(), ['barrier', 'bus', 'car', 'cyclist', 'door']);
  assert.ok(checked.size > 400);
});

test('collision sweeps catch fast longitudinal and lateral crossings without rewarding the crash', () => {
  const state = emptyRoad(createState({ mode: 'rush' }));
  state.speed = 16;
  state.traffic = [threat({ z: 1.4, length: 0.3, kind: 'door', width: 0.2, targetWidth: 0.2 })];
  step(state, { assist: true, throttle: true }, 0.1);
  assert.equal(state.health, 2);
  assert.equal(state.totalCrashes, 1);
  assert.equal(state.traffic[0].crashed, true);
  assert.equal(state.passPoints, 0);
  assert.equal(state.combo, 0);
});

test('a thin collision is detected while steering through its lateral edge', () => {
  const state = emptyRoad(createState({ mode: 'rush' }));
  state.x = -0.8;
  state.vx = 3.6;
  state.traffic = [threat({ z: 0.1, width: 0.2, targetWidth: 0.2, length: 1 })];
  drive(state, 0.2, { right: true, brake: true });
  assert.equal(state.health, 2);
});

test('crash grace prevents stacked damage in a dense row and three distinct crashes end the run', () => {
  const state = emptyRoad(createState({ mode: 'rush' }));
  state.traffic = [threat({ id: 1, z: 1 }), threat({ id: 2, z: 1 })];
  step(state);
  assert.equal(state.health, 2);
  assert.equal(state.totalCrashes, 1);
  for (let i = 0; i < 2; i++) {
    state.traffic = [];
    drive(state, 1.2, { brake: true });
    state.traffic = [threat({ id: i + 3, z: state.distance + 1 })];
    step(state);
  }
  assert.equal(state.phase, 'lost');
  assert.equal(state.health, 0);
  assert.equal(state.result, 'crashed');
});

test('only fully cleared clean close passes earn battery, combo and points once', () => {
  const state = emptyRoad(createState({ mode: 'rush' }));
  state.x = 1.48; state.speed = 11.5; state.battery = 0.1;
  const actor = threat({ z: 1, length: 4.3 });
  state.traffic = [actor];
  step(state, { throttle: true });
  assert.equal(state.passPoints, 0);
  const before = state.battery;
  drive(state, 0.6, { throttle: true });
  assert.equal(actor.passed, true);
  assert.equal(state.combo, 1);
  assert.equal(state.passPoints, 27);
  assert.ok(state.battery > before + 0.02);
  const points = state.passPoints;
  drive(state, 1, { throttle: true });
  assert.equal(state.passPoints, points);
});

test('brake farming cannot earn near-pass resources or delivery time', () => {
  const state = emptyRoad(createState({ mode: 'delivery' }));
  state.x = 1.48; state.speed = 2.2;
  state.traffic = [threat({ z: 1 })];
  drive(state, 3, { brake: true });
  assert.equal(state.combo, 0);
  assert.equal(state.passPoints, 12);
  assert.ok(state.timeLeft < 44);
});

test('Veteran and Nightmare delivery checkpoints never replenish health', () => {
  for (const difficulty of ['veteran', 'nightmare', 'standard']) {
    const state = emptyRoad(createState({ mode: 'delivery', difficulty }));
    state.health = 1; state.battery = 0.2; state.stageDistance = 499.99; state.distance = 499.99;
    step(state, { throttle: true });
    assert.equal(state.deliveries, 1);
    assert.equal(state.stageIndex, 1);
    assert.equal(state.health, difficulty === 'standard' ? 2 : 1);
    assert.ok(state.battery > 0.35);
    assert.equal(getDistrict(state).title, 'Le Marais');
    assert.ok(state.stageDistance < 1);
  }
});

test('delivery exactly on its deadline counts, while a late one loses', () => {
  const onTime = emptyRoad(createState({ mode: 'delivery' }));
  onTime.elapsed = getDifficulty(onTime).deadlines[0] - FIXED_DT; onTime.stageDistance = 499.97; onTime.distance = 499.97;
  step(onTime, { throttle: true });
  assert.equal(onTime.deliveries, 1);
  assert.equal(onTime.phase, 'playing');
  const late = emptyRoad(createState({ mode: 'delivery' }));
  late.elapsed = getDifficulty(late).deadlines[0] - FIXED_DT; late.stageDistance = 495; late.distance = 495;
  step(late, { throttle: true });
  assert.equal(late.phase, 'lost');
  assert.equal(late.result, 'delivery-late');
});

test('Montmartre climb affects unassisted and assisted speed rather than hiding a control penalty', () => {
  const state = emptyRoad(createState({ mode: 'delivery' }));
  state.stageIndex = 4;
  drive(state, 3, { throttle: true });
  assert.equal(state.speed, 10.85);
  state.battery = 1;
  drive(state, 2, { throttle: true, assist: true });
  assert.equal(state.speed, 15.35);
});

test('fixed substeps preserve a slower frame and invalid durations never corrupt state', () => {
  const a = emptyRoad(createState({ mode: 'rush' })), b = emptyRoad(createState({ mode: 'rush' }));
  step(a, { throttle: true, right: true }, 0.1);
  for (let i = 0; i < 12; i++) step(b, { throttle: true, right: true });
  assert.ok(Math.abs(a.distance - b.distance) < 1e-9);
  assert.ok(Math.abs(a.x - b.x) < 1e-9);
  assert.equal(a.tick, 12);
  const frozen = structuredClone(a);
  for (const duration of [0, -1, NaN, Infinity]) step(a, { assist: true }, duration);
  assert.deepEqual(a, frozen);
});

for (const difficulty of ['veteran', 'nightmare']) {
  test(`all five ${difficulty} deliveries are reproducibly completable with legal 15 Hz controls`, () => {
    for (const seed of [1, 2, 7, 31, 12345]) {
      const state = route(createState({ mode: 'delivery', seed, difficulty }), rider({ precise: difficulty === 'nightmare' }));
      assert.equal(state.phase, 'won', `${difficulty}, seed ${seed}: ${state.result} at ${state.distance.toFixed(1)}m`);
      assert.equal(state.distance, TOTAL);
      assert.equal(state.deliveries, 5);
      assert.equal(state.districtResults.length, 5);
      assert.ok(state.health >= 2);
      assert.ok(state.finishTime > 200 && state.finishTime < 240);
      assert.ok(state.districtResults.every((result) => result.timeLeft >= 0));
      assert.ok(state.events.length <= 12);
      assert.ok(state.traffic.length <= MAX_TRAFFIC);
    }
  });
}

test('passive cruise, center throttle, center assist and curb hugging cannot complete Veteran', () => {
  for (const seed of [1, 2, 7, 31]) for (const input of [{}, { throttle: true },
    { throttle: true, assist: true }, { throttle: true, left: true, assist: true }, { throttle: true, right: true }]) {
    const state = drive(createState({ mode: 'delivery', seed }), 250, input);
    assert.equal(state.phase, 'lost', `${seed} ${JSON.stringify(input)}`);
    assert.ok(state.deliveries < 5);
  }
});

test('safe but slow riding misses delivery deadlines rather than winning through passive endurance', () => {
  const state = createState({ mode: 'delivery' });
  const steer = rider({ assist: false });
  route(state, (s) => ({ ...steer(s), throttle: false, assist: false }));
  assert.equal(state.phase, 'lost');
  assert.equal(state.result, 'delivery-late');
  assert.equal(state.totalCrashes, 0);
  assert.equal(state.deliveries, 0);
});

test('Standard lets a careful slower rider complete the same five districts without a clock', () => {
  const state = createState({ mode: 'delivery', difficulty: 'standard', seed: 31 });
  const steer = rider({ assist: false });
  let input = {};
  for (let tick = 0; tick < 120 * 420 && state.phase === 'playing'; tick++) {
    if (tick % 8 === 0) input = { ...steer(state), throttle: false, assist: false };
    step(state, input);
  }
  assert.equal(state.phase, 'won');
  assert.equal(state.timeLeft, null);
  assert.ok(state.elapsed > 350);
});

test('Rush cycles through Paris without delivery deadlines and keeps history and traffic bounded', () => {
  const state = createState({ difficulty: 'standard', mode: 'rush', seed: 19 });
  const control = rider();
  let input = {};
  for (let tick = 0; tick < 120 * 520 && state.phase === 'playing'; tick++) {
    if (tick % 8 === 0) input = control(state);
    step(state, input);
    assert.ok(state.traffic.length <= MAX_TRAFFIC);
    assert.ok(state.events.length <= 12);
    assert.ok(state.districtResults.length <= 10);
  }
  assert.equal(state.phase, 'playing');
  assert.ok(state.deliveries >= 10);
  assert.equal(state.timeLeft, null);
  assert.ok(state.score > 10000);
});

test('Survival is the default and its record is a versioned duration record', () => {
  const state = createState();
  assert.equal(state.mode, 'survival');
  assert.equal(state.difficulty, 'veteran');
  assert.equal(state.timeLeft, null);
  assert.equal(state.speed, 12.5);
  assert.equal(state.survivalPace, 12.5);
  assert.equal(state.brakeCharge, 1);
  assert.equal(recordScope(state), 'veteran-survival-v3');
  for (const difficulty of ['standard', 'veteran', 'nightmare']) {
    assert.equal(recordScope(createState({ difficulty })), `${difficulty}-survival-${difficulty === 'standard' ? 'v1' : 'v3'}`);
    assert.equal(recordScope(createState({ difficulty, mode: 'delivery' })), `${difficulty}-delivery${difficulty === 'standard' ? '' : '-v3'}`);
    assert.equal(recordScope(createState({ difficulty, mode: 'rush' })), `${difficulty}-rush${difficulty === 'standard' ? '' : '-v3'}`);
  }
});

test('Survival pace increases smoothly without a ceiling, with distinct tier starts and ramps', () => {
  for (const difficulty of ['standard', 'veteran', 'nightmare']) {
    const profile = getDifficulty(difficulty);
    assert.equal(getSurvivalPace(0, difficulty), profile.survivalStart);
    let prior = getSurvivalPace(0, difficulty);
    for (const elapsed of [1, 60, 180, 300, 600, 3600, 10800, 100000]) {
      const pace = getSurvivalPace(elapsed, difficulty);
      assert.ok(pace > prior);
      prior = pace;
      assert.equal(getSurvivalPace({ elapsed, difficulty }), pace);
    }
    const firstMinuteGrowth = getSurvivalPace(60, difficulty) - getSurvivalPace(0, difficulty);
    const fifthMinuteGrowth = getSurvivalPace(300, difficulty) - getSurvivalPace(240, difficulty);
    assert.ok(fifthMinuteGrowth > 0 && fifthMinuteGrowth < firstMinuteGrowth);
    assert.ok(getSurvivalPace(300.001, difficulty) - getSurvivalPace(300, difficulty) < 0.001);
  }
  assert.ok(Math.abs(getSurvivalPace(60) - 18.713203) < 0.00001);
  assert.equal(getSurvivalPace(180), 27.5);
  assert.ok(Math.abs(getSurvivalPace(300) - 34.242346) < 0.00001);
  assert.ok(getSurvivalPace(300, 'nightmare') > getSurvivalPace(300, 'veteran'));
  assert.ok(getSurvivalPace(300, 'veteran') > getSurvivalPace(300, 'standard'));
});

test('automatic forward pace continues with no throttle, no battery, held brake and curb riding', () => {
  for (const input of [{}, { brake: true }, { left: true }, { right: true }, { brake: true, left: true, assist: true }]) {
    const state = emptyRoad(createState());
    state.battery = 0;
    drive(state, 60, input);
    assert.equal(state.phase, 'playing');
    assert.ok(state.distance > 720);
    assert.ok(state.speed >= state.survivalPace - 0.001, JSON.stringify(input));
    assert.ok(state.survivalPace > 14);
    assert.equal(state.timeLeft, null);
    assert.equal(state.score, Math.floor(state.elapsed * 1000));
  }
});

test('a short useful brake burst exhausts its charge and holding the key cannot preserve slow speed', () => {
  const state = emptyRoad(createState());
  const initialSpeed = state.speed;
  drive(state, 0.35, { brake: true });
  assert.equal(state.brakeActive, true);
  assert.ok(state.speed < initialSpeed - 1);
  assert.ok(state.speed > state.survivalPace * 0.77);
  drive(state, 3, { brake: true });
  assert.equal(state.brakeCharge, 0);
  assert.equal(state.brakeLocked, true);
  assert.equal(state.brakeActive, false);
  assert.ok(state.speed >= state.survivalPace - 0.001);
  drive(state, 1, {});
  assert.ok(state.brakeCharge >= 0.39);
  assert.equal(state.brakeLocked, false);
  step(state, { brake: true });
  assert.equal(state.brakeActive, true);
});

test('assist is a finite burst above forced Survival pace and exhausting it cannot stall the ride', () => {
  const state = emptyRoad(createState());
  drive(state, 1, { assist: true });
  assert.ok(state.speed > state.survivalPace + 3);
  assert.ok(state.battery < 0.73);
  state.battery = 0.001;
  drive(state, 4, { assist: true });
  assert.equal(state.assistLocked, true);
  assert.equal(state.assistActive, false);
  assert.ok(Math.abs(state.speed - state.survivalPace) < 0.001);
  step(state, {});
  assert.equal(state.assistLocked, false);
});

test('Survival time uses active milliseconds and ignores pass, distance and checkpoint bonuses', () => {
  const state = emptyRoad(createState());
  state.passPoints = 10000;
  state.checkpointPoints = 90000;
  state.combo = 8;
  state.distance = 30000;
  drive(state, 2);
  assert.equal(state.score, Math.floor(state.elapsed * 1000));
  assert.ok(state.score < 2100);
  const before = state.score;
  togglePause(state);
  const snapshot = structuredClone(state);
  for (let i = 0; i < 100; i++) step(state, { assist: true }, 0.1);
  assert.deepEqual(state, snapshot);
  assert.equal(state.score, before);
  togglePause(state);
  step(state);
  assert.ok(state.score > before);
});

test('all Survival tiers carry their damage through clean district crossings without repairs', () => {
  for (const difficulty of ['standard', 'veteran', 'nightmare']) {
    const state = emptyRoad(createState({ difficulty }));
    state.health = 1;
    state.distance = 499.99;
    state.stageDistance = 499.99;
    step(state);
    assert.equal(state.stageIndex, 1);
    assert.equal(state.health, 1);
    assert.equal(state.timeLeft, null);
    assert.equal(state.phase, 'playing');
  }
});

test('Survival ends on the third impact and freezes both final seconds and duration score', () => {
  const state = emptyRoad(createState());
  for (let collision = 0; collision < 3; collision++) {
    state.traffic = [threat({ id: 3000 + collision, z: state.distance + 1 })];
    step(state);
    assert.equal(state.health, 2 - collision);
    if (collision < 2) {
      assert.equal(state.phase, 'playing');
      assert.equal(state.finishTime, null);
      state.traffic = [];
      drive(state, 1.25);
      assert.ok(state.speed >= state.survivalPace - 0.001);
    }
  }
  assert.equal(state.phase, 'lost');
  assert.equal(state.result, 'crashed');
  assert.equal(state.finishTime, state.elapsed);
  assert.equal(state.score, Math.floor(state.finishTime * 1000));
  const ended = structuredClone(state);
  for (let i = 0; i < 100; i++) step(state, { brake: true, assist: true }, 0.1);
  togglePause(state);
  assert.deepEqual(state, ended);
});

test('Survival recoveries restore increasing forced pace promptly after late high-speed hits', () => {
  const state = emptyRoad(createState({ difficulty: 'nightmare' }));
  state.elapsed = 10800;
  state.survivalPace = getSurvivalPace(state);
  state.speed = state.survivalPace;
  state.traffic = [threat({ z: state.distance + 1 })];
  step(state);
  assert.equal(state.health, 2);
  assert.ok(state.speed < state.survivalPace * 0.6);
  state.traffic = [];
  drive(state, 1.1);
  assert.ok(state.speed >= state.survivalPace - 0.001);
});

test('high-speed Survival collision sweeps catch thin doors crossed between rendered frames', () => {
  const state = emptyRoad(createState({ difficulty: 'nightmare' }));
  state.elapsed = 10800;
  state.survivalPace = getSurvivalPace(state);
  state.speed = state.survivalPace;
  state.traffic = [threat({ kind: 'door', z: 5, length: 0.1, width: 0.1, targetWidth: 0.1 })];
  step(state, {}, 0.1);
  assert.equal(state.health, 2);
  assert.equal(state.totalCrashes, 1);
  assert.equal(state.traffic[0].crashed, true);
  assert.equal(state.passPoints, 0);
});

test('Survival seeds replay accelerating traffic, brake charges and warning events deterministically', () => {
  const a = createState({ seed: 29 }), b = createState({ seed: 29 });
  const input = (state) => ({ right: state.tick % 500 < 200, left: state.tick % 500 > 330,
    brake: state.tick % 170 < 30, assist: state.tick % 700 > 620, bell: state.tick % 280 === 0 });
  drive(a, 80, input);
  drive(b, 80, input);
  assert.deepEqual(a, b);
});

test('late Survival warning reach and row separation allow physically achievable corridor transitions', () => {
  for (const difficulty of ['standard', 'veteran', 'nightmare']) for (const elapsed of [60, 180, 300, 10800, 100000]) {
    const state = createState({ difficulty, seed: 29 });
    state.elapsed = elapsed;
    state.survivalPace = getSurvivalPace(state);
    state.speed = state.survivalPace;
    state.distance = 100000;
    state.traffic = [];
    state.nextRowZ = state.distance + state.survivalPace * 2.5;
    step(state);
    const peakSpeed = state.survivalPace + 3.5;
    const profile = getDifficulty(state);
    // Long bus halves, stagger and bike lengths consume at most sixteen metres.
    const availableTransition = (state.rowGap - 16) / peakSpeed;
    assert.ok(availableTransition >= getTrafficTransitionSeconds(state));
    assert.ok(availableTransition > 3.5 / 3.6 + 0.13);
    assert.ok(state.warningDistance / peakSpeed > profile.warning + 0.8);
    assert.ok(state.lookAheadDistance >= state.warningDistance + state.rowGap);
    assert.ok(state.traffic.length > 0 && state.traffic.length <= MAX_TRAFFIC);
    assert.ok(Number.isFinite(state.lookAheadDistance));
  }
});

test('Survival loops all districts beyond ten minutes with legal visible-geometry controls and bounded state', () => {
  for (const difficulty of ['standard', 'veteran', 'nightmare']) for (const seed of [1, 31]) {
    const state = createState({ seed, difficulty });
    const control = rider({ assist: false });
    let input = {};
    let atMinute = null, atThree = null, atFive = null;
    for (let tick = 0; tick < 120 * 620 && state.phase === 'playing'; tick++) {
      if (tick % 8 === 0) input = control(state);
      step(state, input);
      if (tick === 120 * 60) atMinute = state.speed;
      if (tick === 120 * 180) atThree = state.speed;
      if (tick === 120 * 300) atFive = state.speed;
      if (tick % 120 !== 0) continue;
      assert.ok(state.traffic.length <= MAX_TRAFFIC);
      assert.ok(state.events.length <= 12);
      assert.ok(state.districtResults.length <= 10);
      assert.equal(state.timeLeft, null);
      assert.equal(state.score, Math.floor(state.elapsed * 1000));
    }
    assert.equal(state.phase, 'playing', `${difficulty} ${seed} ${state.result}`);
    assert.equal(state.health, 3);
    assert.ok(state.stageIndex >= 20);
    assert.ok(state.deliveries >= 20);
    assert.equal(state.finishTime, null);
    assert.ok(atMinute < atThree && atThree < atFive && atFive < state.speed);
    assert.equal(state.score, Math.floor(state.elapsed * 1000));
  }
});

test('holding neutral controls, brake, empty assist or a curb cannot survive automatically', () => {
  for (const difficulty of ['standard', 'veteran', 'nightmare']) for (const input of [{},
    { brake: true }, { assist: true }, { left: true }, { right: true, brake: true }]) {
    const state = createState({ difficulty, seed: 31 });
    state.battery = 0;
    drive(state, 90, input);
    assert.equal(state.phase, 'lost', `${difficulty} ${JSON.stringify(input)}`);
    assert.equal(state.result, 'crashed');
    assert.equal(state.health, 0);
    assert.equal(state.timeLeft, null);
    assert.equal(state.score, Math.floor(state.finishTime * 1000));
  }
});


test('strict Paris Rush and Survival force the same pace and finite brake charge while Standard Rush remains practice', () => {
  for (const difficulty of ['veteran', 'nightmare']) for (const mode of ['rush', 'survival']) {
    const state = emptyRoad(createState({ mode, difficulty }));
    assert.equal(usesAutomaticPace(state), true);
    drive(state, 12, { brake: true, left: true });
    assert.equal(state.brakeCharge, 0);
    assert.equal(state.brakeLocked, true);
    assert.ok(state.distance > 120);
    assert.ok(state.speed >= state.survivalPace - 0.001);
    assert.equal(state.timeLeft, null);
  }
  const practice = emptyRoad(createState({ mode: 'rush', difficulty: 'standard' }));
  assert.equal(usesAutomaticPace(practice), false);
  drive(practice, 12, { brake: true });
  assert.equal(practice.speed, 2.2);
});

test('Paris difficulty requires more precise steering and progressively quicker corridor transitions', () => {
  const practice = createState({ difficulty: 'standard' });
  for (const difficulty of ['veteran', 'nightmare']) {
    const opening = createState({ difficulty });
    const late = createState({ difficulty }); late.elapsed = 180;
    const practiceCars = practice.traffic.filter((actor) => actor.kind === 'car');
    assert.ok(practiceCars.every((actor) => [-3.5, -1.75, 0, 1.75, 3.5].includes(actor.x)));
    assert.ok(opening.traffic.some((actor) => actor.kind === 'car' && ![-3.5, -1.75, 0, 1.75, 3.5].includes(actor.x)));
    for (const a of opening.traffic.filter((actor) => actor.kind === 'car')) {
      assert.equal(a.width, 1.75);
      for (const b of opening.traffic.filter((actor) => actor.kind === 'car' && actor.id !== a.id && actor.row === a.row))
        assert.ok(Math.abs(a.x - b.x) >= (a.width + b.width) / 2 - 1e-9, 'queued bodies do not overlap');
    }
    assert.ok(getSurvivalPace(60, difficulty) > getSurvivalPace(60, 'standard') + 6);
    assert.ok(getTrafficTransitionSeconds(late) < getTrafficTransitionSeconds(opening));
    // A full two-lane shift remains possible at the worst assisted approach speed.
    emptyRoad(late); late.nextRowZ = late.distance + 100;
    step(late);
    const seconds = (late.rowGap - 16) / (late.survivalPace + 3.5);
    assert.ok(seconds > 3.5 / 3.6 + 0.13);
  }
});

test('imprecise slow corrections lose quickly while timely legal steering earns a long Survival run', () => {
  for (const difficulty of ['veteran', 'nightmare']) for (const seed of [1, 7, 31]) {
    const late = createState({ difficulty, seed }), control = rider({ assist: false });
    let input = {};
    for (let tick = 0; tick < 120 * 60 && late.phase === 'playing'; tick++) {
      if (tick % 24 === 0) input = control(late);
      step(late, input);
    }
    assert.equal(late.phase, 'lost');
    assert.ok(late.elapsed < 25, `${difficulty} ${seed}: late correction survived ${late.elapsed}`);
    const precise = createState({ difficulty, seed }), timely = rider({ assist: false });
    for (let tick = 0; tick < 120 * 60 && precise.phase === 'playing'; tick++) {
      if (tick % 8 === 0) input = timely(precise);
      step(precise, input);
    }
    assert.equal(precise.phase, 'playing');
    assert.equal(precise.health, 3);
    assert.ok(precise.deliveries >= 1);
  }
});
