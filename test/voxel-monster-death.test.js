import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, applyCombatDamage, traceShot } from '../public/voxel-engine.js';
import * as Horde from '../public/voxel-horde-engine.js';
import { monsterTypeId } from '../public/voxel-monster-bodies.js';
import { MONSTER_DEATH_RULES, monsterDeathPose, createMonsterDeathPresenter } from '../public/voxel-monster-death.js';
import { monsterDeathMeshes, VoxelRenderer } from '../public/voxel-renderer.js';

const TYPES = Object.keys(Horde.MONSTER_TYPES);
const arena = { id: 'monster-death-fixture', theme: 'custom', colliders: [], sites: [], bounds: { minX: -24, maxX: 24, minZ: -24, maxZ: 24 } };
const creature = (type = 'stalker', patch = {}) => ({ ...createCombatPlayer(1, 1, 'carbine'), monster: true, human: false, monsterType: type, lifeId: 17, x: 0, y: 0, z: -5, yaw: .6, hp: 40, maxHp: 40, slot: 'empty', ...patch });
function fixture(type = 'stalker', patch = {}) {
  const state = Horde.createState({ capacity: 1, seed: 7159 });
  state.phase = 'fight'; state.tick = 100; state.map = arena;
  state.players = [{ ...state.players[0], x: -3, y: 0, z: 0, participating: true }, creature(type, patch)]; state.fighters = state.players;
  return state;
}
function kill(state, patch = {}) {
  state.tick++;
  const victim = state.players[1];
  applyCombatDamage(state, [{ playerId: 0, targetId: 1, targetLifeId: victim.lifeId, attack: 'gun', weapon: 'carbine', damage: victim.hp, dx: .25, dy: .1, dz: -1, ...patch }]);
  return state.events.findLast(event => event.type === 'kill');
}
function primed(type = 'stalker', patch = {}) {
  const state = fixture(type, patch), present = createMonsterDeathPresenter();
  assert.equal(present(state, 0).length, 0);
  return { state, present };
}
function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
function harness() {
  const uploads = [], draws = [];
  let depthTest = false, depthWrite = true;
  const gl = new Proxy({}, { get(_, key) {
    if (typeof key === 'string' && key === key.toUpperCase()) return key;
    if (key === 'enable') return capability => { if (capability === 'DEPTH_TEST') depthTest = true; };
    if (key === 'disable') return capability => { if (capability === 'DEPTH_TEST') depthTest = false; };
    if (key === 'depthMask') return value => { depthWrite = value; };
    if (key === 'drawArrays') return (_mode, _first, count) => draws.push({ depthTest, depthWrite, count });
    if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
    if (key === 'getAttribLocation') return () => 0;
    if (key === 'getUniformLocation') return (_program, uniform) => uniform;
    if (typeof key === 'string' && key.startsWith('create')) return () => ({});
    return () => {};
  } });
  const renderer = new VoxelRenderer({ getContext: () => gl, getBoundingClientRect: () => ({ width: 960, height: 540 }), addEventListener() {}, removeEventListener() {} });
  const upload = renderer._dynamic;
  renderer._dynamic = function(array, kind = 'world') { uploads.push({ kind, mesh: array.slice() }); return upload.call(this, array, kind); };
  const draw = (state, time, options = {}) => { uploads.length = 0; draws.length = 0; renderer.render(state, { localId: 0, time, hideWeapon: true, ...options }); return uploads.find(item => item.kind === 'world')?.mesh || new Float32Array(); };
  return { renderer, uploads, draws, draw };
}

test('each actual lethal monster contact preserves its old life and pose while death takes effect immediately', () => {
  for (const type of TYPES) {
    const state = fixture(type), victim = state.players[1], source = { x: victim.x, y: victim.y, z: victim.z, yaw: victim.yaw, lifeId: victim.lifeId };
    assert.equal(monsterTypeId(victim), type);
    const event = kill(state);
    assert.equal(victim.alive, false); assert.equal(victim.hp, 0); assert.equal(victim.deaths, 1);
    assert.equal(state.players[0].kills, 1); assert.equal(state.players[0].damageDealt, 40);
    assert.equal(event.monsterType, type); assert.equal(event.targetLifeId, source.lifeId);
    for (const field of ['x', 'y', 'z', 'yaw']) assert.equal(event[field], source[field]);
    assert.deepEqual([event.dx, event.dy, event.dz], [.25, .1, -1]);
    applyCombatDamage(state, [{ playerId: 0, targetId: 1, damage: 100 }]);
    assert.equal(state.events.filter(item => item.type === 'kill').length, 1, 'an already dead corpse cannot be killed again');
    const trace = traceShot(state, 0, { x: 0, y: .55, z: 0 }, { x: 0, y: 0, z: -1 }, 10, arena);
    assert.notEqual(trace.playerId, victim.id, 'the visual corpse never remains shootable');
  }
});

