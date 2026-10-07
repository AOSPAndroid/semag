// A deterministic, DOM-free 2048 engine. Randomness and undo history stay private
// so a state can be safely serialized by the shared solo-game shell.
const internals = new WeakMap();
const directions = new Set(['up', 'down', 'left', 'right']);
export const PUZZLES = Object.freeze([
  { title: 'The First Fold', target: 16, budget: 7, board: [0,0,0,0,0,0,0,0,0,0,0,2,4,2,8,0] },
  { title: 'Corner Conversation', target: 32, budget: 8, board: [0,0,8,4,0,2,0,0,0,0,0,0,2,0,16,0] },
  { title: 'Across the Grain', target: 64, budget: 11, board: [2,0,0,4,0,0,0,2,32,16,0,0,0,0,8,0] },
  { title: 'A Longer Thread', target: 128, budget: 12, board: [8,2,0,64,0,0,0,0,32,16,0,0,0,0,2,4] },
  { title: 'The Quiet Reservoir', target: 256, budget: 12, board: [0,0,4,2,128,64,16,0,0,0,8,0,0,0,32,2] },
  { title: 'The Grand Merge', target: 512, budget: 15, board: [128,0,2,16,256,0,0,32,8,0,0,4,0,2,0,64] },
].map(p => Object.freeze({ ...p, board: Object.freeze(p.board) })));
// Dense, fixed boards. Breadth-first search proves an exact route through every
// trial. Rewinds and retries are scarce across the whole six-trial descent.
export const MASTER_PUZZLES = Object.freeze([
  { title: 'The Narrow Opening', target: 256, budget: 17, board: [8,16,4,8,16,32,16,16,2,8,32,2,32,32,16,16] },
  { title: 'A Tangled Thread', target: 1024, budget: 19, board: [2,256,2,64,32,32,8,256,64,128,64,64,8,32,4,8] },
  { title: 'The Broken Stair', target: 2048, budget: 20, board: [4,4,16,128,256,64,64,16,128,128,128,512,512,8,64,16] },
  { title: 'The Deep Reservoir', target: 4096, budget: 21, board: [256,256,8,256,128,32,1024,32,32,128,8,256,128,16,1024,512] },
  { title: 'Across Sixteen Corners', target: 8192, budget: 22, board: [512,2048,256,512,512,64,32,16,512,2048,256,64,16,1024,256,64] },
  { title: 'The Final Fold', target: 16384, budget: 24, board: [1024,512,1024,128,128,32,128,64,1024,2048,4096,4096,512,32,1024,512] },
].map(p => Object.freeze({ ...p, board: Object.freeze(p.board) })));
export const puzzleLevels = mode => mode === 'master' ? MASTER_PUZZLES : PUZZLES;
const isPuzzle = state => state.mode === 'puzzles' || state.mode === 'master';

function snapshot(state) {
  return {
    board: [...state.board], score: state.score, phase: state.phase,
    won: state.won, continued: state.continued, moves: state.moves, totalMoves: state.totalMoves, puzzlesCleared: state.puzzlesCleared, result: state.result,
  };
}

function spawn(state) {
  const empty = state.board.flatMap((value, index) => value === 0 ? [index] : []);
  if (!empty.length) return null;
  const random = internals.get(state).random;
  const index = empty[Math.min(empty.length - 1, Math.floor(random() * empty.length))];
  const value = random() < 0.9 ? 2 : 4;
  state.board[index] = value;
  return { index, value };
}

export function createState({ random = Math.random, mode = 'classic' } = {}) {
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  const state = {
    gameId: '2048', mode: ['puzzles', 'master'].includes(mode) ? mode : 'classic', level: 0, totalMoves: 0, puzzlesCleared: 0, levelStartScore: 0, levelStartMoves: 0, result: null, board: Array(16).fill(0), score: 0, phase: 'playing',
    won: false, continued: false, undoAvailable: false, moves: 0,
    rewindsLeft: mode === 'master' ? 2 : null, retriesLeft: mode === 'master' ? 2 : null,
  };
  internals.set(state, { random, previous: null });
  if (isPuzzle(state)) state.board = [...puzzleLevels(state.mode)[0].board];
  else { spawn(state); spawn(state); }
  return state;
}

export function hasMoves(state) {
  const board = state.board;
  for (let index = 0; index < 16; index += 1) {
    if (board[index] === 0) return true;
    if (index % 4 < 3 && board[index] === board[index + 1]) return true;
    if (index < 12 && board[index] === board[index + 4]) return true;
  }
  return false;
}

