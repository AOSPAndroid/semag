import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS, MAP_IDS } from '../public/voxel-royale-maps.js';
import { WORLD, WEAPONS, createCombatPlayer, emptyInput, predictLocalMovement } from '../public/voxel-engine.js';

const EPS = 1e-6;
function overlaps(p, box, radius = WORLD.radius) {
  return (p.y || 0) < box.y + box.h - EPS && (p.y || 0) + WORLD.standHeight > box.y + EPS
    && Math.hypot(p.x - Math.max(box.x, Math.min(p.x, box.x + box.w)), p.z - Math.max(box.z, Math.min(p.z, box.z + box.d))) < radius - EPS;
}
const clear = (map, point, radius = WORLD.radius) => point.x >= map.bounds.minX + radius && point.x <= map.bounds.maxX - radius
  && point.z >= map.bounds.minZ + radius && point.z <= map.bounds.maxZ - radius && !map.colliders.some(box => overlaps(point, box, radius));
const supported = (map, p) => !p.y || map.colliders.some(box => Math.abs(box.y + box.h - p.y) < EPS
  && p.x >= box.x + WORLD.radius && p.x <= box.x + box.w - WORLD.radius && p.z >= box.z + WORLD.radius && p.z <= box.z + box.d - WORLD.radius);

// A conservative half-metre floor graph proves a standing player can reach
// every ground cache/door/climb from every random spawn without a jump or crouch.
function floorGraph(map) {
  const unit = .5, n = 129, allowed = new Uint8Array(n * n), parents = new Int32Array(n * n).fill(-2);
  const point = index => ({ x: -32 + index % n * unit, y: 0, z: -32 + Math.floor(index / n) * unit });
  for (let index = 0; index < allowed.length; index++) allowed[index] = Number(clear(map, point(index), WORLD.radius + .025));
  const nearest = p => {
    const ix = Math.round((p.x + 32) / unit), iz = Math.round((p.z + 32) / unit);
    let chosen = -1, distance = Infinity;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (ix + dx < 0 || ix + dx >= n || iz + dz < 0 || iz + dz >= n) continue;
      const index = ix + dx + (iz + dz) * n, next = point(index), gap = Math.hypot(next.x - p.x, next.z - p.z);
      if (allowed[index] && gap < distance && clear(map, { x: (next.x + p.x) / 2, z: (next.z + p.z) / 2, y: 0 }, WORLD.radius + .025)) { chosen = index; distance = gap; }
    }
    assert.ok(distance <= .55, `${map.id}: no conservative floor waypoint for ${JSON.stringify(p)}`);
    return chosen;
  };
  const origin = nearest(map.spawnPoints[0]), queue = [origin]; parents[origin] = -1;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head], ix = current % n, iz = Math.floor(current / n);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (ix + dx < 0 || ix + dx >= n || iz + dz < 0 || iz + dz >= n) continue;
      const next = current + dx + dz * n;
      if (!allowed[next] || parents[next] !== -2) continue;
      const a = point(current), b = point(next);
      if (!clear(map, { x: (a.x + b.x) / 2, y: 0, z: (a.z + b.z) / 2 }, WORLD.radius + .025)) continue;
      parents[next] = current; queue.push(next);
    }
  }
  return { connected: p => parents[nearest(p)] !== -2, reachableCount: queue.length };
}

