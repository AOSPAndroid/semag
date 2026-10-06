import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState,
  dispatch,
  step,
  togglePause,
  pieceCells,
  ghostPiece,
  collides,
  SHAPES,
  TYPES,
  WIDTH,
  HEIGHT,
  HIDDEN_ROWS,
  VISIBLE_HEIGHT,
  LOCK_DELAY,
  MAX_LOCK_RESETS,
  gravitySeconds,
  isGrounded,
  DIG_STAGES,
  DIG_STAGE_COUNT,
  getDigStage,
  garbageRows,
  advanceDigStage,
} from '../public/solo/prism-engine.js';

function seeded(seed = 1) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const clone = (value) => JSON.parse(JSON.stringify(value));
const blank = () => Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null));

// These drivers use the same actions as the browser. The preset board is never changed.
function placeExcavationPiece(state, target) {
  const act = (action) => {
    step(state, {}, 1 / 120);
    assert.equal(dispatch(state, action), true, `${getDigStage(state).id}: ${action}`);
  };
  if (state.active.type !== target.type) act('hold');
  assert.equal(state.active.type, target.type);
  while (state.active.rotation !== target.rotation) act('rotate-cw');
  while (state.active.x !== target.x) act(state.active.x < target.x ? 'right' : 'left');
  assert.deepEqual(ghostPiece(state), target);
  act('hard-drop');
}
function fixture(type, rotation = 0, x = 3, y = 10) {
  const state = createState({ random: seeded(7) });
  state.active = { type, rotation, x, y };
  state.board = blank();
  state.gravityElapsed = 0;
  state.lockElapsed = 0;
  state.lockResets = 0;
  state.lastRotation = null;
  state.lastMove = 'spawn';
  return state;
}
function clearFixture(count, state = fixture('I', 1, 2, HEIGHT - 4)) {
  state.board = blank();
  state.active = { type: 'I', rotation: 1, x: 2, y: HEIGHT - 4 };
  // Vertical I occupies column four. Completing only the lowest count rows
  // leaves any other I cells on the board, without cascade-style clearing.
  for (let y = HEIGHT - count; y < HEIGHT; y += 1) {
    state.board[y] = Array.from({ length: WIDTH }, (_, x) => (x === 4 ? null : 'J'));
  }
  state.lastMove = 'spawn';
  state.lastRotation = null;
  state.gravityElapsed = 0;
  state.lockElapsed = 0;
  return state;
}

test('Excavation provides eight distinct immutable shaped stacks with safe visible spawns and a disclosed fixed queue', () => {
  assert.equal(DIG_STAGE_COUNT, 8);
  assert.equal(new Set(DIG_STAGES.map((stage) => stage.id)).size, 8);
  assert.equal(new Set(DIG_STAGES.map((stage) => JSON.stringify(stage.board))).size, 8);
  assert.equal(
    DIG_STAGES.reduce((sum, stage) => sum + stage.rows, 0),
    60,
  );
  for (const stage of DIG_STAGES) {
    assert.ok(Object.isFrozen(stage) && Object.isFrozen(stage.board) && Object.isFrozen(stage.queue));
    assert.ok(stage.rows >= 4 && stage.rows <= 14);
    assert.ok(stage.budget > stage.placements.length);
    assert.ok(stage.board.slice(0, HIDDEN_ROWS).every((row) => row.every((cell) => cell === null)));
    assert.equal(stage.board.filter((row) => row.includes('G')).length, stage.rows);
    assert.ok(
      stage.placements.every((piece) =>
        pieceCells(piece).every(({ x, y }) => x >= 0 && x < WIDTH && y >= HIDDEN_ROWS && y < HEIGHT),
      ),
    );
  }
  const state = createState({ mode: 'dig', random: seeded(1) });
  assert.deepEqual(state, createState({ mode: 'dig', random: seeded(999) }));
  assert.equal(state.dig.remainingRows, 4);
  assert.equal(collides(state, state.active), false);
  state.board[HEIGHT - 1][0] = 'J';
  assert.equal(DIG_STAGES[0].board[HEIGHT - 1][0], 'G');
});

