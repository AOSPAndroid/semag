import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, emptyInput, eyeHeight, playerHeight, predictLocalMovement, traceShot, WORLD } from '../public/voxel-engine.js';
import { MONSTER_BODIES, monsterTypeId, monsterBodyProfile, monsterBodyBoxes, monsterEyeOrigin, monsterAttackOrigin, monsterBodySamplePoints, monsterClosestPoint, monsterMovementSpeed, monsterMovementMultiplier } from '../public/voxel-monster-bodies.js';
import { navigationCanOccupy, navigationPath } from '../public/voxel-navigation.js';

const ANIMALS = ['wolf', 'pig', 'rat', 'stag'], ALL = ['vampire', 'witch', ...ANIMALS];
const actor = (type, patch = {}) => Object.assign(createCombatPlayer(1), { monster: true, human: false, monsterType: type, team: 1, hp: 100, maxHp: 100, lifeId: 1, radius: MONSTER_BODIES[type]?.radius ?? WORLD.radius }, patch);
const arena = (colliders = []) => ({ id: 'bestiary-body-fixture', bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, colliders });
const localToWorld = (player, point) => ({ x: player.x + Math.cos(player.yaw) * point.x - Math.sin(player.yaw) * point.z, y: player.y + point.y, z: player.z + Math.sin(player.yaw) * point.x + Math.cos(player.yaw) * point.z });
const direction = (yaw, point) => ({ x: Math.cos(yaw) * point.x - Math.sin(yaw) * point.z, y: point.y, z: Math.sin(yaw) * point.x + Math.cos(yaw) * point.z });
const trace = (player, origin, ray, map = arena()) => traceShot({ phase: 'fight', gameId: 'voxel-horde', tick: 0, map, players: [createCombatPlayer(0), player] }, 0, localToWorld(player, origin), direction(player.yaw, ray), 10, map);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} should equal ${b}`);

test('new species require exact trusted monster flags and each animal has immutable distinct physical anatomy', () => {
  const signatures = new Set();
  for (const type of ALL) {
    const player = actor(type);
    assert.equal(monsterTypeId(player), type);
    for (const patch of [{ monster: false }, { monster: 1 }, { human: true }, { monsterType: type.toUpperCase() }, { monsterType: [type] }, { monsterType: new String(type) }]) {
      const fake = { ...player, ...patch, bodyHeight: .1, monsterSpeed: 100 };
      assert.equal(monsterTypeId(fake), null); assert.equal(monsterBodyProfile(fake), null); assert.equal(monsterMovementSpeed(fake), null);
    }
    if (ANIMALS.includes(type)) {
      const body = MONSTER_BODIES[type];
      assert.equal(monsterBodyProfile(player), body); assert.ok(Object.isFrozen(body) && Object.isFrozen(body.boxes) && body.boxes.every(Object.isFrozen));
      assert.equal(body.boxes.filter(box => box.kind === 'leg').length, 4);
      assert.equal(playerHeight(player), body.height); assert.equal(eyeHeight(player), body.eyeHeight);
      signatures.add(`${body.height}:${body.radius}:${body.boxes.length}`);
    } else {
      assert.equal(monsterBodyProfile(player), null); assert.equal(playerHeight(player), WORLD.standHeight);
    }
  }
  assert.equal(signatures.size, 4);
});

test('every animal flesh corner fits its actual swept radius and height at every rotation', () => {
  for (const type of ANIMALS) for (let turn = 0; turn < 64; turn++) {
    const player = actor(type, { yaw: turn * Math.PI / 32, x: .7, y: .3, z: -.4 }), body = monsterBodyProfile(player);
    for (const box of body.boxes) for (const x of [box.x, box.x + box.w]) for (const y of [box.y, box.y + box.h]) for (const z of [box.z, box.z + box.d]) {
      const point = localToWorld(player, { x, y, z });
      assert.ok(Math.hypot(point.x - player.x, point.z - player.z) <= body.radius + 1e-8, `${type}: no unhittable appendage enters cover`);
      assert.ok(point.y >= player.y && point.y <= player.y + body.height + 1e-8);
    }
  }
});

test('each low animal has a real forward headshot zone, separate torso and legs, and no invisible human-height body', () => {
  for (const type of ANIMALS) for (let turn = 0; turn < 16; turn++) {
    const player = actor(type, { yaw: turn * Math.PI / 8 }), body = monsterBodyProfile(player);
    const head = body.boxes.find(box => box.kind === 'head'), torso = body.boxes.find(box => box.kind === 'body'), leg = body.boxes.find(box => box.kind === 'leg');
    assert.equal(trace(player, { x: 0, y: head.y + head.h / 2, z: -3 }, { x: 0, y: 0, z: 1 }).kind, 'head', type);
    assert.equal(trace(player, { x: -3, y: torso.y + torso.h / 2, z: torso.z + torso.d * .9 }, { x: 1, y: 0, z: 0 }).kind, 'body', type);
    assert.equal(trace(player, { x: -3, y: .04, z: leg.z + leg.d / 2 }, { x: 1, y: 0, z: 0 }).kind, 'leg', type);
    assert.equal(trace(player, { x: 0, y: body.height + .01, z: -3 }, { x: 0, y: 0, z: 1 }).kind, 'none', `${type}: over the crown misses`);
  }
});

test('rat tail and stag antlers are genuine authored hit zones rather than decoration outside the body', () => {
  const rat = actor('rat'), stag = actor('stag');
  assert.equal(trace(rat, { x: -3, y: .115, z: .20 }, { x: 1, y: 0, z: 0 }).kind, 'body');
  assert.equal(trace(stag, { x: .25, y: 1.60, z: -3 }, { x: 0, y: 0, z: 1 }).kind, 'head');
  assert.equal(trace(stag, { x: 0, y: 1.55, z: -3 }, { x: 0, y: 0, z: 1 }).kind, 'none', 'empty antler gaps cannot grant invisible headshots');
  assert.equal(trace(rat, { x: -3, y: .115, z: .28 }, { x: 1, y: 0, z: 0 }).kind, 'none');
  assert.equal(trace(stag, { x: 0, y: 1.66, z: -3 }, { x: 0, y: 0, z: 1 }).kind, 'none');
});

test('eye, bite and area-damage samples stay on actual rotated flesh, including tiny targets', () => {
  for (const type of ANIMALS) for (let turn = 0; turn < 16; turn++) {
    const player = actor(type, { x: 2, y: .4, z: -1, yaw: turn * Math.PI / 8 }), before = structuredClone(player);
    for (const point of [monsterEyeOrigin(player), monsterAttackOrigin(player), ...monsterBodySamplePoints(player)]) near(monsterClosestPoint(player, point).distance, 0);
    const closest = monsterClosestPoint(player, localToWorld(player, { x: 0, y: .05, z: 0 }));
    assert.ok(closest && Number.isFinite(closest.distance));
    assert.deepEqual(player, before);
  }
});

test('physical movement uses each species speed and radius independently of a stale weapon field', () => {
  for (const type of ALL) {
    const light = actor(type, { x: -3, weapon: 'pistol' }), heavy = actor(type, { x: 3, weapon: 'lmg' }), map = arena();
    for (let tick = 0; tick < 80; tick++) {
      predictLocalMovement(light, { ...emptyInput(), up: true }, map);
      predictLocalMovement(heavy, { ...emptyInput(), up: true }, map);
      assert.ok(navigationCanOccupy(map, light)); assert.ok(navigationCanOccupy(map, heavy));
    }
    near(light.vz, -monsterMovementSpeed(light)); near(heavy.vz, light.vz); near(light.z, heavy.z);
    if (ANIMALS.includes(type)) { assert.equal(light.radius, MONSTER_BODIES[type].radius); assert.equal(light.crouching, false); }
  }
});

test('vampire and boar rush speed exists only during their actual finite committed lunge', () => {
  for (const [type, ticks, speed, ordinary] of [['vampire', 24, 10.5, 5.2], ['pig', 42, 9.2, 4]]) {
    const player = actor(type, { monsterState: 'leap', lungeTicks: ticks, monsterRallyTicks: 180 });
    assert.equal(monsterMovementSpeed(player), speed); assert.equal(monsterMovementMultiplier(player), 1);
    for (const invalid of [0, -1, ticks + 1, .5, NaN, Infinity, String(ticks)]) {
      assert.equal(monsterMovementSpeed({ ...player, lungeTicks: invalid }), ordinary);
    }
    assert.equal(monsterMovementSpeed({ ...player, monsterState: 'chase' }), ordinary);
    assert.equal(monsterMovementSpeed({ ...player, monster: false }), null);
  }
});

test('a tiny rat clears real low headroom that blocks taller species; paths use the same body profile', () => {
  const map = arena([{ id: 'low-pipe', x: -2, y: .40, z: -1, w: 4, h: 1.5, d: 2 }]);
  const rat = actor('rat', { z: 3 }), wolf = actor('wolf', { z: 3 });
  for (let tick = 0; tick < 110; tick++) {
    predictLocalMovement(rat, { ...emptyInput(), up: true }, map);
    predictLocalMovement(wolf, { ...emptyInput(), up: true }, map);
    assert.ok(navigationCanOccupy(map, rat)); assert.ok(navigationCanOccupy(map, wolf));
  }
  assert.ok(rat.z < -2); assert.ok(wolf.z >= 1 + MONSTER_BODIES.wolf.radius - 1e-7);
  const path = navigationPath(map, actor('rat', { z: 3 }), { x: 0, y: 0, z: -3 });
  assert.ok(path.length); assert.ok(path.every(point => navigationCanOccupy(map, point, MONSTER_BODIES.rat)));
});
