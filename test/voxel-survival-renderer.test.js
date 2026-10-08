import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, getWorldBlock, setWorldBlock } from '../public/voxel-survival-world.js';
import { buildSurvivalChunkMesh, createSurvivalAtlas, SurvivalRenderer, SurvivalDynamicMesh } from '../public/voxel-survival-renderer.js';

const fixtureWorld = (width = 2, height = 2, depth = 2) => ({ width, height, depth, chunkSize: 8, revision: 1, chunkRevisions: new Uint32Array(Math.ceil(width / 8) * Math.ceil(depth / 8)).fill(1), blocks: new Uint8Array(width * height * depth) });
const put = (world, x, y, z, id = 4) => { world.blocks[x + world.width * (z + world.depth * y)] = id; };

test('voxel chunk meshing hides shared faces and keeps outward winding on every axis', () => {
  const world = fixtureWorld(); put(world, 0, 0, 0);
  assert.equal(buildSurvivalChunkMesh(world, 0, 0).faces, 6);
  put(world, 1, 0, 0);
  const mesh = buildSurvivalChunkMesh(world, 0, 0);
  assert.equal(mesh.faces, 10, 'the two internal touching faces are absent');
  assert.equal(mesh.count, 60);
  for (let index = 0; index < mesh.vertices.length; index += 36) {
    const a = mesh.vertices.slice(index, index + 3), b = mesh.vertices.slice(index + 12, index + 15), c = mesh.vertices.slice(index + 24, index + 27);
    const ab = b.map((value, axis) => value - a[axis]), ac = c.map((value, axis) => value - a[axis]);
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    assert.ok(cross.reduce((sum, value, axis) => sum + value * mesh.vertices[index + 3 + axis], 0) > 0, 'face triangles point outward');
  }
});

test('authored woodland meshes stay bounded, finite, and on real solid block faces', () => {
  for (const seed of ['wilds', 'survival-render-budget', 'other']) {
    const world = createWorld(seed); let total = 0;
    for (let z = 0; z < 5; z++) for (let x = 0; x < 5; x++) {
      const mesh = buildSurvivalChunkMesh(world, x, z); total += mesh.count;
      assert.ok(mesh.count < 6000, `chunk ${x}:${z}: ${mesh.count} vertices`);
      assert.ok(mesh.vertices.every(Number.isFinite));
      for (let index = 0; index < mesh.vertices.length; index += 36) {
        const center = [0, 0, 0];
        for (const offset of [0, 12, 24]) for (let axis = 0; axis < 3; axis++) center[axis] += mesh.vertices[index + offset + axis] / 3;
        const normal = mesh.vertices.slice(index + 3, index + 6);
        const inside = center.map((value, axis) => Math.floor(value - normal[axis] * .001));
        const outside = center.map((value, axis) => Math.floor(value + normal[axis] * .001));
        assert.ok(getWorldBlock(world, ...inside), 'visible face borders an actual solid cell');
        assert.equal(getWorldBlock(world, ...outside), 0, 'every emitted face borders air');
      }
    }
    assert.ok(total > 30000 && total < 80000, `${seed}: ${total} total vertices`);
  }
});

test('chunk border surfaces observe the neighboring chunk rather than generating a seam wall', () => {
  const world = fixtureWorld(16, 2, 8); put(world, 7, 0, 4); put(world, 8, 0, 4);
  assert.equal(buildSurvivalChunkMesh(world, 0, 0).faces, 5);
  assert.equal(buildSurvivalChunkMesh(world, 1, 0).faces, 5);
});

test('texture atlas is deterministic, opaque and distinguishes material grain without external assets', () => {
  const atlas = createSurvivalAtlas();
  assert.equal(atlas.width, 128); assert.equal(atlas.height, 128);
  assert.equal(atlas.pixels.length, 128 * 128 * 4);
  assert.deepEqual(createSurvivalAtlas().pixels, atlas.pixels);
  for (let index = 3; index < atlas.pixels.length; index += 4) assert.equal(atlas.pixels[index], 255, 'art never creates a transparent hole in a solid cell');
  const sample = (tile, x, y) => [...atlas.pixels.slice(((Math.floor(tile / 4) * 32 + y) * 128 + tile % 4 * 32 + x) * 4, ((Math.floor(tile / 4) * 32 + y) * 128 + tile % 4 * 32 + x) * 4 + 3)];
  assert.notDeepEqual(sample(14, 16, 1), sample(14, 16, 30), 'grass side has a real top turf seam');
  assert.notDeepEqual(sample(15, 16, 16), sample(15, 3, 3), 'cut timber has visible end grain');
  assert.notDeepEqual(sample(7, 2, 2), sample(8, 2, 2), 'coal and iron ore have distinct deposits');
});

