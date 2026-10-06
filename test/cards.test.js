import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_IDS, createState, startMatch, resetLobby, step, applyAction, viewForPlayer, cardTotal, canPlay,
} from '../public/cards-engine.js';

const card = (rank, suit = 0, id = `${rank}-${suit}`) => ({ id, rank, suit });
function seeded(seed = 1) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function advance(state, ticks) { for (let tick = 0; tick < ticks; tick += 1) step(state); }
function active(gameId, seed = 1) {
  const state = createState(gameId, { random: seeded(seed) });
  startMatch(state);
  advance(state, 240);
  return state;
}
function crazy(hands, deck = [], top = card(4, 0, 'top')) {
  const state = active('crazy-eights');
  Object.assign(state, { hands, deck, discard: [top], activeSuit: top.suit, turn: 0, drawn: [false, false], emptyPasses: 0 });
  return state;
}
function unchangedReject(state, player, action) {
  const before = JSON.stringify(state);
  const result = applyAction(state, player, action);
  assert.equal(result.ok, false);
  assert.equal(typeof result.error, 'string');
  assert.equal(JSON.stringify(state), before, 'rejected action must not mutate the state');
}
const apply = (state, player, action) => assert.deepEqual(applyAction(state, player, action), { ok: true });

test('each card game starts only after its two-second countdown and resets cleanly', () => {
  for (const gameId of GAME_IDS) {
    const state = createState(gameId, { random: seeded(10) });
    assert.equal(state.phase, 'lobby');
    unchangedReject(state, 0, { kind: 'stand' });
    startMatch(state);
    const revision = state.revision;
    advance(state, 239);
    assert.equal(state.phase, 'countdown');
    assert.equal(state.phaseTicks, 1);
    assert.equal(state.revision, revision);
    step(state);
    assert.equal(state.phase, 'fight');
    assert.equal(state.revision, revision + 1);
    advance(state, 100);
    assert.equal(state.revision, revision + 1, 'idle ticks do not change the action revision');
    state.scores[0] = 10;
    const tick = state.tick;
    resetLobby(state);
    assert.equal(state.tick, tick);
    assert.equal(state.phase, 'lobby');
    assert.deepEqual(state.scores, [0, 0]);
    assert.equal(state.winner, null);
    assert.equal(state.revision, revision + 2);
  }
});

test('state creation rejects unsupported modes and seeded deals are reproducible', () => {
  assert.throws(() => createState('poker'), /Unknown/);
  assert.throws(() => createState('memory', { random: 0 }), /random/);
  for (const gameId of GAME_IDS) {
    assert.deepEqual(createState(gameId, { random: seeded(17) }), createState(gameId, { random: seeded(17) }));
  }
});

test('rematches replace private deals and board ownership while preserving the tick clock', () => {
  for (const gameId of GAME_IDS) {
    const state = active(gameId, 27);
    const privateField = gameId === 'memory' ? 'board' : 'hands';
    const oldDeal = state[privateField];
    const oldContents = JSON.stringify(oldDeal);
    state.scores = [8, 3];
    state.winner = 0;
    state.result = 'win';
    state.phase = 'matchEnd';
    if (gameId === 'memory') {
      state.matched[0] = 0;
      state.revealed = [1];
      state.mismatchTicks = 100;
    }
    const tick = state.tick;
    startMatch(state);
    assert.equal(state.tick, tick);
    assert.equal(state.phase, 'countdown');
    assert.equal(state.phaseTicks, 240);
    assert.equal(state.round, 1);
    assert.equal(state.winner, null);
    assert.equal(state.result, null);
    assert.deepEqual(state.scores, [0, 0]);
    assert.notEqual(state[privateField], oldDeal);
    assert.notEqual(JSON.stringify(state[privateField]), oldContents);
    if (gameId === 'memory') {
      assert.deepEqual(state.matched, Array(32).fill(null));
      assert.deepEqual(state.revealed, []);
      assert.equal(state.mismatchTicks, 0);
    }
  }
});

test('all modes reject malformed, wrong-player, and stale actions without mutations', () => {
  for (const gameId of GAME_IDS) {
    const state = active(gameId);
    for (const action of [null, [], 'stand', { kind: 'nonsense' }, { kind: 'stand', revision: state.revision - 1 }]) {
      unchangedReject(state, 0, action);
    }
    unchangedReject(state, 2, { kind: 'stand' });
    unchangedReject(state, '0', { kind: 'stand' });
  }
});

