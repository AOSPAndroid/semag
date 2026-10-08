import assert from 'node:assert/strict';
import test from 'node:test';
import * as game from '../public/shinobi-engine.js';

const input = (buttons = {}, id = 0) => ({ ...game.emptyInput(), aimX: id ? -1 : 1, ...buttons });
function fighting({ ax = 350, ay = 320, bx = 400, by = 320 } = {}) {
  const state = game.createState(); state.phase = 'fight'; state.obstacles = [];
  Object.assign(state.fighters[0], { x: ax, y: ay }); Object.assign(state.fighters[1], { x: bx, y: by });
  return state;
}
function advance(state, ticks, a = input(), b = input({}, 1)) { for (let i = 0; i < ticks; i++) game.step(state, [a, b]); }
function light(state) { game.step(state, [input({ attack: true }), input({}, 1)]); advance(state, game.MOVES.light.startup); }
function projectile(state, owner = 1, extra = {}) {
  const target = state.fighters[1 - owner];
  state.projectiles.push({ id: ++state.projectileId, owner, x: target.x - 20, y: target.y, px: target.x - 20, py: target.y, vx: 20, vy: 0, radius: 3, damage: 14, life: 100, reflections: 0, bornTick: state.tick - 1, ...extra });
}
function parryContact(frame, angle = 0) {
  const state = fighting(), parryStart = game.MOVES.light.startup - frame, shift = Math.max(0, -parryStart);
  for (let tick = 0; tick <= game.MOVES.light.startup + shift; tick++) game.step(state, [input({ attack: tick === shift }), input({ parry: tick === parryStart + shift, aimX: -Math.cos(angle), aimY: Math.sin(angle) }, 1)]);
  return state;
}

test('quick neutral footwork keeps diagonal speed and committed attack movement distinct', () => {
  const straight = fighting({ bx: 800 }), diagonal = game.cloneState(straight);
  advance(straight, 20, input({ down: true })); advance(diagonal, 20, input({ right: true, down: true }));
  const a = straight.fighters[0], b = diagonal.fighters[0];
  assert.ok(a.y - 320 > 60, 'footwork should cover useful spacing rapidly');
  assert.ok(Math.abs(Math.hypot(b.x - 350, b.y - 320) - (a.y - 320)) < 1e-8, 'diagonal movement must not grant extra speed');
  const attacking = fighting({ bx: 800 }); game.step(attacking, [input({ attack: true, down: true }), input({}, 1)]);
  assert.ok(attacking.fighters[0].y > 320 && attacking.fighters[0].y < 320 + game.MOVEMENT.speed, 'commitment slows footwork without freezing input');
  assert.equal(game.getMove(attacking.fighters[0]), game.MOVES.light); assert.equal(game.getMove({ action: 'feint' }), null);
});

test('a released late-recovery tap starts on the first free tick and never auto-repeats', () => {
  const state = fighting({ bx: 800 }), f = state.fighters[0], duration = game.MOVES.light.startup + game.MOVES.light.active + game.MOVES.light.recovery;
  game.step(state, [input({ attack: true }), input({}, 1)]); advance(state, duration - 6);
  game.step(state, [input({ dash: true, up: true }), input({}, 1)]);
  assert.equal(f.action, 'light'); assert.equal(f.inputBuffer.action, 'dash');
  advance(state, 4); assert.equal(f.action, 'light');
  game.step(state, [input(), input({}, 1)]);
  assert.equal(f.action, 'dash'); assert.equal(f.actionFrame, 0); assert.equal(f.dashX, 0); assert.equal(f.dashY, -1);
  assert.equal(f.inputBuffer, null); assert.equal(f.stamina, 100 - game.MOVES.light.cost - game.DASH.cost);
  advance(state, 100, input({ dash: true }));
  assert.equal(state.events.filter(event => event.type === 'dash').length, 1, 'an already held trigger does not become another dash');
});

test('an early buffer expires instead of producing a delayed surprise action', () => {
  const state = fighting({ bx: 800 }), f = state.fighters[0];
  game.step(state, [input({ heavy: true }), input({}, 1)]); advance(state, 2);
  game.step(state, [input({ parry: true }), input({}, 1)]); assert.equal(f.inputBuffer.ticks, game.INPUT_BUFFER.ticks);
  advance(state, game.INPUT_BUFFER.ticks); assert.equal(f.inputBuffer, null);
  advance(state, 90); assert.equal(f.action, 'idle');
  assert.equal(state.events.filter(event => event.type === 'parryStart').length, 0);
});

