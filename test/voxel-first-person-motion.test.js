import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer } from '../public/voxel-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { createFirstPersonMotionPresenter, createWeaponShotPresenter, weaponShotPose, weaponCyclePose } from '../public/voxel-first-person-motion.js';
import { VoxelRenderer } from '../public/voxel-renderer.js';

const actor = patch => ({ ...createCombatPlayer(0), ...patch });
const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);
const walk = (present, hz = 120, aim = 0, crouching = false) => {
  present(actor({ crouching }), 0, 'match');
  let pose;
  for (let frame = 1; frame <= hz; frame++) pose = present(Object.freeze(actor({ crouching, z: -5 * frame / hz, vz: -5 })), frame * 1000 / hz, 'match', { aim });
  return pose;
};

test('head and hand cadence follows actual travelled distance at 60/120/144/240 Hz', () => {
  let reference;
  for (const hz of [60, 120, 144, 240]) {
    const pose = walk(createFirstPersonMotionPresenter(), hz);
    assert.ok(pose.bobY < -.001 && pose.roll !== 0 && pose.weaponY < 0);
    assert.ok(pose.bobY >= -.018 && Math.abs(pose.roll) <= .0034);
    if (reference) for (const field of ['phase', 'stride', 'speed', 'bobY', 'roll', 'weaponX', 'weaponY']) close(pose[field], reference[field]);
    else reference = pose;
  }
});

test('held movement velocity cannot keep head bob moving when physically blocked', () => {
  const present = createFirstPersonMotionPresenter();
  const walking = walk(present), frozen = actor({ z: -5, vz: -5 });
  let pose;
  for (let frame = 1; frame <= 96; frame++) pose = present(frozen, 1000 + frame * 1000 / 120, 'match');
  assert.equal(pose.phase, walking.phase);
  assert.ok(Math.abs(pose.bobY) < .000001 && Math.abs(pose.roll) < .000001 && Math.abs(pose.weaponY) < .000001);
});

test('sub-millimetre reconciliation noise does not produce head or weapon footsteps', () => {
  const present = createFirstPersonMotionPresenter();
  present(actor(), 0, 'match');
  for (let frame = 1; frame <= 240; frame++) {
    const pose = present(actor({ x: frame % 2 ? .0008 : 0, vx: 5 }), frame * 1000 / 240, 'match');
    assert.equal(pose.bobY, 0); assert.equal(pose.roll, 0); assert.equal(pose.phase, 0);
  }
});

test('crouch reduces head motion and settled ADS preserves an exactly still aim origin', () => {
  const normal = walk(createFirstPersonMotionPresenter()), aimed = walk(createFirstPersonMotionPresenter(), 120, 1);
  assert.ok(Math.abs(normal.bobY) > 0);
  assert.equal(aimed.bobY, 0); assert.equal(aimed.roll, 0);
  const crouching = walk(createFirstPersonMotionPresenter(), 120, 0, true);
  assert.ok(crouching.bobY >= -.0081 && Math.abs(crouching.roll) <= .00153);
  const partial = walk(createFirstPersonMotionPresenter(), 120, .8);
  close(partial.bobY, normal.bobY * .2); close(partial.roll, normal.roll * .2);
});

test('sprint gives the held weapon a clear low carry while eye motion and the central aim stay small', () => {
  for (const hz of [60, 144, 240]) {
    const present = createFirstPersonMotionPresenter(); present(actor({ sprinting: true }), 0, 'sprint');
    let pose;
    for (let frame = 1; frame <= hz; frame++) {
      const player = actor({ sprinting: true, z: -7.7 * frame / hz, yaw: .1, pitch: -.2 }), before = structuredClone(player);
      pose = present(player, frame * 1000 / hz, 'sprint');
      assert.ok(pose.bobY >= -.018 && pose.bobY <= 0 && Math.abs(pose.roll) <= .0034);
      assert.ok(Math.abs(pose.weaponX) <= .015 && Math.abs(pose.weaponY) <= .066 && pose.weaponZ <= .035);
      assert.deepEqual(player, before, 'sprint carry cannot alter the real view angles or physical stance');
    }
    assert.ok(pose.sprint > .999 && pose.weaponPitch < -.17 && pose.weaponY < -.04);
    for (let frame = 1; frame <= hz; frame++) pose = present(actor({ z: -7.7, sprinting: true, vz: -7.7 }), 1000 + frame * 1000 / hz, 'sprint');
    assert.ok(pose.sprint < .00001 && Math.abs(pose.weaponPitch) < .00001, 'stale flags and velocity cannot keep a pinned body sprinting');
  }
});

