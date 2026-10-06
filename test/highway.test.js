import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState,
  step,
  togglePause,
  LANES,
  CAR_WIDTH,
  CAR_LENGTH,
  rowSpacing,
  DISTRICTS,
  DISTRICT_LENGTH,
  TOUR_DISTANCE,
  getDistrict,
  recordScope,
  DIFFICULTIES,
  getDifficulty,
} from '../public/solo/highway-engine.js';

function seeded(seed = 37) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

function vehicle({ id = 1000, x = 0, z = 2, speed = 80, width = 0.34, ...rest } = {}) {
  return {
    id,
    row: id,
    lane: 1,
    x,
    z,
    speed,
    width,
    length: 4.3,
    color: '#e4a972',
    passed: false,
    crashed: false,
    ...rest,
  };
}

function emptyRoad(state) {
  state.traffic = [vehicle({ z: 1e6 })];
  return state;
}

function drive(state, seconds, inputs = {}) {
  for (let index = 0; index < Math.round(seconds * 120); index += 1) {
    step(state, typeof inputs === 'function' ? inputs(state) : inputs);
  }
  return state;
}

test('starts with readable road units, three health and an escapable first obstacle', () => {
  const state = createState({ random: seeded() });
  assert.equal(state.gameId, 'night-drive');
  assert.equal(state.phase, 'playing');
  assert.equal(state.speed, 100);
  assert.equal(state.health, 3);
  assert.equal(state.boost, 1);
  assert.equal(state.traffic[0].z, 48);
  assert.equal(state.traffic[0].x, 0);
  assert.equal(state.car.width, CAR_WIDTH);
  assert.equal(state.car.length, CAR_LENGTH);
  assert.ok(state.traffic.length <= 20);
});

test('cruise, throttle and braking use km/h while distance advances in metres', () => {
  const cruising = emptyRoad(createState());
  drive(cruising, 2);
  assert.equal(cruising.speed, 130);
  assert.ok(cruising.distance > 65 && cruising.distance < 73);
  drive(cruising, 3, { throttle: true });
  assert.equal(cruising.speed, 180);
  const fastDistance = cruising.distance;
  drive(cruising, 2, { brake: true, throttle: true });
  assert.equal(cruising.speed, 55);
  assert.ok(cruising.distance - fastDistance > 30);
  assert.ok(cruising.distance - fastDistance < 65);
});

test('steering reacts immediately, settles smoothly, and opposite keys cancel', () => {
  const state = emptyRoad(createState());
  step(state, { right: true });
  assert.ok(state.x > 0 && state.x < 0.005);
  drive(state, 0.35, { right: true });
  assert.ok(state.x > 0.55 && state.x < 0.76);
  const turningSpeed = state.steeringVelocity;
  step(state, { left: true, right: true });
  assert.ok(state.steeringVelocity < turningSpeed);
  drive(state, 0.6);
  assert.ok(Math.abs(state.steeringVelocity) < 0.001);
  drive(state, 2, { left: true });
  assert.equal(state.x, -1.18);
  assert.ok(state.shoulder);
});

test('boost accelerates, drains, locks when empty, and recharges when released', () => {
  const state = emptyRoad(createState());
  drive(state, 2, { boost: true });
  assert.equal(state.speed, 220);
  assert.ok(Math.abs(state.boost - 0.5) < 0.001);
  drive(state, 2.1, { boost: true });
  assert.ok(state.boostLocked);
  assert.equal(state.boosting, false);
  const depleted = state.boost;
  drive(state, 1, { boost: true });
  assert.equal(state.boosting, false);
  assert.ok(state.boost > depleted);
  drive(state, 2);
  assert.equal(state.boostLocked, false);
  const recharged = state.boost;
  step(state, { boost: true });
  assert.equal(state.boosting, true);
  assert.ok(state.boost < recharged);
});

