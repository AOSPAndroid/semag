import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, emptyInput, predictLocalMovement, sweepPresentationOffset, WEAPONS } from '../public/voxel-engine.js';
import { createCorrectionPresenter, createMovementPresenter, projectedMovement, reconcileMovement, resolvePresentationContacts } from '../public/voxel-presentation.js';
import { createNetworkTimeline } from '../public/network-timeline.js';
import { interpolatedState as breachState } from '../public/voxel-client.js';
import { interpolatedState as royaleState } from '../public/voxel-royale-client.js';

const map = { id: 'network-test', bounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 }, colliders: [] };
const speed = WEAPONS.carbine.speed;
const buttons = { ...emptyInput(), right: true };
const actor = (id, changes = {}) => ({ ...createCombatPlayer(id), weapon: 'carbine', x: id === 0 ? -100 : 0, vx: speed, previousInput: { ...buttons }, ...changes });
const state = (tick, changes = {}) => ({ gameId: 'voxel-breach', tick, phase: 'fight', round: 1, matchId: 1, mapId: map.id, map,
  players: [actor(0), actor(1, { x: speed * tick / 120 })], bolts: [], events: [], ...changes });
const predict = (player, input, _map, ticks, peers) => predictLocalMovement(player, input, map, ticks, peers);
const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) <= epsilon, `${a} versus ${b}`);

for (const [name, interpolate] of [['Breach', breachState], ['Royale', royaleState]]) for (const hz of [60, 120, 144, 240]) {
  test(`${name} ${hz} Hz opponents retain constant movement through variable packet arrival delays`, () => {
    const timeline = createNetworkTimeline({ snapshotTicks: 4 });
    const arrivals = Array.from({ length: 120 }, (_, index) => ({ tick: index * 4, time: index * 1000 / 30 + 10 + [0, 8, 20, 3][index % 4] }));
    let index = 0, samples = [], previousX, previousTime;
    for (let frame = 0; frame < 4 * hz; frame++) {
      const now = frame * 1000 / hz;
      while (index < arrivals.length && arrivals[index].time <= now) {
        const arrival = arrivals[index++]; samples.push(timeline.sample(state(arrival.tick), arrival.time, 'fight')); if (samples.length > 12) samples.shift();
      }
      const before = JSON.stringify(samples);
      const rendered = interpolate(samples, timeline.time(now), 0, { predictMovement: predict });
      assert.equal(JSON.stringify(samples), before, 'drawing never changes received snapshots');
      if (!rendered) continue;
      const x = rendered.players[1].x;
      if (previousX !== undefined && now > 500 && now < 3900) {
        const rate = (x - previousX) / (speed * (now - previousTime) / 1000);
        assert.ok(rate >= .9399 && rate <= 1.0601, `opponent speed ratio ${rate}`);
      }
      previousX = x; previousTime = now;
    }
  });
}

test('buffered transforms keep newest health, deaths, events and projectile membership immediate', () => {
  const old = state(0), middle = state(4), newest = state(8);
  newest.players[1].hp = 41;
  newest.events = [{ id: 7, type: 'damage', targetId: 1 }];
  old.bolts = middle.bolts = [{ id: 1, playerId: 0, bornTick: 0, x: 0, y: 1, z: 0, vx: 1, vy: 0, vz: 0 }];
  const samples = [{ time: 0, state: old }, { time: 1000 / 30, state: middle }, { time: 2000 / 30, state: newest }];
  for (const interpolate of [breachState, royaleState]) {
    const rendered = interpolate(samples, 1000 / 60, 0);
    near(rendered.players[1].x, speed / 60);
    assert.equal(rendered.players[1].hp, 41);
    assert.equal(rendered.events, newest.events);
    assert.deepEqual(rendered.bolts, [], 'an already hit projectile cannot return from the display buffer');
    newest.players[1].alive = false;
    assert.equal(interpolate(samples, 1000 / 60, 0).players[1].alive, false);
    newest.players[1].alive = true;
  }
});

