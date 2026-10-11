import assert from 'node:assert/strict';
import test from 'node:test';
import { EXECUTION, createCombatPlayer, combatStep, emptyInput } from '../public/voxel-engine.js';
import { MELEE_WEAPONS } from '../public/voxel-melee.js';
import { selectInventorySlot, setInventoryMeleeLoadout } from '../public/voxel-inventory.js';

const open = { id: 'exec-open', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
const blade = (weapon, id, fields = {}) => { const player = Object.assign(createCombatPlayer(id, 1, 'carbine'), fields); setInventoryMeleeLoadout(player, weapon); selectInventorySlot(player, 0); return player; };
const fixture = players => ({ gameId: 'exec-fixture', phase: 'fight', tick: 0, map: open, mapId: open.id, players, fighters: players, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 });
const step = (state, controls = []) => { state.tick++; combatStep(state, state.players.map((player, index) => ({ ...emptyInput(player), ...(controls[index] || {}) })), open); };
const swingAt = (state, ticks = 40, crouch = true) => { for (let tick = 0; tick < ticks; tick++) step(state, [{ fire: tick === 0, pitch: -.15, crouch }, { yaw: state.players[1].yaw }]); };

test('a knife from behind kills outright and heals the attacker', () => {
  const attacker = blade('knife', 0, { hp: 100 }), victim = blade('katana', 1, { z: -1.2, yaw: 0 });
  const state = fixture([attacker, victim]);
  swingAt(state);
  assert.equal(victim.alive, false, 'one stab from behind');
  const execution = state.events.find(event => event.type === 'execution');
  assert.equal(execution?.backstab, true); assert.equal(execution.healed, EXECUTION.heal);
  assert.equal(attacker.hp, 100 + EXECUTION.heal);
});

test('a standing knife from behind is an ordinary stab: backstabs need a crouched approach', () => {
  const attacker = blade('knife', 0), victim = blade('katana', 1, { z: -1.2, yaw: 0 });
  const state = fixture([attacker, victim]);
  swingAt(state, 40, false);
  assert.equal(victim.alive, true);
  assert.equal(victim.hp, victim.maxHp - MELEE_WEAPONS.knife.damage);
});

test('the same knife from the front is an ordinary stab', () => {
  const attacker = blade('knife', 0), victim = blade('katana', 1, { z: -1.2, yaw: Math.PI });
  const state = fixture([attacker, victim]);
  swingAt(state);
  assert.equal(victim.alive, true);
  assert.equal(victim.hp, victim.maxHp - MELEE_WEAPONS.knife.damage);
  assert.ok(!state.events.some(event => event.type === 'execution'));
});

test('a combo finisher kill is an execution; an ordinary kill is not', () => {
  const finish = (finisher) => {
    const attacker = blade('sword', 0, { hp: 150 }), victim = blade('katana', 1, { z: -2, yaw: Math.PI, hp: 1 });
    const state = fixture([attacker, victim]);
    if (finisher) Object.assign(attacker, { meleeComboStep: 2, meleeComboConfirmed: true, meleeComboWindowTicks: 200, meleeComboWeapon: 'sword' });
    swingAt(state, 60);
    assert.equal(victim.alive, false);
    return state.events.find(event => event.type === 'execution');
  };
  assert.equal(finish(true)?.healed, EXECUTION.heal);
  assert.equal(finish(false), undefined);
});

test('healing never exceeds full health', () => {
  const attacker = blade('knife', 0, { hp: 190 }), victim = blade('katana', 1, { z: -1.2, yaw: 0 });
  const state = fixture([attacker, victim]);
  swingAt(state);
  assert.equal(attacker.hp, attacker.maxHp);
});