test('braking takes priority over boost and boost does not consume charge while braking', () => {
  const state = emptyRoad(createState());
  drive(state, 2, { brake: true, boost: true });
  assert.equal(state.speed, 55);
  assert.equal(state.boosting, false);
  assert.equal(state.boost, 1);
});

test('shoulder slows the car, displays an event, and recovery restores cruise', () => {
  const state = emptyRoad(createState());
  state.speed = 180;
  state.x = 1.1;
  drive(state, 1, { throttle: true, boost: true });
  assert.equal(state.shoulder, true);
  assert.equal(state.speed, 75);
  assert.equal(state.boosting, false);
  assert.equal(state.events.filter((entry) => entry.type === 'shoulder').length, 1);
  drive(state, 0.45, { left: true });
  drive(state, 0.6);
  assert.equal(state.shoulder, false);
  drive(state, 2);
  assert.equal(state.speed, 130);
});

test('collision uses full body widths and one car cannot damage twice', () => {
  const state = createState();
  state.traffic = [vehicle({ z: 2 })];
  state.x = (CAR_WIDTH + 0.34) / 2 - 0.001;
  step(state);
  assert.equal(state.health, 2);
  assert.equal(state.phase, 'playing');
  assert.ok(state.crashCooldown > 1);
  assert.equal(state.traffic[0].crashed, true);
  drive(state, 2);
  assert.equal(state.health, 2);
  assert.equal(state.overtakePoints, 0);
  assert.equal(state.events.filter((entry) => entry.type === 'crash').length, 1);
  const clear = createState();
  clear.traffic = [vehicle({ z: 2 })];
  clear.x = (CAR_WIDTH + 0.34) / 2 + 0.001;
  step(clear);
  assert.equal(clear.health, 3);
});

test('invulnerability prevents overlapping impacts and three separate hits end the run', () => {
  const state = createState();
  state.traffic = [vehicle({ id: 1 }), vehicle({ id: 2 })];
  step(state);
  assert.equal(state.health, 2);
  assert.equal(
    state.traffic.filter((car) => car.id <= 2).every((car) => car.crashed),
    true,
  );
  emptyRoad(state);
  drive(state, 1.3);
  state.traffic = [vehicle({ id: 3 })];
  step(state);
  assert.equal(state.health, 1);
  emptyRoad(state);
  drive(state, 1.3);
  state.traffic = [vehicle({ id: 4 })];
  step(state);
  assert.equal(state.health, 0);
  assert.equal(state.phase, 'lost');
  assert.equal(state.result, 'crashed');
  const snapshot = JSON.stringify(state);
  assert.equal(step(state, { boost: true }), false);
  assert.equal(togglePause(state), false);
  assert.equal(JSON.stringify(state), snapshot);
});

test('overtakes and near misses award points once, never for crashes or rear approaches', () => {
  const state = createState();
  state.speed = 180;
  state.x = 0.45;
  state.traffic = [vehicle({ id: 10, z: 0.1 })];
  step(state);
  assert.equal(state.overtakePoints, 75);
  assert.equal(state.combo, 1);
  assert.equal(state.events.at(-1).type, 'near-miss');
  drive(state, 0.2);
  assert.equal(state.overtakePoints, 75);
  state.x = 0.62;
  state.traffic = [vehicle({ id: 11, z: 0.1 })];
  step(state);
  assert.equal(state.overtakePoints, 125);
  assert.equal(state.events.at(-1).type, 'pass');
  state.x = 0;
  state.traffic = [vehicle({ id: 12, z: 0.1 })];
  step(state);
  assert.equal(state.overtakePoints, 125);
  state.x = 0.62;
  state.speed = 55;
  state.traffic = [vehicle({ id: 13, z: -0.01 })];
  step(state, { brake: true });
  assert.equal(state.overtakePoints, 125);
  assert.equal(state.score, Math.floor(state.distance * 0.2) + 125);
});

