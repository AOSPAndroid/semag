import assert from 'node:assert/strict';
import test from 'node:test';
import { createPracticeInputQueue } from '../public/voxel-practice-input.js';
import { createPractice, startPractice, stepPractice, pausePractice, resumePractice } from '../public/voxel-practice-engine.js';
import { applyCombatDamage, emptyInput, predictLocalMovement } from '../public/voxel-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { movementPresentation } from '../public/voxel-presentation.js';
import { composeInput } from '../public/voxel-client.js';
import { releasePracticeTouchAction } from '../public/voxel-practice-client.js';

function fight(options = {}) {
  const state = createPractice({ bots: 1, mode: 'targets', seed: 65219, ...options });
  startPractice(state);
  while (state.phase === 'countdown') stepPractice(state);
  assert.equal(state.phase, 'fight');
  return state;
}
function shortPress(queue, action) { queue.press(action); queue.release(action); }
function tick(state, queue, held = {}) { const input = queue.sample(held); stepPractice(state, input); return input; }

test('a semi-auto press released before any frame waits for real physics and fires once', () => {
  const state = fight({ weapon: 'pistol' }), queue = createPracticeInputQueue(), player = state.players[0];
  const before = state.tick;
  shortPress(queue, 'fire');
  assert.equal(state.tick, before, 'input events must never advance simulation');
  assert.equal(player.shots, 0);
  tick(state, queue);
  assert.equal(player.shots, 1); assert.equal(player.ammo, WEAPONS.pistol.magazine - 1);
  for (let index = 0; index < WEAPONS.pistol.cooldown + 3; index++) tick(state, queue);
  assert.equal(player.shots, 1, 'one tap must not repeat after weapon recovery');
  shortPress(queue, 'fire'); tick(state, queue);
  assert.equal(player.shots, 2);
});

test('two rapid blade taps retain a release edge and both affect the real equipment', () => {
  const state = fight(), queue = createPracticeInputQueue(), player = state.players[0];
  shortPress(queue, 'swap'); shortPress(queue, 'swap');
  assert.equal(tick(state, queue).swap, true); assert.equal(player.slot, 'sword');
  assert.equal(tick(state, queue).swap, false); assert.equal(player.slot, 'sword');
  assert.equal(tick(state, queue).swap, true); assert.equal(player.slot, 'primary');
  tick(state, queue); assert.equal(player.slot, 'primary');
});

test('rapid utility taps trigger the actual reload, grenade and healing commitments', () => {
  const reload = fight(), reloadQueue = createPracticeInputQueue();
  shortPress(reloadQueue, 'fire'); tick(reload, reloadQueue); tick(reload, reloadQueue);
  shortPress(reloadQueue, 'reload'); tick(reload, reloadQueue);
  assert.ok(reload.players[0].reloadTicks > 0);
  const grenade = fight(), grenadeQueue = createPracticeInputQueue();
  shortPress(grenadeQueue, 'grenade'); tick(grenade, grenadeQueue);
  assert.equal(grenade.players[0].grenades, 0); assert.equal(grenade.grenades.length, 1);
  assert.ok(grenade.players[0].grenadeThrowTicks > 0);
  const heal = fight(), healQueue = createPracticeInputQueue();
  applyCombatDamage(heal, [{ playerId: 1, targetId: 0, damage: 75, weapon: 'carbine', attack: 'gun' }]);
  shortPress(healQueue, 'heal'); tick(heal, healQueue);
  assert.equal(heal.players[0].potions, 0); assert.ok(heal.players[0].healTicks > 0);
});

test('a rapid jump reaches real movement once while ordinary movement remains held', () => {
  const state = fight(), queue = createPracticeInputQueue(), player = state.players[0], start = { ...player };
  shortPress(queue, 'jump');
  for (let index = 0; index < 8; index++) tick(state, queue, { up: true, yaw: 0, pitch: .2 });
  assert.ok(player.y > 0); assert.ok(player.z < start.z);
  assert.equal(player.yaw, 0); assert.equal(player.pitch, .2);
  assert.equal(queue.inspect().jump, 0);
});