test('a buffered opponent body cannot delay or restore authoritative combat actions', () => {
  const idle = state(0), middle = state(4), newest = state(8);
  Object.assign(newest.players[1], { reloadTicks: 190, healTicks: 230, healStartTick: 7, grenadeThrowTicks: 22, meleeTicks: 30, meleeCooldown: 50, meleePhase: 'startup', aiming: true, aimTicks: 2, recoil: .08 });
  const samples = [{ time: 0, state: idle }, { time: 1000 / 30, state: middle }, { time: 2000 / 30, state: newest }];
  for (const interpolate of [breachState, royaleState]) {
    const started = interpolate(samples, 1000 / 60, 0).players[1];
    for (const field of ['reloadTicks', 'healTicks', 'grenadeThrowTicks', 'meleeTicks', 'meleeCooldown', 'aimTicks', 'recoil']) assert.equal(started[field], newest.players[1][field], field);
    Object.assign(middle.players[1], newest.players[1]);
    Object.assign(newest.players[1], { reloadTicks: 0, healTicks: 0, grenadeThrowTicks: 0, meleeTicks: 0, meleeCooldown: 0, meleePhase: 'idle', aiming: false, aimTicks: 0, recoil: 0 });
    const finished = interpolate(samples, 1000 / 60, 0).players[1];
    for (const field of ['reloadTicks', 'healTicks', 'grenadeThrowTicks', 'meleeTicks', 'meleeCooldown', 'aimTicks', 'recoil']) assert.equal(finished[field], 0, field);
    assert.equal(finished.meleePhase, 'idle');
    Object.assign(newest.players[1], { reloadTicks: 190, healTicks: 230, healStartTick: 7, grenadeThrowTicks: 22, meleeTicks: 30, meleeCooldown: 50, meleePhase: 'startup', aiming: true, aimTicks: 2, recoil: .08 });
    middle.players[1] = actor(1, { x: speed * 4 / 120 });
  }
});

test('interpolating a body around a cover corner uses the actual sweep instead of cutting through cover', () => {
  const corner = { ...map, colliders: [{ x: 0, y: 0, z: 0, w: 1, h: 3, d: 1 }] };
  const before = state(0, { map: corner }), after = state(4, { map: corner });
  Object.assign(before.players[1], { x: -.4, z: .8 });
  Object.assign(after.players[1], { x: .8, z: -.4 });
  const original = structuredClone({ before, after });
  for (const interpolate of [breachState, royaleState]) {
    const player = interpolate([{ time: 0, state: before }, { time: 1000 / 30, state: after }], 1000 / 60, 0).players[1];
    const nearestX = Math.max(0, Math.min(1, player.x)), nearestZ = Math.max(0, Math.min(1, player.z));
    assert.ok(Math.hypot(player.x - nearestX, player.z - nearestZ) >= player.radius - 1e-6);
    assert.equal(player.hp, after.players[1].hp);
  }
  assert.deepEqual({ before, after }, original);
});