test('Crazy Eights deals one unique standard deck, seven per hand, and a non-wild initial discard', () => {
  const state = createState('crazy-eights', { random: seeded(82) });
  assert.deepEqual(state.hands.map(hand => hand.length), [7, 7]);
  assert.equal(state.deck.length, 37);
  assert.equal(state.discard.length, 1);
  assert.notEqual(state.discard[0].rank, 8);
  const all = [...state.deck, ...state.hands.flat(), ...state.discard];
  assert.equal(new Set(all.map(value => value.id)).size, 52);
  assert.equal(new Set(all.map(value => `${value.rank}:${value.suit}`)).size, 52);
});

test('Crazy Eights matches ranks/suits and requires an explicit valid suit for a wild eight', () => {
  const state = crazy([[card(8, 1), card(9, 2)], [card(5, 3)]]);
  assert.equal(canPlay(card(4, 3), state.discard[0], 0), true);
  assert.equal(canPlay(card(2, 0), state.discard[0], 0), true);
  assert.equal(canPlay(card(8, 2), state.discard[0], 0), true);
  assert.equal(canPlay(card(2, 1), state.discard[0], 0), false);
  unchangedReject(state, 1, { kind: 'play', cardId: '5-3' });
  unchangedReject(state, 0, { kind: 'play', cardId: '9-2' });
  for (const suit of [undefined, null, -1, 4, 1.5, '2']) unchangedReject(state, 0, { kind: 'play', cardId: '8-1', suit });
  apply(state, 0, { kind: 'play', cardId: '8-1', suit: 3 });
  assert.equal(state.activeSuit, 3);
  assert.equal(state.turn, 1);
  assert.equal(state.discard.at(-1).rank, 8);
  apply(state, 1, { kind: 'play', cardId: '5-3' });
  assert.equal(state.phase, 'matchEnd');
  assert.equal(state.winner, 1);
  assert.deepEqual(state.scores, [0, 1]);
  unchangedReject(state, 0, { kind: 'play', cardId: '9-2' });
});

test('Crazy Eights draw is restricted, drawn cards can be played, and passing requires a draw', () => {
  const playable = crazy([[card(4, 1), card(2, 3)], [card(5, 3)]], [card(3, 2)]);
  unchangedReject(playable, 0, { kind: 'draw' });
  unchangedReject(playable, 0, { kind: 'pass' });
  const state = crazy([[card(2, 1)], [card(5, 3)]], [card(3, 0)]);
  apply(state, 0, { kind: 'draw' });
  assert.equal(state.hands[0].length, 2);
  assert.equal(state.drawn[0], true);
  unchangedReject(state, 0, { kind: 'draw' });
  apply(state, 0, { kind: 'play', cardId: '3-0' });
  assert.equal(state.turn, 1);
  assert.deepEqual(state.drawn, [false, false]);
  const pass = crazy([[card(2, 1)], [card(5, 3)]], [card(3, 2)]);
  apply(pass, 0, { kind: 'draw' });
  apply(pass, 0, { kind: 'pass' });
  assert.equal(pass.turn, 1);
  assert.deepEqual(pass.drawn, [false, false]);
});

test('Crazy Eights recycling keeps the top discard and active suit intact', () => {
  const top = card(8, 0, 'top');
  const state = crazy([[card(2, 1)], [card(5, 3)]], [], top);
  state.activeSuit = 2;
  state.discard = [card(9, 0), card(7, 1), top];
  apply(state, 0, { kind: 'draw' });
  assert.deepEqual(state.discard, [top]);
  assert.equal(state.activeSuit, 2);
  assert.equal(state.deck.length, 1);
  assert.equal(state.hands[0].length, 2);
  assert.equal(new Set([...state.hands.flat(), ...state.deck, ...state.discard].map(value => value.id)).size, 5);
});

test('Crazy Eights exhausted, blocked games resolve by remaining points and permit a draw', () => {
  for (const [hands, winner] of [
    [[[card(2, 1)], [card(13, 2)]], 0],
    [[[card(2, 1)], [card(2, 2)]], null],
  ]) {
    const state = crazy(hands);
    for (const player of [0, 1]) {
      apply(state, player, { kind: 'draw' });
      apply(state, player, { kind: 'pass' });
    }
    assert.equal(state.phase, 'matchEnd');
    assert.equal(state.winner, winner);
    assert.equal(state.result, winner === null ? 'draw' : 'win');
  }
});

