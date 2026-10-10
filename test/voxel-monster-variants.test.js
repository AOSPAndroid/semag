import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendMonsterVariant, MONSTER_VARIANT_ART, MONSTER_VARIANT_IDS } from '../public/voxel-monster-variants.js';
import { monsterMeshes, monsterDeathMeshes, createMonsterDeathMeshPresenter } from '../public/voxel-renderer.js';
import { createMonsterDeathPresenter, MONSTER_DEATH_RULES } from '../public/voxel-monster-death.js';

const position = Object.freeze({ x: 3, y: .7, z: -4, yaw: .9 });
function actor(type, extra = {}) {
  return { id: 9, lifeId: 3, monster: true, human: false, monsterType: type, alive: true, x: 3, y: .7, z: -4, yaw: .9, monsterState: 'pursuit', ...extra };
}
function body(player, options = {}) {
  const boxes = [], mesh = { box(x, y, z, w, h, d, color, pose) { boxes.push({ x, y, z, w, h, d, color, pose }); } };
  assert.equal(appendMonsterVariant(mesh, player, position, options), true); return boxes;
}
const fingerprint = boxes => createHash('sha256').update(JSON.stringify(boxes)).digest('hex');

test('three unarmed variant palettes are immutable and each authored silhouette has a bounded cuboid budget', () => {
  assert.deepEqual(MONSTER_VARIANT_IDS, ['bomber', 'spitter', 'weaver']); assert.ok(Object.isFrozen(MONSTER_VARIANT_IDS)); assert.ok(Object.isFrozen(MONSTER_VARIANT_ART));
  const signatures = new Set();
  for (const id of MONSTER_VARIANT_IDS) {
    const art = MONSTER_VARIANT_ART[id], player = actor(id), before = structuredClone(player), boxes = body(player);
    assert.ok(Object.isFrozen(art)); assert.ok(boxes.length >= 20 && boxes.length * 36 <= 1300);
    assert.ok(boxes.every(box => /^#[0-9a-f]{6}$/.test(box.color) && box.pose === position));
    assert.deepEqual(player, before); assert.deepEqual(body(player), boxes); signatures.add(fingerprint(boxes));
    assert.equal(Object.hasOwn(art, 'weapon'), false, 'none of these silhouettes invents a gun role');
  }
  assert.equal(signatures.size, 3);
});

test('walking feet, opening jaws, swelling bellies and casting hands remain inside actual default hit boxes', () => {
  for (const id of MONSTER_VARIANT_IDS) for (let charge = 0; charge <= 16; charge++) for (let phase = 0; phase <= 16; phase++) {
    const art = MONSTER_VARIANT_ART[id], player = actor(id, { monsterState: art.state, attackTicks: 120 - charge * 120 / 16, attackDuration: 120 });
    const boxes = body(player, { animation: { phase: phase * Math.PI * 2 / 16, stride: 1 }, time: phase * 777 });
    for (const box of boxes) {
      assert.ok([box.x, box.y, box.z, box.w, box.h, box.d].every(Number.isFinite)); assert.ok(box.w > 0 && box.h > 0 && box.d > 0);
      assert.ok(box.y >= 0 && box.y + box.h <= 1.8 + 1e-8, `${id}: anatomy remains at real floor and crown`);
      const extent = box.y + box.h > 1.48 + 1e-8 ? .22 : .29;
      assert.ok(box.x >= -extent - 1e-8 && box.x + box.w <= extent + 1e-8, `${id}: ${box.x}/${box.y} visible width matches damage volume`);
      assert.ok(box.z >= -extent - 1e-8 && box.z + box.d <= extent + 1e-8, `${id}: ${box.z}/${box.y} visible depth matches damage volume`);
      for (const x of [box.x, box.x + box.w]) for (const z of [box.z, box.z + box.d]) assert.ok(Math.hypot(x, z) <= extent + 1e-8, `${id}: continuous turns remain inside world-aligned flesh`);
    }
  }
});

test('the actual renderer preserves the released idle, attack-tell and corpse anatomy byte for byte', () => {
  const signature = createHash('sha256');
  for (const type of ['stalker', 'runner', 'brute', 'gunner', 'sniper', 'hound', 'leaper', 'screecher']) {
    for (const state of ['pursuit', 'windup', 'lungeWindup', 'leap', 'roar', 'aiming', 'dead']) for (const frame of [0, 1, 2]) {
      const player = { id: 8, lifeId: 3, monster: true, human: false, monsterType: type, alive: state !== 'dead', x: 2.4, y: .7, z: -3.1, yaw: frame * .73, pitch: .16, monsterState: state, attackTicks: 18, attackDuration: 72, lungeTicks: 12, roarTicks: 22, roarDuration: 72, monsterRallyTicks: frame ? 60 : 0, vx: frame * 1.4, vz: -frame * .8 };
      // Running limbs deliberately change. Freeze travel here so the same
      // golden still guards the authored silhouettes, attack tells and corpses.
      const mesh = monsterMeshes(player, frame * 1379, { phase: frame * .67, stride: 0, speed: 0 });
      signature.update(`${type}:${state}:${frame}:`); signature.update(new Uint8Array(mesh.buffer, mesh.byteOffset, mesh.byteLength));
    }
  }
  assert.equal(signature.digest('hex'), '506464e80632b6489e6bcad5ee9359628d56317f4f3c4f6b190f58f0b1b0eafa');
});

test('actual live meshes keep every charged and walking corner inside world-aligned hit boxes at continuous yaw', () => {
  const signatures = new Set();
  for (const id of MONSTER_VARIANT_IDS) for (const charge of [0, .5, 1]) for (const phase of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) for (let turn = 0; turn < 24; turn++) {
    const player = actor(id, { yaw: turn * Math.PI / 12, monsterState: MONSTER_VARIANT_ART[id].state, attackTicks: 90 * (1 - charge), attackDuration: 90 });
    const before = structuredClone(player), mesh = monsterMeshes(player, 1000, { phase, stride: 1, speed: 6 });
    assert.ok(mesh instanceof Float32Array && mesh.length % 30 === 0 && mesh.every(Number.isFinite)); assert.ok(mesh.length / 10 <= 1300);
    for (let at = 0; at < mesh.length; at += 10) {
      const y = mesh[at + 1] - player.y, extent = y > 1.48 + 2e-6 ? .22 : .29;
      assert.ok(y >= -2e-6 && y <= 1.8 + 2e-6); assert.ok(Math.abs(mesh[at] - player.x) <= extent + 2e-6 && Math.abs(mesh[at + 2] - player.z) <= extent + 2e-6, `${id}/${charge}/${turn}: displayed flesh agrees with authoritative shots`);
      assert.ok(Math.abs(Math.hypot(mesh[at + 3], mesh[at + 4], mesh[at + 5]) - 1) < 2e-6);
      assert.ok(mesh.subarray(at + 6, at + 10).every(value => value >= 0 && value <= 1));
    }
    assert.deepEqual(player, before); if (charge === 0 && phase === 0 && turn === 0) signatures.add(createHash('sha256').update(new Uint8Array(mesh.buffer)).digest('hex'));
  }
  assert.equal(signatures.size, 3);
});

test('new species use their original anatomy for authoritative cached death collapse and dissolve without carried guns', () => {
  const support = { colliders: [{ x: -10, y: 0, z: -10, w: 20, h: 3, d: 20 }] }, presentDeaths = createMonsterDeathPresenter(), presentMesh = createMonsterDeathMeshPresenter();
  const state = { gameId: 'voxel-horde', mapId: 'test', matchId: 1, horde: { sessionId: 1 }, phase: 'fight', tick: 0, eventId: 0, events: [], players: MONSTER_VARIANT_IDS.map((type, id) => actor(type, { id, y: 3, hp: 100 })) };
  assert.deepEqual(presentDeaths(state, 0), []); state.tick = 1;
  state.events = state.players.map(player => { player.alive = false; player.hp = 0; return { id: ++state.eventId, type: 'kill', targetId: player.id, targetLifeId: player.lifeId, monsterType: player.monsterType, x: player.x, y: player.y, z: player.z, yaw: player.yaw, tick: state.tick }; });
  const deaths = presentDeaths(state, 10), signatures = new Set(); assert.equal(deaths.length, 3);
  const before = JSON.stringify(state);
  for (const death of deaths) {
    const fresh = monsterDeathMeshes(death, 0, support), collapsed = monsterDeathMeshes(death, 360, support), dissolved = monsterDeathMeshes(death, 850, support);
    assert.ok(fresh.length > 0 && collapsed.length > 0 && dissolved.length < fresh.length); assert.notDeepEqual(collapsed, fresh);
    for (const age of [0, 80, 170, 250, 360, 540, 750, 950]) {
      const mesh = monsterDeathMeshes(death, age, support); assert.ok(mesh.length / 10 <= 1300 && mesh.every(Number.isFinite));
      for (let at = 0; at < mesh.length; at += 10) assert.ok(mesh[at + 1] >= 3 - 2e-6);
    }
    assert.deepEqual(monsterDeathMeshes({ ...death, weapon: 'odin' }, 360, support), collapsed); assert.equal(monsterDeathMeshes(death, MONSTER_DEATH_RULES.durationMs, support).length, 0);
    signatures.add(createHash('sha256').update(new Uint8Array(fresh.buffer, fresh.byteOffset, fresh.byteLength)).digest('hex'));
  }
  assert.equal(signatures.size, 3); const first = presentMesh(deaths, support); assert.ok(first.length > 0); assert.equal(presentMesh.getStats().geometryBuilds, 3);
  for (const ageMs of [80, 360, 700, 900]) presentMesh(deaths.map(death => ({ ...death, ageMs })), support);
  assert.equal(presentMesh.getStats().geometryBuilds, 3, 'all collapse frames reuse the three cached corpse buffers');
  presentMesh(deaths.map(death => ({ ...death, ageMs: MONSTER_DEATH_RULES.durationMs })), support); assert.equal(presentMesh.getStats().vertices, 0); assert.equal(JSON.stringify(state), before);
});

test('accepted special attack timers change readable anatomy and glow without time-driven animation while stopped', () => {
  for (const id of MONSTER_VARIANT_IDS) {
    const art = MONSTER_VARIANT_ART[id], idle = body(actor(id)), start = body(actor(id, { monsterState: art.state, attackTicks: 90, attackDuration: 90 }));
    const halfPlayer = actor(id, { monsterState: art.state, attackTicks: 45, attackDuration: 90 }), half = body(halfPlayer, { time: 1000 });
    const full = body(actor(id, { monsterState: art.state, attackTicks: 0, attackDuration: 90 }));
    assert.deepEqual(start, idle); assert.notEqual(fingerprint(half), fingerprint(idle)); assert.notEqual(fingerprint(full), fingerprint(half));
    assert.ok(full.some(box => box.color === art.charge), `${id}: the completed tell is bright and readable`);
    assert.deepEqual(body(halfPlayer, { time: 80000 }), half, 'wall-clock changes cannot continue a paused attack tell');
    assert.equal(full.length, idle.length, 'charging adds no geometry, particle batches or transient meshes');
  }
});

test('living gait follows provided traveled phase while idle and corpse geometry stays planted', () => {
  for (const id of MONSTER_VARIANT_IDS) {
    const player = actor(id), idle = body(player), left = body(player, { animation: { phase: Math.PI / 2, stride: 1 } }), right = body(player, { animation: { phase: Math.PI * 1.5, stride: 1 } });
    assert.notEqual(fingerprint(left), fingerprint(idle)); assert.notEqual(fingerprint(left), fingerprint(right));
    assert.deepEqual(body(player, { animation: { phase: Math.PI / 2, stride: 0 } }), idle);
    const dead = actor(id, { alive: false, monsterState: MONSTER_VARIANT_ART[id].state, attackTicks: 0, attackDuration: 90 }), corpse = body(dead);
    assert.deepEqual(body(dead, { animation: { phase: Math.PI / 2, stride: 1 }, time: 9999 }), corpse);
    assert.equal(corpse.length, idle.length); assert.ok(corpse.every(box => ![MONSTER_VARIANT_ART[id].eye, MONSTER_VARIANT_ART[id].charge].includes(box.color)));
    assert.ok(corpse.every((box, index) => ['x', 'y', 'z', 'w', 'h', 'd'].every(key => box[key] === idle[index][key])));
  }
});

test('invalid or spoofed actors, poses and renderer targets cannot append any partial anatomy', () => {
  for (const player of [null, actor('constructor'), actor('__proto__'), actor('missing'), actor('stalker'), actor('bomber', { monster: false }), actor('bomber', { human: true })]) {
    let boxes = 0; assert.equal(appendMonsterVariant({ box() { boxes++; } }, player, position), false); assert.equal(boxes, 0);
  }
  for (const pose of [null, { ...position, x: NaN }, { ...position, y: Infinity }, { ...position, z: undefined }, { ...position, yaw: NaN }]) {
    let boxes = 0; assert.equal(appendMonsterVariant({ box() { boxes++; } }, actor('bomber'), pose), false); assert.equal(boxes, 0);
  }
  assert.equal(appendMonsterVariant(null, actor('bomber'), position), false); assert.equal(appendMonsterVariant({}, actor('bomber'), position), false);
});

test('absent or malformed tell/gait fields remain finite and cannot fabricate an out-of-bounds body', () => {
  for (const id of MONSTER_VARIANT_IDS) for (const patch of [{ attackTicks: NaN }, { attackTicks: Infinity }, { attackDuration: 0 }, { attackDuration: NaN }, { attackTicks: -100, attackDuration: 1 }, { attackTicks: 999999, attackDuration: 1 }]) {
    const boxes = body(actor(id, { monsterState: MONSTER_VARIANT_ART[id].state, ...patch }), { animation: { phase: NaN, stride: Infinity }, time: NaN });
    assert.ok(boxes.every(box => [box.x, box.y, box.z, box.w, box.h, box.d].every(Number.isFinite)));
    assert.ok(boxes.length * 36 <= 1300);
  }
});
