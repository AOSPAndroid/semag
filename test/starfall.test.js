import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA, HITBOX, LIMITS, DIFFICULTIES, STAGES, UPGRADES, createState, step, sweptCircle, patternDirections, togglePause, chooseUpgrade, recordKey } from '../public/solo/starfall-engine.js';

const DT = 1 / 120;
const enemy = ({ id = 90, ...options } = {}) => ({ id, type: 'drone', x: 240, y: 100, baseX: 240, age: 2, radius: 13, hp: 100, maxHp: 100, fireTimer: 1000, pattern: 0, phase: 1, speed: 0, swing: 0, ...options });
const hostile = ({ id = 200, ...options } = {}) => ({ id, x: 240, y: 300, vx: 0, vy: 150, radius: 4.5, age: 0, grazed: false, kind: 'aim', ...options });
const friendly = ({ id = 300, ...options } = {}) => ({ id, x: 240, y: 300, vx: 0, vy: -650, radius: 2.5, damage: 4, focus: true, ...options });
function quiet(options) { const state = createState(options); state.guardianSpawned = true; state.spawnTimer = 1e9; state.player.invulnerable = 0; return state; }
function advance(state, seconds, input = {}) { for (let tick = 0; tick < seconds * 120; tick += 1) step(state, typeof input === 'function' ? input(state, tick) : input); return state; }
function bossClear(state) { state.guardianSpawned = true; state.enemies = [enemy({ type: STAGES[state.stage - 1].bossType, boss: true, x: state.player.x, y: state.player.y - 50, hp: 1, maxHp: 10, age: 0, radius: 31 })]; state.friendlyShots = [friendly({ x: state.player.x, y: state.player.y - 22, damage: 100 })]; step(state); assert.equal(state.phase, state.stage === 6 ? 'won' : 'upgrade'); }

test('Veteran starts a reproducible six-stage campaign with visible precise core and scarce resources', () => {
  const state = createState(); assert.equal(state.gameId, 'starfall-squadron'); assert.equal(state.difficulty, 'veteran');
  assert.equal(state.phase, 'playing'); assert.equal(state.stage, 1); assert.equal(state.player.radius, 3); assert.equal(HITBOX, 3);
  assert.equal(state.player.hull, 3); assert.equal(state.player.bombs, 2); assert.equal(STAGES.length, 6); assert.equal(new Set(STAGES.map(stage => stage.regionId)).size, 3);
  assert.equal(recordKey(state), 'veteran-campaign-v1'); assert.equal(recordKey(createState({ difficulty: 'nightmare' })), 'nightmare-campaign-v1');
  assert.equal(recordKey(createState({ difficulty: 'standard' })), 'standard-campaign-v1'); assert.equal(createState({ difficulty: 'bad', seed: NaN }).difficulty, 'veteran');
  const a = createState({ seed: 'beacon' }); const b = createState({ seed: 'beacon' }); advance(a, 5, { fire: true }); advance(b, 5, { fire: true }); assert.deepEqual(a, b);
  assert.doesNotThrow(() => JSON.stringify(state));
});

test('first-step movement, normalized diagonals, analog precision and focus obey real physical speed', () => {
  const straight = quiet(); const diagonal = quiet(); const focused = quiet(); const analog = quiet();
  step(straight, { right: true }); step(diagonal, { right: true, up: true }); step(focused, { right: true, focus: true }); step(analog, { moveX: .25 });
  assert.equal(straight.player.x, 240 + 245 / 120); assert.ok(Math.abs(Math.hypot(diagonal.player.x - 240, diagonal.player.y - 502) - 245 / 120) < 1e-10);
  assert.equal(focused.player.x, 240 + 105 / 120); assert.equal(analog.player.x, 240 + 245 / 480); assert.equal(focused.player.focus, true);
  const invalid = quiet(); step(invalid, { right: 'yes', moveX: NaN, moveY: Infinity, focus: 'yes' }); assert.equal(invalid.player.x, 240); assert.equal(invalid.player.y, 502);
});

