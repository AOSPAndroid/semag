import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { MAPS as BREACH } from '../public/voxel-maps.js';
import { MAPS as ROYALE } from '../public/voxel-royale-maps.js';
import { mapMeshes } from '../public/voxel-renderer.js';
import { resolveVoxelWallSign, voxelIdentityFloorRegions, appendVoxelIdentityFloors } from '../public/voxel-map-expansion-art.js';

const close = (a, b) => Math.abs(a - b) < .0001;
const rgb = color => [1, 3, 5].map(at => parseInt(color.slice(at, at + 2), 16) / 255);
const colored = (mesh, color) => {
  const result = [], wanted = rgb(color);
  for (let at = 0; at < mesh.length; at += 10) if (wanted.every((value, i) => close(mesh[at + 6 + i], value))) result.push(Array.from(mesh.slice(at, at + 6)));
  return result;
};
const fixture = (theme, colliders = [], decorations = []) => ({ id: `identity-art-${theme}`, theme, bounds: { minX: -8, maxX: 8, minZ: -8, maxZ: 8 }, colliders, decorations, buildings: [], sites: [] });
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z));

test('wall signs resolve one real face, reject door-spanning panels and retain both horizontal wall orientations', () => {
  const wall = { id: 'left-jamb', x: -5, y: 0, z: 2, w: 2, h: 4, d: .4 }, vertical = { ...wall, id: 'long-wall', w: .4, d: 6 };
  const map = fixture('trading', [wall, vertical]);
  const sign = { kind: 'wall-sign', colliderId: wall.id, face: 'south', left: .10, bottom: 1.2, w: 1.6, h: 1, label: 'LAB' };
  assert.equal(resolveVoxelWallSign(map, sign).wall, wall);
  assert.equal(resolveVoxelWallSign(map, { ...sign, colliderId: vertical.id, face: 'west', w: 4 }).wall, vertical);
  for (const invalid of [{ ...sign, w: 3.4 }, { ...sign, left: -.2 }, { ...sign, bottom: 3.7 }, { ...sign, face: 'up' }, { ...sign, colliderId: 'door-opening' }, { ...sign, h: NaN }]) assert.equal(resolveVoxelWallSign(map, invalid), null);
});

test('Barclays wordmarks and pixel eagles stay on genuine signs in all four wall directions', () => {
  for (const face of ['north', 'south', 'west', 'east']) {
    const alongX = face === 'north' || face === 'south';
    const wall = { id: 'real-sign-wall', x: -5, y: 0, z: -5, w: alongX ? 10 : .4, h: 6, d: alongX ? .4 : 10, material: 'office-panel', color: '#718994' };
    const sign = { kind: 'wall-sign', colliderId: wall.id, face, left: 1, bottom: 1.3, w: 8, h: 1.45, label: 'BARCLAYS', sublabel: 'GLOBAL MARKETS', emblem: 'barclays' };
    const map = fixture('trading', [wall], [sign]), mesh = mapMeshes(map).opaque;
    const letters = colored(mesh, '#e0f5ff'), eagle = colored(mesh, '#25b7e7');
    assert.ok(letters.length >= 600, `${face}: the complete eight-letter wordmark remains visible`);
    assert.ok(eagle.length >= 300, `${face}: pixel eagle and cyan sign trim remain visible`);
    const normal = face === 'north' ? [0, 0, -1] : face === 'south' ? [0, 0, 1] : face === 'west' ? [-1, 0, 0] : [1, 0, 0];
    for (const [x, y, z, nx, ny, nz] of [...letters, ...eagle]) {
      assert.deepEqual([nx, ny, nz], normal);
      assert.ok(y >= sign.bottom && y <= sign.bottom + sign.h);
      const horizontal = alongX ? x - wall.x : z - wall.z;
      assert.ok(horizontal >= sign.left && horizontal <= sign.left + sign.w);
      const plane = alongX ? z : x, actual = alongX ? wall.z + (face === 'south' ? wall.d : 0) : wall.x + (face === 'east' ? wall.w : 0);
      assert.ok(Math.abs(plane - actual) >= .0159 && Math.abs(plane - actual) <= .0241, 'logo pixels are visibly separated paint on the actual bullet-blocking face');
    }
    const malformed = mapMeshes({ ...map, decorations: [{ ...sign, w: 16 }] }).opaque;
    assert.equal(colored(malformed, '#e0f5ff').length, 0, 'oversized branding never hides an adjacent physical doorway');
  }
});

test('both trading scales display inward-facing Barclays identity at the desk floor and upper gallery', () => {
  for (const catalog of [BREACH, ROYALE]) {
    const map = catalog.trading, mesh = mapMeshes(map).opaque, letters = colored(mesh, '#e0f5ff');
    for (const [side, expectedNormal] of [['north', 1], ['south', -1]]) {
      const wall = map.colliders.find(item => item.id === `wall-${side}` || item.id === `boundary-${side}`);
      const plane = wall.z + (side === 'north' ? wall.d : 0);
      const panel = letters.filter(([x, y, z, nx, ny, nz]) => x >= wall.x && x <= wall.x + wall.w && y >= 1 && y < 7 && close(z, plane + expectedNormal * .024) && nx === 0 && ny === 0 && nz === expectedNormal);
      assert.ok(panel.length >= 600, `${map.mode}/${side}: branding faces the actual playing room`);
      assert.ok(panel.some(([, y]) => y > 4.7), 'perimeter branding remains legible from the upper galleries');
    }
    const brand = map.colliders.find(item => item.id === 'trading-brand-wall');
    assert.ok(letters.some(([x, y, z]) => x >= brand.x && x <= brand.x + brand.w && y >= brand.y && y <= brand.y + brand.h && z >= brand.z - .025 && z <= brand.z + brand.d + .025), 'desk-floor players see the lower main market wordmark');
  }
});

