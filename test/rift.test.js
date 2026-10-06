import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, togglePause, chooseUpgrade, ARENA, OBSTACLES,
  TOTAL_WAVES, UPGRADES, MAX_ENEMIES, MAX_PROJECTILES } from '../public/solo/rift-engine.js';

function seeded(seed = 7) {
  return () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
}

function enemy({ id = 500, type = 'chaser', x = 900, y = 600, hp = 10000, ...rest } = {}) {
  const radius = type === 'boss' ? 30 : type === 'brute' ? 22 : 14;
  return { id, type, x, y, hp, maxHp: hp, radius, boss: type === 'boss', speed: 0,
    phase: 'seeking', timer: 0, attackTimer: 1e6, aimX: 1, aimY: 0, pattern: 0, ...rest };
}

function quiet(state = createState({ random: seeded() })) {
  state.enemies = [enemy()];
  state.projectiles = [];
  return state;
}

function advance(state, seconds, input = {}) {
  for (let tick = 0; tick < Math.round(seconds * 120); tick += 1) step(state, typeof input === 'function' ? input(state, tick) : input);
  return state;
}

function clearToUpgrade(state) {
  state.enemies = [];
  step(state);
  assert.equal(state.phase, 'upgrade');
}

function choose(state, priority = ['damage', 'cooling', 'mobility', 'battery', 'plating', 'repair']) {
  const id = priority.find(id => state.upgradeChoices.includes(id));
  assert.ok(id);
  assert.deepEqual(chooseUpgrade(state, id), { ok: true });
}

test('an arena starts with safe finite spawns, four solid covers and readable combat stats', () => {
  for (const source of [seeded(), () => 0, () => .999999]) {
    const state = createState({ random: source });
    assert.equal(state.gameId, 'rift-survivor');
    assert.equal(state.wave, 1);
    assert.equal(state.phase, 'playing');
    assert.equal(state.player.hp, 100);
    assert.equal(state.player.stamina, 100);
    assert.equal(state.enemies.length, 4);
    assert.ok(state.enemies.every(e => Math.hypot(e.x - state.player.x, e.y - state.player.y) > 220));
    assert.ok(state.enemies.every(e => !OBSTACLES.some(r => e.x > r.x - e.radius && e.x < r.x + r.width + e.radius
      && e.y > r.y - e.radius && e.y < r.y + r.height + e.radius)));
    assert.doesNotThrow(() => JSON.stringify(state));
  }
  assert.equal(OBSTACLES.length, 4);
  assert.equal(TOTAL_WAVES, 10);
});

test('movement normalizes diagonals, supports analog precision and reacts on the first step', () => {
  const horizontal = quiet();
  const diagonal = quiet();
  step(horizontal, { right: true });
  step(diagonal, { right: true, down: true });
  assert.ok(horizontal.player.x > 500);
  assert.ok(Math.abs(Math.hypot(diagonal.player.x - 500, diagonal.player.y - 340) - (horizontal.player.x - 500)) < 1e-8);
  const analog = quiet();
  step(analog, { moveX: .25, moveY: 0 });
  assert.ok(Math.abs(analog.player.x - 500 - (horizontal.player.x - 500) * .25) < 1e-8);
  const invalid = quiet();
  step(invalid, { right: 'yes', aimX: NaN, aimY: Infinity });
  assert.equal(invalid.player.x, 500);
  assert.equal(invalid.player.aimX, 1);
  assert.equal(invalid.player.aimY, 0);
});

test('boundaries and covers stop movement and a dash cannot tunnel through cover', () => {
  const state = quiet();
  state.player.x = 240; state.player.y = 235;
  advance(state, 1, { right: true });
  assert.equal(state.player.x, 268);
  step(state, { right: true, dash: true }, 1 / 30);
  assert.equal(state.player.x, 268);
  state.player.x = 500; state.player.y = 12; state.player.dashTime = 0;
  advance(state, 2, { up: true });
  assert.equal(state.player.y, state.player.radius);
  state.player.x = ARENA.width - 12;
  advance(state, 1, { right: true });
  assert.equal(state.player.x, ARENA.width - 12);
});

