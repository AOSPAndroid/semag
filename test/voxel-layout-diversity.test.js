import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS as BREACH } from '../public/voxel-maps.js';
import { MAPS as ROYALE } from '../public/voxel-royale-maps.js';
import { DOJO_MAPS } from '../public/voxel-dojo-maps.js';
import { navigationCanOccupy } from '../public/voxel-navigation.js';

// Inspect playable structure, ignoring IDs, paint, materials and tiny props.
// An arena recoloured or given new labels must still fail this comparison.
function footprint(map) {
  const { minX, maxX, minZ, maxZ } = map.bounds;
  const solid = map.colliders.filter(box => !/^(wall|boundary)-/.test(box.id) && box.w * box.h * box.d >= .6);
  const out = [];
  for (const height of [1.4, 3.1, 4.0]) for (let z = 0; z < 64; z++) for (let x = 0; x < 64; x++) {
    const px = minX + (x + .5) / 64 * (maxX - minX);
    const pz = minZ + (z + .5) / 64 * (maxZ - minZ);
    out.push(Number(solid.some(box => px > box.x - .32 && px < box.x + box.w + .32 && pz > box.z - .32 && pz < box.z + box.d + .32
      && height > box.y && height < box.y + box.h)));
  }
  return out;
}

for (const [mode, maps] of [['breach', BREACH], ['royale', ROYALE], ['dojo', DOJO_MAPS]]) {
  test(`${mode}: floor plans differ independently of their colours and asset labels`, () => {
    const layouts = Object.entries(maps).map(([id, map]) => ({ id, mask: footprint(map) }));
    for (let i = 0; i < layouts.length; i++) for (let j = i + 1; j < layouts.length; j++) {
      const left = layouts[i], right = layouts[j];
      const changed = left.mask.reduce((sum, value, index) => sum + Number(value !== right.mask[index]), 0);
      assert.ok(changed >= left.mask.length * .02, `${mode}/${left.id}/${right.id}: substantial structural differences, not a colour swap (${changed} cells)`);
    }
  });
}

test('each combat theme provides a named upper circuit with clear ground and multiple entrances', () => {
  for (const [mode, maps] of [['breach', BREACH], ['royale', ROYALE]]) for (const map of Object.values(maps)) {
    assert.ok(map.upperFloors.length, `${mode}/${map.id}: usable upper floor`);
    for (const floor of map.upperFloors) {
      assert.ok(floor.name && floor.traverse.length >= 2 && new Set(floor.routeIds).size >= 2);
      assert.ok(floor.underpasses.length, `${floor.id}: a route under the upper floor`);
      for (const point of floor.traverse) assert.ok(navigationCanOccupy(map, point), `${floor.id}: standing upper footprint`);
      for (const point of floor.underpasses) assert.ok(navigationCanOccupy(map, { ...point, y: 0 }), `${floor.id}: standing lower footprint`);
    }
  }
});

test('the original Royale themes no longer use one six-cabin floor plan', () => {
  for (const id of ['forest', 'maze', 'desert']) {
    const map = ROYALE[id];
    assert.equal(map.authoredLayout, true);
    const rooms = map.buildings.map(building => [building.interior.maxX - building.interior.minX,
      building.interior.maxZ - building.interior.minZ].map(value => value.toFixed(2)).join(':'));
    assert.ok(new Set(rooms).size >= 3, `${id}: varied enterable room footprints`);
    assert.ok(map.upperFloors.some(floor => floor.traverse.length >= 3), `${id}: a connected upper route`);
  }
});
