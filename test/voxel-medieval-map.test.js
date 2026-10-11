import assert from 'node:assert/strict';
import test from 'node:test';
import { createMedievalMap } from '../public/voxel-medieval-map.js';
import { addTacticalJumpCover } from '../public/voxel-tactical-cover.js';
import { MAPS as BREACH } from '../public/voxel-maps.js';
import { MAPS as ROYALE } from '../public/voxel-royale-maps.js';
import { WORLD, createState as createBreach, startMatch as startBreach } from '../public/voxel-engine.js';
import { navigationCanOccupy } from '../public/voxel-navigation.js';
import * as Horde from '../public/voxel-horde-engine.js';
import * as Royale from '../public/voxel-royale-engine.js';
import { createPractice, startPractice, stepPractice } from '../public/voxel-practice-engine.js';
import { selectedInventoryItem } from '../public/voxel-inventory.js';

// An independent conservative floor flood-fill checks the whole authored ground,
// rather than trusting the AI planner's answer about its own generated graph.
function floorGraph(map) {
  const unit = .5, nx = Math.round((map.bounds.maxX - map.bounds.minX) / unit) + 1;
  const nz = Math.round((map.bounds.maxZ - map.bounds.minZ) / unit) + 1;
  const allowed = new Uint8Array(nx * nz), seen = new Uint8Array(nx * nz);
  const point = index => ({ x: map.bounds.minX + index % nx * unit, y: 0, z: map.bounds.minZ + Math.floor(index / nx) * unit });
  const clear = p => {
    const radius = WORLD.radius + .025;
    if (p.x < map.bounds.minX + radius || p.x > map.bounds.maxX - radius || p.z < map.bounds.minZ + radius || p.z > map.bounds.maxZ - radius) return false;
    return !map.colliders.some(b => b.y < WORLD.standHeight && b.y + b.h > 0
      && Math.hypot(p.x - Math.max(b.x, Math.min(p.x, b.x + b.w)), p.z - Math.max(b.z, Math.min(p.z, b.z + b.d))) < radius - 1e-7);
  };
  for (let index = 0; index < allowed.length; index++) allowed[index] = Number(clear(point(index)));
  const nearest = p => {
    const ix = Math.round((p.x - map.bounds.minX) / unit), iz = Math.round((p.z - map.bounds.minZ) / unit);
    let best = -1, gap = Infinity;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (ix + dx < 0 || ix + dx >= nx || iz + dz < 0 || iz + dz >= nz) continue;
      const index = ix + dx + (iz + dz) * nx, p2 = point(index), distance = Math.hypot(p2.x - p.x, p2.z - p.z);
      if (allowed[index] && distance < gap && clear({ x: (p.x + p2.x) / 2, z: (p.z + p2.z) / 2 })) { best = index; gap = distance; }
    }
    assert.ok(gap <= .55, `${map.mode}: no standing floor waypoint for ${JSON.stringify(p)}`);
    return best;
  };
  const start = (map.spawns?.flat() || map.spawnPoints)[0], queue = [nearest(start)]; seen[queue[0]] = 1;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head], ix = current % nx, iz = Math.floor(current / nx);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (ix + dx < 0 || ix + dx >= nx || iz + dz < 0 || iz + dz >= nz) continue;
      const next = current + dx + dz * nx;
      if (!allowed[next] || seen[next]) continue;
      const a = point(current), b = point(next);
      if (!clear({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 })) continue;
      seen[next] = 1; queue.push(next);
    }
  }
  return { count: queue.length, connected: p => Boolean(seen[nearest(p)]) };
}

