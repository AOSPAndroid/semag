import assert from 'node:assert/strict';
import test from 'node:test';
import { MELEE_WEAPONS } from '../public/voxel-melee.js';
import { createVoxelMeleeSamples, VOXEL_MELEE_AUDIO } from '../public/voxel-shot-audio.js';

const energy = (samples, rate, from, to) => {
  let total = 0, count = 0;
  for (let i = Math.floor(from * rate); i < Math.min(samples.length, to * rate); i++) { total += samples[i] ** 2; count++; }
  return Math.sqrt(total / Math.max(1, count));
};

test('every committed melee weapon has a distinct bounded quiet sweep with a silent attack and end', () => {
  assert.deepEqual(Object.keys(VOXEL_MELEE_AUDIO), Object.keys(MELEE_WEAPONS));
  const signatures = new Set();
  for (const id of Object.keys(MELEE_WEAPONS)) {
    const samples = createVoxelMeleeSamples(id), profile = VOXEL_MELEE_AUDIO[id];
    assert.ok(samples.every(Number.isFinite));
    assert.equal(samples[0], 0);
    assert.equal(samples.at(-1), 0);
    assert.ok(samples.length <= 48000 * .45);
    assert.ok(samples.every(sample => Math.abs(sample) < .55), 'a swing remains quieter than a firearm crack');
    const active = MELEE_WEAPONS[id].startupTicks / 120;
    assert.ok(energy(samples, 48000, active, active + .06) > energy(samples, 48000, 0, .025) * 8, `${id}: swoosh follows actual committed blade startup`);
    signatures.add(`${samples.length}:${energy(samples, 48000, profile.peak, profile.peak + .02)}`);
    assert.deepEqual(createVoxelMeleeSamples(id), samples, 'cached reports can be rebuilt deterministically');
  }
  assert.equal(signatures.size, 5);
});

test('melee samples accept normal device rates and reject malformed or unbounded synthesis requests', () => {
  for (const id of Object.keys(MELEE_WEAPONS)) for (const rate of [8000, 22050, 44100, 48000, 96000, 192000]) {
    const samples = createVoxelMeleeSamples(id, rate);
    assert.ok(samples.every(Number.isFinite));
    assert.equal(samples.at(-1), 0);
  }
  for (const id of [null, undefined, '__proto__', 'constructor', 'toString', 'missing']) assert.equal(createVoxelMeleeSamples(id), null);
  for (const rate of [NaN, Infinity, 0, 7999, 192001]) assert.equal(createVoxelMeleeSamples('katana', rate), null);
});