test('both network clients resolve mutually approaching projected bodies as one immutable display batch', () => {
  const source = state(0);
  source.players = [actor(0, { x: 5, vx: 0 }),
    actor(1, { x: 0, z: .335, vx: 0, vz: -5.4, yaw: 0, previousInput: { ...emptyInput(), up: true } }),
    actor(2, { x: 0, z: -.335, vx: 0, vz: 5.4, yaw: Math.PI, previousInput: { ...emptyInput(), up: true, yaw: Math.PI } })];
  const before = structuredClone(source);
  for (const interpolate of [breachState, royaleState]) for (const milliseconds of [6.25, 8.25, 25]) {
    const view = interpolate([{ time: 0, state: source }], milliseconds, 0, { predictMovement: predictLocalMovement });
    const a = view.players.find(player => player.id === 1), b = view.players.find(player => player.id === 2);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= a.radius + b.radius - 1e-6, `${milliseconds}ms body gap`);
    assert.equal(a.hp, source.players[1].hp); assert.equal(b.hp, source.players[2].hp);
    const projectedA = projectedMovement({ ...source.players[1] }, source.players[1].previousInput, map, milliseconds, predictLocalMovement, source.players, source.players[1]);
    const projectedB = projectedMovement({ ...source.players[2] }, source.players[2].previousInput, map, milliseconds, predictLocalMovement, source.players, source.players[2]);
    assert.equal(a.vz, projectedA.vz); assert.equal(b.vz, projectedB.vz, 'batch contact does not change projected velocity');
    const reversed = { ...source, players: [...source.players].reverse() };
    const reordered = interpolate([{ time: 0, state: reversed }], milliseconds, 0, { predictMovement: predictLocalMovement });
    for (const player of view.players) assert.deepEqual(reordered.players.find(other => other.id === player.id), player);
  }
  assert.deepEqual(source, before);
});

test('local camera and remote previews share the same display contact batch', () => {
  const a = actor(0, { x: 0, z: .335, vx: 0, vz: -5.4, yaw: 0, previousInput: { ...emptyInput(), up: true } });
  const b = actor(1, { x: 0, z: -.335, vx: 0, vz: 5.4, yaw: Math.PI, previousInput: { ...emptyInput(), up: true, yaw: Math.PI } });
  const authority = [a, b], before = structuredClone(authority);
  const preview = authority.map(player => createMovementPresenter()(player, player.previousInput, map, .99 / 120, predictLocalMovement, authority));
  assert.ok(preview[0].z - preview[1].z < .64, 'fixture reproduces independently previewed overlap');
  const displayed = resolvePresentationContacts(preview, map);
  assert.ok(displayed[0].z - displayed[1].z >= .64 - 1e-6);
  for (let index = 0; index < authority.length; index++) for (const field of Object.keys(preview[index]).filter(field => !['x', 'y', 'z'].includes(field))) assert.deepEqual(displayed[index][field], preview[index][field], field);
  assert.deepEqual(authority, before);
});

test('display body contact ignores eliminated and vertically separated opponents', () => {
  const a = actor(1, { x: 0, z: .31 }), b = actor(2, { x: 0, z: -.31 });
  for (const change of [{ alive: false }, { y: 2 }]) {
    const bodies = [a, { ...b, ...change }], before = structuredClone(bodies);
    assert.deepEqual(resolvePresentationContacts(bodies, map), before);
    assert.deepEqual(bodies, before);
  }
});

test('local replay uses independent simulation ticks even when a heartbeat acknowledges a much larger packet sequence', () => {
  const player = actor(1, { vx: 0 });
  const history = [101, 102, 103].map((tick, index) => ({ tick, seq: index + 1, buttons: { ...buttons } }));
  const before = structuredClone({ player, history });
  const replayed = reconcileMovement(player, history, 900, map, predictLocalMovement, true, [], 100);
  const expected = structuredClone(player); predictLocalMovement(expected, buttons, map, 3);
  assert.deepEqual(replayed.predicted, expected);
  assert.equal(replayed.predictionTick, 103);
  assert.deepEqual(replayed.pending.map(frame => frame.tick), [101, 102, 103]);
  const afterTwo = structuredClone(player); predictLocalMovement(afterTwo, buttons, map, 2);
  const newest = reconcileMovement(afterTwo, history, 901, map, predictLocalMovement, true, [], 102);
  assert.deepEqual(newest.predicted, expected, 'already simulated ticks are not applied twice');
  assert.deepEqual(newest.pending.map(frame => frame.tick), [103]);
  assert.deepEqual({ player, history }, before);
});

