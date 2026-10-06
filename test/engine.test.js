import assert from 'node:assert/strict';
import test from 'node:test';
import { ARENA, MOVES, TICK_RATE, cloneState, createState, emptyInput, resetLobby, startMatch, step } from '../public/engine.js';

const buttons = values => ({ ...emptyInput(), ...values });
const idle = [emptyInput(), emptyInput()];
function advance(state, ticks, inputs = idle) {
  for (let tick = 0; tick < ticks; tick++) step(state, inputs);
  return state;
}
function fight(distance = 78) {
  const state = createState();
  startMatch(state);
  advance(state, 3 * TICK_RATE);
  state.fighters[0].x = 500;
  state.fighters[1].x = 500 + distance;
  return state;
}
function finishAndResume(state) {
  advance(state, 2 * TICK_RATE);
  if (state.phase === 'countdown') advance(state, 2 * TICK_RATE);
}

test('countdown freezes movement and combat until its final tick', () => {
  const state = createState();
  startMatch(state);
  const inputs = [buttons({ right: true, light: true }), buttons({ left: true, heavy: true })];
  advance(state, 3 * TICK_RATE - 1, inputs);
  assert.equal(state.phase, 'countdown');
  assert.equal(state.phaseTicks, 1);
  assert.deepEqual(state.fighters.map(fighter => fighter.x), [390, 810]);
  assert.deepEqual(state.fighters.map(fighter => fighter.hp), [100, 100]);
  step(state, inputs);
  assert.equal(state.phase, 'fight');
  assert.equal(state.roundTicks, 90 * TICK_RATE);
});

test('light attack respects startup, hits once per swing, and does not repeat while held', () => {
  const state = fight();
  const inputs = [buttons({ light: true }), emptyInput()];
  advance(state, MOVES.light.startup, inputs);
  assert.equal(state.fighters[1].hp, 100);
  step(state, inputs);
  assert.equal(state.fighters[1].hp, 100 - MOVES.light.damage);
  assert.ok(state.fighters[1].stun > 0);
  advance(state, MOVES.light.total + 20, inputs);
  assert.equal(state.fighters[1].hp, 100 - MOVES.light.damage);
  assert.equal(state.events.filter(event => event.type === 'hit').length, 1);
  assert.equal(state.events.filter(event => event.type === 'swing').length, 1);
});

test('an attack outside sword reach deals no damage', () => {
  const state = fight(300);
  advance(state, MOVES.heavy.total + 10, [buttons({ heavy: true }), emptyInput()]);
  assert.equal(state.fighters[1].hp, 100);
  assert.equal(state.events.some(event => event.type === 'hit'), false);
});

test('held guard prevents damage and pays the move guard cost', () => {
  const state = fight();
  const guard = buttons({ block: true });
  advance(state, 12, [emptyInput(), guard]);
  advance(state, MOVES.light.startup + 1, [buttons({ light: true }), guard]);
  assert.equal(state.fighters[1].hp, 100);
  assert.equal(state.fighters[1].stamina, 100 - MOVES.light.guardDamage);
  assert.ok(state.fighters[1].stun > 0);
  assert.equal(state.events.at(-1).type, 'block');
});

test('a late guard press parries, preserves health, and stuns the attacker', () => {
  const state = fight();
  advance(state, MOVES.light.startup - 2, [buttons({ light: true }), emptyInput()]);
  advance(state, 3, [buttons({ light: true }), buttons({ block: true })]);
  assert.equal(state.fighters[1].hp, 100);
  assert.equal(state.fighters[1].action, 'parry');
  assert.equal(state.fighters[0].action, 'hit');
  assert.ok(state.fighters[0].stun >= 40);
  assert.equal(state.events.at(-1).type, 'parry');
});

