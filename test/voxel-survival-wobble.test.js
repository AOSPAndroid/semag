import assert from 'node:assert/strict';
import test from 'node:test';
import { createState, step, FIXED_STEP, lookDirection, raycast, serialize, setPaused } from '../public/voxel-survival-engine.js';
import { setWorldBlock } from '../public/voxel-survival-world.js';
import { createSurvivalPresentation } from '../public/voxel-survival-presentation.js';
import { SurvivalRenderer, survivalHandMotion } from '../public/voxel-survival-renderer.js';

const near = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
function fixture() {
  const state = createState({ seed: 93841 });
  state.world.blocks.fill(0);
  for (let z = 0; z < state.world.depth; z++) for (let x = 0; x < state.world.width; x++) setWorldBlock(state.world, x, 0, z, 1);
  Object.assign(state.player, { x: 12.5, y: 1, z: 20.5, grounded: true });
  return state;
}
function harness() {
  let serial = 0, bound = null;
  const uploads = new Map(), recorded = { view: null, eye: null, right: null, up: null, forward: null };
  const functions = {
    getShaderParameter: () => true, getProgramParameter: () => true, getAttribLocation: () => 0,
    getUniformLocation: (_, name) => name,
    createShader: () => ++serial, createProgram: () => ++serial, createBuffer: () => ++serial, createTexture: () => ++serial,
    bindBuffer: (_, buffer) => { bound = buffer; },
    bufferSubData: (_, _offset, values) => { uploads.set(bound, Array.from(values)); },
    uniformMatrix4fv: (name, _transpose, values) => { if (name === 'uView' && !recorded.view) recorded.view = [...values]; },
    uniform3fv: (name, values) => {
      const field = { uEye: 'eye', uRight: 'right', uUp: 'up', uForward: 'forward' }[name];
      if (field && (field !== 'eye' || !recorded.eye)) recorded[field] = [...values];
    },
  };
  const gl = new Proxy(functions, { get: (target, key) => target[key] || (String(key).toUpperCase() === key ? 1 : () => {}) });
  const renderer = new SurvivalRenderer({ width: 960, height: 540, getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) });
  const render = (state, camera = state.player, options = {}) => {
    recorded.view = recorded.eye = null;
    assert.equal(renderer.render(state, camera, options), true);
    return renderer.getStats();
  };
  return { renderer, render, recorded, uploads };
}
function observe({ sprint = true, mode = 'strong', reducedMotion = false, seconds = 1.5, hz = 120, state = fixture(), input = {} } = {}) {
  const capture = harness(), display = createSurvivalPresentation(), frames = [];
  let tick = 0;
  for (let frame = 0; frame <= Math.round(seconds * hz); frame++) {
    const secondsAtFrame = frame / hz;
    while ((tick + 1) * FIXED_STEP <= secondsAtFrame + 1e-10) {
      display.capture(state);
      step(state, { strafe: 1, sprint, yaw: .17, pitch: -.19, ...input }, FIXED_STEP); tick++;
    }
    const sample = display.sample(state, (secondsAtFrame - tick * FIXED_STEP) / FIXED_STEP);
    const stats = capture.render(state, sample.camera, { ...sample.options, reducedMotion, cameraMotion: mode });
    frames.push({ ...stats.firstPerson, drawCalls: stats.drawCalls, uploadedChunks: stats.uploadedChunks });
  }
  return { ...capture, frames, state, display };
}

test('real Wilds walking and food-funded sprint reach the shared camera envelope, with one sky/world roll and unchanged center aim', () => {
  let walkingRoll;
  for (const sprint of [false, true]) {
    const run = observe({ sprint });
    try {
      const { state, renderer, recorded, frames } = run, last = frames.at(-1), direction = lookDirection(state.player);
      const maxDrop = Math.max(...frames.map(frame => -frame.bobY)), maxRoll = Math.max(...frames.map(frame => Math.abs(frame.roll)));
      assert.ok(maxDrop > (sprint ? .017 : .011) && maxDrop <= .01800001);
      assert.ok(maxRoll > (sprint ? .0134 : .0044));
      if (sprint) assert.ok(maxRoll > walkingRoll * 2); else walkingRoll = maxRoll;
      near(last.speed, sprint ? 5.5 : 3.5, .02); assert.equal(last.cameraMotion, 'strong');
      assert.equal(last.headReducedMotion, false); assert.equal(last.airborne, false);
      near(last.eye[1], state.player.y + state.player.eyeHeight + last.bobY);
      for (const [axis, matrixIndex] of [['x', 2], ['y', 6], ['z', 10]]) near(-recorded.view[matrixIndex], direction[axis]);
      for (let axis = 0; axis < 3; axis++) {
        near(recorded.right[axis], recorded.view[axis * 4]); near(recorded.up[axis], recorded.view[axis * 4 + 1]);
        near(recorded.forward[axis], -recorded.view[axis * 4 + 2]);
      }
      assert.ok(frames.slice(1).every(frame => frame.uploadedChunks === 0), 'cosmetic movement never rebuilds terrain');
      const diagnostics = renderer.getStats(); assert.ok(Object.isFrozen(diagnostics.firstPerson)); assert.ok(Object.isFrozen(diagnostics.firstPerson.eye));
    } finally { run.renderer.destroy(); }
  }
});