test('normal move, rotation, hold and hard drop complete all eight Excavation stages and all sixty rows', () => {
  const state = createState({ mode: 'dig', random: seeded(8) });
  for (let stageIndex = 0; stageIndex < DIG_STAGE_COUNT; stageIndex += 1) {
    const stage = getDigStage(state);
    assert.equal(state.dig.stageIndex, stageIndex);
    assert.equal(state.hold, null);
    for (const target of stage.placements) placeExcavationPiece(state, target);
    assert.equal(state.dig.piecesUsed, stage.placements.length);
    assert.equal(state.dig.remainingRows, 0);
    assert.equal(garbageRows(state), 0);
    assert.equal(state.dig.results.length, stageIndex + 1);
    assert.equal(state.active, null);
    assert.ok(state.dig.results.at(-1).time > 0);
    assert.equal(state.phase, stageIndex < DIG_STAGE_COUNT - 1 ? 'stage-clear' : 'won');
    const frozen = clone(state);
    assert.equal(step(state, { softDrop: true }, 0.1), false);
    assert.equal(dispatch(state, 'hard-drop'), false);
    assert.deepEqual(state, frozen);
    if (stageIndex < DIG_STAGE_COUNT - 1) assert.equal(advanceDigStage(state), true);
  }
  assert.equal(state.lines, 60);
  assert.equal(state.piecesLocked, 21);
  assert.equal(state.result, 'excavated');
  assert.equal(advanceDigStage(state), false);
  assert.ok(state.elapsed > 0);
  const finished = clone(state);
  assert.equal(togglePause(state), false);
  step(state, {}, 20);
  assert.deepEqual(state, finished);
});

test('Excavation stage breaks are explicit, pause-safe and reset reserve and lock clocks on continuation', () => {
  const state = createState({ mode: 'dig' });
  assert.equal(advanceDigStage(state), false);
  placeExcavationPiece(state, getDigStage(state).placements[0]);
  assert.equal(state.phase, 'stage-clear');
  const elapsed = state.elapsed;
  assert.equal(togglePause(state), true);
  assert.equal(state.pausedPhase, 'stage-clear');
  assert.equal(advanceDigStage(state), false);
  step(state, {}, 30);
  assert.equal(state.elapsed, elapsed);
  assert.equal(togglePause(state), true);
  assert.equal(state.phase, 'stage-clear');
  assert.equal(advanceDigStage(state), true);
  assert.equal(state.elapsed, elapsed);
  assert.equal(state.hold, null);
  assert.equal(state.holdUsed, false);
  assert.equal(state.lockElapsed, 0);
  assert.equal(state.gravityElapsed, 0);
  assert.equal(state.dig.stageIndex, 1);
  assert.equal(state.dig.piecesUsed, 0);
  assert.equal(state.result, null);
  assert.equal(advanceDigStage(createState()), false);
});

test('Excavation consumes its piece budget on unsuccessful locks, freezes failure, and restarts the challenge cleanly', () => {
  const state = createState({ mode: 'dig' });
  for (let index = 0; index < getDigStage(state).budget; index += 1) {
    assert.equal(dispatch(state, 'hard-drop'), true);
  }
  assert.equal(state.phase, 'lost');
  assert.equal(state.result, 'piece-budget');
  assert.equal(state.dig.piecesUsed, state.dig.budget);
  assert.ok(state.dig.remainingRows > 0);
  const failed = clone(state);
  step(state, {}, 0.1);
  assert.equal(advanceDigStage(state), false);
  assert.deepEqual(state, failed);
  const restarted = createState({ mode: 'dig' });
  assert.equal(restarted.dig.results.length, 0);
  assert.equal(restarted.elapsed, 0);
  assert.equal(restarted.lines, 0);
  assert.equal(restarted.dig.stageIndex, 0);
  assert.equal(restarted.dig.remainingRows, 4);
});

test('Prism starts serializable and seeded, with 20 visible rows, hidden spawn rows and safe active cells', () => {
  const state = createState({ random: seeded(44) });
  assert.deepEqual(state, clone(state));
  assert.deepEqual(state, createState({ random: seeded(44) }));
  assert.equal(state.gameId, 'prism-shift');
  assert.equal(state.phase, 'playing');
  assert.equal(state.mode, 'marathon');
  assert.equal(state.board.length, HIDDEN_ROWS + VISIBLE_HEIGHT);
  assert.ok(state.board.every((row) => row.length === WIDTH && row.every((cell) => cell === null)));
  assert.ok(state.next.length >= 5);
  assert.equal(collides(state, state.active), false);
  assert.equal(state.score, 0);
  assert.equal(state.lines, 0);
  assert.equal(state.level, 1);
  assert.throws(() => createState({ mode: 'unknown' }), /mode/);
  assert.throws(() => createState({ random: 4 }), /random/);
  for (const value of [-1, 1, NaN, Infinity])
    assert.throws(() => createState({ random: () => value }), /random/);
});

