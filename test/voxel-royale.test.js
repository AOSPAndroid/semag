import assert from 'node:assert/strict';
import test from 'node:test';
import * as Royale from '../public/voxel-royale-engine.js';
import { createState as breachState, combatStep, traceShot, emitCombatEvent, WORLD, HEAL } from '../public/voxel-engine.js';
import { KNIFE, meleeProfile } from '../public/voxel-melee.js';
import { WEAPONS, WEAPON_IDS } from '../public/voxel-weapons.js';
import { initializeInventory, createInventoryGun, refreshInventory, selectInventorySlot, inventoryCanTake } from '../public/voxel-inventory.js';

const openArena = { bounds: { minX: -32, maxX: 32, minZ: -32, maxZ: 32 }, colliders: [], sites: [] };
function tick(state, count = 1, controls = {}) {
  for (let index = 0; index < count; index++) Royale.step(state, state.players.map(player => ({ ...Royale.emptyInput(player), ...(controls[player.id] || {}) })));
}
function fight(ids = [0, 1, 2], options = {}) {
  const state = Royale.createState({ seed: 7134, ...options }); Royale.startMatch(state, ids);
  tick(state, Royale.ROYALE.countdownTicks);
  state.map = openArena; state.loot = [];
  for (const id of ids) Object.assign(state.players[id], { x: 20, y: 0, z: -20 + id * 4, yaw: 0, pitch: 0 });
  return state;
}
function equip(player, weapon = 'carbine', ammo = WEAPONS[weapon].magazine, reserve = WEAPONS[weapon].reserve) {
  initializeInventory(player, { weapon, potions: player.potions, grenades: player.grenades, melee: player.meleeWeapon || 'knife' });
  player.inventory[1] = createInventoryGun(weapon, { ammo, reserve });
  refreshInventory(player);
}
function nearLoot(state, playerId, details) {
  const player = state.players[playerId], item = { id: ++state.lootId, x: player.x, y: player.y, z: player.z, ...details };
  state.loot.push(item); return item;
}
function finiteState(state) {
  for (const player of state.players) for (const property of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'pitch', 'hp', 'ammo', 'reserve']) assert.ok(Number.isFinite(player[property]), `${player.id}/${property}`);
  for (const property of ['x', 'z', 'radius', 'initialRadius', 'ticksUntilShrink', 'ticksUntilNext', 'damagePerSecond']) assert.ok(Number.isFinite(state.storm[property]), `storm/${property}`);
}

test('every arena starts 2 or 10 genuine participants at distinct safe random spawns with only a small knife and 200 HP', () => {
  for (const mapId of Royale.MAP_IDS) for (const count of [2, 10]) {
    const state = Royale.createState({ mapId, seed: 113 }), ids = Array.from({ length: count }, (_, id) => id);
    Royale.startMatch(state, ids);
    assert.equal(state.players.length, 10); assert.equal(state.fighters, state.players); assert.equal(state.aliveCount, count);
    assert.deepEqual(state.participantIds, ids); assert.equal(state.phase, 'countdown');
    assert.equal(new Set(state.players.filter(player => player.alive).map(player => `${player.x},${player.z}`)).size, count);
    for (const player of state.players) {
      assert.equal(player.team, player.id); assert.equal(player.alive, ids.includes(player.id)); assert.equal(player.hp, player.alive ? 200 : 0); assert.equal(player.maxHp, 200);
      assert.equal(player.hasGun, false); assert.equal(player.slot, 'sword'); assert.equal(player.ammo + player.reserve + player.potions + player.grenades, 0);
      assert.equal(player.meleeWeapon, 'knife'); assert.equal(meleeProfile(player), KNIFE);
    }
    assert.equal(state.loot.length, Royale.MAPS[mapId].lootPoints.length);
    assert.ok(state.loot.filter(loot => loot.kind === 'weapon').length >= 10);
    for (const kind of ['heal', 'ammo', 'grenade']) assert.ok(state.loot.some(loot => loot.kind === kind), `${mapId}/${kind}`);
    assert.deepEqual(new Set(state.loot.filter(loot => loot.kind === 'weapon').map(loot => loot.weapon)), new Set(WEAPON_IDS));
    assert.ok(state.loot.length <= Royale.ROYALE.maxLoot); finiteState(state);
  }
});

