import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneState, combatStep, createCombatPlayer, emptyInput, predictLocalMovement } from '../public/voxel-engine.js';
import { clearMeleeBuffer, meleeProfile, meleeSlashGeometry, meleeSlashPhase } from '../public/voxel-melee.js';
import { setInventoryMeleeLoadout } from '../public/voxel-inventory.js';
import { combatPresentation, createMovementPresenter, hudTransitionKey, interpolatedVoxelState, projectedMovement, reconcileMovement, withCombatPresentation } from '../public/voxel-presentation.js';

const arena = { id: 'blade-presentation', bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [], sites: [] };
const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) <= epsilon, `${a} ≈ ${b}`);
const vector = player => [Math.sin(player.meleeYaw) * Math.cos(player.meleePitch), Math.sin(player.meleePitch), -Math.cos(player.meleeYaw) * Math.cos(player.meleePitch)];
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, value, index) => sum + value * b[index], 0))));
function fixture(weapon = 'sword') {
  const player = createCombatPlayer(0); Object.assign(player, { x: 0, y: 0, z: 0, human: true, lifeId: 1 }); setInventoryMeleeLoadout(player, weapon, { equip: true });
  return { player, state: { gameId: 'voxel-breach', phase: 'fight', tick: 0, round: 1, matchId: 1, mapId: arena.id, eventId: 0, events: [], players: [player], fighters: [player], map: arena, grenades: [], bolts: [], loot: [] } };
}
function step(setup, input = {}, ticks = 1) { for (let tick = 0; tick < ticks; tick++) { setup.state.tick++; combatStep(setup.state, [{ ...emptyInput(setup.player), ...input }], arena); } }
function startup(weapon = 'sword') {
  const setup = fixture(weapon); step(setup, { fire: true, yaw: 3.1, pitch: .3 }); step(setup, { yaw: -2.8, pitch: .55 }, 2);
  const old = cloneState(setup.player); step(setup, { yaw: -2.8, pitch: .55 }); return { ...setup, old };
}

test('same-swing startup aim follows the short 3D path across the yaw seam without mutating authority', () => {
  const { player, old } = startup(), before = cloneState(player), prior = cloneState(old);
  const view = combatPresentation(player, old, .5);
  near(angle(vector(old), vector(view)), angle(vector(old), vector(player)) / 2, 1e-7);
  assert.ok(angle(vector(view), vector(player)) < .03, 'wrapped yaw takes the short path');
  assert.deepEqual(player, before); assert.deepEqual(old, prior);
});

test('startup guidance advances smoothly at high display refresh while remaining inside the original twelve-degree commitment', () => {
  for (const weapon of ['sword', 'katana']) {
    const { player, old } = startup(weapon), original = { meleeYaw: player.meleeInitialYaw, meleePitch: player.meleeInitialPitch };
    let previous = vector(player);
    for (let frame = 0; frame <= 3; frame++) {
      const view = combatPresentation(player, old, 1, frame * 1000 / 360), next = vector(view);
      assert.ok(angle(vector(original), next) <= Math.PI / 15 + 1e-8);
      assert.ok(angle(previous, next) <= Math.PI / 360 + 1e-7, 'a 360 Hz frame adds at most its share of steering');
      previous = next;
    }
    assert.ok(angle(vector(player), previous) > 0, 'guidance has useful sub-tick motion');
  }
});

test('a visual startup preview waits for authority before drawing the first active cut', () => {
  const setup = startup('katana'); while (setup.player.meleeTicks > meleeProfile(setup.player).activeTicks + meleeProfile(setup.player).recoveryTicks + 1) step(setup, { yaw: -2.8, pitch: .55 });
  const before = cloneState(setup.player), view = combatPresentation(setup.player, setup.player, 1, 25);
  assert.equal(meleeSlashPhase(view).phase, 'startup'); assert.deepEqual(setup.player, before);
  step(setup, { yaw: -2.8, pitch: .55 }); assert.equal(meleeSlashPhase(setup.player).phase, 'active');
});

