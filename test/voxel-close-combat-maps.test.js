import assert from 'node:assert/strict';
import test from 'node:test';
import { createCloseCombatMap, CLOSE_COMBAT_MAP_IDS } from '../public/voxel-close-combat-maps.js';
import { MAPS as BREACH } from '../public/voxel-maps.js';
import { MAPS as ROYALE } from '../public/voxel-royale-maps.js';
import { WORLD, WEAPONS, createCombatPlayer, combatStep, emptyInput, predictLocalMovement, traceShot } from '../public/voxel-engine.js';
import { navigationCanOccupy, navigationPath, navigationVisible } from '../public/voxel-navigation.js';
import { setInventoryMeleeLoadout } from '../public/voxel-inventory.js';
import * as Royale from '../public/voxel-royale-engine.js';
import * as Horde from '../public/voxel-horde-engine.js';

const EPS = 1e-6;
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < EPS, `${label}: ${actual} != ${expected}`);
const supported = (map, p) => !p.y || map.colliders.some(b => Math.abs(b.y + b.h - p.y) < EPS
  && p.x >= b.x + WORLD.radius && p.x <= b.x + b.w - WORLD.radius && p.z >= b.z + WORLD.radius && p.z <= b.z + b.d - WORLD.radius);

// Independent conservative floor flood: standable points and midpoint edges
// prove escape routes without trusting the bot graph's own connectivity result.
function floorGraph(map) {
  const unit = .5, nx = Math.round((map.bounds.maxX - map.bounds.minX) / unit) + 1, nz = Math.round((map.bounds.maxZ - map.bounds.minZ) / unit) + 1;
  const positions = new Uint8Array(nx * nz), seen = new Uint8Array(nx * nz);
  const point = index => ({ x: map.bounds.minX + index % nx * unit, y: 0, z: map.bounds.minZ + Math.floor(index / nx) * unit });
  const clear = p => navigationCanOccupy(map, p, { radius: WORLD.radius + .025, height: WORLD.standHeight });
  for (let index = 0; index < positions.length; index++) positions[index] = Number(clear(point(index)));
  function nearest(p) {
    const ix = Math.round((p.x - map.bounds.minX) / unit), iz = Math.round((p.z - map.bounds.minZ) / unit);
    let result = -1, gap = Infinity;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (ix + dx < 0 || ix + dx >= nx || iz + dz < 0 || iz + dz >= nz) continue;
      const index = ix + dx + (iz + dz) * nx, next = point(index), distance = Math.hypot(p.x - next.x, p.z - next.z);
      if (positions[index] && distance < gap && clear({ x: (p.x + next.x) / 2, z: (p.z + next.z) / 2, y: 0 })) { result = index; gap = distance; }
    }
    assert.ok(gap < .55, `${map.id}: no clear standing floor near ${JSON.stringify(p)}`);
    return result;
  }
  const starts = map.spawns?.flat() || map.spawnPoints, queue = [nearest(starts[0])]; seen[queue[0]] = 1;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head], ix = current % nx, iz = Math.floor(current / nx);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (ix + dx < 0 || ix + dx >= nx || iz + dz < 0 || iz + dz >= nz) continue;
      const next = current + dx + dz * nx;
      if (!positions[next] || seen[next]) continue;
      const a = point(current), b = point(next);
      if (!clear({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, y: 0 })) continue;
      seen[next] = 1; queue.push(next);
    }
  }
  return { count: queue.length, reachable: p => Boolean(seen[nearest(p)]) };
}

function walkTo(body, map, target, label) {
  for (let tick = 0; tick < 1000; tick++) {
    const dx = target.x - body.x, dz = target.z - body.z, distance = Math.hypot(dx, dz);
    if (distance < .11 && Math.hypot(body.vx, body.vz) < .08) break;
    predictLocalMovement(body, { ...emptyInput(body), up: distance > .1, walk: true, yaw: distance > .01 ? Math.atan2(dx, -dz) : body.yaw }, map);
    assert.ok(navigationCanOccupy(map, body), `${label}: a body crossed real cover`);
  }
  assert.ok(Math.hypot(target.x - body.x, target.z - body.z) < .16, `${label}: stalled at ${body.x},${body.y},${body.z}`);
}