test('real aimed fire deals damage, kills once and clears the wave into upgrade selection', () => {
  const state = quiet();
  state.enemies = [enemy({ x: 700, y: 340, hp: 44 })];
  advance(state, .5, { aimX: 5, aimY: 0, fire: true });
  assert.equal(state.enemies.length, 0);
  assert.equal(state.kills, 1);
  assert.equal(state.phase, 'upgrade');
  assert.equal(state.wavesCleared, 1);
  assert.equal(state.score, 400);
  assert.equal(state.upgradeChoices.length, 3);
  assert.equal(new Set(state.upgradeChoices).size, 3);
  assert.equal(state.projectiles.length, 0);
  const snapshot = JSON.stringify(state);
  assert.equal(step(state, { fire: true }), false);
  assert.equal(JSON.stringify(state), snapshot);
});

test('shots are swept through targets and the nearest solid cover blocks either owner', () => {
  const swept = quiet();
  swept.enemies = [enemy({ x: 700, y: 340, hp: 44 })];
  swept.projectiles = [{ id: 999, owner: 'player', x: 400, y: 340, vx: 30000, vy: 0, radius: 4, damage: 22, life: 1 }];
  step(swept, {}, 1 / 30);
  assert.equal(swept.enemies[0].hp, 22);
  assert.equal(swept.projectiles.length, 0);
  const covered = quiet();
  covered.player.x = 200; covered.player.y = 235;
  covered.enemies = [enemy({ x: 440, y: 235, hp: 100 })];
  advance(covered, 1, { fire: true, aimX: 1, aimY: 0 });
  assert.equal(covered.enemies[0].hp, 100);
  covered.player.invulnerable = 0;
  covered.projectiles = [{ id: 999, owner: 'enemy', x: 440, y: 235, vx: -30000, vy: 0, radius: 5, damage: 50, life: 1 }];
  step(covered, {}, 1 / 30);
  assert.equal(covered.player.hp, 100);
  assert.equal(covered.projectiles.length, 0);
});

test('the muzzle path cannot put a new bullet beyond a nearby cover corner', () => {
  const state = quiet();
  state.player.x = 268; state.player.y = 206;
  step(state, { fire: true, aimX: .8, aimY: -.6 });
  assert.equal(state.projectiles.length, 0);
  assert.equal(state.player.fireCooldown, state.player.fireInterval);
  assert.ok(state.player.heat > 0);
});

test('pursuit detours around solid cover and ranged enemies seek a visible firing position', () => {
  for (const playerX of [500, 382]) for (const type of ['chaser', 'ranged', 'boss']) {
    const state = quiet();
    state.player.x = playerX; state.player.y = 235;
    state.enemies = [enemy({ type, x: 240, y: 235, speed: type === 'boss' ? 48 : 100, attackTimer: 0 })];
    let movedAround = false;
    advance(state, 6, current => {
      const e = current.enemies[0];
      if (Math.abs(e.y - 235) > 40) movedAround = true;
      return {};
    });
    assert.ok(movedAround, `${type} should detour rather than camp behind cover at playerX=${playerX}`);
    assert.ok(state.events.some(e => e.type === (type === 'chaser' ? 'swipe' : 'volley')), `${type} should eventually reach an attack position at playerX=${playerX}`);
  }
});

test('heat limits sustained fire, locks until sufficiently cooled and never needs ammo', () => {
  const state = quiet();
  advance(state, 2, { fire: true, aimX: -1, aimY: 0 });
  assert.ok(state.events.some(e => e.type === 'overheat'));
  assert.equal(state.player.overheated, true);
  const shots = state.projectileId;
  advance(state, .4, { fire: true });
  assert.equal(state.projectileId, shots);
  assert.ok(state.player.heat > 35);
  advance(state, 3);
  assert.equal(state.player.overheated, false);
  assert.equal(state.player.heat, 0);
  step(state, { fire: true });
  assert.equal(state.projectileId, shots + 1);
});

