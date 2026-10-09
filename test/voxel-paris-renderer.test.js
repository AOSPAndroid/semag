import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS as BREACH_MAPS } from '../public/voxel-maps.js';
import { MAPS as ROYALE_MAPS } from '../public/voxel-royale-maps.js';
import { createCombatPlayer } from '../public/voxel-engine.js';
import { mapMeshes, parisLandmarkMesh, VoxelRenderer } from '../public/voxel-renderer.js';

const points = array => Array.from({ length: array.length / 10 }, (_, index) => Array.from(array.slice(index * 10, index * 10 + 3)));
const pointKey = point => point.map(value => value.toFixed(3)).join(',');
const close = (a, b) => Math.abs(a - b) < 1e-4;
const catalogMaps = [BREACH_MAPS.paris, ROYALE_MAPS.paris];

test('both Paris districts retain every exact collider corner below the static budget', () => {
  for (const map of catalogMaps) {
    const mesh = mapMeshes(map), vertices = new Set(points(mesh.opaque).map(pointKey));
    assert.ok(mesh.opaque.every(Number.isFinite) && mesh.shadows.every(Number.isFinite));
    assert.ok((mesh.opaque.length + mesh.shadows.length) / 10 < 100000);
    for (const box of map.colliders) for (const x of [box.x, box.x + box.w]) for (const y of [box.y, box.y + box.h]) for (const z of [box.z, box.z + box.d]) {
      assert.ok(vertices.has(pointKey([x, y, z])), `missing shared solid corner: ${box.id}`);
    }
  }
});

test('Paris facade artwork stays on its true faces and rows align across split walls', () => {
  const base = { id: 'paris-surface-fixture', theme: 'paris', bounds: { minX: -8, maxX: 8, minZ: -8, maxZ: 8 }, colliders: [], sites: [], buildings: [] };
  const background = new Set(points(mapMeshes(base).opaque).map(pointKey));
  const pieces = [
    { id: 'paris-cafe-north-left', x: -5.9, y: 0, z: 2, w: 2.1, h: 3.6, d: .4, color: '#c7b79e', material: 'stone' },
    { id: 'paris-cafe-north-right', x: -.8, y: 0, z: 2, w: 3.9, h: 3.6, d: .4, color: '#c7b79e', material: 'stone' },
    { id: 'paris-cafe-north-lintel', x: -3.8, y: 2.45, z: 2, w: 3, h: 1.15, d: .4, color: '#c7b79e', material: 'stone' },
  ];
  for (const collider of pieces) {
    const mesh = mapMeshes({ ...base, colliders: [collider] }).opaque;
    const additions = points(mesh).filter(point => !background.has(pointKey(point)));
    assert.ok(additions.length > 0);
    for (const [x, y, z] of additions) {
      assert.ok(x >= collider.x - .027 && x <= collider.x + collider.w + .027, 'paint cannot span an entrance');
      assert.ok(y >= collider.y - .001 && y <= collider.y + collider.h + .004, 'paint cannot float above or below a wall piece');
      assert.ok(z >= collider.z - .027 && z <= collider.z + collider.d + .027, 'surface detail has no protruding fake cover');
    }
    const frames = [];
    for (let index = 0; index < mesh.length; index += 60) {
      if (close(mesh[index + 6], 0x75 / 255) && close(mesh[index + 7], 0x6f / 255) && close(mesh[index + 8], 0x65 / 255) && close(Math.abs(mesh[index + 5]), 1)) {
        const quad = points(mesh.slice(index, index + 60));
        frames.push({ left: Math.min(...quad.map(point => point[0])), bottom: Math.min(...quad.map(point => point[1])) });
      }
    }
    if (!collider.id.endsWith('lintel')) assert.ok(frames.length > 0, 'true wall segments get aligned upper windows');
    for (const frame of frames) {
      assert.ok(close(frame.left / 2.6, Math.round(frame.left / 2.6)), 'neighbor windows share the world grid');
      assert.ok(close(frame.bottom, 2.12), 'window row remains level across the doorway');
    }
  }
});