test('every tetromino has four unique integer cells and a complete four-rotation cycle', () => {
  for (const type of TYPES) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const shape = SHAPES[type][rotation];
      assert.equal(shape.length, 4);
      assert.equal(new Set(shape.map(({ x, y }) => `${x},${y}`)).size, 4);
      assert.ok(shape.every(({ x, y }) => Number.isInteger(x) && Number.isInteger(y)));
      const state = fixture(type, rotation);
      assert.equal(collides(state, state.active), false);
      const start = clone(state.active);
      for (let turn = 0; turn < 4; turn += 1) dispatch(state, 'rotate-cw');
      assert.deepEqual(state.active, start);
      for (let turn = 0; turn < 4; turn += 1) dispatch(state, 'rotate-ccw');
      assert.deepEqual(state.active, start);
    }
  }
  assert.deepEqual(pieceCells(null), []);
  assert.deepEqual(pieceCells({ type: 'bad', rotation: 0, x: 0, y: 0 }), []);
  assert.deepEqual(
    SHAPES.I[0].map(({ x, y }) => [x, y]),
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
  );
  assert.deepEqual(
    SHAPES.T[0].map(({ x, y }) => [x, y]),
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  );
});

test('7-bag output contains every type exactly once per bag and limits drought to twelve pieces', () => {
  const state = createState({ random: seeded(2) });
  const sequence = [];
  for (let count = 0; count < 140; count += 1) {
    sequence.push(state.active.type);
    state.board = blank();
    assert.equal(dispatch(state, 'hard-drop'), true);
    assert.ok(state.next.length >= 5);
  }
  for (let start = 0; start < sequence.length; start += 7) {
    assert.deepEqual([...sequence.slice(start, start + 7)].sort(), [...TYPES].sort());
  }
  for (const type of TYPES) {
    const positions = sequence.flatMap((value, index) => (value === type ? [index] : []));
    for (let index = 1; index < positions.length; index += 1)
      assert.ok(positions[index] - positions[index - 1] <= 13);
  }
});

test('cells cannot move through either wall, the floor, hidden ceiling or settled blocks', () => {
  const state = fixture('O', 0, -1, 10);
  assert.equal(dispatch(state, 'left'), false);
  assert.equal(state.active.x, -1);
  state.active.x = 7;
  assert.equal(dispatch(state, 'right'), false);
  state.active.y = HEIGHT - 2;
  assert.equal(isGrounded(state), true);
  assert.equal(dispatch(state, 'soft-drop'), false);
  assert.equal(collides(state, { ...state.active, y: -1 }), true);
  state.active = { type: 'O', rotation: 0, x: 3, y: 10 };
  state.board[10][6] = 'J';
  assert.equal(dispatch(state, 'right'), false);
  assert.equal(collides(state, { type: 'O', rotation: 0, x: NaN, y: 3 }), true);
});

test('JLSTZ SRS handles left, right and floor kicks clockwise and counterclockwise', () => {
  const left = fixture('T', 1, -1, 10);
  assert.equal(dispatch(left, 'rotate-cw'), true);
  assert.deepEqual(left.active, { type: 'T', rotation: 2, x: 0, y: 10 });
  assert.equal(left.lastRotation.kickIndex, 1);
  const right = fixture('T', 3, 8, 10);
  assert.equal(dispatch(right, 'rotate-cw'), true);
  assert.deepEqual(right.active, { type: 'T', rotation: 0, x: 7, y: 10 });
  for (const type of ['J', 'L', 'S', 'T', 'Z']) {
    const cw = fixture(type, 0, 3, HEIGHT - 2);
    assert.equal(collides(cw, cw.active), false);
    assert.equal(dispatch(cw, 'rotate-cw'), true);
    assert.equal(cw.active.y, HEIGHT - 3);
    assert.equal(collides(cw, cw.active), false);
    const ccw = fixture(type, 0, 3, HEIGHT - 2);
    assert.equal(dispatch(ccw, 'rotate-ccw'), true);
    assert.equal(ccw.active.y, HEIGHT - 3);
    assert.equal(ccw.active.rotation, 3);
    assert.equal(collides(ccw, ccw.active), false);
  }
});

