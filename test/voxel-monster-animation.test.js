import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, WORLD } from '../public/voxel-engine.js';
import { monsterBodyBoxes, monsterBodyProfile } from '../public/voxel-monster-bodies.js';
import { monsterAttackPose, monsterLocomotionPose, createMonsterAttackPresenter } from '../public/voxel-monster-animation.js';
import { monsterMeshes } from '../public/voxel-renderer.js';

const TYPES = ['stalker', 'runner', 'brute', 'hound', 'leaper', 'screecher', 'bomber', 'spitter', 'weaver'];
const actor = (type = 'stalker', patch = {}) => ({
  ...createCombatPlayer(7), monster: true, human: false, monsterType: type, x: 0, y: 0, z: 0, lifeId: 1,
  monsterState: 'windup', attackTicks: 48, attackDuration: 48, roarTicks: 72, roarDuration: 72, ...patch,
});
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should equal ${expected}`);

test('a settled monster visibly articulates its accepted windup with both support feet planted', () => {
  for (const type of TYPES.filter(type => type !== 'hound')) {
    const player = actor(type), before = structuredClone(player);
    const beginning = monsterLocomotionPose(player, { phase: 0, stride: 0 });
    const charged = monsterLocomotionPose({ ...player, attackTicks: 1 }, { phase: 2, stride: 0 });
    assert.equal(beginning.active, true, `${type}: settled attack uses the articulated limbs`);
    assert.equal(charged.attack.phase, 'startup');
    assert.ok(charged.arms[0].hand[1] > beginning.arms[0].hand[1] + .12, `${type}: a raised arm clearly warns before contact`);
    assert.ok(charged.legs.every(leg => leg.planted && leg.lift === 0), `${type}: no stationary running cycle`);
    assert.deepEqual(charged.legs.map(leg => leg.foot), beginning.legs.map(leg => leg.foot));
    assert.deepEqual(player, before, 'poses never change an authoritative attack');
  }
  const hound = monsterLocomotionPose(actor('hound'), { phase: 1.2, stride: 0 });
  assert.equal(hound.active, true);
  assert.ok(hound.paws.every(paw => paw.planted && paw.lift === 0));
});

test('contact and recovery join the anticipation without a limb intent snap', () => {
  const player = actor('runner');
  const stage = (phase, progress) => monsterAttackPose(player, { attack: { phase, progress, kind: 'windup' } });
  const startupEnd = stage('startup', 1), contactStart = stage('contact', 0);
  const contactEnd = stage('contact', 1), recoveryStart = stage('recovery', 0);
  for (const key of ['windup', 'extension', 'weight', 'brace']) {
    near(startupEnd[key], contactStart[key]); near(contactEnd[key], recoveryStart[key]);
  }
  assert.ok(stage('contact', .7).extension > startupEnd.extension + .5, 'the released claw reaches forward before easing back');
  const settled = stage('recovery', 1);
  assert.equal(settled.windup, 0); assert.equal(settled.extension, 0); assert.equal(settled.weight, 0); assert.equal(settled.brace, 0);
});

test('accepted timers drive a smoothed tell and only an accepted release starts the bounded contact tail', () => {
  const present = createMonsterAttackPresenter(), player = actor(), before = structuredClone(player);
  assert.equal(present(player, 0, 'match').progress, 0);
  const half = { ...player, attackTicks: 24 };
  let pose = present(half, 100, 'match');
  assert.equal(pose.phase, 'startup'); assert.ok(pose.progress > .45 && pose.progress <= .5);
  pose = present(half, 140, 'match');
  assert.ok(pose.progress <= .5, 'wall time cannot predict unseen attack progress');
  pose = present({ ...player, attackTicks: 0 }, 150, 'match');
  assert.equal(pose.phase, 'contact'); assert.equal(pose.progress, 0);
  assert.equal(Object.isFrozen(pose), true);
  const recovery = { ...player, monsterState: 'recover', attackTicks: 0 };
  pose = present(recovery, 200, 'match'); assert.equal(pose.phase, 'contact'); assert.ok(pose.extension > .4);
  pose = present(recovery, 260, 'match'); assert.equal(pose.phase, 'recovery');
  pose = present(recovery, 440, 'match'); assert.equal(pose.phase, 'idle'); assert.equal(pose.weight, 0);
  assert.deepEqual(player, before);
});

test('a tell observed completing between snapshots gets a release pose, but a stagger never invents a strike', () => {
  const player = actor('brute'), released = createMonsterAttackPresenter(), interrupted = createMonsterAttackPresenter();
  released(player, 0, 'match'); interrupted(player, 0, 'match');
  const telling = { ...player, attackTicks: 25 };
  released(telling, 100, 'match'); const before = interrupted(telling, 100, 'match');
  assert.equal(released({ ...player, monsterState: 'recover', attackTicks: 0 }, 110, 'match').phase, 'contact');
  let pose = interrupted({ ...player, monsterState: 'stagger', attackTicks: 0 }, 110, 'match');
  assert.equal(pose.phase, 'recovery'); near(pose.windup, before.windup); near(pose.extension, before.extension);
  assert.equal(Object.isFrozen(pose.recoveryFrom), true);
  pose = interrupted({ ...player, monsterState: 'stagger', attackTicks: 0 }, 170, 'match');
  assert.ok(pose.windup < before.windup); assert.ok(pose.extension <= before.extension);
  pose = interrupted({ ...player, monsterState: 'chase', attackTicks: 0 }, 330, 'match');
  assert.equal(pose.phase, 'idle');
});

test('pause freezes the attack pose and resume discards elapsed wall time', () => {
  const present = createMonsterAttackPresenter(), player = actor('hound');
  present(player, 0, 'match');
  present({ ...player, attackTicks: 0 }, 100, 'match');
  const recovery = { ...player, monsterState: 'recover', attackTicks: 0 };
  const held = present(recovery, 120, 'match');
  assert.strictEqual(present(recovery, 180, 'match', { paused: true }), held);
  assert.strictEqual(present(recovery, 5000, 'match', { paused: true }), held);
  assert.strictEqual(present(recovery, 5100, 'match'), held);
  const resumed = present(recovery, 5120, 'match');
  assert.equal(resumed.phase, 'contact'); assert.ok(resumed.progress > held.progress);
});

test('an online menu does not replay a monster strike that completed while local controls were released', () => {
  const present = createMonsterAttackPresenter(), player = actor();
  present(player, 0, 'online-match');
  const winding = { ...player, attackTicks: 24 }, recovery = { ...player, monsterState: 'recover', attackTicks: 0 };
  const held = present(winding, 100, 'online-match');
  assert.strictEqual(present(winding, 120, 'online-match', { paused: true }), held);
  assert.strictEqual(present(recovery, 500, 'online-match', { paused: true }), held, 'the menu keeps its frozen visual');
  const resumed = present(recovery, 700, 'online-match');
  assert.equal(resumed.phase, 'idle', 'resume resynchronizes rather than releasing the stale tell');
  for (const time of [710, 800, 1000]) assert.equal(present(recovery, time, 'online-match').phase, 'idle');
  const nextTell = present({ ...player, attackTicks: 36 }, 1100, 'online-match');
  assert.equal(nextTell.phase, 'startup'); assert.equal(nextTell.progress, .25);
});

test('resuming an online menu adopts current accepted windup progress without aging the old tell', () => {
  const present = createMonsterAttackPresenter(), player = actor();
  const held = present(player, 0, 'online-match');
  assert.strictEqual(present(player, 10, 'online-match', { paused: true }), held);
  const current = { ...player, attackTicks: 6 };
  const resumed = present(current, 500, 'online-match');
  assert.equal(resumed.phase, 'startup'); assert.equal(resumed.progress, .875);
  assert.equal(present(current, 520, 'online-match').phase, 'startup');
  assert.equal(present({ ...current, monsterState: 'recover', attackTicks: 0 }, 530, 'online-match').phase, 'contact', 'only the new accepted release gets a contact pose');
});

test('life, context, type and clock resets discard a former creature attack without replaying a late recovery', () => {
  const player = actor(), recovery = { ...player, monsterState: 'recover', attackTicks: 0 };
  for (const [patch, time, context] of [
    [{ lifeId: 2 }, 120, 'match'], [{}, 120, 'another-map'], [{ monsterType: 'runner' }, 120, 'match'], [{}, 50, 'match'], [{}, 2000, 'match'],
  ]) {
    const present = createMonsterAttackPresenter();
    present(player, 0, 'match'); present({ ...player, attackTicks: 0 }, 100, 'match');
    assert.equal(present({ ...recovery, ...patch }, time, context).phase, 'idle');
  }
  const fresh = createMonsterAttackPresenter();
  assert.equal(fresh(recovery, 100, 'late-join').phase, 'idle', 'joining a recovery never fabricates the earlier attack');
});

test('monster attack history stays bounded, independent and removable without animating armed, human or dead actors', () => {
  const present = createMonsterAttackPresenter({ maxMonsters: 2 });
  const player = actor();
  present(player, 0, 'match');
  const independent = present({ ...player, id: 8, attackTicks: 1 }, 0, 'match');
  assert.ok(independent.windup > .9);
  assert.equal(present(player, 10, 'match').progress, 0);
  for (let id = 0; id < 100; id++) present({ ...player, id }, 20, 'match');
  assert.equal(present.size, 2);
  present.retain([99]); assert.equal(present.size, 1);
  for (const patch of [{ alive: false }, { monsterType: 'gunner' }, { monsterType: 'sniper' }, { monster: false }, { human: true }, { monsterType: 'unknown' }]) {
    assert.equal(present({ ...player, id: 99, ...patch }, 30, 'match').active, false);
  }
  assert.equal(present.size, 0);
  present(player, 40, 'match'); present.reset(); assert.equal(present.size, 0);
});

test('bad animation values remain finite and cannot change an authoritative attack timer', () => {
  const player = actor(), before = structuredClone(player);
  for (const attack of [null, {}, { phase: 'hit', progress: .5 }, { phase: 'startup', progress: Infinity }, { phase: 'contact', progress: -100 }, { phase: 'recovery', progress: 100 }]) {
    const pose = monsterAttackPose(player, { attack });
    for (const key of ['progress', 'weight', 'windup', 'extension', 'brace']) assert.ok(Number.isFinite(pose[key]) && pose[key] >= 0 && pose[key] <= 1);
  }
  assert.equal(monsterAttackPose({ ...player, attackDuration: 0 }).active, false);
  assert.equal(monsterAttackPose({ ...player, attackTicks: NaN }).active, false);
  assert.equal(monsterAttackPose({ ...player, attackTicks: 0 }, { attack: { phase: 'idle', progress: 0 } }).active, false, 'an expired presenter tail cannot reactivate a cached zero-tick tell');
  assert.deepEqual(player, before);
});

test('all stationary and moving attack vertices remain inside the actual monster flesh and leave authority untouched', () => {
  for (const type of TYPES) for (const stage of ['startup', 'contact', 'recovery']) for (const progress of [0, .25, .5, .75, 1]) for (const stride of [0, 1]) for (const yaw of [0, .73, Math.PI / 2]) {
    const player = actor(type, { yaw, monsterState: stage === 'startup' ? 'windup' : 'recover', attackTicks: 48 * (1 - progress) });
    const before = structuredClone(player), mesh = monsterMeshes(player, 1000, { phase: 1.3, stride, speed: 7, attack: { phase: stage, progress, kind: 'windup' } });
    const c = Math.cos(yaw), s = Math.sin(yaw), boxes = monsterBodyBoxes(player), body = monsterBodyProfile(player);
    assert.ok(mesh.every(Number.isFinite) && mesh.length / 10 <= 1300, `${type}: bounded finite attack geometry`);
    for (let at = 0; at < mesh.length; at += 10) {
      const dx = mesh[at] - player.x, dz = mesh[at + 2] - player.z;
      const x = c * dx + s * dz, y = mesh[at + 1] - player.y, z = -s * dx + c * dz;
      assert.ok(y >= -2e-6 && y <= (body?.height || WORLD.standHeight) + 2e-6, `${type}/${stage}: physical height`);
      if (boxes) assert.ok(boxes.some(box => x >= box.x - 2e-6 && x <= box.x + box.w + 2e-6 && y >= box.y - 2e-6 && y <= box.y + box.h + 2e-6 && z >= box.z - 2e-6 && z <= box.z + box.d + 2e-6), `${type}/${stage}: ${[x, y, z]} belongs to real flesh`);
      else assert.ok(Math.hypot(x, z) <= (y > 1.48 + 2e-6 ? .22 : .29) + 2e-6, `${type}/${stage}: real shooting envelope at every yaw`);
    }
    assert.deepEqual(player, before);
  }
});
