import test from 'node:test';
import assert from 'node:assert/strict';
import * as Combat from '../public/voxel-engine.js';
import * as Horde from '../public/voxel-horde-engine.js';
import * as Royale from '../public/voxel-royale-engine.js';
import { WEAPONS, WEAPON_IDS, weaponDamage } from '../public/voxel-weapons.js';
import { MELEE_WEAPONS, MELEE_IDS } from '../public/voxel-melee.js';
import { createInventoryMelee, dropInventoryItem, lootFromInventoryItem, pickupInventoryItem, setInventoryMeleeLoadout, refreshInventory, storeInventoryGun } from '../public/voxel-inventory.js';
import { createHitFeedback } from '../public/voxel-hit-feedback.js';

const GUNS = ['dualpistols', 'dualsmg', 'slugshotgun'];
const arena = Object.freeze({ id: 'arsenal-independent-arena', bounds: Object.freeze({ minX: -30, maxX: 30, minZ: -30, maxZ: 30 }), colliders: Object.freeze([]), sites: Object.freeze([]), spawns: Horde.MAPS.courtyard.spawns });
function fixture(weapon = 'carbine', distance = 3, height = .9) {
  const state = Combat.createState(); state.map = arena;
  state.players = [Combat.createCombatPlayer(0, 1, weapon), Combat.createCombatPlayer(1)]; state.fighters = state.players;
  Object.assign(state.players[0], { x: 0, y: 0, z: 0, yaw: 0, pitch: Math.atan2(height - Combat.eyeHeight(state.players[0]), distance) });
  Object.assign(state.players[1], { x: 0, y: 0, z: -distance, hp: 10000, maxHp: 10000 });
  return state;
}
function tick(state, count = 1, buttons = {}, options) {
  for (let index = 0; index < count; index++) {
    state.tick++;
    Combat.combatStep(state, state.players.map(player => ({ ...Combat.emptyInput(player), ...(buttons[player.id] || {}) })), state.map, options);
  }
}
function gunValue(player, field, value) { player[field] = value; player.inventory[player.inventoryIndex][field] = value; }
const reports = state => state.events.filter(event => event.type === 'shot' && event.playerId === 0);
function meleeFixture(weapon, distance = 1.5) {
  const state = fixture('carbine', distance);
  assert.ok(setInventoryMeleeLoadout(state.players[0], weapon, { equip: true }));
  state.players[0].pitch = 0;
  return state;
}
function hordeFixture(wave = 1, weapon = 'katana', monsterType = 'stalker', health = 10000) {
  const state = Horde.createState({ capacity: 1, seed: 321711, melee: weapon });
  Horde.startMatch(state); while (state.phase === 'countdown') Horde.step(state);
  setInventoryMeleeLoadout(state.players[0],weapon);
  state.map = arena; state.horde.wave = wave; state.horde.pending = 1; state.horde.nextSpawnTick = 1e9;
  Object.assign(state.players[0], { x: 0, y: 0, z: 3, yaw: 0, pitch: 0 });
  state.spawnWarnings = [{ id: 1, x: 0, y: 0, z: -8, ticksLeft: 1, monsterType }];
  Horde.step(state);
  const monster = state.players.find(player => player.monster), human = state.players[0];
  assert.ok(monster, 'a real rift must create the enemy');
  Object.assign(monster, { x: 0, y: 0, z: -1.5, vx: 0, vy: 0, vz: 0, emergenceTicks: 0, hp: health, maxHp: health });
  Object.assign(human, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
  const brain = state.horde.brains[monster.id]; brain.nextPlanTick = 1e9; brain.path = [];
  assert.ok(setInventoryMeleeLoadout(human, weapon, { equip: true }));
  return { state, monster, human, brain };
}
function hordeTicks(state, count, buttons = {}) { for (let index = 0; index < count; index++) Horde.step(state, [{ ...Combat.emptyInput(state.players[0]), ...buttons }]); }

test('arsenal additions preserve the complete original gun order and four physical inventory slots', () => {
  assert.deepEqual(WEAPON_IDS.slice(0, 13), ['carbine', 'smg', 'marksman', 'pistol', 'shotgun', 'burst', 'sniper', 'lmg', 'crossbow', 'revolver', 'pdw', 'autoshotgun', 'battlerifle']);
  assert.deepEqual(WEAPON_IDS.slice(13, 16), GUNS);
  assert.deepEqual(MELEE_IDS, ['knife', 'sword', 'katana', 'axe', 'tonfas']);
  for (const weapon of GUNS) {
    const player = fixture(weapon).players[0];
    assert.equal(player.hp, 200); assert.equal(player.inventory.length, 4);
    assert.equal(player.inventory[1].weapon, weapon); assert.equal(player.ammo, WEAPONS[weapon].magazine);
  }
});

for (const weapon of GUNS) test(`${weapon}: head/body/leg rewards are confirmed HP loss and cover blocks every round`, () => {
  const damage = [];
  for (const [height, kind] of [[1.62, 'head'], [.9, 'body'], [.25, 'leg']]) {
    const state = fixture(weapon, 3, height); tick(state, Combat.ADS.ticks, { 0: { aim: true } }); tick(state, 1, { 0: { aim: true, fire: true } });
    const shot = reports(state)[0]; assert.ok(shot); assert.equal(shot.hitKind, kind); assert.equal(shot.targetId, 1);
    const distance = Math.hypot(shot.hitX - shot.x, shot.hitY - shot.y, shot.hitZ - shot.z);
    assert.equal(shot.damage, weaponDamage(weapon, kind, distance));
    assert.equal(10000 - state.players[1].hp, shot.damage); assert.equal(state.players[0].ammo, WEAPONS[weapon].magazine - 1);
    assert.equal(reports(state).length, 1, 'a slug or alternating pistol round never invents pellets');
    const pulse = createHitFeedback().consume(state.events, state.players[0], state.players, { now: 1, lifeKey: 1 });
    assert.equal(pulse.kind, kind === 'head' ? 'headshot' : 'body');
    assert.equal(pulse.color, kind === 'head' ? '#ffd45a' : '#f47738');
    damage.push(shot.damage);
  }
  assert.ok(damage[0] > damage[1] && damage[1] > damage[2]);
  const covered = fixture(weapon); covered.map = { ...arena, colliders: [{ id: 'solid-screen', x: -2, y: 0, z: -1.6, w: 4, h: 3, d: .15 }] };
  tick(covered, 1, { 0: { fire: true } });
  assert.equal(covered.players[1].hp, 10000); assert.equal(reports(covered)[0].colliderId, 'solid-screen');
  assert.equal(createHitFeedback().consume(covered.events, covered.players[0], covered.players, { now: 1 }).visible, false);
});

test('paired SMGs alternate one real round at the exact shared cadence and exhaust one combined magazine', () => {
  const state = fixture('dualsmg'), gun = WEAPONS.dualsmg, human = state.players[0];
  tick(state, gun.cooldown * (gun.magazine - 1) + 1, { 0: { fire: true, yaw: Math.PI / 2 } });
  assert.equal(human.shots, gun.magazine); assert.equal(human.ammo, 0); assert.equal(reports(state).length, gun.magazine);
  assert.deepEqual(reports(state).map(event => event.hand), Array.from({ length: gun.magazine }, (_, index) => index % 2));
  assert.deepEqual(reports(state).map(event => event.tick), Array.from({ length: gun.magazine }, (_, index) => 1 + index * gun.cooldown));
  tick(state, gun.cooldown * 3, { 0: { fire: true } }); assert.equal(human.shots, gun.magazine, 'empty left/right hands cannot fire bonus rounds');
});

test('paired pistols require fresh presses, buffer at most one recent press, and never bypass cadence', () => {
  const state = fixture('dualpistols'), gun = WEAPONS.dualpistols;
  tick(state, 1, { 0: { fire: true, yaw: Math.PI / 2 } });
  tick(state, gun.cooldown * 2, { 0: { fire: true, yaw: Math.PI / 2 } });
  assert.equal(state.players[0].shots, 1);
  tick(state, 1); tick(state, 1, { 0: { fire: true, yaw: Math.PI / 2 } });
  tick(state, 1); tick(state, 1, { 0: { fire: true, yaw: Math.PI / 2 } });
  tick(state, gun.cooldown + 1, { 0: { fire: true, yaw: Math.PI / 2 } });
  assert.equal(state.players[0].shots, 3);
  assert.deepEqual(reports(state).map(event => event.hand), [0, 1, 0]);
  assert.ok(reports(state).slice(1).every((event, index) => event.tick - reports(state)[index].tick >= gun.cooldown));
  tick(state, gun.cooldown * 2, { 0: { fire: true } }); assert.equal(state.players[0].shots, 3);
});

for (const weapon of GUNS) test(`${weapon}: a partial reload cannot create ammunition or fire before completion`, () => {
  const state = fixture(weapon), human = state.players[0], gun = WEAPONS[weapon];
  gunValue(human, 'ammo', 0); gunValue(human, 'reserve', 3);
  tick(state, 1, { 0: { reload: true, fire: true } }); assert.equal(human.reloadTicks, gun.reloadTicks);
  tick(state, gun.reloadTicks - 1, { 0: { fire: true } }); assert.equal(human.ammo, 0); assert.equal(human.reserve, 3); assert.equal(human.shots, 0);
  tick(state); assert.equal(human.ammo, 3); assert.equal(human.reserve, 0);
  tick(state, 1, { 0: { slot1: true } }); tick(state, 1, { 0: { slot2: true } });
  assert.equal(human.ammo + human.reserve, 3); assert.equal(human.shots, 0);
});

test('a dropped dual item retains ammo and its next hand while cancelling reload and buffered fire', () => {
  const state = fixture('dualpistols'), human = state.players[0];
  tick(state, 1, { 0: { fire: true, yaw: Math.PI / 2 } }); tick(state);
  tick(state, 1, { 0: { reload: true } }); assert.ok(human.reloadTicks > 0);
  const dropped = dropInventoryItem(human); assert.equal(human.slot, 'empty');
  assert.equal(dropped.ammo, WEAPONS.dualpistols.magazine - 1); assert.equal(dropped.shotIndex, 1);
  assert.equal(dropped.reloadTicks, 0); assert.equal(dropped.pendingFireTicks, 0);
  const recipient = Combat.createCombatPlayer(1); recipient.inventory[1] = null; refreshInventory(recipient);
  assert.equal(pickupInventoryItem(recipient, lootFromInventoryItem(dropped)).ok, true);
  const transfer = fixture('carbine'); transfer.players[0] = recipient; recipient.id = 0; recipient.team = 0; recipient.x = recipient.z = recipient.y = 0;
  tick(transfer, WEAPONS.dualpistols.cooldown + 1); tick(transfer, 1, { 0: { fire: true, yaw: Math.PI / 2 } });
  assert.equal(reports(transfer)[0].hand, 1); assert.equal(recipient.ammo, WEAPONS.dualpistols.magazine - 2);
});

for (const weapon of MELEE_IDS) test(`${weapon}: a committed swing waits its windup, contacts once and respects wall/body cover`, () => {
  const profile = MELEE_WEAPONS[weapon], state = meleeFixture(weapon, Math.min(1.4, profile.reach));
  tick(state, 1, { 0: { fire: true } }); tick(state, profile.startupTicks - 1, { 0: { fire: true } });
  assert.equal(state.players[1].hp, 10000, 'windup cannot deal anticipatory damage');
  tick(state, 1, { 0: { fire: true } }); assert.equal(state.players[0].meleePhase, 'active');
  tick(state, profile.activeTicks - 1, { 0: { fire: true } }); assert.equal(state.players[1].hp, 10000 - profile.damage);
  const contact = state.events.find(event => event.type === 'meleeHit');
  assert.ok(contact.tick >= 1 + profile.startupTicks && contact.tick < 1 + profile.startupTicks + profile.activeTicks, 'the finite blade path contacts during the original active window');
  tick(state, profile.recoveryTicks + 50, { 0: { fire: true } });
  assert.equal(state.players[1].hp, 10000 - profile.damage); assert.equal(state.events.filter(event => event.type === 'meleeStart').length, 1);
  const turned = meleeFixture(weapon); tick(turned, 1, { 0: { fire: true, yaw: Math.PI / 2 } }); tick(turned, profile.startupTicks + profile.activeTicks, { 0: { yaw: 0 } });
  assert.equal(turned.players[1].hp, 10000);
  const covered = meleeFixture(weapon, 1.1); covered.map = { ...arena, colliders: [{ id: 'thin-cover', x: -.6, y: 0, z: -.65, w: 1.2, h: 3, d: .03 }] };
  tick(covered, 1, { 0: { fire: true } }); tick(covered, profile.startupTicks + profile.activeTicks);
  assert.equal(covered.players[1].hp, 10000); assert.equal(covered.events.some(event => event.type === 'meleeHit'), false);
  const shielded = meleeFixture(weapon, Math.min(1.8, profile.reach));
  const ally = Combat.createCombatPlayer(2); ally.team = 0; ally.z = -.75; shielded.players.push(ally);
  tick(shielded, 1, { 0: { fire: true } }); tick(shielded, profile.startupTicks + profile.activeTicks);
  assert.equal(shielded.players[1].hp, 10000); assert.equal(ally.hp, 200, 'friendly bodies block rather than receive melee damage');
});

test('tonfa hand order is stored on the physical melee item and continues after a drop', () => {
  const state = meleeFixture('tonfas'), player = state.players[0], profile = MELEE_WEAPONS.tonfas;
  tick(state, 1, { 0: { fire: true } }); tick(state, profile.startupTicks + profile.activeTicks + profile.recoveryTicks + 2);
  tick(state, 1, { 0: { fire: true } }); tick(state, profile.startupTicks + profile.activeTicks + profile.recoveryTicks + 2);
  assert.deepEqual(state.events.filter(event => event.type === 'meleeStart').map(event => event.hand), [0, 1]);
  storeInventoryGun(player); const dropped = dropInventoryItem(player, 0);
  assert.equal(dropped.meleeIndex, 2); assert.equal(dropped.meleeHand, 1);
  const recipient = Combat.createCombatPlayer(1); recipient.inventory[0] = null; refreshInventory(recipient);
  assert.equal(pickupInventoryItem(recipient, lootFromInventoryItem(dropped)).ok, true); assert.equal(recipient.meleeIndex, 2);
});

test('all configured blades validate explicit enums while Horde and Royale keep knife-only starts', () => {
  for (const weapon of MELEE_IDS) {
    const horde = Horde.createState({ melee: weapon }); assert.equal(horde.players[0].inventory[0].weapon, 'knife');
    Horde.startMatch(horde); assert.equal(horde.players[0].inventory[0].weapon, 'knife');
    assert.equal(horde.players[0].hp, 200); assert.equal(horde.players[0].inventory.length, 4);
    Horde.resetLobby(horde); assert.equal(horde.players[0].inventory[0].weapon, 'knife');
  }
  assert.equal(Horde.createState().players[0].inventory[0].weapon, 'knife');
  for (const bad of ['__proto__', 'constructor', '', null, NaN, {}, ['katana'], new String('katana')]) {
    assert.equal(createInventoryMelee(bad), null); assert.throws(() => Horde.createState({ melee: bad }), RangeError);
    const horde = Horde.createState(), before = JSON.stringify(horde.players[0]);
    assert.equal(Horde.chooseMelee(horde, 0, bad).ok, false); assert.equal(JSON.stringify(horde.players[0]), before);
    assert.equal(Combat.selectLoadout(Combat.createState(), 0, bad).ok, false);
  }
  const royale = Royale.createState({ capacity: 2 }); Royale.startMatch(royale, [0, 1]);
  assert.ok(royale.players.every(player => player.inventory[0].weapon === 'knife' && !player.hasGun));
});

test('Horde melee benefits decrease through waves 1–3 and disappear from later-wave and PvP damage', () => {
  for (const wave of [1, 2, 3, 4, 8]) {
    const { state, monster } = hordeFixture(wave);
    hordeTicks(state, 1, { fire: true }); hordeTicks(state, MELEE_WEAPONS.katana.startupTicks + MELEE_WEAPONS.katana.activeTicks - 1);
    const event = state.events.findLast(event => event.type === 'damage' && event.playerId === 0 && event.targetId === monster.id);
    assert.ok(event, `wave ${wave}: physical melee did not contact`);
    assert.equal(event.damage, Math.round(MELEE_WEAPONS.katana.damage * ([1.6, 1.4, 1.2][wave - 1] || 1)));
    assert.equal(event.headshot, false); assert.equal(event.hitKind, 'body');
  }
  const pvp = meleeFixture('katana'); tick(pvp, 1, { 0: { fire: true } }); tick(pvp, MELEE_WEAPONS.katana.startupTicks + MELEE_WEAPONS.katana.activeTicks - 1);
  assert.equal(pvp.players[1].hp, 10000 - MELEE_WEAPONS.katana.damage);
});

test('early-wave katana opens a real safe punish window while heavy brutes retain impact resistance', () => {
  const ordinary = hordeFixture(1), brute = hordeFixture(3, 'katana', 'brute');
  for (const fixture of [ordinary, brute]) {
    hordeTicks(fixture.state, 1); assert.ok(fixture.brain.attackTicks > 0, 'enemy begins a real close attack');
    hordeTicks(fixture.state, 1, { fire: true }); hordeTicks(fixture.state, MELEE_WEAPONS.katana.startupTicks);
    // Observe the actual descending cut's contact, not an assumed first slice.
    for (let active = 1; active < MELEE_WEAPONS.katana.activeTicks && !fixture.state.events.some(event => event.type === 'monsterStagger'); active++) hordeTicks(fixture.state, 1);
    assert.equal(fixture.brain.attackTicks, 0, 'accepted impact interrupts the current windup');
    assert.ok(fixture.brain.staggerTicks > 0);
    const hp = fixture.human.hp; hordeTicks(fixture.state, fixture.brain.staggerTicks - 1);
    assert.equal(fixture.human.hp, hp, 'staggered enemies cannot finish a stale windup');
  }
  assert.ok(brute.brain.staggerReadyTick > brute.state.tick);
  assert.ok(ordinary.state.events.find(event => event.type === 'monsterStagger').ticks > brute.state.events.find(event => event.type === 'monsterStagger').ticks);
});

test('six-player mixed arsenal combat and three-survivor Horde snapshots remain deterministic', () => {
  const states = [0, 1].map(() => {
    const state = Combat.createState({ teamSize: 3 }); state.map = arena;
    state.players = Array.from({ length: 6 }, (_, id) => Combat.createCombatPlayer(id, 3, GUNS[id % 3])); state.fighters = state.players;
    state.players.forEach((player, id) => { player.x = id * 3 - 7.5; player.z = id < 3 ? 8 : -8; player.yaw = id < 3 ? 0 : Math.PI; player.hp = player.maxHp = 10000; });
    return state;
  });
  for (let index = 0; index < 480; index++) for (const state of states) {
    const buttons = Object.fromEntries(state.players.map(player => [player.id, { fire: index % 24 < 12, reload: index % 180 === 179, right: index < 90, left: index >= 90 && index < 180, aim: index >= 180 }]));
    tick(state, 1, buttons);
  }
  assert.deepEqual(states[0], states[1]);
  assert.ok(states[0].players.every(player => [player.x, player.y, player.z, player.hp, player.ammo, player.shotIndex, player.lastShotHand].every(Number.isFinite)));
  const hordes = [0, 1].map(() => { const state = Horde.createState({ seed: 132477, melee: 'tonfas' }); Horde.startMatch(state, [0, 1, 2]); return state; });
  for (let index = 0; index < 650; index++) for (const state of hordes) Horde.step(state, [{ fire: index % 70 === 0, slot1: index === 361 }, { left: index > 400 && index < 430 }, { right: index > 410 && index < 440 }]);
  assert.deepEqual(hordes[0], hordes[1]);
});

test('rapid tonfa follow-ups cannot indefinitely cancel a living monster attack during stagger immunity', () => {
  const { state, human, monster } = hordeFixture(1, 'tonfas');
  for (let index = 0; index < 210 && human.alive; index++) {
    const dx = monster.x - human.x, dz = monster.z - human.z;
    Horde.step(state, [{ fire: index % 34 === 0, yaw: Math.atan2(dx, -dz), up: Math.hypot(dx, dz) > 1 }]);
  }
  const hits = state.events.filter(event => event.type === 'damage' && event.playerId === 0 && event.targetId === monster.id);
  const staggers = state.events.filter(event => event.type === 'monsterStagger' && event.targetId === monster.id);
  assert.ok(hits.length >= 4, 'several genuine fast physical impacts must exercise resistance');
  assert.ok(staggers.length < hits.length, 'follow-up hits during immunity keep their damage without restacking the stun');
  assert.ok(staggers.slice(1).every((event, index) => event.tick - staggers[index].tick >= staggers[index].ticks + Horde.HORDE_MELEE_RULES.staggerRecoveryTicks));
  assert.ok(human.hp < 200, 'the enemy retains a real attack opportunity between stuns');
  assert.ok(state.events.some(event => event.type === 'monsterAttack' && event.hit === true));
});
