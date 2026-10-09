import test from 'node:test';
import assert from 'node:assert/strict';
import * as Horde from '../public/voxel-horde-engine.js';
import { createCombatPlayer, applyCombatDamage } from '../public/voxel-engine.js';
import { presentWorldLabels, projectWorldLabel } from '../public/voxel-label-presentation.js';
import { mountVoxelLabelOverlay } from '../public/voxel-label-overlay.js';
import { monsterMeshes } from '../public/voxel-renderer.js';

// Independent geometry and actual public-engine actors exercise player-visible
// requirements, rather than reproducing the label helper's internal samples.
const EMPTY_MAP = Object.freeze({ id: 'labels-independent-qa', bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 }, colliders: [] });
const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} versus ${expected}`);
function projection({ aspect = 1, fov = Math.PI / 2 } = {}) {
  const out = new Float32Array(16), f = 1 / Math.tan(fov / 2), near = .025, far = 110;
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) / (near - far); out[11] = -1; out[14] = 2 * far * near / (near - far); return out;
}
function view(eye = [0, 1.62, 0], roll = 0) {
  const c = Math.cos(roll), s = Math.sin(roll);
  return new Float32Array([c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, -c * eye[0] - s * eye[1], s * eye[0] - c * eye[1], -eye[2], 1]);
}
function pose(actor, patch) { Object.assign(actor, { x: 0, y: 0, z: -8, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0, grounded: true, ...patch }); }
function fixture(type = 'stalker') {
  const state = Horde.createState({ capacity: 3, seed: 83631 });
  state.players.slice(0, 3).forEach(actor => { actor.connected = true; });
  Horde.startMatch(state, [0, 1, 2]);
  while (state.phase === 'countdown') Horde.step(state);
  state.map = EMPTY_MAP; state.horde.nextSpawnTick = 1e9; state.horde.pending = 1;
  pose(state.players[0], { z: 0 }); pose(state.players[1], { x: -2 }); pose(state.players[2], { x: 2 });
  state.spawnWarnings = [{ id: ++state.horde.spawnId, x: 0, y: 0, z: -8, ticksLeft: 1, monsterType: type }]; Horde.step(state);
  const monster = state.players.find(actor => actor.monster && actor.alive); assert.ok(monster); monster.emergenceTicks = 0; monster.monsterState = 'hunt';
  pose(monster, { z: -8 });
  const roster = [{ id: 0, name: 'Camille', connected: true }, { id: 1, name: 'Élodie', connected: true }, { id: 2, name: '李 雷', connected: true }];
  const options = { state, players: state.players, roster, localId: 0, cameraPlayer: state.players[0], eye: [0, 1.62, 0], view: view(), projection: projection(), humanPoses: new Map() };
  return { state, monster, roster, options, labels: patch => presentWorldLabels({ ...options, ...patch }) };
}
const monsters = labels => labels.filter(label => label.kind === 'monster');
const names = labels => labels.filter(label => label.kind === 'teammate');
const wall = (patch = {}) => ({ id: 'solid-qa-wall', x: -5, y: 0, z: -4, w: 10, h: 4, d: .3, ...patch });
function covered(f, boxes) { f.state.map = { ...EMPTY_MAP, colliders: boxes }; }

test('actual ready Last Stand actors receive current Unicode teammate names and current monster health', () => {
  const f = fixture(), labels = f.labels();
  assert.deepEqual(names(labels).map(label => label.name).sort(), ['Élodie', '李 雷'].sort());
  assert.equal(labels.some(label => label.id === 0), false, 'the first-person camera never labels itself');
  assert.equal(monsters(labels).length, 1); const bar = monsters(labels)[0];
  assert.equal(bar.id, f.monster.id); assert.equal(bar.hp, f.monster.hp); assert.equal(bar.maxHp, f.monster.maxHp);
  assert.ok(labels.every(label => Number.isFinite(label.x) && Number.isFinite(label.y) && label.x >= 0 && label.x <= 1 && label.y >= 0 && label.y <= 1));
  f.roster[1].name = 'Élodie — host'; assert.equal(names(f.labels()).find(label => label.id === 1).name, 'Élodie — host');
});

test('a full solid wall hides names and bars even though the upper labels project on screen', () => {
  const f = fixture(); assert.equal(f.labels().length, 3); covered(f, [wall()]); assert.deepEqual(f.labels(), []);
  const upper = projectWorldLabel({ x: 0, y: 2.1, z: -8 }, f.options.view, f.options.projection); assert.ok(upper && upper.x > 0 && upper.x < 1);
});

test('revealing a real flank by peeking around the wall restores the correct label', () => {
  const f = fixture(); covered(f, [wall({ x: -.65, w: 1.3 })]);
  assert.equal(monsters(f.labels()).length, 0); f.monster.x = 4;
  assert.equal(monsters(f.labels()).length, 1); assert.equal(monsters(f.labels())[0].id, f.monster.id);
});

test('short hounds hidden by low cover cannot leak bars through empty human-height space', () => {
  const f = fixture('hound'); f.options.eye = [0, .66, 0]; f.options.view = view(f.options.eye);
  covered(f, [wall({ h: .9 })]); assert.deepEqual(monsters(f.labels()), []);
  covered(f, []); const bar = monsters(f.labels())[0]; assert.ok(bar);
  assert.ok(bar.y > .42, 'the low quadruped bar sits near its .8m body, not a 1.8m humanoid anchor');
});

test('a hound body must be visible as well as its label anchor', () => {
  const f = fixture('hound'); f.options.eye = [0, .5, 0]; f.options.view = view(f.options.eye);
  covered(f, [wall({ z: -7.4, h: .86 })]);
  assert.deepEqual(monsters(f.labels()), [], 'an anchor above a low wall must not reveal a fully hidden short body');
});

test('label anchor occlusion independently hides a monster behind an overhead beam', () => {
  const f = fixture(); covered(f, [wall({ y: 1.76, h: .7 })]);
  assert.deepEqual(monsters(f.labels()), [], 'a visible lower leg must not draw a bar through the real overhead solid');
});

test('labels update immediately with damage, dynamic max health, death and subsequent life reuse', () => {
  const f = fixture('brute'), before = monsters(f.labels())[0]; assert.ok(before);
  f.monster.hp = 137; f.monster.maxHp = 430; let label = monsters(f.labels())[0]; assert.equal(label.hp, 137); assert.equal(label.maxHp, 430);
  f.monster.hp = 999; label = monsters(f.labels())[0]; assert.equal(label.hp, 430, 'overheal is visually clamped');
  f.monster.alive = false; f.monster.hp = 0; assert.deepEqual(monsters(f.labels()), []);
  f.monster.alive = true; f.monster.hp = 80; f.monster.maxHp = 80; f.monster.lifeId++;
  label = monsters(f.labels())[0]; assert.equal(label.hp, 80); assert.notEqual(label.key, before.key); assert.equal(label.lifeId, f.monster.lifeId);
});

test('offscreen, behind-camera and near-plane labels are rejected instead of pinned to screen edges', () => {
  const f = fixture();
  for (const patch of [{ x: 100 }, { x: 0, z: 8 }, { x: 0, z: -.001 }]) { pose(f.monster, patch); assert.deepEqual(monsters(f.labels()), []); }
  for (const point of [{ x: 100, y: 1.62, z: -8 }, { x: 0, y: 1.62, z: 8 }, { x: 0, y: 1.62, z: -.001 }]) assert.equal(projectWorldLabel(point, f.options.view, f.options.projection), null);
});

test('final eye translation, head roll and zoom matrices are used for projection', () => {
  const p = { x: 1, y: 2, z: -8 }, eye = [0, 1.62, 0];
  const normal = projectWorldLabel(p, view(eye), projection()); near(normal.x, .5625); near(normal.y, .47625);
  const bobbed = projectWorldLabel(p, view([0, 1.72, 0]), projection()); near(bobbed.y, .4825);
  const rolled = projectWorldLabel(p, view(eye, Math.PI / 2), projection()); near(rolled.x, .52375); near(rolled.y, .5625);
  const ads = projectWorldLabel(p, view(eye), projection({ fov: Math.PI / 3 })); assert.ok(ads.x > normal.x && ads.y < normal.y);
});

test('a spectated camera survivor is excluded while other surviving allies remain eligible', () => {
  const f = fixture(); f.state.players[0].alive = false; f.state.players[0].hp = 0;
  const eye = [-2, 1.62, -8], cameraPlayer = f.state.players[1];
  pose(f.state.players[2], { x: -2, z: -16 }); pose(f.monster, { x: -2, z: -16 });
  const labels = f.labels({ cameraPlayer, eye, view: view(eye) });
  assert.equal(labels.some(label => label.id === 0 || label.id === 1), false); assert.equal(names(labels)[0].id, 2); assert.equal(monsters(labels)[0].id, f.monster.id);
});

test('disconnected, nonparticipating, dead and bot player seats cannot expose teammate names', () => {
  const f = fixture();
  for (const patch of [{ connected: false }, { participating: false }, { alive: false, hp: 0 }, { bot: true }]) {
    const actor = f.state.players[1], old = { ...actor }; Object.assign(actor, patch);
    assert.equal(names(f.labels()).some(label => label.id === 1), false, JSON.stringify(patch)); Object.assign(actor, old);
  }
  f.roster[1].connected = false; assert.equal(names(f.labels()).some(label => label.id === 1), false);
});

test('hostile humans in team FPS and battle royale never receive nameplates or health bars', () => {
  const f = fixture(); const hostile = { ...createCombatPlayer(25), lifeId: 1, connected: true, participating: true, human: true }; pose(hostile, { x: 1, z: -5 });
  f.state.players.push(hostile); f.roster.push({ id: 25, connected: true, name: 'Enemy' });
  for (const gameId of ['voxel-breach', 'voxel-royale']) {
    f.state.gameId = gameId; hostile.team = 1;
    assert.equal(f.labels().some(label => label.id === 25), false, `${gameId} hidden hostile information`);
  }
});

test('malformed snapshots cannot create finite-looking labels from invalid actor or camera coordinates', () => {
  const f = fixture();
  for (const patch of [{ x: NaN }, { y: Infinity }, { z: 'oops' }, { hp: NaN }, { maxHp: Infinity }]) {
    const original = { ...f.monster }; Object.assign(f.monster, patch); assert.deepEqual(monsters(f.labels()), []); Object.assign(f.monster, original);
  }
  assert.deepEqual(f.labels({ eye: [0, NaN, 0] }), []);
  assert.equal(projectWorldLabel({ x: NaN, y: 0, z: -8 }, view(), projection()), null);
});

test('map changes immediately replace visibility rather than retaining the previous unobstructed result', () => {
  const f = fixture(); assert.equal(monsters(f.labels()).length, 1);
  covered(f, [wall()]); assert.equal(monsters(f.labels()).length, 0);
  covered(f, []); assert.equal(monsters(f.labels()).length, 1);
});

test('all eleven genuine monster types use current health and strict real actor lifetime identities', () => {
  assert.equal(Object.keys(Horde.MONSTER_TYPES).length, 11);
  for (const type of Object.keys(Horde.MONSTER_TYPES)) {
    const f = fixture(type), label = monsters(f.labels())[0]; assert.ok(label, type);
    assert.equal(label.hp, f.monster.hp); assert.equal(label.maxHp, f.monster.maxHp); assert.equal(label.id, f.monster.id); assert.equal(label.lifeId, f.monster.lifeId);
  }
});

for (const type of ['bomber', 'spitter', 'weaver']) test(`${type} health bars follow actual damage and death, reject spoofed actors and retain real flesh occlusion during their attack`, () => {
  const f = fixture(type), before = monsters(f.labels())[0]; assert.ok(before);
  const phases = { bomber: 'bomberFuse', spitter: 'spitting', weaver: 'weaving' };
  Object.assign(f.monster, { monsterState: phases[type], attackDuration: Horde.MONSTER_TYPES[type].windup });
  for (const fraction of [0, .5, 1]) for (const yaw of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
    f.monster.attackTicks = f.monster.attackDuration * (1 - fraction); f.monster.yaw = yaw;
    covered(f, []); assert.equal(monsters(f.labels()).length, 1, 'real charged anatomy retains a live visible health bar');
    // From the actual camera the anchor ray crosses this low wall above 1.9m,
    // while every authored head/body corner remains behind its 1.82m face.
    covered(f, [wall({ z: -7.4, h: 1.82, d: .16 })]);
    const visibleBody = monsterMeshes(f.monster, 1000, { phase: Math.PI / 2, stride: 1, speed: 5 }); assert.ok(visibleBody.length > 0);
    for (let at = 0; at < visibleBody.length; at += 10) {
      const crossing = -7.24 / visibleBody[at + 2], y = 1.62 + (visibleBody[at + 1] - 1.62) * crossing;
      assert.ok(crossing > 0 && crossing < 1 && y >= 0 && y < 1.82 && Math.abs(visibleBody[at] * crossing) < 5, 'every actual authored flesh corner is behind the covering wall');
    }
    const anchor = projectWorldLabel({ x: f.monster.x, y: f.monster.y + 1.96, z: f.monster.z }, f.options.view, f.options.projection); assert.ok(anchor);
    assert.ok(1.62 + (1.96 - 1.62) * 7.4 / 8 > 1.82, 'the floating anchor itself is uncovered');
    assert.deepEqual(monsters(f.labels()), [], 'the bar cannot reveal fully covered real flesh through empty space');
    covered(f, [wall({ z: -7.4, h: 1.68, d: .16 })]); assert.equal(monsters(f.labels()).length, 1, 'revealing the actual crown restores the bar');
    covered(f, [wall({ z: -7.4, y: 1.85, h: .25, d: .16 })]); assert.deepEqual(monsters(f.labels()), [], 'an overhead solid hides the anchor even with uncovered flesh below');
  }
  covered(f, []);
  applyCombatDamage(f.state, [{ playerId: 0, targetId: f.monster.id, targetLifeId: f.monster.lifeId, damage: 15, attack: 'gun', weapon: 'carbine' }]);
  assert.equal(monsters(f.labels())[0].hp, before.hp - 15); assert.equal(monsters(f.labels())[0].maxHp, before.maxHp);
  for (const patch of [{ monster: false }, { human: true }, { monsterType: 'sentinel' }, { monsterType: '__proto__' }]) {
    const original = { ...f.monster }; Object.assign(f.monster, patch); assert.deepEqual(monsters(f.labels()), []); Object.assign(f.monster, original);
  }
  applyCombatDamage(f.state, [{ playerId: 0, targetId: f.monster.id, targetLifeId: f.monster.lifeId, damage: f.monster.hp, attack: 'gun', weapon: 'carbine' }]);
  assert.equal(f.monster.alive, false); assert.deepEqual(monsters(f.labels()), []);
  Object.assign(f.monster, { alive: true, hp: before.maxHp, maxHp: before.maxHp, lifeId: f.monster.lifeId + 1 });
  const revived = monsters(f.labels())[0]; assert.ok(revived); assert.notEqual(revived.key, before.key); assert.equal(revived.lifeId, f.monster.lifeId);
});

test('large input rosters remain bounded and presentation never mutates shared simulation or roster data', () => {
  const f = fixture();
  for (let index = 0; index < 80; index++) {
    const actor = { ...f.monster, id: 20 + index, x: (index % 5 - 2) * .5, z: -8 - Math.floor(index / 5) * .1, lifeId: index + 10 }; f.state.players.push(actor);
  }
  const before = JSON.stringify({ state: f.state, roster: f.roster });
  const labels = f.labels(); assert.ok(labels.length <= 23); assert.equal(new Set(labels.map(label => label.key)).size, labels.length);
  assert.equal(JSON.stringify({ state: f.state, roster: f.roster }), before);
  assert.ok(Object.isFrozen(labels) && labels.every(Object.isFrozen));
});

function mountedCanvas() {
  class Node {
    constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.style = {}; this.events = new Map(); this.hidden = false; this.textContent = ''; }
    append(...nodes) { nodes.forEach(node => { node.parentElement = this; this.children.push(node); }); }
    insertBefore(node, next) { node.parentElement = this; const index = this.children.indexOf(next); this.children.splice(index < 0 ? this.children.length : index, 0, node); }
    remove() { if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = null; }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, callback) { this.events.set(name, callback); }
    removeEventListener(name, callback) { if (this.events.get(name) === callback) this.events.delete(name); }
    getBoundingClientRect() { throw new Error('World label painting cannot read layout at display refresh rate'); }
    get clientWidth() { throw new Error('World label painting cannot read layout at display refresh rate'); }
    get innerHTML() { throw new Error('Names must stay text'); }
    set innerHTML(value) { throw new Error('Names must stay text'); }
  }
  const doc = new Node('document'); doc.createElement = tag => new Node(tag);
  const parent = new Node('div'), canvas = new Node('canvas'); canvas.ownerDocument = doc; parent.append(canvas);
  return { canvas, parent, doc };
}

test('overlay lifetime churn and repeated display frames retain at most 23 reusable nodes without layout reads', () => {
  const fake = mountedCanvas(), overlay = mountVoxelLabelOverlay(fake.canvas);
  for (let frame = 0; frame < 2000; frame++) {
    const labels = Array.from({ length: 50 }, (_, id) => ({ key: `monster:${id}:${Math.floor(frame / 7)}`, kind: 'monster', id, lifeId: Math.floor(frame / 7), hp: 200 - frame % 150, maxHp: 200, x: .2 + id / 100, y: .4 }));
    overlay.paint(labels); assert.ok(overlay.inspect().poolSize <= 23); assert.equal(overlay.inspect().visible.length, 23);
  }
  const layer = fake.parent.children.find(node => node.dataset.voxelLabelOverlay !== undefined); assert.equal(layer.children.length, 23);
  overlay.clear(); assert.equal(overlay.inspect().visible.length, 0); assert.ok(layer.hidden);
  overlay.paint([{ key: 'teammate:1:99', kind: 'teammate', id: 1, lifeId: 99, name: 'Élodie', x: .5, y: .2 }]);
  assert.equal(layer.children.length, 23, 'a new human label reuses a released monster slot');
});

test('overlay safely shows literal Unicode names and updates current health fill without stale monster metadata', () => {
  const fake = mountedCanvas(), overlay = mountVoxelLabelOverlay(fake.canvas);
  const base = { key: 'actor:1', id: 1, lifeId: 1, x: .5, y: .2 };
  overlay.paint([{ ...base, kind: 'monster', hp: 180, maxHp: 200 }]);
  const layer = fake.parent.children[1], node = layer.children[0]; assert.equal(node.dataset.hp, '180'); assert.equal(node.children[1].children[0].style.transform, 'scaleX(0.9)');
  overlay.paint([{ ...base, kind: 'monster', hp: 18, maxHp: 300 }]); assert.equal(node.children[1].children[0].style.transform, 'scaleX(0.06)');
  overlay.paint([{ ...base, kind: 'teammate', name: 'Élodie <img src=x onerror=alert(1)>' }]);
  assert.equal(node.children[0].textContent, 'Élodie <img src=x onerror=alert(1)>'); assert.equal(node.dataset.hp, undefined); assert.equal(node.dataset.maxHp, undefined);
  assert.ok(node.children[1].hidden && !node.children[0].hidden);
});

test('overlay clears on hidden gameplay and context loss and destroy releases nodes and listeners permanently', () => {
  const fake = mountedCanvas(), overlay = mountVoxelLabelOverlay(fake.canvas);
  const labels = [{ key: 'monster:4:1', id: 4, lifeId: 1, kind: 'monster', hp: 20, maxHp: 45, x: .5, y: .4 }];
  overlay.paint(labels); overlay.paint(labels, { active: false }); assert.equal(overlay.inspect().visible.length, 0);
  overlay.paint(labels); fake.canvas.events.get('webglcontextlost')(); assert.equal(overlay.inspect().visible.length, 0);
  overlay.paint(labels); fake.doc.hidden = true; fake.doc.events.get('visibilitychange')(); assert.equal(overlay.inspect().visible.length, 0);
  overlay.destroy(); overlay.destroy(); overlay.paint(labels);
  assert.deepEqual(overlay.inspect(), { visible: [], poolSize: 0, destroyed: true }); assert.equal(fake.parent.children.length, 1);
  assert.equal(fake.canvas.events.size, 0); assert.equal(fake.doc.events.size, 0);
});
