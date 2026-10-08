import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS as BREACH_MAPS } from '../public/voxel-maps.js';
import { MAPS as ROYALE_MAPS } from '../public/voxel-royale-maps.js';
import { mapMeshes } from '../public/voxel-renderer.js';

const pointKey = point => point.map(value => value.toFixed(4)).join(':');
const positions = array => Array.from({ length: array.length / 10 }, (_, index) => Array.from(array.slice(index * 10, index * 10 + 3)));
const close = (a, b) => Math.abs(a - b) < .0001;
const rgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
const fixtureMap = theme => ({ id: `asset-${theme}`, theme, bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 }, colliders: [], sites: [], buildings: [] });

function isolate(collider, theme) {
  const map = fixtureMap(theme), background = new Set(positions(mapMeshes(map).opaque).map(pointKey));
  const mesh = mapMeshes({ ...map, colliders: [collider] }).opaque;
  const vertices = [];
  for (let index = 0; index < mesh.length; index += 10) {
    const position = Array.from(mesh.slice(index, index + 3));
    if (!background.has(pointKey(position))) vertices.push({ position, normal: Array.from(mesh.slice(index + 3, index + 6)), color: Array.from(mesh.slice(index + 6, index + 9)) });
  }
  return { mesh, vertices };
}

test('crafted bark, foliage, timber and carved stone remain paint on their true solids', () => {
  const cases = [
    ['forest', { id: 'pine-fixture-trunk', x: 0, y: 0, z: 0, w: .72, h: 4.3, d: .72, material: 'bark', color: '#76543a' }, 6],
    ['forest', { id: 'pine-fixture-crown', x: 0, y: 3.65, z: 0, w: 4, h: 1.65, d: 4, material: 'foliage', color: '#37694a' }, 6],
    ['forest', { id: 'cedar-cabin-north-left', x: 0, y: 0, z: 0, w: 2.4, h: 3, d: .4, material: 'wood', color: '#9b7550' }, 7],
    ['maze', { id: 'maze-nw-north', x: 0, y: 0, z: 0, w: 8, h: 2.52, d: .8, material: 'stone', color: '#9ba593' }, 5],
    ['desert', { id: 'temple-column-fixture', x: 0, y: 0, z: 0, w: 1, h: 3, d: 1, material: 'sandstone', color: '#b39362' }, 5],
    ['paris', { id: 'paris-cafe-roof', x: 0, y: 3.6, z: 0, w: 8, h: .4, d: 7, material: 'slate', color: '#596978' }, 6],
    ['paris', { id: 'paris-cafe-inner-step-4', x: 0, y: 0, z: 0, w: 2.2, h: 3.2, d: 2.2, material: 'wood', color: '#ba9672' }, 6],
  ];
  for (const [theme, box, minimumColors] of cases) {
    const { mesh, vertices } = isolate(box, theme);
    assert.ok(mesh.every(Number.isFinite), `${box.id}: finite geometry`);
    const colors = new Set(vertices.map(vertex => vertex.color.map(value => value.toFixed(4)).join(':')));
    assert.ok(colors.size >= minimumColors, `${box.id}: readable layered material palette`);
    const points = new Set(vertices.map(vertex => pointKey(vertex.position)));
    for (const x of [box.x, box.x + box.w]) for (const y of [box.y, box.y + box.h]) for (const z of [box.z, box.z + box.d]) assert.ok(points.has(pointKey([x, y, z])), `${box.id}: retains complete collision box`);
    for (const { position: [x, y, z] } of vertices) {
      assert.ok(x >= box.x - .027 && x <= box.x + box.w + .027, `${box.id}: no misleading protruding geometry on X`);
      assert.ok(y >= box.y - .001 && y <= box.y + box.h + .008, `${box.id}: no added platform or raised obstacle`);
      assert.ok(z >= box.z - .027 && z <= box.z + box.d + .027, `${box.id}: no misleading protruding geometry on Z`);
    }
  }
});

test('Paris interior finishes face the real room while street windows face outward', () => {
  const box = { id: 'paris-cafe-west', x: 0, y: 0, z: 0, w: .4, h: 3.6, d: 7, material: 'stone', color: '#d1c2a8' };
  const { vertices } = isolate(box, 'paris'), plaster = rgb('#dfd0b4'), glass = rgb('#4c6672');
  const plasterVertices = vertices.filter(vertex => vertex.color.every((value, index) => close(value, plaster[index])));
  const glassVertices = vertices.filter(vertex => vertex.color.every((value, index) => close(value, glass[index])));
  assert.ok(plasterVertices.length > 0 && glassVertices.length > 0);
  assert.ok(plasterVertices.every(vertex => close(vertex.position[0], box.x + box.w + .003) && vertex.normal[0] === 1), 'warm inner plaster lies on the east face of the west wall');
  assert.ok(glassVertices.every(vertex => close(vertex.position[0], box.x - .008) && vertex.normal[0] === -1), 'street window paint cannot leak into the room');
});

test('interior art, roof finishes and door signs preserve every real entrance in all themed rooms', () => {
  for (const map of [BREACH_MAPS.paris, ...Object.values(ROYALE_MAPS)]) {
    const mesh = mapMeshes(map), points = positions(mesh.opaque);
    for (const building of map.buildings) for (const door of building.doorways) {
      const crossing = points.filter(([x, y, z]) => Math.abs(x - door.x) < door.width / 2 - .025 && Math.abs(z - door.z) < .24 && y > .04 && y < door.height - .025);
      assert.equal(crossing.length, 0, `${map.theme}/${building.id}: clear ${door.z} doorway, with no paint bridging the opening`);
    }
  }
});

test('crafted world assets stay within the established static budget for every arena', () => {
  for (const [mode, maps] of [['breach', BREACH_MAPS], ['royale', ROYALE_MAPS]]) for (const [id, map] of Object.entries(maps)) {
    const mesh = mapMeshes(map), total = (mesh.opaque.length + mesh.shadows.length) / 10;
    assert.ok(total < 100000, `${mode}/${id}: ${total} vertices including shadows`);
    assert.ok(mesh.opaque.every(Number.isFinite) && mesh.shadows.every(Number.isFinite));
    if (id === 'paris') assert.ok(total < 95000, `${mode}/paris: foreground craft leaves room inside the shared budget`);
  }
});
