import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../public/solo/ember-engine.js';
import { EMBER_VOXEL, EMBER_THEMES, createEmberMeshBuilder, getEmberRoomSolids,
  buildEmberRoomMesh, buildEmberActorGeometry, buildEmberActorMesh } from '../public/art/ember-voxel-models.js';

function inspect(mesh) {
  assert.ok(mesh instanceof Float32Array);
  assert.equal(mesh.length % 27, 0, 'complete interleaved triangles');
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.length; i += 9) {
    for (let j = 0; j < 9; j++) assert.ok(Number.isFinite(mesh[i + j]), 'finite geometry');
    for (let j = 0; j < 3; j++) { min[j] = Math.min(min[j], mesh[i + j]); max[j] = Math.max(max[j], mesh[i + j]); }
    assert.ok(Math.abs(Math.hypot(mesh[i + 3], mesh[i + 4], mesh[i + 5]) - 1) < .00001, 'unit normals');
    for (let j = 6; j < 9; j++) assert.ok(mesh[i + j] >= 0 && mesh[i + j] <= 1, 'bounded material colors');
  }
  // Back-face culling must agree with the outward normals, including posed limbs.
  for (let i = 0; i < mesh.length; i += 27) {
    const u = [0, 1, 2].map(j => mesh[i + 9 + j] - mesh[i + j]);
    const v = [0, 1, 2].map(j => mesh[i + 18 + j] - mesh[i + j]);
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    assert.ok(normal.reduce((sum, value, j) => sum + value * mesh[i + 3 + j], 0) > 0, 'outward winding');
  }
  return { min, max, vertices: mesh.length / 9 };
}

test('voxel room walls and cover use the engine collision footprints without narrowing the lanes', () => {
  const state = createState({ seed: 88, difficulty: 'nightmare' });
  const solids = getEmberRoomSolids(state), covers = solids.filter(s => s.kind === 'cover');
  assert.equal(covers.length, state.room.obstacles.length);
  state.room.obstacles.forEach((o, i) => assert.deepEqual(covers[i], {
    kind: 'cover', minX: o.x / 32, maxX: (o.x + o.width) / 32,
    minZ: o.y / 32, maxZ: (o.y + o.height) / 32, height: EMBER_VOXEL.coverHeight,
  }));
  assert.deepEqual(EMBER_VOXEL.bounds, { minX: 42 / 32, maxX: 918 / 32, minZ: 42 / 32, maxZ: 598 / 32 });
  assert.equal(solids[0].maxX, EMBER_VOXEL.bounds.minX);
  assert.equal(solids[1].minX, EMBER_VOXEL.bounds.maxX);
  assert.equal(solids[2].maxZ, EMBER_VOXEL.bounds.minZ);
  assert.equal(solids[3].minZ, EMBER_VOXEL.bounds.maxZ);
  for (const wall of solids.slice(0, 4)) assert.equal(wall.height, EMBER_VOXEL.wallHeight);
  const mesh = buildEmberRoomMesh(state), exposedColors = new Set();
  for (let i = 0; i < mesh.length; i += 9) if (Math.abs(mesh[i] - EMBER_VOXEL.bounds.minX) < .00001 && mesh[i + 3] > .99) {
    exposedColors.add(Array.from(mesh.slice(i + 6, i + 9)).map(n => n.toFixed(4)).join(','));
  }
  assert.ok(exposedColors.size >= 3, 'brick material faces reach the wall boundary instead of being hidden inside a solid box');
});

test('all three dungeon acts have finite real depth, distinct materials and a bounded static mesh', () => {
  const state = createState({ seed: 88 });
  const meshes = [];
  for (let act = 1; act <= 3; act++) {
    const mesh = buildEmberRoomMesh({ ...state, act }), stats = inspect(mesh);
    assert.ok(stats.vertices < EMBER_VOXEL.roomVertexBudget);
    assert.deepEqual(stats.min.map(x => Math.round(x * 100) / 100), [0, -.36, 0]);
    assert.deepEqual(stats.max.map(x => Math.round(x * 100) / 100), [30, 3.8, 20]);
    meshes.push(mesh);
  }
  assert.notDeepEqual(meshes[0], meshes[1]);
  assert.notDeepEqual(meshes[1], meshes[2]);
  assert.equal(new Set(EMBER_THEMES.map(t => t.stone)).size, 3);
});

