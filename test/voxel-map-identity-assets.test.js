import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { MAPS as BREACH_MAPS } from '../public/voxel-maps.js';
import { MAPS as ROYALE_MAPS } from '../public/voxel-royale-maps.js';
import { createTradingMap } from '../public/voxel-trading-map.js';
import { mapMeshes } from '../public/voxel-renderer.js';

const digest = array => createHash('sha256').update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
const key = values => values.map(value => value.toFixed(4)).join(':');
const vertexPositions = array => Array.from({ length: array.length / 10 }, (_, at) => Array.from(array.slice(at * 10, at * 10 + 3)));
const fixture = theme => ({ id: `identity-${theme}`, theme, bounds: { minX: -4, maxX: 4, minZ: -4, maxZ: 4 }, colliders: [], sites: [], buildings: [], landmarks: [] });
const rgb = color => [1, 3, 5].map(at => parseInt(color.slice(at, at + 2), 16) / 255);
const close = (a, b) => Math.abs(a - b) < .0001;

function isolate(theme, collider) {
  const base = fixture(theme), background = new Set(vertexPositions(mapMeshes(base).opaque).map(key));
  const mesh = mapMeshes({ ...base, colliders: [collider] }).opaque;
  const vertices = [];
  for (let at = 0; at < mesh.length; at += 10) {
    const position = Array.from(mesh.slice(at, at + 3));
    if (!background.has(key(position))) vertices.push({ position, normal: Array.from(mesh.slice(at + 3, at + 6)), color: Array.from(mesh.slice(at + 6, at + 9)) });
  }
  return { mesh, vertices };
}

test('all independently authored environments retain the original 100k static budget and stable cached artwork', () => {
  const signatures = new Set();
  for (const [mode, maps] of [['breach', BREACH_MAPS], ['royale', ROYALE_MAPS]]) for (const [id, map] of Object.entries(maps)) {
    const before = JSON.stringify(map), first = mapMeshes(map), second = mapMeshes(map);
    assert.equal(JSON.stringify(map), before, `${mode}/${id}: art does not change server collision, spawn or loot data`);
    assert.ok((first.opaque.length + first.shadows.length) / 10 < 100000, `${mode}/${id}: static meshes remain inside the existing art budget`);
    assert.ok(first.opaque.every(Number.isFinite) && first.shadows.every(Number.isFinite));
    assert.equal(first.opaque.length % 30, 0);
    assert.equal(digest(first.opaque), digest(second.opaque), `${mode}/${id}: deterministic build for world cache`);
    signatures.add(digest(first.opaque));
  }
  assert.equal(signatures.size, Object.keys(BREACH_MAPS).length + Object.keys(ROYALE_MAPS).length);
});

test('new office, sewer and alpine materials remain on their complete actual solids', () => {
  const fixtures = [
    ['trading', 'desk', 'trading-desk-test', 4.8, .12, 2.2, .68],
    ['trading', 'desk-cabinet', 'trading-drawer-test', .72, .68, 1.96, 0],
    ['trading', 'office-chair', 'trading-chair-test', .66, .63, .12, .57],
    ['trading', 'screen', 'trading-market-test', 4.2, 1.2, .36, .8],
    ['trading', 'glass', 'trading-meeting-test', .3, 2.9, 5, 0],
    ['sewers', 'sewer-brick', 'sewers-masonry-test', 4.5, 3.4, .7, 0],
    ['sewers', 'pipe', 'sewers-pipe-test', .6, .7, 5, .5],
    ['snow', 'radar', 'snow-radar-test', 2, .9, 2, 3.8],
    ['snow', 'weather-equipment', 'snow-roof-housing-test', 1.2, .8, 1, 3.2],
    ['snow', 'snow-bank', 'snow-bank-test', 4.5, 1.3, 2, 0],
  ];
  for (const [theme, material, id, w, h, d, y] of fixtures) {
    const collider = { id, material, color: '#87958a', x: 0, y, z: 0, w, h, d };
    const { mesh, vertices } = isolate(theme, collider), positions = new Set(vertices.map(vertex => key(vertex.position)));
    assert.ok(mesh.every(Number.isFinite));
    for (const x of [0, w]) for (const yy of [y, y + h]) for (const z of [0, d]) assert.ok(positions.has(key([x, yy, z])), `${id}: exact collision corner is visible`);
    for (const { position: [x, yy, z] } of vertices) {
      assert.ok(x >= -.016 && x <= w + .016 && z >= -.016 && z <= d + .016, `${id}: surface art does not create false cover beyond the actual silhouette`);
      assert.ok(yy >= y - .009 && yy <= y + h + .009, `${id}: no invented platform or missing underside`);
    }
    assert.ok(new Set(vertices.map(vertex => key(vertex.color))).size >= 5, `${id}: readable layered finish`);
  }
});

