import assert from 'node:assert/strict';
import test from 'node:test';
import { createNetworkTimeline } from '../public/network-timeline.js';

test('network samples use simulation ticks, reject stale ticks, and reset at a new match identity', () => {
  const timeline = createNetworkTimeline({ snapshotTicks: 4 });
  const state = { tick: 120, phase: 'fight' };
  const sample = timeline.sample(state, 1042, 'map:1:fight');
  assert.equal(sample.time, 1000);
  assert.equal(sample.receivedAt, 1042);
  assert.equal(sample.state, state, 'clock does not clone or change authoritative gameplay');
  assert.equal(timeline.sample({ tick: 119 }, 1045, 'map:1:fight'), null);
  assert.equal(timeline.sample({ tick: 120 }, 1048, 'map:1:fight').time, 1000);
  assert.equal(timeline.getState().offsetMs, 42, 'repeated Ready broadcasts do not shift the clock');
  timeline.sample({ tick: 0 }, 2000, 'map:2:fight');
  assert.equal(timeline.getState().latestTick, 0);
  assert.ok(timeline.time(2000) < 0, 'new matches do not interpolate from the old match');
  timeline.reset();
  assert.equal(timeline.time(2010), null);
});

for (const snapshotTicks of [2, 4]) for (const hz of [60, 120, 144, 240]) {
  test(`${hz} Hz playback stays monotonic with jittered ${120 / snapshotTicks} Hz packets`, () => {
    const timeline = createNetworkTimeline({ snapshotTicks });
    const interval = snapshotTicks * 1000 / 120;
    const arrivals = Array.from({ length: Math.ceil(4000 / interval) }, (_, index) => ({
      tick: index * snapshotTicks, time: index * interval + 10 + [0, 8, 20, 3][index % 4],
    }));
    let index = 0, previous;
    for (let frame = 0; frame < 4 * hz; frame++) {
      const now = frame * 1000 / hz;
      while (index < arrivals.length && arrivals[index].time <= now) {
        const packet = arrivals[index++]; timeline.sample({ tick: packet.tick }, packet.time, 'fight');
      }
      const cursor = timeline.time(now);
      if (cursor === null) continue;
      if (previous !== undefined) {
        assert.ok(cursor >= previous, 'late packets cannot move the presentation clock backward');
        if (now > 500 && now < 3900) {
          const rate = (cursor - previous) / (1000 / hz);
          assert.ok(rate >= .9399 && rate <= 1.0601, `playback rate ${rate}`);
        }
      }
      assert.ok(cursor <= timeline.getState().latestTime + 25 + 1e-8);
      previous = cursor;
    }
    const timing = timeline.getState();
    assert.ok(timing.bufferMs >= (snapshotTicks === 4 ? 40 : 20));
    assert.ok(timing.bufferMs <= (snapshotTicks === 4 ? 55 : 35));
  });
}

test('a packet outage stops bounded extrapolation and never rewinds on recovery', () => {
  const timeline = createNetworkTimeline({ snapshotTicks: 4, maxExtrapolationMs: 25 });
  timeline.sample({ tick: 120 }, 1010, 'fight');
  assert.equal(timeline.time(5000), 1025);
  assert.equal(timeline.time(6000), 1025);
  assert.equal(timeline.currentTime(6000), 1250, 'local clock also has a bounded prediction horizon');
  timeline.sample({ tick: 724 }, 6045, 'fight');
  assert.ok(timeline.time(6045) >= 1025);
  assert.ok(timeline.time(6045) <= 724 * 1000 / 120 + 25);
});

test('offset changes converge through playback rate instead of position jumps', () => {
  const timeline = createNetworkTimeline({ snapshotTicks: 4 });
  timeline.sample({ tick: 0 }, 40, 'fight');
  let last = timeline.time(40);
  for (let index = 1; index <= 90; index++) {
    const now = index * 1000 / 30 + 10;
    timeline.sample({ tick: index * 4 }, now, 'fight');
    const cursor = timeline.time(now);
    assert.ok(cursor >= last);
    assert.ok(timeline.getState().playbackRate >= .94 && timeline.getState().playbackRate <= 1.06);
    last = cursor;
  }
  assert.ok(timeline.getState().offsetMs < 10.02);
  const copy = timeline.getState(); copy.latestTick = -10;
  assert.equal(timeline.getState().latestTick, 360, 'diagnostics cannot mutate the clock');
});

test('a hidden display resumes near the live simulation instead of replaying the hidden interval', () => {
  const timeline = createNetworkTimeline({ snapshotTicks: 4 });
  timeline.sample({ tick: 0 }, 10, 'fight');
  timeline.time(10);
  for (let index = 1; index <= 90; index++) timeline.sample({ tick: index * 4 }, index * 1000 / 30 + 10, 'fight');
  const resumed = timeline.time(3010);
  assert.ok(resumed >= 2945 && resumed <= 3000);
  assert.equal(timeline.getState().playbackRate, 1);
});