test('Crownfall factory validates mode and deterministically shares honest immutable solids with both catalogs', () => {
  assert.throws(() => createMedievalMap('invalid'), TypeError);
  assert.deepEqual(addTacticalJumpCover(createMedievalMap()), BREACH.medieval);
  assert.deepEqual(createMedievalMap('royale'), ROYALE.medieval);
  for (const map of [BREACH.medieval, ROYALE.medieval]) {
    assert.equal(map.id, 'medieval'); assert.equal(map.theme, 'medieval'); assert.equal(map.name, 'Crownfall Keep');
    assert.equal(map.combatStyle, 'close'); assert.match(map.description, /swords.*shotguns/);
    assert.ok(Object.isFrozen(map) && Object.isFrozen(map.bounds));
    for (const field of ['colliders', 'buildings', 'routes', 'upperFloors', 'landmarks', 'decorations', 'jumpCover', 'hopRoutes']) assert.ok(Object.isFrozen(map[field]));
    assert.ok(map.colliders.length <= (map.mode === 'royale' ? 160 : 100), 'bounded authored physics geometry');
    assert.equal(new Set(map.colliders.map(b => b.id)).size, map.colliders.length);
    for (const b of map.colliders) {
      assert.ok(Object.isFrozen(b) && [b.x, b.y, b.z, b.w, b.h, b.d].every(Number.isFinite));
      assert.ok(Math.min(b.w, b.h, b.d) > 0);
      if (!/^(wall|boundary)-/.test(b.id)) assert.ok(b.x >= map.bounds.minX && b.x + b.w <= map.bounds.maxX
        && b.z >= map.bounds.minZ && b.z + b.d <= map.bounds.maxZ, `${b.id}: real bounds`);
    }
    for (const landmark of map.landmarks) assert.ok(Object.isFrozen(landmark) && Object.isFrozen(landmark.collisionIds)
      && landmark.collisionIds.length && landmark.collisionIds.every(id => map.colliders.some(b => b.id === id)));
    assert.ok(map.landmarks.some(value => value.kind === 'gatehouse'));
    assert.ok(map.landmarks.filter(value => value.kind === 'keep-tower').length >= 2);
    assert.ok(map.decorations.filter(value => value.kind === 'castle-banner').length >= 6);
    assert.ok(map.colliders.some(value => value.material === 'castle-stone') && map.colliders.some(value => value.material === 'castle-timber'));
  }
  assert.equal(BREACH.medieval.bounds.maxX - BREACH.medieval.bounds.minX, 56);
  assert.equal(ROYALE.medieval.bounds.maxX - ROYALE.medieval.bounds.minX, 96);
});

for (const map of [BREACH.medieval, ROYALE.medieval]) test(`${map.mode}/Crownfall: ground loops connect every doorway, approach, cache and gameplay start`, () => {
  const graph = floorGraph(map);
  assert.ok(graph.count > (map.mode === 'royale' ? 24000 : 7500), 'substantial connected standing ground');
  const positions = [...(map.spawns?.flat() || map.spawnPoints), ...map.sites, ...map.routes.map(route => route.start),
    ...map.buildings.flatMap(room => room.doorways.flatMap(door => [door.inside, door.outside])),
    ...(map.lootPoints || []).filter(point => !point.y), ...(map.stormCenter ? [map.stormCenter] : [])];
  for (const position of positions) assert.ok(graph.connected(position), `unreachable ${position.id || JSON.stringify(position)}`);
  for (const building of map.buildings) {
    assert.equal(building.doorways.length, 2, 'opposed exits prevent trapped interiors');
    assert.ok(building.doorways.every(door => door.width >= 2.8 && door.height > WORLD.standHeight));
  }
});

test('Crownfall initializes every Breach team size, Last Stand team and solo drill on shared clear geometry', () => {
  for (const teamSize of [1, 2, 3]) {
    const state = createBreach({ mapId: 'medieval', teamSize }); startBreach(state);
    assert.equal(state.mapId, 'medieval'); assert.equal(state.mapName, 'Crownfall Keep');
    assert.equal(state.players.length, teamSize * 2);
    assert.ok(state.players.every(p => navigationCanOccupy(BREACH.medieval, p)));
  }
  for (const capacity of [1, 2, 3]) {
    const state = Horde.createState({ mapId: 'medieval', capacity, seed: 19 });
    Horde.startMatch(state, Array.from({ length: capacity }, (_, id) => id));
    assert.equal(state.horde.participantIds.length, capacity);
    assert.ok(state.players.filter(p => p.human).every(p => navigationCanOccupy(BREACH.medieval, p)));
  }
  for (const mode of ['targets', 'combat', 'blades']) {
    const state = createPractice({ game: 'voxel', mapId: 'medieval', mode, bots: 5, seed: 19 });
    assert.equal(state.phase, 'ready'); assert.equal(state.map, BREACH.medieval);
    startPractice(state);
    assert.equal(state.players.length, 6); assert.ok(state.players.every(p => navigationCanOccupy(state.map, p)));
  }
});

