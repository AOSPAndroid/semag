import assert from 'node:assert/strict';
import test from 'node:test';
import { capturePlanarPose, presentPlanarFighter, retainAdjacentPlanarPose, rebasePlanarCorrection, presentPlanarEntities } from '../public/planar-presentation.js';
import { tickFraction, frameDecay } from '../public/display-timing.js';
import * as afterimage from '../public/engine.js';
import * as topdown from '../public/topdown-engine.js';
import * as vector from '../public/vector-engine.js';
import * as shinobi from '../public/shinobi-engine.js';
import * as brawl from '../public/brawl-engine.js';
import { BrawlRenderer } from '../public/brawl-renderer.js';

const clone = state => structuredClone(state);
function start(engine) {
  const state = engine.createState();
  if (engine === brawl) { engine.select(state, 0, { character: 'wrench', stage: 'rooftop' }); engine.select(state, 1, { character: 'moth' }); }
  engine.startMatch(state); state.phase = 'fight';
  if (engine === vector) { Object.assign(state.fighters[0], { x: 100, y: 100 }); Object.assign(state.fighters[1], { x: 800, y: 500 }); }
  return state;
}

// Interleave real fixed-step engines with zero-error snapshots between RAFs.
// A snapshot may fully acknowledge prediction, leaving no inputs to replay.
function snapshotCadence(engine, hz, packets, retain = true) {
  let state = start(engine), previous = null, accumulator = 0, last = 0;
  let arrival = 1000 / 60 + 2, correction = { x: 0, y: 0 };
  const positions = [], inputs = [{ ...engine.emptyInput(), right: true }, engine.emptyInput()];
  for (let n = 1; n <= hz / 2; n++) {
    const now = n * 1000 / hz + 1e-8;
    while (packets && arrival < now) {
      const fraction = tickFraction((accumulator + arrival - last) / 1000);
      const oldPose = capturePlanarPose(state), oldPrevious = previous;
      const oldPresented = presentPlanarFighter(state, previous, 0, fraction);
      state = clone(state); previous = null;
      if (retain) previous = retainAdjacentPlanarPose(state, previous, oldPrevious, oldPose);
      const nextPresented = presentPlanarFighter(state, previous, 0, fraction);
      correction = rebasePlanarCorrection(state, oldPose, 0, oldPresented, nextPresented, correction);
      arrival += 1000 / 60;
    }
    accumulator += now - last; last = now;
    while (accumulator >= 1000 / 120) {
      previous = capturePlanarPose(state); engine.step(state, inputs); accumulator -= 1000 / 120;
    }
    const shown = presentPlanarFighter(state, previous, 0, tickFraction(accumulator / 1000));
    positions.push(shown.x + correction.x);
    const decay = frameDecay(.72, 1000 / hz); correction.x *= decay; correction.y *= decay;
  }
  return { state, positions };
}

test('fully acknowledged snapshots preserve uninterrupted real-engine movement at 60, 120, 144 and 240 Hz', () => {
  for (const engine of [afterimage, topdown, vector, shinobi, brawl]) for (const hz of [60, 120, 144, 240]) {
    const uninterrupted = snapshotCadence(engine, hz, false), network = snapshotCadence(engine, hz, true);
    assert.deepEqual(network.state, uninterrupted.state, `${engine.createState().gameId || 'afterimage'} ${hz} Hz gameplay is unchanged`);
    assert.deepEqual(network.positions, uninterrupted.positions, `${hz} Hz snapshots cannot alter zero-error display motion`);
  }
  const smooth = snapshotCadence(vector, 240, true).positions.slice(25);
  assert.ok(smooth.every((x, index) => !index || x > smooth[index - 1]), 'steady movement advances on every high-refresh frame');
  const before = snapshotCadence(vector, 240, true, false).positions.slice(25);
  assert.notDeepEqual(before, smooth, 'the old clear-on-snapshot behavior reproduces visible corrections despite zero prediction error');
});