test('airborne footsteps fade and landing provides a bounded soft compression', () => {
  const present = createFirstPersonMotionPresenter(); walk(present);
  let pose;
  for (let frame = 1; frame <= 24; frame++) pose = present(actor({ z: -5 - frame / 60, y: .3, grounded: false, vy: -6 }), 1000 + frame * 1000 / 120, 'match');
  assert.equal(pose.airborne, true); assert.ok(Math.abs(pose.bobY) < .00003);
  pose = present(actor({ z: -5.4 }), 1210, 'match');
  assert.equal(pose.airborne, false); assert.ok(pose.land > 0 && pose.bobY < -.002 && pose.bobY >= -.018);
  for (let frame = 1; frame <= 100; frame++) pose = present(actor({ z: -5.4 }), 1210 + frame * 1000 / 120, 'match');
  assert.ok(Math.abs(pose.bobY) < .000002);
});

test('pause freezes the displayed stride and lifecycle transitions discard old motion', () => {
  const scenarios = [
    ['context', actor({ z: -5 }), 1010, 'next'],
    ['identity', actor({ id: 1, z: -5 }), 1010, 'match'],
    ['life', actor({ lifeId: 2, z: -5 }), 1010, 'match'],
    ['deaths', actor({ deaths: 1, z: -5 }), 1010, 'match'],
    ['teleport', actor({ z: -8 }), 1010, 'match'],
    ['suspension', actor({ z: -5 }), 2101, 'match'],
    ['reverse', actor({ z: -5 }), 990, 'match'],
    ['dead', actor({ z: -5, alive: false }), 1010, 'match'],
  ];
  for (const [label, player, time, context] of scenarios) {
    const present = createFirstPersonMotionPresenter(); walk(present);
    const pose = present(player, time, context);
    assert.equal(pose.bobY, 0, label); assert.equal(pose.roll, 0, label);
  }
  const present = createFirstPersonMotionPresenter(), moving = walk(present);
  const paused = present(actor({ z: -5 }), 1010, 'match', { paused: true });
  assert.deepEqual(paused, moving);
  assert.deepEqual(present(actor({ z: -5 }), 1500, 'match', { paused: true }), paused);
  const resumed = present(actor({ z: -5 }), 1510, 'match');
  assert.equal(resumed.bobY, 0); assert.equal(resumed.roll, 0);
});

