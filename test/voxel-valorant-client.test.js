import assert from 'node:assert/strict';
import test from 'node:test';
import { WEAPONS, VALORANT_WEAPON_IDS, LEGACY_WEAPON_IDS, WEAPON_IDS, weaponDamage } from '../public/voxel-weapons.js';
import { combatReadout, loadoutForKey, weaponComparison, weaponCrosshairSpread, weaponDamageRows, weaponLoadoutGroups } from '../public/voxel-client.js';
import { combatReadout as royaleReadout } from '../public/voxel-royale-client.js';
import { inventoryControlForKey, inventorySlots, weaponInventoryIconPath } from '../public/voxel-inventory-ui.js';

const player = (weapon, extra = {}) => ({ weapon, hasGun: true, slot: 'primary', alive: true, grounded: true,
  hp: 200, maxHp: 200, ammo: WEAPONS[weapon].magazine, reserve: WEAPONS[weapon].reserve, previousInput: {}, ...extra });

test('grouped loadouts cover the researched collection first and preserve every original weapon', () => {
  const groups = weaponLoadoutGroups(); const ids = groups.flatMap(group => group.ids);
  assert.deepEqual(groups.map(group => group.id), ['sidearm', 'smg', 'shotgun', 'rifle', 'sniper', 'heavy', 'legacy']);
  assert.deepEqual(groups.at(-1).ids, LEGACY_WEAPON_IDS);
  assert.deepEqual(ids.slice(0, VALORANT_WEAPON_IDS.length).sort(), [...VALORANT_WEAPON_IDS].sort());
  assert.equal(ids.length, WEAPON_IDS.length); assert.equal(new Set(ids).size, WEAPON_IDS.length);
  groups[0].ids.pop(); assert.equal(weaponLoadoutGroups()[0].ids.length, 6, 'presentation arrays cannot edit the catalog');
});

test('range comparison uses the contact damage exactly at every authored boundary', () => {
  for (const id of VALORANT_WEAPON_IDS) {
    const rows = weaponDamageRows(id); assert.equal(rows.length, WEAPONS[id].damageBands.length);
    for (const row of rows) for (const zone of ['head', 'body', 'leg']) assert.equal(row[zone], weaponDamage(id, zone, row.distance), `${id}/${zone}/${row.distance}`);
    const card = weaponComparison(id); assert.equal(card.magazine, WEAPONS[id].magazine);
    assert.equal(card.far.body, rows.at(-1).body); assert.ok(card.handling);
  }
  assert.deepEqual(weaponDamageRows('phantom').map(row => [row.distance, row.head, row.body]), [[0, 156, 39], [20, 140, 35]]);
  assert.equal(weaponComparison('vandal').far.head, 160);
  assert.equal(weaponComparison('invalid'), null);
});

test('comparison explains alternate attacks, exact firing rates and the empty Outlaw reload', () => {
  assert.match(weaponComparison('classic').handling, /RMB 3-round burst.*up to 3 rounds/);
  assert.match(weaponComparison('bucky').handling, /7.5 m.*5 pellets.*1 shell/);
  assert.match(weaponComparison('stinger').handling, /ADS 4-shot bursts/);
  assert.match(weaponComparison('bulldog').handling, /ADS 3-shot bursts/);
  assert.equal(weaponComparison('phantom').rate, '11 shots/s');
  assert.equal(weaponComparison('classic').rate, '6.75 shots/s · per press');
  assert.equal(weaponComparison('outlaw').reloadDetail, '2.30 s partial · 3.80 s empty');
  assert.match(weaponComparison('odin').rate, /12.*15.6/);
  assert.match(weaponComparison('crossbow').handling, /48 m\/s.*9 m\/s²/);
  assert.match(weaponComparison('dualsmg').handling, /Alternating barrels.*close-range spread/);
});

test('setup grouping leaves French physical inventory slots and legacy shortcuts intact', () => {
  for (let index = 1; index <= 4; index++) {
    assert.equal(inventoryControlForKey({ code: `Digit${index}`, key: ['&', 'é', '"', "'"][index - 1] }), `slot${index}`);
    assert.equal(loadoutForKey({ code: `Digit${index}` }, 'buy'), LEGACY_WEAPON_IDS[index - 1]);
    assert.equal(loadoutForKey({ code: `Digit${index}` }, 'fight'), null);
  }
});

test('gun readout distinguishes accepted Classic and Bucky secondary attacks from ADS', () => {
  for (const readout of [value => combatReadout(value), value => royaleReadout(value)]) {
    assert.match(readout(player('classic', { previousInput: { aim: true }, ammo: 2 })).status, /RMB BURST.*2 ROUNDS/);
    assert.match(readout(player('bucky', { previousInput: { aim: true } })).status, /AIRBURST.*7.5M/);
    assert.match(readout(player('stinger', { previousInput: { aim: true } })).status, /ADS 4-SHOT BURST/);
    assert.match(readout(player('bulldog', { previousInput: { aim: true } })).status, /ADS 3-SHOT BURST/);
    assert.equal(readout(player('stinger', { burstRemaining: 2, previousInput: { aim: false } })).status, 'BURST FIRING');
    assert.match(readout(player('stinger', { shotCooldown: 20, previousInput: { aim: true } })).status, /BURST RECOVERY/);
    for (const id of ['frenzy', 'judge']) assert.equal(readout(player(id)).status, 'HOLD FIRE · HIP FIRE');
    assert.doesNotMatch(readout(player('classic')).status, /RMB AIM/);
  }
});

test('Outlaw reload progress follows its longer empty-magazine commitment in both multiplayer HUDs', () => {
  for (const readout of [value => combatReadout(value), value => royaleReadout(value)]) {
    const empty = readout(player('outlaw', { ammo: 0, reloadTicks: 228 }));
    assert.equal(empty.progress.total, 456); assert.equal(empty.progress.percent, 50);
    const partial = readout(player('outlaw', { ammo: 1, reloadTicks: 138 }));
    assert.equal(partial.progress.total, 276); assert.equal(partial.progress.percent, 50);
  }
});

test('all catalog guns have distinct hotbar silhouettes without changing their stored ammunition', () => {
  const paths = WEAPON_IDS.map(id => weaponInventoryIconPath(id));
  assert.equal(new Set(paths).size, WEAPON_IDS.length);
  for (const id of WEAPON_IDS) {
    assert.match(weaponInventoryIconPath(id), /^M/);
    const record = { inventoryIndex: 0, inventory: [{ kind: 'weapon', weapon: id, ammo: 3, reserve: 7 }] };
    const before = structuredClone(record), slots = inventorySlots(record);
    assert.equal(slots[0].icon, id); assert.equal(slots[0].detail, '3 / 7'); assert.equal(slots.length, 4);
    assert.deepEqual(record, before);
  }
});

test('crosshair presentation is finite for every gun and expands for the Classic volley', () => {
  for (const id of WEAPON_IDS) {
    for (const aim of [false, true]) assert.ok(Number.isFinite(weaponCrosshairSpread(player(id, { aimTicks: aim ? 18 : 0, previousInput: { aim }, heat: 3 }))));
  }
  assert.ok(weaponCrosshairSpread(player('classic', { previousInput: { aim: true } })) > weaponCrosshairSpread(player('classic')));
  assert.equal(weaponCrosshairSpread(player('vandal', { slot: 'sword' })), 0);
});
