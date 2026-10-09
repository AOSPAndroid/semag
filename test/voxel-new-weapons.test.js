import test from 'node:test';
import assert from 'node:assert/strict';
import { combatStep, createCombatPlayer, createState, emptyInput, eyeHeight, ADS } from '../public/voxel-engine.js';
import { WEAPONS, WEAPON_IDS, weaponDamage, weaponSpread, weaponStats } from '../public/voxel-weapons.js';
import { VOXEL_SHOT_AUDIO, createVoxelShotSamples } from '../public/voxel-shot-audio.js';
import { createWeaponShotPresenter, weaponShotPose } from '../public/voxel-first-person-motion.js';

const NEW_GUNS = ['revolver', 'pdw', 'autoshotgun', 'battlerifle'];
const floor = { id: 'floor', x: -100, y: -1, z: -100, w: 200, h: 1, d: 200 };
const arena = colliders => ({ bounds: { minX: -99, maxX: 99, minZ: -99, maxZ: 99 }, colliders: [floor, ...colliders] });
function lane(weapon, { distance = 5, height = .85, colliders = [] } = {}) {
  const state = createState(); state.map = arena(colliders);
  state.players = [createCombatPlayer(0, 1, weapon), createCombatPlayer(1)]; state.fighters = state.players;
  const [shooter, target] = state.players;
  Object.assign(shooter, { x: 0, y: 0, z: 0, pitch: Math.atan2(height - eyeHeight(shooter), distance) });
  Object.assign(target, { x: 0, y: 0, z: -distance, hp: 10000, maxHp: 10000 });
  return { state, shooter, target };
}
function ticks(state, count, buttons = {}) {
  for (let tick = 0; tick < count; tick++) {
    state.tick++; combatStep(state, state.players.map(player => ({ ...emptyInput(player), ...(player.id === 0 ? buttons : {}) })), state.map);
  }
}
const reports = state => state.events.filter(event => event.type === 'shot' && event.playerId === 0);
const setGunField = (player, field, value) => {
  player[field] = value;
  const item = player.inventory?.[player.inventoryIndex];
  if (item?.kind === 'weapon') item[field] = value;
};
const energy = samples => samples.reduce((total, value) => total + value * value, 0);

test('the previous four roles retain their loadout positions and honest display stats', () => {
  assert.equal(WEAPON_IDS.length, 36); assert.deepEqual(WEAPON_IDS.slice(9, 13), NEW_GUNS);
  const expected = { revolver: [6, 64, 128, 'semi'], pdw: [32, 18, 45, 'auto'], autoshotgun: [8, 10, 12, 'auto'], battlerifle: [20, 37, 100, 'auto'] };
  for (const id of NEW_GUNS) {
    const weapon = WEAPONS[id], stats = weaponStats(id);
    assert.deepEqual([weapon.magazine, stats.body, stats.head, stats.mode], expected[id]);
    assert.equal(stats.shotsPerSecond, 120 / weapon.cooldown);
    assert.equal(stats.reloadSeconds, weapon.reloadTicks / 120);
    assert.equal(stats.damagePerPellet, id === 'autoshotgun');
    assert.equal(stats.pellets, id === 'autoshotgun' ? 7 : 1);
    assert.ok(weapon.reserve >= weapon.magazine * 3);
    assert.ok(Object.isFrozen(weapon) && Object.isFrozen(weapon.effects) && Object.isFrozen(weapon.sound) && Object.isFrozen(weapon.falloff));
  }
  assert.match(weaponStats('revolver').fireRateLabel, /per press/);
  assert.match(weaponStats('autoshotgun').fireRateLabel, /shells\/s/);
});

test('revolver fires once per fresh press and neither held nor premature edges bypass its cycle', () => {
  const { state, shooter } = lane('revolver'), weapon = WEAPONS.revolver;
  ticks(state, 1, { fire: true, yaw: Math.PI / 2 });
  ticks(state, weapon.cooldown * 2, { fire: true, yaw: Math.PI / 2 });
  assert.equal(shooter.shots, 1); assert.equal(shooter.ammo, 5);
  ticks(state, 1); ticks(state, 1, { fire: true, yaw: Math.PI / 2 });
  assert.equal(shooter.shots, 2);
  ticks(state, 1); ticks(state, 1, { fire: true, yaw: Math.PI / 2 });
  assert.equal(shooter.shots, 2);
  ticks(state, weapon.cooldown + 1, { fire: true, yaw: Math.PI / 2 });
  assert.equal(shooter.shots, 2, 'a premature click is not queued for recovery');
  ticks(state, 1); ticks(state, 1, { fire: true, yaw: Math.PI / 2 });
  assert.equal(shooter.shots, 3); assert.equal(shooter.ammo, 3);
});

