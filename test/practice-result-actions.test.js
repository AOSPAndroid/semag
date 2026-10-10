import test from 'node:test';
import assert from 'node:assert/strict';
import { createResultActionGate } from '../public/practice-result-actions.js';

test('results require a short cooldown and release of the finishing mouse click', () => {
  const gate = createResultActionGate();
  gate.press('mouse:0', 0); gate.begin(10);
  assert.equal(gate.isReady(2000), false);
  assert.equal(gate.nextDelay(2000), null);
  gate.release('mouse:0', 2000);
  assert.equal(gate.isReady(2249), false);
  assert.equal(gate.isReady(2250), true);
});

test('rapid clicks near the end of the cooldown extend the quiet interval', () => {
  const gate = createResultActionGate(); gate.begin(0);
  gate.press('mouse:0', 850); gate.release('mouse:0', 850);
  assert.equal(gate.isReady(900), false);
  assert.equal(gate.nextDelay(900), 200);
  assert.equal(gate.isReady(1099), false);
  assert.equal(gate.isReady(1100), true);
  // A new intentional button press after unlocking must still work.
  gate.press('mouse:0', 1110);
  assert.equal(gate.isReady(1110), true);
});

test('held touch or keyboard inputs cannot activate a result action', () => {
  const gate = createResultActionGate();
  gate.press('touch:2', 0); gate.press('key:Enter', 1); gate.begin(2);
  gate.release('touch:2', 1000); assert.equal(gate.isReady(1000), false);
  gate.release('key:Enter', 1000); assert.equal(gate.isReady(1249), false);
  assert.equal(gate.isReady(1250), true);
});

test('a mouse pointer fences disabled-button clicks even when MouseEvents are suppressed', () => {
  const gate = createResultActionGate(); gate.begin(0);
  gate.press('pointer:1', 850); gate.press('mouse:0', 850);
  assert.equal(gate.isReady(1600), false);
  // A disabled button may deliver only the final pointer release. Clearing
  // every mouse button prevents a suppressed mouseup from leaving it stuck.
  gate.release('pointer:1', 1600);
  for (let button = 0; button < 5; button++) gate.release(`mouse:${button}`, 1600);
  assert.equal(gate.nextDelay(1600), 250);
  // Duplicate or unrelated releases must not postpone the action again.
  gate.release('mouse:0', 1700); gate.release('pointer:99', 1700);
  assert.equal(gate.isReady(1849), false);
  assert.equal(gate.isReady(1850), true);
});

test('resetting a drill cancels its timer and gives the next result a fresh guard', () => {
  const gate = createResultActionGate(); gate.begin(0);
  assert.equal(gate.isReady(900), true); gate.cancel();
  assert.equal(gate.isReady(2000), false); assert.equal(gate.nextDelay(2000), null);
  gate.begin(3000); assert.equal(gate.isReady(3899), false);
  assert.equal(gate.isReady(3900), true);
});

test('focus loss clears missing input releases without bypassing the cooldown', () => {
  const gate = createResultActionGate(); gate.press('key:Space', 0); gate.begin(10);
  gate.clearHeld(); assert.equal(gate.isReady(500), false);
  assert.equal(gate.isReady(910), true);
});
