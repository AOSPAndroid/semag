import assert from 'node:assert/strict';
import test from 'node:test';
import { createWeaponWheelController, mountWeaponWheel } from '../public/voxel-inventory-ui.js';
import { createInventoryGun, createInventoryMelee } from '../public/voxel-inventory.js';
import { createPracticeWheelDispatch } from '../public/voxel-practice-client.js';
import { createPracticeInputQueue } from '../public/voxel-practice-input.js';
import { createFpsInputQueue } from '../public/voxel-input-queue.js';
import { createPractice, startPractice, stepPractice } from '../public/voxel-practice-engine.js';
import { pickupCombatLoot } from '../public/voxel-engine.js';

const player = (inventory = [createInventoryMelee('knife'), createInventoryGun('carbine'), null, null], inventoryIndex = 1) => ({ id: 0, lifeId: 1, deaths: 0, alive: true, inventory, inventoryIndex });
const event = (deltaY, extras = {}) => ({ deltaY, deltaX: 0, deltaMode: 0, ...extras });
const consume = (wheel, actor, delta, now, extras) => wheel.consume(event(delta, extras), actor, { now });

test('both directions wrap occupied guns and blades and skip utility and empty slots without mutation', () => {
  const actor = player([createInventoryMelee('katana'), { kind: 'heal', amount: 2 }, createInventoryGun('pistol'), { kind: 'grenade', amount: 1 }], 0);
  const before = structuredClone(actor), wheel = createWeaponWheelController();
  assert.equal(consume(wheel, actor, 120, 0).action, 'slot3');
  assert.equal(consume(wheel, actor, 120, 30).action, 'slot1');
  assert.equal(consume(wheel, actor, -120, 60).action, 'slot3');
  assert.deepEqual(actor, before);
  const empty = player([null, null, null, null]);
  assert.equal(consume(createWeaponWheelController(), empty, 120, 0).action, null);
  const knife = player([createInventoryMelee('knife'), null, null, null], 0);
  assert.equal(consume(createWeaponWheelController(), knife, -120, 0).action, null);
  knife.inventoryIndex = 2;
  assert.equal(consume(createWeaponWheelController(), knife, 120, 0).action, 'slot1');
  assert.equal(consume(createWeaponWheelController(), player([{ kind: 'weapon', weapon: '__proto__' }, null, null, null], 1), 120, 0).action, null);
});

test('physical slot order determines the next weapon even while a potion is selected', () => {
  const actor = player([createInventoryMelee('knife'), { kind: 'heal', amount: 1 }, null, createInventoryGun('pistol')], 1);
  assert.equal(consume(createWeaponWheelController(), actor, 80, 0).action, 'slot4');
  assert.equal(consume(createWeaponWheelController(), actor, -80, 0).action, 'slot1');
});

test('tiny trackpad motion accumulates, direction reversal resets it, and line/page detents stay bounded', () => {
  const actor = player(), wheel = createWeaponWheelController();
  for (let index = 0; index < 19; index++) assert.equal(consume(wheel, actor, 2, index).action, null);
  assert.equal(consume(wheel, actor, 2, 19).action, 'slot1');
  wheel.reset();
  assert.equal(consume(wheel, actor, 30, 100).action, null);
  assert.equal(consume(wheel, actor, -10, 101).action, null);
  assert.equal(wheel.inspect().accumulatedDelta, -10);
  assert.equal(consume(wheel, actor, -30, 102).action, 'slot1');
  const four = player([createInventoryMelee('knife'), createInventoryGun('carbine'), createInventoryGun('pistol'), createInventoryMelee('katana')]);
  assert.equal(consume(createWeaponWheelController(), four, 3, 0, { deltaMode: 1 }).action, 'slot3');
  assert.equal(consume(createWeaponWheelController(), four, 90000, 0, { deltaMode: 2 }).action, 'slot3', 'a huge page delta selects one weapon');
});

