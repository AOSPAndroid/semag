import assert from 'node:assert/strict';
import test from 'node:test';
import { createState, select, selectionComplete, clearSelection, startMatch, resetLobby, step, cloneState, WORLD, CHARACTERS, STAGES, TICK_RATE } from '../public/brawl-engine.js';

function fighting(a = 'wrench', b = 'bulk', stage = 'rooftop') {
  const state = createState();
  select(state, 0, { character: a, stage }); select(state, 1, { character: b });
  startMatch(state); state.phaseTicks = 1; step(state);
  return state;
}
function advance(state, ticks, a = {}, b = {}) { for (let i = 0; i < ticks; i++) step(state, [a, b]); }
function adjacent(state, gap = 54) {
  const main = state.platforms.find(p => p.solid);
  state.fighters.forEach((f, i) => { f.x = 450 + gap * i; f.y = main.y - f.height / 2; f.vx = 0; f.vy = 0; f.grounded = true; f.onPlatform = main.id; });
}
function finite(value) { if (typeof value === 'number') assert.ok(Number.isFinite(value)); else if (value && typeof value === 'object') for (const child of Object.values(value)) finite(child); }

test('six original comics have different bodies, movement, weights and named special moves', () => {
  assert.equal(Object.keys(CHARACTERS).length, 6);
  assert.equal(new Set(Object.values(CHARACTERS).map(c => c.name)).size, 6);
  assert.equal(new Set(Object.values(CHARACTERS).map(c => c.specialName)).size, 6);
  assert.ok(CHARACTERS.bulk.weight > CHARACTERS.moth.weight);
  assert.ok(CHARACTERS.zap.speed > CHARACTERS.bulk.speed);
  assert.equal(CHARACTERS.moth.airJumps, 2);
  assert.ok(CHARACTERS.sprout.attack.reach > CHARACTERS.zap.attack.reach);
});

test('incomplete selections cannot start, and selection ownership/type/phase remain strict', () => {
  const state = createState(); startMatch(state);
  assert.equal(state.phase, 'lobby');
  for (const [id, choice] of [[0, {}], [0, { character: ['wrench'] }], [0, { character: '__proto__' }], [0, { character: 'wrench', hp: 10 }], [1, { stage: 'garden' }], [0, { stage: ['garden'] }]]) assert.equal(select(state, id, choice).ok, false);
  assert.equal(select(state, 0, { character: 'wrench', stage: 'garden' }).ok, true);
  assert.equal(selectionComplete(state), false);
  select(state, 1, { character: 'moth' });
  assert.equal(selectionComplete(state), true);
  startMatch(state);
  assert.equal(state.phase, 'countdown');
  assert.equal(select(state, 0, { stage: 'foundry' }).ok, false);
});

test('three stages have distinct footprints and hazards, and lobby/countdown input does not attack', () => {
  const state = createState();
  advance(state, 20, { attack: true, right: true });
  assert.equal(state.fighters[0].damage, 0);
  assert.equal(state.fighters[0].x, 380);
  assert.equal(new Set(Object.values(STAGES).map(s => JSON.stringify(s.platforms))).size, 3);
  select(state, 0, { character: 'sprout', stage: 'foundry' }); select(state, 1, { character: 'zap' });
  startMatch(state);
  const before = cloneState(state.fighters);
  advance(state, TICK_RATE * 3 - 1, { attack: true, jump: true, right: true });
  assert.equal(state.phase, 'countdown');
  assert.deepEqual(state.fighters, before);
  step(state); assert.equal(state.phase, 'fight');
  assert.equal(state.platforms[0].x, STAGES.foundry.platforms[0].x);
});

