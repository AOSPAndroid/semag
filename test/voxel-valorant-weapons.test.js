import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { WEAPONS, WEAPON_IDS, LEGACY_WEAPON_IDS, VALORANT_WEAPON_IDS, WEAPON_GROUPS, weaponDamage, weaponStats, weaponSpread, weaponAimFovRatio } from '../public/voxel-weapons.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ids = ['classic', 'shorty', 'frenzy', 'ghost', 'sheriff', 'bandit', 'stinger', 'spectre', 'bucky', 'judge', 'bulldog', 'guardian', 'phantom', 'vandal', 'warden', 'marshal', 'outlaw', 'operator', 'ares', 'odin'];

// Independently captured from release 863978c. The three original shotguns are
// intentionally rebalanced in 3.40.0; every other original contract stays fixed.
test('all 13 other original gun profiles and comparison contracts retain their baseline values', () => {
  const preserved = LEGACY_WEAPON_IDS.filter(id => !['shotgun', 'autoshotgun', 'slugshotgun'].includes(id));
  assert.equal(preserved.length, 13);
  assert.equal(hash(Object.fromEntries(preserved.map(id => [id, WEAPONS[id]]))), 'd3133b95d3c5e0df3a5549a616a84d7db1ae04b2a5696d094e99f6dee7f018b3');
  assert.equal(hash(preserved.map(id => weaponStats(id))), '4b67dd4e4a3f6eba96968d3a111c1020d9724f84072da473234f180897d13c56');
  assert.deepEqual(WEAPON_IDS.slice(0, 16), LEGACY_WEAPON_IDS);
});

test('the current official roster includes Bandit and Warden and each gun appears in one honest role', () => {
  assert.deepEqual(VALORANT_WEAPON_IDS, ids);
  assert.equal(WEAPON_IDS.length, 36);
  assert.equal(new Set(WEAPON_IDS).size, 36);
  assert.deepEqual(WEAPON_GROUPS.flatMap(group => group.ids), [...ids, ...LEGACY_WEAPON_IDS]);
  for (const id of ids) {
    const gun = WEAPONS[id];
    assert.equal(gun.id, id); assert.equal(gun.model, id);
    assert.equal(gun.collection, 'valorant'); assert.equal(gun.valorant, true);
    assert.ok(['low', 'medium', 'high'].includes(gun.wallPenetration));
    for (const field of ['magazine', 'reserve', 'reloadTicks', 'cooldown', 'equipTicks']) assert.ok(Number.isInteger(gun[field]) && gun[field] > 0, `${id}.${field}`);
    close(120 / gun.fireIntervalTicks, gun.fireRate);
    assert.ok(Number.isFinite(weaponSpread(id, { motion: 1, grounded: false, heat: 8, ads: 1 })));
    assert.ok(weaponAimFovRatio(id) >= .2 && weaponAimFovRatio(id) <= 1);
  }
  assert.equal(WEAPONS.warden.name, 'Warden');
  assert.equal(WEAPONS.shotgun.name, 'Warden Shotgun', 'legacy identity remains distinct');
});

// Values below are reference fixtures from Riot changes and the checked 13.06 API,
// expressed independently of the catalogue's JSON layout.
const reference = {
  classic: [[0, 78, 26, 22.1], [30, 66, 22, 18.7]],
  shorty: [[0, 22, 11, 9.35], [7, 12, 6, 5.1], [15, 6, 3, 2.55]],
  frenzy: [[0, 78, 26, 22.1], [20, 63, 21, 17.85]],
  ghost: [[0, 105, 30, 25.5], [30, 87.5, 25, 21.25]],
  sheriff: [[0, 159.5, 55, 46.75], [30, 145, 50, 42.5]],
  bandit: [[0, 152, 39, 33], [10, 128, 39, 33], [30, 112, 34, 28]],
  stinger: [[0, 67.5, 27, 22.95], [15, 57, 23, 19]],
  spectre: [[0, 78, 26, 22.1], [15, 66, 22, 18.7], [30, 60, 20, 17]],
  bucky: [[0, 34, 17, 14], [8, 26, 13, 11.05], [12, 18, 9, 7.65]],
  judge: [[0, 34, 17, 14.45], [10, 20, 10, 8.5], [15, 14, 7, 5.95]],
  bulldog: [[0, 115.5, 35, 29.75]], guardian: [[0, 195, 65, 48.75]],
  phantom: [[0, 156, 39, 33.15], [20, 140, 35, 29.75]],
  vandal: [[0, 160, 40, 34]], warden: [[0, 200, 50, 42]],
  marshal: [[0, 202, 101, 85.85]], outlaw: [[0, 238, 140, 119]],
  operator: [[0, 255, 150, 120]], ares: [[0, 75, 30, 25.5], [30, 70, 28, 23.8]],
  odin: [[0, 95, 38, 32.3], [30, 77.5, 31, 26.35]],
};

test('actual head, body and leg contacts follow every researched step boundary without linear interpolation', () => {
  for (const [id, bands] of Object.entries(reference)) {
    for (let index = 0; index < bands.length; index++) {
      const [start, head, body, leg] = bands[index], end = bands[index + 1]?.[0] ?? 200;
      for (const distance of [start, start + .001, (start + end) / 2, end - .001]) {
        close(weaponDamage(id, 'head', distance), head);
        close(weaponDamage(id, 'body', distance), body);
        close(weaponDamage(id, 'leg', distance), leg);
      }
    }
    assert.equal(weaponDamage(id, 'unknown', 0), bands[0][2]);
    assert.equal(weaponDamage(id, 'body', -10), bands[0][2]);
    assert.equal(weaponDamage(id, 'body', 1000), bands.at(-1)[2]);
  }
  assert.equal(weaponDamage('bandit', 'head', 10), 128, 'head-only band cannot be derived from one multiplier');
  assert.equal(weaponDamage('phantom', 'body', 20), 35, 'old 15/30 metre Phantom falloff must not return');
  assert.equal(weaponDamage('bucky', 'body', 0), 17, '12.09 nerf must not revert to 20 per pellet');
});

