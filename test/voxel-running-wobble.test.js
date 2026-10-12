import assert from 'node:assert/strict';
import test from 'node:test';
import { aimDirection, combatStep, createCombatPlayer, createState, emptyInput, predictLocalMovement, traceShot, WORLD } from '../public/voxel-engine.js';
import { createMovementPresenter } from '../public/voxel-presentation.js';
import { createFirstPersonMotionPresenter } from '../public/voxel-first-person-motion.js';
import { createPlayerAnimationPresenter } from '../public/voxel-player-animation.js';
import { VoxelRenderer } from '../public/voxel-renderer.js';

const STEP = 1 / 120;
const arena = { id: 'running-wobble-open', bounds: { minX: -40, maxX: 40, minZ: -40, maxZ: 40 }, colliders: [], sites: [] };
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} versus ${expected}`);
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

// Both the fixed physics and the projected display endpoint are real game code.
// The cosmetic presenter only observes immutable copies of their output.
function observe({ hz = 120, seconds = 2, map = arena, sprint = true, aim = 0, reducedMotion = false, cameraMotion, controls = null } = {}) {
  const player = createCombatPlayer(0), movement = createMovementPresenter(), head = createFirstPersonMotionPresenter(), frames = [];
  let remainder = 0;
  for (let frame = 0; frame <= hz * seconds; frame++) {
    const secondsNow = frame / hz;
    const input = { ...emptyInput(), up: true, sprint, ...controls?.(secondsNow) };
    if (frame) remainder += 1 / hz;
    while (remainder + 1e-12 >= STEP) { remainder = Math.max(0, remainder - STEP); predictLocalMovement(player, input, map); }
    const display = freeze(structuredClone(movement(player, input, map, remainder, predictLocalMovement)));
    const before = JSON.stringify(display), time = secondsNow * 1000;
    const pose = head(display, time, map.id, { aim, reducedMotion, cameraMotion });
    assert.equal(JSON.stringify(display), before, 'cosmetic gait cannot mutate movement, look angles, stamina or combat state');
    frames.push({ time, player: display, pose });
  }
  return { player, frames, head };
}
const peakDrop = frames => Math.max(...frames.map(({ pose }) => -pose.bobY));
const peakRoll = frames => Math.max(...frames.map(({ pose }) => Math.abs(pose.roll)));

test('actual sprinting has a readable alternating roll while walking and vertical head travel retain the released envelope', () => {
  const walking = observe({ sprint: false }), running = observe();
  assert.equal(walking.player.sprinting, false); assert.equal(running.player.sprinting, true);
  assert.ok(peakDrop(walking.frames) > .017 && peakDrop(walking.frames) <= .018);
  assert.ok(peakRoll(walking.frames) > .0066 && peakRoll(walking.frames) <= .0068);
  assert.ok(peakDrop(running.frames) > .017 && peakDrop(running.frames) <= .018);
  assert.ok(peakRoll(running.frames) > .0134 && peakRoll(running.frames) <= .014);
  assert.ok(peakRoll(running.frames) > peakRoll(walking.frames) * 1.9);
  assert.ok(running.frames.some(({ pose }) => pose.roll > .012) && running.frames.some(({ pose }) => pose.roll < -.012));
  for (const { pose } of running.frames) assert.ok(pose.bobY <= 0, 'sprinting cannot reveal cover above the accepted head');
});

test('sprint cadence and amplitude follow the same real physics at 60, 120, 144 and 240 Hz', () => {
  let reference;
  for (const hz of [60, 120, 144, 240]) {
    const result = observe({ hz });
    const checkpoints = result.frames.filter((_entry, frame) => frame && frame % (hz / 6) === 0);
    if (reference) {
      assert.deepEqual(result.player, reference.player, 'the display schedule cannot change the authoritative sprint');
      for (let index = 0; index < checkpoints.length; index++) {
        const pose = checkpoints[index].pose, expected = reference.checkpoints[index].pose;
        near(pose.bobY, expected.bobY, .002); near(pose.roll, expected.roll, .0014); near(pose.sprint, expected.sprint, .018);
      }
    } else reference = { player: structuredClone(result.player), checkpoints };
  }
});

test('starting and releasing sprint blend amplitudes without restarting the travelled footfall phase', () => {
  const { frames } = observe({ hz: 240, controls: seconds => ({ sprint: seconds >= .5 && seconds < 1.2 }) });
  const transition = frames.find(({ time }) => time >= 500 && time < 510).pose;
  assert.ok(transition.sprint > 0 && transition.sprint < .1, 'the initial sprint frame eases in rather than jumping to full amplitude');
  const release = frames.find(({ time }) => time >= 1200 && time < 1210).pose;
  assert.ok(release.sprint > .8 && release.sprint < 1, 'the initial walking frame retains a decaying carry blend');
  const settled = frames.at(-1).pose;
  assert.ok(settled.sprint < .0002 && Math.abs(settled.bobY) <= .01801 && Math.abs(settled.roll) <= .006802);
  for (let index = 1; index < frames.length; index++) {
    const previous = frames[index - 1].pose, pose = frames[index].pose;
    const travelPhase = (pose.phase - previous.phase + Math.PI * 2) % (Math.PI * 2);
    assert.ok(travelPhase < .1, 'a sprint transition does not restart or leap the distance-based gait');
    assert.ok(Math.abs(pose.bobY - previous.bobY) < .0028 && Math.abs(pose.roll - previous.roll) < .0014, 'no one-frame head snap occurs at either transition');
  }
});

test('pinned sprint input and correction wiggle settle the head after a real wall collision', () => {
  const wall = { ...arena, id: 'running-wobble-wall', colliders: [{ x: -3, y: 0, z: -1.5, w: 6, h: 4, d: .2 }] };
  const { player, head, frames } = observe({ map: wall });
  assert.ok(player.z >= -1.3 + player.radius - 1e-5);
  const stopped = frames.at(-1).pose;
  assert.ok(Math.abs(stopped.bobY) < 1e-7 && Math.abs(stopped.roll) < 1e-7 && stopped.sprint < 1e-7);
  for (let frame = 1; frame <= 240; frame++) {
    const pose = head(freeze({ ...player, sprinting: true, vx: 8, vz: -8, x: player.x + Math.sin(frame) * .0004 }), 2000 + frame * 1000 / 240, wall.id);
    near(pose.phase, stopped.phase); assert.ok(Math.abs(pose.bobY) < 1e-7 && Math.abs(pose.roll) < 1e-7);
  }
});

test('sprint ADS and reduced-motion preferences suppress head motion exactly and partial ADS damps the same accepted pose', () => {
  const normal = observe(), partial = observe({ aim: .6 }), aimed = observe({ aim: 1 }), reduced = observe({ reducedMotion: true, cameraMotion: 'system' });
  for (let index = 0; index < normal.frames.length; index++) {
    const pose = normal.frames[index].pose;
    near(partial.frames[index].pose.bobY, pose.bobY * .4); near(partial.frames[index].pose.roll, pose.roll * .4);
    for (const sequence of [aimed, reduced]) { assert.equal(sequence.frames[index].pose.bobY, 0); assert.equal(sequence.frames[index].pose.roll, 0); }
  }
  const changed = normal.head(normal.player, 2010, arena.id, { reducedMotion: true, cameraMotion: 'system' });
  assert.equal(changed.stride, 0); assert.equal(changed.bobY, 0); assert.equal(changed.roll, 0);
});

test('pauses freeze a running pose and resume, life changes, teleports and suspension re-anchor it quietly', () => {
  for (const change of [{ paused: true }, { lifeId: 2 }, { deaths: 2 }, { id: 1 }, { x: 10 }, { context: 'next' }, { time: 3101 }]) {
    const { player, head, frames } = observe();
    const moving = frames.at(-1).pose;
    assert.ok(moving.sprint > .99);
    if (change.paused) {
      assert.deepEqual(head(player, 2050, arena.id, { paused: true }), moving);
      assert.deepEqual(head({ ...player, x: player.x + .02 }, 2400, arena.id, { paused: true }), moving);
      const resumed = head(player, 2410, arena.id);
      assert.equal(resumed.stride, 0); assert.equal(resumed.bobY, 0); assert.equal(resumed.roll, 0);
    } else {
      const quiet = head({ ...player, ...change }, change.time ?? 2010, change.context ?? arena.id);
      assert.equal(quiet.stride, 0); assert.equal(quiet.bobY, 0); assert.equal(quiet.roll, 0);
    }
  }
});

function rendererHarness() {
  const captured = { view: null, eye: null, modelEye: null };
  const gl = new Proxy({}, { get(_target, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (name === 'uniformMatrix4fv') return (uniform, _transpose, value) => { if (uniform === 'uView' && !captured.view) captured.view = Array.from(value); };
    if (name === 'uniform3fv') return (uniform, value) => { if (uniform === 'uEye' && value[1] > 0) captured.eye = Array.from(value); };
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  const renderer = new VoxelRenderer({ width: 960, height: 540, getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) });
  const render = renderer.render;
  renderer.render = function(...args) { captured.view = null; return render.apply(this, args); };
  const original = renderer._viewModel;
  renderer._viewModel = function(...args) { captured.modelEye = [...args[6]]; return original.apply(this, args); };
  return { renderer, captured };
}

test('the renderer uploads sprint wobble without rotating the forward aim or changing authoritative contacts', () => {
  const { renderer, captured } = rendererHarness(), { frames } = observe({ seconds: 1 });
  let maxDrop = 0, maxRoll = 0;
  try {
    for (const { player, time } of frames) {
      const enemy = { ...createCombatPlayer(1), x: player.x, z: player.z - 10 };
      const state = freeze({ gameId: 'voxel-horde', map: arena, phase: 'fight', round: 1, players: [player, enemy], events: [] });
      const original = JSON.stringify(state), direction = aimDirection(player.yaw, player.pitch);
      const origin = { x: player.x, y: player.y + WORLD.eyeHeight, z: player.z };
      const contact = traceShot(state, 0, origin, direction, 100, arena);
      assert.equal(renderer.render(state, { localId: 0, time }), true);
      const { eye, view, modelEye } = captured;
      assert.deepEqual(modelEye, eye, 'the held weapon is clipped from the exact displayed head position');
      near(eye[0], player.x); near(eye[2], player.z);
      for (const [axis, matrixIndex] of [['x', 2], ['y', 6], ['z', 10]]) near(-view[matrixIndex], direction[axis], 1e-7);
      assert.deepEqual(traceShot(state, 0, origin, direction, 100, arena), contact);
      const displayedContact = traceShot(state, 0, { x: eye[0], y: eye[1], z: eye[2] }, direction, 100, arena);
      assert.equal(contact.playerId, enemy.id); assert.equal(displayedContact.playerId, enemy.id); assert.equal(displayedContact.kind, contact.kind);
      assert.equal(JSON.stringify(state), original);
      const drop = origin.y - eye[1], roll = renderer.stats.firstPerson.roll;
      assert.ok(drop >= -1e-8 && drop <= .01801 && Math.abs(roll) <= .01402);
      maxDrop = Math.max(maxDrop, drop); maxRoll = Math.max(maxRoll, Math.abs(roll));
    }
    assert.ok(maxDrop > .017 && maxRoll > .0134, 'the stronger sprint roll reaches actual uploaded world-view matrices');
  } finally { renderer.destroy(); }
});

test('a genuine sprint-to-first-shot transition adds no near-head or thin-cover origin error beyond the released camera', () => {
  // Archived 3.62 camera compression: keep this reference independent of the
  // changed head presenter. The real, unchanged gait still supplies its phase.
  const releasedBob = gait => -Math.min(.018, (1 - Math.cos(gait.phase * 2)) * .009 * gait.stride + gait.land * .012) || 0;
  let acceptedShots = 0, challengingEdges = 0, fadingSprintShots = 0;
  for (const cover of [false, true]) for (const sprintTicks of [60, 73, 86, 99, 112, 125]) {
    const map = { ...arena, id: `first-shot-edge-${cover}-${sprintTicks}`, colliders: [] };
    const state = createState(), referenceGait = createPlayerAnimationPresenter(), { renderer, captured } = rendererHarness();
    state.map = map; state.mapId = map.id; state.phase = 'fight'; state.tick = 0; state.events = [];
    state.players = [createCombatPlayer(0), { ...createCombatPlayer(1), z: -25 }];
    try {
      let baseline;
      for (let tick = 0; tick <= sprintTicks; tick++) {
        if (tick) { state.tick++; predictLocalMovement(state.players[0], { ...emptyInput(), up: true, sprint: true }, map); }
        const frozen = Object.freeze({ ...freeze(structuredClone({ ...state, map: null })), map });
        baseline = referenceGait(frozen.players[0], tick * 1000 / 120, map.id);
        assert.equal(renderer.render(frozen, { localId: 0, time: tick * 1000 / 120 }), true);
      }
      const player = state.players[0], target = state.players[1];
      assert.equal(player.sprinting, true);
      target.x = player.x; target.z = player.z - 2;
      // The center ray grazes the lower head boundary. A thin cover lip can
      // then lie between the accepted eye and the slightly lower display eye.
      const pitch = Math.atan2(1.482 - WORLD.eyeHeight, 2 - .22);
      if (cover) map.colliders.push({ id: 'head-edge-lip', x: player.x - .5, y: 0, z: player.z - 1, w: 1, h: 1.543, d: .035 });
      const input = { ...emptyInput({ yaw: 0, pitch }), up: true, sprint: true, fire: true };
      state.tick++; combatStep(state, [input, emptyInput()], map);
      assert.equal(player.sprinting, false, 'actual gun fire cancels the physical sprint on its first tick');
      const shot = state.events.find(event => event.type === 'shot' && event.playerId === player.id);
      assert.ok(shot, 'the test observes an accepted first shell rather than a fake fire flag'); acceptedShots++;
      near(shot.y, player.y + WORLD.eyeHeight);
      const frozen = Object.freeze({ ...freeze(structuredClone({ ...state, map: null })), map }), time = (sprintTicks + 1) * 1000 / 120;
      baseline = referenceGait(frozen.players[0], time, map.id);
      const baselineDrop = releasedBob(baseline), direction = aimDirection(player.yaw, player.pitch);
      const authorityEye = { x: player.x, y: player.y + WORLD.eyeHeight, z: player.z };
      const oldEye = { ...authorityEye, y: authorityEye.y + baselineDrop };
      const oldDisplayContact = traceShot(frozen, 0, oldEye, direction, 100, map);
      const genuineContact = traceShot(frozen, 0, authorityEye, direction, 100, map);
      const before = JSON.stringify(frozen);
      assert.equal(renderer.render(frozen, { localId: 0, time }), true);
      assert.ok(renderer.stats.firstPerson.sprint > .85, 'the accepted shot is tested while the old sprint carry is still fading'); fadingSprintShots++;
      near(renderer.stats.firstPerson.bobY, baselineDrop);
      near(captured.eye[1], oldEye.y);
      assert.deepEqual(traceShot(frozen, 0, { x: captured.eye[0], y: captured.eye[1], z: captured.eye[2] }, direction, 100, map), oldDisplayContact);
      for (const [axis, matrixIndex] of [['x', 2], ['y', 6], ['z', 10]]) near(-captured.view[matrixIndex], direction[axis], 1e-7);
      if (oldDisplayContact.kind !== genuineContact.kind) challengingEdges++;
      // Project a point on the genuine center ray using the actual renderer
      // view matrix. Stronger roll may rotate the pre-existing offset, but
      // cannot grow its length or create another origin error.
      const point = [authorityEye.x + direction.x * 2, authorityEye.y + direction.y * 2, authorityEye.z + direction.z * 2];
      const coordinates = [0, 1, 2].map(row => captured.view[row] * point[0] + captured.view[row + 4] * point[1] + captured.view[row + 8] * point[2] + captured.view[row + 12]);
      const focalLength = 540 / (2 * Math.tan(70 * Math.PI / 360));
      const actualOffset = Math.hypot(coordinates[0], coordinates[1]) / -coordinates[2] * focalLength;
      const releasedOffset = -baselineDrop * Math.cos(pitch) / (2 - baselineDrop * Math.sin(pitch)) * focalLength;
      near(actualOffset, releasedOffset, .0001);
      assert.ok(actualOffset < 3.6, 'at two metres, first-shot error stays within the released 18 mm envelope');
      assert.equal(JSON.stringify(frozen), before, 'presentation cannot change the accepted shot or contact journal');
    } finally { renderer.destroy(); }
  }
  assert.equal(acceptedShots, 12); assert.equal(fadingSprintShots, 12);
  assert.ok(challengingEdges >= 1, 'the fixture includes a real edge where extra origin translation could change a contact');
});

test('sprinting preserves the released thin-cover clamp instead of clipping through a lower surface', () => {
  const top = WORLD.eyeHeight - .009;
  const map = { ...arena, id: 'running-wobble-eye-cover', colliders: [{ x: -30, y: top - .001, z: -30, w: 60, h: .001, d: 60 }] };
  const { renderer, captured } = rendererHarness(), head = createFirstPersonMotionPresenter();
  let clipped = false;
  try {
    for (let frame = 0; frame <= 120; frame++) {
      const player = freeze({ ...createCombatPlayer(0), x: frame * 7.7 / 120, sprinting: true }), time = frame * 1000 / 120;
      const wanted = head(player, time, map.id);
      assert.equal(renderer.render(freeze({ gameId: 'voxel-horde', map, phase: 'fight', round: 1, players: [player], events: [] }), { localId: 0, time }), true);
      assert.ok(captured.eye[1] >= top + .0049, 'downward compression cannot cross the lower cover surface');
      assert.deepEqual(captured.modelEye, captured.eye);
      clipped ||= wanted.bobY < -.010 && captured.eye[1] > WORLD.eyeHeight + wanted.bobY;
    }
    assert.ok(clipped, 'the fixture reaches a real sprint dip that requires the existing cover clamp');
  } finally { renderer.destroy(); }
});
