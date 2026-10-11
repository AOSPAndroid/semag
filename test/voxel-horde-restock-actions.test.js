import assert from 'node:assert/strict';
import test from 'node:test';
import * as Horde from '../public/voxel-horde-engine.js';
import { HEAL, WEAPONS, addInventoryLoot, resetHealing } from '../public/voxel-engine.js';
import { createInventoryGun, refreshInventory, storeInventoryGun } from '../public/voxel-inventory.js';

function advance(state, ticks, inputs = []) { for (let tick = 0; tick < ticks; tick++) Horde.step(state, inputs); return state; }
function restock({ capacity = 1, ids = [0] } = {}) {
  const state = Horde.createState({ capacity, seed: 7193 });
  Horde.startMatch(state, ids); advance(state, state.phaseTicks);
  assert.equal(state.phase, 'fight');
  for (const id of ids) {
    const player = state.players[id];
    Object.assign(player, { hp: 100, ammo: 3, reserve: 12, x: id * 3, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true }); storeInventoryGun(player);
  }
  // Isolate the wave-clear boundary with no remaining spawn commitments. The
  // real mode step performs its normal bonuses, fences and intermission setup.
  state.horde.pending = 0; state.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER;
  Horde.step(state);
  assert.equal(state.phase, 'intermission');
  return state;
}
function potion(state, id = 0, amount = 2) {
  const player = state.players[id];
  player.inventory[2] = { kind: 'heal', amount }; refreshInventory(player);
  return player;
}
function depletedGun(player, weapon = player.weapon, reserve = 11) {
  player.inventory[1] = createInventoryGun(weapon, { ammo: 0, reserve }); player.inventoryIndex = 1; refreshInventory(player);
  return player;
}
const events = (state, type, id = 0) => state.events.filter(event => event.type === type && event.playerId === id);

test('wave clear keeps the existing automatic recovery and supply economy exactly once', () => {
  const state = restock(), player = state.players[0], gun = WEAPONS[player.weapon];
  assert.equal(player.hp, 135); assert.equal(player.ammo, gun.magazine); assert.equal(player.reserve, 12 + gun.magazine * 2);
  assert.equal(player.potions, 0); assert.equal(player.grenades, 0);
  assert.equal(state.horde.wavesCleared, 1); assert.equal(state.phaseTicks, Horde.HORDE_RULES.intermissionTicks);
  assert.equal(state.loot.filter(item => item.source === 'wave-clear').length, 1);
  const resources = { hp: player.hp, ammo: player.ammo, reserve: player.reserve }, runClock = state.horde.elapsedTicks;
  advance(state, 120, [{ heal: true, reload: true }]);
  assert.deepEqual({ hp: player.hp, ammo: player.ammo, reserve: player.reserve }, resources);
  assert.equal(state.horde.elapsedTicks, runClock); assert.equal(state.horde.wavesCleared, 1);
});

test('F drinks an existing physical potion during restock and commits one charge only on completion', () => {
  const state = restock(), player = potion(state), hp = player.hp, runClock = state.horde.elapsedTicks;
  Horde.step(state, [{ heal: true }]);
  assert.equal(player.healTicks, HEAL.ticks); assert.equal(player.hp, hp); assert.equal(player.potions, 2);
  assert.equal(events(state, 'healStart').length, 1); assert.ok(player.inventory[2].healUseId);
  advance(state, HEAL.ticks - 1, [{ heal: true }]);
  assert.equal(player.healTicks, 1); assert.equal(player.hp, hp); assert.equal(player.potions, 2);
  Horde.step(state, [{ heal: true }]);
  assert.equal(player.hp, Math.min(player.maxHp, hp + HEAL.amount)); assert.equal(player.potions, 1); assert.equal(player.inventory[2].amount, 1);
  assert.equal(player.inventory[2].healUseId, undefined); assert.equal(events(state, 'healComplete').length, 1);
  advance(state, HEAL.ticks * 2, [{ heal: true }]); assert.equal(events(state, 'healStart').length, 1, 'held F cannot drink another charge');
  assert.equal(state.phase, 'intermission'); assert.equal(state.horde.elapsedTicks, runClock);
});