test('I-piece SRS uses its distinct two-column wall offsets and floor kick tests', () => {
  const cw = fixture('I', 1, -2, 10);
  assert.equal(dispatch(cw, 'rotate-cw'), true);
  assert.deepEqual(cw.active, { type: 'I', rotation: 2, x: 0, y: 10 });
  assert.equal(cw.lastRotation.kickIndex, 2);
  const ccw = fixture('I', 1, -2, 10);
  assert.equal(dispatch(ccw, 'rotate-ccw'), true);
  assert.deepEqual(ccw.active, { type: 'I', rotation: 0, x: 0, y: 10 });
  assert.equal(ccw.lastRotation.kickIndex, 1);
  const floor = fixture('I', 0, 3, HEIGHT - 2);
  assert.equal(dispatch(floor, 'rotate-cw'), true);
  assert.deepEqual(floor.active, { type: 'I', rotation: 1, x: 4, y: HEIGHT - 4 });
  assert.equal(floor.lastRotation.kickIndex, 4);
  const floorBack = fixture('I', 0, 3, HEIGHT - 2);
  assert.equal(dispatch(floorBack, 'rotate-ccw'), true);
  assert.deepEqual(floorBack.active, { type: 'I', rotation: 3, x: 2, y: HEIGHT - 4 });
  assert.equal(floorBack.lastRotation.kickIndex, 3);
});

test('blocked SRS tests do not change active geometry, rotation flags or lock timers', () => {
  const state = fixture('T');
  for (const row of state.board) row.fill('J');
  for (const { x, y } of pieceCells(state.active)) state.board[y][x] = null;
  state.lockElapsed = 0.3;
  const before = clone(state);
  assert.equal(dispatch(state, 'rotate-cw'), false);
  assert.equal(dispatch(state, 'rotate-ccw'), false);
  assert.deepEqual(state, before);
});

test('hold is limited to once per locked piece and restores spawn orientation rather than old position', () => {
  const state = fixture('T', 2, 1, 15);
  const queued = state.next[0];
  assert.equal(dispatch(state, 'hold'), true);
  assert.equal(state.hold, 'T');
  assert.equal(state.active.type, queued);
  assert.equal(state.active.rotation, 0);
  assert.equal(state.holdUsed, true);
  const before = clone(state);
  assert.equal(dispatch(state, 'hold'), false);
  assert.deepEqual(state, before);
  dispatch(state, 'hard-drop');
  assert.equal(state.holdUsed, false);
  const outgoing = state.active.type;
  dispatch(state, 'hold');
  assert.equal(state.active.type, 'T');
  assert.equal(state.active.rotation, 0);
  assert.equal(state.active.x, 3);
  assert.equal(state.active.y, HIDDEN_ROWS - 1);
  assert.equal(state.hold, outgoing);
  assert.equal(state.holdUsed, true);
});

test('ghost lands immediately above the stack, stays immutable, and hard drop adds exact distance points', () => {
  const state = fixture('T', 0, 3, 7);
  state.board[19][4] = 'J';
  const before = clone(state);
  const ghost = ghostPiece(state);
  assert.equal(ghost.y, 17);
  assert.equal(collides(state, ghost), false);
  assert.equal(collides(state, { ...ghost, y: ghost.y + 1 }), true);
  assert.deepEqual(state, before);
  assert.equal(dispatch(state, 'hard-drop'), true);
  assert.equal(state.score, 20);
  assert.equal(state.piecesLocked, 1);
  for (const { x, y } of pieceCells(ghost)) assert.equal(state.board[y][x], 'T');
  assert.equal(state.active.y, HIDDEN_ROWS - 1);
});

test('soft drop scores one per descended cell while natural gravity never scores movement', () => {
  const soft = fixture('O');
  assert.equal(dispatch(soft, 'soft-drop'), true);
  assert.equal(soft.score, 1);
  assert.equal(soft.active.y, 11);
  step(soft, { softDrop: true }, 0.105);
  assert.equal(soft.active.y, 14);
  assert.equal(soft.score, 4);
  const natural = fixture('O');
  step(natural, {}, 1);
  assert.equal(natural.active.y, 11);
  assert.equal(natural.score, 0);
  assert.equal(natural.elapsed, 1);
  assert.equal(gravitySeconds(1), 1);
  assert.ok(gravitySeconds(10) < gravitySeconds(2));
  assert.ok(gravitySeconds(1000) >= 0.035);
});

