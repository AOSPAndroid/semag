import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, ADS } from '../public/voxel-engine.js';
import { weaponAimFovRatio } from '../public/voxel-weapons.js';
import { EMPTY_WORLD_LABELS, MAX_WORLD_LABELS, presentWorldLabels, projectWorldLabel } from '../public/voxel-label-presentation.js';
import { VoxelRenderer } from '../public/voxel-renderer.js';

const map = colliders => ({ id: 'labels-fixture', theme: 'custom', colliders, sites: [], bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 } });
const human = (id, fields = {}) => ({ ...createCombatPlayer(id), x: 0, y: 0, z: -6, team: 0, human: true, monster: false, connected: true, participating: true, lifeId: 1, ...fields });
const monster = (id = 3, type = 'stalker', fields = {}) => ({ ...human(id), team: 1, human: false, monster: true, monsterType: type, hp: 80, maxHp: 100, emergenceTicks: 0, monsterState: 'chasing', lifeId: 12, ...fields });
const camera = () => human(0, { z: 0 });
const roster = [{ id: 0, name: 'Observer', connected: true }, { id: 1, name: 'Alice', connected: true }, { id: 2, name: 'Benoît', connected: true }];

function matrices(eye = [0, 1.62, 0], { fov = 70, aspect = 16 / 9, roll = 0 } = {}) {
  const c = Math.cos(roll), s = Math.sin(roll), f = 1 / Math.tan(fov * Math.PI / 360), near = .025, far = 110;
  const view = new Float32Array([c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, -c * eye[0] - s * eye[1], s * eye[0] - c * eye[1], -eye[2], 1]);
  const projection = new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
  return { view, projection };
}
function present(actors = [monster()], fields = {}) {
  const players = [camera(), ...actors], eye = fields.eye || [0, 1.62, 0];
  const state = { gameId: 'voxel-horde', phase: 'fight', map: map([]), players, ...fields.state };
  const { state: _overrides, ...options } = fields;
  return presentWorldLabels({ state, players, roster, localId: 0, cameraPlayer: players[0], eye, ...matrices(eye, fields), ...options });
}
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);
const wall = (height = 3, fields = {}) => ({ id: 'cover', x: -3, y: 0, z: -5.7, w: 6, h: height, d: .20, ...fields });

test('normalized projection follows camera translation, roll, CSS aspect and ADS matrices without drawing or layout', () => {
  const eye = [2, 1.71, 3], point = { x: 3, y: 2.0, z: -7 }, m = matrices(eye, { fov: 44, aspect: 2, roll: .12 });
  const projected = projectWorldLabel(point, m.view, m.projection), f = 1 / Math.tan(44 * Math.PI / 360), dx = point.x - eye[0], dy = point.y - eye[1], depth = eye[2] - point.z;
  near(projected.x, .5 + (Math.cos(.12) * dx + Math.sin(.12) * dy) * f / (2 * 2 * depth));
  near(projected.y, .5 - (-Math.sin(.12) * dx + Math.cos(.12) * dy) * f / (2 * depth));
  assert.ok(projected.depth >= -1 && projected.depth <= 1);
});

test('projection rejects behind-eye, near-plane, far-plane, offscreen and malformed points', () => {
  const { view, projection } = matrices();
  for (const point of [{ x: 0, y: 1.62, z: 2 }, { x: 0, y: 1.62, z: -.01 }, { x: 0, y: 1.62, z: -120 }, { x: 100, y: 1.62, z: -2 }, { x: 0, y: Infinity, z: -2 }]) assert.equal(projectWorldLabel(point, view, projection), null);
  assert.equal(projectWorldLabel({ x: 0, y: 1.62, z: -2 }, [], projection), null);
});