test('prediction clock changes rebase from the interpolated pose while keeping newest combat metadata', () => {
  const state = start(vector), inputs = [{ ...vector.emptyInput(), right: true }, vector.emptyInput()];
  let previous;
  for (let n = 0; n < 12; n++) { previous = capturePlanarPose(state); vector.step(state, inputs); }
  const oldPose = capturePlanarPose(state), oldPresented = presentPlanarFighter(state, previous, 0, .4);
  const next = clone(state); vector.step(next, [{ ...vector.emptyInput(), left: true }, vector.emptyInput()]);
  const retained = retainAdjacentPlanarPose(next, previous, oldPose);
  assert.equal(retained, oldPose, 'a real endpoint may become the adjacent tick after a clock advance');
  const nextPresented = presentPlanarFighter(next, retained, 0, .4), offset = { x: 3, y: -2 };
  const correction = rebasePlanarCorrection(next, oldPose, 0, oldPresented, nextPresented, offset);
  assert.ok(Math.abs(nextPresented.x + correction.x - oldPresented.x - offset.x) < 1e-9);
  assert.ok(Math.abs(nextPresented.y + correction.y - oldPresented.y - offset.y) < 1e-9);
  assert.equal(nextPresented.action, next.fighters[0].action); assert.equal(nextPresented.hp, next.fighters[0].hp);
  const endpointCorrection = state.fighters[0].x + offset.x - next.fighters[0].x;
  assert.ok(Math.abs(endpointCorrection - correction.x) > .1, 'a velocity change exposes the old endpoint-based anchor error');
});

test('history and correction stop at world, life, identity, stale clock and teleport discontinuities', () => {
  const state = start(vector); vector.step(state, [vector.emptyInput(), vector.emptyInput()]);
  const endpoint = capturePlanarPose(state), old = { ...state.fighters[0] };
  for (const change of [
    next => next.round++, next => { next.wave = 9; }, next => { next.stageId = 'elsewhere'; },
    next => { next.phase = 'roundEnd'; }, next => next.tick--,
    next => { next.fighters[0].id = 99; }, next => { next.fighters[0].hp = 0; },
    next => { next.fighters[0].respawnTicks = 90; }, next => { next.fighters[0].stocks = 1; },
    next => { next.fighters[0].x += 200; },
  ]) {
    const next = clone(state); change(next);
    assert.deepEqual(rebasePlanarCorrection(next, endpoint, 0, old, next.fighters[0], { x: 20, y: 10 }), { x: 0, y: 0 });
  }
  for (const patch of [{ phase: 'countdown' }, { round: 8 }, { tick: endpoint.tick + 2 }]) {
    assert.equal(retainAdjacentPlanarPose({ ...state, ...patch }, endpoint), null);
  }
  const next = clone(state); next.tick++;
  const original = clone({ state: next, endpoint });
  const offset = rebasePlanarCorrection(next, endpoint, 0, { ...old, x: old.x + 60, y: old.y - 60 }, old, {}, { maxX: 45, maxY: 35 });
  assert.deepEqual(offset, { x: 45, y: -35 });
  assert.deepEqual({ state: next, endpoint }, original);
});

test('actual Vector shots and Dungeon creatures acquire extra XY poses while combat and lifecycle fields stay immediate', () => {
  const state = start(vector), inputs = [{ ...vector.emptyInput(), fire: true, aimX: 1, aimY: 0 }, vector.emptyInput()];
  vector.step(state, inputs); const previous = capturePlanarPose(state); vector.step(state, inputs);
  assert.equal(state.projectiles.length, 1);
  const original = clone({ state, previous });
  const quarter = presentPlanarEntities(state, previous, .25).projectiles[0], threeQuarter = presentPlanarEntities(state, previous, .75).projectiles[0];
  assert.ok(quarter.x < threeQuarter.x); assert.ok(threeQuarter.x < state.projectiles[0].x);
  assert.equal(quarter.life, state.projectiles[0].life); assert.equal(quarter.damage, state.projectiles[0].damage);
  assert.equal(quarter.px, state.projectiles[0].px);
  assert.deepEqual({ state, previous }, original);
  const dungeon = topdown.createState('coop'); topdown.startMatch(dungeon);
  for (let tick = 0; tick < 400 && dungeon.phase === 'countdown'; tick++) topdown.step(dungeon, [topdown.emptyInput(), topdown.emptyInput()]);
  assert.equal(dungeon.phase, 'fight');
  const before = capturePlanarPose(dungeon); topdown.step(dungeon, [topdown.emptyInput(), topdown.emptyInput()]);
  assert.ok(dungeon.enemies.length > 0);
  const shown = presentPlanarEntities(dungeon, before, .5).enemies;
  assert.ok(shown.some((enemy, i) => enemy.x !== dungeon.enemies[i].x || enemy.y !== dungeon.enemies[i].y), 'real creatures interpolate their fixed-step movement');
  for (let i = 0; i < shown.length; i++) { assert.equal(shown[i].hp, dungeon.enemies[i].hp); assert.equal(shown[i].actionFrame, dungeon.enemies[i].actionFrame); }
});