test('held auto fire and ADS stay continuous after the first queued press', () => {
  const state = fight(), queue = createPracticeInputQueue(), player = state.players[0];
  queue.press('fire');
  for (let index = 0; index < 36; index++) {
    const input = tick(state, queue, { fire: true, aim: true, up: true });
    assert.equal(input.fire, true); assert.equal(input.aim, true); assert.equal(input.up, true);
  }
  assert.ok(player.shots >= 3); assert.equal(player.aimTicks, 18);
});

test('reset cancels pending taps and held countdown actions require a genuine release', () => {
  const state = fight(), queue = createPracticeInputQueue();
  shortPress(queue, 'fire'); shortPress(queue, 'grenade');
  queue.reset({ held: { fire: true, jump: true } });
  assert.equal(queue.preview({ jump: true, up: true }).jump, false);
  assert.equal(queue.preview({ jump: true, up: true }).up, true);
  for (let index = 0; index < 3; index++) tick(state, queue, { fire: true, jump: true });
  assert.equal(state.players[0].shots, 0); assert.equal(state.players[0].grenades, 1); assert.equal(state.players[0].y, 0);
  queue.release('fire'); shortPress(queue, 'fire'); tick(state, queue);
  assert.equal(state.players[0].shots, 1); assert.equal(state.players[0].y, 0);
});

test('render previews neither consume queued presses nor project a blocked countdown jump', () => {
  const state = fight(), queue = createPracticeInputQueue();
  shortPress(queue, 'jump'); shortPress(queue, 'fire');
  const before = queue.inspect();
  for (const hz of [60, 120, 144, 240]) for (let index = 0; index < hz; index++) queue.preview({ up: true, yaw: .4 });
  assert.deepEqual(queue.inspect(), before); assert.equal(state.players[0].shots, 0);
  tick(state, queue); assert.equal(state.players[0].shots, 1); assert.ok(state.players[0].y > 0);
  queue.reset({ held: { jump: true } });
  assert.equal(queue.preview({ jump: true }).jump, false);
  queue.release('jump'); assert.equal(queue.preview({ jump: true }).jump, true);
});

test('pause cancels queued actions and resume primes the real engine fence before a fresh tap', () => {
  const state = fight(), queue = createPracticeInputQueue(), player = state.players[0];
  shortPress(queue, 'fire'); shortPress(queue, 'swap');
  pausePractice(state); queue.reset();
  const frozen = state.tick; tick(state, queue); assert.equal(state.tick, frozen);
  resumePractice(state); queue.reset({ neutral: true }); shortPress(queue, 'fire');
  tick(state, queue); assert.equal(player.shots, 0); assert.equal(player.slot, 'primary');
  tick(state, queue); assert.equal(player.shots, 1); assert.equal(player.slot, 'primary');
});

test('a short Royale interact tap acquires an authored weapon through the actual loot rule', () => {
  const state = fight({ game: 'voxel-royale', mapId: 'forest' }), queue = createPracticeInputQueue();
  const loot = state.loot.find(item => item.kind === 'weapon' && item.y === 0);
  assert.ok(loot); Object.assign(state.players[0], { x: loot.x, y: loot.y, z: loot.z });
  shortPress(queue, 'interact'); tick(state, queue);
  assert.equal(state.players[0].hasGun, true);
  assert.ok(state.events.some(event => event.type === 'lootPickup' && event.playerId === 0));
});

