import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../public/shinobi-engine.js';
import { ShinobiRenderer } from '../public/shinobi-renderer.js';

// A recording Canvas exercises the actual renderer and actual 120 Hz combat.
// The fixture owns no game state and creates no browser timing or input hooks.
function rendererFixture({ width = 960, height = 640, reducedMotion = false } = {}) {
  const previous = { document: globalThis.document, window: globalThis.window, ResizeObserver: globalThis.ResizeObserver };
  const calls = []; let assets = 0, layouts = 0;
  const context = () => {
    const properties = { globalAlpha: 1, lineWidth: 1 }, stack = [];
    let path = [];
    return new Proxy(properties, { get(target, key) {
      if (key in target) return target[key];
      if (key === 'save') return () => stack.push({ ...properties });
      if (key === 'restore') return () => { const saved = stack.pop(); if (saved) Object.assign(properties, saved); };
      if (key === 'beginPath') return () => { path = []; };
      if (key === 'arc') return (...args) => path.push(['arc', ...args]);
      if (key === 'moveTo' || key === 'lineTo' || key === 'rect') return (...args) => path.push([key, ...args]);
      if (key === 'stroke' || key === 'fill') return () => calls.push({ op: key, path: path.map(v => [...v]), color: properties[key === 'fill' ? 'fillStyle' : 'strokeStyle'], lineWidth: properties.lineWidth, alpha: properties.globalAlpha });
      if (key === 'fillText' || key === 'strokeText') return (...args) => calls.push({ op: key, args, color: properties.fillStyle, font: properties.font });
      if (key === 'drawImage' || key === 'fillRect' || key === 'setTransform' || key === 'translate' || key === 'rotate' || key === 'clip' || key === 'setLineDash') return (...args) => calls.push({ op: key, args, color: properties.fillStyle });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
      return () => {};
    }, set(target, key, value) { target[key] = value; return true; } });
  };
  const canvas = () => { const ctx = context(); return { width, height, getContext: () => ctx, getBoundingClientRect() { layouts++; return { width, height }; } }; };
  const listeners = new Map();
  const media = { matches: reducedMotion, addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: (type, fn) => { if (listeners.get(type) === fn) listeners.delete(type); } };
  globalThis.document = { createElement(tag) { if (tag !== 'canvas') throw new Error('Unexpected element'); assets++; return canvas(); } };
  globalThis.window = { devicePixelRatio: 1, matchMedia: () => media };
  globalThis.ResizeObserver = class { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} };
  return { canvas: canvas(), calls, get assets() { return assets; }, get layouts() { return layouts; }, media, changeReducedMotion(value) { media.matches = value; listeners.get('change')?.(); }, restore() { for (const [key, value] of Object.entries(previous)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } };
}

const input = (buttons = {}, id = 0) => ({ ...game.emptyInput(), aimX: id ? -1 : 1, ...buttons });
function fighting({ bx = 400 } = {}) {
  const state = game.createState(); game.startMatch(state);
  for (let tick = 0; tick < 360; tick++) game.step(state, [input(), input({}, 1)]);
  state.obstacles = []; Object.assign(state.fighters[0], { x: 350, y: 320 }); Object.assign(state.fighters[1], { x: bx, y: 320 });
  return state;
}
function practicing({ bots = 4, stageId = 'rooftop' } = {}) {
  const state = game.createState({ mode: 'practice', bots, difficulty: 'hard', stageId, seed: 123 });
  game.startMatch(state);
  for (let tick = 0; tick < 360; tick++) game.step(state, state.fighters.map(fighter => input({}, fighter.id)));
  return state;
}
const advance = (state, ticks, a = input(), b = input({}, 1)) => { for (let i = 0; i < ticks; i++) game.step(state, [a, b]); };
const texts = calls => calls.filter(call => call.op === 'fillText').map(call => call.args[0]);
const arcs = calls => calls.filter(call => call.op === 'stroke').flatMap(call => call.path.filter(path => path[0] === 'arc').map(path => ({ ...call, args: path.slice(1) })));
function withRenderer(options, work) {
  const env = rendererFixture(options); let renderer;
  try { renderer = new ShinobiRenderer(env.canvas); work(renderer, env); }
  finally { renderer?.destroy(); env.restore(); }
}
function paint(renderer, env, fighter, tick) {
  env.calls.length = 0; renderer.paintFighter(renderer.ctx, fighter, tick); return [...env.calls];
}