test('clamped borders remain reachable, invalid dt freezes, and oversized dt is bounded', () => {
  const state = quiet(); advance(state, 4, { left: true, up: true }); assert.equal(state.player.x, 14); assert.equal(state.player.y, 38);
  advance(state, 4, { right: true, down: true }); assert.equal(state.player.x, ARENA.width - 14); assert.equal(state.player.y, ARENA.height - 22);
  for (const dt of [0, -1, NaN, Infinity, '1']) { const snapshot = structuredClone(state); step(state, { fire: true, bomb: true }, dt); assert.deepEqual(state, snapshot); }
  const bounded = quiet(); step(bounded, { right: true }, 999); assert.equal(bounded.time, 1 / 30); assert.equal(bounded.player.x, 240 + 245 / 30);
});

test('relative swept circles distinguish tunnelling, crossing, tangency and a square-corner near miss', () => {
  assert.equal(sweptCircle(0, 0, 20, 0, 10, -10, 10, 10, 2), .4292893218813452);
  assert.equal(sweptCircle(0, 0, 20, 0, 10, 3, 10, 3, 3), .5);
  assert.equal(sweptCircle(0, 0, 0, 0, 2.2, 2.2, 2.2, 2.2, 3), null);
  assert.equal(sweptCircle(0, 0, 0, 0, 2, 0, 2, 0, 3), 0);
  assert.equal(sweptCircle(0, 0, 1, 0, 20, 0, 21, 0, 3), null);
});

test('hostile shots hit a moving pilot at their first shared contact, not just endpoints', () => {
  const state = quiet(); state.player.x = 240; state.player.y = 400;
  state.hostileShots = [hostile({ x: 268, y: 400, vx: -1400, vy: 0 })];
  step(state, { right: true }, 1 / 30); assert.equal(state.player.hull, 2); assert.equal(state.hostileShots.length, 0);
  const hit = state.events.find(item => item.type === 'hit'); assert.ok(hit.x > 240 && hit.x < 268); assert.ok(Math.abs(hit.y - 400) < 1e-10);
});

test('the decorative pilot wings do not enlarge its physical core; close shots graze once', () => {
  const state = quiet(); state.player.x = 240; state.player.y = 400;
  state.hostileShots = [hostile({ x: 252, y: 400, vx: 0, vy: 0 })]; step(state);
  assert.equal(state.player.hull, 3); assert.equal(state.grazes, 1); assert.equal(state.chain, 1); assert.equal(state.score, 10);
  advance(state, 1); assert.equal(state.grazes, 1); assert.equal(state.score, 10); assert.equal(state.hostileShots[0].grazed, true);
});

test('graze chain, multiplier and Risk lens have finite rewards and no health regeneration', () => {
  const state = quiet(); state.player.hull = 1; state.build.graze = 1;
  state.hostileShots = Array.from({ length: 9 }, (_, i) => hostile({ id: 200 + i, x: 253, y: 502, vx: 0, vy: 0 })); step(state);
  assert.equal(state.grazes, 9); assert.equal(state.chain, 9); assert.equal(state.bestChain, 9); assert.equal(state.player.hull, 1);
  assert.equal(state.score, 165); assert.equal(state.chainTime, 4); advance(state, 4.1); assert.equal(state.chain, 0); assert.equal(state.grazes, 9);
});

test('one volley costs one hull, invulnerability is finite, and death freezes the complete game', () => {
  const state = quiet(); state.hostileShots = Array.from({ length: 8 }, (_, i) => hostile({ id: 200 + i, x: 240, y: 502, vx: 0, vy: 0 })); step(state);
  assert.equal(state.player.hull, 2); assert.equal(state.events.filter(item => item.type === 'hit').length, 1); assert.equal(state.hostileShots.length, 0);
  advance(state, 1.7); state.player.hull = 1; state.hostileShots = [hostile({ x: 240, y: 502, vx: 0, vy: 0 })]; step(state);
  assert.equal(state.phase, 'lost'); assert.equal(state.result, 'destroyed'); assert.equal(state.player.hull, 0);
  const ended = structuredClone(state); step(state, { fire: true, bomb: true, right: true }, 1 / 30); assert.deepEqual(state, ended);
});