test('a released jump has the same fractional preview and next real practice movement at high refresh rates', () => {
  for (const hz of [144, 240]) {
    const state = fight(), queue = createPracticeInputQueue(), player = state.players[0];
    const held = { ...emptyInput({ yaw: .7 }), up: true };
    shortPress(queue, 'jump');
    const before = structuredClone(player), counts = queue.inspect(), fraction = 120 / hz;
    const previewInput = queue.preview(held);
    const pose = movementPresentation(player, previewInput, state.map, 1 / hz, predictLocalMovement, state.players);
    assert.deepEqual(queue.inspect(), counts, 'render selection does not consume the jump');
    assert.deepEqual(player, before, 'the preview never changes the real movement body');
    assert.equal(previewInput.jump, true, 'a released pending jump is visible in the next step');
    const sampled = tick(state, queue, held);
    assert.deepEqual(previewInput, sampled);
    assert.ok(player.y > before.y);
    for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(pose[axis] - (before[axis] + (player[axis] - before[axis]) * fraction)) < 1e-8, `${hz} Hz ${axis} follows the actual next physics step`);
  }
});

test('a grounded repeated jump previews its release fence before the real new jump', () => {
  const state = fight(), queue = createPracticeInputQueue(), player = state.players[0], held = { ...emptyInput(), jump: true };
  queue.press('jump'); tick(state, queue, held);
  while (!player.grounded) tick(state, queue, held);
  const start = structuredClone(player);
  queue.release('jump'); queue.press('jump');
  const counts = queue.inspect(), fence = queue.preview(held);
  for (let frame = 0; frame < 16; frame++) assert.deepEqual(queue.preview(held), fence);
  assert.deepEqual(queue.inspect(), counts); assert.equal(fence.jump, false);
  assert.deepEqual(tick(state, queue, held), fence); assert.equal(player.y, start.y); assert.equal(player.grounded, true);
  const jump = queue.preview(held); assert.equal(jump.jump, true);
  const pose = movementPresentation(player, jump, state.map, .5 / 120, predictLocalMovement, state.players);
  assert.deepEqual(tick(state, queue, held), jump); assert.ok(player.y > start.y);
  assert.ok(Math.abs(pose.y - (start.y + (player.y - start.y) * .5)) < 1e-8);
  assert.equal(queue.inspect().jump, 0);
});

test('preview and sample share simultaneous utility counts, auto holds and reset gates without consuming draws', () => {
  const queue = createPracticeInputQueue(), held = { ...emptyInput({ yaw: 1.1, pitch: -.4 }), fire: true, aim: true, up: true };
  for (const action of ['fire', 'swap', 'heal']) shortPress(queue, action);
  const counts = queue.inspect(), preview = queue.preview(held);
  assert.equal(preview.fire, true); assert.equal(preview.swap, true); assert.equal(preview.heal, true);
  for (let frame = 0; frame < 240; frame++) assert.deepEqual(queue.preview(held), preview);
  assert.deepEqual(queue.inspect(), counts); assert.deepEqual(queue.sample(held), preview);
  assert.equal(queue.preview(held).fire, true, 'ordinary automatic holds remain continuous');
  assert.equal(queue.preview(held).swap, false); assert.equal(queue.preview(held).heal, false);
  queue.reset({ neutral: true }); shortPress(queue, 'jump');
  const neutral = queue.preview(held); assert.equal(neutral.jump, false); assert.equal(neutral.fire, false); assert.equal(neutral.up, true);
  assert.deepEqual(queue.sample(held), neutral); assert.equal(queue.preview(held).jump, true);
  queue.reset({ held: { jump: true } });
  assert.equal(queue.preview({ jump: true }).jump, false);
  assert.equal(queue.preview({ jump: false }).jump, false);
  assert.equal(queue.preview({ jump: true }).jump, false, 'a draw cannot remove the held reset gate');
  queue.sample({ jump: false }); queue.press('jump'); assert.equal(queue.preview({ jump: true }).jump, true);
});

