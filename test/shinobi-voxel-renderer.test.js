import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ninjaAppearance, ninjaOperativeMeshes, appendShinobiKunai, createShinobiEffectPresenter, ShinobiVoxelRenderer } from '../public/shinobi-voxel-renderer.js';
import { operativeMeshes, humanDeathMeshes, createHumanDeathMeshPresenter, VoxelRenderer, voxelMapAtmosphere, mapMeshes } from '../public/voxel-renderer.js';
import { playerAnimationPose } from '../public/voxel-player-animation.js';
import { createCombatPlayer } from '../public/voxel-engine.js';
import { MAPS as SHINOBI_MAPS } from '../public/shinobi-voxel-maps.js';

const digest = array => createHash('sha256').update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
const fighter = { id: 0, team: 0, x: 1, y: 0, z: 2, yaw: .5, pitch: 0, alive: true, grounded: true, crouching: false, weapon: 'carbine', slot: 'sword', meleeWeapon: 'katana', previousInput: { up: true }, vx: 0, vz: -6 };
const collector = () => ({ boxes: [], lines: [], box(...args) { this.boxes.push(args); }, line(...args) { this.lines.push(args); } });

test('ninja hood, armour and headband keep a bounded articulated human silhouette', () => {
  const standing = ninjaOperativeMeshes(fighter, 0, playerAnimationPose(fighter, 0));
  assert.ok(standing.every(Number.isFinite)); assert.equal(standing.length % 30, 0); assert.ok(standing.length / 10 < 4000);
  assert.notEqual(digest(standing), digest(operativeMeshes(fighter)), 'ninja clothing has a distinct authored silhouette');
  const crouched = ninjaOperativeMeshes({ ...fighter, crouching: true }, 0);
  let top = -Infinity; for (let at = 1; at < crouched.length; at += 10) top = Math.max(top, crouched[at]);
  assert.ok(top < 1.20, 'hood and cloth lower with the accepted physical stance');
  assert.notEqual(digest(standing), digest(ninjaOperativeMeshes(fighter, 250, { ...playerAnimationPose(fighter, 0), phase: 1.2, stride: 1, sprint: 1 })));
  assert.notEqual(digest(standing), digest(ninjaOperativeMeshes({ ...fighter, grounded: false, vy: 3 }, 250)));
  assert.notEqual(ninjaAppearance({ id: 0 }).shirt, ninjaAppearance({ id: 1 }).shirt);
});

test('katana startup, active cut, parry and recovery keep finite accepted arm grips', () => {
  const signatures = new Set();
  for (const patch of [{}, { meleeTicks: 42, meleeYaw: .5, meleePitch: 0 }, { meleeTicks: 32, meleeYaw: .5, meleePitch: 0 }, { meleeTicks: 10, meleeYaw: .5, meleePitch: 0 }, { parryTicks: 35, parryYaw: .5, parryPitch: 0 }]) {
    const vertices = ninjaOperativeMeshes({ ...fighter, ...patch }, 200);
    assert.ok(vertices.every(Number.isFinite)); assert.ok(vertices.length / 10 < 4000); signatures.add(digest(vertices));
  }
  assert.ok(signatures.size >= 4, 'real swing phases articulate the blade arm, rather than one rigid running pose');
});

test('ninja deaths retain masked clothing while using the existing bounded corpse animation', () => {
  const death = { targetId: 0, team: 0, x: 1, y: 0, z: 2, yaw: .5, lifeId: 1, deaths: 1, dx: 0, dz: -1, crouching: false, ageMs: 250 };
  const map = { id: 'test', colliders: [] };
  const ninja = humanDeathMeshes(death, 250, map, { ninjaSkins: true }), original = humanDeathMeshes(death, 250, map);
  assert.ok(ninja.length > 0 && ninja.every(Number.isFinite)); assert.notEqual(digest(ninja), digest(original));
  const present = createHumanDeathMeshPresenter(); present([death], map, { ninjaSkins: true }); present([death], map, { ninjaSkins: true });
  assert.equal(present.getStats().geometryBuilds, 1);
  present([], map, { ninjaSkins: true }); assert.equal(present.getStats().templateBytes, 0);
});

test('accepted kunai models are directional and hard capped; invalid projectiles are ignored', () => {
  const mesh = collector(), knives = Array.from({ length: 100 }, (_, id) => ({ id, x: id, y: 1, z: 0, dx: 1, dy: 0, dz: 0 }));
  assert.equal(appendShinobiKunai(mesh, knives), 32); assert.equal(mesh.boxes.length, 32 * 4);
  assert.ok(mesh.boxes.every(args => args.slice(0, 6).every(Number.isFinite) && Number.isFinite(args[7].yaw)));
  const empty = collector(); assert.equal(appendShinobiKunai(empty, [{ x: NaN }]), 0);
});

