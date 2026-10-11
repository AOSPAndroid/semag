import test from 'node:test';
import assert from 'node:assert/strict';
import { createState as createEmber, step as stepEmber } from '../public/solo/ember-engine.js';
import { emberRunSummary } from '../public/solo/ember-view.js';
import { createState as createWilds, step as stepWilds, serialize, restore, FIXED_STEP, DAY_SECONDS } from '../public/voxel-survival-engine.js';
import { createWildsDawnTracker, wildsExpeditionSummary } from '../public/solo/survival-view.js';

const summary = rows => Object.fromEntries(rows);

test('Ember summary retains actual partial counters and counts a defeated keeper before its adds die', () => {
  const state = createEmber({ seed: 42, difficulty: 'veteran' });
  assert.equal(summary(emberRunSummary(state)).KEEPERS, '0/3');
  state.act = 2; state.depth = 4; state.room.kind = 'boss';
  state.enemies = [{ ...state.enemies[0], boss: true, hp: 0 }, { ...state.enemies[1], boss: false, hp: 30 }];
  stepEmber(state);
  assert.equal(state.room.cleared, false);
  const result = summary(emberRunSummary(state));
  assert.equal(result.KEEPERS, '2/3');
  assert.equal(result.CHAMBERS, `${state.roomsCleared}/12`);
  assert.equal(result.FALLEN, state.kills);
  assert.equal(result.GOLD, state.gold);
  assert.equal(result.DESCENT, 'Veteran');
  assert.equal(result.RELICS, 0);
  assert.equal(Object.hasOwn(result, 'DAMAGE'), false, 'Untracked cumulative damage must not be invented.');
});

test('accepted final Ember gate yields completed chambers and keeper counters without changing the result', () => {
  const state = createEmber({ seed: 77 });
  state.act = 3; state.depth = 4; state.roomsCleared = 11; state.room.kind = 'boss';
  state.enemies = []; state.player.x = state.room.exit.x; state.player.y = state.room.exit.y;
  stepEmber(state, { interact: true });
  assert.equal(state.phase, 'won'); assert.equal(state.roomsCleared, 12);
  const before = structuredClone(state), result = summary(emberRunSummary(state));
  assert.equal(result.KEEPERS, '3/3'); assert.equal(result.CHAMBERS, '12/12');
  assert.equal(result.SCORE, state.score.toLocaleString()); assert.deepEqual(state, before);
});

function beforeDawn(seed = 99) {
  const state = createWilds({ seed });
  state.time = DAY_SECONDS - FIXED_STEP / 2; state.elapsed = state.time - 30;
  state.day = 1; state.night = true; state.spawnTimer = 10; state.enemies = [];
  return state;
}

test('Wilds milestone fires once only after the engine accepts dawn and increments survived nights', () => {
  const state = beforeDawn(), tracker = createWildsDawnTracker(state);
  assert.equal(tracker.observe(state), null);
  stepWilds(state, {}, FIXED_STEP);
  assert.equal(state.phase, 'playing'); assert.equal(state.stats.nights, 1);
  assert.deepEqual(tracker.observe(state), { night: 1, day: 2, nights: 1 });
  assert.equal(tracker.observe(state), null);
  stepWilds(state, {}, FIXED_STEP); assert.equal(tracker.observe(state), null);
});

test('restored Wilds dawn, paused worlds and deaths cannot replay or invent a milestone', () => {
  const state = beforeDawn(); stepWilds(state, {}, FIXED_STEP);
  const saved = restore(serialize(state)); assert.ok(saved);
  const restoredTracker = createWildsDawnTracker(saved);
  assert.equal(restoredTracker.observe(saved), null);
  const paused = beforeDawn(102), pausedTracker = createWildsDawnTracker(paused);
  paused.paused = true; stepWilds(paused, {}, FIXED_STEP);
  assert.equal(pausedTracker.observe(paused), null); assert.equal(paused.stats.nights, 0);
  const dead = beforeDawn(103), deadTracker = createWildsDawnTracker(dead);
  stepWilds(dead, {}, FIXED_STEP); dead.phase = 'dead'; dead.player.hp = 0;
  assert.equal(deadTracker.observe(dead), null);
});

test('Wilds expedition summary uses actual survival, building and combat counters', () => {
  const state = beforeDawn(); stepWilds(state, {}, FIXED_STEP);
  const before = structuredClone(state), result = summary(wildsExpeditionSummary(state));
  assert.deepEqual(result, {
    'TIME ALIVE': `${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}`,
    'NIGHTS SURVIVED': 1, 'CREATURES DEFEATED': state.stats.kills,
    'BLOCKS MINED': state.stats.mined, 'BLOCKS PLACED': state.stats.built, 'ITEMS CRAFTED': state.stats.crafted,
  });
  assert.deepEqual(state, before);
});
