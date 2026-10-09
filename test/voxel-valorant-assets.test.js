import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { ADS, createCombatPlayer } from '../public/voxel-engine.js';
import { WEAPONS, VALORANT_WEAPON_IDS } from '../public/voxel-weapons.js';
import { VALORANT_MODELS, VALORANT_MODEL_IDS, valorantModel } from '../public/voxel-valorant-models.js';
import { weaponReloadPose } from '../public/voxel-player-animation.js';
import { weaponReloadDuration } from '../public/voxel-fire-modes.js';
import { createCloseCombatMap } from '../public/voxel-close-combat-maps.js';
import { createLootPresenter, lootMeshes, mapMeshes, weaponMeshes, VoxelRenderer } from '../public/voxel-renderer.js';

const points = mesh => Array.from({ length: mesh.length / 10 }, (_, i) => [...mesh.slice(i * 10, i * 10 + 3)]);
const digest = mesh => createHash('sha256').update(Buffer.from(mesh.buffer, mesh.byteOffset, mesh.byteLength)).digest('hex');
const actor = (weapon, patch = {}) => ({ ...createCombatPlayer(0), weapon, ammo: WEAPONS[weapon].magazine, ...patch });
const view = (weapon, patch = {}, map = null, context = {}) => VoxelRenderer.prototype._viewModel.call({ swayX: 0, swayY: 0, lastAim: null, ...context }, actor(weapon, patch), 0, 0, 1000, false, map);

function sightBlocked(mesh) {
  const vertices = points(mesh);
  for (let at = 0; at < vertices.length; at += 3) {
    const [a, b, c] = vertices.slice(at, at + 3);
    if (Math.max(a[1], b[1], c[1]) <= .000001) continue;
    const bx = b[0] - a[0], by = b[1] - a[1], cx = c[0] - a[0], cy = c[1] - a[1], det = bx * cy - cx * by;
    if (Math.abs(det) < 1e-9) continue;
    const u = (-a[0] * cy + a[1] * cx) / det, v = (-bx * a[1] + by * a[0]) / det;
    if (u >= -.000001 && v >= -.000001 && u + v <= 1.000001 && a[2] + u * (b[2] - a[2]) + v * (c[2] - a[2]) < -.03) return true;
  }
  return false;
}

test('all twenty researched weapons have independent frozen original silhouettes, not recoloured legacy models', () => {
  assert.deepEqual([...VALORANT_MODEL_IDS].sort(), [...VALORANT_WEAPON_IDS].sort());
  assert.equal(VALORANT_MODEL_IDS.length, 20);
  const signatures = new Set();
  for (const id of VALORANT_MODEL_IDS) {
    const model = valorantModel(id), mesh = weaponMeshes(id), geometry = new Float32Array(points(mesh).flat());
    assert.ok(Object.isFrozen(model) && Object.isFrozen(model.parts) && model.parts.every(Object.isFrozen));
    assert.equal(WEAPONS[id].adsSightHeight, model.sightHeight, `${id}: actual sight and catalog eye anchor agree`);
    assert.ok(mesh.every(Number.isFinite));
    assert.equal(mesh.length % 30, 0);
    assert.ok(mesh.length / 10 <= 1100, `${id}: preserves existing 1698-vertex worst held model`);
    const front = Math.min(...points(mesh).map(([, , z]) => z));
    assert.ok(Math.abs(front + model.length) < .004, `${id}: painted muzzle belongs to actual barrel`);
    signatures.add(digest(geometry));
  }
  assert.equal(signatures.size, 20, 'every model differs in physical shape even after removing all colours and normals');
  for (const id of [null, '__proto__', 'constructor', 'toString', 'missing']) assert.equal(valorantModel(id), null);
});

