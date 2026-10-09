import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS, createCombatPlayer, emptyInput, predictLocalMovement, WORLD } from '../public/voxel-engine.js';
import { navigationPath, navigationPoints, navigationCanOccupy, navigationVisible } from '../public/voxel-navigation.js';

const openMap = () => ({ bounds: { minX: -6, maxX: 6, minZ: -6, maxZ: 6 }, colliders: [] });
const box = (id, x, y, z, w, h, d) => ({ id, x, y, z, w, h, d });

function follow(map, from, target) {
  const path = navigationPath(map, from, target);
  assert.ok(path.length, `${map.id || 'fixture'} has no route to ${JSON.stringify(target)}`);
  const body = Object.assign(createCombatPlayer(99), from, { y: from.y || 0 });
  let waypoint = 0, jumps = 0;
  for (let tick = 0; tick < 3200 && waypoint < path.length; tick++) {
    const point = path[waypoint], dx = point.x - body.x, dz = point.z - body.z, distance = Math.hypot(dx, dz);
    if (distance < .22 && Math.abs(point.y - body.y) < .04 && body.grounded) { waypoint++; continue; }
    const input = emptyInput({ yaw: Math.atan2(dx, -dz) });
    input.up = distance > .1;
    input.jump = point.jump && body.grounded && body.y < point.y - .1 && !body.previousInput.jump;
    if (input.jump) jumps++;
    predictLocalMovement(body, input, map);
    assert.ok(navigationCanOccupy(map, body), `${map.id || 'fixture'} crossed solid geometry`);
  }
  assert.equal(waypoint, path.length, `${map.id || 'fixture'} stopped at ${waypoint}: ${JSON.stringify(body)}`);
  assert.ok(Math.hypot(body.x - target.x, body.z - target.z) < .25);
  assert.ok(Math.abs(body.y - (target.y || 0)) < .04);
  return { path, jumps, body };
}

test('cached standable points are immutable, bounded, and clear on every tactical map', () => {
  for (const map of Object.values(MAPS)) {
    const points = navigationPoints(map);
    assert.equal(navigationPoints(map), points);
    assert.ok(Object.isFrozen(points)); assert.ok(points.length > 100 && points.length <= 6000);
    for (const point of points) { assert.ok(Object.isFrozen(point)); assert.ok(navigationCanOccupy(map, point)); }
  }
  const large = { bounds: { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 }, colliders: [] };
  assert.ok(navigationPoints(large).length <= 6000);
});

test('the real swept movement reaches every authored high-ground route, including bridges and Paris roofs', () => {
  let climbs = 0;
  for (const map of Object.values(MAPS)) for (const route of map.routes) {
    const landing = route.steps.at(-1), support = map.colliders.find(box => box.id === landing.colliderId);
    const result = follow(map, route.start, { x: landing.x, y: support.y + support.h, z: landing.z });
    assert.ok(result.path.filter(point => point.jump).length >= 4, `${route.id} did not use a real climb chain`);
    assert.ok(result.jumps >= 4); climbs++;
  }
  assert.equal(climbs, 34);
});

test('low .8, .9, and 1 m cover can be climbed instead of trapping melee pursuers below campers', () => {
  for (const height of [.8, .9, 1]) {
    const map = { ...openMap(), colliders: [box('crate', -1, 0, -1, 2, height, 2)] };
    const result = follow(map, { x: 0, y: 0, z: 2 }, { x: 0, y: height, z: 0 });
    assert.ok(result.jumps > 0);
    assert.ok(result.path.some(point => point.jump && Math.abs(point.y - height) < 1e-7));
  }
});

test('descent routes return through real ledges without creating repeated jumps', () => {
  for (const map of [MAPS.courtyard, MAPS.rooftops, MAPS.paris]) {
    const route = map.routes[0], landing = route.steps.at(-1), support = map.colliders.find(box => box.id === landing.colliderId);
    const result = follow(map, { x: landing.x, y: support.y + support.h, z: landing.z }, route.start);
    assert.equal(result.jumps, 0); assert.ok(result.path.every(point => !point.jump));
  }
});

