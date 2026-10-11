import assert from 'node:assert/strict';
import test from 'node:test';
import { DOJO_MAP } from '../public/voxel-dojo-map.js';
import { DOJO_MAPS, DOJO_MAP_IDS, getDojoMap } from '../public/voxel-dojo-maps.js';
import { MAPS, MAP_IDS } from '../public/voxel-maps.js';
import { createCombatPlayer, emptyInput, findNearbyLoot, predictLocalMovement, traceShot, WORLD } from '../public/voxel-engine.js';
import { navigationCanOccupy, navigationPath, navigationVisible } from '../public/voxel-navigation.js';
import { createPractice, startPractice, stepPractice } from '../public/voxel-practice-engine.js';
import { findDojoStation } from '../public/voxel-dojo-engine.js';

const EPS = 1e-6;
const newMaps = DOJO_MAP_IDS.filter(id => id !== 'dojo').map(getDojoMap);
const pointAt = (point, height) => ({ x: point.x, y: (point.y || 0) + height, z: point.z });
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function direction(from, to) {
  const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length, z: (to.z - from.z) / length };
}

/** Only ordinary movement inputs change the actor after its initial spawn. */
function travel(player, target, map, { jump = false, advance } = {}) {
  let highest = player.y;
  for (let tick = 0; tick < 1000; tick++) {
    const dx = target.x - player.x, dz = target.z - player.z, remaining = Math.hypot(dx, dz);
    const input = { ...emptyInput(player), yaw: remaining > .01 ? Math.atan2(dx, -dz) : player.yaw,
      up: remaining > .035, walk: true, jump: jump && tick === 0 };
    if (advance) advance(input);
    else predictLocalMovement(player, input, map);
    highest = Math.max(highest, player.y);
    assert.ok(navigationCanOccupy(map, player), `${map.id}: the moving body enters solid geometry`);
    if (distance(player, target) < .09 && Math.abs(player.y - (target.y || 0)) < .01
        && player.grounded && Math.hypot(player.vx, player.vz) < .4) return { ticks: tick + 1, highest };
  }
  assert.fail(`${map.id}: ordinary inputs cannot reach ${JSON.stringify(target)} from ${player.x}/${player.y}/${player.z}`);
}

function begin(map) {
  const state = createPractice({ mode: 'dojo', mapId: map.id, bots: 5, seed: 1187 });
  startPractice(state);
  for (let tick = 0; tick < 120 && state.phase === 'countdown'; tick++) stepPractice(state);
  assert.equal(state.phase, 'fight');
  return state;
}

test('expanded training maps preserve Cedar and stay outside the competitive map catalog', () => {
  assert.deepEqual(DOJO_MAP_IDS, ['dojo', 'dojo-lantern', 'dojo-iron']);
  assert.equal(DOJO_MAPS.dojo, DOJO_MAP);
  assert.equal(getDojoMap(), DOJO_MAP);
  assert.ok(Object.isFrozen(DOJO_MAPS) && Object.isFrozen(DOJO_MAP_IDS));
  for (const id of DOJO_MAP_IDS) {
    assert.equal(MAPS[id], undefined);
    assert.ok(!MAP_IDS.includes(id));
  }
  for (const id of ['courtyard', '__proto__', 'constructor', '', null, 2]) assert.throws(() => getDojoMap(id), RangeError);
});