test('cars already passed cannot cause invisible crashes when braking', () => {
  const state = createState();
  state.speed = 55;
  state.traffic = [vehicle({ z: -1, speed: 80, passed: true })];
  drive(state, 0.3, { brake: true });
  assert.equal(state.health, 3);
  assert.equal(state.overtakePoints, 0);
});

test('every generated row keeps a lane open and max-speed spacing permits an escape', () => {
  for (let seed = 1; seed <= 100; seed += 1) {
    const state = createState({ random: seeded(seed) });
    const rows = new Map();
    for (const car of state.traffic) rows.set(car.row, [...(rows.get(car.row) || []), car]);
    const positions = [...rows.values()].map((cars) => cars[0].z).sort((a, b) => a - b);
    for (const cars of rows.values()) {
      assert.ok(cars.length >= 1 && cars.length <= 2);
      assert.equal(new Set(cars.map((car) => car.lane)).size, cars.length);
      assert.ok(cars.every((car) => LANES.includes(car.x)));
    }
    for (let index = 1; index < positions.length; index += 1) {
      assert.ok(positions[index] - positions[index - 1] >= rowSpacing(220));
    }
  }
  assert.ok(rowSpacing(220) / ((220 - 80) / 3.6) >= 1.25);
});

test('a long real-input boosted run stays finite and a simple lane escape succeeds', () => {
  const state = createState({ random: seeded(9) });
  drive(state, 90, (current) => {
    const ahead = current.traffic.filter((car) => !car.passed && car.z > 0);
    const next = ahead.reduce((nearest, car) => (!nearest || car.z < nearest.z ? car : nearest), null);
    const blocked = next ? ahead.filter((car) => car.row === next.row).map((car) => car.lane) : [];
    const safe = LANES.filter((_, index) => !blocked.includes(index));
    const target = safe.reduce(
      (best, x) => (Math.abs(x - current.x) < Math.abs(best - current.x) ? x : best),
      safe[0],
    );
    return {
      left: current.x > target + 0.025,
      right: current.x < target - 0.025,
      throttle: true,
      boost: current.elapsed % 11 < 3,
    };
  });
  assert.equal(state.phase, 'playing');
  assert.equal(state.health, 3);
  assert.ok(state.distance > 4500);
  assert.ok(state.score > 3000);
  for (const key of ['x', 'speed', 'distance', 'score', 'boost', 'curve', 'elapsed']) {
    assert.ok(Number.isFinite(state[key]), key);
  }
  assert.ok(state.traffic.length <= 20);
  assert.ok(state.events.length <= 12);
});

test('seeded inputs produce identical state and pause freezes all clocks and traffic', () => {
  const a = createState({ random: seeded(5) });
  const b = createState({ random: seeded(5) });
  const inputs = { left: true, boost: true };
  drive(a, 0.2, inputs);
  drive(b, 0.2, inputs);
  assert.deepEqual(a, b);
  assert.equal(togglePause(a), true);
  const paused = JSON.stringify(a);
  drive(a, 10, { right: true, boost: true });
  assert.equal(JSON.stringify(a), paused);
  assert.equal(togglePause(a), true);
  step(a);
  assert.ok(a.elapsed > b.elapsed);
});

test('frame bounds and invalid randomness are handled without poisoning the state', () => {
  const state = emptyRoad(createState());
  assert.equal(step(state, {}, NaN), false);
  assert.equal(step(state, {}, Infinity), false);
  assert.equal(step(state, {}, -1), false);
  assert.equal(state.elapsed, 0);
  step(state, {}, 20);
  assert.ok(Math.abs(state.elapsed - 0.05) < 1e-10);
  assert.doesNotThrow(() => step(state, null));
  assert.throws(() => createState({ random: 'bad' }), TypeError);
  assert.throws(() => createState({ random: () => 1 }), RangeError);
});