test('bombs are edge-triggered, finite, clear warnings and shots, and cannot be held for repeat spending', () => {
  const state = quiet(); state.enemies = [enemy({ hp: 200 })]; state.hostileShots = [hostile()]; state.warnings = [{ sourceId: 90, remaining: 1 }];
  step(state, { bomb: true }); assert.equal(state.player.bombs, 1); assert.equal(state.enemies[0].hp, 100); assert.equal(state.hostileShots.length, 0); assert.equal(state.warnings.length, 0);
  advance(state, .4, { bomb: true }); assert.equal(state.player.bombs, 1); assert.equal(state.events.filter(item => item.type === 'bomb').length, 1);
  step(state, { bomb: false }); step(state, { bomb: true }); assert.equal(state.player.bombs, 0); assert.equal(state.enemies.length, 0);
  step(state, { bomb: false }); step(state, { bomb: true }); assert.equal(state.player.bombs, 0); assert.equal(state.events.filter(item => item.type === 'bomb').length, 2);
});

test('a shot born after movement tests the final pilot position without retrospective frame damage', () => {
  const state = quiet(); state.player.x = 240; state.player.y = 400;
  state.enemies = [enemy({ x: 230, y: 400, baseX: 230, radius: 0 })];
  state.warnings = [{ id: 500, sourceId: 90, x: 230, y: 400, kind: 'aim', directions: [0], remaining: .01, duration: .52, speed: 0, radius: 4.5 }];
  step(state, { right: true }, 1 / 30); assert.equal(state.player.hull, 3); assert.equal(state.hostileShots[0].x, 240); assert.equal(state.hostileShots[0].age, 0);
});

test('new friendly shots do not hit the earlier position of a moving escort', () => {
  const state = quiet(); state.player.x = 240; state.player.y = 400;
  const target = enemy({ x: 240, y: 384, baseX: 400, swing: 0, radius: 5 }); state.enemies = [target];
  step(state, { fire: true, focus: true }, 1 / 30); assert.equal(target.hp, 100); assert.equal(state.friendlyShots.length, 1);
});

test('friendly bullets choose the first actual body impact independent of enemy array order', () => {
  for (const reverse of [false, true]) {
    const state = quiet(); const near = enemy({ id: 80, y: 320 }); const far = enemy({ id: 81, y: 290 }); state.enemies = reverse ? [far, near] : [near, far];
    state.friendlyShots = [friendly({ y: 350, vy: -1800, damage: 9 })]; step(state, {}, 1 / 30); assert.equal(near.hp, 91); assert.equal(far.hp, 100);
    assert.equal(state.friendlyShots.length, 0); assert.equal(state.events.filter(item => item.type === 'spark').length, 1);
  }
});

test('a shot destroys an incoming escort before a later ram; an earlier ram still counts', () => {
  const rescued = quiet(); rescued.player.y = 400;
  rescued.enemies = [enemy({ y: 350, speed: 1800, hp: 4 })]; rescued.friendlyShots = [friendly({ y: 370, damage: 4 })];
  step(rescued, {}, 1 / 30); assert.equal(rescued.player.hull, 3); assert.equal(rescued.enemies.length, 0); assert.equal(rescued.kills, 1);
  const rammed = quiet(); rammed.player.y = 400;
  rammed.enemies = [enemy({ y: 390, hp: 4 })]; rammed.friendlyShots = [friendly({ y: 440, vy: -1800, damage: 4 })];
  step(rammed, {}, 1 / 30); assert.equal(rammed.player.hull, 2); assert.equal(rammed.kills, 1);
});

test('protection covers earlier contacts even when its timer expires later in the same frame', () => {
  const protectedState = quiet(); protectedState.player.y = 400; protectedState.player.invulnerable = .02;
  protectedState.hostileShots = [hostile({ x: 240, y: 400, vx: 0, vy: 0 })]; step(protectedState, {}, 1 / 30);
  assert.equal(protectedState.player.hull, 3); assert.equal(protectedState.player.invulnerable, 0);
  const expired = quiet(); expired.player.y = 400; expired.player.invulnerable = .01;
  expired.hostileShots = [hostile({ x: 240, y: 372, vx: 0, vy: 900 })]; step(expired, {}, 1 / 30);
  assert.equal(expired.player.hull, 2); assert.ok(Math.abs(expired.player.invulnerable - (1.6 - 9.5 / 900)) < 1e-10);
});

