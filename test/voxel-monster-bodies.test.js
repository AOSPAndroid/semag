import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, combatStep, emptyInput, eyeHeight, playerHeight, predictLocalMovement, traceShot, WORLD } from '../public/voxel-engine.js';
import { setInventoryMeleeLoadout } from '../public/voxel-inventory.js';
import { MONSTER_BODIES, monsterAttackHeight, monsterAttackOrigin, monsterEyeOrigin, monsterBodyBoxes, monsterBodyProfile, monsterBodySamplePoints, monsterClosestPoint, monsterMovementMultiplier, monsterMovementSpeed } from '../public/voxel-monster-bodies.js';
import { navigationCanOccupy, navigationPath, navigationPoints } from '../public/voxel-navigation.js';
import { enableLagCompensation, recordLagCompensation, setShotViewTick, traceCompensatedShot } from '../public/voxel-lag-compensation.js';

const arena = (colliders = []) => ({ id: 'hound-fixture', bounds: { minX: -8, maxX: 8, minZ: -8, maxZ: 8 }, colliders });
const hound = (changes = {}) => Object.assign(createCombatPlayer(1), { monster: true, human: false, monsterType: 'hound', team: 1, radius: .50, hp: 45, maxHp: 45 }, changes);
const world = (dog, p) => ({ x: dog.x + Math.cos(dog.yaw) * p.x - Math.sin(dog.yaw) * p.z, y: dog.y + p.y, z: dog.z + Math.sin(dog.yaw) * p.x + Math.cos(dog.yaw) * p.z });
const rotated = (yaw, direction) => ({ x: Math.cos(yaw) * direction.x - Math.sin(yaw) * direction.z, y: direction.y, z: Math.sin(yaw) * direction.x + Math.cos(yaw) * direction.z });
const state = (dog, map = arena()) => ({ gameId: 'voxel-horde', phase: 'fight', round: 1, matchId: 1, map, tick: 0, events: [], eventId: 0, loot: [], grenades: [], bolts: [], players: [createCombatPlayer(0), dog] });
const trace = (dog, local, direction, map = arena()) => traceShot(state(dog, map), 0, world(dog, local), rotated(dog.yaw, direction), 10, map);
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);

test('only exact authoritative hound flags select immutable low body dimensions', () => {
  const dog = hound();
  assert.equal(monsterBodyProfile(dog), MONSTER_BODIES.hound);
  assert.equal(playerHeight(dog), .80); assert.equal(eyeHeight(dog), .66); assert.equal(monsterAttackHeight(dog), .60);
  dog.crouching = true;
  assert.equal(playerHeight(dog), .80); assert.equal(eyeHeight(dog), .66);
  assert.ok(Object.isFrozen(MONSTER_BODIES)); assert.ok(Object.isFrozen(MONSTER_BODIES.hound));
  assert.ok(Object.isFrozen(monsterBodyBoxes(dog)));
  assert.equal(monsterBodyBoxes(dog).length, 6);
  for (const rect of monsterBodyBoxes(dog)) assert.ok(Object.isFrozen(rect));
  for (const changes of [{ monster: false }, { monster: 1 }, { human: true }, { monsterType: ['hound'] }, { monsterType: new String('hound') }, { monsterType: 'Hound' }, { monsterType: 'unknown' }]) {
    const impostor = hound({ ...changes, crouching: false, bodyHeight: .1, eyeHeight: .1, monsterSpeed: 90 });
    assert.equal(monsterBodyProfile(impostor), null); assert.equal(playerHeight(impostor), WORLD.standHeight); assert.equal(eyeHeight(impostor), WORLD.eyeHeight);
  }
});

test('every authored hound hitbox corner fits its swept collision envelope at all headings', () => {
  for (let step = 0; step < 64; step++) {
    const dog = hound({ yaw: step * Math.PI / 32 });
    for (const box of monsterBodyBoxes(dog)) for (const x of [box.x, box.x + box.w]) for (const y of [box.y, box.y + box.h]) for (const z of [box.z, box.z + box.d]) {
      const corner = world(dog, { x, y, z });
      assert.ok(Math.hypot(corner.x - dog.x, corner.z - dog.z) <= dog.radius + 1e-8);
      assert.ok(corner.y >= dog.y && corner.y <= dog.y + playerHeight(dog) + 1e-8);
    }
  }
});