test('standing market displays show distinct price charts on both genuine screen faces and both orientations', () => {
  for (const [w, d, expectedAxis] of [[4.2, .36, 2], [.22, 5, 0]]) {
    const collider = { id: 'market-charts', x: 0, y: .8, z: 0, w, h: 1.2, d, material: 'screen', color: '#17394b' };
    const { vertices } = isolate('trading', collider);
    for (const color of ['#70b69e', '#d29a7f', '#70a1ac']) {
      const colored = vertices.filter(vertex => vertex.color.every((value, i) => close(value, rgb(color)[i])));
      assert.ok(colored.length > 0, `${w}×${d}: actual authored market chart uses ${color}`);
      assert.ok(colored.every(vertex => Math.abs(vertex.normal[expectedAxis]) === 1), 'charts stay attached to the two physical screen faces');
      assert.ok(colored.some(vertex => vertex.normal[expectedAxis] === 1) && colored.some(vertex => vertex.normal[expectedAxis] === -1));
    }
  }
});

function triangleHit(origin, direction, a, b, c) {
  const sub = (u, v) => u.map((value, i) => value - v[i]);
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const dot = (u, v) => u.reduce((sum, value, i) => sum + value * v[i], 0);
  const e1 = sub(b, a), e2 = sub(c, a), p = cross(direction, e2), det = dot(e1, p);
  if (Math.abs(det) < 1e-8) return Infinity;
  const inv = 1 / det, t = sub(origin, a), u = dot(t, p) * inv;
  if (u < -1e-8 || u > 1 + 1e-8) return Infinity;
  const q = cross(t, e1), v = dot(direction, q) * inv;
  if (v < -1e-8 || u + v > 1 + 1e-8) return Infinity;
  const travel = dot(e2, q) * inv;
  return travel >= 0 ? travel : Infinity;
}
function meshHit(mesh, origin, direction) {
  let nearest = Infinity;
  for (let at = 0; at < mesh.length; at += 30) nearest = Math.min(nearest, triangleHit(origin, direction,
    Array.from(mesh.slice(at, at + 3)), Array.from(mesh.slice(at + 10, at + 13)), Array.from(mesh.slice(at + 20, at + 23))));
  return nearest;
}

test('the visible office desk gap stays open while its real monitor bank blocks a head-height sight line', () => {
  const authored = createTradingMap(), desk = authored.landmarks.find(item => item.kind === 'desk-pod');
  const monitor = authored.colliders.find(item => item.id === 'trading-monitor-0');
  const ids = new Set([...desk.collisionIds, monitor.id]);
  const map = { ...fixture('trading'), colliders: authored.colliders.filter(item => ids.has(item.id)), bounds: authored.bounds };
  const mesh = mapMeshes(map).opaque, startZ = desk.z - 1, centerX = desk.x + desk.w / 2;
  assert.ok(meshHit(mesh, [centerX, .4, startZ], [0, 0, 1]) > desk.d + 2, 'art leaves the same underside firing gap as the three physical desk pieces');
  const hit = meshHit(mesh, [centerX, 1.3, startZ], [0, 0, 1]);
  assert.ok(Math.abs(hit - (monitor.z - startZ)) < .016, 'screen paint and body stop at the actual bullet-blocking monitor slab');
});

test('sewer collector lights are warm masonry work lamps and office ceiling lights stay visibly distinct', () => {
  const ceiling = { id: 'ceiling-test', x: 0, y: 3.4, z: 0, w: 6, h: .32, d: 8, overhead: true };
  const sewer = isolate('sewers', { ...ceiling, material: 'sewer-roof' }), office = isolate('trading', { ...ceiling, material: 'office-ceiling' });
  assert.notEqual(digest(sewer.mesh), digest(office.mesh));
  for (const [art, color] of [[sewer, '#ffe0a0'], [office, '#fff7e8']]) {
    const lit = art.vertices.filter(vertex => vertex.color.every((value, i) => close(value, rgb(color)[i])));
    assert.ok(lit.length > 0);
    assert.ok(lit.every(vertex => vertex.normal[1] === -1 && close(vertex.position[1], 3.392)), 'work lights sit flush against the underside of real overhead cover');
  }
});

test('wet sewer channels remain clearly visible above the real level ground without raised banks or false pools', () => {
  const channel = { id: 'channel-test', x: 0, y: -.16, z: 0, w: 1.5, h: .16, d: 6, color: '#394c35', material: 'water' };
  const { vertices } = isolate('sewers', channel);
  const wet = vertices.filter(vertex => vertex.normal[1] === 1 && vertex.position[1] > .008);
  assert.ok(wet.length > 0, 'the water finish is visible over the shared flat collision floor');
  assert.ok(wet.every(vertex => vertex.position[1] <= .0141 && vertex.position[0] >= 0 && vertex.position[0] <= 1.5 && vertex.position[2] >= 0 && vertex.position[2] <= 6), 'shallow water paint stays within its real channel support');
});
