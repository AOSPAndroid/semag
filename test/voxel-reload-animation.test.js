import assert from 'node:assert/strict';
import test from 'node:test';
import { combatStep, createCombatPlayer, createState, emptyInput, playerHeight, WORLD } from '../public/voxel-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { createWeaponReloadPresenter, playerAnimationPose, weaponReloadPose } from '../public/voxel-player-animation.js';
import { operativeMeshes, playerShotAge, weaponMeshes, VoxelRenderer } from '../public/voxel-renderer.js';
import { weaponCyclePose, weaponShotPose } from '../public/voxel-first-person-motion.js';

const arena = { id: 'mechanical-animation', bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [], sites: [] };
const actor = (weapon = 'carbine', patch = {}) => ({ ...createCombatPlayer(0, 1, weapon), ...patch });
const points = mesh => Array.from({ length: mesh.length / 10 }, (_, index) => [...mesh.slice(index * 10, index * 10 + 3)]);
const view = (player, context = {}, map = null, time = 1000) => VoxelRenderer.prototype._viewModel.call({ lastAim: null, swayX: 0, swayY: 0, ...context }, player, 0, 0, time, false, map);

test('real accepted reload ticks drive removal, an empty receiver, insertion, seating and a separate bolt stroke', () => {
  const state = createState(), player = actor('carbine', { ammo: 1 });
  state.players = [player]; state.fighters = state.players; state.phase = 'fight';
  state.tick++; combatStep(state, [{ ...emptyInput(), reload: true }], arena);
  assert.equal(player.reloadTicks, WEAPONS.carbine.reloadTicks);
  assert.ok(state.events.some(event => event.type === 'reload' && event.playerId === player.id));
  const stages = [], models = new Map();
  for (let tick = 0; tick <= WEAPONS.carbine.reloadTicks; tick++) {
    const before = structuredClone(player), progress = 1 - player.reloadTicks / WEAPONS.carbine.reloadTicks;
    const pose = weaponReloadPose(player.weapon, progress, { active: player.reloadTicks > 0 });
    if (stages.at(-1) !== pose.stage) stages.push(pose.stage);
    if (!models.has(pose.stage)) models.set(pose.stage, weaponMeshes(player.weapon, {}, { reloadMotion: pose }));
    assert.deepEqual(player, before, 'inspection does not spend ammo or advance the accepted timer');
    state.tick++; combatStep(state, [emptyInput()], arena);
  }
  assert.deepEqual(stages, ['lower', 'remove', 'fetch', 'insert', 'seat', 'bolt', 'return', 'ready']);
  assert.equal(models.get('fetch').length, models.get('ready').length - 72 * 10, 'both detached magazine surfaces disappear from the receiver');
  assert.notDeepEqual(models.get('remove'), models.get('insert'));
  assert.ok(weaponReloadPose('carbine', .31).magazineDrop > .24);
  assert.ok(weaponReloadPose('carbine', .66).magazineDrop < .004);
  assert.ok(weaponReloadPose('carbine', .715).seat > .99);
  assert.ok(weaponReloadPose('carbine', .83).bolt > .99);
  assert.equal(player.reloadTicks, 0); assert.equal(player.ammo, WEAPONS.carbine.magazine);
});

test('shell, cylinder, crossbow, belt and paired reloads move their actual distinct mechanical parts', () => {
  for (const weapon of ['shotgun', 'slugshotgun']) {
    const idle = weaponMeshes(weapon), loading = weaponMeshes(weapon, {}, { reloadMotion: weaponReloadPose(weapon, .3) });
    assert.equal(loading.length, idle.length + 72 * 10, `${weapon}: one shell and brass head are visibly loaded`);
    assert.equal(weaponReloadPose(weapon, .20).audioPhase, 'shell1');
    assert.equal(weaponReloadPose(weapon, .42).audioPhase, 'shell2');
    assert.equal(weaponReloadPose(weapon, .66).audioPhase, 'shell3');
    assert.ok(weaponReloadPose(weapon, .825).pump > .99);
    assert.notDeepEqual(weaponMeshes(weapon, {}, { pump: 1 }), idle);
  }
  assert.ok(weaponReloadPose('revolver', .4).cylinder > .99);
  assert.notDeepEqual(weaponMeshes('revolver'), weaponMeshes('revolver', {}, { reloadMotion: weaponReloadPose('revolver', .4) }));
  assert.ok(weaponReloadPose('lmg', .4).lid > .99);
  assert.notDeepEqual(weaponMeshes('lmg'), weaponMeshes('lmg', {}, { reloadMotion: weaponReloadPose('lmg', .4) }));
  const loose = weaponMeshes('crossbow', {}, { loaded: false, reloadMotion: weaponReloadPose('crossbow', .15) });
  const drawn = weaponMeshes('crossbow', {}, { loaded: false, reloadMotion: weaponReloadPose('crossbow', .65) });
  const placed = weaponMeshes('crossbow', {}, { loaded: false, reloadMotion: weaponReloadPose('crossbow', .84) });
  assert.notDeepEqual(loose, drawn, 'the real cocking string draws along its rail');
  assert.equal(placed.length, drawn.length + 144 * 10, 'a placed shaft, head and fletching appear after cocking');
  for (const weapon of ['dualpistols', 'dualsmg']) {
    assert.equal(weaponReloadPose(weapon, .25, { hand: 0 }).active, true);
    assert.equal(weaponReloadPose(weapon, .25, { hand: 1 }).active, false);
    assert.equal(weaponReloadPose(weapon, .73, { hand: 0 }).active, false);
    assert.equal(weaponReloadPose(weapon, .73, { hand: 1 }).active, true);
    assert.notDeepEqual(weaponMeshes(weapon, {}, { reloadProgress: .25 }), weaponMeshes(weapon, {}, { reloadProgress: .73 }));
  }
});

