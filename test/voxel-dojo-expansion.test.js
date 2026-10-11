import assert from 'node:assert/strict';
import test from 'node:test';
import { createPractice, startPractice, stepPractice, pausePractice, resumePractice, getPracticeStats } from '../public/voxel-practice-engine.js';
import { DOJO_MAP } from '../public/voxel-dojo-map.js';
import { DOJO_MAPS, DOJO_MAP_IDS, getDojoMap } from '../public/voxel-dojo-maps.js';
import { DOJO_RESPAWN_TICKS, findDojoStation, findDojoStationLoot } from '../public/voxel-dojo-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { MELEE_WEAPONS } from '../public/voxel-melee.js';
import { applyCombatDamage, eyeHeight, emptyInput, HEAL } from '../public/voxel-engine.js';
import { navigationCanOccupy } from '../public/voxel-navigation.js';
// Charge guns are held to full charge and released; per-press guns fire on the first tick.
const trigger = (weapon, tick) => WEAPONS[weapon].mode === 'charge' ? tick % (WEAPONS[weapon].chargeTicks + 2) < WEAPONS[weapon].chargeTicks : tick === 0 || WEAPONS[weapon].mode === 'auto';

const newMaps = DOJO_MAP_IDS.filter(id => id !== 'dojo');
function advance(state, count, input = {}) { for (let tick = 0; tick < count; tick++) stepPractice(state, typeof input === 'function' ? input(state, tick) : input); }
function begin(mapId, options = {}) {
  const state = createPractice({ mode: 'dojo', mapId, bots: 5, seed: 1187, ...options });
  startPractice(state); while (state.phase === 'countdown') stepPractice(state); return state;
}
function pose(player, point) { Object.assign(player, { x: point.x, y: point.y || 0, z: point.z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, grounded: true, previousInput: emptyInput() }); }
function aim(player, target, fire, head = false) {
  const dx = target.x - player.x, dz = target.z - player.z;
  return { fire, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(target.y + (head ? 1.67 : 1.02) - player.y - eyeHeight(player), Math.hypot(dx, dz)) - player.recoil };
}

test('the Dojo catalog preserves Cedar and only accepts its three isolated training arenas', () => {
  assert.equal(getDojoMap(), DOJO_MAP); assert.equal(DOJO_MAPS.dojo, DOJO_MAP);
  assert.deepEqual(DOJO_MAP_IDS, ['dojo', 'dojo-lantern', 'dojo-iron']);
  for (const mapId of ['courtyard', '__proto__', '', null]) assert.throws(() => getDojoMap(mapId), RangeError);
  for (const mapId of newMaps) {
    assert.throws(() => createPractice({ mode: 'combat', mapId }), RangeError);
    assert.throws(() => createPractice({ game: 'voxel-royale', mode: 'dojo', mapId }), RangeError);
  }
});