test('single, double, triple and tetris compact rows without cascade and use their distinct base awards', () => {
  for (const [count, award] of [
    [1, 100],
    [2, 300],
    [3, 500],
    [4, 800],
  ]) {
    const state = clearFixture(count);
    state.board[8][2] = 'Z';
    dispatch(state, 'hard-drop');
    assert.equal(state.lines, count);
    assert.equal(state.score, award);
    assert.equal(state.lastClear.lines, count);
    assert.equal(state.board[8 + count][2], 'Z');
    assert.ok(state.board.slice(0, count).every((row) => row.every((cell) => cell === null)));
    assert.equal(state.board.length, HEIGHT);
    assert.equal(state.combo, 0);
    assert.equal(state.backToBack, count === 4);
  }
});

test('combo increases only on successive clearing locks; back-to-back survives empty locks and ends on ordinary clears', () => {
  const state = clearFixture(4);
  dispatch(state, 'hard-drop');
  assert.equal(state.score, 800);
  clearFixture(4, state);
  dispatch(state, 'hard-drop');
  assert.equal(state.lastClear.points, 1250);
  assert.equal(state.score, 2050);
  assert.equal(state.lastClear.backToBack, true);
  state.board = blank();
  dispatch(state, 'hard-drop');
  assert.equal(state.combo, -1);
  assert.equal(state.backToBack, true);
  clearFixture(4, state);
  dispatch(state, 'hard-drop');
  assert.equal(state.lastClear.points, 1200);
  clearFixture(1, state);
  dispatch(state, 'hard-drop');
  assert.equal(state.lastClear.points, 300, 'level two single and combo bonus');
  assert.equal(state.backToBack, false);
  clearFixture(4, state);
  dispatch(state, 'hard-drop');
  assert.equal(state.lastClear.points, 1800, 'level two tetris without back-to-back');
  assert.equal(state.lastClear.backToBack, false);
});

function tSpinFixture() {
  const state = fixture('T', 3, 3, HEIGHT - 3);
  state.board[HEIGHT - 3][3] = 'J';
  state.board[HEIGHT - 3][5] = 'J';
  state.board[HEIGHT - 1][3] = 'J';
  state.board[HEIGHT - 1][5] = 'J';
  state.board[HEIGHT - 2] = Array.from({ length: WIDTH }, (_, x) => (x >= 3 && x <= 5 ? null : 'J'));
  return state;
}

test('an actual final SRS rotation into a three-corner T slot scores a full T-spin single', () => {
  const state = tSpinFixture();
  assert.equal(collides(state, state.active), false);
  assert.equal(dispatch(state, 'rotate-cw'), true);
  assert.equal(state.active.rotation, 0);
  assert.equal(isGrounded(state), true);
  dispatch(state, 'hard-drop');
  assert.equal(state.lastClear.spin, 'full');
  assert.equal(state.lastClear.label, 'T-SPIN SINGLE');
  assert.equal(state.lastClear.points, 800);
  assert.equal(state.backToBack, true);
});

test('full T-spin doubles and fifth-test SRS triples receive their own difficult-clear awards', () => {
  const double = tSpinFixture();
  double.board[HEIGHT - 3] = Array.from({ length: WIDTH }, (_, x) => (x === 4 ? null : 'J'));
  assert.equal(dispatch(double, 'rotate-cw'), true);
  dispatch(double, 'hard-drop');
  assert.equal(double.lastClear.lines, 2);
  assert.equal(double.lastClear.spin, 'full');
  assert.equal(double.lastClear.points, 1200);
  const triple = fixture('T', 0, 4, HEIGHT - 5);
  triple.board[HEIGHT - 5][4] = 'J';
  triple.board[HEIGHT - 3] = Array.from({ length: WIDTH }, (_, x) => (x === 4 ? null : 'J'));
  triple.board[HEIGHT - 2] = Array.from({ length: WIDTH }, (_, x) => (x === 4 || x === 5 ? null : 'J'));
  triple.board[HEIGHT - 1] = Array.from({ length: WIDTH }, (_, x) => (x === 4 ? null : 'J'));
  assert.equal(collides(triple, triple.active), false);
  assert.equal(dispatch(triple, 'rotate-cw'), true);
  assert.deepEqual(triple.active, { type: 'T', rotation: 1, x: 3, y: HEIGHT - 3 });
  assert.equal(triple.lastRotation.kickIndex, 4);
  dispatch(triple, 'hard-drop');
  assert.equal(triple.lastClear.lines, 3);
  assert.equal(triple.lastClear.spin, 'full');
  assert.equal(triple.lastClear.points, 1600);
  assert.equal(triple.backToBack, true);
});

