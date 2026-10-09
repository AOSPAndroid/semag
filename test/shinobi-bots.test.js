import assert from 'node:assert/strict';
import test from 'node:test';
import * as game from '../public/shinobi-engine.js';
import * as bots from '../public/shinobi-bots.js';

const input = (extra = {}) => ({ ...game.emptyInput(), ...extra });
function fight(options = {}) {
  const state = bots.createPractice(options); bots.startPractice(state);
  while (state.phase === 'countdown') game.step(state);
  return state;
}
function advance(state, ticks, inputs = []) { for (let tick = 0; tick < ticks; tick++) game.step(state, inputs); }
function position(state, points) { state.obstacles = []; for (const [index, point] of points.entries()) Object.assign(state.fighters[index], point); }
function tool(state, extra = {}) {
  state.projectiles.push({ id: ++state.projectileId, owner: 0, x: 200, y: 320, px: 200, py: 320, vx: 400, vy: 0, radius: 3, damage: game.KUNAI.damage, life: 100, reflections: 0, bornTick: state.tick - 1, ...extra });
}
const coverDistance = (fighter, rect) => Math.hypot(fighter.x - Math.max(rect.x, Math.min(rect.x + rect.w, fighter.x)), fighter.y - Math.max(rect.y, Math.min(rect.y + rect.h, fighter.y)));

test('explicit practice settings sanitize bounded teams and preserve chosen stage on reset and real round restart', () => {
  assert.equal(game.createState().fighters.length, 2); assert.equal(game.createState().practice, undefined);
  const state = bots.createPractice({ bots: 400, difficulty: '__proto__', stageId: 'garden', seed: 123 });
  assert.deepEqual(state.practice, { bots: 4, difficulty: 'hard', stageId: 'garden', seed: 123 });
  assert.equal(state.phase, 'lobby'); assert.equal(state.fighters.length, 5);
  assert.deepEqual(state.fighters.map(f => f.team), [0, 1, 1, 1, 1]); assert.ok(state.fighters.slice(1).every(f => f.bot && f.name));
  for (const f of state.fighters) { assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y)); for (const rect of state.obstacles) assert.ok(coverDistance(f, rect) >= f.radius); }
  bots.startPractice(state); assert.equal(state.phaseTicks, 360); assert.equal(state.stageId, 'garden');
  advance(state, 360); state.fighters.slice(1).forEach(f => { f.hp = 0; }); game.step(state);
  assert.equal(state.winner, 0); advance(state, 240); assert.equal(state.round, 2); assert.equal(state.stageId, 'garden'); assert.equal(state.fighters.length, 5);
  game.resetLobby(state); assert.equal(state.phase, 'lobby'); assert.equal(state.practice.bots, 4); assert.equal(state.stageId, 'garden'); assert.ok(state.fighters.every(f => f.wins === 0));
  assert.equal(bots.createPractice({ bots: -2, stageId: '__proto__' }).practice.bots, 1); assert.equal(bots.createPractice({ stageId: '__proto__' }).stageId, 'rooftop');
});

test('a real committed human cut hits each hostile body once while bot allies cannot damage one another', () => {
  const state = fight({ bots: 3 }); position(state, [{ x: 350, y: 320 }, { x: 400, y: 300 }, { x: 400, y: 340 }, { x: 800, y: 500 }]);
  game.step(state, [input({ attack: true })]); advance(state, 20);
  assert.equal(state.fighters[1].hp, 82); assert.equal(state.fighters[2].hp, 82); assert.equal(state.fighters[0].damageDealt, 36);
  assert.deepEqual(state.fighters[0].attackHits, [1, 2]); advance(state, 20); assert.equal(state.fighters[1].hp, 82);
  const allied = fight({ bots: 2 }); position(allied, [{ x: 154, y: 500 }, { x: 500, y: 280 }, { x: 500, y: 330 }]);
  game.step(allied, [input(), input({ attack: true, aimX: 0, aimY: 1 }), input({ heavy: true, aimX: 0, aimY: -1 })]); advance(allied, 35);
  assert.ok(allied.fighters.every(f => f.hp === 100)); assert.equal(allied.events.filter(e => e.type === 'hit').length, 0);
});

