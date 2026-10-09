import assert from 'node:assert/strict';
import test from 'node:test';
import { combatStep, createCombatPlayer, createState, cloneState, emptyInput, selectMeleeLoadout, selectLoadout, startMatch, resetLobby } from '../public/voxel-engine.js';
import { MELEE, KNIFE, MELEE_IDS, MELEE_WEAPONS, meleeProfile, meleeHand } from '../public/voxel-melee.js';
import { WEAPONS, weaponDamage, weaponHand } from '../public/voxel-weapons.js';
import { createInventoryMelee, initializeInventory, selectInventorySlot, setInventoryMeleeLoadout, pickupInventoryItem, dropInventoryItem, lootFromInventoryItem } from '../public/voxel-inventory.js';
import * as Royale from '../public/voxel-royale-engine.js';

const arena = { id: 'arsenal-contact-fixture', bounds: { minX: -32, maxX: 32, minZ: -32, maxZ: 32 }, colliders: [], sites: [] };
function encounter({ weapon = 'carbine', blade = 'katana', distance = 2, melee = false } = {}) {
  const players = [createCombatPlayer(0, 1, weapon), createCombatPlayer(1)];
  Object.assign(players[0], { z: distance, yaw: 0, pitch: 0 });
  setInventoryMeleeLoadout(players[0], blade, { equip: melee });
  return { gameId: 'arsenal-fixture', tick: 0, phase: 'fight', map: arena, mapId: arena.id, players, fighters: players, events: [], eventId: 0, grenades: [], grenadeId: 0, bolts: [], boltId: 0, loot: [], lootId: 0 };
}
function ticks(state, count = 1, input = {}, options = {}) {
  for (let index = 0; index < count; index++) {
    state.tick++;
    const controls = state.players.map(player => ({ ...emptyInput(player), ...(input[player.id] || {}) }));
    combatStep(state, controls, state.map, options);
  }
}
const shots = state => state.events.filter(event => event.type === 'shot');

test('five immutable melee profiles preserve baseline knife and sword numbers and distinct new tradeoffs', () => {
  assert.deepEqual(MELEE_IDS, ['knife', 'sword', 'katana', 'axe', 'tonfas']);
  assert.deepEqual([KNIFE.startupTicks, KNIFE.activeTicks, KNIFE.recoveryTicks, KNIFE.damage, KNIFE.reach, KNIFE.arcRadians, KNIFE.speed], [10, 8, 26, 28, 1.3, .64, 6.1]);
  assert.deepEqual([MELEE.startupTicks, MELEE.activeTicks, MELEE.recoveryTicks, MELEE.damage, MELEE.reach, MELEE.arcRadians, MELEE.speed], [18, 12, 42, 55, 2.15, .64, 5.85]);
  for (const id of MELEE_IDS) { assert.ok(Object.isFrozen(MELEE_WEAPONS[id])); assert.equal(meleeProfile(id), MELEE_WEAPONS[id]); }
  const { katana, axe, tonfas } = MELEE_WEAPONS;
  assert.ok(katana.reach > MELEE.reach && katana.arcRadians < MELEE.arcRadians);
  assert.ok(axe.damage > MELEE.damage && axe.startupTicks > MELEE.startupTicks && axe.speed < MELEE.speed);
  assert.ok(tonfas.startupTicks < KNIFE.startupTicks && tonfas.recoveryTicks < KNIFE.recoveryTicks && tonfas.reach < katana.reach);
  assert.equal(meleeHand('tonfas', 1), 0); assert.equal(meleeHand('tonfas', 2), 1);
  assert.equal(createInventoryMelee('__proto__'), null);
  for (const value of [['katana'], { toString: () => 'katana' }, new String('katana'), null]) {
    assert.equal(createInventoryMelee(value), null); assert.equal(meleeProfile({ meleeWeapon: value }), MELEE);
  }
});

