import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createCombatPlayer, WORLD, MAPS as TACTICAL_MAPS } from '../public/voxel-engine.js';
import { MAPS } from '../public/voxel-royale-maps.js';
import { HORDE_RULES, createState, startMatch, step, emptyInput } from '../public/voxel-horde-engine.js';
import { monsterMeshes, operativeMeshes, createSpawnWarningPresenter, VoxelRenderer } from '../public/voxel-renderer.js';

const TYPES = ['stalker', 'runner', 'brute', 'gunner', 'sniper'];
const digest = mesh => createHash('sha256').update(new Uint8Array(mesh.buffer, mesh.byteOffset, mesh.byteLength)).digest('hex');
const monster = (monsterType = 'stalker', patch = {}) => ({ ...createCombatPlayer(10, 1, monsterType === 'sniper' ? 'marksman' : 'carbine'), x: 2.25, y: 4, z: -3.5, team: 1, monster: true, monsterType, attackDuration: 48, ...patch });
const fixtureMap = { id: 'horde-art-fixture', theme: 'custom', colliders: [], sites: [], bounds: { minX: -24, maxX: 24, minZ: -24, maxZ: 24 } };

function harness() {
  const uniforms = new Map(), uploads = [];
  const gl = new Proxy({}, { get(_, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (name === 'uniform1f' || name === 'uniform3fv') return (uniform, value) => uniforms.set(uniform, typeof value === 'number' ? value : [...value]);
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  const renderer = new VoxelRenderer({ getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) });
  const upload = renderer._dynamic;
  renderer._dynamic = function(array, kind = 'world') { uploads.push({ kind, mesh: array.slice(), buffer: array.buffer }); return upload.call(this, array, kind); };
  return { renderer, uniforms, uploads };
}

test('all five original monster anatomies fit real shooting and movement envelopes during gait and attack tells', () => {
  const signatures = new Set();
  for (const type of TYPES) {
    const base = monster(type), source = JSON.stringify(base), mesh = monsterMeshes(base, 0);
    signatures.add(digest(mesh));
    assert.notEqual(digest(mesh), digest(operativeMeshes(base)), 'monsters have original anatomy rather than tinted human uniforms');
    for (const monsterState of ['emerging', 'chase', 'windup', 'recover', 'aiming']) for (const attackTicks of [48, 24, 1]) for (const time of [0, 127, 861]) for (let turn = 0; turn < 24; turn++) {
      const player = { ...base, monsterState, attackTicks, yaw: turn * Math.PI / 12, pitch: .8, vx: 6, vz: 4 };
      const geometry = monsterMeshes(player, time);
      assert.ok(geometry.every(Number.isFinite) && geometry.length % 30 === 0);
      assert.ok(geometry.length / 10 <= 1250, `${type}: detailed art remains affordable in a whole wave`);
      let crown = false, soles = false;
      for (let at = 0; at < geometry.length; at += 10) {
        const x = geometry[at] - player.x, y = geometry[at + 1] - player.y, z = geometry[at + 2] - player.z;
        const head = y > WORLD.standHeight - .32 + 1e-6, radius = head ? .22 : .29;
        assert.ok(y >= -1e-6 && y <= WORLD.standHeight + 1e-6, `${type}: actual 1.8m body height`);
        assert.ok(Math.abs(x) <= radius + 1e-6 && Math.abs(z) <= radius + 1e-6, `${type}/${monsterState}/${turn}: ${head ? 'head' : 'body'} cannot imply an unhittable corner`);
        assert.ok(Math.hypot(x, z) <= WORLD.radius + 1e-6, `${type}: claws, armor and strides cannot enter walls`);
        crown ||= Math.abs(y - WORLD.standHeight) < 1e-6; soles ||= y < .02;
      }
      assert.ok(crown && soles, 'all monsters show their real head and ground contact');
    }
    assert.equal(JSON.stringify(base), source, 'rendering never changes combat or movement state');
  }
  assert.equal(signatures.size, TYPES.length, 'stone stalker, masked runner, plated brute and both armed monsters are distinct');
});

test('continuous monster turns, running strides and actual melee windup produce smooth affordable motion', () => {
  for (const type of TYPES) {
    const base = monster(type, { vx: 6, vz: 1 }), before = monsterMeshes({ ...base, yaw: Math.PI / 4 - .001 }, 1000), after = monsterMeshes({ ...base, yaw: Math.PI / 4 + .001 }, 1000);
    assert.equal(before.length, after.length);
    let largest = 0;
    for (let at = 0; at < before.length; at += 10) largest = Math.max(largest, Math.hypot(after[at] - before[at], after[at + 1] - before[at + 1], after[at + 2] - before[at + 2]));
    assert.ok(largest > 0 && largest < .00065, `${type}: turning cannot snap by ninety degrees`);
    assert.notEqual(digest(monsterMeshes(base, 1000)), digest(monsterMeshes(base, 1080)), 'moving monsters have opposing leg strides');
    assert.deepEqual(monsterMeshes({ ...base, vx: 0, vz: 0 }, 1000), monsterMeshes({ ...base, vx: 0, vz: 0 }, 1080), 'idle anatomy does not jitter with the display clock');
    const ready = monsterMeshes({ ...base, monsterState: 'windup', attackTicks: 48 }, 1000), committed = monsterMeshes({ ...base, monsterState: 'windup', attackTicks: 1 }, 1000);
    assert.notEqual(digest(ready), digest(committed), 'the authoritative attack tell raises claws and changes the eyes');
  }
});

test('spawn rifts use live authoritative positions and countdowns while retaining bounded typed geometry', () => {
  const present = createSpawnWarningPresenter(), warning = { id: 1, x: 2, y: 3, z: -4, monsterType: 'runner', ticksLeft: 90, durationTicks: 90 };
  const first = present([warning], 0), buffer = first.contacts.buffer, early = first.contacts.slice();
  assert.equal(first.count, 1);
  assert.ok(early.length / 10 < 600 && early.every(Number.isFinite));
  for (let at = 0; at < early.length; at += 10) {
    assert.ok(Math.hypot(early[at] - warning.x, early[at + 2] - warning.z) <= .493, 'a rift marks its exact pending spawn point');
    assert.ok(early[at + 1] >= warning.y + .024 && early[at + 1] < warning.y + .55, 'no large opaque obstacle or underground rift');
    assert.ok(early[at + 9] > 0 && early[at + 9] < 1, 'rifts remain translucent');
  }
  const late = present([{ ...warning, ticksLeft: 1 }], 800);
  assert.equal(late.contacts.buffer, buffer);
  assert.notEqual(digest(late.contacts), digest(early), 'light pillars grow as the actual spawn approaches');
  assert.equal(present.getStats().builds, 1, 'fresh network identities do not rebuild portals');
  const changed = { ...warning, x: 4 };
  present([changed], 850); assert.equal(present.getStats().builds, 2);
  assert.equal(present([{ ...changed, ticksLeft: 0 }], 900).count, 0, 'expired warnings disappear immediately');
  assert.equal(present.getStats().cachedItems, 0);
  const excessive = Array.from({ length: 200 }, (_, id) => ({ ...warning, id, x: id }));
  const bounded = present([{ ...warning, x: NaN }, { ...warning, durationTicks: 0 }, ...excessive], 1000);
  assert.equal(bounded.count, 4); assert.equal(present.getStats().cachedItems, 4);
  assert.ok(bounded.contacts.length / 10 < 2400 && present.getStats().templateBytes < 256000);
  present.reset(); assert.equal(present.getStats().builds, 0); assert.equal(present([]).contacts.length, 0);
});

test('actual horde upload routes original monsters, shared supplies and portals without tactical objectives or a storm', () => {
  const { renderer, uploads, uniforms } = harness();
  const camera = { ...createCombatPlayer(0), team: 0, x: -5 }, actor = monster();
  const state = { gameId: 'voxel-horde', map: fixtureMap, phase: 'fight', round: 1, tick: 1, players: [camera, actor], loot: [], spawnWarnings: [], events: [] };
  renderer.render(state, { localId: 0, time: 1000, hideWeapon: true });
  assert.deepEqual(uploads.find(upload => upload.kind === 'world').mesh, monsterMeshes(actor, 1000), 'the actual render uses monster anatomy rather than an ordinary tactical operative');
  uploads.length = 0;
  state.bomb = { status: 'carried', carrierId: actor.id }; state.storm = { active: true, x: 0, z: 0, radius: 5 };
  state.loot = [{ id: 'heal', kind: 'heal', x: 1, y: 0, z: 1 }, { id: 'ammo', kind: 'ammo', x: -1, y: 0, z: 1 }];
  state.spawnWarnings = [{ id: 1, x: 5, y: 0, z: -6, monsterType: 'brute', ticksLeft: 45, durationTicks: 90 }];
  renderer.render(state, { localId: 0, time: 1000, hideWeapon: true });
  assert.equal(renderer.stats.lootItems, 2); assert.equal(renderer.stats.spawnWarnings, 1);
  assert.equal(renderer.stats.stormVertices, 0); assert.equal(uniforms.get('uStormStrength'), 0);
  assert.ok(uploads.find(upload => upload.kind === 'world').mesh.length > monsterMeshes(actor, 1000).length, 'healing bottles and ammo tins share the actual world pass');
  assert.ok(uploads.some(upload => upload.kind === 'contact' && upload.mesh.length > 0));
  assert.ok(renderer.stats.drawCalls <= 7);
  state.players[1].alive = false; state.loot = []; state.spawnWarnings = []; uploads.length = 0;
  renderer.render(state, { localId: 0, time: 1001, hideWeapon: true });
  assert.equal(uploads.find(upload => upload.kind === 'world').mesh.length, 0, 'dead enemies, collected supplies and completed portals cannot linger');
  assert.equal(renderer.stats.cachedLootItems, 0); assert.equal(renderer.stats.cachedSpawnWarnings, 0);
  renderer.destroy();
});

test('armed monster models carry recognizable existing guns and their continuous look keeps anatomy stable', () => {
  const { renderer, uploads } = harness();
  const camera = { ...createCombatPlayer(0), team: 0, x: -5 };
  for (const type of ['gunner', 'sniper']) for (const weapon of ['pistol', 'carbine', 'marksman', 'sniper']) {
    const actor = monster(type, { weapon, monsterState: 'aiming', pitch: -.3 });
    const draw = yaw => {
      uploads.length = 0;
      const player = { ...actor, yaw };
      renderer.render({ gameId: 'voxel-horde', map: fixtureMap, phase: 'fight', round: 1, tick: 1, players: [camera, player], events: [] }, { localId: 0, time: 1000, hideWeapon: true });
      return { world: uploads.find(upload => upload.kind === 'world').mesh, anatomy: monsterMeshes(player, 1000) };
    };
    const first = draw(0), turned = draw(.4);
    assert.ok(first.world.length > first.anatomy.length, 'armed enemy displays the actual shared equipped firearm');
    assert.deepEqual(first.world.slice(0, first.anatomy.length), first.anatomy);
    assert.deepEqual(turned.world.slice(0, turned.anatomy.length), turned.anatomy);
    assert.equal(first.world.length, turned.world.length);
    for (let at = first.anatomy.length; at < first.world.length; at += 10) {
      const x = turned.world[at] - actor.x, z = turned.world[at + 2] - actor.z;
      assert.ok(Math.abs(x * Math.cos(.4) + z * Math.sin(.4) - (first.world[at] - actor.x)) < 1e-6, `${type}/${weapon}: gun follows aim without quadrant snaps`);
      assert.ok(Math.abs(z * Math.cos(.4) - x * Math.sin(.4) - (first.world[at + 2] - actor.z)) < 1e-6);
    }
    assert.ok(renderer.stats.dynamicVertices < 3200, 'the shared detailed firearm fits the existing remote-operative budget');
  }
  renderer.destroy();
});

test('a downed connected teammate gets a small depth-tested revive kit only while another revive is allowed', () => {
  const { renderer, uploads } = harness();
  const camera = { ...createCombatPlayer(0), team: 0, x: -5 }, fallen = { ...createCombatPlayer(1), human: true, team: 0, connected: true, participating: true, alive: false, revivesThisWave: 0, x: 3, y: 2, z: -4 };
  const state = { gameId: 'voxel-horde', map: fixtureMap, phase: 'fight', round: 1, tick: 1, players: [camera, fallen], events: [] };
  const draw = () => { uploads.length = 0; renderer.render(state, { localId: 0, time: 1000, hideWeapon: true }); return uploads.find(upload => upload.kind === 'world').mesh; };
  const kit = draw(); assert.ok(kit.length > 0 && kit.length / 10 < 350);
  for (let at = 0; at < kit.length; at += 10) {
    assert.ok(Math.hypot(kit[at] - fallen.x, kit[at + 2] - fallen.z) < .3, 'the passable kit cannot imply solid cover or an oversized body');
    assert.ok(kit[at + 1] > fallen.y && kit[at + 1] < fallen.y + .75, 'revive marker stays over the real down location');
  }
  assert.ok(uploads.some(upload => upload.kind === 'contact'), 'the mint ring is placed on the actual support');
  assert.ok(renderer.stats.drawCalls <= 7, 'revive markers use the existing opaque and depth-tested contact passes');
  for (const patch of [{ connected: false }, { participating: false }, { revivesThisWave: 1 }, { human: false, monster: true }]) {
    state.players[1] = { ...fallen, ...patch }; assert.equal(draw().length, 0, 'disconnected, departed, spent and enemy bodies do not advertise revives');
  }
  state.players[1] = fallen; state.phase = 'matchEnd'; assert.equal(draw().length, 0, 'team wipe removes in-world revive instructions');
  renderer.destroy();
});

test('the last confirmed shot of a cleared wave keeps its tracer and impact feedback during intermission', () => {
  const { renderer } = harness();
  const camera = { ...createCombatPlayer(0), team: 0, x: -5 }, victim = monster('gunner', { alive: false, hp: 0 });
  const state = { gameId: 'voxel-horde', map: fixtureMap, phase: 'intermission', round: 1, tick: 100, players: [camera, victim], events: [
    { id: 1, tick: 100, type: 'shot', playerId: 0, weapon: 'carbine', x: -5, y: 1.6, z: 0, dx: 1, dy: 0, dz: 0, hitX: 2.25, hitY: 5.6, hitZ: -3.5, hitKind: 'body', damage: 40 },
    { id: 2, tick: 100, type: 'damage', attack: 'gun', playerId: 0, targetId: victim.id, weapon: 'carbine', damage: 40, hitX: 2.25, hitY: 5.6, hitZ: -3.5, dx: 1, dy: 0, dz: 0 },
  ] };
  renderer.render(state, { localId: 0, time: 1000, hideWeapon: true });
  assert.equal(renderer.tracers.length, 1, 'a winning final shot cannot disappear when the engine changes phase in the same tick');
  assert.ok(renderer.stats.bloodParticles > 0 && renderer.stats.visibleBloodParticles > 0);
  renderer.render(state, { localId: 0, time: 1005, hideWeapon: true });
  assert.equal(renderer.tracers.length, 1, 'repeated snapshots do not replay the final shot');
  renderer.render(state, { localId: 0, time: 2000, hideWeapon: true });
  assert.equal(renderer.tracers.length, 0); assert.equal(renderer.stats.bloodParticles, 0, 'wave completion effects expire normally');
  renderer.destroy();
});

test('three allies, a dense 24-monster wave and all dropped supplies reuse existing draw passes and geometry storage', () => {
  const { renderer, uploads } = harness();
  const state = { gameId: 'voxel-horde', map: MAPS.paris, phase: 'fight', round: 1, tick: 100,
    players: [0, 1, 2].map(id => ({ ...createCombatPlayer(id), team: 0, x: id * 3 - 4, z: 8 })).concat(Array.from({ length: HORDE_RULES.maxMonsters }, (_, index) => monster(TYPES[index % TYPES.length], { id: index + 3, x: index % 6 * 3 - 8, y: 0, z: Math.floor(index / 6) * 4 - 8, vx: 2, vz: -1 }))),
    loot: Array.from({ length: HORDE_RULES.maxLoot }, (_, id) => ({ id, kind: id % 2 ? 'heal' : 'ammo', x: id % 5 * 2 - 4, y: 0, z: Math.floor(id / 5) * 2 - 4 })),
    spawnWarnings: Array.from({ length: HORDE_RULES.maxWarnings }, (_, id) => ({ id, x: id * 4 - 6, y: 0, z: -18, monsterType: TYPES[id], ticksLeft: 90, durationTicks: 90 })),
    events: [] };
  const buffers = new Map(); let bytes;
  for (let frame = 0; frame < 12; frame++) {
    uploads.length = 0; renderer.render({ ...state, players: state.players.map(player => ({ ...player })), loot: state.loot.map(item => ({ ...item })), spawnWarnings: state.spawnWarnings.map(warning => ({ ...warning, ticksLeft: 90 - frame })) }, { localId: 0, time: 1000 + frame * 1000 / 120 });
    assert.equal(renderer.stats.lootItems, 20); assert.equal(renderer.stats.spawnWarnings, 4);
    assert.ok(renderer.stats.dynamicVertices < 48000, `${renderer.stats.dynamicVertices}: whole dense wave in a bounded batch`);
    assert.ok(renderer.stats.drawCalls <= 7, 'monsters and portals do not add a GPU draw call per entity');
    for (const upload of uploads) {
      assert.ok(upload.mesh.every(Number.isFinite));
      if (buffers.has(upload.kind)) assert.equal(upload.buffer, buffers.get(upload.kind), `${upload.kind}: reuse warmed geometry storage`);
      else buffers.set(upload.kind, upload.buffer);
    }
    if (bytes) assert.equal(renderer.stats.geometryBufferBytes, bytes); else bytes = renderer.stats.geometryBufferBytes;
  }
  assert.equal(renderer.stats.cachedMaps, 1);
  assert.equal(renderer.stats.lootGeometryBuilds, 20); assert.equal(renderer.stats.spawnWarningBuilds, 4);
  renderer.resetEffects(); assert.equal(renderer.stats.cachedSpawnWarnings, 0);
  renderer.destroy();
});

test('the real Last Stand countdown, spawn warning and first monster retain physical maps while dropping tactical site paint', () => {
  const { renderer, uploads } = harness(), state = createState({ capacity: 3, mapId: 'courtyard', seed: 123 });
  startMatch(state, [0, 1, 2]);
  let sawWarning = false, sawMonster = false, builtMap;
  const getMap = renderer._getMap;
  renderer._getMap = function(map) { builtMap = map; return getMap.call(this, map); };
  for (let tick = 0; tick < 600 && !sawMonster; tick++) {
    step(state, state.players.map(player => emptyInput(player)));
    if (!state.spawnWarnings.length && !state.players.some(player => player.monster && player.alive)) continue;
    uploads.length = 0; renderer.render(state, { localId: 0, time: state.tick * 1000 / 120, hideWeapon: true });
    sawWarning ||= state.spawnWarnings.length > 0; sawMonster ||= state.players.some(player => player.monster && player.alive);
    assert.equal(renderer.stats.spawnWarnings, state.spawnWarnings.length);
    assert.ok(renderer.stats.drawCalls <= 7 && renderer.stats.dynamicVertices < 12000);
    assert.equal(builtMap.sites.length, 0, 'survival arenas do not advertise bomb objectives');
  }
  assert.ok(sawWarning && sawMonster, 'actual engine telegraphs and then spawns its first original monster');
  assert.ok(builtMap.colliders.length > 0 && builtMap.spawns.length > 0, 'the real cover and physical start locations remain intact');
  assert.equal(builtMap.colliders, TACTICAL_MAPS.courtyard.colliders, 'survival art shares the exact authoritative collider objects');
  assert.equal(builtMap.spawns, TACTICAL_MAPS.courtyard.spawns);
  assert.ok(TACTICAL_MAPS.courtyard.sites.length > 0, 'rendering survival never changes the tactical engine map');
  assert.equal(renderer.stats.cachedMaps, 1, 'an immutable survival descriptor is reused rather than rebuilt every frame');
  renderer.destroy();
});
