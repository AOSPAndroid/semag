import assert from 'node:assert/strict';
import test from 'node:test';
import { inventoryControlForKey, inventoryItemReadout, inventoryLootPresentation, inventorySlots, inventoryEventFeedback, inventorySwapPresentation } from '../public/voxel-inventory-ui.js';
import { initializeInventory, createInventoryGun, refreshInventory } from '../public/voxel-inventory.js';
import { createCombatPlayer, WEAPONS } from '../public/voxel-engine.js';
import { controlForKey, composeInput, aimFraction, combatReadout } from '../public/voxel-client.js';
import { controlForKey as royaleControl, combatReadout as royaleReadout, aimFraction as royaleAim } from '../public/voxel-royale-client.js';

test('four independent guns retain their own displayed ammunition and selected identity', () => {
  const own = createCombatPlayer(0);
  own.inventory = ['carbine', 'smg', 'sniper', 'shotgun'].map((weapon, index) => createInventoryGun(weapon, { ammo: index + 1, reserve: 10 + index }));
  own.inventoryIndex = 2; refreshInventory(own);
  const before = JSON.stringify(own), slots = inventorySlots(own);
  assert.equal(slots.length, 4); assert.deepEqual(slots.map(slot => slot.kind), Array(4).fill('weapon'));
  assert.deepEqual(slots.map(slot => slot.detail), ['1 / 10', '2 / 11', '3 / 12', '4 / 13']);
  assert.deepEqual(slots.filter(slot => slot.selected).map(slot => slot.index), [2]);
  assert.ok(slots.every(slot => slot.droppable)); assert.equal(JSON.stringify(own), before);
});

test('normal starter and Royale knife-only inventories expose four flexible slots', () => {
  const own = createCombatPlayer(0), normal = inventorySlots(own);
  assert.deepEqual(normal.map(slot => slot.kind), ['melee', 'weapon', 'heal', 'grenade']);
  assert.equal(normal[0].label, 'KNIFE'); assert.equal(normal[1].selected, true); assert.equal(normal[2].detail, '×1 / 2');
  initializeInventory(own, { knifeOnly: true });
  const royale = inventorySlots(own);
  assert.deepEqual(royale.map(slot => slot.kind), ['melee', 'empty', 'empty', 'empty']);
  assert.equal(royale[0].selected, true); assert.ok(royale.slice(1).every(slot => !slot.selected && !slot.droppable));
});

test('potion stacks display a limit of two per slot, independent of aggregate count', () => {
  const own = createCombatPlayer(0);
  own.inventory = [{ kind: 'heal', amount: 2 }, { kind: 'heal', amount: 1 }, { kind: 'grenade', amount: 2 }, null]; own.inventoryIndex = 0; refreshInventory(own);
  const slots = inventorySlots(own);
  assert.equal(own.potions, 3); assert.equal(slots[0].detail, '×2 / 2'); assert.equal(slots[1].detail, '×1 / 2');
  assert.equal(slots[2].detail, '×2 / 2'); assert.equal(slots[3].detail, 'FREE SLOT');
});

test('AZERTY physical digits, numpad and nearby X equip and drop in both FPS clients', () => {
  for (const [key, code, expected] of [['&', 'Digit1', 'slot1'], ['é', 'Digit2', 'slot2'], ['"', 'Digit3', 'slot3'], ["'", 'Digit4', 'slot4'], ['4', 'Numpad4', 'slot4'], ['X', 'KeyX', 'drop']]) {
    const event = { key, code, ctrlKey: true };
    assert.equal(inventoryControlForKey(event), expected); assert.equal(controlForKey(event, 'zqsd'), expected); assert.equal(royaleControl(event, 'zqsd'), expected);
  }
  assert.equal(inventoryControlForKey({ key: '5', code: 'Digit5' }), null);
  for (const control of [controlForKey, royaleControl]) {
    assert.equal(control({ key: 'x', isComposing: true }), null); assert.equal(control({ key: '1', defaultPrevented: true }), null);
    assert.equal(control({ key: 'g' }), 'grenade', 'legacy grenade alias stays intact');
  }
});

test('new inventory controls pass through compose and release with every other input', () => {
  const keys = new Set(['slot3', 'drop']), touch = { actions: new Set(['slot4']), move: { x: 0, y: 0 } }, mouse = { fire: true, aim: false };
  const input = composeInput(keys, touch, mouse, { yaw: .2, pitch: .1 });
  assert.equal(input.slot3, true); assert.equal(input.slot4, true); assert.equal(input.drop, true); assert.equal(input.fire, true);
  const released = composeInput(keys, touch, mouse, { yaw: .2, pitch: .1 }, false);
  for (const action of ['slot1', 'slot2', 'slot3', 'slot4', 'drop', 'fire']) assert.equal(released[action], false);
});

test('selected potions, grenades and empty hands never leak holstered gun ammo or sights', () => {
  const own = createCombatPlayer(0); own.aimTicks = 18; own.ammo = 9; own.reserve = 70;
  for (const [index, label, ammo] of [[2, 'HEALING POTION', '×1'], [3, 'FRAG GRENADE', '×1'], [0, 'EMPTY HANDS', '—']]) {
    if (!index) own.inventory[0] = null;
    own.inventoryIndex = index; refreshInventory(own);
    const expected = inventoryItemReadout(own);
    assert.equal(expected.label, label); assert.equal(expected.ammo, ammo); assert.equal(expected.reserve, '—');
    for (const readout of [combatReadout(own), royaleReadout(own)]) { assert.equal(readout.label, label); assert.equal(readout.ammo, ammo); assert.equal(readout.utility, true); assert.equal(readout.progress, null); }
    assert.equal(aimFraction(own), 0); assert.equal(royaleAim(own), 0);
  }
  assert.equal(inventoryItemReadout({ ...own, healTicks: 10 }), null, 'active drinking keeps the real healing progress');
});