test('Strong doubles roll only; explicit modes override only locomotion while System honors reduced motion and Off remains steady', () => {
  const normal = observe({ mode: 'normal', reducedMotion: true }), strong = observe({ mode: 'strong', reducedMotion: true });
  try {
    for (let i = 0; i < normal.frames.length; i++) {
      near(strong.frames[i].roll, normal.frames[i].roll * 2); near(strong.frames[i].bobY, normal.frames[i].bobY);
    }
    assert.ok(Math.max(...strong.frames.map(frame => Math.abs(frame.roll))) > .0135);
    assert.equal(serialize(strong.state), serialize(normal.state));
    const action = { ...normal.state, mining: { progress: .3 }, player: { ...normal.state.player, swingTime: .11 } };
    assert.equal(survivalHandMotion(action, action.player, { reducedMotion: true, firstPersonMotion: normal.frames.at(-1) }).swing, .06,
      'enabling camera wobble never enables additional mining/attack effects under reduced motion');
    // Wilds does not currently expose ADS. The common display contract still
    // keeps its camera and forward ray steady if equipment later supplies aim.
    const beforeAim = serialize(strong.state), aimed = strong.render(strong.state, strong.state.player, { cameraMotion: 'strong', aim: 1 }).firstPerson;
    assert.equal(aimed.bobY, 0); assert.equal(aimed.roll, 0); assert.equal(serialize(strong.state), beforeAim);
    near(aimed.eye[1], strong.state.player.y + strong.state.player.eyeHeight);
  } finally { normal.renderer.destroy(); strong.renderer.destroy(); }
  for (const mode of ['system', 'off']) {
    const run = observe({ mode, reducedMotion: true });
    try {
      assert.ok(run.frames.every(frame => frame.bobY === 0 && frame.roll === 0 && frame.headReducedMotion === true));
      if (mode === 'off') assert.ok(run.frames.every(frame => frame.weaponX === 0 && frame.weaponY === 0 && frame.weaponZ === 0));
    } finally { run.renderer.destroy(); }
  }
});

for (const hz of [60, 120, 144, 240]) test(`rendering Wilds at ${hz} Hz leaves exact physics, selected equipment, mining and build targets intact`, () => {
  const state = fixture(), control = fixture();
  for (const scene of [state, control]) {
    setWorldBlock(scene.world, 16, 2, 20, 4);
    Object.assign(scene.player, { yaw: Math.PI / 2, pitch: 0 });
  }
  const input = { strafe: 0, forward: 0, mine: true, yaw: Math.PI / 2, pitch: 0 };
  const run = observe({ state, hz, input });
  try {
    for (let tick = 0; tick < 180; tick++) step(control, { strafe: 1, sprint: true, yaw: .17, pitch: -.19, ...input }, FIXED_STEP);
    assert.equal(serialize(state), serialize(control), 'displaying hands, head and terrain cannot advance mining or spend any item');
    const origin = { x: state.player.x, y: state.player.y + state.player.eyeHeight, z: state.player.z }, direction = lookDirection(state.player);
    assert.deepEqual(state.target, control.target);
    assert.deepEqual(raycast(state, origin, direction), raycast(control, origin, direction));
    const before = JSON.stringify({ player: state.player, target: state.target, placement: state.placement, mining: state.mining, inventory: state.inventory, selectedSlot: state.selectedSlot });
    run.render(state, state.player, { cameraMotion: 'strong' });
    assert.equal(JSON.stringify({ player: state.player, target: state.target, placement: state.placement, mining: state.mining, inventory: state.inventory, selectedSlot: state.selectedSlot }), before);
  } finally { run.renderer.destroy(); }
});

test('actual wall contact settles all walking motion despite a held sprint command', () => {
  const state = fixture();
  for (let z = 0; z < state.world.depth; z++) for (let y = 1; y < 5; y++) setWorldBlock(state.world, 15, y, z, 4);
  const run = observe({ state, seconds: 2.5, input: { yaw: 0, pitch: 0 } });
  try {
    assert.ok(run.frames.some(frame => Math.abs(frame.roll) > .005));
    assert.ok(state.player.x < 15);
    const settled = run.frames.at(-1);
    assert.ok(settled.speed < .0001 && settled.stride < .0001 && Math.abs(settled.roll) < 1e-6 && Math.abs(settled.bobY) < 1e-6);
    assert.ok(Math.abs(settled.weaponY) < 1e-6, 'blocked sprint does not leave the hands in a running pose');
  } finally { run.renderer.destroy(); }
});