test('ground jump, fresh double-jump and Moth’s extra flutter obey airtime resources', () => {
  for (const id of ['wrench', 'moth']) {
    const state = fighting(id), f = state.fighters[0], initialY = f.y;
    step(state, [{ jump: true }]); assert.ok(f.y < initialY);
    assert.equal(f.jumpsLeft, CHARACTERS[id].airJumps);
    const after = f.vy;
    advance(state, 5, { jump: true }); assert.ok(f.vy > after, 'held jump does not refresh upward velocity');
    for (let i = 0; i < CHARACTERS[id].airJumps; i++) { step(state); step(state, [{ jump: true }]); }
    assert.equal(f.jumpsLeft, 0);
    step(state); const old = f.vy; step(state, [{ jump: true }]); assert.ok(f.vy > old);
    advance(state, 160);
    assert.equal(f.grounded, true); assert.equal(f.jumpsLeft, CHARACTERS[id].airJumps);
  }
});

test('falling bodies land on one-way platforms, and down+jump drops only through perches', () => {
  const state = fighting(), f = state.fighters[0], perch = state.platforms[1];
  f.x = perch.x + 70; f.y = perch.y - 90; f.vy = 10; f.grounded = false;
  advance(state, 12);
  assert.equal(f.onPlatform, perch.id); assert.equal(f.y, perch.y - f.height / 2);
  step(state, [{ down: true, jump: true }]);
  assert.equal(f.grounded, false); assert.ok(f.dropTicks > 0);
  advance(state, 30, { down: true });
  assert.equal(f.onPlatform, 'main');
  const y = f.y; step(state, [{ down: true, jump: true }]);
  assert.ok(f.y < y, 'the main stage cannot be dropped through');
});

test('solid main platform blocks an upward recovery from below and allows recovery around its edge', () => {
  const state = fighting(), f = state.fighters[0], main = state.platforms[0];
  f.x = 600; f.y = main.y + main.h + f.height / 2 + 25; f.grounded = false; f.coyote = 0;
  step(state, [{ up: true, special: true }]);
  advance(state, 8);
  assert.ok(f.y >= main.y + main.h + f.height / 2 - .001);
  const recover = fighting('parcel'), p = recover.fighters[0], floor = recover.platforms[0];
  p.x = floor.x - 60; p.y = 660; p.grounded = false; p.coyote = 0;
  step(recover, [{ up: true, special: true }]);
  advance(recover, 30, { up: true });
  assert.ok(p.y < floor.y - p.height / 2);
  advance(recover, 30, { right: true });
  assert.ok(p.x > floor.x);
});

test('fastfall increases downward speed and air steering remains controlled', () => {
  const normal = fighting(), fast = fighting();
  for (const state of [normal, fast]) { const f = state.fighters[0]; f.x = 1100; f.y = 200; f.grounded = false; f.vy = 4; }
  advance(normal, 12, { right: true }); advance(fast, 12, { right: true, down: true });
  assert.ok(fast.fighters[0].y > normal.fighters[0].y + 25);
  assert.ok(normal.fighters[0].vx > 0 && normal.fighters[0].vx <= CHARACTERS.wrench.speed);
});

test('fresh ground attacks have startup, hit once, and held attack cannot restart them', () => {
  const state = fighting(); adjacent(state);
  const startup = CHARACTERS.wrench.attack.startup;
  advance(state, startup, { attack: true });
  assert.equal(state.fighters[1].damage, 0);
  step(state, [{ attack: true }]);
  assert.equal(state.fighters[1].damage, CHARACTERS.wrench.attack.damage);
  advance(state, 80, { attack: true });
  assert.equal(state.events.filter(event => event.type === 'move').length, 1);
  assert.equal(state.events.filter(event => event.type === 'hit').length, 1);
});

test('damage percentage amplifies knockback while a heavyweight resists the same hit', () => {
  const light = fighting('wrench', 'moth'), heavy = fighting('wrench', 'bulk'), hurt = fighting('wrench', 'bulk');
  for (const state of [light, heavy, hurt]) adjacent(state);
  hurt.fighters[1].damage = 120;
  for (const state of [light, heavy, hurt]) advance(state, CHARACTERS.wrench.attack.startup + 1, { attack: true });
  assert.ok(light.fighters[1].vx > heavy.fighters[1].vx);
  assert.ok(hurt.fighters[1].vx > heavy.fighters[1].vx * 2);
  assert.ok(hurt.fighters[1].stun > heavy.fighters[1].stun);
});