test('pickup hints explain free slots, full packs and deliberate gun replacement', () => {
  const own = createCombatPlayer(0), loot = { id: 'gun', kind: 'weapon', weapon: 'sniper', ammo: 2, reserve: 8 };
  const before = JSON.stringify(own), replace = inventoryLootPresentation(loot, own);
  assert.equal(replace.name, WEAPONS.sniper.name); assert.match(replace.detail, /Replace .*Carbine.*slot 2.*2 \/ 8/);
  own.inventoryIndex = 0; refreshInventory(own);
  assert.match(inventoryLootPresentation(loot, own).detail, /Inventory full.*X/);
  own.inventory[3] = null; refreshInventory(own);
  assert.match(inventoryLootPresentation(loot, own).detail, /^Pick up.*2 \/ 8/);
  const snapshot = JSON.stringify(own); inventoryLootPresentation({ kind: 'heal', amount: 1 }, own); assert.equal(JSON.stringify(own), snapshot);
  assert.notEqual(JSON.stringify(own), before, 'only the deliberate fixture setup changed the player');
  assert.equal(inventoryLootPresentation({ kind: 'weapon', weapon: 'unknown' }, own), null); assert.equal(inventoryLootPresentation(loot, { ...own, alive: false }), null);
});

test('full-inventory and drop feedback stays explicit and only reports real events', () => {
  assert.match(inventoryEventFeedback({ type: 'inventoryFull' }), /INVENTORY FULL.*X TO DROP/);
  assert.match(inventoryEventFeedback({ type: 'inventoryDrop' }), /DROPPED.*E/);
  assert.match(inventoryEventFeedback({ type: 'inventoryEmpty' }), /EMPTY SLOT/);
  assert.equal(inventoryEventFeedback({ type: 'shot' }), null);
});

test('instant monster healing supplies stay distinct from carried potion stacks', () => {
  const own = createCombatPlayer(0); own.hp = 175;
  const before = JSON.stringify(own), supply = inventoryLootPresentation({ kind: 'heal', type: 'health', amount: 45 }, own);
  assert.equal(supply.name, 'Healing supply'); assert.equal(supply.detail, 'E TO RECOVER UP TO 25 HP'); assert.equal(supply.kind, 'health');
  assert.match(inventoryLootPresentation({ kind: 'heal', amount: 1 }, own).detail, /STACK TO 2/);
  assert.equal(JSON.stringify(own), before);
});

test('gun hints and swap labels name the carried knife or sword and never invent a dropped blade', () => {
  const own = createCombatPlayer(0), before = JSON.stringify(own);
  assert.equal(inventorySwapPresentation(own).label, 'KNIFE'); assert.equal(combatReadout(own).status, 'RMB AIM · V KNIFE');
  assert.equal(JSON.stringify(own), before, 'copy presentation cannot mutate ownership');
  initializeInventory(own, { melee: 'sword' });
  assert.equal(inventorySwapPresentation(own).label, 'SWORD'); assert.equal(combatReadout(own).status, 'RMB AIM · V SWORD');
  own.inventory[0] = null; refreshInventory(own);
  assert.equal(inventorySwapPresentation(own).label, 'NEXT'); assert.equal(combatReadout(own).status, 'RMB AIM · 1–4 EQUIP');
  own.inventory = ['carbine', 'smg', 'sniper', 'pdw'].map(weapon => createInventoryGun(weapon)); own.inventoryIndex = 0; refreshInventory(own);
  assert.equal(inventorySwapPresentation(own).ariaLabel, 'Cycle carried items'); assert.equal(combatReadout(own).status, 'RMB AIM · 1–4 EQUIP');
});

test('blade hints report a carried gun only when owned while bare legacy records stay unchanged', () => {
  const own = createCombatPlayer(0); own.inventoryIndex = 0; refreshInventory(own);
  assert.equal(inventorySwapPresentation(own).label, 'GUN'); assert.equal(combatReadout(own).status, 'LMB STRIKE · V GUN');
  initializeInventory(own, { knifeOnly: true });
  assert.equal(inventorySwapPresentation(own).label, 'KNIFE'); assert.match(inventorySwapPresentation(own).ariaLabel, /no other carried item/);
  assert.equal(combatReadout(own).status, 'LMB STRIKE · 1–4 EQUIP');
  const legacy = { weapon: 'carbine', slot: 'primary', grounded: true, ammo: 10, reserve: 20 };
  assert.equal(inventorySwapPresentation(legacy), null); assert.equal(combatReadout(legacy).status, 'RMB AIM · V SWORD');
  assert.equal(inventorySwapPresentation({ ...legacy, slot: 'sword', meleeWeapon: 'knife' }), null);
  assert.equal(combatReadout({ ...legacy, slot: 'sword', meleeWeapon: 'knife' }).status, 'LMB STRIKE · V GUN');
});