test('accepted active and recovery geometry never rotates toward older windup or rewinds its damage slice', () => {
  const setup = startup(); const old = cloneState(setup.player);
  while (meleeSlashPhase(setup.player).phase === 'startup') step(setup, { yaw: -2.8, pitch: .55 });
  for (const ratio of [0, .25, .5, 1]) {
    const view = combatPresentation(setup.player, old, ratio, 4);
    assert.deepEqual([view.meleeYaw, view.meleePitch], [setup.player.meleeYaw, setup.player.meleePitch]);
    assert.ok(view.meleeTicks <= setup.player.meleeTicks); assert.equal(meleeSlashPhase(view).phase, 'active');
    const real = meleeSlashGeometry(setup.player), drawn = meleeSlashGeometry(view); assert.deepEqual(real.samples, drawn.samples);
  }
  const active = cloneState(setup.player); while (meleeSlashPhase(setup.player).phase === 'active') step(setup, { yaw: 0, pitch: -1 });
  assert.equal(meleeSlashPhase(combatPresentation(setup.player, active, 0)).phase, 'recovery');
});

test('new swing, action, physical slot, initial commitment or life never inherits an older blade animation', () => {
  const { player } = startup();
  for (const change of [{ meleeIndex: player.meleeIndex + 1 }, { meleeStartTick: player.meleeStartTick + 1 }, { meleeAction: 'secondary' }, { inventoryIndex: 2 }, { meleeInitialYaw: .4 }, { lifeId: 2 }, { deaths: 1 }, { meleeWeapon: 'katana' }]) {
    const old = { ...player, ...change, meleeTicks: 100, meleeCooldown: 100, meleeYaw: -1, meleePitch: -.8 };
    const view = combatPresentation(player, old, .25, 25);
    assert.ok(view.meleeTicks <= player.meleeTicks); assert.equal(view.meleeCooldown, player.meleeCooldown);
    assert.ok(angle(vector(view), vector(player)) <= Math.PI / 40 + 1e-8, 'only the current windup can advance');
    assert.ok(angle(vector(view), vector(old)) > 1, 'the older blade direction is never borrowed');
  }
});

test('the first accepted windup continues between frames without borrowing the previous swing timer', () => {
  const setup = fixture(); const previous = cloneState(setup.player); step(setup, { fire: true });
  const first = combatPresentation(setup.player, previous, 0, 0), later = combatPresentation(setup.player, previous, 0, 7);
  assert.equal(first.meleeTicks, setup.player.meleeTicks); assert.ok(later.meleeTicks < first.meleeTicks);
  assert.equal(meleeSlashPhase(later).phase, 'startup'); assert.equal(later.meleeStartTick, setup.player.meleeStartTick);
});

test('local composition copies coherent startup angles and keeps accepted active angles and queue state authoritative', () => {
  const setup = startup(), visual = combatPresentation(setup.player, setup.old, .5, 3), local = cloneState(setup.player); local.x = 4;
  const composed = withCombatPresentation(local, visual); assert.equal(composed.x, 4); assert.equal(composed.meleeYaw, visual.meleeYaw); assert.equal(composed.meleePitch, visual.meleePitch);
  const forged = { ...visual, meleeIndex: visual.meleeIndex + 1, pendingMeleeTicks: 10 };
  const ignored = withCombatPresentation(local, forged); assert.equal(ignored.meleeTicks, local.meleeTicks); assert.equal(ignored.meleeYaw, local.meleeYaw); assert.equal(ignored.pendingMeleeTicks, local.pendingMeleeTicks);
  while (meleeSlashPhase(setup.player).phase === 'startup') step(setup);
  const accepted = cloneState(setup.player), turned = { ...accepted, meleeYaw: 1, meleePitch: 1, pendingMeleeTicks: 10 };
  const active = withCombatPresentation(accepted, turned); assert.equal(active.meleeYaw, accepted.meleeYaw); assert.equal(active.meleePitch, accepted.meleePitch); assert.equal(active.pendingMeleeTicks, accepted.pendingMeleeTicks);
});

test('queued readout transitions paint immediately while its ordinary countdown does not invalidate every frame', () => {
  const setup = fixture(); step(setup, { fire: true }); step(setup, {}, 46);
  const idle = hudTransitionKey(setup.state, [], 0); step(setup, { fire: true }); assert.ok(setup.player.pendingMeleeTicks > 0);
  const queued = hudTransitionKey(setup.state, [], 0); assert.notEqual(queued, idle);
  step(setup); assert.equal(hudTransitionKey(setup.state, [], 0), queued);
  clearMeleeBuffer(setup.player); assert.notEqual(hudTransitionKey(setup.state, [], 0), queued);
});