test('dash costs stamina on a fresh edge, held input cannot chain and recharge is delayed', () => {
  const state = quiet();
  step(state, { right: true, dash: true });
  assert.equal(state.player.stamina, 66);
  assert.ok(state.player.invulnerable > 0);
  assert.ok(state.player.x - 500 > 5);
  advance(state, .4, { dash: true });
  assert.equal(state.events.filter(e => e.type === 'dash').length, 1);
  assert.equal(state.player.stamina, 66);
  advance(state, 1.8, { dash: true });
  assert.equal(state.events.filter(e => e.type === 'dash').length, 1);
  assert.equal(state.player.stamina, 100);
  step(state, {});
  step(state, { dash: true, aimX: 0, aimY: 1 });
  assert.equal(state.events.filter(e => e.type === 'dash').length, 2);
  assert.equal(state.player.dashX, 0);
  assert.equal(state.player.dashY, 1);
  state.player.dashTime = 0; state.player.stamina = 20;
  step(state, {}); step(state, { dash: true });
  assert.equal(state.events.filter(e => e.type === 'dash').length, 2);
});

test('dash evasion prevents projectile damage but a later hit damages health', () => {
  const state = quiet();
  state.player.invulnerable = 0;
  state.projectiles = [{ id: 500, owner: 'enemy', x: 520, y: 340, vx: -500, vy: 0, radius: 5, damage: 14, life: 1 }];
  step(state, { dash: true, right: true });
  assert.equal(state.player.hp, 100);
  advance(state, .3);
  state.projectiles = [{ id: 501, owner: 'enemy', x: state.player.x, y: state.player.y, vx: 0, vy: 0, radius: 5, damage: 14, life: 1 }];
  step(state);
  assert.equal(state.player.hp, 86);
});

test('chasers telegraph a melee strike and moving out of the ring avoids it', () => {
  const stationary = quiet();
  stationary.player.invulnerable = 0;
  stationary.enemies = [enemy({ x: 545, y: 340, attackTimer: 0 })];
  step(stationary);
  assert.equal(stationary.enemies[0].phase, 'windup');
  assert.equal(stationary.player.hp, 100);
  advance(stationary, .25);
  assert.equal(stationary.player.hp, 100);
  advance(stationary, .1);
  assert.equal(stationary.player.hp, 88);
  assert.ok(stationary.events.some(e => e.type === 'swipe'));
  const escape = quiet();
  escape.player.invulnerable = 0;
  escape.enemies = [enemy({ x: 545, y: 340, attackTimer: 0 })];
  step(escape);
  advance(escape, .4, { left: true });
  assert.equal(escape.player.hp, 100);
});

test('ranged aim locks during its tell, emits a three-shot fan and cover absorbs it', () => {
  const state = quiet();
  state.enemies = [enemy({ type: 'ranged', x: 100, y: 340, attackTimer: 0 })];
  step(state);
  assert.equal(state.enemies[0].phase, 'windup');
  assert.equal(state.projectiles.length, 0);
  assert.equal(state.enemies[0].aimY, 0);
  advance(state, .62, { up: true });
  assert.equal(state.projectiles.filter(p => p.owner === 'enemy').length, 3);
  assert.equal(state.enemies[0].aimY, 0);
  assert.ok(state.projectiles.some(p => Math.abs(p.vy) < .00001));
  assert.equal(state.player.hp, 100);
});

test('a charging brute commits to its readable direction and stops against solid cover', () => {
  const state = quiet();
  state.player.x = 500; state.player.y = 235;
  state.enemies = [enemy({ type: 'brute', x: 230, y: 235, attackTimer: 0, speed: 64 })];
  step(state);
  assert.equal(state.enemies[0].phase, 'windup');
  assert.equal(state.enemies[0].aimX, 1);
  advance(state, .75, { down: true });
  assert.equal(state.enemies[0].phase, 'windup');
  advance(state, .4, { down: true });
  assert.equal(state.enemies[0].phase, 'recover');
  assert.ok(state.enemies[0].x <= 258);
  assert.equal(state.player.hp, 100);
});

test('bosses alternate a telegraphed twelve-shot radial pattern and aimed five-shot fan', () => {
  const state = quiet();
  state.wave = 5;
  state.enemies = [enemy({ type: 'boss', x: 100, y: 340, attackTimer: 0 })];
  step(state);
  advance(state, .8);
  assert.equal(state.projectiles.length, 0);
  advance(state, .11);
  assert.equal(state.projectiles.length, 12);
  assert.equal(state.enemies[0].pattern, 1);
  state.projectiles = [];
  state.enemies[0].phase = 'seeking'; state.enemies[0].attackTimer = 0;
  step(state);
  advance(state, .91);
  assert.equal(state.projectiles.length, 5);
  assert.equal(state.enemies[0].pattern, 2);
  assert.ok(state.projectiles.every(p => p.vx > 0));
});