test('seeded Crazy Eights games complete by exclusively legal actions', () => {
  for (const seed of [1, 5, 22, 91]) {
    const state = active('crazy-eights', seed);
    let actions = 0;
    while (state.phase === 'fight' && actions < 3000) {
      const player = state.turn;
      const playable = state.hands[player].find(value => canPlay(value, state.discard.at(-1), state.activeSuit));
      if (playable) apply(state, player, { kind: 'play', cardId: playable.id, suit: 0 });
      else if (!state.drawn[player]) apply(state, player, { kind: 'draw' });
      else apply(state, player, { kind: 'pass' });
      actions += 1;
    }
    assert.equal(state.phase, 'matchEnd', `seed ${seed} should finish`);
    const all = [...state.deck, ...state.hands.flat(), ...state.discard];
    assert.equal(all.length, 52);
    assert.equal(new Set(all.map(value => value.id)).size, 52);
  }
});

test('Crazy Eights player/spectator views never expose opponent values, deck order, or discard history', () => {
  const state = active('crazy-eights');
  for (const player of [0, 1, null]) {
    const view = viewForPlayer(state, player);
    assert.equal(view.gameId, 'crazy-eights');
    for (let owner = 0; owner < 2; owner += 1) {
      assert.deepEqual(view.hands[owner], owner === player ? state.hands[owner] : state.hands[owner].map(() => null));
    }
    assert.equal('deck' in view, false);
    assert.equal('discard' in view, false);
    assert.equal('board' in view, false);
    assert.deepEqual(JSON.parse(JSON.stringify(view)), view);
  }
  const before = JSON.stringify(state);
  const view = viewForPlayer(state, 0);
  view.hands[0][0].rank = 99;
  view.topCard.rank = 99;
  view.drawn[0] = true;
  view.scores[0] = 999;
  assert.equal(JSON.stringify(state), before);
});

test('21 Duel totals handle flexible aces, multiple aces, and face cards', () => {
  assert.equal(cardTotal([card(1), card(13)]), 21);
  assert.equal(cardTotal([card(1), card(1), card(9)]), 21);
  assert.equal(cardTotal([card(1), card(1), card(1), card(9)]), 12);
  assert.equal(cardTotal([card(12), card(13), card(2)]), 22);
  assert.equal(cardTotal([card(1), card(10), card(10)]), 21);
});

test('21 Duel allows independent actions and automatically stands at 21 or bust', () => {
  const state = active('twenty-one');
  state.hands = [[card(10), card(5)], [card(10, 1), card(8, 1)]];
  state.stood = [false, false];
  state.deck = [card(5, 2), card(6, 2)];
  apply(state, 0, { kind: 'hit' });
  assert.equal(cardTotal(state.hands[0]), 21);
  assert.equal(state.stood[0], true);
  assert.equal(state.phase, 'fight');
  unchangedReject(state, 0, { kind: 'hit' });
  apply(state, 1, { kind: 'hit' });
  assert.equal(cardTotal(state.hands[1]), 23);
  assert.equal(state.phase, 'roundEnd');
  assert.equal(state.roundWinner, 0);
  assert.deepEqual(state.scores, [1, 0]);
});

test('21 Duel accepts independent same-hand actions and rejects late previous-hand actions', () => {
  const state = active('twenty-one');
  state.hands = [[card(2), card(3)], [card(2, 1), card(3, 1)]];
  state.deck = [card(4, 1), card(4)];
  state.stood = [false, false];
  const initialRevision = state.revision;
  const round = state.round;
  // Both clients act on the same initial view. Independent hands use the round token,
  // so the first accepted action does not invalidate the other player's action.
  apply(state, 0, { kind: 'hit', round });
  apply(state, 1, { kind: 'hit', round });
  assert.equal(state.revision, initialRevision + 2);
  assert.deepEqual(state.hands.map(cardTotal), [9, 9]);
  apply(state, 0, { kind: 'stand', round });
  apply(state, 1, { kind: 'stand', round });
  assert.equal(state.phase, 'roundEnd');
  advance(state, 480);
  assert.equal(state.round, round + 1);
  assert.equal(state.phase, 'fight');
  unchangedReject(state, 0, { kind: 'hit', round });
  unchangedReject(state, 1, { kind: 'stand', round });
  unchangedReject(state, 0, { kind: 'hit', round: String(state.round) });
  unchangedReject(state, 0, { kind: 'hit', round: state.round + 1 });
});

