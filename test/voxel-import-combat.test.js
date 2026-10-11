import assert from 'node:assert/strict';
import test from 'node:test';
import { combatStep, createCombatPlayer, emptyInput, WEAPONS, traceShot, pickupCombatLoot } from '../public/voxel-engine.js';
import { createInventoryGun, refreshInventory } from '../public/voxel-inventory.js';
import { createPractice, startPractice, stepPractice, pausePractice, resumePractice } from '../public/voxel-practice-engine.js';
import * as Horde from '../public/voxel-horde-engine.js';
import { enableLagCompensation, recordLagCompensation, setShotViewTick, traceCompensatedShot } from '../public/voxel-lag-compensation.js';
import { findDojoStationLoot } from '../public/voxel-dojo-engine.js';

const open = { id: 'import-combat-open', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
function fixture(arena = open) {
  const players = [createCombatPlayer(0, 1, 'railgun')];
  return { gameId: 'voxel-breach', phase: 'fight', round: 1, mapId: arena.id, map: arena, tick: 0, players, fighters: players, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 };
}
function tick(state, controls = {}) { state.tick++; combatStep(state, [{ ...emptyInput(state.players[0]), ...controls }], state.map); }
function charge(state) { for (let index = 0; index < WEAPONS.railgun.chargeTicks; index++) tick(state, { fire: true }); }
function practice(game = 'voxel') {
  const state = createPractice({ game, bots: 1, mode: 'combat', difficulty: 'veteran', seed: 73213 });
  startPractice(state);
  while (state.phase === 'countdown') stepPractice(state);
  state.map = open; state.loot = [];
  Object.assign(state.players[0], { x: 0, y: 0, z: 6, yaw: 0, hp: 20000, maxHp: 20000, grounded: true });
  Object.assign(state.players[1], { x: 0, y: 0, z: -6, yaw: Math.PI, grounded: true, previousInput: emptyInput({ yaw: Math.PI }) });
  return state;
}

test('a charged rail shot is cancelled by a climb instead of firing from its neutral trigger', () => {
  const arena = { ...open, colliders: [{ id: 'crate', x: -1, y: 0, z: -4, w: 2, h: 1.4, d: 2, material: 'wood' }] };
  const state = fixture(arena), player = state.players[0];
  Object.assign(player, { z: -1.65 }); charge(state);
  assert.equal(player.chargeTicks, WEAPONS.railgun.chargeTicks);
  tick(state, { up: true, jump: true });
  assert.ok(player.mantleTicks > 0);
  assert.equal(player.chargeTicks, 0); assert.equal(player.shots, 0); assert.equal(player.ammo, WEAPONS.railgun.magazine);
  while (player.mantleTicks > 0) tick(state);
  tick(state); assert.equal(player.shots, 0, 'the old charge does not discharge after the climb');
  charge(state); tick(state); assert.equal(player.shots, 1, 'normal hold and release still works after climbing');
});

test('interacting cancels a charge and switching between two railguns cannot transfer it', () => {
  for (const controls of [{ interact: true }, { slot3: true }]) {
    const state = fixture(), player = state.players[0];
    player.inventory[2] = createInventoryGun('railgun'); refreshInventory(player);
    charge(state); tick(state, controls); tick(state);
    assert.equal(player.chargeTicks, 0); assert.equal(player.shots, 0); assert.equal(player.ammo, WEAPONS.railgun.magazine);
    charge(state); tick(state); assert.equal(player.shots, 1);
  }
});

test('pausing practice cancels a charge without spending ammunition or shooting on resume', () => {
  const state = createPractice({ bots: 1, mode: 'targets', weapon: 'railgun', seed: 9 }); startPractice(state);
  while (state.phase === 'countdown') stepPractice(state);
  for (let index = 0; index < 60; index++) stepPractice(state, { fire: true });
  assert.equal(state.players[0].chargeTicks, 60);
  pausePractice(state); resumePractice(state); stepPractice(state, { fire: true }); stepPractice(state);
  assert.equal(state.players[0].chargeTicks, 0); assert.equal(state.players[0].shots, 0); assert.equal(state.players[0].ammo, WEAPONS.railgun.magazine);
});

for (const game of ['voxel', 'voxel-royale']) for (const weapon of ['railgun', 'leveraction']) {
  test(`${game} bots can fight after actually picking up a ${weapon}`, () => {
    const state = practice(game), bot = state.players[1];
    const drop = { id: ++state.lootId, kind: 'weapon', weapon, ammo: WEAPONS[weapon].magazine, reserve: WEAPONS[weapon].reserve, x: bot.x, y: bot.y, z: bot.z };
    state.loot.push(drop); assert.ok(pickupCombatLoot(state, bot, drop));
    let accepted = 0, fizzles = 0, fumbles = 0;
    for (let index = 0; index < 900; index++) {
      const previousId = state.eventId; stepPractice(state);
      for (const event of state.events) if (event.id > previousId && event.playerId === bot.id) {
        if (event.type === 'shot' && event.weapon === weapon) { accepted++; if (weapon === 'railgun') assert.equal(event.charge, 1); }
        if (event.type === 'chargeFizzle') fizzles++;
        if (event.type === 'leverFumble') fumbles++;
      }
    }
    assert.ok(accepted >= 2, `accepted ${accepted} shots`);
    assert.equal(fizzles, 0); assert.equal(fumbles, 0); assert.ok(state.players[0].hp < 20000, 'real attacks damage the opponent');
  });
}

function horde() {
  const state = Horde.createState({ capacity: 1, seed: 32 });
  Horde.selectLoadout(state, 0, 'throwingknife'); Horde.startMatch(state, [0]);
  while (state.phase === 'countdown') Horde.step(state);
  state.map = open; state.spawnWarnings = []; state.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER;
  Object.assign(state.players[0], { x: 0, y: 0, z: 0, yaw: 0, grounded: true });
  return state;
}
test('a thrown knife can be recovered in Last Stand as exactly one matching reserve knife', () => {
  const state = horde(), player = state.players[0];
  player.inventory[2] = createInventoryGun('pistol'); refreshInventory(player);
  const otherReserve = player.inventory[2].reserve;
  Horde.step(state, [{ fire: true, pitch: -.25 }]);
  for (let index = 0; index < 200 && state.bolts.length; index++) Horde.step(state);
  const knife = state.loot.find(item => item.recovered);
  assert.ok(knife, 'the physical projectile landed');
  for (let index = 0; index < 60; index++) Horde.step(state);
  Object.assign(player, { x: knife.x, y: knife.y, z: knife.z + .35 });
  assert.equal(Horde.findNearbyLoot(state, 0)?.id, knife.id, 'the recovered knife appears in the normal pickup prompt');
  const reserve = player.reserve;
  Horde.step(state, [{ interact: true }]);
  assert.equal(player.reserve, reserve + 1); assert.equal(player.inventory[2].reserve, otherReserve, 'recovering one knife does not refill other guns');
  assert.equal(state.loot.some(item => item.id === knife.id), false);
});

test('Last Stand pause and restock cancel pending charge/lever shots', () => {
  const state = horde(), player = state.players[0];
  player.chargeTicks = 60; player.leverQueued = true;
  Horde.pauseMatch(state); assert.equal(player.chargeTicks, 0); assert.equal(player.leverQueued, false);
  Horde.resumeMatch(state);
  player.chargeTicks = 60; player.leverQueued = true;
  state.horde.pending = 0; Horde.step(state);
  assert.equal(state.phase, 'intermission'); assert.equal(player.chargeTicks, 0); assert.equal(player.leverQueued, false);
});

test('historical lean rewinds the head height together with its horizontal position', () => {
  const state = fixture(), target = createCombatPlayer(1); target.z = -10;
  state.players.push(target); state.fighters = state.players;
  enableLagCompensation(state);
  for (let tick = 100; tick <= 114; tick++) {
    state.tick = tick;
    Object.assign(target, { leanX: (tick - 100) / 14 * .38, leanZ: 0, leanOffset: (tick - 100) / 14 * .38 });
    recordLagCompensation(state);
  }
  assert.ok(setShotViewTick(state, 0, 100));
  const origin = { x: 0, y: 1.79, z: 0 }, direction = { x: 0, y: 0, z: -1 };
  assert.equal(traceShot(state, 0, origin, direction, 120, open).kind, 'none', 'current head has leaned down and away');
  const before = structuredClone(state);
  const hit = traceCompensatedShot(state, 0, origin, direction, 120, open, traceShot);
  assert.equal(hit.kind, 'head'); assert.equal(hit.playerId, target.id);
  assert.deepEqual(state, before, 'the rewind never changes authoritative state');
});

test('the Dojo can loot separate smoke and flash stacks without exceeding either stack or the four-slot pack', () => {
  const state = createPractice({ mode: 'dojo', bots: 1, seed: 829 }); startPractice(state);
  while (state.phase === 'countdown') stepPractice(state);
  const player = state.players[0], station = state.map.stations.find(item => item.id === 'supplies');
  const approach = type => {
    const supply = state.loot.find(item => item.dojoStation === 'supplies' && item.type === type);
    Object.assign(player, { x: supply.x, y: station.y, z: station.z, vx: 0, vy: 0, vz: 0, previousInput: emptyInput(player) });
    assert.equal(findDojoStationLoot(state)?.type, type);
    stepPractice(state, { interact: true }); stepPractice(state);
  };
  approach('smoke');
  assert.equal(player.grenades, 2); assert.deepEqual(player.inventory[2], { kind: 'grenade', type: 'smoke', amount: 2 });
  assert.equal(player.inventory[3], null);
  approach('flash');
  assert.equal(player.grenades, 4); assert.deepEqual(player.inventory[3], { kind: 'grenade', type: 'flash', amount: 2 });
  assert.equal(player.inventory.length, 4); assert.equal(findDojoStationLoot(state), null, 'full typed stacks cannot collect more from the restocked bench');
  stepPractice(state, { slot3: true }); stepPractice(state, { grenade: true });
  assert.equal(player.inventory[2].amount, 1); assert.equal(state.grenades[0].type, 'smoke');
  Object.assign(player, { x: station.x + .7, y: station.y, z: station.z });
  while (player.grenadeThrowTicks > 0) stepPractice(state);
  stepPractice(state, { interact: true });
  assert.equal(player.inventory[2].amount, 2, 'restock tops up only the available space in the existing smoke stack');
  assert.equal(player.inventory[3].amount, 2); assert.equal(player.grenades, 4); assert.equal(player.inventory.length, 4);
});