test('all eight real monster species expose bounded live health, with the dog label above its low head', () => {
  const types = ['stalker', 'runner', 'brute', 'gunner', 'sniper', 'hound', 'leaper', 'screecher'];
  const labels = present(types.map((type, index) => monster(index + 3, type, { x: (index - 3.5) * .6 })));
  assert.equal(labels.length, 8);
  assert.ok(labels.every(label => label.kind === 'monster' && label.hp === 80 && label.maxHp === 100 && label.lifeId === 12 && !('name' in label)));
  const dog = labels.find(label => label.id === 8), humanSize = labels.find(label => label.id === 3);
  assert.ok(dog.y > .5 && dog.y > humanSize.y, 'low canine anchor follows .80 m anatomy');
});

test('a short dog fully concealed by low cover has no bar even when the above-head anchor is uncovered', () => {
  const clear = present([monster(3, 'hound')]); assert.equal(clear.length, 1);
  const { view, projection } = matrices(); assert.ok(projectWorldLabel({ x: 0, y: .96, z: -6.26 }, view, projection));
  assert.equal(present([monster(3, 'hound'), monster(4)], { state: { map: map([wall(.9)]) } }).length, 1, 'only the tall ghoul has visible flesh over the wall');
});

test('a tall monster fully concealed by a near wall does not leak a floating anchor over its top', () => {
  assert.equal(present([monster()], { state: { map: map([wall(1.88, { z: -5.7, d: .02 })]) } }).length, 0);
});

test('a beam or ceiling covering only the label anchor hides the label while flesh remains visible', () => {
  assert.equal(present([monster()], { state: { map: map([wall(.4, { y: 1.86, z: -5.8, d: .1 })]) } }).length, 0);
  assert.equal(present([monster()], { state: { map: map([wall(.2, { y: 2.1, z: -5.8, d: .1 })]) } }).length, 1, 'a beam above the anchor has no effect');
});

test('names follow real standing and crouching human heights and conceal the crouched body behind cover', () => {
  const standing = present([human(1)]), crouching = present([human(1, { crouching: true })]);
  assert.equal(standing[0].name, 'Alice'); assert.ok(crouching[0].y > standing[0].y);
  assert.equal(present([human(1, { crouching: true })], { state: { map: map([wall(1.35, { z: -5.95, d: .02 })]) } }).length, 0);
  assert.equal(present([human(1)], { state: { map: map([wall(1.35, { z: -5.95, d: .02 })]) } }).length, 1);
});

test('very thin physical cover blocks labels and an actual doorway restores visibility', () => {
  const thin = wall(3, { z: -3, d: .001 });
  assert.equal(present([monster()], { state: { map: map([thin]) } }).length, 0);
  assert.equal(present([monster()], { state: { map: map([{ ...thin, x: -3, w: 2.7 }, { ...thin, x: .3, w: 2.7 }]) } }).length, 1);
});

test('above-floor actors and independently positioned cover use full 3D height', () => {
  const actor = monster(3, 'hound', { y: 2 });
  assert.equal(present([actor], { state: { map: map([wall(.9)]) } }).length, 1);
  assert.equal(present([actor], { state: { map: map([wall(.9, { y: 2, z: -5.98, d: .01 })]) } }).length, 0);
});

test('dead, emerging, pending, unknown and spoofed monster records cannot produce bars', () => {
  for (const fields of [{ alive: false }, { hp: 0 }, { hp: NaN }, { maxHp: 0 }, { maxHp: Infinity }, { emergenceTicks: 1 }, { monsterState: 'emerging' }, { monsterType: 'unknown' }, { monster: false }, { human: true }, { x: Infinity }]) assert.equal(present([monster(3, 'hound', fields)]).length, 0, JSON.stringify(fields));
  assert.equal(present([monster(3, 'hound', { hp: 140 })])[0].hp, 100, 'a stale over-heal cannot overflow its bounded rail');
});

