import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, step, togglePause, LANES, CAR_WIDTH, CAR_LENGTH, rowSpacing,
} from '../public/solo/highway-engine.js';

function seeded(seed = 37) {
  return () => {
    seed = Math.imul(seed, 1664525) + 1013904223 | 0;
    return (seed >>> 0) / 4294967296;
  };
}

function vehicle({ id = 1000, x = 0, z = 2, speed = 80, width = .34, ...rest } = {}) {
  return { id, row: id, lane: 1, x, z, speed, width, length: 4.3,
    color: '#e4a972', passed: false, crashed: false, ...rest };
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
  assert.ok(state.x > 0 && state.x < .005);
  drive(state, .35, { right: true });
  assert.ok(state.x > .55 && state.x < .76);
  const turningSpeed = state.steeringVelocity;
  step(state, { left: true, right: true });
  assert.ok(state.steeringVelocity < turningSpeed);
  drive(state, .6);
  assert.ok(Math.abs(state.steeringVelocity) < .001);
  drive(state, 2, { left: true });
  assert.equal(state.x, -1.18);
  assert.ok(state.shoulder);
});

test('boost accelerates, drains, locks when empty, and recharges when released', () => {
  const state = emptyRoad(createState());
  drive(state, 2, { boost: true });
  assert.equal(state.speed, 220);
  assert.ok(Math.abs(state.boost - .5) < .001);
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
  assert.equal(state.events.filter(entry => entry.type === 'shoulder').length, 1);
  drive(state, .45, { left: true });
  drive(state, .6);
  assert.equal(state.shoulder, false);
  drive(state, 2);
  assert.equal(state.speed, 130);
});

test('collision uses full body widths and one car cannot damage twice', () => {
  const state = createState();
  state.traffic = [vehicle({ z: 2 })];
  state.x = (CAR_WIDTH + .34) / 2 - .001;
  step(state);
  assert.equal(state.health, 2);
  assert.equal(state.phase, 'playing');
  assert.ok(state.crashCooldown > 1);
  assert.equal(state.traffic[0].crashed, true);
  drive(state, 2);
  assert.equal(state.health, 2);
  assert.equal(state.overtakePoints, 0);
  assert.equal(state.events.filter(entry => entry.type === 'crash').length, 1);
  const clear = createState();
  clear.traffic = [vehicle({ z: 2 })];
  clear.x = (CAR_WIDTH + .34) / 2 + .001;
  step(clear);
  assert.equal(clear.health, 3);
});

test('invulnerability prevents overlapping impacts and three separate hits end the run', () => {
  const state = createState();
  state.traffic = [vehicle({ id: 1 }), vehicle({ id: 2 })];
  step(state);
  assert.equal(state.health, 2);
  assert.equal(state.traffic.filter(car => car.id <= 2).every(car => car.crashed), true);
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
  state.x = .45;
  state.traffic = [vehicle({ id: 10, z: .1 })];
  step(state);
  assert.equal(state.overtakePoints, 75);
  assert.equal(state.combo, 1);
  assert.equal(state.events.at(-1).type, 'near-miss');
  drive(state, .2);
  assert.equal(state.overtakePoints, 75);
  state.x = .62;
  state.traffic = [vehicle({ id: 11, z: .1 })];
  step(state);
  assert.equal(state.overtakePoints, 125);
  assert.equal(state.events.at(-1).type, 'pass');
  state.x = 0;
  state.traffic = [vehicle({ id: 12, z: .1 })];
  step(state);
  assert.equal(state.overtakePoints, 125);
  state.x = .62;
  state.speed = 55;
  state.traffic = [vehicle({ id: 13, z: -.01 })];
  step(state, { brake: true });
  assert.equal(state.overtakePoints, 125);
  assert.equal(state.score, Math.floor(state.distance * .2) + 125);
});

test('cars already passed cannot cause invisible crashes when braking', () => {
  const state = createState();
  state.speed = 55;
  state.traffic = [vehicle({ z: -1, speed: 80, passed: true })];
  drive(state, .3, { brake: true });
  assert.equal(state.health, 3);
  assert.equal(state.overtakePoints, 0);
});

test('every generated row keeps a lane open and max-speed spacing permits an escape', () => {
  for (let seed = 1; seed <= 100; seed += 1) {
    const state = createState({ random: seeded(seed) });
    const rows = new Map();
    for (const car of state.traffic) rows.set(car.row, [...(rows.get(car.row) || []), car]);
    const positions = [...rows.values()].map(cars => cars[0].z).sort((a, b) => a - b);
    for (const cars of rows.values()) {
      assert.ok(cars.length >= 1 && cars.length <= 2);
      assert.equal(new Set(cars.map(car => car.lane)).size, cars.length);
      assert.ok(cars.every(car => LANES.includes(car.x)));
    }
    for (let index = 1; index < positions.length; index += 1) {
      assert.ok(positions[index] - positions[index - 1] >= rowSpacing(220));
    }
  }
  assert.ok(rowSpacing(220) / ((220 - 80) / 3.6) >= 1.25);
});

test('a long real-input boosted run stays finite and a simple lane escape succeeds', () => {
  const state = createState({ random: seeded(9) });
  drive(state, 90, current => {
    const ahead = current.traffic.filter(car => !car.passed && car.z > 0);
    const next = ahead.reduce((nearest, car) => !nearest || car.z < nearest.z ? car : nearest, null);
    const blocked = next ? ahead.filter(car => car.row === next.row).map(car => car.lane) : [];
    const safe = LANES.filter((_, index) => !blocked.includes(index));
    const target = safe.reduce((best, x) => Math.abs(x - current.x) < Math.abs(best - current.x) ? x : best, safe[0]);
    return { left: current.x > target + .025, right: current.x < target - .025,
      throttle: true, boost: current.elapsed % 11 < 3 };
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
  drive(a, .2, inputs);
  drive(b, .2, inputs);
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
  assert.equal(state.elapsed, .05);
  assert.doesNotThrow(() => step(state, null));
  assert.throws(() => createState({ random: 'bad' }), TypeError);
  assert.throws(() => createState({ random: () => 1 }), RangeError);
});