function climb(map, route, weapon) {
  const body = Object.assign(createCombatPlayer(0, 1, weapon), route.start);
  for (const step of route.steps) {
    const support = map.colliders.find(value => value.id === step.colliderId), top = support.y + support.h;
    const face = { x: Math.max(support.x, Math.min(body.x, support.x + support.w)), z: Math.max(support.z, Math.min(body.z, support.z + support.d)) };
    const dx = face.x - body.x, dz = face.z - body.z, distance = Math.hypot(dx, dz);
    assert.ok(distance > WORLD.radius && top > body.y && top - body.y <= .8 + EPS, `${route.id}: a reachable raised face`);
    walkTo(body, map, { x: face.x - dx / distance * .4, z: face.z - dz / distance * .4 }, route.id);
    const yaw = Math.atan2(step.x - body.x, -(step.z - body.z));
    predictLocalMovement(body, { ...emptyInput(body), up: true, jump: true, yaw }, map);
    for (let tick = 0; tick < 150 && !body.grounded; tick++) predictLocalMovement(body, { ...emptyInput(body), up: true, yaw }, map);
    assert.equal(body.grounded, true, `${route.id}: lands after a real jump`); near(body.y, top, `${route.id} landing`);
    walkTo(body, map, step, route.id); near(body.y, top, `${route.id} stable support`);
    assert.ok(supported(map, body));
  }
  near(body.y, 3.2, route.id);
}

function encounter(map, weapon, from, target, blade = false) {
  const players = [Object.assign(createCombatPlayer(0, 1, weapon), { ...from, y: 0, team: 0, human: true, lifeId: 1 }),
    Object.assign(createCombatPlayer(1, 1, 'carbine'), { ...target, y: 0, team: 1, hp: 500, maxHp: 500, lifeId: 1 })];
  if (blade) setInventoryMeleeLoadout(players[0], 'sword', { equip: true });
  const state = { gameId: 'voxel-breach', phase: 'fight', tick: 0, eventId: 0, events: [], players, fighters: players, map, grenades: [], bolts: [], loot: [] };
  assert.ok(players.every(p => navigationCanOccupy(map, p)), `${map.id}: physical combat poses`);
  const dx = target.x - from.x, dz = target.z - from.z, yaw = Math.atan2(dx, -dz), pitch = blade ? 0 : Math.atan2(1.05 - WORLD.eyeHeight, Math.hypot(dx, dz));
  const ticks = blade ? 70 : 1;
  for (let tick = 0; tick < ticks; tick++) {
    state.tick++; combatStep(state, [{ ...emptyInput(players[0]), fire: tick === 0, yaw, pitch }, emptyInput(players[1])], map);
  }
  return { state, damage: 500 - players[1].hp };
}

