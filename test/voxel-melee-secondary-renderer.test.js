import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer } from '../public/voxel-engine.js';
import { MELEE_WEAPONS, KNIFE_SECONDARY, PARRY_PROFILES, meleeProfile, meleeSlashGeometry, meleeSlashPhase } from '../public/voxel-melee.js';
import { meleeMotion, meleeWorldPose, meleeMeshes, meleeTrailPath, operativePose, particlePosition, VoxelRenderer } from '../public/voxel-renderer.js';

const arena = { id: 'melee-secondary-visuals', theme: 'forest', bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 }, colliders: [], sites: [] };
const actor = (weapon = 'sword', patch = {}) => ({ ...createCombatPlayer(0), slot: 'sword', meleeWeapon: weapon, meleeYaw: 0, meleePitch: 0, parryYaw: 0, parryPitch: 0, ...patch });
const attack = (secondary = false, phase = 'active', progress = .5, patch = {}) => {
  const profile = secondary ? KNIFE_SECONDARY : MELEE_WEAPONS.knife;
  const ticks = phase === 'startup' ? profile.startupTicks * (1 - progress) + profile.activeTicks + profile.recoveryTicks
    : phase === 'active' ? profile.activeTicks * (1 - progress) + profile.recoveryTicks : profile.recoveryTicks * (1 - progress);
  return actor('knife', { meleeAction: secondary ? 'secondary' : 'primary', meleeTicks: ticks, ...patch });
};
const guarding = (weapon, phase = 'active', progress = .5, patch = {}) => {
  const profile = PARRY_PROFILES[weapon];
  const ticks = phase === 'startup' ? profile.startupTicks * (1 - progress) + profile.activeTicks + profile.recoveryTicks
    : phase === 'active' ? profile.activeTicks * (1 - progress) + profile.recoveryTicks : profile.recoveryTicks * (1 - progress);
  return actor(weapon, { meleeTicks: 0, parryTicks: ticks, ...patch });
};
const points = mesh => Array.from({ length: mesh.length / 10 }, (_, i) => [...mesh.slice(i * 10, i * 10 + 3)]);
const near = (a, b, label, tolerance = 2e-6) => assert.ok(Math.abs(a - b) < tolerance, `${label}: ${a} != ${b}`);
const direction = pose => [Math.sin(pose.yaw) * Math.cos(pose.pitch), Math.sin(pose.pitch), -Math.cos(pose.yaw) * Math.cos(pose.pitch)];
const world = (local, yaw) => [local[0] * Math.cos(yaw) - local[2] * Math.sin(yaw), local[1], local[0] * Math.sin(yaw) + local[2] * Math.cos(yaw)];
const scene = players => ({ gameId: 'voxel-horde', phase: 'fight', round: 1, tick: 100, map: arena, players, events: [] });