test('damage has a short shared cooldown, health carries between waves and zero ends all input', () => {
  const state = quiet();
  state.player.invulnerable = 0;
  const impact = id => ({ id, owner: 'enemy', x: state.player.x, y: state.player.y, vx: 0, vy: 0, radius: 5, damage: 60, life: 1 });
  state.projectiles = [impact(1), impact(2)];
  step(state);
  assert.equal(state.player.hp, 40);
  advance(state, .6);
  state.projectiles = [impact(3)];
  step(state);
  assert.equal(state.player.hp, 0);
  assert.equal(state.phase, 'lost');
  const frozen = JSON.stringify(state);
  assert.equal(step(state, { fire: true, dash: true }), false);
  assert.equal(togglePause(state), false);
  assert.equal(chooseUpgrade(state, 'repair').ok, false);
  assert.equal(JSON.stringify(state), frozen);
});

test('wave upgrades validate offered IDs, preserve pause phase and apply capped meaningful choices', () => {
  const state = quiet();
  assert.equal(chooseUpgrade(state, 'damage').ok, false);
  state.player.hp = 30;
  clearToUpgrade(state);
  assert.equal(state.upgradeChoices.length, 3);
  assert.equal(chooseUpgrade(state, 'unknown').ok, false);
  const unavailable = Object.keys(UPGRADES).find(id => !state.upgradeChoices.includes(id));
  assert.equal(chooseUpgrade(state, unavailable).ok, false);
  togglePause(state);
  assert.equal(state.pausedPhase, 'upgrade');
  const frozen = JSON.stringify(state);
  advance(state, 4, { fire: true });
  assert.equal(JSON.stringify(state), frozen);
  assert.equal(chooseUpgrade(state, state.upgradeChoices[0]).ok, false);
  togglePause(state);
  assert.equal(state.phase, 'upgrade');
  choose(state, ['repair', 'plating', 'damage', 'cooling', 'mobility', 'battery']);
  assert.equal(state.wave, 2);
  assert.equal(state.phase, 'playing');
  assert.ok(state.player.hp <= 65);
  assert.equal(state.player.heat, 0);
  assert.equal(state.player.stamina, state.player.maxStamina);
  assert.ok(state.player.invulnerable > 0);
  assert.equal(state.enemies.length, 7);
});

test('progression has exactly ten finite waves, boss encounters and a final victory', () => {
  const state = createState({ random: seeded() });
  for (let wave = 1; wave <= 10; wave += 1) {
    assert.equal(state.wave, wave);
    assert.ok(state.enemies.length <= MAX_ENEMIES);
    assert.equal(state.enemies.filter(e => e.boss).length, wave === 5 || wave === 10 ? 1 : 0);
    state.enemies = [];
    step(state);
    if (wave < 10) {
      assert.equal(state.phase, 'upgrade');
      assert.equal(state.upgradeChoices.length, 3);
      choose(state);
    }
  }
  assert.equal(state.phase, 'won');
  assert.equal(state.wavesCleared, 10);
  assert.equal(state.result, 'rift-sealed');
  const snapshot = JSON.stringify(state);
  assert.equal(togglePause(state), false);
  assert.equal(step(state), false);
  assert.equal(JSON.stringify(state), snapshot);
});

test('each upgrade changes its intended resource and capped upgrades cannot consume a choice', () => {
  const expected = {
    repair: { hp: 66, maxHp: 100 }, damage: { damage: 28, hp: 31 },
    cooling: { cooling: 36, heatPerShot: 10, hp: 31 }, mobility: { moveSpeed: 250, hp: 31 },
    battery: { maxStamina: 115, staminaRegen: 29, hp: 31 }, plating: { maxHp: 110, hp: 41 },
  };
  for (const [id, fields] of Object.entries(expected)) {
    const state = quiet();
    state.player.hp = 31;
    clearToUpgrade(state);
    state.upgradeChoices = [id]; // Isolate each effect from the random offered trio.
    assert.deepEqual(chooseUpgrade(state, id), { ok: true });
    for (const [field, value] of Object.entries(fields)) assert.equal(state.player[field], value, `${id}: ${field}`);
    assert.equal(state.upgrades[id], 1);
  }
  const capped = quiet();
  clearToUpgrade(capped);
  capped.player.damage = 46;
  capped.upgradeChoices = ['damage'];
  const snapshot = JSON.stringify(capped);
  assert.equal(chooseUpgrade(capped, 'damage').ok, false);
  assert.equal(JSON.stringify(capped), snapshot);
});