test('identity floors partition overlapping paths, water crossings and room interiors at each support level', () => {
  const platform = { id: 'upper-floor', x: 3, y: 2.9, z: 0, w: 4, h: .3, d: 4 };
  const map = { ...fixture('trading', [platform], [
    { kind: 'aisle', x: -5, z: -5, w: 10, d: 10, color: '#7d8585' },
    { kind: 'water-channel', x: -2, z: -4, w: 3, d: 8, color: '#394c35' },
    { kind: 'upper-aisle', x: 3, y: 3.2, z: 0, w: 4, d: 4, color: '#708090' },
  ]), buildings: [{ id: 'ground-room', interior: { minX: -4, maxX: -1, minZ: -3, maxZ: 3 } }] };
  const regions = voxelIdentityFloorRegions(map);
  assert.ok(regions.some(region => close(region.y, 3.208)), 'upstairs paint uses the real platform support');
  for (let a = 0; a < regions.length; a++) for (let b = a + 1; b < regions.length; b++) if (close(regions[a].y, regions[b].y)) assert.equal(overlap(regions[a], regions[b]), 0, 'one disjoint broad floor background per support level');
  assert.ok(regions.filter(region => close(region.y, .008)).reduce((sum, region) => sum + region.w * region.d, 0) === 100, 'clipping preserves complete authored ground coverage');
  const floors = [], mesh = { floor(x, z, w, d, color, y) { floors.push({ x, z, w, d, color, y }); } };
  assert.equal(appendVoxelIdentityFloors(mesh, map), true);
  for (const floor of floors) {
    const supports = regions.filter(region => close(floor.y, region.y) || close(floor.y, region.y + .008));
    assert.ok(Math.abs(supports.reduce((area, region) => area + overlap(floor, region), 0) - floor.w * floor.d) < .000001, 'detail remains clipped to its disjoint background and separated by8mm');
  }
});

test('new skybridge lighting is visibly distinct from office ceiling panels and sewer collector lamps', () => {
  const ceiling = { id: 'actual-ceiling', x: -3, y: 6, z: -3, w: 6, h: .3, d: 6, overhead: true };
  for (const [theme, material, light, depth] of [['snow', 'snow-ceiling', '#d8f5ff', .020], ['trading', 'office-ceiling', '#fff7e8', .008], ['sewers', 'sewer-ceiling', '#ffe0a0', .008]]) {
    const mesh = mapMeshes(fixture(theme, [{ ...ceiling, material }])).opaque, lit = colored(mesh, light);
    assert.ok(lit.length > 0, `${theme}: recognizable environment lighting`);
    assert.ok(lit.every(([x, y, z, nx, ny, nz]) => close(y, ceiling.y - depth) && nx === 0 && ny === -1 && nz === 0 && x >= ceiling.x && x <= ceiling.x + ceiling.w && z >= ceiling.z && z <= ceiling.z + ceiling.d), 'all lamps remain paint on physical overhead cover');
  }
});

test('Bastion relay bases rest on their actual redesigned battlements instead of floating above them', () => {
  const map = BREACH.bastion;
  for (const side of ['west', 'east']) {
    const mast = map.colliders.find(item => item.id === `landmark-bastion-${side}-mast`);
    const head = map.colliders.find(item => item.id === `landmark-bastion-${side}-array`);
    assert.ok(map.colliders.some(box => box.id !== mast.id && close(box.y + box.h, mast.y) && box.x <= mast.x && box.x + box.w >= mast.x + mast.w && box.z <= mast.z && box.z + box.d >= mast.z + mast.d), 'whole mast footprint has a real roof support');
    assert.ok(close(head.y, mast.y + mast.h), 'relay array rests exactly on the mast');
  }
});

test('each identity environment tessellates its ground once without a second broad coplanar floor', () => {
  for (const theme of ['snow', 'sewers', 'trading', 'paris']) {
    const map = fixture(theme), mesh = mapMeshes(map).opaque, ground = [];
    for (let at = 0; at < mesh.length; at += 60) {
      const positions = Array.from({ length: 6 }, (_, n) => Array.from(mesh.slice(at + n * 10, at + n * 10 + 3)));
      if (!positions.every(([x, y, z]) => close(y, 0) && x >= map.bounds.minX && x <= map.bounds.maxX && z >= map.bounds.minZ && z <= map.bounds.maxZ)) continue;
      const xs = positions.map(p => p[0]), zs = positions.map(p => p[2]);
      ground.push({ x: Math.min(...xs), z: Math.min(...zs), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs) });
    }
    assert.ok(Math.abs(ground.reduce((area, rect) => area + rect.w * rect.d, 0) - 256) < .0002);
    for (let a = 0; a < ground.length; a++) for (let b = a + 1; b < ground.length; b++) assert.ok(overlap(ground[a], ground[b]) < .000001, `${theme}: no coplanar duplicate ground rectangle`);
  }
});

test('all updated identity meshes stay deterministic, finite and within the shared100k static budget', () => {
  for (const [mode, catalog] of [['breach', BREACH], ['royale', ROYALE]]) for (const id of ['snow', 'sewers', 'trading', 'paris']) {
    const map = catalog[id], before = JSON.stringify(map), first = mapMeshes(map), second = mapMeshes(map);
    const digest = array => createHash('sha256').update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
    assert.equal(JSON.stringify(map), before);
    assert.equal(digest(first.opaque), digest(second.opaque));
    assert.ok(first.opaque.every(Number.isFinite) && first.shadows.every(Number.isFinite));
    assert.ok((first.opaque.length + first.shadows.length) / 10 < 100000, `${mode}/${id}: sensible static world budget`);
  }
});
