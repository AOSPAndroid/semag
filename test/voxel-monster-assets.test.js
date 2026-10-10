import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createCombatPlayer, WORLD } from '../public/voxel-engine.js';
import { HORDE_RULES } from '../public/voxel-horde-engine.js';
import { MAPS } from '../public/voxel-royale-maps.js';
import { monsterBodyBoxes, monsterBodyProfile } from '../public/voxel-monster-bodies.js';
import { monsterAnimationPose, createMonsterAnimationPresenter, monsterMeshes, createSpawnWarningPresenter, VoxelRenderer } from '../public/voxel-renderer.js';

const TYPES = ['hound', 'leaper', 'screecher'];
const ORIGINAL_TYPES = ['stalker', 'runner', 'brute', 'gunner', 'sniper', ...TYPES];
const ALL_TYPES = [...ORIGINAL_TYPES, 'bomber', 'spitter', 'weaver'];
const digest = mesh => createHash('sha256').update(new Uint8Array(mesh.buffer, mesh.byteOffset, mesh.byteLength)).digest('hex');
const actor = (monsterType, patch = {}) => ({ ...createCombatPlayer(7), monster: true, human: false, monsterType, team: 1, x: 2.25, y: 4, z: -3.5, attackDuration: monsterType === 'hound' ? 24 : 54, roarDuration: 72, lungeDuration: 30, ...patch });
const inside = (point, box) => point[0] >= box.x - .000002 && point[0] <= box.x + box.w + .000002 && point[1] >= box.y - .000002 && point[1] <= box.y + box.h + .000002 && point[2] >= box.z - .000002 && point[2] <= box.z + box.d + .000002;
const localPoints = (mesh, player) => {
  const c = Math.cos(player.yaw), s = Math.sin(player.yaw), points = [];
  for (let at = 0; at < mesh.length; at += 10) {
    const x = mesh[at] - player.x, z = mesh[at + 2] - player.z;
    points.push([c * x + s * z, mesh[at + 1] - player.y, -s * x + c * z]);
  }
  return points;
};

test('all new anatomy and attack poses remain inside actual flesh and movement bounds at every continuous yaw', () => {
  const states = ['emerging', 'chase', 'windup', 'lungeWindup', 'leap', 'roar', 'recover', 'stagger'];
  for (const type of TYPES) for (const monsterState of states) for (const fraction of [0, .5, .999]) for (const phase of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) for (let turn = 0; turn < 24; turn++) {
    const player = actor(type, { monsterState, yaw: turn * Math.PI / 12, attackTicks: 54 * (1 - fraction), roarTicks: 72 * (1 - fraction), lungeTicks: 30 * (1 - fraction), monsterRallyTicks: turn % 2 ? 180 : 0 });
    const before = JSON.stringify(player), mesh = monsterMeshes(player, 1000, { phase, stride: 1, speed: 9 });
    assert.ok(mesh.every(Number.isFinite) && mesh.length % 30 === 0);
    assert.ok(mesh.length / 10 < 1100, `${type}: whole anatomy remains affordable`);
    const body = monsterBodyProfile(player), boxes = monsterBodyBoxes(player);
    for (const point of localPoints(mesh, player)) {
      assert.ok(point[1] >= -.000002 && point[1] <= (body?.height || WORLD.standHeight) + .000002, `${type}: physical height`);
      assert.ok(Math.hypot(point[0], point[2]) <= (body?.radius || WORLD.radius) + .000002, `${type}: ears, tail and claws cannot enter a wall`);
      if (boxes) assert.ok(boxes.some(box => inside(point, box)), `${type}/${monsterState}: ${point} is real flesh`);
      else {
        // Humanoid shot boxes are world-aligned, independent of turn.
        const x = Math.cos(player.yaw) * point[0] - Math.sin(player.yaw) * point[2], z = Math.sin(player.yaw) * point[0] + Math.cos(player.yaw) * point[2];
        const radius = point[1] > WORLD.standHeight - .32 + .000002 ? .22 : .29;
        assert.ok(Math.abs(x) <= radius + .000002 && Math.abs(z) <= radius + .000002, `${type}: rotated real ${radius === .22 ? 'head' : 'body'} box`);
      }
    }
    assert.equal(JSON.stringify(player), before, 'geometry never changes simulation state');
  }
});

