import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, getWorldBlock, setWorldBlock } from '../public/voxel-survival-world.js';
import { buildSurvivalChunkMesh, createSurvivalAtlas, SurvivalRenderer } from '../public/voxel-survival-renderer.js';

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