test('multiple hostile blades retain symmetric same-tick trades and genuine directional parry consequences', () => {
  const state = fight({ bots: 2 }); position(state, [{ x: 350, y: 320 }, { x: 400, y: 300 }, { x: 400, y: 340 }]);
  game.step(state, [input({ attack: true }), input({ attack: true, aimX: -1 }), input({ attack: true, aimX: -1 })]); advance(state, 8);
  assert.equal(state.fighters[0].hp, 64); assert.equal(state.fighters[1].hp, 82); assert.equal(state.fighters[2].hp, 82);
  const guarded = fight({ bots: 2 }); position(guarded, [{ x: 350, y: 320 }, { x: 400, y: 320 }, { x: 800, y: 500 }]);
  game.step(guarded, [input({ attack: true })]); advance(guarded, 4);
  game.step(guarded, [input(), input({ parry: true, aimX: -1 })]); advance(guarded, 3);
  assert.equal(guarded.fighters[1].hp, 100); assert.equal(guarded.fighters[0].action, 'stun'); assert.equal(guarded.fighters[1].parries, 1);
});

test('kunai select the nearest living hostile contact, skip allies and corpses, and respect nearer cover', () => {
  for (const covered of [false, true]) {
    const state = fight({ bots: 3 }); position(state, [{ x: 154, y: 320 }, { x: 350, y: 320 }, { x: 500, y: 320 }, { x: 700, y: 320 }]);
    if (covered) state.obstacles = [{ x: 280, y: 280, w: 20, h: 80 }];
    tool(state); game.step(state);
    assert.equal(state.fighters[1].hp, covered ? 100 : 86); assert.equal(state.fighters[2].hp, 100); assert.equal(state.projectiles.length, 0);
  }
  const allied = fight({ bots: 3 }); position(allied, [{ x: 200, y: 320 }, { x: 350, y: 320 }, { x: 500, y: 320 }, { x: 700, y: 320 }]);
  tool(allied, { owner: 2, x: 480, px: 480, vx: -400 }); game.step(allied);
  assert.equal(allied.fighters[0].hp, 86); assert.equal(allied.fighters[1].hp, 100);
  const corpse = fight({ bots: 2 }); position(corpse, [{ x: 154, y: 320 }, { x: 350, y: 320 }, { x: 500, y: 320 }]); corpse.fighters[1].hp = 0;
  tool(corpse); game.step(corpse); assert.equal(corpse.fighters[2].hp, 86);
});

test('a reflected tool changes teams and hits its original enemy rather than another bot ally', () => {
  const state = fight({ bots: 2 }); position(state, [{ x: 200, y: 320 }, { x: 350, y: 320 }, { x: 500, y: 320 }]);
  game.step(state, [input(), input({ parry: true, aimX: -1 })]); advance(state, 3);
  tool(state, { x: 300, px: 300, vx: 80 }); game.step(state);
  assert.equal(state.projectiles[0].owner, 1); assert.equal(state.fighters[1].hp, 100); assert.equal(state.fighters[2].hp, 100);
  advance(state, 2); assert.equal(state.fighters[0].hp, 86); assert.equal(state.fighters[2].hp, 100);
});

