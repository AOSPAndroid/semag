import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blocksSoloShortcut, soloSessionShortcut, handShortcutIndex, createPressLatch,
} from '../public/solo/input-shortcuts.js';
import { createState as createParisState, step as stepParis, togglePause as pauseParis, FIXED_DT } from '../public/solo/paris-engine.js';

const event = (key, overrides = {}) => ({ key, code: key === 'Escape' ? 'Escape' : `Key${key.toUpperCase()}`, ...overrides });

test('solo session actions use P while leaving Escape to the browser', () => {
  for (const key of ['p', 'P']) assert.equal(soloSessionShortcut(event(key)), 'pause');
  assert.equal(soloSessionShortcut(event('Escape')), null);
  for (const key of ['r', 'R']) assert.equal(soloSessionShortcut(event(key)), 'restart');
  for (const key of ['w', 'z', 'q', 'a', 'c', 'e', ' ', 'Enter', 'Tab']) {
    assert.equal(soloSessionShortcut(event(key)), null, `Do not steal gameplay key ${key}`);
  }
  assert.equal(soloSessionShortcut({}), null);
  assert.equal(soloSessionShortcut(null), null);
});

test('held P pauses once and must be released before resuming', () => {
  let paused = false;
  const dispatch = input => {
    if (soloSessionShortcut(input) === 'pause') paused = !paused;
  };
  dispatch(event('p'));
  assert.equal(paused, true);
  for (let index = 0; index < 20; index += 1) dispatch(event('p', { repeat: true }));
  assert.equal(paused, true);
  dispatch(event('p'));
  assert.equal(paused, false);
});

test('pause, restart and hand actions preserve browser shortcuts and consumed events', () => {
  for (const flag of ['defaultPrevented', 'repeat', 'isComposing', 'ctrlKey', 'metaKey', 'altKey']) {
    for (const key of ['Escape', 'p', 'r']) {
      assert.equal(soloSessionShortcut(event(key, { [flag]: true })), null, `${flag}/${key}`);
    }
    assert.equal(handShortcutIndex(event('&', { code: 'Digit1', [flag]: true }), 9), null, flag);
  }
  // Shift is part of ordinary typing on French keyboards, not a browser shortcut.
  assert.equal(handShortcutIndex(event('1', { code: 'Digit1', shiftKey: true }), 9), 0);
});

test('focused typing and help cannot trigger session or hand actions', () => {
  const selectors = [];
  const target = { closest(selector) { selectors.push(selector); return this; } };
  for (const key of ['Escape', 'p', 'r']) assert.equal(soloSessionShortcut(event(key, { target })), null);
  assert.equal(handShortcutIndex(event('&', { code: 'Digit1', target }), 9), null);
  assert.equal(blocksSoloShortcut(event('Escape', { target })), true);
  for (const selector of selectors) {
    assert.ok(selector.includes('[contenteditable]:not([contenteditable="false"])'));
    assert.ok(selector.includes('#solo-how-to'));
    assert.ok(selector.includes('summary'));
  }
  const playfield = { closest: () => null };
  assert.equal(soloSessionShortcut(event('p', { target: playfield })), 'pause');
  assert.equal(soloSessionShortcut(event('Escape', { target: playfield })), null);
});

test('unshifted AZERTY number-row shortcuts select the same cards and heroes', () => {
  const frenchSymbols = ['&', 'é', '"', "'", '(', '-', 'è', '_', 'ç'];
  for (const [index, key] of frenchSymbols.entries()) {
    const input = event(key, { code: `Digit${index + 1}` });
    assert.equal(handShortcutIndex(input, 9), index);
    assert.equal(handShortcutIndex(input, 3), index < 3 ? index : null);
    assert.equal(handShortcutIndex(event(String(index + 1), { code: `Digit${index + 1}` }), 9), index);
    assert.equal(handShortcutIndex(event(String(index + 1), { code: `Numpad${index + 1}` }), 9), index);
  }
});

