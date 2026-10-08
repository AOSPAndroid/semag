import assert from 'node:assert/strict';
import test from 'node:test';
import { capturePlanarPose, presentPlanarFighter } from '../public/planar-presentation.js';
import { frameDecay, tickFraction } from '../public/display-timing.js';
import * as afterimage from '../public/engine.js';
import * as relic from '../public/topdown-engine.js';
import * as vector from '../public/vector-engine.js';
import * as shinobi from '../public/shinobi-engine.js';
import * as brawl from '../public/brawl-engine.js';
import { BrawlRenderer } from '../public/brawl-renderer.js';

function posePair() {
  const state = afterimage.createState(); state.phase = 'fight'; state.tick = 10;
  Object.assign(state.fighters[0], { x: 100, y: 100 });
  const before = capturePlanarPose(state);
  Object.assign(state.fighters[0], { x: 108, y: 104, hp: 73, action: 'heavy', actionFrame: 0 });
  state.tick++;
  return { state, before };
}

test('between-tick planar poses retain immediate combat feedback and immutable simulation', () => {
  const { state, before } = posePair(), original = JSON.stringify(state), sample = JSON.stringify(before);
  const shown = presentPlanarFighter(state, before, 0, .5);
  assert.equal(shown.x, 104); assert.equal(shown.y, 102);
  assert.equal(shown.hp, 73); assert.equal(shown.action, 'heavy'); assert.equal(shown.actionFrame, 0);
  shown.x = 900;
  assert.equal(JSON.stringify(state), original); assert.equal(JSON.stringify(before), sample);
});

test('render interpolation snaps on match, world, life, identity and teleport discontinuities', () => {
  for (const change of [
    state => { state.phase = 'countdown'; }, state => { state.round++; },
    state => { state.wave = 2; }, state => { state.stageId = 'new'; },
    state => { state.tick += 2; }, state => { state.tick = 0; },
    state => { state.fighters[0].hp = 0; }, state => { state.fighters[0].downed = true; },
    state => { state.fighters[0].id = 4; }, state => { state.fighters[0].characterId = 'zap'; },
    state => { state.fighters[0].selected = true; }, state => { state.fighters[0].stocks = 2; },
    state => { state.fighters[0].respawnTicks = 120; }, state => { state.fighters[0].x += 300; },
  ]) {
    const { state, before } = posePair(); change(state);
    assert.deepEqual(presentPlanarFighter(state, before, 0, .5), state.fighters[0]);
  }
  const { state } = posePair();
  assert.deepEqual(presentPlanarFighter(state, null, 0, .5), state.fighters[0]);
});

test('snapshot opponents blend across real network tick gaps and reset across respawns', () => {
  const { state, before } = posePair(); state.tick += 2;
  assert.equal(presentPlanarFighter(state, before, 0, .5, { adjacentTick: false }).x, 104);
  for (const change of [
    state => { state.round++; }, state => { state.stageId = 'next'; },
    state => { state.fighters[0].stocks = 2; }, state => { state.fighters[0].respawnTicks = 60; },
    state => { state.fighters[0].hp = 0; }, state => { state.fighters[0].x += 300; },
  ]) {
    const next = structuredClone(state); change(next);
    assert.deepEqual(presentPlanarFighter(next, before, 0, .5, { adjacentTick: false }), next.fighters[0]);
  }
});

function runCadence(engine, refresh) {
  const state = engine.createState();
  if (engine === brawl) {
    engine.select(state, 0, { character: 'wrench', stage: 'rooftop' });
    engine.select(state, 1, { character: 'moth' });
  }
  engine.startMatch(state); state.phase = 'fight';
  let accumulator = 0, previousTime = 0, previous = null;
  const positions = [], inputs = [{ ...engine.emptyInput(), right: true }, engine.emptyInput()];
  // The tiny timestamp offset avoids rounding a final exact tick below zero;
  // it is constant across every display cadence and never reaches simulation.
  for (let frame = 1; frame <= refresh / 4; frame++) {
    const time = frame * 1000 / refresh + 1e-6;
    accumulator += time - previousTime; previousTime = time;
    while (accumulator >= 1000 / 120) {
      previous = capturePlanarPose(state); engine.step(state, inputs); accumulator -= 1000 / 120;
    }
    const shown = presentPlanarFighter(state, previous, 0, tickFraction(accumulator / 1000));
    positions.push(shown.x);
    assert.ok(shown.x >= Math.min(state.fighters[0].x, previous?.fighters[0].x ?? state.fighters[0].x) - 1e-9);
    assert.ok(shown.x <= Math.max(state.fighters[0].x, previous?.fighters[0].x ?? state.fighters[0].x) + 1e-9);
  }
  return { state, positions };
}

test('144 and 240 Hz planar rendering produces additional poses without changing any 120 Hz combat outcome', () => {
  for (const engine of [afterimage, relic, vector, shinobi, brawl]) {
    const baseline = runCadence(engine, 60);
    assert.equal(baseline.state.tick, 30);
    for (const refresh of [120, 144, 240]) {
      const result = runCadence(engine, refresh);
      assert.deepEqual(result.state, baseline.state);
      assert.equal(new Set(result.positions).size, result.positions.length, `${refresh} Hz produces a distinct moving pose on every frame`);
    }
  }
});

test('prediction correction retains the same settling time at 60, 120, 144 and 240 Hz', () => {
  const expected = 45 * Math.pow(.72, 15);
  for (const refresh of [60, 120, 144, 240]) {
    let offset = 45;
    for (let frame = 0; frame < refresh / 4; frame++) offset *= frameDecay(.72, 1000 / refresh);
    assert.ok(Math.abs(offset - expected) < 1e-10);
  }
});

function zoomAfter(refresh) {
  const renderer = Object.create(BrawlRenderer.prototype);
  const ctx = new Proxy({ measureText: () => ({ width: 60 }) }, { get(target, key) { return target[key] ?? (() => {}); } });
  Object.assign(renderer, { ctx, canvas: { width: 1200, height: 720 }, motion: { matches: false }, backgrounds: new Map() });
  renderer.resetEffects(); renderer.lastTime = 1000;
  const state = brawl.createState(); state.phase = 'fight'; state.fighters[0].x = 1400;
  for (let frame = 1; frame <= refresh / 4; frame++) renderer.render(state, { time: 1000 + frame * 1000 / refresh });
  return renderer.zoom;
}

test('brawler camera framing settles identically across 60 through 240 Hz actual renderer calls', () => {
  const expected = zoomAfter(60);
  for (const refresh of [120, 144, 240]) assert.ok(Math.abs(zoomAfter(refresh) - expected) < 1e-12);
});