test('stale authority bursts use pending targets and retain a final full-wrap commitment', () => {
  for (const count of [2, 3, 4, 6]) {
    const actor = player([createInventoryMelee('knife'), createInventoryGun('carbine'), createInventoryGun('pistol'), createInventoryMelee('katana')]);
    const wheel = createWeaponWheelController(), sent = [];
    for (let index = 0; index < count; index++) { const action = consume(wheel, actor, 120, index).action; if (action) sent.push(action); }
    const expected = (1 + count) % 4;
    assert.equal(wheel.inspect().pendingIndex, expected);
    const final = wheel.flush(actor, 24); if (final) sent.push(final);
    assert.equal(sent.at(-1), `slot${expected + 1}`);
    assert.ok(sent.length <= 2); assert.equal(wheel.inspect().queuedIndex, null);
    assert.equal(actor.inventoryIndex, 1, 'wheel requests never write accepted selection');
  }
});

test('high-frequency motion coalesces to one latest target per interval with no delayed backlog', () => {
  const actor = player([createInventoryMelee('knife'), createInventoryGun('carbine'), createInventoryGun('pistol'), createInventoryMelee('katana')]);
  const wheel = createWeaponWheelController(), sent = [];
  for (let now = 0; now < 240; now++) { const action = consume(wheel, actor, 120, now).action; if (action) sent.push(action); }
  const final = wheel.flush(actor, 264); if (final) sent.push(final);
  assert.ok(sent.length <= 11, `${sent.length} bounded commitments from 240 raw events`);
  assert.equal(sent.at(-1), 'slot2');
  assert.equal(wheel.flush(actor, 300), null); assert.equal(wheel.flush(actor, 600), null);
});

test('pinch, horizontal gestures, invalid deltas and dead actors do not consume page input; real crouch does', () => {
  const actor = player();
  for (const extras of [{ ctrlKey: true }, { deltaX: 200 }, { deltaY: 0 }, { deltaY: Infinity }, { deltaX: NaN }, { defaultPrevented: true }, { altKey: true }, { metaKey: true }]) {
    assert.deepEqual(consume(createWeaponWheelController(), actor, 120, 0, extras), { handled: false, action: null });
  }
  assert.equal(consume(createWeaponWheelController(), { ...actor, alive: false }, 120, 0).handled, false);
  assert.equal(createWeaponWheelController().consume(event(120, { ctrlKey: true }), actor, { now: 0, crouchHeld: true }).action, 'slot1');
});

test('life and inventory changes discard stale wheel targets while ammunition changes preserve them', () => {
  const actor = player([createInventoryMelee('knife'), createInventoryGun('carbine'), createInventoryGun('pistol'), createInventoryMelee('katana')]);
  let resets = 0; const wheel = createWeaponWheelController({ onReset: () => resets++ });
  assert.equal(consume(wheel, actor, 120, 0).action, 'slot3');
  actor.inventory[1].ammo--;
  assert.equal(consume(wheel, actor, 120, 30).action, 'slot4');
  actor.lifeId++;
  assert.equal(consume(wheel, actor, 120, 60).action, 'slot3');
  actor.inventory[2] = { kind: 'heal', amount: 1 };
  assert.equal(consume(wheel, actor, 120, 90).action, 'slot4');
  assert.equal(resets, 3);
  const snapshot = wheel.inspect(); assert.ok(Object.isFrozen(snapshot));
  wheel.reset(); assert.equal(snapshot.pendingIndex, 3); assert.equal(wheel.inspect().pendingIndex, null);
});

class Canvas extends EventTarget {
  constructor() { super(); this.ownerDocument = { activeElement: this }; }
}
function dispatchWheel(canvas, deltaY = 120, extras = {}) {
  const value = new Event('wheel', { cancelable: true });
  for (const [key, data] of Object.entries({ deltaY, deltaX: 0, deltaMode: 0, ...extras })) Object.defineProperty(value, key, { value: data });
  canvas.dispatchEvent(value); return value;
}

