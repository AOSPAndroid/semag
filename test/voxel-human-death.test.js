import assert from 'node:assert/strict';
import test from 'node:test';
import { createState, createCombatPlayer, applyCombatDamage, traceShot } from '../public/voxel-engine.js';
import { HUMAN_DEATH_RULES, humanDeathPose, humanDeathCameraPose, createHumanDeathPresenter } from '../public/voxel-human-death.js';
import { humanDeathMeshes, createHumanDeathMeshPresenter, VoxelRenderer } from '../public/voxel-renderer.js';

const arena = { id: 'human-death-fixture', theme: 'custom', colliders: [], sites: [], bounds: { minX: -24, maxX: 24, minZ: -24, maxZ: 24 } };
function fixture(patch = {}) {
  const state = createState();
  Object.assign(state, { phase: 'fight', tick: 100, map: arena, mapId: arena.id, ...patch });
  Object.assign(state.players[0], { x: -3, y: 0, z: 0, lifeId: 4 });
  Object.assign(state.players[1], { x: 0, y: 0, z: -5, yaw: .6, lifeId: 17, hp: 40, maxHp: 40, slot: 'empty' });
  return state;
}
function kill(state, id = 1, patch = {}) {
  state.tick++;
  const victim = state.players[id];
  applyCombatDamage(state, [{ playerId: id === 0 ? 1 : 0, targetId: id, targetLifeId: victim.lifeId, attack: 'gun', weapon: 'carbine', damage: victim.hp, dx: .25, dy: .1, dz: -1, ...patch }]);
  return state.events.findLast(event => event.type === 'kill' && event.targetId === id);
}
function primed(patch = {}, options) {
  const state = fixture(patch), present = createHumanDeathPresenter(options);
  assert.equal(present(state, 0).length, 0);
  return { state, present };
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function vertices(mesh) {
  return Array.from({ length: mesh.length / 10 }, (_, index) => Array.from(mesh.subarray(index * 10, index * 10 + 3)));
}
function bounds(mesh) {
  const points = vertices(mesh);
  return { min: [0, 1, 2].map(axis => Math.min(...points.map(point => point[axis]))), max: [0, 1, 2].map(axis => Math.max(...points.map(point => point[axis]))) };
}
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
  const draw = (state, time, options = {}) => {
    uploads.length = 0; draws.length = 0;
    renderer.render(state, { localId: 0, time, hideWeapon: true, ...options });
    return uploads.find(item => item.kind === 'world')?.mesh || new Float32Array();
  };
  return { renderer, uploads, draws, draw };
}

test('real lethal human and bot contacts freeze the old life, stance and impact without delaying authoritative death', () => {
  for (const gameId of ['voxel-breach', 'voxel-royale', 'voxel-horde', 'voxel-dojo']) for (const crouching of [false, true]) {
    const state = fixture({ gameId }); Object.assign(state.players[1], { human: false, crouching });
    const victim = state.players[1], before = { x: victim.x, y: victim.y, z: victim.z, yaw: victim.yaw, lifeId: victim.lifeId, team: victim.team };
    const event = kill(state);
    assert.equal(victim.alive, false); assert.equal(victim.hp, 0); assert.equal(victim.deaths, 1);
    assert.equal(state.players[0].kills, 1); assert.equal(state.players[0].damageDealt, 40);
    assert.ok(Object.isFrozen(event.humanDeath));
    assert.deepEqual(event.humanDeath, { lifeId: before.lifeId, deaths: 1, team: before.team, crouching, yaw: before.yaw, dx: .25, dy: .1, dz: -1 });
    for (const field of ['x', 'y', 'z']) assert.equal(event[field], before[field]);
    const retained = JSON.stringify(event.humanDeath);
    Object.assign(victim, { yaw: 2.5, lifeId: 18, crouching: !crouching });
    assert.equal(JSON.stringify(event.humanDeath), retained, 'later actor changes cannot rewrite the accepted death pose');
    applyCombatDamage(state, [{ playerId: 0, targetId: 1, damage: 100 }]);
    assert.equal(state.events.filter(item => item.type === 'kill').length, 1);
    assert.notEqual(traceShot(state, 0, { x: 0, y: .55, z: 0 }, { x: 0, y: 0, z: -1 }, 10, arena).playerId, 1, 'visual bodies never remain combat targets');
  }
});

