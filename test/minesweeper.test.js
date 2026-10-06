import assert from 'node:assert/strict';
import test from 'node:test';
import { DIFFICULTIES, advanceTime, chord, cloneState, createState, flag, getStats, neighbors, reveal, togglePause } from '../public/solo/minesweeper-engine.js';

function seeded(seed = 42) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function rejectUnchanged(state, action, index) {
  const before = cloneState(state);
  const result = action(state, index);
  assert.equal(result.ok, false);
  assert.equal(typeof result.error, 'string');
  assert.deepEqual(state, before);
}

function openedBoard(options = {}) {
  const state = createState({ random: seeded(), ...options });
  reveal(state, Math.floor(state.rows / 2) * state.cols + Math.floor(state.cols / 2));
  return state;
}

test('Minesweeper starts with a covered board and no mines or timer until first reveal', () => {
  const state = createState();
  assert.equal(state.phase, 'playing');
  assert.equal(state.difficulty, 'beginner');
  assert.equal(state.cells.length, 81);
  assert.equal(state.generated, false);
  assert.ok(state.cells.every(cell => !cell.mine && !cell.revealed && !cell.flagged && cell.adjacent === 0));
  assert.deepEqual(getStats(state), { opened: 0, safe: 71, flags: 0, remaining: 10, elapsed: 0 });
  advanceTime(state, 10);
  assert.equal(state.elapsed, 0);
});

test('Expert leaves substantially more deduction after the safe opening across seeded fields', () => {
  const fractions = { beginner: 0, expert: 0 };
  for (const difficulty of Object.keys(fractions)) for (let seed = 1; seed <= 64; seed++) {
    const state = createState({ ...DIFFICULTIES[difficulty], random: seeded(seed) });
    const first = Math.floor(state.rows / 2) * state.cols + Math.floor(state.cols / 2);
    assert.equal(reveal(state, first).ok, true);
    assert.ok([first, ...neighbors(state, first)].every(index => !state.cells[index].mine));
    assert.equal(state.cells.filter(cell => cell.mine).length, DIFFICULTIES[difficulty].mines);
    assert.equal(state.phase, 'playing');
    fractions[difficulty] += state.opened / (state.cells.length - state.mines) / 64;
  }
  assert.ok(fractions.beginner > .5, 'the relaxed mode keeps its generous opening');
  assert.ok(fractions.expert < .25, 'Expert leaves most safe tiles for actual deduction');
  assert.ok(fractions.expert < fractions.beginner / 3);
});

test('both difficulties protect the first tile and all eight neighbors and place the exact mine count', () => {
  for (const settings of Object.values(DIFFICULTIES)) {
    const state = createState({ ...settings, random: seeded() });
    const center = Math.floor(state.rows / 2) * state.cols + Math.floor(state.cols / 2);
    assert.deepEqual(reveal(state, center), { ok: true });
    assert.equal(state.cells.filter(cell => cell.mine).length, settings.mines);
    assert.equal(state.cells[center].adjacent, 0);
    assert.ok([center, ...neighbors(state, center)].every(index => !state.cells[index].mine && state.cells[index].revealed));
    assert.ok(state.opened >= 9);
    assert.equal(state.cells.filter(cell => cell.revealed && !cell.mine).length, state.opened);
    for (const [index, cell] of state.cells.entries()) {
      assert.equal(cell.adjacent, neighbors(state, index).filter(other => state.cells[other].mine).length);
    }
  }
});

test('dense custom boards fall back to protecting the first tile alone', () => {
  const state = createState({ rows: 2, cols: 2, mines: 3, random: () => 0 });
  reveal(state, 1);
  assert.equal(state.cells[1].mine, false);
  assert.equal(state.cells[1].adjacent, 3);
  assert.equal(state.cells.filter(cell => cell.mine).length, 3);
  assert.equal(state.phase, 'won');
});

