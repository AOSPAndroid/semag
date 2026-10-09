import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, LEGACY_WEAPON_IDS, weaponDamage, weaponStats } from '../../../public/voxel-weapons.js';
import { MELEE_WEAPONS } from '../../../public/voxel-melee.js';
import { createArmoryEntries, categoriesFor, filterArmoryEntries, weaponCategory } from './catalog.js';

const selectFor = (ids, catalog = WEAPONS) => ({
  disabled: false,
  options: ids.map(id => ({ value: id, textContent: catalog[id]?.name || id, disabled: false })),
});
const statFor = (entry, label) => entry.stats.find(stat => stat.label === label);

test('every gun belongs to exactly one role, retaining researched categories', () => {
  const expectedLegacy = {
    carbine: 'rifle', smg: 'smg', marksman: 'sniper', pistol: 'sidearm', shotgun: 'shotgun',
    burst: 'rifle', sniper: 'sniper', lmg: 'heavy', crossbow: 'special', revolver: 'sidearm',
    pdw: 'smg', autoshotgun: 'shotgun', battlerifle: 'rifle', dualpistols: 'sidearm',
    dualsmg: 'smg', slugshotgun: 'shotgun',
  };
  assert.deepEqual(new Set(Object.keys(expectedLegacy)), new Set(LEGACY_WEAPON_IDS));
  for (const weapon of Object.values(WEAPONS)) {
    assert.equal(weaponCategory(weapon), weapon.category || expectedLegacy[weapon.id]);
    assert.equal(weaponCategory(weapon.id), weaponCategory(weapon));
    assert.notEqual(weaponCategory(weapon), 'all');
  }
  const entries = createArmoryEntries(selectFor(Object.keys(WEAPONS)));
  assert.equal(entries.length, 36);
  const categories = categoriesFor(entries);
  assert.equal(categories[0].count, 36);
  assert.equal(categories.slice(1).reduce((sum, category) => sum + category.count, 0), 36);
});

test('metadata is limited to native options and unknown choices retain their names', () => {
  const select = selectFor(['vandal', 'sword of tomorrow', 'vandal']);
  select.options[1].textContent = 'Future Prototype';
  select.options[1].parentElement = { tagName: 'OPTGROUP', disabled: true };
  select.options.unshift({ value: '', textContent: 'Choose a weapon' });
  const entries = createArmoryEntries(select);
  assert.deepEqual(entries.map(entry => entry.id), ['vandal', 'sword of tomorrow']);
  assert.strictEqual(entries[0].weapon, WEAPONS.vandal);
  assert.equal(entries[0].image, 'art/armory/vandal.webp');
  assert.equal(entries[1].name, 'Future Prototype');
  assert.equal(entries[1].label, 'Future Prototype');
  assert.equal(entries[1].disabled, true);
  assert.equal(entries[1].weapon, null);
  assert.deepEqual(entries[1].stats, []);
  assert.equal(entries[1].description, '');
  assert.deepEqual(categoriesFor(entries).map(category => category.id), ['all', 'rifle', 'special']);
  assert.deepEqual(createArmoryEntries(null), []);
  assert.equal(weaponCategory('constructor'), 'special');
  assert.equal(weaponCategory('__proto__'), 'special');
});

test('gun stat rows use authoritative damage, pellet counts and effective cadence', () => {
  const entries = createArmoryEntries(selectFor(['shotgun', 'shorty', 'burst', 'crossbow', 'stinger']));
  for (const entry of entries) {
    const sourceStats = weaponStats(entry.weapon);
    assert.equal(entry.stats.length, 4);
    assert.equal(statFor(entry, 'Damage').value, String(weaponDamage(entry.weapon, 'body', 0)));
    assert.equal(statFor(entry, 'Fire rate').value, sourceStats.fireRateLabel);
    assert.equal(statFor(entry, 'Reload').value, `${sourceStats.reloadSeconds.toFixed(2)} s`);
  }
  assert.equal(statFor(entries[0], 'Damage').value, '28');
  assert.match(statFor(entries[0], 'Damage').note, /per pellet.*8 pellets per shell/);
  assert.match(statFor(entries[1], 'Damage').note, /15 pellets per shell/);
  assert.equal(statFor(entries[2], 'Fire rate').value, '3-round burst · 6.2 shots/s');
  assert.equal(statFor(entries[3], 'Fire rate').value, '0.6 shots/s · per press');
  assert.match(statFor(entries[3], 'Fire rate').note, /reload/);
});

test('melee metadata uses complete primary swing timing and authored reach', () => {
  const entries = createArmoryEntries(selectFor(Object.keys(MELEE_WEAPONS), MELEE_WEAPONS), 'melee');
  assert.deepEqual(categoriesFor(entries, 'melee').map(({ id, count }) => ({ id, count })), [
    { id: 'all', count: 5 }, { id: 'blades', count: 3 }, { id: 'impact', count: 2 },
  ]);
  for (const entry of entries) {
    const weapon = MELEE_WEAPONS[entry.id];
    assert.strictEqual(entry.weapon, weapon);
    assert.equal(entry.image, `art/armory/melee_${entry.id}.webp`);
    assert.equal(statFor(entry, 'Damage').value, String(weapon.damage));
    assert.equal(statFor(entry, 'Reach').value, `${weapon.reach} m`);
    assert.equal(statFor(entry, 'Wind-up').value, `${(weapon.startupTicks / 120).toFixed(2)} s`);
    assert.equal(statFor(entry, 'Swing').value, `${((weapon.startupTicks + weapon.activeTicks + weapon.recoveryTicks) / 120).toFixed(2)} s`);
  }
});

test('category and case-insensitive multiword search compose without mutation', () => {
  const entries = createArmoryEntries(selectFor(['smg', 'dualsmg', 'pistol', 'crossbow']));
  const before = entries.map(entry => entry.id);
  assert.deepEqual(filterArmoryEntries(entries, 'smg', '  TWIN swift  ').map(entry => entry.id), ['dualsmg']);
  assert.deepEqual(filterArmoryEntries(entries, 'all', 'flying bolt').map(entry => entry.id), ['crossbow']);
  assert.deepEqual(filterArmoryEntries(entries, 'sidearm', 'swift'), []);
  assert.deepEqual(filterArmoryEntries(entries, 'all', '  ').map(entry => entry.id), before);
  assert.deepEqual(entries.map(entry => entry.id), before);
});