test('focused lance, wing batteries and cadence make different, capped weapon builds', () => {
  const narrow = quiet(); narrow.build.lance = 2; step(narrow, { fire: true, focus: true }); assert.equal(narrow.friendlyShots.length, 1); assert.equal(narrow.friendlyShots[0].damage, 6);
  const wide = quiet(); wide.build.wings = 2; step(wide, { fire: true }); assert.equal(wide.friendlyShots.length, 6); assert.equal(wide.friendlyShots.filter(item => item.vx !== 0).length, 4);
  const rapid = quiet(); rapid.build.cadence = 2; step(rapid, { fire: true, focus: true }); assert.ok(rapid.player.fireTimer < narrow.player.fireTimer);
  assert.equal(UPGRADES.patch.cap, 1); assert.equal(UPGRADES.bomb.cap, 2);
});

test('pattern geometry leaves a real ring gap on every tier and final boss phase', () => {
  const angularDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  for (const difficulty of Object.values(DIFFICULTIES)) for (let stage = 1; stage <= 6; stage += 1) for (let phase = 1; phase <= 3; phase += 1) {
    for (const kind of ['ring', 'cross']) {
      const aim = Math.PI / 2 + .21; const angles = patternDirections(kind, aim, { stage, phase, density: difficulty.density, spin: .24 });
      const gap = kind === 'ring' ? .34 : .26; assert.ok(angles.length >= 9); assert.ok(angles.every(angle => angularDistance(angle, aim) > gap));
      // At 100 px from the source the gap is much wider than a 3 px core plus either projectile radius.
      assert.ok(Math.sin(gap) * 100 > HITBOX + 4.5 + 12);
    }
  }
});

test('warnings last at least half a second, aim locks, the muzzle follows its source, and volley cannot appear early', () => {
  const state = quiet(); state.enemies = [enemy({ fireTimer: 0, baseX: 180, swing: 20 })]; state.player.x = 70;
  step(state); assert.equal(state.warnings.length, 1); const tell = state.warnings[0]; const directions = [...tell.directions];
  assert.ok(tell.duration >= .5); const sourceX = tell.x; state.player.x = 410; advance(state, .3); assert.deepEqual(tell.directions, directions); assert.notEqual(tell.x, sourceX); assert.equal(state.hostileShots.length, 0);
  advance(state, .3); assert.ok(state.hostileShots.length > 0); assert.equal(state.warnings.length, 0);
});

test('guardians arrive only after their wave section and final guardian exposes all three real phases', () => {
  const state = createState(); state.player.invulnerable = DIFFICULTIES.veteran.waveTime + 5;
  advance(state, DIFFICULTIES.veteran.waveTime - .05, { fire: true }); assert.equal(state.guardianSpawned, false);
  advance(state, .1); assert.equal(state.guardianSpawned, true); assert.ok(state.enemies.some(item => item.boss));
  const final = quiet(); final.stage = 6; final.enemies = [enemy({ type: 'crown', boss: true, hp: 100, maxHp: 100, age: 3, phase: 1 })]; step(final); assert.equal(final.enemies[0].phase, 1);
  final.enemies[0].hp = 66; step(final); assert.equal(final.enemies[0].phase, 2); final.enemies[0].hp = 33; step(final); assert.equal(final.enemies[0].phase, 3);
  assert.equal(final.events.filter(item => item.type === 'phase').length, 2);
});