test('Crownfall Royale gives eleven knife-only starts, finite rich loot and real travel to every gun', () => {
  const map = ROYALE.medieval;
  assert.equal(map.spawnPoints.length, 16); assert.equal(map.buildings.length, 5); assert.equal(map.lootPoints.length, 56);
  assert.equal(new Set(map.lootPoints.map(p => `${p.x}/${p.y}/${p.z}`)).size, map.lootPoints.length);
  assert.ok(map.lootPoints.filter(p => p.kind === 'weapon').length >= 11);
  for (const seed of [1, 7, 151, 7143]) {
    const state = createPractice({ game: 'voxel-royale', mapId: 'medieval', bots: 10, seed }); startPractice(state);
    assert.equal(state.players.length, 11); assert.equal(state.aliveCount, 11); assert.equal(state.loot.filter(loot => loot.weapon !== 'grapple').length, map.lootPoints.length);
    for (const player of state.players) {
      assert.ok(navigationCanOccupy(map, player)); assert.equal(player.hasGun, false);
      assert.equal(selectedInventoryItem(player).weapon, 'knife'); assert.equal(player.inventory.filter(Boolean).length, 1);
      assert.equal(player.ammo + player.reserve + player.potions + player.grenades, 0);
    }
    const guns = state.loot.filter(loot => loot.kind === 'weapon'); assert.ok(guns.length >= 11);
    for (const gun of guns) for (const player of state.players) assert.ok(Math.hypot(gun.x - player.x, gun.z - player.z) >= Royale.ROYALE.gunSpawnClearance);
    for (const kind of ['heal', 'ammo', 'grenade', 'melee']) assert.ok(state.loot.some(loot => loot.kind === kind));
    for (const x of [map.bounds.minX, map.bounds.maxX]) for (const z of [map.bounds.minZ, map.bounds.maxZ])
      assert.ok(state.storm.initialRadius >= Math.hypot(x - state.storm.x, z - state.storm.z) + WORLD.radius);
  }
});

test('Crownfall ten bots leave their starts and collect finite physical caches before shooting', () => {
  const state = createPractice({ game: 'voxel-royale', mapId: 'medieval', bots: 10, seed: 713, difficulty: 'rookie' });
  startPractice(state); while (state.phase === 'countdown') stepPractice(state);
  const initial = state.players.map(p => ({ x: p.x, z: p.z })), owned = new Set(), seen = new Set();
  for (let tick = 0; tick < 900 && state.phase === 'fight'; tick++) {
    stepPractice(state);
    if (tick % 15 === 0) for (const bot of state.players.slice(1).filter(p => p.alive)) assert.ok(navigationCanOccupy(state.map, bot));
    for (const event of state.events) {
      if (seen.has(event.id)) continue; seen.add(event.id);
      if (event.type === 'lootPickup' && event.kind === 'weapon' && event.playerId > 0) {
        assert.ok(!state.loot.some(loot => loot.id === event.lootId), 'picked-up guns disappear from the finite world');
        assert.ok(Math.hypot(state.players[event.playerId].x - initial[event.playerId].x, state.players[event.playerId].z - initial[event.playerId].z) >= 4);
        owned.add(event.playerId);
      }
      if (event.type === 'shot' && event.playerId > 0) assert.ok(owned.has(event.playerId), 'gun fire follows a real cache pickup');
    }
  }
  assert.ok(state.players.slice(1).every((bot, index) => Math.hypot(bot.x - initial[index + 1].x, bot.z - initial[index + 1].z) > .5));
  assert.ok(owned.size >= 3, 'several actual bots acquire guns through authored village/castle paths');
});