for (const blade of ['katana', 'axe', 'tonfas']) test(`${blade} uses real startup, once-per-swing contact, committed aim, reach and ally/cover blockers`, () => {
  const profile = MELEE_WEAPONS[blade];
  const state = encounter({ blade, distance: profile.reach + .28, melee: true });
  ticks(state, 1, { 0: { fire: true } });
  ticks(state, profile.startupTicks - 1, { 0: { fire: true } });
  assert.equal(state.players[1].hp, 200, 'windup cannot apply early damage');
  ticks(state, 1, { 0: { fire: true } });
  assert.equal(state.players[0].meleePhase, 'active');
  assert.equal(state.players[1].hp, 200, 'the blade has not crossed this far central target on its first active slice');
  ticks(state, profile.activeTicks - 1, { 0: { fire: true } });
  assert.equal(state.players[1].hp, 200 - profile.damage);
  const contact = state.events.find(event => event.type === 'meleeHit');
  assert.ok(contact.tick >= 1 + profile.startupTicks && contact.tick < 1 + profile.startupTicks + profile.activeTicks, 'contact must resolve inside the original active window');
  ticks(state, profile.recoveryTicks + 10, { 0: { fire: true } });
  assert.equal(state.players[1].hp, 200 - profile.damage, 'held trigger and active frames never duplicate contact');
  assert.equal(state.events.filter(event => event.type === 'meleeHit').length, 1);
  const distant = encounter({ blade, distance: profile.reach + .30, melee: true });
  ticks(distant, 1, { 0: { fire: true } }); ticks(distant, profile.startupTicks + profile.activeTicks);
  assert.equal(distant.players[1].hp, 200);
  const covered = encounter({ blade, distance: 1.2, melee: true });
  covered.map = { ...arena, colliders: [{ id: 'thin-real-cover', x: -.5, y: 0, z: .58, w: 1, h: 2, d: .02 }] };
  ticks(covered, 1, { 0: { fire: true } }); ticks(covered, profile.startupTicks + profile.activeTicks);
  assert.equal(covered.players[1].hp, 200);
  const turning = encounter({ blade, distance: 1.2, melee: true });
  ticks(turning, 1, { 0: { fire: true, yaw: Math.PI / 2 } }); ticks(turning, profile.startupTicks + profile.activeTicks, { 0: { yaw: 0 } });
  assert.equal(turning.players[1].hp, 200, 'turning the camera cannot redirect a committed swing');
  const allied = encounter({ blade, distance: 1.6, melee: true }), ally = createCombatPlayer(2);
  Object.assign(ally, { team: 0, z: .8 }); allied.players.push(ally);
  ticks(allied, 1, { 0: { fire: true } }); ticks(allied, profile.startupTicks + profile.activeTicks);
  assert.equal(allied.players[1].hp, 200); assert.equal(ally.hp, 200);
});

test('mode-specific melee hooks only scale and stagger accepted contacts while default PvP stays unchanged', () => {
  const state = encounter({ blade: 'katana', distance: 1.8, melee: true }), contacts = [];
  const options = { meleeDamageScale: (current, attacker, target, profile) => {
    assert.equal(current, state); assert.equal(attacker.id, 0); assert.equal(target.id, 1); assert.equal(profile.id, 'katana'); return 1.6;
  }, onMeleeHit: (current, hit, attacker, target, profile) => contacts.push([current === state, hit.damage, attacker.id, target.id, profile.id]) };
  ticks(state, 1, { 0: { fire: true } }, options); ticks(state, 30, {}, options);
  assert.equal(state.players[1].hp, 123); assert.deepEqual(contacts, [[true, 77, 0, 1, 'katana']]);
  const normal = encounter({ blade: 'katana', distance: 1.8, melee: true }); ticks(normal, 1, { 0: { fire: true } }); ticks(normal, 30);
  assert.equal(normal.players[1].hp, 152);
  const blocked = encounter({ blade: 'katana', distance: 1.8, melee: true });
  blocked.map = { ...arena, colliders: [{ id: 'hook-cover', x: -.5, y: 0, z: .8, w: 1, h: 2, d: .02 }] };
  let called = false; ticks(blocked, 1, { 0: { fire: true } }, { onMeleeHit: () => called = true }); ticks(blocked, 30, {}, { onMeleeHit: () => called = true });
  assert.equal(called, false);
});