test('an empty corpse weapon collected in restock can reload using its real reserve', () => {
  const state = restock(), player = state.players[0];
  // Keep the authored blade cache; a physical empty gun is deliberately placed
  // nearer than it so E picks this corpse-style item through the normal route.
  Object.assign(player, { x: .5, z: 0 });
  const drop = addInventoryLoot(state, player, createInventoryGun('pistol', { ammo: 0, reserve: 8 }));
  Horde.step(state, [{ interact: true }]);
  assert.equal(state.loot.some(item => item.id === drop.id), false); assert.equal(player.weapon, 'pistol'); assert.equal(player.ammo, 0); assert.equal(player.reserve, 8);
  Horde.step(state); Horde.step(state, [{ reload: true }]);
  assert.equal(player.reloadTicks, WEAPONS.pistol.reloadTicks); assert.equal(events(state, 'reload').length, 1);
  advance(state, WEAPONS.pistol.reloadTicks - 1);
  assert.equal(player.reloadTicks, 1); assert.equal(player.ammo, 0); assert.equal(player.reserve, 8);
  Horde.step(state);
  assert.equal(player.reloadTicks, 0); assert.equal(player.ammo, 8); assert.equal(player.reserve, 0); assert.equal(events(state, 'reloadComplete').length, 1);
  assert.equal(player.inventory[player.inventoryIndex].ammo, 8); assert.equal(player.inventory[player.inventoryIndex].reserve, 0);
});

test('a last-tick restock drink crosses into the next wave without losing its token or retriggering a held F', () => {
  const state = restock(), player = potion(state); player.hp = 50;
  advance(state, state.phaseTicks - 1); assert.equal(state.phaseTicks, 1);
  Horde.step(state, [{ heal: true }]);
  assert.equal(state.phase, 'fight'); assert.equal(state.horde.wave, 2); assert.equal(player.healTicks, HEAL.ticks);
  const token = player.healUseId, life = player.lifeId;
  assert.ok(token); assert.equal(player.inventory[2].healUseId, token); assert.ok(state.horde.inputFences[0].includes('heal'));
  advance(state, HEAL.ticks, [{ heal: true }]);
  assert.equal(player.lifeId, life); assert.equal(player.hp, 110); assert.equal(player.potions, 1); assert.equal(events(state, 'healComplete').length, 1);
  advance(state, 16, [{ heal: true }]); assert.equal(events(state, 'healStart').length, 1);
  Horde.step(state); Horde.step(state, [{ heal: true }]); assert.equal(events(state, 'healStart').length, 2);
});

test('a late restock reload continues into combat and only spends reserve when it finishes', () => {
  const state = restock(), player = depletedGun(state.players[0]);
  advance(state, state.phaseTicks - 2); Horde.step(state, [{ reload: true }]);
  assert.equal(state.phase, 'intermission'); assert.equal(player.reloadTicks, WEAPONS.carbine.reloadTicks);
  Horde.step(state, [{ reload: true }]); assert.equal(state.phase, 'fight'); assert.equal(player.reloadTicks, WEAPONS.carbine.reloadTicks - 1);
  assert.ok(state.horde.inputFences[0].includes('reload'));
  // Prevent fresh rifts from distracting this reload boundary fixture; this
  // does not alter the held item or the mode's next-wave clock.
  state.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER;
  advance(state, WEAPONS.carbine.reloadTicks - 2, [{ reload: true }]);
  assert.equal(player.reloadTicks, 1); assert.equal(player.ammo, 0); assert.equal(player.reserve, 11);
  Horde.step(state, [{ reload: true }]);
  assert.equal(player.reloadTicks, 0); assert.equal(player.ammo, 11); assert.equal(player.reserve, 0);
  assert.equal(events(state, 'reload').length, 1); assert.equal(events(state, 'reloadComplete').length, 1);
});

test('solo pause freezes an accepted drink and reload while resume completes them once', () => {
  for (const action of ['heal', 'reload']) {
    const state = restock(), player = action === 'heal' ? potion(state) : depletedGun(state.players[0]);
    Horde.step(state, [{ [action]: true }]); advance(state, 5);
    const clock = state.phaseTicks, remaining = action === 'heal' ? player.healTicks : player.reloadTicks, hp = player.hp, ammo = player.ammo;
    Horde.pauseMatch(state); const paused = JSON.stringify(state);
    advance(state, 600, [{ [action]: true, fire: true }]); assert.equal(JSON.stringify(state), paused);
    Horde.resumeMatch(state); assert.equal(state.phase, 'intermission'); assert.equal(state.phaseTicks, clock);
    assert.equal(action === 'heal' ? player.healTicks : player.reloadTicks, remaining);
    advance(state, remaining, [{ [action]: true }]);
    if (action === 'heal') { assert.equal(player.hp, hp + HEAL.amount); assert.equal(player.potions, 1); assert.equal(events(state, 'healComplete').length, 1); }
    else { assert.ok(player.ammo > ammo); assert.equal(player.reserve, 0); assert.equal(events(state, 'reloadComplete').length, 1); }
  }
});

