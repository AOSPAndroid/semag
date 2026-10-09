import assert from 'node:assert/strict';
import test from 'node:test';
import * as checkers from '../public/checkers-engine.js';
import * as cards from '../public/cards-engine.js';
import { BOARD_CARD_BOT_PROFILES, createBoardCardBot } from '../public/board-card-bots.js';

const card = (rank, suit = 0, id = `${rank}-${suit}`) => ({ rank, suit, id });
const man = owner => ({ owner, king: false });
const king = owner => ({ owner, king: true });
function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function board(pieces, turn = 1) {
  const state = checkers.createState();
  state.phase = 'fight';
  state.board.fill(null);
  for (const [index, piece] of pieces) {
    assert.equal((Math.floor(index / 8) + index % 8) % 2, 1, 'fixtures use legal dark squares');
    state.board[index] = { ...piece };
  }
  state.turn = turn;
  state.positionCounts = {};
  return state;
}
function active(gameId, seed = 1) {
  const state = cards.createState(gameId, { random: seeded(seed) });
  cards.startMatch(state);
  for (let tick = 0; tick < 240; tick += 1) cards.step(state);
  return state;
}
function eights(hand, { top = card(4, 0, 'top'), deck = [], opponent = [card(2, 3)], drawn = false } = {}) {
  const state = active('crazy-eights');
  Object.assign(state, { hands: [opponent, hand], turn: 1, drawn: [false, drawn], deck, discard: [top], activeSuit: top.suit });
  return state;
}
function duel(hand, { scores = [0, 0], round = 1, stood = false, deck = [card(2, 1)] } = {}) {
  const state = active('twenty-one');
  Object.assign(state, { hands: [[card(10, 2), card(7, 2)], hand], scores, round, stood: [false, stood], deck });
  return state;
}
function memoryView({ revision = 1, turn = 0, revealed = [], faces = [], matched = Array(32).fill(null), mismatchTicks = 0 } = {}) {
  const visible = Array(32).fill(null);
  for (const [index, value] of faces) visible[index] = value;
  return { gameId: 'memory', phase: 'fight', revision, round: 1, turn, revealed, cards: visible, matched, mismatchTicks };
}

test('the three difficulties have finite progressively stronger search and memory budgets', () => {
  const profiles = ['normal', 'hard', 'expert'].map(difficulty => BOARD_CARD_BOT_PROFILES[difficulty]);
  for (const property of ['nodes', 'depth', 'memory', 'memoryAge']) {
    assert.ok(profiles[0][property] < profiles[1][property]);
    assert.ok(profiles[1][property] < profiles[2][property]);
  }
  assert.ok(profiles.every(profile => profile.delayTicks >= 48 && profile.memory <= 32));
  assert.throws(() => createBoardCardBot({ gameId: 'chess' }), /Unsupported/);
  assert.throws(() => createBoardCardBot({ gameId: 'memory', playerId: 2 }), /playerId/);
  assert.throws(() => createBoardCardBot({ gameId: 'checkers', difficulty: 'invalid' }), /difficulty/);
});

test('all bots wait for active play and their turn without mutating a view', () => {
  for (const gameId of ['checkers', ...cards.GAME_IDS]) {
    const bot = createBoardCardBot({ gameId });
    const state = gameId === 'checkers' ? checkers.createState() : cards.createState(gameId, { random: seeded(8) });
    const view = gameId === 'checkers' ? state : cards.viewForPlayer(state, 1);
    const before = structuredClone(view);
    assert.equal(bot.action(view), null);
    assert.deepEqual(view, before);
    view.phase = 'fight';
    if (gameId !== 'twenty-one') {
      view.turn = 0;
      assert.equal(bot.action(view), null);
    }
  }
});

test('checkers uses the mandatory capture and emits the forced continuation as a new position', () => {
  const state = board([[10, man(1)], [19, man(0)], [37, man(0)], [7, man(0)], [12, man(1)]]);
  const bot = createBoardCardBot({ gameId: 'checkers' });
  const before = structuredClone(state);
  const first = bot.action(state);
  assert.deepEqual(first, { kind: 'move', from: 10, to: 28 });
  assert.deepEqual(state, before);
  assert.equal(bot.action(state), null, 'a pending move must not be sent twice');
  assert.deepEqual(checkers.applyMove(state, 1, first.from, first.to), { ok: true });
  assert.equal(state.forcedFrom, 28);
  const continuation = bot.action(state);
  assert.deepEqual(continuation, { kind: 'move', from: 28, to: 46 });
  assert.deepEqual(checkers.applyMove(state, 1, continuation.from, continuation.to), { ok: true });
  assert.equal(state.turn, 0);
});