test('number-row shortcuts are bounded and never convert unrelated symbols into cards', () => {
  for (const input of [event('0', { code: 'Digit0' }), event('&'), event('x'), event('Enter'), {}, null]) {
    assert.equal(handShortcutIndex(input, 9), null);
  }
  assert.equal(handShortcutIndex(event('1', { code: 'Digit1' }), 0), null);
  assert.equal(handShortcutIndex({ code: 'Digit3' }, 3), 2);
  assert.equal(handShortcutIndex({ key: '2' }, 3), 1);
});

test('held gameplay input can keep tracked repeats without bypassing typing and Help guards', () => {
  const held = { allowRepeat: true };
  assert.equal(blocksSoloShortcut(event('c', { repeat: true }), held), false);
  assert.equal(blocksSoloShortcut(event('w', { repeat: true }), held), false);
  assert.equal(blocksSoloShortcut(event('c', { repeat: true })), true);
  for (const flag of ['defaultPrevented', 'isComposing', 'ctrlKey', 'metaKey', 'altKey']) {
    assert.equal(blocksSoloShortcut(event('c', { repeat: true, [flag]: true }), held), true, flag);
  }
  const help = { closest: () => ({}) };
  assert.equal(blocksSoloShortcut(event('c', { target: help }), held), true);
  assert.equal(blocksSoloShortcut(event('e', { repeat: true, target: help }), held), true);
});

test('a short Paris bell tap survives render-only frames and rings on the next simulation step', () => {
  const state = createParisState({ difficulty: 'standard' });
  const press = createPressLatch();
  press.press();
  // Down/up can both happen before a post-resume frame accumulates FIXED_DT.
  assert.equal(state.tick, 0);
  assert.equal(state.events.some(event => event.type === 'bell'), false);
  stepParis(state, { bell: press.consume(false) }, FIXED_DT);
  assert.equal(state.events.filter(event => event.type === 'bell').length, 1);
  stepParis(state, { bell: press.consume(false) }, FIXED_DT);
  assert.equal(state.bellHeld, false);
  assert.equal(state.events.filter(event => event.type === 'bell').length, 1);
});

test('queued Paris taps neither bypass cooldown nor replay once it expires', () => {
  const state = createParisState({ difficulty: 'standard' });
  const press = createPressLatch();
  press.press();
  stepParis(state, { bell: press.consume() }, FIXED_DT);
  stepParis(state, { bell: false }, FIXED_DT);
  press.press();
  stepParis(state, { bell: press.consume() }, FIXED_DT);
  for (let tick = 0; tick < 160; tick += 1) stepParis(state, { bell: press.consume() }, FIXED_DT);
  assert.equal(state.bellCooldown, 0);
  assert.equal(state.events.filter(event => event.type === 'bell').length, 1);
  press.press();
  stepParis(state, { bell: press.consume() }, FIXED_DT);
  assert.equal(state.events.filter(event => event.type === 'bell').length, 2);
});

test('Paris held bells stay edge-triggered after a queued press is consumed', () => {
  const state = createParisState({ difficulty: 'standard' });
  const press = createPressLatch();
  press.press();
  for (let tick = 0; tick < 160; tick += 1) stepParis(state, { bell: press.consume(true) }, FIXED_DT);
  assert.equal(state.bellCooldown, 0);
  assert.equal(state.events.filter(event => event.type === 'bell').length, 1);
  stepParis(state, { bell: press.consume(false) }, FIXED_DT);
  press.press();
  stepParis(state, { bell: press.consume(true) }, FIXED_DT);
  assert.equal(state.events.filter(event => event.type === 'bell').length, 2);
});

test('Paris input resets discard pending taps before pause, layout changes and new rides', () => {
  const state = createParisState({ difficulty: 'standard' });
  const press = createPressLatch();
  press.press();
  press.reset();
  pauseParis(state);
  pauseParis(state);
  stepParis(state, { bell: press.consume() }, FIXED_DT);
  assert.equal(state.events.some(event => event.type === 'bell'), false);
  press.press();
  press.reset();
  const fresh = createParisState({ difficulty: 'standard' });
  stepParis(fresh, { bell: press.consume() }, FIXED_DT);
  assert.equal(fresh.events.some(event => event.type === 'bell'), false);
});
