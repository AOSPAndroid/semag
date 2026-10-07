import assert from 'node:assert/strict';
import test from 'node:test';
import * as game from '../public/shinobi-engine.js';
const input = (buttons = {}, id = 0) => ({ ...game.emptyInput(), aimX: id ? -1 : 1, ...buttons });
function fighting({ cover = false, ax = 350, ay = 320, bx = 400, by = 320 } = {}) {
  const state = game.createState(); game.startMatch(state);
  for (let i = 0; i < 360; i++) game.step(state, [input(), input({}, 1)]);
  assert.equal(state.phase, 'fight');
  if (!cover) state.obstacles = [];
  Object.assign(state.fighters[0], { x: ax, y: ay }); Object.assign(state.fighters[1], { x: bx, y: by });
  return state;
}
function advance(state, count, a = input(), b = input({}, 1)) { for (let i = 0; i < count; i++) game.step(state, [a, b]); }
const kunai = (state, { x = 200, y = 320, vx = 80, vy = 0, owner = 0, ...other } = {}) => state.projectiles.push({ id: ++state.projectileId, owner, x, y, px: x, py: y, vx, vy, radius: 3, damage: 14, life: 100, reflections: 0, bornTick: state.tick - 1, ...other });
const distanceToRect = (f, rect) => Math.hypot(f.x - Math.max(rect.x, Math.min(rect.x + rect.w, f.x)), f.y - Math.max(rect.y, Math.min(rect.y + rect.h, f.y)));