test('real katana startup, active contact, and recovery have distinct truthful sectors', () => withRenderer({}, (renderer, env) => {
  for (const action of ['light', 'heavy']) {
    const state = fighting(), move = game.MOVES[action];
    game.step(state, [input({ [action === 'light' ? 'attack' : 'heavy']: true }), input({}, 1)]);
    const committed = structuredClone(state);
    let calls = paint(renderer, env, state.fighters[0], state.tick);
    assert.ok(calls.some(call => call.op === 'setLineDash' && call.args[0].length), 'startup declares a dashed sector');
    assert.ok(arcs(calls).some(arc => arc.args[2] === move.range - 1 && arc.args[3] === -move.cone && arc.args[4] === move.cone));
    assert.ok(!texts(calls).some(text => text.startsWith('STRIKE')));
    assert.deepEqual(state, committed, 'painting cannot advance or mutate combat');
    advance(state, move.startup);
    assert.equal(state.fighters[1].hp, 100 - move.damage);
    calls = paint(renderer, env, state.fighters[0], state.tick);
    assert.ok(texts(calls).some(text => text.startsWith('STRIKE')));
    assert.ok(arcs(calls).some(arc => Math.abs(arc.args[2] - (move.range - .75)) < 1e-9 && arc.args[3] === -move.cone && arc.args[4] === move.cone), 'solid outline shows the full actual active sector');
    advance(state, move.active);
    calls = paint(renderer, env, state.fighters[0], state.tick);
    assert.ok(!arcs(calls).some(arc => arc.args[2] > 45), 'recovery never leaves an apparently damaging sector');
    assert.ok(!texts(calls).some(text => text.startsWith('STRIKE')));
    assert.ok(texts(calls).includes('RECOVER'));
  }
}));

test('confirmed links appear only at legal engine frames and the third cut remains committed', () => withRenderer({}, (renderer, env) => {
  const state = fighting(); game.step(state, [input({ attack: true }), input({}, 1)]); advance(state, game.CHAIN.startFrame - 1);
  assert.ok(!texts(paint(renderer, env, state.fighters[0], state.tick)).includes('LINK / STEP'));
  advance(state, 1); assert.ok(texts(paint(renderer, env, state.fighters[0], state.tick)).includes('LINK / STEP'));
  game.step(state, [input({ attack: true }), input({}, 1)]);
  assert.equal(state.fighters[0].comboStep, 2); assert.ok(texts(paint(renderer, env, state.fighters[0], state.tick)).includes('CUT II'));
  advance(state, game.CHAIN.startFrame); game.step(state, [input({ attack: true }), input({}, 1)]);
  assert.equal(state.fighters[0].comboStep, 3); assert.ok(texts(paint(renderer, env, state.fighters[0], state.tick)).includes('CUT III'));
  advance(state, game.CHAIN.startFrame); const third = texts(paint(renderer, env, state.fighters[0], state.tick));
  assert.ok(third.includes('RECOVER')); assert.ok(!third.some(text => text.includes('LINK')));
  const missed = fighting({ bx: 800 }); game.step(missed, [input({ attack: true }), input({}, 1)]); advance(missed, game.CHAIN.startFrame);
  assert.ok(!texts(paint(renderer, env, missed.fighters[0], missed.tick)).some(text => text.includes('LINK')), 'a whiff offers no misleading link cue');
  state.fighters[0].hp = 0;
  assert.deepEqual(texts(paint(renderer, env, state.fighters[0], state.tick)), [], 'dead actors have no actionable labels');
  state.fighters[0].actionFrame = game.MOVES.light.startup;
  assert.ok(!arcs(paint(renderer, env, state.fighters[0], state.tick)).some(arc => arc.args[2] > 45), 'a dead actor never retains a damaging sector');
}));