test('paused running poses freeze; resume, death, teleport, suspension and replaced worlds re-anchor quietly', () => {
  const run = observe(), { state, render, renderer } = run;
  try {
    const moving = renderer.getStats().firstPerson;
    setPaused(state, true); render(state);
    for (const field of ['bobY', 'roll', 'weaponX', 'weaponY', 'phase', 'stride', 'sprint']) near(renderer.getStats().firstPerson[field], moving[field]);
    const paused = renderer.getStats().firstPerson;
    render(state, state.player, { displayTime: state.time + .2 }); assert.deepEqual(renderer.getStats().firstPerson, paused);
    setPaused(state, false); render(state); assert.equal(renderer.getStats().firstPerson.stride, 0);
    const assertQuiet = () => { const pose = renderer.getStats().firstPerson; assert.equal(pose.bobY, 0); assert.equal(pose.roll, 0); assert.equal(pose.stride, 0); };
    assertQuiet();
    Object.assign(state.player, { x: 4 }); state.time += .01; render(state); assertQuiet();
    state.time += 2; render(state); assertQuiet();
    state.phase = 'dead'; state.player.hp = 0; render(state); assertQuiet();
    const replacement = fixture(); render(replacement); assertQuiet();
    assert.equal(renderer.getStats().firstPerson.cameraMotion, 'strong');
  } finally { renderer.destroy(); }
});

test('jumping and crouched display stances settle head sway without raising the eye or changing physical dimensions', () => {
  const run = observe(), { state, render, renderer } = run;
  try {
    const before = { radius: state.player.radius, height: state.player.height, eyeHeight: state.player.eyeHeight };
    step(state, { strafe: 1, sprint: true, jump: true, yaw: .17, pitch: -.19 }, FIXED_STEP);
    assert.equal(state.player.grounded, false);
    let last;
    for (let frame = 0; frame <= 40; frame++) {
      const camera = { ...state.player, x: state.player.x + frame / 100, y: state.player.y + frame / 50 };
      last = render(state, camera, { displayTime: state.time + frame / 120 }).firstPerson;
      assert.ok(last.eye[1] <= camera.y + camera.eyeHeight + 1e-8);
    }
    assert.ok(Math.abs(last.roll) < .0001 && Math.abs(last.bobY) < .0001);
    assert.deepEqual({ radius: state.player.radius, height: state.player.height, eyeHeight: state.player.eyeHeight }, before);
    const crouched = fixture();
    for (let frame = 0; frame <= 60; frame++) {
      const camera = { ...crouched.player, crouching: true, grounded: true, vy: 0, x: 18 + frame * 3.5 / 120, y: 1 };
      last = render(crouched, camera, { displayTime: crouched.time + frame / 120 }).firstPerson;
      assert.ok(Math.abs(last.roll) <= .0068 * .45 * .7 + 1e-7);
    }
    assert.equal(last.crouchCarry, 1);
  } finally { renderer.destroy(); }
});

test('voxel lips and low ceiling edges bound actual uploaded head travel; roll does not change the forward targeting ray', () => {
  const state = fixture(), { render, renderer, recorded } = harness();
  setWorldBlock(state.world, 11, 1, 20, 4); setWorldBlock(state.world, 12, 3, 20, 4);
  state.player.vx = 5.5;
  let clamped = 0, maxUnclamped = 0;
  try {
    // Original eye is 10mm above a nearby ledge. One near-clip corner crosses
    // its side; the camera must retain a 5mm gap even at peak sprint dip.
    for (let frame = 0; frame <= 150; frame++) {
      const camera = { ...state.player, x: 12.02, y: 1, z: 20.2 + frame * 5.5 / 120, eye: 1.01, yaw: 0, pitch: .2 };
      if (Math.floor(camera.z) !== 20) setWorldBlock(state.world, 11, 1, Math.floor(camera.z), 4);
      const stats = render(state, camera, { displayTime: state.time + frame / 120, cameraMotion: 'strong' });
      const pose = stats.firstPerson;
      assert.ok(pose.bobY <= 0 && pose.bobY >= -.00500001); assert.ok(recorded.eye[1] >= 2.005 - 1e-8);
      if (Math.abs(pose.bobY + .005) < 1e-8) clamped++;
      const direction = lookDirection(camera);
      for (const [axis, index] of [['x', 2], ['y', 6], ['z', 10]]) near(-recorded.view[index], direction[axis]);
    }
    assert.ok(clamped > 10, 'actual moving views reached the cover-clamped part of the 18mm envelope');
    // A completely clear original eye retains the unchanged full envelope.
    renderer.presentHead.reset();
    for (let frame = 0; frame <= 150; frame++) {
      const camera = { ...state.player, x: 15.5 + frame * 5.5 / 120, y: 1, z: 20.5 };
      const pose = render(state, camera, { displayTime: state.time + frame / 120 }).firstPerson;
      maxUnclamped = Math.max(maxUnclamped, -pose.bobY);
    }
    assert.ok(maxUnclamped > .017 && maxUnclamped <= .01800001);
  } finally { renderer.destroy(); }
});