function cacheRenderer() {
  let next = 0;
  return {
    world: null, chunks: new Map(), contextLost: false, lamps: [], particles: [], eventIds: new Set(), eventQueue: [], frameStats: {}, _lastRevision: -1,
    _clearWorld: SurvivalRenderer.prototype._clearWorld,
    gl: { STATIC_DRAW: 1, ARRAY_BUFFER: 2, createBuffer: () => ++next, deleteBuffer: () => {}, bindBuffer: () => {}, bufferData: () => {} },
  };
}
test('steady frames upload no terrain and edits rebuild only affected chunks including corner AO', () => {
  const renderer = cacheRenderer(), world = createWorld('renderer-cache');
  SurvivalRenderer.prototype._updateWorld.call(renderer, world);
  assert.equal(renderer.frameStats.uploadedChunks, 25);
  SurvivalRenderer.prototype._updateWorld.call(renderer, world);
  assert.equal(renderer.frameStats.uploadedChunks, 0);
  setWorldBlock(world, 10, 18, 10, 4);
  SurvivalRenderer.prototype._updateWorld.call(renderer, world);
  assert.equal(renderer.frameStats.uploadedChunks, 1);
  setWorldBlock(world, 7, 18, 7, 4);
  SurvivalRenderer.prototype._updateWorld.call(renderer, world);
  assert.equal(renderer.frameStats.uploadedChunks, 4, 'two adjacent chunks and their diagonal AO neighbor update');
  assert.equal(renderer.chunks.size, 25, 'resident mesh cache stays fixed at world size');
});

test('event dust is capped, deduplicated and expires on simulation time', () => {
  const renderer = { eventIds: new Set(), eventQueue: [], particles: [] };
  const state = { time: 10, events: Array.from({ length: 32 }, (_, id) => ({ id, type: 'mined', time: 10, x: id % 8, y: 5, z: 8 })) };
  SurvivalRenderer.prototype._events.call(renderer, state);
  assert.equal(renderer.particles.length, 64);
  SurvivalRenderer.prototype._events.call(renderer, state);
  assert.equal(renderer.particles.length, 64);
  SurvivalRenderer.prototype._events.call(renderer, { time: 10.5, events: [] });
  assert.equal(renderer.particles.length, 0);
});

test('pooled moving body meshes preserve outward normals and transformed cube surfaces', () => {
  const mesh = new SurvivalDynamicMesh();
  const pose = { x: 12, y: 4, z: 8, yaw: .73, pitch: -.31, scale: .7 };
  mesh.box(-.2, .1, -.3, .4, .8, .6, [.4, .5, .6], pose);
  const array = mesh.array();
  assert.equal(array.length, 36 * 12); assert.ok(array.every(Number.isFinite));
  for (let index = 0; index < array.length; index += 36) {
    const a = array.slice(index, index + 3), b = array.slice(index + 12, index + 15), c = array.slice(index + 24, index + 27);
    const ab = b.map((v, axis) => v - a[axis]), ac = c.map((v, axis) => v - a[axis]);
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const normal = array.slice(index + 3, index + 6);
    assert.ok(Math.abs(Math.hypot(...normal) - 1) < 1e-6);
    assert.ok(cross.reduce((sum, value, axis) => sum + value * normal[axis], 0) > 0, 'moving face retains outward winding');
    for (const offset of [0, 12, 24]) {
      // Invert the authored yaw/pitch to verify every point stays on its real
      // cube surface, rather than using the same forward transform as drawing.
      const x = array[index + offset] - pose.x, y = array[index + offset + 1] - pose.y, z = array[index + offset + 2] - pose.z;
      const localX = (x * Math.cos(pose.yaw) + z * Math.sin(pose.yaw)) / pose.scale;
      const rotatedZ = -x * Math.sin(pose.yaw) + z * Math.cos(pose.yaw);
      const localY = (y * Math.cos(pose.pitch) + rotatedZ * Math.sin(pose.pitch)) / pose.scale;
      const localZ = (-y * Math.sin(pose.pitch) + rotatedZ * Math.cos(pose.pitch)) / pose.scale;
      assert.ok(Math.min(Math.abs(localX + .2), Math.abs(localX - .2)) < 2e-6);
      assert.ok(Math.min(Math.abs(localY - .1), Math.abs(localY - .9)) < 2e-6);
      assert.ok(Math.min(Math.abs(localZ + .3), Math.abs(localZ - .3)) < 2e-6);
    }
  }
});

test('dense moving geometry reuses its typed backing store after warmup without stale vertices', () => {
  const mesh = new SurvivalDynamicMesh();
  const draw = boxes => {
    mesh.reset();
    for (let index = 0; index < boxes; index++) mesh.box(index % 12, 1, Math.floor(index / 12), .4, .6, .4, [.4, .5, .6], { x: 0, y: 0, z: 0, yaw: index * .1 });
    return mesh.array();
  };
  const dense = draw(144), buffer = dense.buffer;
  assert.equal(dense.length, 144 * 36 * 12);
  for (let frame = 0; frame < 240; frame++) {
    const result = draw(frame % 2 ? 144 : 12);
    assert.equal(result.buffer, buffer, 'display Hz cannot allocate a new geometry backing store');
    assert.equal(result.length, (frame % 2 ? 144 : 12) * 36 * 12, 'reset hides all old vertices');
  }
});