test('up-attacks launch upward and aerial down-attacks create a meteor recovery threat', () => {
  const up = fighting(); adjacent(up, 0);
  up.fighters[1].y -= 65; up.fighters[1].grounded = false;
  advance(up, CHARACTERS.wrench.attack.startup + 1, { attack: true, up: true });
  assert.ok(up.fighters[1].damage > 0);
  assert.ok(up.fighters[1].vy < 0);
  const down = fighting();
  down.fighters[0].x = 1100; down.fighters[0].y = 300; down.fighters[0].grounded = false;
  down.fighters[1].x = 1100; down.fighters[1].y = 350; down.fighters[1].grounded = false;
  advance(down, CHARACTERS.wrench.attack.startup + 1, { attack: true, down: true });
  assert.ok(down.fighters[1].damage > 0);
  assert.ok(down.fighters[1].vy > 0);
  assert.equal(down.fighters[0].move.angle, Math.PI / 2);
});

test('fresh shield parries, established shield blocks, and shield depletion causes a punish window', () => {
  const parry = fighting(); adjacent(parry);
  advance(parry, CHARACTERS.wrench.attack.startup - 2, { attack: true });
  advance(parry, 3, { attack: true }, { shield: true });
  assert.equal(parry.fighters[1].damage, 0);
  assert.ok(parry.events.some(e => e.type === 'parry'));
  assert.ok(parry.fighters[0].stun > 0);
  const block = fighting(); adjacent(block);
  advance(block, 10, {}, { shield: true });
  advance(block, CHARACTERS.wrench.attack.startup + 1, { attack: true }, { shield: true });
  assert.equal(block.fighters[1].damage, 0);
  assert.ok(block.events.some(e => e.type === 'block'));
  assert.ok(block.fighters[1].shield < 80);
  const broken = fighting(); broken.fighters[1].shield = .1;
  step(broken, [{}, { shield: true }]);
  assert.equal(broken.fighters[1].shieldBreakTicks, 90);
  advance(broken, 90);
  assert.equal(broken.fighters[1].shieldBreakTicks, 0);
  assert.ok(broken.fighters[1].shield >= 30);
});

test('dodge startup is vulnerable, evasion is bounded, and aerial dodge cannot be refreshed midair', () => {
  const state = fighting(), f = state.fighters[0];
  step(state, [{ dodge: true, right: true }]);
  assert.equal(f.invulnerable, false);
  advance(state, 3, { dodge: true }); assert.equal(f.invulnerable, false);
  step(state, [{ dodge: true }]); assert.equal(f.invulnerable, true);
  advance(state, 13, { dodge: true }); assert.equal(f.invulnerable, false);
  advance(state, 100, { dodge: true });
  assert.equal(state.events.filter(e => e.type === 'dodge').length, 1);
  const air = fighting(), a = air.fighters[0]; a.x = 1120; a.y = 0; a.grounded = false;
  step(air, [{ dodge: true, up: true }]); assert.equal(a.airDodgeUsed, true);
  advance(air, 70, { up: true });
  step(air, [{ dodge: true, up: true }]);
  assert.equal(air.events.filter(e => e.type === 'dodge').length, 1);
});

test('recovery special is character-specific, available once per airtime, and refreshes on landing', () => {
  const state = fighting('parcel'), f = state.fighters[0];
  f.x = 600; f.y = 350; f.grounded = false; f.coyote = 0;
  step(state, [{ up: true, special: true }]);
  assert.equal(f.move.name, CHARACTERS.parcel.recoveryName);
  assert.equal(f.recoveryUsed, true); assert.ok(f.vy < -15);
  advance(state, 40);
  step(state, [{ up: true, special: true }]);
  assert.notEqual(f.action, 'recovery');
  advance(state, 160);
  assert.equal(f.grounded, true); assert.equal(f.recoveryUsed, false);
  step(state, [{ up: true, special: true }]); assert.equal(f.action, 'recovery');
});