test('mounted wheel owns only an active captured or focused fallback canvas and releases scrolling elsewhere', () => {
  const canvas = new Canvas(), actor = player(), sent = []; let at = 0;
  let context = { player: actor, active: true, pointerLocked: true, fallback: false };
  const mount = mountWeaponWheel(canvas, { context: () => context, dispatch: action => { sent.push(action); }, now: () => at });
  assert.equal(dispatchWheel(canvas).defaultPrevented, true); assert.deepEqual(sent, ['slot1']);
  context.active = false; assert.equal(dispatchWheel(canvas).defaultPrevented, false); mount.flush(); assert.equal(mount.inspect().pendingIndex, null);
  context = { ...context, active: true, pointerLocked: false, fallback: false }; assert.equal(dispatchWheel(canvas).defaultPrevented, false);
  context.fallback = true; canvas.ownerDocument.activeElement = {}; assert.equal(dispatchWheel(canvas).defaultPrevented, false);
  canvas.ownerDocument.activeElement = canvas; at = 100; assert.equal(dispatchWheel(canvas).defaultPrevented, true);
  assert.equal(dispatchWheel(canvas, 120, { ctrlKey: true }).defaultPrevented, false);
  context.crouchHeld = true; at = 130; assert.equal(dispatchWheel(canvas, 120, { ctrlKey: true }).defaultPrevented, true);
  const before = sent.length; mount.destroy(); mount.destroy(); assert.equal(dispatchWheel(canvas).defaultPrevented, false); mount.flush(); assert.equal(sent.length, before);
});

test('inactive flush and rejected dispatch cannot replay a deferred target after returning to gameplay', () => {
  const canvas = new Canvas(), actor = player(), sent = []; let at = 0, active = true;
  const mount = mountWeaponWheel(canvas, { context: () => ({ player: actor, active, pointerLocked: true }), dispatch: action => { sent.push(action); }, now: () => at });
  dispatchWheel(canvas); at = 1; dispatchWheel(canvas); assert.equal(mount.inspect().queuedIndex, 1);
  active = false; at = 40; mount.flush(); active = true; mount.flush(); assert.deepEqual(sent, ['slot1']); mount.destroy();
  const rejected = mountWeaponWheel(canvas, { context: () => ({ player: actor, active: true, pointerLocked: true }), dispatch: () => false, now: () => at });
  dispatchWheel(canvas); assert.equal(rejected.inspect().pendingIndex, null); rejected.destroy();
});

function practiceFight() {
  const state = createPractice({ bots: 1, mode: 'targets', seed: 65219 }); startPractice(state);
  while (state.phase === 'countdown') stepPractice(state);
  const actor = state.players[0];
  for (const weapon of ['pistol', 'katana']) {
    const loot = { id: ++state.lootId, kind: weapon === 'katana' ? 'melee' : 'weapon', weapon, x: actor.x, y: actor.y, z: actor.z };
    state.loot.push(loot); assert.equal(pickupCombatLoot(state, actor, loot), true);
  }
  assert.equal(actor.inventory.filter(Boolean).length, 4);
  stepPractice(state, { slot2: true }); stepPractice(state, {});
  assert.equal(actor.inventoryIndex, 1); return state;
}

test('practice supersedes only its wheel-owned token and the latest rapid choice reaches real authority', () => {
  const state = practiceFight(), actor = state.players[0], queue = createPracticeInputQueue();
  const dispatch = createPracticeWheelDispatch(queue, () => ({ yaw: .25, pitch: -.1 }));
  const keyboard = queue.press('jump');
  assert.equal(dispatch.dispatch('slot3'), true); assert.equal(dispatch.dispatch('slot4'), true);
  assert.equal(queue.inspect().slot3, 0); assert.equal(queue.inspect().slot4, 1); assert.equal(queue.inspect().jump, 1);
  const sampled = queue.sample(); stepPractice(state, sampled);
  assert.equal(actor.inventoryIndex, 3); assert.ok(actor.y > 0); assert.equal(actor.shots, 0); assert.equal(actor.meleeTicks, 0);
  assert.equal(queue.cancel(keyboard), false, 'the independently accepted jump token remains consumed normally');
  queue.press('slot3'); assert.equal(dispatch.dispatch('slot4'), false); dispatch.cancel();
  assert.equal(queue.inspect().slot3, 1, 'independent numeric/hotbar selection is preserved'); assert.equal(queue.inspect().slot4, 0);
});

