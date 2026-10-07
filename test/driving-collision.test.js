import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAR_LENGTH, CAR_WIDTH, createState as createNightState, step as stepNight,
} from '../public/solo/highway-engine.js';
import {
  BIKE_LENGTH, BIKE_WIDTH, createState as createParisState, step as stepParis,
} from '../public/solo/paris-engine.js';

function car(overrides = {}) {
  return { id: 1000, row: 1000, lane: 1, x: 0, z: 0, speed: 80,
    width: 0.34, length: 4.3, color: '#ccc', passed: false, crashed: false, ...overrides };
}

function nightWithCar(overrides = {}) {
  const state = createNightState({ random: () => 0.5 });
  state.speed = 180;
  state.traffic = [car(overrides)];
  return state;
}

function openingDoor(overrides = {}) {
  const state = createParisState({ mode: 'delivery', difficulty: 'standard' });
  state.speed = 16;
  state.nextRowZ = 1e9;
  state.traffic = [{ id: 1000, row: 1000, kind: 'door', x: 0, z: 0,
    width: 1.1, targetWidth: 2.3, length: 2, speed: 0, color: '#ccc',
    targetX: 0, warningTimer: 0, warningActive: true, turnSignal: 0,
    maneuverStarted: false, passed: false, crashed: false, alerted: false, ...overrides }];
  return state;
}

test('Night Drive accepts a lateral dodge completed after the other body has cleared', () => {
  const halfWidth = (CAR_WIDTH + 0.34) / 2;
  const state = nightWithCar({ z: -(CAR_LENGTH + 4.3) / 2 + 0.01 });
  state.x = halfWidth + 0.005;
  state.steeringVelocity = -2.15;
  stepNight(state, { throttle: true, left: true });
  assert.ok(state.x < halfWidth, 'the endpoint alone appears to overlap');
  assert.equal(state.health, 3, 'lateral entry happened after longitudinal clearance');
  assert.equal(state.traffic[0].crashed, false);
  assert.equal(state.traffic[0].passed, true);
});

test('Night Drive catches contact before a last-instant lateral escape', () => {
  const halfWidth = (CAR_WIDTH + 0.34) / 2;
  const state = nightWithCar({ z: -(CAR_LENGTH + 4.3) / 2 + 0.01 });
  state.x = halfWidth - 0.005;
  state.steeringVelocity = 2.15;
  stepNight(state, { throttle: true, right: true });
  assert.ok(state.x > halfWidth, 'the endpoint alone appears safely clear');
  assert.equal(state.health, 2, 'the bodies overlapped early in the tick');
  assert.equal(state.totalCrashes, 1);
  assert.equal(state.overtakePoints, 0);
});

test('Night Drive intersects moving merge positions with their longitudinal contact interval', () => {
  for (const enteringLate of [true, false]) {
    const halfWidth = (CAR_WIDTH + 0.34) / 2;
    const state = nightWithCar({
      x: halfWidth + (enteringLate ? 0.005 : -0.005),
      z: -(CAR_LENGTH + 4.3) / 2 + 0.01,
      targetLane: enteringLate ? 0 : 2, changeTimer: 0, signal: true,
    });
    stepNight(state, { throttle: true });
    assert.equal(state.health, enteringLate ? 3 : 2);
    assert.equal(state.traffic[0].crashed, !enteringLate);
    if (!enteringLate) assert.equal(state.overtakePoints, 0);
  }
});

test('Night Drive continuous collisions retain high-speed longitudinal hits and strict side clearance', () => {
  const hit = nightWithCar({ z: 8, speed: 0, length: 0.2 });
  hit.speed = 8000;
  stepNight(hit, { throttle: true });
  assert.equal(hit.health, 2);
  assert.equal(hit.totalCrashes, 1);
  assert.equal(hit.overtakePoints, 0);
  const tangent = nightWithCar({ z: 0 });
  tangent.x = (CAR_WIDTH + 0.34) / 2;
  stepNight(tangent, { throttle: true });
  assert.equal(tangent.health, 3, 'touching a side without overlap remains safe');
});

test('Paris Pedal does not apply a future door width before the bike has cleared it', () => {
  const state = openingDoor({ z: -(BIKE_LENGTH + 2) / 2 + 0.001 });
  state.x = (BIKE_WIDTH + 1.1) / 2 + 0.003;
  stepParis(state, { throttle: true, assist: true });
  assert.ok(state.x < (BIKE_WIDTH + state.traffic[0].width) / 2,
    'the final width alone appears to overlap');
  assert.equal(state.health, 3, 'the door reached that width after the rear body cleared');
  assert.equal(state.traffic[0].crashed, false);
  assert.equal(state.traffic[0].passed, true);
});

test('Paris Pedal still catches a door opening while the bike is beside it', () => {
  const state = openingDoor();
  state.x = (BIKE_WIDTH + 1.1) / 2 + 0.003;
  stepParis(state, { throttle: true, assist: true });
  assert.equal(state.health, 2);
  assert.equal(state.traffic[0].crashed, true);
  assert.equal(state.passPoints, 0);
});

test('Paris Pedal growing-door sweeps include relative sideways motion and do not collide at a single corner', () => {
  const clearing = openingDoor({ z: -(BIKE_LENGTH + 2) / 2 + 0.001 });
  clearing.x = (BIKE_WIDTH + 1.1) / 2 + 0.008;
  clearing.vx = -3.6;
  stepParis(clearing, { throttle: true, assist: true, left: true });
  assert.equal(clearing.health, 3, 'the lateral entry occurs after the door has passed');
  const entering = openingDoor();
  entering.x = (BIKE_WIDTH + 1.1) / 2 + 0.008;
  entering.vx = -3.6;
  stepParis(entering, { throttle: true, assist: true, left: true });
  assert.equal(entering.health, 2, 'an entry alongside an opening door is still a hit');
});