test('seeded fresh matches replay exactly and rematches reshuffle spawns and loot without preserving an old kit', () => {
  const first = Royale.createState({ seed: 91 }), second = Royale.createState({ seed: 91 });
  Royale.startMatch(first, [0, 3, 8]); Royale.startMatch(second, [8, 0, 3]);
  assert.deepEqual(Royale.cloneState(first), Royale.cloneState(second));
  const poses = first.players.map(player => [player.x, player.z]), supplies = JSON.stringify(first.loot);
  equip(first.players[0], 'sniper'); first.players[0].potions = 3;
  Royale.startMatch(first, [0, 3, 8]);
  assert.equal(first.matchId, 2); assert.equal(first.round, 2); assert.notDeepEqual(first.players.map(player => [player.x, player.z]), poses);
  assert.notEqual(JSON.stringify(first.loot), supplies); assert.equal(first.players[0].hasGun, false); assert.equal(first.players[0].potions, 0);
  assert.equal(first.players[0].meleeWeapon, 'knife'); assert.equal(first.players[0].hp, 200); assert.equal(first.players[0].slot, 'sword');
});

test('invalid capacity and fabricated participant sets fail before changing match state', () => {
  for (const capacity of [0, 1, 11, 2.5, NaN]) assert.throws(() => Royale.createState({ capacity }), RangeError);
  assert.throws(() => Royale.createState({ mapId: '__proto__' }), RangeError);
  const state = Royale.createState({ capacity: 2, seed: 1 });
  for (const ids of [[], [0], [0, 0], [0, 10], [-1, 0], [0, 1, 2], [0, 1.5], null]) assert.throws(() => Royale.startMatch(state, ids), RangeError);
  assert.equal(state.phase, 'lobby'); assert.equal(state.aliveCount, 0); assert.equal(state.matchId, 0);
});

test('countdown locks physics and held knife, utility, swap and pickup inputs cannot trigger latent actions', () => {
  const state = Royale.createState({ seed: 82 }); Royale.startMatch(state, [0, 1]);
  const player = state.players[0], pose = [player.x, player.y, player.z];
  state.loot = [{ id: 1, kind: 'weapon', weapon: 'carbine', ammo: 24, reserve: 24, x: player.x, y: player.y, z: player.z }];
  const controls = { 0: { up: true, jump: true, fire: true, interact: true, swap: true, heal: true, grenade: true } };
  tick(state, Royale.ROYALE.countdownTicks, controls);
  assert.deepEqual([player.x, player.y, player.z], pose); assert.equal(state.phase, 'fight'); assert.equal(player.hasGun, false);
  tick(state, 1, controls); assert.equal(player.hasGun, false); assert.equal(player.meleePhase, 'idle'); assert.equal(state.grenades.length, 0);
  tick(state); tick(state, 1, { 0: { interact: true } }); assert.equal(player.hasGun, true);
});

test('a fresh reachable E pickup equips a gun once and holding E cannot repeatedly consume nearby supplies', () => {
  const state = fight(), player = state.players[0];
  nearLoot(state, 0, { kind: 'weapon', weapon: 'smg', ammo: 17, reserve: 31 });
  tick(state, 1, { 0: { interact: true } });
  assert.equal(player.hasGun, true); assert.equal(player.slot, 'primary'); assert.equal(player.weapon, 'smg'); assert.equal(player.ammo, 17); assert.equal(player.reserve, 31);
  assert.equal(player.meleeWeapon, 'knife');
  nearLoot(state, 0, { kind: 'heal', amount: 1 }); tick(state, 20, { 0: { interact: true } }); assert.equal(player.potions, 0);
  tick(state); tick(state, 1, { 0: { interact: true } }); assert.equal(player.potions, 1);
  assert.equal(state.events.filter(event => event.type === 'lootPickup').length, 2);
});