for (const mapId of newMaps) {
  test(`${mapId}: selected arena waits for Start and restart retains its real poses and kit`, () => {
    const state = createPractice({ mode: 'dojo', mapId, bots: 5, weapon: 'judge', melee: 'katana', seed: 414 });
    const ready = JSON.stringify(state); advance(state, 360, { up: true, fire: true, dojoMotion: true });
    assert.equal(JSON.stringify(state), ready); assert.equal(state.map, DOJO_MAPS[mapId]); assert.equal(state.mapId, mapId); assert.equal(state.mapName, state.map.name);
    assert.deepEqual(state.players.map(player => [player.x, player.y, player.z]), [state.map.playerSpawn, ...state.map.targetSpawns].map(point => [point.x, point.y, point.z]));
    startPractice(state); while (state.phase === 'countdown') stepPractice(state);
    advance(state, 120, { up: true }); assert.notEqual(state.players[0].z, state.map.playerSpawn.z);
    pausePractice(state); const preserved = { ...state.practice.config }; const restarted = createPractice(preserved); startPractice(restarted);
    assert.equal(restarted.map, state.map); assert.equal(restarted.mapName, state.map.name); assert.equal(restarted.players[0].weapon, 'judge'); assert.equal(restarted.players[0].meleeWeapon, 'katana');
    assert.deepEqual([restarted.players[0].x, restarted.players[0].y, restarted.players[0].z], [state.map.playerSpawn.x, state.map.playerSpawn.y, state.map.playerSpawn.z]);
  });

  test(`${mapId}: all guns must be picked up at the selected rack and cause real body contacts`, () => {
    for (const weapon of Object.keys(WEAPONS).filter(id => !WEAPONS[id].gadget)) {
      const state = begin(mapId), player = state.players[0], gunRack = state.map.stations.find(station => station.id === 'gun');
      stepPractice(state, { dojoWeapon: weapon, interact: true }); assert.equal(player.weapon, 'carbine', 'remote selection granted a gun');
      pose(player, gunRack); stepPractice(state); stepPractice(state, { dojoWeapon: weapon, interact: true });
      assert.equal(player.weapon, weapon); assert.ok(state.events.some(event => event.type === 'lootPickup' && event.weapon === weapon));
      assert.ok(state.loot.some(item => item.dojoStation === 'gun' && item.weapon === weapon));
      const target = state.players[1]; pose(player, { x: target.x, y: target.y, z: target.z + 3 });
      const hp = target.hp;
      for (let tick = 0; tick < 200 && target.hp === hp; tick++) stepPractice(state, aim(player, target, trigger(weapon, tick)));
      assert.ok(target.hp < hp, `${weapon}: no real body contact`); assert.ok(state.dojo.lastHit?.damage > 0);
      assert.ok(player.inventory.length <= 4); assert.equal(state.phase, 'fight');
    }
  });

  test(`${mapId}: all blades are physical rack pickups and resolve swept attacks`, () => {
    for (const melee of Object.keys(MELEE_WEAPONS)) {
      const state = begin(mapId), player = state.players[0], rack = state.map.stations.find(station => station.id === 'blade');
      pose(player, rack); stepPractice(state, { dojoBlade: melee, interact: true });
      assert.equal(player.meleeWeapon, melee); assert.equal(player.slot, 'sword');
      const target = state.players[1]; pose(player, { x: target.x, y: target.y, z: target.z + 1.05 });
      stepPractice(state, { fire: true, yaw: 0, pitch: 0 }); advance(state, MELEE_WEAPONS[melee].startupTicks + MELEE_WEAPONS[melee].activeTicks + 3);
      assert.equal(target.hp, 200 - MELEE_WEAPONS[melee].damage); assert.equal(state.dojo.lastHit?.weapon, melee);
      assert.ok(state.events.some(event => event.type === 'meleeHit' && event.weapon === melee));
    }
  });

  test(`${mapId}: moving targets keep their supported upper and ground lanes, then Reset uses those pads`, () => {
    const state = begin(mapId, { targetMotion: 'moving' }), starts = state.map.targetSpawns;
    const travel = starts.map(() => 0);
    for (let tick = 0; tick < 1200; tick++) {
      stepPractice(state);
      for (const target of state.players.slice(1)) {
        const bound = state.map.targetMotionBounds[target.id - 1], spawn = starts[target.id - 1];
        assert.ok(navigationCanOccupy(state.map, target), `${target.id}: body crossed cover`);
        assert.ok(Math.abs(target.y - spawn.y) < 1e-6, `${target.id}: walked off its floor`);
        assert.ok(target.x >= bound.minX - .12 && target.x <= bound.maxX + .12, `${target.id}: escaped its lateral lane`);
        assert.ok(target.z >= bound.minZ && target.z <= bound.maxZ);
        travel[target.id - 1] = Math.max(travel[target.id - 1], Math.abs(target.x - spawn.x));
      }
    }
    assert.ok(travel.every(value => value > .5));
    stepPractice(state, { dojoMotion: true }); stepPractice(state); stepPractice(state, { dojoReset: true });
    assert.equal(state.dojo.moving, false); assert.equal(state.dojo.resetCount, 1);
    assert.deepEqual(state.players.slice(1).map(target => [target.x, target.y, target.z]), starts.map(point => [point.x, point.y, point.z]));
  });

  test(`${mapId}: upper targets respawn on the selected supported floor after genuine headshot damage`, () => {
    const state = begin(mapId, { weapon: 'operator' }), target = state.players[5], life = target.lifeId;
    const origin = state.map.rangeLanes.find(lane => lane.targetIndex === 4).origin;
    pose(state.players[0], origin);
    advance(state, 30, () => ({ ...aim(state.players[0], target, false, true), aim: true }));
    for (let tick = 0; tick < 180 && target.alive; tick++) stepPractice(state, { ...aim(state.players[0], target, tick === 0, true), aim: true });
    assert.equal(target.alive, false); assert.equal(state.phase, 'fight'); assert.equal(getPracticeStats(state).kills, 1);
    advance(state, DOJO_RESPAWN_TICKS);
    const next = state.players[5], spawn = state.map.targetSpawns[4];
    assert.equal(next.alive, true); assert.equal(next.lifeId, life + 1); assert.equal(next.hp, 200);
    assert.deepEqual([next.x, next.y, next.z], [spawn.x, spawn.y, spawn.z]); assert.ok(navigationCanOccupy(state.map, next));
    advance(state, 60); assert.equal(next.y, spawn.y, 'respawn fell through its platform');
  });

  test(`${mapId}: selected supply and recovery benches use finite inventory and real potion commitments`, () => {
    const state = begin(mapId), player = state.players[0], recovery = state.map.stations.find(station => station.id === 'recovery');
    pose(player, recovery); stepPractice(state, { dojoWound: true }); assert.equal(player.hp, 140);
    const supply = state.map.stations.find(station => station.id === 'supplies'); pose(player, supply); stepPractice(state, { interact: true });
    assert.equal(player.potions, 2); stepPractice(state); stepPractice(state, { heal: true }); assert.equal(player.potions, 2);
    advance(state, HEAL.ticks); assert.equal(player.potions, 1); assert.equal(player.hp, 200);
    assert.ok(player.inventory.length <= 4); assert.equal(state.loot.filter(item => item.dojoStation === 'supplies').length, 4, 'potion, frag, smoke and flash restock');
    pose(player, recovery); stepPractice(state, { dojoWound: true }); stepPractice(state); stepPractice(state, { interact: true }); assert.equal(player.hp, 200);
    pose(player, { ...recovery, y: 2.4 }); assert.equal(findDojoStation(state, 'recovery'), null, 'wrong-floor station interaction was accepted');
  });

  test(`${mapId}: pause freezes clocks and loot, rejects held actions, and death recovery returns to this entrance`, () => {
    const state = begin(mapId, { targetMotion: 'moving', weapon: 'ghost', melee: 'axe' });
    pausePractice(state); const frozen = JSON.stringify(state);
    advance(state, 360, { fire: true, interact: true, dojoMotion: true, dojoReset: true }); assert.equal(JSON.stringify(state), frozen);
    resumePractice(state); stepPractice(state, { fire: true, interact: true, dojoMotion: true, dojoReset: true });
    assert.equal(state.dojo.moving, true); assert.equal(state.dojo.resetCount, 0); assert.equal(state.players[0].shots, 0);
    stepPractice(state); stepPractice(state, { dojoMotion: true }); assert.equal(state.dojo.moving, false);
    applyCombatDamage(state, [{ playerId: null, targetId: 0, damage: 250, attack: 'training' }]);
    advance(state, DOJO_RESPAWN_TICKS + 1); const player = state.players[0], spawn = state.map.playerSpawn;
    assert.equal(player.alive, true); assert.equal(player.weapon, 'ghost'); assert.equal(player.meleeWeapon, 'axe');
    assert.deepEqual([player.x, player.y, player.z], [spawn.x, spawn.y, spawn.z]); assert.equal(state.phase, 'fight');
    assert.equal(getPracticeStats(state).result, null); assert.equal(findDojoStationLoot(state), null);
  });
}
