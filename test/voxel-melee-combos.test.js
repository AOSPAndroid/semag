import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, combatStep, applyCombatDamage, emptyInput, predictLocalMovement, cloneState } from '../public/voxel-engine.js';
import { MELEE_WEAPONS, MELEE_COMBO_WINDOW_TICKS, meleeComboLength, meleeProfile, meleeSlashGeometry, clearMeleeComboContinuation } from '../public/voxel-melee.js';
import { setInventoryMeleeLoadout, selectInventorySlot, initializeInventory } from '../public/voxel-inventory.js';
import * as Royale from '../public/voxel-royale-engine.js';

const arena = { id: 'combo-fixture', bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, colliders: [], sites: [] };
function fixture(weapon = 'katana', targetWeapon = 'carbine') {
  const players = [createCombatPlayer(0), createCombatPlayer(1, 1, targetWeapon)];
  Object.assign(players[0], { x: 0, z: 0, lifeId: 1 });
  Object.assign(players[1], { x: 0, z: -1.25, lifeId: 1, hp: 3000, maxHp: 3000 });
  setInventoryMeleeLoadout(players[0], weapon, { equip: true });
  return { gameId: 'voxel-breach', phase: 'fight', tick: 0, eventId: 0, events: [], players, fighters: players, map: arena, grenades: [], bolts: [], loot: [] };
}
function step(state, input = {}, count = 1, targetInput = {}) {
  for (let tick = 0; tick < count; tick++) { state.tick++; combatStep(state, state.players.map((player, id) => ({ ...emptyInput(player), ...(id === 0 ? input : targetInput) })), state.map); }
}
function strike(state, { hit = true } = {}) {
  const [player, target] = state.players, base = MELEE_WEAPONS[player.meleeWeapon];
  Object.assign(target, { x: 0, z: hit ? -1.25 : -9, vx: 0, vz: 0, knockbackX: 0, knockbackZ: 0, knockbackTicks: 0 });
  step(state, { fire: true }); step(state, {}, base.startupTicks + base.activeTicks + base.recoveryTicks);
  return state.events.findLast(event => event.type === 'meleeStart' && event.playerId === 0);
}

for (const weapon of Object.keys(MELEE_WEAPONS)) test(`${weapon}: confirmed fresh presses produce its full finite chain and a stronger finisher`, () => {
  const state = fixture(weapon), [player, target] = state.players, length = meleeComboLength(weapon), damageBefore = target.hp;
  let expectedDamage = 0;
  for (let index = 1; index <= length; index++) {
    const start = strike(state); assert.equal(start.comboStep, index); assert.equal(start.comboLength, length); assert.equal(start.comboFinisher, index === length);
    const hit = state.events.findLast(event => event.type === 'meleeHit' && event.playerId === 0);
    assert.equal(hit.comboStep, index); assert.equal(hit.comboFinisher, index === length); assert.equal(player.meleeComboConfirmed, true);
    expectedDamage += meleeProfile({ meleeWeapon: weapon, meleeComboWeapon: weapon, meleeComboStep: index }).damage;
    assert.equal(player.meleeComboWindowTicks, MELEE_COMBO_WINDOW_TICKS);
  }
  assert.equal(target.hp, damageBefore - expectedDamage);
  const finisher = meleeProfile(player); assert.ok(finisher.damage > MELEE_WEAPONS[weapon].damage); assert.ok(finisher.pushSpeed > MELEE_WEAPONS[weapon].pushSpeed);
  assert.equal(strike(state).comboStep, 1, 'a completed chain starts a new opening cut');
});

test('held attack never advances a chain; whiffs, expired timing and physical weapon changes restart it', () => {
  const state = fixture('sword'), player = state.players[0];
  step(state, { fire: true }, 150); assert.equal(state.events.filter(event => event.type === 'meleeStart').length, 1);
  step(state); assert.equal(strike(state).comboStep, 1);
  assert.equal(strike(state, { hit: false }).comboStep, 2); assert.equal(player.meleeComboConfirmed, false);
  assert.equal(strike(state).comboStep, 1);
  step(state, {}, MELEE_COMBO_WINDOW_TICKS + 1); assert.equal(strike(state).comboStep, 1);
  selectInventorySlot(player, 1); selectInventorySlot(player, 0); assert.equal(player.meleeComboStep, 0); assert.equal(strike(state).comboStep, 1);
});

