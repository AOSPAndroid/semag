import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { MAPS } from '../public/voxel-royale-maps.js';
import { WEAPON_IDS } from '../public/voxel-weapons.js';
import { createCombatPlayer } from '../public/voxel-engine.js';
import { mapMeshes, lootMeshes, stormMesh, survivorColor, VoxelRenderer } from '../public/voxel-renderer.js';

const digest = array => createHash('sha256').update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
const vertices = array => Array.from({ length: array.length / 10 }, (_, index) => Array.from(array.slice(index * 10, index * 10 + 3)));
const pickup = (patch = {}) => ({ id: 1, kind: 'weapon', weapon: 'carbine', x: 0, y: 0, z: 0, ...patch });
const near = (a, b) => Math.abs(a - b) < 1e-4;

test('all four survival maps keep every real solid and fit the 100k static budget', () => {
  const signatures = new Set();
  for (const map of Object.values(MAPS)) {
    const meshes = mapMeshes(map), points = vertices(meshes.opaque);
    const count = (meshes.opaque.length + meshes.shadows.length) / 10;
    assert.ok(count < 100000, `${map.id}: ${count} static vertices`);
    assert.ok(meshes.opaque.every(Number.isFinite) && meshes.shadows.every(Number.isFinite));
    signatures.add(digest(meshes.opaque));
    for (const box of map.colliders) {
      // Every collider retains its complete top and bottom silhouette. This
      // detects accidental budget truncation, shifted roofs and missing walls.
      for (const x of [box.x, box.x + box.w]) for (const y of [box.y, box.y + box.h]) for (const z of [box.z, box.z + box.d]) {
        assert.ok(points.some(point => near(point[0], x) && near(point[1], y) && near(point[2], z)), `${map.id}: missing physical corner on ${box.id}`);
      }
    }
  }
  assert.equal(signatures.size, 4, 'forest, ruins, desert and Paris have distinct geometry and artwork');
});

test('survival backdrops are forest, cliff and dune silhouettes rather than city windows', () => {
  const bounds = { minX: -4, maxX: 4, minZ: -4, maxZ: 4 };
  const city = mapMeshes({ id: 'city-fixture', theme: 'courtyard', bounds, colliders: [], sites: [] });
  const signatures = new Set();
  for (const theme of ['forest', 'maze', 'desert']) {
    const mesh = mapMeshes({ id: 'theme-fixture', theme, bounds, colliders: [], sites: [] });
    assert.equal(mesh.shadows.length, 0, 'outside decoration is not physical cover');
    assert.ok(mesh.opaque.length < city.opaque.length, 'the natural backdrop omits dense city architecture');
    signatures.add(digest(mesh.opaque));
  }
  assert.equal(signatures.size, 3);
});

test('nine gun pickups and three supply kinds have distinct small finite silhouettes', () => {
  const signatures = new Set();
  for (const patch of [...WEAPON_IDS.map(weapon => ({ weapon })), ...['heal', 'ammo', 'grenade'].map(kind => ({ kind }))]) {
    const mesh = lootMeshes([pickup(patch)], 1000);
    assert.equal(mesh.count, 1);
    assert.ok(mesh.opaque.every(Number.isFinite) && mesh.contacts.every(Number.isFinite));
    assert.ok((mesh.opaque.length + mesh.contacts.length) / 10 <= 276, `${JSON.stringify(patch)}: cheap pickup silhouette`);
    assert.ok(vertices(mesh.opaque).every(([x, y, z]) => Math.abs(x) < .8 && Math.abs(z) < .8 && y > 0 && y < .5), 'pickup cannot resemble a wall or waist-high crate');
    signatures.add(digest(mesh.opaque));
  }
  assert.equal(signatures.size, 12);
  const elevated = lootMeshes([pickup({ kind: 'heal', y: 3.36 })], 1000);
  assert.ok(vertices(elevated.opaque).every(([, y]) => y > 3.36 && y < 3.86), 'roof loot stays above its actual support');
});

test('all 128 authoritative world pickups render; invalid records cannot poison geometry', () => {
  const items = Array.from({ length: 128 }, (_, id) => pickup({ id, weapon: 'sniper', x: id % 16 - 8, z: Math.floor(id / 16) - 4 }));
  const mesh = lootMeshes([pickup({ x: NaN }), pickup({ weapon: 'unknown' }), ...items]);
  assert.equal(mesh.count, 128, 'the renderer does not hide drops below the engine cap');
  assert.ok((mesh.opaque.length + mesh.contacts.length) / 10 < 40000);
  assert.ok(mesh.opaque.every(Number.isFinite));
  assert.equal(lootMeshes([...items, pickup({ id: 129 })]).count, 128, 'malformed excess state remains bounded');
});

test('safe-zone boundaries use the live circle and never produce an opaque wall', () => {
  for (const radius of [45, 22.5, 3, 0]) {
    const mesh = stormMesh({ active: true, x: 7, z: -4, radius });
    assert.equal(mesh.length / 10, 768);
    assert.ok(mesh.every(Number.isFinite));
    for (let index = 0; index < mesh.length; index += 10) {
      const distance = Math.hypot(mesh[index] - 7, mesh[index + 2] + 4);
      assert.ok(distance <= radius + .111);
      assert.ok(near(mesh[index + 1], .035) || near(mesh[index + 1], .034), 'only a ground projection, no solid vertical plane');
      assert.ok(mesh[index + 9] > 0 && mesh[index + 9] < 1, 'the boundary remains translucent');
    }
  }
  for (const storm of [undefined, { active: false, x: 0, z: 0, radius: 10 }, { active: true, x: NaN, z: 0, radius: 10 }, { active: true, x: 0, z: 0, radius: -1 }]) assert.equal(stormMesh(storm).length, 0);
});