test('hound has four separate planted paws, a true muzzle, ears and a short hittable tail instead of humanoid anatomy', () => {
  const player = actor('hound', { x: 0, y: 0, z: 0 }), points = localPoints(monsterMeshes(player), player);
  for (const x of [-.13, .13]) for (const z of [-.19, .21]) assert.ok(points.some(point => point[1] < .012 && Math.abs(point[0] - x) < .061 && Math.abs(point[2] - z) < .09), `distinct grounded paw ${x}/${z}`);
  assert.ok(points.some(([x, y, z]) => y > .79 && z < -.25 && x < -.02), 'left raised ear');
  assert.ok(points.some(([x, y, z]) => y > .79 && z < -.25 && x > .02), 'right raised ear');
  assert.ok(points.some(([, y, z]) => z < -.45 && y > .60), 'forward nose within the real head');
  assert.ok(points.some(([x, y, z]) => Math.abs(x) < .04 && z > .32 && y > .47), 'short posterior stub has a real torso hit region');
  assert.equal(Math.max(...points.map(([, y]) => y)).toFixed(2), '0.80');
});

test('new species have different silhouettes and real readable bite, crouch-lunge and throat-roar tells', () => {
  const ready = TYPES.map(type => monsterMeshes(actor(type), 1000));
  assert.equal(new Set(ready.map(digest)).size, 3);
  for (const type of TYPES) {
    const state = type === 'hound' ? 'windup' : type === 'leaper' ? 'lungeWindup' : 'roar';
    const early = monsterMeshes(actor(type, { monsterState: state, attackTicks: 54, roarTicks: 72 }), 1000);
    const late = monsterMeshes(actor(type, { monsterState: state, attackTicks: 1, roarTicks: 1 }), 1000);
    assert.notEqual(digest(early), digest(late), `${type}: actual warning timer changes anatomy and danger color`);
    assert.equal(early.length, late.length, 'animation changes existing surfaces without extra entity draw calls');
    const walking = actor(type, { vx: 5, vz: 2 });
    assert.notEqual(digest(monsterMeshes(walking, 1000)), digest(monsterMeshes(walking, 1080)), 'moving gait animates');
    assert.deepEqual(monsterMeshes(actor(type), 1000), monsterMeshes(actor(type), 1080), 'idle pure anatomy has no clock jitter');
    const before = monsterMeshes({ ...walking, yaw: .4 - .001 }, 1000), after = monsterMeshes({ ...walking, yaw: .4 + .001 }, 1000);
    let maximum = 0;
    for (let at = 0; at < before.length; at += 10) maximum = Math.max(maximum, Math.hypot(after[at] - before[at], after[at + 1] - before[at + 1], after[at + 2] - before[at + 2]));
    assert.ok(maximum > 0 && maximum < .0011, `${type}: turns remain continuous`);
  }
  const leaper = actor('leaper'), standing = localPoints(monsterMeshes(leaper), leaper), crouch = localPoints(monsterMeshes({ ...leaper, monsterState: 'lungeWindup', attackTicks: 1 }), leaper);
  assert.ok(Math.max(...standing.map(([, y]) => y)) - Math.max(...crouch.map(([, y]) => y)) > .04, 'the committed lunge visibly crouches without leaving the head box');
  const normal = monsterMeshes(actor('leaper'), 1000), jumping = monsterMeshes(actor('leaper', { monsterState: 'leap', lungeTicks: 25 }), 1000);
  assert.notEqual(digest(normal), digest(jumping), 'claws stay raised for actual committed leap travel');
});

