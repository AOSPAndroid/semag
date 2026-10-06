/** Prism Shift: deterministic falling blocks, with SRS kicks and bounded lock resets. */
export const WIDTH = 10;
export const VISIBLE_HEIGHT = 20;
export const HIDDEN_ROWS = 4;
export const HEIGHT = VISIBLE_HEIGHT + HIDDEN_ROWS;
export const LOCK_DELAY = 0.5;
export const MAX_LOCK_RESETS = 15;
export const SOFT_DROP_SECONDS = 0.035;
export const SPRINT_LINES = 40;
export const TYPES = Object.freeze(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);

const SPAWN_SHAPES = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
};
export const SHAPES = Object.freeze(Object.fromEntries(TYPES.map(type => {
  const rotations = [SPAWN_SHAPES[type].map(([x, y]) => ({ x, y }))];
  for (let index = 1; index < 4; index += 1) {
    const size = type === 'I' || type === 'O' ? 4 : 3;
    rotations.push(type === 'O' ? rotations[0].map(cell => ({ ...cell }))
      : rotations[index - 1].map(({ x, y }) => ({ x: size - 1 - y, y: x })));
  }
  return [type, Object.freeze(rotations.map(rotation => Object.freeze(rotation.map(Object.freeze))))];
})));

// SRS offsets are defined with positive y pointing up; convert on application.
const KICKS = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const I_KICKS = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};
const randomSources = new WeakMap();
const EPSILON = 1e-10;

