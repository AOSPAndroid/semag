import assert from 'node:assert/strict';
import test from 'node:test';
import { createState, step, startMatch, resetLobby, emptyInput, cloneState, WORLD, COVERS, WEAPON, DASH, TICK_RATE } from '../public/vector-engine.js';

function fighting() {
  const state = createState();
  startMatch(state);
  state.phaseTicks = 1;
  step(state);
  return state;
}
function advance(state, ticks, first = {}, second = {}) {
  for (let i = 0; i < ticks; i++) step(state, [first, second]);
  return state;
}
function projectile(state, overrides = {}) {
  state.projectiles.push({ id: ++state.projectileId, owner: 0, x: 400, y: 320, px: 400, py: 320, vx: 100, vy: 0, radius: 3, damage: 18, life: 100, bornTick: -1, ...overrides });
}
function finite(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (value && typeof value === 'object') for (const child of Object.values(value)) finite(child);
}

test('Vector starts only after countdown, and lobby input cannot move or fire', () => {
  const state = createState();
  const initial = cloneState(state.fighters);
  advance(state, 50, { right: true, fire: true, dash: true });
  assert.deepEqual(state.fighters, initial);
  startMatch(state);
  assert.equal(state.phase, 'countdown');
  advance(state, 3 * TICK_RATE - 1, { right: true, fire: true, dash: true, aimX: 0, aimY: 1 });
  assert.equal(state.phase, 'countdown');
  assert.equal(state.fighters[0].x, initial[0].x);
  assert.equal(state.fighters[0].ammo, WEAPON.magazine);
  step(state, [{ right: true, fire: true, dash: true }]);
  assert.equal(state.phase, 'fight');
  step(state, [{ right: true, fire: true, dash: true }]);
  assert.equal(state.fighters[0].dashTicks, 0, 'held dash during countdown needs a fresh press');
  assert.equal(state.fighters[0].ammo, 5);
});

test('aim normalizes finite inputs and malformed values cannot poison prediction', () => {
  const state = fighting(), f = state.fighters[0];
  step(state, [{ aimX: 1, aimY: 1, right: 'yes', fire: 1 }]);
  assert.ok(Math.abs(f.aimX - Math.SQRT1_2) < 1e-9);
  assert.equal(f.previousInput.right, false);
  assert.equal(f.ammo, 6);
  step(state, [{ aimX: 0, aimY: 0 }]);
  assert.ok(Math.abs(f.aimY - Math.SQRT1_2) < 1e-9);
  step(state, [{ aimX: NaN, aimY: Infinity }]);
  finite(state);
  assert.ok(Math.abs(f.aimX - Math.SQRT1_2) < 1e-9);
});

test('diagonal movement has the same speed and focus slows deliberate aiming', () => {
  const straight = fighting(), diagonal = fighting(), focused = fighting();
  advance(straight, 30, { right: true });
  advance(diagonal, 30, { right: true, down: true });
  advance(focused, 30, { right: true, focus: true });
  const origin = { x: 154, y: 320 };
  assert.ok(Math.abs(Math.hypot(diagonal.fighters[0].x - origin.x, diagonal.fighters[0].y - origin.y) - (straight.fighters[0].x - origin.x)) < 1e-6);
  assert.ok(focused.fighters[0].x < straight.fighters[0].x - 35);
});

test('movement slides along cover, cannot dash through it, and stays inside the arena', () => {
  const state = fighting(), f = state.fighters[0];
  f.x = 200; f.y = 190;
  advance(state, 80, { right: true });
  assert.equal(f.x, COVERS[0].x - f.radius);
  step(state, [{ right: true, dash: true }]);
  advance(state, DASH.duration, { right: true, dash: true });
  assert.equal(f.x, COVERS[0].x - f.radius);
  advance(state, 80, { down: true, right: true });
  assert.ok(f.y > COVERS[0].y + COVERS[0].h + f.radius);
  assert.ok(f.x > COVERS[0].x);
  advance(state, 800, { left: true, up: true });
  assert.equal(f.x, WORLD.minX);
  assert.equal(f.y, WORLD.minY);
});

test('six-shot firing cadence is bounded and an empty magazine reloads automatically', () => {
  const state = fighting(), f = state.fighters[0];
  advance(state, 100, { fire: true, focus: true, aimX: 0, aimY: -1 });
  assert.equal(f.shotsFired, 5);
  assert.equal(f.ammo, 1);
  step(state, [{ fire: true, focus: true, aimX: 0, aimY: -1 }]);
  assert.equal(f.shotsFired, 6);
  assert.equal(f.ammo, 0);
  advance(state, WEAPON.shotTicks - 1);
  assert.equal(f.reloadTicks, 0);
  step(state);
  assert.equal(f.reloadTicks, WEAPON.reloadTicks);
  advance(state, WEAPON.reloadTicks - 1);
  assert.equal(f.ammo, 0);
  step(state);
  assert.equal(f.ammo, WEAPON.magazine);
  assert.equal(f.reloadTicks, 0);
});

