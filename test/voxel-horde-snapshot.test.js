import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatPlayer, emptyInput, combatStep } from '../public/voxel-engine.js';
import { snapshotHordeState } from '../public/voxel-horde-snapshot.js';

function firedState() {
  const arena = { id: 'wire-traces', bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [] };
  const shooter = Object.assign(createCombatPlayer(0, 1, 'shorty'), { x: .137, z: 5.19, triggerBlocked: false, yaw: .0048314 });
  const target = Object.assign(createCombatPlayer(1), { team: 1, x: .137, z: 0, hp: 200, maxHp: 200 });
  const state = { gameId: 'voxel-horde', phase: 'fight', tick: 10, eventId: 0, events: [], players: [shooter, target], fighters: [shooter, target], map: arena, grenades: [], bolts: [], horde: { brains: [{ targetId: 0 }], projectiles: [], hazards: [], teamstats: { damage: 48.75 } } };
  combatStep(state, [{ ...emptyInput(shooter), fire: true }, emptyInput(target)], arena);
  assert.equal(shooter.shots, 1); assert.equal(state.events.filter(event => event.type === 'shot').length, 15);
  return state;
}

test('actual shotgun events keep every pellet, contact, lifetime and damage while reducing trace float bytes', () => {
  const state = firedState(), before = structuredClone(state), snapshot = snapshotHordeState(state);
  assert.equal(snapshot.events.length, state.events.length);
  const spatial = new Set(['x', 'y', 'z', 'dx', 'dy', 'dz', 'distance', 'attackX', 'attackY', 'attackZ', 'hitX', 'hitY', 'hitZ']);
  function compare(original, wire, key) {
    if (typeof original === 'number' && spatial.has(key)) { assert.ok(Math.abs(wire - original) <= .0000050001, key); return; }
    if (Array.isArray(original)) { assert.equal(wire.length, original.length); original.forEach((item, index) => compare(item, wire[index])); return; }
    if (original && typeof original === 'object') { assert.deepEqual(Object.keys(wire), Object.keys(original)); for (const field of Object.keys(original)) compare(original[field], wire[field], field); return; }
    assert.equal(wire, original, key);
  }
  state.events.forEach((event, index) => compare(event, snapshot.events[index]));
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot.events)) < Buffer.byteLength(JSON.stringify(state.events)) * .85);
  assert.deepEqual(state, before);
});

test('wire compaction never rounds authoritative actors, physical projectiles, hazards or team statistics', () => {
  const state = firedState();
  state.horde.projectiles.push({ id: 1, x: 1 / 3, dx: Math.sqrt(.5), sourceLifeId: 123 });
  state.horde.hazards.push({ id: 2, x: Math.PI, ticksLeft: 108 });
  const snapshot = snapshotHordeState(state);
  assert.equal(snapshot.players, state.players); assert.equal(snapshot.horde.projectiles, state.horde.projectiles);
  assert.equal(snapshot.horde.hazards, state.horde.hazards); assert.equal(snapshot.horde.teamstats, state.horde.teamstats);
  assert.equal(snapshot.map, undefined); assert.equal(snapshot.fighters, undefined); assert.equal(snapshot.horde.brains, undefined);
  assert.equal(state.map.id, 'wire-traces'); assert.equal(state.horde.brains.length, 1);
});

test('successive snapshots reflect current events and never cache stale coordinates or strip integer records', () => {
  const event = { id: 1, tick: 17, type: 'monsterSiphon', playerId: 3, lifeId: 27, hp: 135, amount: 8, x: 1.123456789 };
  const state = { events: [event], horde: { brains: [] } }, first = snapshotHordeState(state);
  event.x = -2.234567891; event.hp = 127;
  const next = snapshotHordeState(state);
  assert.equal(first.events[0].x, 1.12346); assert.equal(next.events[0].x, -2.23457);
  assert.equal(first.events[0].hp, 135); assert.equal(next.events[0].hp, 127);
  assert.equal(next.events[0].lifeId, 27); assert.equal(next.events[0].amount, 8);
  const integer = { id: 3, tick: 19, type: 'hordeWave', wave: 9 };
  state.events = [integer]; assert.equal(snapshotHordeState(state).events[0], integer);
});