test('reloads are frozen with their accepted timer, cancel immediately, and clip before real thin cover', () => {
  const cover = { ...arena, colliders: [{ id: 'thin', x: -5, y: 0, z: -.325, w: 10, h: 4, d: .015 }] };
  for (const weapon of Object.keys(WEAPONS)) for (const progress of [.20, .40, .56, .715, .83]) {
    const player = actor(weapon, { reloadTicks: WEAPONS[weapon].reloadTicks * (1 - progress) }), source = structuredClone(player);
    const reference = view(player, {}, null, 1000);
    for (const hz of [60, 120, 144, 240]) assert.deepEqual(view(player, {}, null, 1000 + 1000 / hz), reference, `${weapon}: display cadence cannot anticipate reload state`);
    const clipped = view(player, {}, cover);
    assert.ok(points(clipped).every(([, , z]) => z > -.31001), `${weapon}: hands and mechanisms remain before the wall`);
    assert.deepEqual(player, source);
    const cancelled = weaponReloadPose(weapon, progress, { active: false });
    assert.equal(cancelled.stage, 'ready'); assert.equal(cancelled.magazineDrop, 0); assert.equal(cancelled.bolt, 0);
    assert.deepEqual(weaponMeshes(weapon, {}, { reloadMotion: cancelled }), weaponMeshes(weapon));
  }
});

test('every staged reload and sprint gait preserves actual head, torso, foot and wall contact envelopes', () => {
  for (const weapon of Object.keys(WEAPONS)) for (const crouching of [false, true]) for (const progress of [.2, .4, .56, .715, .83]) {
    const player = actor(weapon, { crouching, yaw: .731, vx: 2, vz: -4, reloadTicks: WEAPONS[weapon].reloadTicks * (1 - progress) });
    const source = structuredClone(player), animation = playerAnimationPose(player, .19);
    for (const point of points(operativeMeshes(player, 190, false, animation))) {
      const [x, y, z] = point, height = playerHeight(player), radius = y > height - .32 + 1e-6 ? .22 : .29;
      assert.ok(y >= -1e-6 && y <= height + 1e-6, `${weapon}: genuine body height`);
      assert.ok(Math.hypot(x, z) <= radius + 1e-6 && Math.hypot(x, z) <= WORLD.radius + 1e-6, `${weapon}: genuine body/head and cover bounds`);
    }
    assert.deepEqual(player, source);
  }
  for (const yaw of [0, .731, 1.73]) for (let frame = 0; frame < 120; frame++) {
    const player = actor('carbine', { sprinting: true, yaw, vx: 0, vz: -7.7 });
    const mesh = operativeMeshes(player, frame * 1000 / 120, false, playerAnimationPose(player, frame / 120));
    assert.ok(points(mesh).every(([x, y, z]) => y >= 0 && y <= WORLD.standHeight && Math.hypot(x, z) <= (y > WORLD.standHeight - .32 + 1e-6 ? .22 : .29) + 1e-6));
    assert.ok(mesh.length / 10 <= 1200, 'expressive gait adds no anatomy or vertex budget');
  }
});

