import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombatPlayer, applyCombatDamage, traceShot, WORLD } from '../public/voxel-engine.js';
import { MONSTER_SHAMBLER_ART, appendMonsterShambler } from '../public/voxel-monster-variants.js';
import { MONSTER_DEATH_RULES } from '../public/voxel-monster-death.js';
import { monsterMeshes, monsterDeathMeshes, createMonsterDeathMeshPresenter, VoxelRenderer } from '../public/voxel-renderer.js';

const art = MONSTER_SHAMBLER_ART;
const map = { id: 'shambler-art', theme: 'forest', bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [], sites: [] };
const monster = (patch = {}) => ({ ...createCombatPlayer(1), monster: true, human: false, monsterType: 'stalker', lifeId: 1, x: 0, y: 0, z: 0, slot: 'empty', ...patch });
const human = () => ({ ...createCombatPlayer(0), human: true, monster: false, connected: true, participating: true, lifeId: 1, weapon: 'odin', ammo: 100, slot: 'primary' });
const scene = players => ({ gameId: 'voxel-horde', mapId: map.id, map, phase: 'fight', round: 1, tick: 100, eventId: 0, events: [], players, horde: { specialId: 0, projectiles: [], hazards: [] } });
function landmarks(player = monster(), animation = { stride: 0 }) {
  const boxes = [], panels = [], pose = { x: 0, y: 0, z: 0, yaw: 0 };
  const mesh = { box(x, y, z, w, h, d, color, attachment) { boxes.push({ x, y, z, w, h, d, color, attachment }); } };
  const front = (x, y, z, w, h, color) => panels.push({ x, y, z, w, h, color });
  assert.equal(appendMonsterShambler(mesh, player, pose, { animation, front }), true);
  return { boxes, panels };
}

test('the base shambler has raised ragged clothing and a visibly damaged asymmetric face, hands and leg', () => {
  assert.ok(Object.isFrozen(art));
  const { boxes, panels } = landmarks();
  assert.equal(boxes.length, 28); assert.equal(panels.length, 33);
  assert.ok(boxes.some(part => part.y < .74 && part.y > .70 && part.color === art.shirt), 'one long torn hem extends lower than the others');
  assert.equal(boxes.filter(part => part.z < -.14 && part.y > 1.1 && part.y < 1.3).length, 2, 'the split shirt lapels are actual raised geometry');
  assert.ok(panels.some(part => part.x > .05 && part.y > 1 && part.color === art.seam), 'a pocket has its own recessed face');
  assert.ok(panels.some(part => part.y < .3 && part.color === art.bone), 'one shin exposes bone instead of another uniform trouser');
  assert.equal(boxes.filter(part => part.y > .7 && part.y < .8 && part.color === art.bone).length, 4, 'four separate uneven hanging fingers');
  assert.ok(boxes.some(part => part.x > .07 && part.y > 1.55 && part.color === art.bone), 'only one cheek is exposed bone');
  assert.ok(panels.some(part => part.x < -.13 && part.y > 1.58 && part.color === art.wound), 'the opposite cheek has a distinct wound');
  const sockets = panels.filter(part => part.y > 1.64 && part.y < 1.67 && part.color === art.shadow);
  assert.equal(sockets.length, 2); assert.notEqual(sockets[0].y, sockets[1].y, 'eyes are intentionally uneven');
  const teeth = panels.filter(part => part.y > 1.54 && part.y < 1.58 && part.color === art.bone);
  assert.equal(teeth.length, 3); assert.equal(new Set(teeth.map(part => part.x)).size, 3, 'an exposed jaw has separated teeth');
  assert.ok(boxes.some(part => Math.abs(part.y + part.h - WORLD.standHeight) < 1e-8), 'cropped hair ends at the real crown');
});

