import assert from 'node:assert/strict';
import test from 'node:test';
import { SHINOBI_EDGE_ACTIONS, createShinobiInputQueue, createShinobiMouseButtons } from '../public/shinobi-input.js';
import * as game from '../public/shinobi-engine.js';

function fight() {
  const state = game.createState(); game.startMatch(state);
  while (state.phase === 'countdown') game.step(state, [game.emptyInput(), game.emptyInput()]);
  Object.assign(state.fighters[0], { x: 400, y: 320 });
  Object.assign(state.fighters[1], { x: 600, y: 320 });
  return state;
}
function tick(state, queue, held = {}) {
  const input = queue.sample({ ...game.emptyInput(), ...held });
  game.step(state, [input, { ...game.emptyInput(), aimX: -1 }]);
  return input;
}
function tap(queue, action, aim) { assert.equal(queue.press(action, aim), true); queue.release(action); }
function attacks(state) { return state.events.filter(event => event.type === 'attack' && event.fighter === 0); }

test('a released quick tap waits for a real fixed step and commits exactly once', () => {
  const state = fight(), queue = createShinobiInputQueue(), before = state.tick;
  tap(queue, 'attack', { aimX: 1, aimY: 0 });
  assert.equal(state.tick, before); assert.equal(state.fighters[0].action, 'idle');
  tick(state, queue);
  assert.equal(state.fighters[0].action, 'light'); assert.equal(state.fighters[0].stamina, 100 - game.MOVES.light.cost);
  for (let index = 0; index < 120; index++) tick(state, queue);
  assert.equal(attacks(state).length, 1); assert.equal(state.fighters[0].action, 'idle');
});

test('three taps between frames retain all three real engine input edges', () => {
  const state = fight(), queue = createShinobiInputQueue();
  for (let index = 0; index < 3; index++) tap(queue, 'attack', { aimX: 1, aimY: 0 });
  const sampled = [];
  for (let index = 0; index < 6; index++) {
    const input = tick(state, queue); sampled.push(input.attack);
    assert.equal(state.fighters[0].previousInput.attack, input.attack);
  }
  assert.deepEqual(sampled, [true, false, true, false, true, false]);
  assert.equal(queue.inspect().pending.length, 0);
});

test('an attack captures normalized press-time aim before later mouse movement', () => {
  const state = fight(), queue = createShinobiInputQueue(), aim = { aimX: 3, aimY: 4 };
  tap(queue, 'heavy', aim); aim.aimX = -1; aim.aimY = 0;
  const input = tick(state, queue, { aimX: -1, aimY: 0 });
  assert.equal(input.aimX, .6); assert.equal(input.aimY, .8);
  assert.equal(state.fighters[0].action, 'heavy');
  assert.ok(Math.abs(state.fighters[0].actionFacing - Math.atan2(4, 3)) < 1e-12);
  tick(state, queue, { aimX: -1, aimY: 0 });
  assert.ok(Math.abs(state.fighters[0].actionFacing - Math.atan2(4, 3)) < 1e-12);
  assert.equal(state.fighters[0].aimX, -1, 'continuous aim may turn while a committed blade stays locked');
});

test('different queued actions keep their order and each distinct captured direction', () => {
  const queue = createShinobiInputQueue(), raw = { ...game.emptyInput(), attack: true, heavy: true, up: true, aimX: -1, aimY: 0 };
  queue.press('attack', { aimX: 0, aimY: -5 }); queue.press('heavy', { aimX: 10, aimY: 0 });
  const first = queue.sample(raw), second = queue.sample(raw);
  assert.equal(first.attack, true); assert.equal(first.heavy, false); assert.equal(first.up, true);
  assert.equal(first.aimX, 0); assert.equal(first.aimY, -1);
  assert.equal(second.attack, true); assert.equal(second.heavy, true); assert.equal(second.up, true);
  assert.equal(second.aimX, 1); assert.equal(second.aimY, 0);
});

test('holding a sampled action never creates an automatic new attack after recovery', () => {
  const state = fight(), queue = createShinobiInputQueue(), start = state.fighters[0].y;
  queue.press('attack', { aimX: 1, aimY: 0 });
  for (let index = 0; index < 90; index++) {
    const input = tick(state, queue, { attack: true, up: true });
    assert.equal(input.attack, true); assert.equal(input.up, true);
  }
  assert.equal(attacks(state).length, 1); assert.ok(state.fighters[0].y < start - 30);
  // Release and repress can both happen between these sampled steps.
  queue.release('attack'); queue.press('attack', { aimX: 1, aimY: 0 });
  assert.equal(tick(state, queue, { attack: true }).attack, false);
  assert.equal(tick(state, queue, { attack: true }).attack, true);
  assert.equal(attacks(state).length, 2);
});