test('the Eiffel landmark is finite, inexpensive and entirely outside both collision districts', () => {
  for (const map of catalogMaps) {
    const mesh = parisLandmarkMesh(map.bounds), landmark = points(mesh);
    assert.ok(mesh.every(Number.isFinite));
    assert.ok(mesh.length / 10 < 4000);
    assert.ok(landmark.every(point => point[2] < map.bounds.minZ - 16), 'no decorative tower part becomes invisible cover in the arena');
    assert.ok(Math.max(...landmark.map(point => point[1])) > 31);
    assert.ok(landmark.some(point => Math.abs(point[0] + 9) > 6 && point[1] < .5), 'four separated feet form a broad base');
    assert.ok(!landmark.some(point => Math.abs(point[0] + 9) < 1 && Math.abs(point[2] - (map.bounds.minZ - 24)) < 1 && point[1] < 6), 'the lower arch remains visibly open');
  }
});

function rendererHarness() {
  const uniforms = new Map(), deleted = [], buffers = [];
  let nextId = 0;
  const gl = new Proxy({}, { get(_, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (name === 'uniform1f' || name === 'uniform3fv') return (uniform, value) => uniforms.set(uniform, typeof value === 'number' ? value : [...value]);
    if (name === 'deleteBuffer') return buffer => deleted.push(buffer);
    if (typeof name === 'string' && name.startsWith('create')) return () => ({ id: ++nextId });
    return () => {};
  } });
  const canvas = { getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) };
  const renderer = new VoxelRenderer(canvas), upload = renderer._dynamic;
  renderer._dynamic = function(array, kind = 'world') { buffers.push({ kind, array }); return upload.call(this, array, kind); };
  return { renderer, uniforms, deleted, buffers };
}
const survivors = (count = 2) => Array.from({ length: count }, (_, id) => ({ ...createCombatPlayer(id), id, team: id, alive: true, weapon: 'lmg', x: id * 2 - 10, z: 9 }));
const pickup = id => ({ id, kind: 'weapon', weapon: 'sniper', x: id % 16 - 8, y: 0, z: Math.floor(id / 16) - 4 });

test('same-id Paris variants cache separately, reset effects and still evict GPU buffers at three maps', () => {
  const { renderer, deleted } = rendererHarness();
  const breach = renderer._getMap(BREACH_MAPS.paris), royale = renderer._getMap(ROYALE_MAPS.paris);
  assert.notEqual(breach, royale);
  assert.notEqual(breach.opaque.count, royale.opaque.count);
  assert.equal(renderer._getMap(BREACH_MAPS.paris), breach, 'snapshots reuse the immutable catalog entry');
  const state = { gameId: 'voxel-breach', map: BREACH_MAPS.paris, mapId: 'paris', phase: 'fight', round: 1, tick: 100, players: survivors(), events: [{ id: 1, tick: 100, type: 'shot', weapon: 'lmg', playerId: 0, x: 0, y: 1.6, z: 4, dx: 0, dy: 0, dz: -1, hitX: 0, hitY: 1.6, hitZ: 0, hitKind: 'body', damage: 26 }] };
  renderer.render(state, { localId: 0, time: 1000, hideWeapon: true });
  assert.ok(renderer.tracers.length > 0 && renderer.particles.length > 0);
  renderer.render({ ...state, gameId: 'voxel-royale', map: ROYALE_MAPS.paris, events: [] }, { localId: 0, time: 1001, hideWeapon: true });
  assert.equal(renderer.tracers.length, 0);
  assert.equal(renderer.particles.length, 0);
  renderer._getMap(BREACH_MAPS.courtyard);
  renderer._getMap(ROYALE_MAPS.forest);
  assert.equal(renderer.mapCache.size, 3);
  assert.equal(deleted.length, 2, 'the evicted opaque and shadow GPU buffers are both released');
  renderer.destroy();
});

