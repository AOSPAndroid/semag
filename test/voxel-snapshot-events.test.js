import assert from 'node:assert/strict';
import test from 'node:test';
import { SNAPSHOT_EVENT_TICKS, SNAPSHOT_LONG_EVENT_TICKS, recentSnapshotEvents } from '../public/voxel-snapshot-events.js';
import { createBladeFeel } from '../public/voxel-blade-feel.js';

test('snapshots keep recent events and kills long enough for death poses, nothing older', () => {
  const tick = 1000, event = (type, age) => ({ id: tick - age, tick: tick - age, type });
  const events = [event('shot', SNAPSHOT_EVENT_TICKS + 1), event('shot', SNAPSHOT_EVENT_TICKS), event('kill', SNAPSHOT_LONG_EVENT_TICKS), event('kill', SNAPSHOT_LONG_EVENT_TICKS + 1), event('meleeHit', 0)];
  assert.deepEqual(recentSnapshotEvents({ tick, events }).map(e => [e.type, tick - e.tick]), [['shot', SNAPSHOT_EVENT_TICKS], ['kill', SNAPSHOT_LONG_EVENT_TICKS], ['meleeHit', 0]]);
  assert.ok(SNAPSHOT_LONG_EVENT_TICKS >= 240, 'human and monster death poses read kills for up to 240 ticks');
});

test('a cleave through many bodies kicks the camera once per swing', () => {
  const one = createBladeFeel(), many = createBladeFeel();
  one.sample(0); many.sample(0);
  const hit = targetId => ({ type: 'meleeHit', playerId: 0, targetId, damage: 40, weapon: 'sword', meleeIndex: 3, meleeStartTick: 90 });
  one.observe(hit(1), 0, 0);
  for (let target = 1; target <= 20; target++) many.observe(hit(target), 0, 0);
  assert.deepEqual(many.sample(0), one.sample(0));
});
