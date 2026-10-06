export const GRID_SIZE = 20;
export const START_STEP_MS = 150;
export const MIN_STEP_MS = 65;
const block = (x, y, w, h) => Array.from({ length: w * h }, (_, i) => ({ x: x + i % w, y: y + Math.floor(i / w) }));
export const GARDENS = Object.freeze([
  { title: 'Orchard Steps', goal: 3, speed: 170, obstacles: [...block(6, 4, 4, 2), ...block(11, 14, 4, 2)] },
  { title: 'Four Stone Wells', goal: 4, speed: 160, obstacles: [...block(5, 4, 3, 3), ...block(12, 4, 3, 3), ...block(5, 13, 3, 3), ...block(12, 13, 3, 3)] },
  { title: 'Hedge Gates', goal: 5, speed: 150, obstacles: [...block(6, 3, 1, 14).filter(c => ![6, 10, 14].includes(c.y)), ...block(13, 3, 1, 14).filter(c => ![5, 10, 13].includes(c.y))] },
  { title: 'The Lantern Island', goal: 5, speed: 145, obstacles: block(7, 7, 6, 6) },
  { title: 'Stonewind Crossing', goal: 6, speed: 135, obstacles: [...block(5, 3, 3, 4), ...block(10, 8, 3, 4), ...block(15, 13, 2, 4)] },
  { title: 'The Walled Orchard', goal: 7, speed: 125, obstacles: [...block(4, 5, 12, 1).filter(c => [9, 10].every(x => c.x !== x)), ...block(4, 14, 12, 1).filter(c => [9, 10].every(x => c.x !== x)), ...block(5, 7, 1, 6).filter(c => c.y !== 10), ...block(14, 7, 1, 6).filter(c => c.y !== 10)] },
].map(g => Object.freeze({ ...g, obstacles: Object.freeze(g.obstacles.map(Object.freeze)) })));

const DIRECTIONS = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const randomSources = new WeakMap();
const sameCell = (a, b) => a.x === b.x && a.y === b.y;

function placeFood(state) {
  const occupied = new Set([...state.snake, ...(state.obstacles || [])].map(cell => cell.y * state.width + cell.x));
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
export function createState({ random = Math.random, mode = 'classic' } = {}) {
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  const state = {
    gameId: 'snake', phase: 'playing', mode: mode === 'gardens' ? 'gardens' : 'classic', level: 0, levelFoods: 0, gardensCleared: 0, pausedPhase: null, obstacles: [], width: GRID_SIZE, height: GRID_SIZE,
    snake: [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }],
    direction: 'right', queuedDirection: null, food: null,
    score: 0, foodsEaten: 0, stepMs: START_STEP_MS, ticks: 0, result: null,
  };
  randomSources.set(state, random);
  if (state.mode === 'gardens') startGarden(state, 0);
  else state.food = placeFood(state);
  return state;
}


function startGarden(state, level) {
  state.level = level; state.levelFoods = 0; state.phase = 'playing'; state.result = null;
  state.snake = [{ x: 3, y: 10 }, { x: 2, y: 10 }, { x: 1, y: 10 }, { x: 0, y: 10 }];
  state.direction = 'right'; state.queuedDirection = null;
  state.obstacles = GARDENS[level].obstacles.map(c => ({ ...c })); state.stepMs = GARDENS[level].speed; state.food = placeFood(state);
}
export function advanceGarden(state) {
  if (state.mode !== 'gardens' || state.phase !== 'levelClear' || state.level >= GARDENS.length - 1) return false;
  startGarden(state, state.level + 1); return true;
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
  if (state.obstacles?.some(cell => sameCell(cell, head))) { state.phase = 'lost'; state.result = 'hedge'; return true; }
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
    state.levelFoods += 1;
    state.stepMs = state.mode === 'gardens' ? Math.max(95, GARDENS[state.level].speed - state.levelFoods * 3) : Math.max(MIN_STEP_MS, START_STEP_MS - state.foodsEaten * 5);
    if (state.mode === 'gardens' && state.levelFoods >= GARDENS[state.level].goal) {
      state.gardensCleared += 1; state.score += 50 + state.level * 10; state.food = null;
      state.phase = state.level === GARDENS.length - 1 ? 'won' : 'levelClear'; state.result = state.phase === 'won' ? 'gardens' : 'garden'; return true;
    }
    state.food = placeFood(state);
    if (state.food === null) {
      state.phase = 'won';
      state.result = 'filled';
    }
  }
  return true;
}

export function togglePause(state) {
  if (['playing', 'levelClear'].includes(state.phase)) { state.pausedPhase = state.phase; state.phase = 'paused'; }
  else if (state.phase === 'paused') { state.phase = state.pausedPhase || 'playing'; state.pausedPhase = null; }
  else return false;
  return true;
}