test('co-op names require a live connected roster member and participating same-team human', () => {
  assert.equal(present([human(1), human(2, { team: 1 })]).length, 1);
  for (const fields of [{ connected: false }, { participating: false }, { human: false }, { alive: false }]) assert.equal(present([human(1, fields)]).length, 0);
  assert.equal(present([human(1)], { roster: [{ id: 1, name: 'Alice', connected: false }] }).length, 0);
  assert.equal(present([human(1)], { roster: [] }).length, 0);
  const name = present([human(1)], { roster: [{ id: 1, connected: true, name: '\u0000 <b>Alice</b> ' + 'x'.repeat(50) }] })[0].name;
  assert.equal(name.length, 24); assert.ok(!name.includes('\u0000')); assert.ok(name.startsWith('<b>Alice</b>'), 'presentation returns literal text for textContent');
});

test('Breach labels only connected teammates and never opponents or practice bots', () => {
  const team = { ...createCombatPlayer(1), x: 1, z: -6, team: 0 }, hostile = { ...createCombatPlayer(2), x: -1, z: -6, team: 1 };
  const labels = present([team, hostile], { state: { gameId: 'voxel-breach' } });
  assert.equal(labels.length, 1); assert.equal(labels[0].name, 'Alice'); assert.equal(labels[0].kind, 'teammate');
  assert.equal(present([team], { state: { gameId: 'voxel-breach' }, roster: [] }).length, 0);
  assert.ok(!('hp' in labels[0]), 'no competitive health information is attached to names');
});

test('Royale never provides enemy human labels, health bars or spectator information', () => {
  assert.equal(present([human(1), monster()], { state: { gameId: 'voxel-royale' } }).length, 0);
});

test('spectators skip the watched actor and preserve the original player team filter', () => {
  const watched = human(1), ally = human(2), enemy = human(4, { team: 1 }), players = [camera(), watched, ally, enemy, monster()];
  players[0].alive = false;
  const labels = presentWorldLabels({ state: { gameId: 'voxel-horde', phase: 'fight', map: map([]), players }, players, roster: [...roster, { id: 4, name: 'Opponent', connected: true }], localId: 0, cameraPlayer: watched, eye: [0, 1.62, 0], ...matrices() });
  assert.deepEqual(labels.map(label => label.id), [2, 3]);
});

test('offscreen and behind-camera actors are hidden rather than clamped to screen edges', () => {
  assert.equal(present([monster(3, 'hound', { z: 6 }), human(1, { x: 20, z: -2 })]).length, 0);
  assert.equal(present([monster()], { state: { phase: 'lobby' } }), EMPTY_WORLD_LABELS);
});

test('snapshots are copied/frozen, recycled lifetimes get a new key, and source actors are not changed', () => {
  const actor = Object.freeze(monster()), before = JSON.stringify(actor), first = present([actor]);
  assert.ok(Object.isFrozen(first)); assert.ok(Object.isFrozen(first[0])); assert.throws(() => { first[0].hp = 1; }, TypeError);
  const next = present([monster(3, 'hound', { hp: 21, maxHp: 45, lifeId: 13 })]);
  assert.notEqual(first[0].key, next[0].key); assert.equal(first[0].hp, 80); assert.equal(next[0].hp, 21); assert.equal(JSON.stringify(actor), before);
});

test('actor, roster and duplicate bounds prevent unbounded labels or retained stale records', () => {
  const actors = Array.from({ length: 500 }, (_, index) => monster(index + 1, 'hound', { x: (index % 5 - 2) * .3 }));
  const labels = present(actors); assert.ok(labels.length <= MAX_WORLD_LABELS); assert.equal(labels.length, 22);
  assert.equal(present([monster(), monster()]).length, 1);
  assert.equal(present([], { roster: Array.from({ length: 500 }, (_, id) => ({ id, connected: true, name: 'Name' })) }), EMPTY_WORLD_LABELS);
});

