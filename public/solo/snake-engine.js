export const GRID_SIZE = 20;
export const START_STEP_MS = 150;
export const MIN_STEP_MS = 65;

const DIRECTIONS = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const randomSources = new WeakMap();
const sameCell = (a, b) => a.x === b.x && a.y === b.y;

function placeFood(state) {
  const occupied = new Set(state.snake.map(cell => cell.y * state.width + cell.x));
  const available = [];
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      if (!occupied.has(y * state.width + x)) available.push({ x, y });
    }
  }
  if (!available.length) return null;
  const value = (randomSources.get(state) || Math.random)();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('random must return a number from 0 up to, but not including, 1');
  }
  return available[Math.floor(value * available.length)];
}

/** Pure, mutable game state. Random sources stay outside the serializable state. */
export function createState({ random = Math.random } = {}) {
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  const state = {
    gameId: 'snake', phase: 'playing', width: GRID_SIZE, height: GRID_SIZE,
    snake: [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }],
    direction: 'right', queuedDirection: null, food: null,
    score: 0, foodsEaten: 0, stepMs: START_STEP_MS, ticks: 0, result: null,
  };
  randomSources.set(state, random);
  state.food = placeFood(state);
  return state;
}

/** Queue at most one real turn between steps; a reverse turn is never legal. */
export function turn(state, direction) {
  if (state.phase !== 'playing' || !Object.hasOwn(DIRECTIONS, direction)
    || state.queuedDirection !== null || direction === state.direction
    || direction === OPPOSITE[state.direction]) return false;
  state.queuedDirection = direction;
  return true;
}

export function step(state) {
  if (state.phase !== 'playing') return false;
  state.direction = state.queuedDirection || state.direction;
  state.queuedDirection = null;
  state.ticks += 1;
  const vector = DIRECTIONS[state.direction];
  const head = { x: state.snake[0].x + vector.x, y: state.snake[0].y + vector.y };
  if (head.x < 0 || head.x >= state.width || head.y < 0 || head.y >= state.height) {
    state.phase = 'lost';
    state.result = 'wall';
    return true;
  }
  const eating = state.food !== null && sameCell(head, state.food);
  // When moving normally, the last tail tile is vacated in the same step.
  const collisionBody = eating ? state.snake : state.snake.slice(0, -1);
  if (collisionBody.some(cell => sameCell(cell, head))) {
    state.phase = 'lost';
    state.result = 'self';
    return true;
  }
  state.snake.unshift(head);
  if (!eating) state.snake.pop();
  else {
    state.foodsEaten += 1;
    state.score += 10;
    state.stepMs = Math.max(MIN_STEP_MS, START_STEP_MS - state.foodsEaten * 5);
    state.food = placeFood(state);
    if (state.food === null) {
      state.phase = 'won';
      state.result = 'filled';
    }
  }
  return true;
}

export function togglePause(state) {
  if (state.phase === 'playing') state.phase = 'paused';
  else if (state.phase === 'paused') state.phase = 'playing';
  else return false;
  return true;
}
