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
const gatedWall = (x, gaps, width = 1) => block(x, 2, width, 15).filter(cell => !gaps.includes(cell.y));
const hedgeRow = (y, gap) => block(2, y, 16, 1).filter(cell => !gap.includes(cell.x));
// The bottom two rows remain a protected starting corridor. All other floor
// tiles belong to one connected component; every gate is at least two tiles wide.
export const GAUNTLET = Object.freeze([
  { title: 'Split Courtyards', obstacles: [4, 12].flatMap(x => [3, 11].flatMap(y => block(x, y, 4, 4))) },
  { title: 'Alternating Gates', obstacles: [...gatedWall(5, [4, 5]), ...gatedWall(10, [12, 13]), ...gatedWall(15, [7, 8])] },
  { title: 'The Stone Arcade', obstacles: [3, 7, 11, 15].flatMap(x => [2, 6, 10, 14].flatMap(y => block(x, y, 2, 2))) },
  { title: 'Switchback Hedges', obstacles: [4, 8, 12, 16].flatMap((y, i) => hedgeRow(y, i % 2 ? [14, 15] : [4, 5])) },
  { title: 'Crosswind Locks', obstacles: [...gatedWall(5, [6, 7, 14, 15], 2), ...gatedWall(12, [3, 4, 10, 11], 2), ...block(8, 8, 2, 4)] },
  { title: 'The Final Braid', obstacles: [...gatedWall(4, [4, 5], 2), ...gatedWall(9, [12, 13], 2), ...gatedWall(14, [7, 8], 2)] },
].map((garden, level) => Object.freeze({ ...garden, goal: 18 + level * 4, speed: 115 - level * 5, startLength: 8 + level * 2, obstacles: Object.freeze(garden.obstacles.map(Object.freeze)) })));
export const GAUNTLET_FRUIT_GOAL = GAUNTLET.reduce((sum, garden) => sum + garden.goal, 0);
export const gardenLevels = mode => mode === 'gauntlet' ? GAUNTLET : GARDENS;

const DIRECTIONS = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
const directionVectors = Object.values(DIRECTIONS);
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const randomSources = new WeakMap();
const sameCell = (a, b) => a.x === b.x && a.y === b.y;

function placeFood(state) {
  const occupied = new Set([...state.snake, ...(state.obstacles || [])].map(cell => cell.y * state.width + cell.x));
  const permanentWalls = new Set((state.obstacles || []).map(cell => cell.y * state.width + cell.x));
  const walls = new Set(permanentWalls);
  if (state.mode === 'gauntlet') for (const cell of state.snake.slice(1, -1)) walls.add(cell.y * state.width + cell.x);
  function floorDistances(blocked) {
    const head = state.snake[0], distances = new Map([[head.y * state.width + head.x, 0]]), queue = [head];
    for (const cell of queue) for (const { x: dx, y: dy } of directionVectors) {
      const x = cell.x + dx, y = cell.y + dy, key = y * state.width + x;
      if (x < 0 || x >= state.width || y < 0 || y >= state.height || blocked.has(key) || distances.has(key)) continue;
      distances.set(key, distances.get(cell.y * state.width + cell.x) + 1); queue.push({ x, y });
    }
    return distances;
  }
  const foodCells = distances => {
    const cells = [];
    for (let y = 0; y < state.height; y++) for (let x = 0; x < state.width; x++) {
      const key = y * state.width + x;
      if (!occupied.has(key) && distances.has(key)) cells.push({ x, y });
    }
    return cells;
  };
  let distances = floorDistances(walls), available = foodCells(distances);
  // A moving body can temporarily enclose the head. That is not a filled board
  // victory: the tail can release space, or an already trapped trail will crash.
  if (!available.length && state.mode === 'gauntlet') { distances = floorDistances(permanentWalls); available = foodCells(distances); }
  if (!available.length) return null;
  if (state.mode === 'gauntlet') {
    const furthest = Math.max(...available.map(cell => distances.get(cell.y * state.width + cell.x)));
    available = available.filter(cell => distances.get(cell.y * state.width + cell.x) >= Math.min(8, furthest));
  }
  const value = (randomSources.get(state) || Math.random)();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must return a number from 0 up to, but not including, 1');
  const food = available[Math.floor(value * available.length)];
  if (state.mode === 'gauntlet') {
    // The allowance includes a full tail-clearing detour, rather than demanding
    // the static shortest route through a trail that moves every step.
    state.fruitMoves = Math.max(64, distances.get(food.y * state.width + food.x) * 2 + state.snake.length * 2 + 16);
    state.fruitMoveLimit = state.fruitMoves;
  }
  return food;
}

/** Pure, mutable game state. Random sources stay outside the serializable state. */
export function createState({ random = Math.random, mode = 'classic' } = {}) {
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  const state = {
    gameId: 'snake', phase: 'playing', mode: ['gardens', 'gauntlet'].includes(mode) ? mode : 'classic', level: 0, levelFoods: 0, gardensCleared: 0, pausedPhase: null, obstacles: [], width: GRID_SIZE, height: GRID_SIZE,
    snake: [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }],
    direction: 'right', queuedDirection: null, food: null,
    score: 0, foodsEaten: 0, fruitMoves: null, fruitMoveLimit: null, stepMs: START_STEP_MS, ticks: 0, result: null,
  };
  randomSources.set(state, random);
  if (state.mode !== 'classic') startGarden(state, 0);
  else state.food = placeFood(state);
  return state;
}


function startGarden(state, level) {
  state.level = level; state.levelFoods = 0; state.phase = 'playing'; state.result = null;
  state.snake = [{ x: 3, y: 10 }, { x: 2, y: 10 }, { x: 1, y: 10 }, { x: 0, y: 10 }];
  state.direction = 'right'; state.queuedDirection = null;
  const garden = gardenLevels(state.mode)[level];
  if (state.mode === 'gauntlet') {
    const trail = [...Array.from({ length: 4 }, (_, i) => ({ x: 3 - i, y: 18 })), ...Array.from({ length: 16 }, (_, i) => ({ x: i, y: 19 }))];
    state.snake = trail.slice(0, garden.startLength);
  }
  state.obstacles = garden.obstacles.map(c => ({ ...c })); state.stepMs = garden.speed; state.food = placeFood(state);
}
export function advanceGarden(state) {
  if (state.mode === 'classic' || state.phase !== 'levelClear' || state.level >= gardenLevels(state.mode).length - 1) return false;
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
  if (state.mode === 'gauntlet') state.fruitMoves -= 1;
  if (!eating) {
    state.snake.pop();
    if (state.mode === 'gauntlet' && state.fruitMoves <= 0) { state.phase = 'lost'; state.result = 'fruitExpired'; }
  }
  else {
    state.foodsEaten += 1;
    state.score += 10;
    state.levelFoods += 1;
    const garden = gardenLevels(state.mode)[state.level];
    state.stepMs = state.mode === 'gauntlet' ? Math.max(75, garden.speed - state.levelFoods) : state.mode === 'gardens' ? Math.max(95, garden.speed - state.levelFoods * 3) : Math.max(MIN_STEP_MS, START_STEP_MS - state.foodsEaten * 5);
    if (state.mode !== 'classic' && state.levelFoods >= garden.goal) {
      state.gardensCleared += 1; state.score += 50 + state.level * 10; state.food = null;
      state.phase = state.level === gardenLevels(state.mode).length - 1 ? 'won' : 'levelClear'; state.result = state.phase === 'won' ? state.mode : 'garden'; return true;
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