test('character specials create distinct boomerang, leaf, arcing parcel, spark, gust, and heavyweight punch', () => {
  for (const id of Object.keys(CHARACTERS)) {
    const state = fighting(id), f = state.fighters[0];
    advance(state, id === 'bulk' ? 26 : 15, { special: true });
    assert.equal(f.move.name, CHARACTERS[id].specialName);
    if (CHARACTERS[id].projectile) {
      assert.equal(state.projectiles[0].kind, CHARACTERS[id].projectile);
      if (id === 'parcel') assert.ok(state.projectiles[0].vy < 0);
    } else assert.equal(f.move.kind, 'burst');
  }
  const returning = fighting('wrench');
  advance(returning, 60, { special: true });
  assert.ok(returning.projectiles[0].vx < 0);
});

test('swept projectiles do not tunnel through bodies or solid platform cover', () => {
  const state = fighting(); adjacent(state, 150);
  const target = state.fighters[1];
  state.projectiles.push({ id: 1, owner: 0, kind: 'spark', x: target.x - 100, y: target.y, vx: 200, vy: 0, radius: 7, damage: 12, life: 20, age: 0, hitTargets: [] });
  step(state);
  assert.equal(target.damage, 12); assert.equal(state.projectiles.length, 0);
  const covered = fighting(), main = covered.platforms[0];
  covered.fighters[1].x = 600; covered.fighters[1].y = 680; covered.fighters[1].grounded = false;
  covered.projectiles.push({ id: 1, owner: 0, kind: 'leaf', x: 600, y: main.y - 30, vx: 0, vy: 200, radius: 7, damage: 12, life: 20, age: 0, hitTargets: [] });
  step(covered);
  assert.equal(covered.fighters[1].damage, 0); assert.equal(covered.projectiles.length, 0);
});

test('projectile circles allow real corner near misses while retaining glancing hits', () => {
  for (const [offset, expectedDamage] of [[6, 0], [4, 12]]) {
    const state = fighting(), target = state.fighters[1];
    Object.assign(target, { x: 600, y: 100, vx: 0, vy: -CHARACTERS.bulk.gravity, grounded: false, stun: 10 });
    state.projectiles.push({ id: 1, owner: 0, kind: 'spark', x: target.x - target.width / 2 - offset,
      y: target.y - target.height / 2 - offset, vx: 0, vy: 0, radius: 7, damage: 12, life: 20, age: 0, hitTargets: [] });
    step(state);
    assert.equal(target.damage, expectedDamage, `corner clearance ${Math.hypot(offset, offset)}px`);
  }
});

test('projectile contact follows a moving fighter rather than only its final position', () => {
  const state = fighting(), target = state.fighters[1];
  Object.assign(target, { x: 600, y: 100, vx: 25, vy: 12, grounded: false, stun: 10 });
  state.projectiles.push({ id: 1, owner: 0, kind: 'spark', x: 630, y: 67,
    vx: -9.5, vy: 0, radius: 7, damage: 12, life: 20, age: 0, hitTargets: [] });
  step(state);
  assert.equal(target.damage, 12, 'the shot catches the upper corner before the falling body moves below it');
  assert.equal(state.projectiles.length, 0);
});

test('roof-edge collisions use crossing position and allow sliding off after an early landing', () => {
  const departing = fighting('parcel'), f = departing.fighters[0], main = departing.platforms[0];
  Object.assign(f, { x: main.x + 5, y: main.y - f.height / 2 - 1, vx: -25, vy: 12, grounded: false, stun: 10 });
  step(departing);
  assert.ok(f.x + f.width / 2 < main.x);
  assert.equal(f.y + f.height / 2, main.y, 'the body meets the roof before crossing its edge');
  assert.equal(f.grounded, false, 'sliding off must not restore grounded resources');
  step(departing);
  assert.ok(f.y + f.height / 2 > main.y);

  const arriving = fighting('parcel'), a = arriving.fighters[0], roof = arriving.platforms[0];
  Object.assign(a, { x: roof.x - 30, y: roof.y - a.height / 2 - 1, vx: 25, vy: 12, grounded: false, stun: 10 });
  step(arriving);
  assert.equal(a.grounded, false, 'crossing the edge after falling below the roof cannot teleport onto it');
  assert.ok(a.y + a.height / 2 > roof.y);
  assert.equal(a.x + a.width / 2, roof.x, 'the solid side catches the late arrival');
});