test('accepted paired-pistol presses alternate one finite round and a fresh recovery press is retained once', () => {
  const state = encounter({ weapon: 'dualpistols', distance: 8 }); state.players[1].hp = state.players[1].maxHp = 2000;
  ticks(state, 1, { 0: { fire: true } }); ticks(state, 1); ticks(state, 1, { 0: { fire: true } });
  ticks(state, 13);
  assert.equal(shots(state).length, 1);
  ticks(state);
  assert.deepEqual(shots(state).map(shot => shot.hand), [0, 1]);
  assert.equal(state.players[0].ammo, 22); assert.equal(state.players[0].shots, 2);
  ticks(state, 60, { 0: { fire: true } });
  // This genuinely fresh press fires once, then a held trigger remains silent.
  assert.equal(shots(state).length, 3); assert.equal(state.players[0].ammo, 21);
  assert.deepEqual(shots(state).map(shot => shot.hand), [0, 1, 0]);
});

test('pending paired-pistol presses cannot leak through a reload or inventory swap', () => {
  for (const interrupt of [{ reload: true }, { swap: true }]) {
    const state = encounter({ weapon: 'dualpistols' });
    ticks(state, 1, { 0: { fire: true } }); ticks(state); ticks(state, 1, { 0: { fire: true } }); ticks(state, 1, { 0: interrupt }); ticks(state, 30);
    assert.equal(shots(state).length, 1); assert.equal(state.players[0].pendingFireTicks, 0);
  }
});

test('automatic paired SMGs alternate accepted hands at exact cadence and share finite ammunition/reload', () => {
  const state = encounter({ weapon: 'dualsmg', distance: 8 }), player = state.players[0]; state.players[1].hp = state.players[1].maxHp = 2000;
  player.ammo = 3; player.reserve = 2;
  ticks(state, 50, { 0: { fire: true } });
  assert.deepEqual(shots(state).map(shot => [shot.tick, shot.hand]), [[1, 0], [7, 1], [13, 0]]);
  assert.equal(player.ammo, 0); assert.equal(player.reserve, 2); assert.equal(player.shots, 3);
  ticks(state); ticks(state, 1, { 0: { reload: true } }); assert.equal(player.reloadTicks, 300);
  ticks(state, 300); assert.equal(player.ammo, 2); assert.equal(player.reserve, 0);
  ticks(state, 1, { 0: { fire: true } }); assert.equal(shots(state).at(-1).hand, 1); assert.equal(player.lastShotHand, 1); assert.equal(player.ammo, 1);
});

test('slug shotgun emits one contact per shell, preserves press cadence, rewards headshots and falls off', () => {
  for (const [pitch, kind, damage] of [[0, 'head', 216], [-.08, 'body', 120]]) {
    const state = encounter({ weapon: 'slugshotgun', distance: 8 });
    ticks(state, 110, { 0: { fire: true, pitch } });
    assert.equal(shots(state).length, 1); assert.equal(shots(state)[0].pelletCount, 1); assert.equal(shots(state)[0].hitKind, kind);
    assert.equal(state.players[1].hp, Math.max(0, 200 - damage)); assert.equal(state.players[0].ammo, 4);
  }
  assert.ok(weaponDamage('slugshotgun', 'body', 60) < weaponDamage('slugshotgun', 'body', 8));
  assert.equal(weaponDamage('slugshotgun', 'head', 8), 216, 'a precise close headshot can defeat a full-health player');
});

test('real cover blocks both paired guns and slug damage without consuming a second round', () => {
  for (const weapon of ['dualpistols', 'dualsmg', 'slugshotgun']) {
    const state = encounter({ weapon, distance: 8 });
    state.map = { ...arena, colliders: [{ id: 'shared-eye-origin-cover', x: -.4, y: 0, z: 4, w: .8, h: 2, d: .1 }] };
    ticks(state, 1, { 0: { fire: true } });
    assert.equal(shots(state).length, 1); assert.equal(shots(state)[0].hitKind, 'wall'); assert.equal(state.players[1].hp, 200);
    assert.equal(state.players[0].ammo, WEAPONS[weapon].magazine - 1);
  }
});

