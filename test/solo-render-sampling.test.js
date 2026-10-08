import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderSampling } from '../public/solo/render-sampling.js';
import { tickFraction } from '../public/display-timing.js';
import * as circuit from '../public/solo/circuit-engine.js';
import * as highway from '../public/solo/highway-engine.js';
import * as paris from '../public/solo/paris-engine.js';
import * as ember from '../public/solo/ember-engine.js';
import * as rift from '../public/solo/rift-engine.js';
import * as starfall from '../public/solo/starfall-engine.js';
import * as shadow from '../public/solo/shadow-engine.js';
import * as skyline from '../public/solo/skyline-engine.js';

const clone = value => JSON.parse(JSON.stringify(value));
const random = () => { let seed = 731; return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); };
const sampler = () => createRenderSampling({ fields: ['elapsed'], objects: { player: { fields: ['x', 'y'], angles: ['facing'], maxDistance: 24 } }, collections: { shots: { fields: ['x', 'y'], velocityGuard: true, guards: ['bounces'] } }, continuity: s => s.level });
const fixture = () => ({ phase: 'playing', elapsed: 0, level: 0, score: 12, player: { x: 2, y: 10, hp: 3, facing: Math.PI - .1, attackTime: 0 }, shots: [{ id: 1, x: 0, y: 5, vx: 100, vy: 0, bounces: 1 }] });

test('240 Hz presents four distinct poses between 60 Hz collision steps without moving physics', () => {
  const state = fixture(), display = sampler();
  display.capture(state);
  state.elapsed = 1 / 60; state.player.x = 6; state.player.hp = 2; state.player.attackTime = .2;
  const authoritative = clone(state), values = [];
  for (const fraction of [0, .25, .5, .75]) {
    const frame = display.sample(state, fraction);
    values.push(frame.player.x);
    assert.equal(frame.player.hp, 2);
    assert.equal(frame.player.attackTime, .2, 'action starts and cancels remain immediate');
    assert.equal(frame.score, 12);
  }
  assert.deepEqual(values, [2, 3, 4, 5]);
  assert.deepEqual(state, authoritative, 'drawing never changes collision poses or clocks');
  assert.equal(display.getStats().physicsSamples, 1);
  assert.equal(display.getStats().interpolatedSamples, 4);
});

test('render samples reuse bounded scratch bodies and lists without aliasing simulation', () => {
  const state = fixture(), display = sampler(); display.capture(state);
  state.player.x = 6; state.shots[0].x = 8;
  const frame = display.sample(state, .25), player = frame.player, shots = frame.shots, shot = shots[0];
  assert.notEqual(frame, state); assert.notEqual(player, state.player); assert.notEqual(shots, state.shots); assert.notEqual(shot, state.shots[0]);
  const next = display.sample(state, .75);
  assert.equal(next, frame); assert.equal(next.player, player); assert.equal(next.shots, shots); assert.equal(next.shots[0], shot);
  assert.equal(next.player.x, 5); assert.equal(state.player.x, 6);
});

test('angle interpolation follows the short path across the turn boundary', () => {
  const state = fixture(), display = sampler(); display.capture(state);
  state.player.facing = -Math.PI + .1;
  assert.ok(Math.abs(display.sample(state, .5).player.facing - Math.PI) < 1e-12);
});

test('new spawns, removed shots and no-ID projectiles retain current membership and identity', () => {
  const state = fixture(), display = sampler(), unnumbered = { x: 3, y: 4, vx: 10, vy: 0 };
  state.shots.push(unnumbered); display.capture(state);
  state.shots.shift(); unnumbered.x = 7; state.shots.push({ id: 2, x: 12, y: 5, vx: 100, vy: 0 });
  const frame = display.sample(state, .5);
  assert.equal(frame.shots.length, 2);
  assert.equal(frame.shots[0].x, 5);
  assert.equal(frame.shots[1], state.shots[1], 'fresh spawn is visible immediately');
  assert.deepEqual(state.shots.map(s => s.x), [7, 12]);
});

