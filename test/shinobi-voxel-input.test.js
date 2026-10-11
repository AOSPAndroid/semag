import assert from 'node:assert/strict';
import test from 'node:test';
import { createFpsInputQueue, releaseFpsTouchAction } from '../public/voxel-input-queue.js';
import { createShinobiVoxelInputQueue, SHINOBI_VOXEL_EDGE_ACTIONS } from '../public/shinobi-voxel-input.js';

function tap(queue, action, at, look = {}, sequence = 1) {
  queue.observe({ ...look, [action]: true }, at, { sequence, viewTick: sequence * 10 });
  queue.observe({ ...look, [action]: false }, at + 1, { sequence: sequence + 1, viewTick: sequence * 10 + 1 });
}

test('two sub-step blade taps survive 120 Hz sampling with a real release between attacks', () => {
  const queue = createShinobiVoxelInputQueue();
  tap(queue, 'fire', 100, { yaw: -.6, pitch: -.2 }, 1);
  tap(queue, 'fire', 102, { yaw: .7, pitch: .1 }, 3);
  const moving = { up: true, right: true, sprint: true, yaw: 1.4, pitch: .3 };
  queue.observe(moving, 104, { viewTick: 50 });
  const first = queue.sample(undefined, 104);
  const release = queue.sample(undefined, 104 + 1000 / 120);
  const second = queue.sample(undefined, 104 + 2000 / 120);
  assert.equal(first.buttons.fire, true);
  assert.equal(release.buttons.fire, false);
  assert.equal(second.buttons.fire, true);
  assert.equal(first.buttons.yaw, -.6); assert.equal(first.buttons.pitch, -.2); assert.equal(first.viewTick, 10);
  assert.equal(release.buttons.yaw, 1.4); assert.equal(release.viewTick, 50);
  assert.equal(second.buttons.yaw, .7); assert.equal(second.buttons.pitch, .1); assert.equal(second.viewTick, 30);
  for (const sampled of [first, release, second]) {
    assert.equal(sampled.buttons.up, true);
    assert.equal(sampled.buttons.right, true);
    assert.equal(sampled.buttons.sprint, true);
  }
  assert.equal(queue.inspect().pending.length, 0);
  assert.notEqual(queue.sample(undefined, 130).buttons.fire, true);
});

test('released slash, parry, dash and kunai capture their own direction while movement remains current', () => {
  for (const action of ['fire', 'aim', 'dash', 'kunai']) {
    const queue = createShinobiVoxelInputQueue();
    tap(queue, action, 100, { yaw: -.4, pitch: -.25 }, 3);
    queue.observe({ left: true, crouch: true, walk: true, yaw: 1.2, pitch: .4 }, 102, { viewTick: 80 });
    const sampled = queue.sample(undefined, 103);
    assert.equal(sampled.buttons[action], true, action);
    assert.equal(sampled.buttons.yaw, -.4, action);
    assert.equal(sampled.buttons.pitch, -.25, action);
    assert.equal(sampled.viewTick, 30, action);
    assert.equal(sampled.buttons.left, true, action);
    assert.equal(sampled.buttons.crouch, true, action);
    assert.equal(sampled.buttons.walk, true, action);
    const next = queue.sample(undefined, 104);
    assert.notEqual(next.buttons[action], true, action);
    assert.equal(next.buttons.yaw, 1.2, action);
    assert.equal(next.viewTick, 80, action);
  }
});

test('jump and feint use the latest movement and turn without restoring a stale attack direction', () => {
  for (const action of ['jump', 'feint']) {
    const queue = createShinobiVoxelInputQueue();
    tap(queue, action, 100, { yaw: -.8, pitch: -.2 }, 1);
    queue.observe({ down: true, sprint: true, yaw: .9, pitch: .35 }, 102, { viewTick: 70 });
    const sampled = queue.sample(undefined, 103);
    assert.equal(sampled.buttons[action], true);
    assert.equal(sampled.buttons.down, true); assert.equal(sampled.buttons.sprint, true);
    assert.equal(sampled.buttons.yaw, .9); assert.equal(sampled.buttons.pitch, .35); assert.equal(sampled.viewTick, 70);
  }
});

