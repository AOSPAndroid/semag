import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS as BREACH } from '../public/voxel-maps.js';
import { MAPS as ROYALE } from '../public/voxel-royale-maps.js';
import { mapMeshes } from '../public/voxel-renderer.js';

const close = (a, b) => Math.abs(a - b) < .0001;
const rgb = color => [1, 3, 5].map(at => parseInt(color.slice(at, at + 2), 16) / 255);
const rectOverlap = (a, b) => Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)) * Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
const surfaceQuads = (mesh, color, box, face, offset) => {
  const wanted = rgb(color), result = [], normal = face === 'north' ? -1 : 1;
  const plane = box.z + (face === 'south' ? box.d : 0) + normal * offset;
  for (let at = 0; at < mesh.length; at += 60) {
    if (!(mesh[at + 3] === 0 && mesh[at + 4] === 0 && mesh[at + 5] === normal && close(mesh[at + 2], plane) && wanted.every((value, axis) => close(mesh[at + 6 + axis], value)))) continue;
    const points = Array.from({ length: 6 }, (_, n) => Array.from(mesh.slice(at + n * 10, at + n * 10 + 9)));
    if (!points.every(([x, y, z, nx, ny, nz, r, g, b]) => nx === 0 && ny === 0 && nz === normal && close(z, plane) && close(r, wanted[0]) && close(g, wanted[1]) && close(b, wanted[2]) && x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h)) continue;
    result.push({ minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])), minY: Math.min(...points.map(p => p[1])), maxY: Math.max(...points.map(p => p[1])) });
  }
  return result;
};

test('every authored thin surface keeps paint at its real support height and retains all physical corners', () => {
  let checked = 0, breachChecked = 0, royaleChecked = 0;
  for (const [mode, catalog] of [['breach', BREACH], ['royale', ROYALE]]) for (const map of Object.values(catalog)) for (const box of map.colliders.filter(c => c.h <= .8 && !String(c.id).startsWith('landmark-'))) {
    const fixture = { ...map, id: `${mode}-${map.id}-${box.id}-surface`, colliders: [box], sites: [], buildings: [], decorations: [], routes: [], landmarks: [], stations: [], rangeLanes: [] };
    const mesh = mapMeshes(fixture).opaque;
    assert.ok(mesh.every(Number.isFinite));
    const positions = Array.from({ length: mesh.length / 10 }, (_, at) => [mesh[at * 10], mesh[at * 10 + 1], mesh[at * 10 + 2]]);
    for (const x of [box.x, box.x + box.w]) for (const y of [box.y, box.y + box.h]) for (const z of [box.z, box.z + box.d]) assert.ok(positions.some(p => close(p[0], x) && close(p[1], y) && close(p[2], z)), `${mode}/${map.id}/${box.id}: the complete real collision box remains rendered`);
    // The fixture contains one actual solid. Ground paint sits below .05m,
    // clouds start above 22m and the skyline stays outside the map bounds.
    // All pixels at playable height near this footprint must be attached.
    assert.ok(box.y + box.h < 20, 'every real thin support stays below the decorative cloud layer');
    const attached = positions.filter(([x, y, z]) => y > .05 && y < 20 && x >= box.x - .04 && x <= box.x + box.w + .04 && z >= box.z - .04 && z <= box.z + box.d + .04);
    assert.ok(attached.length > 0 || box.y + box.h <= .05, 'the physical surface above ground paint remains visible');
    for (const [, y] of attached) assert.ok(y >= box.y - .0201 && y <= box.y + box.h + .0201, `${mode}/${map.id}/${box.id}: finish cannot float above or below the ${box.h}m real surface`);
    checked++; if (mode === 'breach') breachChecked++; else royaleChecked++;
  }
  assert.ok(checked > 700 && breachChecked > 100 && royaleChecked > 100, 'both complete live catalogs, including platforms and small hop obstacles, are exercised');
});

test('core environment wordmarks and objective badges remain legible on their own real wall pixels', () => {
  for (const theme of ['rooftops', 'foundry', 'bastion']) {
    const map = BREACH[theme], box = map.colliders.find(c => c.w >= 5 && c.h >= 2.7 && c.y < .1 && !String(c.id).startsWith('wall-'));
    const mesh = mapMeshes(map).opaque;
    let sharedBadges = 0;
    for (const face of ['north', 'south']) {
      const title = surfaceQuads(mesh, '#e5d2a4', box, face, .034);
      assert.ok(title.length > 50, `${theme}/${face}: the full environment name is visible`);
      const badges = [...surfaceQuads(mesh, '#ecb964', box, face, .03), ...surfaceQuads(mesh, '#64c9bc', box, face, .03)];
      const backings = surfaceQuads(mesh, '#263b3e', box, face, .025);
      for (const glyph of title) for (const other of [...badges, ...backings]) assert.equal(rectOverlap(glyph, other), 0, `${theme}/${face}: objective glyphs and panels cannot cover the environment wordmark`);
      sharedBadges += badges.length;
    }
    assert.ok(sharedBadges > 0, 'the actual objectives still retain visible badges');
    if (theme === 'foundry') for (const face of ['north', 'south']) assert.equal(surfaceQuads(mesh, '#e5dac2', box, face, .031).length, 0, 'the furnace has its authored identity without competing generic cargo letters');
  }
  const depot = BREACH.depot, depotMesh = mapMeshes(depot).opaque;
  assert.ok(depot.colliders.some(box => ['north', 'south'].some(face => surfaceQuads(depotMesh, '#e5dac2', box, face, .031).length > 30)), 'valid freight-container labels remain visible in Depot');
});