test('rounds require the complete bot side to fall and timeout compares normalized team health', () => {
  const state = fight({ bots: 4 }); state.fighters[1].hp = 0; game.step(state); assert.equal(state.phase, 'fight');
  state.fighters.slice(1).forEach(f => { f.hp = 0; }); game.step(state); assert.equal(state.phase, 'roundEnd'); assert.equal(state.winnerTeam, 0); assert.equal(state.fighters[0].wins, 1);
  const loss = fight({ bots: 4 }); loss.fighters[0].hp = 0; game.step(loss); assert.equal(loss.winner, 1); assert.equal(loss.winnerTeam, 1); assert.ok(loss.fighters.slice(1).every(f => f.wins === 1));
  const equal = fight({ bots: 4 }); equal.roundTicks = 1; game.step(equal); assert.equal(equal.winner, null, 'four healthy bots do not win a draw on raw total HP');
  const lead = fight({ bots: 4 }); lead.fighters[0].hp = 75; lead.fighters.slice(1).forEach(f => { f.hp = 50; }); lead.roundTicks = 1; game.step(lead); assert.equal(lead.winner, 0);
  const eliminated = fight({ bots: 4 }); eliminated.fighters[0].hp = 90; eliminated.fighters[1].hp = 0; eliminated.roundTicks = 1; game.step(eliminated); assert.equal(eliminated.winner, 0, 'eliminated fighters remain zero in the side health fraction');
});

test('dead fighters cannot move, spend resources or block living footwork during a multi-enemy round', () => {
  const state = fight({ bots: 2 }); position(state, [{ x: 300, y: 320 }, { x: 350, y: 320 }, { x: 850, y: 500 }]);
  const dead = state.fighters[1]; dead.hp = 0; const before = { x: dead.x, y: dead.y, stamina: dead.stamina, kunai: dead.kunai };
  advance(state, 30, [input({ right: true }), input({ left: true, heavy: true, dash: true, throw: true })]);
  assert.equal(dead.action, 'dead'); assert.deepEqual({ x: dead.x, y: dead.y, stamina: dead.stamina, kunai: dead.kunai }, before);
  assert.ok(state.fighters[0].x > dead.x + dead.radius); assert.equal(state.phase, 'fight');
});

test('three-body fast contacts preserve separation, cover clearance and movement energy', () => {
  for (const stageId of Object.keys(game.STAGES)) {
    const state = fight({ bots: 4, stageId }), wall = state.obstacles[0], x = wall.x + wall.w + 15, y = wall.y + wall.h / 2;
    Object.assign(state.fighters[0], { x: x + 60, y }); Object.assign(state.fighters[1], { x: x + 30, y }); Object.assign(state.fighters[2], { x, y });
    for (let tick = 0; tick < 80; tick++) {
      const old = state.fighters.map(f => ({ x: f.x, y: f.y }));
      game.step(state, state.fighters.map((f, id) => input({ left: id < 3, down: id < 3, dash: id < 3 && tick === 0 })));
      for (const f of state.fighters) {
        assert.ok(Math.hypot(f.x - old[f.id].x, f.y - old[f.id].y) <= Math.hypot(f.vx, f.vy) + 1e-5, `${stageId}: collisions add no speed`);
        for (const rect of state.obstacles) assert.ok(coverDistance(f, rect) >= f.radius - 1e-5, `${stageId}: no cover penetration`);
      }
      for (let a = 0; a < state.fighters.length; a++) for (let b = a + 1; b < state.fighters.length; b++) assert.ok(Math.hypot(state.fighters[a].x - state.fighters[b].x, state.fighters[a].y - state.fighters[b].y) >= 30 - 1e-5, `${stageId}: bodies remain separate`);
    }
    assert.ok(state.fighters[2].y > y + 40, `${stageId}: crowding still permits tangential escape`);
  }
});

test('multi-fighter presentation reuses real swept contacts without changing accepted actors', () => {
  const state = fight({ bots: 2 }); position(state, [{ x: 350, y: 320 }, { x: 400, y: 320 }, { x: 450, y: 320 }]);
  const before = game.cloneState(state), desired = state.fighters.map(f => ({ ...f, x: f.id === 0 ? 440 : f.id === 2 ? 360 : f.x }));
  const shown = game.sweepPresentationFighters(state, desired);
  assert.deepEqual(state, before); assert.notDeepEqual(shown, desired);
  for (let a = 0; a < shown.length; a++) for (let b = a + 1; b < shown.length; b++) assert.ok(Math.hypot(shown[a].x - shown[b].x, shown[a].y - shown[b].y) >= 30 - 1e-5);
});

