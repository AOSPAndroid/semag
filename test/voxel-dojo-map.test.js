import assert from 'node:assert/strict';
import test from 'node:test';
import { DOJO_MAP, DOJO_PLAYER_SPAWN, DOJO_RANGE_LANES, DOJO_STATIONS, DOJO_TARGET_SPAWNS } from '../public/voxel-dojo-map.js';
import { MAPS, MAP_IDS } from '../public/voxel-maps.js';
import { createCombatPlayer, emptyInput, findNearbyLoot, predictLocalMovement, rayBox, traceShot, WORLD } from '../public/voxel-engine.js';
import { navigationCanOccupy, navigationPath, navigationVisible } from '../public/voxel-navigation.js';

const EPS = 1e-7;
const eye = point => ({ x: point.x, y: point.y + WORLD.eyeHeight, z: point.z });
const forward = Object.freeze({ x: 0, y: 0, z: -1 });

test('Dojo is an immutable isolated training map with bounded, positive collision geometry', () => {
  assert.equal(DOJO_MAP.id, 'dojo');
  assert.equal(DOJO_MAP.theme, 'dojo');
  assert.ok(!MAP_IDS.includes('dojo'));
  assert.equal(MAPS.dojo, undefined);
  assert.equal(DOJO_MAP.sites.length, 0);
  assert.ok(Object.isFrozen(DOJO_MAP));
  for (const key of ['bounds', 'colliders', 'decorations', 'stations', 'targetSpawns', 'rangeLanes', 'spawns', 'sites'])
    assert.ok(Object.isFrozen(DOJO_MAP[key]), key);
  assert.ok(DOJO_MAP.colliders.length <= 100);
  assert.equal(new Set(DOJO_MAP.colliders.map(value => value.id)).size, DOJO_MAP.colliders.length);
  for (const box of DOJO_MAP.colliders) {
    assert.ok(Object.isFrozen(box));
    assert.ok(box.id && box.color && box.material);
    for (const key of ['x', 'y', 'z', 'w', 'h', 'd']) assert.ok(Number.isFinite(box[key]), `${box.id}/${key}`);
    for (const key of ['w', 'h', 'd']) assert.ok(box[key] > 0, `${box.id}/${key}`);
    if (/^dojo-(west|east|north|south)-wall$/.test(box.id)) continue;
    assert.ok(box.x >= DOJO_MAP.bounds.minX - EPS && box.x + box.w <= DOJO_MAP.bounds.maxX + EPS, `${box.id}/x`);
    assert.ok(box.z >= DOJO_MAP.bounds.minZ - EPS && box.z + box.d <= DOJO_MAP.bounds.maxZ + EPS, `${box.id}/z`);
  }
});

test('Standing players can occupy every spawn, station and target; the only hall roof clears a full jump', () => {
  for (const point of [DOJO_PLAYER_SPAWN, ...DOJO_MAP.spawns.flat(), ...DOJO_STATIONS, ...DOJO_RANGE_LANES.map(lane => lane.origin)]) {
    assert.ok(navigationCanOccupy(DOJO_MAP, point), `${point.x}/${point.z} clear body`);
    assert.ok(Object.isFrozen(point));
  }
  const roof = DOJO_MAP.colliders.find(box => box.id === 'dojo-hall-roof');
  const jumpApex = WORLD.jumpSpeed ** 2 / (2 * WORLD.gravity);
  assert.ok(roof.overhead && roof.y > WORLD.standHeight + jumpApex);
  assert.ok(roof.z >= 10 && roof.z + roof.d <= DOJO_MAP.bounds.maxZ);
  assert.ok(navigationCanOccupy(DOJO_MAP, { ...DOJO_PLAYER_SPAWN, y: jumpApex }));
});

test('The authored practice lanes are measured and have clear body and head sightlines', () => {
  for (const lane of DOJO_RANGE_LANES) {
    assert.ok(Math.abs(Math.hypot(lane.target.x - lane.origin.x, lane.target.z - lane.origin.z) - lane.distance) < EPS);
    assert.equal(lane.target, DOJO_TARGET_SPAWNS[lane.targetIndex]);
    assert.ok(navigationVisible(DOJO_MAP, eye(lane.origin), eye(lane.target)), `${lane.id}/head`);
    assert.ok(navigationVisible(DOJO_MAP, { ...lane.origin, y: 1 }, { ...lane.target, y: 1 }), `${lane.id}/body`);
    // The native hitscan engine must also contact the actor before any wall.
    const shooter = Object.assign(createCombatPlayer(0), lane.origin);
    const target = Object.assign(createCombatPlayer(1), lane.target);
    const state = { players: [shooter, target], map: DOJO_MAP };
    const head = traceShot(state, 0, eye(shooter), forward, lane.distance + 1, DOJO_MAP);
    assert.equal(head.playerId, 1, lane.id);
    assert.ok(head.distance < lane.distance);
  }
});