function districtDriver(state) {
  const ahead = state.traffic.filter((car) => !car.passed && car.z > 0);
  const nearest = ahead.reduce((a, b) => (!a || b.z < a.z ? b : a), null);
  const row = nearest ? ahead.filter((car) => car.row === nearest.row) : [];
  const blocked = new Set(
    row.flatMap((car) =>
      car.targetLane !== undefined && car.targetLane !== car.lane ? [car.lane, car.targetLane] : [car.lane],
    ),
  );
  const safe = LANES.filter((_, index) => !blocked.has(index));
  const target = safe.reduce(
    (best, x) => (Math.abs(x - state.x) < Math.abs(best - state.x) ? x : best),
    safe[0] ?? 0,
  );
  return {
    left: state.x > target + 0.018,
    right: state.x < target - 0.018,
    throttle: true,
    boost: state.elapsed % 11 < 3,
  };
}

test('five districts use distinct traffic layouts, warnings and weather with bounded escapable rows', () => {
  assert.equal(DISTRICTS.length, 5);
  assert.equal(new Set(DISTRICTS.map((d) => d.id)).size, 5);
  assert.throws(() => createState({ mode: 'unknown' }), RangeError);
  for (let index = 0; index < DISTRICTS.length; index += 1) {
    const state = createState({ random: seeded(index + 30) });
    state.districtIndex = index;
    state.districtId = DISTRICTS[index].id;
    state.distance = index * DISTRICT_LENGTH;
    state.traffic = [];
    step(state);
    assert.equal(getDistrict(state), DISTRICTS[index]);
    assert.equal(recordScope(state), 'default');
    assert.ok(state.traffic.length <= 20);
    const rows = new Map();
    for (const car of state.traffic) rows.set(car.row, [...(rows.get(car.row) || []), car]);
    for (const cars of rows.values()) {
      assert.ok(cars.length >= 1 && cars.length <= 2);
      assert.equal(new Set(cars.map((car) => car.lane)).size, cars.length);
      assert.ok(cars.every((car) => car.speed === DISTRICTS[index].trafficSpeed));
      if (DISTRICTS[index].id === 'works')
        assert.ok(cars.every((car) => car.kind === 'barrier' && car.speed === 0));
      if (cars.some((car) => car.targetLane !== car.lane))
        assert.equal(cars.length, 1, 'only lone cars may merge so a full escape lane remains');
    }
    const positions = [...rows.values()].map((cars) => cars[0].z).sort((a, b) => a - b);
    for (let i = 1; i < positions.length; i += 1)
      assert.ok(positions[i] - positions[i - 1] >= rowSpacing(220, DISTRICTS[index].trafficSpeed));
  }
});

test('coastal lane changes give a 1.2-second signal before crossing and pause freezes the warning', () => {
  const state = createState({ random: seeded(7) });
  state.districtIndex = 1;
  state.districtId = 'coast';
  state.distance = 900;
  state.traffic = [vehicle({ lane: 0, x: LANES[0], z: 85, targetLane: 1, changeTimer: null, signal: false })];
  step(state);
  assert.equal(state.traffic[0].signal, true);
  assert.equal(state.traffic[0].x, LANES[0]);
  drive(state, 0.7);
  assert.equal(state.traffic[0].x, LANES[0]);
  togglePause(state);
  const before = JSON.stringify(state);
  drive(state, 3);
  assert.equal(JSON.stringify(state), before);
  togglePause(state);
  drive(state, 0.6);
  assert.ok(state.traffic[0].x > LANES[0]);
  drive(state, 1);
  assert.equal(state.traffic[0].lane, 1);
  assert.equal(state.traffic[0].x, LANES[1]);
});

test('wet steering carries more momentum and construction spacing accounts for stationary barriers', () => {
  const dry = emptyRoad(createState()),
    wet = emptyRoad(createState());
  wet.districtIndex = 3;
  wet.districtId = 'storm';
  wet.distance = 2700;
  drive(dry, 0.1, { right: true });
  drive(wet, 0.1, { right: true });
  assert.ok(wet.steeringVelocity < dry.steeringVelocity);
  drive(dry, 0.1);
  drive(wet, 0.1);
  assert.ok(wet.steeringVelocity > dry.steeringVelocity);
  assert.ok(rowSpacing(220, 0) > rowSpacing(220, 80));
  assert.ok(rowSpacing(220, 0) / (220 / 3.6) > 1.35);
});