test('loot prompts and authoritative pickups reject walls, remote heights, range and incompatible ammo', () => {
  const state = fight(), player = state.players[0]; Object.assign(player, { x: 0, z: 0 });
  state.map = { ...openArena, colliders: [{ id: 'partition', x: -.2, y: 0, z: -.85, w: .4, h: 3, d: .15 }] };
  const loot = nearLoot(state, 0, { kind: 'weapon', weapon: 'carbine', ammo: 24, reserve: 24, z: -1.4 });
  assert.equal(Royale.findNearbyLoot(state, 0), null); tick(state, 1, { 0: { interact: true } }); assert.equal(player.hasGun, false);
  state.map = openArena; loot.y = 3.36; assert.equal(Royale.findNearbyLoot(state, 0), null);
  loot.y = 0; loot.z = -1.701; assert.equal(Royale.findNearbyLoot(state, 0), null);
  loot.z = -1.69; assert.equal(Royale.findNearbyLoot(state, 0)?.id, loot.id);
  state.loot = []; equip(player, 'carbine', 10, 2);
  nearLoot(state, 0, { kind: 'ammo', weapon: 'sniper', amount: 5 }); assert.equal(Royale.findNearbyLoot(state, 0), null);
  state.loot[0].weapon = 'carbine'; assert.equal(Royale.findNearbyLoot(state, 0)?.kind, 'ammo');
});

test('additional guns retain separate magazines and cooldowns, and full-backpack exchanges conserve the old gun', () => {
  const state = fight(), player = state.players[0]; equip(player, 'sniper', 2, 7); player.shotCooldown = 122;
  const incoming = nearLoot(state, 0, { kind: 'weapon', weapon: 'pistol', ammo: 5, reserve: 12 });
  tick(state, 1, { 0: { interact: true } });
  assert.equal(player.weapon, 'pistol'); assert.equal(player.ammo, 5); assert.equal(player.reserve, 12); assert.equal(player.shotCooldown, 0);
  assert.ok(!state.loot.some(loot => loot.id === incoming.id));
  assert.equal(state.loot.length, 0); assert.equal(player.inventory[1].weapon, 'sniper');
  assert.equal(player.inventory[1].ammo, 2); assert.equal(player.inventory[1].reserve, 7); assert.equal(player.inventory[1].shotCooldown, 121);
  tick(state, 1, { 0: { slot2: true } }); tick(state); tick(state, 1, { 0: { fire: true } });
  assert.equal(player.shots, 0); assert.equal(player.ammo, 2); assert.equal(player.shotCooldown, 118);
  player.inventory[3] = createInventoryGun('smg'); refreshInventory(player);
  nearLoot(state, 0, { kind: 'weapon', weapon: 'carbine', ammo: 8, reserve: 19 });
  tick(state, 1, { 0: { interact: true } });
  assert.equal(player.weapon, 'carbine'); assert.equal(player.ammo, 8); assert.equal(player.reserve, 19);
  const old = state.loot.find(loot => loot.kind === 'weapon');
  assert.equal(old.weapon, 'sniper'); assert.equal(old.ammo, 2); assert.equal(old.reserve, 7); assert.equal(old.item.shotCooldown, 118);
});

test('supply stacks and weapon-specific ammo conserve amounts and respect inventory limits', () => {
  const state = fight(), player = state.players[0], reserveCap = WEAPONS.carbine.reserve * 2; equip(player, 'carbine', 9, reserveCap - 2);
  const ammo = nearLoot(state, 0, { kind: 'ammo', weapon: 'carbine', amount: 24 });
  tick(state, 1, { 0: { interact: true } }); assert.equal(player.reserve, reserveCap); assert.equal(ammo.amount, 22); assert.equal(player.ammo, 9);
  state.loot = []; const heal = nearLoot(state, 0, { kind: 'heal', amount: 5 }); tick(state); tick(state, 1, { 0: { interact: true } });
  assert.equal(player.potions, 4); assert.equal(heal.amount, 1); assert.equal(inventoryCanTake(player, heal), false);
  tick(state); tick(state, 1, { 0: { interact: true } }); assert.equal(heal.amount, 1); assert.equal(player.potions, 4);
  assert.deepEqual(player.inventory.slice(2).map(item => item.amount), [2, 2]);
  tick(state, 1, { 0: { slot4: true } }); tick(state, 1, { 0: { drop: true } }); assert.equal(player.potions, 2);
  state.loot = []; const frag = nearLoot(state, 0, { kind: 'grenade', amount: 4 }); tick(state); tick(state, 1, { 0: { interact: true } });
  assert.equal(player.grenades, 2); assert.equal(frag.amount, 2); assert.equal(inventoryCanTake(player, frag), false);
});