test('all ten survivors use stable distinct free-for-all colors', () => {
  const colors = Array.from({ length: 10 }, (_, id) => survivorColor({ id, team: 0 }));
  assert.equal(new Set(colors).size, 10);
  for (let id = 0; id < 10; id++) assert.equal(survivorColor({ id, team: 9 - id }), colors[id], 'changing a team compatibility field cannot imply an alliance');
});

function rendererHarness() {
  const uniforms = new Map();
  const gl = new Proxy({}, { get(_, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (name === 'uniform1f' || name === 'uniform3fv') return (uniform, value) => uniforms.set(uniform, typeof value === 'number' ? value : [...value]);
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  const canvas = { getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) };
  const renderer = new VoxelRenderer(canvas), buffers = [];
  const upload = renderer._dynamic;
  renderer._dynamic = function(array, kind = 'world') { buffers.push({ kind, array }); return upload.call(this, array, kind); };
  return { renderer, uniforms, buffers };
}
const players = weapon => Array.from({ length: 10 }, (_, id) => ({ ...createCombatPlayer(id), id, team: id, weapon, alive: true, x: id * 2 - 10, z: 2 }));

test('a ten-player sustained volley renders all drops in seven passes with bounded effects', () => {
  const { renderer, buffers } = rendererHarness();
  const state = { gameId: 'voxel-royale', map: MAPS.forest, mapId: 'forest', phase: 'fight', round: 1, tick: 100,
    players: players('lmg'), loot: Array.from({ length: 128 }, (_, id) => pickup({ id, weapon: 'sniper', x: id % 16 - 8, z: Math.floor(id / 16) - 4 })),
    storm: { active: true, x: 0, z: 0, radius: 30 }, maxGrenades: 20,
    grenades: Array.from({ length: 20 }, (_, id) => ({ id, x: id % 10 * 2 - 10, y: .12, z: 20 + Math.floor(id / 10) * 3, radius: .12, fuseTicks: 180 })),
    events: Array.from({ length: 150 }, (_, id) => ({ id: id * 2, tick: 100, type: 'shot', weapon: 'lmg', playerId: id % 10, targetId: (id + 1) % 10, x: 0, y: 1.6, z: 4, dx: 0, dy: 0, dz: -1, hitX: 0, hitY: 1.6, hitZ: 0, hitKind: 'body', damage: 26 })).flatMap(event => [event, { ...event, id: event.id + 1, type: 'damage', attack: 'gun' }]) };
  assert.equal(renderer.render(state, { localId: 0, time: 1000 }), true);
  assert.equal(renderer.stats.lootItems, 128);
  assert.equal(renderer.stats.stormVertices, 768);
  assert.ok(renderer.stats.dynamicVertices < 72000, `${renderer.stats.dynamicVertices}: maximum pickup pile, ten LMG users and twenty live grenades`);
  const world = vertices(buffers.find(buffer => buffer.kind === 'world').array);
  for (const grenade of state.grenades) assert.ok(world.some(([x, y, z]) => Math.abs(x - grenade.x) < .13 && y >= 0 && y < .3 && Math.abs(z - grenade.z) < .13), `live frag ${grenade.id} cannot disappear below the authoritative cap`);
  assert.ok(renderer.stats.drawCalls <= 7);
  assert.equal(renderer.particles.length, 84);
  assert.ok(renderer.stats.bloodParticles > 0, 'confirmed blood shares the existing dynamic pass and bounded particle pool');
  assert.equal(renderer.tracers.length, 14);
  renderer.destroy();
});

test('dead opponents and carried tactical bombs cannot appear in the survival world', () => {
  const { renderer, uniforms, buffers } = rendererHarness();
  const state = { gameId: 'voxel-royale', map: MAPS.forest, mapId: 'forest', phase: 'fight', round: 1, tick: 1,
    players: players('carbine').map(player => ({ ...player, alive: player.id === 0 || player.id === 1 })),
    loot: [], storm: { active: true, x: 7, z: -4, radius: 20 }, events: [] };
  renderer.render(state, { localId: 0, time: 1000, hideWeapon: true });
  const alive = buffers.find(buffer => buffer.kind === 'world').array;
  assert.deepEqual(uniforms.get('uStormCircle'), [7, -4, 20]);
  assert.equal(uniforms.get('uStormStrength'), 1, 'live circle drives the outside haze');
  buffers.length = 0;
  state.bomb = { status: 'carried', carrierId: 1 };
  renderer.render(state, { localId: 0, time: 1001, hideWeapon: true });
  assert.equal(digest(buffers.find(buffer => buffer.kind === 'world').array), digest(alive), 'a compatibility bomb field cannot add tactical objective props');
  buffers.length = 0; state.players[1].alive = false;
  renderer.render(state, { localId: 0, time: 1002, hideWeapon: true });
  assert.equal(buffers.find(buffer => buffer.kind === 'world').array.length, 0, 'all dead remote survivors are omitted');
  renderer.destroy();
});