test('fine skin and cloth detail follows the real gait and attack while eyes lose their glow on death', () => {
  const idle = monsterMeshes(monster(), 0, { stride: 0 });
  assert.deepEqual(monsterMeshes(monster(), 99000, { phase: 4, stride: 0 }), idle, 'a clock alone never jitters resting art');
  for (const animation of [{ stride: 1, phase: .7 }, { stride: 1, phase: 3.8 }, { stride: 0, attack: { phase: 'contact', progress: .2, kind: 'windup' } }]) {
    const moved = monsterMeshes(monster(), 1000, animation);
    assert.equal(moved.length, idle.length, 'starting or striking cannot pop extra limbs or garment parts into view');
    assert.notDeepEqual(moved, idle);
  }
  const loaded = landmarks(monster({ monsterState: 'windup', attackDuration: 48, attackTicks: 1 }));
  assert.equal(loaded.panels.filter(part => part.color === art.charge).length, 2, 'the accepted attack tell brightens both eyes');
  const dead = landmarks(monster({ alive: false, monsterState: 'dead' }));
  assert.ok(dead.panels.every(part => ![art.eye, art.charge].includes(part.color)), 'dead enemies have dark eyes');
});

test('all detailed shambler vertices stay hittable and grounded through turns, stride, landing and attack contact', () => {
  for (let yawStep = 0; yawStep < 16; yawStep++) for (const phase of [0, .7, 1.9, 3.8]) for (const attack of [null, { phase: 'startup', progress: .8, kind: 'windup' }, { phase: 'contact', progress: .4, kind: 'windup' }, { phase: 'recovery', progress: .7, kind: 'windup' }]) for (const airborne of [false, true]) {
    const player = monster({ x: 3, y: 2, z: -4, yaw: yawStep * Math.PI / 8, grounded: !airborne, monsterRallyTicks: 60 });
    const before = structuredClone(player), mesh = monsterMeshes(player, 1000, { phase, stride: 1, run: 1, forward: -.8, strafe: .9, airborne, jump: .8, land: airborne ? 0 : .7, attack });
    assert.ok(mesh.length / 10 <= 1250 && mesh.every(Number.isFinite));
    let floor = Infinity;
    for (let at = 0; at < mesh.length; at += 10) {
      const x = mesh[at] - player.x, y = mesh[at + 1] - player.y, z = mesh[at + 2] - player.z;
      assert.ok(y >= -2e-6 && y <= WORLD.standHeight + 2e-6);
      assert.ok(Math.hypot(x, z) <= (y > 1.48 + 2e-6 ? .22 : .29) + 2e-6, 'clothing, fingers and face remain inside the true shooting envelope');
      floor = Math.min(floor, y);
    }
    if (!airborne) assert.ok(Math.abs(floor - .018) < 2e-6, 'at least one real sole stays planted through grounded motion');
    assert.deepEqual(player, before);
  }
});

test('the detailed crown and forehead reward headshots at every facing without widening the authority body', () => {
  for (let step = 0; step < 32; step++) {
    const yaw = step * Math.PI / 16, c = Math.cos(yaw), s = Math.sin(yaw), target = monster({ yaw });
    for (const [x, y, expected] of [[0, 1.72, 'head'], [-.095, 1.66, 'head'], [.095, 1.66, 'head'], [0, 1.02, 'body']]) {
      const hit = traceShot(scene([human(), target]), 0, { x: c * x + s * 3, y, z: s * x - c * 3 }, { x: -s, y: 0, z: c }, 10, map);
      assert.equal(hit.kind, expected); assert.equal(hit.playerId, target.id);
    }
  }
});

test('the detailed dead shambler falls, clears actual nearby cover and dissolves using one cached template', () => {
  const support = { ...map, colliders: [{ x: -10, y: 0, z: -10, w: 20, h: 2, d: 20 }, { x: .55, y: 2, z: -2, w: .3, h: 3, d: 4 }] };
  const death = { key: '1:1', targetId: 1, lifeId: 1, monsterType: 'stalker', x: 0, y: 2, z: 0, yaw: .73, dx: 1, dz: .4, ageMs: 0 };
  const present = createMonsterDeathMeshPresenter(), first = present([death], support), buffer = first.buffer;
  assert.equal(present.getStats().geometryBuilds, 1);
  for (let ageMs = 0; ageMs < MONSTER_DEATH_RULES.durationMs; ageMs += 20) {
    const mesh = present([{ ...death, ageMs }], support);
    assert.equal(mesh.buffer, buffer); assert.equal(present.getStats().geometryBuilds, 1);
    assert.ok(mesh.length / 10 <= 1400 && mesh.every(Number.isFinite));
    for (let at = 0; at < mesh.length; at += 10) {
      assert.ok(mesh[at + 1] >= 2 - 2e-6, 'no piece passes through the actual supporting floor');
      assert.equal(mesh[at] > .55 + 1e-6 && mesh[at] < .85 - 1e-6 && mesh[at + 1] > 2 + 1e-6 && mesh[at + 2] > -2 && mesh[at + 2] < 2, false, 'new details cannot drift into solid cover');
    }
  }
  assert.notDeepEqual(monsterDeathMeshes(death, 360, support), monsterDeathMeshes(death, 0, support));
  assert.equal(present([{ ...death, ageMs: MONSTER_DEATH_RULES.durationMs }], support).length, 0);
});