test('early-heavy feint is readable before input and withdraws without a damage sector', () => withRenderer({}, (renderer, env) => {
  const state = fighting(); game.step(state, [input({ heavy: true }), input({}, 1)]);
  assert.ok(!texts(paint(renderer, env, state.fighters[0], state.tick)).includes('FEINT READY'));
  advance(state, game.FEINT.startFrame); assert.ok(texts(paint(renderer, env, state.fighters[0], state.tick)).includes('FEINT READY'));
  game.step(state, [input({ feint: true }), input({}, 1)]); assert.equal(state.fighters[0].action, 'feint');
  const before = structuredClone(state), calls = paint(renderer, env, state.fighters[0], state.tick);
  assert.ok(texts(calls).includes('FEINT')); assert.ok(!arcs(calls).some(arc => arc.args[2] > 45));
  assert.deepEqual(state, before); advance(state, game.FEINT.duration); assert.equal(state.fighters[1].hp, 100);
}));

test('perfect gate matches its precise cone and ends when the engine window ends', () => withRenderer({}, (renderer, env) => {
  const state = fighting({ bx: 800 }); game.step(state, [input({ parry: true }), input({}, 1)]);
  assert.ok(!texts(paint(renderer, env, state.fighters[0], state.tick)).includes('PERFECT'));
  advance(state, game.PARRY.startup);
  let calls = paint(renderer, env, state.fighters[0], state.tick);
  assert.ok(texts(calls).includes('PERFECT'));
  assert.ok(arcs(calls).some(arc => arc.args[2] === 27 && arc.args[3] === -game.PARRY.perfectCone && arc.args[4] === game.PARRY.perfectCone));
  advance(state, game.PARRY.perfectEnd - game.PARRY.startup + 1);
  calls = paint(renderer, env, state.fighters[0], state.tick); assert.ok(texts(calls).includes('PARRY'));
  assert.ok(!arcs(calls).some(arc => arc.args[2] === 27));
  advance(state, game.PARRY.activeEnd - game.PARRY.perfectEnd);
  calls = paint(renderer, env, state.fighters[0], state.tick); assert.ok(texts(calls).includes('OPEN'));
  assert.ok(!arcs(calls).some(arc => arc.lineWidth > 1 && arc.args[2] === 24));
}));

test('fast confirmed events use unique readable lanes, deduplicate, and clear on a new round', () => withRenderer({ width: 320, height: 213 }, (renderer, env) => {
  const state = fighting(); Object.assign(state.fighters[1], { x: 48, y: 48 });
  state.events = [
    { id: 100, tick: state.tick, type: 'hit', fighter: 0, target: 1, damage: 18, x: 60, y: 48 },
    { id: 101, tick: state.tick, type: 'parry', fighter: 1, target: 0, perfect: true, x: 60, y: 48 },
    { id: 102, tick: state.tick, type: 'deflect', fighter: 1, perfect: false, x: 60, y: 48 },
  ];
  renderer.observeEvents(state); assert.deepEqual(renderer.callouts.map(callout => callout.text), ['−18', 'PERFECT', 'DEFLECT']);
  assert.equal(new Set(renderer.callouts.map(callout => callout.y)).size, 3);
  for (const callout of renderer.callouts) { assert.ok(callout.x >= 48, 'labels stay inside the arena'); assert.ok(callout.y > 48, 'top-edge labels relocate below the actor'); }
  assert.ok(renderer.callouts.find(callout => callout.text === 'PERFECT').x > 48, 'a long edge label moves inward');
  renderer.observeEvents(state); assert.equal(renderer.callouts.length, 3); assert.equal(renderer.bursts.length, 3);
  renderer.paintEffects(renderer.ctx, .5); assert.equal(renderer.callouts.length, 0); assert.equal(renderer.bursts.length, 0);
  const oldEvents = [...state.events]; renderer.resetEffects(); state.events = oldEvents; renderer.observeEvents(state); assert.equal(renderer.callouts.length, 3);
  state.round++; state.events = []; renderer.observeEvents(state); assert.equal(renderer.callouts.length, 0); assert.equal(renderer.particles.length, 0);
}));

test('dash labels and trails respect actual invulnerability, and reduced motion removes moving trails', () => withRenderer({}, (renderer, env) => {
  const state = fighting({ bx: 800 }); game.step(state, [input({ dash: true, right: true }), input({}, 1)]);
  renderer.render(state, { time: 0 }); assert.equal(renderer.ghosts.length, 0);
  advance(state, game.DASH.startup); renderer.render(state, { time: 25 });
  assert.ok(texts(paint(renderer, env, state.fighters[0], state.tick)).includes('EVADE')); assert.equal(renderer.ghosts.length, 1);
  env.changeReducedMotion(true); assert.equal(renderer.ghosts.length, 0); assert.equal(renderer.particles.length, 0);
  advance(state, 3); renderer.render(state, { time: 50 }); assert.equal(renderer.ghosts.length, 0);
  advance(state, game.DASH.invulnerableEnd - state.fighters[0].actionFrame + 1);
  assert.ok(texts(paint(renderer, env, state.fighters[0], state.tick)).includes('DASH'));
}));