test('neighbor computation excludes self and avoids wrapping edges', () => {
  const state = createState();
  assert.deepEqual(neighbors(state, 0), [1, 9, 10]);
  assert.deepEqual(neighbors(state, 8), [7, 16, 17]);
  assert.equal(neighbors(state, 40).length, 8);
  assert.deepEqual(neighbors(state, -1), []);
});

test('flags toggle before first reveal without placing mines or starting the clock', () => {
  const state = createState();
  flag(state, 10);
  assert.equal(state.cells[10].flagged, true);
  assert.equal(getStats(state).remaining, 9);
  advanceTime(state, 5);
  assert.equal(state.generated, false);
  assert.equal(state.elapsed, 0);
  rejectUnchanged(state, reveal, 10);
  flag(state, 10);
  assert.equal(state.flags, 0);
  assert.equal(state.cells[10].flagged, false);
});

test('zero flood preserves covered flags, and revealing an unflagged safe tile never double-counts', () => {
  const state = createState({ random: seeded() });
  flag(state, 39);
  reveal(state, 40);
  assert.equal(state.cells[39].mine, false);
  assert.equal(state.cells[39].revealed, false);
  assert.equal(state.cells[39].flagged, true);
  const before = state.opened;
  flag(state, 39);
  reveal(state, 39);
  assert.equal(state.cells[39].revealed, true);
  assert.ok(state.opened > before);
  assert.equal(state.opened, state.cells.filter(cell => !cell.mine && cell.revealed).length);
  if (state.phase === 'playing') rejectUnchanged(state, reveal, 40);
});

test('invalid actions reject without changing board, counts, revision, or generation', () => {
  const state = createState();
  for (const invalid of [-1, 81, 1.5, NaN, '0', null]) {
    for (const action of [reveal, flag, chord]) rejectUnchanged(state, action, invalid);
  }
  rejectUnchanged(state, chord, 40);
  reveal(state, 40);
  rejectUnchanged(state, flag, 40);
  rejectUnchanged(state, chord, 40);
});

test('clicking a mine loses, reveals all mines, and blocks subsequent actions', () => {
  const state = openedBoard();
  const mine = state.cells.findIndex(cell => cell.mine);
  assert.deepEqual(reveal(state, mine), { ok: true });
  assert.equal(state.phase, 'lost');
  assert.equal(state.exploded, mine);
  assert.ok(state.cells.filter(cell => cell.mine).every(cell => cell.revealed));
  for (const action of [reveal, flag, chord]) rejectUnchanged(state, action, 0);
  rejectUnchanged(state, togglePause);
  const elapsed = state.elapsed;
  advanceTime(state, 100);
  assert.equal(state.elapsed, elapsed);
});

test('correct adjacent flags allow a number chord to uncover neighboring safe tiles', () => {
  const state = openedBoard();
  const target = state.cells.findIndex((cell, index) => cell.revealed && cell.adjacent > 0 && neighbors(state, index).some(other => !state.cells[other].mine && !state.cells[other].revealed));
  assert.notEqual(target, -1);
  for (const index of neighbors(state, target).filter(other => state.cells[other].mine)) flag(state, index);
  const opened = state.opened;
  assert.deepEqual(chord(state, target), { ok: true });
  assert.ok(state.opened > opened);
  assert.notEqual(state.phase, 'lost');
  assert.ok(neighbors(state, target).every(index => state.cells[index].revealed || state.cells[index].flagged));
});

test('a number chord rejects an unmatched flag count without mutation', () => {
  const state = openedBoard();
  const number = state.cells.findIndex(cell => cell.revealed && cell.adjacent > 0);
  assert.notEqual(number, -1);
  rejectUnchanged(state, chord, number);
});