test('ricochets and action phase changes snap to valid completed collision poses', () => {
  const state = fixture(), display = sampler(); display.capture(state);
  state.shots[0].x = 8; state.shots[0].vx = -100; state.shots[0].bounces = 0;
  assert.equal(display.sample(state, .25).shots[0], state.shots[0]);
  display.capture(state); state.player.phase = 'dash'; state.player.x = 12;
  assert.equal(display.sample(state, .25).player, state.player);
});

test('pause, reset, new lives, map transitions and teleports never blend stale poses', () => {
  const state = fixture(), display = sampler(); display.capture(state); state.player.x = 6;
  state.phase = 'paused'; assert.equal(display.sample(state, .5), state);
  state.phase = 'playing'; display.reset(); assert.equal(display.sample(state, .5), state);
  display.capture(state); state.level++; assert.equal(display.sample(state, .5), state);
  display.capture(state); state.player.x += 100; assert.equal(display.sample(state, .5).player, state.player);
  display.capture(state); state.player = { ...state.player, x: 2 }; assert.equal(display.sample(state, .5).player, state.player);
  assert.equal(display.sample(clone(state), .5).player.x, 2);
  const stats = display.getStats(); stats.physicsSamples = 0; assert.ok(display.getStats().physicsSamples > 0);
});

const games = [
  ['Circuit', circuit, () => circuit.createState({ difficulty: 'veteran' }), { throttle: true }],
  ['Night Drive', highway, () => highway.createState({ difficulty: 'veteran', random: random() }), { throttle: true }],
  ['Paris Pedal', paris, () => paris.createState({ difficulty: 'veteran', seed: 1729 }), { throttle: true }],
  ['Ember Delve', ember, () => ember.createState({ difficulty: 'veteran', seed: 1729 }), { right: true, melee: true, aimX: 1, aimY: 0 }],
  ['Rift Survivor', rift, () => rift.createState({ difficulty: 'veteran', random: random() }), { right: true, fire: true, aimX: 1, aimY: 0 }],
  ['Starfall', starfall, () => starfall.createState({ seed: 1729 }), { fire: true, up: true }],
  ['Shadow', shadow, () => shadow.createState(), { right: true, sneak: true }],
  ['Skyline', skyline, () => skyline.createState(), { right: true, jump: true }],
];

for (const [name, engine, createState, controls] of games) test(`${name}: 60/120/144/240 Hz render schedules preserve the same physics, damage, RNG and challenge clocks`, () => {
  function run(hz) {
    const state = createState(), step = engine.FIXED_STEP || engine.FIXED_DT || 1 / 120;
    const display = createRenderSampling({ fields: ['elapsed', 'time', 'distance', 'x'], objects: { player: { fields: ['x', 'y'] }, car: { fields: ['x', 'y'], angles: ['heading'] } }, collections: { enemies: { fields: ['x', 'y'] }, traffic: { fields: ['x', 'z'] }, projectiles: { fields: ['x', 'y'], velocityGuard: true } } });
    let tick = 0;
    for (let frame = 1; frame <= hz * 2; frame++) {
      const seconds = frame / hz, due = Math.floor(seconds / step + 1e-9);
      while (tick < due) { display.capture(state); engine.step(state, controls, step); tick++; }
      const before = clone(state);
      display.sample(state, tickFraction(Math.max(0, seconds - tick * step), step));
      assert.deepEqual(state, before, 'presentation leaves real engine state intact');
    }
    return { state: clone(state), stats: display.getStats() };
  }
  const reference = run(60);
  for (const hz of [120, 144, 240]) {
    const result = run(hz);
    assert.deepEqual(result.state, reference.state, `${hz} Hz changes no gameplay outcome`);
    assert.equal(result.stats.physicsSamples, reference.stats.physicsSamples);
    assert.equal(result.stats.renderSamples, hz * 2);
    assert.ok(result.stats.interpolatedSamples > 0);
  }
});