test('projectile reflections, returning weapons, deaths, births, removals and reused IDs never blend obsolete poses', () => {
  const state = start(shinobi); state.tick = 10;
  state.projectiles = [{ id: 1, kind: 'kunai', owner: 0, team: 'a', x: 100, y: 100, life: 90, bornTick: 3, reflections: 0, returning: false }];
  state.enemies = [{ id: 100, type: 'slime', variant: 'garden', x: 100, y: 100, hp: 20 }];
  const before = capturePlanarPose(state); state.tick++;
  state.projectiles[0].x += 10; state.enemies[0].x += 2;
  for (const patch of [{ owner: 1 }, { team: 'b' }, { bornTick: 11 }, { reflections: 1 }, { reflected: true }, { returning: true }, { kind: 'arrow' }, { id: 2 }, { life: 0 }, { x: 300 }]) {
    const next = clone(state); Object.assign(next.projectiles[0], patch);
    assert.deepEqual(presentPlanarEntities(next, before, .5).projectiles[0], next.projectiles[0]);
  }
  for (const patch of [{ id: 101 }, { type: 'bat' }, { variant: 'crypt' }, { hp: 0 }, { downed: true }]) {
    const next = clone(state); Object.assign(next.enemies[0], patch);
    assert.deepEqual(presentPlanarEntities(next, before, .5).enemies[0], next.enemies[0]);
  }
  const removed = clone(state); removed.projectiles = []; removed.enemies = [];
  assert.deepEqual(presentPlanarEntities(removed, before, .5), { projectiles: [], enemies: [] });
  const born = clone(state); born.projectiles.push({ ...born.projectiles[0], id: 2 });
  assert.deepEqual(presentPlanarEntities(born, before, .5).projectiles[1], born.projectiles[1]);
  const duplicate = clone(state); duplicate.projectiles.push({ ...duplicate.projectiles[0], x: 140 });
  assert.deepEqual(presentPlanarEntities(duplicate, before, .5).projectiles, duplicate.projectiles);
  for (const patch of [{ round: 9 }, { stageId: 'shrine' }, { tick: 13 }, { phase: 'roundEnd' }]) {
    const next = { ...state, ...patch };
    assert.deepEqual(presentPlanarEntities(next, before, .5), { projectiles: next.projectiles, enemies: next.enemies });
  }
});

test('the real Brawl renderer keeps fractional fighter, trail and projectile anchors', () => {
  const calls = [];
  const ctx = new Proxy({ measureText: () => ({ width: 15 }) }, { get(target, key) { return target[key] ?? ((...args) => { if (key === 'translate') calls.push(args); }); } });
  const renderer = Object.create(BrawlRenderer.prototype);
  Object.assign(renderer, { ctx, canvas: { width: 1200, height: 720 }, motion: { matches: false }, backgrounds: new Map(), sprite: () => ({}) });
  renderer.resetEffects();
  const state = start(brawl); Object.assign(state.fighters[0], { x: 410.125, y: 504.375, action: 'dodge' });
  state.projectiles = [{ id: 1, kind: 'leaf', x: 550.375, y: 450.625, vx: 1, vy: 0 }];
  renderer.render(state, { time: 1000 });
  assert.ok(calls.some(args => args[0] === 410.125 && args[1] === 504.375));
  assert.ok(calls.some(args => args[0] === 550.375 && args[1] === 450.625));
  calls.length = 0; state.fighters[0].x += .25; renderer.render(state, { time: 1010 });
  assert.ok(calls.some(args => args[0] === 410.125 && args[1] === 504.375), 'afterimages use their original fractional anchor');
  assert.ok(calls.some(args => args[0] === 410.375 && args[1] === 504.375), 'the live sprite advances by a subpixel');
});