test('Paris is tactical or free-for-all according to the game, with no theme-based objective leakage', () => {
  const { renderer, uniforms, buffers } = rendererHarness();
  const state = { gameId: 'voxel-breach', map: BREACH_MAPS.paris, mapId: 'paris', phase: 'fight', round: 1, tick: 100, players: survivors(), events: [], loot: [pickup(1)], storm: { active: true, x: 0, z: 9, radius: 20 } };
  renderer.render(state, { localId: 0, time: 1000, hideWeapon: true });
  const baseline = buffers.find(buffer => buffer.kind === 'world').array.length;
  assert.equal(renderer.stats.lootItems, 1, 'physical inventory drops render in Breach as well as Royale');
  assert.equal(renderer.stats.stormVertices, 0);
  assert.equal(uniforms.get('uStormStrength'), 0);
  buffers.length = 0;
  state.bomb = { status: 'carried', carrierId: 1 };
  renderer.render(state, { localId: 0, time: 1001, hideWeapon: true });
  assert.ok(buffers.find(buffer => buffer.kind === 'world').array.length > baseline, 'the tactical bomb remains visible in Breach');
  buffers.length = 0;
  const royale = { ...state, gameId: 'voxel-royale', map: ROYALE_MAPS.paris };
  renderer.render(royale, { localId: 0, time: 1002, hideWeapon: true });
  const carriedCompatibilityBomb = buffers.find(buffer => buffer.kind === 'world').array;
  assert.equal(renderer.stats.lootItems, 1);
  assert.equal(renderer.stats.stormVertices, 768);
  assert.equal(uniforms.get('uStormStrength'), 1);
  buffers.length = 0;
  renderer.render({ ...royale, bomb: null }, { localId: 0, time: 1002, hideWeapon: true });
  assert.deepEqual(buffers.find(buffer => buffer.kind === 'world').array, carriedCompatibilityBomb, 'Royale cannot gain a tactical bomb from a compatibility field');
  renderer.destroy();
});

test('ten-player Paris firefights keep all world loot and live grenades inside the rendering budget', () => {
  const { renderer, buffers } = rendererHarness();
  const state = { gameId: 'voxel-royale', map: ROYALE_MAPS.paris, mapId: 'paris', phase: 'fight', round: 1, tick: 100, players: survivors(10),
    loot: Array.from({ length: 128 }, (_, id) => pickup(id)), storm: { active: true, x: 0, z: 9, radius: 20 }, maxGrenades: 20,
    grenades: Array.from({ length: 20 }, (_, id) => ({ id, x: id % 10 * 2 - 10, y: .12, z: 22 + Math.floor(id / 10) * 3, radius: .12, fuseTicks: 180 })),
    events: Array.from({ length: 150 }, (_, id) => ({ id, tick: 100, type: 'shot', weapon: 'lmg', playerId: id % 10, x: 0, y: 1.6, z: 4, dx: 0, dy: 0, dz: -1, hitX: 0, hitY: 1.6, hitZ: 0, hitKind: 'body', damage: 26 })) };
  assert.equal(renderer.render(state, { localId: 0, time: 1000 }), true);
  assert.equal(renderer.stats.lootItems, 128);
  assert.equal(renderer.stats.stormVertices, 768);
  assert.ok(renderer.stats.mapVertices < 100000);
  assert.ok(renderer.stats.dynamicVertices < 72000, `${renderer.stats.dynamicVertices}: full ten-player stress frame`);
  assert.ok(renderer.stats.drawCalls <= 7);
  assert.equal(renderer.particles.length, 84);
  assert.equal(renderer.tracers.length, 14);
  assert.ok(buffers.every(buffer => buffer.array.every(Number.isFinite)));
  const world = points(buffers.find(buffer => buffer.kind === 'world').array);
  for (const grenade of state.grenades) assert.ok(world.some(([x, y, z]) => Math.abs(x - grenade.x) < .13 && y >= 0 && y < .3 && Math.abs(z - grenade.z) < .13), `live grenade ${grenade.id} stays visible`);
  renderer.destroy();
});