test('swapping off a committed knife swing then collecting a gun cannot erase melee recovery', () => {
  const state = fight(), player = state.players[0], target = state.players[1]; equip(player); player.slot = 'sword';
  Object.assign(player, { x: 0, z: 1.5, yaw: 0 }); Object.assign(target, { x: 0, z: 0 });
  tick(state, 1, { 0: { fire: true } }); tick(state, KNIFE.startupTicks); assert.equal(target.hp, 172); assert.equal(player.meleeCooldown, KNIFE.activeTicks + KNIFE.recoveryTicks);
  tick(state, 1, { 0: { swap: true } }); assert.equal(player.slot, 'primary'); assert.equal(player.meleeTicks, 0);
  const recovery = player.meleeCooldown; nearLoot(state, 0, { kind: 'weapon', weapon: 'pistol', ammo: 12, reserve: 24 });
  tick(state, 1, { 0: { interact: true } }); assert.equal(player.meleeCooldown, recovery - 1);
  tick(state, 1, { 0: { swap: true } }); assert.equal(player.slot, 'sword'); tick(state); tick(state, 1, { 0: { fire: true } });
  assert.equal(player.meleePhase, 'idle'); assert.equal(state.events.filter(event => event.type === 'meleeStart').length, 1); assert.equal(target.hp, 172); assert.equal(player.meleeWeapon, 'knife');
});

test('every gun damage profile and delayed bolt reuses Breach contacts in free-for-all combat', () => {
  for (const weapon of WEAPON_IDS) {
    const state = fight(), shooter = state.players[0], target = state.players[1]; equip(shooter, weapon);
    Object.assign(shooter, { x: 0, z: 4, yaw: 0, pitch: Math.atan2(.9 - WORLD.eyeHeight, 4) }); Object.assign(target, { x: 0, z: 0 });
    tick(state, 18, { 0: { aim: true, pitch: shooter.pitch } }); tick(state, WEAPONS[weapon].spinupTicks || 1, { 0: { aim: true, fire: true, pitch: shooter.pitch } });
    if (WEAPONS[weapon].projectile) { assert.equal(target.hp, 200); tick(state, 15, { 0: { aim: true, pitch: shooter.pitch } }); }
    assert.ok(target.hp < 200, weapon); assert.ok(state.events.some(event => event.type === 'damage' && event.targetId === 1 && event.playerId === 0), weapon);
    assert.equal(shooter.shots, 1, weapon); assert.equal(shooter.ammo, WEAPONS[weapon].magazine - 1, weapon); finiteState(state);
  }
});

test('all ten survivors can throw both grenades before the first fuse expires without lost inventory or invisible simulation', () => {
  const state = fight(Array.from({ length: 10 }, (_, id) => id));
  for (const player of state.players) { player.grenades = 2; player.yaw = Math.PI / 2; }
  const controls = Object.fromEntries(state.participantIds.map(id => [id, { grenade: true }]));
  tick(state, 1, controls);
  assert.equal(state.maxGrenades, 20); assert.equal(state.grenades.length, 10); assert.ok(state.players.every(player => player.grenades === 1));
  assert.deepEqual(new Set(state.grenades.map(grenade => grenade.playerId)), new Set(state.participantIds));
  tick(state, 24); tick(state, 1, controls);
  assert.equal(state.grenades.length, 20); assert.ok(state.players.every(player => player.grenades === 0));
  assert.equal(state.events.filter(event => event.type === 'grenadeThrow').length, 20);
  const oldFuse = state.grenades[0].fuseTicks; tick(state);
  assert.equal(state.grenades.length, 20); assert.equal(state.grenades[0].fuseTicks, oldFuse - 1);
  assert.ok(state.grenades.every(grenade => [grenade.x, grenade.y, grenade.z, grenade.vx, grenade.vy, grenade.vz].every(Number.isFinite)));
  tick(state, 289); assert.equal(state.grenades.length, 0);
  assert.equal(state.events.filter(event => event.type === 'grenadeExplosion').length, 20); finiteState(state);
});

