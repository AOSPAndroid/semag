import assert from 'node:assert/strict';
import test from 'node:test';
import { createLootPresenter, lootMeshes, VoxelRenderer } from '../public/voxel-renderer.js';
import { createState, startMatch } from '../public/voxel-royale-engine.js';
import { createState as breachState } from '../public/voxel-engine.js';

function nearMesh(actual, expected, label) {
  assert.equal(actual.length, expected.length, label);
  for (let at = 0; at < actual.length; at++) assert.ok(Math.abs(actual[at] - expected[at]) < .000004, `${label}: ${at}`);
}
function forest() {
  const state = createState({ mapId: 'forest', capacity: 10, seed: 3200319 });
  startMatch(state, Array.from({ length: 10 }, (_, id) => id));
  return state;
}

test('cached pickup art preserves every surface, marker and bob through fresh network object identities', () => {
  const state = forest(), present = createLootPresenter();
  let opaqueBuffer, contactsBuffer;
  for (const time of [0, 4.2, 16.7, 250, 1500, 15000]) {
    const items = state.loot.map(item => ({ ...item })), old = lootMeshes(items, time), current = present(items, time);
    assert.equal(current.count, old.count);
    nearMesh(current.opaque, old.opaque, 'opaque art');
    assert.deepEqual(current.contacts, old.contacts, 'ground rings never follow floating items');
    if (opaqueBuffer) assert.equal(current.opaque.buffer, opaqueBuffer, 'frames reuse typed geometry storage');
    if (contactsBuffer) assert.equal(current.contacts.buffer, contactsBuffer);
    opaqueBuffer = current.opaque.buffer; contactsBuffer = current.contacts.buffer;
  }
  assert.equal(present.getStats().builds, state.loot.length, 'unchanged pickups assemble only once');
});

test('pickup changes and removals invalidate only affected geometry and never retain departed supplies', () => {
  const state = forest(), present = createLootPresenter();
  present(state.loot, 0);
  const originalCount = state.loot.length;
  const changed = state.loot.map(item => ({ ...item }));
  changed[0] = { ...changed[0], y: changed[0].y + 3 };
  nearMesh(present(changed, 50).opaque, lootMeshes(changed, 50).opaque, 'moved pickup');
  assert.equal(present.getStats().builds, originalCount + 1);
  changed.splice(0, 4);
  const current = present(changed, 100);
  assert.equal(current.count, originalCount - 4);
  assert.equal(present.getStats().cachedItems, changed.length);
  assert.equal(present.getStats().builds, originalCount + 1);
  present.reset();
  assert.equal(present.getStats().cachedItems, 0);
  assert.equal(present.getStats().builds, 0);
  assert.equal(present([], 120).opaque.length, 0);
});

test('malformed and excessive pickups cannot expand the retained art cache beyond the gameplay limit', () => {
  const present = createLootPresenter(), items = Array.from({ length: 256 }, (_, id) => ({ id, kind: 'heal', x: id % 40, y: 3, z: Math.floor(id / 40) }));
  const result = present([{ id: 'bad', kind: 'weapon', weapon: 'missing', x: 0, y: 0, z: 0 }, { id: 'nan', kind: 'heal', x: NaN, y: 0, z: 0 }, ...items], 0);
  assert.equal(result.count, 128);
  assert.equal(present.getStats().cachedItems, 128);
  present(items.slice(128), 100);
  assert.equal(present.getStats().cachedItems, 128, 'previous match props are evicted rather than accumulated');
  assert.ok(present.getStats().bufferBytes < 4 * 1024 * 1024);
});

function renderer() {
  const gl = new Proxy({}, { get(_, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  return new VoxelRenderer({ width: 960, height: 540, getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) });
}

test('steady real render frames reuse world, contact and weapon buffers with unchanged geometry budgets', () => {
  const visual = renderer(), state = breachState({ teamSize: 3, mapId: 'paris' });
  state.phase = 'fight';
  for (const player of state.players) { player.vx = 2; player.vz = -3; }
  const buffers = new Map(), original = visual._dynamic;
  let repeats = 0;
  visual._dynamic = function(array, kind = 'world') {
    if (buffers.has(kind)) { assert.equal(array.buffer, buffers.get(kind), `${kind}: typed storage reused`); repeats++; }
    else buffers.set(kind, array.buffer);
    assert.equal(array.length % 30, 0);
    assert.ok(array.every(Number.isFinite));
    return original.call(this, array, kind);
  };
  for (let frame = 0; frame < 8; frame++) visual.render(state, { localId: 0, time: 1000 + frame * 1000 / 120 });
  assert.ok(repeats >= 20);
  assert.ok(visual.stats.dynamicVertices > 0 && visual.stats.dynamicVertices < 72000);
  visual.destroy();
});