test('nonlethal damage, stale-life damage, human actors and other voxel modes do not manufacture monster death metadata', () => {
  const state = fixture();
  applyCombatDamage(state, [{ playerId: 0, targetId: 1, targetLifeId: 16, damage: 1000 }]);
  assert.equal(state.players[1].hp, 40); assert.equal(state.events.length, 0);
  applyCombatDamage(state, [{ playerId: 0, targetId: 1, damage: 1 }]);
  assert.equal(state.players[1].hp, 39); assert.equal(state.events.some(event => event.type === 'kill'), false);
  for (const patch of [{ human: true }, { monster: false }, { monsterType: '__proto__' }, { monsterType: 'not-a-monster' }]) {
    const actor = creature('stalker', patch); assert.equal(monsterTypeId(actor), null);
    const altered = fixture('stalker', patch), event = kill(altered);
    assert.equal(Object.hasOwn(event, 'monsterType'), false); assert.equal(Object.hasOwn(event, 'targetLifeId'), false);
  }
  for (const gameId of ['voxel-breach', 'voxel-royale']) {
    const altered = fixture(); altered.gameId = gameId;
    const event = kill(altered);
    assert.equal(Object.hasOwn(event, 'monsterType'), false); assert.equal(Object.hasOwn(event, 'targetLifeId'), false);
  }
});

test('Horde kill counts, fifth-kill potion reward and clear-wave transition do not wait for the death animation', () => {
  const state = Horde.createState({ capacity: 1, seed: 7159 }); Horde.startMatch(state);
  for (let tick = state.phaseTicks; tick > 0; tick--) Horde.step(state);
  state.map = arena; Object.assign(state.players[0], { x: 0, y: 0, z: 8 });
  state.horde.pending = 1; state.horde.nextSpawnTick = Number.MAX_SAFE_INTEGER;
  state.spawnWarnings = [{ id: 1, x: 0, y: 0, z: -8, ticksLeft: 1, monsterType: 'hound' }]; Horde.step(state);
  const victim = state.players[1]; assert.ok(victim?.monster); victim.emergenceTicks = 0;
  const present = createMonsterDeathPresenter(); present(state, 0);
  state.horde.killsSinceHeal = 4; state.horde.pending = 0;
  applyCombatDamage(state, [{ playerId: 0, targetId: victim.id, targetLifeId: victim.lifeId, damage: victim.hp, attack: 'gun', weapon: 'carbine' }]);
  Horde.step(state);
  assert.equal(state.phase, 'intermission'); assert.equal(state.horde.totalKills, 1); assert.equal(state.horde.teamstats.kills, 1);
  assert.ok(state.loot.some(item => item.kind === 'heal' && item.amount === 1), 'loot is available on the first game tick after death');
  assert.equal(present(state, 10).length, 1, 'the final monster still has a short visual confirmation after the wave clears');
});

test('only fresh authoritative lethal events create a corpse; initial history, dead snapshots and damage cues do not', () => {
  const initial = fixture(); kill(initial);
  const present = createMonsterDeathPresenter(); assert.equal(present(initial, 0).length, 0, 'joining mid-match cannot replay old kills');
  assert.equal(present(initial, 100).length, 0);
  const { state, present: clean } = primed(); state.players[1].alive = false; state.players[1].hp = 0;
  assert.equal(clean(state, 10).length, 0, 'a dead snapshot is not a new lethal event');
  state.eventId++; state.events.push({ id: state.eventId, tick: state.tick, type: 'damage', targetId: 1, hp: 0, damage: 40 });
  assert.equal(clean(state, 20).length, 0, 'an impact/zero-HP cue cannot independently duplicate a death');
});