test('dash ribbons and kunai sparks require new accepted events and expire without replay', () => {
  const present = createShinobiEffectPresenter(), mesh = collector();
  const state = { phase: 'fight', map: { id: 'dojo' }, round: 1, tick: 20, events: [{ id: 1, type: 'dashStart', tick: 20, playerId: 0, x: 0, y: 0, z: 0, ticks: 18 }, { id: 2, type: 'kunaiImpact', tick: 20, playerId: 0, x: 1, y: 1, z: 2 }] };
  present.observe(state, 1000); present.observe(state, 1001);
  assert.equal(present.inspect().dashes, 1); assert.equal(present.inspect().sparks, 5);
  present.appendEffects(mesh, { players: [fighter], eye: [1, 2, 4], time: 1001 }); assert.equal(mesh.lines.length, 3);
  present.observe({ ...state, events: [] }, 1500); assert.equal(present.inspect().dashes, 0); assert.equal(present.inspect().sparks, 0);
  present.observe(state, 1501); assert.equal(present.inspect().sparks, 0, 'old accepted snapshot never replays particles');
  present.reset(); assert.equal(present.inspect().eventIds, 0);
});

test('reduced motion omits dash ribbons; all new effects remain bounded under a long event stream', () => {
  const present = createShinobiEffectPresenter(), mesh = collector();
  const state = { phase: 'fight', map: { id: 'dojo' }, tick: 500, events: Array.from({ length: 500 }, (_, id) => ({ id, tick: 500, type: id % 2 ? 'dashStart' : 'kunaiImpact', playerId: 0, x: 0, y: 1, z: 0 })) };
  present.observe(state, 1000, { reducedMotion: true });
  assert.ok(present.inspect().eventIds <= 128); assert.ok(present.inspect().dashes <= 6); assert.ok(present.inspect().sparks <= 24);
  present.appendEffects(mesh, { players: [fighter], eye: [1, 2, 4], time: 1001, reducedMotion: true }); assert.equal(mesh.lines.length, 0);
  present.observe({ ...state, phase: 'paused', events: [] }, 2000); assert.equal(present.inspect().sparks, 24);
  present.observe({ ...state, events: [] }, 2001); assert.equal(present.inspect().sparks, 0, 'resume does not shower stale paused particles');
});

test('FPS viewmodels keep the original path when no third-person options are present', () => {
  const context = { lastAim: null, swayX: 0, swayY: 0, localShot: null };
  const array = VoxelRenderer.prototype._viewModel.call(context, { ...fighter, slot: 'gun', ammo: 24, aimTicks: 0 }, 0, 0, 1000);
  assert.ok(array.every(Number.isFinite)); assert.ok(array.length > 0);
});

test('only the authored Shinobi night and indoor maps override shared Dojo atmosphere', () => {
  const daylight = voxelMapAtmosphere({ theme: 'dojo' });
  assert.equal(voxelMapAtmosphere(SHINOBI_MAPS['shinobi-courtyard']), daylight, 'Sakura daylight stays identical to the original Dojo');
  for (const id of ['shinobi-rooftops', 'shinobi-dojo']) {
    const map = SHINOBI_MAPS[id], profile = voxelMapAtmosphere(map);
    assert.notEqual(profile, daylight); assert.ok(Object.isFrozen(profile));
    assert.equal(voxelMapAtmosphere({ ...map, mode: 'dojo' }), daylight, 'training and FPS defaults never inherit the new game atmosphere');
  }
  const moon = voxelMapAtmosphere(SHINOBI_MAPS['shinobi-rooftops']), lantern = voxelMapAtmosphere(SHINOBI_MAPS['shinobi-dojo']);
  assert.equal(moon.top, '#101d35'); assert.equal(moon.sunColor, '#dceaff'); assert.ok(moon.ambient[2] > moon.ambient[0] && moon.direct[2] > moon.direct[0], 'readable moonlight uses a cool key and blue ambient');
  assert.ok(lantern.ambient[0] > lantern.ambient[2], 'the actual indoor hall gets warm amber light');
});