test('twenty detailed live shamblers, twenty fresh corpses and twenty Odin drops fit warmed existing GPU budgets', () => {
  const calls = { creates: 0, allocations: 0 };
  const gl = new Proxy({}, { get(_, key) {
    if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
    if (key === 'getAttribLocation') return () => 0;
    if (key === 'getUniformLocation') return (_program, uniform) => uniform;
    if (key === 'createBuffer') return () => { calls.creates++; return {}; };
    if (key === 'bufferData') return () => { calls.allocations++; };
    if (typeof key === 'string' && key.startsWith('create')) return () => ({});
    return () => {};
  } });
  const renderer = new VoxelRenderer({ getContext: () => gl, getBoundingClientRect: () => ({ width: 960, height: 540 }), addEventListener() {}, removeEventListener() {} });
  try {
    const local = human(), monsters = Array.from({ length: 20 }, (_, index) => monster({ id: index + 1, team: 1, lifeId: index + 1, x: (index % 5 - 2) * 3, z: -8 - Math.floor(index / 5) * 3, hp: 40, maxHp: 40 }));
    const state = scene([local, ...monsters]); renderer.render(state, { localId: 0, time: 0 }); state.tick++;
    applyCombatDamage(state, monsters.map(player => ({ playerId: 0, targetId: player.id, targetLifeId: player.lifeId, attack: 'gun', weapon: 'carbine', damage: player.hp, dz: -1 })));
    state.players = [local, ...monsters.map(player => ({ ...player, alive: true, hp: 40, lifeId: player.lifeId + 100, x: player.x + 1 }))];
    state.loot = Array.from({ length: 20 }, (_, id) => ({ id, kind: 'weapon', weapon: 'odin', x: (id % 5 - 2) * 3, y: 0, z: -8 - Math.floor(id / 5) * 3, amount: 1 }));
    renderer.render(state, { localId: 0, time: 10 }); const created = calls.creates, allocated = calls.allocations;
    assert.equal(renderer.stats.monsterDeaths.activeCorpses, 20); assert.equal(renderer.stats.lootItems, 20);
    assert.equal(renderer.stats.monsterDeaths.vertices, 20 * 1206);
    for (const time of [20, 40, 60]) {
      renderer.render(state, { localId: 0, time });
      assert.ok(renderer.stats.dynamicVertices < 72000, `full detailed scene: ${renderer.stats.dynamicVertices} vertices`);
      assert.ok(renderer.stats.drawCalls <= 7); assert.equal(calls.creates, created); assert.equal(calls.allocations, allocated);
    }
  } finally { renderer.destroy(); }
});

test('invalid identities and poses never append even partial shambler anatomy', () => {
  for (const player of [null, monster({ monster: false }), monster({ human: true }), monster({ monsterType: ['stalker'] }), monster({ monsterType: new String('stalker') }), monster({ monsterType: '__proto__' })]) {
    let calls = 0;
    assert.equal(appendMonsterShambler({ box() { calls++; } }, player, { x: 0, y: 0, z: 0, yaw: 0 }, { front() { calls++; } }), false);
    assert.equal(calls, 0);
  }
  for (const pose of [null, { x: NaN, y: 0, z: 0, yaw: 0 }, { x: 0, y: 0, z: 0, yaw: Infinity }]) {
    let calls = 0;
    assert.equal(appendMonsterShambler({ box() { calls++; } }, monster(), pose, { front() { calls++; } }), false);
    assert.equal(calls, 0);
  }
});