test('PDW, auto shotgun and battle rifle spend one round or shell at exact automatic cadence', () => {
  for (const id of ['pdw', 'autoshotgun', 'battlerifle']) {
    const { state, shooter } = lane(id), weapon = WEAPONS[id];
    ticks(state, weapon.cooldown * 2 + 1, { fire: true, yaw: Math.PI / 2 });
    const shells = reports(state).filter(event => event.pellet === 0);
    assert.equal(shooter.shots, 3, id); assert.equal(shooter.ammo, weapon.magazine - 3, id);
    assert.deepEqual(shells.map(event => event.tick), [1, weapon.cooldown + 1, weapon.cooldown * 2 + 1], id);
    assert.equal(reports(state).length, 3 * (weapon.pellets || 1), id);
    assert.equal(shooter.burstRemaining, 0, 'automatic guns never acquire burst state');
  }
});

test('all new guns transfer finite reserve only on their full reload completion', () => {
  for (const id of NEW_GUNS) {
    const { state, shooter } = lane(id), weapon = WEAPONS[id];
    setGunField(shooter, 'ammo', 0); setGunField(shooter, 'reserve', 3);
    ticks(state, 1, { reload: true, fire: true, yaw: Math.PI / 2 });
    assert.equal(shooter.reloadTicks, weapon.reloadTicks, id); assert.equal(shooter.shots, 0);
    ticks(state, weapon.reloadTicks - 1, { fire: true, yaw: Math.PI / 2 });
    assert.equal(shooter.ammo, 0, id); assert.equal(shooter.reserve, 3, id);
    ticks(state, 1);
    assert.equal(shooter.ammo, 3, id); assert.equal(shooter.reserve, 0, id);
    assert.equal(shooter.shots, 0, id);
    assert.equal(state.events.filter(event => event.type === 'reloadComplete').length, 1, id);
    ticks(state, 1, { reload: true }); assert.equal(shooter.reloadTicks, 0, 'empty reserve cannot refill');
    ticks(state, 1, { fire: true, yaw: Math.PI / 2 }); assert.equal(shooter.ammo, 2, id);
  }
});

test('settled new gun contacts apply distinct head, body and leg damage at actual hit distance', () => {
  for (const id of NEW_GUNS) for (const [height, kind] of [[1.62, 'head'], [.9, 'body'], [.25, 'leg']]) {
    const { state, shooter, target } = lane(id, { distance: 4, height });
    ticks(state, ADS.ticks, { aim: true }); ticks(state, 1, { aim: true, fire: true });
    const shell = reports(state), center = shell.find(event => event.pellet === 0);
    assert.equal(center.hitKind, kind, `${id} ${kind}`); assert.equal(center.targetId, target.id);
    const distance = Math.hypot(center.hitX - center.x, center.hitY - center.y, center.hitZ - center.z);
    assert.equal(center.damage, weaponDamage(id, kind, distance), id);
    assert.equal(shooter.ammo, WEAPONS[id].magazine - 1);
    assert.equal(10000 - target.hp, shell.reduce((total, event) => total + event.damage, 0), id);
    for (const event of shell) assert.ok([event.dx, event.dy, event.dz, event.hitX, event.hitY, event.hitZ, event.damage].every(Number.isFinite));
  }
});

test('new close-range roles lose damage with distance and never erase their movement tradeoffs', () => {
  for (const id of NEW_GUNS) {
    const weapon = WEAPONS[id], near = weaponDamage(id, 'body', weapon.falloff.start);
    const far = weaponDamage(id, 'body', weapon.range);
    assert.ok(far < near && far > 0, id);
    assert.equal(weaponDamage(id, 'body', 10000), Math.round(weapon.damage * weapon.falloff.minimum));
    const moving = weaponSpread(id, { motion: 1 }), aimed = weaponSpread(id, { motion: 1, ads: 1 });
    assert.ok(aimed < moving && aimed > weaponSpread(id, { ads: 1 }), id);
    assert.ok(weaponSpread(id, { grounded: false }) > weaponSpread(id), id);
    assert.ok(weaponSpread(id, { heat: 8 }) > weaponSpread(id), id);
  }
  assert.ok(weaponDamage('pdw', 'body', 40) < weaponDamage('smg', 'body', 40));
  assert.ok(WEAPONS.battlerifle.recoil > WEAPONS.carbine.recoil * 2 && WEAPONS.battlerifle.speed < WEAPONS.carbine.speed);
  assert.ok(WEAPONS.autoshotgun.pelletSpread > WEAPONS.shotgun.pelletSpread);
});