function lineIndexes(direction, line) {
  return Array.from({ length: 4 }, (_, offset) => {
    if (direction === 'left') return line * 4 + offset;
    if (direction === 'right') return line * 4 + 3 - offset;
    if (direction === 'up') return offset * 4 + line;
    return (3 - offset) * 4 + line;
  });
}

export function move(state, direction) {
  const unchanged = () => ({ changed: false, score: state.score, phase: state.phase, merged: [], spawned: null });
  if (state.phase !== 'playing' || !directions.has(direction)) return unchanged();
  const next = Array(16).fill(0);
  const merged = [];
  let gained = 0;
  for (let line = 0; line < 4; line += 1) {
    const indexes = lineIndexes(direction, line);
    const values = indexes.map(index => state.board[index]).filter(Boolean);
    let target = 0;
    for (let source = 0; source < values.length; source += 1) {
      let value = values[source];
      if (values[source + 1] === value) {
        value *= 2;
        gained += value;
        source += 1;
        merged.push(indexes[target]);
      }
      next[indexes[target]] = value;
      target += 1;
    }
  }
  if (next.every((value, index) => value === state.board[index])) return unchanged();
  const data = internals.get(state);
  data.previous = snapshot(state);
  state.board = next;
  state.score += gained;
  state.moves += 1; state.totalMoves += 1;
  state.undoAvailable = state.mode !== 'master' || state.rewindsLeft > 0;
  const spawned = isPuzzle(state) ? null : spawn(state);
  const puzzle = puzzleLevels(state.mode)[state.level];
  const target = isPuzzle(state) ? puzzle.target : 2048;
  state.won = state.won || state.board.some(value => value >= target);
  if (isPuzzle(state)) {
    if (state.won) {
      state.phase = 'won'; state.puzzlesCleared++; state.score += 100 + Math.max(0, puzzle.budget - state.moves) * 25;
      state.result = state.level === puzzleLevels(state.mode).length - 1 ? 'tour' : 'puzzle';
      if (state.mode === 'master' && state.result === 'tour') {
        state.score += state.rewindsLeft * 250 + state.retriesLeft * 500;
        state.undoAvailable = false; data.previous = null;
      }
    }
    else if (state.moves >= puzzle.budget) { state.phase = 'lost'; state.result = 'budget'; }
    else if (!hasMoves(state)) { state.phase = 'lost'; state.result = 'blocked'; }
    return { changed: true, score: state.score, phase: state.phase, gained, merged, spawned };
  }
  if (state.won && !state.continued) state.phase = 'won';
  else if (!hasMoves(state)) state.phase = 'lost';
  return { changed: true, score: state.score, phase: state.phase, gained, merged, spawned };
}

export function undo(state) {
  const data = internals.get(state);
  if (!data?.previous || !state.undoAvailable) return false;
  if (state.mode === 'master' && (state.phase === 'paused' || state.rewindsLeft <= 0)) return false;
  if (state.mode === 'master') state.rewindsLeft--;
  Object.assign(state, data.previous, { board: [...data.previous.board], undoAvailable: false });
  data.previous = null;
  return true;
}

export function togglePause(state) {
  if (state.phase === 'playing') state.phase = 'paused';
  else if (state.phase === 'paused') state.phase = 'playing';
  else return false;
  return true;
}

export function continueGame(state) {
  if (state.phase !== 'won' || isPuzzle(state)) return false;
  state.continued = true;
  state.phase = hasMoves(state) ? 'playing' : 'lost';
  return true;
}

/** Move to the next fixed puzzle. Undo never crosses a level boundary. */
export function nextPuzzle(state) {
  if (!isPuzzle(state) || state.phase !== 'won' || state.level >= puzzleLevels(state.mode).length - 1) return false;
  state.levelStartScore = state.score; state.levelStartMoves = state.totalMoves;
  state.level++; state.board = [...puzzleLevels(state.mode)[state.level].board]; state.moves = 0;
  state.won = false; state.continued = false; state.phase = 'playing'; state.result = null; state.undoAvailable = false;
  internals.get(state).previous = null; return true;
}

export function retryPuzzle(state) {
  if (!isPuzzle(state) || state.phase !== 'lost') return false;
  if (state.mode === 'master') {
    if (state.retriesLeft <= 0) return false;
    state.retriesLeft--;
  }
  state.board = [...puzzleLevels(state.mode)[state.level].board]; state.moves = 0;
  state.score = state.levelStartScore; state.totalMoves = state.levelStartMoves;
  state.won = false; state.phase = 'playing'; state.result = null; state.undoAvailable = false;
  internals.get(state).previous = null; return true;
}