test('holding guard through blockstun does not grant another parry window', () => {
  const state = fight();
  const guard = buttons({ block: true });
  advance(state, 12, [emptyInput(), guard]);
  advance(state, MOVES.light.startup + 1, [buttons({ light: true }), guard]);
  advance(state, state.hitstop + MOVES.light.blockstun, [emptyInput(), guard]);
  assert.equal(state.fighters[1].action, 'block');
  // Place the next strike at its contact frame while the same guard stays held.
  const attacker = state.fighters[0];
  attacker.action = 'light';
  attacker.actionFrame = MOVES.light.startup - 1;
  attacker.hitTargets = [];
  attacker.x = state.fighters[1].x - 78;
  step(state, [emptyInput(), guard]);
  assert.equal(state.events.at(-1).type, 'block');
  assert.equal(state.fighters[1].hp, 100);
});

test('depleted guard breaks into a punishable stun', () => {
  const state = fight();
  const guard = buttons({ block: true });
  state.fighters[1].stamina = MOVES.light.guardDamage - 1;
  advance(state, 12, [emptyInput(), guard]);
  advance(state, MOVES.light.startup + 1, [buttons({ light: true }), guard]);
  assert.equal(state.fighters[1].stamina, 0);
  assert.ok(state.fighters[1].guardBroken > 0);
  assert.ok(state.fighters[1].stun >= 90);
  assert.equal(state.events.at(-1).type, 'guardbreak');
});

test('dash spends stamina and its timed invulnerability evades an in-range attack', () => {
  const state = fight(100);
  advance(state, 8, [buttons({ light: true }), emptyInput()]);
  advance(state, 5, [buttons({ light: true }), buttons({ dash: true, left: true })]);
  assert.equal(state.fighters[1].action, 'dash');
  assert.equal(state.fighters[1].actionFrame, MOVES.dash.invulnerableStart);
  assert.equal(state.fighters[1].invulnerable, true);
  assert.equal(state.fighters[1].stamina, 100 - MOVES.dash.stamina);
  assert.ok(Math.abs(state.fighters[1].x - state.fighters[0].x) < MOVES.light.reach);
  advance(state, MOVES.light.active, [buttons({ light: true }), buttons({ dash: true, left: true })]);
  assert.equal(state.fighters[1].hp, 100);
  assert.equal(state.events.some(event => event.type === 'hit'), false);
});

test('dash startup remains vulnerable before the invulnerability window', () => {
  const state = fight();
  advance(state, MOVES.light.startup, [buttons({ light: true }), emptyInput()]);
  step(state, [buttons({ light: true }), buttons({ dash: true, left: true })]);
  assert.equal(state.fighters[1].hp, 100 - MOVES.light.damage);
  assert.equal(state.fighters[1].invulnerable, false);
});

test('insufficient stamina prevents dash and heavy attack; resting restores it', () => {
  const state = fight(300);
  state.fighters[0].stamina = 0;
  step(state, [buttons({ heavy: true, dash: true }), emptyInput()]);
  assert.equal(state.fighters[0].action, 'idle');
  assert.equal(state.events.some(event => event.type === 'swing' || event.type === 'dash'), false);
  advance(state, 400);
  assert.equal(state.fighters[0].stamina, 100);
});

test('a confirmed light can cancel into heavy; a missed light cannot', () => {
  for (const distance of [78, 300]) {
    const state = fight(distance);
    step(state, [buttons({ light: true }), emptyInput()]);
    while (state.fighters[0].actionFrame < 18) step(state);
    step(state, [buttons({ heavy: true }), emptyInput()]);
    assert.equal(state.fighters[0].action, distance === 78 ? 'heavy' : 'light');
    assert.equal(state.events.some(event => event.type === 'cancel'), distance === 78);
  }
});