test('nonlethal damage and stale-life damage cannot emit a human death; real monster events retain their own descriptor', () => {
  const state = fixture();
  applyCombatDamage(state, [{ playerId: 0, targetId: 1, targetLifeId: 16, damage: 1000 }]);
  assert.equal(state.players[1].hp, 40); assert.equal(state.events.length, 0);
  applyCombatDamage(state, [{ playerId: 0, targetId: 1, damage: 1 }]);
  assert.equal(state.players[1].hp, 39); assert.equal(state.events.some(event => event.humanDeath), false);
  const monsters = fixture({ gameId: 'voxel-horde' }); Object.assign(monsters.players[1], { human: false, monster: true, monsterType: 'hound' });
  const event = kill(monsters);
  assert.equal(event.monsterType, 'hound'); assert.equal(event.targetLifeId, 17);
  assert.equal(Object.hasOwn(event, 'humanDeath'), false, 'human confirmation never adds a second body to a monster kill');
});

test('the presenter requires a fresh lethal event rather than joining history, a dead snapshot or a damage cue', () => {
  const history = fixture(); kill(history);
  const present = createHumanDeathPresenter();
  assert.equal(present(history, 0).length, 0); assert.equal(present(history, 100).length, 0);
  const { state, present: clean } = primed(); state.players[1].alive = false; state.players[1].hp = 0;
  assert.equal(clean(state, 10).length, 0);
  state.events.push({ type: 'damage', id: ++state.eventId, tick: state.tick, targetId: 1, hp: 0, damage: 40 });
  assert.equal(clean(state, 20).length, 0);
  state.players.splice(1, 1);
  assert.equal(clean(state, 30).length, 0, 'removing an actor cannot create a death');
});

test('duplicate event snapshots and same-life retransmissions create only one animation, which cannot resurrect after expiry', () => {
  const { state, present } = primed(), event = kill(state);
  assert.equal(present(state, 10).length, 1);
  assert.equal(present({ ...state, players: state.players.map(player => ({ ...player })), events: state.events.map(item => ({ ...item })) }, 20).length, 1);
  state.events.push({ ...event, id: ++state.eventId });
  assert.equal(present(state, 30).length, 1); assert.equal(present.getStats().acceptedKills, 1);
  assert.equal(present(state, HUMAN_DEATH_RULES.durationMs + 50).length, 0);
  state.events.push({ ...event, id: ++state.eventId });
  assert.equal(present(state, HUMAN_DEATH_RULES.durationMs + 60).length, 0);
});

test('a new life or increased death counter in a reused human seat cannot inherit the old pose and can die independently', () => {
  for (const reuseLifeId of [false, true]) {
    const { state, present } = primed(), old = kill(state);
    if (reuseLifeId) assert.equal(present(state, 5).length, 1, 'accept this death before a respawn reuses exactly the same life identifier');
    state.players[1] = { ...createCombatPlayer(1, 1, 'carbine'), lifeId: reuseLifeId ? 17 : 18, deaths: reuseLifeId ? 1 : 0, x: 10, z: 8 };
    state.fighters = state.players;
    const first = present(state, 10); assert.equal(first.length, 1);
    assert.deepEqual([first[0].x, first[0].y, first[0].z, first[0].yaw], [old.x, old.y, old.z, old.humanDeath.yaw]);
    kill(state); const both = present(state, 20);
    assert.equal(both.length, 2); assert.equal(new Set(both.map(death => death.key)).size, 2);
    assert.equal(state.players[1].x, 10); assert.equal(state.players[1].z, 8);
  }
});

test('malformed, nonhuman, future and stale death events cannot create a body; contradictory same-life living state is rejected', () => {
  const mutations = [
    event => { event.type = 'damage'; }, event => { event.targetId = -1; }, event => { event.humanDeath = undefined; },
    event => { event.monsterType = 'hound'; }, event => { event.x = NaN; }, event => { event.y = Infinity; }, event => { event.z = undefined; },
    event => { event.tick += 1; }, event => { event.tick -= HUMAN_DEATH_RULES.maxEventAgeTicks + 1; },
    ...[{ lifeId: -1 }, { deaths: 0 }, { team: NaN }, { crouching: 0 }, { yaw: NaN }, { dx: Infinity }, { dy: undefined }, { dz: NaN }].map(patch => event => { event.humanDeath = { ...event.humanDeath, ...patch }; }),
  ];
  for (const mutate of mutations) {
    const { state, present } = primed(); const event = kill(state); mutate(event);
    assert.equal(present(state, 10).length, 0);
  }
  for (const patch of [{ alive: true }, { hp: 1 }, { monsterType: 'hound' }]) {
    const { state, present } = primed(); kill(state); Object.assign(state.players[1], patch);
    assert.equal(present(state, 10).length, 0, 'accepted same-life state and descriptor must agree about death');
  }
});