test('manual reload is a fresh edge, blocks firing, and finishes in 1.1 seconds', () => {
  const state = fighting(), f = state.fighters[0];
  step(state, [{ fire: true, focus: true, aimX: 0, aimY: -1 }]);
  step(state, [{ reload: true, fire: true }]);
  assert.equal(f.reloadTicks, WEAPON.reloadTicks);
  advance(state, WEAPON.reloadTicks - 1, { reload: true, fire: true, aimX: 0, aimY: -1 });
  assert.equal(f.shotsFired, 1);
  assert.equal(f.ammo, 5);
  step(state, [{ reload: true, fire: true, aimX: 0, aimY: -1 }]);
  assert.equal(f.shotsFired, 2);
  assert.equal(f.reloadTicks, 0);
  advance(state, 5, { reload: true });
  assert.equal(f.reloadTicks, 0, 'held R cannot continuously restart partial reloads');
});

test('focus shots are straight and fast, normal recoil remains deterministic', () => {
  const a = fighting(), b = fighting();
  step(a, [{ fire: true, aimX: 1, aimY: 0 }]);
  step(b, [{ fire: true, focus: true, aimX: 1, aimY: 0 }]);
  assert.equal(b.projectiles[0].vy, 0);
  assert.ok(b.projectiles[0].vx > a.projectiles[0].vx);
  assert.notEqual(a.projectiles[0].vy, 0);
  const replay = fighting();
  step(replay, [{ fire: true, aimX: 1, aimY: 0 }]);
  assert.deepEqual(a, replay);
});

test('swept projectiles hit a body crossed between tick endpoints and only damage once', () => {
  const state = fighting(), target = state.fighters[1];
  target.x = 500; target.y = 320;
  projectile(state, { x: 400, vx: 200 });
  step(state);
  assert.equal(target.hp, 82);
  assert.equal(state.projectiles.length, 0);
  assert.equal(state.events.filter(e => e.type === 'hit').length, 1);
  advance(state, 20);
  assert.equal(target.hp, 82);
});

test('swept relative-body collision hits a target moving across a bullet path', () => {
  const state = fighting(), target = state.fighters[1];
  target.x = 500; target.y = 270; target.vy = 100;
  projectile(state, { x: 470, y: 300, vx: 80 });
  step(state);
  assert.equal(target.hp, 82);
  assert.ok(target.y > 320);
});

test('cover wins before a body behind it, even for a projectile crossing the whole cover', () => {
  const state = fighting(), target = state.fighters[1];
  target.x = 450; target.y = 190;
  projectile(state, { x: 180, y: 190, vx: 500 });
  step(state);
  assert.equal(target.hp, 100);
  assert.equal(state.projectiles.length, 0);
  const impact = state.events.find(e => e.type === 'cover');
  assert.equal(impact.x, COVERS[0].x - 3);
});

test('firing with a muzzle at cover cannot spawn bullets through its near wall', () => {
  const state = fighting(), shooter = state.fighters[0], target = state.fighters[1];
  shooter.x = COVERS[0].x - shooter.radius; shooter.y = 190;
  target.x = 450; target.y = 190;
  step(state, [{ fire: true, focus: true, aimX: 1, aimY: 0 }]);
  assert.equal(shooter.ammo, 5);
  assert.equal(state.projectiles.length, 0);
  assert.equal(target.hp, 100);
  assert.ok(state.events.some(e => e.type === 'cover'));
});

test('dash has vulnerable startup, a bounded evasion window, and no held-key chaining', () => {
  const state = fighting(), f = state.fighters[0];
  step(state, [{ dash: true, right: true, fire: true }]);
  assert.equal(f.stamina, 100 - DASH.cost);
  assert.equal(f.ammo, 6);
  assert.equal(f.invulnerable, false);
  advance(state, DASH.invulnerableStart - 1, { dash: true });
  assert.equal(f.invulnerable, false);
  step(state, [{ dash: true }]);
  assert.equal(f.invulnerable, true);
  advance(state, DASH.invulnerableEnd - DASH.invulnerableStart, { dash: true });
  assert.equal(f.invulnerable, true);
  step(state, [{ dash: true }]);
  assert.equal(f.invulnerable, false);
  advance(state, 140, { dash: true });
  assert.equal(state.events.filter(e => e.type === 'dash').length, 1);
  assert.ok(f.stamina > 100 - DASH.cost && f.stamina < 100);
  advance(state, 40, { dash: true });
  assert.equal(f.stamina, 100);
  step(state);
  step(state, [{ dash: true }]);
  assert.equal(state.events.filter(e => e.type === 'dash').length, 2);
});

test('dash can evade bullets during its active window but startup takes full damage', () => {
  const startup = fighting(), evasive = fighting();
  for (const state of [startup, evasive]) {
    const f = state.fighters[1];
    f.x = 500; f.y = 320;
  }
  projectile(startup, { x: 470, vx: 70 });
  step(startup, [{}, { dash: true, right: true }]);
  assert.equal(startup.fighters[1].hp, 82);
  advance(evasive, DASH.invulnerableStart, {}, { dash: true, right: true });
  projectile(evasive, { x: evasive.fighters[1].x - 40, vx: 90 });
  step(evasive, [{}, { dash: true }]);
  assert.equal(evasive.fighters[1].invulnerable, true);
  assert.equal(evasive.fighters[1].hp, 100);
});

