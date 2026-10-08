import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, emptyInput, predictLocalMovement, traceShot, MAPS, WEAPONS } from '../public/voxel-engine.js';
import { launchBolt } from '../public/voxel-projectiles.js';
import { combatPresentation, createMovementPresenter, movementPresentation, projectedMovement, withCombatPresentation } from '../public/voxel-presentation.js';
import { interpolatedState as breachState, createContinuousInputPacer } from '../public/voxel-client.js';
import { interpolatedState as royaleState, createInputPacer } from '../public/voxel-royale-client.js';
import { VoxelRenderer } from '../public/voxel-renderer.js';

const STEP = 1 / 120;
const openMap = { id: 'refresh-test', bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [] };
const input = (changes = {}) => ({ ...emptyInput(), right: true, ...changes });
const near = (actual, expected, epsilon = 1e-10) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} versus ${expected}`);

test('60, 120, 144 and 240 Hz produce identical fixed physics and distinct intermediate display poses', () => {
  let baseline;
  for (const hz of [60, 120, 144, 240]) {
    const player = createCombatPlayer(0), buttons = input(), peers = [], present = createMovementPresenter();
    let remainder = 0, physicsTicks = 0;
    const positions = [];
    for (let frame = 1; frame <= hz; frame++) {
      remainder += 1 / hz;
      while (remainder + 1e-12 >= STEP) { remainder = Math.max(0, remainder - STEP); predictLocalMovement(player, buttons, openMap, 1, peers); physicsTicks++; }
      const before = structuredClone(player), pose = present(player, buttons, openMap, remainder, predictLocalMovement, peers);
      assert.deepEqual(player, before, 'drawing never consumes a physics step or changes its input history');
      positions.push(pose.x);
    }
    assert.equal(physicsTicks, 120);
    assert.equal(new Set(positions.map(x => x.toFixed(9))).size, hz, `${hz} distinct display positions`);
    if (baseline) assert.deepEqual(player, baseline); else baseline = player;
  }
});

test('sub-tick camera stays on the swept side of walls and live bodies without moving the source', () => {
  for (const [map, peers, maxX] of [
    [{ ...openMap, colliders: [{ x: 1, y: 0, z: -2, w: .1, h: 4, d: 4 }] }, [], .68],
    [openMap, [{ ...createCombatPlayer(1), x: 1.2 }], .56],
  ]) {
    const player = { ...createCombatPlayer(0), x: maxX - .005, vx: 5.5 }, before = structuredClone({ player, peers });
    for (const fraction of [.1, .5, .99]) {
      const pose = movementPresentation(player, input(), map, STEP * fraction, predictLocalMovement, peers);
      assert.ok(pose.x <= maxX + 1e-5);
      assert.ok(pose.x >= player.x - 1e-5);
      assert.equal(pose.hp, player.hp);
    }
    assert.deepEqual({ player, peers }, before);
  }
});

test('previewing a jump does not consume its press or stand a crouched player through a roof', () => {
  const player = createCombatPlayer(0), buttons = input({ right: false, jump: true });
  const pose = movementPresentation(player, buttons, openMap, STEP / 2, predictLocalMovement);
  assert.ok(pose.y > 0); assert.equal(player.y, 0); assert.equal(player.previousInput.jump, false); assert.equal(player.grounded, true);
  predictLocalMovement(player, buttons, openMap);
  assert.equal(player.previousInput.jump, true); assert.equal(player.grounded, false);
  const roof = { ...openMap, colliders: [{ x: -1, y: 1.2, z: -1, w: 2, h: .2, d: 2 }] };
  const crouched = { ...createCombatPlayer(0), crouching: true };
  assert.equal(movementPresentation(crouched, input({ right: false }), roof, STEP / 2, predictLocalMovement).crouching, true);
});

test('repeated display poses reuse one collision sweep and invalidate immediately on input, tick and peer changes', () => {
  const player = createCombatPlayer(0), peers = [], present = createMovementPresenter(); let sweeps = 0;
  const predict = (...args) => { sweeps++; return predictLocalMovement(...args); };
  for (const fraction of [.1, .3, .5, .9]) present(player, input(), openMap, STEP * fraction, predict, peers);
  assert.equal(sweeps, 1);
  present(player, input({ yaw: .3 }), openMap, STEP / 2, predict, peers); assert.equal(sweeps, 2);
  predictLocalMovement(player, input({ yaw: .3 }), openMap);
  present(player, input({ yaw: .3 }), openMap, STEP / 2, predict, peers); assert.equal(sweeps, 3);
  present(player, input({ yaw: .3 }), openMap, STEP / 2, predict, [{ ...createCombatPlayer(1), x: 2 }]); assert.equal(sweeps, 4);
  assert.equal(present(player, input(), openMap, 0, predict, peers), player);
});

test('remote projection reuses snapshot endpoints, smoothly covers fractional ticks and stops after 25ms', () => {
  const source = { ...createCombatPlayer(1), vx: 5.5 }, peers = [source], buttons = input(); let sweeps = 0;
  const predict = (...args) => { sweeps++; return predictLocalMovement(...args); };
  const half = projectedMovement({ ...source }, buttons, openMap, 1000 / 240, predict, peers, source);
  const nearly = projectedMovement({ ...source }, buttons, openMap, 7, predict, peers, source);
  assert.ok(half.x > source.x && nearly.x > half.x); assert.equal(sweeps, 1);
  assert.equal(source.x, 0);
  const end = projectedMovement({ ...source }, buttons, openMap, 25, predict, peers, source);
  const stalled = projectedMovement({ ...source }, buttons, openMap, 1000, predict, peers, source);
  assert.deepEqual(stalled, end); assert.equal(sweeps, 2);
});

test('visual combat smoothing preserves newest health, inventory, action cancellation and fresh recoil', () => {
  const old = { ...createCombatPlayer(0), hp: 180, ammo: 15, aiming: true, aimTicks: 4, recoil: .07, reloadTicks: 90, healTicks: 180, healStartTick: 1, meleeTicks: 30 };
  const newest = { ...old, hp: 100, ammo: 9, aimTicks: 8, recoil: .05, reloadTicks: 86, healTicks: 176, meleeTicks: 26 };
  const pose = combatPresentation(newest, old, .5);
  near(pose.aimTicks, 6); near(pose.recoil, .06); near(pose.reloadTicks, 88); near(pose.healTicks, 178); near(pose.meleeTicks, 28);
  assert.equal(pose.hp, 100); assert.equal(pose.ammo, 9); assert.equal(newest.aimTicks, 8);
  const ahead = combatPresentation(newest, old, 1, 1000);
  near(ahead.aimTicks, 11); near(ahead.reloadTicks, 83);
  const stopped = combatPresentation({ ...newest, reloadTicks: 0, healTicks: 0, meleeTicks: 0, recoil: .1 }, old, .1, 0);
  assert.equal(stopped.reloadTicks, 0); assert.equal(stopped.healTicks, 0); assert.equal(stopped.meleeTicks, 0); assert.equal(stopped.recoil, .1);
  for (const change of [{ weapon: 'pistol' }, { slot: 'sword' }, { meleeWeapon: 'knife' }, { alive: false }, { team: 1 }]) {
    const reset = { ...newest, ...change };
    assert.equal(combatPresentation(reset, old, .5, 25), reset);
  }
  const combined = withCombatPresentation({ ...newest, x: 3, hp: 70, ammo: 8 }, pose);
  assert.equal(combined.x, 3); assert.equal(combined.hp, 70); assert.equal(combined.ammo, 8); assert.equal(combined.aimTicks, 6);
});

test('both voxel clients render fractional remote movement and bolt flight without mutating snapshots', () => {
  for (const interpolate of [breachState, royaleState]) {
    const own = { ...createCombatPlayer(0), x: -8, z: -8 }, remote = { ...createCombatPlayer(1), x: 8, z: 8, vx: 5.5, previousInput: input() };
    const state = { phase: 'fight', round: 1, matchId: 1, mapId: 'courtyard', map: MAPS.courtyard, tick: 10, players: [own, remote], bolts: [] };
    launchBolt(state, own, WEAPONS.crossbow, { x: 20, y: 3, z: 5 }, { x: 0, y: 0, z: -1 });
    const before = structuredClone(state), rendered = interpolate([{ time: 0, state }], 1000 / 240, 0, { predictMovement: predictLocalMovement, traceProjectile: traceShot });
    assert.ok(rendered.players[1].x > remote.x); assert.equal(rendered.players[0].x, own.x);
    assert.ok(rendered.bolts[0].z < state.bolts[0].z); near(rendered.bolts[0].z, 5 - WEAPONS.crossbow.projectileSpeed / 240);
    assert.deepEqual(state, before);
  }
});

test('phase, map and life transitions bypass stale combat and body interpolation in both clients', () => {
  for (const interpolate of [breachState, royaleState]) {
    const before = { phase: 'fight', round: 1, matchId: 1, mapId: 'courtyard', map: MAPS.courtyard, players: [{ ...createCombatPlayer(0), x: 0, aimTicks: 3 }], bolts: [] };
    for (const context of [{ phase: 'buy' }, { mapId: 'depot' }, interpolate === breachState ? { round: 2 } : { matchId: 2 }]) {
      const next = { ...before, ...context, players: [{ ...before.players[0], x: 2, aimTicks: 18 }] };
      const pose = interpolate([{ time: 0, state: before }, { time: 100, state: next }], 50, 0).players[0];
      assert.equal(pose.x, 2); assert.equal(pose.aimTicks, 18);
    }
  }
});

test('weapon sway has the same angular response and settling time at 60, 120, 144 and 240 Hz', () => {
  let reference;
  for (const hz of [60, 120, 144, 240]) {
    const context = { lastAim: null, swayX: 0, swayY: 0, localShot: null }, player = createCombatPlayer(0);
    const render = (yaw, pitch, time) => VoxelRenderer.prototype._viewModel.call(context, player, yaw, pitch, time);
    render(0, 0, 0);
    for (let frame = 1; frame <= hz / 4; frame++) { const seconds = frame / hz; render(seconds * 2, seconds * .3, seconds * 1000); }
    const peak = { x: context.swayX, y: context.swayY };
    for (let frame = hz / 4 + 1; frame <= hz / 2; frame++) render(.5, .075, frame / hz * 1000);
    const result = { peak, x: context.swayX, y: context.swayY };
    if (reference) { near(result.peak.x, reference.peak.x); near(result.peak.y, reference.peak.y); near(result.x, reference.x); near(result.y, reference.y); } else reference = result;
    render(2, 1, 10000);
    assert.ok(Math.abs(context.swayX) < Math.abs(result.x), 'an idle/background gap decays sway instead of injecting a stale turn');
  }
});

test('high-frequency continuous input remains within Breach120 and Royale60 budgets while edges are immediate', () => {
  for (const [create, budget] of [[createContinuousInputPacer, 120], [createInputPacer, 60]]) {
    const pacer = create(budget); let sends = 0;
    for (let time = 0; time < 1000; time += .5) if (pacer.shouldSend(time)) sends++;
    assert.ok(sends <= budget);
    assert.equal(pacer.shouldSend(1000, true), true); assert.equal(pacer.shouldSend(1000.01, true), true);
    assert.equal(pacer.shouldSend(1000.02), false);
  }
});