test('21 Duel resolves tied totals, two busts, and a busted hand without awarding tied points', () => {
  for (const [hands, winner] of [
    [[[card(10), card(9)], [card(10, 1), card(9, 1)]], null],
    [[[card(10), card(10), card(5)], [card(10, 1), card(10, 1), card(3, 1)]], null],
    [[[card(10), card(10), card(5)], [card(2, 1), card(3, 1)]], 1],
  ]) {
    const state = active('twenty-one');
    state.hands = hands;
    state.stood = [false, false];
    apply(state, 1, { kind: 'stand' });
    assert.equal(state.phase, 'fight');
    apply(state, 0, { kind: 'stand' });
    assert.equal(state.phase, 'roundEnd');
    assert.equal(state.roundWinner, winner);
    assert.equal(state.roundOutcome, winner === null ? 'draw' : 'win');
    assert.equal(state.scores[0] + state.scores[1], winner === null ? 0 : 1);
  }
});

test('21 Duel opponents stay concealed until resolution and are concealed again after exactly four seconds', () => {
  const state = active('twenty-one');
  state.stood = [false, false];
  for (const owner of [0, 1]) {
    const view = viewForPlayer(state, owner);
    assert.deepEqual(view.hands[1 - owner], [null, null]);
    assert.equal(view.totals[1 - owner], null);
    assert.equal('deck' in view, false);
  }
  assert.deepEqual(viewForPlayer(state, null).totals, [null, null]);
  apply(state, 0, { kind: 'stand' });
  apply(state, 1, { kind: 'stand' });
  const revealed = viewForPlayer(state, 0);
  assert.deepEqual(revealed.hands, state.hands);
  assert.deepEqual(revealed.totals, state.hands.map(cardTotal));
  const revision = state.revision;
  advance(state, 479);
  assert.equal(state.phase, 'roundEnd');
  assert.equal(state.revision, revision);
  step(state);
  assert.equal(state.round, 2);
  assert.equal(state.phase, 'fight');
  assert.equal(state.revision, revision + 1);
  assert.equal(viewForPlayer(state, 0).totals[1], null);
  assert.deepEqual(viewForPlayer(state, 0).hands[1], [null, null]);
});

test('21 Duel completes exactly five scored rounds and final public hands reveal both players', () => {
  const state = active('twenty-one');
  const expectedScores = [0, 0];
  for (let round = 1; round <= 5; round += 1) {
    assert.equal(state.round, round);
    state.hands = round % 2 ? [[card(10), card(9)], [card(10, 1), card(8, 1)]]
      : [[card(10), card(8)], [card(10, 1), card(9, 1)]];
    state.stood = [false, false];
    apply(state, 0, { kind: 'stand' });
    apply(state, 1, { kind: 'stand' });
    expectedScores[round % 2 ? 0 : 1] += 1;
    assert.deepEqual(state.scores, expectedScores);
    if (round < 5) advance(state, 480);
  }
  assert.equal(state.phase, 'matchEnd');
  assert.equal(state.winner, 0);
  assert.equal(state.result, 'win');
  assert.deepEqual(state.scores, [3, 2]);
  assert.deepEqual(viewForPlayer(state, 1).hands, state.hands);
  unchangedReject(state, 1, { kind: 'stand' });
  advance(state, 1000);
  assert.equal(state.round, 5);
  assert.equal(state.phase, 'matchEnd');
  startMatch(state);
  assert.deepEqual(state.scores, [0, 0]);
  assert.equal(state.round, 1);
});

test('21 Duel tied match declares a draw', () => {
  const state = active('twenty-one');
  state.round = 5;
  state.scores = [2, 2];
  state.hands = [[card(10), card(9)], [card(10, 1), card(9, 1)]];
  state.stood = [false, false];
  apply(state, 0, { kind: 'stand' });
  apply(state, 1, { kind: 'stand' });
  assert.equal(state.phase, 'matchEnd');
  assert.equal(state.winner, null);
  assert.equal(state.result, 'draw');
});

