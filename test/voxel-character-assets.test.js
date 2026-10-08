import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createCombatPlayer, WORLD, HEAL, playerHeight } from '../public/voxel-engine.js';
import { MAPS as ROYALE_MAPS } from '../public/voxel-royale-maps.js';
import { operativeMeshes, lootMeshes, VoxelRenderer } from '../public/voxel-renderer.js';

const vertices = mesh => Array.from({ length: mesh.length / 10 }, (_, index) => Array.from(mesh.slice(index * 10, index * 10 + 3)));
const digest = mesh => createHash('sha256').update(new Uint8Array(mesh.buffer, mesh.byteOffset, mesh.byteLength)).digest('hex');
const operative = patch => ({ ...createCombatPlayer(3), x: 1.25, y: 4, z: -2.5, ...patch });

test('refined helmet, uniform and gear remain inside actual shooting boxes and movement radius', () => {
  for (const crouching of [false, true]) for (const pitch of [-1.35, 0, 1.35]) for (let angle = 0; angle < 24; angle++) for (const time of [0, 127, 861]) {
    const player = operative({ crouching, pitch, yaw: angle * Math.PI / 12, vx: 6, vz: 4 });
    const source = JSON.stringify(player), mesh = operativeMeshes(player, time), height = playerHeight(player);
    assert.ok(mesh.every(Number.isFinite));
    assert.equal(mesh.length % 30, 0, 'whole triangles');
    assert.ok(mesh.length / 10 <= 1200, 'layered detail uses surface paint rather than redundant enclosed boxes');
    let crown = false, soles = false;
    for (const [worldX, worldY, worldZ] of vertices(mesh)) {
      const x = worldX - player.x, y = worldY - player.y, z = worldZ - player.z;
      const head = y > height - .32 + 1e-6, radius = head ? .22 : .29;
      assert.ok(y >= -1e-6 && y <= height + 1e-6, `${crouching}: no anatomy above or below the real body`);
      assert.ok(Math.abs(x) <= radius + 1e-6 && Math.abs(z) <= radius + 1e-6, `${crouching}/${angle}: ${head ? 'head' : 'body'} matches the engine contact boxes`);
      assert.ok(Math.hypot(x, z) <= WORLD.radius + 1e-6, 'boots, helmet, pouches and backpack fit the wall collision radius');
      crown ||= y > height - .004;
      soles ||= y < .02;
    }
    assert.ok(crown && soles, 'the complete operator still has a head and both grounded feet');
    assert.equal(JSON.stringify(player), source, 'visual construction cannot mutate authoritative combat state');
  }
});

test('operative silhouette retains honest quarter turns while helmet reflections follow pitch', () => {
  const player = operative({ yaw: 0 });
  const base = operativeMeshes(player, 1000);
  assert.deepEqual(operativeMeshes({ ...player, yaw: .7 }, 1000), base, 'continuous aim cannot rotate square anatomy out of its hitbox');
  assert.notEqual(digest(operativeMeshes({ ...player, yaw: Math.PI / 2 }, 1000)), digest(base), 'the visible front changes with a real quarter turn');
  assert.notEqual(digest(operativeMeshes({ ...player, pitch: .9 }, 1000)), digest(base), 'visor detail responds without tilting the head outside its hitbox');
});

test('team tabs and ten survivor uniform identities remain readable and deterministic', () => {
  const player = operative({ id: 0, team: 0 });
  assert.notEqual(digest(operativeMeshes(player)), digest(operativeMeshes({ ...player, team: 1 })), 'both tactical uniforms retain their own accent');
  const survivors = Array.from({ length: 10 }, (_, id) => operativeMeshes({ ...player, id }, 1000, true));
  assert.equal(new Set(survivors.map(digest)).size, 10);
  assert.deepEqual(operativeMeshes(player, 1000, true), operativeMeshes({ ...player, team: 8 }, 1000, true), 'free-for-all gear never implies a tactical alliance');
});

test('shared bottles, intact-pin grenades and ammunition tins stay cheap and above their support', () => {
  const silhouettes = new Set();
  for (const kind of ['heal', 'grenade', 'ammo']) for (const y of [0, 4]) {
    const mesh = lootMeshes([{ id: 17, kind, x: 2, y, z: -3 }], 1000);
    assert.equal(mesh.count, 1);
    assert.ok((mesh.opaque.length + mesh.contacts.length) / 10 <= 246, `${kind}: leave space for the full world pickup cap during firefights`);
    assert.ok(mesh.opaque.every(Number.isFinite));
    for (const [x, yy, z] of vertices(mesh.opaque)) {
      assert.ok(Math.abs(x - 2) < .3 && Math.abs(z + 3) < .3 && yy > y && yy < y + .5, 'supplies cannot suggest waist-high cover or sink through a shelf');
    }
    if (kind === 'grenade') {
      const core = vertices(mesh.opaque).slice(0, 36), centerY = (Math.min(...core.map(point => point[1])) + Math.max(...core.map(point => point[1]))) / 2;
      for (const [x, yy, z] of vertices(mesh.opaque)) assert.ok(Math.hypot(x - 2, yy - centerY, z + 3) <= .12 + 1e-6, 'the intact pin and lever also fit the physical grenade sphere');
    }
    if (y === 0) silhouettes.add(digest(mesh.opaque));
  }
  assert.equal(silhouettes.size, 3);
});