test('an authoritative death is consumed once despite repeated snapshots and duplicate events for the same monster life', () => {
  const { state, present } = primed(), event = kill(state);
  const deaths = present(state, 10); assert.equal(deaths.length, 1);
  assert.equal(present(state, 20).length, 1); assert.equal(present(state, 30).length, 1);
  state.events.push({ ...event, id: ++state.eventId });
  assert.equal(present(state, 40).length, 1, 'one defeated life has one collapse even if a duplicate receives a different event ID');
  assert.equal(present(state, 2000).length, 0, 'the body expires within a short bounded interval');
  assert.equal(present(state, 2010).length, 0, 'retained snapshot history cannot resurrect expired corpses');
});

test('a recycled monster slot neither replaces the defeated silhouette nor inherits its animation', () => {
  const { state, present } = primed('hound'), old = kill(state);
  state.players[1] = creature('brute', { lifeId: 18, x: 10, z: 8 });
  state.fighters = state.players;
  const deaths = present(state, 10); assert.equal(deaths.length, 1);
  assert.equal(deaths[0].monsterType, 'hound'); assert.equal(deaths[0].lifeId, 17);
  for (const field of ['x', 'y', 'z']) assert.equal(deaths[0][field], old[field], 'old body remains at its actual death location');
  kill(state);
  const both = present(state, 20); assert.equal(both.length, 2);
  assert.equal(new Set(both.map(death => death.lifeId)).size, 2, 'the next life can die independently');
  assert.equal(state.players[1].monsterType, 'brute'); assert.equal(state.players[1].x, 10);
});

test('pause, repeated timestamps and first resumption retain the exact death pose without consuming wall time', () => {
  const { state, present } = primed(); kill(state); present(state, 100);
  const moving = present(state, 220)[0], age = moving.ageMs;
  assert.ok(age > 0);
  assert.equal(present(state, 220)[0].ageMs, age);
  state.phase = 'paused';
  assert.equal(present(state, 300)[0].ageMs, age);
  assert.equal(present(state, 6000)[0].ageMs, age);
  state.phase = 'fight'; assert.equal(present(state, 6100)[0].ageMs, age, 'resumption discards pause wall time');
  assert.ok(present(state, 6200)[0].ageMs > age);
  const before = present(state, 6200)[0].ageMs;
  assert.equal(present(state, 6300, { paused: true })[0].ageMs, before, 'local pause uses the same clock fence');
});

test('death motion is based on elapsed time across 30, 60, 144 and 240 Hz displays', () => {
  const poses = [], ages = [];
  for (const rate of [30, 60, 144, 240]) {
    const { state, present } = primed('runner'); kill(state); present(state, 100);
    for (let frame = 1; frame * 1000 / rate < 350; frame++) present(state, 100 + frame * 1000 / rate);
    const death = present(state, 450)[0]; assert.ok(death);
    poses.push(monsterDeathPose(death, death.ageMs)); ages.push(death.ageMs);
  }
  for (let index = 1; index < poses.length; index++) {
    assert.ok(Math.abs(ages[index] - ages[0]) < 1e-7);
    assert.deepEqual(poses[index], poses[0], 'refresh rate cannot accelerate or change the collapse');
  }
});

test('intermission and match end finish a pending death; new lobby/map/match/session and explicit reset discard history', () => {
  for (const phase of ['intermission', 'matchEnd']) {
    const { state, present } = primed(); kill(state); present(state, 100);
    state.phase = phase; assert.equal(present(state, 150).length, 1);
    assert.equal(present(state, 2000).length, 0);
  }
  for (const patch of [{ phase: 'lobby' }, { phase: 'countdown' }, { mapId: 'depot', map: { ...arena, id: 'different-map' } }, { matchId: 99 }, { gameId: 'voxel-royale' }]) {
    const { state, present } = primed(); kill(state); assert.equal(present(state, 10).length, 1);
    Object.assign(state, patch); assert.equal(present(state, 20).length, 0);
  }
  const { state, present } = primed(); kill(state); assert.equal(present(state, 10).length, 1);
  state.horde.sessionId++; assert.equal(present(state, 20).length, 0);
  present.reset(); assert.equal(present.getStats().activeCorpses, 0);
  assert.equal(present(state, 30).length, 0, 'reset primes from history instead of replaying previous kills');
});

