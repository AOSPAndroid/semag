import assert from 'node:assert/strict';
import test from 'node:test';
import { aimDirection, combatStep, createCombatPlayer, createState, emptyInput, predictLocalMovement, traceShot, WORLD, WEAPONS } from '../public/voxel-engine.js';
import { createMovementPresenter } from '../public/voxel-presentation.js';
import { VoxelRenderer } from '../public/voxel-renderer.js';
import { createFirstPersonMotionPresenter, createWeaponShotPresenter, weaponShotPose } from '../public/voxel-first-person-motion.js';

const STEP = 1 / 120;
const openMap = { id: 'fps-feel-independent', theme: 'custom', bounds: { minX: -40, maxX: 40, minZ: -40, maxZ: 40 }, colliders: [], sites: [] };
const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} versus ${expected}`);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

// Observe the matrices and eye actually uploaded to the world shader. These
// checks do not substitute a camera implementation or infer it from debug stats.
function harness() {
  const calls = { views: [], eyes: [], modelEyes: [], skyRight: [], skyUp: [], skyForward: [] };
  const gl = new Proxy({}, { get(_target, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (name === 'uniformMatrix4fv') return (uniform, _transpose, value) => { if (uniform === 'uView') calls.views.push(Array.from(value)); };
    if (name === 'uniform3fv') return (uniform, value) => {
      if (uniform === 'uEye' && value[1] > 0) calls.eyes.push(Array.from(value));
      const sky = { uRight: 'skyRight', uUp: 'skyUp', uForward: 'skyForward' }[uniform];
      if (sky) calls[sky].push(Array.from(value));
    };
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  const renderer = new VoxelRenderer({ width: 960, height: 540, getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) });
  const model = renderer._viewModel;
  renderer._viewModel = function(...args) { calls.modelEyes.push([...args[6]]); return model.apply(this, args); };
  const render = (state, options) => {
    for (const values of Object.values(calls)) values.length = 0;
    assert.equal(renderer.render(state, options), true);
    return { view: calls.views[0], eye: calls.eyes[0], modelEye: calls.modelEyes[0], skyRight: calls.skyRight[0], skyUp: calls.skyUp[0], skyForward: calls.skyForward[0] };
  };
  return { renderer, render };
}

function rollOf(view, yaw, pitch) {
  const canonicalRight = [Math.cos(yaw), 0, Math.sin(yaw)];
  const canonicalUp = [-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), Math.cos(yaw) * Math.sin(pitch)];
  const right = [view[0], view[4], view[8]];
  return Math.atan2(dot(right, canonicalUp), dot(right, canonicalRight));
}

test('real fixed physics gives subtle GPU head motion at every refresh rate without changing forward aim or source state', () => {
  let reference;
  for (const hz of [60, 120, 144, 240]) {
    const { renderer, render } = harness(), player = createCombatPlayer(0), source = createMovementPresenter();
    const input = { ...emptyInput({ yaw: .41, pitch: .13 }), up: true };
    const checkpoints = [];
    let remainder = 0, maxDrop = 0, maxRoll = 0;
    try {
      for (let frame = 0; frame <= hz; frame++) {
        if (frame) remainder += 1 / hz;
        while (remainder + 1e-12 >= STEP) { remainder = Math.max(0, remainder - STEP); predictLocalMovement(player, input, openMap); }
        const presented = structuredClone(source(player, input, openMap, remainder, predictLocalMovement));
        const state = freeze({ gameId: 'voxel-breach', map: openMap, phase: 'fight', round: 1, tick: Math.floor(frame * 120 / hz), players: [presented], events: [] });
        const original = JSON.stringify(state), time = 3000 + frame * 1000 / hz;
        const { view, eye, skyRight, skyUp, skyForward } = render(state, { localId: 0, yaw: input.yaw, pitch: input.pitch, time, hideWeapon: true });
        const forward = aimDirection(input.yaw, input.pitch);
        for (const [axis, index] of [['x', 2], ['y', 6], ['z', 10]]) near(-view[index], forward[axis], 1e-7);
        for (let axis = 0; axis < 3; axis++) { near(skyRight[axis], view[axis * 4], 1e-7); near(skyUp[axis], view[axis * 4 + 1], 1e-7); near(skyForward[axis], -view[axis * 4 + 2], 1e-7); }
        near(eye[0], presented.x, 1e-12); near(eye[2], presented.z, 1e-12);
        const drop = presented.y + WORLD.eyeHeight - eye[1], roll = rollOf(view, input.yaw, input.pitch);
        assert.ok(drop >= -1e-8 && drop <= .01801, 'cosmetic bob stays below the genuine standing eye and under 18 mm');
        assert.ok(Math.abs(roll) <= .00351, 'head tilt remains under 0.201 degrees');
        for (let row = 0; row < 3; row++) near(view[row] * eye[0] + view[row + 4] * eye[1] + view[row + 8] * eye[2] + view[row + 12], 0, 1e-5);
        assert.equal(JSON.stringify(state), original, 'drawing cannot alter movement, server aim, health, ammo or event journals');
        maxDrop = Math.max(maxDrop, drop); maxRoll = Math.max(maxRoll, Math.abs(roll));
        if (frame && frame % (hz / 6) === 0) checkpoints.push({ drop, roll });
      }
      assert.ok(maxDrop > .001 && maxRoll > .0001, 'the world shader actually receives visible walking bob and roll');
      if (reference) {
        assert.deepEqual(player, reference.player, 'refresh rate never changes fixed movement physics');
        for (let index = 0; index < checkpoints.length; index++) { near(checkpoints[index].drop, reference.checkpoints[index].drop, .002); near(checkpoints[index].roll, reference.checkpoints[index].roll, .0006); }
      } else reference = { player: structuredClone(player), checkpoints };
    } finally { renderer.destroy(); }
  }
});

function firedState(weapon, patch = {}) {
  const state = createState();
  Object.assign(state, { map: openMap, mapId: openMap.id, phase: 'fight', tick: 0, events: [] });
  state.players = [{ ...createCombatPlayer(0, 1, weapon), z: 3, ...patch }, { ...createCombatPlayer(1), z: -3 }];
  for (let tick = 0; tick < 40; tick++) {
    state.tick++;
    combatStep(state, state.players.map(player => ({ ...emptyInput({ yaw: 0, pitch: -.075 }), fire: player.id === 0 })), openMap);
    if (state.events.some(event => event.type === 'shot' || event.type === 'boltLaunch')) break;
  }
  return state;
}

test('accepted shots across all weapons produce one shell kick and replayed snapshots cannot restart it', () => {
  for (const weapon of Object.keys(WEAPONS)) {
    const state = firedState(weapon), events = state.events.filter(event => ['shot', 'boltLaunch'].includes(event.type));
    assert.equal(events.length, WEAPONS[weapon].pellets || 1, `${weapon}: genuine authoritative report count`);
    assert.equal(state.players[0].ammo, WEAPONS[weapon].magazine - 1, 'one accepted shell spends one ammo');
    const { renderer, render } = harness();
    try {
      const source = JSON.stringify(state);
      render(freeze(state), { localId: 0, time: 1000, hideWeapon: true });
      assert.equal(renderer.localShot?.weapon, weapon);
      const kick = renderer.localShot, born = kick.born;
      render(state, { localId: 0, time: 1008, hideWeapon: true });
      assert.equal(renderer.localShot, kick, 'repeated snapshot preserves the existing impulse object');
      assert.equal(renderer.localShot.born, born, 'a repeat event cannot retrigger muzzle flash or recoil');
      render(state, { localId: 0, time: 1800, hideWeapon: true });
      assert.equal(JSON.stringify(state), source, 'presentation leaves the real shot, collision and damage untouched');
      renderer.resetEffects();
      assert.equal(renderer.localShot, null);
      renderer._events(state, 2000, 1);
      assert.equal(renderer.localShot, null, 'enemy reports cannot shake the local held weapon');
    } finally { renderer.destroy(); }
  }
});

test('blocked trigger conditions never invent a shot impulse, tracer, flash or server contact', () => {
  for (const patch of [{ ammo: 0, reserve: 0 }, { reloadTicks: 1000 }, { grenadeThrowTicks: 1000 }, { alive: false }, { slot: 'sword' }]) {
    const state = firedState('carbine', patch);
    assert.equal(state.events.filter(event => ['shot', 'boltLaunch'].includes(event.type)).length, 0);
    const { renderer, render } = harness();
    try {
      const source = JSON.stringify(state);
      render(freeze(state), { localId: 0, time: 1000, hideWeapon: true });
      assert.equal(renderer.localShot, null); assert.equal(renderer.tracers.length, 0);
      assert.equal(JSON.stringify(state), source);
    } finally { renderer.destroy(); }
  }
});

test('world head motion and first-person cover clipping use the exact same eye while genuine shot contacts remain unchanged', () => {
  const { renderer, render } = harness(), player = createCombatPlayer(0), source = createMovementPresenter();
  const buttons = { ...emptyInput(), up: true }, enemy = { ...createCombatPlayer(1), x: 0, z: -12 };
  let remainder = 0, seenBob = false;
  try {
    for (let frame = 0; frame <= 90; frame++) {
      if (frame) remainder += 1 / 120;
      while (remainder + 1e-12 >= STEP) { remainder = Math.max(0, remainder - STEP); predictLocalMovement(player, buttons, openMap); }
      const camera = structuredClone(source(player, buttons, openMap, remainder, predictLocalMovement));
      const state = freeze({ gameId: 'voxel-breach', map: openMap, phase: 'fight', round: 1, tick: frame, players: [camera, enemy], events: [] });
      const origin = { x: camera.x, y: camera.y + WORLD.eyeHeight, z: camera.z }, direction = aimDirection(0, 0);
      const before = traceShot(state, 0, origin, direction, 100, openMap);
      const { eye, modelEye } = render(state, { localId: 0, yaw: 0, pitch: 0, time: 3000 + frame * 1000 / 120 });
      assert.deepEqual(modelEye, eye, 'view-model wall clipping gets the exact rendered bobbed camera');
      assert.deepEqual(traceShot(state, 0, origin, direction, 100, openMap), before, 'the real aim ray and contact remain immutable');
      assert.equal(before.playerId, enemy.id, 'the genuine forward contact remains a target throughout the walk');
      const displayed = traceShot(state, 0, { x: eye[0], y: eye[1], z: eye[2] }, direction, 100, openMap);
      assert.equal(displayed.playerId, before.playerId);
      assert.equal(displayed.kind, before.kind, 'restrained bob preserves this centered head contact');
      seenBob ||= eye[1] < origin.y - .001;
    }
    assert.ok(seenBob);
  } finally { renderer.destroy(); }
});

test('a thin surface directly below the existing eye clips cosmetic head travel and its view-model rays together', () => {
  // Stress an explicit camera/cover boundary independently of the ordinary
  // body sweep: even a camera supplied just above a thin platform stays above it.
  const top = WORLD.eyeHeight - .009;
  const map = { ...openMap, id: 'fps-feel-thin-eye-cover', colliders: [{ id: 'thin-deck', x: -8, y: top - .001, z: -8, w: 16, h: .001, d: 16 }] };
  const { renderer, render } = harness(), reference = createFirstPersonMotionPresenter();
  let restrained = false;
  try {
    for (let frame = 0; frame <= 90; frame++) {
      const camera = { ...createCombatPlayer(0), x: frame * .03 }, time = 1000 + frame * 1000 / 120;
      const unclipped = reference(camera, time, map.id);
      const { eye, modelEye } = render(freeze({ gameId: 'voxel-breach', map, round: 1, phase: 'fight', tick: frame, players: [camera], events: [] }), { localId: 0, time });
      assert.ok(eye[1] >= top + .0049, 'downward bob never enters or crosses the thin lower surface');
      assert.deepEqual(modelEye, eye);
      if (unclipped.bobY < -.010) { restrained = true; assert.ok(eye[1] > WORLD.eyeHeight + unclipped.bobY, 'real cover visibly limits the otherwise requested motion'); }
    }
    assert.ok(restrained, 'the test reaches a stride phase that would cross this surface without clipping');
  } finally { renderer.destroy(); }
});

function observeMovement({ hz = 240, seconds = 2, map = openMap, buttons = { ...emptyInput(), up: true }, aim = 0 } = {}) {
  const player = createCombatPlayer(0), movement = createMovementPresenter(), head = createFirstPersonMotionPresenter();
  const frames = [];
  let remainder = 0;
  for (let frame = 0; frame <= hz * seconds; frame++) {
    if (frame) remainder += 1 / hz;
    while (remainder + 1e-12 >= STEP) { remainder = Math.max(0, remainder - STEP); predictLocalMovement(player, buttons, map); }
    const camera = freeze(structuredClone(movement(player, buttons, map, remainder, predictLocalMovement)));
    const time = frame * 1000 / hz, pose = head(camera, time, map.id, { aim });
    frames.push({ time, camera, pose });
  }
  return { player, head, frames };
}

test('real wall contacts and tiny network correction wiggle settle the head instead of bobbing against blocked input', () => {
  const wall = { ...openMap, id: 'fps-feel-wall', colliders: [{ x: -3, y: 0, z: -1.5, w: 6, h: 4, d: .2 }] };
  const { player, head, frames } = observeMovement({ map: wall });
  assert.ok(player.z >= -1.3 + player.radius - 1e-5);
  const final = frames.at(-1).pose;
  assert.ok(Math.abs(final.bobY) < 1e-7 && Math.abs(final.roll) < 1e-7 && final.stride < 1e-7);
  for (let frame = 1; frame <= 240; frame++) {
    const blocked = freeze({ ...player, vx: 6, vz: -6, x: player.x + Math.sin(frame) * .0004 });
    const pose = head(blocked, 2000 + frame * 1000 / 240, wall.id);
    near(pose.phase, final.phase, 1e-12);
    assert.ok(Math.abs(pose.bobY) < 1e-7 && Math.abs(pose.roll) < 1e-7);
  }
});

test('precision ADS removes camera translation and roll, while crouching and airborne travel reduce ground bob', () => {
  const run = observeMovement(), aimed = observeMovement({ aim: 1 }), crouched = observeMovement({ buttons: { ...emptyInput(), up: true, crouch: true } });
  const maximum = frames => Math.max(...frames.map(({ pose }) => Math.abs(pose.bobY)));
  assert.ok(maximum(run.frames) > .01);
  for (const { pose } of aimed.frames) { near(pose.bobY, 0, 0); near(pose.roll, 0, 0); }
  assert.ok(maximum(crouched.frames) < maximum(run.frames) * .5, 'low, slow crouched movement receives restrained head travel');
  const { head, player } = run;
  let pose;
  for (let frame = 1; frame <= 72; frame++) {
    const airborne = freeze({ ...player, grounded: false, y: 1 + frame * .001, x: player.x + frame * .025, vy: 1 });
    pose = head(airborne, 2000 + frame * 1000 / 240, openMap.id);
  }
  assert.equal(pose.airborne, true);
  assert.ok(Math.abs(pose.bobY) < .00002 && Math.abs(pose.roll) < .000005, 'walking motion fades out while freely moving through the air');
});

test('paused motion remains frozen and resume, map, life, teleport and suspension safely anchor the camera again', () => {
  for (const change of [
    { paused: true }, { context: 'new-map' }, { patch: { lifeId: 2 } }, { patch: { deaths: 2 } },
    { patch: { id: 1 } }, { patch: { x: 10 } }, { time: 4000 }, { time: 1000 }, { time: -1 },
  ]) {
    const { head, player, frames } = observeMovement({ hz: 120, seconds: .5 });
    const moving = frames.at(-1).pose, context = change.context ?? openMap.id, next = { ...player, ...change.patch };
    assert.ok(moving.stride > 0);
    if (change.paused) {
      for (let frame = 1; frame <= 20; frame++) assert.deepEqual(head({ ...next, x: next.x + frame * .02 }, 500 + frame * 20, context, { paused: true }), moving);
      const resumed = head({ ...next, x: next.x + .4 }, 920, context);
      near(resumed.bobY, 0, 0); near(resumed.roll, 0, 0); assert.equal(resumed.stride, 0);
    } else {
      const reset = head(next, change.time ?? 516, context);
      if (change.time === 1000) {
        assert.ok(reset.stride > 0, 'a real 500 ms display hitch decays the continuous gait rather than resetting its phase');
        near(reset.phase, moving.phase);
      } else {
        near(reset.bobY, 0, 0); near(reset.roll, 0, 0); assert.equal(reset.stride, 0);
      }
    }
  }
});

test('accepted recoil preserves one impulse per real shell, remains bounded under rapid reports and has frame-independent recovery', () => {
  const state = firedState('shotgun'), shell = state.events.filter(event => event.type === 'shot'), motion = createWeaponShotPresenter();
  for (const event of shell) motion.report(freeze(event), 1000);
  assert.equal(motion.getStats().acceptedShots, 1);
  const initial = motion.sample('shotgun', 1016);
  assert.ok(initial.kick > .5 && initial.z > .05 && initial.pitch > .03);
  for (const event of shell) assert.equal(motion.report(event, 1020), false);
  assert.deepEqual(motion.sample('shotgun', 1016), initial);
  for (let id = 100; id < 2100; id++) motion.report({ id, type: 'shot', playerId: 0, weapon: 'smg', pellet: 0 }, 1100 + id / 1000);
  assert.ok(motion.getStats().activeShots <= 16);
  const rapid = motion.sample('smg', 1110);
  assert.ok(Object.values(rapid).every(Number.isFinite));
  // The stronger SMG profile pushes .050 m and pitches .076 rad per peak.
  // Overlap retains the explicit 1.7 impulse cap rather than accumulating
  // the thousands of accepted reports into camera-sized weapon displacement.
  assert.ok(rapid.kick >= 0 && rapid.kick <= 1.7 + 1e-12);
  assert.ok(rapid.z >= 0 && rapid.z <= .050 * 1.7 + 1e-12);
  assert.ok(Math.abs(rapid.pitch) <= .076 * 1.7 + 1e-12);
  const aimedRapid = motion.sample('smg', 1110, 1);
  near(aimedRapid.z, rapid.z * .78, 1e-12);
  near(aimedRapid.pitch, rapid.pitch * .28, 1e-12);
  for (let repeat = 0; repeat < 10; repeat++) {
    assert.deepEqual(motion.sample('smg', 1110, 1), aimedRapid, 'repeated ADS sampling never compounds damping');
    assert.deepEqual(motion.sample('smg', 1110, 0), rapid, 'returning to hip aim restores the same accepted pose');
  }
  assert.deepEqual(motion.sample('smg', 1310), { kick: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  assert.equal(motion.getStats().activeShots, 0, 'a rapid volley releases its bounded history after actual recovery');
  for (const weapon of Object.keys(WEAPONS)) for (const aim of [0, 1]) {
    const first = createWeaponShotPresenter(); first.report({ id: 1, type: weapon === 'crossbow' ? 'boltLaunch' : 'shot', weapon, pellet: 0 }, 0);
    const expected = first.sample(weapon, 100, aim);
    for (const hz of [60, 120, 144, 240]) {
      const presenter = createWeaponShotPresenter(); presenter.report({ id: 1, type: weapon === 'crossbow' ? 'boltLaunch' : 'shot', weapon, pellet: 0 }, 0);
      for (let frame = 0; frame * 1000 / hz < 100; frame++) presenter.sample(weapon, frame * 1000 / hz, aim);
      assert.deepEqual(presenter.sample(weapon, 100, aim), expected, 'sampling a different number of display frames cannot alter recoil');
      assert.deepEqual(presenter.sample(weapon, 450, aim), { kick: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
    }
  }
});

test('malformed, projectile-contact and non-shell reports cannot create invalid or stale presentation impulses', () => {
  const motion = createWeaponShotPresenter();
  for (const weapon of ['unknown', 'constructor', 'toString', '__proto__', null]) {
    assert.equal(motion.report({ id: String(weapon), type: 'shot', weapon }, 10), false);
    assert.ok(Object.values(weaponShotPose(weapon, 10)).every(Number.isFinite), 'public pose fallback cannot inherit a prototype object as a weapon profile');
  }
  for (const type of ['damage', 'boltHit', 'meleeStart', 'healComplete', 'fire']) assert.equal(motion.report({ id: type, type, weapon: 'carbine' }, 10), false);
  assert.equal(motion.report({ id: 1, type: 'shot', weapon: 'carbine', pellet: 1 }, 10), false);
  assert.equal(motion.report({ id: 1, type: 'shot', weapon: 'carbine' }, NaN), false);
  assert.equal(motion.getStats().acceptedShots, 0);
  assert.equal(motion.report({ id: 2, type: 'boltLaunch' }, 20), true);
  assert.ok(motion.sample('crossbow', 25).kick > 0);
  assert.equal(motion.sample('crossbow', 10).kick, 0, 'a reversed render clock cannot replay a future shot');
  motion.reset();
  assert.deepEqual(motion.getStats(), { acceptedShots: 0, activeShots: 0 });
});