test('The equipment hall and every target share the ordinary navigation mesh', () => {
  for (const target of [...DOJO_STATIONS, ...DOJO_TARGET_SPAWNS]) {
    const path = navigationPath(DOJO_MAP, DOJO_PLAYER_SPAWN, target);
    assert.ok(path.length, `${target.x}/${target.z} reachable`);
    const end = path.at(-1);
    assert.ok(Math.hypot(end.x - target.x, end.z - target.z) < .05, 'path reaches authored point');
    assert.ok(path.every(point => navigationCanOccupy(DOJO_MAP, point)), 'every path node is physically free');
  }
});

test('Station display items rest above real benches and are visible to normal E pickup', () => {
  assert.deepEqual(DOJO_STATIONS.map(station => station.id), ['gun', 'blade', 'supplies', 'recovery']);
  for (const station of DOJO_STATIONS) {
    const bench = DOJO_MAP.colliders.find(box => box.id === station.colliderId);
    assert.ok(bench && Object.isFrozen(station.display));
    assert.ok(station.display.y >= bench.y + bench.h);
    assert.ok(station.display.x >= bench.x && station.display.x <= bench.x + bench.w);
    assert.ok(station.display.z >= bench.z && station.display.z <= bench.z + bench.d);
    assert.ok(station.radius > 0 && station.interactionRadius === station.radius);
    for (const offset of station.id === 'supplies' ? [-.32, .32] : [0]) {
      const player = Object.assign(createCombatPlayer(0), station);
      const loot = { id: 1, kind: 'weapon', weapon: 'carbine', ...station.display, x: station.display.x + offset };
      const state = { phase: 'fight', players: [player], loot: [loot], map: DOJO_MAP };
      assert.equal(findNearbyLoot(state, 0, DOJO_MAP), loot, `${station.id}/${offset} E pickup is in reach and not behind the bench`);
    }
  }
});

test('North backstop and side cover use the same real ray boxes as combat', () => {
  const north = DOJO_MAP.colliders.find(box => box.id === 'dojo-north-wall');
  const hit = traceShot({ players: [], map: DOJO_MAP }, 0, { x: 7, y: WORLD.eyeHeight, z: -20 }, forward, 100, DOJO_MAP);
  assert.equal(hit.kind, 'wall');
  assert.equal(hit.colliderId, north.id);
  assert.ok(north.h > WORLD.eyeHeight + 2);
  const cover = DOJO_MAP.colliders.find(box => box.id === 'dojo-cover-test-wall');
  assert.equal(rayBox({ x: 15, y: 1.2, z: 7 }, forward, cover, 10), 3.5);
  assert.equal(rayBox({ x: 15, y: WORLD.eyeHeight, z: 7 }, forward, cover, 10), null, 'standing head remains exposed above the low cover');
  assert.equal(navigationCanOccupy(DOJO_MAP, { x: 15, y: 0, z: 3.2 }), false);
});

test('Ordinary movement reaches a training lane and cannot walk through the equipment bench', () => {
  const player = Object.assign(createCombatPlayer(0), DOJO_PLAYER_SPAWN);
  for (let tick = 0; tick < 120; tick++) predictLocalMovement(player, { ...emptyInput(), up: true }, DOJO_MAP);
  assert.ok(player.z < 8 && player.z > 4, 'normal forward input enters the open courtyard');
  assert.ok(navigationCanOccupy(DOJO_MAP, player));
  Object.assign(player, DOJO_STATIONS[0], { vx: 0, vz: 0 });
  for (let tick = 0; tick < 180; tick++) predictLocalMovement(player, { ...emptyInput(), down: true }, DOJO_MAP);
  const bench = DOJO_MAP.colliders.find(box => box.id === DOJO_STATIONS[0].colliderId);
  assert.ok(player.z <= bench.z - WORLD.radius + EPS, 'real tabletop stops the standing body');
  assert.ok(navigationCanOccupy(DOJO_MAP, player));
});