test('a fresh predicted jump survives replay once; held jump never starts a second jump', () => {
  const player = actor(1, { vx: 0, previousInput: emptyInput() });
  const input = { ...emptyInput(), jump: true };
  const history = [21, 22, 23].map(tick => ({ tick, buttons: input }));
  const result = reconcileMovement(player, history, 999, map, predictLocalMovement, true, [], 20);
  const expected = structuredClone(player); predictLocalMovement(expected, input, map, 3);
  assert.deepEqual(result.predicted, expected);
  assert.ok(result.predicted.y > 0);
  const authoritative = structuredClone(player); predictLocalMovement(authoritative, input, map, 2);
  assert.deepEqual(reconcileMovement(authoritative, history, 1000, map, predictLocalMovement, true, [], 22).predicted, expected);
});

for (const hz of [60, 120, 144, 240]) test(`local correction decays with elapsed time at ${hz} Hz without filtering aim or gameplay`, () => {
  const correction = createCorrectionPresenter();
  const before = actor(1, { x: 0 }), player = actor(1, { x: .12, yaw: 1.4, pitch: -.6, hp: 82, ammo: 3 });
  const original = structuredClone(player);
  assert.equal(correction.correct(before, player, 100), true);
  near(correction.present(player, 100, sweepPresentationOffset, map).x, 0);
  let pose;
  for (let frame = 1; frame <= hz; frame++) pose = correction.present(player, 100 + frame * 1000 / hz, sweepPresentationOffset, map);
  near(pose.x, player.x);
  assert.equal(pose.yaw, 1.4); assert.equal(pose.pitch, -.6); assert.equal(pose.hp, 82); assert.equal(pose.ammo, 3);
  assert.deepEqual(player, original);
  const half = createCorrectionPresenter(); half.correct(before, player, 100);
  near(half.present(player, 140, sweepPresentationOffset, map).x, .06);
});

test('correction offsets sweep against walls, floor, ceiling and living players', () => {
  const cases = [
    { player: actor(1, { x: 0 }), before: actor(1, { x: .3 }), map: { ...map, colliders: [{ x: .5, y: 0, z: -1, w: .1, h: 4, d: 2 }] }, axis: 'x', limit: .5 - .32 },
    { player: actor(1, { x: 0 }), before: actor(1, { x: 0, y: -.1 }), map, axis: 'y', minimum: 0 },
    { player: actor(1, { x: 0 }), before: actor(1, { x: 0, y: .3 }), map: { ...map, colliders: [{ x: -1, y: 2, z: -1, w: 2, h: .2, d: 2 }] }, axis: 'y', limit: .2 },
    { player: actor(1, { x: -.3 }), before: actor(1, { x: .05 }), map, peers: [actor(2, { x: .6 })], axis: 'x', limit: -.04 },
  ];
  for (const entry of cases) {
    const correction = createCorrectionPresenter(), original = structuredClone({ player: entry.player, peers: entry.peers });
    correction.correct(entry.before, entry.player, 100);
    const pose = correction.present(entry.player, 100, sweepPresentationOffset, entry.map, entry.peers || []);
    if ('limit' in entry) assert.ok(pose[entry.axis] <= entry.limit + 1e-6);
    if ('minimum' in entry) assert.ok(pose[entry.axis] >= entry.minimum - 1e-6);
    assert.deepEqual({ player: entry.player, peers: entry.peers }, original);
  }
});

test('death, team change, phase change and teleport cancel display correction immediately', () => {
  const before = actor(1, { x: 0 }), after = actor(1, { x: .1 });
  for (const change of [{ alive: false }, { team: 0 }, { id: 7 }, { x: 2 }]) {
    const correction = createCorrectionPresenter(); correction.correct(before, after, 100);
    const next = { ...after, ...change };
    assert.equal(correction.correct(after, next, 110), false);
    assert.deepEqual(correction.getState().offset, { x: 0, y: 0, z: 0 });
  }
  const correction = createCorrectionPresenter(); correction.correct(before, after, 100);
  assert.equal(correction.correct(after, before, 110, { continuous: false }), false);
  near(correction.present(before, 110, sweepPresentationOffset, map).x, before.x);
});