for (const map of newMaps) {
  test(`${map.name}: immutable geometry has positive dimensions, unique IDs and a bounded mesh budget`, () => {
    assert.equal(map.mode, 'dojo');
    assert.ok(Object.isFrozen(map));
    for (const key of ['bounds', 'colliders', 'decorations', 'stations', 'targetSpawns', 'targetMotionBounds', 'rangeLanes', 'routes', 'spawns', 'ceilings'])
      assert.ok(Object.isFrozen(map[key]), key);
    assert.ok(map.colliders.length <= 100, 'static training art remains bounded');
    assert.equal(new Set(map.colliders.map(box => box.id)).size, map.colliders.length);
    for (const box of map.colliders) {
      assert.ok(Object.isFrozen(box) && box.color && box.material, box.id);
      for (const key of ['x', 'y', 'z', 'w', 'h', 'd']) assert.ok(Number.isFinite(box[key]), `${box.id}/${key}`);
      for (const key of ['w', 'h', 'd']) assert.ok(box[key] > 0, `${box.id}/${key}`);
      assert.ok(box.y >= 0, box.id);
      const perimeter = /-(west|east|north|south)-wall$/.test(box.id);
      const margin = perimeter ? 1 : 0;
      assert.ok(box.x >= map.bounds.minX - margin - EPS && box.x + box.w <= map.bounds.maxX + margin + EPS, `${box.id}/x`);
      assert.ok(box.z >= map.bounds.minZ - margin - EPS && box.z + box.d <= map.bounds.maxZ + margin + EPS, `${box.id}/z`);
    }
    for (const value of map.decorations) {
      assert.ok(Object.isFrozen(value));
      for (const key of ['x', 'y', 'z', 'w', 'd']) assert.ok(Number.isFinite(value[key]), `${value.kind}/${key}`);
      assert.ok(value.w > 0 && value.d > 0);
    }
    for (const route of map.routes) {
      assert.ok(Object.isFrozen(route) && Object.isFrozen(route.steps) && Object.isFrozen(route.approach));
      assert.ok(route.steps.every(Object.isFrozen));
    }
  });

  test(`${map.name}: every spawn, target motion extent and firing mark has real ground support and body clearance`, () => {
    const poses = [...map.spawns.flat(), ...map.stations, ...map.rangeLanes.map(lane => lane.origin)];
    for (const [index, bounds] of map.targetMotionBounds.entries()) {
      assert.ok(Object.isFrozen(bounds));
      assert.equal(bounds.y, map.targetSpawns[index].y);
      for (const x of [bounds.minX, bounds.maxX]) for (const z of [bounds.minZ, bounds.maxZ]) poses.push({ x, y: bounds.y, z });
    }
    for (const pose of poses) {
      assert.ok(navigationCanOccupy(map, pose), `${pose.x}/${pose.y}/${pose.z} clear standing body`);
      const actor = Object.assign(createCombatPlayer(0), pose);
      for (let tick = 0; tick < 30; tick++) predictLocalMovement(actor, emptyInput(actor), map);
      assert.ok(actor.grounded && Math.abs(actor.y - pose.y) < EPS, 'elevated poses stand on actual solids instead of floating');
    }
    const apex = WORLD.jumpSpeed ** 2 / (2 * WORLD.gravity);
    assert.ok(navigationCanOccupy(map, { ...map.playerSpawn, y: map.playerSpawn.y + apex }), 'spawn roof leaves space for a normal jump');
    for (const id of map.ceilings) {
      const roof = map.colliders.find(box => box.id === id);
      assert.ok(roof?.overhead && roof.y > WORLD.standHeight + apex);
    }
  });

  test(`${map.name}: measured lanes contact the correct body and head with all five targets present, including moving endpoints`, () => {
    for (const lane of map.rangeLanes) {
      assert.equal(lane.target, map.targetSpawns[lane.targetIndex]);
      assert.ok(Math.abs(distance(lane.origin, lane.target) - lane.distance) < EPS);
      for (const offsetX of [-1.4, 0, 1.4]) for (const offsetZ of [-.18, 0, .18]) {
        const targets = map.targetSpawns.map((pose, index) => Object.assign(createCombatPlayer(index + 1), pose));
        const target = targets[lane.targetIndex]; target.x += offsetX; target.z += offsetZ;
        for (const [height, kind] of [[1, 'body'], [WORLD.eyeHeight, 'head']]) {
          const origin = pointAt(lane.origin, height), contact = pointAt(target, height);
          assert.ok(navigationVisible(map, origin, contact), `${lane.id}/${kind} world visibility`);
          const hit = traceShot({ map, players: targets }, 0, origin, direction(origin, contact), lane.distance + 3, map);
          assert.equal(hit.playerId, target.id, `${lane.id}/${kind}: another actor or wall blocks the intended target`);
          assert.equal(hit.kind, kind, `${lane.id}: real ${kind} hit volume`);
        }
      }
    }
  });

  test(`${map.name}: normal movement reaches every station and real E input picks up the displayed equipment`, () => {
    for (const station of map.stations) {
      const state = begin(map), player = state.players[0];
      const path = navigationPath(map, player, station);
      assert.ok(path.length, `${station.id}: no navigation path`);
      for (const point of path) travel(player, point, map, { jump: point.jump, advance: input => stepPractice(state, input) });
      assert.ok(distance(player, station) < .09);
      assert.equal(findDojoStation(state)?.id, station.id);
      const bench = map.colliders.find(box => box.id === station.colliderId);
      assert.ok(bench && station.display.y >= bench.y + bench.h && Object.isFrozen(station.display));
      assert.ok(station.display.x >= bench.x && station.display.x <= bench.x + bench.w);
      assert.ok(station.display.z >= bench.z && station.display.z <= bench.z + bench.d);
      const items = state.loot.filter(item => item.dojoStation === station.id);
      for (const item of items) assert.equal(findNearbyLoot({ ...state, loot: [item] }, 0, map), item, `${station.id}: displayed gear is obstructed or outside normal E reach`);
      if (station.id === 'recovery') continue;
      assert.ok(items.length);
      stepPractice(state, { interact: true });
      const pickup = state.events.findLast(event => event.type === 'lootPickup' && event.playerId === 0);
      assert.ok(pickup && items.some(item => item.id === pickup.lootId), `${station.id}: E never collected the real bench item`);
      assert.ok(player.inventory.some(item => item?.kind === pickup.kind && (pickup.weapon ? item.weapon === pickup.weapon : item.amount > 0)), `${station.id}: pickup did not enter inventory`);
    }
  });

  test(`${map.name}: four ordinary jumps climb the raised route and walk onto the actual firing gallery`, () => {
    for (const route of map.routes) {
      const player = Object.assign(createCombatPlayer(0), map.playerSpawn);
      const approach = navigationPath(map, player, route.start);
      assert.ok(approach.length);
      for (const point of approach) travel(player, point, map, { jump: point.jump });
      assert.equal(player.y, 0);
      // Walking into the first riser cannot silently step up or pass through it.
      const blocked = { ...player, previousInput: emptyInput(player) };
      const first = route.steps[0], firstBox = map.colliders.find(box => box.id === first.colliderId);
      for (let tick = 0; tick < 120; tick++) predictLocalMovement(blocked, { ...emptyInput(blocked), yaw: 0, up: true }, map);
      assert.equal(blocked.y, 0);
      assert.ok(blocked.z >= firstBox.z + firstBox.d + WORLD.radius - EPS);
      assert.equal(route.steps.length, 4);
      let previousHeight = 0;
      for (const point of route.steps) {
        const support = map.colliders.find(box => box.id === point.colliderId);
        assert.ok(support);
        assert.ok(Math.abs(point.y - previousHeight - .6) < EPS, 'each riser uses the advertised 0.6 m step');
        assert.ok(Math.abs(point.y - support.y - support.h) < EPS);
        const result = travel(player, point, map, { jump: true });
        assert.ok(result.highest > point.y + .2, 'the jump genuinely rises above the step');
        assert.ok(player.grounded && Math.abs(player.y - point.y) < EPS);
        previousHeight = point.y;
      }
      travel(player, route.destination, map);
      assert.ok(distance(player, route.destination) < .09 && player.grounded);
      assert.ok(Math.abs(player.y - 2.4) < EPS);
      const support = map.colliders.find(box => box.id.endsWith('-deck'));
      assert.ok(player.x > support.x && player.x < support.x + support.w && player.z > support.z && player.z < support.z + support.d,
        'the full route reaches the deck, rather than only the last stair');
      // A released input keeps the firing destination supported as physics advances.
      for (let tick = 0; tick < 60; tick++) predictLocalMovement(player, emptyInput(player), map);
      assert.ok(player.grounded && Math.abs(player.y - 2.4) < EPS);
    }
  });

  test(`${map.name}: tall cover blocks normal walking, body shots and head shots with the same authored solid`, () => {
    const cover = map.colliders.find(box => box.id.endsWith(map.id === 'dojo-lantern' ? '-cover-west' : '-baffle-center'));
    assert.ok(cover && cover.h > WORLD.eyeHeight);
    const x = cover.x + cover.w / 2, from = { x, y: 0, z: cover.z + cover.d + 2 }, to = { x, y: 0, z: cover.z - 2 };
    const target = Object.assign(createCombatPlayer(1), to);
    for (const height of [1, WORLD.eyeHeight]) {
      const origin = pointAt(from, height), contact = pointAt(target, height);
      assert.equal(navigationVisible(map, origin, contact), false);
      const hit = traceShot({ map, players: [target] }, 0, origin, direction(origin, contact), 10, map);
      assert.equal(hit.kind, 'wall'); assert.equal(hit.colliderId, cover.id);
    }
    const player = Object.assign(createCombatPlayer(0), from);
    for (let tick = 0; tick < 180; tick++) predictLocalMovement(player, { ...emptyInput(player), yaw: 0, up: true }, map);
    assert.ok(player.z >= cover.z + cover.d + WORLD.radius - EPS);
    assert.ok(navigationCanOccupy(map, player));
    assert.equal(navigationCanOccupy(map, { x, y: 0, z: cover.z + cover.d / 2 }), false);
  });
}