function harness() {
  const calls = { creates: 0, allocations: 0, projection: null };
  const gl = new Proxy({}, { get(_target, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (name === 'uniformMatrix4fv') return (uniform, _transpose, matrix) => { if (uniform === 'uProjection') calls.projection = [...matrix]; };
    if (name === 'createBuffer') return () => { calls.creates++; return {}; };
    if (name === 'bufferData') return () => { calls.allocations++; };
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  const canvas = { getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) };
  return { visual: new VoxelRenderer(canvas), calls };
}

test('the committed secondary knife visibly draws back, drives a deeper precise thrust, and uses its real longer timing', () => {
  const early = meleeMotion(attack(true, 'startup', .35)), drawn = meleeMotion(attack(true, 'startup', .60));
  const late = meleeMotion(attack(true, 'startup', .99)), heavy = meleeMotion(attack(true)), quick = meleeMotion(attack());
  assert.equal(early.phase, 'startup'); assert.ok(drawn.extension < -.10 && early.extension < 0, 'the stronger thrust first loads behind its ready pose');
  assert.ok(late.extension > .60 && heavy.extension > quick.extension + .15, 'wind-up releases into the deep axial commitment');
  assert.equal(heavy.action, 'secondary'); assert.equal(quick.action, 'primary');
  assert.equal(meleeMotion(attack(true, 'recovery', .50)).phase, 'recovery');
  assert.equal(meleeMotion(attack(true, 'recovery', 1)).phase, 'idle');
  assert.equal(meleeProfile(attack(true)).startupTicks, 20); assert.equal(meleeProfile(attack()).startupTicks, 10);
  const receiver = { lastAim: null, swayX: 0, swayY: 0 };
  const quickMesh = VoxelRenderer.prototype._viewModel.call(receiver, attack(), 0, 0, 1000);
  const deepMesh = VoxelRenderer.prototype._viewModel.call(receiver, attack(true), 0, 0, 1000);
  assert.ok(Math.min(...points(deepMesh).map(p => p[2])) < Math.min(...points(quickMesh).map(p => p[2])) - .10, 'first-person secondary is clearly deeper');
  const earlyGrip = meleeWorldPose(attack(true, 'startup', .60)), lateGrip = meleeWorldPose(attack(true, 'startup', .99));
  assert.ok(lateGrip.z < earlyGrip.z - .70, 'remote humans also show the committed loaded thrust');
});

test('secondary knife geometry and its real grasp remain exact at committed upward/downward aim in both stances', () => {
  for (const progress of [0, .25, .70]) for (const crouching of [false, true]) for (const meleePitch of [-1.35, 0, 1.35]) {
    const player = attack(true, 'active', progress, { meleeYaw: 1.9, meleePitch, yaw: -.6, pitch: -.9, crouching });
    const before = structuredClone(player), pose = meleeWorldPose(player), axis = direction(pose), phase = meleeSlashPhase(player);
    const geometry = meleeSlashGeometry(player, { from: phase.progress, to: phase.progress }), sample = geometry.samples[0];
    axis.forEach((value, i) => near(value, [sample.direction.x, sample.direction.y, sample.direction.z][i], 'locked precise axis'));
    const projected = points(meleeMeshes(player, pose)).map(point => point.reduce((sum, value, i) => sum + (value - [geometry.origin.x, geometry.origin.y, geometry.origin.z][i]) * axis[i], 0));
    near(Math.max(...projected), 2.05, 'visible tip is the actual extended secondary capsule endpoint', .00002);
    const hand = world(operativePose(player).arms[1].hand, player.yaw);
    hand.forEach((value, i) => near(value, [pose.x - player.x, pose.y - player.y - .025, pose.z - player.z][i], 'hand remains physically attached'));
    assert.deepEqual(player, before);
  }
});

test('each accepted guard raises and lowers its blade only for its own finite startup, active and recovery window', () => {
  for (const weapon of Object.keys(PARRY_PROFILES)) {
    const start = meleeMotion(guarding(weapon, 'startup', 0)), active = meleeMotion(guarding(weapon)), recovery = meleeMotion(guarding(weapon, 'recovery', .5));
    assert.equal(start.phase, 'parry-startup'); assert.equal(start.guardActive, false);
    assert.equal(active.phase, 'parry-active'); assert.equal(active.guardActive, true); assert.equal(active.active, false, 'defense never advertises attack damage');
    assert.ok(active.grip > recovery.grip && recovery.grip > 0);
    assert.equal(meleeMotion(guarding(weapon, 'recovery', 1)).phase, 'idle');
    assert.equal(meleeMotion(guarding(weapon, 'active', .3, { parryConsumed: true })).guardActive, false, 'consumed guards never show another active contact');
    for (const patch of [{ slot: 'primary' }, { alive: false }, { parryTicks: 0, parryCooldown: 70, aiming: true, aimTicks: 12 }]) assert.equal(meleeMotion({ ...guarding(weapon), ...patch }).phase, 'idle');
    assert.equal(meleeTrailPath(guarding(weapon)), null, 'a raised guard never creates a damaging slash trail');
  }
});

test('guard hands stay attached to world grips and all unchanged head, torso and leg anatomy remains in place', () => {
  for (const weapon of Object.keys(PARRY_PROFILES)) for (const crouching of [false, true]) for (const parryPitch of [-1.35, 0, 1.35]) {
    const player = guarding(weapon, 'active', .5, { yaw: -.8, pitch: .5, parryYaw: 1.7, parryPitch, crouching });
    const before = structuredClone(player), joints = operativePose(player), idle = operativePose({ ...player, parryTicks: 0 });
    assert.deepEqual(joints.head, idle.head); assert.deepEqual(joints.torso, idle.torso); assert.deepEqual(joints.legs, idle.legs);
    for (const hand of weapon === 'tonfas' ? [0, 1] : [0]) {
      const held = { ...player, meleeHand: hand }, grip = meleeWorldPose(held), contact = world(joints.arms[hand ? 0 : 1].hand, player.yaw);
      contact.forEach((value, i) => near(value, [grip.x - player.x, grip.y - player.y - .025, grip.z - player.z][i], `${weapon} guard hand${hand}`));
    }
    assert.deepEqual(meleeWorldPose({ ...player, yaw: 2.3, pitch: -1.1 }), meleeWorldPose(player), 'free look cannot steer accepted guard direction');
    assert.deepEqual(player, before);
  }
});

test('guard and deep knife first-person geometry respect real intervening cover', () => {
  const wall = { id: 'thin-cover', x: -4, y: 0, z: -.30, w: 8, h: 3, d: .015 };
  for (const player of [attack(true), ...Object.keys(PARRY_PROFILES).map(weapon => guarding(weapon))]) {
    const receiver = { lastAim: null, swayX: 0, swayY: 0 }, before = structuredClone(player);
    const uncovered = VoxelRenderer.prototype._viewModel.call(receiver, player, 0, 0, 1000);
    const covered = VoxelRenderer.prototype._viewModel.call(receiver, player, 0, 0, 1000, false, { ...arena, colliders: [wall] });
    assert.ok(uncovered.length > covered.length, `${player.meleeWeapon}: solid cover clips the held geometry`);
    assert.ok(points(covered).every(([, , z]) => z > -.30), 'no view blade or glove is recreated beyond the real wall');
    assert.deepEqual(player, before);
  }
});

test('only a fresh accepted parry contact produces one tiny bounded clash with cover-safe particles', () => {
  const { visual } = harness(), state = scene([guarding('sword')]);
  state.events = [{ id: 1, tick: 100, type: 'parryStart', playerId: 0 }, { id: 2, tick: 100, type: 'meleeParry', playerId: 0 }];
  visual.render(state, { localId: 0, time: 1000 }); assert.equal(visual.particles.length, 0);
  const contact = { id: 3, tick: 100, type: 'meleeParry', playerId: 0, targetId: 1, weapon: 'sword', x: .10, y: 1.21, z: -.42 };
  state.events.push(contact); const before = structuredClone(state);
  visual.render(state, { localId: 0, time: 1000 });
  assert.equal(visual.particles.length, 4); assert.ok(visual.particles.every(p => p.material === 'parry' && p.cover && p.size <= .012 && p.life < 150));
  const particles = [...visual.particles]; visual.render(state, { localId: 0, time: 1000 }); assert.deepEqual(visual.particles, particles, 'replayed accepted contacts are deduplicated');
  const wall = { x: -.50, y: 0, z: -.46, w: 1, h: 3, d: .01 };
  for (const particle of particles) for (const time of [1010, 1050, 1100]) assert.ok(particlePosition(particle, time, [wall]).point[2] > -.45, 'clash motes cannot escape through cover');
  visual.render({ ...state, events: [{ ...contact, id: 4, tick: 70 }] }, { localId: 0, time: 1000 }); assert.equal(visual.particles.length, 4, 'old contact history never recreates an effect');
  assert.deepEqual(state, before);
  visual.resetEffects(); assert.equal(visual.particles.length, 0); visual.destroy();
});

test('frozen accepted guard and thrust poses are invariant at display refresh rates and melee RMB never applies gun zoom', () => {
  for (const player of [guarding('katana'), attack(true)]) {
    let expected;
    for (const hz of [60, 120, 144, 240]) {
      const { visual, calls } = harness(), state = scene([{ ...player, aiming: true, aimTicks: 12 }]), before = structuredClone(state);
      for (let frame = 0; frame <= hz / 4; frame++) visual.render(state, { localId: 0, time: 1000 + frame * 1000 / hz });
      const mesh = [...visual.frameMeshes.weapon.array];
      if (expected) assert.deepEqual(mesh, expected); else expected = mesh;
      assert.equal(visual.stats.firstPerson.melee.action, player.meleeWeapon === 'knife' ? 'secondary' : 'parry');
      const meleeProjection = [...calls.projection];
      visual.render(scene([{ ...player, aiming: false, aimTicks: 0 }]), { localId: 0, time: 1400 }); assert.deepEqual(calls.projection, meleeProjection, 'melee AIM has no ADS zoom');
      assert.deepEqual(state, before); visual.destroy();
    }
  }
});

test('ten simultaneous melee actors and confirmed clashes preserve shared GPU storage and seven-draw gameplay budgets', () => {
  const { visual, calls } = harness();
  const players = Array.from({ length: 10 }, (_, id) => ({ ...(id % 5 === 0 ? attack(true) : guarding(['sword', 'katana', 'axe', 'tonfas'][id % 4])), id, x: id % 5 * 2 - 4, z: Math.floor(id / 5) * 3 }));
  const state = scene(players);
  // Reserve the renderer's existing peak effect capacity once, then require
  // every changing accepted pose/contact to reuse that same GPU allocation.
  state.events = Array.from({ length: 21 }, (_, id) => ({ id: id + 1, tick: state.tick, type: 'meleeParry', playerId: id % 10, targetId: (id + 1) % 10, x: .1, y: 1.2, z: -.4 }));
  visual.render(state, { localId: 0, time: 1000 });
  const creates = calls.creates, allocations = calls.allocations;
  for (let frame = 0; frame < 80; frame++) {
    state.tick++; state.events = [{ id: frame + 22, tick: state.tick, type: 'meleeParry', playerId: frame % 10, targetId: (frame + 1) % 10, x: .1, y: 1.2, z: -.4 }];
    visual.render(state, { localId: 0, time: 1010 + frame * 1000 / 240 });
    assert.ok(visual.stats.drawCalls <= 7); assert.ok(visual.stats.dynamicVertices < 72000); assert.ok(visual.particles.length <= 84);
  }
  assert.equal(calls.creates, creates, 'melee defense never creates per-frame GPU objects');
  assert.equal(calls.allocations, allocations, 'the existing reserved buffers contain every guard and clash');
  visual.destroy();
});