test('physical paired gun and tonfa inventory preserve hand cadence and recovery through holster/drop/pickup', () => {
  const state = encounter({ weapon: 'dualpistols', blade: 'tonfas' }), player = state.players[0];
  ticks(state, 1, { 0: { fire: true } }); selectInventorySlot(player, 0); ticks(state, 1, { 0: { fire: true } });
  ticks(state); ticks(state, 1, { 0: { fire: true } }); ticks(state, 8);
  const blade = dropInventoryItem(player);
  assert.equal(blade.weapon, 'tonfas'); assert.equal(blade.meleeIndex, 1); assert.equal(blade.meleeHand, 0); assert.ok(blade.meleeCooldown > 0);
  assert.equal(pickupInventoryItem(player, lootFromInventoryItem(blade)).ok, true); assert.equal(player.meleeIndex, 1);
  selectInventorySlot(player, 1); const gun = dropInventoryItem(player);
  assert.equal(gun.weapon, 'dualpistols'); assert.equal(gun.shotIndex, 1); assert.equal(gun.lastShotHand, 0); assert.equal(gun.pendingFireTicks, 0);
  assert.equal(pickupInventoryItem(player, lootFromInventoryItem(gun)).ok, true);
  ticks(state, 30); ticks(state, 1, { 0: { fire: true } });
  assert.equal(shots(state).at(-1).hand, 1);
});

test('Breach close-combat selection validates enum and phase while starts and rematches restore the fixed knife', () => {
  const state = createState();
  assert.equal(selectMeleeLoadout(state, 0, '__proto__').ok, false); assert.equal(selectMeleeLoadout(state, 0, 'constructor').ok, false);
  for (const value of [['katana'], { toString: () => 'katana' }, new String('katana'), null]) assert.equal(selectMeleeLoadout(state, 0, value).ok, false);
  assert.equal(selectMeleeLoadout(state, .5, 'katana').ok, false);
  const before = JSON.stringify(state);
  assert.equal(selectMeleeLoadout(state, 0, 'katana').ok, false); assert.equal(JSON.stringify(state), before);
  assert.equal(selectMeleeLoadout(state, 0, 'knife').changed, false);
  selectLoadout(state, 0, 'dualpistols'); startMatch(state);
  assert.equal(state.players[0].inventory[0].weapon, 'knife'); assert.equal(state.players[0].inventory[1].weapon, 'dualpistols');
  state.phase = 'fight'; assert.equal(selectMeleeLoadout(state, 0, 'axe').ok, false);
  resetLobby(state); assert.equal(state.players[0].meleeLoadout, 'knife'); assert.equal(state.players[0].inventory[0].weapon, 'knife');
});

test('Royale seeds every new blade while every participant still starts with only the small knife', () => {
  for (const mapId of Object.keys(Royale.MAPS)) {
    const state = Royale.createState({ mapId, seed: 920 }); Royale.startMatch(state, [0, 1]);
    assert.deepEqual(new Set(state.loot.filter(loot => loot.kind === 'melee').map(loot => loot.weapon)), new Set(['sword', 'katana', 'axe', 'tonfas']));
    for (const player of state.players.filter(player => player.participating)) assert.deepEqual(player.inventory.map(item => item?.weapon || null), ['knife', null, null, null]);
  }
});

test('new ranged/melee profiles replay identical commands into identical snapshots', () => {
  for (const weapon of ['dualpistols', 'dualsmg', 'slugshotgun']) {
    const server = encounter({ weapon, blade: 'tonfas', distance: 5 }), client = cloneState(server);
    server.players[1].hp = client.players[1].hp = 2000;
    for (let tick = 0; tick < 320; tick++) {
      const input = { 0: { fire: tick % 19 === 0 || weapon === 'dualsmg', reload: tick === 180, swap: tick === 100 || tick === 140, right: tick < 60, yaw: .08 * Math.sin(tick / 20) } };
      ticks(server, 1, input); ticks(client, 1, input);
      assert.deepEqual(client, server, `${weapon} tick ${tick}`);
    }
  }
  assert.equal(weaponHand('dualpistols', 1), 0); assert.equal(weaponHand('dualpistols', 2), 1); assert.equal(weaponHand('carbine', 2), 0);
});