test('warm rendering retains fractional actors, bounded assets, and no per-frame layout reads', () => withRenderer({}, (renderer, env) => {
  const state = fighting({ bx: 800 });
  for (const id of [0, 1]) for (const pose of ['ready', 'windup', 'strike', 'recover', 'guard', 'throw', 'stun', 'feint']) for (const stride of [-1, 0, 1]) renderer.sprite(id, stride, pose);
  for (const stage of Object.values(game.STAGES)) renderer.scene(stage.id, stage.covers);
  const assets = env.assets, layouts = env.layouts, original = structuredClone(state);
  for (let n = 0; n < 240; n++) {
    state.stageId = ['rooftop', 'garden', 'shrine'][n % 3]; state.obstacles = game.STAGES[state.stageId].covers;
    state.fighters[0].x = 154 + n * .125; state.fighters[0].y = 320 + n * .0375;
    const before = structuredClone(state); env.calls.length = 0; renderer.render(state, { time: n * 1000 / 240, localId: 0 });
    assert.deepEqual(state, before, 'rendering never mutates authoritative state');
    assert.ok(env.calls.some(call => call.op === 'translate' && call.args[0] === state.fighters[0].x && call.args[1] === state.fighters[0].y), 'sprite is anchored to its fractional collision position');
  }
  assert.equal(env.assets, assets); assert.equal(env.layouts, layouts); assert.equal(renderer.scenes.size, 3);
  assert.equal(state.fighters[1].hp, original.fighters[1].hp);
}));

test('small arenas omit redundant tiny resource text while preserving the local ring and aim reticle', () => {
  for (const width of [960, 700, 390, 320]) withRenderer({ width, height: width * 2 / 3 }, (renderer, env) => {
    const state = fighting({ bx: 800 }), aimTarget = { x: 623.25, y: 245.75 };
    renderer.render(state, { localId: 0, time: 0, aimTarget }); env.calls.length = 0;
    renderer.render(state, { localId: 0, time: 5, aimTarget });
    const labels = texts(env.calls), compact = width < 960 / 1.35;
    for (const label of ['KUNAI', 'STAMINA', 'PARRY']) assert.equal(labels.includes(label), !compact, `${width}px resource strip visibility`);
    assert.equal(env.calls.some(call => call.op === 'fillRect' && call.args[0] === 294 && call.args[1] === 608 && call.args[2] === 372 && call.args[3] === 32), !compact, 'no unreadable resource tile remains');
    assert.ok(arcs(env.calls).some(arc => arc.args[0] === state.fighters[0].x && arc.args[1] === state.fighters[0].y && arc.args[2] === state.fighters[0].radius), 'local selection ring remains');
    assert.ok(env.calls.some(call => call.op === 'fill' && call.path.some(path => path[0] === 'arc' && path[1] === aimTarget.x && path[2] === aimTarget.y && path[3] === 1)), 'mouse aim point remains precise');
    env.calls.length = 0; renderer.render(state, { time: 10 });
    assert.equal(texts(env.calls).some(text => text.startsWith('READ THE BLADE')), !compact, 'spectator hint follows the same readability boundary');
  });
});