test('held countdown controls stay blocked after the bell until a genuine release', () => {
  const state = game.createState(), queue = createShinobiInputQueue(); game.startMatch(state);
  const held = { attack: true, dash: true, parry: true, feint: true, right: true };
  queue.reset({ held });
  assert.equal(queue.press('attack', { aimX: 1, aimY: 0 }), false);
  while (state.phase === 'countdown') tick(state, queue, held);
  for (let index = 0; index < 6; index++) tick(state, queue, held);
  assert.equal(state.fighters[0].action, 'run'); assert.equal(state.fighters[0].stamina, 100);
  assert.equal(attacks(state).length, 0);
  queue.release('attack'); tap(queue, 'attack', { aimX: 1, aimY: 0 });
  tick(state, queue, held);
  assert.equal(state.fighters[0].action, 'light'); assert.equal(attacks(state).length, 1);
  assert.equal(state.fighters[0].previousInput.dash, false);
});

test('reset clears focus-loss taps and a neutral resume step preserves only new presses', () => {
  const state = fight(), queue = createShinobiInputQueue();
  queue.press('attack'); tick(state, queue, { attack: true });
  for (let index = 0; index < 90; index++) tick(state, queue, { attack: true });
  tap(queue, 'dash'); tap(queue, 'throw');
  queue.reset({ neutral: true });
  tap(queue, 'attack', { aimX: 0, aimY: 1 });
  assert.equal(tick(state, queue).attack, false, 'resume clears the old real engine held-input fence first');
  assert.equal(attacks(state).length, 1); assert.equal(state.fighters[0].kunai, game.KUNAI.capacity);
  tick(state, queue);
  assert.equal(attacks(state).length, 2); assert.equal(state.fighters[0].actionFacing, Math.PI / 2);
  assert.ok(!state.events.some(event => event.type === 'dash' || event.type === 'throw'));
});

test('render previews and copied diagnostics cannot consume or mutate queued presses', () => {
  const state = fight(), queue = createShinobiInputQueue();
  tap(queue, 'heavy', { aimX: 0, aimY: -1 });
  const before = queue.inspect(), raw = Object.freeze({ ...game.emptyInput(), left: true });
  for (const hz of [60, 120, 144, 240]) for (let index = 0; index < hz; index++) queue.preview(raw);
  const copy = queue.inspect(); copy.pending[0].aim.aimY = 1; copy.pending.length = 0; copy.blocked.push('heavy');
  assert.deepEqual(queue.inspect(), before); assert.equal(state.fighters[0].action, 'idle');
  tick(state, queue, raw);
  assert.equal(state.fighters[0].action, 'heavy'); assert.equal(state.fighters[0].actionFacing, -Math.PI / 2);
});

test('reset fences also mask read-only previews without consuming the neutral step', () => {
  const queue = createShinobiInputQueue(); queue.reset({ held: { parry: true }, neutral: true });
  const raw = { parry: true, dash: true, left: true, aimX: 1, aimY: 0 };
  for (let index = 0; index < 10; index++) assert.deepEqual(queue.preview(raw), { ...raw, attack: false, heavy: false, throw: false, parry: false, dash: false, feint: false });
  assert.equal(queue.inspect().neutral, true);
  queue.sample(raw); assert.equal(queue.preview(raw).dash, true); assert.equal(queue.preview(raw).parry, false);
  queue.release('parry'); assert.equal(queue.preview(raw).parry, true);
});

test('pending edges are bounded and invalid aim falls back to current continuous aim', () => {
  const queue = createShinobiInputQueue();
  assert.equal(queue.press('unknown'), false);
  for (let index = 0; index < 100; index++) assert.equal(queue.press('attack', { aimX: NaN, aimY: 1 }), index < 16);
  assert.equal(queue.inspect().pending.length, 16);
  let edges = 0;
  for (let index = 0; index < 33; index++) {
    const input = queue.sample({ attack: false, aimX: 0, aimY: 1 });
    if (input.attack) edges++;
    assert.equal(input.aimX, 0); assert.equal(input.aimY, 1);
  }
  assert.equal(edges, 16); assert.equal(queue.inspect().pending.length, 0);
});

test('feint uses the same short-tap queue and independent controllers never share input', () => {
  assert.ok(SHINOBI_EDGE_ACTIONS.includes('feint'));
  const first = createShinobiInputQueue(), second = createShinobiInputQueue({ actions: ['feint'] });
  tap(first, 'feint', { aimX: -1, aimY: 0 });
  assert.equal(second.press('attack'), false); assert.equal(second.sample({ feint: false }).feint, false);
  assert.equal(first.sample({ feint: false }).feint, true);
  assert.equal(first.sample({ feint: false }).feint, false);
  assert.equal(second.inspect().pending.length, 0);
});