test('functional landmarks distinguish suppressed barrels, twin bores, bullpup, curved magazine, cylinder, scopes and heavy feed boxes', () => {
  for (const id of ['ghost', 'spectre', 'phantom']) {
    const model = valorantModel(id);
    assert.ok(model.parts.some(part => part.z === -model.length && part.w > .075 && part.d > .3), `${id}: actual long suppressor`);
  }
  for (const id of ['shorty', 'outlaw']) {
    assert.equal(valorantModel(id).muzzlePorts.length, 2);
    assert.ok(Math.abs(valorantModel(id).muzzlePorts[0].y - valorantModel(id).muzzlePorts[1].y) > .06, 'two stacked barrels have separate physical mouths');
  }
  assert.ok(valorantModel('bulldog').parts.filter(part => part.motion === 'magazine').every(part => part.z > 0), 'bullpup magazine behind the trigger');
  assert.ok(new Set(valorantModel('vandal').parts.filter(part => part.motion === 'magazine').map(part => part.z)).size >= 3, 'three stepped segments curve the magazine');
  assert.ok(valorantModel('sheriff').parts.filter(part => part.motion === 'cylinder').length >= 2, 'separate exposed cylinder pieces');
  assert.ok(valorantModel('warden').scoped && valorantModel('warden').parts.filter(part => part.motion === 'magazine').every(part => part.z < -.2), 'new scoped Warden uses its actual forward magazine');
  assert.ok(valorantModel('odin').parts.some(part => part.x < -.20 && part.motion === 'lid'), 'large left feed belt');
  assert.ok(valorantModel('ares').parts.some(part => part.motion === 'magazine' && part.w > .16), 'real ammunition box');
});

test('actual aimed camera rays remain clear through new iron sights and open scope tubes; unsupported ADS keeps the hip pose', () => {
  for (const id of VALORANT_MODEL_IDS) {
    const ready = view(id), aimed = view(id, { aimTicks: ADS.ticks });
    assert.equal(sightBlocked(aimed), false, `${id}: no solid optic lens, closed notch or glove covers the aim ray`);
    if (WEAPONS[id].adsSupported === false || WEAPONS[id].adsEnabled === false) assert.deepEqual(aimed, ready, `${id}: RMB cannot invent an aim-down-sights pose`);
    if (valorantModel(id).scoped) {
      const mesh = weaponMeshes(id), y = .175;
      const translated = new Float32Array(mesh);
      for (let at = 1; at < translated.length; at += 10) translated[at] -= y;
      assert.equal(sightBlocked(translated), false, `${id}: held scope is an actual open 3D aperture`);
    }
  }
});

test('every new surface and mechanical reload stays before actual positive and behind-anchor cover cut planes', () => {
  for (const id of VALORANT_MODEL_IDS) for (const reloadProgress of [0, .21, .5, .82]) for (const limit of [-.27, 0, .04, .3, .7]) {
    const mesh = weaponMeshes(id, {}, { limit, reloadProgress });
    assert.ok(mesh.every(Number.isFinite));
    assert.ok(points(mesh).every(([, , z]) => z >= -limit - .000001), `${id}/${reloadProgress}: barrel, magazine, scope and paint respect real cover`);
  }
  const wall = { colliders: [{ id: 'thin-cover', x: -6, y: 0, z: -.325, w: 12, h: 4, d: .015 }] };
  for (const id of VALORANT_MODEL_IDS) for (const patch of [{}, { aimTicks: ADS.ticks }, { reloadTicks: weaponReloadDuration(id, 0) * .5, ammo: 0 }]) {
    const mesh = view(id, patch, wall, { localShot: { born: 990, weapon: id, hand: 0, shotIndex: 1 } });
    assert.ok(points(mesh).every(([, , z]) => z > -.31001), `${id}: a hidden held anchor cannot recreate geometry through a thin wall`);
  }
});