test('four real practice opponents have distinct identities, living depth order, and truthful overhead resources', () => withRenderer({}, (renderer, env) => {
  const state = practicing(); state.obstacles = [];
  const positions = [[154.25, 340.125], [500, 410], [670.375, 130.25], [760.5, 490.75], [805.125, 240.875]];
  for (const fighter of state.fighters) Object.assign(fighter, { x: positions[fighter.id][0], y: positions[fighter.id][1], action: 'run' });
  Object.assign(state.fighters[1], { hp: 0, action: 'dash', invulnerable: true });
  Object.assign(state.fighters[3], { hp: 40, stamina: 23 });
  const before = structuredClone(state), order = [], original = renderer.paintFighter.bind(renderer);
  renderer.paintFighter = (...args) => { order.push(args[1].id); return original(...args); };
  const players = [{ name: 'Camille' }, { name: 'Shinobi 1' }, { name: 'Shinobi 2' }, { name: 'Shinobi 3' }, { name: 'Shinobi 4' }];
  renderer.render(state, { localId: 0, players, time: 0 });
  assert.deepEqual(order, [2, 4, 0, 3], 'the reused practice draw list orders every living actor by depth');
  const labels = texts(env.calls);
  for (const name of ['CAMILLE', 'SHINOBI 2', 'SHINOBI 3', 'SHINOBI 4']) assert.ok(labels.includes(name));
  assert.ok(!labels.includes('SHINOBI 1'), 'an eliminated opponent keeps no live identity');
  assert.ok(![...renderer.sprites.keys()].some(key => key.startsWith('1:')), 'an eliminated actor is never rendered as an active body');
  assert.equal(env.calls.filter(call => call.op === 'fillRect' && call.args[2] === 36 && call.args[3] === 9).length, 4, 'each living actor retains the existing compact HP/stamina track');
  assert.ok(env.calls.some(call => call.op === 'fillRect' && call.args[0] === state.fighters[3].x - 17 && call.args[1] === state.fighters[3].y - 28 && call.args[2] === 34 * .4), 'HP uses that opponent’s actual health');
  assert.ok(env.calls.some(call => call.op === 'fillRect' && call.args[0] === state.fighters[3].x - 17 && call.args[1] === state.fighters[3].y - 23 && call.args[2] === 34 * .23), 'stamina uses that opponent’s actual resource');
  assert.equal(new Set(Array.from({ length: 5 }, (_, id) => renderer.sprite(id))).size, 5, 'all five identities have separate cached pixel assets');
  const identityColors = new Set(env.calls.filter(call => call.op === 'fillText' && ['CAMILLE', 'SHINOBI 2', 'SHINOBI 3', 'SHINOBI 4'].includes(call.args[0])).map(call => call.color));
  assert.equal(identityColors.size, 4, 'numbered names match distinct sash colors');
  assert.deepEqual(state, before, 'rendering cannot mutate the actual practice engine');
}));

test('practice dash ghosts and hit flashes work for the fourth opponent and remain bounded', () => withRenderer({}, (renderer, env) => {
  const state = practicing(); state.obstacles = [];
  game.step(state, state.fighters.map(fighter => input({ dash: true, left: fighter.id > 0, right: fighter.id === 0 }, fighter.id)));
  for (let i = 0; i < game.DASH.startup; i++) game.step(state, state.fighters.map(fighter => input({}, fighter.id)));
  renderer.render(state, { time: 0 });
  assert.deepEqual(new Set(renderer.ghosts.map(ghost => ghost.id)), new Set([0, 1, 2, 3, 4]));
  assert.equal(renderer.lastGhost[4], state.tick, 'a fourth opponent gets its own real dash cadence');
  state.events = Array.from({ length: 48 }, (_, index) => ({ id: 1000 + index, tick: state.tick, type: 'hit', fighter: index % 5, target: 4, damage: 18, x: state.fighters[4].x, y: state.fighters[4].y }));
  renderer.observeEvents(state);
  assert.equal(renderer.hitFlash[4], .13); assert.equal(renderer.hitFlash.length, 5);
  assert.ok(renderer.particles.length <= 96); assert.ok(renderer.bursts.length <= 20); assert.ok(renderer.callouts.length <= 6);
  const count = renderer.bursts.length; renderer.observeEvents(state); assert.equal(renderer.bursts.length, count, 'confirmed events still deduplicate');
  state.fighters[4].hp = 0; renderer.render(state, { time: 5 });
  assert.ok(!renderer.ghosts.some(ghost => ghost.id === 4), 'a defeated opponent cannot leave a living dash silhouette');
  env.changeReducedMotion(true); assert.equal(renderer.particles.length, 0); assert.equal(renderer.ghosts.length, 0);
}));

