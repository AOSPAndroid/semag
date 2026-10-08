import test from 'node:test';
import assert from 'node:assert/strict';
import { capturePlanarPose, presentNetworkPlanarFighter } from '../public/planar-presentation.js';
import { createNetworkTimeline } from '../public/network-timeline.js';

const state = (tick, x, patch = {}) => ({ tick, phase: 'fight', round: 1, stageId: 'garden', fighters: [{ id: 0, x: 0, y: 0, hp: 100 }, { id: 1, x, y: 0, hp: 100, action: 'run', ...patch }] });
const sample = source => ({ state: source, time: source.tick * 1000 / 120, pose: capturePlanarPose(source) });

test('fast Shinobi dashes remain buffered within their bounded distance without weakening default teleport guards', () => {
  const before = sample(state(10, 0)), after = sample(state(12, 18.4));
  const newest = state(18, 73.6, { hp: 25, action: 'dash', actionFrame: 7 });
  assert.equal(presentNetworkPlanarFighter(newest, before, after, 1, 11 * 1000 / 120).x, 73.6);
  const view = presentNetworkPlanarFighter(newest, before, after, 1, 11 * 1000 / 120, { maxDistance: 96 });
  assert.ok(Math.abs(view.x - 9.2) < 1e-8);
  assert.equal(view.hp, 25); assert.equal(view.action, 'dash'); assert.equal(view.actionFrame, 7);
  const teleport = state(18, 140);
  assert.deepEqual(presentNetworkPlanarFighter(teleport, before, after, 1, before.time, { maxDistance: 10000 }), teleport.fighters[1]);
  assert.deepEqual(presentNetworkPlanarFighter(newest, before, after, 1, before.time, { maxDistance: NaN }), newest.fighters[1]);
});

test('buffered remote transforms preserve latest health, action, timers and authoritative events', () => {
  const before = sample(state(10, 10)), after = sample(state(12, 12));
  const newest = state(14, 14, { hp: 22, action: 'hit', hitstun: 18, damageDealt: 53 });
  const original = structuredClone({ before, after, newest });
  const view = presentNetworkPlanarFighter(newest, before, after, 1, 11 * 1000 / 120);
  assert.ok(Math.abs(view.x - 11) < 1e-9);
  assert.equal(view.hp, 22); assert.equal(view.action, 'hit'); assert.equal(view.hitstun, 18); assert.equal(view.damageDealt, 53);
  assert.deepEqual({ before, after, newest }, original);
});

test('deaths, respawns, stocks, identity, rounds, maps and teleports bypass obsolete transform samples', () => {
  const before = sample(state(10, 10)), after = sample(state(12, 12));
  for (const patch of [{ hp: 0 }, { respawnTicks: 60 }, { stocks: 2 }, { id: 9 }, { characterId: 'new' }, { x: 200 }]) {
    const newest = state(14, 14, patch);
    assert.deepEqual(presentNetworkPlanarFighter(newest, before, after, 1, before.time), newest.fighters[1]);
  }
  for (const patch of [{ round: 2 }, { wave: 2 }, { stageId: 'gallery' }, { phase: 'roundEnd' }]) {
    const newest = { ...state(14, 14), ...patch };
    assert.deepEqual(presentNetworkPlanarFighter(newest, before, after, 1, before.time), newest.fighters[1]);
  }
});

test('invalid, reversed, missing and out-of-range samples stay finite and never overshoot', () => {
  const newest = state(14, 14), before = sample(state(10, 10)), after = sample(state(12, 12));
  assert.deepEqual(presentNetworkPlanarFighter(newest, null, after, 1, 1), newest.fighters[1]);
  assert.deepEqual(presentNetworkPlanarFighter(newest, before, after, 1, NaN), newest.fighters[1]);
  assert.equal(presentNetworkPlanarFighter(newest, before, after, 1, -100).x, 10);
  assert.equal(presentNetworkPlanarFighter(newest, before, after, 1, 10000).x, 12);
  assert.ok(Number.isFinite(presentNetworkPlanarFighter(newest, before, sample(state(12, NaN)), 1, 100).x));
  assert.deepEqual(presentNetworkPlanarFighter(newest, after, before, 1, 100), newest.fighters[1]);
});

test('2D multiplayer uses canonical tick time despite variable receipt delay at 60–240 Hz', () => {
  for (const hz of [60, 120, 144, 240]) {
    const clock = createNetworkTimeline({ tickRate: 120, snapshotTicks: 2 }), samples = [];
    const arrivals = Array.from({ length: 121 }, (_, n) => ({ source: state(n * 2, n), at: n * 1000 / 60 + [0, 8, 3, 12][n % 4] }));
    let next = 0, previous = -Infinity;
    for (let now = 0; now < 1950; now += 1000 / hz) {
      while (next < arrivals.length && arrivals[next].at <= now) {
        const { source, at } = arrivals[next++];
        const accepted = clock.sample(source, at, 'garden');
        samples.push({ ...accepted, pose: capturePlanarPose(source) });
      }
      if (samples.length < 2) continue;
      const target = clock.time(now);
      let before = samples[0], after = samples.at(-1);
      for (let i = 1; i < samples.length; i++) if (samples[i].time >= target) { before = samples[i - 1]; after = samples[i]; break; }
      const displayed = presentNetworkPlanarFighter(samples.at(-1).state, before, after, 1, target);
      assert.ok(displayed.x >= previous - 1e-8, `${hz} Hz never reverses steady forward motion`);
      assert.ok(displayed.x <= samples.at(-1).state.fighters[1].x, 'never paints ahead through unknown cover');
      previous = displayed.x;
    }
    assert.ok(previous > 110, `${hz} Hz playback keeps pace with the match`);
  }
});