test('the existing final-recovery fresh-press buffer bridges a confirmed combo without extra held swings', () => {
  const state = fixture('katana'), player = state.players[0];
  step(state, { fire: true }); while (player.meleeTicks > 8) step(state);
  assert.equal(player.meleeComboConfirmed, true);
  step(state, { fire: true }); assert.ok(player.pendingMeleeTicks > 0);
  step(state, { fire: true }, 60);
  assert.deepEqual(state.events.filter(event => event.type === 'meleeStart').map(event => event.comboStep), [1, 2]);
  assert.equal(player.pendingMeleeTicks, 0);
});

test('combo direction reverses real finite geometry, including paired tonfas, without changing reach', () => {
  for (const weapon of ['sword', 'katana', 'axe', 'tonfas']) {
    const base = { meleeWeapon: weapon, meleeComboWeapon: weapon, meleeYaw: 0, meleePitch: 0, x: 0, y: 0, z: 0 };
    const first = meleeSlashGeometry({ ...base, meleeComboStep: 1, meleeHand: 0 }), second = meleeSlashGeometry({ ...base, meleeComboStep: 2, meleeHand: 1 });
    assert.equal(first.reach, second.reach); assert.equal(first.radius, second.radius);
    assert.ok(first.samples[0].outer.x < 0 && second.samples[0].outer.x > 0, `${weapon}: actual initial blade segment reverses`);
    assert.equal(first.samples.length, second.samples.length);
  }
});

test('neutralizing a confirmed active followup retains its committed blade but cannot rearm continuation', () => {
  const state = fixture('katana'), player = state.players[0]; strike(state);
  step(state, { fire: true }); step(state, {}, 10); assert.equal(player.meleeComboStep, 2); assert.equal(player.meleeComboConfirmed, true);
  const geometry = meleeSlashGeometry(player), profile = meleeProfile(player);
  clearMeleeComboContinuation(player); assert.equal(player.meleeComboWindowTicks, 0); assert.equal(player.meleeComboConfirmed, false);
  assert.equal(meleeProfile(player), profile); assert.deepEqual(meleeSlashGeometry(player), geometry);
  step(state, {}, 50); assert.equal(player.meleeComboStep, 0); assert.equal(strike(state).comboStep, 1);
});

test('stale attacker identity and denied contacts cannot confirm a fresh chain', () => {
  const state = fixture('knife'), player = state.players[0];
  step(state, { fire: true });
  const fake = { playerId: 0, targetId: 1, targetLifeId: 1, damage: 1, attack: 'knife', weapon: 'knife', comboStep: 1, meleeIndex: player.meleeIndex, meleeStartTick: player.meleeStartTick, attackerLifeId: 0, attackerDeaths: 0 };
  applyCombatDamage(state, [fake]); assert.equal(player.meleeComboConfirmed, false);
  applyCombatDamage(state, [{ ...fake, attackerLifeId: 1, meleeIndex: player.meleeIndex - 1 }]); assert.equal(player.meleeComboConfirmed, false);
  applyCombatDamage(state, [{ ...fake, attackerLifeId: 1, damage: 0 }]); assert.equal(player.meleeComboConfirmed, false);
});

test('an actual front-facing parry ends the cut without advancing its chain or awarding damage', () => {
  const state = fixture('knife'), [attacker, defender] = state.players;
  setInventoryMeleeLoadout(defender, 'sword', { equip: true });
  step(state, { fire: true }, 1, { aim: true, yaw: Math.PI }); step(state, {}, 14, { yaw: Math.PI });
  assert.ok(state.events.some(event => event.type === 'meleeParry'));
  assert.equal(defender.hp, 3000); assert.equal(attacker.meleeComboConfirmed, false); assert.equal(attacker.meleeComboWindowTicks, 0);
  assert.equal(state.events.some(event => event.type === 'meleeHit'), false);
});

test('a genuine seven-hit Royale knife chain rewards two finishers and clamps the lethal hit to remaining health', () => {
  const state = Royale.createState({ seed: 813 }); Royale.startMatch(state, [0, 1, 2]);
  const advance = (count, fire = false) => {
    for (let tick = 0; tick < count; tick++) {
      const [player, target] = state.players, raw = state.players.map(emptyInput);
      raw[0] = { ...raw[0], fire, yaw: Math.atan2(target.x - player.x, -(target.z - player.z)), up: Math.hypot(target.x - player.x, target.z - player.z) > 1.05 };
      Royale.step(state, raw);
    }
  };
  advance(Royale.ROYALE.countdownTicks); state.map = arena; state.loot = [];
  Object.assign(state.players[0], { x: 0, y: 0, z: 0 }); Object.assign(state.players[1], { x: 0, y: 0, z: -1.25 }); Object.assign(state.players[2], { x: 15, y: 0, z: 15 });
  for (let strike = 0; strike < 6; strike++) { advance(1, true); advance(44); }
  assert.equal(state.players[1].hp, 20); assert.equal(state.players[1].alive, true);
  advance(1, true); advance(10);
  assert.equal(state.players[1].hp, 0); assert.equal(state.players[1].alive, false); assert.equal(state.players[0].kills, 1); assert.equal(state.players[0].damageDealt, 200);
  const hits = state.events.filter(event => event.type === 'meleeHit'); assert.equal(hits.length, 7); assert.equal(hits.filter(event => event.comboFinisher).length, 2);
  assert.equal(state.events.findLast(event => event.type === 'damage').damage, 20);
});

