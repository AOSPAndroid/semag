import assert from 'node:assert/strict';
import test from 'node:test';
import { PUNCH, INPUT_KEYS, createCombatPlayer, combatStep, emptyInput } from '../public/voxel-engine.js';
import { selectInventorySlot, setInventoryMeleeLoadout } from '../public/voxel-inventory.js';
import { FPS_EDGE_ACTIONS } from '../public/voxel-input-queue.js';
import { controlForKey } from '../public/voxel-client.js';

const open = { id: 'punch-open', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [], sites: [] };
const fixture = (attackerFields = {}, targetFields = {}) => {
  const a = Object.assign(createCombatPlayer(0, 1, 'carbine'), { z: 0, yaw: 0 }, attackerFields), b = Object.assign(createCombatPlayer(1, 1, 'carbine'), { z: -1.1, yaw: Math.PI }, targetFields);
  const players = [a, b];
  return { a, b, state: { gameId: 'punch', phase: 'fight', tick: 0, map: open, players, fighters: players, grenades: [], bolts: [], events: [], eventId: 0, loot: [] } };
};
const step = (state, controls = []) => { state.tick++; combatStep(state, state.players.map((p, i) => ({ ...emptyInput(p), yaw: p.yaw, pitch: 0, ...(controls[i] || {}) })), open); };
const run = (state, ticks, controls = () => []) => { for (let t = 0; t < ticks; t++) step(state, controls(t)); };

test('V is the punch key and a quick tap survives the network input queue', () => {
  assert.ok(INPUT_KEYS.includes('punch')); assert.ok(FPS_EDGE_ACTIONS.includes('punch'));
  assert.equal(controlForKey({ key: 'v', code: 'KeyV' }), 'punch');
  assert.equal(controlForKey({ key: 't', code: 'KeyT' }), 'swap', 'quick swap moved to T');
});

test('a jab with a gun in hand hurts a little, shoves and briefly staggers', () => {
  const { a, b, state } = fixture();
  run(state, 30, t => [{ punch: t === 0 }]);
  assert.equal(b.hp, b.maxHp - PUNCH.damage);
  assert.ok(b.z < -1.1 - .1, `pushed back: ${b.z}`);
  assert.ok(state.events.some(e => e.type === 'meleeStun' && e.targetId === 1));
  assert.ok(state.events.some(e => e.type === 'punchHit')); assert.equal(a.slot, 'primary', 'the gun stays in the right hand');
});

test('the punch has its own cooldown: mashing V lands once per window', () => {
  const { b, state } = fixture();
  run(state, PUNCH.cooldownTicks - 10, t => [{ punch: t % 4 === 0 }]);
  assert.equal(state.events.filter(e => e.type === 'punchStart').length, 1);
  assert.equal(b.hp, b.maxHp - PUNCH.damage);
});

test('a jab knocks a raised sword guard down and cancels a heavy charge', () => {
  const { b, state } = fixture({}, {});
  setInventoryMeleeLoadout(b, 'sword'); selectInventorySlot(b, 0);
  run(state, 50, () => [{}, { aim: true }]);
  assert.equal(b.guarding, true);
  b.heavyChargeTicks = 40;
  run(state, 10, t => [{ punch: t === 0 }, { aim: true }]);
  assert.equal(b.guardBroken, true); assert.equal(b.guarding, false); assert.equal(b.heavyChargeTicks, 0);
});

test('a punch misses outside its short frontal reach', () => {
  for (const fields of [{ z: -3 }, { z: 1.1 }]) {
    const { b, state } = fixture({}, fields);
    run(state, 20, t => [{ punch: t === 0 }]);
    assert.equal(b.hp, b.maxHp, JSON.stringify(fields));
  }
});
