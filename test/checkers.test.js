import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TICK_RATE, applyMove, cloneState, createState, legalMoves, resetLobby, startMatch, step,
} from '../public/checkers-engine.js';

const square = (row, column) => row * 8 + column;
const man = owner => ({ owner, king: false });
const king = owner => ({ owner, king: true });

function advance(state, ticks) {
  for (let tick = 0; tick < ticks; tick++) step(state);
  return state;
}

function position(pieces, turn = 0) {
  const state = createState();
  startMatch(state);
  advance(state, 3 * TICK_RATE);
  state.board = Array(64).fill(null);
  for (const [index, piece] of pieces) state.board[index] = { ...piece };
  state.turn = turn;
  state.forcedFrom = null;
  state.moves = 0;
  state.lastMove = null;
  state.halfMoves = 0;
  // Custom positions have no previous occurrences. Tests build their own legal history.
  state.positionCounts = {};
  return state;
}

function move(state, player, from, to) {
  assert.deepEqual(applyMove(state, player, from, to), { ok: true }, `${player}: ${from} → ${to}`);
}

function rejectWithoutMutation(state, player, from, to) {
  const before = structuredClone(state);
  const result = applyMove(state, player, from, to);
  assert.equal(result.ok, false, `${player}: ${from} → ${to} should be rejected`);
  assert.equal(typeof result.error, 'string');
  assert.ok(result.error.length > 0);
  assert.deepEqual(state, before, 'rejected moves must leave all authoritative state unchanged');
}

function sortedMoves(state, player = state.turn) {
  return legalMoves(state, player).toSorted((a, b) => a.from - b.from || a.to - b.to);
}

test('the starting board has twelve men per player on dark squares and an empty center', () => {
  const state = createState();
  assert.equal(state.phase, 'lobby');
  assert.equal(state.board.length, 64);
  assert.equal(state.winner, null);
  assert.equal(state.result, null);
  assert.equal(state.forcedFrom, null);
  for (const owner of [0, 1]) {
    assert.equal(state.board.filter(piece => piece?.owner === owner).length, 12);
  }
  for (const [index, piece] of state.board.entries()) {
    const row = Math.floor(index / 8);
    if (!piece) continue;
    assert.equal((row + index % 8) % 2, 1);
    assert.equal(piece.king, false);
    assert.ok(row < 3 || row > 4);
  }
  assert.ok(state.board.slice(24, 40).every(piece => piece === null));
});

test('the three-second countdown rejects moves and starts play on its final tick', () => {
  const state = createState();
  rejectWithoutMutation(state, 0, 40, 33);
  startMatch(state);
  const initialBoard = structuredClone(state.board);
  advance(state, 3 * TICK_RATE - 1);
  assert.equal(state.phase, 'countdown');
  assert.equal(state.phaseTicks, 1);
  assert.deepEqual(state.board, initialBoard);
  rejectWithoutMutation(state, 0, 40, 33);
  step(state);
  assert.equal(state.phase, 'fight');
  move(state, 0, 40, 33);
  assert.equal(state.turn, 1);
});

test('men move one diagonal square forward for either player', () => {
  for (const [owner, from, destinations, backward, opponent] of [
    [0, square(4, 3), [square(3, 2), square(3, 4)], square(5, 2), square(1, 6)],
    [1, square(3, 2), [square(4, 1), square(4, 3)], square(2, 1), square(6, 7)],
  ]) {
    const state = position([[from, man(owner)], [opponent, man(1 - owner)]], owner);
    assert.deepEqual(sortedMoves(state), destinations.map(to => ({ from, to, capture: null })));
    rejectWithoutMutation(state, owner, from, backward);
    move(state, owner, from, destinations[0]);
    assert.equal(state.board[from], null);
    assert.deepEqual(state.board[destinations[0]], man(owner));
    assert.equal(state.turn, 1 - owner);
  }
});