test('a buffered jump survives a short hitstun and lands back on the floor', () => {
  const state = fight(300);
  state.fighters[0].action = 'hit';
  state.fighters[0].stun = 4;
  step(state, [buttons({ jump: true }), emptyInput()]);
  advance(state, 4);
  assert.equal(state.fighters[0].action, 'jump');
  assert.ok(state.fighters[0].y < ARENA.floor);
  advance(state, 120);
  assert.equal(state.fighters[0].y, ARENA.floor);
  assert.equal(state.fighters[0].vy, 0);
});

test('same-frame attacks trade damage fairly', () => {
  const state = fight();
  advance(state, MOVES.light.startup + 1, [buttons({ light: true }), buttons({ light: true })]);
  assert.deepEqual(state.fighters.map(fighter => fighter.hp), [100 - MOVES.light.damage, 100 - MOVES.light.damage]);
  assert.equal(state.events.filter(event => event.type === 'hit').length, 2);
});

test('best of three retains round wins, resets combat, and ends at two wins', () => {
  const state = fight();
  for (const [index, winner] of [0, 1, 0].entries()) {
    state.fighters[1 - winner].hp = 0;
    step(state);
    assert.equal(state.phase, 'roundEnd');
    assert.equal(state.winner, winner);
    finishAndResume(state);
    if (index < 2) {
      assert.equal(state.phase, 'fight');
      assert.equal(state.round, index + 2);
      assert.deepEqual(state.fighters.map(fighter => fighter.hp), [100, 100]);
    }
  }
  assert.equal(state.phase, 'matchEnd');
  assert.equal(state.winner, 0);
  assert.deepEqual(state.fighters.map(fighter => fighter.wins), [2, 1]);
  const terminal = cloneState(state);
  advance(state, 200, [buttons({ heavy: true }), buttons({ light: true })]);
  assert.deepEqual(state.fighters.map(fighter => fighter.hp), terminal.fighters.map(fighter => fighter.hp));
  resetLobby(state);
  assert.equal(state.phase, 'lobby');
  assert.deepEqual(state.fighters.map(fighter => fighter.wins), [0, 0]);
});

test('timeout awards higher health; double knockout awards neither player', () => {
  const timed = fight(300);
  timed.roundTicks = 1;
  timed.fighters[0].hp = 70;
  timed.fighters[1].hp = 60;
  step(timed);
  assert.equal(timed.winner, 0);
  assert.equal(timed.events.at(-1).reason, 'time');

  const draw = fight();
  draw.fighters.forEach(fighter => { fighter.hp = 0; });
  step(draw);
  assert.equal(draw.winner, null);
  assert.deepEqual(draw.fighters.map(fighter => fighter.wins), [0, 0]);
  finishAndResume(draw);
  assert.equal(draw.phase, 'fight');
  assert.equal(draw.round, 2);
});

test('deterministic mixed-input simulation stays bounded and cloneable', () => {
  const first = fight(300);
  const second = cloneState(first);
  let seed = 0x12345678;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 2 ** 32;
  };
  for (let tick = 0; tick < 5000; tick++) {
    const inputs = [0, 1].map(() => buttons({
      left: random() < 0.35,
      right: random() < 0.35,
      jump: random() < 0.08,
      light: random() < 0.15,
      heavy: random() < 0.08,
      dash: random() < 0.05,
      block: random() < 0.25,
    }));
    step(first, inputs);
    step(second, inputs);
    for (const fighter of first.fighters) {
      assert.ok(Number.isFinite(fighter.x) && fighter.x >= ARENA.minX && fighter.x <= ARENA.maxX);
      assert.ok(Number.isFinite(fighter.y) && fighter.y <= ARENA.floor);
      assert.ok(fighter.hp >= 0 && fighter.hp <= 100);
      assert.ok(fighter.stamina >= 0 && fighter.stamina <= 100);
    }
    assert.ok(first.events.length <= 48);
  }
  assert.deepEqual(first, second);
  const copy = cloneState(first);
  copy.fighters[0].hp = -999;
  assert.notEqual(first.fighters[0].hp, copy.fighters[0].hp);
});
