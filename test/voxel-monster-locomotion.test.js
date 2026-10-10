import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, WORLD } from '../public/voxel-engine.js';
import { monsterBodyBoxes, monsterBodyProfile } from '../public/voxel-monster-bodies.js';
import { monsterLocomotionPose } from '../public/voxel-monster-animation.js';
import { monsterMeshes, monsterAnimationPose, createMonsterAnimationPresenter } from '../public/voxel-renderer.js';

const TYPES = ['stalker', 'runner', 'brute', 'gunner', 'sniper', 'hound', 'leaper', 'screecher', 'bomber', 'spitter', 'weaver'];
const actor = (type, patch = {}) => ({ ...createCombatPlayer(7), monster: true, human: false, monsterType: type, x: 2.25, y: 4, z: -3.5, lifeId: 1, monsterState: 'chase', ...patch });
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('every species bends its knees and lifts swing feet while the opposing feet remain planted', () => {
  const rhythms = new Set();
  for (const type of TYPES) {
    const player = actor(type), before = structuredClone(player);
    const left = monsterLocomotionPose(player, { phase: 0, stride: 1, speed: 7 });
    const right = monsterLocomotionPose(player, { phase: Math.PI, stride: 1, speed: 7 });
    const legs = type === 'hound' ? left.paws : left.legs;
    assert.ok(legs.some(leg => leg.foot[1] > .08), `${type}: clearly raised swing foot`);
    assert.ok(legs.some(leg => leg.foot[1] < .02), `${type}: actual planted opposite foot`);
    assert.ok(legs.every(leg => leg.hip[1] > leg.knee[1] && leg.knee[1] > leg.ankle[1]), `${type}: bent articulated chain`);
    assert.notDeepEqual(left, right, `${type}: alternating steps change the joints`);
    const travel = monsterLocomotionPose(player, { phase: Math.PI / 2, stride: 1, speed: 7 });
    if (type !== 'hound') {
      assert.ok(Math.abs(travel.legs[0].foot[2] - travel.legs[1].foot[2]) >= .125, `${type}: noticeable travel replaces a tiny translation`);
      rhythms.add(JSON.stringify([left.legs[0].lift, travel.legs[0].foot[2], travel.arms[0].hand]));
    }
    assert.deepEqual(player, before, 'cosmetic joints do not mutate authority');
    near(left.bodyBob, 0);
    assert.ok(monsterLocomotionPose(player, { phase: Math.PI / 2, stride: 1 }).bodyBob < 0, 'weight drops into the real torso rather than raising the head');
  }
  assert.ok(rhythms.size >= 8, 'heavy, sprinting, ranged and special species have distinct locomotion');
});

test('actual animated vertices remain hittable during slow steps, full runs, strafing, takeoff, falling and landing', () => {
  const poses = [];
  for (const stride of [.15, .6, 1]) for (const [forward, strafe] of [[1, 0], [-1, 0], [0, 1], [.7071, .7071]]) for (let index = 0; index < 16; index++) poses.push({ phase: index * Math.PI / 8, stride, speed: stride * 7, forward, strafe });
  poses.push({ phase: 0, stride: 0, airborne: true, jump: 1 }, { phase: 1, stride: 0, airborne: true, fall: 1 }, { phase: 2, stride: 0, land: 1 });
  for (const type of TYPES) for (const animation of poses) {
    const player = actor(type, { yaw: .731 }), before = structuredClone(player), mesh = monsterMeshes(player, 1000, animation);
    const c = Math.cos(player.yaw), s = Math.sin(player.yaw), body = monsterBodyProfile(player), boxes = monsterBodyBoxes(player);
    assert.ok(mesh.every(Number.isFinite) && mesh.length / 10 <= 1300, `${type}: bounded finite anatomy`);
    for (let at = 0; at < mesh.length; at += 10) {
      const dx = mesh[at] - player.x, y = mesh[at + 1] - player.y, dz = mesh[at + 2] - player.z;
      const x = c * dx + s * dz, z = -s * dx + c * dz;
      assert.ok(y >= -2e-6 && y <= (body?.height || WORLD.standHeight) + 2e-6, `${type}: real physical height`);
      if (boxes) assert.ok(boxes.some(box => x >= box.x - 2e-6 && x <= box.x + box.w + 2e-6 && y >= box.y - 2e-6 && y <= box.y + box.h + 2e-6 && z >= box.z - 2e-6 && z <= box.z + box.d + 2e-6), `${type}: ${[x, y, z]} stays inside real flesh`);
      else {
        const radius = y > 1.48 + 2e-6 ? .22 : .29;
        assert.ok(Math.hypot(x, z) <= radius + 2e-6, `${type}: ${[x, y, z]} remains inside the shooting envelope at any yaw`);
      }
    }
    assert.deepEqual(player, before);
  }
});

