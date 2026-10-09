import assert from 'node:assert/strict';
import test from 'node:test';
import { combatStep, createCombatPlayer, emptyInput } from '../public/voxel-engine.js';
import { MELEE_WEAPONS, meleeProfile, meleeSlashGeometry } from '../public/voxel-melee.js';
import { setInventoryMeleeLoadout } from '../public/voxel-inventory.js';
import { createSlashImpactPresenter } from '../public/voxel-slash-effects.js';
import { meleeTrailMeshes, meleeTrailPath, particlePosition, VoxelRenderer } from '../public/voxel-renderer.js';

const arena = { id: 'slash-upgrade', theme: 'forest', bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, colliders: [], sites: [] };
const actor = (weapon = 'sword', id = 0, patch = {}) => ({ ...createCombatPlayer(id), human: true, lifeId: 1, slot: 'sword', meleeWeapon: weapon, meleeYaw: 0, meleePitch: 0, ...patch });
const active = weapon => actor(weapon, 0, { meleeIndex: 1, meleeTicks: MELEE_WEAPONS[weapon].recoveryTicks + MELEE_WEAPONS[weapon].activeTicks * .3 });
const scene = players => ({ gameId: 'voxel-horde', phase: 'fight', tick: 100, round: 1, map: arena, players, events: [], horde: { projectiles: [], hazards: [] } });
const points = array => Array.from({ length: array.length / 10 }, (_, index) => [...array.slice(index * 10, index * 10 + 3)]);

function actualContact({ cover = false, ally = false } = {}) {
  const attacker = actor(), target = actor('knife', 1, { team: 1, x: 0, z: -2.1, monster: true, human: false, monsterType: 'stalker' });
  setInventoryMeleeLoadout(attacker, 'sword', { equip: true });
  const state = scene([attacker, target]); state.tick = 0; state.eventId = 0; state.grenades = []; state.bolts = []; state.loot = [];
  if (ally) state.players.push(actor('knife', 2, { x: 0, z: -.9, team: 0 }));
  if (cover) state.map = { ...arena, colliders: [{ id: 'cover', x: -3, y: 0, z: -.9, w: 6, h: 3, d: .02 }] };
  const profile = meleeProfile(attacker);
  for (let tick = 0; tick <= profile.startupTicks + profile.activeTicks; tick++) {
    state.tick++;
    combatStep(state, state.players.map(player => ({ ...emptyInput(player), fire: player.id === 0 && tick === 0 })), state.map);
  }
  return { state, hit: state.events.find(event => event.type === 'meleeHit') };
}

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

test('bright curved blade bands remain tapered, finite and fixed to actual damage samples', () => {
  for (const weapon of ['sword', 'katana', 'axe', 'tonfas']) {
    const player = active(weapon), before = structuredClone(player), path = meleeTrailPath(player), shared = meleeSlashGeometry(player, { from: path.from, to: path.to });
    const mesh = meleeTrailMeshes(player), reduced = meleeTrailMeshes(player, [], [0, 1.62, 0], { reducedMotion: true });
    assert.equal(mesh.length, reduced.length); assert.ok(mesh.length / 10 <= 48 * 18); assert.ok(mesh.every(Number.isFinite));
    const groups = Array.from({ length: mesh.length / 180 }, (_, index) => [...mesh.slice(index * 180, index * 180 + 180)]);
    assert.ok(groups.length > 2);
    assert.ok(groups.at(-1)[19] > groups[0][19] * 3, `${weapon}: translucent cut brightens toward the current tip`);
    const radialWidth = group => Math.hypot(...[0, 1, 2].map(axis => group[60 + axis] - group[70 + axis]));
    assert.ok(radialWidth(groups.at(-1)) > radialWidth(groups[0]) * 2, `${weapon}: tip ribbon tapers to the oldest sample`);
    assert.ok(Math.max(...Array.from({ length: mesh.length / 10 }, (_, index) => mesh[index * 10 + 9])) > .70, `${weapon}: bright visible leading edge`);
    assert.ok(reduced[79] < mesh[79], 'reduced-motion mode keeps the real path but softens the extra glow');
    path.samples.forEach((sample, index) => [shared.samples[index].outer.x, shared.samples[index].outer.y, shared.samples[index].outer.z].forEach((value, axis) => assert.ok(Math.abs(value - sample.outer[axis]) < 1e-9)));
    const origin = path.origin, reach = MELEE_WEAPONS[weapon].reach;
    assert.ok(points(mesh).every(point => Math.hypot(...point.map((value, axis) => value - origin[axis])) <= reach + .04), 'no false projectile-length flourish');
    assert.deepEqual(player, before);
  }
});

