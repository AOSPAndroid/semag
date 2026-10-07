import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, togglePause, chooseUpgrade, ARENA, OBSTACLES,
  TOTAL_WAVES, UPGRADES, MAX_ENEMIES, MAX_PROJECTILES, SECTORS, DIFFICULTIES, enemyShotPattern, threatPace, chargeSpeed } from '../public/solo/rift-engine.js';

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
  const id = priority.find(id => state.upgradeChoices.includes(id)) || state.upgradeChoices[0];
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
  assert.equal(TOTAL_WAVES, 20);
  assert.equal(SECTORS.length, 4);
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

test('progression has twenty finite waves, four distinct sectors and a final victory', () => {
  const state = createState({ random: seeded() });
  for (let wave = 1; wave <= TOTAL_WAVES; wave += 1) {
    assert.equal(state.wave, wave);
    assert.ok(state.enemies.length <= MAX_ENEMIES);
    assert.equal(state.sector, Math.floor((wave - 1) / 5));
    assert.equal(state.sectorName, SECTORS[state.sector].name);
    assert.equal(state.enemies.filter(e => e.boss).length, wave % 5 === 0 ? 1 : 0);
    if (wave % 5 === 0) assert.equal(state.enemies.find(e => e.boss).bossName, SECTORS[state.sector].boss);
    state.enemies = [];
    step(state);
    if (wave < TOTAL_WAVES) {
      assert.equal(state.phase, 'upgrade');
      assert.equal(state.upgradeChoices.length, 3);
      choose(state);
    }
  }
  assert.equal(state.phase, 'won');
  assert.equal(state.wavesCleared, TOTAL_WAVES);
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

test('mirror rounds really bank a shot from the arena wall into a target behind the shooter', () => {
  for (const rank of [0, 1]) {
    const state = quiet(); state.player.x = 920; state.player.y = 340; state.player.ricochet = rank;
    state.enemies = [enemy({ x: 780, y: 340, hp: 100 })];
    step(state, { fire: true, aimX: 1, aimY: 0 });
    advance(state, .5);
    assert.equal(state.enemies[0].hp, rank ? 78 : 100);
    assert.equal(state.events.some(event => event.type === 'bounce'), Boolean(rank));
  }
  const touching = quiet(); touching.player.x = 268; touching.player.y = 235; touching.player.ricochet = 1;
  step(touching, { fire: true, aimX: 1, aimY: 0 });
  assert.equal(touching.projectiles.length, 1);
  assert.ok(touching.projectiles[0].vx < 0);
  assert.ok(touching.projectiles[0].x < 280);
  assert.equal(touching.projectiles[0].bounces, 0);
});

test('arc, frost and siphon combine through actual aimed hits and chain kills', () => {
  const state = quiet();
  state.player.chain = 1; state.player.frost = 2; state.player.siphon = 1; state.player.hp = 50;
  const first = enemy({ id: 1, x: 700, y: 340, hp: 22 });
  const next = enemy({ id: 2, x: 760, y: 340, hp: 8.8 });
  state.enemies = [first, next, enemy()];
  step(state, { fire: true, aimX: 1, aimY: 0 }); advance(state, .35);
  assert.equal(state.kills, 2);
  assert.equal(state.player.hp, 52);
  assert.equal(first.slowFactor, .7); assert.equal(next.slowFactor, .7);
  assert.ok(state.events.some(event => event.type === 'arc' && event.toX === 760));
  assert.equal(state.enemies.length, 1);
});

test('phase shock shatters frozen enemies and the afterimage lens primes one cool heavy shot', () => {
  const state = quiet();
  state.player.pulse = 1; state.player.focus = 1;
  const chilled = enemy({ x: 570, y: 340, hp: 100, slowTime: 1, slowFactor: .7 });
  state.enemies = [chilled, enemy()];
  step(state, { dash: true, left: true, fire: true, aimX: -1, aimY: 0 });
  assert.equal(chilled.hp, 76); // 16-point shock, amplified by the existing chill.
  assert.ok(Math.abs(state.projectiles[0].damage - 29.7) < 1e-8);
  assert.equal(state.player.heat, 5.5);
  assert.equal(state.player.focusReady, false);
  advance(state, .15);
  step(state, { fire: true, aimX: -1, aimY: 0 });
  assert.equal(state.projectiles.at(-1).damage, 22);
});

test('the triad chamber creates actual side rounds on its fourth trigger', () => {
  const state = quiet(); state.player.scatter = 1;
  advance(state, .38, { fire: true, aimX: -1, aimY: 0 });
  assert.equal(state.player.shotsFired, 4);
  assert.equal(state.projectileId, 6);
  assert.equal(state.projectiles.filter(shot => Math.abs(shot.vy) > 1).length, 2);
  assert.ok(state.projectiles.filter(shot => Math.abs(shot.vy) > 1).every(shot => Math.abs(shot.damage - 12.1) < 1e-8));
});

test('weavers strafe instead of merely following and their single shot has a readable windup', () => {
  const state = quiet();
  state.enemies = [enemy({ type: 'weaver', x: 750, y: 340, attackTimer: 1, speed: 140, strafe: 1 })];
  advance(state, .2);
  assert.ok(Math.abs(state.enemies[0].y - 340) > 15);
  state.enemies[0].attackTimer = 0;
  step(state);
  assert.equal(state.enemies[0].phase, 'windup');
  advance(state, .35);
  assert.equal(state.projectiles.length, 0);
  advance(state, .08);
  assert.equal(state.projectiles.length, 1);
  assert.equal(state.enemies[0].strafe, -1);
});

test('elites have distinct affixes and overcharge affects just the chosen next wave', () => {
  const baseline = createState({ random: seeded(23) }); clearToUpgrade(baseline);
  const risky = createState({ random: seeded(23) }); clearToUpgrade(risky);
  const id = baseline.upgradeChoices[0];
  chooseUpgrade(baseline, id); chooseUpgrade(risky, id, { risk: true });
  assert.equal(risky.waveRisk, true); assert.equal(risky.overcharges, 1);
  assert.equal(risky.enemies.length, baseline.enemies.length + 1);
  assert.equal(risky.enemies.filter(e => e.elite).length, 2);
  assert.ok(risky.enemies.filter(e => e.elite).every(e => ['swift', 'armored', 'volatile'].includes(e.affix)));
  risky.player.invulnerable = 0;
  risky.projectiles = [{ id: 991, owner: 'enemy', x: risky.player.x, y: risky.player.y, vx: 0, vy: 0, radius: 5, damage: 10, life: 1 }];
  step(risky); assert.equal(risky.player.hp, 88.5);
  clearToUpgrade(risky); assert.equal(risky.score, 1110); chooseUpgrade(risky, risky.upgradeChoices[0]);
  assert.equal(risky.waveRisk, false); assert.equal(risky.overcharges, 1);
});

test('a volatile elite leaves a delayed floor warning instead of instant unavoidable damage', () => {
  const state = quiet(); state.player.invulnerable = 0;
  state.enemies = [enemy({ id: 1, x: 550, y: 340, hp: 22, elite: true, affix: 'volatile' }), enemy()];
  step(state, { fire: true, aimX: 1, aimY: 0 }); advance(state, .1);
  assert.equal(state.hazards.length, 1);
  assert.equal(state.player.hp, 100);
  advance(state, .5);
  assert.equal(state.player.hp, 100);
  advance(state, .5, { left: true });
  assert.equal(state.player.hp, 100);
});

test('each guardian sector uses different patterns with delayed mines, staggered rings and lane escapes', () => {
  for (let sector = 0; sector < 4; sector += 1) for (let pattern = 0; pattern < 2; pattern += 1) {
    const state = quiet(); state.sector = sector; state.wave = (sector + 1) * 5;
    state.enemies = [enemy({ type: 'boss', x: 100, y: 340, attackTimer: 0, bossSector: sector, pattern })];
    step(state); assert.equal(state.enemies[0].attackName, SECTORS[sector].patterns[pattern]);
    advance(state, .8); assert.equal(state.projectiles.length, 0); assert.equal(state.hazards.length, 0);
    advance(state, .11);
    if (sector === 1 && pattern === 0) {
      assert.equal(state.hazards.length, 3); assert.ok(state.hazards.every(h => h.warning > .8));
    } else if (sector === 1 && pattern === 1) {
      assert.equal(state.projectiles.length, 10); assert.equal(state.enemies[0].phase, 'burst');
      advance(state, .33); assert.ok(state.events.filter(e => e.type === 'volley').length >= 2);
    } else if (sector === 3 && pattern === 0) {
      assert.deepEqual(state.hazards.map(h => h.kind), ['vertical', 'horizontal']);
      assert.ok(state.hazards.every(h => h.warning > .9));
    } else if (sector === 2 && pattern === 1 || sector === 3 && pattern === 1) assert.equal(state.hazards.length, 1);
    else assert.ok(state.projectiles.length > 0);
  }
});

test('floor hazards freeze when paused and moving out before their countdown avoids damage', () => {
  const state = quiet(); state.player.invulnerable = 0;
  state.hazards = [{ id: 1, kind: 'vertical', x: 500, y: 340, width: 52, radius: 64, warning: .9, life: .25, damage: 18, struck: false }];
  togglePause(state); const snapshot = JSON.stringify(state); advance(state, 4);
  assert.equal(JSON.stringify(state), snapshot); togglePause(state);
  advance(state, 1.2, { right: true });
  assert.equal(state.player.hp, 100); assert.equal(state.hazards.length, 0);
  state.hazards = [{ id: 2, kind: 'blast', x: state.player.x, y: state.player.y, radius: 64, warning: .1, life: .25, damage: 18, struck: false }];
  advance(state, .3); assert.equal(state.player.hp, 82);
});

test('harder tiers open with mixed pressure and elites without inflating ordinary health', () => {
  const standard = createState({ random: seeded(3) });
  const veteran = createState({ random: seeded(3), difficulty: 'veteran' });
  assert.equal(veteran.enemies[0].speed, standard.enemies[0].speed * DIFFICULTIES.veteran.enemySpeed);
  assert.equal(veteran.enemies.length, 6);
  assert.deepEqual(veteran.enemies.map(e => e.type), ['chaser', 'chaser', 'chaser', 'chaser', 'ranged', 'weaver']);
  assert.equal(veteran.enemies.filter(e => e.elite).length, 1);
  const nightmare = createState({ random: seeded(3), difficulty: 'nightmare' });
  assert.equal(nightmare.enemies.length, 9);
  assert.equal(nightmare.enemies.filter(e => e.elite).length, 2);
  assert.ok(nightmare.enemies.some(e => e.type === 'brute'));
  for (const tier of [veteran, nightmare]) {
    for (const e of tier.enemies) {
      assert.ok(Math.hypot(e.x - tier.player.x, e.y - tier.player.y) > 220);
      if (e.type === 'chaser' && e.affix !== 'armored') assert.equal(e.maxHp, standard.enemies[0].maxHp);
    }
  }
  veteran.player.invulnerable = 0;
  veteran.projectiles = [{ id: 1, owner: 'enemy', x: 500, y: 340, vx: 0, vy: 0, radius: 5, damage: 10, life: 1 }];
  step(veteran); assert.equal(veteran.player.hp, 88);
  assert.equal(DIFFICULTIES.veteran.score, 1.5);
  assert.equal(DIFFICULTIES.nightmare.score, 2);
  assert.throws(() => createState({ difficulty: 'impossible' }), RangeError);
});

test('leading aim reads actual movement, locks throughout the tell, and offers time to reverse', () => {
  const standard = quiet(createState({ random: seeded(3) }));
  const veteran = quiet(createState({ random: seeded(3), difficulty: 'veteran' }));
  for (const s of [standard, veteran]) s.enemies = [enemy({ type: 'ranged', x: 180, y: 340, attackTimer: 0 })];
  step(standard, { up: true }); step(veteran, { up: true });
  const foe = veteran.enemies[0];
  assert.equal(foe.phase, 'windup');
  assert.equal(foe.timer, .6);
  assert.ok(foe.aimY < standard.enemies[0].aimY - .3);
  const locked = { x: foe.aimX, y: foe.aimY };
  const startY = veteran.player.y;
  advance(veteran, .4, { down: true });
  assert.equal(foe.aimX, locked.x); assert.equal(foe.aimY, locked.y);
  assert.ok(veteran.player.y > startY + 80);
  assert.equal(veteran.player.hp, 100);
  advance(veteran, .21, { down: true });
  assert.equal(veteran.projectiles.filter(b => b.owner === 'enemy').length, 3);
  assert.ok(veteran.projectiles.every(b => b.vy < 0));
  assert.ok(Math.abs(Math.hypot(veteran.projectiles[0].vx, veteran.projectiles[0].vy) - 229 * DIFFICULTIES.veteran.projectileSpeed * foe.attackPace) < 1e-8);
});

test('higher-tier fan warnings agree with emitted alternating volleys and their attack cadence', () => {
  for (const difficulty of ['standard', 'veteran', 'nightmare']) {
    const state = quiet(createState({ random: seeded(3), difficulty }));
    const foe = enemy({ type: 'ranged', x: 180, y: 340, phase: 'windup', timer: .001, volleyIndex: 0 });
    state.enemies = [foe];
    const first = enemyShotPattern(state, foe);
    step(state);
    assert.equal(state.projectiles.length, first.count);
    assert.ok(Math.abs(foe.attackTimer - 2 * DIFFICULTIES[difficulty].cadence / threatPace(state)) < 1e-9);
    const angle = Math.atan2(state.projectiles[0].vy, state.projectiles[0].vx);
    assert.ok(Math.abs(angle + (first.count - 1) / 2 * first.spread) < 1e-8);
    state.projectiles = [];
    foe.phase = 'windup'; foe.timer = .001;
    const second = enemyShotPattern(state, foe);
    step(state);
    assert.equal(state.projectiles.length, second.count);
    assert.equal(second.count, difficulty === 'standard' ? 3 : 5);
    assert.equal(enemyShotPattern(state, { type: 'weaver', volleyIndex: 1 }).count, difficulty === 'standard' ? 1 : 2);
  }
});

test('higher-tier kill healing has a shared wave budget and repairs retain visible costs', () => {
  for (const difficulty of ['veteran', 'nightmare']) {
    const state = quiet(createState({ random: seeded(3), difficulty }));
    state.player.hp = 40; state.player.siphon = 3;
    for (let kill = 0; kill < 10; kill += 1) {
      state.enemies = [enemy({ x: 560, y: 340, hp: 1 }), enemy({ id: 999 })];
      state.player.fireCooldown = 0; state.player.heat = 0; state.player.overheated = false;
      advance(state, .1, { fire: true, aimX: 1, aimY: 0 });
    }
    assert.equal(state.kills, 10);
    const budget = DIFFICULTIES[difficulty].healingBudget;
    assert.ok(Math.abs(state.player.hp - (40 + budget)) < 1e-8);
    assert.ok(Math.abs(state.waveHealing - budget) < 1e-8);
    clearToUpgrade(state); state.upgradeChoices = ['repair', 'plating'];
    assert.equal(chooseUpgrade(state, 'repair').ok, true);
    assert.ok(Math.abs(state.player.hp - (40 + budget + DIFFICULTIES[difficulty].repair)) < 1e-8);
    assert.equal(state.waveHealing, 0);
    clearToUpgrade(state); state.upgradeChoices = ['plating'];
    const hp = state.player.hp;
    assert.equal(chooseUpgrade(state, 'plating').ok, true);
    assert.equal(state.player.maxHp, 110);
    assert.equal(state.player.hp, hp + DIFFICULTIES[difficulty].plating);
  }
});

test('chain kills cannot multiply the remaining healing budget or consume it while healthy', () => {
  const state = quiet(createState({ random: seeded(3), difficulty: 'nightmare' }));
  state.player.siphon = 3; state.player.chain = 3;
  state.enemies = [enemy({ id: 500, x: 560, y: 340, hp: 1 }), enemy({ id: 501, x: 580, y: 350, hp: 1 }), enemy({ id: 999 })];
  advance(state, .1, { fire: true, aimX: 1, aimY: 0 });
  assert.equal(state.kills, 2);
  assert.equal(state.waveHealing, 0);
  state.player.hp = 50; state.waveHealing = 4.75;
  state.enemies = [enemy({ id: 502, x: 560, y: 340, hp: 1 }), enemy({ id: 503, x: 580, y: 350, hp: 1 }), enemy({ id: 999 })];
  state.player.fireCooldown = 0;
  advance(state, .1, { fire: true, aimX: 1, aimY: 0 });
  assert.equal(state.kills, 4);
  assert.equal(state.player.hp, 50.25);
  assert.equal(state.waveHealing, 5);
});

test('every tier preserves bounded safe waves, deterministic pressure and paused decision clocks', () => {
  for (const difficulty of ['veteran', 'nightmare']) {
    const a = createState({ difficulty, random: seeded(31) });
    const b = createState({ difficulty, random: seeded(31) });
    advance(a, 1, { up: true, fire: true, aimX: -1, aimY: -.4 });
    advance(b, 1, { up: true, fire: true, aimX: -1, aimY: -.4 });
    assert.deepEqual(a, b);
    for (let wave = 1; wave < TOTAL_WAVES; wave += 1) {
      clearToUpgrade(a);
      togglePause(a); const snapshot = JSON.stringify(a);
      advance(a, 1, { fire: true, dash: true });
      assert.equal(JSON.stringify(a), snapshot);
      assert.equal(chooseUpgrade(a, a.upgradeChoices[0]).ok, false);
      togglePause(a);
      assert.equal(chooseUpgrade(a, a.upgradeChoices[0], { risk: true }).ok, true);
      assert.ok(a.enemies.length <= MAX_ENEMIES);
      assert.ok(a.enemies.every(e => Math.hypot(e.x - a.player.x, e.y - a.player.y) > 220));
      assert.equal(a.enemies.filter(e => e.boss).length, a.wave % 5 === 0 ? 1 : 0);
      assert.ok(a.enemies.filter(e => e.elite).length >= DIFFICULTIES[difficulty].elites);
    }
  }
});

test('a legal-input expedition defeats all twenty waves, 259 enemies and four guardians', () => {
  const state = createState({ random: seeded(7) });
  const path = [{ x: 500, y: 100 }, { x: 880, y: 100 }, { x: 880, y: 580 }, { x: 120, y: 580 }, { x: 120, y: 100 }];
  let waypoint = 0;
  let observedBosses = new Set();
  for (let tick = 0; tick < 120 * 600 && state.phase !== 'won' && state.phase !== 'lost'; tick += 1) {
    if (state.phase === 'upgrade') { choose(state, ['repair', 'siphon', 'plating', 'damage', 'chain', 'cooling', 'scatter', 'focus', 'frost', 'pulse', 'mobility', 'battery', 'ricochet']); continue; }
    const p = state.player;
    let target = path[waypoint];
    if (Math.hypot(p.x - target.x, p.y - target.y) < 25) { waypoint = (waypoint + 1) % path.length; target = path[waypoint]; }
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const magnitude = Math.hypot(dx, dy);
    const closest = state.enemies.reduce((best, e) => !best || Math.hypot(e.x - p.x, e.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? e : best, null);
    for (const e of state.enemies) if (e.boss) observedBosses.add(state.wave);
    const threat = state.enemies.some(e => Math.hypot(e.x - p.x, e.y - p.y) < 90)
      || state.projectiles.some(b => b.owner === 'enemy' && Math.hypot(b.x - p.x, b.y - p.y) < 55)
      || state.hazards.some(h => h.warning < .2 && (h.kind === 'vertical' ? Math.abs(h.x - p.x) < 45
        : h.kind === 'horizontal' ? Math.abs(h.y - p.y) < 45 : Math.hypot(h.x - p.x, h.y - p.y) < h.radius + 25));
    step(state, { moveX: dx / magnitude, moveY: dy / magnitude, aimX: closest.x - p.x, aimY: closest.y - p.y,
      fire: true, dash: threat && tick % 60 === 0 });
    assert.ok(state.enemies.length <= MAX_ENEMIES);
    assert.ok(state.projectiles.length <= MAX_PROJECTILES);
    assert.ok(state.events.length <= 32);
    assert.ok(state.hazards.length <= 32);
    assert.ok(Number.isFinite(state.player.x) && Number.isFinite(state.player.y));
  }
  assert.equal(state.phase, 'won');
  assert.deepEqual([...observedBosses], [5, 10, 15, 20]);
  assert.equal(state.kills, 259);
  assert.ok(state.player.hp > 0);
  assert.ok(state.score > 90000);
  assert.ok(state.elapsed < 600);
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

// A test pilot reacts to observable trajectories rather than modifying combat.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const path = [{ x: 500, y: 100 }, { x: 880, y: 100 }, { x: 880, y: 580 }, { x: 120, y: 580 }, { x: 120, y: 100 }];
function hitRisk(px, py, vx, vy, bx, by, bvx, bvy, horizon, radius) {
  const dx = bx - px; const dy = by - py; const rx = bvx - vx; const ry = bvy - vy;
  const time = clamp(-(dx * rx + dy * ry) / (rx * rx + ry * ry || 1), 0, horizon);
  const gap = Math.hypot(dx + rx * time, dy + ry * time);
  return gap < radius ? (radius - gap) / radius * (1.2 - time / horizon) : 0;
}
function tacticalInput(state, memory) {
  const player = state.player;
  let target = path[memory.waypoint || 0];
  if (Math.hypot(player.x - target.x, player.y - target.y) < 35) {
    memory.waypoint = ((memory.waypoint || 0) + 1) % path.length;
    target = path[memory.waypoint];
  }
  const intended = Math.atan2(target.y - player.y, target.x - player.x);
  const speed = player.moveSpeed;
  const bullets = state.projectiles.filter(b => b.owner === 'enemy');
  const incoming = bullets.slice();
  for (const enemy of state.enemies) if (enemy.phase === 'windup' && ['ranged', 'weaver'].includes(enemy.type)) {
    const shot = enemyShotPattern(state, enemy);
    const aim = Math.atan2(enemy.aimY, enemy.aimX);
    const velocity = shot.speed * DIFFICULTIES[state.difficulty].projectileSpeed * (enemy.attackPace ?? threatPace(state));
    for (let index = 0; index < shot.count; index += 1) {
      const angle = aim + (index - (shot.count - 1) / 2) * shot.spread;
      incoming.push({ x: enemy.x + Math.cos(angle) * (enemy.radius + 6) - Math.cos(angle) * velocity * enemy.timer,
        y: enemy.y + Math.sin(angle) * (enemy.radius + 6) - Math.sin(angle) * velocity * enemy.timer,
        vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity });
    }
  }
  let best = null;
  for (let index = 0; index < 16; index += 1) {
    const angle = intended + index * Math.PI / 8;
    const x = Math.cos(angle); const y = Math.sin(angle); const vx = x * speed; const vy = y * speed;
    let cost = (1 - Math.cos(angle - intended)) * .6;
    for (const bullet of incoming) cost += hitRisk(player.x, player.y, vx, vy, bullet.x, bullet.y, bullet.vx, bullet.vy, .85, 38) * 25;
    for (const enemy of state.enemies) {
      if (enemy.type === 'chaser' || enemy.boss) {
        const gap = Math.hypot(enemy.x - player.x - vx * .35, enemy.y - player.y - vy * .35);
        if (gap < enemy.radius + 75) cost += (enemy.radius + 75 - gap) * .06;
      }
      if (enemy.type === 'brute' && ['charge', 'windup'].includes(enemy.phase)) {
        const velocity = chargeSpeed(state, enemy);
        const delay = enemy.phase === 'windup' ? enemy.timer : 0;
        cost += hitRisk(player.x, player.y, vx, vy, enemy.x - enemy.aimX * velocity * delay,
          enemy.y - enemy.aimY * velocity * delay, enemy.aimX * velocity, enemy.aimY * velocity, .85, 55) * 28;
      }
    }
    for (const hazard of state.hazards) {
      const time = Math.max(.06, hazard.warning);
      const hx = player.x + vx * time; const hy = player.y + vy * time;
      const gap = hazard.kind === 'vertical' ? Math.abs(hazard.x - hx) : hazard.kind === 'horizontal'
        ? Math.abs(hazard.y - hy) : Math.hypot(hazard.x - hx, hazard.y - hy);
      if (gap < (hazard.radius || hazard.width / 2) + 25) cost += 18;
    }
    // Check the nearby route as well: a fast diagonal can pass a corner before
    // the old first sample, so endpoint-only planning asks for a blocked dash.
    for (const time of [.04, .08, .12, .2, .35, .5]) {
      const px = player.x + vx * time; const py = player.y + vy * time;
      if (px < 25 || px > 975 || py < 25 || py > 655) cost += 30;
      for (const cover of OBSTACLES) if (Math.hypot(px - clamp(px, cover.x, cover.x + cover.width),
        py - clamp(py, cover.y, cover.y + cover.height)) < player.radius + 5) cost += 30;
    }
    if (!best || cost < best.cost) best = { x, y, cost };
  }
  const closest = state.enemies.reduce((best, e) => !best || Math.hypot(e.x - player.x, e.y - player.y)
    < Math.hypot(best.x - player.x, best.y - player.y) ? e : best, null);
  const previous = memory.enemies?.get(closest.id);
  const delta = memory.lastElapsed === undefined ? 0 : state.elapsed - memory.lastElapsed;
  // Aim from observed motion, including committed charges faster than walking.
  const vx = previous && delta > 0 ? clamp((closest.x - previous.x) / delta, -800, 800) : 0;
  const vy = previous && delta > 0 ? clamp((closest.y - previous.y) / delta, -800, 800) : 0;
  const travel = Math.hypot(closest.x - player.x, closest.y - player.y) / 780;
  memory.enemies = new Map(state.enemies.map(e => [e.id, { x: e.x, y: e.y }]));
  memory.lastElapsed = state.elapsed;
  const urgent = bullets.some(b => hitRisk(player.x, player.y, best.x * speed, best.y * speed, b.x, b.y, b.vx, b.vy, .2, 27) > 0)
    || state.enemies.some(e => e.phase === 'charge' && Math.hypot(e.x - player.x, e.y - player.y) < 100)
    || state.hazards.some(h => h.warning < .12 && (h.kind === 'vertical' ? Math.abs(h.x - player.x) < 50
      : h.kind === 'horizontal' ? Math.abs(h.y - player.y) < 50 : Math.hypot(h.x - player.x, h.y - player.y) < h.radius + 15));
  if (player.heat > 75 || player.overheated) memory.cooling = true;
  if (player.heat < 25) memory.cooling = false;
  return { moveX: best.x, moveY: best.y, aimX: closest.x + vx * travel - player.x, aimY: closest.y + vy * travel - player.y,
    fire: state.difficulty === 'standard' || !memory.cooling, dash: urgent && !player.dashHeld && player.stamina >= player.dashCost };
}

test('deliberate legal dodging and build choices can beat both demanding tiers', () => {
  for (const difficulty of ['veteran', 'nightmare']) for (const seed of [7, 31]) {
    const state = createState({ difficulty, random: seeded(seed) });
    const memory = {}; let input = {}; let lastEvent = 0; let dashes = 0;
    const bosses = [];
    for (let tick = 0; tick < 120 * 600 && !['won', 'lost'].includes(state.phase); tick += 1) {
      if (state.phase === 'upgrade') {
        const priority = state.player.hp < 65
          ? ['repair', 'plating', 'damage', 'chain', 'frost', 'scatter', 'cooling', 'mobility', 'focus', 'siphon', 'battery', 'pulse', 'ricochet']
          : ['damage', 'chain', 'frost', 'scatter', 'cooling', 'mobility', 'focus', 'battery', 'plating', 'repair', 'siphon', 'pulse', 'ricochet'];
        choose(state, priority); continue;
      }
      // Read visible committed warnings and moving shots at 30 Hz; submit only
      // ordinary aim/move/fire/dash inputs to the fixed-step game.
      if (tick % 4 === 0 || !input.aimX) input = tacticalInput(state, memory);
      step(state, input);
      for (const e of state.events) if (e.id > lastEvent) {
        lastEvent = e.id;
        if (e.type === 'dash') dashes += 1;
        if (e.type === 'kill' && e.enemyType === 'boss') bosses.push(state.wave);
      }
      assert.ok(state.enemies.length <= MAX_ENEMIES);
      assert.ok(state.projectiles.length <= MAX_PROJECTILES);
      assert.ok(state.hazards.length <= 32 && state.events.length <= 32);
    }
    assert.equal(state.phase, 'won', `${difficulty} seed ${seed}: wave ${state.wave}`);
    assert.equal(state.wavesCleared, TOTAL_WAVES);
    assert.deepEqual(bosses, [5, 10, 15, 20]);
    assert.equal(state.kills, difficulty === 'veteran' ? 299 : 353);
    assert.ok(state.player.hp > 0);
    assert.ok(dashes > 0);
    assert.ok(state.elapsed < 600);
  }
});

test('a healing-first perimeter loop no longer cruises through Veteran', () => {
  for (const seed of [7, 31]) {
    const state = createState({ difficulty: 'veteran', random: seeded(seed) });
    let waypoint = 0;
    for (let tick = 0; tick < 120 * 180 && !['won', 'lost'].includes(state.phase); tick += 1) {
      if (state.phase === 'upgrade') {
        choose(state, ['repair', 'siphon', 'plating', 'damage', 'chain', 'cooling', 'scatter', 'focus', 'frost', 'pulse', 'mobility', 'battery', 'ricochet']); continue;
      }
      const p = state.player;
      let goal = path[waypoint];
      if (Math.hypot(p.x - goal.x, p.y - goal.y) < 25) { waypoint = (waypoint + 1) % path.length; goal = path[waypoint]; }
      const dx = goal.x - p.x; const dy = goal.y - p.y; const magnitude = Math.hypot(dx, dy) || 1;
      const foe = state.enemies.reduce((best, e) => !best || Math.hypot(e.x - p.x, e.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? e : best, null);
      step(state, { moveX: dx / magnitude, moveY: dy / magnitude, aimX: foe.x - p.x, aimY: foe.y - p.y, fire: true });
    }
    assert.equal(state.phase, 'lost');
    assert.ok(state.wave <= 8, `seed ${seed}: wave ${state.wave}`);
    assert.ok(state.wave >= 3, 'Opening waves should give time to learn the warnings');
  }
});


test('releasing fire restores full cooling and clears an overheat that held input prolongs', () => {
  for (const difficulty of ['veteran', 'nightmare']) {
    const held = quiet(createState({ random: seeded(41), difficulty })), released = quiet(createState({ random: seeded(41), difficulty }));
    for (const s of [held, released]) { s.player.heat = 90; s.player.overheated = true; }
    advance(held, 2.5, { fire: true }); advance(released, 2.5);
    assert.ok(held.player.heat > released.player.heat + 20); assert.equal(held.player.overheated, true); assert.equal(released.player.overheated, false);
    step(released, { fire: true }); assert.ok(released.projectileId > 0);
  }
  const practiceHeld = quiet(), practiceReleased = quiet();
  for (const s of [practiceHeld, practiceReleased]) { s.player.heat = 90; s.player.overheated = true; }
  advance(practiceHeld, 1, { fire: true }); advance(practiceReleased, 1); assert.equal(practiceHeld.player.heat, practiceReleased.player.heat);
});

test('even a complete heat-sink build has to release fire instead of erasing weapon pressure', () => {
  const held = quiet(createState({ random: seeded(42), difficulty: 'veteran' })); held.player.cooling = 52; held.player.heatPerShot = 7;
  advance(held, 8, { fire: true, aimX: -1, aimY: 0 }); assert.ok(held.events.some(e => e.type === 'overheat')); assert.ok(held.player.heat > 28);
  const ready = held.player.heat; advance(held, .5); assert.ok(held.player.heat < ready - 25);
});

test('elite suppression keeps its committed location and full warning, allowing a clean sidestep', () => {
  const setup = () => {
    const s = quiet(createState({ random: seeded(43), difficulty: 'veteran' })); s.wave = 8; s.player.invulnerable = 0;
    const foe = enemy({ type: 'ranged', x: 180, y: 340, elite: true, phase: 'windup', timer: .001, volleyIndex: 1, targetX: 500, targetY: 340 }); s.enemies = [foe];
    step(s); s.projectiles = []; foe.phase = 'recover'; foe.timer = 100; return s;
  };
  const stay = setup(), evade = setup(); assert.equal(stay.hazards.length, 1); assert.ok(stay.hazards[0].warning >= .9);
  const target = { x: evade.hazards[0].x, y: evade.hazards[0].y }; advance(stay, .8); assert.equal(stay.player.hp, 100);
  advance(evade, .8, { up: true }); assert.deepEqual({ x: evade.hazards[0].x, y: evade.hazards[0].y }, target);
  advance(stay, .3); advance(evade, .3, { up: true }); assert.ok(stay.player.hp < 100); assert.equal(evade.player.hp, 100);
});

test('wounded guardians add readable escape pressure in every sector without extra actors', () => {
  for (let sector = 0; sector < SECTORS.length; sector++) {
    const waves = [];
    for (const difficulty of ['standard', 'veteran', 'nightmare']) {
      const s = quiet(createState({ random: seeded(44), difficulty })); s.sector = sector; s.wave = (sector + 1) * 5;
      s.enemies = [enemy({ type: 'boss', x: 160, y: 340, hp: 490, maxHp: 1000, phase: 'windup', timer: .001, attackName: SECTORS[sector].patterns[0] })];
      step(s, { up: true }); waves.push(s);
      assert.equal(s.enemies.length, 1); assert.ok(s.projectiles.length <= MAX_PROJECTILES);
      if (difficulty !== 'standard') assert.ok(s.hazards.some(h => h.warning >= .99 && h.radius === 60));
    }
    assert.ok(waves[1].hazards.length > waves[0].hazards.length); assert.ok(waves[2].hazards.length > waves[1].hazards.length);
    const mark = waves[1].hazards.find(h => h.radius === 60); const fixed = { x: mark.x, y: mark.y }; advance(waves[1], .3, { down: true }); assert.deepEqual({ x: mark.x, y: mark.y }, fixed);
  }
});

test('deep frost still controls ordinary foes while tough guardians resist being permanently pinned', () => {
  const normal = quiet(createState({ random: seeded(45), difficulty: 'veteran' })), guardian = quiet(createState({ random: seeded(45), difficulty: 'veteran' }));
  for (const s of [normal, guardian]) s.player.frost = 3;
  normal.enemies = [enemy({ x: 560, y: 340, hp: 1000 })]; guardian.enemies = [enemy({ type: 'boss', x: 560, y: 340, hp: 1000 })];
  advance(normal, .1, { fire: true, aimX: 1, aimY: 0 }); advance(guardian, .1, { fire: true, aimX: 1, aimY: 0 });
  assert.ok(normal.enemies[0].hp < 1000 && guardian.enemies[0].hp < 1000); assert.ok(guardian.enemies[0].slowFactor > normal.enemies[0].slowFactor); assert.ok(guardian.enemies[0].slowTime < normal.enemies[0].slowTime);
});


test('threat pace follows cumulative active combat time and freezes outside play', () => {
  for (const difficulty of ['veteran', 'nightmare']) {
    const s = quiet(createState({ random: seeded(51), difficulty })); assert.equal(threatPace(s), 1);
    advance(s, 60); assert.ok(Math.abs(threatPace(s) - 1.05) < 1e-9);
    togglePause(s); const paused = JSON.stringify(s); advance(s, 30, { fire: true, dash: true }); assert.equal(JSON.stringify(s), paused);
    togglePause(s); advance(s, 30); assert.ok(Math.abs(threatPace(s) - 1.075) < 1e-9);
    clearToUpgrade(s); const retained = threatPace(s), clock = s.elapsed; advance(s, 60, { fire: true }); assert.equal(s.elapsed, clock); assert.equal(threatPace(s), retained);
    choose(s); assert.equal(threatPace(s), retained); assert.equal(s.wave, 2);
    const fresh = createState({ random: seeded(51), difficulty }); assert.equal(fresh.elapsed, 0); assert.equal(threatPace(fresh), 1);
  }
});

test('late pursuit is actually faster, with a stable cap and unchanged practice speed', () => {
  for (const difficulty of ['standard', 'veteran', 'nightmare']) {
    const early = quiet(createState({ random: seeded(52), difficulty })), late = quiet(createState({ random: seeded(52), difficulty }));
    for (const s of [early, late]) s.enemies = [enemy({ x: 100, y: 340, speed: 100 })];
    late.elapsed = 600; advance(early, .2); advance(late, .2);
    const ordinary = early.enemies[0].x - 100, accelerated = late.enemies[0].x - 100;
    if (difficulty === 'standard') { assert.equal(ordinary, accelerated); assert.equal(threatPace(late), 1); }
    else { assert.ok(accelerated > ordinary * 1.2); assert.ok(accelerated <= ordinary * 1.25 + .001); assert.equal(threatPace(late), 1.25); late.elapsed = 100000; assert.equal(threatPace(late), 1.25); }
  }
});

test('new attack cooldowns tighten with time while every warning remains readable and unchanged', () => {
  for (const type of ['chaser', 'brute', 'ranged', 'weaver', 'boss']) {
    const early = quiet(createState({ random: seeded(53), difficulty: 'veteran' })), late = quiet(createState({ random: seeded(53), difficulty: 'veteran' }));
    for (const s of [early, late]) s.enemies = [enemy({ type, x: type === 'chaser' ? 535 : type === 'brute' ? 200 : 100, y: 340, attackTimer: 0 })];
    late.elapsed = 300; step(early); step(late); const a = early.enemies[0], b = late.enemies[0];
    assert.equal(a.phase, 'windup'); assert.equal(b.phase, 'windup'); assert.equal(a.timer, b.timer); assert.ok(a.timer >= .32);
    if (type === 'brute') continue;
    for (let tick = 0; tick < 150 && a.phase === 'windup'; tick++) step(early);
    for (let tick = 0; tick < 150 && b.phase === 'windup'; tick++) step(late);
    assert.ok(b.attackTimer < a.attackTimer * .9, `${type} should schedule a faster next attack`);
  }
});

test('a ranged warning commits projectile speed and later shots cannot accelerate in flight', () => {
  const s = quiet(createState({ random: seeded(54), difficulty: 'veteran' })); s.elapsed = 30;
  const foe = enemy({ type: 'ranged', x: 100, y: 340, attackTimer: 0 }); s.enemies = [foe]; step(s);
  const committed = foe.attackPace, aim = { x: foe.aimX, y: foe.aimY }; assert.equal(foe.phase, 'windup');
  s.elapsed = 300; advance(s, .61); assert.deepEqual({ x: foe.aimX, y: foe.aimY }, aim);
  const shots = s.projectiles.filter(b => b.owner === 'enemy'); assert.equal(shots.length, 3);
  const speed = Math.hypot(shots[0].vx, shots[0].vy); assert.ok(Math.abs(speed - 229 * DIFFICULTIES.veteran.projectileSpeed * committed) < 1e-8);
  const velocity = { x: shots[0].vx, y: shots[0].vy }; s.elapsed = 1000; step(s); assert.deepEqual({ x: shots[0].vx, y: shots[0].vy }, velocity);
  s.projectiles = []; foe.phase = 'seeking'; foe.attackTimer = 0; step(s); assert.ok(foe.attackPace > committed); advance(s, .61);
  assert.ok(Math.hypot(s.projectiles[0].vx, s.projectiles[0].vy) > speed * 1.2);
});

test('a brute commits the displayed charge speed through its warning, slowdown changes and the whole dash', () => {
  const s = quiet(createState({ random: seeded(55), difficulty: 'veteran' })); s.elapsed = 30;
  const foe = enemy({ type: 'brute', x: 200, y: 340, attackTimer: 0, speed: 64, slowTime: 2, slowFactor: .7 }); s.enemies = [foe]; step(s);
  const committed = chargeSpeed(s, foe), aim = { x: foe.aimX, y: foe.aimY }; assert.ok(Number.isFinite(foe.committedChargeSpeed));
  s.elapsed = 300; foe.slowTime = 0; assert.equal(chargeSpeed(s, foe), committed); advance(s, .81); assert.equal(foe.phase, 'charge');
  const before = foe.x; step(s, {}, 1 / 30); assert.ok(Math.abs(foe.x - before - committed / 30) < 1e-8); assert.equal(chargeSpeed(s, foe), committed); assert.deepEqual({ x: foe.aimX, y: foe.aimY }, aim);
  while (foe.phase === 'charge') step(s); foe.phase = 'seeking'; foe.attackTimer = 0; step(s); assert.ok(chargeSpeed(s, foe) > committed * 1.3);
});

test('timed threat preserves already scheduled cooldowns and terminal clocks', () => {
  const s = quiet(createState({ random: seeded(56), difficulty: 'nightmare' })); s.enemies[0].attackTimer = 10; s.elapsed = 299;
  step(s, {}, 1 / 30); assert.ok(Math.abs(s.enemies[0].attackTimer - (10 - 1 / 30)) < 1e-8);
  for (const phase of ['won', 'lost']) { s.phase = phase; const snapshot = JSON.stringify(s); advance(s, 60); assert.equal(JSON.stringify(s), snapshot); }
});
