import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS as BASE_MAPS } from '../public/voxel-maps.js';
import { HORDE_MAPS, addHordeCover } from '../public/voxel-horde-maps.js';
import * as Horde from '../public/voxel-horde-engine.js';
import { navigationCanOccupy, navigationPath, navigationVisible } from '../public/voxel-navigation.js';
import { monsterBodyProfile } from '../public/voxel-monster-bodies.js';
import { emptyInput, traceShot, predictLocalMovement, createCombatPlayer, WORLD } from '../public/voxel-engine.js';
import { snapshotHordeState } from '../public/voxel-horde-snapshot.js';
import { mapMeshes } from '../public/voxel-renderer.js';

const intersects = (a, b) => a.x < b.x + b.w - .005 && a.x + a.w > b.x + .005 && a.z < b.z + b.d - .005 && a.z + a.d > b.z + .005 && a.y < b.y + b.h - .005 && a.y + a.h > b.y + .005;
const physical = { radius: .52, height: 1.8 };

for (const [id, map] of Object.entries(HORDE_MAPS)) {
  test(`${id}: Last Stand cover leaves Breach, entrances and original climbs intact`, () => {
    const base = BASE_MAPS[id], added = map.colliders.filter(box => box.id.startsWith('horde-'));
    assert.equal(Horde.MAPS[id], map); assert.notEqual(base, map);
    assert.ok(Object.isFrozen(map) && Object.isFrozen(map.hordeCover));
    assert.equal(addHordeCover(map), map); assert.equal(base.hordeCover, undefined);
    assert.deepEqual(map.colliders.slice(0, base.colliders.length), base.colliders);
    assert.equal(map.hordeCover.length, 4); assert.ok(added.length >= 9);
    assert.equal(new Set(map.colliders.map(box => box.id)).size, map.colliders.length);
    for (const box of added) {
      assert.ok([box.x, box.y, box.z, box.w, box.h, box.d].every(Number.isFinite));
      assert.ok(box.w > 0 && box.h > 0 && box.d > 0);
      assert.ok(box.x >= map.bounds.minX && box.x + box.w <= map.bounds.maxX && box.z >= map.bounds.minZ && box.z + box.d <= map.bounds.maxZ);
      assert.ok(!base.colliders.some(existing => intersects(box, existing)), `${box.id}: overlaps an old solid`);
    }
    for (const spawn of map.spawns.flat()) assert.ok(navigationCanOccupy(map, spawn, physical));
    const doorPoints = (base.buildings || []).flatMap(building => (building.doorways || []).flatMap(door => [door.inside, door.outside])).filter(Boolean);
    const climbPoints = base.routes.flatMap(route => [route.start, ...route.approach, ...route.steps.map(p => { const box = base.colliders.find(box => box.id === p.colliderId); return { ...p, y: box.y + box.h }; })]);
    for (const p of [...doorPoints, ...climbPoints]) if (navigationCanOccupy(base, p, physical)) assert.ok(navigationCanOccupy(map, p, physical), `${id}: blocked entrance/climb at ${JSON.stringify(p)}`);
    assert.ok(map.jumpCover.some(cover => cover.kind === 'horde-hop'));
    for (const hop of map.jumpCover.filter(cover => cover.kind === 'horde-hop')) assert.ok(navigationCanOccupy(map, hop.landing, physical), `${hop.colliderId}: misleading landing`);
  });

  test(`${id}: human and wider hound routes remain connected through cover and to the upper floors`, () => {
    for (const actor of [{}, { monster: true, human: false, monsterType: 'hound' }]) {
      const from = { ...map.spawns[0][0], ...actor };
      const goals = [map.spawns[1][0], ...map.jumpCover.filter(cover => cover.kind === 'horde-hop').map(cover => cover.landing), ...map.routes.map(route => { const p = route.steps.at(-1), box = map.colliders.find(box => box.id === p.colliderId); return { ...p, y: box.y + box.h }; })];
      for (const target of goals) assert.ok(navigationPath(map, from, target).length, `${id}/${actor.monsterType || 'human'}: unreachable ${JSON.stringify(target)}`);
    }
  });

  test(`${id}: crafted cover stays finite and inside the shared static render budget`, () => {
    const mesh = mapMeshes(map), previous = mapMeshes(BASE_MAPS[id]);
    const count = (mesh.opaque.length + mesh.shadows.length) / 10, delta = count - (previous.opaque.length + previous.shadows.length) / 10;
    assert.ok(count < 100000 && delta > 1000 && delta < 10000, `${id}: ${count} vertices, ${delta} added`);
    assert.ok(mesh.opaque.every(Number.isFinite) && mesh.shadows.every(Number.isFinite));
  });
}

