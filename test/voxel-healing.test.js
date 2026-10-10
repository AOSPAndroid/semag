import assert from 'node:assert/strict';
import test from 'node:test';
import { HEAL, TICK_RATE, createCombatPlayer, combatStep, emptyInput, pickupCombatLoot, cloneState, predictLocalMovement, resetHealing } from '../public/voxel-engine.js';
import { createInventoryGun, dropInventoryItem, refreshInventory, inventoryTotal, selectInventorySlot } from '../public/voxel-inventory.js';

const arena = { bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [] };
function fixture(amount = 2, gameId = 'voxel-horde') {
  const player = createCombatPlayer(0), target = createCombatPlayer(1);
  target.x = 20; target.z = 20; player.hp = 60;
  const state = { gameId, phase: 'fight', tick: 0, players: [player, target], fighters: [player, target], map: arena, events: [], eventId: 0, loot: [], lootId: 0, grenades: [], grenadeId: 0, bolts: [], boltId: 0 };
  const loot = { id: ++state.lootId, kind: 'heal', amount, x: 0, y: 0, z: 0 }; state.loot.push(loot);
  assert.ok(pickupCombatLoot(state, player, loot));
  return state;
}
function tick(state, input = {}, additionalDamage = []) {
  state.tick++;
  combatStep(state, [{ ...emptyInput(state.players[0]), ...input }, emptyInput(state.players[1])], arena, { additionalDamage });
}
function advance(state, ticks, input = {}) { for (let index = 0; index < ticks; index++) tick(state, input); }
const completeEvents = state => state.events.filter(event => event.type === 'healComplete');

test('a 0.2-second drink keeps its two-stack visible and atomically spends exactly one on completion', () => {
  const state = fixture(), player = state.players[0], stack = player.inventory[2];
  assert.equal(HEAL.ticks / TICK_RATE, .2); assert.equal(HEAL.amount, 60);
  tick(state, { heal: true });
  assert.equal(player.hp, 60); assert.equal(player.potions, 2); assert.equal(stack.amount, 2);
  advance(state, HEAL.ticks - 1);
  assert.equal(player.hp, 60); assert.equal(player.potions, 2); assert.equal(player.healTicks, 1); assert.equal(completeEvents(state).length, 0);
  tick(state);
  assert.equal(player.hp, 120); assert.equal(player.potions, 1); assert.equal(stack.amount, 1);
  assert.equal(stack.healUseId, undefined); assert.equal(player.healUseId, null); assert.equal(player.healInventoryIndex, -1);
  assert.equal(completeEvents(state).length, 1); assert.equal(completeEvents(state)[0].amount, 60);
  advance(state, HEAL.ticks * 2); assert.equal(player.hp, 120); assert.equal(player.potions, 1);
});

test('two deliberate drinks empty a stack, while held heal and rapid taps never duplicate a drink', () => {
  const state = fixture(), player = state.players[0];
  tick(state, { heal: true }); advance(state, HEAL.ticks * 2, { heal: true });
  assert.equal(player.hp, 120); assert.equal(player.potions, 1); assert.equal(completeEvents(state).length, 1);
  tick(state); tick(state, { heal: true });
  for (let index = 0; index < HEAL.ticks; index++) tick(state, { heal: index % 2 === 0 });
  assert.equal(player.hp, 180); assert.equal(player.potions, 0); assert.equal(player.inventory[2], null); assert.equal(completeEvents(state).length, 2);
  advance(state, HEAL.ticks * 2, { heal: true }); assert.equal(player.hp, 180);
});

for (const action of ['fire', 'jump', 'swap', 'reload', 'interact', 'grenade', 'slot1', 'slot2', 'slot3', 'slot4', 'drop']) test(`${action} interrupts drinking without consuming its potion or leaving a delayed heal`, () => {
  const state = fixture(), player = state.players[0];
  tick(state, { heal: true }); advance(state, HEAL.ticks - 1);
  tick(state, { [action]: true });
  assert.equal(player.healTicks, 0); assert.equal(player.healing, false); assert.equal(player.hp, 60); assert.equal(player.potions, 2, action);
  assert.equal(player.inventory[2].amount, 2); assert.equal(player.inventory[2].healUseId, undefined);
  advance(state, HEAL.ticks * 2); assert.equal(player.hp, 60); assert.equal(completeEvents(state).length, 0);
});