test('checkers completes a capture chain before scoring and chooses the branch that wins a king', () => {
  // Both initial jumps take a man, but only the right branch captures the king next.
  const state = board([[19, man(1)], [26, man(0)], [28, man(0)], [46, king(0)], [1, king(0)]]);
  const bot = createBoardCardBot({ gameId: 'checkers', difficulty: 'expert' });
  assert.deepEqual(bot.action(state), { kind: 'move', from: 19, to: 37 });
});

test('checkers avoids a legal quiet move that immediately gives away its man', () => {
  const state = board([[19, man(1)], [33, man(0)], [1, king(0)]]);
  const bot = createBoardCardBot({ gameId: 'checkers', difficulty: 'hard' });
  const result = bot.action(state);
  assert.deepEqual(result, { kind: 'move', from: 19, to: 28 });
  assert.deepEqual(checkers.applyMove(state, 1, result.from, result.to), { ok: true });
  assert.ok(checkers.legalMoves(state).every(move => move.capture === null));
});

test('checkers seeks promotion and respects the engine rule that crowning ends a jump turn', () => {
  const state = board([[40, man(1)], [42, man(1)], [51, man(0)], [53, man(0)], [1, king(0)]]);
  const bot = createBoardCardBot({ gameId: 'checkers' });
  const result = bot.action(state);
  assert.ok(checkers.legalMoves(state).some(move => move.from === result.from && move.to === result.to));
  assert.deepEqual(checkers.applyMove(state, 1, result.from, result.to), { ok: true });
  assert.equal(state.board[result.to].king, true);
  assert.equal(state.turn, 0);
  assert.equal(state.forcedFrom, null);
});

test('checkers search is bounded at every difficulty and reset permits a replay of the same position', () => {
  for (const difficulty of ['normal', 'hard', 'expert']) {
    const state = checkers.createState();
    state.phase = 'fight';
    state.turn = 1;
    const before = structuredClone(state);
    const bot = createBoardCardBot({ gameId: 'checkers', difficulty });
    const move = bot.action(state);
    assert.ok(checkers.legalMoves(state).some(candidate => candidate.from === move.from && candidate.to === move.to));
    assert.ok(bot.diagnostics.nodes <= BOARD_CARD_BOT_PROFILES[difficulty].nodes);
    assert.ok(bot.diagnostics.completedDepth >= 1);
    assert.deepEqual(state, before);
    assert.equal(bot.action(state), null);
    bot.reset();
    assert.deepEqual(bot.action(state), move);
  }
});

test('Crazy Eights chooses a suit chain while conserving a playable wild', () => {
  const hand = [card(8, 3), card(4, 1), card(9, 1), card(6, 1), card(2, 0)];
  const state = eights(hand, { opponent: [card(2, 3), card(3, 3), card(5, 3)] });
  const bot = createBoardCardBot({ gameId: 'crazy-eights' });
  const before = structuredClone(state);
  const action = bot.action(cards.viewForPlayer(state, 1));
  assert.equal(action.kind, 'play');
  assert.equal(action.cardId, '4-1');
  assert.deepEqual(state, before);
  assert.deepEqual(cards.applyAction(state, 1, action), { ok: true });
});

test('Crazy Eights uses a necessary wild and declares the majority suit of its remaining hand', () => {
  const state = eights([card(8, 3), card(2, 1), card(3, 1), card(5, 2)], { opponent: [card(2, 2), card(3, 2), card(6, 2)] });
  const action = createBoardCardBot({ gameId: 'crazy-eights' }).action(cards.viewForPlayer(state, 1));
  assert.deepEqual(action, { kind: 'play', cardId: '8-3', suit: 1, revision: state.revision });
  assert.deepEqual(cards.applyAction(state, 1, action), { ok: true });
});

test('Crazy Eights draws once, plays a useful draw, or passes a nonmatching draw', () => {
  for (const drawnCard of [card(3, 0), card(3, 2)]) {
    const state = eights([card(2, 1)], { deck: [drawnCard] });
    const bot = createBoardCardBot({ gameId: 'crazy-eights' });
    const draw = bot.action(cards.viewForPlayer(state, 1));
    assert.equal(draw.kind, 'draw');
    assert.equal(bot.action(cards.viewForPlayer(state, 1)), null);
    assert.deepEqual(cards.applyAction(state, 1, draw), { ok: true });
    const next = bot.action(cards.viewForPlayer(state, 1));
    assert.equal(next.kind, drawnCard.suit === 0 ? 'play' : 'pass');
    assert.deepEqual(cards.applyAction(state, 1, next), { ok: true });
  }
});