function touchControls() {
  const queue = createPracticeInputQueue(), keys = new Set(), mouse = { fire: false, aim: false };
  const touch = { actions: new Set(), move: { x: 0, y: 0 } }, pointers = new Map();
  const held = () => composeInput(keys, touch, mouse, { yaw: 0, pitch: 0 });
  return { queue, keys, mouse, touch, pointers, held,
    down(id, action) {
      const wasHeld = held()[action];
      touch.actions.add(action);
      const pointer = { action, target: { setAttribute() {} }, token: wasHeld ? null : queue.press(action) };
      pointers.set(id, pointer); return pointer;
    },
    end(id, cancelled) {
      const pointer = pointers.get(id); pointers.delete(id);
      releasePracticeTouchAction(pointer, pointers, touch.actions, queue, action => held()[action], cancelled);
    },
  };
}

test('an unconsumed cancelled touch cannot fire, throw a grenade or invent a rendered jump', () => {
  for (const action of ['fire', 'grenade', 'jump']) {
    const state = fight({ weapon: 'pistol' }), controls = touchControls(), player = state.players[0];
    controls.down(1, action); controls.end(1, true);
    const held = controls.held(), preview = controls.queue.preview(held);
    const pose = movementPresentation(player, preview, state.map, 1 / 240, predictLocalMovement, state.players);
    assert.equal(preview[action], false); assert.equal(pose.y, 0); assert.equal(controls.queue.inspect()[action], 0);
    tick(state, controls.queue, held);
    assert.equal(player.shots, 0); assert.equal(player.grenades, 1); assert.equal(state.grenades.length, 0); assert.equal(player.y, 0);
  }
});

test('ordinary touch release preserves a quick fire, grenade or jump tap until real physics', () => {
  for (const action of ['fire', 'grenade', 'jump']) {
    const state = fight({ weapon: 'pistol' }), controls = touchControls(), player = state.players[0];
    controls.down(1, action); controls.end(1, false);
    assert.equal(controls.queue.inspect()[action], 1); tick(state, controls.queue, controls.held());
    if (action === 'fire') assert.equal(player.shots, 1);
    if (action === 'grenade') { assert.equal(player.grenades, 0); assert.equal(state.grenades.length, 1); }
    if (action === 'jump') assert.ok(player.y > 0);
  }
});

test('cancelling one touch token preserves earlier and later same-action taps and unrelated commitments', () => {
  const state = fight(), controls = touchControls(), player = state.players[0];
  const first = controls.down(1, 'swap'); controls.end(1, false);
  controls.down(2, 'swap'); controls.end(2, true);
  controls.down(3, 'swap'); controls.end(3, false);
  controls.down(4, 'jump'); controls.end(4, false);
  assert.equal(controls.queue.inspect().swap, 2); assert.equal(controls.queue.inspect().jump, 1);
  tick(state, controls.queue, controls.held()); assert.equal(player.slot, 'sword'); assert.ok(player.y > 0);
  assert.equal(controls.queue.cancel(first.token), false, 'a consumed token cannot cancel the later same-action press');
  tick(state, controls.queue, controls.held()); assert.equal(player.slot, 'sword');
  tick(state, controls.queue, controls.held()); assert.equal(player.slot, 'primary');
  assert.equal(state.events.filter(event => event.type === 'swap').length, 2);
});

test('cancelling an already consumed touch cannot undo a grenade or erase another pending input', () => {
  const state = fight(), controls = touchControls(), player = state.players[0];
  const grenade = controls.down(1, 'grenade'); tick(state, controls.queue, controls.held());
  assert.equal(player.grenades, 0); assert.equal(state.grenades.length, 1);
  controls.down(2, 'jump'); controls.end(2, false); controls.end(1, true);
  assert.equal(controls.queue.cancel(grenade.token), false); assert.equal(controls.queue.inspect().jump, 1);
  tick(state, controls.queue, controls.held());
  assert.ok(player.y > 0); assert.equal(player.grenades, 0); assert.equal(state.grenades.length, 1);
});