test('newer buffered intentions replace older ones and simultaneous defensive priority is stable', () => {
  const state = fighting({ bx: 800 }), duration = game.MOVES.light.startup + game.MOVES.light.active + game.MOVES.light.recovery;
  game.step(state, [input({ attack: true }), input({}, 1)]); advance(state, duration - 7);
  game.step(state, [input({ heavy: true }), input({}, 1)]);
  game.step(state, [input({ parry: true }), input({}, 1)]); assert.equal(state.fighters[0].inputBuffer.action, 'parry');
  advance(state, 5); assert.equal(state.fighters[0].action, 'parry');
  const simultaneous = fighting({ bx: 800 }); game.step(simultaneous, [input({ attack: true, heavy: true, parry: true, dash: true }), input({}, 1)]);
  assert.equal(simultaneous.fighters[0].action, 'dash'); assert.equal(simultaneous.fighters[0].stamina, 100 - game.DASH.cost);
});

test('buffered blade and parry capture press-time aim while live movement and look remain immediate', () => {
  for (const action of ['heavy', 'parry', 'throw']) {
    const state = fighting({ bx: 800 }), f = state.fighters[0], duration = game.MOVES.light.startup + game.MOVES.light.active + game.MOVES.light.recovery;
    game.step(state, [input({ attack: true }), input({}, 1)]); advance(state, duration - 5);
    game.step(state, [input({ [action]: true, aimX: 0, aimY: -1 }), input({}, 1)]);
    advance(state, 4, input({ aimX: -1, right: true }));
    assert.equal(f.action, action); assert.equal(f.actionFacing, -Math.PI / 2); assert.equal(f.facing, Math.PI);
    assert.ok(f.vx > 0, 'current movement remains responsive during the new commitment');
  }
});

test('real hit-confirmed cuts chain up to three with a fresh post-hit choice and full third recovery', () => {
  const state = fighting(), f = state.fighters[0]; light(state);
  assert.equal(f.hitConfirmed, true); assert.equal(state.fighters[1].hp, 82); assert.equal(f.comboStep, 1);
  for (const step of [2, 3]) {
    game.step(state, [input({ attack: true }), input({}, 1)]); advance(state, game.CHAIN.startFrame - game.MOVES.light.startup - 1);
    assert.equal(f.actionFrame, 0); assert.equal(f.comboStep, step); assert.equal(f.hitConfirmed, false);
    advance(state, game.MOVES.light.startup);
    assert.equal(state.fighters[1].hp, 100 - step * game.MOVES.light.damage); assert.equal(f.hitConfirmed, true);
  }
  advance(state, game.CHAIN.startFrame - game.MOVES.light.startup);
  const before = f.stamina; game.step(state, [input({ attack: true, dash: true }), input({}, 1)]);
  assert.equal(f.action, 'light'); assert.equal(f.comboStep, 3); assert.equal(f.stamina, before);
  assert.equal(game.getCombatOptions(f).canChain, false); assert.equal(game.getCombatOptions(f).canDashCancel, false);
  advance(state, game.INPUT_BUFFER.ticks); assert.equal(f.action, 'light'); assert.equal(f.inputBuffer, null);
  advance(state, 4); assert.equal(f.action, 'idle');
  assert.equal(state.events.filter(event => event.type === 'attack').length, 3);
  assert.deepEqual(state.events.filter(event => event.type === 'chain').map(event => event.comboStep), [2, 3]);
  assert.equal(state.events.filter(event => event.type === 'dashCancel').length, 0);
});

test('a press before contact cannot pre-program a hit confirm and held attack never chains', () => {
  for (const mode of ['early', 'held']) {
    const state = fighting(), f = state.fighters[0]; game.step(state, [input({ attack: true }), input({}, 1)]);
    if (mode === 'early') { advance(state, 5); game.step(state, [input({ attack: true }), input({}, 1)]); advance(state, 25); }
    else advance(state, 40, input({ attack: true }));
    assert.equal(state.fighters[1].hp, 82, mode); assert.equal(state.events.filter(event => event.type === 'chain').length, 0, mode);
    assert.equal(f.action, 'idle', mode);
  }
});

