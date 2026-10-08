import assert from 'node:assert/strict';
import test from 'node:test';
import { frameAlpha, frameDecay, tickFraction } from '../public/display-timing.js';

test('camera smoothing and reconciliation decay have equal wall-clock response at 60, 120, 144 and 240 Hz', () => {
  const duration = 350;
  for (const hz of [60, 120, 144, 240]) {
    const count = Math.ceil(hz * duration / 1000), delta = duration / count;
    let smoothed = 0, correction = 12;
    for (let frame = 0; frame < count; frame++) {
      smoothed += (1 - smoothed) * frameAlpha(.18, delta);
      correction *= frameDecay(.72, delta);
    }
    assert.ok(Math.abs(smoothed - (1 - .82 ** (duration * .06))) < 1e-12, `${hz}: camera speed is independent of display rate`);
    assert.ok(Math.abs(correction - 12 * .72 ** (duration * .06)) < 1e-12, `${hz}: correction fades at the same speed`);
  }
});

test('timing weights retain the existing 60 Hz feel and ignore zero or invalid elapsed time safely', () => {
  assert.ok(Math.abs(frameAlpha(.3) - .3) < 1e-12);
  assert.ok(Math.abs(frameDecay(.72) - .72) < 1e-12);
  assert.equal(frameAlpha(.3, 0), 0);
  assert.equal(frameDecay(.72, 0), 1);
  assert.equal(frameAlpha(1, 0), 0);
  assert.equal(frameAlpha(1, 1), 1);
  assert.equal(frameAlpha(.3, -1), 0);
  assert.equal(frameDecay(.72, -1), 1);
  assert.equal(frameAlpha(NaN, 10), 0);
  assert.equal(frameDecay(NaN, 10), 1);
  assert.ok(Math.abs(frameAlpha(.3, Infinity) - .3) < 1e-12);
  assert.equal(frameAlpha(.3, 1000), frameAlpha(.3, 100));
});

test('presentation samples all between-tick fractions without changing a fixed simulation clock', () => {
  const step = 1 / 120;
  let ticks = 0, accumulator = 0;
  const samples = [];
  for (let frame = 0; frame < 240; frame++) {
    accumulator += 1 / 240;
    while (accumulator + 1e-12 >= step) { accumulator -= step; ticks++; }
    samples.push(tickFraction(accumulator, step));
  }
  assert.equal(ticks, 120, '240 render samples still produce exactly 120 physics steps');
  assert.equal(samples.filter(value => Math.abs(value - .5) < 1e-9).length, 120, 'intervening frames have a usable half-tick sample');
  assert.equal(tickFraction(-1), 0);
  assert.equal(tickFraction(1), 1);
  assert.equal(tickFraction(NaN), 0);
  assert.equal(tickFraction(step / 2, 0), .5);
});