test('malformed and unrelated events cannot create misleading death geometry', () => {
  for (const patch of [{ targetLifeId: 0 }, { targetLifeId: undefined }, { targetId: -1 }, { monsterType: '__proto__' }, { monsterType: undefined }, { x: NaN }, { y: Infinity }, { z: undefined }, { yaw: NaN }, { type: 'damage' }]) {
    const { state, present } = primed(), event = kill(state);
    Object.assign(event, patch);
    assert.equal(present(state, 10).length, 0, JSON.stringify(patch));
  }
});

test('a genuine lethal event first painted after a slow co-op frame still gets one complete death animation', () => {
  for (const delayTicks of [60, 120, 240]) for (const reusedSlot of [false, true]) {
    const { state, present } = primed('hound'), { renderer, draw } = harness();
    try {
      draw(state, 0); const event = kill(state);
      state.tick += delayTicks;
      if (reusedSlot) { state.players[1] = creature('brute', { lifeId: 18, x: 10, z: 8 }); state.fighters = state.players; }
      const firstPaint = delayTicks * 1000 / Horde.TICK_RATE;
      const deaths = present(state, firstPaint); draw(state, firstPaint);
      assert.equal(deaths.length, 1, `${delayTicks} ticks/reused ${reusedSlot}: a fresh unseen lethal event survives slow presentation`);
      assert.equal(deaths[0].ageMs, 0, 'the short collapse starts when the client can first show it');
      assert.equal(deaths[0].lifeId, 17); assert.equal(deaths[0].monsterType, 'hound');
      assert.equal(renderer.stats.monsterDeaths.activeCorpses, 1); assert.equal(renderer.stats.monsterDeaths.acceptedKills, 1);
      assert.ok(renderer.stats.monsterDeaths.vertices > 0, 'the genuine death reaches the actual WebGL world batch');
      state.events.push({ ...event, id: ++state.eventId });
      const repeated = { ...state, players: state.players.map(player => ({ ...player })), events: state.events.map(item => ({ ...item })) };
      assert.equal(present(repeated, firstPaint + 100).length, 1); draw(repeated, firstPaint + 100);
      assert.equal(present.getStats().acceptedKills, 1); assert.equal(renderer.stats.monsterDeaths.acceptedKills, 1);
      assert.equal(renderer.stats.monsterDeaths.geometryBuilds, 1, 'late repeated packets and duplicate life events cannot replay or rebuild the kill');
      assert.equal(present(repeated, firstPaint + MONSTER_DEATH_RULES.durationMs).length, 0);
      draw(repeated, firstPaint + MONSTER_DEATH_RULES.durationMs);
      assert.equal(renderer.stats.monsterDeaths.activeCorpses, 0, 'tolerating a delayed first paint cannot prolong the animation itself');
    } finally { renderer.destroy(); }
  }
});

test('genuinely expired unseen kills and future-dated kills remain rejected at the bounded freshness guard', () => {
  for (const scenario of ['expired', 'future']) {
    const { state, present } = primed(), event = kill(state);
    if (scenario === 'expired') state.tick = event.tick + MONSTER_DEATH_RULES.maxEventAgeTicks + 1;
    else event.tick = state.tick + 1;
    assert.equal(present(state, 10).length, 0, `${scenario}: invalid event timing cannot manufacture a corpse`);
    assert.equal(present.getStats().acceptedKills, 0);
    if (scenario === 'future') state.tick = event.tick;
    assert.equal(present(state, 20).length, 0, 'consumed invalid history cannot later turn into a fresh kill');
  }
});

test('a long stream of deaths remains bounded, and immutable source snapshots are never changed by presentation', () => {
  const { state, present } = primed();
  for (let index = 0; index < 75; index++) {
    state.players[1] = creature(TYPES[index % TYPES.length], { lifeId: index + 100 }); kill(state);
  }
  const frozen = freeze(structuredClone(state)), before = JSON.stringify(frozen);
  const deaths = present(frozen, 10);
  assert.ok(deaths.length > 0 && deaths.length <= 20);
  assert.equal(present.getStats().activeCorpses, deaths.length);
  for (const death of deaths) { monsterDeathPose(death, 250); monsterDeathMeshes(death, 250, arena); }
  assert.equal(JSON.stringify(frozen), before, 'positions, alive flags, hit boxes, loot, events and random state remain authoritative');
  assert.equal(present(frozen, 2000).length, 0);
  assert.ok(Object.isFrozen(MONSTER_DEATH_RULES), 'the shared duration and capacity cannot drift at runtime');
});