test('knife-only survivors can damage each other and V never equips a fictitious empty gun', () => {
  const state = fight(), attacker = state.players[0], target = state.players[1];
  Object.assign(attacker, { x: 0, z: 1.5, yaw: 0 }); Object.assign(target, { x: 0, z: 0 });
  tick(state, 1, { 0: { swap: true } }); assert.equal(attacker.slot, 'sword');
  tick(state); tick(state, 1, { 0: { fire: true } }); tick(state, 20);
  assert.equal(target.hp, 172); assert.equal(attacker.ammo, 0); assert.equal(attacker.shots, 0);
  const hit = state.events.findLast(event => event.type === 'meleeHit'), damage = state.events.findLast(event => event.type === 'damage');
  assert.equal(hit.weapon, 'knife'); assert.equal(hit.damage, 28); assert.equal(damage.attack, 'knife'); assert.equal(damage.weapon, 'knife');
});

test('death drops supplied inventory exactly once without refills and only the last genuine survivor wins', () => {
  const state = fight([0, 1]), victim = state.players[1], shooter = state.players[0];
  equip(victim, 'smg', 7, 13); victim.potions = 2; victim.grenades = 1;
  equip(shooter, 'marksman'); Object.assign(shooter, { x: 0, z: 4, yaw: 0, pitch: 0 }); Object.assign(victim, { x: 0, z: 0 });
  victim.hp = 100; // A wounded survivor is within one marksman headshot of elimination.
  tick(state, 1, { 0: { fire: true } });
  assert.equal(victim.alive, false); assert.equal(shooter.kills, 1); assert.equal(state.phase, 'matchEnd'); assert.equal(state.winnerId, 0); assert.equal(state.aliveCount, 1);
  assert.deepEqual(state.placements.map(entry => [entry.playerId, entry.place]), [[1, 2], [0, 1]]);
  assert.deepEqual(state.loot.filter(loot => loot.droppedBy === 1).map(loot => [loot.kind, loot.ammo, loot.reserve, loot.amount]), [['melee', undefined, undefined, undefined], ['weapon', 7, 13, undefined], ['heal', undefined, undefined, 2], ['grenade', undefined, undefined, 1]]);
  assert.equal(state.loot.find(loot => loot.droppedBy === 1 && loot.kind === 'melee').weapon, 'knife');
  const count = state.loot.length; tick(state, 200); Royale.eliminateParticipant(state, 1); assert.equal(state.loot.length, count); assert.equal(victim.hasGun, false);
});

test('simultaneous lethal free-for-all shots trade and produce an explicit draw with no inactive ghost winner', () => {
  const state = fight([2, 9]); const first = state.players[2], second = state.players[9];
  equip(first, 'marksman'); equip(second, 'marksman');
  Object.assign(first, { x: 0, z: 4, yaw: 0, pitch: 0 }); Object.assign(second, { x: 0, z: 0, yaw: Math.PI, pitch: 0 });
  first.hp = second.hp = 100;
  tick(state, 1, { 2: { fire: true }, 9: { fire: true } });
  assert.equal(state.phase, 'matchEnd'); assert.equal(state.winnerId, null); assert.equal(state.roundReason, 'noSurvivors'); assert.equal(state.aliveCount, 0);
  assert.equal(first.kills, 1); assert.equal(second.kills, 1); assert.equal(state.events.filter(event => event.type === 'kill').length, 2); finiteState(state);
});

test('airborne death drops fall onto the real raised support instead of floating or tunnelling through it', () => {
  const state = fight(), player = state.players[1];
  state.map = { ...openArena, colliders: [{ id: 'raised-support', x: -2, y: 1.2, z: -2, w: 4, h: .3, d: 4 }] };
  Object.assign(player, { x: 0, y: 4, z: 0, grounded: false }); equip(player, 'carbine', 7, 12); player.potions = 2;
  Royale.eliminateParticipant(state, 1); assert.equal(state.phase, 'fight');
  const drops = state.loot.filter(loot => loot.droppedBy === 1); assert.equal(drops.length, 3); assert.ok(drops.every(loot => loot.y === 4 && loot.falling));
  tick(state, 120); assert.ok(drops.every(loot => loot.y === 1.5 && !loot.falling && loot.vy === 0));
  const gun = drops.find(loot => loot.kind === 'weapon'), heal = drops.find(loot => loot.kind === 'heal');
  assert.equal(gun.ammo, 7); assert.equal(gun.reserve, 12); assert.equal(heal.amount, 2); finiteState(state);
});