test('whiffs, cover, invulnerability and a parry cannot provide hit-confirm cancels', () => {
  for (const mode of ['miss', 'cover', 'invulnerable', 'parry']) {
    const state = fighting({ bx: mode === 'miss' ? 800 : 400 }), f = state.fighters[0];
    if (mode === 'cover') state.obstacles = [{ id: 'thin', x: 372, y: 290, w: 6, h: 60 }];
    if (mode === 'parry') { Object.assign(state.fighters[1], { action: 'parry', actionFrame: 0, actionFacing: Math.PI }); }
    if (mode === 'invulnerable') {
      game.step(state, [input({ attack: true }), input({}, 1)]); advance(state, 3);
      game.step(state, [input(), input({ dash: true, left: true }, 1)]); advance(state, 4);
    } else light(state);
    assert.equal(state.fighters[1].hp, 100, mode); assert.equal(f.hitConfirmed, false, mode);
    game.step(state, [input({ attack: true }), input({}, 1)]); advance(state, 8);
    assert.equal(state.events.filter(event => event.type === 'chain').length, 0, mode);
  }
});

test('a chained blade locks its new direction and cannot bend after the confirm', () => {
  const state = fighting(), f = state.fighters[0]; light(state);
  game.step(state, [input({ attack: true, aimX: -1 }), input({}, 1)]); advance(state, 7);
  assert.equal(f.comboStep, 2); assert.equal(f.actionFacing, Math.PI);
  advance(state, game.MOVES.light.startup, input({ aimX: 1 }));
  assert.equal(state.fighters[1].hp, 82); assert.equal(f.actionFacing, Math.PI); assert.equal(f.facing, 0);
});

test('a confirmed retreat pays the full dash cancel tax and retains vulnerable startup', () => {
  const state = fighting(), f = state.fighters[0]; light(state);
  game.step(state, [input({ dash: true, left: true }), input({}, 1)]); advance(state, 7);
  assert.equal(f.action, 'dash'); assert.equal(f.actionFrame, 0); assert.equal(f.stamina, 100 - game.MOVES.light.cost - game.CHAIN.dashCancelCost);
  assert.equal(f.invulnerable, false); assert.equal(f.dashX, -1);
  assert.equal(state.events.filter(event => event.type === 'dashCancel').length, 1);
  const poor = fighting(); light(poor); poor.fighters[0].stamina = game.CHAIN.dashCancelCost - .5;
  game.step(poor, [input({ dash: true }), input({}, 1)]); advance(poor, 7);
  assert.equal(poor.fighters[0].action, 'light'); assert.equal(poor.fighters[0].stamina, game.CHAIN.dashCancelCost - .5);
});

test('chain and feint windows have exact final-tick boundaries', () => {
  for (const frame of [game.CHAIN.endFrame, game.CHAIN.endFrame + 1]) {
    const state = fighting(), f = state.fighters[0]; light(state); advance(state, frame - game.MOVES.light.startup - 1);
    game.step(state, [input({ attack: true }), input({}, 1)]);
    assert.equal(f.comboStep, frame === game.CHAIN.endFrame ? 2 : 1);
    assert.equal(state.events.filter(event => event.type === 'chain').length, frame === game.CHAIN.endFrame ? 1 : 0);
    if (frame > game.CHAIN.endFrame) {
      advance(state, game.MOVES.light.startup + game.MOVES.light.active + game.MOVES.light.recovery - frame);
      assert.equal(f.actionFrame, 0); assert.equal(f.comboStep, 1, 'a late buffered cut waits for full recovery and starts a new chain');
    }
  }
  for (const frame of [game.FEINT.endFrame, game.FEINT.endFrame + 1]) {
    const state = fighting({ bx: 800 }); game.step(state, [input({ heavy: true }), input({}, 1)]); advance(state, frame - 1);
    game.step(state, [input({ feint: true }), input({}, 1)]);
    assert.equal(state.fighters[0].action, frame === game.FEINT.endFrame ? 'feint' : 'heavy');
    if (frame > game.FEINT.endFrame) assert.equal(state.fighters[0].inputBuffer, null);
  }
});