test('card decisions cannot read the hidden deck, opposing hand, or concealed total', () => {
  for (const gameId of ['crazy-eights', 'twenty-one']) {
    const state = gameId === 'crazy-eights' ? eights([card(2, 1)]) : duel([card(10), card(6, 1)]);
    const view = cards.viewForPlayer(state, 1);
    Object.defineProperty(view.hands, 0, { get() { throw new Error('opponent hand inspected'); } });
    Object.defineProperty(view, 'deck', { get() { throw new Error('hidden deck inspected'); } });
    if (gameId === 'twenty-one') Object.defineProperty(view.totals, 0, { get() { throw new Error('concealed total inspected'); } });
    assert.ok(createBoardCardBot({ gameId }).action(view));
  }
});

test('Twenty-One hits low hard hands, hits soft seventeen, and stands on strong hands or an empty deck', () => {
  for (const [hand, kind, options] of [
    [[card(10), card(6, 1)], 'hit'],
    [[card(1), card(6, 1)], 'hit'],
    [[card(10), card(8, 1)], 'stand'],
    [[card(1), card(7, 1)], 'stand'],
    [[card(4), card(5, 1)], 'stand', { deck: [] }],
  ]) {
    const state = duel(hand, options);
    const action = createBoardCardBot({ gameId: 'twenty-one' }).action(cards.viewForPlayer(state, 1));
    assert.deepEqual(action, { kind, round: state.round });
    assert.deepEqual(cards.applyAction(state, 1, action), { ok: true });
  }
  const stood = duel([card(10), card(7, 1)], { stood: true });
  assert.equal(createBoardCardBot({ gameId: 'twenty-one' }).action(cards.viewForPlayer(stood, 1)), null);
});

test('Twenty-One considers only public final-round pressure and normal difficulty remains conservative', () => {
  const state = duel([card(10), card(7, 1)], { round: 5, scores: [3, 1] });
  assert.equal(createBoardCardBot({ gameId: 'twenty-one', difficulty: 'hard' }).action(cards.viewForPlayer(state, 1)).kind, 'hit');
  assert.equal(createBoardCardBot({ gameId: 'twenty-one', difficulty: 'normal' }).action(cards.viewForPlayer(state, 1)).kind, 'stand');
});

test('Twenty-One allows a concurrent human hit without stale revision or duplicate bot replay', () => {
  const state = duel([card(10), card(6, 1)], { deck: [card(2, 3), card(2, 2)] });
  const bot = createBoardCardBot({ gameId: 'twenty-one' });
  const action = bot.action(cards.viewForPlayer(state, 1));
  assert.equal(Object.hasOwn(action, 'revision'), false);
  assert.deepEqual(cards.applyAction(state, 0, { kind: 'hit', round: state.round }), { ok: true });
  assert.equal(bot.action(cards.viewForPlayer(state, 1)), null, 'opponent hit does not create a new bot decision');
  assert.deepEqual(cards.applyAction(state, 1, action), { ok: true });
  assert.equal(bot.action(cards.viewForPlayer(state, 1)).kind, 'stand');
});

test('Memory learns both human-visible reveals and recalls a pair after the cards turn over', () => {
  const bot = createBoardCardBot({ gameId: 'memory' });
  const before = memoryView({ revision: 3, turn: 0, revealed: [7, 18], faces: [[7, card(3, 1, 'a')], [18, card(3, 1, 'b')]], mismatchTicks: 120 });
  const unchanged = structuredClone(before);
  bot.observe(before);
  assert.deepEqual(before, unchanged);
  assert.equal(bot.action(before), null);
  const first = bot.action(memoryView({ revision: 4, turn: 1 }));
  assert.deepEqual(first, { kind: 'flip', index: 7, revision: 4 });
  assert.equal(bot.action(memoryView({ revision: 4, turn: 1 })), null);
  const second = bot.action(memoryView({ revision: 5, turn: 1, revealed: [7], faces: [[7, card(3, 1, 'a')]] }));
  assert.deepEqual(second, { kind: 'flip', index: 18, revision: 5 });
});