test('practice shows one round-seal pair per side instead of overlapping every bot’s score', () => withRenderer({}, (renderer, env) => {
  const state = practicing(); state.fighters[0].hp = 0;
  game.step(state, state.fighters.map(fighter => input({}, fighter.id)));
  assert.equal(state.winnerTeam, 1); assert.ok(state.fighters.slice(1).every(fighter => fighter.wins === 1));
  renderer.render(state, { time: 0 }); env.calls.length = 0;
  renderer.render(state, { time: 5 });
  const seals = env.calls.filter(call => call.op === 'fill' && call.path.length === 4 && call.path[0][0] === 'moveTo' && call.path[0][2] === 12 && [331, 344, 616, 629].includes(call.path[0][1]));
  assert.equal(seals.length, 4, 'two human seals and two team seals remain the complete round display');
  assert.equal(seals.filter(call => call.color !== '#6a818144').length, 1);
  assert.equal(renderer.sprites.size, 4, 'only the four living bot assets are requested while the human is eliminated');
  assert.ok(![...renderer.sprites.keys()].some(key => key.startsWith('0:')));
  assert.ok(!arcs(env.calls).some(arc => arc.args[0] === state.fighters[0].x && arc.args[1] === state.fighters[0].y && arc.args[2] === state.fighters[0].radius), 'eliminated human has no live selection ring');
}));

test('warm five-actor practice preserves animation, fractional positions, and finite sprite and effect caches', () => withRenderer({}, (renderer, env) => {
  const state = practicing();
  for (const id of [0, 1, 2, 3, 4]) for (const pose of ['ready', 'windup', 'strike', 'recover', 'guard', 'throw', 'stun', 'feint']) for (const stride of [-1, 0, 1]) renderer.sprite(id, stride, pose);
  for (const stage of Object.values(game.STAGES)) renderer.scene(stage.id, stage.covers);
  const assets = env.assets, layouts = env.layouts, drawList = renderer.fighterOrder;
  for (let n = 0; n < 120; n++) {
    state.stageId = ['rooftop', 'garden', 'shrine'][n % 3]; state.obstacles = game.STAGES[state.stageId].covers;
    for (const fighter of state.fighters) Object.assign(fighter, { action: 'run', x: 100 + fighter.id * 160 + n * .125, y: 120 + fighter.id * 80 + n * .0375 });
    state.tick = n; const before = structuredClone(state); env.calls.length = 0;
    renderer.render(state, { localId: 0, time: n * 1000 / 240 });
    assert.equal(renderer.fighterOrder, drawList, 'practice does not allocate a new scene list each frame');
    for (const fighter of state.fighters) assert.ok(env.calls.some(call => call.op === 'translate' && call.args[0] === fighter.x && call.args[1] === fighter.y), 'every actor keeps its fractional authoritative position');
    assert.deepEqual(state, before);
  }
  assert.equal(renderer.sprites.size, 120); assert.equal(env.assets, assets); assert.equal(env.layouts, layouts); assert.equal(renderer.scenes.size, 3);
  const lastReady = renderer.sprite(4, 0, 'ready');
  for (let id = 5; id < 30; id++) renderer.sprite(id, id, `unrecognized-${id}`);
  assert.equal(renderer.sprites.size, 120, 'invalid identity, pose, and stride cannot create an unbounded sprite cache');
  assert.equal(renderer.sprite(4, 0, 'ready'), lastReady);
}));

test('portrait practice names stay short and separate from bottom-edge action cues', () => withRenderer({ width: 320, height: 213 }, (renderer, env) => {
  const state = practicing(); state.obstacles = [];
  Object.assign(state.fighters[4], { x: game.WORLD.maxX, y: game.WORLD.maxY, action: 'parry', actionFrame: game.PARRY.startup });
  renderer.render(state, { time: 0, players: [null, null, null, null, { name: 'An exceptionally long fourth opponent name' }] });
  const name = env.calls.find(call => call.op === 'fillText' && call.args[0].startsWith('4 AN EXCEP'));
  assert.ok(name); assert.equal(name.args[0].length, 12); assert.ok(name.args[0].endsWith('…'));
  assert.ok(name.args[1] < game.WORLD.maxX, 'the truncated edge name shifts inward');
  const action = env.calls.find(call => call.op === 'fillText' && call.args[0] === 'PERFECT');
  assert.ok(action); assert.ok(Math.abs(name.args[2] - action.args[2]) > 8 * renderer.uiScale, 'the identity and actual parry window use separate readable lanes');
}));