test('lobby and countdown cannot move, attack, or consume ninja resources', () => {
  const state = game.createState(), before = game.cloneState(state.fighters);
  advance(state, 90, input({ right: true, attack: true, dash: true, throw: true }));
  assert.deepEqual(state.fighters, before); game.startMatch(state);
  advance(state, 359, input({ right: true, attack: true, dash: true, throw: true }));
  assert.equal(state.phase, 'countdown'); assert.equal(state.fighters[0].x, 154); assert.equal(state.fighters[0].kunai, 3); assert.equal(state.fighters[0].stamina, 100);
  game.step(state, [input({ attack: true }), input({}, 1)]); assert.equal(state.phase, 'fight');
  game.step(state, [input({ attack: true }), input({}, 1)]); assert.equal(state.fighters[0].action, 'idle'); // Held before the bell is not a fresh attack.
});
test('katana starts on its declared active tick, hits once, and requires a new press', () => {
  const state = fighting(), attack = input({ attack: true }); game.step(state, [attack, input({}, 1)]);
  advance(state, game.MOVES.light.startup - 1, attack); assert.equal(state.fighters[1].hp, 100);
  game.step(state, [attack, input({}, 1)]); assert.equal(state.fighters[1].hp, 82);
  advance(state, 140, attack); assert.equal(state.fighters[1].hp, 82); assert.equal(state.fighters[0].stamina, 100);
  game.step(state, [input(), input({}, 1)]); advance(state, 11, attack); assert.equal(state.fighters[1].hp, 64);
});
test('heavy cut has a readable commitment, longer range, and finite stamina cost', () => {
  const state = fighting({ bx: 436 }); game.step(state, [input({ heavy: true }), input({}, 1)]);
  assert.equal(state.fighters[0].stamina, 74);
  advance(state, game.MOVES.heavy.startup - 1); assert.equal(state.fighters[1].hp, 100);
  game.step(state, [input(), input({}, 1)]); assert.equal(state.fighters[1].hp, 68);
});
test('blade direction locks when committed and cannot snap through its recovery', () => {
  const state = fighting(); game.step(state, [input({ attack: true, aimX: -1 }), input({}, 1)]);
  advance(state, 20, input({ aimX: 1 })); assert.equal(state.fighters[1].hp, 100); assert.equal(state.fighters[0].actionFacing, Math.PI);
});
test('a blade outside its cone or range cannot hit, including a target just beyond the tip', () => {
  for (const point of [{ bx: 424, by: 320 }, { bx: 350, by: 376 }]) {
    const state = fighting(point); game.step(state, [input({ attack: true }), input({}, 1)]); advance(state, 16); assert.equal(state.fighters[1].hp, 100);
  }
});
test('simultaneous committed katana strikes trade symmetrically', () => {
  const state = fighting(); game.step(state, [input({ attack: true }), input({ attack: true }, 1)]); advance(state, 10);
  assert.equal(state.fighters[0].hp, 82); assert.equal(state.fighters[1].hp, 82);
});
test('katana cannot strike through solid cover', () => {
  const state = fighting({ ax: 380, bx: 438 }); state.obstacles = [{ id: 'pillar', x: 400, y: 300, w: 16, h: 40 }];
  game.step(state, [input({ heavy: true }), input({}, 1)]); advance(state, 36); assert.equal(state.fighters[1].hp, 100);
});
test('a well-timed directional melee parry stuns the attacker instead of taking damage', () => {
  const state = fighting(); game.step(state, [input({ attack: true }), input({}, 1)]); advance(state, 6);
  game.step(state, [input(), input({ parry: true }, 1)]); advance(state, 3);
  assert.equal(state.fighters[1].hp, 100); assert.equal(state.fighters[0].action, 'stun'); assert.equal(state.fighters[1].parries, 1);
  assert.equal(state.events.at(-1).type, 'parry');
});
test('early, late, and wrong-facing parries leave real openings', () => {
  for (const mode of ['startup', 'late', 'wrong']) {
    const state = fighting();
    if (mode === 'late') { game.step(state, [input(), input({ parry: true }, 1)]); advance(state, 14); }
    game.step(state, [input({ attack: true }), mode === 'wrong' ? input({ parry: true, aimX: 1 }, 1) : input({}, 1)]);
    advance(state, 8);
    if (mode === 'startup') game.step(state, [input(), input({ parry: true }, 1)]);
    else game.step(state, [input(), input({}, 1)]);
    game.step(state, [input(), input({}, 1)]); assert.equal(state.fighters[1].hp, 82, mode);
  }
});
test('holding parry is one commitment, not an invincible permanent guard', () => {
  const state = fighting({ bx: 600 }); advance(state, 90, input({ parry: true }));
  assert.equal(state.fighters[0].parries, 0); assert.equal(state.fighters[0].action, 'idle'); assert.ok(state.fighters[0].stamina > 80);
  assert.equal(state.events.filter(e => e.type === 'parryStart').length, 1);
});
test('too little stamina prevents expensive moves without negative resources', () => {
  for (const [button, cost] of [['attack', 14], ['heavy', 26], ['parry', 20], ['dash', 30], ['throw', 6]]) {
    const state = fighting(); state.fighters[0].stamina = cost - .5;
    game.step(state, [input({ [button]: true }), input({}, 1)]); assert.equal(state.fighters[0].action, 'idle'); assert.ok(state.fighters[0].stamina >= 0); assert.equal(state.fighters[0].kunai, 3);
  }
});
test('kunai release after startup, consume one tool, and recover only during free movement', () => {
  const state = fighting({ bx: 800 }); game.step(state, [input({ throw: true }), input({}, 1)]);
  assert.equal(state.fighters[0].kunai, 2); assert.equal(state.projectiles.length, 0);
  advance(state, 13); assert.equal(state.projectiles.length, 0); game.step(state, [input(), input({}, 1)]);
  assert.equal(state.projectiles.length, 1); assert.equal(state.projectiles[0].x, state.fighters[0].x + 20); // Born at end of tick.
  advance(state, game.KUNAI.recovery + game.KUNAI.recoverTicks - 1); assert.equal(state.fighters[0].kunai, 2);
  game.step(state, [input(), input({}, 1)]); assert.equal(state.fighters[0].kunai, 3);
});
test('a near-wall kunai muzzle stops on the near face and never appears across cover', () => {
  const state = fighting({ ax: 384, bx: 600 }); state.obstacles = [{ id: 'thin', x: 400, y: 280, w: 8, h: 80 }];
  game.step(state, [input({ throw: true }), input({}, 1)]); advance(state, 14);
  assert.equal(state.projectiles.length, 0); const hit = state.events.findLast(e => e.type === 'cover'); assert.equal(hit.x, 397);
});
test('earliest kunai body or cover contact wins, independent of obstacle iteration order', () => {
  for (const covered of [false, true]) {
    const state = fighting({ ax: 150, bx: covered ? 310 : 250 }); state.obstacles = [{ id: 'far', x: 340, y: 290, w: 20, h: 60 }, { id: 'near', x: 280, y: 290, w: 12, h: 60 }];
    kunai(state, { vx: 180 }); game.step(state, [input(), input({}, 1)]);
    assert.equal(state.fighters[1].hp, covered ? 100 : 86); assert.equal(state.projectiles.length, 0);
    assert.equal(state.events.at(-1).type, covered ? 'cover' : 'hit');
  }
});
test('relative motion catches a kunai while the target crosses away from the endpoint', () => {
  const state = fighting({ ax: 150, bx: 250, by: 337.1 }); kunai(state, { x: 225, vx: 100 });
  game.step(state, [input(), input({ down: true }, 1)]); assert.equal(state.fighters[1].hp, 86);
});
test('diagonal kunai clears the empty square outside a rounded cover corner', () => {
  const state = fighting({ ax: 150, bx: 800 }); state.obstacles = [{ id: 'stone', x: 400, y: 300, w: 80, h: 80 }];
  kunai(state, { x: 397.1, y: 297.1, vx: .6, vy: -.6 }); game.step(state, [input(), input({}, 1)]);
  assert.equal(state.projectiles.length, 1); assert.equal(state.events.at(-1).type, 'fight');
});
test('directional kunai parry reflects once at actual contact and can strike the thrower later', () => {
  const state = fighting({ ax: 200, bx: 350 }); game.step(state, [input(), input({ parry: true }, 1)]); advance(state, 3);
  kunai(state, { x: 300, vx: 80 }); game.step(state, [input(), input({}, 1)]);
  assert.equal(state.fighters[1].hp, 100); assert.equal(state.projectiles[0].owner, 1); assert.equal(state.projectiles[0].x, 332); assert.equal(state.projectiles[0].vx, -80);
  advance(state, 2); assert.equal(state.fighters[0].hp, 86); assert.equal(state.projectiles.length, 0);
});
test('dash has startup and recovery vulnerability and finite stamina', () => {
  for (const frame of [0, 3, 13]) {
    const state = fighting({ ax: 150, bx: 500 }); game.step(state, [input(), input({ dash: true, up: true }, 1)]); advance(state, frame);
    const f = state.fighters[1]; kunai(state, { x: f.x - 20, y: f.y, vx: 20 });
    game.step(state, [input(), input({}, 1)]); assert.equal(f.hp, frame === 3 ? 100 : 86);
    assert.equal(f.stamina, 70);
  }
});
test('swept dash slides along exact rounded cover without entering a wall or the boundary', () => {
  const state = fighting({ ax: 370, ay: 285, bx: 800, by: 500 }); state.obstacles = [{ id: 'stone', x: 400, y: 300, w: 80, h: 80 }];
  game.step(state, [input({ dash: true, right: true, down: true }), input({}, 1)]);
  for (let i = 0; i < 100; i++) { game.step(state, [input({ right: true, down: true }), input({}, 1)]); assert.ok(distanceToRect(state.fighters[0], state.obstacles[0]) >= 15 - 1e-6); }
  assert.ok(state.fighters[0].x > 480); assert.ok(state.fighters[0].y > 380);
  advance(state, 400, input({ right: true, down: true })); assert.ok(state.fighters[0].x <= game.WORLD.maxX); assert.ok(state.fighters[0].y <= game.WORLD.maxY);
});
test('opposing fast dashes cannot pass through one another', () => {
  const state = fighting({ ax: 450, bx: 510 }); game.step(state, [input({ dash: true, right: true }), input({ dash: true, left: true }, 1)]); advance(state, 22);
  assert.ok(state.fighters[0].x < state.fighters[1].x); assert.ok(state.fighters[1].x - state.fighters[0].x >= 30 - 1e-6);
  advance(state, 4, input({ left: true }), input({ right: true }, 1)); assert.ok(state.fighters[1].x - state.fighters[0].x > 30);
});
test('JSON prediction clones remain deterministic through complex actions and all state stays bounded', () => {
  const a = fighting({ cover: true, ax: 154, bx: 806 }), b = game.cloneState(a);
  for (let tick = 0; tick < 2000; tick++) {
    const inputs = [input({ right: tick % 400 < 180, down: tick % 700 < 150, attack: tick % 73 === 0, heavy: tick % 193 === 0, parry: tick % 97 === 0, dash: tick % 307 === 0, throw: tick % 103 === 0, aimX: Math.cos(tick / 70), aimY: Math.sin(tick / 70) }), input({ left: tick % 350 < 160, up: tick % 550 < 120, throw: tick % 127 === 0, parry: tick % 131 === 0 }, 1)];
    game.step(a, inputs); game.step(b, inputs); assert.deepEqual(a, b);
    assert.ok(a.events.length <= 48); assert.ok(a.projectiles.length <= 24);
    for (const f of a.fighters) { assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y)); assert.ok(f.stamina >= 0 && f.stamina <= 100); }
  }
});
test('idle draws finish in finite time rather than producing endless unattended rounds', () => {
  const state = game.createState(); game.startMatch(state);
  for (let tick = 0; tick < 50000 && state.phase !== 'matchEnd'; tick++) game.step(state, [input(), input({}, 1)]);
  assert.equal(state.phase, 'matchEnd'); assert.equal(state.round, 5); assert.equal(state.winner, null); assert.ok(state.events.length <= 48);
});
test('a genuine best-of-three visits all arenas and ends through ordinary movement and katana inputs', () => {
  const state = game.createState(); game.startMatch(state);
  const maps = new Set(), routeIndex = [0, 0], roundRoutes = [[], [{ x: 154, y: 230 }, { x: 700, y: 230 }], [{ x: 806, y: 230 }, { x: 360, y: 230 }], [{ x: 154, y: 220 }, { x: 560, y: 220 }]];
  let lastRound = 0;
  for (let tick = 0; tick < 20000 && state.phase !== 'matchEnd'; tick++) {
    if (state.round !== lastRound) { lastRound = state.round; routeIndex.fill(0); }
    const controls = [input(), input({}, 1)];
    if (state.phase === 'fight') {
      maps.add(state.stageId); const id = state.round === 2 ? 1 : 0, f = state.fighters[id], target = state.fighters[1 - id];
      const route = state.round === 1 ? [] : roundRoutes[state.round], point = route[routeIndex[id]] || target;
      if (Math.hypot(point.x - f.x, point.y - f.y) < 12 && routeIndex[id] < route.length) routeIndex[id]++;
      const dx = point.x - f.x, dy = point.y - f.y, range = Math.hypot(target.x - f.x, target.y - f.y);
      controls[id] = input({ right: dx > 3 && range > 50, left: dx < -3 && range > 50, down: dy > 3 && range > 50, up: dy < -3 && range > 50, attack: range <= 63 && tick % 42 === 0, aimX: (target.x - f.x) / range, aimY: (target.y - f.y) / range }, id);
    }
    game.step(state, controls);
  }
  assert.equal(state.phase, 'matchEnd'); assert.equal(state.winner, 0); assert.equal(state.round, 3); assert.equal(state.fighters[0].wins, 2); assert.equal(state.fighters[1].wins, 1); assert.deepEqual([...maps], ['rooftop', 'garden', 'shrine']);
});