test('first, second and third actually accepted burst rounds each start fresh remote recoil and cycling', () => {
  const state = createState(), player = actor('burst');
  state.players = [player]; state.fighters = state.players; state.phase = 'fight';
  const fresh = [];
  for (let tick = 0; tick <= WEAPONS.burst.burstInterval * 2 + 1; tick++) {
    state.tick++; combatStep(state, [{ ...emptyInput(), fire: tick === 0 }], arena);
    const accepted = state.events.some(event => event.type === 'shot' && event.playerId === player.id && event.tick === state.tick);
    if (accepted) {
      assert.equal(playerShotAge(player), 0, 'the short interval between burst rounds is honored');
      assert.ok(weaponShotPose(player.weapon, playerShotAge(player)).kick > .05);
      fresh.push(player.shotIndex);
    } else if (fresh.length) {
      const age = playerShotAge(player);
      assert.ok(age > 0 && age <= WEAPONS.burst.burstInterval * 1000 / 120);
      if (age >= 8 && age < 78) assert.ok(weaponCyclePose(player.weapon, age).bolt > 0);
    }
  }
  assert.deepEqual(fresh, [1, 2, 3]);
  assert.equal(playerShotAge(actor('carbine', { shotCooldown: 20 })), Infinity, 'cooldown without an accepted shot cannot kick');
});

test('30 Hz accepted reload snapshots produce continuous bounded cosmetic motion at 60/144/240 Hz', () => {
  const duration = WEAPONS.carbine.reloadTicks;
  const finishes = [];
  for (const hz of [60, 120, 144, 240]) {
    const present = createWeaponReloadPresenter();
    let previous = null, observed = -1, intermediateFrames = 0;
    for (let frame = 0; frame <= hz; frame++) {
      const time = frame * 1000 / hz, acceptedTick = Math.floor((time * .12 + 1e-9) / 4) * 4;
      const player = Object.freeze(actor('carbine', { reloadTicks: duration - acceptedTick }));
      const pose = present(player, time, 'round', { durationTicks: duration });
      assert.ok(pose.remainingTicks >= player.reloadTicks - 4 && pose.remainingTicks <= player.reloadTicks);
      assert.ok(pose.remainingTicks >= 1, 'presentation cannot confirm completion or transfer ammo');
      assert.ok(Math.abs(pose.remainingTicks - (duration - time * .12)) <= 1.5, `${hz}: visual timer follows the real tick cadence within a display sample`);
      if (previous && player.reloadTicks === observed) {
        assert.ok(pose.remainingTicks < previous.remainingTicks, 'intermediate display frames move the actual magazine/hand');
        intermediateFrames++;
      }
      if (previous) assert.ok(previous.remainingTicks - pose.remainingTicks <= 120 / hz + 1.5, 'new snapshots cannot create a large pose jump');
      assert.deepEqual(present(player, time, 'round', { durationTicks: duration }), pose, 'repeat timestamps do not add elapsed motion');
      previous = pose; observed = player.reloadTicks;
    }
    assert.ok(intermediateFrames > hz / 3);
    finishes.push(previous);
  }
  assert.ok(finishes.every(pose => pose.remainingTicks === duration - 120));
});

test('cosmetic reload timers freeze pauses, clamp missing snapshots, and reset on all actual lifecycle interruptions', () => {
  const options = { durationTicks: WEAPONS.carbine.reloadTicks }, present = createWeaponReloadPresenter({ maxPlayers: 2 });
  const player = actor('carbine', { reloadTicks: 2, lifeId: 1 });
  present(player, 0, 'round', options);
  const nearEnd = present(player, 100, 'round', options);
  assert.equal(nearEnd.remainingTicks, 1); assert.equal(nearEnd.active, true);
  assert.equal(present(player, 200, 'round', { ...options, paused: true }), nearEnd);
  assert.equal(present(player, 700, 'round', { ...options, paused: true }), nearEnd);
  assert.equal(present(player, 710, 'round', options).remainingTicks, 1);
  const complete = present({ ...player, reloadTicks: 0 }, 720, 'round', options);
  assert.equal(complete.active, false); assert.equal(complete.remainingTicks, 0); assert.equal(present.size, 0);
  for (const patch of [{ weapon: 'pistol' }, { inventoryIndex: 2 }, { lifeId: 2 }, { deaths: 1 }, { reloadTicks: 200 }]) {
    present.reset(); const source = actor('carbine', { reloadTicks: 150, lifeId: 1 });
    present(source, 0, 'round', options); present(source, 20, 'round', options);
    const changed = { ...source, ...patch }, before = structuredClone(changed);
    assert.equal(present(changed, 30, 'round', options).remainingTicks, changed.reloadTicks);
    assert.deepEqual(changed, before);
  }
  for (const patch of [{ slot: 'sword' }, { slot: 'empty' }, { alive: false }]) {
    present.reset(); present(player, 0, 'round', options);
    assert.equal(present({ ...player, ...patch }, 30, 'round', options).active, false); assert.equal(present.size, 0);
  }
  for (const [time, context] of [[-1, 'round'], [1100, 'round'], [20, 'next-round']]) {
    present.reset(); const source = actor('carbine', { reloadTicks: 100 });
    present(source, 0, 'round', options); present(source, 10, 'round', options);
    assert.equal(present(source, time, context, options).remainingTicks, 100);
  }
  present.reset();
  for (let id = 0; id < 10; id++) { present({ ...player, id }, 0, 'round', options); assert.ok(present.size <= 2); }
  present.retain([9]); assert.equal(present.size, 1); present.reset(); assert.equal(present.size, 0);
});