test('every monster has finite original voxel anatomy, visible collapse and a short dissolve without underground vertices or carried guns', () => {
  const signatures = new Set();
  for (const type of TYPES) {
    const { state, present } = primed(type, { y: 3, weapon: 'odin', slot: 'primary' }); kill(state);
    const death = freeze(present(state, 100)[0]), before = JSON.stringify(death);
    const support = { ...arena, colliders: [{ x: -10, y: 0, z: -12, w: 20, h: 3, d: 20 }] };
    const fresh = monsterDeathMeshes(death, 0, support), fallen = monsterDeathMeshes(death, 350, support), dissolving = monsterDeathMeshes(death, 750, support);
    assert.ok(fresh.length > 0 && fallen.length > 0, `${type}: retained silhouette clearly falls before removal`);
    assert.notDeepEqual(fallen, fresh, `${type}: death visibly moves the existing body`);
    assert.ok(dissolving.length < fresh.length, `${type}: small voxel pieces disappear gradually`);
    assert.equal(monsterDeathMeshes(death, 2000, support).length, 0);
    for (const mesh of [fresh, fallen, dissolving]) {
      assert.ok(mesh instanceof Float32Array && mesh.length % 30 === 0 && mesh.every(Number.isFinite));
      assert.ok(mesh.length / 10 <= 1400, `${type}: a corpse uses a body-sized vertex budget`);
      for (let at = 0; at < mesh.length; at += 10) assert.ok(mesh[at + 1] >= 3 - 2e-6, `${type}: no collapse vertex clips below its real support`);
    }
    assert.deepEqual(monsterDeathMeshes({ ...death, weapon: 'classic' }, 350, support), fallen, 'dead anatomy does not duplicate a gun while its loot lies nearby');
    signatures.add(Buffer.from(fresh.buffer, fresh.byteOffset, fresh.byteLength).toString('base64'));
    assert.equal(JSON.stringify(death), before);
  }
  assert.equal(signatures.size, TYPES.length, 'the dog, brutes and ranged species keep distinct dead silhouettes');
});

test('the actual WebGL world batch shows fresh kills, stays depth tested, removes labels and expires without another entity pass', () => {
  const { renderer, draws, draw } = harness();
  try {
    const state = fixture('hound'); Object.assign(state.players[0], { x: 0, z: 0, yaw: 0 }); draw(state, 0);
    assert.ok(renderer.worldLabels.some(label => label.id === 1), 'fixture actually exposes the live monster health label before death');
    kill(state);
    const before = JSON.stringify(state), killed = draw(state, 10), fallen = draw(state, 250);
    assert.ok(killed.length > 0 && fallen.length > 0); assert.notDeepEqual(killed, fallen);
    assert.ok(draws.some(pass => pass.count === fallen.length / 10 && pass.depthTest && pass.depthWrite), 'the corpse uses the opaque depth-tested world pass, so walls hide it');
    assert.ok(renderer.stats.drawCalls <= 7, 'corpse triangles join existing world batching');
    assert.equal(renderer.worldLabels.some(label => label.id === 1), false, 'a corpse cannot show a living health bar');
    assert.equal(draw(state, 2000).length, 0);
    assert.equal(JSON.stringify(state), before, 'renderer cannot delay a death, collide with a corpse, or alter rewards');
    renderer.resetEffects(); draw(state, 2010);
    assert.equal(renderer.stats.monsterDeaths.activeCorpses, 0, 'an effects reset cannot replay old dead bodies');
    assert.equal(renderer.stats.monsterDeaths.vertices, 0);
  } finally { renderer.destroy(); }
});