test('a feint spends stamina in the early heavy tell and leaves exposed recovery without damage', () => {
  const state = fighting(), f = state.fighters[0]; game.step(state, [input({ heavy: true }), input({}, 1)]); advance(state, 5);
  assert.equal(game.getCombatOptions(f).canFeint, false);
  game.step(state, [input({ feint: true, aimX: -1 }), input({}, 1)]);
  assert.equal(f.action, 'feint'); assert.equal(f.actionFrame, 0); assert.equal(f.stamina, 100 - game.MOVES.heavy.cost - game.FEINT.cost);
  assert.equal(f.actionFacing, 0, 'the withdrawn blade retains the original heavy direction');
  game.step(state, [input({ dash: true, parry: true }), input({}, 1)]); assert.equal(f.action, 'feint'); assert.equal(f.invulnerable, false);
  advance(state, game.FEINT.duration - 2); assert.equal(f.action, 'feint'); assert.equal(state.fighters[1].hp, 100);
  game.step(state, [input(), input({}, 1)]); assert.equal(f.action, 'idle'); assert.equal(f.inputBuffer, null);
  assert.equal(state.events.filter(event => event.type === 'feint').length, 1);
});

test('early feint taps buffer to their legal tell; late, neutral and unaffordable feints never attack', () => {
  const early = fighting(); game.step(early, [input({ heavy: true }), input({}, 1)]); advance(early, 1);
  game.step(early, [input({ feint: true }), input({}, 1)]); assert.equal(early.fighters[0].action, 'heavy');
  advance(early, game.FEINT.startFrame - 2); assert.equal(early.fighters[0].action, 'feint');
  for (const mode of ['neutral', 'late', 'poor']) {
    const state = fighting({ bx: 800 }), f = state.fighters[0];
    if (mode !== 'neutral') { game.step(state, [input({ heavy: true }), input({}, 1)]); advance(state, mode === 'late' ? game.FEINT.endFrame : game.FEINT.startFrame - 1); }
    if (mode === 'poor') f.stamina = game.FEINT.cost - .5;
    game.step(state, [input({ feint: true }), input({}, 1)]); assert.notEqual(f.action, 'feint', mode);
    advance(state, 90, input({ feint: true }));
    assert.equal(f.action, 'idle', mode); assert.equal(f.inputBuffer, null, mode);
    assert.equal(state.events.filter(event => event.type === 'attack').length, mode === 'neutral' ? 0 : 1, mode);
  }
});

test('feinting a heavy is punishable by an opponent real cut during the exposed recovery', () => {
  const state = fighting(); game.step(state, [input({ heavy: true }), input({}, 1)]); advance(state, 5);
  game.step(state, [input({ feint: true }), input({ attack: true }, 1)]); advance(state, game.MOVES.light.startup);
  assert.equal(state.fighters[0].action, 'feint'); assert.equal(state.fighters[0].hp, 82); assert.equal(state.fighters[1].hp, 100);
});

test('perfect parry requires both precise timing and a narrower incoming direction', () => {
  for (const [frame, angle, kind] of [[2, 0, 'perfect'], [4, .5, 'perfect'], [5, 0, 'normal'], [9, 0, 'normal'], [3, .7, 'normal'], [1, 0, 'miss'], [10, 0, 'miss'], [3, .9, 'miss']]) {
    const state = parryContact(frame, angle), [attacker, defender] = state.fighters, event = state.events.findLast(event => event.type === 'parry');
    assert.equal(defender.hp, kind === 'miss' ? 82 : 100, `${frame}/${angle}`);
    if (kind === 'miss') { assert.equal(event, undefined); assert.equal(defender.parrySuccess, false); continue; }
    const perfect = kind === 'perfect';
    assert.equal(event.perfect, perfect); assert.equal(attacker.stunDuration, perfect ? game.PARRY.perfectStun : game.PARRY.stun);
    assert.equal(defender.stamina, 100 - game.PARRY.cost + (perfect ? game.PARRY.perfectRefund : game.PARRY.refund));
    assert.equal(defender.perfectParries, perfect ? 1 : 0); assert.equal(defender.parrySuccess, true);
  }
});

test('successful parry opens a counter quickly while a missed guard remains committed', () => {
  const success = parryContact(game.PARRY.startup), defender = success.fighters[1];
  advance(success, game.PARRY.successDuration - game.PARRY.startup - 1); assert.equal(defender.action, 'parry');
  game.step(success, [input(), input({ attack: true }, 1)]); assert.equal(defender.action, 'light');
  advance(success, game.MOVES.light.startup);
  assert.equal(success.fighters[0].hp, 82); assert.equal(success.fighters[0].action, 'stun');
  const miss = fighting({ bx: 800 }); game.step(miss, [input({ parry: true }), input({}, 1)]);
  advance(miss, game.PARRY.duration - 1); assert.equal(miss.fighters[0].action, 'parry');
  game.step(miss, [input(), input({}, 1)]); assert.equal(miss.fighters[0].action, 'idle');
});