test('men capture forward for either player and remove only the jumped opponent', () => {
  for (const [owner, from, captured, to, survivor] of [
    [0, square(5, 2), square(4, 3), square(3, 4), square(1, 0)],
    [1, square(2, 3), square(3, 4), square(4, 5), square(6, 7)],
  ]) {
    const state = position([
      [from, man(owner)], [captured, man(1 - owner)], [survivor, man(1 - owner)],
    ], owner);
    assert.deepEqual(sortedMoves(state), [{ from, to, capture: captured }]);
    move(state, owner, from, to);
    assert.equal(state.board[from], null);
    assert.equal(state.board[captured], null);
    assert.deepEqual(state.board[to], man(owner));
    assert.deepEqual(state.board[survivor], man(1 - owner));
  }
});

test('uncrowned men cannot capture backward', () => {
  for (const [owner, from, captured, backwardLanding] of [
    [0, square(3, 4), square(4, 3), square(5, 2)],
    [1, square(4, 3), square(3, 4), square(2, 5)],
  ]) {
    const state = position([[from, man(owner)], [captured, man(1 - owner)]], owner);
    assert.ok(legalMoves(state).every(candidate => candidate.capture === null));
    rejectWithoutMutation(state, owner, from, backwardLanding);
  }
});

test('kings can move one square in all four diagonal directions', () => {
  for (const owner of [0, 1]) {
    const from = square(3, 4);
    const state = position([[from, king(owner)], [square(7, 0), king(1 - owner)]], owner);
    assert.deepEqual(sortedMoves(state), [square(2, 3), square(2, 5), square(4, 3), square(4, 5)]
      .map(to => ({ from, to, capture: null })));
    rejectWithoutMutation(state, owner, from, square(0, 1));
  }
});

test('kings can capture in all four diagonal directions for either player', () => {
  for (const owner of [0, 1]) {
    for (const [rowDelta, columnDelta] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const from = square(3, 4);
      const captured = square(3 + rowDelta, 4 + columnDelta);
      const to = square(3 + 2 * rowDelta, 4 + 2 * columnDelta);
      const state = position([[from, king(owner)], [captured, man(1 - owner)]], owner);
      assert.deepEqual(sortedMoves(state), [{ from, to, capture: captured }]);
      move(state, owner, from, to);
      assert.equal(state.board[captured], null);
      assert.deepEqual(state.board[to], king(owner));
    }
  }
});

test('a capture anywhere on the board forbids another piece from making a quiet move', () => {
  const state = position([
    [square(5, 2), man(0)], [square(6, 5), man(0)],
    [square(4, 3), man(1)], [square(1, 6), man(1)],
  ]);
  assert.deepEqual(sortedMoves(state), [{ from: square(5, 2), to: square(3, 4), capture: square(4, 3) }]);
  rejectWithoutMutation(state, 0, square(6, 5), square(5, 4));
  move(state, 0, square(5, 2), square(3, 4));
  assert.equal(state.moves, 1);
});

test('a chained jump keeps the same turn and forces continuation with the same piece', () => {
  const state = position([
    [square(6, 1), man(0)], [square(6, 5), man(0)],
    [square(5, 2), man(1)], [square(3, 4), man(1)], [square(1, 0), man(1)],
  ]);
  move(state, 0, square(6, 1), square(4, 3));
  assert.equal(state.turn, 0);
  assert.equal(state.forcedFrom, square(4, 3));
  assert.equal(state.moves, 0, 'a partial chain is not a completed turn');
  assert.deepEqual(sortedMoves(state), [{ from: square(4, 3), to: square(2, 5), capture: square(3, 4) }]);
  rejectWithoutMutation(state, 0, square(6, 5), square(5, 4));
  rejectWithoutMutation(state, 0, square(4, 3), square(3, 2));
  rejectWithoutMutation(state, 1, square(1, 0), square(2, 1));
  move(state, 0, square(4, 3), square(2, 5));
  assert.equal(state.turn, 1);
  assert.equal(state.forcedFrom, null);
  assert.equal(state.moves, 1);
  assert.equal(state.board[square(5, 2)], null);
  assert.equal(state.board[square(3, 4)], null);
});