test('the katana outer cone corner requires a real finite blade-body intersection', () => {
  const angle = .779, state = fighting({ ax: 400, ay: 300, bx: 400 + Math.cos(angle) * 90, by: 300 + Math.sin(angle) * 90 });
  game.step(state, [input({ heavy: true }), input({}, 1)]); advance(state, game.MOVES.heavy.startup + 2);
  assert.equal(state.fighters[1].hp, 100);
});

test('visible katana tells expose the whole real active sector and lock committed facing', async () => {
  const { ShinobiRenderer } = await import('../public/shinobi-renderer.js');
  for (const action of ['light', 'heavy']) for (const frame of [game.MOVES[action].startup - 1, game.MOVES[action].startup, game.MOVES[action].startup + game.MOVES[action].active]) {
    const arcs = [], rotations = [], clips = [], context = new Proxy({}, { get(target, key) { return target[key] ?? (key === 'arc' ? (...args) => arcs.push(args) : key === 'rotate' ? angle => rotations.push(angle) : key === 'clip' ? rule => clips.push(rule) : () => {}); }, set(target, key, value) { target[key] = value; return true; } });
    const fake = { sprite: () => ({}), reducedMotion: true, hitFlash: [0, 0], paintBlade: () => {}, clipWeapons: ShinobiRenderer.prototype.clipWeapons }, f = { ...game.createState().fighters[0], action, actionFrame: frame, facing: -1, actionFacing: .5 };
    ShinobiRenderer.prototype.paintFighter.call(fake, context, f, 12, false, [{ id: 'blade-cover', x: f.x + 36, y: f.y - 10, w: 20, h: 20 }]);
    assert.deepEqual(clips, [undefined, 'evenodd'], 'real weapon clipping must exclude the wall and solid-cover sight shadow');
    assert.equal(rotations[0], .5);
    const move = game.MOVES[action], active = arcs.find(a => Math.abs(a[2] - (move.range - .75)) < 1e-7 && a[3] === -move.cone && a[4] === move.cone);
    assert.equal(Boolean(active), frame === move.startup, `${action} frame ${frame} should visibly match its damaging sector`);
  }
  for (const action of ['parry', 'throw']) {
    const rotations = [], context = new Proxy({}, { get(target, key) { return target[key] ?? (key === 'rotate' ? angle => rotations.push(angle) : () => {}); }, set(target, key, value) { target[key] = value; return true; } });
    ShinobiRenderer.prototype.paintFighter.call({ sprite: () => ({}), reducedMotion: true, hitFlash: [0, 0], paintBlade: () => {}, clipWeapons: ShinobiRenderer.prototype.clipWeapons }, context, { ...game.createState().fighters[0], action, actionFrame: 4, facing: 1, actionFacing: -.7 }, 12);
    assert.equal(rotations[0], -.7);
  }
});
test('only real parry contacts create clash effects; deduplicated effects remain bounded', async () => {
  const { ShinobiRenderer } = await import('../public/shinobi-renderer.js'), renderer = { reducedMotion: false, resetEffects: ShinobiRenderer.prototype.resetEffects };
  renderer.resetEffects();
  const state = { tick: 1, events: [{ id: 1, type: 'parryStart', fighter: 0, x: 200, y: 200 }, { id: 2, type: 'parry', fighter: 0, x: 200, y: 200 }] };
  ShinobiRenderer.prototype.observeEvents.call(renderer, state); assert.equal(renderer.bursts.length, 0); assert.equal(renderer.particles.length, 0); assert.equal(renderer.callouts.length, 0);
  state.events.push({ id: 3, type: 'parry', fighter: 0, target: 1, x: 220, y: 200 }); ShinobiRenderer.prototype.observeEvents.call(renderer, state); assert.equal(renderer.particles.length, 10);
  ShinobiRenderer.prototype.observeEvents.call(renderer, state); assert.equal(renderer.particles.length, 10);
  for (let tick = 2; tick < 500; tick++) ShinobiRenderer.prototype.observeEvents.call(renderer, { tick, events: [{ id: tick + 10, type: 'hit', fighter: 0, target: 1, x: tick, y: 200 }] });
  assert.ok(renderer.particles.length <= 96); assert.ok(renderer.bursts.length <= 20); assert.ok(renderer.seenEvents.size <= 256); assert.ok(renderer.callouts.length <= 6);
});

