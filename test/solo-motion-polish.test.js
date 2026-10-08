import test from 'node:test';
import assert from 'node:assert/strict';
import { drawHighwayRoadMarkings } from '../public/solo/highway-view.js';
import { createParisRenderer } from '../public/solo/paris-renderer.js';
import { createSkylinePresentation, skylineGatePresentation } from '../public/solo/skyline-view.js';
import { createShadowPresentation } from '../public/solo/shadow-view.js';
import { createStarfallPresentation, createStarfallEffects, drawStarfallEffects } from '../public/solo/starfall-view.js';
import { createCircuitPresentation, circuitWheelAngle } from '../public/solo/circuit-view.js';
import * as skyline from '../public/solo/skyline-engine.js';
import * as shadow from '../public/solo/shadow-engine.js';
import * as starfall from '../public/solo/starfall-engine.js';
import * as circuit from '../public/solo/circuit-engine.js';
import * as paris from '../public/solo/paris-engine.js';

const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const mix = (before, after, fraction) => before + (after - before) * fraction;
function recordingCanvas() {
  const calls = [], paths = []; let points = [];
  const ctx = new Proxy({
    calls, paths, fillStyle: '', globalAlpha: 1,
    beginPath() { points = []; }, moveTo(x, y) { points.push([x, y]); }, lineTo(x, y) { points.push([x, y]); },
    fill() { paths.push({ color: this.fillStyle, points: points.map(point => [...point]) }); },
    fillRect(x, y, width, height) { calls.push({ method: 'rect', color: this.fillStyle, x, y, width, height }); },
    fillText(value, x, y) { calls.push({ method: 'text', value, x, y }); },
    arc(x, y, radius) { calls.push({ method: 'arc', x, y, radius }); },
    measureText(value) { return { width: String(value).length * 6 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    drawImage(image, ...args) { calls.push({ method: 'image', image, args }); },
  }, { get: (object, key) => object[key] ?? (() => {}) });
  return ctx;
}
const roadY = z => 178 + 296 * 16 / (z + 16);
function stripe(ctx, nearY) {
  return ctx.paths.find(path => path.color === '#bfcbb8' && Math.abs(path.points[2][1] - nearY) < 1e-8);
}

test('Night Drive lane endpoints flow through distance wraps with fractional projection rather than 2m screen jumps', () => {
  const ctx = recordingCanvas(), values = [];
  for (const distance of [11.98, 11.99, 12, 12.01, 12.02]) {
    ctx.paths.length = 0; drawHighwayRoadMarkings(ctx, { distance, curve: .137 });
    const line = stripe(ctx, roadY(12 - distance));
    assert.ok(line, 'the same world stripe survives the period boundary');
    close(line.points[0][1], roadY(17.5 - distance));
    values.push(line.points[2][1]);
  }
  assert.equal(new Set(values).size, values.length);
  for (let index = 1; index < values.length; index++) assert.ok(values[index] - values[index - 1] > 0 && values[index] - values[index - 1] < .2);
  assert.ok(ctx.paths.some(path => path.points.some(point => point.some(value => Math.abs(value - Math.round(value)) > .01))));
});

test('Night Drive stripes pass beneath the bumper continuously and distant reach has fixed draw bounds', () => {
  const ctx = recordingCanvas();
  for (const distance of [5.49, 5.5, 5.51]) {
    ctx.paths.length = 0; drawHighwayRoadMarkings(ctx, { distance });
    const line = ctx.paths.find(path => path.color === '#bfcbb8' && path.points[2][1] === 520);
    assert.ok(line, 'passing the old 5.5m Boolean cutoff cannot erase a whole bumper stripe');
    close(line.points[0][1], roadY(5.5 - distance));
  }
  for (const distance of [0, 11.999, 12.001, 130000.013]) for (const reach of [400, 1200, 50000, 1e12]) {
    ctx.paths.length = 0;
    const count = drawHighwayRoadMarkings(ctx, { distance, curve: -.25, reach });
    assert.ok(count < 240, `paint work ${count} must not grow with survival distance/reach`);
    assert.equal(count, ctx.paths.length);
    assert.ok(ctx.paths.every(path => path.points.every(point => point.every(Number.isFinite))));
  }
});

test('Paris projected barrier body and lamps retain fractional motion over no-tick render samples', () => {
  const state = paris.createState({ seed: 1729, mode: 'survival' });
  const actor = { id: 999, kind: 'barrier', x: .373, z: 30, width: 1.6, length: 1, color: '#e0a857', passed: false, crashed: false };
  state.traffic = [actor];
  const ctx = recordingCanvas(), renderer = createParisRenderer(ctx, { reducedMotion: true });
  const positions = [], original = structuredClone(state);
  for (const offset of [0, .003, .006, .009]) {
    const display = { ...state, distance: state.distance + offset };
    ctx.calls.length = 0; renderer.draw(display);
    const body = ctx.calls.find(call => call.color === '#e0a857'); assert.ok(body);
    const scale = 18 / (18 + actor.z - display.distance - actor.length / 2);
    close(body.x, 360 + (actor.x - actor.width / 2) * 49 * scale);
    close(body.width, actor.width * 49 * scale);
    positions.push(body.x);
  }
  assert.equal(new Set(positions).size, 4, 'subpixel distance changes cannot round back to identical rects');
  assert.deepEqual(state, original, 'draws cannot change authoritative traffic or RNG');
});

test('Skyline samples momentum, both clocks and an unchanged spool together, without blending new attachments/releases', () => {
  const state = skyline.createState(), presentation = createSkylinePresentation();
  Object.assign(state.player, { x: 300, y: 280, vx: 90, vy: 0, grounded: false });
  skyline.step(state, { hook: true, aimX: 315, aimY: 195 }); assert.ok(state.hook);
  const spool = state.hook;
  presentation.capture(state); const before = structuredClone(state);
  skyline.step(state, { hook: true, up: true, right: true }); const authoritative = structuredClone(state);
  const lengths = [];
  for (const fraction of [0, .25, .5, .75]) {
    const frame = presentation.sample(state, fraction);
    close(frame.levelElapsed, mix(before.levelElapsed, state.levelElapsed, fraction));
    close(frame.elapsed, mix(before.elapsed, state.elapsed, fraction));
    close(frame.player.vx, mix(before.player.vx, state.player.vx, fraction));
    close(frame.player.vy, mix(before.player.vy, state.player.vy, fraction));
    close(frame.hook.length, mix(before.hook.length, state.hook.length, fraction)); lengths.push(frame.hook.length);
    assert.equal(frame.hook.index, spool.index); assert.deepEqual(state, authoritative);
  }
  assert.equal(new Set(lengths).size, 4);
  presentation.capture(state); skyline.step(state, {}); assert.equal(presentation.sample(state, .01).hook, null);
  while (state.hookRetry > 0) skyline.step(state, {});
  presentation.capture(state); skyline.step(state, { hook: true, aimX: 315, aimY: 195 });
  assert.ok(state.hook); assert.equal(presentation.sample(state, .01).hook, state.hook, 'fresh attachment starts at its actual length');
});

test('Skyline continuous clock samples preserve the actual security-beam activation tick', () => {
  const state = skyline.createState(), presentation = createSkylinePresentation(); state.level = 3;
  const gate = skyline.LEVELS[3].gates[0], rate = skyline.DIFFICULTIES.veteran.laserRate;
  state.levelElapsed = (gate.period + gate.warmup - gate.offset) / rate - skyline.FIXED_STEP / 2;
  assert.equal(skyline.gatePhase(gate, state.levelElapsed), 'warning');
  presentation.capture(state); skyline.step(state, {});
  assert.equal(skyline.gatePhase(gate, state.levelElapsed), 'active');
  const frame = presentation.sample(state, .01);
  assert.ok(frame.levelElapsed < state.levelElapsed);
  assert.deepEqual(skylineGatePresentation(gate, state, frame), { phase: 'active', charge: 1 });
  assert.equal(state.phase, 'playing'); assert.equal(skyline.gatePhase(gate, state.levelElapsed), 'active', 'sampling cannot move activation or collision time');
  state.levelElapsed = (gate.period + gate.warmup / 2 - gate.offset) / rate;
  presentation.capture(state); skyline.step(state, {});
  const charges = [0, .25, .5, .75].map(fraction => skylineGatePresentation(gate, state, presentation.sample(state, fraction)).charge);
  assert.equal(new Set(charges).size, 4, 'warning charge advances on frames without a new physics tick');
});

test('Shadow samples seal-channel and smoke decay between real ticks, with starts, cancellations and completions immediate', () => {
  const state = shadow.createState(), presentation = createShadowPresentation();
  Object.assign(state.player, shadow.LEVELS[0].seals[0]);
  shadow.step(state, { interact: true, smoke: true }); assert.ok(state.channel && state.clouds[0]);
  presentation.capture(state); const before = structuredClone(state);
  shadow.step(state, { interact: true }); const authoritative = structuredClone(state), progress = [];
  for (const fraction of [0, .25, .5, .75]) {
    const frame = presentation.sample(state, fraction);
    close(frame.channel.progress, mix(before.channel.progress, state.channel.progress, fraction));
    close(frame.clouds[0].life, mix(before.clouds[0].life, state.clouds[0].life, fraction));
    progress.push(frame.channel.progress); assert.deepEqual(state, authoritative);
  }
  assert.equal(new Set(progress).size, 4);
  presentation.capture(state); shadow.step(state, { right: true }); assert.equal(presentation.sample(state, .01).channel, null);
  shadow.step(state, { interact: true }); state.channel.progress = state.channel.duration - shadow.FIXED_STEP / 2;
  presentation.capture(state); shadow.step(state, { interact: true });
  assert.equal(presentation.sample(state, .01).channel, null); assert.equal(state.scrolls[0], true);
});

test('Shadow guard countdown is continuous while blade starts and damage/readiness transitions remain authoritative', () => {
  const state = shadow.createState(), presentation = createShadowPresentation(), guard = state.guards[0];
  Object.assign(state.player, { x: 225, y: 535 }); Object.assign(guard, { x: 200, y: 535, facing: 0, mode: 'alert', suspicion: 1, attack: 0, cooldown: 0 });
  presentation.capture(state); shadow.step(state, {}); assert.equal(guard.attack, .78);
  assert.equal(presentation.sample(state, .01).guards[0].attack, .78, 'new warning starts immediately');
  presentation.capture(state); const before = guard.attack; shadow.step(state, {});
  close(presentation.sample(state, .25).guards[0].attack, mix(before, guard.attack, .25));
  guard.attack = .18 + shadow.FIXED_STEP / 2; guard.attackHit = false;
  const health = state.player.hp; presentation.capture(state); shadow.step(state, {});
  assert.equal(guard.attackHit, true); assert.equal(state.player.hp, health - 1);
  const frame = presentation.sample(state, .01);
  assert.equal(frame.guards[0], guard, 'the contact tick is a discrete action boundary'); assert.equal(frame.player.hp, state.player.hp);
  assert.equal(frame.player.invulnerable, state.player.invulnerable, 'new protection begins immediately');
});

test('Starfall effects move/fade on no-tick frames, start once immediately, reuse scratch and stay bounded', () => {
  const state = starfall.createState({ seed: 1729 }), effects = createStarfallEffects();
  starfall.step(state, { bomb: true }); effects.capture(state);
  const original = structuredClone(state), immediate = effects.sample(0);
  assert.equal(immediate.bombGlow, .48); assert.equal(immediate.rings.length, 1); assert.equal(immediate.rings[0].age, 0);
  const firstRing = immediate.rings[0], times = [state.time, state.time + 1 / 240, state.time + 2 / 240, state.time + 3 / 240];
  const ages = times.map(time => effects.sample(time).rings[0].age);
  assert.equal(new Set(ages).size, 4); assert.equal(effects.sample(times.at(-1)).rings[0], firstRing);
  effects.capture(state); assert.equal(effects.sample(state.time).rings.length, 1, 'old events cannot restart effects');
  const event = { id: ++state.eventId, type: 'destroy', x: 130, y: 200, boss: false }; state.events.push(event); effects.capture(state);
  const initial = effects.sample(state.time), particle = { ...initial.particles[0] }, xs = [], ctx = recordingCanvas();
  for (const time of times) {
    const effectFrame = effects.sample(time), sampled = effectFrame.particles[0]; const age = Math.max(0, time - state.time);
    close(sampled.x, particle.x + particle.vx * age); close(sampled.y, particle.y + particle.vy * age); xs.push(sampled.x);
    ctx.calls.length = 0; drawStarfallEffects(ctx, effectFrame);
    const drawn = ctx.calls.find(call => call.color === particle.color);
    close(drawn.x, sampled.x); close(drawn.y, sampled.y);
    close(ctx.calls.find(call => call.method === 'arc').radius, 24 + effectFrame.rings[0].age * 95);
    assert.equal(ctx.globalAlpha, 1, 'effect drawing restores Canvas opacity');
  }
  assert.equal(new Set(xs).size, 4);
  for (let index = 0; index < 50; index++) state.events.push({ ...event, id: ++state.eventId });
  effects.capture(state); const bounded = effects.sample(state.time);
  assert.equal(bounded.particles.length, 96); assert.equal(bounded.rings.length, 12);
  const authoritative = structuredClone(state); effects.sample(state.time + 1); assert.deepEqual(state, authoritative);
  assert.deepEqual({ ...original, events: state.events, eventId: state.eventId }, state, 'effects cannot change game state');
  effects.reset(); assert.equal(effects.sample(state.time).particles.length, 0);
  effects.capture(state); assert.equal(effects.sample(state.time).rings.length, 0, 'reset preserves event deduplication');
  const reduced = createStarfallEffects(); reduced.capture(original, true);
  assert.equal(reduced.sample(original.time).particles.length, 0); close(reduced.sample(original.time).bombGlow, .1);
});

test('Starfall warnings and stage clock sample while real firing removes the warning immediately', () => {
  const state = starfall.createState({ seed: 1729 }), presentation = createStarfallPresentation();
  for (let ticks = 0; !state.warnings.length && ticks < 1200; ticks++) starfall.step(state, {});
  assert.ok(state.warnings.length); const warning = state.warnings[0];
  presentation.capture(state); const before = structuredClone(state); starfall.step(state, {});
  const frame = presentation.sample(state, .25);
  close(frame.warnings[0].remaining, mix(before.warnings[0].remaining, state.warnings[0].remaining, .25));
  close(frame.stageTime, mix(before.stageTime, state.stageTime, .25));
  warning.remaining = 1 / 240; presentation.capture(state); starfall.step(state, {});
  assert.ok(!presentation.sample(state, .01).warnings.some(item => item.id === warning.id));
  assert.ok(state.hostileShots.length > 0, 'authoritative firing and shot membership are preserved');
});

test('Circuit visible wheel pose follows actual turn momentum through steering reversal and reverse, independently of display cadence', () => {
  const state = circuit.createState({ difficulty: 'veteran' }), presentation = createCircuitPresentation(); state.startDelay = 0;
  for (let ticks = 0; ticks < 90; ticks++) circuit.step(state, { throttle: true, right: true });
  presentation.capture(state); const before = structuredClone(state);
  circuit.step(state, { throttle: true, left: true }); const original = structuredClone(state), angles = [];
  for (const fraction of [0, .25, .5, .75]) {
    const frame = presentation.sample(state, fraction);
    close(frame.car.angularVelocity, mix(before.car.angularVelocity, state.car.angularVelocity, fraction));
    const expected = Math.atan(frame.car.angularVelocity * 43 / Math.max(55, Math.abs(frame.car.speed)) * (frame.car.speed < 0 ? -1 : 1));
    close(circuitWheelAngle(frame.car), Math.max(-.69, Math.min(.69, expected))); angles.push(circuitWheelAngle(frame.car));
    assert.deepEqual(state, original);
  }
  assert.equal(new Set(angles).size, 4); assert.ok(angles.every(angle => angle > 0), 'fresh Left cannot instantly draw right-turn momentum as a left-turning rack');
  close(circuitWheelAngle({ speed: -80, angularVelocity: -.4 }), circuitWheelAngle({ speed: 80, angularVelocity: .4 }));
  assert.equal(circuitWheelAngle({ speed: 0, angularVelocity: 0 }), 0);
});

for (const [name, engine, factory, controls] of [
  ['Skyline', skyline, createSkylinePresentation, { right: true, jump: true }],
  ['Shadow', shadow, createShadowPresentation, { right: true, sneak: true }],
  ['Starfall', starfall, createStarfallPresentation, { fire: true, focus: true, up: true }],
  ['Circuit', circuit, createCircuitPresentation, { throttle: true, right: true }],
]) test(`${name} final view sampler preserves real motion, resources, damage, RNG and clocks at 60/144/240 Hz`, () => {
  function run(hz) {
    const state = engine.createState({ seed: 1729, difficulty: 'veteran' }), display = factory();
    const step = engine.FIXED_STEP || engine.FIXED_DT || 1 / 120;
    let tick = 0;
    for (let frame = 1; frame <= hz; frame++) {
      const due = Math.floor(frame / hz / step + 1e-9);
      while (tick < due) { display.capture(state); engine.step(state, controls, step); tick++; }
      const original = structuredClone(state);
      display.sample(state, Math.max(0, frame / hz - tick * step) / step);
      assert.deepEqual(state, original);
    }
    return state;
  }
  const reference = run(60);
  assert.deepEqual(run(144), reference); assert.deepEqual(run(240), reference);
});
