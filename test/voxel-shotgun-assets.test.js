import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { ADS, createCombatPlayer } from '../public/voxel-engine.js';
import { WEAPONS } from '../public/voxel-weapons.js';
import { LEGACY_SHOTGUN_MODELS, legacyShotgunModel, valorantModel } from '../public/voxel-valorant-models.js';
import { createLootPresenter, lootMeshes, weaponMeshes, VoxelRenderer } from '../public/voxel-renderer.js';

const SHOTGUNS = ['shotgun', 'autoshotgun', 'slugshotgun', 'shorty', 'bucky', 'judge'];
const points = mesh => Array.from({ length: mesh.length / 10 }, (_, i) => [...mesh.slice(i * 10, i * 10 + 3)]);
const shape = mesh => createHash('sha256').update(Buffer.from(new Float32Array(points(mesh).flat()).buffer)).digest('hex');
const view = (weapon, patch = {}, map = null) => VoxelRenderer.prototype._viewModel.call(
  { swayX: 0, swayY: 0, lastAim: null },
  { ...createCombatPlayer(0), weapon, ammo: WEAPONS[weapon].magazine, ...patch }, 0, 0, 1000, false, map,
);

// A vertical ray through the actual triangles distinguishes attached metal
// from a luminous post with an empty gap below it, regardless of its colour.
function solidAtHeight(mesh, x, y, z) {
  const hits = [];
  for (let at = 0; at < mesh.length; at += 30) {
    const a = [...mesh.slice(at, at + 3)], b = [...mesh.slice(at + 10, at + 13)], c = [...mesh.slice(at + 20, at + 23)];
    const normalY = mesh[at + 4];
    if (Math.abs(normalY) < .99 || a[1] <= y + .000001) continue;
    const bx = b[0] - a[0], bz = b[2] - a[2], cx = c[0] - a[0], cz = c[2] - a[2], determinant = bx * cz - cx * bz;
    if (Math.abs(determinant) < 1e-12) continue;
    const u = ((x - a[0]) * cz - (z - a[2]) * cx) / determinant, v = (bx * (z - a[2]) - bz * (x - a[0])) / determinant;
    if (u >= -.000001 && v >= -.000001 && u + v <= 1.000001) hits.push({ y: a[1], normalY });
  }
  hits.sort((a, b) => a.y - b.y);
  return hits.length > 0 && hits[0].normalY > 0;
}

test('six shotgun silhouettes retain their real lengths and remain distinct without relying on colour', () => {
  const expectedFronts = { shotgun: -1.056, autoshotgun: -.966, slugshotgun: -1.147, shorty: -.461, bucky: -1.011, judge: -.931 };
  const signatures = new Set();
  for (const id of SHOTGUNS) {
    const mesh = weaponMeshes(id), vertices = points(mesh);
    assert.ok(mesh.every(Number.isFinite));
    assert.ok(mesh.length / 10 < 1000, `${id}: detailed gun is cheaper than the original 1698-vertex held maximum`);
    assert.ok(Math.abs(Math.min(...vertices.map(([, , z]) => z)) - expectedFronts[id]) < .00001, `${id}: receiver polish cannot extend its barrel or move the shot origin`);
    signatures.add(shape(mesh));
  }
  assert.equal(signatures.size, 6);
  assert.ok(Object.isFrozen(LEGACY_SHOTGUN_MODELS));
  for (const id of Object.keys(LEGACY_SHOTGUN_MODELS)) {
    const model = legacyShotgunModel(id);
    assert.ok(Object.isFrozen(model) && model.parts.every(Object.isFrozen) && model.details.every(Object.isFrozen));
  }
  for (const id of ['__proto__', 'constructor', 'toString', null, 'missing']) assert.equal(legacyShotgunModel(id), null);
});