test('distance gait is identical at 60, 120 and 240 Hz and held through airborne travel and landing', () => {
  for (const type of TYPES) {
    const outcomes = [];
    for (const refresh of [60, 120, 240]) {
      const present = createMonsterAnimationPresenter(), base = actor(type, { x: 0, y: 0, z: 0 }), initial = present(base, 0, 'match');
      let animation;
      for (let frame = 1; frame <= refresh; frame++) animation = present({ ...base, z: -frame * 6 / refresh }, frame * 1000 / refresh, 'match');
      outcomes.push(animation);
      const airborne = { ...base, z: -6.1, y: .5, grounded: false, vy: 6 };
      let jump = present(airborne, 1020, 'match');
      const heldPhase = jump.phase;
      for (let frame = 1; frame <= 20; frame++) jump = present({ ...airborne, y: .5 + frame * .02, z: -6.1 - frame * .03, vy: -3 }, 1020 + frame * 10, 'match');
      assert.equal(jump.phase, heldPhase, `${type}: feet do not run on invisible ground`);
      assert.equal(jump.airborne, true);
      assert.ok(monsterLocomotionPose(airborne, jump).legs.concat(monsterLocomotionPose(airborne, jump).paws).every(leg => leg.foot[1] > .04), 'airborne knees tuck without a ground contact');
      let landing = present({ ...base, z: -6.7, y: 0 }, 1230, 'match');
      assert.equal(landing.airborne, false); assert.ok(landing.land > .25, 'real downward landing compresses the weight');
      for (let frame = 1; frame <= 150; frame++) landing = present({ ...base, z: -6.7 }, 1230 + frame * 10, 'match');
      assert.equal(landing.land, 0); assert.equal(landing.stride, 0, 'stopped joints settle fully');
      assert.equal(initial.stride, 0);
    }
    for (const outcome of outcomes.slice(1)) { near(outcome.phase, outcomes[0].phase); near(outcome.stride, outcomes[0].stride); near(outcome.speed, outcomes[0].speed); }
  }
});

test('armed hands remain attached to their gun while running; motion stops completely for idle and death', () => {
  for (const type of ['gunner', 'sniper']) {
    const player = actor(type, { monsterState: 'aiming' });
    for (const phase of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const motion = monsterLocomotionPose(player, { phase, stride: 1 });
      assert.deepEqual(motion.arms[1].hand, [.120, 1.245, -.180]);
      assert.deepEqual(motion.arms[0].hand, [.063, 1.245, -.210]);
    }
  }
  for (const type of TYPES) {
    const player = actor(type);
    assert.deepEqual(monsterMeshes(player, 200, { phase: 0, stride: 0 }), monsterMeshes(player, 9000, { phase: 4, stride: 0 }), `${type}: a parked monster never jitters`);
    const dead = { ...player, alive: false };
    assert.deepEqual(monsterMeshes(dead, 200, { phase: 0, stride: 0 }), monsterMeshes(dead, 9000, { phase: 4, stride: 1 }), `${type}: death suppresses locomotion`);
    assert.equal(monsterAnimationPose({ ...player, grounded: false, vy: 6, vx: 6 }, 200).phase, 0);
    const present = createMonsterAnimationPresenter(); present(player, 0, 'match');
    assert.equal(present({ ...player, z: player.z - .1 }, 20, 'match').stride > 0, true);
    assert.equal(present({ ...player, monsterType: type === 'hound' ? 'runner' : 'hound' }, 40, 'match').stride, 0, 'recycled type clears old joint motion');
  }
});
