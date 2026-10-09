import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer } from '../public/voxel-engine.js';
import { MONSTER_SPECIAL_RULES as RULES, launchMonsterShard, markMonsterRune } from '../public/voxel-monster-specials.js';
import { monsterSpecialMeshes, createMonsterSpecialImpactPresenter, particlePosition, VoxelRenderer } from '../public/voxel-renderer.js';
import { MELEE_WEAPONS } from '../public/voxel-melee.js';
import { DOJO_MAP } from '../public/voxel-dojo-map.js';

const arena = { id: 'special-renderer', theme: 'forest', bounds: { minX: -40, maxX: 40, minZ: -40, maxZ: 40 }, colliders: [], sites: [] };
const human = (id = 0, patch = {}) => ({ ...createCombatPlayer(id), lifeId: 1, connected: true, participating: true, human: true, monster: false, ...patch });
const monster = (type, id = 1, patch = {}) => ({ ...createCombatPlayer(id), lifeId: 1, human: false, monster: true, monsterType: type, x: 0, z: -7, ...patch });
const scene = players => ({ gameId: 'voxel-horde', phase: 'fight', tick: 100, round: 1, map: arena, players, eventId: 0, events: [], horde: { specialId: 0, projectiles: [], hazards: [] } });
const points = array => Array.from({ length: array.length / 10 }, (_, index) => [...array.slice(index * 10, index * 10 + 3)]);

