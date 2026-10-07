import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAR_BODY,
  WORLD,
  FIXED_DT,
  createState,
  getTrack,
  nearestTrack,
  trackInfo,
  step,
} from '../public/solo/circuit-engine.js';

const angle = value => Math.atan2(Math.sin(value), Math.cos(value));
const extents = heading => ({
  x: Math.abs(Math.cos(heading)) * CAR_BODY.halfLength + Math.abs(Math.sin(heading)) * CAR_BODY.halfWidth,
  y: Math.abs(Math.sin(heading)) * CAR_BODY.halfLength + Math.abs(Math.cos(heading)) * CAR_BODY.halfWidth,
});
const assertBodyWithinWorld = (car, label) => {
  const extent = extents(car.heading);
  assert.ok(car.x - extent.x >= -1e-9, `${label}: left body edge`);
  assert.ok(car.x + extent.x <= WORLD.width + 1e-9, `${label}: right body edge`);
  assert.ok(car.y - extent.y >= -1e-9, `${label}: top body edge`);
  assert.ok(car.y + extent.y <= WORLD.height + 1e-9, `${label}: bottom body edge`);
};

for (const difficulty of ['standard', 'veteran', 'nightmare']) {
  test(`a legal inside line earns Harbor Ring checkpoint 3 on ${difficulty}`, () => {
    // This driver begins at the ordinary standing start. It never edits the
    // state: a slow inside line exposes the polygon projection jump at gate 3.
    const state = createState({ trackId: 'harbor-ring', difficulty });
    const track = getTrack(state);
    const gate = track.gates[3];
    let crossing = null;
    for (let tick = 0; tick < 1500 && state.phase === 'playing'; tick++) {
      const projected = nearestTrack(state.car, undefined, track.id);
      const speed = Math.hypot(state.car.vx, state.car.vy);
      const target = trackInfo(projected.s + 24 + speed * 0.05, track.id);
      const offset = projected.s > gate.s - 180 && projected.s < gate.s + 100 ? -19 : 0;
      const targetX = target.x - target.ty * offset;
      const targetY = target.y + target.tx * offset;
      const error = angle(Math.atan2(targetY - state.car.y, targetX - state.car.x) - state.car.heading);
      const before = {
        x: state.car.x,
        y: state.car.y,
        s: projected.s,
        side: (state.car.x - gate.x) * gate.tx + (state.car.y - gate.y) * gate.ty,
        gate: state.nextGate,
        travel: state.course.travel,
      };
      step(state, {
        throttle: speed < 85,
        brake: speed > 88,
        left: error < -0.025,
        right: error > 0.025,
      }, FIXED_DT);
      assert.equal(state.onRoad, true, 'the entire approach remains on asphalt');
      if (state.challenge) assert.equal(state.challenge.offRoad, 0);
      const side = (state.car.x - gate.x) * gate.tx + (state.car.y - gate.y) * gate.ty;
      if (before.gate === 3 && before.side < 0 && side >= 0) {
        crossing = before;
        break;
      }
    }
    assert.ok(crossing, 'the legal driver reaches the directed checkpoint plane');
    assert.ok(crossing.travel >= track.length / track.gates.length * 0.85, 'the driver earns enough continuous course travel');
    const moved = Math.hypot(state.car.x - crossing.x, state.car.y - crossing.y);
    const projectedAdvance = nearestTrack(state.car, undefined, track.id).s - crossing.s;
    assert.ok(projectedAdvance > moved * 1.8 + 0.25, 'this is the corner-projection regression, not an ordinary centreline crossing');
    assert.equal(state.nextGate, 4, 'an on-road forward crossing earns checkpoint credit despite the projection jump');
    assert.equal(state.phase, 'playing');
  });
}

test('world walls contain the rotated car body and reflect outward motion', () => {
  for (const heading of [0, Math.PI / 4, Math.PI / 2, 2.4]) {
    for (const side of ['left', 'right', 'top', 'bottom']) {
      const state = createState();
      state.startDelay = 0;
      const vertical = side === 'top' || side === 'bottom';
      const lower = side === 'left' || side === 'top';
      const axis = vertical ? 'y' : 'x';
      const velocity = vertical ? 'vy' : 'vx';
      const worldSize = vertical ? WORLD.height : WORLD.width;
      const extent = extents(heading)[axis];
      Object.assign(state.car, {
        x: WORLD.width / 2,
        y: WORLD.height / 2,
        heading,
        angularVelocity: 0,
        vx: 0,
        vy: 0,
        [axis]: lower ? extent + 0.01 : worldSize - extent - 0.01,
        [velocity]: lower ? -150 : 150,
      });
      assertBodyWithinWorld(state.car, `${side} before contact`);
      step(state, {}, FIXED_DT);
      assertBodyWithinWorld(state.car, `${side} at heading ${heading}`);
      assert.ok(lower ? state.car[velocity] > 0 : state.car[velocity] < 0, `${side}: outward velocity reflects inward`);
    }
  }
});

test('corner contact contains the whole diagonal body on both axes', () => {
  const heading = Math.PI / 4;
  const extent = extents(heading);
  for (const horizontal of [-1, 1]) for (const vertical of [-1, 1]) {
    const state = createState();
    state.startDelay = 0;
    Object.assign(state.car, {
      x: horizontal < 0 ? extent.x + 0.01 : WORLD.width - extent.x - 0.01,
      y: vertical < 0 ? extent.y + 0.01 : WORLD.height - extent.y - 0.01,
      heading,
      angularVelocity: 0,
      vx: horizontal * 120,
      vy: vertical * 120,
    });
    assertBodyWithinWorld(state.car, 'before corner contact');
    step(state, {}, FIXED_DT);
    assertBodyWithinWorld(state.car, `corner ${horizontal},${vertical}`);
    assert.ok(state.car.vx * horizontal < 0, 'horizontal outward velocity reflects');
    assert.ok(state.car.vy * vertical < 0, 'vertical outward velocity reflects');
  }
});

test('rotation into a wall preserves velocity already moving inward', () => {
  for (const side of ['left', 'right', 'top', 'bottom']) {
    const state = createState();
    state.startDelay = 0;
    const vertical = side === 'top' || side === 'bottom';
    const lower = side === 'left' || side === 'top';
    const heading = vertical ? Math.PI / 2 : 0;
    const axis = vertical ? 'y' : 'x';
    const velocity = vertical ? 'vy' : 'vx';
    const worldSize = vertical ? WORLD.height : WORLD.width;
    const previousExtent = extents(heading)[axis];
    Object.assign(state.car, {
      x: WORLD.width / 2,
      y: WORLD.height / 2,
      heading,
      angularVelocity: 5,
      vx: 0,
      vy: 0,
      [axis]: lower ? previousExtent + 0.0001 : worldSize - previousExtent - 0.0001,
      [velocity]: lower ? 0.6 : -0.6,
    });
    assertBodyWithinWorld(state.car, `${side} before rotating`);
    step(state, {}, FIXED_DT);
    const newExtent = extents(state.car.heading)[axis];
    assert.ok(newExtent > previousExtent + 0.1, 'rotation widens the body into the wall');
    assertBodyWithinWorld(state.car, `${side} after rotating`);
    const expectedPosition = lower ? newExtent : worldSize - newExtent;
    assert.ok(Math.abs(state.car[axis] - expectedPosition) < 1e-9, 'the expanded body is clamped at contact');
    assert.ok(lower ? state.car[velocity] > 0 : state.car[velocity] < 0, `${side}: inward motion must not reverse outward`);
  }
});