test('low canine head, torso, separate legs and empty gaps trace accurately through every yaw', () => {
  for (let step = 0; step < 32; step++) {
    const dog = hound({ x: .8, y: .2, z: -.7, yaw: step * Math.PI / 16 });
    assert.equal(trace(dog, { x: 0, y: .66, z: -3 }, { x: 0, y: 0, z: 1 }).kind, 'head', `front head at yaw ${dog.yaw}`);
    assert.equal(trace(dog, { x: -3, y: .42, z: .12 }, { x: 1, y: 0, z: 0 }).kind, 'body');
    assert.equal(trace(dog, { x: -3, y: .16, z: -.19 }, { x: 1, y: 0, z: 0 }).kind, 'leg');
    assert.equal(trace(dog, { x: -3, y: .16, z: 0 }, { x: 1, y: 0, z: 0 }).kind, 'none', 'between forelegs and hind legs');
    assert.equal(trace(dog, { x: .24, y: .60, z: -3 }, { x: 0, y: 0, z: 1 }).kind, 'none', 'no inflated rotated AABB');
    assert.equal(trace(dog, { x: 0, y: .81, z: -3 }, { x: 0, y: 0, z: 1 }).kind, 'none', 'shots just over ears miss');
    assert.equal(trace(dog, { x: 0, y: 1.6, z: -3 }, { x: 0, y: 0, z: 1 }).kind, 'none', 'no invisible human-height target');
  }
});

test('real cover blocks low canine headshots and low silhouettes do not hide a taller enemy', () => {
  const dog = hound({ z: -3 }), map = arena([{ id: 'cover', x: -2, y: 0, z: -1, w: 4, h: .85, d: .25 }]);
  const hit = traceShot(state(dog, map), 0, { x: 0, y: .66, z: 3 }, { x: 0, y: 0, z: -1 }, 10, map);
  assert.equal(hit.kind, 'wall'); assert.equal(hit.colliderId, 'cover');
  const snapshot = state(dog);
  snapshot.players.push(Object.assign(createCombatPlayer(2), { z: -5 }));
  const over = traceShot(snapshot, 0, { x: 0, y: 1.62, z: 3 }, { x: 0, y: 0, z: -1 }, 10, snapshot.map);
  assert.equal(over.playerId, 2); assert.equal(over.kind, 'head');
});

test('closest canine flesh and area-damage samples remain on real rotated boxes', () => {
  for (let step = 0; step < 16; step++) {
    const dog = hound({ x: -1, z: 2, y: .3, yaw: step * Math.PI / 8 });
    const samples = monsterBodySamplePoints(dog);
    assert.equal(samples.length, 6);
    for (const point of [monsterEyeOrigin(dog), monsterAttackOrigin(dog)]) { const hit = monsterClosestPoint(dog, point); near(hit.distance, 0); assert.equal(hit.kind, 'head'); }
    for (const sample of samples) near(monsterClosestPoint(dog, sample).distance, 0);
    const contact = monsterClosestPoint(dog, world(dog, { x: 0, y: .16, z: 0 }));
    assert.equal(contact.kind, 'leg'); assert.ok(contact.distance > .07 && contact.distance < .2);
    assert.equal(traceShot(state(dog), 0, contact, { x: 0, y: 1, z: 0 }, .001, arena()).playerId, 1);
  }
  assert.equal(monsterClosestPoint(createCombatPlayer(0), { x: 0, y: 0, z: 0 }), null);
  assert.equal(monsterBodySamplePoints(hound({ x: NaN })), null);
});

test('a human katana makes one real flesh contact across every canine facing', () => {
  for (let step = 0; step < 16; step++) {
    const dog = hound({ z: -1.75, yaw: step * Math.PI / 8, hp: 100, maxHp: 100 }), snapshot = state(dog);
    setInventoryMeleeLoadout(snapshot.players[0], 'katana', { equip: true });
    snapshot.tick++; combatStep(snapshot, [{ ...emptyInput({ yaw: 0, pitch: -.28 }), fire: true }, emptyInput(dog)]);
    for (let tick = 0; tick < 55; tick++) { snapshot.tick++; combatStep(snapshot, [emptyInput({ yaw: 0, pitch: -.28 }), emptyInput(dog)]); }
    assert.equal(dog.hp, 52, `katana once through facing ${dog.yaw}`);
    assert.equal(snapshot.events.filter(event => event.type === 'damage').length, 1);
  }
});

