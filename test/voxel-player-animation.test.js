import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlayerAnimationPresenter, playerAnimationPose } from '../public/voxel-player-animation.js';
import { createCombatPlayer, emptyInput, predictLocalMovement } from '../public/voxel-engine.js';
import { createMovementPresenter } from '../public/voxel-presentation.js';

const STEP = 1 / 120;
const openMap = { id: 'human-animation', bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [] };
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} versus ${b}`);

function simulate(hz, seconds = 2, buttons = { ...emptyInput(), up: true }, map = openMap) {
  const player = createCombatPlayer(1), source = createMovementPresenter(), animation = createPlayerAnimationPresenter();
  const poses = [animation(player, 0, map.id)];
  let remainder = 0;
  for (let frame = 1; frame <= seconds * hz; frame++) {
    remainder += 1 / hz;
    while (remainder + 1e-12 >= STEP) { remainder = Math.max(0, remainder - STEP); predictLocalMovement(player, buttons, map); }
    const presented = source(player, buttons, map, remainder, predictLocalMovement);
    const before = structuredClone(presented);
    poses.push(animation(structuredClone(presented), frame * 1000 / hz, map.id));
    assert.deepEqual(presented, before, 'animating a received pose does not mutate movement or combat');
  }
  return { poses, player, animation };
}

test('actual 120 Hz physics yields distance-identical walking at 60, 120, 144 and 240 Hz', () => {
  let baseline;
  for (const hz of [60, 120, 144, 240]) {
    const result = simulate(hz), last = result.poses.at(-1);
    assert.ok(last.stride > .8);
    assert.ok(last.forward > .999 && Math.abs(last.strafe) < 1e-8);
    const expectedPhase = Math.hypot(result.player.x, result.player.z) * Math.PI * 2 / 2.45 % (Math.PI * 2);
    near(last.phase, expectedPhase);
    for (let i = 1; i < result.poses.length; i++) assert.notEqual(result.poses[i].phase, result.poses[i - 1].phase, 'each high-refresh presented position advances the limbs');
    if (baseline) {
      assert.deepEqual(result.player, baseline.player);
      near(last.phase, baseline.pose.phase);
      near(last.speed, baseline.pose.speed, .025);
      near(last.stride, baseline.pose.stride, .006);
    } else baseline = { player: result.player, pose: last };
  }
});

test('walk, run and crouched motion use real speed and shorter crouched steps', () => {
  const running = simulate(120), walking = simulate(120, 2, { ...emptyInput(), up: true, walk: true }), crouching = simulate(120, 2, { ...emptyInput(), up: true, crouch: true });
  assert.ok(running.poses.at(-1).speed > walking.poses.at(-1).speed * 1.6);
  assert.ok(walking.poses.at(-1).stride > crouching.poses.at(-1).stride);
  near(crouching.poses.at(-1).crouch, 1);
  near(crouching.poses.at(-1).phase, Math.hypot(crouching.player.x, crouching.player.z) * Math.PI * 2 / 1.90 % (Math.PI * 2));
});

test('a genuine wall collision settles the legs and held input or stale velocity cannot make them march', () => {
  const wall = { ...openMap, colliders: [{ x: -3, y: 0, z: -1.5, w: 6, h: 4, d: .2 }] };
  const { poses, player, animation } = simulate(240, 2, { ...emptyInput(), up: true }, wall);
  assert.ok(player.z >= -1.5 + .2 + player.radius - 1e-4, 'the displayed body actually reaches solid cover');
  const stopped = poses.at(-1);
  assert.ok(stopped.stride < 1e-8 && stopped.speed < 1e-8);
  const againstWall = { ...player, vx: 5.5, vz: -5.5, previousInput: { ...emptyInput(), up: true } };
  const later = animation(againstWall, 2010, wall.id);
  near(later.phase, stopped.phase);
  assert.ok(later.stride < 1e-8);
});

test('ordinary stopping, backpedaling, yaw turns and strafing keep one continuous distance phase', () => {
  const present = createPlayerAnimationPresenter(), player = createCombatPlayer(2);
  present(player, 0, 'match');
  let pose;
  for (let frame = 1; frame <= 12; frame++) { player.z -= .04; pose = present({ ...player }, frame * 10, 'match'); }
  const phase = pose.phase;
  for (let frame = 13; frame <= 100; frame++) pose = present({ ...player, vz: -4 }, frame * 10, 'match');
  near(pose.phase, phase); assert.ok(pose.stride < 1e-5);
  for (let frame = 101; frame <= 112; frame++) { player.z += .03; pose = present({ ...player }, frame * 10, 'match'); }
  assert.ok(pose.forward < -.8 && Math.abs(pose.strafe) < 1e-8);
  const backward = pose.phase;
  player.yaw = Math.PI / 2;
  for (let frame = 113; frame <= 124; frame++) { player.z += .03; pose = present({ ...player }, frame * 10, 'match'); }
  assert.ok(pose.strafe > .85 && Math.abs(pose.forward) < .13);
  near(pose.phase, (backward + .36 * Math.PI * 2 / 2.45) % (Math.PI * 2));
});

test('real jump and descent freeze ground stride; landing compresses briefly then settles', () => {
  const present = createPlayerAnimationPresenter(), player = createCombatPlayer(0);
  present(player, 0, 'jump');
  let tick = 0, pose;
  for (; tick < 24; tick++) { predictLocalMovement(player, { ...emptyInput(), up: true }, openMap); pose = present({ ...player }, (tick + 1) * 1000 / 120, 'jump'); }
  const groundPhase = pose.phase;
  let rising = false, falling = false, landed = null;
  for (; tick < 180; tick++) {
    predictLocalMovement(player, { ...emptyInput(), up: true, jump: tick === 24 }, openMap);
    pose = present({ ...player }, (tick + 1) * 1000 / 120, 'jump');
    if (pose.airborne) {
      near(pose.phase, groundPhase);
      if (player.vy > 1) rising ||= pose.jump > .1;
      if (player.vy < -1) falling ||= pose.fall > .1;
    } else if (rising && falling) { landed = pose; break; }
  }
  assert.ok(rising && falling && landed, 'actual ballistic movement traverses both air poses');
  near(landed.phase, groundPhase);
  assert.ok(landed.land > .6 && landed.bodyBob < 0 && landed.bodyBob >= -.028);
  for (let i = 0; i < 120; i++) { tick++; pose = present({ ...player }, (tick + 1) * 1000 / 120, 'jump'); }
  assert.ok(pose.land < 1e-4 && pose.stride < 1e-6);
});

test('repeat timestamps and paused frames are frozen; resume anchors without accumulated strides', () => {
  const present = createPlayerAnimationPresenter(), player = createCombatPlayer(3);
  present(player, 0, 'pause');
  player.x = .05;
  const moving = present(player, 10, 'pause');
  assert.equal(present({ ...player, x: .09 }, 10, 'pause'), moving);
  for (let i = 1; i <= 10; i++) assert.equal(present({ ...player, x: .05 + i * .02 }, 10 + i * 20, 'pause', { paused: true }), moving);
  player.x = .25;
  const resumed = present(player, 220, 'pause');
  near(resumed.phase, 0); near(resumed.stride, 0);
  player.x += .04;
  assert.ok(present(player, 230, 'pause').phase > 0);
});

test('map, match, life, death, teleport, long suspension and time reversal reset old motion', () => {
  for (const change of [
    { context: 'another-map' }, { context: 'next-match' }, { player: { lifeId: 2 } }, { player: { deaths: 1 } },
    { player: { x: 5 } }, { time: 1200 }, { time: -1 },
  ]) {
    const present = createPlayerAnimationPresenter(), player = { ...createCombatPlayer(1), lifeId: 1 };
    present(player, 0, 'old-match');
    player.x = .05;
    assert.ok(present(player, 10, 'old-match').stride > 0);
    const reset = present({ ...player, ...change.player }, change.time ?? 20, change.context ?? 'old-match');
    near(reset.phase, 0); near(reset.stride, 0); near(reset.speed, 0);
  }
  const present = createPlayerAnimationPresenter(), player = createCombatPlayer(1);
  present(player, 0); present({ ...player, x: .05 }, 10);
  present({ ...player, alive: false }, 20);
  assert.equal(present.size, 0);
  near(present(player, 30).phase, 0);
});

test('seat histories are independent, bounded, released on dropout and reject invalid identities', () => {
  const present = createPlayerAnimationPresenter({ maxPlayers: 3 });
  for (let id = 0; id < 12; id++) { const player = createCombatPlayer(id); present(player, 0); present({ ...player, x: .03 }, 10); assert.ok(present.size <= 3); }
  assert.equal(present.size, 3);
  present.retain([10, 11]); assert.equal(present.size, 2);
  near(present({ ...createCombatPlayer(10), x: .03 }, 20).phase, .03 * Math.PI * 2 / 2.45);
  near(present(createCombatPlayer(9), 20).phase, 0);
  for (const id of ['10', -1, NaN, Infinity, {}, Number.MAX_SAFE_INTEGER + 1]) present({ ...createCombatPlayer(0), id }, 30);
  assert.equal(present.size, 3);
  present({ ...createCombatPlayer(11), monster: true }, 30); assert.equal(present.size, 2);
  present.reset(); assert.equal(present.size, 0);
});

test('all pose outputs are finite, small and pure for malformed or extreme presentation inputs', () => {
  const present = createPlayerAnimationPresenter();
  for (const player of [null, {}, { ...createCombatPlayer(0), vx: NaN, vy: Infinity, vz: -Infinity }, { ...createCombatPlayer(1), vx: Number.MAX_VALUE, vz: Number.MAX_VALUE, yaw: Math.PI / 4, crouching: true }, { ...createCombatPlayer(2), grounded: false, vy: -1000 }]) {
    const before = structuredClone(player);
    for (const pose of [playerAnimationPose(player, Number.MAX_VALUE), present(player, 100000)]) {
      for (const value of Object.values(pose)) if (typeof value === 'number') assert.ok(Number.isFinite(value));
      assert.ok(pose.stride >= 0 && pose.stride <= 1 && pose.crouch >= 0 && pose.crouch <= 1);
      assert.ok(pose.bodyBob <= 0 && pose.bodyBob >= -.028);
      assert.ok(Math.abs(pose.leanForward) <= .08 && Math.abs(pose.leanSide) <= .08);
      for (const leg of pose.legs) for (const value of Object.values(leg)) assert.ok(Number.isFinite(value));
    }
    assert.deepEqual(player, before);
  }
});

test('crouch enters its real short silhouette immediately and standing releases smoothly', () => {
  const present = createPlayerAnimationPresenter(), player = createCombatPlayer(0);
  present(player, 0);
  near(present({ ...player, crouching: true }, 10).crouch, 1);
  const standing = present(player, 20);
  assert.ok(standing.crouch > .8 && standing.crouch < 1);
  const settled = present(player, 200);
  assert.ok(settled.crouch < .05);
});

test('bounded correction noise is idle while slow continuous travel eventually makes a step', () => {
  const present = createPlayerAnimationPresenter(), player = createCombatPlayer(0);
  present(player, 0);
  for (let frame = 1; frame <= 240; frame++) {
    const pose = present({ ...player, x: frame % 2 ? .0008 : -.0008, vx: 5 }, frame * 1000 / 240);
    near(pose.phase, 0); near(pose.stride, 0);
  }
  let pose;
  for (let frame = 1; frame <= 240; frame++) pose = present({ ...player, x: frame * .00025 }, 1000 + frame * 1000 / 240);
  assert.ok(pose.phase > .1, 'slow travel leaves the dead zone and accumulates real stride distance');
  near(pose.phase, .06 * Math.PI * 2 / 2.45, .005);
});

test('ordinary 350–500 ms render hitches preserve actual distance gait; long suspension resets it', () => {
  const present = createPlayerAnimationPresenter(), player = createCombatPlayer(1), buttons = { ...emptyInput(), up: true };
  present(player, 0, 'hitch');
  let time = 0;
  for (const ticks of [42, 60, 42]) {
    for (let tick = 0; tick < ticks; tick++) predictLocalMovement(player, buttons, openMap);
    time += ticks * 1000 / 120;
    const pose = present(structuredClone(player), time, 'hitch');
    assert.ok(pose.stride > .75, 'a still-moving body keeps walking through a brief render hitch');
    near(pose.phase, Math.hypot(player.x, player.z) * Math.PI * 2 / 2.45 % (Math.PI * 2));
  }
  for (let tick = 0; tick < 132; tick++) predictLocalMovement(player, buttons, openMap);
  const suspended = present(structuredClone(player), time + 1100, 'hitch');
  near(suspended.phase, 0); near(suspended.stride, 0); near(suspended.speed, 0);
});
