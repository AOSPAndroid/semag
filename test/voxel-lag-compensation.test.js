import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';
import { createCombatPlayer, traceShot } from '../public/voxel-engine.js';
import { MAX_REWIND_TICKS, enableLagCompensation, getLagCompensationDiagnostics, isValidViewTick, recordLagCompensation, setShotViewTick, traceCompensatedShot } from '../public/voxel-lag-compensation.js';

const arena = { id: 'lag-test', colliders: [] };
const origin = { x: 0, y: 1.62, z: 0 }, direction = { x: 0, y: 0, z: -1 };
const actor = (id, changes = {}) => ({ ...createCombatPlayer(id), x: id ? 0 : 0, y: 0, z: id ? -10 : 0, ...changes });
const makeState = () => ({ gameId: 'voxel-breach', phase: 'fight', mapId: arena.id, map: arena, round: 1, matchId: 1, tick: 100, players: [actor(0), actor(1)] });
const compensated = (state, map = arena, shotOrigin = origin, shotDirection = direction) => traceCompensatedShot(state, 0, shotOrigin, shotDirection, 120, map, traceShot);
const current = (state, map = arena, shotOrigin = origin, shotDirection = direction) => traceShot(state, 0, shotOrigin, shotDirection, 120, map);
function recordPath(state, from = 100, to = 120, position = tick => ({ x: (tick - from) * 5.4 / 120 })) {
  enableLagCompensation(state);
  for (let tick = from; tick <= to; tick++) {
    state.tick = tick;
    Object.assign(state.players[1], position(tick));
    recordLagCompensation(state);
  }
  return state;
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} versus ${b}`);

for (const delay of [45, 50, 55]) test(`a real moving head at ${delay} ms buffered view is hit without enlarging its hitbox`, () => {
  const state = makeState(), viewTick = 120 - delay * 120 / 1000;
  recordPath(state, 100, 120, tick => ({ x: (tick - viewTick) * 5.4 / 120 }));
  assert.equal(current(state).kind, 'none', 'current narrow head has moved out of the displayed aim line');
  const before = structuredClone(state);
  assert.equal(setShotViewTick(state, 0, viewTick), true);
  const hit = compensated(state);
  assert.equal(hit.kind, 'head');
  assert.equal(hit.playerId, 1);
  near(hit.x, 0);
  near(hit.z, -9.78);
  assert.deepEqual(state, before, 'historical tracing never mutates authority');
});

test('fractional historical XYZ interpolate onto newest stance and combat fields only', () => {
  const state = makeState();
  recordPath(state, 100, 120, tick => ({ x: tick - 100, y: (tick - 100) * .1, z: -10 - (tick - 100) * .2 }));
  Object.assign(state.players[1], { crouching: true, hp: 67, weapon: 'sniper', aimTicks: 18, yaw: 1.4, pitch: .4, team: 1 });
  const before = structuredClone(state);
  setShotViewTick(state, 0, 108.5);
  let seen;
  traceCompensatedShot(state, 0, origin, direction, 120, arena, (...args) => { seen = args[0]; return traceShot(...args); });
  near(seen.players[1].x, 8.5);
  near(seen.players[1].y, .85);
  near(seen.players[1].z, -11.7);
  for (const field of ['crouching', 'hp', 'weapon', 'aimTicks', 'yaw', 'pitch', 'team']) assert.equal(seen.players[1][field], state.players[1][field], field);
  assert.equal(seen.players[0], state.players[0], 'shooter origin and body remain current');
  assert.deepEqual(state, before);
});

test('current static cover blocks a compensated headshot', () => {
  const state = recordPath(makeState(), 100, 120, tick => ({ x: (tick - 114) * 5.4 / 120 }));
  setShotViewTick(state, 0, 114);
  const map = { ...arena, colliders: [{ id: 'current-cover', x: -1, y: 0, z: -5, w: 2, h: 3, d: .5 }] };
  const hit = compensated(state, map);
  assert.equal(hit.kind, 'wall');
  assert.equal(hit.colliderId, 'current-cover');
});

test('the displayed historic allied body blocks enemies while keeping its current team', () => {
  const state = makeState();
  state.players.push(actor(2, { team: 0, z: -5 }));
  enableLagCompensation(state);
  for (let tick = 100; tick <= 120; tick++) {
    state.tick = tick;
    state.players[1].x = 0;
    state.players[2].x = (tick - 114) * 5.4 / 120;
    recordLagCompensation(state);
  }
  assert.equal(current(state).playerId, 1, 'current ally has moved outside the aim line');
  setShotViewTick(state, 0, 114);
  const hit = compensated(state);
  assert.equal(hit.playerId, 2);
  assert.equal(state.players[hit.playerId].team, state.players[0].team);
});

test('a newly crouched target keeps its current smaller head silhouette', () => {
  const state = recordPath(makeState(), 100, 120, tick => ({ x: (tick - 114) * 5.4 / 120 }));
  state.players[1].crouching = true;
  setShotViewTick(state, 0, 114);
  assert.equal(compensated(state).kind, 'none', 'historical standing stance cannot be resurrected');
  assert.equal(compensated(state, arena, { ...origin, y: .98 }).kind, 'head');
});

for (const metadata of [undefined, null, false, '114', NaN, Infinity, -Infinity, -1, {}, [], Number.MAX_SAFE_INTEGER + 1]) test(`invalid view metadata ${String(metadata)} cannot rewind a shot`, () => {
  const state = recordPath(makeState(), 100, 120, tick => ({ x: (tick - 114) * 5.4 / 120 }));
  setShotViewTick(state, 0, 114);
  assert.equal(isValidViewTick(metadata), false);
  assert.equal(setShotViewTick(state, 0, metadata), false);
  assert.deepEqual(compensated(state), current(state));
});

for (const metadata of [120.01, 121, 100, Number.MAX_SAFE_INTEGER]) test(`syntactically valid but future or stale view tick ${metadata} uses current authority`, () => {
  const state = recordPath(makeState(), 100, 120, tick => ({ x: (tick - 114) * 5.4 / 120 }));
  assert.equal(isValidViewTick(metadata), true);
  assert.equal(setShotViewTick(state, 0, metadata), false);
  assert.deepEqual(compensated(state), current(state));
});

test('held automatic fire stops rewinding once its last view tick leaves the 150 ms window', () => {
  const state = recordPath(makeState(), 100, 120, tick => ({ x: (tick - 114) * 5.4 / 120 }));
  setShotViewTick(state, 0, 114);
  assert.equal(compensated(state).kind, 'head');
  state.tick = 132;
  state.players[1].x = (132 - 114) * 5.4 / 120;
  recordLagCompensation(state);
  assert.equal(compensated(state).kind, 'head', 'exactly 18 ticks remains bounded and available');
  state.tick = 133;
  state.players[1].x += 5.4 / 120;
  recordLagCompensation(state);
  assert.deepEqual(compensated(state), current(state), 'expired metadata falls back instead of clamping to the oldest frame');
});

test('missing metadata clears a previously accepted view tick for old clients', () => {
  const state = recordPath(makeState(), 100, 120, tick => ({ x: (tick - 114) * 5.4 / 120 }));
  setShotViewTick(state, 0, 114);
  assert.equal(compensated(state).kind, 'head');
  setShotViewTick(state, 0, undefined);
  assert.deepEqual(compensated(state), current(state));
});

test('unenabled browser/practice state and enabled state without metadata retain trace parity', () => {
  const state = makeState();
  assert.equal(setShotViewTick(state, 0, 100), false);
  recordLagCompensation(state);
  assert.deepEqual(compensated(state), current(state));
  assert.deepEqual(getLagCompensationDiagnostics(state), { enabled: false });
  enableLagCompensation(state);
  recordLagCompensation(state);
  assert.deepEqual(compensated(state), current(state));
});

for (const [label, update] of [
  ['phase', state => { state.phase = 'roundEnd'; }],
  ['round', state => { state.round++; }],
  ['match', state => { state.matchId++; }],
  ['map id', state => { state.mapId = 'other'; }],
  ['map object', state => { state.map = { ...arena }; }],
]) test(`${label} changes discard prior shot metadata and history`, () => {
  const state = recordPath(makeState(), 100, 120, tick => ({ x: (tick - 114) * 5.4 / 120 }));
  setShotViewTick(state, 0, 114);
  update(state);
  assert.deepEqual(compensated(state), current(state));
  assert.equal(getLagCompensationDiagnostics(state).frameCount, 0);
  assert.equal(getLagCompensationDiagnostics(state).viewCount, 0);
});

test('dead actors cannot return from history or block a living target', () => {
  const state = makeState();
  state.players.push(actor(2, { z: -15 }));
  recordPath(state, 100, 120, tick => ({ x: (tick - 114) * 5.4 / 120 }));
  state.players[1].alive = false;
  setShotViewTick(state, 0, 114);
  assert.equal(compensated(state).playerId, 2);
});

test('revived actors cannot reuse a previous life pose', () => {
  const state = recordPath(makeState(), 100, 120, tick => ({ x: (tick - 114) * 5.4 / 120 }));
  state.tick++;
  state.players[1].alive = false;
  recordLagCompensation(state);
  state.tick++;
  state.players[1].alive = true;
  recordLagCompensation(state);
  setShotViewTick(state, 0, 114);
  assert.deepEqual(compensated(state), current(state));
});

for (const [label, update] of [
  ['new spawn object', state => { state.players[1] = { ...state.players[1] }; }],
  ['team switch', state => { state.players[1].team = 0; }],
  ['teleport', state => { state.players[1].x += 5; }],
]) test(`a target ${label} prevents rewinding into its previous context`, () => {
  const state = recordPath(makeState(), 100, 120, tick => ({ x: (tick - 114) * 5.4 / 120 }));
  setShotViewTick(state, 0, 114);
  update(state);
  assert.deepEqual(compensated(state), current(state), 'changes after capture are protected');
  state.tick++;
  recordLagCompensation(state);
  setShotViewTick(state, 0, 114);
  assert.deepEqual(compensated(state), current(state), 'changes captured on the next tick remain protected');
});

test('a historical player removed from membership is never added back', () => {
  const state = recordPath(makeState(), 100, 120, tick => ({ x: (tick - 114) * 5.4 / 120 }));
  state.players.pop();
  setShotViewTick(state, 0, 114);
  assert.deepEqual(compensated(state), current(state));
});

test('a shooter new life clears held view metadata', () => {
  const state = recordPath(makeState(), 100, 120, tick => ({ x: (tick - 114) * 5.4 / 120 }));
  setShotViewTick(state, 0, 114);
  state.players[0] = { ...state.players[0] };
  state.tick++;
  recordLagCompensation(state);
  assert.equal(getLagCompensationDiagnostics(state).viewCount, 0);
  assert.deepEqual(compensated(state), current(state));
});

test('recording must align the actual current physical tick before compensation is available', () => {
  const state = recordPath(makeState(), 100, 120, tick => ({ x: (tick - 114) * 5.4 / 120 }));
  setShotViewTick(state, 0, 114);
  state.tick++;
  assert.deepEqual(compensated(state), current(state), 'unrecorded movement ticks cannot use old capture as current authority');
  recordLagCompensation(state);
  assert.equal(compensated(state).kind, 'head');
});

test('clock reversal drops history instead of reusing future poses', () => {
  const state = recordPath(makeState(), 100, 120, tick => ({ x: (tick - 114) * 5.4 / 120 }));
  setShotViewTick(state, 0, 114);
  state.tick = 118;
  recordLagCompensation(state);
  assert.deepEqual(compensated(state), current(state));
  assert.equal(getLagCompensationDiagnostics(state).frameCount, 1);
  assert.equal(getLagCompensationDiagnostics(state).viewCount, 0);
});

test('ten-player history at 120 Hz remains private, bounded and cheap over a long run', () => {
  const state = makeState();
  state.gameId = 'voxel-royale';
  state.players = Array.from({ length: 10 }, (_, id) => actor(id, { x: id * 2, z: id ? -10 - id : 0 }));
  enableLagCompensation(state);
  const initialKeys = Object.keys(state);
  const started = performance.now();
  for (let tick = 100; tick < 12100; tick++) {
    state.tick = tick;
    for (let id = 1; id < 10; id++) state.players[id].x += .005;
    recordLagCompensation(state);
    if (tick >= 106) {
      setShotViewTick(state, 0, tick - 6);
      compensated(state);
    }
  }
  const elapsed = performance.now() - started, diagnostics = getLagCompensationDiagnostics(state);
  assert.ok(elapsed < 5000, `${elapsed.toFixed(1)} ms for 100 seconds of ten-player simulation and traces`);
  assert.equal(diagnostics.frameCount, MAX_REWIND_TICKS + 1);
  assert.equal(diagnostics.newestTick - diagnostics.oldestTick, MAX_REWIND_TICKS);
  assert.deepEqual(Object.keys(state), initialKeys, 'WeakMap history does not enter snapshots');
  diagnostics.frameCount = 0;
  assert.equal(getLagCompensationDiagnostics(state).frameCount, MAX_REWIND_TICKS + 1, 'diagnostics expose copied values');
});