test('five simultaneous inward dashes cannot tunnel through crowded contact from different approach angles', () => {
  for (const rotation of [0, .17, .63]) {
    const state = fight({ bots: 4 }); state.obstacles = [];
    for (const f of state.fighters) { const angle = f.id * Math.PI * 2 / 5 + rotation; f.x = 480 + Math.cos(angle) * 48; f.y = 320 + Math.sin(angle) * 48; }
    for (let tick = 0; tick < 22; tick++) {
      const before = state.fighters.map(f => ({ x: f.x, y: f.y }));
      game.step(state, state.fighters.map(f => { const dx = 480 - f.x, dy = 320 - f.y, length = Math.hypot(dx, dy) || 1; return input({ dash: tick === 0, aimX: dx / length, aimY: dy / length }); }));
      for (const f of state.fighters) assert.ok(Math.hypot(f.x - before[f.id].x, f.y - before[f.id].y) <= Math.hypot(f.vx, f.vy) + 1e-5);
      for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) assert.ok(Math.hypot(state.fighters[a].x - state.fighters[b].x, state.fighters[a].y - state.fighters[b].y) >= 30 - 1e-5);
    }
  }
});

test('bot decisions wait for delayed observations and cannot spend resources or mutate real fighters', () => {
  for (const difficulty of Object.keys(bots.DIFFICULTIES)) {
    const state = fight({ bots: 1, difficulty }); position(state, [{ x: 350, y: 320 }, { x: 400, y: 320 }]);
    const before = game.cloneState(state.fighters), first = bots.botInputs(state);
    assert.deepEqual(state.fighters, before); assert.ok(game.INPUT_KEYS.every(key => first[1][key] === false));
    game.step(state, [input({ attack: true }), first[1]]);
    for (let tick = 0; tick < game.MOVES.light.startup; tick++) bots.stepPractice(state);
    assert.equal(state.fighters[1].hp, 82, `${difficulty}: a fresh close light cut lands before a bot can react`);
    assert.equal(state.fighters[1].parries, 0); assert.equal(state.fighters[1].stamina, 100);
  }
});

test('hidden human movement never updates last-seen bot aim through solid cover', () => {
  const state = fight({ bots: 1, stageId: 'garden' });
  for (let tick = 0; tick < 60; tick++) { bots.botInputs(state); state.tick++; }
  const brain = state.botState.brains[0], known = { ...brain.lastSeen };
  Object.assign(state.fighters[0], { x: 400, y: 310 }); Object.assign(state.fighters[1], { x: 560, y: 310 });
  for (let tick = 0; tick < 60; tick++) { bots.botInputs(state); state.tick++; }
  assert.equal(brain.lastSeen.x, known.x); assert.equal(brain.lastSeen.y, known.y);
  assert.ok(state.botState.history.length <= 36);
});

test('hard bots navigate each actual stage, use real attacks and complete a tough finite match', () => {
  for (const stageId of Object.keys(game.STAGES)) for (const count of [1, 4]) {
    const state = bots.createPractice({ bots: count, stageId, seed: 123, difficulty: 'hard' }); bots.startPractice(state);
    for (let tick = 0; tick < 6000 && state.phase !== 'matchEnd'; tick++) {
      bots.stepPractice(state);
      assert.ok(state.events.length <= 48 && state.projectiles.length <= 24);
      for (const f of state.fighters) {
        assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y) && f.stamina >= 0 && f.stamina <= 100 && f.kunai >= 0 && f.kunai <= 3);
        for (const rect of state.obstacles) assert.ok(coverDistance(f, rect) >= f.radius - 1e-5);
      }
    }
    assert.equal(state.phase, 'matchEnd', `${stageId}/${count} bots actually finish`); assert.equal(state.winner, 1); assert.equal(state.fighters[0].hp, 0);
    assert.ok(state.fighters.slice(1).some(f => f.damageDealt > 0)); assert.ok(state.botState.history.length <= 36);
  }
});

