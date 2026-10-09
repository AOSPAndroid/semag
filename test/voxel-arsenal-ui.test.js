import assert from 'node:assert/strict';
import test from 'node:test';
import { inventorySlots, inventoryLootPresentation, inventorySwapPresentation } from '../public/voxel-inventory-ui.js';
import { initializeInventory, refreshInventory } from '../public/voxel-inventory.js';
import { MELEE_WEAPONS, MELEE_IDS } from '../public/voxel-melee.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { createCombatPlayer } from '../public/voxel-engine.js';
import { createPractice, startPractice } from '../public/voxel-practice-engine.js';
import { meleeLoadoutNote, validHordeSettings } from '../public/hub/horde-setup.js';

test('every carried blade has its own catalog label, icon and truthful swap destination', () => {
  for (const id of MELEE_IDS) {
    const player = createCombatPlayer(0); initializeInventory(player, { melee: id, potions: 1, grenades: 1 });
    const before = JSON.stringify(player), slot = inventorySlots(player)[0], blade = MELEE_WEAPONS[id];
    assert.equal(slot.name, blade.name); assert.equal(slot.label, blade.label); assert.equal(slot.icon, id);
    assert.equal(inventorySwapPresentation(player).label, blade.label);
    player.inventoryIndex = 0; refreshInventory(player);
    assert.equal(inventorySwapPresentation(player).label, 'GUN');
    const pickup = inventoryLootPresentation({ id: `blade-${id}`, kind: 'melee', weapon: id }, player);
    assert.equal(pickup.name, blade.name); assert.ok(pickup.detail.includes(`Replace ${blade.name} · slot 1`));
    player.inventoryIndex = 1; refreshInventory(player);
    assert.match(inventoryLootPresentation({ kind: 'melee', weapon: id }, player).detail, /Inventory full.*X/);
    player.inventory[1] = null; refreshInventory(player);
    assert.equal(inventorySwapPresentation(player).label, blade.label);
    assert.ok(inventorySwapPresentation(player).ariaLabel.includes(blade.label.toLowerCase()));
    assert.notEqual(JSON.stringify(player), before, 'only explicit fixture equipment changes ownership');
  }
});

test('dual guns display one combined magazine each and use distinct paired silhouettes', () => {
  const player = createCombatPlayer(0);
  player.inventory = ['dualpistols', 'dualsmg', 'slugshotgun', 'carbine'].map((weapon, index) => ({ kind: 'weapon', weapon, ammo: index + 1, reserve: index + 9 }));
  player.inventoryIndex = 1; refreshInventory(player);
  const before = JSON.stringify(player), slots = inventorySlots(player);
  assert.deepEqual(slots.map(slot => slot.label), ['DUAL PISTOLS', 'DUAL SMGS', WEAPONS.slugshotgun.label, 'CARBINE']);
  assert.deepEqual(slots.map(slot => slot.icon), ['dualpistols', 'dualsmg', 'slugshotgun', 'carbine']);
  assert.deepEqual(slots.map(slot => slot.detail), ['1 / 9', '2 / 10', '3 / 11', '4 / 12']);
  assert.equal(slots[1].selected, true); assert.equal(JSON.stringify(player), before);
});

test('close-combat comparisons use catalog damage, reach and all phases of a committed swing', () => {
  for (const id of MELEE_IDS) {
    const blade = MELEE_WEAPONS[id], note = meleeLoadoutNote(id);
    const cycle = Number(((blade.startupTicks + blade.activeTicks + blade.recoveryTicks) / 120).toFixed(2));
    assert.ok(note.includes(`${blade.damage} base damage`)); assert.ok(note.includes(`${blade.reach} m reach`));
    assert.ok(note.includes(`${Number((blade.startupTicks / 120).toFixed(2))} s wind-up`));
    assert.ok(note.includes(`${cycle} s full swing`)); assert.equal(note.includes('undefined'), false);
    assert.equal(validHordeSettings('courtyard', 'veteran', 3, id), id === 'knife', 'stronger blades are loot, never starter choices');
  }
  for (const invalid of ['__proto__', 'unknown', '', null, {}, 1]) {
    assert.equal(meleeLoadoutNote(invalid), ''); assert.equal(validHordeSettings('courtyard', 'veteran', 3, invalid), false);
    assert.equal(inventoryLootPresentation({ kind: 'melee', weapon: invalid }, { alive: true }), null);
  }
});

test('Breach practice starts and restarts with a fixed knife and chosen gun; bots keep their default gear', () => {
  for (const melee of MELEE_IDS) {
    const state = createPractice({ game: 'voxel', mode: 'targets', bots: 1, weapon: 'dualpistols', melee, seed: 99 });
    assert.equal(state.phase, 'ready'); assert.equal(state.practice.config.melee, 'knife');
    for (let run = 0; run < 2; run++) {
      startPractice(state);
      assert.equal(state.players[0].inventory[0].weapon, 'knife'); assert.equal(state.players[0].inventory[1].weapon, 'dualpistols');
      assert.equal(state.players[0].potions+state.players[0].grenades,0);assert.deepEqual(state.players[0].inventory.slice(2),[null,null]);
      assert.equal(state.players[0].inventoryIndex, 1); assert.equal(state.players[1].inventory[0].weapon, 'knife');
      state.phase = 'matchEnd';
    }
  }
  assert.equal(createPractice({ bots: 1, seed: 99 }).practice.config.melee, 'knife');
  for (const melee of ['__proto__', 'missing', 99, {}]) {
    assert.throws(() => createPractice({ bots: 1, melee, seed: 99 }), /close-combat weapon/);
  }
});

test('Royale practice retains its honest knife-only scavenging start even with a valid blade preference', () => {
  const state = createPractice({ game: 'voxel-royale', melee: 'axe', bots: 1, seed: 123 });
  assert.equal(state.practice.config.melee, 'knife'); startPractice(state);
  assert.equal(state.players[0].inventory[0].weapon, 'knife'); assert.equal(state.players[0].inventory.filter(Boolean).length, 1);
});