test('V and numeric equipment changes work in restock while attacks and parry remain disabled', () => {
  const state = restock(), player = state.players[0];
  Horde.step(state, [{ swap: true, fire: true, aim: true, grenade: true }]);
  assert.equal(player.slot, 'sword'); assert.equal(player.inventoryIndex, 0); assert.equal(player.meleeTicks, 0); assert.equal(player.parryTicks, 0); assert.equal(player.aiming, false); assert.equal(player.shots, 0); assert.equal(state.grenades.length, 0);
  Horde.step(state, [{ swap: true }]); assert.equal(player.inventoryIndex, 0, 'a held V is one equipment press');
  Horde.step(state); Horde.step(state, [{ swap: true }]); assert.equal(player.slot, 'primary');
  Horde.step(state, [{ slot1: true }]); assert.equal(player.slot, 'sword');
  Horde.step(state, [{ slot2: true }]); assert.equal(player.slot, 'primary');
});

test('interrupting a restock drink or reload by equipment change loses neither potion nor ammunition', () => {
  const state = restock(), player = potion(state); const hp = player.hp;
  Horde.step(state, [{ heal: true }]); advance(state, 5); Horde.step(state, [{ swap: true }]);
  assert.equal(player.healTicks, 0); assert.equal(player.hp, hp); assert.equal(player.potions, 2); assert.equal(player.inventory[2].healUseId, undefined); assert.equal(events(state, 'healCancel').length, 1);
  Horde.step(state); Horde.step(state, [{ swap: true }]); depletedGun(player);
  Horde.step(state, [{ reload: true }]); advance(state, 5); Horde.step(state, [{ swap: true }]);
  assert.equal(player.reloadTicks, 0); assert.equal(player.inventory[1].ammo, 0); assert.equal(player.inventory[1].reserve, 11);
  assert.equal(events(state, 'reloadComplete').length, 0);
});

test('two nonadjacent co-op seats recover independently and cannot spend an absent survivor inventory', () => {
  const state = restock({ capacity: 3, ids: [0, 2] }), first = potion(state, 0), second = depletedGun(state.players[2]);
  const absent = JSON.stringify(state.players[1].inventory), inputs = [{ heal: true }, { heal: true, reload: true }, { reload: true }];
  Horde.step(state, inputs); assert.equal(first.healTicks, HEAL.ticks); assert.equal(second.reloadTicks, WEAPONS.carbine.reloadTicks);
  advance(state, WEAPONS.carbine.reloadTicks, inputs);
  assert.equal(first.hp, 195); assert.equal(first.potions, 1); assert.equal(second.ammo, 11); assert.equal(second.reserve, 0);
  assert.equal(events(state, 'healComplete', 0).length, 1); assert.equal(events(state, 'reloadComplete', 2).length, 1);
  assert.equal(JSON.stringify(state.players[1].inventory), absent); assert.equal(state.phase, 'intermission');
});

test('a wave-clear cancellation preserves an unfinished fight potion before the unchanged HP bonus', () => {
  const state = Horde.createState({ capacity: 1 }); Horde.startMatch(state); advance(state, state.phaseTicks);
  const player = potion(state); player.hp = 50;
  // Let the genuine fight action start before the final clear boundary, then
  // its normal reset must retain the reserved physical charge for restock.
  Horde.step(state, [{ heal: true }]); assert.equal(player.healTicks, HEAL.ticks);
  state.horde.pending = 0; state.spawnWarnings = []; state.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER;
  Horde.step(state);
  assert.equal(state.phase, 'intermission'); assert.equal(player.hp, 85); assert.equal(player.potions, 2); assert.equal(player.healTicks, 0); assert.equal(player.inventory[2].healUseId, undefined);
  assert.equal(events(state, 'healComplete').length, 0);
  Horde.step(state, [{ heal: true }]); advance(state, HEAL.ticks);
  assert.equal(player.hp, 145); assert.equal(player.potions, 1);
  resetHealing(player); assert.equal(player.potions, 1);
});
