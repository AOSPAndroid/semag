import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatPlayer, sweepPresentationOffset, separatePresentationBodies, WORLD } from '../public/voxel-engine.js';

const arena = colliders => ({ bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, colliders });
const box = (patch = {}) => ({ x: 2, y: 0, z: -2, w: 1, h: 4, d: 4, ...patch });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} versus ${b}`);

test('presentation sweeps stop at cover and slide along it without mutating input, health or velocity', () => {
  const source = createCombatPlayer(0), before = structuredClone(source);
  Object.freeze(source.previousInput); Object.freeze(source);
  const pose = sweepPresentationOffset(source, { x: 10, z: 1 }, arena([box()]));
  near(pose.x, 2 - source.radius); near(pose.z, 1);
  assert.deepEqual(source, before);
  for (const key of Object.keys(source).filter(key => !['x', 'y', 'z'].includes(key))) assert.deepEqual(pose[key], source[key], key);
});

test('floor, platform tops, ceilings and map boundaries constrain correction using body height', () => {
  const source = { ...createCombatPlayer(0), y: 4 };
  near(sweepPresentationOffset(source, { y: -10 }, arena([])).y, 0);
  near(sweepPresentationOffset(source, { y: -10 }, arena([box({ x: -1, z: -1, w: 2, d: 2, h: 2 })])).y, 2);
  const ground = createCombatPlayer(0), roof = box({ x: -1, z: -1, w: 2, d: 2, y: 3, h: 1 });
  near(sweepPresentationOffset(ground, { y: 10 }, arena([roof])).y, 3 - WORLD.standHeight);
  near(sweepPresentationOffset({ ...ground, crouching: true }, { y: 10 }, arena([roof])).y, 3 - WORLD.crouchHeight);
  near(sweepPresentationOffset(ground, { x: -100 }, arena([])).x, -20 + ground.radius);
});

test('living bodies block corrections; dead, own and vertically separated bodies do not', () => {
  const source = createCombatPlayer(0), peer = { ...createCombatPlayer(1), x: 2 };
  const before = structuredClone(peer); Object.freeze(peer);
  near(sweepPresentationOffset(source, { x: 5 }, arena([]), [peer]).x, 2 - source.radius - peer.radius);
  assert.deepEqual(peer, before);
  for (const patch of [{ alive: false }, { id: 0 }, { y: 5 }]) near(sweepPresentationOffset(source, { x: 5 }, arena([]), [{ ...peer, ...patch }]).x, 5);
});

test('invalid offsets/maps and untrusted peer coordinates cannot introduce nonfinite render poses', () => {
  const source = createCombatPlayer(0);
  for (const offset of [{ x: NaN }, { y: Infinity }, { z: 1e308 }]) assert.deepEqual(sweepPresentationOffset(source, offset, arena([])), source);
  assert.deepEqual(sweepPresentationOffset(source, { x: 1 }, 'missing-map'), source);
  assert.deepEqual(sweepPresentationOffset(source, { x: 1 }, {}), source);
  near(sweepPresentationOffset(source, { x: 1 }, arena([]), [{ alive: true, x: NaN }]).x, 1);
  assert.ok(['x', 'y', 'z'].every(axis => Number.isFinite(sweepPresentationOffset({ ...source, x: NaN }, {}, arena([]))[axis])));
});

test('mutually closing displayed bodies resolve together without changing real velocity or gameplay fields', () => {
  const players = [ { ...createCombatPlayer(1), z: -.31, vz: 5.4 }, { ...createCombatPlayer(2), z: .31, vz: -5.4 } ];
  const original = structuredClone(players); players.forEach(Object.freeze);
  const view = separatePresentationBodies(players, arena([]));
  assert.ok(view[1].z - view[0].z >= .64 - 1e-7);
  for (let index = 0; index < players.length; index++) for (const key of Object.keys(players[index]).filter(key => !['x', 'y', 'z'].includes(key))) assert.deepEqual(view[index][key], players[index][key]);
  assert.deepEqual(players, original);
  assert.deepEqual(separatePresentationBodies([...players].reverse(), arena([])).reverse(), view, 'pair resolution follows stable IDs, not snapshot array order');
});

test('a wall-pinned render crowd resolves outward without pushing either body into cover', () => {
  const players = [{ ...createCombatPlayer(0), x: .33, vx: 0 }, { ...createCombatPlayer(1), x: .92, vx: -5.4 }];
  const wall = box({ x: -1, z: -2, w: 1, h: 4, d: 4 });
  const view = separatePresentationBodies(players, arena([wall]));
  assert.ok(view[0].x >= view[0].radius - 1e-7);
  assert.ok(view[1].x - view[0].x >= .64 - 1e-7);
  assert.deepEqual(separatePresentationBodies(players, 'missing-map'), players);
  const dead = players.map(player => ({ ...player, alive: false }));
  assert.deepEqual(separatePresentationBodies(dead, arena([wall])), dead);
});
