import assert from 'node:assert/strict';
import test from 'node:test';
import { createEndPresentation, END_PRESENTATION_RULES } from '../public/voxel-end-presentation.js';

const options = { contextKey: 'courtyard:match-4:round-2' };
const idle = { holding: false, started: false, finished: false, remainingMs: 0 };

test('the accepted final phase gets a bounded cosmetic tail and one completion edge', () => {
  for (const phase of ['roundEnd', 'matchEnd']) {
    const present = createEndPresentation();
    assert.deepEqual(present.observe('fight', 20, options), idle);
    assert.deepEqual(present.observe(phase, 40, options), { holding: true, started: true, finished: false, remainingMs: END_PRESENTATION_RULES.durationMs });
    assert.deepEqual(present.observe(phase, 1139, options), { holding: true, started: false, finished: false, remainingMs: 1 });
    assert.deepEqual(present.observe(phase, 1140, options), { holding: false, started: false, finished: true, remainingMs: 0 });
    assert.deepEqual(present.observe(phase, 1140, options), idle);
    assert.deepEqual(present.observe(phase, 2000, options), idle);
  }
});

test('repeated snapshots and roundEnd to matchEnd do not restart a death tail', () => {
  const present = createEndPresentation(); present.observe('fight', 0, options);
  present.observe('roundEnd', 100, options);
  for (const time of [100, 150, 500, 1000]) assert.equal(present.observe('roundEnd', time, options).remainingMs, 1200 - time);
  assert.deepEqual(present.observe('matchEnd', 1150, options), { holding: true, started: false, finished: false, remainingMs: 50 });
  assert.equal(present.observe('matchEnd', 1200, options).finished, true);
});

test('a fresh or reconnect terminal snapshot exposes its result immediately', () => {
  for (const phase of ['roundEnd', 'matchEnd']) {
    const present = createEndPresentation();
    assert.deepEqual(present.observe(phase, 300, options), idle);
    present.observe('fight', 310, options); present.reset();
    assert.deepEqual(present.observe(phase, 320, options), idle);
    assert.equal(present.inspect().deadline, null);
  }
});

test('lobby, countdown, buy, pause and intermission transitions cannot manufacture a final kill', () => {
  for (const prior of ['lobby', 'countdown', 'buy', 'paused', 'intermission']) {
    const present = createEndPresentation(); present.observe(prior, 0, options);
    assert.deepEqual(present.observe('matchEnd', 10, options), idle);
  }
});

test('new map, match or round context cancels a hold without replaying history', () => {
  for (const contextKey of ['dojo:match-4:round-2', 'courtyard:match-5:round-2', 'courtyard:match-4:round-3']) {
    const present = createEndPresentation(); present.observe('fight', 0, options); present.observe('roundEnd', 100, options);
    assert.deepEqual(present.observe('matchEnd', 200, { contextKey }), idle);
    assert.equal(present.inspect().deadline, null);
    assert.deepEqual(present.observe('matchEnd', 300, { contextKey }), idle);
  }
});

test('ineligible gameplay clears both a pending hold and its fight priming', () => {
  const present = createEndPresentation(); present.observe('fight', 0, options);
  assert.deepEqual(present.observe('matchEnd', 10, { ...options, eligible: false }), idle);
  assert.deepEqual(present.observe('matchEnd', 20, options), idle);
  present.observe('fight', 30, options); assert.equal(present.observe('matchEnd', 40, options).holding, true);
  assert.deepEqual(present.observe('matchEnd', 50, { ...options, eligible: false }), idle);
  assert.deepEqual(present.observe('matchEnd', 60, options), idle);
  present.observe('fight', 70, { ...options, eligible: false });
  assert.deepEqual(present.observe('matchEnd', 80, options), idle);
});

test('returning to live or setup phases clears the tail and allows the next genuine fight end', () => {
  const present = createEndPresentation(); present.observe('fight', 0, options); present.observe('roundEnd', 10, options);
  assert.deepEqual(present.observe('buy', 20, options), idle);
  assert.deepEqual(present.observe('fight', 30, options), idle);
  assert.equal(present.observe('roundEnd', 40, options).remainingMs, 1100);
});

test('reduced motion uses a shorter fixed deadline without changing an existing tail', () => {
  const present = createEndPresentation(); present.observe('fight', 0, options);
  assert.equal(present.observe('matchEnd', 100, { ...options, reducedMotion: true }).remainingMs, END_PRESENTATION_RULES.reducedDurationMs);
  assert.equal(present.observe('matchEnd', 499, options).holding, true);
  assert.equal(present.observe('matchEnd', 500, options).finished, true);
});

test('time reversal or invalid clocks clear a hold rather than extend it indefinitely', () => {
  const present = createEndPresentation(); present.observe('fight', 100, options); present.observe('matchEnd', 200, options);
  assert.deepEqual(present.observe('matchEnd', 150, options), idle);
  assert.deepEqual(present.observe('matchEnd', 160, options), idle);
  present.observe('fight', 170, options); present.observe('matchEnd', 180, options);
  assert.deepEqual(present.observe('matchEnd', NaN, options), idle);
  assert.deepEqual(present.observe('matchEnd', 190, options), idle);
});

test('presentation is independent of display refresh rate and cannot mutate accepted gameplay', () => {
  const state = Object.freeze({ phase: 'matchEnd', phaseTicks: 0, tick: 2340, winner: 0 });
  for (const hz of [30, 60, 144, 240]) {
    const present = createEndPresentation(); present.observe('fight', 0, options);
    present.observe(state.phase, 100, options);
    for (let frame = 1; frame / hz * 1000 < 1100; frame++) present.observe(state.phase, 100 + frame / hz * 1000, options);
    assert.equal(present.observe(state.phase, 1200, options).holding, false);
    assert.deepEqual(state, { phase: 'matchEnd', phaseTicks: 0, tick: 2340, winner: 0 });
  }
});