const near = (a, b, message) => assert.ok(Math.abs(a - b) < EPS, `${message}: ${a} != ${b}`);
const move = (player, map, controls = {}) => predictLocalMovement(player, { ...emptyInput(player), ...controls }, map);
function walkTo(player, map, target, label) {
  for (let tick = 0; tick < 900; tick++) {
    const dx = target.x - player.x, dz = target.z - player.z, distance = Math.hypot(dx, dz);
    if (distance < .11 && Math.hypot(player.vx, player.vz) < .08) break;
    move(player, map, { up: distance > .1, walk: true, yaw: distance > .01 ? Math.atan2(dx, -dz) : player.yaw });
  }
  assert.ok(Math.hypot(player.x - target.x, player.z - target.z) < .16, `${label}: could not walk to ${target.x},${target.z}; stopped ${player.x},${player.y},${player.z}`);
}
function climb(player, map, route) {
  for (const step of route.steps) {
    const box = map.colliders.find(value => value.id === step.colliderId), top = box.y + box.h;
    const face = { x: Math.max(box.x, Math.min(player.x, box.x + box.w)), z: Math.max(box.z, Math.min(player.z, box.z + box.d)) };
    const dx = face.x - player.x, dz = face.z - player.z, distance = Math.hypot(dx, dz);
    assert.ok(distance > WORLD.radius, `${route.id}: a real raised face precedes ${box.id}`);
    walkTo(player, map, { x: face.x - dx / distance * .4, z: face.z - dz / distance * .4 }, route.id);
    assert.ok(top > player.y && top - player.y <= 1 + EPS, `${route.id}: legal jump rise`);
    const yaw = Math.atan2(step.x - player.x, -(step.z - player.z));
    move(player, map, { up: true, jump: true, yaw });
    for (let tick = 0; tick < 140 && !player.grounded; tick++) move(player, map, { up: true, yaw });
    assert.equal(player.grounded, true, `${route.id}: lands on ${box.id}`);
    near(player.y, top, `${route.id}/${box.id} landing`);
    walkTo(player, map, step, route.id);
    near(player.y, top, `${route.id}/${box.id} stable height`);
    assert.ok(supported(map, player) && clear(map, player), `${route.id}: complete unobstructed standing footprint`);
  }
}