test('both close-combat maps are deterministic, distinct and honestly share immutable engine/render geometry', () => {
  assert.deepEqual(CLOSE_COMBAT_MAP_IDS, ['market', 'lockdown']);
  assert.throws(() => createCloseCombatMap('missing'), TypeError); assert.throws(() => createCloseCombatMap('market', 'invalid'), TypeError);
  for (const [mode, catalog] of [['breach', BREACH], ['royale', ROYALE]]) for (const id of CLOSE_COMBAT_MAP_IDS) {
    const map = catalog[id]; assert.deepEqual(createCloseCombatMap(id, mode), map); assert.equal(map.combatStyle, 'close');
    assert.match(map.description, /swords?|shotgun/); assert.ok(Object.isFrozen(map) && Object.isFrozen(map.bounds));
    assert.ok(map.colliders.length <= 180); assert.equal(new Set(map.colliders.map(b => b.id)).size, map.colliders.length);
    for (const field of ['colliders', 'routes', 'buildings', 'ceilings', 'landmarks', 'decorations']) assert.ok(Object.isFrozen(map[field]));
    for (const b of map.colliders) {
      assert.ok(Object.isFrozen(b) && [b.x, b.y, b.z, b.w, b.h, b.d].every(Number.isFinite));
      assert.ok(Math.min(b.w, b.h, b.d) > 0);
      if (!/^(boundary|wall)-/.test(b.id)) assert.ok(b.x >= map.bounds.minX && b.x + b.w <= map.bounds.maxX && b.z >= map.bounds.minZ && b.z + b.d <= map.bounds.maxZ, `${b.id}: authored bounds`);
    }
    for (const landmark of map.landmarks) assert.ok(Object.isFrozen(landmark) && Object.isFrozen(landmark.collisionIds)
      && landmark.collisionIds.every(id => map.colliders.some(b => b.id === id)), 'all displayed cover has real collision');
  }
  assert.notDeepEqual(BREACH.market.colliders, BREACH.lockdown.colliders);
  assert.notEqual(BREACH.market.floorColor, BREACH.lockdown.floorColor); assert.notEqual(BREACH.market.skyColor, BREACH.lockdown.skyColor);
  assert.equal(BREACH.market.buildings.length, 2); assert.equal(BREACH.lockdown.buildings.length, 0);
});

for (const [mode, catalog] of [['breach', BREACH], ['royale', ROYALE]]) for (const id of CLOSE_COMBAT_MAP_IDS) {
  test(`${mode}/${id}: every spawn, objective, ground cache, doorway and ascent belongs to one connected standing floor`, () => {
    const map = catalog[id], graph = floorGraph(map), starts = map.spawns?.flat() || map.spawnPoints;
    assert.ok(graph.count > (mode === 'royale' ? 6500 : 1500));
    const targets = [...starts, ...map.sites, ...(map.lootPoints || []).filter(p => !p.y), ...map.routes.map(r => r.start),
      ...map.buildings.flatMap(b => b.doorways.flatMap(d => [d.inside, d.outside])), ...(map.stormCenter ? [map.stormCenter] : [])];
    for (const p of targets) assert.ok(navigationCanOccupy(map, p) && graph.reachable(p), `${map.id}/${p.id || JSON.stringify(p)}: reachable escape floor`);
    for (const p of map.lootPoints || []) assert.ok(navigationCanOccupy(map, p) && supported(map, p), `${p.id}: unobstructed supported supplies`);
    if (mode === 'royale') {
      assert.equal(starts.length, 16); assert.ok(map.lootPoints.length >= 30);
      for (const [i, p] of starts.entries()) for (const other of starts.slice(i + 1)) assert.ok(Math.hypot(p.x - other.x, p.z - other.z) >= 8);
    }
  });

  test(`${mode}/${id}: slow guns and full standing bodies make every four-stage jump without clipping ceiling, rails or supports`, () => {
    const map = catalog[id], slowest = Object.values(WEAPONS).reduce((a, b) => a.speed < b.speed ? a : b);
    for (const route of map.routes) {
      const landing = route.steps.at(-1), support = map.colliders.find(b => b.id === landing.colliderId);
      assert.ok(navigationPath(map, route.start, { ...landing, y: support.y + support.h }).filter(p => p.jump).length >= 4);
      climb(map, route, slowest.id);
    }
    for (const room of map.buildings) {
      const [north, south] = room.doorways, body = Object.assign(createCombatPlayer(0), north.outside);
      assert.ok(north.width >= 2.6 && south.width >= 2.6);
      walkTo(body, map, north.inside, room.id); walkTo(body, map, south.inside, room.id); walkTo(body, map, south.outside, room.id);
      near(body.y, 0, room.id); assert.equal(body.crouching, false);
    }
  });
}