test('reloads move real magazines, open twin barrels about their breech and preserve supported Outlaw duration', () => {
  const full = weaponMeshes('vandal'), removed = weaponMeshes('vandal', {}, { reloadProgress: .4 });
  assert.ok(removed.length < full.length, 'detached magazine disappears while the support hand fetches it');
  for (const id of ['shorty', 'outlaw']) {
    const open = weaponReloadPose(id, .5);
    assert.ok(open.breakOpen > .9 && open.shellVisible, `${id}: uses its accepted break-open reload stage`);
    const closedMesh = weaponMeshes(id), openMesh = weaponMeshes(id, {}, { reloadProgress: .5 });
    const front = mesh => points(mesh).filter(([, , z]) => z < valorantModel(id).breakHingeZ - .09).map(([, y]) => y);
    assert.ok(Math.min(...front(openMesh)) < Math.min(...front(closedMesh)) - .045, `${id}: barrel rotates downward around its real hinge`);
    assert.ok(openMesh.length / 10 < 1150, 'twin loose shells stay in the original held geometry budget');
  }
  assert.equal(weaponReloadDuration('outlaw', 0), 456);
  assert.equal(weaponReloadDuration('outlaw', 1), 276);
  const renderer = { swayX: 0, swayY: 0, lastAim: null };
  VoxelRenderer.prototype._viewModel.call(renderer, actor('outlaw', { ammo: 0, reloadTicks: 228 }), 0, 0, 1000);
  assert.equal(renderer.reloadMotion.progress, .5, 'empty reload pose measures progress against 456, not the tactical duration');
});

test('twin-barrel reports alternate one muzzle flare, while repeated snapshots never double either barrel', () => {
  for (const id of ['shorty', 'outlaw']) {
    const ready = view(id), first = view(id, {}, null, { localShot: { born: 990, weapon: id, hand: 0, shotIndex: 1 } }), second = view(id, {}, null, { localShot: { born: 990, weapon: id, hand: 0, shotIndex: 2 } });
    assert.equal(first.length - ready.length, 720);
    assert.equal(second.length - ready.length, 720);
    assert.deepEqual(first.slice(0, ready.length), second.slice(0, ready.length), 'accepted barrel choice cannot move the whole weapon twice');
    assert.notDeepEqual(first.slice(ready.length), second.slice(ready.length), 'the two barrel mouths have different actual flash positions');
  }
});

test('all new ground props stay small and use the existing bounded immutable pickup cache', () => {
  const present = createLootPresenter(), items = VALORANT_MODEL_IDS.map((weapon, id) => ({ id, kind: 'weapon', weapon, x: id % 5, y: 0, z: Math.floor(id / 5) }));
  for (const item of items) {
    const mesh = lootMeshes([item]);
    assert.equal(mesh.count, 1);
    assert.ok((mesh.opaque.length + mesh.contacts.length) / 10 <= 246, `${item.weapon}: maximum 128-supply pool cost does not increase`);
  }
  const first = present(items, 0), buffer = first.opaque.buffer;
  assert.equal(first.count, 20);
  const later = present(items.map(item => ({ ...item })), 200);
  assert.equal(later.opaque.buffer, buffer);
  assert.equal(present.getStats().builds, 20, 'fresh network objects do not rebuild unchanged models');
  present.reset(); assert.equal(present.getStats().cachedItems, 0);
});

test('new covered arenas have different palettes, affordable cached geometry and every real solid corner', () => {
  const signatures = new Set();
  for (const id of ['market', 'lockdown']) for (const mode of ['breach', 'royale']) {
    const map = createCloseCombatMap(id, mode), mesh = mapMeshes(map), verts = points(mesh.opaque);
    signatures.add(digest(mesh.opaque));
    assert.ok((mesh.opaque.length + mesh.shadows.length) / 10 < 100000, `${id}/${mode}: preserves original static budget`);
    const key = point => point.map(value => value.toFixed(3)).join(':'), drawn = new Set(verts.map(key));
    for (const box of map.colliders) for (const x of [box.x, box.x + box.w]) for (const y of [box.y, box.y + box.h]) for (const z of [box.z, box.z + box.d]) assert.ok(drawn.has(key([x, y, z])), `${box.id}: surface paint cannot hide a real physical corner`);
  }
  assert.equal(signatures.size, 4);
});