test('JSON-cloned bot practice stays deterministic through reactions, tools, cover and match endings', () => {
  const a = bots.createPractice({ bots: 4, difficulty: 'expert', stageId: 'garden', seed: 972 }); bots.startPractice(a);
  const b = game.cloneState(a);
  for (let tick = 0; tick < 2300; tick++) {
    const human = input({ up: tick % 420 < 180, right: tick % 600 < 160, attack: tick % 37 === 0, heavy: tick % 193 === 0, parry: tick % 97 === 0, throw: tick % 179 === 0, dash: tick % 251 === 0, aimX: Math.cos(tick / 40), aimY: Math.sin(tick / 40) });
    bots.stepPractice(a, human); bots.stepPractice(b, human); assert.deepEqual(a, b);
  }
  const before = game.cloneState(a.fighters); bots.botInputs(a); assert.deepEqual(a.fighters, before);
  assert.ok(a.botState.history.length <= 36);
});

test('difficulty increases reaction and precision without granting damage, stamina, health or tools', () => {
  assert.ok(bots.DIFFICULTIES.normal.reactionTicks > bots.DIFFICULTIES.hard.reactionTicks && bots.DIFFICULTIES.hard.reactionTicks > bots.DIFFICULTIES.expert.reactionTicks);
  assert.ok(bots.DIFFICULTIES.expert.parryChance < 1 && bots.DIFFICULTIES.expert.aimError > 0);
  for (const difficulty of Object.keys(bots.DIFFICULTIES)) {
    const state = bots.createPractice({ bots: 4, difficulty });
    assert.ok(state.fighters.every(f => f.hp === 100 && f.maxHp === 100 && f.stamina === 100 && f.kunai === 3));
    const idle = game.cloneState(state.fighters); for (let tick = 0; tick < 30; tick++) bots.stepPractice(state); assert.deepEqual(state.fighters, idle);
  }
});

test('expert opponents use genuine defense and punish openings but remain beatable by committed human cuts', () => {
  let parries = 0, humanDamage = 0; const actions = new Set();
  for (let seed = 1; seed <= 8; seed++) {
    const state = fight({ bots: 1, difficulty: 'expert', seed }); position(state, [{ x: 350, y: 320 }, { x: 420, y: 320 }]);
    for (let tick = 0; tick < 500 && state.phase === 'fight'; tick++) {
      const [human, enemy] = state.fighters, dx = enemy.x - human.x, dy = enemy.y - human.y, length = Math.hypot(dx, dy) || 1;
      bots.stepPractice(state, input({ aimX: dx / length, aimY: dy / length, heavy: tick % 70 === 0, parry: tick % 70 === 45 }));
      actions.add(state.fighters[1].action);
    }
    parries += state.fighters[1].parries; humanDamage += state.fighters[0].damageDealt;
  }
  assert.ok(parries > 0, 'delayed defense actually produces real parry contacts');
  assert.ok(humanDamage > 0, 'defense never grants perfect blocking or immunity');
  for (const action of ['light', 'heavy', 'parry', 'dash', 'throw']) assert.ok(actions.has(action), `ordinary ${action} inputs reach real combat`);
});

test('an exhausted bot retreats without free stamina, kunai or unaffordable actions', () => {
  const state = fight({ bots: 1, difficulty: 'expert' }), bot = state.fighters[1];
  position(state, [{ x: 350, y: 320 }, { x: 420, y: 320 }]); bot.stamina = 0; bot.staminaDelay = 120; bot.kunai = 0;
  for (let tick = 0; tick < 80; tick++) {
    bots.stepPractice(state); assert.equal(bot.stamina, 0); assert.equal(bot.kunai, 0); assert.ok(['idle', 'run'].includes(bot.action));
  }
  assert.ok(Math.hypot(bot.x - 350, bot.y - 320) > 100); assert.equal(bot.damageDealt, 0);
});