test('normal deflections retain speed; perfect deflections accelerate with a strict reflection cap', () => {
  for (const [frame, reflections, perfect] of [[5, 0, false], [2, 0, true], [2, 2, false]]) {
    const state = fighting({ ax: 200, bx: 350 }), f = state.fighters[1];
    game.step(state, [input(), input({ parry: true }, 1)]); advance(state, frame - 1);
    projectile(state, 0, { x: 300, y: 320, vx: 80, reflections }); game.step(state, [input(), input({}, 1)]);
    if (reflections === 2) { assert.equal(state.projectiles.length, 0); assert.equal(f.hp, 86); continue; }
    assert.equal(f.hp, 100); assert.equal(state.projectiles[0].reflections, 1);
    assert.equal(state.projectiles[0].vx, -80 * (perfect ? game.PARRY.perfectReflectionSpeed : 1));
    assert.equal(state.events.at(-1).perfect, perfect);
  }
});

test('damage, parry stun and lifecycle fences discard stale buffered intentions', () => {
  const damaged = fighting({ bx: 800 }); game.step(damaged, [input({ heavy: true }), input({}, 1)]);
  game.step(damaged, [input({ parry: true }), input({}, 1)]); assert.equal(damaged.fighters[0].inputBuffer.action, 'parry');
  projectile(damaged); game.step(damaged, [input(), input({}, 1)]); assert.equal(damaged.fighters[0].inputBuffer, null);
  const stunned = fighting(); game.step(stunned, [input({ attack: true }), input({}, 1)]); advance(stunned, 4);
  game.step(stunned, [input({ heavy: true }), input({ parry: true }, 1)]); advance(stunned, 3);
  assert.equal(stunned.fighters[0].action, 'stun'); assert.equal(stunned.fighters[0].inputBuffer, null);
  const countdown = game.createState(); game.startMatch(countdown); countdown.fighters[0].inputBuffer = { action: 'heavy', ticks: 10 };
  advance(countdown, 360, input({ attack: true, feint: true })); assert.equal(countdown.fighters[0].inputBuffer, null);
  game.step(countdown, [input({ attack: true, feint: true }), input({}, 1)]); assert.equal(countdown.fighters[0].action, 'idle');
  const round = fighting(); light(round); round.fighters[1].hp = game.MOVES.light.damage;
  game.step(round, [input({ attack: true }), input({}, 1)]); advance(round, 15);
  assert.equal(round.phase, 'roundEnd'); assert.ok(round.fighters.every(f => f.inputBuffer === null && !f.hitConfirmed && f.comboStep === 0));
  game.resetLobby(round); assert.ok(round.fighters.every(f => f.perfectParries === 0 && !f.parrySuccess));
});

test('new combat choices remain deterministic after JSON clones and resource storage stays bounded', () => {
  const a = fighting(), b = game.cloneState(a);
  for (let tick = 0; tick < 2500; tick++) {
    const controls = [input({ attack: tick % 17 === 0, heavy: tick % 131 === 0, feint: tick % 131 === 9, dash: tick % 71 === 0, throw: tick % 97 === 0, parry: tick % 53 === 0, left: tick % 130 > 95, right: tick % 130 < 20 }), input({ attack: tick % 29 === 0, parry: tick % 47 === 0, feint: tick % 139 === 10, heavy: tick % 139 === 0, dash: tick % 83 === 0, throw: tick % 107 === 0 }, 1)];
    game.step(a, controls); game.step(b, controls); assert.deepEqual(a, b);
    assert.ok(a.events.length <= 48 && a.projectiles.length <= 24);
    for (const f of a.fighters) {
      assert.ok(f.stamina >= 0 && f.stamina <= 100 && f.comboStep >= 0 && f.comboStep <= game.CHAIN.max);
      if (f.inputBuffer) assert.ok(f.inputBuffer.ticks > 0 && f.inputBuffer.ticks <= game.INPUT_BUFFER.ticks && Number.isFinite(f.inputBuffer.aimX) && Number.isFinite(f.inputBuffer.aimY));
    }
  }
});

