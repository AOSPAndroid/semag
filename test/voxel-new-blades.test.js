import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, combatStep, emptyInput } from '../public/voxel-engine.js';
import { HATCHET_THROW, MELEE_WEAPONS, meleeComboLength, meleeSlashGeometry, parryProfile } from '../public/voxel-melee.js';
import { selectInventorySlot, setInventoryMeleeLoadout } from '../public/voxel-inventory.js';
import { meleeMeshes } from '../public/voxel-renderer.js';
import { VOXEL_BLADE_IMPACT_AUDIO, VOXEL_MELEE_AUDIO } from '../public/voxel-shot-audio.js';

const open = { id: 'new-blades', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
const blade = (weapon, id, fields = {}) => { const player = Object.assign(createCombatPlayer(id, 1, 'carbine'), fields); setInventoryMeleeLoadout(player, weapon); selectInventorySlot(player, 0); return player; };
const fixture = players => ({ gameId: 'new-blades', phase: 'fight', tick: 0, map: open, mapId: open.id, players, fighters: players, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 });
const step = (state, controls = []) => { state.tick++; combatStep(state, state.players.map((player, index) => ({ ...emptyInput(player), yaw: player.yaw, pitch: player.pitch, ...(controls[index] || {}) })), open); };
const run = (state, ticks, controls = () => []) => { for (let tick = 0; tick < ticks; tick++) step(state, controls(tick)); };

test('the three new blades are complete weapons with chains, sounds and models', () => {
  for (const id of ['spear', 'hatchet', 'whip']) {
    assert.ok(MELEE_WEAPONS[id], id); assert.ok(meleeComboLength(id) >= 2, id);
    assert.ok(VOXEL_MELEE_AUDIO[id] && VOXEL_BLADE_IMPACT_AUDIO[id], id);
    assert.ok(meleeMeshes({ meleeWeapon: id }).length > 0, id);
  }
  assert.ok(parryProfile('spear')); assert.equal(parryProfile('whip'), null);
});

test('the spear thrusts in a straight line and outreaches the sword', () => {
  assert.ok(MELEE_WEAPONS.spear.reach > MELEE_WEAPONS.sword.reach + .8);
  const geometry = meleeSlashGeometry({ meleeWeapon: 'spear', yaw: 0, pitch: 0 }, { origin: { x: 0, y: 1.5, z: 0 } });
  assert.equal(geometry.kind, 'stab');
  const lancer = blade('spear', 0, { z: 0, yaw: 0, pitch: -.15 }), target = blade('sword', 1, { z: -3.6, yaw: Math.PI });
  const state = fixture([lancer, target]);
  run(state, 40, tick => [{ fire: tick === 0 }]);
  assert.equal(target.hp, target.maxHp - MELEE_WEAPONS.spear.damage, 'a thrust lands where a sword cannot reach');
});

test('the hatchet throws on right click, cannot cut while away and flies back after its cooldown', () => {
  const thrower = blade('hatchet', 0, { z: 0, yaw: 0, pitch: 0 }), target = blade('sword', 1, { z: -12, yaw: 0 });
  const state = fixture([thrower, target]);
  step(state, [{ aim: true }]);
  assert.ok(state.events.some(event => event.type === 'hatchetThrow'));
  assert.equal(state.bolts.length, 1); assert.equal(state.bolts[0].weapon, 'hatchet');
  run(state, 60);
  assert.ok(target.hp < target.maxHp, 'the hatchet arcs into the target');
  const hit = state.events.find(event => event.type === 'damage' && event.weapon === 'hatchet');
  assert.ok(hit && hit.damage >= HATCHET_THROW.damage * .8);
  step(state, [{ fire: true }]);
  assert.ok(!state.events.some(event => event.type === 'meleeStart'), 'no cut with an empty hand');
  run(state, HATCHET_THROW.cooldownTicks);
  step(state, [{ fire: true }]);
  assert.ok(state.events.some(event => event.type === 'meleeStart'), 'the hatchet is back');
});

test('the chain whip catches at long range and drags its target closer', () => {
  const lasher = blade('whip', 0, { z: 0, yaw: 0, pitch: 0 }), target = blade('sword', 1, { z: -4.2, yaw: Math.PI });
  const state = fixture([lasher, target]);
  run(state, 40, tick => [{ fire: tick === 0 }]);
  assert.equal(target.hp, target.maxHp - MELEE_WEAPONS.whip.damage);
  assert.ok(target.z > -4.2 + .1, `pulled in: ${target.z}`);
});