test('a genuine unseen death still plays from its start after slow frames or after the dead seat disappears', () => {
  for (const delayTicks of [60, 120, 240]) for (const removeSeat of [false, true]) {
    const { state, present } = primed(); kill(state); state.tick += delayTicks;
    if (removeSeat) state.players.splice(1, 1);
    const first = present(state, delayTicks * 1000 / 120);
    assert.equal(first.length, 1); assert.equal(first[0].ageMs, 0);
    assert.equal(first[0].lifeId, 17);
  }
});

test('pause and local pause freeze animation, repeated timestamps do not advance it, and resumption discards pause wall time', () => {
  const { state, present } = primed(); kill(state); present(state, 100);
  const age = present(state, 220)[0].ageMs; assert.ok(age > 0);
  assert.equal(present(state, 220)[0].ageMs, age);
  state.phase = 'paused'; assert.equal(present(state, 300)[0].ageMs, age); assert.equal(present(state, 6000)[0].ageMs, age);
  state.phase = 'fight'; assert.equal(present(state, 6100)[0].ageMs, age); assert.ok(present(state, 6200)[0].ageMs > age);
  const resumedAge = present(state, 6200)[0].ageMs;
  assert.equal(present(state, 6300, { paused: true })[0].ageMs, resumedAge);
  assert.equal(present(state, 10000, { paused: true })[0].ageMs, resumedAge);
  assert.equal(present(state, 10100)[0].ageMs, resumedAge);
});

test('30, 60, 144 and 240 Hz presentation reaches the same pose at the same elapsed time', () => {
  const poses = [];
  for (const rate of [30, 60, 144, 240]) {
    const { state, present } = primed(); kill(state); present(state, 100);
    for (let frame = 1; frame * 1000 / rate < 350; frame++) present(state, 100 + frame * 1000 / rate);
    const death = present(state, 450)[0]; poses.push(humanDeathPose(death, death.ageMs));
  }
  for (const pose of poses.slice(1)) assert.deepEqual(pose, poses[0]);
});

test('round and match end preserve confirmation, while new game/map/match/round/session and time resets discard old histories', () => {
  for (const phase of ['intermission', 'roundEnd', 'matchEnd']) {
    const { state, present } = primed(); kill(state); present(state, 100); state.phase = phase;
    assert.equal(present(state, 150).length, 1); assert.equal(present(state, 2000).length, 0);
  }
  for (const patch of [{ phase: 'lobby' }, { phase: 'countdown' }, { phase: 'buy' }, { mapId: 'depot' }, { matchId: 99 }, { round: 2 }, { gameId: 'voxel-royale' }]) {
    const { state, present } = primed(); kill(state); assert.equal(present(state, 10).length, 1);
    Object.assign(state, patch); assert.equal(present(state, 20).length, 0);
  }
  for (const key of ['practice', 'horde']) {
    const { state, present } = primed({ [key]: { sessionId: 1 } }); kill(state); assert.equal(present(state, 10).length, 1);
    state[key].sessionId++; assert.equal(present(state, 20).length, 0);
  }
  const { state, present } = primed(); kill(state); assert.equal(present(state, 100).length, 1);
  assert.equal(present(state, 90).length, 0, 'a restarted presentation clock cannot replay retained events');
  present.reset(); assert.equal(present.getStats().activeCorpses, 0); assert.equal(present(state, 110).length, 0);
});