test('crowning by capture ends the turn even when the new king could jump backward', () => {
  for (const [owner, from, captured, crown, nextVictim, otherOpponent] of [
    [0, square(2, 1), square(1, 2), square(0, 3), square(1, 4), square(6, 7)],
    [1, square(5, 2), square(6, 3), square(7, 4), square(6, 5), square(1, 0)],
  ]) {
    const state = position([
      [from, man(owner)], [captured, man(1 - owner)],
      [nextVictim, man(1 - owner)], [otherOpponent, man(1 - owner)],
    ], owner);
    move(state, owner, from, crown);
    assert.deepEqual(state.board[crown], king(owner));
    assert.equal(state.forcedFrom, null);
    assert.equal(state.turn, 1 - owner);
    assert.equal(state.moves, 1);
    assert.equal(state.lastMove.kinged, true);
    assert.deepEqual(state.board[nextVictim], man(1 - owner));
    const backwardLanding = owner === 0 ? square(2, 5) : square(5, 6);
    rejectWithoutMutation(state, owner, crown, backwardLanding);
  }
});

test('a quiet move to the far rank crowns the man for either player', () => {
  for (const [owner, from, to, opponent] of [
    [0, square(1, 2), square(0, 1), square(5, 6)],
    [1, square(6, 3), square(7, 2), square(2, 5)],
  ]) {
    const state = position([[from, man(owner)], [opponent, man(1 - owner)]], owner);
    move(state, owner, from, to);
    assert.deepEqual(state.board[to], king(owner));
    assert.equal(state.lastMove.kinged, true);
    assert.equal(state.turn, 1 - owner);
  }
});

test('capturing the final opposing piece ends the match and freezes further moves', () => {
  for (const [owner, from, captured, to] of [
    [0, square(5, 2), square(4, 3), square(3, 4)],
    [1, square(2, 3), square(3, 4), square(4, 5)],
  ]) {
    const state = position([[from, man(owner)], [captured, man(1 - owner)]], owner);
    move(state, owner, from, to);
    assert.equal(state.phase, 'matchEnd');
    assert.equal(state.result, 'win');
    assert.equal(state.winner, owner);
    rejectWithoutMutation(state, owner, to, owner === 0 ? square(2, 3) : square(5, 4));
  }
});

test('a player with remaining pieces but no legal move loses', () => {
  for (const [owner, from, to, trappedOpponent] of [
    [0, square(4, 3), square(3, 2), square(7, 0)],
    [1, square(3, 2), square(4, 3), square(0, 1)],
  ]) {
    const state = position([[from, man(owner)], [trappedOpponent, man(1 - owner)]], owner);
    move(state, owner, from, to);
    assert.deepEqual(state.board[trappedOpponent], man(1 - owner));
    assert.equal(state.phase, 'matchEnd');
    assert.equal(state.result, 'win');
    assert.equal(state.winner, owner);
  }
});

test('invalid coordinates, invalid players, wrong turns, and illegal geometry never mutate state', () => {
  const state = createState();
  startMatch(state);
  advance(state, 3 * TICK_RATE);
  for (const [player, from, to] of [
    [1, 17, 24], [-1, 40, 33], [2, 40, 33], ['0', 40, 33], [null, 40, 33],
    [0, -1, 33], [0, 64, 33], [0, 40, -1], [0, 40, 64],
    [0, 40.5, 33], [0, 40, 33.5], [0, '40', 33], [0, 40, '33'],
    [0, NaN, 33], [0, 40, NaN], [0, null, 33], [0, 40, null],
    [0, 32, 25], [0, 17, 24], [0, 40, 40], [0, 40, 32], [0, 40, 26],
    [0, 42, 24], [0, 40, 49],
  ]) rejectWithoutMutation(state, player, from, to);
});

test('threefold repetition ends the match on the third occurrence of a complete position', () => {
  const state = position([[49, king(0)], [14, king(1)]]);
  const cycle = [[0, 49, 40], [1, 14, 23], [0, 40, 49], [1, 23, 14]];
  // The position after ply one occurs again after plies five and nine.
  for (let ply = 0; ply < 9; ply++) {
    move(state, ...cycle[ply % cycle.length]);
    if (ply < 8) {
      assert.equal(state.phase, 'fight');
      assert.equal(state.result, null);
    }
  }
  assert.equal(state.moves, 9);
  assert.equal(state.phase, 'matchEnd');
  assert.equal(state.result, 'draw');
  assert.equal(state.winner, null);
});

