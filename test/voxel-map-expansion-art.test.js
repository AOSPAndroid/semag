import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { DOJO_MAPS } from '../public/voxel-dojo-maps.js';
import { createMedievalMap } from '../public/voxel-medieval-map.js';
import { mapMeshes } from '../public/voxel-renderer.js';
import { MAP_EXPANSION_ART, MAP_EXPANSION_ATMOSPHERE, appendVoxelMapExpansionCollider, appendVoxelMapExpansionDecoration, appendVoxelMapExpansionFloors } from '../public/voxel-map-expansion-art.js';

const rgb = color => [1, 3, 5].map(at => parseInt(color.slice(at, at + 2), 16) / 255);
const close = (a, b) => Math.abs(a - b) < .00002;
const digest = array => createHash('sha256').update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
const withColor = (mesh, color) => {
  const wanted = rgb(color), values = [];
  for (let at = 0; at < mesh.length; at += 10) if (wanted.every((value, axis) => close(mesh[at + 6 + axis], value))) values.push(Array.from(mesh.slice(at, at + 6)));
  return values;
};

class SurfaceCapture {
  boxes = [];
  vertices = [];
  quad(a, b, c, d, normal, color) { for (const p of [a, b, c, a, c, d]) this.vertices.push({ p, normal, color }); }
  floor(x, z, w, d, color, y = .008) { this.quad([x, y, z], [x, y, z + d], [x + w, y, z + d], [x + w, y, z], [0, 1, 0], typeof color === 'string' ? [...rgb(color), 1] : color); }
  box(x, y, z, w, h, d, color) { this.boxes.push({ x, y, z, w, h, d, color }); }
}

test('new surface finishes emit each complete collision box and keep every detail within its real silhouette', () => {
  const materials = {
    'dojo-lantern': ['shoji', 'dojo-cedar', 'lantern', 'dojo-plaster', 'dojo-roof', 'dojo-stone', 'tatami'],
    'dojo-iron': ['steel', 'concrete', 'crate', 'iron-panel', 'iron-grate', 'hazard'],
    medieval: ['castle-stone', 'castle-timber', 'castle-slate', 'castle-iron', 'castle-gold', 'heraldic-red'],
  };
  for (const [theme, values] of Object.entries(materials)) for (const material of values) for (const [w, h, d] of [[5.2, 3.8, .4], [.35, 3.1, 4.6], [.20, .13, .18], [6, .32, 9]]) {
    const box = { id: `keep-tower-${material}`, x: 1.7, y: 2.1, z: -3.2, w, h, d, color: '#87958a', material, overhead: material === 'dojo-roof' };
    const capture = new SurfaceCapture(); assert.equal(appendVoxelMapExpansionCollider(capture, box, theme), true);
    assert.deepEqual(capture.boxes, [{ x: box.x, y: box.y, z: box.z, w, h, d, color: box.color }]);
    assert.ok(capture.vertices.length > 0);
    for (const { p, normal, color } of capture.vertices) {
      assert.ok([...p, ...normal, ...color].every(Number.isFinite));
      assert.ok(p[0] >= box.x - .0201 && p[0] <= box.x + w + .0201 && p[2] >= box.z - .0201 && p[2] <= box.z + d + .0201, `${theme}/${material}: all layer spacing remains thin face paint`);
      assert.ok(p[1] >= box.y - .0201 && p[1] <= box.y + h + .0201, `${theme}/${material}: no invented step or clipped underside`);
      assert.ok(normal.filter(value => Math.abs(value) === 1).length === 1);
    }
  }
  const legacy = new SurfaceCapture(); assert.equal(appendVoxelMapExpansionCollider(legacy, {}, 'dojo'), false); assert.equal(legacy.boxes.length + legacy.vertices.length, 0);
});

test('all three dojo worlds and both Crownfall scales retain distinct deterministic static art below the existing budget', () => {
  const maps = [...Object.values(DOJO_MAPS), createMedievalMap('breach'), createMedievalMap('royale')], signatures = new Set();
  for (const map of maps) {
    const before = JSON.stringify(map), first = mapMeshes(map), second = mapMeshes(map);
    assert.equal(JSON.stringify(map), before, `${map.id}/${map.mode}: paint never alters physics, equipment or loot`);
    assert.ok(first.opaque.every(Number.isFinite) && first.shadows.every(Number.isFinite));
    assert.ok((first.opaque.length + first.shadows.length) / 10 < 100000, `${map.id}/${map.mode}: existing static geometry budget`);
    assert.equal(digest(first.opaque), digest(second.opaque)); assert.equal(digest(first.shadows), digest(second.shadows));
    signatures.add(digest(first.opaque));
  }
  assert.equal(signatures.size, maps.length);
  assert.equal(new Set(Object.values(MAP_EXPANSION_ART).map(item => item.paving)).size, 3);
  assert.equal(new Set(Object.values(MAP_EXPANSION_ATMOSPHERE).map(item => item.top)).size, 3);
});

