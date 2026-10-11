import assert from 'node:assert/strict';
import test from 'node:test';
import { aimDirection, combatStep, createCombatPlayer, createState, emptyInput, predictLocalMovement, traceShot, WORLD } from '../public/voxel-engine.js';
import { createMovementPresenter } from '../public/voxel-presentation.js';
import { createFirstPersonMotionPresenter, resolveCameraMotion } from '../public/voxel-first-person-motion.js';
import { VoxelRenderer } from '../public/voxel-renderer.js';

const arena = { id: 'camera-motion-options', bounds: { minX: -40, maxX: 40, minZ: -40, maxZ: 40 }, colliders: [], sites: [] };
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} versus ${b}`);
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const visualFields = ['bobY', 'roll', 'weaponX', 'weaponY', 'weaponZ', 'weaponPitch', 'weaponYaw', 'weaponRoll'];

function frames({ hz = 120, map = arena, sprint = true } = {}) {
  const player = createCombatPlayer(0), movement = createMovementPresenter(), result = [];
  const input = { ...emptyInput(), up: true, sprint };
  let remainder = 0;
  for (let frame = 0; frame <= hz; frame++) {
    if (frame) remainder += 1 / hz;
    while (remainder + 1e-12 >= 1 / 120) { remainder = Math.max(0, remainder - 1 / 120); predictLocalMovement(player, input, map); }
    result.push({ player: freeze(structuredClone(movement(player, input, map, remainder, predictLocalMovement))), time: frame * 1000 / hz });
  }
  return result;
}

test('only known camera choices override system motion preferences', () => {
  for (const value of [undefined, null, '', 'unknown', 'constructor', {}, ['normal'], new String('normal'), true, 1]) {
    assert.deepEqual(resolveCameraMotion(value, true), { cameraMotion: 'system', headReducedMotion: true, rollMultiplier: 1 });
    assert.equal(resolveCameraMotion(value, false).headReducedMotion, false);
  }
  assert.deepEqual(resolveCameraMotion('normal', true), { cameraMotion: 'normal', headReducedMotion: false, rollMultiplier: 1 });
  assert.deepEqual(resolveCameraMotion('strong', true), { cameraMotion: 'strong', headReducedMotion: false, rollMultiplier: 2 });
  assert.deepEqual(resolveCameraMotion('off', false), { cameraMotion: 'off', headReducedMotion: true, rollMultiplier: 1 });
});

test('strong doubles actual travelled roll while vertical bob, held equipment and authoritative movement stay unchanged', () => {
  let reference;
  for (const hz of [60, 120, 144, 240]) {
    const normal = createFirstPersonMotionPresenter(), strong = createFirstPersonMotionPresenter();
    const points = frames({ hz }), checkpoints = [];
    let maxRoll = 0;
    for (let frame = 0; frame < points.length; frame++) {
      const { player, time } = points[frame], before = JSON.stringify(player);
      const a = normal(player, time, arena.id, { cameraMotion: 'normal', reducedMotion: true });
      const b = strong(player, time, arena.id, { cameraMotion: 'strong', reducedMotion: true });
      assert.equal(b.bobY, a.bobY); near(b.roll, a.roll * 2);
      for (const field of visualFields.filter(field => field !== 'roll')) assert.equal(b[field], a[field]);
      assert.ok(b.bobY >= -.018 && b.bobY <= 0 && Math.abs(b.roll) <= .014);
      assert.equal(JSON.stringify(player), before);
      maxRoll = Math.max(maxRoll, Math.abs(b.roll));
      if (frame && frame % (hz / 6) === 0) checkpoints.push(b);
    }
    assert.ok(maxRoll > .0135);
    if (reference) for (let index = 0; index < checkpoints.length; index++) {
      near(checkpoints[index].roll, reference[index].roll, .0014); near(checkpoints[index].bobY, reference[index].bobY, .002);
    } else reference = checkpoints;
  }
});

test('absent camera options preserve system suppression, while explicit off also suppresses sprint and crouch carry', () => {
  const defaultHead = createFirstPersonMotionPresenter(), systemHead = createFirstPersonMotionPresenter(), offHead = createFirstPersonMotionPresenter();
  for (const { player, time } of frames()) {
    assert.deepEqual(defaultHead(player, time, arena.id, { reducedMotion: true }), systemHead(player, time, arena.id, { reducedMotion: true, cameraMotion: 'system' }));
    const off = offHead(player, time, arena.id, { cameraMotion: 'off' });
    for (const field of visualFields) assert.equal(off[field], 0, `off clears ${field}, including static sprint carry`);
  }
  const crouched = offHead({ ...frames().at(-1).player, crouching: true }, 1010, arena.id, { cameraMotion: 'off' });
  for (const field of visualFields) assert.equal(crouched[field], 0);
});

test('strong keeps ADS exactly still, settles against physical walls and does not animate correction wiggle', () => {
  const aimed = createFirstPersonMotionPresenter();
  for (const { player, time } of frames({ sprint: false })) {
    const pose = aimed(player, time, arena.id, { cameraMotion: 'strong', reducedMotion: true, aim: 1 });
    for (const field of ['bobY', 'roll']) assert.equal(pose[field], 0, `ADS suppresses camera ${field}`);
  }
  const wall = { ...arena, id: 'camera-motion-wall', colliders: [{ x: -3, y: 0, z: -1.5, w: 6, h: 4, d: .2 }] }, head = createFirstPersonMotionPresenter();
  const points = frames({ map: wall });
  let pose;
  for (const { player, time } of points) pose = head(player, time, wall.id, { cameraMotion: 'strong' });
  const player = points.at(-1).player, phase = pose.phase;
  for (let frame = 1; frame <= 240; frame++) pose = head({ ...player, x: player.x + Math.sin(frame) * .0004, sprinting: true, vx: 8, vz: -8 }, 1000 + frame * 1000 / 240, wall.id, { cameraMotion: 'strong' });
  near(pose.phase, phase); assert.ok(Math.abs(pose.bobY) < 1e-7 && Math.abs(pose.roll) < 1e-7);
});

test('changing camera mode quietly reanchors locomotion, and strong preserves pause and lifecycle resets', () => {
  const head = createFirstPersonMotionPresenter(), points = frames();
  let pose;
  for (const { player, time } of points) pose = head(player, time, arena.id, { cameraMotion: 'strong' });
  const player = points.at(-1).player;
  assert.deepEqual(head(player, 1040, arena.id, { cameraMotion: 'strong', paused: true }), pose);
  assert.deepEqual(head(player, 1300, arena.id, { cameraMotion: 'strong', paused: true }), pose);
  const resumed = head(player, 1310, arena.id, { cameraMotion: 'strong' });
  assert.equal(resumed.stride, 0); assert.equal(resumed.bobY, 0); assert.equal(resumed.roll, 0);
  for (const mode of ['normal', 'off', 'system', 'strong']) {
    const changed = head(player, 1320, arena.id, { cameraMotion: mode });
    assert.equal(changed.stride, 0); assert.equal(changed.bobY, 0); assert.equal(changed.roll, 0);
  }
  for (const patch of [{ lifeId: 2 }, { deaths: 2 }, { x: 20 }]) {
    const separate = createFirstPersonMotionPresenter();
    for (const { player, time } of points) separate(player, time, arena.id, { cameraMotion: 'strong' });
    const changed = separate({ ...player, ...patch }, 1010, arena.id, { cameraMotion: 'strong' });
    assert.equal(changed.stride, 0); assert.equal(changed.roll, 0);
  }
});

function harness({ systemReduced = false } = {}) {
  const uploads = { view: null, eye: null, effects: [] };
  const gl = new Proxy({}, { get(_target, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (name === 'uniformMatrix4fv') return (uniform, _transpose, value) => { if (uniform === 'uView' && !uploads.view) uploads.view = [...value]; };
    if (name === 'uniform3fv') return (uniform, value) => { if (uniform === 'uEye' && value[1] > 0) uploads.eye = [...value]; };
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  const renderer = new VoxelRenderer({ width: 960, height: 540, getContext: () => gl, getBoundingClientRect: () => ({ width: 960, height: 540 }), addEventListener() {}, removeEventListener() {} });
  renderer.reducedMotion = { matches: systemReduced };
  const render = renderer.render, events = renderer._events;
  renderer.render = function(...args) { uploads.view = null; return render.apply(this, args); };
  renderer._events = function(state, time, id, options) { uploads.effects.push(options.reducedMotion); return events.call(this, state, time, id, options); };
  return { renderer, uploads };
}

test('actual renderer overrides only head motion, preserves global reduced effects and exposes frozen effective diagnostics', () => {
  for (const preference of [undefined, 'system', 'normal', 'strong', 'off', 'unknown']) {
    const { renderer, uploads } = harness({ systemReduced: true });
    let maxRoll = 0;
    try {
      for (const { player, time } of frames()) {
        assert.equal(renderer.render({ gameId: 'voxel-dojo', map: arena, phase: 'fight', round: 1, players: [player], events: [] }, { localId: 0, time, cameraMotion: preference }), true);
        const stats = renderer.stats, expected = resolveCameraMotion(preference, true);
        assert.equal(stats.reducedMotion, true); assert.equal(stats.cameraMotion, expected.cameraMotion); assert.equal(stats.headReducedMotion, expected.headReducedMotion);
        assert.equal(stats.firstPerson.cameraMotion, expected.cameraMotion); assert.equal(stats.firstPerson.headReducedMotion, expected.headReducedMotion);
        maxRoll = Math.max(maxRoll, Math.abs(stats.firstPerson.roll));
        if (expected.headReducedMotion) { assert.equal(stats.firstPerson.bobY, 0); assert.equal(stats.firstPerson.roll, 0); }
        assert.ok(Object.isFrozen(stats) && Object.isFrozen(stats.firstPerson));
        assert.throws(() => { stats.cameraMotion = 'off'; }, TypeError);
      }
      assert.ok(uploads.effects.every(value => value === true), 'explicit camera motion never unmutes reduced slash/monster/death effects');
      if (preference === 'normal') assert.ok(maxRoll > .0067 && maxRoll <= .007);
      if (preference === 'strong') assert.ok(maxRoll > .0135 && maxRoll <= .014);
    } finally { renderer.destroy(); }
  }
});

test('system honors explicit and reduced-quality suppression while normal and strong can override locomotion alone', () => {
  for (const option of [{ reducedMotion: true }, { quality: 'reduced' }]) for (const mode of ['system', 'normal', 'strong', 'off']) {
    const { renderer } = harness();
    try {
      for (const { player, time } of frames()) renderer.render({ gameId: 'voxel-dojo', map: arena, phase: 'fight', players: [player], events: [] }, { localId: 0, time, cameraMotion: mode, ...option });
      assert.equal(renderer.stats.reducedMotion, true);
      assert.equal(renderer.stats.headReducedMotion, mode === 'system' || mode === 'off');
    } finally { renderer.destroy(); }
  }
});

test('strong and normal upload the same first-shot eye and center ray at a near head and cover edge', () => {
  const normal = harness(), strong = harness(), state = createState();
  state.map = arena; state.mapId = arena.id; state.phase = 'fight'; state.events = []; state.tick = 0;
  state.players = [createCombatPlayer(0), { ...createCombatPlayer(1), z: -25 }];
  try {
    for (let tick = 0; tick <= 99; tick++) {
      if (tick) predictLocalMovement(state.players[0], { ...emptyInput(), up: true, sprint: true }, arena);
      for (const [mode, instance] of [['normal', normal], ['strong', strong]]) instance.renderer.render(state, { localId: 0, time: tick * 1000 / 120, cameraMotion: mode, reducedMotion: true });
    }
    const player = state.players[0], target = state.players[1];
    target.x = player.x; target.z = player.z - 2;
    const pitch = Math.atan2(1.482 - WORLD.eyeHeight, 2 - .22);
    combatStep(state, [{ ...emptyInput({ pitch }), up: true, sprint: true, fire: true }, emptyInput()], arena);
    assert.equal(player.sprinting, false); assert.ok(state.events.some(event => event.type === 'shot'));
    const original = JSON.stringify(state), direction = aimDirection(player.yaw, player.pitch);
    for (const [mode, instance] of [['normal', normal], ['strong', strong]]) {
      instance.renderer.render(state, { localId: 0, time: 100 * 1000 / 120, cameraMotion: mode, reducedMotion: true });
      for (const [axis, matrixIndex] of [['x', 2], ['y', 6], ['z', 10]]) near(-instance.uploads.view[matrixIndex], direction[axis], 1e-7);
    }
    assert.deepEqual(strong.uploads.eye, normal.uploads.eye);
    near(strong.renderer.stats.firstPerson.roll, normal.renderer.stats.firstPerson.roll * 2);
    const eye = instance => ({ x: instance.uploads.eye[0], y: instance.uploads.eye[1], z: instance.uploads.eye[2] });
    const edgeMap = { ...arena, colliders: [{ id: 'thin-lip', x: player.x - .5, y: 0, z: player.z - 1, w: 1, h: 1.543, d: .035 }] };
    for (const map of [arena, edgeMap]) assert.deepEqual(traceShot(state, 0, eye(strong), direction, 100, map), traceShot(state, 0, eye(normal), direction, 100, map));
    assert.equal(JSON.stringify(state), original);
  } finally { normal.renderer.destroy(); strong.renderer.destroy(); }
});
