import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, turn, step, togglePause, GRID_SIZE, START_STEP_MS, MIN_STEP_MS } from '../public/solo/snake-engine.js';

function seeded(seed = 1) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const clone = state => JSON.parse(JSON.stringify(state));
const cell = (x, y) => ({ x, y });

test('snake starts with a clean serializable grid, safe food, and reproducible seeded placement', () => {
  const state = createState({ random: seeded(17) });
  assert.deepEqual(state, createState({ random: seeded(17) }));
  assert.deepEqual(state, clone(state));
  assert.equal(state.phase, 'playing');
  assert.equal(state.width, GRID_SIZE);
  assert.equal(state.height, GRID_SIZE);
  assert.equal(state.score, 0);
  assert.equal(state.snake.length, 4);
  assert.equal(state.direction, 'right');
  assert.equal(state.stepMs, START_STEP_MS);
  assert.ok(!state.snake.some(segment => segment.x === state.food.x && segment.y === state.food.y));
  assert.throws(() => createState({ random: 3 }), /random/);
  for (const value of [-.1, 1, NaN, Infinity]) assert.throws(() => createState({ random: () => value }), /random/);
});

test('each step advances exactly one tile without growing when no fruit is eaten', () => {
  const state = createState({ random: () => 0 });
  const body = clone(state).snake;
  assert.equal(step(state), true);
  assert.deepEqual(state.snake, [cell(10, 10), ...body.slice(0, -1)]);
  assert.equal(state.ticks, 1);
  assert.equal(state.score, 0);
});

test('a single queued turn prevents both immediate reversal and rapid double-turn reversal', () => {
  const state = createState({ random: () => 0 });
  const before = clone(state);
  assert.equal(turn(state, 'left'), false);
  assert.equal(turn(state, 'right'), false);
  assert.equal(turn(state, 'unknown'), false);
  assert.deepEqual(state, before);
  assert.equal(turn(state, 'up'), true);
  assert.equal(turn(state, 'left'), false);
  assert.equal(state.queuedDirection, 'up');
  step(state);
  assert.deepEqual(state.snake[0], cell(9, 9));
  assert.equal(state.direction, 'up');
  assert.equal(state.queuedDirection, null);
  assert.equal(turn(state, 'left'), true);
  step(state);
  assert.deepEqual(state.snake[0], cell(8, 9));
});

test('food adds a tail tile, ten points, safe new food, and faster pacing down to a floor', () => {
  const state = createState({ random: seeded(3) });
  state.food = cell(10, 10);
  step(state);
  assert.equal(state.snake.length, 5);
  assert.equal(state.foodsEaten, 1);
  assert.equal(state.score, 10);
  assert.equal(state.stepMs, START_STEP_MS - 5);
  assert.ok(!state.snake.some(segment => segment.x === state.food.x && segment.y === state.food.y));
  state.snake = [cell(0, 0)];
  state.foodsEaten = 99;
  state.food = cell(1, 0);
  step(state);
  assert.equal(state.stepMs, MIN_STEP_MS);
});

test('random placement uses every empty tile evenly, including first and last available cells', () => {
  const first = createState({ random: () => 0 });
  const last = createState({ random: () => 1 - Number.EPSILON });
  assert.deepEqual(first.food, cell(0, 0));
  assert.deepEqual(last.food, cell(19, 19));
  const state = createState({ random: () => 0 });
  state.snake = [cell(1, 0), cell(0, 0)];
  state.food = cell(2, 0);
  step(state);
  assert.deepEqual(state.food, cell(3, 0), 'food selection must skip every occupied tile');
});

test('wall collisions end the run and no further moves or pauses alter terminal states', () => {
  const state = createState({ random: () => 0 });
  state.snake = [cell(19, 4), cell(18, 4)];
  step(state);
  assert.equal(state.phase, 'lost');
  assert.equal(state.result, 'wall');
  assert.deepEqual(state.snake, [cell(19, 4), cell(18, 4)]);
  const before = clone(state);
  assert.equal(step(state), false);
  assert.equal(turn(state, 'up'), false);
  assert.equal(togglePause(state), false);
  assert.deepEqual(state, before);
});

test('self collision loses while stepping onto a vacating tail tile remains legal', () => {
  const layout = [cell(2, 2), cell(2, 3), cell(1, 3), cell(1, 2)];
  const safe = createState({ random: () => 0 });
  safe.snake = layout.map(segment => ({ ...segment }));
  safe.direction = 'up';
  assert.equal(turn(safe, 'left'), true);
  step(safe);
  assert.equal(safe.phase, 'playing');
  assert.deepEqual(safe.snake[0], cell(1, 2));
  assert.equal(new Set(safe.snake.map(segment => `${segment.x},${segment.y}`)).size, safe.snake.length);
  const collision = createState({ random: () => 0 });
  collision.snake = [...layout, cell(0, 2)];
  collision.direction = 'up';
  turn(collision, 'left');
  step(collision);
  assert.equal(collision.phase, 'lost');
  assert.equal(collision.result, 'self');
});

test('pausing preserves queued turns, food, score, and position until resumed', () => {
  const state = createState({ random: () => 0 });
  turn(state, 'down');
  assert.equal(togglePause(state), true);
  const paused = clone(state);
  assert.equal(step(state), false);
  assert.equal(turn(state, 'up'), false);
  assert.deepEqual(state, paused);
  assert.equal(togglePause(state), true);
  step(state);
  assert.equal(state.phase, 'playing');
  assert.deepEqual(state.snake[0], cell(9, 11));
});

test('eating the last empty tile wins with no attempted random choice on a full board', () => {
  let randomCalls = 0;
  const state = createState({ random: () => { randomCalls += 1; return 0; } });
  state.snake = [cell(18, 19)];
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      if ((x === 18 || x === 19) && y === 19) continue;
      state.snake.push(cell(x, y));
    }
  }
  state.food = cell(19, 19);
  const beforeCalls = randomCalls;
  step(state);
  assert.equal(state.phase, 'won');
  assert.equal(state.result, 'filled');
  assert.equal(state.food, null);
  assert.equal(state.snake.length, 400);
  assert.equal(state.score, 10);
  assert.equal(randomCalls, beforeCalls);
  const won = clone(state);
  assert.equal(step(state), false);
  assert.deepEqual(state, won);
});