test('a real-input kiting and aiming run can defeat every enemy and both bosses', () => {
  const state = createState({ random: seeded(7) });
  const path = [{ x: 500, y: 100 }, { x: 880, y: 100 }, { x: 880, y: 580 }, { x: 120, y: 580 }, { x: 120, y: 100 }];
  let waypoint = 0;
  let observedBosses = new Set();
  for (let tick = 0; tick < 120 * 600 && state.phase !== 'won' && state.phase !== 'lost'; tick += 1) {
    if (state.phase === 'upgrade') { choose(state, ['repair', 'plating', 'damage', 'cooling', 'mobility', 'battery']); continue; }
    const p = state.player;
    let target = path[waypoint];
    if (Math.hypot(p.x - target.x, p.y - target.y) < 25) { waypoint = (waypoint + 1) % path.length; target = path[waypoint]; }
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const magnitude = Math.hypot(dx, dy);
    const closest = state.enemies.reduce((best, e) => !best || Math.hypot(e.x - p.x, e.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? e : best, null);
    for (const e of state.enemies) if (e.boss) observedBosses.add(state.wave);
    const threat = state.enemies.some(e => Math.hypot(e.x - p.x, e.y - p.y) < 90)
      || state.projectiles.some(b => b.owner === 'enemy' && Math.hypot(b.x - p.x, b.y - p.y) < 55);
    step(state, { moveX: dx / magnitude, moveY: dy / magnitude, aimX: closest.x - p.x, aimY: closest.y - p.y,
      fire: true, dash: threat && tick % 60 === 0 });
    assert.ok(state.enemies.length <= MAX_ENEMIES);
    assert.ok(state.projectiles.length <= MAX_PROJECTILES);
    assert.ok(state.events.length <= 32);
    assert.ok(Number.isFinite(state.player.x) && Number.isFinite(state.player.y));
  }
  assert.equal(state.phase, 'won');
  assert.deepEqual([...observedBosses], [5, 10]);
  assert.equal(state.kills, 100);
  assert.ok(state.player.hp > 0);
  assert.ok(state.score > 30000);
  assert.ok(state.elapsed < 400);
});

test('seeded combat reproduces exactly and pause freezes every clock and held dash edge', () => {
  const a = createState({ random: seeded(31) });
  const b = createState({ random: seeded(31) });
  advance(a, 3, { right: true, down: true, aimX: -.5, aimY: .8, fire: true, dash: true });
  advance(b, 3, { right: true, down: true, aimX: -.5, aimY: .8, fire: true, dash: true });
  assert.deepEqual(a, b);
  togglePause(a);
  assert.equal(a.player.dashHeld, false);
  const snapshot = JSON.stringify(a);
  advance(a, 10, { fire: true });
  assert.equal(JSON.stringify(a), snapshot);
  togglePause(a);
  assert.equal(a.phase, 'playing');
});

test('invalid frames, large finite inputs and invalid random sources cannot poison combat', () => {
  const state = quiet();
  for (const dt of [0, -1, NaN, Infinity]) assert.equal(step(state, {}, dt), false);
  assert.equal(state.elapsed, 0);
  step(state, { aimX: Number.MAX_VALUE, aimY: Number.MAX_VALUE, moveX: Number.MAX_VALUE, moveY: Number.MAX_VALUE }, 10);
  assert.equal(state.elapsed, 1 / 30);
  for (const value of Object.values(state.player)) if (typeof value === 'number') assert.ok(Number.isFinite(value));
  assert.doesNotThrow(() => step(state, null));
  assert.throws(() => createState({ random: 'no' }), TypeError);
  assert.throws(() => createState({ random: () => 1 }), RangeError);
  assert.throws(() => createState({ random: () => NaN }), RangeError);
});