function harness() {
  const matrices = [], uploads = [], gl = new Proxy({}, { get(_, key) {
    if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
    if (key === 'getAttribLocation') return () => 0;
    if (key === 'getUniformLocation') return (_program, uniform) => uniform;
    if (key === 'uniformMatrix4fv') return (name, _transpose, value) => matrices.push({ name, value: [...value] });
    if (typeof key === 'string' && key.startsWith('create')) return () => ({});
    if (key === 'readPixels') return () => { throw new Error('World labels must not read the GPU.'); };
    return () => {};
  } });
  let layoutReads = 0;
  const renderer = new VoxelRenderer({ getContext: () => gl, addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, getBoundingClientRect: () => { layoutReads++; return { width: 1000, height: 600 }; } });
  const original = renderer._dynamic;
  renderer._dynamic = function(array, kind = 'world') { uploads.push({ kind, vertices: array.length / 10, storage: array.buffer }); return original.call(this, array, kind); };
  return { renderer, matrices, uploads, reads: () => layoutReads };
}

test('real renderer projects names with the exact uploaded final camera matrices and stable viewport', () => {
  const { renderer, matrices, reads } = harness(), players = [camera(), human(1, { x: 1.2 })];
  const state = { gameId: 'voxel-horde', phase: 'fight', map: map([]), players, loot: [], events: [] }, before = reads();
  for (let frame = 0; frame < 12; frame++) {
    matrices.length = 0;
    const cam = { ...players[0], x: frame * .04, vx: 4, aiming: true, aimTicks: ADS.ticks, weapon: 'marksman' };
    renderer.render({ ...state, players: [cam, players[1]] }, { localId: 0, time: 1000 + frame * 1000 / 120, aimYaw: -.03, aimPitch: .02, roster });
    const worldView = matrices.find(item => item.name === 'uView').value, projection = matrices.find(item => item.name === 'uProjection').value;
    const expected = projectWorldLabel({ x: 1.2, y: 1.96, z: -6 }, worldView, projection);
    near(renderer.worldLabels[0].x, expected.x); near(renderer.worldLabels[0].y, expected.y);
    assert.equal(renderer.worldLabels[0].name, 'Alice'); assert.ok(Object.isFrozen(renderer.worldLabels));
    const f = 1 / Math.tan(70 * weaponAimFovRatio('marksman', ADS) * Math.PI / 360); near(projection[5], f);
  }
  assert.equal(reads(), before, 'no frame reads layout');
  renderer.destroy();
});

test('labels add no GPU draw or geometry uploads and reset on context loss, failure, reset and destroy', () => {
  const { renderer, uploads } = harness(), players = [camera(), human(1), monster(3, 'hound')], state = { gameId: 'voxel-horde', phase: 'fight', map: map([]), players, loot: [], events: [] };
  renderer.render(state, { localId: 0, time: 1000, hideWeapon: true }); const vertices = renderer.stats.dynamicVertices, calls = renderer.stats.drawCalls, buffers = uploads.map(upload => upload.storage);
  uploads.length = 0;
  renderer.render(state, { localId: 0, time: 1000, roster, hideWeapon: true });
  assert.equal(renderer.worldLabels.length, 2); assert.equal(renderer.stats.dynamicVertices, vertices); assert.equal(renderer.stats.drawCalls, calls);
  assert.deepEqual(uploads.map(upload => upload.storage), buffers);
  assert.throws(() => { renderer.worldLabels = []; }, TypeError);
  renderer._onLost({ preventDefault() {} }); assert.equal(renderer.worldLabels, EMPTY_WORLD_LABELS);
  assert.equal(renderer.render(state, { localId: 0, roster }), false); assert.equal(renderer.worldLabels, EMPTY_WORLD_LABELS);
  renderer.contextLost = false; renderer.available = true; renderer.render(state, { localId: 0, roster }); assert.equal(renderer.worldLabels.length, 2);
  renderer.resetEffects(); assert.equal(renderer.worldLabels, EMPTY_WORLD_LABELS);
  renderer.render(state, { localId: 0, roster }); renderer.render(null); assert.equal(renderer.worldLabels, EMPTY_WORLD_LABELS);
  renderer.render(state, { localId: 0, roster }); renderer.destroy(); assert.equal(renderer.worldLabels, EMPTY_WORLD_LABELS);
});
