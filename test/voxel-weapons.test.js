import assert from 'node:assert/strict';
import test from 'node:test';
import { WEAPONS, WEAPON_IDS, weaponAimFovRatio, weaponDamage, weaponSpread } from '../public/voxel-weapons.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);

test('loadout order remains stable, with four distinct finite roles after the existing nine', () => {
  assert.deepEqual(WEAPON_IDS.slice(0, 16), ['carbine', 'smg', 'marksman', 'pistol', 'shotgun', 'burst', 'sniper', 'lmg', 'crossbow', 'revolver', 'pdw', 'autoshotgun', 'battlerifle', 'dualpistols', 'dualsmg', 'slugshotgun']);
  assert.ok(Object.isFrozen(WEAPON_IDS));
  assert.ok(Object.isFrozen(WEAPONS));
  for (const id of WEAPON_IDS) {
    const weapon = WEAPONS[id];
    assert.equal(weapon.id, id);
    assert.ok(Object.isFrozen(weapon));
    for (const field of ['magazine', 'reserve', 'damage', 'cooldown', 'reloadTicks', 'range', 'speed']) assert.ok(Number.isFinite(weapon[field]) && weapon[field] > 0, `${id}.${field}`);
    for (const field of ['magazine', 'reserve', 'cooldown', 'reloadTicks']) assert.ok(Number.isInteger(weapon[field]), `${id}.${field} uses discrete ticks or rounds`);
  }
  assert.equal(WEAPONS.sniper.mode, 'bolt');
  assert.equal(WEAPONS.lmg.mode, 'auto');
  assert.equal(WEAPONS.crossbow.projectile, true);
  assert.equal(WEAPONS.crossbow.magazine, 1);
});

test('original SMG and rebalanced shotgun retain exact falloff, rounding and head contacts', () => {
  for (const id of WEAPON_IDS.slice(0, 6)) for (const distance of [0, 8, 10, 20, 24, 35, 70, 100]) for (const kind of ['body', 'head']) {
    const weapon = WEAPONS[id];
    const falloff = id === 'smg' ? Math.max(.65, Math.min(1, 1 - Math.max(0, distance - 20) / 70)) : id === 'shotgun' ? Math.max(.25, Math.min(1, 1 - Math.max(0, distance - 8) / 24)) : 1;
    assert.equal(weaponDamage(id, kind, distance), Math.round(weapon.damage * (kind === 'head' ? weapon.headMultiplier : 1) * falloff));
  }
  assert.equal(weaponDamage('smg', 'body', 20), 20);
  assert.equal(weaponDamage('smg', 'body', 100), 13);
  assert.equal(weaponDamage('shotgun', 'body', 8), 28);
  assert.equal(weaponDamage('shotgun', 'body', 100), 7);
  assert.ok(Object.isFrozen(WEAPONS.smg.falloff));
});

test('new damage rewards head accuracy without turning the crossbow into a body-shot kill', () => {
  assert.equal(weaponDamage('sniper', 'body', 35), 100);
  assert.equal(weaponDamage('sniper', 'head', 35), 200);
  assert.equal(weaponDamage('crossbow', 'body', 35), 75);
  assert.equal(weaponDamage('crossbow', 'head', 35), 150);
  assert.equal(weaponDamage('lmg', 'body', 10), 26);
  assert.equal(weaponDamage('lmg', 'head', 10), 59);
  assert.equal(weaponDamage('__proto__'), 0);
  assert.equal(weaponDamage(null), 0);
  assert.equal(weaponDamage({ damage: NaN }), 0);
});

test('old movement, airborne, heat and ADS spread match the engine formula exactly', () => {
  for (const id of WEAPON_IDS.slice(0, 6)) for (const motion of [0, .4, 1]) for (const grounded of [true, false]) for (const heat of [0, 3, 12]) for (const ads of [0, .5, 1]) {
    const weapon = WEAPONS[id];
    const expected = (motion * weapon.movingSpread + (grounded ? 0 : weapon.airborneSpread) + Math.min(8, heat) * weapon.bloom) * (1 - ads * (1 - .4));
    close(weaponSpread(id, { motion, grounded, heat, ads }), expected);
  }
  close(weaponSpread('carbine', { motion: 1, ads: 1 }, { spreadMultiplier: .2 }), WEAPONS.carbine.movingSpread * .2);
});

test('sniper accuracy transitions through the scope and still penalizes jumping and movement', () => {
  close(weaponSpread('sniper'), .085);
  close(weaponSpread('sniper', { ads: .5 }), (.085 + .0015) / 2);
  close(weaponSpread('sniper', { ads: 1 }), .0015);
  assert.ok(weaponSpread('sniper') > 50 * weaponSpread('sniper', { ads: 1 }));
  assert.ok(weaponSpread('sniper', { ads: 1, motion: 1 }) > weaponSpread('sniper', { ads: 1 }));
  assert.ok(weaponSpread('sniper', { ads: 1, grounded: false }) > weaponSpread('sniper', { ads: 1, motion: 1 }));
  assert.ok(Number.isFinite(weaponSpread('sniper', { motion: NaN, heat: Infinity, ads: Infinity })));
  assert.equal(weaponSpread('unknown'), 0);
});

test('LMG exchanges opening speed, movement and reload time for sustained fire capacity', () => {
  assert.equal(WEAPONS.lmg.spinupTicks, 24);
  assert.ok(WEAPONS.lmg.magazine >= WEAPONS.carbine.magazine * 2);
  assert.ok(WEAPONS.lmg.speed < WEAPONS.carbine.speed);
  assert.ok(WEAPONS.lmg.reloadTicks > WEAPONS.carbine.reloadTicks);
  assert.ok(WEAPONS.lmg.damage * 120 / WEAPONS.lmg.cooldown < WEAPONS.carbine.damage * 120 / WEAPONS.carbine.cooldown);
  assert.ok(WEAPONS.lmg.bloom < WEAPONS.carbine.bloom);
  assert.ok(weaponSpread('lmg', { heat: 8 }) > weaponSpread('lmg', { heat: 0 }));
});

test('crossbow catalog defines readable travel and drop before its finite expiry', () => {
  const weapon = WEAPONS.crossbow, distance = 30, seconds = distance / weapon.projectileSpeed;
  close(seconds, .625);
  close(.5 * weapon.projectileGravity * seconds * seconds, 1.7578125);
  assert.equal(weapon.projectileTicks, 240);
  assert.ok(seconds < weapon.projectileTicks / 120);
  assert.ok(weapon.reloadTicks > weapon.cooldown, 'one loaded bolt requires a deliberate manual reload');
});

test('weapon optics provide the same zoom ratio for camera and look, including ADS rule overrides', () => {
  close(weaponAimFovRatio('carbine'), 54 / 70);
  close(weaponAimFovRatio('marksman'), 40 / 70);
  close(weaponAimFovRatio('sniper'), 32 / 70);
  assert.equal(WEAPONS.marksman.scoped, true);
  assert.equal(WEAPONS.sniper.scoped, true);
  assert.ok(weaponAimFovRatio('sniper') < weaponAimFovRatio('marksman'));
  close(weaponAimFovRatio('marksman', { scopedFovRatio: .5 }), .5);
  close(weaponAimFovRatio('sniper', { scopedFovRatio: .5 }), .4);
  close(weaponAimFovRatio('smg', { fovRatio: .6 }), .6);
  close(weaponAimFovRatio('__proto__'), 54 / 70);
  assert.ok(Number.isFinite(weaponAimFovRatio('sniper', { scopedFovRatio: NaN })));
});
