import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS, MAP_IDS } from '../public/voxel-maps.js';

const RADIUS = .32, BODY_HEIGHT = 1.8, EPS = 1e-7;
const overlaps = (point, box, y = 0) => {
  const closestX = Math.max(box.x, Math.min(point.x, box.x + box.w));
  const closestZ = Math.max(box.z, Math.min(point.z, box.z + box.d));
  return Math.hypot(point.x - closestX, point.z - closestZ) < RADIUS - EPS
    && y < box.y + box.h - EPS && y + BODY_HEIGHT > box.y + EPS;
};

test('twelve authored maps expose immutable geometry with a bounded collision budget', () => {
  assert.deepEqual(MAP_IDS, ['courtyard', 'depot', 'canal', 'rooftops', 'foundry', 'bastion', 'paris', 'snow', 'sewers', 'trading', 'market', 'lockdown']);
  assert.ok(Object.isFrozen(MAPS));
  assert.ok(Object.isFrozen(MAP_IDS));
  const geometries = new Set();
  for (const [id, map] of Object.entries(MAPS)) {
    assert.equal(map.id, id);
    assert.equal(map.theme, id);
    assert.ok(map.name && map.description);
    assert.ok(Object.isFrozen(map));
    assert.ok(Object.isFrozen(map.bounds));
    assert.ok(Object.isFrozen(map.colliders));
    assert.ok(map.colliders.length <= (['snow', 'sewers', 'trading', 'market', 'lockdown'].includes(id) ? 180 : id === 'paris' ? 128 : id === 'foundry' ? 60 : 55), `${id} collision budget`);
    assert.equal(new Set(map.colliders.map(box => box.id)).size, map.colliders.length, `${id} duplicate cover ID`);
    geometries.add(JSON.stringify(map.colliders));
    for (const box of map.colliders) {
      assert.ok(Object.isFrozen(box));
      for (const field of ['x', 'y', 'z', 'w', 'h', 'd']) assert.ok(Number.isFinite(box[field]), `${id}/${box.id} ${field}`);
      for (const field of ['w', 'h', 'd']) assert.ok(box[field] > 0, `${id}/${box.id} positive ${field}`);
      if (!box.id.startsWith('wall-')) {
        assert.ok(box.x >= map.bounds.minX - EPS && box.x + box.w <= map.bounds.maxX + EPS, `${id}/${box.id} x bounds`);
        assert.ok(box.z >= map.bounds.minZ - EPS && box.z + box.d <= map.bounds.maxZ + EPS, `${id}/${box.id} z bounds`);
      }
    }
  }
  assert.equal(geometries.size, MAP_IDS.length);
});

test('all squad spawns and ground charge sites remain clear of new climb geometry', () => {
  for (const map of Object.values(MAPS)) {
    assert.ok(Object.isFrozen(map.spawns));
    assert.deepEqual(map.spawns.map(side => side.length), [3, 3]);
    assert.equal(new Set(map.spawns.flat().map(point => `${point.x}:${point.z}`)).size, 6);
    for (const side of map.spawns) {
      assert.ok(Object.isFrozen(side));
      for (const spawn of side) {
        assert.ok(Object.isFrozen(spawn));
        assert.ok(!map.colliders.some(box => overlaps(spawn, box)), `${map.id} obstructed spawn`);
      }
    }
    assert.deepEqual(map.sites.map(site => site.id), ['A', 'B']);
    assert.ok(Object.isFrozen(map.sites));
    for (const site of map.sites) {
      assert.ok(Object.isFrozen(site));
      assert.ok(site.radius >= 2);
      assert.ok(!map.colliders.some(box => overlaps(site, box)), `${map.id}/${site.id} planting center`);
    }
  }
});

test('climb routes mark clear starts and real, unobstructed landing surfaces', () => {
  let routeCount = 0;
  for (const map of Object.values(MAPS)) {
    assert.ok(Object.isFrozen(map.routes));
    assert.ok(map.routes.length >= 4, `${map.id} alternate climbs`);
    assert.equal(new Set(map.routes.map(route => route.id)).size, map.routes.length);
    for (const side of ['south', 'north']) assert.ok(map.routes.filter(route => route.side === side).length >= 2, `${map.id} ${side} approaches`);
    for (const route of map.routes) {
      routeCount++;
      assert.ok(Object.isFrozen(route));
      assert.ok(Object.isFrozen(route.start));
      assert.ok(Object.isFrozen(route.steps));
      assert.ok(Object.isFrozen(route.approach));
      assert.ok(route.name);
      assert.ok(['flank', 'mid'].includes(route.role));
      assert.ok(!map.colliders.some(box => overlaps(route.start, box)), `${map.id}/${route.id} floor start`);
      assert.ok(route.steps.length >= 4);
      let previousHeight = 0;
      for (const [index, step] of route.steps.entries()) {
        assert.ok(Object.isFrozen(step));
        const box = map.colliders.find(box => box.id === step.colliderId);
        assert.ok(box, `${map.id}/${route.id} missing support ${step.colliderId}`);
        assert.ok(step.x >= box.x + RADIUS - EPS && step.x <= box.x + box.w - RADIUS + EPS, `${route.id}/${index} inset x`);
        assert.ok(step.z >= box.z + RADIUS - EPS && step.z <= box.z + box.d - RADIUS + EPS, `${route.id}/${index} inset z`);
        const height = box.y + box.h;
        assert.ok(height >= previousHeight - EPS && height - previousHeight <= .8 + EPS, `${route.id}/${index} reachable rise`);
        assert.ok(!map.colliders.some(cover => overlaps(step, cover, height)), `${route.id}/${index} blocked landing`);
        if (index < 3) assert.ok(box.w >= 2.2 - EPS && box.d >= 2.2 - EPS, `${route.id}/${index} broad platform`);
        previousHeight = height;
      }
      assert.ok(previousHeight >= 3.2 - EPS, `${route.id} worthwhile high ground`);
    }
  }
  assert.equal(routeCount, 58);
});

test('new maps include distinct upper route shapes and genuine walk-under space', () => {
  for (const [id, supportId, point] of [
    ['rooftops', 'roofline-west-roof', { x: -13, z: -1 }],
    ['foundry', 'foundry-west-gallery', { x: -14.5, z: 0 }],
    ['bastion', 'bastion-west-bridge', { x: -6.6, z: 1 }],
  ]) {
    const map = MAPS[id], support = map.colliders.find(box => box.id === supportId);
    assert.ok(support.y >= BODY_HEIGHT + .9 - EPS, `${id} standing headroom`);
    assert.ok(point.x > support.x && point.x < support.x + support.w && point.z > support.z && point.z < support.z + support.d);
    assert.ok(!map.colliders.some(box => overlaps(point, box)), `${id} genuine clear passage`);
    assert.ok(map.routes.some(route => route.role === 'mid'), `${id} contested upper route`);
  }
  for (const id of ['rooftops', 'bastion']) {
    const map = MAPS[id];
    assert.ok(map.routes.filter(route => {
      const end = route.steps.at(-1), support = map.colliders.find(box => box.id === end.colliderId);
      return support.y + support.h === 4;
    }).length >= 2, `${id} alternate watch deck access`);
  }
});