test('bounded corpse capacity expires and releases records without mutating immutable accepted state', () => {
  const { state, present } = primed({}, { maxCorpses: 3 });
  state.players = [state.players[0], ...Array.from({ length: 8 }, (_, i) => ({ ...createCombatPlayer(i + 1, 1, 'carbine'), lifeId: i + 10, x: i - 4, z: -8, hp: 20 }))];
  state.fighters = state.players;
  for (let id = 1; id <= 8; id++) kill(state, id);
  const frozen = freeze(structuredClone(state)), before = JSON.stringify(frozen);
  const deaths = present(frozen, 10);
  assert.equal(deaths.length, 3); assert.deepEqual(deaths.map(death => death.targetId), [6, 7, 8]);
  assert.ok(deaths.every(Object.isFrozen)); assert.equal(present.getStats().acceptedKills, 8);
  assert.equal(present(frozen, 2000).length, 0); assert.equal(present.getStats().activeCorpses, 0);
  assert.equal(JSON.stringify(frozen), before);
});

test('operator bodies collapse toward the impact, retain skin and crouch identity, dissolve gradually and omit dropped equipment', () => {
  for (const crouching of [false, true]) {
    const { state, present } = primed(); state.players[1].crouching = crouching; kill(state, 1, { dx: 1, dz: 0 });
    const death = freeze(present(state, 10)[0]), before = JSON.stringify(death);
    const fresh = humanDeathMeshes(death, 0, arena), fallen = humanDeathMeshes(death, 360, arena), dissolving = humanDeathMeshes(death, 850, arena);
    assert.ok(fresh.length > 0 && fallen.length > 0); assert.notDeepEqual(fallen, fresh);
    assert.ok(bounds(fallen).max[0] > bounds(fresh).max[0] + .25, 'a clear impact from the left topples the human to the right');
    assert.ok(bounds(fallen).max[1] < bounds(fresh).max[1] - .25, 'the fallen silhouette is clearly lower');
    assert.ok(dissolving.length > 0 && dissolving.length < fresh.length);
    assert.equal(humanDeathMeshes(death, HUMAN_DEATH_RULES.durationMs, arena).length, 0);
    for (const mesh of [fresh, fallen, dissolving]) assert.ok(mesh instanceof Float32Array && mesh.length % 30 === 0 && mesh.every(Number.isFinite));
    assert.deepEqual(humanDeathMeshes({ ...death, weapon: 'odin', slot: 'primary', potions: 2 }, 360, arena), fallen, 'dropped guns and potions are not rendered twice as body parts');
    assert.notDeepEqual(humanDeathMeshes({ ...death, targetId: 2, team: 0 }, 0, arena), fresh, 'the dead operator retains its own appearance');
    assert.equal(JSON.stringify(death), before);
  }
});

test('human collapse remains above elevated ground and outside desks and corner walls throughout its animation', () => {
  const cases = [
    { ground: 0, supports: [], walls: [{ x: -2, y: 0, z: -6.05, w: 4, h: 3, d: .3 }] },
    { ground: 3, supports: [{ x: -10, y: 0, z: -12, w: 20, h: 3, d: 20 }], walls: [{ x: .58, y: 3, z: -6.8, w: .3, h: 3, d: 3.6 }, { x: -2, y: 3, z: -5.9, w: 2.7, h: 3, d: .3 }] },
    { ground: 0, supports: [], walls: [{ x: -.6, y: 0, z: -6.4, w: 1.2, h: .75, d: .6 }] },
  ];
  for (const { ground, supports, walls } of cases) for (const crouching of [false, true]) {
    const map = { ...arena, colliders: [...supports, ...walls] }, { state, present } = primed();
    Object.assign(state.players[1], { y: ground, crouching }); kill(state);
    const death = present(state, 10)[0];
    for (const age of [0, 80, 170, 250, 360, 540, 750, 950]) {
      for (const [x, y, z] of vertices(humanDeathMeshes(death, age, map))) {
        assert.ok(y >= ground - 2e-6, `${ground}/${crouching}/${age}: no corpse vertex sinks through support`);
        for (const wall of walls) assert.equal(x > wall.x + 1e-6 && x < wall.x + wall.w - 1e-6 && y > wall.y + 1e-6 && y < wall.y + wall.h - 1e-6 && z > wall.z + 1e-6 && z < wall.z + wall.d - 1e-6, false, `${ground}/${crouching}/${age}: death does not push the body into solid cover`);
      }
    }
  }
});