test('presented gait follows distance, rejects correction jitter, settles idle and holds its pose through pause and resumption', () => {
  for (const type of ALL_TYPES) {
    const present = createMonsterAnimationPresenter(), player = actor(type, { x: 0, y: 0, z: 0, lifeId: 1 });
    const initial = present(player, 0, 'match1');
    assert.equal(initial.stride, 0);
    let current;
    for (let frame = 1; frame <= 120; frame++) current = present({ ...player, x: frame * 5 / 120 }, frame * 1000 / 120, 'match1');
    assert.ok(current.stride > .98 && current.speed > 4.99);
    const cycle = type === 'hound' ? 1.28 : type === 'leaper' ? 2.05 : type === 'screecher' ? 1.85 : type === 'runner' ? 1.75 : 3;
    const phase = (initial.phase + 5 * Math.PI * 2 / cycle) % (Math.PI * 2);
    assert.ok(Math.abs(current.phase - phase) < .000001, 'phase uses travelled metres, independent of refresh rate');
    assert.strictEqual(present({ ...player, x: 5 }, 1000, 'match1'), current, 'second pass at the same timestamp keeps one pose');
    assert.strictEqual(present({ ...player, x: 5 }, 1050, 'match1', { paused: true }), current);
    assert.strictEqual(present({ ...player, x: 5 }, 1500, 'match1', { paused: true }), current);
    assert.strictEqual(present({ ...player, x: 5 }, 1600, 'match1'), current, 'resume discards wall time without a phase jump');
    const parkedPhase = current.phase;
    for (let frame = 1; frame <= 120; frame++) current = present({ ...player, x: 5 + (frame % 2 ? .0001 : 0) }, 1600 + frame * 1000 / 120, 'match1');
    assert.equal(current.phase, parkedPhase, 'sub-millimetre corrections do not flap paws');
    assert.equal(current.stride, 0, 'parked limbs settle naturally');
    assert.equal(present({ ...player, x: 5, lifeId: 2 }, 2700, 'match1').stride, 0, 'new life discards old travel');
    assert.equal(present({ ...player, x: 50 }, 2800, 'match1').stride, 0, 'teleport does not fake a burst of running');
    assert.equal(present({ ...player, x: 50 }, 2810, 'match2').stride, 0, 'new map or match discards gait history');
    present.retain([]); assert.equal(present.size, 0);
    for (let id = 0; id < 100; id++) present({ ...player, id }, 3000, 'match2');
    assert.equal(present.size, 20, 'history storage is bounded to real wave size');
    present.reset(); assert.equal(present.size, 0);
  }
  assert.equal(monsterAnimationPose(actor('hound', { alive: false, vx: 9 }), 1000).stride, 0);
});

test('rally marks only actually buffed monsters and pending new species have distinct small depth-tested spawn colors', () => {
  for (const type of ORIGINAL_TYPES) {
    const normal = monsterMeshes(actor(type), 1000), buffed = monsterMeshes(actor(type, { monsterRallyTicks: 180 }), 1000);
    assert.notEqual(digest(normal), digest(buffed), `${type}: actual rally state has a compact in-world cue`);
    assert.deepEqual(monsterMeshes(actor(type, { monsterRallyTicks: 0 }), 1000), normal, 'cue expires with authoritative effect');
    assert.ok(buffed.length - normal.length <= 60, 'a buff marker adds at most one small painted quad');
  }
  const signatures = new Set();
  for (const type of TYPES) {
    const present = createSpawnWarningPresenter(), warning = { id: 1, monsterType: type, x: 0, y: 0, z: 0, ticksLeft: 90, durationTicks: 90 };
    const result = present([warning], 1000);
    signatures.add(digest(result.contacts));
    assert.ok(result.contacts.length / 10 < 600 && result.contacts.every(Number.isFinite));
    assert.equal(present.getStats().cachedItems, 1);
    assert.equal(present([{ ...warning, ticksLeft: 0 }], 2000).contacts.length, 0, 'expired warning is removed');
  }
  assert.equal(signatures.size, 3, 'hound amber, leaper pale green and screecher pink remain distinguishable');
});

