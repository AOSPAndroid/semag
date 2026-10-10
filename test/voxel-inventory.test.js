import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, combatStep, emptyInput, pickupCombatLoot, HEAL } from '../public/voxel-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { createInventoryGun, initializeInventory, refreshInventory, inventoryTotal, inventoryPickupHint } from '../public/voxel-inventory.js';
import { createFpsInputQueue } from '../public/voxel-input-queue.js';
import { createPracticeInputQueue } from '../public/voxel-practice-input.js';

const arena = { bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [] };
function fixture(weapon = 'carbine') {
  const player = createCombatPlayer(0, 1, weapon);
  const target = createCombatPlayer(1); target.x = 20; target.z = 20;
  const state={ gameId: 'voxel-breach', practice: {}, phase: 'fight', tick: 0, players: [player, target], fighters: [player, target], map: arena, events: [], eventId: 0, loot: [], lootId: 0, grenades: [], grenadeId: 0, bolts: [], boltId: 0 };
  // Utility-specific fixtures collect their supplies; fresh players carry none.
  for(const kind of ['heal','grenade']){const loot={id:++state.lootId,kind,amount:1,x:0,y:0,z:0};state.loot.push(loot);assert.equal(pickupCombatLoot(state,player,loot),true);}
  return state;
}
function tick(state, input = {}) { state.tick++; combatStep(state, [{ ...emptyInput(state.players[0]), ...input }, emptyInput(state.players[1])], arena); }

test('the default four-slot kit owns only a knife first and chosen weapon second with two free slots', () => {
  const player = createCombatPlayer(0, 1, 'revolver');
  assert.deepEqual(player.inventory.map(item => item?[item.kind, item.weapon || item.amount]:null), [['melee', 'knife'], ['weapon', 'revolver'], null, null]);
  assert.equal(player.potions+player.grenades,0);
  assert.equal(player.inventoryIndex, 1); assert.equal(player.ammo, 6);
  initializeInventory(player, { knifeOnly: true });
  assert.deepEqual(player.inventory.map(item => item?.weapon || null), ['knife', null, null, null]);
  assert.equal(player.hasGun, false); assert.equal(player.ammo, 0); assert.equal(player.potions, 0); assert.equal(player.grenades, 0);
});

test('rapid switching gives each carried gun exactly one cooldown tick and never duplicates ammo', () => {
  const state = fixture('carbine'), player = state.players[0];
  player.inventory[2] = createInventoryGun('pistol'); player.inventory[2].shotCooldown = 30; refreshInventory(player);
  tick(state, { fire: true }); assert.equal(player.ammo, 23); assert.equal(player.inventory[1].shotCooldown, 12);
  tick(state, { slot3: true, fire: true });
  assert.equal(player.inventory[1].shotCooldown, 11); assert.equal(player.inventory[2].shotCooldown, 28);
  assert.equal(player.inventory[2].ammo, 12); assert.equal(player.shots, 1);
  tick(state, { fire: true }); tick(state, { slot2: true, fire: true });
  assert.equal(player.inventory[1].shotCooldown, 9); assert.equal(player.inventory[2].shotCooldown, 26);
  assert.equal(player.inventory[1].ammo, 23); assert.equal(player.shots, 1);
});

test('drop cancels reload and burst commitments while retaining the real ammo, shot index and cooldown', () => {
  const state = fixture('burst'), player = state.players[0];
  tick(state, { fire: true }); const index = player.shotIndex;
  assert.equal(player.inventory[1].burstRemaining, 2);
  tick(state, { drop: true, fire: true });
  const drop = state.loot.find(item => item.kind === 'weapon');
  assert.equal(drop.ammo, 26); assert.equal(drop.item.shotIndex, index);
  assert.equal(drop.item.burstRemaining, 0); assert.equal(drop.item.reloadTicks, 0); assert.ok(drop.item.shotCooldown > 0);
  assert.equal(player.slot, 'empty'); assert.equal(player.shots, 1);
  tick(state); assert.equal(pickupCombatLoot(state, player, drop), true);
  for (let index = 0; index < 20; index++) tick(state);
  assert.equal(player.shots, 1); assert.equal(player.ammo, 26);
});

test('a stack capped at two leaves the uncollected potion on the floor', () => {
  const state = fixture(), player = state.players[0];
  const loot = { id: ++state.lootId, kind: 'heal', amount: 2, x: 0, y: 0, z: 0 }; state.loot.push(loot);
  assert.equal(pickupCombatLoot(state, player, loot), true);
  assert.equal(player.inventory[2].amount, 2); assert.equal(loot.amount, 1); assert.equal(state.loot.includes(loot), true);
  assert.equal(inventoryTotal(player, 'heal'), 2);
});

