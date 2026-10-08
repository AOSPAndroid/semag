import assert from 'node:assert/strict';
import test from 'node:test';
import { createState, step, FIXED_STEP, canOccupy, serialize, getBlock } from '../public/voxel-survival-engine.js';
import { setWorldBlock } from '../public/voxel-survival-world.js';
import { createSurvivalPresentation } from '../public/voxel-survival-presentation.js';
import { survivalHandMotion, SurvivalRenderer } from '../public/voxel-survival-renderer.js';

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

test('pause, new worlds, teleports and death never blend stale scenes', () => {
  const state = fixture(), display = createSurvivalPresentation();
  const checkSnap = change => {
    state.paused = false; state.phase = 'playing'; display.capture(state); step(state, { strafe: 1 }, FIXED_STEP); change();
    const sample = display.sample(state, .1);
    close(sample.camera.x, state.player.x); assert.equal(sample.options.displayTime, state.time);
  };
  checkSnap(() => { state.paused = true; });
  checkSnap(() => { state.phase = 'dead'; });
  checkSnap(() => { state.player.x += 2; });
  checkSnap(() => { state.world = { ...state.world }; });
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

// Recording GL observes the real renderer's camera uniforms, terrain cache and
// lighting. Gameplay, display sampling and mesh building remain the real code.
function recordingRenderer() {
  const eyes = [], times = [], daylight = [];
  let serial = 0;
  const functions = {
    getShaderParameter: () => true, getProgramParameter: () => true, getAttribLocation: () => 0,
    getUniformLocation: (_, name) => name,
    createShader: () => ++serial, createProgram: () => ++serial, createBuffer: () => ++serial, createTexture: () => ++serial,
    uniform3fv: (name, value) => { if (name === 'uEye') eyes.push([...value]); },
    uniform1f: (name, value) => { if (name === 'uTime') times.push(value); if (name === 'uDaylight') daylight.push(value); },
  };
  const gl = new Proxy(functions, { get: (target, key) => target[key] || (String(key).toUpperCase() === key ? 1 : () => {}) });
  const canvas = { width: 960, height: 540, getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) };
  return { renderer: new SurvivalRenderer(canvas), eyes, times, daylight };
}

test('distant real regrowth edits retain walking/creature/arrow cadence while the renderer updates terrain immediately', () => {
  const state = fixture(), display = createSurvivalPresentation(), { renderer, eyes } = recordingRenderer();
  state.tick = 119; state.regrowth.push({ x: 5, y: 1, z: 5, at: state.time });
  state.enemies.push(foe(1, 23, 20));
  state.projectiles.push({ id: 1, x: 5, y: 3, z: 25, vx: 20, vy: 0, vz: 0, life: 3, damage: 12 });
  renderer.render(state, state.player, { hideHands: true }); eyes.length = 0;
  const oldFaces = renderer.chunks.get(0).faces;
  display.capture(state); const before = clone(state), oldRevision = state.world.revision;
  step(state, { strafe: 1, yaw: 0, pitch: 0 }, FIXED_STEP);
  assert.equal(getBlock(state, 5, 1, 5), 13); assert.equal(state.world.revision, oldRevision + 1);
  const authoritative = serialize(state), samples = [];
  for (const fraction of [0, .25, .5, .75]) {
    const sample = display.sample(state, fraction);
    close(sample.camera.x, before.player.x + (state.player.x - before.player.x) * fraction);
    close(sample.options.enemies[0].x, before.enemies[0].x + (state.enemies[0].x - before.enemies[0].x) * fraction);
    close(sample.options.projectiles[0].x, before.projectiles[0].x + (state.projectiles[0].x - before.projectiles[0].x) * fraction);
    assert.equal(sample.options.worldRevision, state.world.revision);
    assert.equal(renderer.render(state, sample.camera, { ...sample.options, hideHands: true }), true);
    assert.equal(renderer._lastRevision, state.world.revision);
    assert.equal(renderer.chunks.get(0).revision, state.world.chunkRevisions[0]);
    assert.equal(renderer.chunks.get(0).faces, oldFaces + 4, 'current shrub mesh replaces the old chunk immediately');
    samples.push(display.getPresentation()); clearScene(state, samples.at(-1));
    assert.equal(serialize(state), authoritative);
  }
  assert.equal(new Set(eyes.map(eye => eye[0])).size, 4, 'the real renderer receives four walking camera positions per tick');
  assert.equal(new Set(samples.map(sample => sample.enemies[0].x)).size, 4);
  renderer.destroy();
});

test('a real placement behind a moving player rejects only interpolated poses inside the current block', () => {
  const state = fixture(), display = createSurvivalPresentation();
  Object.assign(state.player, { x: 20.299, z: 20.5, yaw: -Math.PI / 2, pitch: 0 });
  setWorldBlock(state.world, 18, 2, 20, 4);
  state.inventory[0] = { id: 'stone', count: 8 };
  display.capture(state); const beforeX = state.player.x;
  step(state, { forward: -1, yaw: -Math.PI / 2, pitch: 0, place: true }, FIXED_STEP);
  assert.equal(getBlock(state, 19, 2, 20), 4); assert.equal(state.stats.built, 1);
  assert.equal(canOccupy(state, beforeX, state.player.y, state.player.z), false, 'the past eye/body now intersects the placed block');
  assert.equal(canOccupy(state, state.player.x, state.player.y, state.player.z), true);
  const authoritative = serialize(state);
  for (const fraction of [0, .1]) {
    const sample = display.sample(state, fraction);
    close(sample.camera.x, state.player.x); assert.equal(sample.options.player, state.player);
    clearScene(state, display.getPresentation()); assert.equal(serialize(state), authoritative);
  }
  const safe = display.sample(state, .75);
  assert.ok(safe.camera.x < state.player.x, 'a validated clear pose still samples smoothly after this same edit');
  assert.notEqual(safe.options.player, state.player);
  clearScene(state, display.getPresentation()); assert.equal(serialize(state), authoritative);
});

test('true day rollover keeps a validated moving cohort smooth and renders current dawn lighting', () => {
  const state = fixture(), display = createSurvivalPresentation(), { renderer, eyes, times, daylight } = recordingRenderer();
  state.time = 180 - FIXED_STEP / 2; state.night = true; state.spawnTimer = 20;
  state.enemies.push(foe(1, 23, 20));
  display.capture(state); const before = clone(state);
  step(state, { strafe: 1, yaw: 0 }, FIXED_STEP);
  assert.equal(state.day, 2); assert.equal(state.night, false);
  const authoritative = serialize(state);
  for (const fraction of [0, .25, .5, .75]) {
    const sample = display.sample(state, fraction);
    close(sample.camera.x, before.player.x + (state.player.x - before.player.x) * fraction);
    close(sample.options.enemies[0].x, before.enemies[0].x + (state.enemies[0].x - before.enemies[0].x) * fraction);
    assert.equal(sample.options.displayTime, state.time);
    renderer.render(state, sample.camera, { ...sample.options, hideHands: true });
    clearScene(state, display.getPresentation()); assert.equal(serialize(state), authoritative);
  }
  assert.equal(new Set(eyes.map(eye => eye[0])).size, 4);
  assert.ok(times.every(time => time === state.time)); assert.ok(daylight.every(amount => amount === 1));
  renderer.destroy();
});

test('revision changes retain the current corner and crowd rejection rules and do not rewind arrow membership', () => {
  const state = fixture(), display = createSurvivalPresentation();
  setWorldBlock(state.world, 10, 1, 10, 4); setWorldBlock(state.world, 10, 2, 10, 4);
  Object.assign(state.player, { x: 9.69, z: 10.15 }); display.capture(state);
  Object.assign(state.player, { x: 10.15, z: 9.69 }); setWorldBlock(state.world, 5, 5, 5, 4);
  let authoritative = serialize(state), sample = display.sample(state, .5);
  close(sample.camera.x, state.player.x); close(sample.camera.z, state.player.z); assert.equal(sample.options.player, state.player);
  clearScene(state, display.getPresentation()); assert.equal(serialize(state), authoritative);
  Object.assign(state.player, { x: 20, z: 20 }); state.enemies.push(foe(1, 20.8, 20)); display.capture(state);
  state.player.x = 20.18; state.enemies[0].x = 20.81; setWorldBlock(state.world, 6, 5, 5, 4);
  authoritative = serialize(state); display.sample(state, .8); clearScene(state, display.getPresentation()); assert.equal(serialize(state), authoritative);

  state.enemies.length = 0; Object.assign(state.player, { x: 20.5, z: 20.5 });
  const arrow = { id: 1, x: 5.8, y: 3, z: 5.5, vx: 24, vy: 0, vz: 0, life: 3, damage: 12 };
  state.projectiles = [arrow]; display.capture(state); arrow.x = 6.2; setWorldBlock(state.world, 5, 3, 5, 4);
  const blocked = display.sample(state, .25);
  assert.equal(blocked.options.projectiles[0], arrow, 'a newly filled old arrow segment cannot be interpolated through terrain');
  state.projectiles.length = 0;
  assert.equal(display.sample(state, .5).options.projectiles.length, 0);
});

test('walking through real regrowth and dawn preserves mechanics and clear nonmutating scenes at 60–240 Hz', () => {
  function run(hz) {
    const state = fixture(), display = createSurvivalPresentation();
    state.time = 180 - .6; state.night = true; state.spawnTimer = 30;
    state.regrowth.push({ x: 5, y: 1, z: 5, at: state.time }, { x: 6, y: 1, z: 5, at: state.time + 1 });
    let tick = 0, sawEdit = false, sawDay = false, previousRevision = state.world.revision;
    for (let frame = 1; frame <= hz * 2; frame++) {
      const seconds = frame / hz, due = Math.floor(seconds / FIXED_STEP + 1e-9);
      while (tick < due) {
        display.capture(state); step(state, { strafe: tick < 100 ? 1 : -1, yaw: .2, pitch: 0, jump: tick === 20, sprint: true }, FIXED_STEP);
        sawEdit ||= state.world.revision !== previousRevision; sawDay ||= state.day === 2; previousRevision = state.world.revision; tick++;
      }
      const authoritative = serialize(state);
      display.sample(state, (seconds - tick * FIXED_STEP) / FIXED_STEP);
      clearScene(state, display.getPresentation()); assert.equal(serialize(state), authoritative);
    }
    assert.ok(sawEdit && sawDay, 'real edit and day-boundary engine paths ran');
    return serialize(state);
  }
  const reference = run(60);
  for (const hz of [120, 144, 240]) assert.equal(run(hz), reference);
});