test('renderer effects freeze in lobby or pause and settle after finishing blows', async () => {
  const { ShinobiRenderer } = await import('../public/shinobi-renderer.js');
  const context = new Proxy({}, { get(target, key) { return target[key] ?? (() => {}); }, set(target, key, value) { target[key] = value; return true; } });
  const renderer = { ctx: context, canvas: { width: 960, height: 640 }, reducedMotion: false, lastTime: 0, lastGhost: [-1, -1], ghosts: [{ id: 0, x: 100, y: 100, facing: 0, age: .01 }], particles: [{ x: 100, y: 100, vx: 100, vy: 0, age: .01, life: .2, color: '#fff' }], bursts: [{ x: 100, y: 100, age: .01, life: .2, type: 'hit', color: '#fff', angle: 0 }], callouts: [{ x: 100, y: 63, age: .01, life: .6, text: '−18', color: '#ffe2c1' }], hitFlash: [.1, 0], observeEvents() {}, scene: () => ({ canvas: {}, coverLayer: {} }), background: () => ({}), sprite: () => ({}), paintFighter() {}, paintProjectile() {}, paintEffects: ShinobiRenderer.prototype.paintEffects };
  const state = game.createState(); ShinobiRenderer.prototype.render.call(renderer, state, { time: 1000 }); ShinobiRenderer.prototype.render.call(renderer, state, { time: 2000 });
  assert.equal(renderer.particles[0].age, .01); assert.equal(renderer.particles[0].x, 100); assert.equal(renderer.ghosts[0].age, .01); assert.equal(renderer.hitFlash[0], .1);
  assert.equal(renderer.callouts[0].age, .01);
  state.phase = 'fight'; state.paused = true; ShinobiRenderer.prototype.render.call(renderer, state, { time: 2500 }); assert.equal(renderer.particles[0].age, .01);
  state.paused = false; ShinobiRenderer.prototype.render.call(renderer, state, { time: 2520 }); assert.ok(renderer.particles[0].age > .01); assert.ok(renderer.particles[0].x > 100); assert.ok(renderer.hitFlash[0] < .1);
  const previousAge = renderer.callouts[0].age;
  state.phase = 'roundEnd'; ShinobiRenderer.prototype.render.call(renderer, state, { time: 2540 });
  assert.ok(renderer.callouts[0].age > previousAge, 'a finishing blow must settle during roundEnd instead of remaining frozen over the result');
});