test('dash cancels reload progress, costs stamina, and cannot begin when exhausted', () => {
  const state = fighting(), f = state.fighters[0];
  f.ammo = 2;
  step(state, [{ reload: true }]);
  advance(state, 40);
  step(state, [{ dash: true, down: true }]);
  assert.equal(f.reloadTicks, 0);
  assert.equal(f.ammo, 2);
  advance(state, DASH.duration);
  f.stamina = DASH.cost - 1;
  step(state, [{ dash: true }]);
  assert.equal(f.dashTicks, 0);
  step(state, [{ reload: true }]);
  assert.equal(f.reloadTicks, WEAPON.reloadTicks);
});

test('two fighters cannot overlap or shove each other through arena walls', () => {
  const state = fighting(), [a, b] = state.fighters;
  a.x = 60; b.x = 95;
  advance(state, 50, { right: true }, { left: true });
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius - 1e-6);
  a.x = WORLD.minX; b.x = WORLD.minX + 32;
  advance(state, 60, {}, { left: true });
  assert.equal(a.x, WORLD.minX);
  assert.ok(b.x >= WORLD.minX + 32 - 1e-6);
});

test('two round victories complete a match and rematch/reset clears combat resources', () => {
  const state = fighting();
  for (let round = 1; round <= 2; round++) {
    state.fighters[1].hp = 18;
    projectile(state, { x: state.fighters[1].x - 30, vx: 60 });
    step(state);
    assert.equal(state.phase, 'roundEnd');
    assert.equal(state.winner, 0);
    assert.equal(state.fighters[0].wins, round);
    advance(state, 2 * TICK_RATE);
    if (round === 1) {
      assert.equal(state.phase, 'countdown');
      assert.equal(state.round, 2);
      assert.equal(state.fighters[1].hp, 100);
      advance(state, 2 * TICK_RATE);
      assert.equal(state.phase, 'fight');
    }
  }
  assert.equal(state.phase, 'matchEnd');
  const ended = cloneState(state.fighters);
  advance(state, 20, { fire: true, right: true });
  assert.deepEqual(state.fighters, ended);
  const tick = state.tick;
  resetLobby(state);
  assert.equal(state.tick, tick);
  assert.equal(state.phase, 'lobby');
  assert.equal(state.fighters[0].wins, 0);
  assert.equal(state.fighters[1].hp, 100);
  assert.equal(state.projectiles.length, 0);
  startMatch(state);
  assert.equal(state.phase, 'countdown');
  assert.equal(state.fighters[0].ammo, 6);
});

test('timeout compares health, and tied timeout or simultaneous knockout awards no win', () => {
  const tied = fighting();
  tied.roundTicks = 1;
  step(tied);
  assert.equal(tied.winner, null);
  assert.deepEqual(tied.fighters.map(f => f.wins), [0, 0]);
  assert.equal(tied.events.at(-1).reason, 'timeout');
  advance(tied, 2 * TICK_RATE);
  assert.equal(tied.round, 2);
  const health = fighting();
  health.roundTicks = 1; health.fighters[0].hp = 82;
  step(health);
  assert.equal(health.winner, 1);
  const trade = fighting();
  trade.fighters.forEach(f => { f.hp = 18; });
  projectile(trade, { x: trade.fighters[1].x - 30, vx: 60 });
  projectile(trade, { owner: 1, x: trade.fighters[0].x + 30, vx: -60 });
  step(trade);
  assert.equal(trade.winner, null);
  assert.deepEqual(trade.fighters.map(f => f.wins), [0, 0]);
});

test('cloned simulations remain deterministic and finite through long varied input streams', () => {
  const a = fighting(), b = cloneState(a);
  for (let tick = 0; tick < 30_000; tick++) {
    const inputs = [0, 1].map(id => ({
      right: (tick + id * 100) % 450 < 120,
      left: (tick + id * 100) % 450 >= 220 && (tick + id * 100) % 450 < 360,
      down: (tick + id * 70) % 600 < 160,
      up: (tick + id * 70) % 600 >= 300 && (tick + id * 70) % 600 < 460,
      fire: tick % 70 < 50, reload: tick % 210 === 0, dash: tick % 150 === 0,
      focus: tick % 200 > 100, aimX: Math.cos(tick / 180 + id * Math.PI), aimY: Math.sin(tick / 180 + id * Math.PI),
    }));
    step(a, inputs); step(b, inputs);
    if (a.phase === 'matchEnd') { startMatch(a); startMatch(b); }
    assert.ok(a.projectiles.length <= 32);
    assert.ok(a.events.length <= 48);
    for (const f of a.fighters) {
      assert.ok(f.x >= WORLD.minX && f.x <= WORLD.maxX);
      assert.ok(f.y >= WORLD.minY && f.y <= WORLD.maxY);
      assert.ok(f.hp >= 0 && f.hp <= 100);
      assert.ok(f.stamina >= 0 && f.stamina <= 100);
    }
    if (tick % 1000 === 0) finite(a);
  }
  assert.deepEqual(a, b);
});