test('range metadata and comparison values use actual contact damage, including exact decimals', () => {
  assert.equal(weaponStats('phantom').falloffStart, 20);
  assert.equal(weaponStats('spectre').falloffStart, 15);
  assert.equal(weaponStats('spectre').falloffEnd, 30);
  assert.equal(weaponStats('vandal').falloffStart, null);
  for (const id of ids) {
    const stats = weaponStats(id), gun = WEAPONS[id];
    close(stats.shotsPerSecond, gun.fireRate);
    close(stats.head, reference[id][0][1]); close(stats.body, reference[id][0][2]); close(stats.leg, reference[id][0][3]);
    assert.equal(stats.damagePerPellet, (gun.pellets || 1) > 1);
    assert.equal(stats.damageBands, gun.damageBands);
    close(stats.reloadSeconds, gun.reloadTicks / 120);
  }
});

test('all nested gun facts, firing variants and presentation data are immutable', () => {
  const assertFrozen = (value, path) => {
    if (!value || typeof value !== 'object') return;
    assert.ok(Object.isFrozen(value), path);
    for (const [key, child] of Object.entries(value)) assertFrozen(child, `${path}.${key}`);
  };
  for (const id of ids) assertFrozen(WEAPONS[id], id);
  assertFrozen(WEAPON_GROUPS, 'groups');
  assert.throws(() => { WEAPONS.phantom.damageBands[0].body = 999; }, TypeError);
  assert.throws(() => { WEAPONS.classic.alternateFire.count = 99; }, TypeError);
  assert.throws(() => { WEAPONS.warden.modelFeatures.scope = false; }, TypeError);
});

test('distinct researched alternate modes cannot collapse into renamed legacy gun profiles', () => {
  assert.equal(WEAPONS.classic.alternateFire.mode, 'volley');
  assert.equal(WEAPONS.classic.alternateFire.count, 3);
  assert.equal(WEAPONS.classic.pellets, undefined, 'three bullets spend three rounds, not one shotgun shell');
  close(120 / WEAPONS.classic.alternateFire.cooldown, 2.22);
  assert.equal(WEAPONS.bucky.pellets, 15);
  assert.equal(WEAPONS.bucky.alternateFire.mode, 'airburst');
  assert.equal(WEAPONS.bucky.alternateFire.count, 5);
  assert.equal(WEAPONS.bucky.alternateFire.burstDistance, 7.5);
  assert.equal(WEAPONS.shorty.pellets, 15); assert.equal(WEAPONS.judge.pellets, 12);
  for (const [id, count, rate] of [['stinger', 4, 8.470589], ['bulldog', 3, 6.315715]]) {
    const burst = WEAPONS[id].adsBurst;
    assert.equal(WEAPONS[id].mode, 'auto'); assert.equal(burst.count, count);
    close(120 * count / ((count - 1) * burst.intervalTicks + burst.recoveryTicks), rate);
  }
  assert.equal(WEAPONS.ares.spinupTicks, undefined, 'Ares has no inherited Bastion wind-up');
  close(120 / WEAPONS.odin.fireRamp.startCooldownTicks, 12);
  close(120 / WEAPONS.odin.fireRamp.endCooldownTicks, 15.6);
  close(120 / WEAPONS.odin.fireRamp.adsCooldownTicks, 15.6);
  assert.equal(WEAPONS.outlaw.magazine, 2);
  assert.equal(WEAPONS.outlaw.reloadTicks, 276); assert.equal(WEAPONS.outlaw.emptyReloadTicks, 456);
});

test('official ammo corrections, optics and suppression remain distinct', () => {
  for (const [id, reserve] of [['shorty', 6], ['bandit', 24], ['phantom', 60], ['vandal', 50], ['warden', 36]]) assert.equal(WEAPONS[id].reserve, reserve);
  for (const id of ['ghost', 'spectre', 'phantom']) {
    assert.equal(WEAPONS[id].suppressed, true);
    assert.ok(WEAPONS[id].effects.muzzleStrength < WEAPONS.vandal.effects.muzzleStrength);
    assert.ok(WEAPONS[id].sound.noiseVolume < WEAPONS.vandal.sound.noiseVolume);
  }
  assert.equal(WEAPONS.warden.scoped, true); assert.equal(WEAPONS.warden.zoomMultiplier, 2);
  assert.equal(WEAPONS.guardian.zoomMultiplier, 1.5);
  assert.equal(WEAPONS.marshal.zoomMultiplier, 3.5);
  assert.ok(WEAPONS.marshal.adsSpeed > WEAPONS.marshal.speed, 'source scoped movement differs from a universal slowdown');
  assert.ok(weaponAimFovRatio('warden') < weaponAimFovRatio('vandal'));
  assert.ok(weaponSpread('operator', { ads: 1 }) < weaponSpread('operator', { ads: 0 }));
  assert.equal(weaponDamage('__proto__'), 0); assert.equal(weaponStats('toString'), null);
});