test('short open peeks reward actual shotgun pellets and sword contact, while authored turns stop distant rifle and shotgun damage', () => {
  for (const [id, x, nearZ, targetZ, farZ] of [['market', 0, 5, 3.6, -9.5], ['lockdown', -5.2, 4, 2.6, -10]]) {
    const map = BREACH[id], from = { x, z: nearZ }, close = { x, z: targetZ }, far = { x, z: farZ };
    const shotgun = encounter(map, 'shotgun', from, close), rifle = encounter(map, 'carbine', from, close), sword = encounter(map, 'carbine', from, close, true);
    assert.ok(shotgun.damage > rifle.damage && rifle.damage > 0, `${id}: a genuine close pellet advantage`);
    assert.ok(sword.damage > 0 && sword.state.events.some(e => e.type === 'meleeHit'), `${id}: real close blade contact`);
    for (const weapon of ['carbine', 'shotgun']) {
      const blocked = encounter(map, weapon, from, far); assert.equal(blocked.damage, 0, `${id}/${weapon}: real full-height angle interruption`);
      assert.ok(blocked.state.events.some(e => e.type === 'shot'), 'the obstructed shot was actually fired');
    }
    const origin = { ...from, y: WORLD.eyeHeight }, target = { ...far, y: WORLD.eyeHeight };
    assert.equal(navigationVisible(map, origin, target), false);
    const contact = traceShot({ map, players: [] }, 0, origin, { x: 0, y: 0, z: -1 });
    assert.equal(contact.kind, 'wall'); assert.ok(contact.distance < 12, `${id}: nearby solid cover breaks the long angle`);
  }
});

test('thin shop walls and blast screens block a sword within reach as well as bullets', () => {
  for (const [id, from, target] of [
    ['market', { x: -16.05, z: 2.5 }, { x: -14.55, z: 2.5 }],
    ['lockdown', { x: -4.4, z: 8.55 }, { x: -4.4, z: 6.75 }],
  ]) for (const blade of [false, true]) {
    const result = encounter(BREACH[id], 'shotgun', from, target, blade);
    assert.equal(result.damage, 0, `${id}: ${blade ? 'sword' : 'pellets'} cannot cut through honest protection`);
    assert.ok(result.state.events.some(e => e.type === (blade ? 'meleeStart' : 'shot')));
  }
});

test('Royale starts two or ten real knife-only players with legal separated spawns, supported loot and an inclusive storm', () => {
  for (const id of CLOSE_COMBAT_MAP_IDS) for (const capacity of [2, 10]) {
    const state = Royale.createState({ mapId: id, capacity, seed: 761 });
    Royale.startMatch(state, Array.from({ length: capacity }, (_, i) => i));
    assert.equal(state.participantIds.length, capacity); assert.equal(state.aliveCount, capacity);
    for (const p of state.players.filter(p => p.participating)) {
      assert.ok(navigationCanOccupy(state.map, p)); assert.equal(p.inventory[0].weapon, 'knife'); assert.equal(p.hasGun, false);
      assert.ok(Math.hypot(p.x - state.storm.x, p.z - state.storm.z) < state.storm.radius);
    }
    assert.ok(state.loot.length >= 30);
    for (const p of state.loot) assert.ok(navigationCanOccupy(state.map, p) && supported(state.map, p), `${id}: actual seeded loot is supported`);
  }
});

test('Last Stand uses genuine safe emergence and connected pursuit on both compact arenas', () => {
  for (const id of CLOSE_COMBAT_MAP_IDS) {
    const state = Horde.createState({ mapId: id, capacity: 3, seed: 8124 }); Horde.startMatch(state, [0, 1, 2]);
    for (let tick = 0; tick < 1800 && !state.players.some(p => p.monster && p.alive); tick++) Horde.step(state);
    const monster = state.players.find(p => p.monster && p.alive);
    assert.ok(monster, `${id}: a real wave materialized`); assert.ok(navigationCanOccupy(BREACH[id], monster));
    const humans = state.players.filter(p => p.human && p.participating);
    assert.ok(humans.some(p => navigationPath(BREACH[id], monster, p).length), `${id}: monster pursuit has a real connected route`);
    assert.ok(humans.every(p => navigationCanOccupy(BREACH[id], p)));
    assert.ok(state.events.some(e => e.type === 'monsterRift'));
  }
});