function harness() {
  const uploads = [];
  const gl = new Proxy({}, { get(_, key) {
    if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
    if (key === 'getAttribLocation') return () => 0;
    if (key === 'getUniformLocation') return (_program, uniform) => uniform;
    if (typeof key === 'string' && key.startsWith('create')) return () => ({});
    return () => {};
  } });
  const renderer = new VoxelRenderer({ getContext: () => gl, getBoundingClientRect: () => ({ width: 960, height: 540 }), addEventListener() {}, removeEventListener() {} });
  const upload = renderer._dynamic;
  renderer._dynamic = function(array, kind = 'world') { uploads.push({ kind, mesh: array.slice(), buffer: array.buffer }); return upload.call(this, array, kind); };
  return { renderer, uploads };
}

test('hound, leaper and screecher never draw a firearm even if a stale snapshot includes weapon, ammo and aiming fields', () => {
  const { renderer, uploads } = harness(), camera = { ...createCombatPlayer(0), x: -5 }, map = { id: 'new-creature-fixture', theme: 'custom', colliders: [], sites: [], bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 } };
  for (const type of TYPES) {
    const player = actor(type, { vx: 0, vz: 0, monsterState: 'aiming', weapon: 'lmg', ammo: 75, slot: 'primary' });
    uploads.length = 0;
    renderer.render({ gameId: 'voxel-horde', map, phase: 'fight', round: 1, players: [camera, player], loot: [], events: [] }, { localId: 0, time: 1000, hideWeapon: true });
    assert.deepEqual(uploads.find(upload => upload.kind === 'world').mesh, monsterMeshes(player, 1000), 'actual opaque upload contains only the creature');
    assert.ok(renderer.stats.drawCalls <= 7);
  }
  renderer.destroy();
});

test('actual mixed-species world upload holds its running anatomy through a long pause and first resumed frame', () => {
  const { renderer, uploads } = harness(), camera = { ...createCombatPlayer(0), x: -5 }, map = { id: 'creature-pause-fixture', theme: 'custom', colliders: [], sites: [], bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 } };
  const monsters = ALL_TYPES.map((type, index) => actor(type, { id: index + 1, x: index, y: 0, z: -3, vx: 5, lifeId: 1, slot: 'empty' }));
  const state = { gameId: 'voxel-horde', map, phase: 'fight', round: 1, players: [camera, ...monsters], loot: [], events: [] };
  const draw = time => { uploads.length = 0; renderer.render(state, { localId: 0, time, hideWeapon: true }); return uploads.find(upload => upload.kind === 'world').mesh; };
  const initial = draw(0);
  let running;
  for (let frame = 1; frame <= 20; frame++) {
    state.players = [camera, ...monsters.map(player => ({ ...player, x: player.x + frame * .05 }))];
    running = draw(frame * 10);
  }
  assert.notEqual(digest(initial), digest(running), 'every live movement is presented through the actual world batch');
  state.phase = 'paused';
  assert.deepEqual(draw(1000), running);
  assert.deepEqual(draw(6000), running, 'long wall time leaves posed feet and claws frozen');
  state.phase = 'fight';
  assert.deepEqual(draw(7000), running, 'resuming cannot catch up wall-clock walking');
  renderer.destroy();
});