test('eighty actual quiet king plies produce a draw without triggering threefold repetition', () => {
  // The kings stay in separated two-rank corridors. This fixed legal route visits
  // every complete board/turn position at most twice, including the initial one.
  const corridors = [[56, 49, 58, 51, 60, 53, 62, 55], [8, 1, 10, 3, 12, 5, 14, 7]];
  const route = [
    4, 2, 3, 1, 2, 0, 1, 1, 0, 0, 1, 1, 0, 2, 1, 3, 0, 2, 1, 3,
    0, 4, 1, 5, 0, 4, 1, 5, 0, 6, 1, 7, 0, 6, 1, 7, 2, 6, 3, 5,
    2, 6, 3, 5, 4, 6, 5, 7, 4, 6, 5, 5, 4, 4, 5, 5, 6, 4, 5, 3,
    4, 4, 3, 3, 2, 2, 3, 1, 4, 0, 5, 1, 6, 0, 5, 1, 6, 2, 7, 1,
  ];
  const indices = [3, 3];
  const occurrences = new Map([['3,3,0', 1]]);
  const state = position([[corridors[0][3], king(0)], [corridors[1][3], king(1)]]);
  for (const [ply, next] of route.entries()) {
    const player = ply % 2;
    assert.equal(Math.abs(next - indices[player]), 1, 'fixture follows adjacent diagonal squares');
    const from = corridors[player][indices[player]];
    const to = corridors[player][next];
    indices[player] = next;
    const key = `${indices[0]},${indices[1]},${1 - player}`;
    const visits = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, visits);
    assert.ok(visits <= 2, 'fixture must not reach a third occurrence');
    move(state, player, from, to);
    assert.equal(state.halfMoves, ply + 1);
    if (ply < 79) {
      assert.equal(state.phase, 'fight');
      assert.equal(state.result, null);
    }
  }
  assert.equal(state.moves, 80);
  assert.equal(state.phase, 'matchEnd');
  assert.equal(state.result, 'draw');
  assert.equal(state.winner, null);
});

test('a capture or an uncrowned man move resets the no-progress counter', () => {
  const captures = position([[42, king(0)], [35, man(1)], [14, man(1)]]);
  captures.halfMoves = 79;
  move(captures, 0, 42, 28);
  assert.equal(captures.halfMoves, 0);
  assert.equal(captures.phase, 'fight');
  const advances = position([[42, man(0)], [14, man(1)]]);
  advances.halfMoves = 79;
  move(advances, 0, 42, 33);
  assert.equal(advances.halfMoves, 0);
  assert.equal(advances.phase, 'fight');
});

test('cloned states do not share mutable board pieces or move history', () => {
  const state = position([[42, man(0)], [35, man(1)], [14, man(1)]]);
  move(state, 0, 42, 28);
  const copy = cloneState(state);
  assert.deepEqual(copy, state);
  copy.board[28].king = true;
  copy.lastMove.to = 0;
  copy.positionCounts.unrelated = 3;
  assert.equal(state.board[28].king, false);
  assert.equal(state.lastMove.to, 28);
  assert.equal(state.positionCounts.unrelated, undefined);
});

test('reset clears a match and permits a fresh countdown with the full initial board', () => {
  const state = position([[42, man(0)], [35, man(1)]]);
  move(state, 0, 42, 28);
  assert.equal(state.result, 'win');
  resetLobby(state);
  const fresh = createState();
  assert.equal(state.phase, 'lobby');
  assert.deepEqual(state.board, fresh.board);
  assert.equal(state.turn, fresh.turn);
  assert.equal(state.winner, null);
  assert.equal(state.result, null);
  assert.equal(state.forcedFrom, null);
  assert.equal(state.lastMove, null);
  assert.equal(state.moves, 0);
  assert.equal(state.halfMoves, 0);
  rejectWithoutMutation(state, 0, 40, 33);
  startMatch(state);
  assert.equal(state.phase, 'countdown');
  advance(state, 3 * TICK_RATE);
  assert.equal(state.phase, 'fight');
  move(state, 0, 40, 33);
});