test('a three-corner rear-facing spin receives mini scoring, while nonrotation placement receives ordinary scoring', () => {
  const mini = tSpinFixture();
  // Facing right: front corners are right top/bottom. Removing bottom right
  // still leaves three corners, but makes this a mini when rotated in place.
  mini.board[HEIGHT - 1][5] = null;
  mini.active = { type: 'T', rotation: 0, x: 3, y: HEIGHT - 3 };
  mini.board[HEIGHT - 2] = Array(WIDTH).fill(null);
  assert.equal(dispatch(mini, 'rotate-cw'), true);
  assert.equal(isGrounded(mini), true);
  dispatch(mini, 'hard-drop');
  assert.equal(mini.lastClear.spin, 'mini');
  assert.equal(mini.lastClear.points, 100);
  const ordinary = tSpinFixture();
  ordinary.active.rotation = 0;
  ordinary.lastMove = 'move';
  ordinary.lastRotation = null;
  dispatch(ordinary, 'hard-drop');
  assert.equal(ordinary.lastClear.spin, null);
  assert.equal(ordinary.lastClear.points, 100);
});

test('level changes after ten lines, using the pre-clear level for score and faster subsequent gravity', () => {
  const state = clearFixture(2);
  state.lines = 9;
  dispatch(state, 'hard-drop');
  assert.equal(state.lines, 11);
  assert.equal(state.level, 2);
  assert.equal(state.score, 300);
  clearFixture(1, state);
  dispatch(state, 'hard-drop');
  assert.equal(state.lastClear.points, 300, 'level two single plus one combo bonus');
});

test('ground contact locks at 500 ms and resets at most fifteen successful floor moves', () => {
  const state = fixture('O', 0, 3, HEIGHT - 2);
  step(state, {}, LOCK_DELAY - 0.001);
  assert.equal(state.piecesLocked, 0);
  step(state, {}, 0.001);
  assert.equal(state.piecesLocked, 1);
  const capped = fixture('O', 0, 3, HEIGHT - 2);
  for (let index = 0; index < MAX_LOCK_RESETS; index += 1) {
    step(capped, {}, 0.4);
    assert.equal(dispatch(capped, index % 2 ? 'left' : 'right'), true);
    assert.equal(capped.lockElapsed, 0);
  }
  assert.equal(capped.lockResets, 15);
  step(capped, {}, 0.4);
  dispatch(capped, 'left');
  assert.ok(Math.abs(capped.lockElapsed - 0.4) < 1e-8);
  step(capped, {}, 0.1);
  assert.equal(capped.piecesLocked, 1);
  assert.equal(capped.lockResets, 0, 'new piece receives its own reset allowance');
});

test('airborne actions never consume lock resets and blocked floor actions cannot reset the delay', () => {
  const airborne = fixture('T');
  dispatch(airborne, 'left');
  dispatch(airborne, 'rotate-cw');
  assert.equal(airborne.lockResets, 0);
  const wall = fixture('O', 0, -1, HEIGHT - 2);
  step(wall, {}, 0.49);
  dispatch(wall, 'left');
  assert.equal(wall.lockResets, 0);
  step(wall, {}, 0.01);
  assert.equal(wall.piecesLocked, 1);
});

test('pause freezes elapsed, gravity, lock delay, queue and every action until resumed', () => {
  const state = fixture('T', 0, 3, HEIGHT - 2);
  step(state, {}, 0.3);
  assert.equal(togglePause(state), true);
  const before = clone(state);
  for (const action of ['left', 'right', 'rotate-cw', 'rotate-ccw', 'hold', 'soft-drop', 'hard-drop']) {
    assert.equal(dispatch(state, action), false);
  }
  assert.equal(step(state, { softDrop: true }, 1), false);
  assert.deepEqual(state, before);
  assert.equal(togglePause(state), true);
  step(state, {}, 0.2);
  assert.equal(state.piecesLocked, 1);
});