test('a consumed practice wheel press cannot erase a newer independent press or fake a held numeric release', () => {
  const queue = createPracticeInputQueue(); let held = {};
  const dispatch = createPracticeWheelDispatch(queue, () => held);
  dispatch.dispatch('slot3'); queue.sample(); queue.sample();
  queue.press('slot3'); assert.equal(dispatch.dispatch('slot4'), false);
  assert.equal(queue.inspect().slot3, 1); dispatch.cancel(); assert.equal(queue.inspect().slot3, 1);
  held = { slot4: true }; assert.equal(dispatch.dispatch('slot4'), false); assert.equal(held.slot4, true);
});

test('held or unconsumed independent inventory intent wins in real practice, then wheel works after release', () => {
  for (const source of ['held key', 'released touch']) {
    const state = practiceFight(), actor = state.players[0], queue = createPracticeInputQueue();
    let held = source === 'held key' ? { slot1: true, yaw: .2 } : { yaw: .2 };
    const physical = queue.press('slot1', held), dispatch = createPracticeWheelDispatch(queue, () => held);
    assert.equal(dispatch.dispatch('slot3'), false); assert.equal(queue.inspect().slot1, 1);
    stepPractice(state, queue.sample(held)); assert.equal(actor.inventoryIndex, 0);
    assert.equal(queue.cancel(physical), false);
    if (source === 'held key') assert.equal(dispatch.dispatch('slot3'), false, 'a still-held numeric source keeps priority');
    held = { yaw: .2 }; queue.release('slot1'); stepPractice(state, queue.sample(held));
    assert.equal(dispatch.dispatch('slot3'), true); stepPractice(state, queue.sample(held));
    assert.equal(actor.inventoryIndex, 2); assert.equal(actor.shots, 0); assert.equal(actor.meleeTicks, 0);
  }
});

test('real practice inventory fences held fire and RMB until release, without phantom shots or blade secondary', () => {
  const state = practiceFight(), actor = state.players[0], queue = createPracticeInputQueue();
  const held = { fire: true, aim: true, yaw: .3, pitch: .1 };
  stepPractice(state, queue.sample(held)); const before = actor.shots;
  const dispatch = createPracticeWheelDispatch(queue, () => held);
  dispatch.dispatch('slot1');
  for (let index = 0; index < 100; index++) stepPractice(state, queue.sample(held));
  assert.equal(actor.inventoryIndex, 0); assert.equal(actor.shots, before); assert.equal(actor.meleeTicks, 0); assert.equal(actor.meleeIndex, 0); assert.notEqual(actor.meleeAction, 'secondary');
  assert.equal(held.fire, true); assert.equal(held.aim, true);
  queue.release('fire'); queue.release('aim'); stepPractice(state, queue.sample({}));
  queue.press('aim', held); stepPractice(state, queue.sample({ aim: true, yaw: .3, pitch: .1 }));
  assert.equal(actor.meleeAction, 'secondary', 'a genuinely new RMB press remains usable');
});

test('network wheel slot pulses preserve physical fire/aim and serialize a stale full-wrap finish', () => {
  const state = practiceFight(), actor = state.players[0], queue = createFpsInputQueue();
  const held = { fire: true, aim: true, yaw: .3, pitch: .1 };
  queue.observe(held, 0); stepPractice(state, queue.sample(held, 0).buttons); const before = actor.shots;
  const wheel = createWeaponWheelController();
  function send(action, now) { if (action) { queue.observe({ ...held, [action]: true }, now); queue.observe(held, now); } }
  for (let index = 0; index < 4; index++) send(consume(wheel, actor, 120, index).action, index);
  send(wheel.flush(actor, 24), 24);
  for (let index = 0; index < 20; index++) stepPractice(state, queue.sample(held, 25 + index).buttons);
  assert.equal(actor.inventoryIndex, 1); assert.equal(actor.shots, before); assert.equal(actor.meleeTicks, 0); assert.equal(actor.parryTicks, 0);
  assert.equal(held.fire, true); assert.equal(held.aim, true);
  assert.equal(queue.inspect().pending.length, 0);
});
