import assert from 'node:assert/strict';
import test from 'node:test';
import * as Breach from '../public/voxel-engine.js';
import * as Royale from '../public/voxel-royale-engine.js';
import { MELEE, KNIFE, meleeProfile, meleeWeaponId, meleeLabel } from '../public/voxel-melee.js';

const arena = { bounds: { minX: -32, maxX: 32, minZ: -32, maxZ: 32 }, colliders: [], sites: [] };
const controls = (state, buttons = {}) => state.players.map(player => ({ ...Breach.emptyInput(player), ...(buttons[player.id] || {}) }));
function ticks(state, count = 1, buttons = {}) {
  for (let index = 0; index < count; index++) Royale.step(state, controls(state, buttons));
}
function encounter(distance = 1.5) {
  const state = Royale.createState({ seed: 81 }); Royale.startMatch(state, [0, 1, 2]);
  ticks(state, Royale.ROYALE.countdownTicks); state.map = arena; state.loot = [];
  Object.assign(state.players[0], { x: 0, y: 0, z: distance, yaw: 0, pitch: 0 });
  Object.assign(state.players[1], { x: 0, y: 0, z: 0 });
  Object.assign(state.players[2], { x: 20, y: 0, z: 20 });
  return state;
}

test('shared melee profiles preserve the Breach sword and identify the smaller Royale knife', () => {
  const sword = Breach.createCombatPlayer(0), knife = encounter().players[0];
  sword.meleeWeapon = 'sword'; sword.inventory[0].weapon = 'sword';
  assert.equal(Breach.MELEE, MELEE); assert.equal(Breach.KNIFE, KNIFE);
  assert.ok(Object.isFrozen(MELEE) && Object.isFrozen(KNIFE));
  assert.equal(meleeProfile(sword), MELEE); assert.equal(meleeWeaponId(sword), 'sword'); assert.equal(meleeLabel(sword), 'SWORD');
  assert.equal(meleeProfile(knife), KNIFE); assert.equal(meleeWeaponId(knife), 'knife'); assert.equal(meleeLabel(knife), 'KNIFE');
  assert.equal(meleeProfile({}), MELEE); assert.equal(meleeProfile({ meleeWeapon: 'unknown' }), MELEE);
  assert.ok(KNIFE.reach < MELEE.reach && KNIFE.damage < MELEE.damage && KNIFE.speed > MELEE.speed);
});

test('knife windup lasts ten ticks, contacts once, and cannot repeat from a held trigger', () => {
  const state = encounter(), [attacker, target] = state.players;
  ticks(state, 1, { 0: { fire: true } });
  assert.equal(attacker.meleePhase, 'startup'); assert.equal(attacker.meleeTicks, 44); assert.equal(target.hp, 200);
  ticks(state, 9, { 0: { fire: true } }); assert.equal(target.hp, 200);
  ticks(state, 1, { 0: { fire: true } }); assert.equal(attacker.meleePhase, 'active'); assert.equal(target.hp, 172);
  ticks(state, 8, { 0: { fire: true } }); assert.equal(attacker.meleePhase, 'recovery'); assert.equal(target.hp, 172);
  ticks(state, 60, { 0: { fire: true } }); assert.equal(attacker.meleePhase, 'idle'); assert.equal(target.hp, 172);
  assert.equal(state.events.filter(event => event.type === 'meleeStart').length, 1);
  assert.equal(state.events.filter(event => event.type === 'damage').length, 1); assert.equal(attacker.shots, 0);
  ticks(state); ticks(state, 1, { 0: { fire: true } }); ticks(state, 10); assert.equal(target.hp, 144);
});

test('the knife uses its actual short reach and solid cover blocks a reachable strike', () => {
  for (const [distance, expected] of [[1.61, 172], [1.63, 200]]) {
    const state = encounter(distance); ticks(state, 1, { 0: { fire: true } }); ticks(state, 20);
    assert.equal(state.players[1].hp, expected, `${distance}: target radius is included without extending the knife reach`);
  }
  const covered = encounter(1.5);
  covered.map = { ...arena, colliders: [{ id: 'thin-partition', x: -.5, y: 0, z: .74, w: 1, h: 2, d: .02 }] };
  ticks(covered, 1, { 0: { fire: true } }); ticks(covered, 20);
  assert.equal(covered.players[1].hp, 200); assert.equal(covered.events.some(event => event.type === 'meleeHit'), false);
});