test('two cancelled fingers preserve the aggregate hold until the final pending contact is cancelled', () => {
  const state = fight(), controls = touchControls();
  const owner = controls.down(1, 'jump'), alias = controls.down(2, 'jump');
  assert.ok(owner.token); assert.equal(alias.token, null); assert.equal(controls.queue.inspect().jump, 1);
  controls.end(1, true);
  assert.equal(controls.held().jump, true); assert.equal(controls.queue.inspect().jump, 1);
  assert.equal(alias.token, owner.token, 'the live remaining finger can withdraw the original pending press');
  controls.end(2, true);
  assert.equal(controls.held().jump, false); assert.equal(controls.queue.inspect().jump, 0);
  tick(state, controls.queue, controls.held()); assert.equal(state.players[0].y, 0);
});

test('a valid release by either held finger preserves the aggregate tap despite another finger cancelling', () => {
  for (const order of [[1, 2], [2, 1]]) for (const firstCancelled of [true, false]) {
    const state = fight(), controls = touchControls();
    controls.down(1, 'jump'); controls.down(2, 'jump');
    controls.end(order[0], firstCancelled); controls.end(order[1], !firstCancelled);
    assert.equal(controls.queue.inspect().jump, 1);
    tick(state, controls.queue, controls.held()); assert.ok(state.players[0].y > 0);
  }
});

test('a cancelled touch preserves the same action still held by a keyboard or mouse alias', () => {
  for (const action of ['jump', 'fire']) {
    const state = fight({ weapon: 'pistol' }), controls = touchControls();
    controls.down(1, action);
    if (action === 'jump') controls.keys.add('jump'); else controls.mouse.fire = true;
    controls.end(1, true);
    assert.equal(controls.held()[action], true); assert.equal(controls.queue.inspect()[action], 1);
    tick(state, controls.queue, controls.held());
    if (action === 'jump') assert.ok(state.players[0].y > 0); else assert.equal(state.players[0].shots, 1);
  }
});

test('token cancellation stays bounded and cannot remove a consumed, forged or reset commitment', () => {
  const state = fight(), queue = createPracticeInputQueue(), tokens = [];
  for (let index = 0; index < 8; index++) { tokens.push(queue.press('swap')); queue.release('swap'); }
  assert.equal(queue.press('swap'), null); assert.equal(queue.inspect().swap, 8);
  assert.equal(queue.cancel({ action: 'swap' }), false); assert.equal(queue.cancel(null), false);
  assert.equal(queue.cancel(tokens[3]), true); assert.equal(queue.cancel(tokens[3]), false); assert.equal(queue.inspect().swap, 7);
  for (let index = 0; index < 16; index++) tick(state, queue);
  assert.equal(state.events.filter(event => event.type === 'swap').length, 7); assert.equal(queue.inspect().swap, 0);
  assert.equal(queue.cancel(tokens[0]), false);
  const previous = queue.press('jump'); queue.reset({ held: { jump: true } });
  assert.equal(queue.cancel(previous), false); assert.equal(queue.press('jump'), null);
  queue.release('jump'); const fresh = queue.press('jump'); assert.ok(fresh); assert.equal(queue.cancel(fresh), true);
});

test('render previews leave cancellable token ownership and release fences unchanged', () => {
  const state = fight({ weapon: 'pistol' }), controls = touchControls(), player = state.players[0];
  const jump = controls.down(1, 'jump'); controls.down(2, 'fire'); controls.end(2, false);
  const counts = controls.queue.inspect();
  for (let frame = 0; frame < 240; frame++) {
    const preview = controls.queue.preview(controls.held()); preview.jump = false;
    movementPresentation(player, controls.queue.preview(controls.held()), state.map, 1 / 240, predictLocalMovement, state.players);
  }
  assert.deepEqual(controls.queue.inspect(), counts); assert.equal(player.y, 0); assert.equal(player.shots, 0);
  controls.end(1, true); assert.equal(controls.queue.cancel(jump.token), false, 'only the cancellation consumed ownership');
  assert.equal(controls.queue.inspect().fire, 1);
  tick(state, controls.queue, controls.held()); assert.equal(player.y, 0); assert.equal(player.shots, 1);
});