test('adventurer, four enemy families and three bosses have distinct 3D silhouettes', () => {
  const meshes = [];
  for (const [kind, act, expectedHeight] of [
    ['hero', 1, 1.6], ['crawler', 1, .7], ['archer', 1, 1.6], ['charger', 1, 1.8], ['sentinel', 1, 1.7],
    ['boss', 1, 2.7], ['boss', 2, 2.9], ['boss', 3, 2.6],
  ]) {
    const mesh = buildEmberActorGeometry({ kind, act }), stats = inspect(mesh);
    assert.ok(stats.max[1] >= expectedHeight, `${kind} act ${act} has the expected height`);
    assert.ok(Math.abs(stats.min[1]) < .001, 'idle boots or feet touch the floor');
    assert.ok(stats.max[0] - stats.min[0] > .45, 'body width');
    assert.ok(stats.max[2] - stats.min[2] > .45, 'actual model depth');
    meshes.push(mesh);
  }
  for (let i = 0; i < meshes.length; i++) for (let j = i + 1; j < meshes.length; j++) assert.notDeepEqual(meshes[i], meshes[j]);
});

test('walking, sword, dodge cloak and casting change the hero pose without moving gameplay state', () => {
  const idle = buildEmberActorGeometry({ kind: 'hero' });
  for (const pose of [{ walking: true, gait: Math.PI / 2 }, { attack: .08 }, { dash: .2 }, { cast: .14 }]) {
    const mesh = buildEmberActorGeometry({ kind: 'hero', ...pose });
    inspect(mesh);
    assert.notDeepEqual(mesh, idle);
  }
  const state = createState({ seed: 91 }), before = JSON.stringify(state);
  buildEmberRoomMesh(state);
  buildEmberActorMesh(state, 20, { gaitById: new Map([['hero', 1.3]]), walkingById: new Map([['hero', true]]) });
  assert.equal(JSON.stringify(state), before);
});

test('distance-driven gait, camera-facing yaw, near-camera hero hiding and reduced motion are respected', () => {
  const state = createState({ seed: 88 });
  const plain = buildEmberActorMesh(state, 0);
  const moving = buildEmberActorMesh(state, 0, { gaitById: new Map([['hero', 1.5], [state.enemies[0].id, 1.5]]), walkingById: new Map([['hero', true]]) });
  assert.notDeepEqual(moving, plain);
  assert.notDeepEqual(buildEmberActorMesh(state, 0, { heroYaw: Math.PI }), plain);
  assert.equal(plain.length - buildEmberActorMesh(state, 0, { hideHero: true }).length, buildEmberActorGeometry({ kind: 'hero' }).length);
  assert.deepEqual(buildEmberActorMesh(state, 2, { reducedMotion: true }), buildEmberActorMesh(state, 20, { reducedMotion: true }));
});

test('maximum combat population and every room prop stay within the dynamic geometry budget', () => {
  const state = createState({ seed: 11 });
  state.enemies = Array.from({ length: 18 }, (_, i) => ({ ...state.enemies[0], type: 'boss', boss: true, id: i + 1 }));
  for (let act = 1; act <= 3; act++) for (const kind of ['boss', 'camp', 'treasure']) for (const cleared of [false, true]) {
    const mesh = buildEmberActorMesh({ ...state, act, room: { ...state.room, kind, cleared, rewardTaken: cleared } }, 3.2);
    const stats = inspect(mesh);
    assert.ok(stats.vertices < EMBER_VOXEL.actorVertexBudget);
  }
});

test('posed box transformations preserve outward faces and world positions', () => {
  const builder = createEmberMeshBuilder({ x: 7, y: 2, z: 8, yaw: Math.PI / 2 });
  builder.box(0, 0, -2, 1, 2, .5, '#ffffff', { pitch: .4, yaw: -.7, roll: .2 });
  const stats = inspect(builder.finish());
  assert.ok(stats.min[0] > 8 && stats.max[0] < 10);
  assert.ok(stats.min[2] > 7 && stats.max[2] < 9);
});