test('disconnections eliminate during countdown or combat without free kill credit, and multiple survivors continue', () => {
  const state = fight(); equip(state.players[1], 'shotgun', 2, 4);
  Royale.eliminateParticipant(state, 1); assert.equal(state.phase, 'fight'); assert.equal(state.aliveCount, 2); assert.equal(state.players[1].alive, false);
  assert.ok(state.players.every(player => player.kills === 0)); assert.equal(state.loot.filter(loot => loot.droppedBy === 1).length, 2);
  Royale.eliminateParticipant(state, 2); assert.equal(state.phase, 'matchEnd'); assert.equal(state.winnerId, 0);
  const countdown = Royale.createState({ seed: 2 }); Royale.startMatch(countdown, [0, 1]); Royale.eliminateParticipant(countdown, 0);
  assert.equal(countdown.phase, 'matchEnd'); assert.equal(countdown.winnerId, 1); assert.equal(countdown.players[1].kills, 0);
});

test('the storm warns, contracts continuously, escalates honest periodic damage and closes in four minutes', () => {
  const state = fight(); const radius = state.storm.initialRadius;
  tick(state, 1); assert.equal(state.storm.mode, 'waiting'); assert.equal(state.storm.radius, radius); assert.equal(state.storm.ticksUntilShrink, 30 * 120 - 1);
  state.matchTicks = 30 * 120 - 1; tick(state); assert.equal(state.storm.mode, 'shrinking'); assert.equal(state.storm.radius, radius);
  tick(state); assert.ok(state.storm.radius < radius); assert.ok(state.storm.radius > radius * .72);
  state.matchTicks = 60 * 120 - 1; tick(state); assert.equal(state.storm.stage, 1); assert.equal(state.storm.mode, 'waiting'); assert.ok(Math.abs(state.storm.radius - radius * .72) < 1e-9);
  assert.equal(state.storm.damagePerSecond, 4);
  Object.assign(state.players[0], { x: 30, z: 30 }); state.players[0].hp = 100;
  state.matchTicks = 105 * 120 - 1; tick(state); assert.equal(state.storm.stage, 2); assert.equal(state.players[0].hp, 93);
  assert.equal(state.events.findLast(event => event.type === 'damage' && event.targetId === 0).attack, 'storm');
  assert.ok(state.players.every(player => player.kills === 0));
  assert.equal(Royale.STORM_STAGES.reduce((sum, stage) => sum + stage.wait + stage.shrink, 0), 240);
  assert.ok(state.events.filter(event => event.type === 'stormStage').length >= 3); finiteState(state);
});

test('the final zero-radius storm resolves all survivors in finite time, including someone at the exact centre', () => {
  const state = fight([0, 1]);
  Object.assign(state.players[0], { x: state.storm.x, z: state.storm.z }); Object.assign(state.players[1], { x: state.storm.x + 1, z: state.storm.z });
  state.matchTicks = 240 * 120 - 1; tick(state);
  assert.equal(state.storm.mode, 'final'); assert.equal(state.storm.radius, 0); assert.equal(state.players[0].hp, 175); assert.equal(state.players[1].hp, 175);
  tick(state, 840); assert.equal(state.phase, 'matchEnd'); assert.equal(state.aliveCount, 0); assert.equal(state.winnerId, null); assert.equal(state.roundTicks, 0); finiteState(state);
});

test('storm pulses use the final moved pose: entering the circle saves while exiting takes the actual boundary hit', () => {
  for (const entering of [true, false]) {
    const state = fight(), player = state.players[0], radius = state.storm.initialRadius * .46;
    Object.assign(player, { x: state.storm.x + radius + (entering ? .005 : -.005), z: state.storm.z, yaw: 0, hp: 6, vx: entering ? -5.85 : 5.85 });
    state.matchTicks = 105 * 120 - 1;
    tick(state, 1, { 0: entering ? { left: true } : { right: true } });
    const distance = Math.hypot(player.x - state.storm.x, player.z - state.storm.z);
    assert.ok(entering ? distance < state.storm.radius : distance > state.storm.radius);
    assert.equal(player.alive, entering); assert.equal(player.hp, entering ? 6 : 0);
    const hit = state.events.findLast(event => event.type === 'damage' && event.targetId === 0 && event.attack === 'storm');
    if (entering) assert.equal(hit, undefined);
    else { assert.equal(hit.damage, 6); assert.ok(Math.hypot(hit.x - state.storm.x, hit.z - state.storm.z) > state.storm.radius); }
    finiteState(state);
  }
});