test('the selected potion drinks without firing the mirrored gun and holding its trigger completes the channel', () => {
  const state = fixture(), player = state.players[0]; player.hp = 90;
  tick(state, { slot3: true, fire: true }); assert.equal(player.shots, 0); assert.equal(player.healTicks, 0);
  tick(state); tick(state, { fire: true });
  assert.equal(player.healTicks, HEAL.ticks); assert.equal(player.potions, 1); assert.equal(player.slot, 'potion');
  for (let index = 0; index < HEAL.ticks; index++) tick(state, { fire: true });
  assert.equal(player.hp, 150); assert.equal(player.potions, 0); assert.equal(player.slot, 'empty'); assert.equal(player.shots, 0); assert.equal(player.ammo, WEAPONS.carbine.magazine);
});

test('a selected frag throws exactly once and cannot fire the hidden gun from a held trigger', () => {
  const state = fixture(), player = state.players[0];
  tick(state, { slot4: true }); tick(state, { fire: true });
  assert.equal(state.grenades.length, 1); assert.equal(player.grenades, 0); assert.equal(player.slot, 'empty');
  for (let index = 0; index < 35; index++) tick(state, { fire: true });
  assert.equal(state.grenades.length, 1); assert.equal(player.shots, 0); assert.equal(player.ammo, WEAPONS.carbine.magazine);
});

test('throwing a selected grenade stack spends that stack before another carried stack', () => {
  const state = fixture(), player = state.players[0];
  player.inventory[0] = { kind: 'grenade', amount: 2 }; refreshInventory(player);
  assert.equal(player.grenades, 3); tick(state, { slot1: true }); tick(state, { fire: true });
  assert.equal(player.inventory[0].amount, 1); assert.equal(player.inventory[3].amount, 1);
  assert.equal(player.grenades, 2); assert.equal(state.grenades.length, 1);
});

test('explicit full-backpack gun replacement drops the selected gun with its real magazine', () => {
  const state = fixture(), player = state.players[0]; tick(state, { fire: true }); tick(state);
  const loot = { id: ++state.lootId, kind: 'weapon', weapon: 'sniper', ammo: 3, reserve: 7, x: 0, y: 0, z: 0 }; state.loot.push(loot);
  assert.match(inventoryPickupHint(player, loot), /Replace Kestrel Carbine/);
  assert.equal(pickupCombatLoot(state, player, loot), true);
  assert.equal(player.inventoryIndex, 1); assert.equal(player.weapon, 'sniper'); assert.equal(player.ammo, 3);
  const old = state.loot.find(item => item.weapon === 'carbine'); assert.equal(old.ammo, 23); assert.ok(old.item.shotCooldown > 0);
});

test('FPS coalescing equips the requested slot before a per-slot drop and never samples a shot', () => {
  const state = fixture(), player = state.players[0], queue = createFpsInputQueue();
  queue.observe({ ...emptyInput(player), slot1: true, drop: true, fire: true }, 0);
  queue.observe(emptyInput(player), 1);
  const first = queue.sample(undefined, 2).buttons; assert.equal(first.slot1, true); assert.equal(first.drop, false); tick(state, first);
  const second = queue.sample(undefined, 3).buttons; assert.equal(second.drop, true); assert.equal(second.slot1, true); tick(state, second);
  assert.equal(player.inventory[0], null); assert.equal(player.inventory[1].weapon, 'carbine'); assert.equal(player.shots, 0);
  assert.equal(state.loot[0].kind, 'melee'); assert.equal(state.loot[0].weapon, 'knife');
});

test('new inventory presses respect reset and cancellation fences in both input queues', () => {
  const queue = createFpsInputQueue(); queue.reset({ held: { slot2: true, drop: true }, neutral: true });
  queue.observe({ slot2: true, drop: true }, 0); assert.equal(queue.sample(undefined, 1).buttons.drop, false);
  queue.observe({}, 2); queue.sample(undefined, 3); queue.observe({ drop: true }, 4, { sequence: 7 });
  assert.equal(queue.cancel({ action: 'drop', seq: 7 }), true); queue.observe(emptyInput(), 5); assert.equal(queue.sample(undefined, 6).buttons.drop, false);
  const practice = createPracticeInputQueue(); practice.reset({ held: { slot4: true, drop: true }, neutral: true });
  assert.equal(practice.sample({ slot4: true, drop: true }).drop, false);
  practice.sample({}); const token = practice.press('drop'); assert.ok(token); assert.equal(practice.cancel(token), true); assert.equal(practice.sample({}).drop, undefined);
});

test('a simultaneous switch and physical trigger cannot produce a queued shot after the switch', () => {
  const state = fixture(), player = state.players[0], queue = createFpsInputQueue();
  player.inventory[2] = createInventoryGun('pistol'); refreshInventory(player);
  queue.observe({ ...emptyInput(player), slot3: true, fire: true }, 0);
  for (let index = 0; index < 6; index++) tick(state, queue.sample(undefined, index + 1).buttons);
  assert.equal(player.inventoryIndex, 2); assert.equal(player.shots, 0); assert.equal(player.ammo, 12);
  queue.observe(emptyInput(player), 8); tick(state, queue.sample(undefined, 9).buttons);
  queue.observe({ ...emptyInput(player), fire: true }, 10); tick(state, queue.sample(undefined, 11).buttons);
  assert.equal(player.shots, 1); assert.equal(player.ammo, 11);
});