test('40-line sprint wins on its final clear, freezes final elapsed and rejects all further actions', () => {
  const state = createState({ mode: 'sprint', random: seeded(8) });
  state.lines = 38;
  state.level = 4;
  state.elapsed = 52.42;
  clearFixture(2, state);
  state.lockElapsed = 0.49;
  step(state, {}, 0.5);
  assert.equal(state.lines, 40);
  assert.equal(state.phase, 'won');
  assert.equal(state.result, 'forty-lines');
  assert.equal(state.active, null);
  assert.ok(Math.abs(state.elapsed - 52.43) < 1e-8, 'unused frame time cannot inflate a completed sprint');
  const before = clone(state);
  assert.equal(step(state, {}, 1), false);
  assert.equal(dispatch(state, 'hold'), false);
  assert.equal(togglePause(state), false);
  assert.deepEqual(state, before);
});

test('marathon continues past forty lines and top-out ends by either blocked spawn or hidden lock', () => {
  const marathon = clearFixture(4);
  marathon.lines = 39;
  marathon.level = 4;
  dispatch(marathon, 'hard-drop');
  assert.equal(marathon.lines, 43);
  assert.equal(marathon.phase, 'playing');
  const blocked = fixture('O', 0, 0, HEIGHT - 2);
  blocked.board[HIDDEN_ROWS][4] = 'Z';
  blocked.board[HIDDEN_ROWS][5] = 'Z';
  dispatch(blocked, 'hard-drop');
  assert.equal(blocked.phase, 'lost');
  assert.equal(blocked.result, 'block-out');
  const hidden = fixture('O', 0, 3, 0);
  hidden.board[2][4] = 'J';
  hidden.board[2][5] = 'J';
  dispatch(hidden, 'hard-drop');
  assert.equal(hidden.phase, 'lost');
  assert.equal(hidden.result, 'lock-out');
  assert.equal(hidden.active, null);
  const before = clone(hidden);
  assert.equal(dispatch(hidden, 'left'), false);
  assert.equal(step(hidden), false);
  assert.equal(togglePause(hidden), false);
  assert.deepEqual(hidden, before);
});

test('invalid actions and deltas leave state unchanged, with strict boolean soft-drop input', () => {
  const state = fixture('T');
  const before = clone(state);
  for (const action of [null, {}, 'rotate', '__proto__', '']) assert.equal(dispatch(state, action), false);
  for (const dt of [NaN, Infinity, -1, 0, 2, '0.5']) assert.equal(step(state, {}, dt), false);
  assert.deepEqual(state, before);
  step(state, { softDrop: 'true' }, 0.1);
  assert.equal(state.active.y, before.active.y);
  assert.equal(state.score, 0);
  assert.equal(state.elapsed, 0.1);
});

test('fixed and chunked gravity advance to the same geometry and clocks', () => {
  const fixed = fixture('O');
  const chunked = clone(fixed);
  for (let index = 0; index < 240; index += 1) step(fixed, {}, 1 / 120);
  step(chunked, {}, 1);
  step(chunked, {}, 1);
  assert.deepEqual(fixed.active, chunked.active);
  assert.equal(fixed.score, chunked.score);
  assert.ok(Math.abs(fixed.elapsed - chunked.elapsed) < 1e-8);
  assert.ok(Math.abs(fixed.gravityElapsed - chunked.gravityElapsed) < 1e-8);
});

test('seeded legal action stress remains finite, respects settled geometry and terminates without unbounded queues', () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    const random = seeded(seed);
    const state = createState({ random: seeded(seed * 19) });
    const actions = ['left', 'right', 'rotate-cw', 'rotate-ccw', 'hold', 'hard-drop', 'soft-drop'];
    for (let tick = 0; tick < 4000 && state.phase === 'playing'; tick += 1) {
      if (random() < 0.5) dispatch(state, actions[Math.floor(random() * actions.length)]);
      step(state, { softDrop: random() > 0.7 }, 1 / 120);
      for (const value of [
        state.elapsed,
        state.score,
        state.lines,
        state.level,
        state.lockElapsed,
        state.gravityElapsed,
      ]) {
        assert.ok(Number.isFinite(value) && value >= 0);
      }
      assert.ok(state.next.length >= 5 && state.next.length <= 12);
      assert.ok(state.lockResets <= MAX_LOCK_RESETS);
      assert.ok(
        state.board.every(
          (row) => row.length === WIDTH && row.every((cell) => cell === null || TYPES.includes(cell)),
        ),
      );
      if (state.phase === 'playing') assert.equal(collides(state, state.active), false);
    }
    assert.equal(state.phase, 'lost');
  }
});
