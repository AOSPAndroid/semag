import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, move, undo, hasMoves, togglePause, continueGame } from '../public/solo/2048-engine.js';

function seeded(seed = 1) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function fixture(values = [], score = 0, options = { random: () => 0.5 }) {
  const state = createState(options);
  state.board = [...values, ...Array(16 - values.length).fill(0)];
  state.score = score;
  return state;
}

function beforeSpawn(state, result) {
  const board = [...state.board];
  assert.ok(result.spawned, 'each successful move spawns one tile');
  assert.ok([2, 4].includes(result.spawned.value));
  assert.equal(board[result.spawned.index], result.spawned.value);
  board[result.spawned.index] = 0;
  return board;
}

test('2048 deals two separate tiles and supports reproducible injected randomness', () => {
  const state = createState({ random: () => 0 });
  assert.deepEqual(state.board, [2, 2, ...Array(14).fill(0)]);
  assert.equal(state.phase, 'playing');
  assert.equal(state.score, 0);
  assert.equal(state.undoAvailable, false);
  assert.deepEqual(createState({ random: seeded(9) }), createState({ random: seeded(9) }));
  assert.deepEqual(createState({ random: () => 0.99 }).board.slice(14), [4, 4]);
  assert.throws(() => createState({ random: 3 }), /random/);
  assert.doesNotThrow(() => JSON.stringify(state));
});

test('2048 merges each source tile at most once, from the movement edge', () => {
  const cases = [
    { line: [2, 2, 2, 2], direction: 'left', result: [4, 4, 0, 0], score: 8 },
    { line: [2, 2, 4, 0], direction: 'left', result: [4, 4, 0, 0], score: 4 },
    { line: [4, 4, 8, 8], direction: 'left', result: [8, 16, 0, 0], score: 24 },
    { line: [2, 0, 2, 4], direction: 'left', result: [4, 4, 0, 0], score: 4 },
    { line: [2, 2, 2, 0], direction: 'right', result: [0, 0, 2, 4], score: 4 },
    { line: [2, 2, 4, 4], direction: 'right', result: [0, 0, 4, 8], score: 12 },
  ];
  for (const entry of cases) {
    const state = fixture(entry.line);
    const result = move(state, entry.direction);
    assert.equal(result.changed, true);
    assert.deepEqual(beforeSpawn(state, result).slice(0, 4), entry.result);
    assert.equal(state.score, entry.score);
    assert.equal(result.gained, entry.score);
  }
});

test('2048 slides columns in both directions without merging across rows', () => {
  for (const direction of ['up', 'down']) {
    const board = Array(16).fill(0);
    [2, 0, 2, 2].forEach((value, row) => { board[row * 4] = value; });
    board[1] = 4;
    const state = fixture(board);
    const result = move(state, direction);
    const actual = beforeSpawn(state, result);
    assert.deepEqual([actual[0], actual[4], actual[8], actual[12]], direction === 'up' ? [4, 2, 0, 0] : [0, 0, 2, 4]);
    assert.equal(actual[direction === 'up' ? 1 : 13], 4);
    assert.equal(state.score, 4);
  }
});

test('2048 accumulates points across all four lines and sliding alone scores zero', () => {
  const state = fixture([2, 2, 2, 2, 4, 4, 0, 0, 8, 0, 8, 0, 16, 16, 16, 16], 50);
  const result = move(state, 'left');
  assert.deepEqual(beforeSpawn(state, result), [4, 4, 0, 0, 8, 0, 0, 0, 16, 0, 0, 0, 32, 32, 0, 0]);
  assert.equal(result.gained, 96);
  assert.equal(state.score, 146);
  const sliding = fixture([0, 2, 0, 0], 7);
  const slide = move(sliding, 'left');
  assert.equal(slide.gained, 0);
  assert.equal(sliding.score, 7);
});