test('near-miss risk builds a capped multiplier and fuel while collision or timeout resets the chain', () => {
  const state = createState();
  state.x = 0.45;
  state.speed = 180;
  state.boost = 0.2;
  for (let hit = 1; hit <= 7; hit += 1) {
    state.traffic = [vehicle({ id: 100 + hit, z: 0.1 })];
    const before = state.overtakePoints;
    step(state);
    assert.equal(state.combo, Math.min(5, hit));
    assert.equal(state.overtakePoints - before, 50 + 25 * Math.min(5, hit));
  }
  assert.ok(state.boost > 0.8 && state.boost <= 1);
  emptyRoad(state);
  drive(state, 8.1);
  assert.equal(state.combo, 0);
  state.x = 0.45;
  state.traffic = [vehicle({ z: 0.1 })];
  step(state);
  assert.equal(state.combo, 1);
  state.x = 0;
  state.traffic = [vehicle({ id: 900, z: 2 })];
  step(state);
  assert.equal(state.combo, 0);
});

test('boost cells are precise one-time resources and district warnings precede clean milestone rewards', () => {
  const state = emptyRoad(createState());
  state.boost = 0.1;
  state.speed = 180;
  state.pickups = [{ id: 1, x: 0, z: 0.1, collected: false }];
  step(state);
  assert.ok(state.boost > 0.39 && state.boost < 0.41);
  assert.equal(state.overtakePoints, 35);
  assert.equal(state.pickups.length, 0);
  state.distance = 750;
  step(state);
  assert.equal(state.districtWarning, 'coast');
  state.distance = 899.9;
  state.health = 2;
  step(state);
  assert.equal(state.districtIndex, 1);
  assert.equal(state.districtId, 'coast');
  assert.equal(state.districtResults[0].clean, true);
  assert.equal(state.health, 3);
  assert.equal(state.checkpointPoints, 600);
  state.distance = 1799.9;
  state.districtCrashes = 1;
  state.health = 2;
  step(state);
  assert.equal(state.districtResults[1].clean, false);
  assert.equal(state.health, 2);
  assert.equal(state.checkpointPoints, 900);
});

test('real steering, throttle and timed boost complete every tour district without forcing progress or health', () => {
  for (const seed of [9, 37, 81]) {
    const state = createState({ mode: 'tour', random: seeded(seed) }),
      seen = new Set();
    let barriers = false,
      merges = false,
      pickups = false;
    for (let tick = 0; tick < 120 * 180 && state.phase === 'playing'; tick += 1) {
      seen.add(state.districtId);
      barriers ||= state.traffic.some((car) => car.kind === 'barrier');
      merges ||= state.traffic.some((car) => car.signal);
      pickups ||= state.pickups.length > 0;
      step(state, districtDriver(state));
      assert.ok(state.traffic.length <= 20 && state.pickups.length <= 5 && state.events.length <= 12);
      assert.ok(
        state.boost >= 0 && state.boost <= 1 && state.combo <= 5 && state.health >= 0 && state.health <= 3,
      );
    }
    assert.equal(state.phase, 'won', `seed ${seed}`);
    assert.equal(state.result, 'tour-complete');
    assert.equal(state.distance, TOUR_DISTANCE);
    assert.equal(state.districtResults.length, 5);
    assert.equal(seen.size, 5);
    assert.ok(barriers && merges && pickups);
    assert.equal(recordScope(state), 'tour');
    assert.ok(state.health > 0);
    assert.ok(state.finishTime > 60 && state.finishTime < 180);
    const before = JSON.stringify(state);
    assert.equal(step(state, { boost: true }), false);
    assert.equal(togglePause(state), false);
    assert.equal(JSON.stringify(state), before);
  }
});