test('parcel detonations use a bounded radius and cannot damage their owner', () => {
  const state = fighting('parcel'); adjacent(state, 70);
  const target = state.fighters[1];
  state.projectiles.push({ id: 1, owner: 0, kind: 'parcel', x: target.x, y: target.y - 45, vx: 0, vy: 0, radius: 11, damage: 18, life: 1, age: 79, hitTargets: [] });
  step(state);
  assert.equal(target.damage, 18); assert.equal(state.fighters[0].damage, 0);
  assert.equal(state.projectiles.length, 0);
  assert.ok(state.events.some(e => e.type === 'explosion'));
});

test('parcel blasts respect solid rooftop cover and the nearest visible body edge', () => {
  const covered = fighting('parcel'), protectedFighter = covered.fighters[1], main = covered.platforms[0];
  Object.assign(protectedFighter, { x: 600, y: main.y + main.h + protectedFighter.height / 2 + 6, grounded: false });
  covered.projectiles.push({ id: 1, owner: 0, kind: 'parcel', x: 600, y: main.y - 30,
    vx: 0, vy: 0, radius: 11, damage: 18, life: 1, age: 79, hitTargets: [] });
  step(covered);
  assert.equal(protectedFighter.damage, 0);
  assert.ok(covered.events.some(e => e.type === 'explosion'));

  const glancing = fighting('parcel'), target = glancing.fighters[1];
  Object.assign(target, { x: 600, y: 100, vy: -CHARACTERS.bulk.gravity, grounded: false, stun: 10 });
  glancing.projectiles.push({ id: 1, owner: 0, kind: 'parcel', x: 680, y: 188,
    vx: 0, vy: -.14, radius: 11, damage: 18, life: 1, age: 79, hitTargets: [] });
  step(glancing);
  assert.equal(target.damage, 18, 'the body edge inside the 85px blast counts even when its center is farther away');
});

test('parcel blasts hit an exposed body portion around a roof edge without penetrating full cover', () => {
  const state = fighting('parcel'), target = state.fighters[1], main = state.platforms[0];
  Object.assign(target, { x: main.x + 1, y: main.y + main.h + target.height / 2 + 1, grounded: false });
  state.projectiles.push({ id: 1, owner: 0, kind: 'parcel', x: main.x + 1, y: main.y - 12,
    vx: 0, vy: -.14, radius: 11, damage: 18, life: 1, age: 79, hitTargets: [] });
  step(state);
  assert.equal(target.damage, 18, 'the left shoulder is visible around the roof despite cover hiding the nearest body point');
});

test('stage hazards warn before activity, hit once per activation, and have deterministic cycling', () => {
  const state = fighting('wrench', 'bulk', 'garden'), f = state.fighters[0], spec = STAGES.garden.hazards[0];
  f.x = 600; f.y = state.platforms[0].y - f.height / 2;
  state.elapsedTicks = spec.warningStart - 1;
  step(state); assert.equal(state.hazards[0].phase, 'warning'); assert.equal(f.damage, 0);
  state.elapsedTicks = spec.activeStart - 1;
  step(state); assert.equal(state.hazards[0].phase, 'active'); assert.equal(f.damage, spec.damage);
  advance(state, 5); assert.equal(f.damage, spec.damage);
  const copy = cloneState(state); advance(state, 200); advance(copy, 200); assert.deepEqual(state, copy);
});

