import assert from 'node:assert/strict';
import test from 'node:test';
import { MANTLE, LEAN, WORLD, createCombatPlayer, combatStep, emptyInput, findMantleTarget, predictLocalMovement } from '../public/voxel-engine.js';
import { interpolatedVoxelState } from '../public/voxel-presentation.js';

const open = { id: 'import-movement', bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, colliders: [], sites: [] };
const crate = () => ({ ...open, colliders: [{ id: 'ledge', x: -1, y: 0, z: -4, w: 2, h: 1.4, d: 2 }] });
const fixture = (map, players = [createCombatPlayer(0, 1, 'vandal')]) => ({ gameId: 'movement-import-fixture', phase: 'fight', tick: 0, map, mapId: map.id,
  players, fighters: players, grenades: [], grenadeId: 0, bolts: [], boltId: 0, events: [], eventId: 0, loot: [], lootId: 0 });
const step = (state, controls = [{}]) => { state.tick++; combatStep(state, state.players.map((player, index) => ({ ...emptyInput(player), ...(controls[index] || {}) })), state.map); };
const sameMovement = (actual, expected) => {
  for (const field of ['x', 'y', 'z', 'mantleTicks']) assert.ok(Math.abs(actual[field] - expected[field]) < 1e-8, `${field}: ${actual[field]} vs ${expected[field]}`);
};

test('mantling rejects a thin obstruction between otherwise clear rise and landing positions', () => {
  const map = crate();
  // Both endpoints fit; this narrow raised rail occupies only the gap between
  // them. A direct transform would tunnel through it during the forward step.
  map.colliders.push({ id: 'raised-rail', x: -1, y: 1.41, z: -2.07, w: 2, h: 2, d: .02 });
  const state = fixture(map), player = state.players[0]; Object.assign(player, { z: -1.68 });
  assert.equal(findMantleTarget(player, map), null);
  const predicted = structuredClone(player), input = { up: true, jump: true };
  step(state, [input]); predictLocalMovement(predicted, { ...emptyInput(), ...input }, map);
  assert.equal(player.mantleTicks, 0, 'the obstructed climb never begins'); sameMovement(predicted, player);
});

test('a teammate occupying the landing blocks a mantle in both authority and prediction', () => {
  const map = crate(), player = createCombatPlayer(0, 2, 'vandal'), teammate = createCombatPlayer(1, 2, 'vandal');
  Object.assign(player, { z: -1.68 }); Object.assign(teammate, { z: -2.4, y: 1.4 });
  const state = fixture(map, [player, teammate]), predicted = structuredClone(player);
  assert.equal(findMantleTarget(player, map, false, state.players), null);
  const input = { up: true, jump: true }; step(state, [input]);
  predictLocalMovement(predicted, { ...emptyInput(), ...input }, map, 1, state.players);
  assert.equal(player.mantleTicks, 0); sameMovement(predicted, player);
});

test('a teammate entering an active climb stops it at contact without a later snap through', () => {
  const map = crate(), player = createCombatPlayer(0, 2, 'vandal'), teammate = createCombatPlayer(1, 2, 'vandal');
  Object.assign(player, { z: -1.68 }); Object.assign(teammate, { x: 4, z: -2.4 });
  const state = fixture(map, [player, teammate]); step(state, [{ up: true, jump: true }]);
  assert.ok(player.mantleTicks > 0);
  for (let tick = 0; tick < 19; tick++) step(state);
  Object.assign(teammate, { x: 0, y: 1.4, z: -2.4, grounded: true });
  const predicted = structuredClone(player);
  for (let tick = 0; tick < MANTLE.ticks; tick++) {
    const peers = structuredClone(state.players); step(state);
    predictLocalMovement(predicted, emptyInput(), map, 1, peers); sameMovement(predicted, player);
    if (!player.mantleTicks) break;
  }
  assert.equal(player.mantleTicks, 0, 'the new obstruction cancels the climb');
  assert.ok(player.z >= teammate.z + WORLD.radius * 2 - 1e-8, 'the body remains on the near side of the teammate');
  const stoppedZ = player.z;
  for (let tick = 0; tick < 10; tick++) step(state);
  assert.ok(Math.abs(player.z - stoppedZ) < 1e-8, 'later ticks do not restore the old mantle path');
});

test('remote peeks interpolate on the same received time bracket as their bodies', () => {
  const local = createCombatPlayer(0, 1, 'vandal'), remote = createCombatPlayer(1, 1, 'vandal'); remote.x = 5;
  const from = fixture(open, [local, remote]), to = structuredClone(from);
  Object.assign(to.players[1], { lean: 1, leanOffset: LEAN.offset, leanX: LEAN.offset, leanZ: 0 }); to.tick = 4;
  const snapshots = JSON.stringify([from, to]);
  const display = interpolatedVoxelState([{ time: 0, state: from }, { time: 40, state: to }], 20, 0);
  assert.ok(Math.abs(display.players[1].lean - .5) < 1e-9);
  assert.ok(Math.abs(display.players[1].leanX - LEAN.offset / 2) < 1e-9, 'the head is halfway through its peek rather than on the newest pose');
  assert.equal(JSON.stringify([from, to]), snapshots, 'presentation never changes received snapshots');
});

test('a verified curved movement replay interpolates the remote peek along with its replayed body', () => {
  const local = createCombatPlayer(0, 1, 'vandal'), remote = createCombatPlayer(1, 1, 'vandal'); remote.x = 5;
  const held = { ...emptyInput(), up: true, leanRight: true }; remote.previousInput = { ...held };
  const state = fixture(open, [local, remote]), from = structuredClone(state);
  for (let tick = 0; tick < 4; tick++) step(state, [{}, held]);
  const to = structuredClone(state), expected = structuredClone(from.players[1]);
  predictLocalMovement(expected, held, open, 2, from.players);
  const display = interpolatedVoxelState([{ time: 0, state: from }, { time: 4 * 1000 / 120, state: to }], 2 * 1000 / 120, 0, { predictMovement: predictLocalMovement });
  assert.ok(Math.abs(display.players[1].z - expected.z) < 1e-8);
  assert.ok(Math.abs(display.players[1].leanX - expected.leanX) < 1e-8, 'a replayed body and head share their two-tick pose');
});