test('dropping the selected potion returns its entire untouched stack to the floor', () => {
  const state = fixture(), player = state.players[0];
  tick(state, { slot3: true }); tick(state, { fire: true }); advance(state, HEAL.ticks - 1, { fire: true });
  tick(state, { drop: true });
  const loot = state.loot.find(item => item.kind === 'heal');
  assert.equal(player.healTicks, 0); assert.equal(player.potions, 0); assert.equal(player.hp, 60);
  assert.equal(loot.amount, 2); assert.equal(loot.item.healUseId, undefined);
  advance(state, HEAL.ticks * 2); assert.equal(player.hp, 60);
});

test('selected-potion fire drinks its own stack before other stacks and holding fire never shoots the gun', () => {
  const state = fixture(), player = state.players[0];
  player.inventory[3] = { kind: 'heal', amount: 2 }; refreshInventory(player);
  tick(state, { slot4: true }); tick(state, { fire: true }); advance(state, HEAL.ticks * 2, { fire: true });
  assert.equal(player.inventory[2].amount, 2); assert.equal(player.inventory[3].amount, 1);
  assert.equal(player.potions, 3); assert.equal(player.hp, 120); assert.equal(player.shots, 0);
  tick(state); tick(state, { fire: true }); advance(state, HEAL.ticks, { fire: true });
  assert.equal(player.inventory[3], null); assert.equal(player.potions, 2); assert.equal(player.hp, 180); assert.equal(player.slot, 'empty'); assert.equal(player.shots, 0);
});

for (const damage of [15, 100]) test(`final-tick damage of ${damage} cancels healing before the potion can be spent`, () => {
  const state = fixture(2, damage >= 60 ? 'voxel-breach' : 'voxel-horde'), player = state.players[0];
  tick(state, { heal: true }); advance(state, HEAL.ticks - 1);
  tick(state, {}, [{ playerId: 1, targetId: 0, damage, attack: 'gun', weapon: 'carbine' }]);
  assert.equal(player.hp, Math.max(0, 60 - damage)); assert.equal(player.healTicks, 0); assert.equal(player.healing, false); assert.equal(completeEvents(state).length, 0);
  if (player.alive) assert.equal(player.potions, 2);
  else { assert.equal(player.potions, 0); assert.equal(state.loot.filter(item => item.kind === 'heal').reduce((total, item) => total + item.amount, 0), 2); }
  advance(state, HEAL.ticks * 2); assert.equal(player.hp, Math.max(0, 60 - damage));
});

test('damage interruption leaves both charges available for a subsequent successful retry', () => {
  const state = fixture(), player = state.players[0];
  tick(state, { heal: true }); advance(state, 5); tick(state, {}, [{ playerId: 1, targetId: 0, damage: 10, attack: 'gun', weapon: 'carbine' }]);
  assert.equal(player.potions, 2); assert.equal(player.hp, 50);
  tick(state, { heal: true }); advance(state, HEAL.ticks);
  assert.equal(player.hp, 110); assert.equal(player.potions, 1); assert.equal(completeEvents(state).length, 1);
});

for (const change of ['remove', 'replace', 'move', 'switch', 'new-life']) test(`a ${change} cannot turn a stale reservation into a free heal or consume another item`, () => {
  const state = fixture(), player = state.players[0];
  tick(state, { heal: true }); advance(state, HEAL.ticks - 1);
  if (change === 'remove') dropInventoryItem(player, 2);
  if (change === 'replace') { player.inventory[2] = { kind: 'heal', amount: 2 }; refreshInventory(player); }
  if (change === 'move') { player.inventory[3] = player.inventory[2]; player.inventory[2] = null; refreshInventory(player); }
  if (change === 'switch') selectInventorySlot(player, 0);
  if (change === 'new-life') player.lifeId = 1;
  const before = inventoryTotal(player, 'heal'); tick(state);
  assert.equal(player.hp, 60); assert.equal(player.potions, before); assert.equal(player.healTicks, 0); assert.equal(player.healing, false); assert.equal(completeEvents(state).length, 0);
});

