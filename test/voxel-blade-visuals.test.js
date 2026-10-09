import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createCombatPlayer } from '../public/voxel-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { MELEE_WEAPONS, PARRY_PROFILES, meleeSlashGeometry, meleeSlashPhase } from '../public/voxel-melee.js';
import { meleeMotion, meleeWorldPose, meleeViewPose, meleeSupportGrip, meleeTrailMeshes, operativePose, weaponMeshes, VoxelRenderer } from '../public/voxel-renderer.js';

const BLADES = ['sword', 'katana', 'axe', 'tonfas'];
const actor = (id, ticks, patch = {}) => ({ ...createCombatPlayer(0), slot: 'sword', meleeWeapon: id, meleeTicks: ticks, meleeYaw: .3, meleePitch: -.12, ...patch });
const total = id => { const p = MELEE_WEAPONS[id]; return p.startupTicks + p.activeTicks + p.recoveryTicks; };
const near = (a, b, label, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${label}: ${a} != ${b}`);
const rotate = ([x, y, z], yaw = 0, pitch = 0, roll = 0) => {
  const rx = x * Math.cos(roll) - y * Math.sin(roll), ry = x * Math.sin(roll) + y * Math.cos(roll);
  const py = ry * Math.cos(pitch) - z * Math.sin(pitch), pz = ry * Math.sin(pitch) + z * Math.cos(pitch);
  return [rx * Math.cos(yaw) - pz * Math.sin(yaw), py, rx * Math.sin(yaw) + pz * Math.cos(yaw)];
};
const points = mesh => Array.from({ length: mesh.length / 10 }, (_, i) => [...mesh.slice(i * 10, i * 10 + 3)]);
const viewModel = (player, map = null) => VoxelRenderer.prototype._viewModel.call({ swayX: 0, swayY: 0, lastAim: null }, player, 0, 0, 1000, false, map);

test('wide blade edges follow the actual waist-crossing cut tangent while their forward axis remains exact', () => {
  for (const id of BLADES) for (const progress of [.12, .45, .82]) for (const crouching of [false, true]) for (const meleeHand of [0, 1]) {
    const p = MELEE_WEAPONS[id], player = actor(id, p.recoveryTicks + p.activeTicks * (1 - progress), { meleePitch: .7, crouching, meleeHand });
    const phase = meleeSlashPhase(player), motion = meleeMotion(player), pose = meleeWorldPose(player);
    const path = meleeSlashGeometry(player, { from: Math.max(0, phase.progress - .001), to: Math.min(1, phase.progress + .001) });
    const first = path.samples[0].direction, last = path.samples.at(-1).direction;
    const reverse = p.dualWield && meleeHand === 1 ? -1 : 1;
    const travel = [last.x - first.x, last.y - first.y, last.z - first.z].map(value => value * reverse);
    const direction = rotate([0, 0, -1], pose.yaw, pose.pitch), edge = rotate([1, 0, 0], pose.yaw, pose.pitch, pose.roll);
    const along = travel.reduce((sum, value, axis) => sum + value * direction[axis], 0);
    const tangent = travel.map((value, axis) => value - direction[axis] * along), length = Math.hypot(...tangent);
    edge.forEach((value, axis) => near(value, tangent[axis] / length, `${id}: real slicing edge`));
    near(edge.reduce((sum, value, axis) => sum + value * direction[axis], 0), 0, 'wrist roll never steers the damage ray');
    assert.ok(motion.active);
  }
});

test('blade grip paths load, cross and settle without a translation pop at 120 Hz or any idle drift', () => {
  for (const id of BLADES) {
    const p = MELEE_WEAPONS[id], sequence = [];
    for (let ticks = total(id); ticks >= 0; ticks--) {
      const player = actor(id, ticks), before = structuredClone(player), pose = meleeViewPose(player);
      assert.ok(Object.values(pose).every(Number.isFinite));
      assert.deepEqual(player, before);
      sequence.push(pose);
    }
    for (let i = 1; i < sequence.length; i++) {
      const distance = Math.hypot(...['x', 'y', 'z'].map(axis => sequence[i][axis] - sequence[i - 1][axis]));
      assert.ok(distance < .11, `${id}: wrist translation cannot jump by 11cm within one physics tick (${distance})`);
    }
    const load = meleeViewPose(actor(id, p.activeTicks + p.recoveryTicks + 1));
    const follow = meleeViewPose(actor(id, p.recoveryTicks));
    assert.ok(load.y > follow.y + .08, `${id}: visible high load and lower follow-through`);
    assert.deepEqual(sequence.at(-1), meleeViewPose(actor(id, 0)), 'completed recovery reaches the stationary ready pose exactly');
  }
});

test('first-person blade axes and edges stay committed when the camera looks away or rolls', () => {
  for (const id of BLADES) for (const yaw of [-1.3, .7]) for (const pitch of [-.8, .9]) for (const roll of [-.05, .05]) {
    const p = MELEE_WEAPONS[id], player = actor(id, p.recoveryTicks + p.activeTicks * .4), motion = meleeMotion(player), world = meleeWorldPose(player);
    const local = meleeViewPose(player, motion, { yaw, pitch, roll });
    for (const axis of [[0, 0, -1], [1, 0, 0]]) {
      const presented = rotate(rotate(axis, local.yaw, local.pitch, local.roll), yaw, pitch, roll);
      const accepted = rotate(axis, world.yaw, world.pitch, world.roll);
      presented.forEach((value, i) => near(value, accepted[i], `${id}: camera-independent committed basis`));
    }
  }
});

test('long-weapon off hands remain physically attached through cut and guard in either stance', () => {
  for (const id of ['sword', 'katana', 'axe']) for (const crouching of [false, true]) for (const meleePitch of [-1.25, .8]) {
    const p = MELEE_WEAPONS[id], guard = PARRY_PROFILES[id];
    for (const patch of [{ meleeTicks: 0, parryTicks: 0 }, { meleeTicks: p.recoveryTicks + p.activeTicks * .6 }, { meleeTicks: 0, parryTicks: guard.recoveryTicks + guard.activeTicks * .5, parryYaw: .3, parryPitch: meleePitch }]) {
      const player = actor(id, 0, { yaw: -.7, meleePitch, crouching, ...patch }), before = structuredClone(player);
      const grip = meleeSupportGrip(player, meleeWorldPose(player)), joints = operativePose(player);
      const hand = rotate(joints.arms[0].hand, player.yaw);
      hand.forEach((value, axis) => near(value, grip[axis] - [player.x, player.y, player.z][axis], `${id}: off hand follows long handle`));
      const idle = operativePose({ ...player, meleeTicks: 0, parryTicks: 0 });
      assert.deepEqual(joints.head, idle.head); assert.deepEqual(joints.torso, idle.torso); assert.deepEqual(joints.legs, idle.legs);
      assert.deepEqual(player, before);
    }
  }
  assert.equal(meleeSupportGrip(actor('knife', 0), {}), null);
  assert.equal(meleeSupportGrip(actor('tonfas', 0), {}), null);
});

test('all five blade rigs remain finite and cover-safe throughout load, cut, recovery and defense', () => {
  const wall = { colliders: [{ x: -4, y: 0, z: -.33, w: 8, h: 4, d: .015 }] };
  for (const id of Object.keys(MELEE_WEAPONS)) {
    const p = MELEE_WEAPONS[id], guard = PARRY_PROFILES[id];
    const ticks = [0, total(id), p.activeTicks + p.recoveryTicks + p.startupTicks * .5, p.activeTicks + p.recoveryTicks, p.recoveryTicks + p.activeTicks * .5, p.recoveryTicks, p.recoveryTicks * .5];
    const poses = ticks.map(t => actor(id, t, { yaw: 0, meleeYaw: 0, meleePitch: 0 }));
    if (guard) poses.push(actor(id, 0, { yaw: 0, parryYaw: 0, parryPitch: 0, parryTicks: guard.activeTicks + guard.recoveryTicks }));
    for (const player of poses) {
      const open = viewModel(player), covered = viewModel(player, wall);
      assert.ok(open.every(Number.isFinite) && covered.every(Number.isFinite));
      assert.ok(open.length / 10 < 1800, `${id}: both hands and blade fit within 1800 held vertices`);
      assert.ok(points(covered).every(([, , z]) => z > -.31501), `${id}: rolled blade and both gloves stay before the real wall`);
      assert.ok(meleeTrailMeshes(player, wall.colliders).length / 10 <= 48 * 18, 'ribbon brightness uses the existing bounded triangles');
    }
  }
});

test('all 36 gun meshes, pump strokes, reloads, ADS and cover states match the released 3.40.0 renderer byte for byte', () => {
  // Independently captured from release 19a148b before melee renderer edits:
  // 540 transformed/clipped world models and 360 real first-person states.
  const digest = createHash('sha256');
  const wall = { colliders: [{ x: -5, y: 0, z: -.35, w: 10, h: 4, d: .015 }] };
  const states = [{}, { aimTicks: 12 }, { reloadTicks: 160 }, { shotIndex: 1, shotCooldown: 10 }, { crouching: true }];
  const add = mesh => digest.update(Buffer.from(mesh.buffer, mesh.byteOffset, mesh.byteLength));
  assert.equal(Object.keys(WEAPONS).length, 36);
  for (const weapon of Object.keys(WEAPONS)) {
    for (const limit of [Infinity, -.10, 0, .25, .70]) for (const reloadProgress of [0, .4, .83]) {
      add(weaponMeshes(weapon, { x: .13, y: -.19, z: -.47, yaw: .63, pitch: -.27, scale: .91 }, { limit, reloadProgress, pump: .75 }));
    }
    for (const patch of states) for (const map of [null, wall]) {
      const player = { ...createCombatPlayer(0), weapon, ammo: WEAPONS[weapon].magazine, ...patch };
      add(VoxelRenderer.prototype._viewModel.call({ swayX: 0, swayY: 0, lastAim: null }, player, .23, -.12, 1000, false, map));
    }
  }
  assert.equal(digest.digest('hex'), 'b16c5f06d2568cc387550e46a5a1a6a3955092b0caa1217e42a72aa77973d2fc');
});