test('renderer anchors once to raw accepted timers while retaining projected bodies and rejecting old gear/lives', () => {
  let allocations = 0;
  const gl = new Proxy({}, { get(_, key) {
    if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
    if (key === 'getAttribLocation') return () => 0;
    if (key === 'getUniformLocation') return (_program, uniform) => uniform;
    if (typeof key === 'string' && key.startsWith('create')) return () => { allocations++; return {}; };
    return () => {};
  } });
  const renderer = new VoxelRenderer({ getContext: () => gl, getBoundingClientRect: () => ({ width: 960, height: 540 }), addEventListener() {}, removeEventListener() {}, dispatchEvent() {} });
  const accepted = actor('carbine', { reloadTicks: 200, lifeId: 1 });
  const projected = { ...accepted, x: .4, reloadTicks: 197 };
  const state = { gameId: 'voxel-breach', map: arena, phase: 'fight', round: 1, tick: 100, players: [projected], events: [] };
  renderer.render(state, { localId: 0, time: 1000, viewPlayer: projected, acceptedPlayers: [accepted] });
  const created = allocations;
  for (const time of [1004, 1008, 1016, 1024, 1032, 1040, 1050]) {
    const rawBefore = structuredClone(accepted), bodyBefore = structuredClone(projected);
    renderer.render(state, { localId: 0, time, viewPlayer: projected, acceptedPlayers: [accepted] });
    const motion = renderer.stats.firstPerson;
    assert.equal(motion.reload.authoritativeTicks, 200);
    assert.ok(motion.reload.visualTicks >= 196 && motion.reload.visualTicks <= 200, 'preprojected197 cannot accumulate a second projection');
    assert.equal(motion.eye[0], projected.x, 'raw timer anchoring never rewinds the independently projected body');
    assert.deepEqual(accepted, rawBefore); assert.deepEqual(projected, bodyBefore);
    assert.equal(allocations, created, 'reload animation creates no GPU resources');
    assert.ok(renderer.stats.drawCalls <= 7 && renderer.stats.dynamicVertices <= 72000);
  }
  for (const patch of [{ lifeId: 2 }, { inventoryIndex: 2 }, { weapon: 'pistol' }, { slot: 'empty' }]) {
    renderer.resetEffects();
    renderer.render(state, { localId: 0, time: 2000, viewPlayer: projected, acceptedPlayers: [{ ...accepted, ...patch }] });
    assert.equal(renderer.stats.firstPerson.reload.active, false, 'a different accepted actor/held item cannot animate the old reload');
  }
  renderer.resetEffects();
  renderer.render(state, { localId: 0, time: 3000, viewPlayer: projected, acceptedPlayers: [accepted] });
  renderer.render(state, { localId: 0, time: 3016, viewPlayer: projected, acceptedPlayers: [{ ...accepted, reloadTicks: 0 }] });
  assert.equal(renderer.stats.firstPerson.reload.active, false, 'real completion immediately clears an older positive projected timer');
  assert.equal(renderer.stats.firstPerson.reload.visualTicks, 0);
  for (const weapon of ['dualpistols', 'dualsmg']) {
    renderer.resetEffects();
    const raw = actor(weapon, { reloadTicks: WEAPONS[weapon].reloadTicks * .25, lifeId: 2 });
    const shown = { ...raw, reloadTicks: raw.reloadTicks - 3 };
    renderer.render({ ...state, players: [shown] }, { localId: 0, time: 4000, viewPlayer: shown, acceptedPlayers: [raw] });
    const reload = renderer.stats.firstPerson.reload;
    assert.equal(reload.active, true, 'the whole accepted reload continues after the first gun is ready');
    assert.equal(reload.hands[0].active, false); assert.equal(reload.hands[0].stage, 'ready');
    assert.equal(reload.hands[1].active, true); assert.equal(reload.hands[1].stage, 'insert');
  }
  renderer.destroy();
});
