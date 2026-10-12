import assert from 'node:assert/strict';
import test from 'node:test';
import { BLADE_GUARD, createCombatPlayer, combatStep, emptyInput } from '../public/voxel-engine.js';
import { selectInventorySlot, setInventoryMeleeLoadout } from '../public/voxel-inventory.js';

const open = { id: 'guard-open', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
const swordsman = (weapon = 'katana') => { const player = Object.assign(createCombatPlayer(1, 1, 'carbine'), { z: -8, yaw: Math.PI, hp: 1000, maxHp: 1000 }); setInventoryMeleeLoadout(player, weapon); selectInventorySlot(player, 0); return player; };
const fixture = defender => {
  const shooter = Object.assign(createCombatPlayer(0, 1, 'carbine'), { hp: 1000, maxHp: 1000 });
  const players = [shooter, defender];
  return { state: { gameId: 'guard-fixture', phase: 'fight', tick: 0, map: open, mapId: open.id, players, fighters: players, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 }, shooter, defender };
};
const step = (state, controls = []) => { state.tick++; combatStep(state, state.players.map((player, index) => ({ ...emptyInput(player), ...(controls[index] || {}) })), open); };
const aimAtBody = { pitch: Math.atan2(1 - 1.62, 8) };
const DEF = { yaw: Math.PI };

test('a held sword or katana guard blocks bullets from the front for stamina', () => {
  for (const weapon of ['sword', 'katana']) {
    const { state, shooter, defender } = fixture(swordsman(weapon));
    for (let tick = 0; tick < 20; tick++) step(state, [{}, { ...DEF, aim: true }]);
    assert.equal(defender.guarding, true, weapon);
    const stamina = defender.stamina;
    step(state, [{ fire: true, ...aimAtBody }, { ...DEF, aim: true }]);
    assert.equal(shooter.shots, 1);
    assert.equal(defender.hp, 1000, `${weapon}: the round is stopped`);
    assert.ok(defender.stamina < stamina, 'blocking costs stamina');
    assert.ok(state.events.some(event => event.type === 'bulletBlock'));
  }
});

test('the guard only covers the front, and axes, knives and tonfas cannot block bullets', () => {
  const turned = fixture(swordsman('sword'));
  for (let tick = 0; tick < 20; tick++) step(turned.state, [{}, { yaw: 0, aim: true }]);
  step(turned.state, [{ fire: true, ...aimAtBody }, { yaw: 0, aim: true }]);
  assert.ok(turned.defender.hp < 1000, 'a shot in the back lands');
  for (const weapon of ['axe', 'knife', 'tonfas']) {
    const { state, defender } = fixture(swordsman(weapon));
    for (let tick = 0; tick < 20; tick++) step(state, [{}, { ...DEF, aim: true }]);
    step(state, [{ fire: true, ...aimAtBody }, { ...DEF, aim: true }]);
    assert.ok(defender.hp < 1000, weapon);
  }
});

test('an exhausted guard breaks: the round lands and the defender staggers', () => {
  const { state, defender } = fixture(swordsman('sword'));
  for (let tick = 0; tick < 20; tick++) step(state, [{}, { ...DEF, aim: true }]);
  defender.stamina = 1;
  step(state, [{ fire: true, ...aimAtBody }, { ...DEF, aim: true }]);
  assert.ok(defender.hp < 1000);
  assert.ok(state.events.some(event => event.type === 'guardBreak'));
  assert.ok(defender.hitStunTicks > 0); assert.equal(defender.guardBroken, true);
});

test('a parry timed against a round deflects it back at the shooter', () => {
  const { state, shooter, defender } = fixture(swordsman('katana'));
  step(state, [{}, DEF]);
  // Press right-click; the parry's active window opens after its 4-tick startup.
  step(state, [{}, { ...DEF, aim: true }]);
  for (let tick = 0; tick < 5; tick++) step(state, [{}, { ...DEF, aim: true }]);
  step(state, [{ fire: true, ...aimAtBody }, { ...DEF, aim: true }]);
  assert.equal(defender.hp, 1000);
  const deflect = state.events.find(event => event.type === 'bulletDeflect');
  assert.ok(deflect?.returned, 'the round went back');
  assert.ok(shooter.hp < 1000 && shooter.hp >= 1000 - 40, `the shooter took the returned share (${1000 - shooter.hp})`);
});

test('guarding slows movement and cannot be sprinted', () => {
  const { state, defender } = fixture(swordsman('katana'));
  for (let tick = 0; tick < 90; tick++) step(state, [{}, { yaw: 0, up: true, sprint: true, aim: true }]);
  assert.equal(defender.sprinting, false);
  const speed = Math.hypot(defender.vx, defender.vz);
  assert.ok(speed < 6 * 1.12 * BLADE_GUARD.speedMultiplier + 1e-6, `${speed}`);
});
