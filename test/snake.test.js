import test from 'node:test';
import assert from 'node:assert/strict';
import { GARDENS, GAUNTLET, GAUNTLET_FRUIT_GOAL, advanceGarden, createState, turn, step, togglePause, GRID_SIZE, START_STEP_MS, MIN_STEP_MS } from '../public/solo/snake-engine.js';

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

test('six garden layouts have different connected paths and safely placed fruit', () => {
  const s = createState({ mode: 'gardens', random: () => .45 }); const layouts = [];
  for (let level = 0; level < 6; level++) {
    assert.equal(s.level, level); assert.ok(s.obstacles.length > 0); layouts.push(JSON.stringify(s.obstacles));
    assert.ok(!s.obstacles.some(c => c.x === s.food.x && c.y === s.food.y));
    const blocked = new Set(s.obstacles.map(c => `${c.x},${c.y}`)), seen = new Set(['3,10']), queue = [{ x: 3, y: 10 }];
    for (const p of queue) for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const x = p.x + dx, y = p.y + dy, id = `${x},${y}`; if (x >= 0 && x < 20 && y >= 0 && y < 20 && !blocked.has(id) && !seen.has(id)) { seen.add(id); queue.push({ x,y }); } }
    assert.equal(seen.size, 400 - s.obstacles.length);
    if (level < 5) { s.phase = 'levelClear'; assert.equal(advanceGarden(s), true); }
  }
  assert.equal(new Set(layouts).size, 6);
});
test('stone hedges end a garden run and a fresh tour resets its resources', () => {
  const s = createState({ mode: 'gardens', random: () => .3 }); s.snake = [{ x: 5, y: 4 }, { x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }]; s.direction = 'right'; step(s);
  assert.equal(s.phase, 'lost'); assert.equal(s.result, 'hedge'); assert.equal(advanceGarden(s), false);
  const fresh = createState({ mode: 'gardens' }); assert.equal(fresh.score, 0); assert.equal(fresh.gardensCleared, 0); assert.equal(fresh.level, 0);
});
test('cleared-garden transitions pause without resetting score or rushing the next layout', () => {
  const s = createState({ mode: 'gardens', random: () => .2 }); s.phase = 'levelClear'; s.score = 80; s.gardensCleared = 1;
  togglePause(s); const before = structuredClone(s); step(s); assert.deepEqual(s, before); assert.equal(advanceGarden(s), false); togglePause(s); assert.equal(s.phase, 'levelClear');
  assert.equal(advanceGarden(s), true); assert.equal(s.level, 1); assert.equal(s.score, 80); assert.equal(s.snake.length, 4); assert.equal(s.gardensCleared, 1);
});
function foodPath(s) {
  const blocked = new Set([...s.obstacles, ...s.snake.slice(1, -1)].map(c => `${c.x},${c.y}`)); const head = s.snake[0], start = `${head.x},${head.y}`, end = `${s.food.x},${s.food.y}`, q = [head], parents = new Map([[start, null]]);
  for (const p of q) { const id = `${p.x},${p.y}`; if (id === end) break; for (const [direction, dx, dy] of [['right',1,0],['left',-1,0],['down',0,1],['up',0,-1]]) { const x = p.x + dx, y = p.y + dy, next = `${x},${y}`; if (x >= 0 && x < 20 && y >= 0 && y < 20 && !blocked.has(next) && !parents.has(next)) { parents.set(next, { previous: id, direction }); q.push({x,y}); } } }
  if (!parents.has(end)) return [];
  const out = []; for (let id = end; parents.get(id); id = parents.get(id).previous) out.unshift(parents.get(id).direction); return out;
}
test('normal turn and step inputs complete all six gardens and finite fruit goals', () => {
  const s = createState({ mode: 'gardens', random: () => .29 }); let guard = 0;
  while (!['won','lost'].includes(s.phase) && guard++ < 10000) {
    if (s.phase === 'levelClear') { advanceGarden(s); continue; }
    const path = foodPath(s); assert.ok(path.length > 0, `garden ${s.level}`); turn(s, path[0]); step(s);
  }
  assert.equal(s.phase, 'won'); assert.equal(s.result, 'gardens'); assert.equal(s.gardensCleared, 6); assert.equal(s.foodsEaten, 30); assert.ok(s.score >= 700);
});

test('gauntlet has six new connected layouts, demanding fruit goals, and protected longer starting trails', () => {
  assert.equal(GAUNTLET_FRUIT_GOAL, 168);
  assert.equal(new Set(GAUNTLET.map(garden => JSON.stringify(garden.obstacles))).size, 6);
  for (let seed = 1; seed <= 32; seed++) {
    const state = createState({ mode: 'gauntlet', random: seeded(seed) });
    for (let level = 0; level < GAUNTLET.length; level++) {
      assert.equal(state.level, level);
      assert.ok(GAUNTLET[level].goal >= GARDENS[level].goal * 2);
      assert.ok(state.stepMs < GARDENS[level].speed);
      assert.equal(state.snake.length, GAUNTLET[level].startLength);
      assert.notDeepEqual(state.obstacles, GARDENS[level].obstacles);
      const walls = new Set(state.obstacles.map(cell => `${cell.x},${cell.y}`)), floor = [state.snake[0]], seen = new Set([`${state.snake[0].x},${state.snake[0].y}`]);
      for (const cell of floor) for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const x = cell.x+dx, y = cell.y+dy, key = `${x},${y}`; if (x>=0 && x<20 && y>=0 && y<20 && !walls.has(key) && !seen.has(key)) { seen.add(key); floor.push({x,y}); } }
      assert.equal(seen.size, 400 - state.obstacles.length, `stage ${level+1}: no isolated fruit pockets`);
      assert.ok(!state.obstacles.some(wall => state.snake.some(segment => wall.x === segment.x && wall.y === segment.y)));
      assert.ok(foodPath(state).length > 0, `seed ${seed}, level ${level}: reachable fruit`);
      const firstStep = { x: state.snake[0].x + 1, y: state.snake[0].y };
      assert.ok(!state.obstacles.some(wall => wall.x === firstStep.x && wall.y === firstStep.y));
      if (level < GAUNTLET.length - 1) { state.phase = 'levelClear'; assert.equal(advanceGarden(state), true); }
    }
  }
});