test('2048 spawns only after valid moves and rejected moves preserve undo and RNG', () => {
  let calls = 0;
  const state = fixture([2, 0, 0, 0], 0, { random: () => { calls += 1; return 0; } });
  const baseline = JSON.stringify(state);
  assert.equal(move(state, 'left').changed, false);
  assert.equal(move(state, 'sideways').changed, false);
  assert.equal(JSON.stringify(state), baseline);
  assert.equal(calls, 4, 'unchanged moves consume no additional random values');
  assert.equal(move(state, 'right').changed, true);
  assert.equal(calls, 6);
  const after = JSON.stringify(state);
  assert.equal(move(state, 'up').changed, false);
  assert.equal(JSON.stringify(state), after);
  assert.equal(state.undoAvailable, true);
  assert.equal(calls, 6);
  assert.equal(undo(state), true);
  assert.deepEqual(state.board, [2, ...Array(15).fill(0)]);
});

test('2048 undo removes the spawn and restores exact previous score, board, move count and phase', () => {
  const state = fixture([2, 2, 4, 0], 123);
  const previous = JSON.parse(JSON.stringify(state));
  move(state, 'left');
  assert.equal(state.undoAvailable, true);
  assert.equal(state.moves, 1);
  togglePause(state);
  assert.equal(undo(state), true);
  assert.deepEqual(state, previous);
  assert.equal(undo(state), false);
  assert.deepEqual(state, previous);
});

test('2048 successive moves keep only the most recent undo snapshot', () => {
  const state = fixture([2, 2, 0, 0]);
  move(state, 'right');
  const previous = JSON.parse(JSON.stringify(state));
  move(state, 'down');
  assert.equal(undo(state), true);
  assert.deepEqual(state, { ...previous, undoAvailable: false });
  const afterUndo = JSON.stringify(state);
  assert.equal(undo(state), false);
  assert.equal(JSON.stringify(state), afterUndo);
});

test('2048 pauses without allowing moves, then resumes the same board', () => {
  const state = fixture([2, 2, 0, 0]);
  assert.equal(togglePause(state), true);
  const paused = JSON.stringify(state);
  assert.equal(move(state, 'left').changed, false);
  assert.equal(JSON.stringify(state), paused);
  assert.equal(togglePause(state), true);
  assert.equal(state.phase, 'playing');
  assert.equal(move(state, 'left').changed, true);
});

test('2048 wins once, can undo a win, and continues towards larger tiles', () => {
  const state = fixture([1024, 1024, 0, 0]);
  const previous = JSON.parse(JSON.stringify(state));
  move(state, 'left');
  assert.equal(state.phase, 'won');
  assert.equal(state.won, true);
  assert.equal(state.score, 2048);
  const won = JSON.stringify(state);
  assert.equal(move(state, 'right').changed, false);
  assert.equal(togglePause(state), false);
  assert.equal(JSON.stringify(state), won);
  assert.equal(undo(state), true);
  assert.deepEqual(state, previous);
  move(state, 'left');
  assert.equal(continueGame(state), true);
  assert.equal(state.phase, 'playing');
  assert.equal(state.continued, true);
  state.board = [2048, 2048, ...Array(14).fill(0)];
  move(state, 'left');
  assert.equal(state.board[0], 4096);
  assert.equal(state.phase, 'playing');
  assert.equal(state.score, 6144);
  assert.equal(continueGame(state), false);
});

test('2048 move availability includes empty cells and horizontal or vertical pairs only', () => {
  const alternating = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
  const state = fixture(alternating);
  assert.equal(hasMoves(state), false);
  state.board[15] = 0;
  assert.equal(hasMoves(state), true);
  state.board = [...alternating];
  state.board[1] = 2;
  assert.equal(hasMoves(state), true);
  state.board = [...alternating];
  state.board[4] = 2;
  assert.equal(hasMoves(state), true);
});

test('2048 detects a final full board after spawning and undo rescues the last move', () => {
  const initial = [0, 2, 4, 2, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
  const state = fixture(initial, 55, { random: () => 0.99 });
  move(state, 'left');
  assert.equal(state.board[3], 4);
  assert.equal(hasMoves(state), false);
  assert.equal(state.phase, 'lost');
  const lost = JSON.stringify(state);
  assert.equal(move(state, 'down').changed, false);
  assert.equal(togglePause(state), false);
  assert.equal(continueGame(state), false);
  assert.equal(JSON.stringify(state), lost);
  assert.equal(undo(state), true);
  assert.equal(state.phase, 'playing');
  assert.deepEqual(state.board, initial);
  assert.equal(state.score, 55);
});
