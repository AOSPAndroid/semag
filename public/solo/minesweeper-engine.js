/** Local Minesweeper rules. The clock is advanced explicitly by the view. */
export const DIFFICULTIES = Object.freeze({
  beginner: Object.freeze({ rows: 9, cols: 9, mines: 10, label: 'Beginner' }),
  intermediate: Object.freeze({ rows: 16, cols: 16, mines: 40, label: 'Intermediate' }),
  expert: Object.freeze({ rows: 16, cols: 30, mines: 99, label: 'Expert' }),
});

const randomSources = new WeakMap();
const rejected = error => ({ ok: false, error });
const validIndex = (state, index) => Number.isInteger(index) && index >= 0 && index < state.cells.length;

export function createState({ rows = 9, cols = 9, mines = 10, random = Math.random } = {}) {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 2 || cols < 2 || rows > 32 || cols > 32) {
    throw new RangeError('The board must have between 2 and 32 rows and columns.');
  }
  if (!Number.isInteger(mines) || mines < 1 || mines >= rows * cols) {
    throw new RangeError('The mine count must be positive and smaller than the board.');
  }
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  const difficulty = Object.entries(DIFFICULTIES).find(([, value]) => value.rows === rows && value.cols === cols && value.mines === mines)?.[0] || 'custom';
  const state = {
    rows, cols, mines, difficulty, phase: 'playing', generated: false,
    elapsed: 0, opened: 0, flags: 0, exploded: null, revision: 0,
    cells: Array.from({ length: rows * cols }, () => ({ mine: false, adjacent: 0, revealed: false, flagged: false })),
  };
  randomSources.set(state, random);
  return state;
}

export function neighbors(state, index) {
  if (!validIndex(state, index)) return [];
  const row = Math.floor(index / state.cols);
  const col = index % state.cols;
  const result = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const y = row + dy;
      const x = col + dx;
      if ((dx || dy) && y >= 0 && y < state.rows && x >= 0 && x < state.cols) result.push(y * state.cols + x);
    }
  }
  return result;
}

function placeMines(state, firstIndex) {
  let excluded = new Set([firstIndex, ...neighbors(state, firstIndex)]);
  // Dense custom boards still guarantee a safe first tile.
  if (state.cells.length - excluded.size < state.mines) excluded = new Set([firstIndex]);
  const candidates = state.cells.flatMap((_, index) => excluded.has(index) ? [] : [index]);
  const random = randomSources.get(state) || Math.random;
  for (let index = 0; index < state.mines; index += 1) {
    const sample = Number(random());
    const unit = Number.isFinite(sample) ? Math.max(0, Math.min(1 - Number.EPSILON, sample)) : 0;
    const other = index + Math.floor(unit * (candidates.length - index));
    [candidates[index], candidates[other]] = [candidates[other], candidates[index]];
    state.cells[candidates[index]].mine = true;
  }
  for (const [index, cell] of state.cells.entries()) {
    cell.adjacent = neighbors(state, index).filter(other => state.cells[other].mine).length;
  }
  state.generated = true;
}

function openSafeTiles(state, start) {
  const queue = [start];
  const queued = new Set(queue);
  for (let position = 0; position < queue.length; position += 1) {
    const index = queue[position];
    const cell = state.cells[index];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    state.opened += 1;
    if (cell.adjacent) continue;
    for (const other of neighbors(state, index)) {
      if (!queued.has(other)) { queued.add(other); queue.push(other); }
    }
  }
}

function finishIfWon(state) {
  if (state.opened === state.cells.length - state.mines) state.phase = 'won';
}

function explode(state, index) {
  state.phase = 'lost';
  state.exploded = index;
  for (const cell of state.cells) if (cell.mine) cell.revealed = true;
}

export function reveal(state, index) {
  if (state.phase !== 'playing') return rejected('Resume or start a new board to play.');
  if (!validIndex(state, index)) return rejected('Choose a tile on the board.');
  const cell = state.cells[index];
  if (cell.flagged) return rejected('Remove the flag before revealing this tile.');
  if (cell.revealed) return rejected('This tile is already open.');
  if (!state.generated) placeMines(state, index);
  if (cell.mine) explode(state, index);
  else { openSafeTiles(state, index); finishIfWon(state); }
  state.revision += 1;
  return { ok: true };
}

export function flag(state, index) {
  if (state.phase !== 'playing') return rejected('Resume or start a new board to play.');
  if (!validIndex(state, index)) return rejected('Choose a tile on the board.');
  const cell = state.cells[index];
  if (cell.revealed) return rejected('Open tiles cannot be flagged.');
  cell.flagged = !cell.flagged;
  state.flags += cell.flagged ? 1 : -1;
  state.revision += 1;
  return { ok: true };
}

/** Reveal around a number after placing exactly that many adjacent flags. */
export function chord(state, index) {
  if (state.phase !== 'playing') return rejected('Resume or start a new board to play.');
  if (!validIndex(state, index)) return rejected('Choose a tile on the board.');
  const cell = state.cells[index];
  if (!cell.revealed || !cell.adjacent || cell.mine) return rejected('Chord an open numbered tile.');
  const adjacent = neighbors(state, index);
  if (adjacent.filter(other => state.cells[other].flagged).length !== cell.adjacent) {
    return rejected(`Place ${cell.adjacent} adjacent ${cell.adjacent === 1 ? 'flag' : 'flags'} before opening around this number.`);
  }
  const covered = adjacent.filter(other => !state.cells[other].flagged && !state.cells[other].revealed);
  if (!covered.length) return rejected('All unflagged neighboring tiles are already open.');
  for (const other of covered) {
    if (state.cells[other].mine) { explode(state, other); break; }
    openSafeTiles(state, other);
  }
  if (state.phase === 'playing') finishIfWon(state);
  state.revision += 1;
  return { ok: true };
}

export function togglePause(state) {
  if (state.phase !== 'playing' && state.phase !== 'paused') return rejected('Start a new board to play again.');
  state.phase = state.phase === 'playing' ? 'paused' : 'playing';
  state.revision += 1;
  return { ok: true };
}

export function advanceTime(state, seconds) {
  if (state.phase === 'playing' && state.generated && Number.isFinite(seconds) && seconds > 0) state.elapsed += seconds;
  return state.elapsed;
}

export function getStats(state) {
  return { opened: state.opened, safe: state.cells.length - state.mines, flags: state.flags, remaining: state.mines - state.flags, elapsed: state.elapsed };
}

export const cloneState = state => JSON.parse(JSON.stringify(state));
