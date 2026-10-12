import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCombatDamage, createCombatPlayer, KNOCKBACK } from '../public/voxel-engine.js';
import { BLADE_IMPACT, meleeProfile } from '../public/voxel-melee.js';

const arena = { id: 'impact', bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 }, colliders: [], sites: [] };
const hitWith = (weapon, comboStep = 1) => {
  const attacker = Object.assign(createCombatPlayer(0, 1, 'carbine'), { meleeWeapon: weapon, slot: 'sword', z: 1 }), target = Object.assign(createCombatPlayer(1, 1, 'carbine'), { hp: 1000, maxHp: 1000 });
  const state = { phase: 'fight', tick: 10, map: arena, players: [attacker, target], fighters: [attacker, target], events: [], eventId: 0 };
  applyCombatDamage(state, [{ playerId: 0, targetId: 1, damage: 1, attack: weapon, weapon, comboStep, meleeIndex: 1, meleeStartTick: 5 }], { arena });
  return { target, state };
};
const push = target => Math.hypot(target.knockbackX, target.knockbackZ);

test('every sword, katana and axe cut staggers and shoves a player; finishers stagger longer', () => {
  for (const weapon of ['sword', 'katana', 'axe']) {
    const { target } = hitWith(weapon);
    assert.equal(target.hitStunTicks, BLADE_IMPACT[weapon].stunTicks, weapon);
    assert.ok(push(target) >= 1.4, `${weapon}: a visible shove (${push(target)})`);
    assert.ok(push(target) <= KNOCKBACK.maxPlayerSpeed + 1e-9, `${weapon}: still capped`);
    const finisher = hitWith(weapon, weapon === 'axe' ? 2 : 3);
    assert.equal(finisher.target.hitStunTicks, BLADE_IMPACT[weapon].finisherStunTicks, `${weapon} finisher`);
  }
});

test('quick blades keep their light touch', () => {
  for (const weapon of ['knife', 'tonfas']) {
    const { target } = hitWith(weapon);
    assert.equal(target.hitStunTicks, 10, weapon);
    assert.ok(push(target) < 1, `${weapon}: ${push(target)}`);
  }
  assert.equal(meleeProfile({ meleeWeapon: 'knife', meleeComboWeapon: 'knife', meleeComboStep: 1 }).playerPush, .28);
});

test('a staggered player cannot be stun-locked by a second cut inside the guard window', () => {
  const { target, state } = hitWith('sword');
  target.hitStunTicks = 0;
  applyCombatDamage(state, [{ playerId: 0, targetId: 1, damage: 1, attack: 'sword', weapon: 'sword', comboStep: 2, meleeIndex: 2, meleeStartTick: 6 }], { arena });
  assert.equal(target.hitStunTicks, 0, 'the 0.6 s guard blocks an immediate re-stun');
});