for (const gun of ['carbine', 'vandal']) test(`${gun}: brief player stun blocks shots and held input, then permits a fresh attack after recovery`, () => {
  const state = fixture('knife', gun), victim = state.players[1];
  strike(state); assert.equal(victim.hitStunTicks, 0);
  const hit = { playerId: 0, targetId: 1, targetLifeId: 1, damage: 1, attack: 'knife', weapon: 'knife' };
  step(state, {}, 80); applyCombatDamage(state, [hit]); assert.equal(victim.hitStunTicks, 10); assert.equal(victim.hitStunReadyTicks, 72);
  const shots = victim.shots;
  step(state, {}, 30, { fire: true }); assert.equal(victim.shots, shots, 'holding through impact needs a release');
  step(state, {}, 1, { fire: false }); step(state, {}, 1, { fire: true }); assert.ok(victim.shots > shots);
  const ready = victim.hitStunReadyTicks; applyCombatDamage(state, [hit]); assert.equal(victim.hitStunTicks, 0); assert.equal(victim.hitStunReadyTicks, ready, 'immunity cannot be refreshed by another blade');
});

test('human impact movement and confirmed-chain private clocks replay exactly without publishing attack state', () => {
  const state = fixture('tonfas'); strike(state); const victim = state.players[1];
  step(state, {}, 80); applyCombatDamage(state, [{ playerId: 0, targetId: 1, damage: 1, attack: 'tonfas', weapon: 'tonfas', targetLifeId: 1 }]);
  const predicted = cloneState(victim), initial = [predicted.hp, predicted.ammo, predicted.meleeComboStep, predicted.meleeComboConfirmed, predicted.meleeComboWindowTicks, predicted.inventory];
  for (let tick = 0; tick < 20; tick++) {
    const input = { ...emptyInput(victim), right: true, fire: true };
    predictLocalMovement(predicted, input, arena); step(state, {}, 1, input);
    for (const field of ['x', 'z', 'vx', 'vz', 'hitStunTicks', 'hitStunReadyTicks']) assert.ok(Math.abs(predicted[field] - victim[field]) < 1e-8, field);
  }
  assert.deepEqual([predicted.hp, predicted.ammo, predicted.meleeComboStep, predicted.meleeComboConfirmed, predicted.meleeComboWindowTicks, predicted.inventory], initial);
});

for (const weapon of ['carbine', 'vandal']) test(`${weapon}: reload and stun expiry preserve exact movement prediction through ADS`, () => {
  const state = fixture('knife', weapon), victim = state.players[1];
  Object.assign(victim, { hitStunTicks: 6, hitStunReadyTicks: 72, reloadTicks: 1, ammo: victim.ammo - 2, triggerBlocked: true, meleeAimBlocked: true });
  const predicted = cloneState(victim), publishedAmmo = predicted.ammo, publishedReload = predicted.reloadTicks;
  for (let tick = 0; tick < 24; tick++) {
    const input = { ...emptyInput(victim), up: true, aim: true };
    predictLocalMovement(predicted, input, arena); step(state, {}, 1, input);
    for (const field of ['x', 'z', 'vx', 'vz', 'hitStunTicks', 'hitStunReadyTicks']) assert.ok(Math.abs(predicted[field] - victim[field]) < 1e-8, `${field} at ${tick}`);
  }
  assert.equal(predicted.ammo, publishedAmmo); assert.equal(predicted.reloadTicks, publishedReload);
});

test('stun blocks a new grenade, discards its held press and permits a fresh throw after recovery', () => {
  const state = fixture('knife'), victim = state.players[1]; initializeInventory(victim, { weapon: 'carbine', grenades: 1 });
  applyCombatDamage(state, [{ playerId: 0, targetId: 1, damage: 1, attack: 'knife', weapon: 'knife', targetLifeId: 1 }]);
  step(state, {}, 20, { grenade: true }); assert.equal(state.grenades.length, 0); assert.equal(victim.grenades, 1);
  step(state); step(state, {}, 1, { grenade: true }); assert.equal(state.grenades.length, 1); assert.equal(victim.grenades, 0);
});