test('legal steering completes all 168 gauntlet fruit and their move allowances across seeded runs', () => {
  for (const seed of [1, 2, 3]) {
    const state = createState({ mode: 'gauntlet', random: seeded(seed) });
    let guard = 0;
    while (!['won', 'lost'].includes(state.phase) && guard++ < 10000) {
      if (state.phase === 'levelClear') { advanceGarden(state); continue; }
      const route = foodPath(state);
      assert.ok(route.length, `seed ${seed}, stage ${state.level + 1}, fruit ${state.levelFoods}`);
      turn(state, route[0]); step(state);
      assert.ok(state.stepMs >= 75);
      assert.notEqual(state.result, 'fruitExpired');
      if (state.phase === 'playing') assert.ok(state.fruitMoves > 0);
    }
    assert.equal(state.phase, 'won'); assert.equal(state.result, 'gauntlet');
    assert.equal(state.gardensCleared, 6); assert.equal(state.foodsEaten, 168);
    assert.equal(state.score, 2130); assert.equal(state.stepMs, 75);
  }
});

test('gauntlet pause and next-stage transition retain progress but reset the growing trail', () => {
  const state = createState({ mode: 'gauntlet', random: seeded(6) });
  const route = foodPath(state);
  turn(state, route[0]); togglePause(state);
  const paused = clone(state); assert.equal(step(state), false); assert.deepEqual(state, paused);
  togglePause(state); step(state); assert.equal(state.phase, 'playing');
  state.phase = 'levelClear'; state.score = 130; state.gardensCleared = 1;
  assert.equal(advanceGarden(state), true); assert.equal(state.score, 130);
  assert.equal(state.level, 1); assert.equal(state.stepMs, GAUNTLET[1].speed); assert.equal(state.snake.length, GAUNTLET[1].startLength);
  assert.equal(createState({ mode: 'classic' }).stepMs, START_STEP_MS);
  assert.equal(createState({ mode: 'gardens' }).stepMs, GARDENS[0].speed);
});

test('food never spawns in a permanently disconnected hedge pocket', () => {
  const state = createState({ mode: 'gauntlet', random: () => 1 - Number.EPSILON });
  state.snake = [cell(1, 1), cell(0, 1)]; state.direction = 'right';
  state.obstacles = Array.from({ length: 20 }, (_, y) => cell(10, y));
  state.food = cell(2, 1); step(state);
  assert.ok(state.food.x < 10, 'the fruit remains in the head’s permanent floor component');
  assert.ok(!state.snake.some(segment => sameCellForTest(segment, state.food)));
});
const sameCellForTest = (a, b) => a.x === b.x && a.y === b.y;


test('gauntlet perimeter camping expires the fruit while legal direct routes can claim it on the final move', () => {
  const state = createState({ mode: 'gauntlet', random: seeded(17) });
  state.snake = [cell(3,18),cell(2,18),cell(1,18),cell(0,18)];
  state.food = cell(9,9); state.fruitMoves = 3;
  step(state); step(state); step(state);
  assert.equal(state.phase, 'lost'); assert.equal(state.result, 'fruitExpired');
  const terminal = clone(state); assert.equal(step(state), false); assert.deepEqual(state, terminal);
  const finalMove = createState({ mode: 'gauntlet', random: seeded(17) });
  finalMove.food = cell(4,18); finalMove.fruitMoves = 1;
  step(finalMove); assert.equal(finalMove.phase, 'playing'); assert.equal(finalMove.foodsEaten, 1);
  assert.ok(finalMove.fruitMoves >= 64, 'a newly claimed fruit receives a fresh movement allowance');
});

test('gauntlet movement budget and longer trail are unchanged by a paused step', () => {
  const state = createState({ mode: 'gauntlet', random: seeded(19) });
  turn(state, 'up'); togglePause(state); const paused = clone(state);
  for (let i=0;i<100;i++) assert.equal(step(state), false);
  assert.deepEqual(state, paused); togglePause(state); step(state);
  assert.equal(state.fruitMoves, paused.fruitMoves-1);
  const practice = createState({ mode:'gardens', random:seeded(19) });
  assert.equal(practice.fruitMoves, null);
});


test('a temporarily enclosed head cannot claim a filled-board Gauntlet victory', () => {
  const state = createState({ mode: 'gauntlet', random: seeded(33) });
  state.obstacles = [];
  state.snake = [cell(1,2),cell(2,2),cell(2,1),cell(2,0),cell(1,0),cell(0,0),cell(0,1),cell(0,2),cell(0,3),cell(1,3),cell(2,3)];
  state.direction = 'up'; state.food = cell(1,1);
  step(state);
  assert.equal(state.foodsEaten, 1);
  assert.equal(state.phase, 'playing', 'temporary body enclosure does not award a victory');
  assert.ok(state.food, 'the next fruit stays on unoccupied permanent floor');
  assert.ok(!state.snake.some(segment => sameCellForTest(segment, state.food)));
  step(state);
  assert.equal(state.phase, 'lost'); assert.equal(state.result, 'self');
});
