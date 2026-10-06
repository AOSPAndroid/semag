// A deterministic, DOM-free 2048 engine. Randomness and undo history stay private
// so a state can be safely serialized by the shared solo-game shell.
const internals = new WeakMap();
const directions = new Set(['up', 'down', 'left', 'right']);

function snapshot(state) {
  return {
    board: [...state.board], score: state.score, phase: state.phase,
    won: state.won, continued: state.continued, moves: state.moves,
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

export function createState({ random = Math.random } = {}) {
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  const state = {
    board: Array(16).fill(0), score: 0, phase: 'playing',
    won: false, continued: false, undoAvailable: false, moves: 0,
  };
  internals.set(state, { random, previous: null });
  spawn(state);
  spawn(state);
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
  state.moves += 1;
  state.undoAvailable = true;
  const spawned = spawn(state);
  state.won = state.won || state.board.some(value => value >= 2048);
  if (state.won && !state.continued) state.phase = 'won';
  else if (!hasMoves(state)) state.phase = 'lost';
  return { changed: true, score: state.score, phase: state.phase, gained, merged, spawned };
}

export function undo(state) {
  const data = internals.get(state);
  if (!data?.previous || !state.undoAvailable) return false;
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
  if (state.phase !== 'won') return false;
  state.continued = true;
  state.phase = hasMoves(state) ? 'playing' : 'lost';
  return true;
}
