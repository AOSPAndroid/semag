import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer } from '../public/voxel-engine.js';
import { MONSTER_BODIES } from '../public/voxel-monster-bodies.js';
import { MONSTER_QUADRUPED_GAITS, monsterLocomotionPose, monsterAttackPose, monsterGaitCycleMetres, createMonsterAttackPresenter } from '../public/voxel-monster-animation.js';
import { createMonsterAnimationPresenter } from '../public/voxel-renderer.js';
import { createEnemyFootstepPresenter, createVoxelFootstepSamples, VOXEL_FOOTSTEP_AUDIO } from '../public/voxel-footsteps.js';

const TYPES = ['vampire', 'witch', 'wolf', 'pig', 'rat', 'stag'], ANIMALS = TYPES.slice(2);
const actor = (monsterType, patch = {}) => ({ ...createCombatPlayer(7), monster: true, human: false, monsterType, lifeId: 1, x: 3, y: 0, z: -3, monsterState: 'chase', ...patch });
const listener = { ...createCombatPlayer(0), x: 0, y: 0, z: 0, yaw: 0, alive: true };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} should equal ${b}`);

test('four animal species have species-sized articulated paws and real alternating support rather than human limbs', () => {
  const signatures = new Set();
  for (const type of ANIMALS) {
    const player = actor(type), before = structuredClone(player), profile = MONSTER_QUADRUPED_GAITS[type];
    const idle = monsterLocomotionPose(player, { stride: 0, phase: 1.2 });
    assert.equal(idle.paws.length, 4); assert.equal(idle.legs.length, 0); assert.equal(idle.arms.length, 0);
    assert.ok(idle.paws.every(paw => paw.planted && paw.lift === 0));
    assert.deepEqual(idle.paws.map(paw => [paw.hip[0], paw.hip[2]]), [[-profile.x, profile.frontZ], [-profile.x, profile.rearZ], [profile.x, profile.frontZ], [profile.x, profile.rearZ]]);
    let prior, contacts = 0;
    const supports = [0, 0, 0, 0];
    for (let sample = 0; sample <= 64; sample++) {
      const pose = monsterLocomotionPose(player, { stride: 1, run: 1, phase: (sample + .1) * Math.PI * 2 / 64 });
      assert.equal(pose.paws.filter(paw => paw.planted).length, 2);
      assert.ok(pose.bodyBob >= -profile.maxBob && pose.bodyBob <= 0);
      for (const [index, paw] of pose.paws.entries()) {
        assert.ok(paw.hip[1] > paw.knee[1] && paw.knee[1] > paw.ankle[1]);
        if (paw.planted) { near(paw.lift, 0); near(paw.foot[1], profile.footY); if (sample < 64) supports[index]++; }
        else assert.ok(paw.lift > 0);
      }
      if (prior && pose.paws.some((paw, index) => paw.planted && !prior[index].planted)) contacts++;
      prior = pose.paws;
    }
    assert.deepEqual(supports, [32, 32, 32, 32]); assert.equal(contacts, 2, 'four paws create two coordinated contacts per cycle');
    const move = monsterLocomotionPose(player, { stride: 1, run: 1, phase: 0 });
    if (type === 'stag') assert.equal(move.paws[0].planted, move.paws[2].planted, 'long-legged stag bounds on front/rear pairs');
    else assert.equal(move.paws[0].planted, move.paws[3].planted, 'other species trot on diagonal supports');
    signatures.add(JSON.stringify([profile.hipY, move.paws.map(paw => paw.foot), monsterGaitCycleMetres(type)]));
    assert.deepEqual(player, before);
  }
  assert.equal(signatures.size, 4);
});

test('new species observe distance at 60, 120 and 240 Hz and freeze ground cadence during airborne motion', () => {
  for (const type of TYPES) {
    const results = [];
    for (const hz of [60, 120, 240]) {
      const present = createMonsterAnimationPresenter(), base = actor(type, { x: 0, z: 0 });
      present(base, 0, 'round'); let pose;
      for (let frame = 1; frame <= hz; frame++) pose = present({ ...base, z: -6 * frame / hz }, 1000 * frame / hz, 'round');
      results.push(pose);
      const flying = { ...base, z: -6.1, y: .2, grounded: false, vy: 6 };
      pose = present(flying, 1020, 'round'); const phase = pose.phase;
      for (let frame = 1; frame <= 10; frame++) pose = present({ ...flying, z: -6.1 - frame * .04, y: .2 + frame * .03 }, 1020 + frame * 10, 'round');
      near(pose.phase, phase);
      const joints = monsterLocomotionPose(flying, pose);
      assert.ok([...joints.paws, ...joints.legs].every(leg => !leg.planted && leg.lift > 0));
      present({ ...base, z: -6.5 }, 1140, 'round');
      for (let frame = 1; frame <= 150; frame++) pose = present({ ...base, z: -6.5 }, 1140 + frame * 10, 'round');
      assert.equal(pose.stride, 0); assert.equal(pose.land, 0);
      assert.equal(present({ ...base, lifeId: 2 }, 2700, 'round').stride, 0, 'recycled lives discard the former gait');
      present.reset(); assert.equal(present.size, 0); assert.equal(present.attackSize, 0);
    }
    for (const pose of results.slice(1)) for (const key of ['phase', 'stride', 'speed']) near(pose[key], results[0][key]);
  }
});

test('vampire rush and witch hex share accepted startup and release timing without inventing a hit after cancellation or an online menu', () => {
  for (const [type, state] of [['vampire', 'lungeWindup'], ['witch', 'hexing'], ['pig', 'lungeWindup'], ['wolf', 'windup'], ['rat', 'windup'], ['stag', 'windup']]) {
    const player = actor(type, { monsterState: state, attackDuration: 96, attackTicks: 96 }), before = structuredClone(player);
    const release = createMonsterAttackPresenter(); release(player, 0, 'round');
    const telling = release({ ...player, attackTicks: 1 }, 100, 'round');
    assert.equal(telling.phase, 'startup'); assert.equal(telling.kind, state); assert.ok(telling.windup > .95);
    assert.equal(release({ ...player, monsterState: 'recover', attackTicks: 0 }, 110, 'round').phase, 'contact');
    assert.equal(release({ ...player, monsterState: 'recover', attackTicks: 0 }, 500, 'round').phase, 'idle');
    const cancel = createMonsterAttackPresenter(); cancel(player, 0, 'round'); cancel({ ...player, attackTicks: 10 }, 50, 'round');
    assert.equal(cancel({ ...player, monsterState: 'stagger', attackTicks: 0 }, 60, 'round').phase, 'recovery');
    const online = createMonsterAttackPresenter(); online(player, 0, 'round');
    online({ ...player, attackTicks: 20 }, 100, 'round', { paused: true });
    online({ ...player, monsterState: 'recover', attackTicks: 0 }, 200, 'round', { paused: true });
    assert.equal(online({ ...player, monsterState: 'chase', attackTicks: 0 }, 300, 'round').phase, 'idle', 'server-completed tell cannot replay a stale contact on resume');
    assert.deepEqual(player, before);
  }
});

test('coerced identities cannot claim trusted animal joints, special attack tells or species audio', () => {
  for (const type of TYPES) for (const invalid of [[type], new String(type), { toString: () => type }]) {
    const fake = actor(type, { monsterType: invalid, monsterState: type === 'witch' ? 'hexing' : 'windup', attackTicks: 1, attackDuration: 96 });
    assert.equal(monsterAttackPose(fake).active, false);
    assert.equal(monsterLocomotionPose(fake, { stride: 1 }).paws.length, 0);
    assert.equal(monsterGaitCycleMetres(invalid), 3);
    assert.equal(createVoxelFootstepSamples(invalid), null);
  }
});

test('new contact sounds follow actual rendered touchdown at every refresh rate and stop with the actor', () => {
  for (const type of TYPES) {
    const counts = [];
    for (const hz of [60, 120, 240]) {
      const calls = [], audio = { enabled: true, footstep: (type, options) => { calls.push({ type, ...options }); return true; }, stopFootsteps() {} };
      const steps = createEnemyFootstepPresenter(audio), gait = createMonsterAnimationPresenter(), base = actor(type);
      let prior, lastPlayer, lastMotion;
      for (let frame = 0; frame <= hz * 4; frame++) {
        const now = frame * 1000 / hz, player = { ...base, x: base.x + frame / hz }, motion = gait(player, now, 'round'), joints = monsterLocomotionPose(player, motion);
        const before = calls.length; steps.observe([{ ...player, ...motion }], { now, listener, context: 'round' });
        if (calls.length > before) {
          assert.equal(calls.at(-1).type, type); assert.ok(calls.at(-1).gain > 0);
          assert.ok([...joints.paws, ...joints.legs].some((limb, index) => limb.planted && !prior[index].planted), `${type}: sound coincides with the actual planted support`);
        }
        prior = [...joints.paws, ...joints.legs]; lastPlayer = player; lastMotion = motion;
      }
      assert.ok(calls.length >= 2); counts.push(calls.length);
      const stoppedCount = calls.length;
      for (let frame = 1; frame <= hz; frame++) {
        const now = 4000 + frame * 1000 / hz, motion = gait(lastPlayer, now, 'round');
        steps.observe([{ ...lastPlayer, ...motion }], { now, listener, context: 'round' });
      }
      assert.equal(calls.length, stoppedCount, 'settling limbs without displacement do not make phantom contacts');
      steps.observe([{ ...lastPlayer, ...lastMotion, alive: false }], { now: 5020, listener, context: 'round' });
      assert.equal(steps.inspect().trackedActors, 0); assert.equal(calls.length, stoppedCount);
    }
    assert.deepEqual(counts, [counts[0], counts[0], counts[0]], `${type}: display refresh cannot speed the audible cadence`);
    assert.ok(Object.isFrozen(VOXEL_FOOTSTEP_AUDIO[type]));
  }
  assert.ok(VOXEL_FOOTSTEP_AUDIO.rat.gain < VOXEL_FOOTSTEP_AUDIO.pig.gain && VOXEL_FOOTSTEP_AUDIO.rat.range < VOXEL_FOOTSTEP_AUDIO.stag.range);
  assert.ok(MONSTER_BODIES.rat.height < MONSTER_BODIES.wolf.height);
});