test('the dog clears honest low overhead cover while a standing human cannot', () => {
  const map = arena([{ id: 'low-roof', x: -4, y: .82, z: -1, w: 8, h: 1, d: 2 }]);
  const dog = hound({ z: 3 }), human = Object.assign(createCombatPlayer(0), { z: 3 });
  for (let tick = 0; tick < 150; tick++) {
    predictLocalMovement(dog, { ...emptyInput(), up: true, crouch: true }, map);
    predictLocalMovement(human, { ...emptyInput(), up: true }, map);
    assert.ok(navigationCanOccupy(map, dog));
  }
  assert.equal(dog.crouching, false); assert.equal(dog.radius, .50);
  assert.ok(dog.z < -2, `dog traversed the low roof: ${dog.z}`);
  assert.ok(human.z >= 1 + WORLD.radius - 1e-7, `standing human stopped: ${human.z}`);
});

test('hound speed is weapon-independent, slightly faster than runners, and does not leak to humans', () => {
  const map = arena(), pistolDog = hound({ x: -3, weapon: 'pistol' }), heavyDog = hound({ x: 3, weapon: 'lmg' });
  for (let tick = 0; tick < 100; tick++) {
    predictLocalMovement(pistolDog, { ...emptyInput(), up: true }, map);
    predictLocalMovement(heavyDog, { ...emptyInput(), up: true }, map);
  }
  near(pistolDog.vz, -6.8); near(heavyDog.vz, -6.8); near(pistolDog.z, heavyDog.z);
  const fake = Object.assign(createCombatPlayer(0), { monster: false, monsterType: 'hound', monsterRallyTicks: 180, lungeTicks: 30, monsterState: 'leap' });
  assert.equal(monsterMovementSpeed(fake), null); assert.equal(monsterMovementMultiplier(fake), 1);
  const leaper = hound({ monsterType: 'leaper', monsterState: 'leap', lungeTicks: 30, monsterRallyTicks: 180 });
  assert.equal(monsterMovementSpeed(leaper), 9); assert.equal(monsterMovementMultiplier(leaper), 1);
  leaper.lungeTicks = 0; assert.equal(monsterMovementSpeed(leaper), 5.5); assert.equal(monsterMovementMultiplier(leaper), 1.18);
  for (const ticks of [0, -1, 181, Infinity, NaN, '180', .5]) assert.equal(monsterMovementMultiplier(hound({ monsterRallyTicks: ticks })), 1);
  assert.equal(monsterMovementMultiplier(hound({ monsterType: 'runner', monsterRallyTicks: 180 })), 1.18);
});

test('hound jumps retain authored crate reach and collisions prevent ceiling penetration', () => {
  const dog = hound(), map = arena();
  predictLocalMovement(dog, { ...emptyInput(), jump: true }, map);
  near(dog.vy, WORLD.jumpSpeed - WORLD.gravity / 120);
  let apex = dog.y;
  for (let tick = 0; tick < 100; tick++) { predictLocalMovement(dog, emptyInput(), map); apex = Math.max(apex, dog.y); }
  assert.ok(apex > 1.0 && apex < 1.12); assert.equal(dog.y, 0);
  const roofMap = arena([{ id: 'ceiling', x: -2, y: 1.1, z: -2, w: 4, h: 1, d: 4 }]), under = hound();
  for (let tick = 0; tick < 100; tick++) {
    predictLocalMovement(under, { ...emptyInput(), jump: tick === 0 }, roofMap);
    assert.ok(under.y + playerHeight(under) <= 1.1 + 1e-8);
  }
});

test('body-aware cached navigation accepts low dog routes and excludes narrow human routes', () => {
  const roof = arena([{ id: 'roof', x: -8, y: .82, z: -1, w: 16, h: 2, d: 2 }]), dog = hound({ z: 3 });
  assert.deepEqual(navigationPath(roof, dog, { x: 0, y: 0, z: -3 }), [{ x: 0, y: 0, z: -3, jump: false }]);
  assert.deepEqual(navigationPath(roof, { x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: -3 }), []);
  const channel = arena([{ id: 'left', x: -8, y: 0, z: -1, w: 7.58, h: 3, d: 2 }, { id: 'right', x: .42, y: 0, z: -1, w: 7.58, h: 3, d: 2 }]);
  assert.ok(navigationPath(channel, { x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: -3 }).length);
  assert.deepEqual(navigationPath(channel, dog, { x: 0, y: 0, z: -3 }), []);
  const map = arena(), dogNodes = navigationPoints(map, dog), humanNodes = navigationPoints(map);
  assert.equal(navigationPoints(map, dog), dogNodes); assert.equal(navigationPoints(map), humanNodes); assert.notEqual(dogNodes, humanNodes);
  assert.ok(dogNodes.length <= 6000); for (const point of dogNodes) assert.ok(navigationCanOccupy(map, point, MONSTER_BODIES.hound));
});