test('blast-zone loss takes exactly one stock, respawns safely, and attacking forfeits spawn protection', () => {
  const state = fighting(), f = state.fighters[0];
  f.x = WORLD.blastLeft - 1; f.damage = 160;
  step(state); assert.equal(f.stocks, 2); assert.equal(f.damage, 0); assert.equal(f.respawnTicks, 120);
  advance(state, 119, { attack: true }); assert.equal(f.stocks, 2); assert.equal(f.respawnTicks, 1);
  step(state); assert.equal(f.respawnTicks, 0); assert.equal(f.invulnerableTicks, 180); assert.equal(f.y, 150);
  step(state); step(state, [{ attack: true }]);
  assert.equal(f.invulnerableTicks, 0); assert.equal(f.invulnerable, false);
});

test('three-stock match ends once, simultaneous last-stock loss draws, and rematch preserves picks', () => {
  const state = fighting('sprout', 'zap', 'foundry');
  for (let i = 0; i < 3; i++) {
    const f = state.fighters[1]; f.x = WORLD.blastRight + 5; step(state);
    if (i < 2) advance(state, 121);
  }
  assert.equal(state.phase, 'matchEnd'); assert.equal(state.winner, 0); assert.equal(state.fighters[0].wins, 1);
  const frozen = cloneState(state.fighters); advance(state, 50, { attack: true, right: true }); assert.deepEqual(state.fighters, frozen);
  resetLobby(state); assert.equal(state.stageId, 'foundry'); assert.equal(state.stageSelected, true); assert.equal(state.fighters[0].characterId, 'sprout'); assert.equal(state.fighters[1].stocks, 3);
  clearSelection(state, 1); assert.equal(selectionComplete(state), false); assert.equal(state.stageSelected, true);
  clearSelection(state, 0); assert.equal(state.stageSelected, false);
  const draw = fighting(); draw.fighters.forEach(f => { f.stocks = 1; f.x = WORLD.blastLeft - 10; }); step(draw);
  assert.equal(draw.phase, 'matchEnd'); assert.equal(draw.winner, null);
});

test('four-minute timeout ranks remaining stocks then lower damage and can draw', () => {
  for (const [stocks, damage, winner] of [[[3, 2], [90, 0], 0], [[2, 2], [90, 10], 1], [[2, 2], [10, 10], null]]) {
    const state = fighting(); state.roundTicks = 1; state.fighters.forEach((f, i) => { f.stocks = stocks[i]; f.damage = damage[i]; });
    step(state); assert.equal(state.phase, 'matchEnd'); assert.equal(state.winner, winner); assert.equal(state.result, 'time');
  }
});

test('long cloned input streams stay deterministic with bounded effects, finite physics and every character', () => {
  for (let id = 0; id < 6; id++) {
    const names = Object.keys(CHARACTERS), a = fighting(names[id], names[(id + 3) % 6], Object.keys(STAGES)[id % 3]), b = cloneState(a);
    for (let tick = 0; tick < 12_000; tick++) {
      const inputs = [0, 1].map(player => ({ left: (tick + player * 90) % 480 < 130, right: (tick + player * 90) % 480 > 220 && (tick + player * 90) % 480 < 350,
        up: tick % 170 < 55, down: tick % 170 > 120, jump: tick % 83 === 0, attack: tick % 43 === 0, special: tick % 91 === 0,
        shield: (tick + player * 7) % 130 < 20, dodge: tick % 111 === 0 }));
      step(a, inputs); step(b, inputs);
      if (a.phase === 'matchEnd') { startMatch(a); startMatch(b); a.phaseTicks = 1; b.phaseTicks = 1; }
      assert.ok(a.projectiles.length <= 32 && a.events.length <= 64 && a.hazards.length <= 2);
      for (const f of a.fighters) assert.ok(f.stocks >= 0 && f.stocks <= 3 && f.damage >= 0 && f.damage <= 999 && f.shield >= 0 && f.shield <= 100);
      if (tick % 1000 === 0) finite(a);
    }
    assert.deepEqual(a, b);
  }
});
