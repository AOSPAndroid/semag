import test from 'node:test';
import assert from 'node:assert/strict';
import { PUZZLES, MASTER_PUZZLES, nextPuzzle, retryPuzzle, createState, move, undo, hasMoves, togglePause, continueGame } from '../public/solo/2048-engine.js';

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

test('six fixed puzzles conserve their target mass and never deal random tiles', () => {
  for (const puzzle of PUZZLES) { assert.equal(puzzle.board.reduce((a,b)=>a+b,0), puzzle.target); assert.equal(puzzle.board.length,16); }
  const s=createState({mode:'puzzles',random:()=>{throw new Error('puzzles have no random deal');}});assert.equal(s.mode,'puzzles');assert.deepEqual(s.board,PUZZLES[0].board);const result=move(s,'left');assert.equal(result.spawned,null);assert.equal(s.board.reduce((a,b)=>a+b,0),16);
});
test('actual slide inputs solve every fixed puzzle within its budget and preserve campaign score', () => {
  const solutions=[['left','up','left','up','left'],['right','up','right','up','left','up'],['left','up','right','up','left','down','left','up','up'],['down','right','up','left','down','left','down','left','up','left'],['up','left','down','right','up','left','up','up','left','left'],['down','left','down','right','up','left','down','right','down','left','down','left','up']];
  const s=createState({mode:'puzzles'});let lastScore=0;
  for(let level=0;level<6;level++) { assert.equal(s.level,level);for(const direction of solutions[level])assert.equal(move(s,direction).changed,true);assert.equal(s.phase,'won');assert.ok(s.board.includes(PUZZLES[level].target));assert.ok(s.moves<=PUZZLES[level].budget);assert.ok(s.score>lastScore);lastScore=s.score;assert.equal(continueGame(s),false);if(level<5){assert.equal(nextPuzzle(s),true);assert.equal(s.undoAvailable,false);assert.equal(undo(s),false);} }
  assert.equal(s.result,'tour');assert.equal(s.puzzlesCleared,6);assert.equal(s.totalMoves,53);assert.equal(nextPuzzle(s),false);
});
test('puzzle undo restores the completion bonus, move budget, and clear count exactly', () => {
  const s=createState({mode:'puzzles'});for(const d of ['left','up','left','up'])move(s,d);const before=structuredClone(s);move(s,'left');assert.equal(s.phase,'won');assert.equal(s.puzzlesCleared,1);assert.equal(undo(s),true);assert.deepEqual(s,{...before,undoAvailable:false});assert.equal(move(s,'left').phase,'won');
});
test('exhausting a puzzle move budget loses and retry resets only the current puzzle', () => {
  const s=createState({mode:'puzzles'});for(const d of ['left','up','left','up','left'])move(s,d);nextPuzzle(s);const score=s.score,total=s.totalMoves;
  for(let i=0;i<30&&s.phase==='playing';i++)move(s,['left','right'][i%2]);assert.equal(s.phase,'lost');assert.equal(s.result,'budget');assert.equal(s.moves,PUZZLES[1].budget);assert.equal(retryPuzzle(s),true);assert.equal(s.level,1);assert.equal(s.score,score);assert.equal(s.totalMoves,total);assert.equal(s.moves,0);assert.equal(s.puzzlesCleared,1);assert.deepEqual(s.board,PUZZLES[1].board);
});
test('puzzle pause blocks budget consumption and preserves board and campaign fields', () => {
  const s=createState({mode:'puzzles'});move(s,'left');togglePause(s);const before=structuredClone(s);assert.equal(move(s,'down').changed,false);assert.deepEqual(s,before);togglePause(s);assert.equal(s.phase,'playing');assert.equal(s.moves,1);
});

// Search the actual engine instead of maintaining a second merge implementation.
const symmetries = Array.from({ length: 8 }, (_, transform) => Array.from({ length: 16 }, (_, index) => {
  let x = index % 4, y = Math.floor(index / 4);
  if (transform >= 4) x = 3 - x;
  for (let turn = 0; turn < transform % 4; turn++) [x, y] = [3 - y, x];
  return y * 4 + x;
}));
const puzzleKey = board => symmetries.map(indices => indices.map(index => board[index]).join(',')).sort()[0];
function solveMaster(level) {
  const start = MASTER_PUZZLES[level].board;
  const queue = [{ board: start, path: [] }], seen = new Set([puzzleKey(start)]);
  for (const current of queue) for (const direction of ['left', 'up', 'right', 'down']) {
    const candidate = createState({ mode: 'master', random: () => { throw new Error('Master never deals random tiles'); } });
    candidate.board = [...current.board]; candidate.level = level; candidate.moves = current.path.length;
    const result = move(candidate, direction);
    if (!result.changed) continue;
    const path = [...current.path, direction];
    if (candidate.phase === 'won') return path;
    if (candidate.phase !== 'playing') continue;
    const key = puzzleKey(candidate.board);
    if (!seen.has(key)) { seen.add(key); queue.push({ board: candidate.board, path }); }
    assert.ok(seen.size < 50_000, 'the fixed trial must have a tractable proof');
  }
  throw new Error(`Master trial ${level + 1} is unsolvable within its budget`);
}

test('every dense Master trial is solver-proven with progressively demanding optimal lengths', () => {
  const optimal = [9, 11, 12, 13, 15, 17], state = createState({ mode: 'master' });
  let previousScore = 0;
  for (let level = 0; level < MASTER_PUZZLES.length; level++) {
    const puzzle = MASTER_PUZZLES[level];
    assert.equal(puzzle.board.length, 16); assert.ok(puzzle.board.every(value => value > 0));
    assert.equal(puzzle.board.reduce((sum, value) => sum + value, 0), puzzle.target);
    const solution = solveMaster(level);
    assert.equal(solution.length, optimal[level]);
    assert.equal(puzzle.budget, optimal[level] + (level === 0 ? 1 : 0));
    for (const direction of solution) { const result = move(state, direction); assert.equal(result.changed, true); assert.equal(result.spawned, null); }
    assert.equal(state.phase, 'won'); assert.ok(state.board.includes(puzzle.target));
    assert.ok(state.score > previousScore); previousScore = state.score;
    assert.equal(continueGame(state), false);
    if (level < MASTER_PUZZLES.length - 1) { assert.equal(nextPuzzle(state), true); assert.equal(undo(state), false); }
  }
  assert.equal(state.totalMoves, 77); assert.equal(state.puzzlesCleared, 6); assert.equal(state.result, 'tour');
  assert.equal(nextPuzzle(state), false);
});

test('Master budgets, loss undo, retry and pause preserve the exact fixed trial', () => {
  const state = createState({ mode: 'master' });
  move(state, 'left'); togglePause(state); const paused = structuredClone(state);
  assert.equal(move(state, 'down').changed, false); assert.deepEqual(state, paused); togglePause(state);
  while (state.phase === 'playing') move(state, state.moves % 2 ? 'right' : 'left');
  assert.equal(state.result, 'budget'); assert.equal(state.moves, 10);
  assert.equal(undo(state), true); assert.equal(state.phase, 'playing'); assert.equal(state.moves, 9);
  move(state, 'right'); assert.equal(state.phase, 'lost');
  assert.equal(retryPuzzle(state), true); assert.deepEqual(state.board, MASTER_PUZZLES[0].board);
  assert.equal(state.moves, 0); assert.equal(state.score, 0); assert.equal(state.totalMoves, 0);
  assert.equal(state.undoAvailable, false); assert.equal(state.mode, 'master');
});