test('a short late-recovery press keeps its original aim through the real combat buffer', () => {
  const state = fight(), queue = createShinobiInputQueue(), player = state.fighters[0];
  tap(queue, 'attack', { aimX: 1, aimY: 0 }); tick(state, queue);
  const duration = game.MOVES.light.startup + game.MOVES.light.active + game.MOVES.light.recovery;
  while (player.actionFrame < duration - 6) tick(state, queue);
  tap(queue, 'heavy', { aimX: 0, aimY: -1 }); tick(state, queue, { aimX: 1, aimY: 0 });
  assert.equal(player.action, 'light'); assert.equal(player.inputBuffer.action, 'heavy');
  for (let index = 0; index < 6 && player.action !== 'heavy'; index++) tick(state, queue, { aimX: -1, aimY: 0 });
  assert.equal(player.action, 'heavy'); assert.equal(player.actionFacing, -Math.PI / 2);
  assert.equal(player.aimX, -1, 'free mouse aim is current while committed buffered facing stays captured');
  assert.equal(attacks(state).length, 2);
});

test('a short feint tap cancels a real early heavy and never becomes a delayed strike', () => {
  const state = fight(), queue = createShinobiInputQueue(), player = state.fighters[0];
  tap(queue, 'heavy', { aimX: 1, aimY: 0 }); tick(state, queue);
  while (player.actionFrame < game.FEINT.startFrame - 1) tick(state, queue);
  tap(queue, 'feint', { aimX: 0, aimY: 1 }); tick(state, queue);
  assert.equal(player.action, 'feint'); assert.equal(player.actionFacing, 0, 'withdraw the already committed blade');
  assert.equal(player.stamina, 100 - game.MOVES.heavy.cost - game.FEINT.cost);
  assert.ok(state.events.some(event => event.type === 'feint' && event.fighter === 0));
  for (let index = 0; index < game.FEINT.duration + game.INPUT_BUFFER.ticks + 2; index++) tick(state, queue);
  assert.equal(player.action, 'idle'); assert.equal(attacks(state).length, 1);
  assert.equal(state.fighters[1].hp, 100);
});

test('a post-hit short cut chains in real combat while a pre-hit mashed edge cannot', () => {
  const confirmed = fight(), queue = createShinobiInputQueue(), player = confirmed.fighters[0];
  Object.assign(confirmed.fighters[1], { x: 450, y: 320 });
  tap(queue, 'attack', { aimX: 1, aimY: 0 }); tick(confirmed, queue);
  while (player.actionFrame < game.CHAIN.startFrame - 1) tick(confirmed, queue);
  assert.equal(player.hitConfirmed, true);
  tap(queue, 'attack', { aimX: 1, aimY: 0 }); tick(confirmed, queue);
  assert.equal(player.comboStep, 2); assert.equal(player.actionFrame, 0);
  assert.ok(confirmed.events.some(event => event.type === 'chain' && event.comboStep === 2));

  const mashed = fight(), mashedQueue = createShinobiInputQueue();
  Object.assign(mashed.fighters[1], { x: 450, y: 320 });
  tap(mashedQueue, 'attack', { aimX: 1, aimY: 0 }); tap(mashedQueue, 'attack', { aimX: 1, aimY: 0 });
  for (let index = 0; index < game.CHAIN.endFrame + 2; index++) tick(mashed, mashedQueue);
  assert.equal(mashed.fighters[0].hitConfirmed, true);
  assert.equal(attacks(mashed).length, 1);
  assert.ok(!mashed.events.some(event => event.type === 'chain'));
});

function mouseControls(queue) {
  const mouse = createShinobiMouseButtons();
  let held = mouse.read();
  return {
    event(method, args, aim = { aimX: 1, aimY: 0 }) {
      const next = mouse[method](...args);
      for (const action of ['attack', 'heavy']) {
        if (next[action] && !held[action]) queue.press(action, aim);
        if (!next[action] && held[action]) queue.release(action);
      }
      held = next;
      return { ...held };
    },
    reset() { held = mouse.reset(); queue.reset({ neutral: true }); },
    held: () => ({ ...held }),
  };
}