test('storm damage on the final potion tick cancels completion instead of healing through a lethal boundary', () => {
  const state = fight(), player = state.players[0];
  Object.assign(player, { x: 30, z: 30, hp: 10, potions: 1 }); tick(state, 1, { 0: { heal: true } });
  assert.equal(player.healTicks, HEAL.ticks); player.healTicks = 1; state.matchTicks = 185 * 120 - 1;
  tick(state); assert.equal(player.alive, false); assert.equal(player.hp, 0);
  assert.ok(!state.events.some(event => event.type === 'healComplete' && event.playerId === 0)); assert.equal(state.events.findLast(event => event.type === 'kill').attack, 'storm');
});

test('lobby reset clears projectiles, loot, health and winner while preserving clock and match identity', () => {
  const state = fight([0, 1]); equip(state.players[0], 'crossbow'); state.players[0].potions = 2;
  tick(state, 1, { 0: { fire: true } }); assert.equal(state.bolts.length, 1);
  const { tick: clock, eventId, matchId } = state; Royale.resetLobby(state);
  assert.equal(state.phase, 'lobby'); assert.equal(state.tick, clock); assert.equal(state.eventId, eventId); assert.equal(state.matchId, matchId);
  assert.equal(state.loot.length + state.bolts.length + state.grenades.length, 0); assert.equal(state.winnerId, null); assert.equal(state.aliveCount, 0);
  assert.ok(state.players.every(player => !player.alive && !player.hasGun)); finiteState(state);
});

test('Royale snapshots remain isolated and bounded, with shared static geometry rather than copied map data', () => {
  const state = fight(); const copy = Royale.cloneState(state); copy.players[0].hp = 1;
  assert.equal(state.players[0].hp, 200); assert.equal(copy.map, state.map); assert.equal(copy.fighters, copy.players);
  for (let index = 0; index < 400; index++) emitCombatEvent(state, 'probe'); assert.equal(state.events.length, 256);
  const breach = breachState(); for (let index = 0; index < 400; index++) emitCombatEvent(breach, 'probe'); assert.equal(breach.events.length, 160);
  tick(state, 50, { 0: { yaw: Infinity, pitch: NaN, up: 1, jump: 'true' } }); finiteState(state);
});

test('shared physical combat respects an explicitly supplied arena for hitscan, sword and ballistic cover', () => {
  const wall = { id: 'adapter-cover', x: 19.5, y: 0, z: 2, w: 1, h: 3, d: .2 }, arena = { ...openArena, colliders: [wall] };
  for (const weapon of ['carbine', 'crossbow', 'sword']) {
    const state = breachState(), attacker = state.players[0], target = state.players[1];
    Object.assign(attacker, { x: 20, y: 0, z: weapon === 'sword' ? 2.6 : 4, yaw: 0, pitch: 0 }); Object.assign(target, { x: 20, y: 0, z: weapon === 'sword' ? 1.1 : 0 });
    if (weapon === 'sword') { initializeInventory(attacker, { melee: 'sword' }); selectInventorySlot(attacker, 0); } else equip(attacker, weapon);
    assert.equal(traceShot(state, 0, { x: 20, y: 1.62, z: 4 }, { x: 0, y: 0, z: -1 }, 10, arena).colliderId, wall.id);
    state.tick++; combatStep(state, state.players.map(player => ({ ...Royale.emptyInput(player), fire: player.id === 0 })), arena);
    for (let index = 0; index < 35; index++) { state.tick++; combatStep(state, state.players.map(player => Royale.emptyInput(player)), arena); }
    assert.equal(target.hp, 200, weapon); assert.ok(!state.events.some(event => event.type === 'damage'), weapon);
    if (weapon === 'carbine') assert.equal(state.events.find(event => event.type === 'shot').colliderId, wall.id);
    if (weapon === 'crossbow') assert.equal(state.events.find(event => event.type === 'boltHit').colliderId, wall.id);
  }
});