test('serialized deterministic state cloning preserves an accepted drink and one physical debit', () => {
  const state = fixture(); tick(state, { heal: true }); advance(state, 7);
  const copy = cloneState(state); advance(state, HEAL.ticks - 7); advance(copy, HEAL.ticks - 7);
  assert.deepEqual(copy, state); assert.equal(copy.players[0].hp, 120); assert.equal(copy.players[0].potions, 1);
});

test('mode resets retain the reserved stack, clear the drink state and cannot emit a delayed completion', () => {
  const state = fixture(), player = state.players[0];
  tick(state, { heal: true }); advance(state, HEAL.ticks - 1); resetHealing(player);
  assert.equal(player.potions, 2); assert.equal(player.inventory[2].amount, 2); assert.equal(player.inventory[2].healUseId, undefined);
  assert.equal(player.healTicks, 0); assert.equal(player.healing, false); assert.equal(player.healStartTick, -1); assert.equal(player.healUseId, null);
  advance(state, HEAL.ticks * 2); assert.equal(player.hp, 60); assert.equal(completeEvents(state).length, 0);
  tick(state, { heal: true }); advance(state, HEAL.ticks); assert.equal(player.hp, 120); assert.equal(player.potions, 1);
});

test('collecting another stack cancels the drink while preserving all old and new supplies', () => {
  const state = fixture(), player = state.players[0];
  tick(state, { heal: true }); advance(state, HEAL.ticks - 1);
  const loot = { id: ++state.lootId, kind: 'heal', amount: 2, x: 0, y: 0, z: 0 }; state.loot.push(loot);
  assert.ok(pickupCombatLoot(state, player, loot));
  assert.equal(player.healTicks, 0); assert.equal(player.potions, 4); assert.equal(player.inventory[2].healUseId, undefined);
  advance(state, HEAL.ticks * 2); assert.equal(player.hp, 60); assert.equal(completeEvents(state).length, 0);
});

test('full health never wastes a potion at start or after healing from another source mid-drink', () => {
  const state = fixture(), player = state.players[0]; player.hp = player.maxHp;
  tick(state, { heal: true }); assert.equal(player.healTicks, 0); assert.equal(player.potions, 2);
  tick(state); player.hp = 185; tick(state, { heal: true }); advance(state, HEAL.ticks);
  assert.equal(player.hp, 200); assert.equal(player.potions, 1); assert.equal(completeEvents(state)[0].amount, 15);
  tick(state); player.hp = 185; tick(state, { heal: true }); player.hp = player.maxHp; advance(state, HEAL.ticks);
  assert.equal(player.hp, 200); assert.equal(player.potions, 1); assert.equal(completeEvents(state).length, 1);
});

test('completion preserves both gun magazines and advances active and holstered cooldowns once per tick', () => {
  const state = fixture(), player = state.players[0];
  player.inventory[3] = createInventoryGun('pistol', { shotCooldown: 99, ammo: 3, reserve: 7 });
  player.shotCooldown = 50; player.ammo = 7; player.reserve = 13;
  tick(state, { heal: true }); advance(state, HEAL.ticks);
  assert.equal(player.inventory[1].shotCooldown, 50 - HEAL.ticks - 1); assert.equal(player.inventory[3].shotCooldown, 99 - HEAL.ticks - 1);
  assert.equal(player.inventory[1].ammo, 7); assert.equal(player.inventory[1].reserve, 13);
  assert.equal(player.inventory[3].ammo, 3); assert.equal(player.inventory[3].reserve, 7); assert.equal(player.shots, 0);
});

test('movement prediction ages the short healing lock without publishing health, reservation or inventory mutations', () => {
  const state = fixture(), player = state.players[0];
  tick(state, { slot3: true }); tick(state, { fire: true, up: true });
  const predicted = structuredClone(player), immutable = JSON.stringify([predicted.hp, predicted.healTicks, predicted.healUseId, predicted.inventory]);
  for (let index = 0; index < HEAL.ticks + 5; index++) {
    const controls = { up: true, fire: true, sprint: true };
    predictLocalMovement(predicted, controls, arena); tick(state, controls);
    assert.ok(Math.abs(predicted.z - player.z) < 1e-8); assert.ok(Math.abs(predicted.vz - player.vz) < 1e-8);
  }
  assert.equal(JSON.stringify([predicted.hp, predicted.healTicks, predicted.healUseId, predicted.inventory]), immutable);
  assert.equal(player.hp, 120); assert.equal(player.potions, 1);
});