test('guardian death clears exactly one stage and menus freeze clocks, shots, resources and score', () => {
  const state = quiet(); state.player.hull = 2; state.player.bombs = 1; bossClear(state);
  assert.equal(state.stagesCleared, 1); assert.equal(state.stage, 1); assert.equal(state.phase, 'upgrade'); assert.equal(state.player.hull, 2); assert.equal(state.player.bombs, 1);
  assert.equal(state.enemies.length, 0); assert.equal(state.hostileShots.length, 0); assert.equal(state.friendlyShots.length, 0); assert.equal(state.upgradeChoices.length, 3);
  const menu = structuredClone(state); advance(state, 2, { fire: true, bomb: true }); assert.deepEqual(state, menu);
  assert.deepEqual(chooseUpgrade(state, 'bogus'), { ok: false }); assert.equal(state.phase, 'upgrade');
  assert.deepEqual(chooseUpgrade(state, 'patch'), { ok: true }); assert.equal(state.player.hull, 3); assert.equal(state.player.bombs, 1); assert.equal(state.stage, 2); assert.equal(state.stagesCleared, 1);
  assert.equal(state.stageTime, 0); assert.equal(state.time, menu.time); assert.equal(state.build.patch, 1); assert.deepEqual(chooseUpgrade(state, 'lance'), { ok: false });
});

test('repair is available at most once, full hull never offers it, and upgrades cannot repeat one menu', () => {
  const state = quiet(); bossClear(state); assert.ok(!state.upgradeChoices.includes('patch')); const id = state.upgradeChoices[0]; chooseUpgrade(state, id);
  state.player.hull = 2; state.build.patch = 1; bossClear(state); assert.ok(!state.upgradeChoices.includes('patch')); const stage = state.stage; const choice = state.upgradeChoices[0]; assert.equal(chooseUpgrade(state, choice).ok, true); assert.equal(chooseUpgrade(state, choice).ok, false); assert.equal(state.stage, stage + 1);
});

test('pause and resume preserve the exact upgrade or combat state and do not spend resources', () => {
  const state = quiet(); state.hostileShots = [hostile()]; togglePause(state); assert.equal(state.phase, 'paused'); assert.equal(state.resumePhase, 'playing');
  const paused = structuredClone(state); advance(state, 1, { bomb: true }); assert.deepEqual(state, paused); togglePause(state); assert.equal(state.phase, 'playing'); assert.equal(state.hostileShots.length, 1);
  bossClear(state); const choices = [...state.upgradeChoices]; togglePause(state); assert.equal(state.resumePhase, 'upgrade'); togglePause(state); assert.equal(state.phase, 'upgrade'); assert.deepEqual(state.upgradeChoices, choices);
});

test('only the sixth cleared guardian earns a terminal campaign result; records remain separate by tier', () => {
  const state = quiet(); for (let stage = 1; stage <= 6; stage += 1) { bossClear(state); if (stage < 6) { assert.equal(state.result, null); chooseUpgrade(state, state.upgradeChoices[0]); } }
  assert.equal(state.phase, 'won'); assert.equal(state.result, 'campaign'); assert.equal(state.stagesCleared, 6); assert.equal(state.stage, 6); assert.ok(state.score > 25000);
  const completed = structuredClone(state); step(state, { right: true, bomb: true }); assert.deepEqual(state, completed); assert.equal(togglePause(state), false);
});

