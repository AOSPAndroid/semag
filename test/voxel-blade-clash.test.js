import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, combatStep, emptyInput } from '../public/voxel-engine.js';
import { MELEE_WEAPONS } from '../public/voxel-melee.js';
import { selectInventorySlot, setInventoryMeleeLoadout } from '../public/voxel-inventory.js';
import { BLADE_WEIGHT, createBladeFeel } from '../public/voxel-blade-feel.js';

const open = { id: 'clash-open', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
const blade = (weapon, id, fields = {}) => { const player = Object.assign(createCombatPlayer(id, 1, 'carbine'), fields); setInventoryMeleeLoadout(player, weapon); selectInventorySlot(player, 0); return player; };
const fixture = players => ({ gameId: 'clash-fixture', phase: 'fight', tick: 0, map: open, mapId: open.id, players, fighters: players, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 });
const step = (state, controls = []) => { state.tick++; combatStep(state, state.players.map((player, index) => ({ ...emptyInput(player), yaw: player.yaw, pitch: -.15, ...(controls[index] || {}) })), open); };

test('two swords swinging into each other clash: no damage, both swings stop and both fighters part', () => {
  const a = blade('sword', 0, { z: 0, yaw: 0 }), b = blade('sword', 1, { z: -1.6, yaw: Math.PI });
  const state = fixture([a, b]);
  for (let tick = 0; tick < 50; tick++) step(state, [{ fire: tick === 0 }, { fire: tick === 0 }]);
  const clash = state.events.find(event => event.type === 'meleeClash');
  assert.ok(clash, 'blades met');
  assert.equal(a.hp, a.maxHp); assert.equal(b.hp, b.maxHp);
  assert.ok(!state.events.some(event => event.type === 'meleeHit'));
  assert.ok(b.z < -1.6 - .05 && a.z > .05, `pushed apart: a ${a.z} b ${b.z}`);
});

test('a cut into a defender who is not swinging lands normally', () => {
  const a = blade('sword', 0, { z: 0, yaw: 0 }), b = blade('sword', 1, { z: -1.6, yaw: Math.PI });
  const state = fixture([a, b]);
  for (let tick = 0; tick < 50; tick++) step(state, [{ fire: tick === 0 }, {}]);
  assert.ok(!state.events.some(event => event.type === 'meleeClash'));
  assert.equal(b.hp, b.maxHp - MELEE_WEAPONS.sword.damage);
});

test('a swing from behind never clashes with the target\'s own cut', () => {
  const a = blade('sword', 0, { z: 0, yaw: 0 }), b = blade('sword', 1, { z: -1.6, yaw: 0 });
  const state = fixture([a, b]);
  for (let tick = 0; tick < 50; tick++) step(state, [{ fire: tick === 0 }, { fire: tick === 0 }]);
  assert.ok(!state.events.some(event => event.type === 'meleeClash'));
  assert.ok(b.hp < b.maxHp);
});

test('blade feel: heavier blades hold the impact longer and kick harder; reduced motion is still', () => {
  const stop = weapon => { const feel = createBladeFeel(); feel.observe({ type: 'meleeHit', playerId: 0, targetId: 1, damage: 30, weapon }, 0, 1000); let ms = 0; while (feel.holding(1000 + ms)) ms++; return ms; };
  assert.ok(stop('axe') > stop('sword') && stop('sword') > stop('knife'));
  assert.equal(stop('axe'), BLADE_WEIGHT.axe.stopMs);
  const feel = createBladeFeel(); feel.sample(0);
  feel.observe({ type: 'meleeHit', playerId: 0, targetId: 1, damage: 30, weapon: 'axe', comboFinisher: true }, 0, 0);
  const kick = feel.sample(0); assert.ok(kick.pitch > 0);
  let settled; for (let ms = 16; ms <= 320; ms += 16) settled = feel.sample(ms);
  assert.ok(Math.abs(settled.pitch) < kick.pitch * .01, 'the kick settles within a fraction of a second');
  assert.deepEqual(createBladeFeel().sample(0, { reducedMotion: true }), { pitch: 0, yaw: 0, roll: 0 });
  assert.equal(feel.holding(10, { reducedMotion: true }), false);
  assert.equal(feel.observe({ type: 'meleeHit', playerId: 4, targetId: 5, damage: 30, weapon: 'sword' }, 0, 0), false, 'other fights do not shake my camera');
});

test('blade feel: an execution pulses the field of view in and back out', () => {
  const feel = createBladeFeel();
  feel.observe({ type: 'execution', playerId: 0, targetId: 1 }, 0, 0);
  assert.ok(feel.fovScale(200) < .95); assert.equal(feel.fovScale(1000), 1); assert.equal(feel.fovScale(200, { reducedMotion: true }), 1);
});