test('new Last Stand solids stop actual bullets and accepted movement at their visible silhouette', () => {
  const map = HORDE_MAPS.trading, box = map.colliders.find(box => box.id === 'horde-trading-archive-cabinet');
  const player = createCombatPlayer(0), target = createCombatPlayer(1);
  Object.assign(player, { x: box.x - 2, y: 0, z: box.z + box.d / 2, yaw: Math.PI / 2 });
  Object.assign(target, { x: box.x + box.w + 2, y: 0, z: player.z });
  const state = { gameId: 'voxel-horde', map, mapId: map.id, players: [player, target] };
  const contact = traceShot(state, 0, { x: player.x, y: 1.55, z: player.z }, { x: 1, y: 0, z: 0 }, 10);
  assert.equal(contact.kind, 'wall'); assert.equal(contact.colliderId, box.id);
  const before = target.hp;
  for (let tick = 0; tick < 240; tick++) predictLocalMovement(player, { ...emptyInput(player), up: true }, map);
  assert.ok(player.x <= box.x - player.radius + 1e-5); assert.ok(navigationCanOccupy(map, player)); assert.equal(target.hp, before);
});

test('server state owns the Last Stand geometry while network snapshots omit static maps', () => {
  const state = Horde.createState({ mapId: 'paris', capacity: 1, seed: 7 });
  assert.equal(state.map, HORDE_MAPS.paris); assert.equal(snapshotHordeState(state).map, undefined);
});

for (const id of ['paris', 'sewers', 'trading']) for (const type of ['hound', 'gunner']) {
  test(`${id}: actual ${type} pursues around new cover instead of getting stuck`, () => {
    const map = HORDE_MAPS[id], actor = { monster: true, human: false, monsterType: type }, profile = monsterBodyProfile(actor) || { radius: WORLD.radius, height: WORLD.standHeight, eyeHeight: WORLD.eyeHeight };
    let pair;
    for (const group of map.hordeCover.filter(group => group.y === 0)) {
      for (const [dx, dz] of [[2.4, 0], [0, 2.4]]) {
        const start = { x: group.x - dx, y: 0, z: group.z - dz }, target = { x: group.x + dx, y: 0, z: group.z + dz };
        if (navigationCanOccupy(map, start, profile) && navigationCanOccupy(map, target)
          && !navigationVisible(map, { ...start, y: profile.eyeHeight }, { ...target, y: 1.4 })
          && navigationPath(map, { ...start, ...actor }, target).length) { pair = { start, target }; break; }
      }
      if (pair) break;
    }
    assert.ok(pair, 'need an actual obstructed approach');
    const state = Horde.createState({ mapId: id, capacity: 1, seed: 420 }); Horde.startMatch(state, [0]);
    while (state.phase === 'countdown') Horde.step(state);
    state.horde.wave = type === 'gunner' ? 4 : 1; state.horde.pending = 1; state.horde.nextSpawnTick = 1e9;
    const human = state.players[0]; Object.assign(human, pair.target, { hp: 10000, maxHp: 10000 }); human.previousInput = emptyInput(human);
    state.spawnWarnings = [{ id: ++state.horde.spawnId, ...pair.start, ticksLeft: 1, monsterType: type }];
    Horde.step(state);
    const monster = state.players.find(player => player.monster && player.alive); assert.ok(monster); monster.emergenceTicks = 0;
    for (let tick = 0; tick < 1800 && human.hp === human.maxHp; tick++) {
      Horde.step(state); assert.ok(navigationCanOccupy(map, monster));
    }
    assert.ok(human.hp < human.maxHp, `${type} failed to fight around actual cover: ${JSON.stringify({ x: monster.x, z: monster.z, yaw: monster.yaw, weapon: monster.weapon, shots: monster.shots, brain: state.horde.brains[monster.id] })}`);
  });
}
