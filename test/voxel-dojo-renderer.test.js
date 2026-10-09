import assert from 'node:assert/strict';
import test from 'node:test';
import { DOJO_MAP } from '../public/voxel-dojo-map.js';
import { mapMeshes } from '../public/voxel-renderer.js';

const colors = { shoji: '#785a40', cedar: '#65442f', torii: '#762f24', plaster: '#75583d', lantern: '#ecd3a1' };
const rgb = color => [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255);
const withColor = (array, color) => {
  const expected = rgb(color), result = [];
  for (let index = 0; index < array.length; index += 10) if (expected.every((value, axis) => Math.abs(array[index + 6 + axis] - value) < 1e-6)) result.push([...array.slice(index, index + 3)]);
  return result;
};

test('Dojo true cedar, paper lattice, vermilion and lantern finishes route to their distinct surface geometry', () => {
  const before = JSON.stringify(DOJO_MAP), geometry = mapMeshes(DOJO_MAP);
  for (const [material, color] of Object.entries(colors)) {
    const points = withColor(geometry.opaque, color); assert.ok(points.length > 0, `${material}: authored finish is actually emitted`);
    const candidates = DOJO_MAP.colliders.filter(box => box.material === ({ shoji: 'shoji', cedar: 'dojo-cedar', torii: 'torii', plaster: 'dojo-plaster', lantern: 'lantern' })[material]);
    for (const point of points) assert.ok(candidates.some(box => point[0] >= box.x - .012 && point[0] <= box.x + box.w + .012 && point[1] >= box.y && point[1] <= box.y + box.h + .006 && point[2] >= box.z - .012 && point[2] <= box.z + box.d + .012), `${material}: finish cannot create phantom cover away from its real box`);
  }
  const pink = DOJO_MAP.colliders.find(box => box.material === 'cherry-foliage'), points = withColor(geometry.opaque, pink.color);
  assert.ok(points.length >= 24, 'four cherry canopies retain their unshaded pale-pink top surfaces');
  assert.equal(JSON.stringify(DOJO_MAP), before); assert.ok(geometry.opaque.every(Number.isFinite));
});

test('Dojo ground paint receives visible shadows and is built once into a bounded deterministic static mesh', () => {
  const geometry = mapMeshes(DOJO_MAP);
  for (let index = 1; index < geometry.shadows.length; index += 10) assert.ok(geometry.shadows[index] >= .019 && geometry.shadows[index] <= .023, 'shadows sit above the floor paint instead of disappearing under it');
  assert.ok(geometry.opaque.length / 10 < 50000); assert.ok(geometry.shadows.length / 10 < 4000);
  assert.deepEqual(mapMeshes(DOJO_MAP), geometry, 'static dojo art never depends on display time or RNG');
});