test('fixed highway substeps match longer frames and endless districts continue after the tour distance', () => {
  const fixed = createState({ random: seeded(2) }),
    frame = createState({ random: seeded(2) });
  step(frame, { right: true, boost: true }, 0.05);
  for (let i = 0; i < 6; i += 1) step(fixed, { right: true, boost: true });
  for (const key of ['elapsed', 'distance', 'x', 'speed', 'boost'])
    assert.ok(Math.abs(fixed[key] - frame[key]) < 1e-10, key);
  const endless = createState({ random: seeded(9) });
  drive(endless, 100, districtDriver);
  assert.equal(endless.phase, 'playing');
  assert.ok(endless.distance > TOUR_DISTANCE);
  assert.ok(endless.districtIndex >= 5);
});

test('difficulty profiles preserve standard records and separate every harder mode', () => {
  assert.deepEqual(
    DIFFICULTIES.map((profile) => profile.id),
    ['standard', 'veteran', 'nightmare'],
  );
  assert.equal(createState().difficulty, 'standard');
  assert.equal(createState().delivery, null);
  assert.throws(() => createState({ difficulty: 'impossible' }), RangeError);
  for (const difficulty of DIFFICULTIES)
    for (const mode of ['endless', 'tour']) {
      const state = createState({ difficulty: difficulty.id, mode, random: seeded(33) });
      assert.equal(getDifficulty(state), difficulty);
      assert.equal(state.boost, difficulty.boostStart);
      const base = mode === 'tour' ? 'tour' : 'default';
      assert.equal(recordScope(state), difficulty.id === 'standard' ? base : `${difficulty.id}-${base}`);
      assert.deepEqual(state, JSON.parse(JSON.stringify(state)));
    }
});

test('Veteran and Nightmare delivery clocks defeat both slow cruise and permanent braking using legal steering', () => {
  for (const difficulty of ['veteran', 'nightmare'])
    for (const brake of [false, true]) {
      const state = createState({ difficulty, mode: 'tour', random: seeded(9) });
      drive(state, 30, (current) => ({ ...districtDriver(current), throttle: false, boost: false, brake }));
      assert.equal(state.phase, 'lost', `${difficulty} ${brake ? 'brake' : 'cruise'}`);
      assert.equal(state.result, 'delivery-missed');
      assert.ok(state.distance < DISTRICT_LENGTH);
      assert.equal(state.health, 3, 'safe steering still fails the pace goal without a crash');
      assert.equal(state.delivery.remaining, 0);
      const before = JSON.stringify(state);
      assert.equal(step(state, { boost: true }), false);
      assert.equal(JSON.stringify(state), before);
    }
  const practice = createState({ mode: 'tour', random: seeded(9) });
  drive(practice, 160, (current) => ({ ...districtDriver(current), throttle: false, boost: false }));
  assert.equal(practice.phase, 'won', 'Standard remains a playable untimed practice tour');
  assert.ok(practice.finishTime > 120);
});

test('harder profiles keep every row escapable with enough travel time to cross two lanes', () => {
  for (const difficulty of ['veteran', 'nightmare'])
    for (let index = 0; index < DISTRICTS.length; index++) {
      const state = createState({ difficulty, random: seeded(index + 100) });
      state.districtIndex = index;
      state.districtId = DISTRICTS[index].id;
      state.distance = index * DISTRICT_LENGTH;
      state.traffic = [];
      step(state);
      const rows = new Map();
      for (const car of state.traffic) {
        if (!rows.has(car.row)) rows.set(car.row, []);
        rows.get(car.row).push(car);
        assert.equal(car.speed, DISTRICTS[index].trafficSpeed);
      }
      let previous = null;
      for (const cars of rows.values()) {
        const blocked = new Set(
          cars.flatMap((car) => (car.targetLane !== car.lane ? [car.lane, car.targetLane] : [car.lane])),
        );
        assert.ok(blocked.size < 3);
        assert.ok(cars.length <= 2);
        if (previous !== null) {
          const relativeSpeed = (220 - DISTRICTS[index].trafficSpeed) / 3.6;
          assert.ok((cars[0].z - previous) / relativeSpeed > 1);
        }
        previous = cars[0].z;
      }
      assert.ok(state.traffic.length <= 20 && state.pickups.length <= 5);
    }
});