test('reduced motion uses an immediate static defeated pose and does not move or roll the local camera', () => {
  const { state, present } = primed(); kill(state); const death = present(state, 10)[0];
  assert.deepEqual(humanDeathMeshes(death, 0, arena, { reducedMotion: true }), humanDeathMeshes(death, 500, arena, { reducedMotion: true }));
  assert.ok(humanDeathMeshes(death, 850, arena, { reducedMotion: true }).length < humanDeathMeshes(death, 0, arena, { reducedMotion: true }).length);
  for (const ageMs of [0, 200, 500, 1000]) assert.ok(Object.values(humanDeathCameraPose({ ...death, ageMs }, { reducedMotion: true })).every(value => value === 0));
  const { renderer, draw } = harness();
  try {
    const local = fixture(); draw(local, 0, { reducedMotion: true }); kill(local, 0); draw(local, 10, { reducedMotion: true }); draw(local, 450, { reducedMotion: true });
    assert.ok(Object.values(renderer.stats.humanDeaths.camera).every(value => value === 0));
  } finally { renderer.destroy(); }
});

test('the actual WebGL world batch draws a fresh human collapse with depth tests, removes its name label and releases geometry on expiry', () => {
  const { renderer, draws, draw } = harness();
  try {
    const state = fixture(); Object.assign(state.players[0], { x: 0, z: 0, yaw: 0 }); draw(state, 0);
    kill(state); const frozen = freeze(state), before = JSON.stringify(frozen);
    const fresh = draw(frozen, 10), fallen = draw(frozen, 250);
    assert.ok(fresh.length > 0 && fallen.length > 0); assert.notDeepEqual(fresh, fallen);
    assert.equal(renderer.stats.humanDeaths.activeCorpses, 1); assert.equal(renderer.stats.humanDeaths.geometryBuilds, 1);
    assert.ok(renderer.stats.humanDeaths.vertices > 0);
    assert.ok(draws.some(pass => pass.count === fallen.length / 10 && pass.depthTest && pass.depthWrite), 'walls occlude bodies in the normal opaque world pass');
    assert.ok(renderer.stats.drawCalls <= 7); assert.equal(renderer.worldLabels.some(label => label.id === 1), false);
    assert.ok(draw(frozen, 2000).length > 0, 'real dropped loot remains visible after the visual body is gone');
    assert.equal(renderer.stats.lootItems, frozen.loot.length); assert.equal(renderer.stats.humanDeaths.activeCorpses, 0);
    assert.equal(renderer.stats.humanDeaths.vertices, 0); assert.equal(renderer.stats.humanDeaths.templateBytes, 0);
    assert.equal(JSON.stringify(frozen), before);
    renderer.resetEffects(); draw(frozen, 2010); assert.equal(renderer.stats.humanDeaths.activeCorpses, 0);
  } finally { renderer.destroy(); }
});

test('new packet object identities reuse bounded human corpse geometry and remain in the normal draw budget', () => {
  const { renderer, draw } = harness();
  try {
    const state = fixture();
    state.players = [state.players[0], ...Array.from({ length: 12 }, (_, index) => ({ ...createCombatPlayer(index + 1, 1, 'carbine'), lifeId: index + 1, x: index % 4 * 3 - 4, z: -12 + Math.floor(index / 4) * 3, slot: 'empty', hp: 40 }))]; state.fighters = state.players;
    draw(state, 0); for (let id = 1; id <= 12; id++) kill(state, id); draw(state, 10);
    const first = renderer.stats.humanDeaths;
    assert.equal(first.activeCorpses, 12); assert.equal(first.geometryBuilds, 12); assert.ok(first.vertices > 0);
    assert.ok(first.templateBytes < 2 * 1024 * 1024);
    for (let frame = 1; frame <= 10; frame++) {
      draw({ ...state, players: state.players.map(player => ({ ...player })), events: state.events.map(event => ({ ...event, humanDeath: event.humanDeath ? { ...event.humanDeath } : undefined })) }, 10 + frame * 1000 / 144);
      assert.equal(renderer.stats.humanDeaths.geometryBuilds, 12); assert.equal(renderer.stats.humanDeaths.templateBytes, first.templateBytes);
      assert.ok(renderer.stats.dynamicVertices < 72000); assert.ok(renderer.stats.drawCalls <= 7);
    }
    draw(state, 2000); assert.equal(renderer.stats.humanDeaths.templateBytes, 0);
  } finally { renderer.destroy(); }
});