test('all selected dojo maps label four real stations and every range, including upstairs origins', () => {
  for (const map of Object.values(DOJO_MAPS)) {
    const mesh = mapMeshes(map).opaque, stationPaint = withColor(mesh, '#f2deb3'), rangePaint = withColor(mesh, '#eed5a5');
    for (const station of map.stations) {
      const bench = map.colliders.find(box => box.id === station.colliderId);
      const letters = stationPaint.filter(([x, y, z]) => x >= bench.x - .0201 && x <= bench.x + bench.w + .0201 && y >= bench.y && y <= bench.y + bench.h && z >= bench.z - .0201 && z <= bench.z + bench.d + .0201);
      assert.ok(letters.length > 0, `${map.id}/${station.id}: readable sign remains on the actual bench`);
    }
    for (const lane of map.rangeLanes) {
      const letters = rangePaint.filter(([x, y, z]) => Math.abs(x - lane.origin.x) < 1.3 && Math.abs(z - lane.origin.z - .58) < .3 && close(y, (lane.origin.y || 0) + (map.theme === 'dojo' ? .014 : .016)));
      assert.ok(letters.length > 0, `${map.id}/${lane.id}: no omitted fifth lane or ground-level label under an elevated deck`);
    }
  }
});

test('dojo floor shadows remain above painted flooring and Lantern ceiling boards stay flush to real overhead cover', () => {
  for (const map of Object.values(DOJO_MAPS)) {
    const mesh = mapMeshes(map);
    for (let at = 1; at < mesh.shadows.length; at += 10) assert.ok(mesh.shadows[at] >= .019 && mesh.shadows[at] <= .023);
  }
  const map = DOJO_MAPS['dojo-lantern'], roof = map.colliders.find(box => box.material === 'dojo-roof');
  const boards = withColor(mapMeshes(map).opaque, '#735538');
  assert.ok(boards.length > 0);
  assert.ok(boards.every(([x, y, z, nx, ny, nz]) => x >= roof.x && x <= roof.x + roof.w && z >= roof.z && z <= roof.z + roof.d && close(y, roof.y - .004) && nx === 0 && ny === -1 && nz === 0));
  const grid = withColor(mapMeshes(map).opaque, '#4b3829');
  assert.ok(grid.length > 0 && grid.every(([, y]) => close(y, roof.y - .012)), 'wide roof lattice is separated8mm from its broad underside paint');
});

test('authored castle banners are vertical paint on wall segments and never bridge real door openings', () => {
  for (const mode of ['breach', 'royale']) {
    const map = createMedievalMap(mode);
    for (const banner of map.decorations.filter(item => item.kind === 'castle-banner')) {
      const capture = new SurfaceCapture(); assert.equal(appendVoxelMapExpansionDecoration(capture, map, banner), true);
      assert.equal(capture.boxes.length, 0); assert.ok(capture.vertices.length > 0);
      const building = map.buildings.find(item => item.id === banner.buildingId), walls = map.colliders.filter(box => building.wallIds.includes(box.id));
      for (const { p: [x, y, z], normal: [nx, ny, nz] } of capture.vertices) {
        assert.equal(nx, 0); assert.equal(ny, 0); assert.equal(nz, banner.face === 'north' ? -1 : 1);
        assert.ok(walls.some(box => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h && z >= box.z - .0201 && z <= box.z + box.d + .0201), `${mode}/${banner.buildingId}: banner never covers an open door`);
      }
    }
    const base = map.buildings[0], opening = base.doorways[0], capture = new SurfaceCapture();
    const invalid = { kind: 'castle-banner', buildingId: base.id, face: 'north', x: opening.x - .6, y: .3, z: opening.z - .26, w: 1.2, h: 1.6 };
    assert.equal(appendVoxelMapExpansionDecoration(capture, map, invalid), true); assert.equal(capture.vertices.length, 0, 'invalid paint cannot invent a door-filling banner');
  }
});

test('new floor paint has one non-overlapping background and clipped detail8mm above its true support', () => {
  for (const map of [DOJO_MAPS['dojo-lantern'], DOJO_MAPS['dojo-iron'], createMedievalMap('breach'), createMedievalMap('royale')]) {
    const capture = new SurfaceCapture(); assert.equal(appendVoxelMapExpansionFloors(capture, map), true);
    const quads = [];
    for (let at = 0; at < capture.vertices.length; at += 6) {
      const vertices = capture.vertices.slice(at, at + 6), xs = vertices.map(item => item.p[0]), zs = vertices.map(item => item.p[2]);
      quads.push({ x: Math.min(...xs), z: Math.min(...zs), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs), y: vertices[0].p[1] });
    }
    const base = quads.filter(rect => close(rect.y % 1, .008) || close(rect.y - 2.4, .008));
    const details = quads.filter(rect => !base.includes(rect));
    assert.ok(base.length > 0 && details.length > 0);
    for (let a = 0; a < base.length; a++) for (let b = a + 1; b < base.length; b++) {
      if (!close(base[a].y, base[b].y)) continue;
      const overlapX = Math.min(base[a].x + base[a].w, base[b].x + base[b].w) - Math.max(base[a].x, base[b].x);
      const overlapZ = Math.min(base[a].z + base[a].d, base[b].z + base[b].d) - Math.max(base[a].z, base[b].z);
      assert.ok(overlapX <= .00001 || overlapZ <= .00001, `${map.id}: paths/pads cannot fight an overlapping broad floor rectangle`);
    }
    for (const detail of details) {
      const coveredArea = base.filter(rect => close(detail.y - rect.y, .008)).reduce((area, rect) => area
        + Math.max(0, Math.min(detail.x + detail.w, rect.x + rect.w) - Math.max(detail.x, rect.x))
        * Math.max(0, Math.min(detail.z + detail.d, rect.z + rect.d) - Math.max(detail.z, rect.z)), 0);
      assert.ok(Math.abs(coveredArea - detail.w * detail.d) < .00001, `${map.id}: grain stays on the non-overlapping background union with8mm depth separation`);
      assert.ok(close(detail.y, .016) || close(detail.y, 2.416), 'floor detail never creates a visible raised platform');
    }
  }
});