function shuffledBag(state) {
  const bag = [...TYPES];
  const random = randomSources.get(state) || Math.random;
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('random must return a number from 0 up to, but not including, 1');
    }
    const target = Math.floor(value * (index + 1));
    [bag[index], bag[target]] = [bag[target], bag[index]];
  }
  return bag;
}
function refillQueue(state) {
  while (state.next.length < 6) state.next.push(...shuffledBag(state));
}
export function pieceCells(piece) {
  if (!piece || !Object.hasOwn(SHAPES, piece.type) || !Number.isInteger(piece.rotation)
    || piece.rotation < 0 || piece.rotation > 3) return [];
  return SHAPES[piece.type][piece.rotation].map(({ x, y }) => ({ x: piece.x + x, y: piece.y + y }));
}
export function collides(state, piece) {
  const cells = pieceCells(piece);
  return cells.length !== 4 || cells.some(({ x, y }) => !Number.isInteger(x) || !Number.isInteger(y)
    || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || state.board[y][x] !== null);
}
export function ghostPiece(state) {
  if (!state.active || collides(state, state.active)) return null;
  const ghost = { ...state.active };
  while (!collides(state, { ...ghost, y: ghost.y + 1 })) ghost.y += 1;
  return ghost;
}
export function gravitySeconds(level) {
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.min(30, Math.floor(level))) : 1;
  return Math.max(0.035, (0.8 - (safeLevel - 1) * 0.007) ** (safeLevel - 1));
}
export function isGrounded(state) {
  return Boolean(state.active && collides(state, { ...state.active, y: state.active.y + 1 }));
}
function spawn(state, type, usedHold = false) {
  state.active = { type, x: 3, y: HIDDEN_ROWS - 1, rotation: 0 };
  state.holdUsed = usedHold;
  state.lockElapsed = 0;
  state.lockResets = 0;
  state.gravityElapsed = 0;
  state.lastMove = 'spawn';
  state.lastRotation = null;
  if (collides(state, state.active)) {
    state.phase = 'lost';
    state.result = 'block-out';
  }
}
function spawnNext(state) {
  refillQueue(state);
  const type = state.next.shift();
  refillQueue(state);
  spawn(state, type);
}
export function createState({ mode = 'marathon', random = Math.random } = {}) {
  if (mode !== 'marathon' && mode !== 'sprint') throw new RangeError('mode must be marathon or sprint');
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  const state = {
    gameId: 'prism-shift', mode, phase: 'playing', width: WIDTH, height: HEIGHT, hiddenRows: HIDDEN_ROWS,
    board: Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null)),
    active: null, hold: null, holdUsed: false, next: [],
    score: 0, lines: 0, level: 1, elapsed: 0, piecesLocked: 0,
    combo: -1, backToBack: false, lastClear: null,
    gravityElapsed: 0, lockElapsed: 0, lockResets: 0,
    lastMove: 'spawn', lastRotation: null, result: null,
  };
  randomSources.set(state, random);
  spawnNext(state);
  return state;
}
function resetLockAfterAction(state, wasGrounded) {
  if (wasGrounded && state.lockResets < MAX_LOCK_RESETS) {
    state.lockElapsed = 0;
    state.lockResets += 1;
  }
}
function move(state, dx, dy, { scoreDrop = false, resetLock = false } = {}) {
  const candidate = { ...state.active, x: state.active.x + dx, y: state.active.y + dy };
  if (collides(state, candidate)) return false;
  const wasGrounded = isGrounded(state);
  state.active = candidate;
  state.lastMove = dx ? 'move' : 'drop';
  state.lastRotation = null;
  if (resetLock) resetLockAfterAction(state, wasGrounded);
  if (scoreDrop) state.score += dy;
  return true;
}
function rotate(state, direction) {
  if (state.active.type === 'O') return false;
  const from = state.active.rotation;
  const to = (from + direction + 4) % 4;
  const tests = (state.active.type === 'I' ? I_KICKS : KICKS)[`${from}>${to}`];
  const wasGrounded = isGrounded(state);
  for (let index = 0; index < tests.length; index += 1) {
    const [dx, dyUp] = tests[index];
    const candidate = { ...state.active, x: state.active.x + dx, y: state.active.y - dyUp, rotation: to };
    if (collides(state, candidate)) continue;
    state.active = candidate;
    state.lastMove = 'rotate';
    state.lastRotation = { from, to, kickIndex: index };
    resetLockAfterAction(state, wasGrounded);
    return true;
  }
  return false;
}
function spinKind(state) {
  if (state.active.type !== 'T' || state.lastMove !== 'rotate' || !state.lastRotation) return null;
  const cx = state.active.x + 1;
  const cy = state.active.y + 1;
  const occupied = (x, y) => x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || state.board[y][x] !== null;
  // Clockwise corners: top left, top right, bottom right, bottom left.
  const corners = [occupied(cx - 1, cy - 1), occupied(cx + 1, cy - 1),
    occupied(cx + 1, cy + 1), occupied(cx - 1, cy + 1)];
  if (corners.filter(Boolean).length < 3) return null;
  const front = state.active.rotation;
  return corners[front] && corners[(front + 1) % 4] || state.lastRotation.kickIndex === 4 ? 'full' : 'mini';
}
function lockPiece(state) {
  const cells = pieceCells(state.active);
  const spin = spinKind(state);
  for (const { x, y } of cells) state.board[y][x] = state.active.type;
  const keptRows = state.board.filter(row => row.some(value => value === null));
  const cleared = HEIGHT - keptRows.length;
  state.board = [...Array.from({ length: cleared }, () => Array(WIDTH).fill(null)), ...keptRows];
  const difficult = cleared > 0 && (cleared === 4 || spin !== null);
  const chained = difficult && state.backToBack;
  const regular = [0, 100, 300, 500, 800];
  const fullSpin = [400, 800, 1200, 1600];
  const miniSpin = [100, 200, 400];
  let base = spin === 'full' ? fullSpin[cleared] : spin === 'mini' ? miniSpin[cleared] : regular[cleared];
  base = base || 0;
  if (chained) base *= 1.5;
  state.combo = cleared ? state.combo + 1 : -1;
  const points = (base + Math.max(0, state.combo) * 50) * state.level;
  state.score += points;
  if (difficult) state.backToBack = true;
  else if (cleared) state.backToBack = false;
  state.lines += cleared;
  state.level = 1 + Math.floor(state.lines / 10);
  state.piecesLocked += 1;
  const lineLabels = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];
  const label = spin ? `T-SPIN${spin === 'mini' ? ' MINI' : ''}${cleared ? ` ${lineLabels[cleared]}` : ''}`
    : lineLabels[cleared] || '';
  state.lastClear = { id: state.piecesLocked, lines: cleared, spin, label, points,
    combo: state.combo, backToBack: chained, time: state.elapsed };
  if (state.mode === 'sprint' && state.lines >= SPRINT_LINES) {
    state.phase = 'won';
    state.result = 'forty-lines';
    state.active = null;
    return;
  }
  if (!cleared && cells.every(({ y }) => y < HIDDEN_ROWS)) {
    state.phase = 'lost';
    state.result = 'lock-out';
    state.active = null;
    return;
  }
  spawnNext(state);
}
/** Immediate edge-triggered actions. The view owns keyboard DAS/ARR. */
export function dispatch(state, action) {
  if (state.phase !== 'playing' || !state.active || typeof action !== 'string') return false;
  switch (action) {
    case 'left': return move(state, -1, 0, { resetLock: true });
    case 'right': return move(state, 1, 0, { resetLock: true });
    case 'rotate-cw': return rotate(state, 1);
    case 'rotate-ccw': return rotate(state, -1);
    case 'soft-drop': return move(state, 0, 1, { scoreDrop: true });
    case 'hard-drop': {
      const ghost = ghostPiece(state);
      if (!ghost) return false;
      const distance = ghost.y - state.active.y;
      state.score += distance * 2;
      if (distance) { state.lastMove = 'drop'; state.lastRotation = null; }
      state.active = ghost;
      lockPiece(state);
      return true;
    }
    case 'hold': {
      if (state.holdUsed) return false;
      const held = state.hold;
      state.hold = state.active.type;
      if (held === null) spawnNext(state);
      else spawn(state, held);
      state.holdUsed = true;
      return true;
    }
    default: return false;
  }
}
/** Advance in seconds. Invalid deltas cannot change the state or gameplay clocks. */
export function step(state, input = {}, dt = 1 / 120) {
  if (state.phase !== 'playing' || !state.active || !Number.isFinite(dt) || dt <= 0 || dt > 1) return false;
  let remaining = dt;
  const softDrop = input?.softDrop === true;
  while (remaining > EPSILON && state.phase === 'playing') {
    const interval = softDrop ? Math.min(gravitySeconds(state.level), SOFT_DROP_SECONDS) : gravitySeconds(state.level);
    const grounded = isGrounded(state);
    const untilGravity = Math.max(0, interval - state.gravityElapsed);
    const untilLock = grounded ? Math.max(0, LOCK_DELAY - state.lockElapsed) : Infinity;
    const advance = Math.min(remaining, untilGravity, untilLock);
    state.elapsed += advance;
    state.gravityElapsed += advance;
    if (grounded) state.lockElapsed += advance;
    remaining -= advance;
    if (grounded && state.lockElapsed >= LOCK_DELAY - EPSILON) {
      lockPiece(state);
      continue;
    }
    if (state.gravityElapsed >= interval - EPSILON) {
      state.gravityElapsed = 0;
      move(state, 0, 1, { scoreDrop: softDrop });
      continue;
    }
    if (advance <= EPSILON) break;
  }
  return true;
}
export function togglePause(state) {
  if (state.phase === 'playing') state.phase = 'paused';
  else if (state.phase === 'paused') state.phase = 'playing';
  else return false;
  return true;
}
