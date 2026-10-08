import assert from 'node:assert/strict';
import test from 'node:test';
import { createState, step, FIXED_STEP, canOccupy, serialize } from '../public/voxel-survival-engine.js';
import { setWorldBlock } from '../public/voxel-survival-world.js';
import { createSurvivalPresentation } from '../public/voxel-survival-presentation.js';
import { survivalHandMotion } from '../public/voxel-survival-renderer.js';

const clone = value => structuredClone(value);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const overlap = (a, b) => a.y + a.height > b.y + 1e-7 && a.y < b.y + b.height - 1e-7
  && Math.hypot(a.x - b.x, a.z - b.z) < a.radius + b.radius - 1e-7;
function fixture() {
  const state = createState({ seed: 93841 });
  state.world.blocks.fill(0);
  for (let z = 0; z < state.world.depth; z++) for (let x = 0; x < state.world.width; x++) setWorldBlock(state.world, x, 0, z, 1);
  Object.assign(state.player, { x: 20.5, y: 1, z: 20.5 });
  return state;
}
function foe(id, x, z, type = 'crawler') {
  return { id, type, x, y: 1, z, vx: 0, vy: 0, vz: 0, yaw: 0, radius: .32, height: 1.65, hp: 45, maxHp: 45,
    attackCooldown: 1, hitFlash: 0, grounded: true, stuckTime: 0, digTime: 0, digTarget: null, daylightTime: 0 };
}
function clearScene(state, displayed) {
  const bodies = [displayed.camera, ...displayed.enemies.filter(body => body.hp > 0)];
  for (let index = 0; index < bodies.length; index++) {
    const body = bodies[index];
    assert.ok(canOccupy(state, body.x, body.y, body.z, body.radius, body.height), `body ${index} entered terrain`);
    for (let other = index + 1; other < bodies.length; other++) assert.ok(!overlap(body, bodies[other]), `bodies ${index}/${other} overlapped`);
  }
}

test('Wilds samples camera, creature, arrow and animation time together at 240 Hz, with immediate mouse look', () => {
  const state = fixture(), display = createSurvivalPresentation();
  state.enemies.push(foe(1, 23, 20));
  state.projectiles.push({ id: 1, x: 5, y: 4, z: 5, vx: 20, vy: 0, vz: 0, life: 3, damage: 12 });
  display.capture(state);
  const before = clone(state);
  step(state, { strafe: 1, yaw: 0, pitch: 0 }, FIXED_STEP);
  const authoritative = serialize(state), samples = [];
  for (const fraction of [0, .25, .5, .75]) {
    const sample = display.sample(state, fraction, { yaw: 1.37, pitch: -.42 });
    close(sample.camera.x, before.player.x + (state.player.x - before.player.x) * fraction);
    close(sample.options.enemies[0].x, before.enemies[0].x + (state.enemies[0].x - before.enemies[0].x) * fraction);
    close(sample.options.projectiles[0].x, before.projectiles[0].x + (state.projectiles[0].x - before.projectiles[0].x) * fraction);
    close(sample.options.displayTime, before.time + (state.time - before.time) * fraction);
    assert.equal(sample.camera.yaw, 1.37); assert.equal(sample.camera.pitch, -.42);
    samples.push(display.getPresentation()); clearScene(state, samples.at(-1));
    assert.equal(serialize(state), authoritative, 'sampling cannot move physics or advance a gameplay clock');
  }
  for (const key of ['camera', 'enemies', 'projectiles']) {
    const values = samples.map(sample => key === 'camera' ? sample.camera.x : sample[key][0].x);
    assert.equal(new Set(values).size, 4, `${key} must move at display cadence`);
  }
});

test('Wilds display scratch is reused and the copied inspection snapshot cannot mutate the game', () => {
  const state = fixture(), display = createSurvivalPresentation(); state.enemies.push(foe(1, 23, 20));
  display.capture(state); step(state, { strafe: 1 }, FIXED_STEP);
  const sample = display.sample(state, .25), camera = sample.camera, enemies = sample.options.enemies, creature = enemies[0];
  const next = display.sample(state, .75);
  assert.equal(next, sample); assert.equal(next.camera, camera); assert.equal(next.options.enemies, enemies); assert.equal(next.options.enemies[0], creature);
  const copy = display.getPresentation(); copy.camera.x = -100; copy.enemies[0].x = -100;
  assert.notEqual(state.player.x, -100); assert.notEqual(display.getPresentation().camera.x, -100);
  assert.notEqual(state.enemies[0].x, -100); assert.notEqual(display.getPresentation().enemies[0].x, -100);
});

test('terrain corner cuts and crowded body contacts fall back to real clear poses', () => {
  const state = fixture(), display = createSurvivalPresentation();
  setWorldBlock(state.world, 10, 1, 10, 4); setWorldBlock(state.world, 10, 2, 10, 4);
  Object.assign(state.player, { x: 9.69, z: 10.15 }); display.capture(state);
  Object.assign(state.player, { x: 10.15, z: 9.69 });
  const snapshot = serialize(state);
  const sampled = display.sample(state, .5); close(sampled.camera.x, state.player.x); close(sampled.camera.z, state.player.z);
  clearScene(state, display.getPresentation()); assert.equal(serialize(state), snapshot);

  Object.assign(state.player, { x: 20, z: 20 });
  state.enemies.push(foe(1, 20.8, 20)); display.capture(state);
  state.player.x = 20.18; state.enemies[0].x = 20.81;
  display.sample(state, .8); clearScene(state, display.getPresentation());
});