test('a physical wall is routed around, while a sealed dividing wall stays disconnected', () => {
  const from = { x: 0, y: 0, z: 4 }, target = { x: 0, y: 0, z: -4 };
  const map = { ...openMap(), colliders: [box('wall', -2, 0, -.1, 4, 3, .2)] };
  const result = follow(map, from, target);
  assert.ok(result.path.some(point => Math.abs(point.x) >= 2 + WORLD.radius - 1e-7));
  assert.deepEqual(navigationPath({ ...map, colliders: [box('sealed', -6, 0, -.1, 12, 3, .2)] }, from, target), []);
});

test('circular wall contacts remain legal rather than being trapped in padded rectangles', () => {
  const map = { ...openMap(), colliders: [box('wall', 2, 0, -5, 1, 3, 10)] };
  const from = { x: 2 - WORLD.radius, y: 0, z: -4 }, target = { x: -3, y: 0, z: 4 };
  assert.ok(navigationCanOccupy(map, from));
  const result = follow(map, from, target);
  assert.equal(result.path.length, 1);
  assert.equal(result.path[0].jump, false);
});

test('jumping targets retain pursuit of the legal surface beneath them', () => {
  const map = openMap(), from = { x: 0, y: 0, z: 4 }, target = { x: 0, y: .9, z: -4 };
  assert.deepEqual(navigationPath(map, from, target), [{ x: 0, y: 0, z: -4, jump: false }]);
  const crateMap = { ...map, colliders: [box('crate', -1, 0, -1, 2, .8, 2)] };
  const path = navigationPath(crateMap, from, { x: 0, y: 1.3, z: 0 });
  assert.ok(path.length); assert.equal(path.at(-1).y, .8);
});

test('unreachable high ledges and low ceilings never create invented jump links', () => {
  const from = { x: 0, y: 0, z: 2 }, target = { x: 0, y: 1.2, z: 0 };
  const tall = { ...openMap(), colliders: [box('tall', -1, 0, -1, 2, 1.2, 2)] };
  assert.deepEqual(navigationPath(tall, from, target), []);
  const roofed = { ...openMap(), colliders: [box('crate', -1, 0, -1, 2, .8, 2), box('ceiling', -6, 2.65, -6, 12, .25, 12)] };
  assert.deepEqual(navigationPath(roofed, from, { ...target, y: .8 }), []);
});

test('world visibility respects the shared ray boxes and exact cover distance', () => {
  const map = { ...openMap(), colliders: [box('cover', -1, 0, -.1, 2, 3, .2)] };
  assert.equal(navigationVisible(map, { x: 0, y: 1.6, z: 4 }, { x: 0, y: 1.6, z: -4 }), false);
  assert.equal(navigationVisible(map, { x: 3, y: 1.6, z: 4 }, { x: 3, y: 1.6, z: -4 }), true);
  assert.equal(navigationVisible(map, { x: 0, y: 4, z: 4 }, { x: 0, y: 4, z: -4 }), true);
});

test('planning returns independent paths and never mutates map, players, or targets', () => {
  const map = MAPS.paris, from = { ...map.spawns[0][0], y: 0, hp: 75, vx: 2 }, target = { ...map.spawns[1][0], y: 0 };
  const before = JSON.stringify({ map, from, target }), path = navigationPath(map, from, target), expected = navigationPath(map, from, target);
  assert.ok(path.length); path[0].x = -999; path.length = 0;
  assert.deepEqual(navigationPath(map, from, target), expected);
  assert.equal(JSON.stringify({ map, from, target }), before);
});

test('invalid coordinates and absent arenas fail safely', () => {
  const map = openMap(), point = { x: 0, y: 0, z: 0 };
  for (const invalid of [{ ...point, x: NaN }, { ...point, y: NaN }, { ...point, z: Infinity }, { x: 100, y: 0, z: 0 }]) {
    assert.equal(navigationCanOccupy(map, invalid), false);
    assert.deepEqual(navigationPath(map, invalid, point), []);
    assert.deepEqual(navigationPath(map, point, invalid), []);
  }
  assert.deepEqual(navigationPoints(null), []); assert.deepEqual(navigationPath(null, point, point), []);
  assert.equal(navigationVisible(map, point, { ...point, y: NaN }), false);
});