test('a sub-step dash preserves its camera-relative movement direction after the camera turns', () => {
  const queue = createShinobiVoxelInputQueue();
  tap(queue, 'dash', 100, { yaw: -.4, pitch: -.2, moveYaw: .7 }, 1);
  queue.observe({ up: true, yaw: .6, pitch: .3, moveYaw: -1.2 }, 102, { viewTick: 50 });
  const preview = queue.preview(undefined, 103), sampled = queue.sample(undefined, 103);
  assert.equal(sampled.buttons.dash, true); assert.equal(sampled.buttons.up, true);
  assert.equal(sampled.buttons.yaw, -.4); assert.equal(sampled.buttons.moveYaw, .7);
  assert.deepEqual(sampled.buttons, preview);
  const next = queue.sample(undefined, 104);
  assert.notEqual(next.buttons.dash, true); assert.equal(next.buttons.yaw, .6); assert.equal(next.buttons.moveYaw, -1.2);
});

test('sword, parry and kunai commitments capture combat aim while keeping current movement direction', () => {
  for (const action of ['fire', 'aim', 'kunai']) {
    const queue = createShinobiVoxelInputQueue();
    tap(queue, action, 100, { yaw: -.5, pitch: -.15, moveYaw: .8 }, 1);
    queue.observe({ up: true, yaw: 1.1, pitch: .2, moveYaw: -1.3 }, 102, { viewTick: 50 });
    const sampled = queue.sample(undefined, 103);
    assert.equal(sampled.buttons[action], true); assert.equal(sampled.buttons.up, true);
    assert.equal(sampled.buttons.yaw, -.5); assert.equal(sampled.buttons.pitch, -.15);
    assert.equal(sampled.buttons.moveYaw, -1.3, action);
  }
});

test('a physical hold journals one attack while sustained parry and current movement stay live', () => {
  const queue = createShinobiVoxelInputQueue();
  for (let index = 0; index < 60; index++) {
    queue.observe({ fire: true, aim: true, up: true, yaw: index / 20 }, 100 + index);
  }
  assert.deepEqual(queue.inspect().pending.map(edge => edge.action), ['fire', 'aim']);
  for (let index = 0; index < 10; index++) {
    const sampled = queue.sample(undefined, 160 + index);
    assert.equal(sampled.buttons.fire, true); assert.equal(sampled.buttons.aim, true); assert.equal(sampled.buttons.up, true);
  }
  assert.equal(queue.inspect().pending.length, 0);
  queue.observe({}, 170); queue.sample(undefined, 171);
  queue.observe({ fire: true }, 172);
  assert.deepEqual(queue.inspect().pending.map(edge => edge.action), ['fire']);
});

test('pause reset fences every held combat action until its genuine release', () => {
  const queue = createShinobiVoxelInputQueue();
  const held = Object.fromEntries(SHINOBI_VOXEL_EDGE_ACTIONS.map(action => [action, true]));
  queue.observe(held, 100);
  queue.reset({ held, neutral: true });
  for (let index = 0; index < 3; index++) {
    queue.observe({ ...held, up: true, sprint: true }, 101 + index);
    const sampled = queue.sample(undefined, 101 + index);
    for (const action of SHINOBI_VOXEL_EDGE_ACTIONS) assert.equal(sampled.buttons[action], false, action);
    assert.equal(sampled.buttons.up, true); assert.equal(sampled.buttons.sprint, true);
  }
  queue.observe({}, 104);
  tap(queue, 'dash', 105, { yaw: .5, pitch: 0 }, 20);
  assert.equal(queue.sample(undefined, 107).buttons.dash, true);
  assert.deepEqual(queue.inspect().blocked, []);
});

test('a fresh post-pause jump waits through the neutral step and is not lost', () => {
  const queue = createShinobiVoxelInputQueue();
  tap(queue, 'fire', 100);
  queue.reset({ neutral: true });
  tap(queue, 'jump', 102);
  assert.equal(queue.preview({ up: true, jump: true }, 104).jump, false);
  assert.equal(queue.sample(undefined, 104).buttons.jump, false);
  assert.equal(queue.sample(undefined, 105).buttons.jump, true);
  assert.notEqual(queue.sample(undefined, 106).buttons.fire, true);
});