test('all catalog guns have a distinct fast strike followed by an analytic smooth recovery', () => {
  const signatures = new Set();
  for (const weapon of Object.keys(WEAPONS)) {
    const start = weaponShotPose(weapon, 0), peak = [];
    for (let time = 0; time < 400; time++) peak.push([time, weaponShotPose(weapon, time)]);
    const [peakTime, maximum] = peak.reduce((best, entry) => entry[1].kick > best[1].kick ? entry : best);
    assert.ok(start.kick > .05 && peakTime >= 10 && peakTime <= 45, weapon);
    assert.ok(maximum.kick > .99 && maximum.kick <= 1.001);
    assert.ok(maximum.z > .03 && maximum.z < .16 && maximum.pitch > .03);
    assert.ok(weaponShotPose(weapon, peakTime + 150).kick < maximum.kick * .2);
    assert.deepEqual(weaponShotPose(weapon, 400), { kick: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
    signatures.add(JSON.stringify(maximum));
    for (const [, pose] of peak) assert.ok(Object.values(pose).every(Number.isFinite));
  }
  assert.equal(signatures.size, Object.keys(WEAPONS).length);
});

test('shot poses at the same elapsed time are identical across display schedules and ADS damps them', () => {
  for (const weapon of Object.keys(WEAPONS)) {
    const reference = weaponShotPose(weapon, 100);
    for (const hz of [60, 120, 144, 240]) {
      for (let frame = 0; frame < hz / 10; frame++) weaponShotPose(weapon, frame * 1000 / hz);
      assert.deepEqual(weaponShotPose(weapon, 100), reference);
    }
    const aimed = weaponShotPose(weapon, 100, 1);
    assert.ok(aimed.pitch < reference.pitch * .3 && aimed.z < reference.z);
  }
});

test('one accepted shell creates one impulse despite repeated snapshots and later pellet batches', () => {
  const present = createWeaponShotPresenter(), shell = Array.from({ length: 8 }, (_, pellet) => ({ id: pellet + 1, type: 'shot', tick: 120, playerId: 0, weapon: 'shotgun', pellet, pelletCount: 8 }));
  assert.equal(present.report(shell[0], 1000), true);
  const pose = present.sample('shotgun', 1020);
  for (const event of shell) assert.equal(present.report(event, 1020), false);
  assert.deepEqual(present.sample('shotgun', 1020), pose);
  assert.equal(present.getStats().acceptedShots, 1);
  assert.equal(present.report({ id: 30, type: 'boltLaunch', weapon: 'crossbow' }, 1030), true);
  assert.equal(present.getStats().acceptedShots, 2);
  assert.equal(present.sample('carbine', 1040).kick, 0);
});

test('accepted-shot ages retain real per-hand slides and the delayed pump/bolt cycle without trigger guesses', () => {
  const present = createWeaponShotPresenter();
  assert.equal(present.age('shotgun', 1000), Infinity);
  assert.equal(present.report({ id: 1, type: 'dryFire', weapon: 'shotgun' }, 1000), false);
  assert.deepEqual(weaponCyclePose('shotgun', present.age('shotgun', 1200)), { pump: 0, bolt: 0 });
  present.report({ id: 2, type: 'shot', weapon: 'shotgun', pellet: 0 }, 1000);
  assert.equal(present.sample('shotgun', 1490).kick, 0, 'the recoil settles before the pump has returned');
  assert.ok(weaponCyclePose('shotgun', present.age('shotgun', 1490)).pump > 0);
  assert.equal(present.sample('shotgun', 1525).kick, 0); assert.equal(present.age('shotgun', 1525), Infinity);
  present.report({ id: 3, type: 'shot', weapon: 'dualpistols', hand: 0, pellet: 0 }, 2000);
  present.report({ id: 4, type: 'shot', weapon: 'dualpistols', hand: 1, pellet: 0 }, 2010);
  assert.equal(present.age('dualpistols', 2020, 0), 20); assert.equal(present.age('dualpistols', 2020, 1), 10);
  assert.ok(weaponCyclePose('dualpistols', present.age('dualpistols', 2020, 0)).bolt > .9);
  assert.ok(weaponCyclePose('sniper', 265).bolt > .99 && weaponCyclePose('sniper', 0).bolt === 0);
  for (const hz of [60, 144, 240]) {
    for (let frame = 0; frame < hz / 2; frame++) weaponCyclePose('slugshotgun', frame * 1000 / hz);
    assert.deepEqual(weaponCyclePose('slugshotgun', 245), { pump: 1, bolt: 0 });
  }
});

test('long automatic reports remain bounded and invalid/profile prototype input stays finite', () => {
  const present = createWeaponShotPresenter();
  for (let id = 0; id < 500; id++) present.report({ id, type: 'shot', weapon: 'smg', pellet: 0 }, id);
  assert.ok(present.getStats().activeShots <= 16);
  assert.ok(present.sample('smg', 500).kick <= 1.7 + 1e-9);
  assert.equal(present.sample('smg', 1000).kick, 0);
  assert.equal(present.getStats().activeShots, 0);
  const stacked = createWeaponShotPresenter();
  for (let id = 0; id < 16; id++) stacked.report({ id, type: 'shot', weapon: 'smg', pellet: 0 }, 1000);
  const saturated = stacked.sample('smg', 1020);
  assert.ok(saturated.kick <= 1.7 && saturated.z <= .050 * 1.7 && saturated.pitch <= .076 * 1.7);
  for (const weapon of ['constructor', 'toString', '__proto__', 'unknown', null]) {
    assert.equal(present.report({ id: 900, type: 'shot', weapon }, 1010), false);
    assert.ok(Object.values(weaponShotPose(weapon, 10)).every(Number.isFinite));
  }
  for (const age of [NaN, Infinity, -1]) assert.equal(weaponShotPose('carbine', age).kick, 0);
  present.reset(); assert.deepEqual(present.getStats(), { acceptedShots: 0, activeShots: 0 });
});

const map = { id: 'first-person', colliders: [], sites: [], bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 } };
const harness = () => {
  const gl = new Proxy({}, { get(_, key) {
    if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
    if (key === 'getAttribLocation') return () => 0;
    if (key === 'getUniformLocation') return (_program, uniform) => uniform;
    if (typeof key === 'string' && key.startsWith('create')) return () => ({});
    return () => {};
  } });
  return new VoxelRenderer({ getContext: () => gl, getBoundingClientRect: () => ({ width: 960, height: 540 }), addEventListener() {}, removeEventListener() {}, dispatchEvent() {} });
};

test('renderer clears old impulses on weapon/slot/life/death changes without replaying old events', () => {
  for (const change of [{ weapon: 'pistol' }, { slot: 'sword' }, { lifeId: 2 }, { deaths: 1 }, { alive: false }]) {
    const renderer = harness(), player = actor();
    const state = { gameId: 'voxel-breach', map, phase: 'fight', round: 1, tick: 120, players: [player], events: [{ id: 1, type: 'shot', tick: 120, playerId: 0, weapon: 'carbine', pellet: 0, hitKind: 'none' }] };
    renderer.render(state, { localId: 0, time: 1000 });
    assert.equal(renderer.stats.firstPerson.acceptedShots, 1);
    Object.assign(player, change);
    renderer.render(state, { localId: 0, time: 1010 });
    assert.equal(renderer.localShot, null);
    assert.equal(renderer.stats.firstPerson.shot.kick, 0);
    assert.equal(renderer.stats.firstPerson.acceptedShots, 0);
    renderer.destroy();
  }
});