test('auto shotgun preserves one shell, seven deterministic contacts and independent cover blocking', () => {
  const states = Array.from({ length: 2 }, () => lane('autoshotgun', { distance: 2.5, colliders: [{ id: 'partial-cover', x: .075, y: 0, z: -1.6, w: .4, h: 3, d: .3 }] }).state);
  for (const state of states) ticks(state, 1, { fire: true });
  const shell = reports(states[0]);
  assert.deepEqual(shell, reports(states[1])); assert.equal(shell.length, 7);
  assert.deepEqual(shell.map(event => event.pellet), [0, 1, 2, 3, 4, 5, 6]);
  assert.ok(shell.every(event => event.pelletCount === 7));
  assert.equal(states[0].players[0].ammo, 7); assert.equal(states[0].players[0].shots, 1);
  assert.ok(shell.some(event => event.colliderId === 'partial-cover'));
  assert.ok(shell.some(event => event.targetId === 1 && event.damage > 0));
  const covered = lane('autoshotgun', { distance: 2.5, colliders: [{ id: 'full-cover', x: -2, y: 0, z: -1.6, w: 4, h: 3, d: .3 }] });
  ticks(covered.state, 1, { fire: true });
  assert.equal(covered.target.hp, 10000); assert.ok(reports(covered.state).every(event => event.colliderId === 'full-cover' && event.damage === 0));
});

test('suppressed PDW has a genuinely quieter short report and subdued presentation flash', () => {
  const pdw = createVoxelShotSamples('pdw'), smg = createVoxelShotSamples('smg');
  assert.equal(WEAPONS.pdw.suppressed, true); assert.ok(pdw.length < smg.length);
  assert.ok(energy(pdw) < energy(smg) * .4, 'suppression reduces the complete rendered report energy');
  const high = samples => energy(samples.subarray(1, 480).map((sample, index) => sample - samples[index]));
  assert.ok(high(pdw) < high(smg) * .4, 'the first 10 ms crack is subdued too');
  assert.ok(WEAPONS.pdw.effects.muzzleStrength < WEAPONS.smg.effects.muzzleStrength / 3);
  assert.ok(WEAPONS.pdw.effects.muzzleSize < WEAPONS.smg.effects.muzzleSize / 2);
  assert.ok(WEAPONS.pdw.sound.noiseVolume < WEAPONS.smg.sound.noiseVolume / 2);
});

test('new sound reports stay finite and distinct at all supported device rates without Web Audio creation', () => {
  const signatures = new Set();
  for (const id of NEW_GUNS) for (const rate of [8000, 44100, 48000, 96000, 192000]) {
    const samples = createVoxelShotSamples(id, rate);
    assert.equal(samples.length, Math.ceil(VOXEL_SHOT_AUDIO[id].duration * rate));
    assert.ok(samples.every(sample => Number.isFinite(sample) && Math.abs(sample) < .8));
    assert.ok(samples.at(-1) === 0); assert.ok(energy(samples) > 0);
    if (rate === 48000) signatures.add(`${samples.length}:${energy(samples)}:${samples[8]}`);
  }
  assert.equal(signatures.size, 4);
});

test('new shell impulses are distinct, bounded, deduplicated and recover independently of refresh rate', () => {
  const signatures = new Set();
  for (const id of NEW_GUNS) {
    const shot = createWeaponShotPresenter(), count = WEAPONS[id].pellets || 1;
    for (let pellet = 0; pellet < count; pellet++) assert.equal(shot.report({ id: pellet, type: 'shot', weapon: id, pellet, pelletCount: count }, 1000), pellet === 0);
    assert.equal(shot.getStats().acceptedShots, 1);
    const peak = Math.max(...Array.from({ length: 50 }, (_, time) => shot.sample(id, 1000 + time).kick));
    assert.ok(peak > .99 && peak <= 1.001, id);
    assert.equal(shot.report({ id: 0, type: 'shot', weapon: id, pellet: 0 }, 1025), false);
    const reference = weaponShotPose(id, 100);
    for (const hz of [60, 120, 144, 240]) {
      for (let frame = 0; frame < hz / 10; frame++) shot.sample(id, 1000 + frame * 1000 / hz);
      assert.deepEqual(shot.sample(id, 1100), reference);
    }
    signatures.add(JSON.stringify(reference));
    assert.equal(shot.sample(id, 1400).kick, 0);
    assert.ok(Object.values(reference).every(Number.isFinite));
    assert.ok(weaponShotPose(id, 25, 1).pitch < weaponShotPose(id, 25).pitch * .3);
  }
  assert.equal(signatures.size, 4);
});