function pilot(state) {
  const p = state.player; const boss = state.enemies.find(enemy => enemy.boss);
  const target = boss || state.enemies.filter(enemy => enemy.y < p.y - 30).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
  let best = null;
  for (let option = 0; option <= 16; option += 1) {
    const angle = (option - 1) * Math.PI * 2 / 16; const mx = option ? Math.cos(angle) : 0; const my = option ? Math.sin(angle) : 0; const speed = 105 * (1 + state.build.thrusters * .08);
    let risk = 0;
    for (const bullet of state.hostileShots) { const rx = bullet.x - p.x; const ry = bullet.y - p.y; const vx = bullet.vx - mx * speed; const vy = bullet.vy - my * speed; const vv = vx * vx + vy * vy; const t = vv ? Math.max(0, Math.min(.8, -(rx * vx + ry * vy) / vv)) : 0; const d = Math.hypot(rx + vx * t, ry + vy * t); risk += 200 * Math.exp(-((d / (HITBOX + bullet.radius + 9)) ** 2)) / (1 + t * 8); }
    const nx = p.x + mx * speed * .4; const ny = p.y + my * speed * .4;
    if (nx < 22 || nx > 458 || ny < 140 || ny > 560) risk += 500;
    const flight = target ? Math.max(0, (p.y - target.y) / 650) : 0;
    const aimX = boss ? 240 + Math.sin((boss.age + flight - 2) * (state.stage === 6 ? .53 : .63)) * (state.stage === 6 ? 135 : 145) : target?.x ?? 240;
    const score = risk + Math.abs(nx - aimX) * .03 + Math.abs(ny - 430) * .002;
    if (!best || score < best.score) best = { moveX: mx, moveY: my, score, risk };
  }
  return { moveX: best.moveX, moveY: best.moveY, fire: true, focus: true, bomb: p.bombs > 0 && p.invulnerable <= 0 && best.risk > 80 };
}
function runPilot(difficulty, control, limit = 650) {
  const state = createState({ difficulty, seed: 1729 }); const bounds = { enemies: 0, hostileShots: 0, friendlyShots: 0, warnings: 0 };
  for (let tick = 0; tick < limit * 120 && !['won', 'lost'].includes(state.phase); tick += 1) {
    if (state.phase === 'upgrade') { const preferences = state.player.hull < state.player.maxHull ? ['patch', ...(state.player.bombs === 0 ? ['bomb'] : []), 'lance', 'cadence', 'wings', 'thrusters', 'graze'] : ['lance', 'cadence', 'wings', 'thrusters', 'patch', 'bomb', 'graze']; const choice = preferences.find(id => state.upgradeChoices.includes(id)); assert.ok(choice); assert.equal(chooseUpgrade(state, choice).ok, true); }
    else step(state, control(state));
    for (const key of Object.keys(bounds)) bounds[key] = Math.max(bounds[key], state[key].length);
    assert.ok(state.player.x >= 14 && state.player.x <= W - 14 && state.player.y >= 38 && state.player.y <= H - 22);
    assert.ok(state.player.hull >= 0 && state.player.bombs >= 0);
  }
  return { state, bounds };
}
const W = ARENA.width; const H = ARENA.height;

test('stationary fire, bottom tracking and fixed circular flight cannot beat the default challenge', () => {
  const aim = (state, x, y) => { const dx = x - state.player.x; const dy = y - state.player.y; const distance = Math.hypot(dx, dy); return { moveX: distance > 1 ? dx / Math.max(distance, 4) : 0, moveY: distance > 1 ? dy / Math.max(distance, 4) : 0, fire: true }; };
  for (const control of [() => ({ fire: true, focus: true }), state => aim(state, state.enemies.find(enemy => enemy.boss)?.x ?? 240, 502), state => aim(state, 240 + 150 * Math.sin(state.time * .8), 460 + 80 * Math.cos(state.time * .8))]) {
    const { state } = runPilot('veteran', control, 180); assert.equal(state.phase, 'lost'); assert.ok(state.stagesCleared < 2); assert.ok(state.time < 60);
  }
});

test('a predictive pilot using only normal movement, fire, finite bombs and offered upgrades completes the hard six-stage campaign', () => {
  const { state, bounds } = runPilot('veteran', pilot);
  assert.equal(state.phase, 'won'); assert.equal(state.result, 'campaign'); assert.equal(state.stagesCleared, 6); assert.ok(state.time > 200 && state.time < 450);
  assert.ok(state.player.hull > 0 && state.player.hull <= 3); assert.equal(state.player.bombs, 0); assert.ok(state.grazes > 20); assert.ok(state.kills > 60);
  assert.ok(bounds.enemies <= LIMITS.enemies); assert.ok(bounds.hostileShots <= LIMITS.hostileShots); assert.ok(bounds.friendlyShots <= LIMITS.friendlyShots); assert.ok(bounds.warnings <= LIMITS.warnings);
  assert.ok(state.events.length <= LIMITS.events); assert.ok(Object.entries(state.build).every(([id, count]) => count <= UPGRADES[id].cap)); assert.doesNotThrow(() => JSON.stringify(state));
});
