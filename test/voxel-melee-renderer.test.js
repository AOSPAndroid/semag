import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer } from '../public/voxel-engine.js';
import { MELEE_WEAPONS, meleeSlashGeometry, meleeSlashPhase } from '../public/voxel-melee.js';
import { meleeMeshes, meleeMotion, meleeTrailMeshes, meleeTrailPath, meleeWorldPose, operativePose, VoxelRenderer } from '../public/voxel-renderer.js';

const actor = (id = 'sword', progress = .5, patch = {}) => {
  const profile = MELEE_WEAPONS[id];
  return { ...createCombatPlayer(0), slot: 'sword', meleeWeapon: id, meleeYaw: .3, meleePitch: -.12, meleeTicks: profile.activeTicks + profile.recoveryTicks - progress * profile.activeTicks, ...patch };
};
const points = mesh => Array.from({ length: mesh.length / 10 }, (_, i) => [...mesh.slice(i * 10, i * 10 + 3)]);
const near = (a, b, label, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${label}: ${a} != ${b}`);
const closePoint = (a, b, label, tolerance = 1e-6) => a.forEach((value, axis) => near(value, b[axis], `${label}/${axis}`, tolerance));
const direction = pose => [Math.sin(pose.yaw) * Math.cos(pose.pitch), Math.sin(pose.pitch), -Math.cos(pose.yaw) * Math.cos(pose.pitch)];
const total = id => { const p = MELEE_WEAPONS[id]; return p.startupTicks + p.activeTicks + p.recoveryTicks; };

function harness() {
  const calls = { creates: 0, allocations: [], depth: false }, buffers = [];
  let bound;
  const constants = { DEPTH_TEST: 1, CULL_FACE: 2, BLEND: 3, COLOR_BUFFER_BIT: 4, DEPTH_BUFFER_BIT: 8 };
  const gl = new Proxy(constants, { get(target, name) {
    if (name in target) return target[name];
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (name === 'createBuffer') return () => { calls.creates++; const buffer = {}; buffers.push(buffer); return buffer; };
    if (name === 'bindBuffer') return (_kind, buffer) => { bound = buffer; };
    if (name === 'bufferData') return () => { calls.allocations.push(bound); };
    if (name === 'enable') return flag => { if (flag === constants.DEPTH_TEST) calls.depth = true; };
    if (name === 'disable') return flag => { if (flag === constants.DEPTH_TEST) calls.depth = false; };
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  const canvas = { getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) };
  return { visual: new VoxelRenderer(canvas), calls, buffers };
}
const arena = { id: 'finite-melee-renderer', theme: 'forest', bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 }, colliders: [], sites: [] };
const scene = player => ({ gameId: 'voxel-horde', phase: 'fight', round: 1, tick: 100, map: arena, players: [player], events: [] });

test('every active world blade tip follows the authoritative finite cut, including committed elevated/crouched aim', () => {
  for (const id of Object.keys(MELEE_WEAPONS)) for (const progress of [0, .25, .70]) for (const crouching of [false, true]) for (const meleeHand of [0, 1]) {
    const player = actor(id, progress, { meleeYaw: 1.9, meleePitch: .42, yaw: -1.8, pitch: -.9, crouching, meleeHand });
    const before = JSON.stringify(player), phase = meleeSlashPhase(player), geometry = meleeSlashGeometry(player, { from: phase.progress, to: phase.progress });
    const sample = geometry.samples[0], pose = meleeWorldPose(player), axis = direction(pose);
    closePoint(axis, [sample.direction.x, sample.direction.y, sample.direction.z], `${id}: locked direction`);
    const projected = points(meleeMeshes(player, pose, { hand: meleeHand })).map(point => point.reduce((sum, value, index) => sum + (value - [geometry.origin.x, geometry.origin.y, geometry.origin.z][index]) * axis[index], 0));
    near(Math.max(...projected), geometry.reach - geometry.radius, `${id}: actual visible tip reaches path end`, .00002);
    assert.equal(JSON.stringify(player), before, 'visual sampling cannot alter authoritative position, HP, timing or aim');
  }
});

test('a raised short-blade arm stays attached to its committed grip above the ordinary idle hand ceiling', () => {
  for (const id of ['knife', 'sword', 'katana', 'axe', 'tonfas']) for (const crouching of [false, true]) for (const meleeHand of [0, 1]) for (const meleePitch of [-1.35, 1.35]) {
    const player = actor(id, .5, { yaw: 0, meleeYaw: 0, meleePitch, crouching, meleeHand });
    const grip = meleeWorldPose(player), pose = operativePose(player);
    const hand = pose.arms[id === 'tonfas' && meleeHand === 1 ? 0 : 1].hand;
    closePoint(hand, [grip.x - player.x, grip.y - player.y - .025, grip.z - player.z], `${id}: glove follows committed grip`);
  }
});

test('sword and katana show continuous sweeps while the knife thrusts and tonfas mirror their diagonal cuts', () => {
  for (const id of ['sword', 'katana', 'axe']) {
    const poses = [0, .15, .3, .5, .7, .85].map(progress => meleeMotion(actor(id, progress, { meleeYaw: 0, meleePitch: 0 })));
    assert.ok(poses.at(-1).yaw - poses[0].yaw > .60, `${id}: broad readable sweep`);
    assert.ok(poses.every(pose => pose.active));
    assert.ok(poses.slice(1).every((pose, index) => Math.abs(pose.yaw - poses[index].yaw) < .5), 'no teleporting blade poses');
  }
  const knife = [0, .5, .85].map(progress => meleeMotion(actor('knife', progress)));
  assert.ok(knife.every(pose => Math.abs(pose.yaw) < 1e-8 && pose.extension > .35));
  const right = meleeMotion(actor('tonfas', .2, { meleeYaw: 0, meleePitch: 0, meleeHand: 0 }));
  const left = meleeMotion(actor('tonfas', .2, { meleeYaw: 0, meleePitch: 0, meleeHand: 1 }));
  near(right.yaw, -left.yaw, 'mirrored yaw'); near(right.pitch, -left.pitch, 'mirrored diagonal pitch');
  const heavy = [0, .2, .9].map(progress => meleeMotion(actor('axe', progress, { meleeYaw: 0, meleePitch: 0 })));
  assert.ok(Math.abs(heavy.at(-1).pitch - heavy[0].pitch) > .65, 'axe has a pronounced heavy diagonal chop');
});

test('a finite trailing ribbon follows sampled damage slices, fades promptly, and never grows into a projectile', () => {
  for (const id of Object.keys(MELEE_WEAPONS)) {
    const profile = MELEE_WEAPONS[id], startup = actor(id, 0, { meleeTicks: total(id) });
    assert.equal(meleeTrailPath(startup), null);
    const player = actor(id, .6), before = JSON.stringify(player), path = meleeTrailPath(player), phase = meleeSlashPhase(player);
    assert.ok(path.samples.length <= 49); near(path.to, phase.to, 'finite current damage endpoint');
    assert.ok(path.from >= Math.max(0, phase.to - .550001));
    const shared = meleeSlashGeometry(player, { from: path.from, to: path.to });
    path.samples.forEach((sample, index) => closePoint(sample.outer, [shared.samples[index].outer.x, shared.samples[index].outer.y, shared.samples[index].outer.z], `${id}: exact uncovered tip`));
    assert.ok(meleeTrailMeshes(player).length / 10 <= 48 * 18);
    const early = meleeTrailPath({ ...player, meleeTicks: profile.recoveryTicks - 1 });
    const late = meleeTrailPath({ ...player, meleeTicks: profile.recoveryTicks - 5 });
    assert.ok(early.fade > late.fade && late.fade > 0);
    // The polished trail retains its finite tip for 10 physics ticks (83ms),
    // then disappears instead of accumulating through the whole recovery.
    assert.equal(meleeTrailPath({ ...player, meleeTicks: profile.recoveryTicks - 10 }), null);
    assert.equal(meleeTrailPath({ ...player, alive: false }), null);
    assert.equal(meleeTrailPath({ ...player, slot: 'primary' }), null);
    assert.equal(JSON.stringify(player), before);
  }
});

test('solid thin cover clips radial bands and prevents triangle bridges, without removing the visible near side', () => {
  const wall = { id: 'thin-metal', x: -5, y: 0, z: -.90, w: 10, h: 3, d: .02 };
  for (const id of Object.keys(MELEE_WEAPONS)) {
    const player = actor(id, .5, { meleeYaw: 0, meleePitch: 0 });
    const path = meleeTrailPath(player, [wall]), mesh = meleeTrailMeshes(player, [wall]);
    assert.ok(path.samples.some(sample => sample.clipped)); assert.ok(mesh.length > 0);
    assert.ok(points(mesh).every(([, , z]) => z > -.88), `${id}: every ribbon/core vertex remains before cover`);
  }
  const player = actor('sword', .6, { meleeYaw: 0, meleePitch: 0 });
  const pillar = { id: 'small-cover-between-rays', x: .085, y: 1.0, z: -.69, w: .04, h: .5, d: .025 };
  const mesh = meleeTrailMeshes(player, [pillar]);
  assert.ok(mesh.length > 0, 'the rest of the finite arc remains visible');
  for (let at = 0; at < mesh.length; at += 30) {
    const triangle = [0, 10, 20].map(offset => [...mesh.slice(at + offset, at + offset + 3)]);
    const lo = [0, 1, 2].map(axis => Math.min(...triangle.map(point => point[axis])));
    const hi = [0, 1, 2].map(axis => Math.max(...triangle.map(point => point[axis])));
    assert.ok(!(hi[0] >= pillar.x && lo[0] <= pillar.x + pillar.w && hi[1] >= pillar.y && lo[1] <= pillar.y + pillar.h && hi[2] >= pillar.z && lo[2] <= pillar.z + pillar.d), 'no rendered triangle bridges into intervening cover');
  }
});

test('frozen authoritative state yields the same path at 60/120/144/240 Hz and free camera aim cannot steer it', () => {
  const player = actor('sword', .6), reference = meleeTrailPath(player);
  assert.deepEqual(meleeTrailPath({ ...player, yaw: -2, pitch: 1 }), reference);
  let expected;
  for (const hz of [60, 120, 144, 240]) {
    const { visual } = harness(), state = scene(player), before = JSON.stringify(state);
    for (let frame = 0; frame <= hz / 4; frame++) visual.render(state, { localId: 0, time: 1000 + frame * 1000 / hz });
    const mesh = [...visual.frameMeshes.tracer.array];
    if (expected) assert.deepEqual(mesh, expected, `${hz} Hz: no trail accumulation or wall-clock movement`); else expected = mesh;
    assert.equal(visual.stats.meleeTrailActors, 1); assert.ok(visual.stats.meleeTrailVertices > 0);
    assert.equal(JSON.stringify(state), before);
    visual.destroy();
  }
});

test('native render uses depth-tested shared tracer storage and allocates no new GPU buffers for changing blade slices', () => {
  const { visual, calls } = harness(), player = actor('sword', .6), state = scene(player);
  const storage = visual.frameMeshes.tracer.storage.buffer;
  let observed = false;
  const dynamic = visual._dynamic;
  visual._dynamic = function(array, kind) {
    if (kind === 'tracer') { observed = true; assert.equal(calls.depth, true, 'world depth occludes both local and remote ribbons'); assert.equal(array.buffer, storage); }
    return dynamic.call(this, array, kind);
  };
  visual.render(state, { localId: 0, time: 1000 });
  const allocated = calls.creates, trailAllocations = calls.allocations.filter(buffer => buffer === visual.tracerBuffer).length;
  for (let frame = 0; frame < 120; frame++) {
    player.meleeTicks = MELEE_WEAPONS.sword.recoveryTicks + .2 + (frame % 11);
    visual.render(state, { localId: 0, time: 1010 + frame * 1000 / 240 });
    assert.ok(visual.stats.meleeTrailVertices <= 48 * 18); assert.ok(visual.stats.drawCalls <= 7);
  }
  assert.ok(observed); assert.equal(calls.creates, allocated, 'active melee never creates GPU objects');
  assert.equal(calls.allocations.filter(buffer => buffer === visual.tracerBuffer).length, trailAllocations, 'bounded trail buffer was reserved once');
  visual.resetEffects(); assert.equal(visual.stats.meleeTrailVertices, 0); assert.equal(visual.stats.meleeTrailActors, 0);
  visual.destroy();
});