test('held mouse movement after a focus reset cannot invent a new real attack', () => {
  const state = fight(), queue = createShinobiInputQueue(), controls = mouseControls(queue);
  controls.event('down', [0, 1]); tick(state, queue, controls.held());
  assert.equal(attacks(state).length, 1);
  controls.reset();
  for (let index = 0; index < 90; index++) tick(state, queue, controls.held());
  for (let index = 0; index < 6; index++) {
    assert.deepEqual(controls.event('sync', [1]), { attack: false, heavy: false });
    tick(state, queue, controls.held());
  }
  assert.equal(attacks(state).length, 1); assert.equal(state.fighters[0].action, 'idle');
  controls.event('sync', [0]); controls.event('down', [0, 1]); tick(state, queue, controls.held());
  assert.equal(attacks(state).length, 2); assert.equal(state.fighters[0].action, 'light');
});

test('a fresh secondary press after focus never rearms an old held primary button', () => {
  const state = fight(), queue = createShinobiInputQueue(), controls = mouseControls(queue);
  controls.event('down', [0, 1]); controls.reset(); tick(state, queue, controls.held());
  assert.deepEqual(controls.event('down', [2, 3], { aimX: 0, aimY: -1 }), { attack: false, heavy: true });
  tick(state, queue, controls.held());
  assert.equal(state.fighters[0].action, 'heavy'); assert.equal(state.fighters[0].actionFacing, -Math.PI / 2);
  for (let index = 0; index < 6; index++) {
    assert.deepEqual(controls.event('sync', [3]), { attack: false, heavy: true });
    tick(state, queue, controls.held());
  }
  assert.deepEqual(attacks(state).map(event => event.action), ['heavy']);
});

test('a partial mouse chord release preserves a rapid heavy tap without duplicate edges', () => {
  const state = fight(), queue = createShinobiInputQueue(), controls = mouseControls(queue), player = state.fighters[0];
  controls.event('down', [0, 1]); controls.event('down', [0, 1]); tick(state, queue, controls.held());
  const duration = game.MOVES.light.startup + game.MOVES.light.active + game.MOVES.light.recovery;
  while (player.actionFrame < duration - 6) tick(state, queue, controls.held());
  controls.event('down', [2, 3], { aimX: 0, aimY: -1 });
  assert.deepEqual(controls.event('sync', [1]), { attack: true, heavy: false });
  // A partial lost-capture notification repeats the actual remaining bits.
  assert.deepEqual(controls.event('sync', [1]), { attack: true, heavy: false });
  assert.deepEqual(queue.inspect().pending.map(edge => edge.action), ['heavy']);
  tick(state, queue, controls.held());
  assert.equal(player.inputBuffer.action, 'heavy');
  for (let index = 0; index < 6 && player.action !== 'heavy'; index++) tick(state, queue, controls.held());
  assert.equal(player.action, 'heavy'); assert.equal(player.actionFacing, -Math.PI / 2);
  assert.deepEqual(attacks(state).map(event => event.action), ['light', 'heavy']);
  controls.event('sync', [0]);
  for (let index = 0; index < 90; index++) tick(state, queue, controls.held());
  assert.equal(attacks(state).length, 2);
});

test('normal final mouse up retains a short tap and cancellation discards it', () => {
  const state = fight(), queue = createShinobiInputQueue(), controls = mouseControls(queue);
  controls.event('down', [0, 1]); controls.event('sync', [0]);
  assert.deepEqual(queue.inspect().pending.map(edge => edge.action), ['attack']);
  tick(state, queue, controls.held()); assert.equal(attacks(state).length, 1);
  for (let index = 0; index < 90; index++) tick(state, queue, controls.held());
  controls.event('down', [2, 2]); controls.reset(); tick(state, queue, controls.held());
  for (let index = 0; index < 30; index++) tick(state, queue, controls.held());
  assert.equal(attacks(state).length, 1); assert.equal(state.fighters[0].action, 'idle');
});

test('mouse button snapshots are independent copies and sync cannot arm unknown buttons', () => {
  const mouse = createShinobiMouseButtons(), other = createShinobiMouseButtons();
  const snapshot = mouse.down(0, 1); snapshot.attack = false; snapshot.heavy = true;
  assert.deepEqual(mouse.read(), { attack: true, heavy: false });
  assert.deepEqual(other.sync(3), { attack: false, heavy: false });
  assert.deepEqual(mouse.down(1, 5), { attack: true, heavy: false });
  assert.deepEqual(mouse.sync(3), { attack: true, heavy: false });
  assert.deepEqual(mouse.sync(0), { attack: false, heavy: false });
  for (const buttons of [NaN, Infinity, -1, 1.5, '1', null]) {
    mouse.down(0, 1); assert.deepEqual(mouse.sync(buttons), { attack: false, heavy: false });
  }
});