test('a knife commits aim at startup and the closest physical body blocks a cleave', () => {
  const turning = encounter(); ticks(turning, 1, { 0: { fire: true, yaw: Math.PI / 2 } }); ticks(turning, 20, { 0: { yaw: 0 } });
  assert.equal(turning.players[1].hp, 200, 'turning the camera does not rotate a committed attack');
  const blocked = encounter(1.6); Object.assign(blocked.players[2], { x: 0, y: 0, z: .8 });
  ticks(blocked, 1, { 0: { fire: true } }); ticks(blocked, 20);
  assert.equal(blocked.players[1].hp, 200); assert.equal(blocked.players[2].hp, 172);
  assert.equal(blocked.events.filter(event => event.type === 'damage').length, 1);
});

test('a full-health Royale survivor requires eight committed knife hits and damage is clamped honestly', () => {
  const state = encounter(), [attacker, target] = state.players;
  for (let hit = 0; hit < 7; hit++) { ticks(state, 1, { 0: { fire: true } }); ticks(state, 44); }
  assert.equal(target.hp, 4); assert.equal(target.alive, true);
  ticks(state, 1, { 0: { fire: true } }); ticks(state, 10);
  assert.equal(target.hp, 0); assert.equal(target.alive, false); assert.equal(attacker.kills, 1); assert.equal(attacker.damageDealt, 200);
  assert.equal(state.events.findLast(event => event.type === 'damage').damage, 4);
  const kill = state.events.findLast(event => event.type === 'kill'); assert.equal(kill.weapon, 'knife'); assert.equal(kill.attack, 'knife');
});

test('knife movement prediction follows the authoritative faster profile without changing health or inventory', () => {
  const state = encounter(), player = state.players[0], predicted = Breach.cloneState(player);
  const initialKit = [predicted.hp, predicted.maxHp, predicted.meleeWeapon, predicted.ammo, predicted.potions];
  for (let index = 0; index < 120; index++) {
    const raw = { ...Breach.emptyInput(player), right: true };
    Breach.predictLocalMovement(predicted, raw, arena);
    Royale.step(state, controls(state, { 0: raw }));
    assert.ok(Math.abs(predicted.x - player.x) < 1e-8 && Math.abs(predicted.vx - player.vx) < 1e-8);
  }
  assert.ok(Math.abs(player.vx - 6.1) < 1e-8);
  assert.deepEqual([predicted.hp, predicted.maxHp, predicted.meleeWeapon, predicted.ammo, predicted.potions], initialKit);
});

test('picking up a gun preserves the small knife through weapon swaps and a rematch restores only that knife', () => {
  const state = encounter(), player = state.players[0];
  state.loot = [{ id: ++state.lootId, kind: 'weapon', weapon: 'smg', ammo: 12, reserve: 30, x: player.x, y: player.y, z: player.z }];
  ticks(state, 1, { 0: { interact: true } }); assert.equal(player.hasGun, true); assert.equal(player.slot, 'primary');
  assert.equal(player.meleeWeapon, 'knife'); ticks(state); ticks(state, 1, { 0: { swap: true } });
  assert.equal(player.slot, 'sword'); assert.equal(meleeProfile(player), KNIFE);
  ticks(state); ticks(state, 1, { 0: { fire: true } }); ticks(state, 10); assert.equal(state.players[1].hp, 172);
  state.map = Royale.MAPS[state.mapId]; Royale.startMatch(state, [0, 1, 2]); const fresh = state.players[0];
  assert.equal(fresh.hp, 200); assert.equal(fresh.meleeWeapon, 'knife'); assert.equal(fresh.hasGun, false);
  assert.equal(fresh.ammo + fresh.reserve + fresh.potions + fresh.grenades, 0);
});