function harness() {
  const calls = { creates: 0, allocations: 0 };
  const gl = new Proxy({}, { get(_target, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (name === 'getUniformLocation') return (_program, uniform) => uniform;
    if (name === 'createBuffer') return () => { calls.creates++; return {}; };
    if (name === 'bufferData') return () => { calls.allocations++; };
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  const canvas = { getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) };
  return { renderer: new VoxelRenderer(canvas), calls };
}

test('real released shards have bounded solids behind their simulated tip, including thin nearby rear cover', () => {
  const source = monster('spitter'), state = scene([human(), source]);
  assert.equal(launchMonsterShard(state, source, 0, 0), true);
  const projectile = state.horde.projectiles[0], before = structuredClone(state), geometry = monsterSpecialMeshes(state, arena);
  assert.equal(geometry.shards, 1); assert.equal(geometry.world.length / 10, 72); assert.equal(geometry.contacts.length, 0);
  assert.ok(points(geometry.world).every(([x, y, z]) => z >= projectile.z && Math.abs(x - projectile.x) <= .023 && Math.abs(y - projectile.y) <= .023));
  const wall = { id: 'rear-cover', x: -2, y: 0, z: projectile.z + .15, w: 4, h: 3, d: .02 };
  const covered = monsterSpecialMeshes(state, { ...arena, colliders: [wall] });
  assert.ok(covered.shards === 1 && covered.world.length > 0);
  assert.ok(points(covered.world).every(([, , z]) => z < wall.z));
  source.alive = false; assert.equal(monsterSpecialMeshes(state, arena).shards, 1, 'a released projectile survives source death for its current life');
  source.lifeId++; assert.equal(monsterSpecialMeshes(state, arena).shards, 0, 'slot reuse never renders the former life projectile');
  source.lifeId--; source.alive = true; assert.deepEqual(state, before);
});

test('fixed rune and bomber rings respect accepted bounds, actual platforms, intervening walls and finite timers', () => {
  const target = human(0, { y: 2 }), source = monster('weaver'), bomber = monster('bomber', 2, { x: 10, z: 6, monsterState: 'bomberFuse', attackTicks: 45, attackDuration: 90 });
  const map = { ...arena, colliders: [{ id: 'deck', x: -3, y: 0, z: -3, w: 6, h: 2, d: 6 }] }, state = scene([target, source, bomber]);
  assert.equal(markMonsterRune(state, source, target, map), true);
  const before = structuredClone(state), geometry = monsterSpecialMeshes(state, map);
  assert.equal(geometry.runes, 1); assert.equal(geometry.fuses, 1); assert.ok(geometry.contacts.length > 0);
  assert.ok(geometry.contacts.every(Number.isFinite));
  const runePoints = points(geometry.contacts).filter(([, y]) => y > 1);
  assert.ok(runePoints.every(([x, y, z]) => Math.abs(y - 2.016) < 1e-6 && Math.hypot(x, z) <= RULES.runeRadius + 1e-6));
  const wall = { id: 'thin-divider', x: -.1, y: 2, z: -4, w: .2, h: 3, d: 8 };
  const covered = monsterSpecialMeshes(state, { ...map, colliders: [...map.colliders, wall] });
  assert.ok(covered.contacts.length < geometry.contacts.length);
  for (let index = 0; index < covered.contacts.length; index += 30) {
    const triangle = [0, 10, 20].map(offset => [...covered.contacts.slice(index + offset, index + offset + 3)]);
    if (triangle[0][1] < 2) continue;
    assert.ok(Math.max(...triangle.map(point => point[0])) < wall.x || Math.min(...triangle.map(point => point[0])) > wall.x + wall.w, 'no ring triangle bridges a real divider');
  }
  const narrow = monsterSpecialMeshes({ ...state, players: state.players.slice(0, 2) }, { ...map, colliders: [{ ...map.colliders[0], x: -1.7, z: -1.7, w: 3.4, d: 3.4 }] });
  assert.ok(points(narrow.contacts).every(([x, , z]) => x >= -1.7 && x <= 1.7 && z >= -1.7 && z <= 1.7), 'warning remains painted on the actual platform');
  source.alive = false; assert.equal(monsterSpecialMeshes(state, map).runes, 0);
  source.alive = true; target.lifeId++; assert.equal(monsterSpecialMeshes(state, map).runes, 0);
  target.lifeId--; state.horde.hazards[0].ticksLeft = 0; assert.equal(monsterSpecialMeshes(state, map).runes, 0);
  state.horde.hazards[0].ticksLeft = before.horde.hazards[0].ticksLeft; assert.deepEqual(state, before);
});

test('special contact events are life-aware, fresh, stage-specific and semantically deduplicated', () => {
  for (const type of ['bomber', 'spitter', 'weaver']) {
    const state = scene([human(), monster(type)]), event = { type: type === 'bomber' ? 'monsterBlast' : type === 'spitter' ? 'monsterShardImpact' : 'monsterMark', stage: 'release', playerId: 1, sourceId: 1, sourceLifeId: 1, specialId: 3, tick: 100, x: 0, y: .2, z: -4 };
    const present = createMonsterSpecialImpactPresenter(), particles = present(event, state, 1000);
    assert.equal(particles.length, type === 'spitter' ? 4 : 12); assert.ok(particles.every(particle => particle.cover && particle.life < 320 && particle.radius <= .8));
    assert.equal(present({ ...event, id: 999 }, state, 1000).length, 0);
    for (const patch of [{ sourceLifeId: 2 }, { tick: 81 }, { tick: 102 }, { x: NaN }]) assert.equal(createMonsterSpecialImpactPresenter()({ ...event, ...patch }, state, 1000).length, 0);
    if (type === 'weaver') for (const stage of ['windup', 'cancel']) assert.equal(createMonsterSpecialImpactPresenter()({ ...event, stage }, state, 1000).length, 0);
    const muted = createMonsterSpecialImpactPresenter(); assert.equal(muted(event, state, 1000, { reducedMotion: true }).length, 0); assert.equal(muted(event, state, 1000).length, 0);
    const wall = { x: -3, y: 0, z: -4.2, w: 6, h: 3, d: .02 };
    for (const particle of particles) assert.ok(particlePosition(particle, 1100, [wall]).point[2] > wall.z + wall.d);
  }
});

test('special snapshot limits and reduced motion keep frozen geometry finite and display-rate independent', () => {
  const state = scene([human(), monster('spitter'), monster('weaver', 2), monster('bomber', 3, { monsterState: 'bomberFuse', attackTicks: 45, attackDuration: 90 })]);
  for (let index = 0; index < 16; index++) launchMonsterShard(state, state.players[1], 0, 0);
  for (let index = 0; index < 4; index++) markMonsterRune(state, state.players[2], state.players[0], arena);
  state.horde.projectiles.push(...state.horde.projectiles.map(projectile => ({ ...projectile, id: projectile.id + 100 })));
  state.horde.hazards.push(...state.horde.hazards.map(hazard => ({ ...hazard, id: hazard.id + 100 })));
  const before = structuredClone(state), geometry = monsterSpecialMeshes(state, arena), reduced = monsterSpecialMeshes(state, arena, { reducedMotion: true });
  assert.equal(geometry.shards, 16); assert.equal(geometry.runes, 4); assert.equal(geometry.fuses, 1);
  assert.ok(geometry.vertices <= 5 * 28 * 12 + 16 * 72);
  assert.deepEqual(points(geometry.contacts), points(reduced.contacts)); assert.ok(reduced.contacts[9] < geometry.contacts[9]);
  assert.deepEqual(monsterSpecialMeshes(state, arena), geometry); assert.deepEqual(state, before);
});

test('Dojo full Horde stress frames share existing buffers and retain seven-draw/72k vertex budgets', () => {
  const players = [human(0, { x: 0, z: 12, slot: 'sword', meleeWeapon: 'katana', meleeYaw: 0, meleePitch: 0, meleeTicks: MELEE_WEAPONS.katana.recoveryTicks + 5 })];
  for (let id = 1; id <= 20; id++) players.push(monster(['bomber', 'spitter', 'weaver'][id % 3], id, { x: id % 5 * 3 - 6, z: -Math.floor(id / 5) * 3, monsterState: id % 3 === 0 ? 'bomberFuse' : 'pursue', attackTicks: 45, attackDuration: 90 }));
  const state = scene(players); state.map = DOJO_MAP; state.loot = Array.from({ length: 20 }, (_, id) => ({ id, kind: 'weapon', weapon: 'odin', x: id % 5 * 2 - 4, y: 0, z: 8 - Math.floor(id / 5) }));
  for (let index = 0; index < 16; index++) launchMonsterShard(state, players[1], 0, 0);
  for (let index = 0; index < 4; index++) markMonsterRune(state, players[2], players[0], DOJO_MAP);
  const { renderer, calls } = harness(); renderer.render(state, { localId: 0, time: 1000 });
  assert.equal(renderer.stats.monsterSpecials.shards, 16); assert.equal(renderer.stats.monsterSpecials.runes, 4); assert.equal(renderer.stats.monsterSpecials.fuses, 4);
  const creates = calls.creates, allocations = calls.allocations, buffers = Object.fromEntries(Object.entries(renderer.frameMeshes).map(([name, mesh]) => [name, mesh.storage.buffer]));
  for (const hz of [60, 120, 144, 240]) for (let frame = 0; frame < 12; frame++) {
    renderer.render(state, { localId: 0, time: 1000 + frame * 1000 / hz });
    assert.ok(renderer.stats.drawCalls <= 7); assert.ok(renderer.stats.dynamicVertices < 72000, `${renderer.stats.dynamicVertices}: full special actor/loot stress`);
    for (const [name, mesh] of Object.entries(renderer.frameMeshes)) assert.equal(mesh.storage.buffer, buffers[name]);
  }
  assert.equal(calls.creates, creates); assert.equal(calls.allocations, allocations);
  renderer.resetEffects(); assert.equal(renderer.stats.monsterSpecials.vertices, 0); renderer.destroy();
});