test('harder resources recharge slowly, reward fast near misses once, cap time credit and never heal checkpoints', () => {
  for (const difficulty of ['veteran', 'nightmare']) {
    const state = emptyRoad(createState({ difficulty })),
      profile = getDifficulty(state);
    state.boost = 0.1;
    drive(state, 1);
    assert.ok(Math.abs(state.boost - (0.1 + profile.boostRegen)) < 1e-8);
    state.speed = 180;
    for (let pass = 0; pass < 15; pass++) {
      state.traffic = [vehicle({ id: 900 + pass, x: 0.45, z: 0.01, speed: 0 })];
      step(state, { throttle: true });
    }
    assert.ok(Math.abs(state.delivery.bonus - profile.bonusCap) < 1e-8);
    const bonus = state.delivery.bonus;
    step(state, { throttle: true });
    assert.equal(state.delivery.bonus, bonus, 'one vehicle cannot repeatedly award time');
    state.health = 2;
    state.distance = DISTRICT_LENGTH - 0.1;
    state.districtCrashes = 0;
    state.traffic = [];
    step(state, { throttle: true });
    assert.equal(state.districtIndex, 1);
    assert.equal(state.health, 2);
    assert.equal(state.delivery.bonus, 0);
    assert.equal(state.delivery.limit, profile.limits[1]);
    assert.equal(state.delivery.startedAt, state.elapsed);
  }
  const slow = emptyRoad(createState({ difficulty: 'veteran' }));
  slow.speed = 130;
  slow.traffic = [vehicle({ x: 0.45, z: 0.01, speed: 0 })];
  step(slow);
  assert.equal(slow.combo, 1);
  assert.equal(slow.delivery.bonus, 0, 'slow overtakes cannot farm delivery time');
});

test('seeded fast steering and resource use complete every harder tour without changing health, traffic or distance', () => {
  for (const difficulty of ['veteran', 'nightmare'])
    for (const seed of [9, 37, 81]) {
      const state = createState({ difficulty, mode: 'tour', random: seeded(seed) });
      drive(state, 115, districtDriver);
      assert.equal(state.phase, 'won', `${difficulty} seed ${seed}`);
      assert.equal(state.result, 'tour-complete');
      assert.equal(state.distance, TOUR_DISTANCE);
      assert.equal(state.districtResults.length, 5);
      assert.equal(state.health, 3);
      assert.ok(state.districtResults.every((district) => district.clean && district.timeLeft > 0));
      assert.ok(state.boost >= 0 && state.boost <= 1);
      assert.ok(state.finishTime > 75 && state.finishTime < 101);
      assert.equal(recordScope(state), `${difficulty}-tour`);
    }
});

test('pause freezes delivery deadlines, resources and traffic and fixed profile steps remain deterministic', () => {
  const state = createState({ difficulty: 'veteran', random: seeded(5) });
  drive(state, 3, districtDriver);
  togglePause(state);
  const paused = JSON.stringify(state);
  drive(state, 40, { brake: true, boost: true });
  assert.equal(JSON.stringify(state), paused);
  togglePause(state);
  const before = state.delivery.remaining;
  step(state, { throttle: true });
  assert.ok(state.delivery.remaining < before);
  const fixed = createState({ difficulty: 'nightmare', random: seeded(2) }),
    frame = createState({ difficulty: 'nightmare', random: seeded(2) });
  step(frame, { right: true, boost: true }, 0.05);
  for (let tick = 0; tick < 6; tick++) step(fixed, { right: true, boost: true });
  assert.deepEqual(frame, fixed);
});