test('Shinobi night maps omit cropped floating cuboid clouds while Sakura and all shared defaults retain them', () => {
  const maxY = array => { let value = -Infinity; for (let at = 1; at < array.length; at += 10) value = Math.max(value, array[at]); return value; };
  for (const id of ['shinobi-rooftops', 'shinobi-dojo']) {
    const map = SHINOBI_MAPS[id], meshes = mapMeshes(map);
    assert.ok(maxY(meshes.opaque) < 23, 'no decorative overhead cloud box can crop into the night sky');
    assert.ok(maxY(mapMeshes({ ...map, mode: 'dojo' }).opaque) >= 23, 'shared default cloud artwork is unchanged');
    assert.ok(meshes.opaque.every(Number.isFinite) && meshes.shadows.every(Number.isFinite));
    assert.ok(meshes.opaque.length / 10 < 150000);
  }
  assert.ok(maxY(mapMeshes(SHINOBI_MAPS['shinobi-courtyard']).opaque) >= 23, 'the daylight courtyard retains its soft voxel clouds');
});

test('actual night render uploads the authored sky, moon and lighting without altering real map collision data', () => {
  const uploads = new Map(), gl = new Proxy({}, { get(_target, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (name === 'uniform3fv') return (uniform, value) => uploads.set(uniform, [...value]);
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  const visual = new ShinobiVoxelRenderer({ width: 960, height: 540, getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) });
  const map = SHINOBI_MAPS['shinobi-rooftops'], colliders = JSON.stringify(map.colliders), state = { gameId: 'shinobi-voxel', phase: 'fight', tick: 1, round: 1, map, players: [{ ...createCombatPlayer(0), ...fighter }], events: [], kunai: [] };
  assert.equal(visual.render(state, { localId: 0, time: 1000, yaw: 0, pitch: -.13 }), true);
  assert.deepEqual(uploads.get('uTop'), [0x10 / 255, 0x1d / 255, 0x35 / 255]);
  assert.deepEqual(uploads.get('uSunColor'), [0xdc / 255, 0xea / 255, 0xff / 255]);
  assert.deepEqual(uploads.get('uSun'), voxelMapAtmosphere(map).direct); assert.deepEqual(uploads.get('uAmbient'), voxelMapAtmosphere(map).ambient);
  assert.equal(JSON.stringify(map.colliders), colliders); assert.ok(visual.stats.drawCalls <= 7); visual.destroy();
});

test('actual third-person renders use the exact crosshair camera, draw the local ninja and reuse bounded GPU buffers', () => {
  const calls = { eye: null, creates: 0 };
  const gl = new Proxy({}, { get(_target, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (name === 'uniform3fv') return (uniform, value) => { if (uniform === 'uEye') calls.eye = [...value]; };
    if (name === 'createBuffer') return () => { calls.creates++; return {}; };
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  const visual = new ShinobiVoxelRenderer({ width: 960, height: 540, getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) });
  const player = { ...createCombatPlayer(0), ...fighter }, enemy = { ...createCombatPlayer(1), ...fighter, id: 1, team: 1, x: 2, z: -3 };
  const state = { gameId: 'shinobi-voxel', phase: 'fight', round: 1, tick: 100, map: { id: 'shinobi-test', theme: 'dojo', colliders: [], sites: [], bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 } }, players: [player, enemy], events: [], kunai: [{ id: 1, playerId: 0, x: 1, y: 1, z: -2, dx: 0, dy: 0, dz: -1 }] };
  const buffers = new Map(), dynamic = visual.voxel._dynamic;
  visual.voxel._dynamic = function(array, kind = 'world') {
    assert.ok(array.every(Number.isFinite)); assert.equal(array.length % 30, 0);
    if (buffers.has(kind)) assert.equal(array.buffer, buffers.get(kind)); else buffers.set(kind, array.buffer);
    assert.notEqual(kind, 'weapon', 'third-person never draws detached first-person hands');
    return dynamic.call(this, array, kind);
  };
  for (let frame = 0; frame < 12; frame++) {
    const time = 1000 + frame * 1000 / 144, pose = visual.updateCamera(state, { localId: 0, yaw: .5, pitch: -.13, time });
    assert.equal(visual.render(state, { localId: 0, cameraPose: pose, time }), true);
    assert.deepEqual(calls.eye, pose.eye, 'drawn matrix uses the exact ray that produced combat aim');
    assert.ok(visual.locomotionActors.some(actor => actor.id === 0), 'local third-person body participates in the shared gait presenter');
    assert.ok(visual.stats.dynamicVertices < 18000); assert.ok(visual.stats.drawCalls <= 7);
  }
  assert.ok(calls.creates < 15); assert.equal(visual.stats.thirdPerson, true); assert.equal(visual.stats.ninjaSkins, true);
  visual.resetEffects(); assert.equal(visual.camera, null); visual.destroy(); assert.equal(visual.destroyed, true);
});
