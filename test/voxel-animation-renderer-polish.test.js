import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, WORLD } from '../public/voxel-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { MELEE_WEAPONS, PARRY_PROFILES } from '../public/voxel-melee.js';
import { playerAnimationPose, weaponReloadPose } from '../public/voxel-player-animation.js';
import { monsterLocomotionPose } from '../public/voxel-monster-animation.js';
import { operativePose, operativeBladePose, operativeFirearmPose, operativeMeshes, ninjaOperativeMeshes, operativePlayerMeshes, meleeMeshes, createMonsterAnimationPresenter, VoxelRenderer } from '../public/voxel-renderer.js';

const arena = { id: 'animation-articulation', theme: 'dojo', bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [], sites: [] };
const actor = (patch = {}) => ({ ...createCombatPlayer(0), x: 0, y: 0, z: 0, lifeId: 1, ...patch });
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} versus ${b}`);
const distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const rotateYaw = (point, yaw) => [point[0] * Math.cos(yaw) - point[2] * Math.sin(yaw), point[1], point[0] * Math.sin(yaw) + point[2] * Math.cos(yaw)];
const world = (point, player) => rotateYaw(point, player.yaw).map((value, axis) => value + [player.x, player.y, player.z][axis]);
const points = mesh => Array.from({ length: mesh.length / 10 }, (_, at) => [...mesh.slice(at * 10, at * 10 + 3)]);
const ticks = (profile, phase, progress) => phase === 'startup' ? profile.startupTicks * (1 - progress) + profile.activeTicks + profile.recoveryTicks : phase === 'active' ? profile.activeTicks * (1 - progress) + profile.recoveryTicks : profile.recoveryTicks * (1 - progress);

function harness() {
  const calls = { buffers: 0, allocations: 0, matrices: {} };
  const gl = new Proxy({}, { get(_, key) {
    if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
    if (key === 'getAttribLocation') return () => 0;
    if (key === 'getUniformLocation') return (_program, uniform) => uniform;
    if (key === 'createBuffer') return () => { calls.buffers++; return {}; };
    if (key === 'bufferData') return () => { calls.allocations++; };
    if (key === 'uniformMatrix4fv') return (name, _transpose, value) => { calls.matrices[name] = [...value]; };
    if (typeof key === 'string' && key.startsWith('create')) return () => ({});
    return () => {};
  } });
  return { renderer: new VoxelRenderer({ getContext: () => gl, getBoundingClientRect: () => ({ width: 960, height: 540 }), addEventListener() {}, removeEventListener() {} }), calls };
}
const scene = players => ({ gameId: 'voxel-breach', map: arena, phase: 'fight', round: 1, tick: 100, players, events: [] });

// Real palms are boxes in the common world batch, not extra boxes scaled by the blade.
function actualPalm(mesh, hand, player, ninja) {
  const cloud = points(mesh), half = ninja ? .04 : .037;
  for (const x of [-half, half]) for (const y of [ninja ? -.039 : -.037, ninja ? .039 : .037]) for (const z of [-half, half]) {
    const corner = world([hand[0] + x, hand[1] + y, hand[2] + z], player);
    assert.ok(cloud.some(point => distance(corner, point) < 2e-6), 'the actual unscaled palm corners reach the equipment grip');
  }
}

test('every blade keeps its actual unscaled palms attached in idle, cut, recovery and parry poses', () => {
  for (const meleeWeapon of Object.keys(MELEE_WEAPONS)) for (const crouching of [false, true]) for (const phase of ['idle', 'startup', 'active', 'recovery', 'parry']) {
    const profile = phase === 'parry' ? PARRY_PROFILES[meleeWeapon] : MELEE_WEAPONS[meleeWeapon];
    if (!profile) continue;
    const player = actor({ slot: 'sword', meleeWeapon, crouching, yaw: .731, pitch: .45, meleeYaw: .731, meleePitch: .45, parryYaw: .731, parryPitch: .45,
      meleeTicks: phase === 'idle' || phase === 'parry' ? 0 : ticks(profile, phase, .45), parryTicks: phase === 'parry' ? ticks(profile, 'active', .5) : 0 });
    const before = structuredClone(player), animation = playerAnimationPose(player, .19), joints = operativePose(player, animation);
    for (const hand of MELEE_WEAPONS[meleeWeapon].dualWield ? [0, 1] : [0]) {
      const held = operativeBladePose(player, hand), palm = world(joints.arms[hand === 0 ? 1 : 0].hand, player);
      assert.ok(distance(palm, [held.pose.x, held.pose.y - .025, held.pose.z]) < 1e-9, `${meleeWeapon} ${phase}: exact primary grasp`);
    }
    for (const ninja of [false, true]) {
      const body = ninja ? ninjaOperativeMeshes(player, 190, animation) : operativeMeshes(player, 190, false, animation);
      for (const arm of joints.arms) actualPalm(body, arm.hand, player, ninja);
      const models = MELEE_WEAPONS[meleeWeapon].dualWield ? [0, 1].reduce((total, hand) => total + meleeMeshes(player, operativeBladePose(player, hand).pose, { hand }).length, 0) : meleeMeshes(player, operativeBladePose(player).pose).length;
      const composed = operativePlayerMeshes(player, arena, 190, animation, { ninjaSkins: ninja });
      assert.ok(composed.length <= body.length + models, 'world equipment adds its blade only, with no giant duplicate hand/sleeve blocks');
      assert.ok(composed.length > body.length, 'visible weapon remains in the actual gameplay batch');
    }
    assert.deepEqual(player, before);
  }
});

test('long-blade shoulders load, cut across the body and recover without moving the real head or feet', () => {
  for (const meleeWeapon of ['sword', 'katana', 'axe']) {
    const player = actor({ slot: 'sword', meleeWeapon }), idle = operativePose(player), phases = [];
    for (const [phase, progress] of [['startup', .9], ['active', .1], ['active', .9], ['recovery', .15], ['recovery', .95]]) {
      const pose = operativePose({ ...player, meleeTicks: ticks(MELEE_WEAPONS[meleeWeapon], phase, progress) });
      assert.deepEqual(pose.head, idle.head); assert.deepEqual(pose.legs, idle.legs);
      near(pose.torso.hipY, idle.torso.hipY); near(pose.torso.chestY, idle.torso.chestY);
      assert.ok(Math.abs(pose.torso.shoulderYaw) <= .1);
      phases.push(pose.combat.turn);
    }
    assert.ok(phases[0] * phases[2] < 0, 'shoulders load and rotate through the cut');
    assert.ok(Math.abs(phases[4]) < Math.abs(phases[3]), 'accepted recovery releases the shoulder load');
  }
});

test('remote reload palms follow the real magazine, pouch, bolt and distinct equipment instead of a torso approximation', () => {
  for (const weapon of ['carbine', 'classic', 'bucky', 'sheriff', 'outlaw', 'odin', 'crossbow', 'dualpistols', 'dualsmg']) {
    let previous = null, changed = 0;
    for (const progress of [.20, .30, .40, .56, .715, .83, .96]) {
      const player = actor({ weapon, crouching: true, pitch: 1.4, yaw: -.731, reloadTicks: WEAPONS[weapon].reloadTicks * (1 - progress) });
      const animation = { ...playerAnimationPose(player, .19), reload: weaponReloadPose(weapon, progress) }, joints = operativePose(player, animation);
      for (const [index, arm] of joints.arms.entries()) {
        const hand = WEAPONS[weapon].dualWield && index === 0 ? 1 : 0, held = operativeFirearmPose(player, animation, animation.reload, hand);
        const contact = WEAPONS[weapon].dualWield || index === 1 ? held.right : held.support;
        near(distance(world(arm.hand, player), contact), 0);
        assert.ok(arm.hand[1] + .04 <= WORLD.crouchHeight + 1e-8, 'the complete gun lowers together with the grip at steep pitch');
        actualPalm(operativeMeshes(player, 190, false, animation), arm.hand, player, false);
      }
      if (previous && joints.arms.some((arm, index) => distance(arm.hand, previous.arms[index].hand) > .001)) changed++;
      previous = joints;
    }
    assert.ok(changed >= 3, `${weapon}: accepted mechanical stages visibly change the actual grasp`);
  }
});

test('human stance-phase feet stay planted while gait twist affects only the real garment', () => {
  const player = actor({ vx: 2, vz: -5, sprinting: true });
  let planted = 0, doubleSupport = 0, swinging = 0;
  for (let frame = 0; frame < 240; frame++) {
    const animation = playerAnimationPose(player, frame / 240), joints = operativePose(player, animation);
    near(joints.torso.shoulderYaw, animation.shoulderYaw); near(joints.torso.hipsYaw, animation.hipsYaw);
    const body = operativeMeshes(player, frame * 1000 / 240, false, animation);
    for (const [index, leg] of joints.legs.entries()) {
      if (animation.legs[index].clearance === 0) { near(leg.foot[1], .018); assert.equal(leg.planted, true); assert.equal(leg.contact, 1); planted++; }
      else if (leg.lift > .02) swinging++;
    }
    if (joints.legs.every(leg => leg.planted)) doubleSupport++;
    for (const arm of joints.arms) actualPalm(body, arm.hand, player, false);
  }
  assert.ok(planted > 100 && swinging > 10 && doubleSupport > 0, 'real movement includes loaded stance, swing clearance and double support');
});

test('monster attack presentation uses accepted tells with projected gait, pauses safely and clears bounded history', () => {
  const present = createMonsterAnimationPresenter({ maxMonsters: 2 });
  const player = actor({ id: 7, monster: true, human: false, monsterType: 'stalker', monsterState: 'windup', attackDuration: 48, attackTicks: 48 });
  const project = (ticks, state = 'windup') => ({ ...player, x: .4, attackTicks: ticks, monsterState: state });
  let pose = present(project(2), 0, 'round', { acceptedPlayer: player });
  near(pose.attack.progress, 0, 0); assert.equal(pose.attack.phase, 'startup');
  const beginning = monsterLocomotionPose(player, pose);
  for (const time of [4, 8, 16, 24]) pose = present(project(2), time, 'round', { acceptedPlayer: player });
  near(pose.attack.progress, 0, 0); assert.equal(pose.speed, 0, 'projected timer cannot advance the accepted tell or stationary feet');
  pose = present(project(1), 100, 'round', { acceptedPlayer: { ...player, attackTicks: 1 } });
  const motion = monsterLocomotionPose(project(1), pose);
  assert.equal(motion.active, true); assert.ok(motion.arms.some((arm, index) => arm.hand[1] > beginning.arms[index].hand[1] + .12), 'settled windup really articulates the raised warning');
  const held = present(project(1), 110, 'round', { acceptedPlayer: { ...player, attackTicks: 1 }, paused: true });
  assert.deepEqual(present(project(1), 310, 'round', { acceptedPlayer: { ...player, attackTicks: 1 }, paused: true }).attack, held.attack);
  present(project(1), 320, 'round', { acceptedPlayer: { ...player, attackTicks: 1 } });
  pose = present(project(0, 'recover'), 330, 'round', { acceptedPlayer: { ...player, attackTicks: 0, monsterState: 'recover' } });
  assert.equal(pose.attack.phase, 'contact');
  pose = present(project(0, 'recover'), 440, 'round', { acceptedPlayer: { ...player, attackTicks: 0, monsterState: 'recover' } });
  assert.equal(pose.attack.phase, 'recovery');
  pose = present(project(0, 'chase'), 700, 'round', { acceptedPlayer: { ...player, attackTicks: 0, monsterState: 'chase' } });
  assert.equal(pose.attack.phase, 'idle');
  for (let id = 0; id < 5; id++) present({ ...player, id }, 800, 'round');
  assert.equal(present.size, 2); assert.equal(present.attackSize, 2);
  present.retain([4]); assert.equal(present.size, 1); assert.equal(present.attackSize, 1);
  present.reset(); assert.equal(present.size, 0); assert.equal(present.attackSize, 0);
});

test('rendered human/monster diagnostic joints and equipment are immutable, honest and reuse existing GPU resources', () => {
  const { renderer, calls } = harness(), local = actor(), teammate = actor({ id: 1, weapon: 'carbine', x: 2, z: -3, reloadTicks: 200 });
  const monster = actor({ id: 7, monster: true, human: false, monsterType: 'stalker', z: -4, monsterState: 'windup', attackDuration: 48, attackTicks: 1 });
  const state = { ...scene([local, teammate, monster]), gameId: 'voxel-horde' };
  renderer.render(state, { localId: 0, time: 0, acceptedPlayers: state.players });
  const buffers = calls.buffers, allocations = calls.allocations;
  const human = renderer.stats.humanAnimation.poses.find(pose => pose.id === 1), enemy = renderer.stats.monsterAnimation.poses[0];
  assert.ok(Object.isFrozen(human.arms[0].hand) && Object.isFrozen(human.firearms[0].pose) && Object.isFrozen(human.legs[0]));
  assert.throws(() => { human.arms[0].hand[1] = 99; }, TypeError);
  assert.ok(enemy.active && enemy.attack.phase === 'startup' && enemy.charge > .9 && enemy.combatBlend > .9);
  assert.ok(Object.isFrozen(enemy.attack) && Object.isFrozen(enemy.arms[0].hand));
  const support = human.firearms[0].support; near(distance(world(human.arms[0].hand, teammate), support), 0);
  for (const time of [4, 8, 16, 24]) renderer.render(state, { localId: 0, time, acceptedPlayers: state.players });
  assert.equal(calls.buffers, buffers); assert.equal(calls.allocations, allocations);
  assert.ok(renderer.stats.drawCalls <= 7 && renderer.stats.dynamicVertices <= 72000);
  renderer.resetEffects(); assert.equal(renderer.stats.monsterAnimation.cachedAttacks, 0);
  assert.equal(renderer.stats.humanAnimation.poses.length, 0); renderer.destroy();
});

test('first-person gun-only yaw and roll use the actual motion while reduced-motion forwarding preserves settled aim', () => {
  const player = actor({ weapon: 'carbine' }), receiver = { lastAim: null, swayX: 0, swayY: 0, firstPersonMotion: { weaponX: 0, weaponY: 0, weaponZ: 0, weaponPitch: 0, weaponYaw: .1, weaponRoll: .08 } };
  const carrying = VoxelRenderer.prototype._viewModel.call(receiver, player, 0, 0, 1000);
  const neutral = VoxelRenderer.prototype._viewModel.call({ ...receiver, firstPersonMotion: { ...receiver.firstPersonMotion, weaponYaw: 0, weaponRoll: 0 } }, player, 0, 0, 1000);
  assert.notDeepEqual(carrying, neutral, 'gun carry rotation is visible in the actual view model');
  const { renderer } = harness(); let reduced = null;
  const present = renderer.presentHead;
  renderer.presentHead = (actor, time, context, options) => { reduced = options.reducedMotion; return present(actor, time, context, options); };
  renderer.presentHead.reset = () => present.reset();
  renderer.render(scene([player]), { localId: 0, time: 0, reducedMotion: true });
  assert.equal(reduced, true); assert.equal(renderer.stats.firstPerson.bobY, 0); assert.equal(renderer.stats.firstPerson.roll, 0);
  renderer.destroy();
});