test('a full mixed monster wave, three allies, all supplies, warnings, grenades and hit effects preserve the existing draw and vertex budgets', t => {
  const { renderer, uploads } = harness();
  const players = [0, 1, 2].map(id => ({ ...createCombatPlayer(id), human: true, team: 0, weapon: 'dualsmg', ammo: 48, x: id * 3 - 3, z: 12 })).concat(Array.from({ length: HORDE_RULES.maxMonsters }, (_, index) => actor(ALL_TYPES[index % ALL_TYPES.length], { id: index + 3, lifeId: 1, x: index % 5 * 3 - 6, y: 0, z: Math.floor(index / 5) * 3 - 6, weapon: index % 2 ? 'sniper' : 'lmg', monsterState: index % 3 ? 'lungeWindup' : 'roar', attackTicks: 20, roarTicks: 20, vx: 3, monsterRallyTicks: 180 })));
  const events = Array.from({ length: 100 }, (_, id) => ({ id: id * 2, type: 'shot', weapon: 'lmg', tick: 100, playerId: 0, targetId: 7, x: 0, y: 1.6, z: 4, dx: 0, dy: 0, dz: -1, hitX: 0, hitY: 1.6, hitZ: 0, hitKind: 'body', damage: 26 })).flatMap(event => [event, { ...event, id: event.id + 1, type: 'damage', attack: 'gun' }]);
  const state = { gameId: 'voxel-horde', map: MAPS.paris, phase: 'fight', round: 1, tick: 100, players,
    loot: Array.from({ length: HORDE_RULES.maxLoot }, (_, id) => ({ id, kind: id % 3 === 0 ? 'weapon' : id % 3 === 1 ? 'heal' : 'ammo', weapon: 'dualsmg', x: id % 5 * 2 - 4, y: 0, z: Math.floor(id / 5) * 2 - 4 })),
    spawnWarnings: Array.from({ length: HORDE_RULES.maxWarnings }, (_, id) => ({ id, monsterType: TYPES[id % TYPES.length], x: id * 4 - 6, y: 0, z: -18, ticksLeft: 90, durationTicks: 90 })),
    grenades: Array.from({ length: 20 }, (_, id) => ({ id, x: id % 10 * 2 - 10, y: .12, z: 20 + Math.floor(id / 10) * 3, radius: .12, fuseTicks: 180 })), maxGrenades: 20, events };
  const buffers = new Map(); let bytes, peak = 0;
  for (let frame = 0; frame < 12; frame++) {
    uploads.length = 0;
    const moved = { ...state, players: players.map(player => ({ ...player, x: player.x + (player.monster ? frame * .025 : 0) })), spawnWarnings: state.spawnWarnings.map(warning => ({ ...warning, ticksLeft: 90 - frame })) };
    renderer.render(moved, { localId: 0, time: 1000 + frame * 1000 / 120 });
    assert.equal(renderer.stats.lootItems, 20); assert.equal(renderer.stats.spawnWarnings, 4);
    assert.equal(renderer.particles.length, 84); assert.equal(renderer.tracers.length, 14);
    assert.ok(renderer.stats.mapVertices < 100000, 'static map keeps original limit');
    assert.ok(renderer.stats.dynamicVertices < 72000, `${renderer.stats.dynamicVertices}: existing total geometry cap`);
    assert.ok(renderer.stats.drawCalls <= 7, 'no per-monster GPU passes');
    peak = Math.max(peak, renderer.stats.dynamicVertices);
    for (const upload of uploads) {
      assert.ok(upload.mesh.every(Number.isFinite));
      if (buffers.has(upload.kind)) assert.equal(upload.buffer, buffers.get(upload.kind), `${upload.kind}: warmed typed buffer is retained`);
      else buffers.set(upload.kind, upload.buffer);
    }
    if (bytes) assert.equal(renderer.stats.geometryBufferBytes, bytes); else bytes = renderer.stats.geometryBufferBytes;
  }
  assert.ok(renderer.presentMonsters.size <= HORDE_RULES.maxMonsters);
  renderer.resetEffects(); assert.equal(renderer.presentMonsters.size, 0);
  renderer.destroy();
  t.diagnostic(`Mixed full-pool peak ${peak}; ${72000 - peak} vertices remain under the unchanged limit.`);
});