test('collapsing monsters remain above their support and outside nearby solid cover at every animation stage', () => {
  const groundWall = { x: -2, y: 0, z: -6.05, w: 4, h: 3, d: .3 };
  const corner = [{ x: .58, y: 3, z: -6.8, w: .3, h: 3, d: 3.6 }, { x: -2, y: 3, z: -5.9, w: 2.7, h: 3, d: .3 }];
  const configurations = [{ ground: 0, walls: [groundWall], supports: [] }, { ground: 3, walls: corner, supports: [{ x: -10, y: 0, z: -12, w: 20, h: 3, d: 20 }] }];
  for (const { ground, walls, supports } of configurations) for (const type of TYPES) {
    const map = { ...arena, colliders: [...supports, ...walls] };
    const { state, present } = primed(type, { y: ground }); kill(state);
    const death = present(state, 10)[0];
    for (const age of [0, 80, 170, 250, 360, 540, 750, 950]) {
      const mesh = monsterDeathMeshes(death, age, map);
      for (let at = 0; at < mesh.length; at += 10) {
        const [x, y, z] = mesh.slice(at, at + 3);
        for (const wall of walls) {
          const inside = x > wall.x + 1e-6 && x < wall.x + wall.w - 1e-6 && y > wall.y + 1e-6 && y < wall.y + wall.h - 1e-6 && z > wall.z + 1e-6 && z < wall.z + wall.d - 1e-6;
          assert.equal(inside, false, `${type}/${age}/${ground}: death animation cannot push a visual body into solid cover`);
        }
        assert.ok(y >= ground - 2e-6, `${type}/${age}/${ground}: the dead body never sinks through its actual support`);
      }
    }
  }
});

test('twenty cached corpses, a newly spawned full wave and twenty supplies fit the existing real render budget', () => {
  const { renderer, draw } = harness();
  try {
    const state = fixture();
    const monsters = Array.from({ length: 20 }, (_, index) => creature(TYPES[index % TYPES.length], { id: index + 1, lifeId: index + 1, x: index % 5 * 3 - 6, z: -12 + Math.floor(index / 5) * 3, weapon: 'odin', slot: index % 8 === 3 || index % 8 === 4 ? 'primary' : 'empty' }));
    state.players = [state.players[0], ...monsters]; state.fighters = state.players;
    draw(state, 0); state.tick++;
    applyCombatDamage(state, monsters.map(monster => ({ playerId: 0, targetId: monster.id, targetLifeId: monster.lifeId, attack: 'gun', weapon: 'carbine', damage: monster.hp, dz: -1 })));
    state.players = [state.players[0], ...monsters.map(monster => ({ ...monster, alive: true, hp: 40, lifeId: monster.lifeId + 100, x: monster.x + 1, z: monster.z + 1 }))]; state.fighters = state.players;
    state.loot = Array.from({ length: 20 }, (_, id) => ({ id, kind: id % 2 ? 'weapon' : 'heal', weapon: 'odin', x: id % 5 * 3 - 5, y: 0, z: -11 + Math.floor(id / 5) * 3, amount: 1 }));
    draw(state, 10);
    const first = renderer.stats;
    assert.equal(first.monsterDeaths.activeCorpses, 20); assert.equal(first.monsterDeaths.geometryBuilds, 20);
    assert.equal(first.lootItems, 20); assert.ok(first.monsterDeaths.vertices > 0);
    assert.ok(first.dynamicVertices < 72000, 'live monsters, corpse bodies, loot, contacts and hit effects retain the existing total vertex limit');
    assert.ok(first.drawCalls <= 7); assert.ok(first.monsterDeaths.templateBytes < 2 * 1024 * 1024);
    for (let frame = 1; frame <= 10; frame++) {
      const snapshot = { ...state, players: state.players.map(player => ({ ...player })), events: state.events.map(event => ({ ...event })), loot: state.loot.map(item => ({ ...item })) };
      draw(snapshot, 10 + frame * 1000 / 144);
      assert.equal(renderer.stats.monsterDeaths.geometryBuilds, 20, 'fresh packet object identities cannot rebuild corpse models');
      assert.equal(renderer.stats.monsterDeaths.templateBytes, first.monsterDeaths.templateBytes, 'no typed buffers accumulate while the pose advances');
      assert.ok(renderer.stats.dynamicVertices < 72000); assert.ok(renderer.stats.drawCalls <= 7);
    }
    draw(state, 2000);
    const ended = renderer.stats.monsterDeaths;
    assert.equal(ended.activeCorpses, 0); assert.equal(ended.vertices, 0);
    assert.ok(ended.templateBytes < first.monsterDeaths.templateBytes, 'expired per-kill buffers are released');
    assert.ok(ended.templateBytes <= TYPES.length * 1400 * 10 * 4, 'only the fixed eight reusable anatomy templates remain');
    renderer.resetEffects(); assert.equal(renderer.stats.monsterDeaths.templateBytes, 0);
  } finally { renderer.destroy(); }
});