test('Memory never learns unrevealed values even when extra face data is supplied', () => {
  const bot = createBoardCardBot({ gameId: 'memory', difficulty: 'expert' });
  const polluted = memoryView({ revision: 1, faces: [[4, card(2, 1, 'a')], [6, card(2, 1, 'b')]], turn: 0 });
  bot.observe(polluted);
  assert.equal(bot.diagnostics.remembered, 0);
  assert.deepEqual(bot.action(memoryView({ revision: 2, turn: 1 })), { kind: 'flip', index: 0, revision: 2 });
});

test('Memory waits for mismatch turnover, excludes matched/revealed cards, and forgets after reset', () => {
  const bot = createBoardCardBot({ gameId: 'memory' });
  bot.observe(memoryView({ revealed: [8, 21], faces: [[8, card(2)], [21, card(2, 0, 'mate')]] }));
  assert.equal(bot.action(memoryView({ revision: 2, turn: 1, mismatchTicks: 5 })), null);
  const matched = Array(32).fill(null); matched[8] = 0; matched[21] = 0; matched[0] = 1; matched[1] = 1;
  const action = bot.action(memoryView({ revision: 3, turn: 1, matched, revealed: [2], faces: [[2, card(4)]] }));
  assert.ok(![0, 1, 2, 8, 21].includes(action.index));
  bot.reset();
  assert.equal(bot.diagnostics.remembered, 0);
  assert.equal(bot.action(memoryView({ revision: 3, turn: 1 })).index, 0);
});

test('Memory capacity is finite and stale observations expire at each difficulty', () => {
  for (const difficulty of ['normal', 'hard', 'expert']) {
    const bot = createBoardCardBot({ gameId: 'memory', difficulty });
    for (let index = 0; index < 32; index += 1) {
      bot.observe(memoryView({ revision: index + 1, revealed: [index], faces: [[index, card(index % 8 + 1, Math.floor(index / 16), `m${index}`)]] }));
    }
    assert.equal(bot.diagnostics.remembered, BOARD_CARD_BOT_PROFILES[difficulty].memory);
    for (let revision = 33; revision <= 34 + BOARD_CARD_BOT_PROFILES[difficulty].memoryAge; revision += 1) bot.observe(memoryView({ revision }));
    assert.equal(bot.diagnostics.remembered, 0);
  }
});

test('each card bot finishes genuine seeded matches using only its own allow-listed views', () => {
  for (const gameId of cards.GAME_IDS) {
    for (const seed of [3, 17, 42, 91]) {
      const state = active(gameId, seed);
      const bots = [0, 1].map(playerId => createBoardCardBot({ gameId, playerId, difficulty: 'hard' }));
      let decisions = 0;
      let ticks = 0;
      while (state.phase !== 'matchEnd' && decisions < 3000 && ticks < 30000) {
        for (let player = 0; player < 2; player += 1) bots[player].observe(cards.viewForPlayer(state, player));
        if (state.phase !== 'fight' || state.mismatchTicks > 0) { cards.step(state); ticks += 1; continue; }
        const player = gameId === 'twenty-one' ? state.stood[0] ? 1 : 0 : state.turn;
        const before = structuredClone(state);
        const action = bots[player].action(cards.viewForPlayer(state, player));
        assert.ok(action, `${gameId}, seed ${seed}: a legal active decision exists`);
        assert.deepEqual(state, before, 'bot never mutates the authoritative card state');
        assert.deepEqual(cards.applyAction(state, player, action), { ok: true }, `${gameId}, seed ${seed}`);
        decisions += 1;
      }
      assert.equal(state.phase, 'matchEnd', `${gameId}, seed ${seed}: finite playable match`);
      assert.ok(decisions > 0 && decisions < 3000);
    }
  }
});

test('a genuine checkers match uses legal bot moves, capture continuations, and a finite game result', () => {
  const state = checkers.createState();
  state.phase = 'fight';
  const bots = [0, 1].map(playerId => createBoardCardBot({ gameId: 'checkers', playerId, difficulty: 'normal' }));
  let decisions = 0;
  while (state.phase === 'fight' && decisions < 500) {
    const action = bots[state.turn].action(state);
    assert.ok(action);
    assert.deepEqual(checkers.applyMove(state, state.turn, action.from, action.to), { ok: true });
    decisions += 1;
  }
  assert.equal(state.phase, 'matchEnd');
  assert.ok(decisions > 10 && decisions < 500);
});
