import test from 'node:test';
import assert from 'node:assert/strict';
import { breachMatchResult } from '../public/voxel-client.js';
import { royaleMatchResult } from '../public/voxel-royale-client.js';
import { createEndPresentation } from '../public/voxel-end-presentation.js';
import { createRoyaleRewardPresenter } from '../public/voxel-royale-reward.js';
import { createResultActionGate } from '../public/practice-result-actions.js';

const players = [
  { id: 0, team: 0, kills: 5, deaths: 2, damageDealt: 1097.4, shots: 41 },
  { id: 1, team: 0, kills: 6, deaths: 1, damageDealt: 989.8, shots: 34 },
  { id: 2, team: 1, kills: 9, deaths: 4, damageDealt: 1300, shots: 49 },
  { id: 3, team: 1, kills: 0, deaths: 2, damageDealt: 54, shots: 11 },
];

test('Breach celebrates authoritative winning team zero and preserves its real score and personal totals', () => {
  const state = { winner: 0, scores: [4, 2], mapName: 'Connected Rooftops', players: structuredClone(players) };
  const before = structuredClone(state), result = breachMatchResult(state, 0);
  assert.equal(result.won, true); assert.equal(result.winner, 0); assert.equal(result.team, 0);
  assert.deepEqual(result.scores, [4, 2]); assert.equal(result.kills, 5); assert.equal(result.deaths, 2);
  assert.equal(result.damage, 1097); assert.equal(result.shots, 41); assert.equal(result.map, 'Connected Rooftops');
  assert.deepEqual(result.rows.map(row => row.id), [1, 0, 2, 3]);
  assert.equal(result.rows.find(row => row.id === 0).self, true);
  assert.deepEqual(state, before);
});

test('Breach high kills cannot turn a loss, missing player or unassigned winner into a victory', () => {
  const state = { winner: 0, scores: [4, 2], players };
  assert.equal(breachMatchResult(state, 2).won, false);
  assert.equal(breachMatchResult(state, 99).won, false);
  assert.equal(breachMatchResult({ ...state, winner: null }, 0).won, false);
  assert.equal(breachMatchResult({ ...state, winner: undefined }, undefined).won, false);
  assert.equal(breachMatchResult({ ...state, winner: 1 }, 2).won, true);
});

test('Royale winner player zero is a real win and standings exclude empty capacity seats', () => {
  const state = { winnerId: 0, winner: 0, participantIds: [0, 2, 3], players, placements: [
    { playerId: 3, place: 3 }, { playerId: 2, place: 2 }, { playerId: 0, place: 1 },
  ], matchTicks: 120 * 137, mapName: 'Forest Canopy' };
  const before = structuredClone(state), result = royaleMatchResult(state, 0);
  assert.equal(result.won, true); assert.equal(result.winner, 0); assert.equal(result.place, 1);
  assert.equal(result.total, 3); assert.equal(result.time, '2:17'); assert.equal(result.kills, 5);
  assert.deepEqual(result.rows.map(row => [row.id, row.place]), [[0, 1], [2, 2], [3, 3]]);
  assert.deepEqual(state, before);
});

test('Royale standings preserve a loser’s recorded rank instead of deriving it from kills', () => {
  const state = { winnerId: 0, participantIds: [0, 2, 3], players,
    placements: [{ playerId: 2, place: 3 }, { playerId: 3, place: 2 }, { playerId: 0, place: 1 }], matchTicks: 36000 };
  const result = royaleMatchResult(state, 2);
  assert.equal(result.won, false); assert.equal(result.place, 3); assert.equal(result.kills, 9);
  assert.equal(royaleMatchResult(state, 1).won, false);
  assert.equal(royaleMatchResult({ ...state, winnerId: null, winner: null }, 0).won, false);
});

test('invalid counters remain finite and never create an invented accuracy or headshot statistic', () => {
  const state = { winner: null, scores: [NaN, -1], participantIds: [0], players: [
    { id: 0, team: 0, kills: Infinity, deaths: -1, damageDealt: NaN, shots: undefined },
  ], matchTicks: Infinity };
  const breach = breachMatchResult(state, 0), royale = royaleMatchResult(state, 0);
  assert.deepEqual(breach.scores, [0, 0]);
  for (const field of ['kills', 'deaths', 'damage', 'shots']) assert.equal(breach[field], 0);
  assert.equal(royale.time, '0:00'); assert.equal(royale.place, null);
  assert.equal(Object.hasOwn(breach, 'accuracy'), false); assert.equal(Object.hasOwn(royale, 'headshots'), false);
});

test('online cosmetic victory follows the existing death tail and then arms only after physical release', () => {
  const death = createEndPresentation(), reward = createRoyaleRewardPresenter(), actions = createResultActionGate();
  const observe = (phase, now, won = true) => {
    const tail = death.observe(phase, now, { contextKey: 'map:1:4' });
    const reveal = reward.observe(phase, now, { contextKey: 'map:1:4', death: tail, won });
    return { death: tail, reveal, holding: tail.holding || reveal.holding };
  };
  observe('fight', 0); actions.press('mouse:0', 20);
  assert.equal(observe('matchEnd', 30).reveal.stage, 'death');
  assert.equal(observe('matchEnd', 1130).reveal.stage, 'victory');
  assert.equal(observe('matchEnd', 2979).holding, true);
  assert.equal(observe('matchEnd', 2980).holding, false);
  actions.begin(2980); assert.equal(actions.isReady(5000), false);
  actions.release('mouse:0', 5000); assert.equal(actions.isReady(5249), false);
  assert.equal(actions.isReady(5250), true);
});

test('terminal reconnect, losses and auto-advancing intermediate rounds cannot replay a match celebration', () => {
  const tail = createEndPresentation(), reward = createRoyaleRewardPresenter();
  const observe = (phase, now, won = true) => reward.observe(phase, now, {
    contextKey: 'map:7:4', death: tail.observe(phase, now, { contextKey: 'map:7:4' }), won,
  });
  assert.equal(observe('matchEnd', 0).holding, false);
  tail.reset(); reward.reset(); observe('fight', 10);
  assert.equal(observe('roundEnd', 20).stage, 'idle');
  assert.equal(observe('matchEnd', 30).visible, false);
  tail.reset(); reward.reset(); observe('fight', 40);
  assert.equal(observe('matchEnd', 50, false).stage, 'death');
  assert.equal(observe('matchEnd', 1150, false).stage, 'results');
});