test('the exact dog body follows real .8, .9 and 1 metre crate paths without clipping', () => {
  for (const height of [.8, .9, 1]) {
    const map = arena([{ id: 'crate', x: -1, y: 0, z: -1, w: 2, h: height, d: 2 }]);
    const dog = hound({ z: 2 }), route = navigationPath(map, dog, { x: 0, y: height, z: 0 });
    assert.ok(route.length); assert.ok(route.some(point => point.jump));
    let waypoint = 0;
    for (let tick = 0; tick < 1600 && waypoint < route.length; tick++) {
      const point = route[waypoint], dx = point.x - dog.x, dz = point.z - dog.z, distance = Math.hypot(dx, dz);
      if (distance < .22 && Math.abs(point.y - dog.y) < .04 && dog.grounded) { waypoint++; continue; }
      const input = { ...emptyInput({ yaw: Math.atan2(dx, -dz) }), up: distance > .1, jump: point.jump && dog.grounded && dog.y < point.y - .1 && !dog.previousInput.jump };
      predictLocalMovement(dog, input, map);
      assert.ok(navigationCanOccupy(map, dog), 'the conservative dog envelope never crossed solid cover');
    }
    assert.equal(waypoint, route.length, `hound reached ${height}m crate`);
    near(dog.y, height); assert.ok(dog.grounded);
  }
});

test('dogs can route to a real bite position for humans standing close to walls', () => {
  const map = arena([{ id: 'wall', x: 0, y: 0, z: -8, w: 1, h: 3, d: 16 }]);
  const dog = hound({ x: -3, z: 2 }), target = { x: -.33, y: 0, z: -2 };
  assert.equal(navigationCanOccupy(map, target), true);
  assert.equal(navigationCanOccupy(map, target, MONSTER_BODIES.hound), false);
  const route = navigationPath(map, dog, target);
  assert.ok(route.length); assert.ok(navigationCanOccupy(map, route.at(-1), MONSTER_BODIES.hound));
  assert.ok(Math.hypot(route.at(-1).x - target.x, route.at(-1).z - target.z) <= .75 + 1e-8);
});

test('historical canine traces rewind exact head orientation along a short yaw arc', () => {
  const dog = hound({ z: -3 }), snapshot = state(dog);
  enableLagCompensation(snapshot);
  snapshot.tick = 100; recordLagCompensation(snapshot);
  snapshot.tick = 101; dog.yaw = Math.PI; recordLagCompensation(snapshot);
  const origin = { x: -3, y: .66, z: -3.32 }, direction = { x: 1, y: 0, z: 0 };
  assert.equal(traceShot(snapshot, 0, origin, direction, 10, snapshot.map).kind, 'none');
  assert.equal(setShotViewTick(snapshot, 0, 100), true);
  const before = structuredClone(snapshot), hit = traceCompensatedShot(snapshot, 0, origin, direction, 10, snapshot.map, traceShot);
  assert.equal(hit.kind, 'head'); assert.equal(hit.playerId, 1); assert.deepEqual(snapshot, before);
  dog.monsterType = 'runner';
  assert.deepEqual(traceCompensatedShot(snapshot, 0, origin, direction, 10, snapshot.map, traceShot), traceShot(snapshot, 0, origin, direction, 10, snapshot.map), 'body changes cannot reuse a canine life shape');
});

test('ordinary human standing and crouching traces keep their original head, torso and knee boundaries', () => {
  const human = Object.assign(createCombatPlayer(1), { z: -3 }), snapshot = state(human);
  for (const [crouching, headY, torsoY, legY] of [[false, 1.62, 1, .2], [true, .98, .6, .15]]) {
    human.crouching = crouching;
    for (const [y, kind] of [[headY, 'head'], [torsoY, 'body'], [legY, 'leg']]) assert.equal(traceShot(snapshot, 0, { x: 0, y, z: 0 }, { x: 0, y: 0, z: -1 }, 10, snapshot.map).kind, kind);
    assert.equal(playerHeight(human), crouching ? WORLD.crouchHeight : WORLD.standHeight);
    assert.equal(eyeHeight(human), crouching ? WORLD.crouchEyeHeight : WORLD.eyeHeight);
  }
});