test('matching the count with incorrect flags can detonate a mine during a chord', () => {
  const state = openedBoard();
  const target = state.cells.findIndex((cell, index) => cell.revealed && cell.adjacent === 1 && neighbors(state, index).some(other => !state.cells[other].mine && !state.cells[other].revealed));
  assert.notEqual(target, -1);
  const safe = neighbors(state, target).find(index => !state.cells[index].mine && !state.cells[index].revealed);
  flag(state, safe);
  assert.deepEqual(chord(state, target), { ok: true });
  assert.equal(state.phase, 'lost');
  assert.equal(state.cells[state.exploded].mine, true);
  assert.equal(state.cells[safe].flagged, true);
  assert.equal(state.cells[safe].revealed, false);
});

test('the win requires all safe tiles revealed and does not require flags on mines', () => {
  const state = openedBoard();
  advanceTime(state, 7.25);
  for (const [index, cell] of state.cells.entries()) {
    if (!cell.mine && !cell.revealed) reveal(state, index);
  }
  assert.equal(state.phase, 'won');
  assert.equal(state.opened, 71);
  assert.equal(state.flags, 0);
  assert.equal(state.elapsed, 7.25);
  assert.ok(state.cells.filter(cell => cell.mine).every(cell => !cell.revealed));
  advanceTime(state, 50);
  assert.equal(state.elapsed, 7.25);
  for (const action of [reveal, flag, chord]) rejectUnchanged(state, action, 0);
});

test('pause blocks all board actions and counts only active seconds, even before first reveal', () => {
  const state = createState({ random: seeded() });
  togglePause(state);
  assert.equal(state.phase, 'paused');
  for (const action of [reveal, flag, chord]) rejectUnchanged(state, action, 40);
  advanceTime(state, 10);
  assert.equal(state.elapsed, 0);
  togglePause(state);
  reveal(state, 40);
  advanceTime(state, 1.75);
  togglePause(state);
  advanceTime(state, 100);
  assert.equal(state.elapsed, 1.75);
  togglePause(state);
  advanceTime(state, 2.25);
  assert.equal(state.elapsed, 4);
  for (const invalid of [-1, 0, NaN, Infinity, '3']) advanceTime(state, invalid);
  assert.equal(state.elapsed, 4);
});

test('board generation is repeatable with the same random source sequence and snapshots are independent', () => {
  const a = openedBoard({ random: seeded(111) });
  const b = openedBoard({ random: seeded(111) });
  assert.deepEqual(a, b);
  const copy = cloneState(a);
  copy.cells[0].flagged = !copy.cells[0].flagged;
  copy.phase = 'lost';
  assert.notDeepEqual(copy, a);
  assert.notEqual(a.phase, 'lost');
});

test('invalid board definitions fail rather than creating impossible layouts', () => {
  for (const settings of [{ rows: 1 }, { cols: 33 }, { rows: 2.5 }, { mines: 0 }, { mines: 81 }, { mines: NaN }]) {
    assert.throws(() => createState(settings), RangeError);
  }
  assert.throws(() => createState({ random: false }), TypeError);
});

test('Expert is a 30 by 16 field with 99 mines and a safe first neighborhood', () => {
  const s = createState({ rows: 16, cols: 30, mines: 99, random: () => .4 });
  assert.equal(s.difficulty, 'expert'); assert.equal(s.cells.length, 480);
  assert.equal(reveal(s, 245).ok, true); assert.equal(s.cells.filter(c => c.mine).length, 99);
  for (const i of [245, ...neighbors(s, 245)]) assert.equal(s.cells[i].mine, false);
  assert.ok(s.opened > 0);
});
test('Expert normal reveals can complete all 381 safe tiles with a frozen final clock', () => {
  const s = createState({ rows: 16, cols: 30, mines: 99, random: () => .73 }); reveal(s, 0); advanceTime(s, 17);
  for (let i = 0; i < s.cells.length; i++) if (!s.cells[i].mine && !s.cells[i].revealed) reveal(s, i);
  assert.equal(s.phase, 'won'); assert.equal(s.opened, 381); advanceTime(s, 30); assert.equal(s.elapsed, 17);
});