test('round changes clear old impact feedback and stale snapshot events do not replay', async () => {
  const { ShinobiRenderer } = await import('../public/shinobi-renderer.js');
  const renderer = { reducedMotion: false, resetEffects: ShinobiRenderer.prototype.resetEffects };
  renderer.resetEffects();
  const state = { tick: 200, round: 1, stageId: 'rooftop', phase: 'fight', events: [{ id: 1, tick: 199, type: 'hit', fighter: 0, target: 1, damage: 18, x: 300, y: 300 }] };
  ShinobiRenderer.prototype.observeEvents.call(renderer, state);
  assert.equal(renderer.callouts[0].text, '−18'); assert.ok(renderer.particles.length > 0);
  state.round = 2; state.stageId = 'garden'; state.events = [];
  ShinobiRenderer.prototype.observeEvents.call(renderer, state);
  assert.equal(renderer.callouts.length, 0); assert.equal(renderer.particles.length, 0); assert.equal(renderer.bursts.length, 0);
  state.events = [{ id: 2, tick: 1, type: 'hit', fighter: 0, target: 1, damage: 32, x: 300, y: 300 }];
  ShinobiRenderer.prototype.observeEvents.call(renderer, state);
  assert.equal(renderer.callouts.length, 0); assert.equal(renderer.particles.length, 0); assert.equal(renderer.hitFlash[1], 0);
  state.events = [{ id: 3, tick: 200, type: 'deflect', fighter: 1, x: 300, y: 300 }];
  ShinobiRenderer.prototype.observeEvents.call(renderer, state); assert.equal(renderer.callouts[0].text, 'DEFLECT');
  state.phase = 'lobby'; state.events = [];
  ShinobiRenderer.prototype.observeEvents.call(renderer, state); assert.equal(renderer.callouts.length, 0); assert.equal(renderer.particles.length, 0);
});
