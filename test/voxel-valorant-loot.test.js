import assert from 'node:assert/strict';
import test from 'node:test';
import * as Royale from '../public/voxel-royale-engine.js';
import { WEAPONS, WEAPON_IDS } from '../public/voxel-weapons.js';
import { MELEE_IDS } from '../public/voxel-melee.js';
import { navigationCanOccupy } from '../public/voxel-navigation.js';

const shotgunFamily = id => WEAPONS[id].category === 'shotgun' || ['shotgun', 'autoshotgun', 'slugshotgun'].includes(id);
function match(mapId, seed, capacity = 10) {
  const state = Royale.createState({ mapId, seed, capacity });
  Royale.startMatch(state, Array.from({ length: capacity }, (_, i) => i)); return state;
}
function advance(state, count, buttons = {}) {
  for (let tick = 0; tick < count; tick++) {
    const inputs = state.players.map(p => ({ ...Royale.emptyInput(p), ...(buttons[p.id] || {}) })); Royale.step(state, inputs);
  }
}
function poseAt(state, item) {
  const player = state.players[0];
  Object.assign(player, { x: item.x, y: item.y, z: item.z, vx: 0, vy: 0, vz: 0, grounded: true, yaw: 0, pitch: 0 });
  // Unit encounters use a genuine authored cache and keep the idle opponent
  // outside pickup range; the authoritative input path still owns the pickup.
  const remote = state.map.spawnPoints.find(p => Math.hypot(p.x - item.x, p.z - item.z) > 12);
  Object.assign(state.players[1], remote, { vx: 0, vy: 0, vz: 0, grounded: true });
  assert.ok(navigationCanOccupy(state.map, player));
  advance(state, 1); assert.equal(Royale.findNearbyLoot(state, 0)?.id, item.id);
  advance(state, 1, { 0: { interact: true } });
  assert.equal(state.loot.some(p => p.id === item.id), false, 'an accepted pickup removes exactly this cache');
  return player;
}

test('every map keeps all four blade types and eight or more useful supplies alongside distinct seeded guns', () => {
  const blades = new Set(MELEE_IDS.filter(id => id !== 'knife'));
  for (const mapId of Royale.MAP_IDS) for (const seed of [0, 761, 8124, 0xffffffff]) {
    const state = match(mapId, seed), guns = state.loot.filter(p => p.kind === 'weapon'), supplies = state.loot.filter(p => ['heal', 'ammo', 'grenade'].includes(p.kind));
    assert.equal(state.loot.length, state.map.lootPoints.length); assert.ok(state.loot.length <= Royale.ROYALE.maxLoot);
    assert.ok(guns.length >= Royale.ROYALE.maxPlayers); assert.equal(new Set(guns.map(p => p.weapon)).size, guns.length);
    assert.deepEqual(new Set(state.loot.filter(p => p.kind === 'melee').map(p => p.weapon)), blades);
    assert.ok(supplies.length >= 8, `${mapId}/${seed}: the larger gun catalogue cannot crowd out supplies`);
    for (const kind of ['heal', 'ammo', 'grenade']) assert.ok(supplies.filter(p => p.kind === kind).length >= 2, `${mapId}/${seed}/${kind}`);
    for (const gun of guns) {
      const profile = WEAPONS[gun.weapon]; assert.ok(profile);
      assert.equal(gun.ammo, profile.magazine); assert.equal(gun.reserve, Math.min(profile.reserve, profile.magazine * 2));
    }
    for (const ammo of supplies.filter(p => p.kind === 'ammo')) {
      assert.ok(guns.some(p => p.weapon === ammo.weapon), `${mapId}: ammo belongs to a gun available in this round`);
      assert.equal(ammo.amount, WEAPONS[ammo.weapon].magazine);
    }
    assert.ok(state.players.filter(p => p.participating).every(p => p.inventory[0].weapon === 'knife' && !p.hasGun && p.potions === 0 && p.grenades === 0));
  }
  assert.equal(Royale.ROYALE.maxLoot, 128);
});