test('Memory uses 16 distinct pairs with distinct card IDs and an entirely concealed initial board', () => {
  const state = active('memory');
  const counts = new Map();
  for (const value of state.board) {
    const key = `${value.rank}:${value.suit}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  assert.equal(counts.size, 16);
  assert.ok([...counts.values()].every(count => count === 2));
  assert.equal(new Set(state.board.map(value => value.id)).size, 32);
  const view = viewForPlayer(state, 0);
  assert.deepEqual(view.cards, Array(32).fill(null));
  assert.equal(view.pairsRemaining, 16);
  assert.equal('board' in view, false);
});

test('Memory rejects repeated, off-turn, stale, out-of-range, and malformed flips', () => {
  const state = active('memory');
  unchangedReject(state, 1, { kind: 'flip', index: 0 });
  for (const index of [-1, 32, 0.5, '0', null, undefined]) unchangedReject(state, 0, { kind: 'flip', index });
  const revision = state.revision;
  apply(state, 0, { kind: 'flip', index: 0, revision });
  unchangedReject(state, 0, { kind: 'flip', index: 0 });
  unchangedReject(state, 0, { kind: 'flip', index: 1, revision });
  assert.deepEqual(state.revealed, [0]);
});

test('Memory mismatch reveals exactly two cards for one second, blocks spam, then conceals and changes turn', () => {
  const state = active('memory');
  const first = state.board[0];
  const second = state.board.findIndex(value => value.rank !== first.rank || value.suit !== first.suit);
  apply(state, 0, { kind: 'flip', index: 0 });
  apply(state, 0, { kind: 'flip', index: second });
  const view = viewForPlayer(state, 1);
  assert.deepEqual(view.revealed, [0, second]);
  assert.equal(view.cards.filter(Boolean).length, 2);
  assert.equal(state.mismatchTicks, 120);
  unchangedReject(state, 0, { kind: 'flip', index: 31 });
  unchangedReject(state, 1, { kind: 'flip', index: 31 });
  const revision = state.revision;
  advance(state, 119);
  assert.equal(state.turn, 0);
  assert.equal(state.mismatchTicks, 1);
  assert.equal(state.revision, revision);
  step(state);
  assert.equal(state.turn, 1);
  assert.deepEqual(state.revealed, []);
  assert.deepEqual(viewForPlayer(state, 0).cards, Array(32).fill(null));
  assert.equal(state.revision, revision + 1);
});

function memoryPairs(state) {
  const pairs = new Map();
  state.board.forEach((value, index) => {
    const key = `${value.rank}:${value.suit}`;
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(index);
  });
  return [...pairs.values()];
}

test('Memory matching earns a point, keeps the turn, permanently reveals cards and completes the board', () => {
  const state = active('memory');
  const pairs = memoryPairs(state);
  for (const [first, second] of pairs) {
    apply(state, 0, { kind: 'flip', index: first });
    apply(state, 0, { kind: 'flip', index: second });
    assert.equal(state.turn, 0);
    assert.equal(state.matched[first], 0);
    assert.equal(state.matched[second], 0);
    assert.deepEqual(state.revealed, []);
    assert.deepEqual(viewForPlayer(state, 1).cards[first], state.board[first]);
    unchangedReject(state, 0, { kind: 'flip', index: first });
  }
  assert.equal(state.phase, 'matchEnd');
  assert.equal(state.winner, 0);
  assert.deepEqual(state.scores, [16, 0]);
  assert.equal(viewForPlayer(state, 0).pairsRemaining, 0);
  assert.equal(viewForPlayer(state, 0).cards.filter(Boolean).length, 32);
});

test('Memory completes an evenly shared board as a draw', () => {
  const state = active('memory');
  const pairs = memoryPairs(state);
  for (const pair of pairs.slice(0, 8)) for (const index of pair) apply(state, 0, { kind: 'flip', index });
  apply(state, 0, { kind: 'flip', index: pairs[8][0] });
  apply(state, 0, { kind: 'flip', index: pairs[9][0] });
  advance(state, 120);
  assert.equal(state.turn, 1);
  for (const pair of pairs.slice(8)) for (const index of pair) apply(state, 1, { kind: 'flip', index });
  assert.equal(state.phase, 'matchEnd');
  assert.deepEqual(state.scores, [8, 8]);
  assert.equal(state.winner, null);
  assert.equal(state.result, 'draw');
});

test('Memory snapshot data cannot mutate internal card identities, ownership, or scores', () => {
  const state = active('memory');
  apply(state, 0, { kind: 'flip', index: 0 });
  const before = JSON.stringify(state);
  const view = viewForPlayer(state, 1);
  view.cards[0].rank = 99;
  view.revealed.push(12);
  view.matched[0] = 1;
  view.scores[0] = 999;
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(JSON.parse(JSON.stringify(viewForPlayer(state, 0))), viewForPlayer(state, 0));
});