test('the geometry presenter discards old per-life buffers instead of leaking repeated respawn deaths', () => {
  const meshes = createHumanDeathMeshPresenter(), { state, present } = primed(); kill(state); const original = present(state, 10)[0];
  let oneBodyBytes;
  for (let life = 0; life < 40; life++) {
    const death = { ...original, key: `1:${life}:1`, lifeId: life, ageMs: 0 };
    assert.ok(meshes([death], arena).length > 0);
    if (oneBodyBytes === undefined) oneBodyBytes = meshes.getStats().templateBytes;
    assert.equal(meshes.getStats().templateBytes, oneBodyBytes, 'repeated lives keep only the one active body allocation');
    meshes([], arena); assert.equal(meshes.getStats().templateBytes, 0);
  }
  meshes.reset(); assert.equal(meshes.getStats().geometryBuilds, 0); assert.equal(meshes.getStats().vertices, 0);
});

test('local death lowers and tilts the camera gently, keeps horizontal position fixed, and holds until a real respawn', () => {
  const { renderer, draw } = harness();
  try {
    const state = fixture(); draw(state, 0); const alive = renderer.stats.cameraEyeHeight;
    kill(state, 0); draw(state, 10); const start = renderer.firstPersonMotion.eye.slice();
    draw(state, 240); const midway = renderer.stats.humanDeaths.camera;
    assert.ok(midway.lower > 0 && midway.lower < 1.15); assert.ok(midway.roll > 0 && midway.roll <= .13);
    assert.equal(renderer.firstPersonMotion.eye[0], start[0]); assert.equal(renderer.firstPersonMotion.eye[2], start[2]);
    draw(state, 500); const settled = renderer.stats.humanDeaths.camera, settledHeight = renderer.stats.cameraEyeHeight;
    assert.equal(settled.fall, 1); assert.ok(settledHeight < alive - .5);
    draw(state, 2000); assert.deepEqual(renderer.stats.humanDeaths.camera, settled); assert.equal(renderer.stats.cameraEyeHeight, settledHeight);
    state.players[0] = { ...createCombatPlayer(0, 1, 'carbine'), lifeId: 5, deaths: 1, x: -3, z: 0 }; state.fighters = state.players;
    draw(state, 2010); assert.equal(renderer.stats.humanDeaths.camera, null); assert.ok(renderer.stats.cameraEyeHeight > settledHeight + .5);
  } finally { renderer.destroy(); }
});

test('a missed render interval cannot leave the local camera upright after the death animation expires', () => {
  const { renderer, draw } = harness();
  try {
    const state = fixture(); draw(state, 0); kill(state, 0); draw(state, 10);
    assert.equal(renderer.stats.humanDeaths.camera.fall, 0);
    draw(state, HUMAN_DEATH_RULES.durationMs + 100);
    assert.equal(renderer.stats.humanDeaths.activeCorpses, 0);
    assert.equal(renderer.stats.humanDeaths.camera.fall, 1, 'camera settle follows active elapsed time even when the corpse expired between paints');
    assert.ok(renderer.stats.humanDeaths.camera.lower > .5);
  } finally { renderer.destroy(); }
});

test('local death camera respects nearby ground cover and pause, and changing the spectated life clears the fall', () => {
  const { renderer, draw } = harness();
  try {
    const state = fixture(); state.map = { ...arena, colliders: [{ x: -4, y: 0, z: -1, w: 2, h: .8, d: 2 }] };
    Object.assign(state.players[0], { y: .8, grounded: true }); draw(state, 0); kill(state, 0); draw(state, 10); draw(state, 200);
    const before = renderer.stats.humanDeaths.camera;
    state.phase = 'paused'; draw(state, 10000); assert.deepEqual(renderer.stats.humanDeaths.camera, before);
    state.phase = 'fight'; draw(state, 10100); assert.deepEqual(renderer.stats.humanDeaths.camera, before);
    draw(state, 10400); assert.ok(renderer.firstPersonMotion.eye[1] >= .8 + .04, 'the camera cannot lower through its support');
    draw(state, 10410, { viewPlayer: state.players[1] }); assert.equal(renderer.stats.humanDeaths.camera, null);
  } finally { renderer.destroy(); }
});