test('an accepted queued recovery immediately replaces a cached remote sprint continuation', () => {
  const setup = fixture(); step(setup, { fire: true }); step(setup, {}, 53);
  const player = setup.player; assert.equal(player.meleeTicks, 1);
  const buttons = { ...emptyInput(player), up: true, sprint: true }, peers = [];
  const unqueued = projectedMovement(player, buttons, arena, 25, predictLocalMovement, peers);
  player.pendingMeleeTicks = 8;
  const expected = cloneState(player); predictLocalMovement(expected, buttons, arena, 3, peers);
  const queued = projectedMovement(player, buttons, arena, 25, predictLocalMovement, peers);
  near(queued.z, expected.z); near(queued.stamina, expected.stamina); assert.equal(queued.sprinting, false);
  assert.ok(unqueued.stamina < queued.stamina, 'the new accepted followup prevents a stale predicted sprint');
  assert.equal(player.pendingMeleeTicks, 8, 'presentation never spends accepted queued input');
});

test('the cached sub-tick presenter refreshes a changed blade context once and reuses the new endpoint', () => {
  const { player } = startup(), buttons = emptyInput(player), peers = [], presenter = createMovementPresenter(); let calls = 0;
  const predict = (...args) => { calls++; return predictLocalMovement(...args); };
  presenter(player, buttons, arena, 1 / 360, predict, peers); presenter(player, buttons, arena, 1 / 240, predict, peers); assert.equal(calls, 1);
  player.pendingMeleeTicks = 5; player.meleeYaw += .02;
  presenter(player, buttons, arena, 1 / 360, predict, peers); assert.equal(calls, 2);
  presenter(player, buttons, arena, 1 / 240, predict, peers); assert.equal(calls, 2, 'fresh displays share one collision-tested endpoint');
});

test('reconciliation strips a speculative private queued action when fresh authority cancels the click', () => {
  const setup = fixture(); step(setup, { fire: true }); step(setup, {}, 46);
  const speculative = cloneState(setup.player), late = { ...emptyInput(speculative), fire: true };
  predictLocalMovement(speculative, late, arena); assert.equal(speculative.pendingMeleeTicks, 0, 'the queued private clock never publishes its intent');
  step(setup, { fire: true }); assert.ok(setup.player.pendingMeleeTicks > 0); clearMeleeBuffer(setup.player);
  const history = [{ seq: 5, tick: setup.state.tick, buttons: late }], reconciled = reconcileMovement(setup.player, history, 5, arena, predictLocalMovement, true, [], setup.state.tick);
  assert.equal(reconciled.pending.length, 0); const expected = cloneState(setup.player);
  for (let tick = 0; tick < 80; tick++) {
    const input = { ...emptyInput(setup.player), up: true, sprint: true };
    predictLocalMovement(reconciled.predicted, input, arena); predictLocalMovement(expected, input, arena);
    near(reconciled.predicted.z, expected.z); near(reconciled.predicted.stamina, expected.stamina);
  }
  assert.equal(reconciled.predicted.pendingMeleeTicks, 0); assert.equal(reconciled.predicted.meleeIndex, setup.player.meleeIndex);
});

test('remote body interpolation and attack presentation cannot bridge a reused player life', () => {
  const setup = startup(), oldState = cloneState(setup.state); oldState.players[0].x = -2; oldState.players[0].lifeId = 0; oldState.players[0].meleeYaw = 1;
  const newest = cloneState(setup.state); newest.players[0].x = 2; const view = interpolatedVoxelState([{ time: 0, state: oldState }, { time: 40, state: newest }], 20, -1);
  assert.equal(view.players[0].x, 2); assert.equal(view.players[0].meleeYaw, newest.players[0].meleeYaw); assert.equal(view.players[0].meleeTicks, newest.players[0].meleeTicks);
});

test('gun ADS, reload, recoil and newest health remain unchanged by the melee presentation additions', () => {
  const player = createCombatPlayer(0), old = { ...player, aimTicks: 6, reloadTicks: 80, recoil: .3 };
  Object.assign(player, { aiming: true, aimTicks: 10, reloadTicks: 76, recoil: .2, hp: 120 }); old.aiming = true;
  const view = combatPresentation(player, old, .5, 4);
  near(view.aimTicks, 8.48); near(view.reloadTicks, 77.52); near(view.recoil, .25 - .48 * .04 / 120); assert.equal(view.hp, 120);
});
