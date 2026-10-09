import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, predictLocalMovement, traceShot } from '../public/voxel-engine.js';
import { advanceMonsterSpecials, launchMonsterShard, markMonsterRune, MONSTER_SPECIAL_RULES as rules } from '../public/voxel-monster-specials.js';
import { interpolatedVoxelState } from '../public/voxel-presentation.js';

const map = { id: 'monster-network-fixture', bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, colliders: [] };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} versus ${expected}`);
function fixture() {
  const players = Array.from({ length: 5 }, (_, id) => Object.assign(createCombatPlayer(id), { alive: false, lifeId: 1, x: 15 + id, z: 15 }));
  Object.assign(players[0], { alive: true, human: true, connected: true, participating: true, x: 12, z: 12 });
  Object.assign(players[3], { alive: true, human: false, monster: true, monsterType: 'spitter', lifeId: 7, x: 0, z: 0 });
  Object.assign(players[4], { alive: true, human: false, monster: true, monsterType: 'weaver', lifeId: 8 });
  return { gameId: 'voxel-horde', phase: 'fight', round: 1, matchId: 1, mapId: map.id, map, tick: 1200, eventId: 0, events: [], players, bolts: [], horde: { projectiles: [], hazards: [], specialId: 0, wave: 6, teamstats: { damage: 314 } } };
}
function advance(state, ticks) {
  const hits = [];
  for (let tick = 0; tick < ticks; tick++) { state.tick++; hits.push(...advanceMonsterSpecials(state, map)); }
  return hits;
}
function received() {
  const state = fixture(), samples = [];
  assert.equal(launchMonsterShard(state, state.players[3], 0, 0), true);
  assert.equal(markMonsterRune(state, state.players[4], state.players[0], map), true);
  for (let packet = 0; packet <= 6; packet++) {
    samples.push({ time: packet * 1000 / 30, state: structuredClone(state) });
    if (packet < 6) advance(state, 4);
  }
  return samples;
}
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

for (const hz of [60, 144]) test(`actual 30 Hz monster shards move continuously at ${hz} Hz while timers, runes and gameplay stay newest`, () => {
  const samples = received(), newest = samples.at(-1).state, before = structuredClone(samples);
  freeze(samples);
  let previous;
  for (let frame = 0; frame <= Math.floor(hz / 5); frame++) {
    const time = frame * 1000 / hz, view = interpolatedVoxelState(samples, time, 0), shard = view.horde.projectiles[0];
    near(shard.x, 0); near(shard.y, 1.1); near(shard.z, -rules.shardSpeed * time / 1000);
    if (previous !== undefined) near(previous - shard.z, rules.shardSpeed / hz);
    for (const field of ['id', 'sourceId', 'sourceLifeId', 'spawnTick', 'dx', 'dy', 'dz', 'ticksLeft', 'lifeTicks']) assert.equal(shard[field], newest.horde.projectiles[0][field], field);
    assert.deepEqual(view.horde.hazards, newest.horde.hazards, 'fixed warning position and authoritative countdown');
    assert.equal(view.tick, newest.tick); assert.equal(view.horde.wave, newest.horde.wave);
    assert.equal(view.horde.teamstats.damage, 314); assert.equal(view.players[0].hp, newest.players[0].hp);
    previous = shard.z;
  }
  const commonTime = (hz === 60 ? 5 : 12) * 1000 / hz;
  near(interpolatedVoxelState(samples, commonTime, 0).horde.projectiles[0].z, -.625, 'the same midpoint between two packets');
  assert.deepEqual(samples, before);
});

test('the selected older bracket controls position while the newest shard lifetime remains authoritative', () => {
  const samples = received(), view = interpolatedVoxelState(samples, 50, 0), newest = samples.at(-1).state;
  near(view.horde.projectiles[0].z, -.375);
  assert.equal(view.horde.projectiles[0].ticksLeft, newest.horde.projectiles[0].ticksLeft);
  assert.equal(view.horde.hazards[0].ticksLeft, newest.horde.hazards[0].ticksLeft);
  assert.equal(view.events, newest.events);
});

test('real shard impact, expiry and caster-life cancellation disappear immediately even when displaying an older bracket', () => {
  for (const removal of ['impact', 'expiry', 'caster-life']) {
    const state = fixture();
    if (removal === 'impact') Object.assign(state.players[0], { x: 0, z: -.4 });
    launchMonsterShard(state, state.players[3], 0, 0);
    const old = structuredClone(state);
    if (removal === 'expiry') state.horde.projectiles[0].ticksLeft = 1;
    if (removal === 'caster-life') state.players[3].lifeId++;
    const hits = advance(state, 4);
    assert.equal(state.horde.projectiles.length, 0, removal);
    if (removal === 'impact') { assert.equal(hits.length, 1); assert.equal(hits[0].weapon, 'spitter'); }
    const samples = [{ time: 0, state: old }, { time: 1000 / 30, state }], before = structuredClone(samples);
    assert.deepEqual(interpolatedVoxelState(samples, 1, 0).horde.projectiles, []);
    assert.deepEqual(samples, before);
  }
});

test('newly spawned shards and rune markers are displayed immediately rather than being delayed into the transform buffer', () => {
  const samples = received(), newest = samples.at(-1).state;
  const oldIds = newest.horde.projectiles.map(projectile => projectile.id);
  newest.players[3].x = 8;
  launchMonsterShard(newest, newest.players[3], .4, .1);
  newest.players[0].x = 18;
  markMonsterRune(newest, newest.players[4], newest.players[0], map);
  const view = interpolatedVoxelState(samples, 16, 0);
  const fresh = newest.horde.projectiles.find(projectile => !oldIds.includes(projectile.id));
  assert.deepEqual(view.horde.projectiles.find(projectile => projectile.id === fresh.id), fresh);
  assert.deepEqual(view.horde.hazards, newest.horde.hazards);
});

test('a recycled special ID cannot blend another caster, caster life or newly launched physical shard', () => {
  for (const changed of [{ id: 99 }, { sourceId: 4 }, { sourceLifeId: 8 }, { spawnTick: 1224 }]) {
    const state = fixture(); launchMonsterShard(state, state.players[3], 0, 0);
    const old = structuredClone(state); advance(state, 4);
    Object.assign(state.horde.projectiles[0], changed, { x: 9, y: 2, z: 7 });
    const view = interpolatedVoxelState([{ time: 0, state: old }, { time: 1000 / 30, state }], 1000 / 60, 0);
    assert.deepEqual(view.horde.projectiles[0], state.horde.projectiles[0], JSON.stringify(changed));
  }
});

test('a dead same-life spitter can leave a real in-flight shard whose position still smooths', () => {
  const state = fixture(); launchMonsterShard(state, state.players[3], 0, 0);
  const old = structuredClone(state); state.players[3].alive = false; advance(state, 4);
  assert.equal(state.horde.projectiles.length, 1, 'authority preserves the already launched physical projectile');
  const view = interpolatedVoxelState([{ time: 0, state: old }, { time: 1000 / 30, state }], 1000 / 60, 0);
  near(view.horde.projectiles[0].z, -.125); assert.equal(view.players[3].alive, false);
});

test('match, map, round and phase changes stop blending an old special context', () => {
  for (const changed of [{ matchId: 2 }, { mapId: 'different-map' }, { round: 2 }, { phase: 'intermission' }, { phase: 'paused' }, { phase: 'matchEnd' }]) {
    const samples = received(), newest = samples.at(-1).state;
    Object.assign(newest, changed);
    const view = interpolatedVoxelState(samples, 16, 0);
    assert.deepEqual(view.horde.projectiles, newest.horde.projectiles, JSON.stringify(changed));
    assert.deepEqual(view.horde.hazards, newest.horde.hazards);
  }
});

test('stationary runes disappear with newest cancellation and no shard position extrapolates past received authority', () => {
  const samples = received(), newest = samples.at(-1).state;
  newest.horde.hazards = [];
  assert.deepEqual(interpolatedVoxelState(samples, 16, 0).horde.hazards, []);
  for (const time of [200, 210, 5000]) {
    const view = interpolatedVoxelState(samples, time, 0, { predictMovement: predictLocalMovement, traceProjectile: traceShot });
    assert.deepEqual(view.horde.projectiles, newest.horde.projectiles, `${time}: no speculative shard travel`);
  }
});

test('special presentation copies are bounded and cannot modify authoritative projectile or warning objects', () => {
  const state = fixture();
  for (let index = 0; index < 40; index++) {
    state.horde.projectiles.push({ id: index + 1, sourceId: 3, sourceLifeId: 7, spawnTick: state.tick, x: index, y: 1, z: 0, ticksLeft: 600, lifeTicks: 600, dx: 0, dy: 0, dz: -1 });
    state.horde.hazards.push({ id: 100 + index, x: index, y: 0, z: 5, ticksLeft: 108, lifeTicks: 108 });
  }
  const original = structuredClone(state), samples = [{ time: 0, state }]; freeze(state);
  const view = interpolatedVoxelState(samples, 0, 0);
  assert.equal(view.horde.projectiles.length, rules.maxProjectiles); assert.equal(view.horde.hazards.length, rules.maxHazards);
  view.horde.projectiles[0].x = 900; view.horde.projectiles[0].ticksLeft = 1; view.horde.hazards[0].ticksLeft = 1;
  assert.deepEqual(state, original);
});

test('a missing special pool preserves legacy Horde snapshots and unrelated gun and bolt presentation', () => {
  const state = fixture(); delete state.horde.projectiles; delete state.horde.hazards;
  state.bolts = [{ id: 5, playerId: 0, bornTick: 1, x: 1, y: 1, z: 1, vx: 0, vy: 0, vz: 0 }];
  state.players[0].ammo = 3; state.players[0].damageDealt = 27;
  const old = structuredClone(state); state.bolts[0].x = 3;
  const view = interpolatedVoxelState([{ time: 0, state: old }, { time: 1000 / 30, state }], 1000 / 60, 0);
  assert.deepEqual(view.horde.projectiles, []); assert.deepEqual(view.horde.hazards, []);
  near(view.bolts[0].x, 2); assert.equal(view.players[0].ammo, 3); assert.equal(view.players[0].damageDealt, 27);
});