test('a real accepted sword contact emits one small burst, with semantic life/swing/target dedup', () => {
  const { state, hit } = actualContact(); assert.ok(hit); const before = structuredClone(state), present = createSlashImpactPresenter();
  const particles = present(hit, state, 1000);
  assert.equal(particles.length, 6); assert.ok(particles.every(particle => particle.cover && particle.radius <= .34 && particle.life < 200 && particle.size <= .014));
  assert.equal(present({ ...hit, id: hit.id + 100 }, state, 1000).length, 0, 'a different envelope ID cannot replay the same flesh contact');
  const wall = { x: -2, y: 0, z: hit.z - .05, w: 4, h: 3, d: .02 };
  for (const particle of particles) for (const time of [1010, 1050, 1100]) assert.ok(particlePosition(particle, time, [wall]).point[2] > wall.z + wall.d, 'impact motes do not escape behind nearby cover');
  assert.deepEqual(state, before);
});

test('walls and allied bodies prevent real damage and therefore never manufacture blade contact sparks', () => {
  for (const config of [{ cover: true }, { ally: true }]) {
    const { state, hit } = actualContact(config); assert.equal(hit, undefined); assert.equal(state.players[1].hp, 200);
    const { renderer } = harness(); renderer.render(state, { localId: 0, time: 1000 });
    assert.equal(renderer.particles.filter(particle => particle.material === 'blade').length, 0); renderer.destroy();
  }
});

test('untrusted, stale, future, reused-life and allied contact metadata cannot create a burst', () => {
  const { state, hit } = actualContact();
  for (const patch of [{ type: 'meleeStart' }, { damage: 0 }, { weapon: 'unknown' }, { x: NaN }, { meleeIndex: 0 }, { meleeStartTick: undefined }, { tick: state.tick - 19 }, { tick: state.tick + 2 }, { attackerLifeId: 0 }, { targetLifeId: 0 }, { targetId: 0 }]) {
    assert.equal(createSlashImpactPresenter()({ ...hit, ...patch }, state, 1000).length, 0);
  }
  const allies = structuredClone(state); allies.players[1].team = allies.players[0].team;
  assert.equal(createSlashImpactPresenter()(hit, allies, 1000).length, 0);
  const present = createSlashImpactPresenter({ capacity: 8 });
  for (let index = 1; index <= 24; index++) present({ ...hit, meleeIndex: index }, state, 1000, { reducedMotion: true });
  assert.equal(present.getStats().seenContacts, 8); assert.equal(present.getStats().confirmedContacts, 24);
  assert.equal(present({ ...hit, meleeIndex: 24 }, state, 1000).length, 0, 'muted contacts stay consumed after changing preference');
  present.reset(); assert.equal(present.getStats().confirmedContacts, 0);
});

test('actual render consumes confirmed impact once, honors reduced motion and reuses seven-pass bounded storage', () => {
  const { state, hit } = actualContact(), { renderer, calls } = harness();
  state.players[0] = active('sword'); state.players[0].lifeId = hit.attackerLifeId;
  state.events = [hit]; renderer.render(state, { localId: 0, time: 1000 });
  assert.equal(renderer.particles.length, 6); assert.equal(renderer.stats.slashImpacts.confirmedContacts, 1);
  const creates = calls.creates, allocations = calls.allocations, storage = renderer.frameMeshes.tracer.storage.buffer;
  for (let frame = 0; frame < 60; frame++) {
    renderer.render(state, { localId: 0, time: 1000 + frame * 1000 / 240 });
    assert.equal(renderer.frameMeshes.tracer.storage.buffer, storage); assert.ok(renderer.stats.drawCalls <= 7); assert.ok(renderer.stats.dynamicVertices < 72000); assert.ok(renderer.particles.length <= 84);
  }
  assert.equal(calls.creates, creates); assert.equal(calls.allocations, allocations);
  renderer.resetEffects(); renderer.render(state, { localId: 0, time: 2000, reducedMotion: true });
  assert.equal(renderer.stats.reducedMotion, true); assert.equal(renderer.particles.length, 0); assert.ok(renderer.stats.meleeTrailVertices > 0);
  renderer.render(state, { localId: 0, time: 2000 }); assert.equal(renderer.particles.length, 0);
  renderer.destroy();
});