function renderHarness() {
  const gl = new Proxy({}, { get(_, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  const canvas = { getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) };
  const renderer = new VoxelRenderer(canvas), world = [];
  const upload = renderer._dynamic;
  renderer._dynamic = function(array, kind = 'world') { if (kind === 'world') world.push(array); return upload.call(this, array, kind); };
  return { renderer, world };
}

test('128 of every supply kind remain below the full ten-player, twenty-frag firefight budget', () => {
  const { renderer } = renderHarness();
  const state = { gameId: 'voxel-royale', map: ROYALE_MAPS.paris, phase: 'fight', round: 1, tick: 100,
    players: Array.from({ length: 10 }, (_, id) => ({ ...createCombatPlayer(id, 1, 'lmg'), x: id * 2 - 10, z: 9 })),
    storm: { active: true, x: 0, z: 9, radius: 20 }, maxGrenades: 20,
    grenades: Array.from({ length: 20 }, (_, id) => ({ id, x: id % 10 * 2 - 10, y: .12, z: 22 + Math.floor(id / 10) * 3, radius: .12, fuseTicks: 180 })),
    events: Array.from({ length: 150 }, (_, id) => ({ id, tick: 100, type: 'shot', weapon: 'lmg', playerId: id % 10, x: 0, y: 1.6, z: 4, dx: 0, dy: 0, dz: -1, hitX: 0, hitY: 1.6, hitZ: 0, hitKind: 'body', damage: 26 })) };
  for (const kind of ['heal', 'grenade', 'ammo']) {
    renderer.resetEffects();
    state.loot = Array.from({ length: 128 }, (_, id) => ({ id, kind, x: id % 16 - 8, y: 0, z: Math.floor(id / 16) - 4 }));
    assert.equal(renderer.render(state, { localId: 0, time: 1000 }), true);
    assert.equal(renderer.stats.lootItems, 128, 'no supply drops are omitted to meet the budget');
    assert.ok(renderer.stats.dynamicVertices < 72000, `${kind}: ${renderer.stats.dynamicVertices} vertices`);
    assert.ok(renderer.stats.drawCalls <= 7);
    assert.equal(renderer.particles.length, 84);
    assert.equal(renderer.tracers.length, 14);
  }
  renderer.destroy();
});

test('segmented live grenade shells, safety levers and fuse lights tumble inside the real collision sphere', () => {
  const { renderer, world } = renderHarness();
  const map = { id: 'grenade-art-fixture', theme: 'custom', colliders: [], sites: [], bounds: { minX: -4, maxX: 4, minZ: -4, maxZ: 4 } };
  for (const radius of [.04, .12, .25]) for (const time of [0, 79, 477, 1000]) {
    const grenade = { id: 0, x: 1, y: 2, z: -1, radius, vx: 4, vy: 2, vz: 1, bounces: 2, fuseTicks: 90 };
    renderer.render({ gameId: 'voxel-royale', map, phase: 'fight', round: 1, maxGrenades: 1, players: [], grenades: [grenade], events: [] }, { time, hideWeapon: true });
    const mesh = world.at(-1);
    assert.ok(mesh.length > 0 && mesh.every(Number.isFinite));
    for (const [x, y, z] of vertices(mesh)) assert.ok(Math.hypot(x - grenade.x, y - grenade.y, z - grenade.z) <= radius + 1e-6, `${radius}/${time}: no fake grenade corners beyond physical contact`);
    assert.ok(renderer.stats.drawCalls <= 7, 'shell paint stays in the existing world batch');
  }
  renderer.destroy();
});

test('the bottle opens during a real healing pose and keeps its brass cap when sealed', () => {
  const player = operative({ healing: true, slot: 'sword', meleeWeapon: 'knife' });
  const model = healTicks => VoxelRenderer.prototype._viewModel.call({ lastAim: null, swayX: 0, swayY: 0, localShot: null }, { ...player, healTicks }, 0, 0, 1000);
  const sealed = model(HEAL.ticks), drinking = model(HEAL.ticks / 2);
  assert.ok(sealed.every(Number.isFinite) && drinking.every(Number.isFinite));
  assert.equal(sealed.length - drinking.length, 36 * 10, 'exactly the intact cork disappears while drinking');
});