test('render previews remain observational and match the next authoritative combat selection', () => {
  const queue = createShinobiVoxelInputQueue();
  tap(queue, 'kunai', 100, { yaw: .4, pitch: -.3 }, 1);
  tap(queue, 'jump', 102, {}, 3);
  queue.observe({ up: true, yaw: -.7, pitch: .2 }, 104, { viewTick: 60 });
  const before = queue.inspect();
  for (const hz of [60, 120, 144, 240]) {
    for (let index = 0; index < hz; index++) {
      const preview = queue.preview(undefined, 105);
      assert.equal(preview.kunai, true); assert.equal(preview.jump, false);
      preview.kunai = false; preview.yaw = 99;
    }
  }
  assert.deepEqual(queue.inspect(), before);
  const preview = queue.preview(undefined, 105);
  assert.deepEqual(queue.sample(undefined, 105).buttons, preview);
  assert.equal(queue.preview(undefined, 106).jump, true);
  assert.equal(queue.preview(undefined, 106).yaw, -.7);
});

test('custom taps respect the pending budget and expire after the configured stall fence', () => {
  const queue = createShinobiVoxelInputQueue({ maxPending: 2, maxAgeMs: 120 });
  for (let index = 0; index < 20; index++) tap(queue, 'feint', 100 + index * 2, {}, index * 2);
  assert.equal(queue.inspect().pending.length, 2);
  assert.equal(queue.sample(undefined, 200).buttons.feint, true);
  assert.equal(queue.sample(undefined, 201).buttons.feint, false);
  assert.equal(queue.sample(undefined, 202).buttons.feint, true);
  assert.notEqual(queue.sample(undefined, 203).buttons.feint, true);
  tap(queue, 'kunai', 204, { yaw: .5 }, 50);
  assert.equal(queue.preview(undefined, 324).kunai, true);
  assert.equal(queue.preview(undefined, 324.01).kunai, false);
  assert.equal(queue.inspect().pending.length, 1, 'preview does not consume an expired edge');
  assert.equal(queue.sample(undefined, 324.01).buttons.kunai, false);
  assert.equal(queue.inspect().pending.length, 0);
});

test('custom touch cancellation removes only its own unconsumed dash commitment', () => {
  const queue = createShinobiVoxelInputQueue();
  tap(queue, 'kunai', 100, {}, 1);
  const actions = new Set(['dash']);
  const pointer = { action: 'dash', pressSeq: 3, element: { classList: { remove() {} } } };
  queue.observe({ dash: true }, 102, { sequence: 3 });
  const cancelled = releaseFpsTouchAction(pointer, new Map(), actions, () => false, true);
  assert.deepEqual(cancelled, { action: 'dash', seq: 3 });
  assert.equal(queue.cancel(cancelled), true);
  queue.observe({}, 103, { sequence: 4 });
  assert.equal(queue.sample(undefined, 104).buttons.kunai, true);
  assert.notEqual(queue.sample(undefined, 105).buttons.dash, true);
  tap(queue, 'dash', 106, {}, 5);
  assert.equal(queue.cancel(cancelled), false, 'an old touch token cannot erase a new dash');
  assert.equal(queue.sample(undefined, 108).buttons.dash, true);
  assert.equal(queue.cancel({ action: 'grenade', seq: 5 }), false);
});

test('custom action lists are copied, deduplicated and validated for the lifetime of a queue', () => {
  const edges = ['dash', 'dash', 'kunai', null, '__proto__'];
  const aims = ['dash', 'dash', 'fire'], movement = ['dash', 'dash', 'fire'];
  const queue = createFpsInputQueue({ edgeActions: edges, aimActions: aims, movementActions: movement });
  edges.length = 0; edges.push('fire'); aims.length = 0; movement.length = 0;
  tap(queue, 'dash', 100, { yaw: -.5, pitch: .2, moveYaw: -.6 }, 1);
  tap(queue, 'kunai', 102, { yaw: -.8, pitch: -.2 }, 3);
  queue.observe({ yaw: .7, pitch: .3, moveYaw: .9 }, 104, { viewTick: 80 });
  assert.deepEqual(queue.inspect().pending.map(edge => edge.action), ['dash', 'kunai']);
  const dash = queue.sample(undefined, 105).buttons;
  assert.equal(dash.yaw, -.5, 'copied aim actions still capture dash direction');
  assert.equal(dash.moveYaw, -.6, 'copied movement actions still capture dash travel direction');
  const kunai = queue.sample(undefined, 106).buttons;
  assert.equal(kunai.yaw, .7, 'non-aim custom action uses the latest direction');
  assert.equal(kunai.moveYaw, .9, 'non-movement custom action uses the latest movement direction');
  assert.equal(queue.cancel({ action: 'fire', seq: 1 }), false);
  assert.equal(Object.isFrozen(SHINOBI_VOXEL_EDGE_ACTIONS), true);
});