test('all six front sights have continuous metal down to the actual barrel instead of a floating bead', () => {
  const sightFronts = { shotgun: -.978, autoshotgun: -.888, slugshotgun: -1.078, shorty: -.418, bucky: -.968, judge: -.888 };
  const originalCounts = { shotgun: 894, autoshotgun: 930, slugshotgun: 840, shorty: 720, bucky: 894, judge: 924 };
  for (const id of SHOTGUNS) {
    const mesh = weaponMeshes(id);
    for (const y of [.09, .10, .12, .15]) assert.ok(solidAtHeight(mesh, 0, y, sightFronts[id] + .010), `${id}: no air gap below its fixed .152m sight tip`);
    assert.equal(solidAtHeight(mesh, 0, .153, sightFronts[id] + .010), false, `${id}: attachment never raises the tip above the accepted camera aim line`);
    assert.equal(mesh.length / 10, originalCounts[id], `${id}: extends the existing stalk with no additional vertices`);
  }
});

test('drum plates leave with the actual detachable magazine instead of remaining suspended on the gun', () => {
  for (const id of ['autoshotgun', 'judge']) {
    const full = points(weaponMeshes(id)), removed = points(weaponMeshes(id, {}, { reloadProgress: .4 }));
    assert.ok(full.some(([, y]) => y < -.25), `${id}: actual broad drum silhouette`);
    assert.ok(removed.every(([, y]) => y > -.2), `${id}: drum body, rim and painted face all disappear together during the fetch stage`);
  }
});

test('pump strokes move the ribbed forend while the barrel, receiver and live sight stay fixed', () => {
  for (const id of ['shotgun', 'slugshotgun', 'bucky']) {
    const ready = weaponMeshes(id), pumped = weaponMeshes(id, {}, { pump: 1 });
    assert.equal(ready.length, pumped.length, `${id}: cycling cannot duplicate geometry`);
    const travel = (valorantModel(id) || legacyShotgunModel(id)).pumpTravel || .16;
    let movingVertices = 0, fixedVertices = 0;
    for (let at = 0; at < ready.length; at += 10) {
      const deltaZ = pumped[at + 2] - ready[at + 2];
      assert.ok(Math.abs(pumped[at] - ready[at]) < .000001 && Math.abs(pumped[at + 1] - ready[at + 1]) < .000001);
      if (Math.abs(deltaZ) < .000001) fixedVertices++;
      else { assert.ok(Math.abs(deltaZ - travel) < .000001, `${id}: all rib paint follows the physical pump`); movingVertices++; }
    }
    assert.ok(movingVertices >= 72 && fixedVertices > movingVertices, `${id}: physical forend and its detailing cycle; the whole gun does not`);
  }
});

test('every refined shotgun clips its mechanics, loose shells and paint against real thin cover', () => {
  const wall = { colliders: [{ x: -8, y: 0, z: -.325, w: 16, h: 4, d: .015 }] };
  for (const id of SHOTGUNS) for (const reloadProgress of [0, .2, .4, .5, .83]) {
    for (const limit of [-.27, 0, .03, .3, .7]) {
      const mesh = weaponMeshes(id, {}, { limit, reloadProgress, pump: .8 });
      assert.ok(points(mesh).every(([, , z]) => z >= -limit - .000001), `${id}: decorative rib, brass hull and barrel never recreate a surface behind cover`);
    }
    for (const patch of [{}, { aimTicks: ADS.ticks }, { reloadTicks: WEAPONS[id].reloadTicks * reloadProgress }]) {
      assert.ok(points(view(id, patch, wall)).every(([, , z]) => z > -.31001), `${id}: first-person anchor remains on the actual eye side of the wall`);
    }
  }
});

test('all six miniature shotgun drops keep the established supply budget and reuse cached original assets', () => {
  const items = SHOTGUNS.map((weapon, id) => ({ id, kind: 'weapon', weapon, x: id, y: 0, z: 0 })), signatures = new Set();
  for (const item of items) {
    const mesh = lootMeshes([item]);
    assert.equal(mesh.count, 1);
    assert.ok((mesh.opaque.length + mesh.contacts.length) / 10 <= 246, `${item.weapon}: the complete 128-item supply pool stays affordable`);
    signatures.add(shape(mesh.opaque));
  }
  assert.equal(signatures.size, 6, 'a dropped twin-barrel, pump and drum gun retain recognisable geometry');
  const present = createLootPresenter(), first = present(items, 0);
  const second = present(items.map(item => ({ ...item })), 100);
  assert.equal(first.opaque.buffer, second.opaque.buffer);
  assert.equal(present.getStats().builds, 6);
});