test('Royale has four distinct immutable authored arenas with bounded geometry and spread spawn choices', () => {
  assert.deepEqual(MAP_IDS, ['forest', 'maze', 'desert', 'paris']);
  assert.ok(Object.isFrozen(MAPS) && Object.isFrozen(MAP_IDS));
  const skies = new Set(), floors = new Set(), shapes = new Set();
  for (const map of Object.values(MAPS)) {
    assert.ok(Object.isFrozen(map) && Object.isFrozen(map.bounds));
    assert.equal(map.theme, map.id);
    assert.deepEqual(map.sites, []);
    assert.ok(map.name && map.description);
    assert.deepEqual(map.bounds, { minX: -32, maxX: 32, minZ: -32, maxZ: 32 });
    assert.ok(map.colliders.length <= 160, `${map.id} collision budget`);
    assert.ok(Object.isFrozen(map.colliders) && Object.isFrozen(map.spawnPoints) && Object.isFrozen(map.lootPoints));
    assert.equal(new Set(map.colliders.map(box => box.id)).size, map.colliders.length);
    for (const box of map.colliders) {
      assert.ok(Object.isFrozen(box));
      for (const field of ['x', 'y', 'z', 'w', 'h', 'd']) assert.ok(Number.isFinite(box[field]));
      for (const field of ['w', 'h', 'd']) assert.ok(box[field] > 0);
      assert.match(box.color, /^#[0-9a-f]{6}$/i);
      if (!box.id.startsWith('boundary-')) assert.ok(box.x >= -32 && box.x + box.w <= 32 && box.z >= -32 && box.z + box.d <= 32, `${map.id}/${box.id} bounds`);
    }
    assert.ok(map.spawnPoints.length >= 16);
    for (const [index, p] of map.spawnPoints.entries()) {
      assert.ok(clear(map, p), `${map.id}/spawn-${index} is clear`);
      assert.ok(Object.isFrozen(p) && Number.isFinite(p.yaw));
      for (const other of map.spawnPoints.slice(index + 1)) assert.ok(Math.hypot(p.x - other.x, p.z - other.z) >= 8, `${map.id} spawn separation`);
    }
    assert.ok(clear(map, map.stormCenter), `${map.id} final circle has clear standing ground`);
    skies.add(map.skyColor); floors.add(map.floorColor); shapes.add(JSON.stringify(map.colliders));
  }
  assert.equal(skies.size, 4); assert.equal(floors.size, 4); assert.equal(shapes.size, 4);
});

for (const map of Object.values(MAPS)) {
  test(`${map.name}: every cache is unobstructed, supported and distributed across real structures`, () => {
    assert.ok(map.lootPoints.length >= 30);
    assert.equal(new Set(map.lootPoints.map(p => p.id)).size, map.lootPoints.length);
    assert.equal(new Set(map.lootPoints.map(p => `${p.x}:${p.y}:${p.z}`)).size, map.lootPoints.length);
    for (const p of map.lootPoints) {
      assert.ok(Object.isFrozen(p));
      assert.ok(['weapon', 'heal', 'ammo', 'grenade'].includes(p.kind));
      assert.ok(clear(map, p), `${map.id}/${p.id} clear player footprint`);
      assert.ok(supported(map, p), `${map.id}/${p.id} supported loot`);
      if (p.y) assert.ok(map.routes.some(route => {
        const top = map.colliders.find(box => box.id === route.steps.at(-1).colliderId);
        return Math.abs(top.y + top.h - p.y) < EPS && p.x >= top.x + WORLD.radius && p.x <= top.x + top.w - WORLD.radius && p.z >= top.z + WORLD.radius && p.z <= top.z + top.d - WORLD.radius;
      }), `${map.id}/${p.id} has an authored climb to its support`);
    }
    for (const building of map.buildings) assert.ok(map.lootPoints.filter(p => !p.y && p.x > building.interior.minX && p.x < building.interior.maxX && p.z > building.interior.minZ && p.z < building.interior.maxZ).length >= 3, `${building.id} has real interior supplies`);
    for (const [xSign, zSign] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) assert.ok(map.lootPoints.filter(p => p.x * xSign > 8 && p.z * zSign > 8).length >= 4, `${map.id} decentralized quadrant loot`);
  });

  test(`${map.name}: all random spawns, ground caches, doors and climb starts share connected standing floor`, () => {
    const graph = floorGraph(map);
    assert.ok(graph.reachableCount > 6500, `${map.id} broad playable floor`);
    const locations = [...map.spawnPoints, ...map.lootPoints.filter(p => !p.y), ...map.routes.map(route => route.start), map.stormCenter,
      ...map.buildings.flatMap(building => building.doorways.flatMap(door => [door.inside, door.outside]))];
    for (const p of locations) assert.ok(graph.connected(p), `${map.id}: disconnected ${p.id || JSON.stringify(p)}`);
  });

  test(`${map.name}: two-door interiors can be entered and escaped using real standing movement`, () => {
    for (const building of map.buildings) {
      const [north, south] = building.doorways;
      assert.ok(north.width >= 2 && south.width >= 2 && north.height > WORLD.standHeight && south.height > WORLD.standHeight);
      const player = Object.assign(createCombatPlayer(0), north.outside);
      walkTo(player, map, north.inside, building.id);
      walkTo(player, map, south.inside, building.id);
      walkTo(player, map, south.outside, building.id);
      near(player.y, 0, `${building.id} stays on the ground`);
      assert.equal(player.grounded, true); assert.equal(player.crouching, false);
    }
  });

  test(`${map.name}: every high route is reachable through successive jumps with the slowest weapon`, () => {
    const slowest = Object.values(WEAPONS).reduce((a, b) => a.speed < b.speed ? a : b);
    assert.ok(map.routes.length >= 5);
    for (const route of map.routes) {
      assert.ok(Object.isFrozen(route) && Object.isFrozen(route.start) && Object.isFrozen(route.steps));
      const player = Object.assign(createCombatPlayer(0, 1, slowest.id), route.start);
      assert.ok(clear(map, player), `${route.id} clear floor approach`);
      climb(player, map, route);
      assert.ok(player.y >= 3.36 - EPS, `${route.id} meaningful high ground`);
      assert.ok(route.steps.length >= 4);
    }
  });
}

test('the forest has safe overhead foliage and the Egyptian pyramid has genuine five-tier vertical routes', () => {
  const canopies = MAPS.forest.colliders.filter(box => box.material === 'foliage');
  assert.ok(canopies.length >= 30 && canopies.every(box => box.y >= WORLD.standHeight + 1.8));
  assert.ok(MAPS.forest.colliders.some(box => box.material === 'bark'));
  const pyramid = MAPS.desert.colliders.filter(box => box.id.startsWith('pyramid-tier-'));
  assert.equal(pyramid.length, 5);
  assert.equal(pyramid.at(-1).h, 4.2);
  for (let i = 1; i < pyramid.length; i++) {
    assert.ok(pyramid[i].w < pyramid[i - 1].w && pyramid[i].d < pyramid[i - 1].d);
    near(pyramid[i].h - pyramid[i - 1].h, .84, 'pyramid terrace rise');
  }
  assert.equal(MAPS.desert.routes.filter(route => route.id.startsWith('pyramid-')).length, 2);
});