test('presentation sweep uses exact cover, simultaneous bodies and newest metadata without mutation', () => {
  const state = fighting({ ax: 380, ay: 320, bx: 430, by: 320 }); state.obstacles = [{ id: 'pillar', x: 400, y: 290, w: 10, h: 60 }];
  const desired = state.fighters.map(f => ({ ...f, x: f.id ? 300 : 470, y: 330, hp: 73, action: 'feint', inputBuffer: { action: 'dash' } }));
  // Reject an outlandish desire rather than tracing an unrelated path.
  desired[1].x = 390;
  const before = game.cloneState(state), original = game.cloneState(desired), shown = game.sweepPresentationFighters(state, desired);
  assert.deepEqual(state, before); assert.deepEqual(desired, original); assert.notEqual(shown, desired);
  assert.ok(shown[0].x <= 385 + 1e-6); assert.ok(shown[1].x >= 425 - 1e-6);
  for (const f of shown) { assert.equal(f.hp, 73); assert.equal(f.action, 'feint'); assert.deepEqual(f.inputBuffer, { action: 'dash' }); }
  const touching = fighting({ ax: 400, bx: 430 }), opposite = [{ ...touching.fighters[1], x: 390, y: 330 }, { ...touching.fighters[0], x: 440, y: 330 }];
  const result = game.sweepPresentationFighters(touching, opposite);
  assert.deepEqual(result.map(f => f.id), [1, 0]); assert.ok(result[1].x < result[0].x); assert.ok(Math.hypot(result[0].x - result[1].x, result[0].y - result[1].y) >= 30 - 1e-6);
  assert.equal(result[0].y, 330); assert.equal(result[1].y, 330);
});

test('presentation sweep keeps rounded-corner sliding, boundaries and invalid offset fallbacks exact', () => {
  const state = fighting({ ax: 370, ay: 285, bx: 800, by: 500 }); state.obstacles = [{ id: 'stone', x: 400, y: 300, w: 80, h: 80 }];
  const desired = state.fighters.map(f => ({ ...f, x: f.x + 70, y: f.y + 70 })), result = game.sweepPresentationFighters(state, desired), a = result[0];
  const rect = state.obstacles[0], distance = Math.hypot(a.x - Math.max(rect.x, Math.min(rect.x + rect.w, a.x)), a.y - Math.max(rect.y, Math.min(rect.y + rect.h, a.y)));
  assert.ok(distance >= a.radius - 1e-6); assert.ok(a.x > state.fighters[0].x || a.y > state.fighters[0].y);
  for (const invalid of [NaN, Infinity, state.fighters[0].x + 1000]) {
    const next = desired.map(f => ({ ...f })); next[0].x = invalid;
    const shown = game.sweepPresentationFighters(state, next); assert.equal(shown[0].x, state.fighters[0].x); assert.equal(shown[0].y, state.fighters[0].y);
  }
  const edge = fighting({ ax: game.WORLD.maxX - 5, ay: game.WORLD.maxY - 5, bx: 600 });
  const shown = game.sweepPresentationFighters(edge, edge.fighters.map(f => ({ ...f, x: f.x + 60, y: f.y + 60 })));
  assert.equal(shown[0].x, game.WORLD.maxX); assert.equal(shown[0].y, game.WORLD.maxY);
});

test('presentation crowding re-sweeps a wall-pinned opponent on every authored stage', () => {
  for (const stage of Object.values(game.STAGES)) {
    const wall = stage.covers[0], x = wall.x + wall.w + game.WORLD.fighterRadius, y = wall.y + wall.h / 2;
    const state = fighting({ ax: x + 30, ay: y, bx: x, by: y }); state.obstacles = stage.covers.map(rect => ({ ...rect }));
    const desired = state.fighters.map(f => ({ ...f, x: f.x - 45, y: f.y + 60 }));
    const displayed = game.sweepPresentationFighters(state, desired);
    assert.ok(Math.hypot(displayed[0].x - displayed[1].x, displayed[0].y - displayed[1].y) >= 30 - 1e-6, stage.id);
    for (const f of displayed) {
      assert.ok(f.y > y, `${stage.id} tangential presentation movement stays free`);
      for (const rect of state.obstacles) assert.ok(Math.hypot(f.x - Math.max(rect.x, Math.min(rect.x + rect.w, f.x)), f.y - Math.max(rect.y, Math.min(rect.y + rect.h, f.y))) >= f.radius - 1e-6, `${stage.id} must preserve cover contact`);
    }
  }
});