test('every gun is reachable on every map across deterministic real seeded starts; ordinary maps preserve a varied unbiased subset', () => {
  const ordinaryShotgunCounts = new Set();
  for (const mapId of Royale.MAP_IDS) {
    const available = new Set(), signatures = new Set();
    for (let seed = 1; seed <= 64; seed++) {
      const state = match(mapId, seed), guns = state.loot.filter(p => p.kind === 'weapon');
      guns.forEach(p => available.add(p.weapon)); signatures.add(guns.map(p => p.weapon).join(','));
      if (state.map.combatStyle === 'close') assert.ok(guns.filter(p => shotgunFamily(p.weapon)).length >= 2, `${mapId}: close-quarter scavenging includes two distinct shotgun-family choices`);
      else ordinaryShotgunCounts.add(guns.filter(p => shotgunFamily(p.weapon)).length);
    }
    assert.deepEqual(available, new Set(WEAPON_IDS), `${mapId}: every weapon remains reachable through seeded scavenging`);
    assert.ok(signatures.size > 50, `${mapId}: memorizing a fixed gun list does not solve looting`);
  }
  assert.ok(ordinaryShotgunCounts.has(0) || ordinaryShotgunCounts.has(1), 'ordinary arenas do not inherit the close-map shotgun guarantee');
  const first = match('market', 761), identical = match('market', 761);
  assert.deepEqual(first.loot, identical.loot);
  const old = JSON.stringify(first.loot); Royale.startMatch(first, [0, 1]);
  assert.notEqual(JSON.stringify(first.loot), old, 'replaying advances the deterministic shuffle');
});

test('every catalogue weapon can be genuinely looted with its own magazine and reserve from seeded caches', () => {
  const seeds = new Map();
  for (let seed = 1; seed <= 64 && seeds.size < WEAPON_IDS.length; seed++) {
    for (const gun of match('forest', seed, 2).loot.filter(p => p.kind === 'weapon')) if (!seeds.has(gun.weapon)) seeds.set(gun.weapon, seed);
  }
  assert.equal(seeds.size, WEAPON_IDS.length);
  for (const [weapon, seed] of seeds) {
    const state = match('forest', seed, 2); advance(state, Royale.ROYALE.countdownTicks); assert.equal(state.phase, 'fight');
    const item = state.loot.find(p => p.kind === 'weapon' && p.weapon === weapon), ammo = item.ammo, reserve = item.reserve;
    const player = poseAt(state, item);
    assert.equal(player.inventory[0].weapon, 'knife'); assert.equal(player.inventory[1].weapon, weapon);
    assert.equal(player.weapon, weapon); assert.equal(player.ammo, ammo); assert.equal(player.reserve, reserve);
    assert.equal(player.inventory[1].ammo, ammo); assert.equal(player.inventory[1].reserve, reserve);
    assert.equal(state.events.filter(e => e.type === 'lootPickup').length, 1);
  }
});

test('seeded ammunition genuinely replenishes its available gun after firing and reloading, preserving inventory authority', () => {
  for (const mapId of Royale.MAP_IDS) {
    const state = match(mapId, 761, 2); advance(state, Royale.ROYALE.countdownTicks);
    const ammo = state.loot.find(p => p.kind === 'ammo'), gun = state.loot.find(p => p.kind === 'weapon' && p.weapon === ammo.weapon);
    assert.ok(gun); const player = poseAt(state, gun), startAmmo = player.ammo;
    for (let tick = 0; tick < 300 && player.shots === 0; tick++) advance(state, 1, { 0: { fire: true } });
    assert.ok(player.shots > 0 && player.ammo < startAmmo, `${mapId}: accepted physical rounds consumed ammunition`);
    advance(state, 1); advance(state, 1, { 0: { reload: true } });
    for (let tick = 0; tick < 900 && player.reloadTicks > 0; tick++) advance(state, 1);
    assert.equal(player.reloadTicks, 0); const previousReserve = player.reserve, incoming = ammo.amount;
    poseAt(state, ammo);
    assert.equal(player.reserve, Math.min(WEAPONS[player.weapon].reserve * 2, previousReserve + incoming));
    assert.ok(player.reserve > previousReserve); assert.equal(player.inventory[1].reserve, player.reserve);
  }
});
