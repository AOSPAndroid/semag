import assert from 'node:assert/strict';
import test from 'node:test';
import * as relic from '../public/topdown-engine.js';
import * as vector from '../public/vector-engine.js';

function fighting(engine, mode = 'duel') {
  const state = engine.createState(mode);
  engine.startMatch(state);
  for (let i = 0; i < engine.TICK_RATE * 3; i++) engine.step(state);
  return state;
}

function arrow(state, overrides) {
  state.projectiles.push({
    id: ++state.projectileId, owner: 0, team: 'p0', kind: 'arrow',
    x: 200, y: 320, vx: 8.5, vy: 0, angle: 0, radius: 5,
    damage: 11, life: 140, pierce: 0, hitTargets: [], ...overrides,
  });
}

test('Relic arrows contact a moving body between tick endpoints at normal roll and arrow speeds', () => {
  const state = fighting(relic), target = state.fighters[1];
  Object.assign(state.fighters[0], { x: 200, y: 320 });
  Object.assign(target, { x: 500, y: 333, facing: Math.PI / 2 });
  arrow(state, { x: 484.3 });
  relic.step(state, [{}, { down: true, roll: true }]);
  assert.equal(target.invulnerable, false, 'the roll is still in vulnerable startup');
  assert.equal(target.hp, 89);
  assert.equal(state.projectiles.length, 0);
});

test('Relic arrows hit a body before cover and cover stops a body behind it', () => {
  for (const [targetX, expectedHp] of [[250, 89], [370, 100]]) {
    const state = fighting(relic), target = state.fighters[1];
    Object.assign(state.fighters[0], { x: 170, y: 224 });
    Object.assign(target, { x: targetX, y: 224 });
    arrow(state, { x: 200, y: 224, vx: 220 });
    relic.step(state);
    assert.equal(target.hp, expectedHp);
    assert.equal(state.projectiles.length, 0);
    if (targetX > 300) {
      const impact = state.events.find(event => event.type === 'arrowStop');
      assert.equal(impact.x, 280, 'impact is at first contact, before the pillar');
    }
  }
});

test('Relic firing beside a pillar stops the muzzle at the near contact face', () => {
  const state = fighting(relic), shooter = state.fighters[0];
  Object.assign(shooter, { x: 270, y: 224, facing: 0 });
  Object.assign(state.fighters[1], { x: 400, y: 224 });
  relic.step(state, [{ shoot: true }, {}]);
  for (let i = 0; i < relic.MOVES.shoot.startup; i++) relic.step(state);
  assert.equal(state.projectiles.length, 0);
  const impact = state.events.find(event => event.type === 'arrowStop');
  assert.equal(impact.x, 280);
  assert.equal(impact.y, 224);
});

test('Dungeon arrows choose first contact rather than the nearest target center', () => {
  const state = fighting(relic, 'coop'), template = state.enemies[0];
  state.obstacles = [];
  Object.assign(state.fighters[0], { x: 200, y: 530 });
  Object.assign(state.fighters[1], { x: 800, y: 530 });
  const small = { ...structuredClone(template), id: 100, type: 'slime', radius: 18, x: 460, y: 342, hp: 40, stun: 1000, vx: 0, vy: 0 };
  const large = { ...structuredClone(template), id: 101, type: 'boss', radius: 34, x: 480, y: 292, hp: 40, stun: 1000, vx: 0, vy: 0 };
  state.enemies = [small, large];
  arrow(state, { team: 'heroes', x: 400, vx: 100 });
  relic.step(state);
  assert.equal(small.hp, 40);
  assert.equal(large.hp, 29);
});

test('Relic body separation transfers blocked displacement away from a pinned fighter', () => {
  for (const [x, y] of [[relic.ARENA.minX, 320], [354, 224]]) {
    const state = fighting(relic), [a, b] = state.fighters;
    Object.assign(a, { x, y });
    Object.assign(b, { x: x + 31, y });
    for (let i = 0; i < 60; i++) relic.step(state, [{}, { left: true }]);
    assert.equal(a.x, x, 'the pinned fighter remains at the wall or pillar face');
    assert.ok(b.x - a.x >= a.radius + b.radius - 1e-7);
  }
});

test('Vector bullets can graze the outside of cover corners without invisible square padding', () => {
  const state = fighting(vector), cover = state.obstacles[0];
  state.projectiles.push({ id: ++state.projectileId, owner: 0, x: cover.x - 2.8, y: cover.y - 2.8,
    vx: -5, vy: -5, radius: 3, damage: 18, life: 100, bornTick: -1 });
  vector.step(state);
  assert.equal(state.projectiles.length, 1);
  assert.equal(state.events.some(event => event.type === 'cover'), false);
});

test('Vector bullets still strike the circular contact boundary at a cover corner', () => {
  const state = fighting(vector), cover = state.obstacles[0];
  state.projectiles.push({ id: ++state.projectileId, owner: 0, x: cover.x - 10, y: cover.y - 10,
    vx: 10, vy: 10, radius: 3, damage: 18, life: 100, bornTick: -1 });
  vector.step(state);
  assert.equal(state.projectiles.length, 0);
  const impact = state.events.find(event => event.type === 'cover');
  assert.ok(Math.abs(Math.hypot(impact.x - cover.x, impact.y - cover.y) - 3) < 1e-8);
});

test('Vector circular bodies slide past cover corners while respecting their true footprint', () => {
  const state = fighting(vector), cover = state.obstacles[0], fighter = state.fighters[0];
  fighter.x = cover.x - fighter.radius - 1;
  fighter.y = cover.y - fighter.radius + 0.5;
  vector.step(state, [{ right: true }]);
  assert.ok(fighter.x > cover.x - fighter.radius, 'the empty corner does not block a circular body');
  for (let i = 0; i < 35; i++) vector.step(state, [{ right: true }]);
  const nearestX = Math.max(cover.x, Math.min(fighter.x, cover.x + cover.w));
  const nearestY = Math.max(cover.y, Math.min(fighter.y, cover.y + cover.h));
  assert.ok(Math.abs(Math.hypot(fighter.x - nearestX, fighter.y - nearestY) - fighter.radius) < 1e-7);
});