test('world edits, pause, new worlds, teleports, death and day changes never blend stale scenes', () => {
  const state = fixture(), display = createSurvivalPresentation();
  const checkSnap = change => {
    state.paused = false; state.phase = 'playing'; display.capture(state); step(state, { strafe: 1 }, FIXED_STEP); change();
    const sample = display.sample(state, .1);
    close(sample.camera.x, state.player.x); assert.equal(sample.options.displayTime, state.time);
  };
  checkSnap(() => setWorldBlock(state.world, 5, 5, 5, 4));
  checkSnap(() => { state.paused = true; });
  checkSnap(() => { state.phase = 'dead'; });
  checkSnap(() => { state.player.x += 2; });
  checkSnap(() => { state.day++; });
  display.reset(); const fresh = fixture(); assert.equal(display.sample(fresh, .1).options.displayTime, fresh.time);
});

test('new spawns, dead foes and removed arrows keep authoritative membership', () => {
  const state = fixture(), display = createSurvivalPresentation();
  state.enemies.push(foe(1, 23, 20)); state.projectiles.push({ id: 1, x: 5, y: 4, z: 5, vx: 20, vy: 0, vz: 0, life: 3 });
  display.capture(state); state.enemies[0].hp = 0; const fresh = foe(2, 25, 20); state.enemies.push(fresh); state.projectiles.length = 0;
  const sample = display.sample(state, .25);
  assert.equal(sample.options.enemies[0], state.enemies[0], 'death cannot blend into a live creature');
  assert.equal(sample.options.enemies[1], fresh, 'a newly spawned creature has no old pose');
  assert.equal(sample.options.projectiles.length, 0, 'collision removals are immediate');
});

test('attack and hurt starts are immediate, timer decay is smooth and attack arc is independent of world time', () => {
  const state = fixture(), display = createSurvivalPresentation(); display.capture(state);
  state.player.swingTime = .22; state.player.hurtTime = .45;
  const start = display.sample(state, .1);
  assert.equal(start.options.player.swingTime, .22); assert.equal(start.options.player.hurtTime, .45);
  assert.equal(survivalHandMotion(state, start.camera, start.options).swing, 0, 'a new attack begins at its neutral hand pose');
  display.capture(state); step(state, {}, FIXED_STEP);
  const middle = display.sample(state, .5);
  close(middle.options.player.swingTime, .22 - FIXED_STEP * .5);
  const move = survivalHandMotion(state, middle.camera, middle.options);
  const later = survivalHandMotion({ ...state, time: state.time + 71 }, middle.camera, { ...middle.options, displayTime: state.time + 71 });
  assert.equal(move.swing, later.swing, 'identical attack progress gives the same arc at every world time');
  assert.ok(move.swing > 0);
});

test('mining progress samples only its active target and resets immediately on a target or tool change', () => {
  const state = fixture(), display = createSurvivalPresentation();
  state.mining = { x: 10, y: 1, z: 10, id: 4, progress: .3, total: 1 };
  display.capture(state); state.mining.progress += FIXED_STEP;
  close(display.sample(state, .5).options.mining.progress, .3 + FIXED_STEP * .5);
  state.selectedSlot++; assert.equal(display.sample(state, .5).options.mining, state.mining);
  state.mining = { ...state.mining, x: 11 }; assert.equal(display.sample(state, .5).options.mining, state.mining);
  state.mining = null; assert.equal(display.sample(state, .5).options.mining, null);
});

test('dense creature contacts, jump landings and arrows preserve identical mechanics at 60/120/144/240 Hz', () => {
  function run(hz) {
    const state = fixture(), display = createSurvivalPresentation();
    for (let id = 1; id <= 12; id++) {
      const angle = id * Math.PI / 6;
      state.enemies.push(foe(id, 20.5 + Math.cos(angle) * 2.5, 20.5 + Math.sin(angle) * 2.5, id % 3 === 0 ? 'archer' : 'crawler'));
    }
    state.enemyId = 12;
    for (let id = 1; id <= 12; id++) state.projectiles.push({ id, x: 3, y: 3, z: 3 + id, vx: 18, vy: 0, vz: 0, life: 3, damage: 16 });
    state.projectileId = 12;
    let tick = 0, highest = state.player.y;
    for (let frame = 1; frame <= hz * 2; frame++) {
      const seconds = frame / hz, due = Math.floor(seconds / FIXED_STEP + 1e-9);
      while (tick < due) {
        display.capture(state);
        step(state, { strafe: tick < 100 ? 1 : -1, yaw: tick < 120 ? .2 : -.2, pitch: 0, jump: tick === 20 || tick === 125, sprint: true }, FIXED_STEP);
        highest = Math.max(highest, state.player.y); tick++;
      }
      const snapshot = serialize(state);
      display.sample(state, (seconds - tick * FIXED_STEP) / FIXED_STEP);
      assert.equal(serialize(state), snapshot, 'render cadence must not change controls, damage, RNG, edits or clocks');
      clearScene(state, display.getPresentation());
    }
    assert.ok(highest > 2, 'real jump trajectory was exercised');
    assert.ok(state.events.some(event => ['hurt', 'shot'].includes(event.type)), 'real combat contact or arrows were exercised');
    return serialize(state);
  }
  const reference = run(60);
  for (const hz of [120, 144, 240]) assert.equal(run(hz), reference, `mechanics changed at ${hz} Hz`);
});
