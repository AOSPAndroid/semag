import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS as BREACH } from '../public/voxel-maps.js';
import { MAPS as ROYALE } from '../public/voxel-royale-maps.js';
import { WORLD, WEAPONS, createCombatPlayer, emptyInput, predictLocalMovement, traceShot } from '../public/voxel-engine.js';
import { navigationCanOccupy, navigationPath } from '../public/voxel-navigation.js';
import { mapMeshes } from '../public/voxel-renderer.js';

const heavy = Object.values(WEAPONS).reduce((a, b) => a.speed < b.speed ? a : b);
const scenarios = [
  ['royale', ROYALE.forest, 200, { x: 12, z: -38 }],
  ['royale', ROYALE.maze, 200, { x: 7, z: -33 }],
  ['royale', ROYALE.desert, 200, { x: 2, z: 37 }],
  ['breach', BREACH.medieval, 100, { x: -7, z: -23 }],
  ['royale', ROYALE.medieval, 160, { x: 2, z: -33 }],
];
const sparse = map => map.colliders.filter(box => box.id.startsWith(`${map.id}-sparse-`));
const distance = (point, box) => Math.hypot(
  Math.max(box.x - point.x, 0, point.x - box.x - box.w),
  Math.max(box.z - point.z, 0, point.z - box.z - box.d));
const nearbyGround = (map, point) => Math.min(...map.colliders.filter(box => box.y < 1.8 && box.y + box.h > .25
  && !/^(wall|boundary)-/.test(box.id)).map(box => distance(point, box)));
const spawn = map => (map.spawns?.flat() || map.spawnPoints)[0];
const faces = box => [
  { point: { x: box.x + box.w / 2, y: 0, z: box.z - .7 }, direction: { x: 0, y: 0, z: 1 } },
  { point: { x: box.x + box.w / 2, y: 0, z: box.z + box.d + .7 }, direction: { x: 0, y: 0, z: -1 } },
  { point: { x: box.x - .7, y: 0, z: box.z + box.d / 2 }, direction: { x: 1, y: 0, z: 0 } },
  { point: { x: box.x + box.w + .7, y: 0, z: box.z + box.d / 2 }, direction: { x: -1, y: 0, z: 0 } },
];
const protectedPoints = map => [
  ...(map.spawns?.flat() || map.spawnPoints), ...map.sites, ...(map.lootPoints || []),
  ...(map.stormCenter ? [map.stormCenter] : []), ...map.routes.map(route => route.start),
  ...map.buildings.flatMap(building => building.doorways.flatMap(door => [door.inside, door.outside])),
  ...map.upperFloors.flatMap(floor => [...floor.underpasses, ...floor.traverse]),
  ...map.routes.flatMap(route => route.steps.map(step => {
    const support = map.colliders.find(box => box.id === step.colliderId);
    return { x: step.x, y: support.y + support.h, z: step.z };
  })),
];

for (const [mode, map, cap, formerGap] of scenarios) {
  const label = `${mode}/${map.id}`;

  test(`${label}: setting-specific supplies reduce a bare lane within the original physics and art budgets`, () => {
    const added = sparse(map), base = { ...map, colliders: map.colliders.filter(box => !added.includes(box)) };
    assert.ok(added.length >= 6 && added.length <= 10);
    assert.ok(map.colliders.length <= cap);
    assert.equal(new Set(map.colliders.map(box => box.id)).size, map.colliders.length);
    assert.ok(nearbyGround(map, formerGap) < nearbyGround(base, formerGap) - 2,
      'cover meaningfully shortens an existing bare approach');
    assert.ok(added.some(box => box.h >= 1.2), 'each setting gains cover for a standing peek');
    assert.ok(added.some(box => box.h <= .84), 'each setting retains small jump plays');
    for (const box of added) {
      assert.ok(Object.isFrozen(box) && [box.x, box.y, box.z, box.w, box.h, box.d].every(Number.isFinite));
      assert.ok(Math.min(box.w, box.h, box.d) > 0);
      assert.ok(box.x >= map.bounds.minX && box.x + box.w <= map.bounds.maxX
        && box.z >= map.bounds.minZ && box.z + box.d <= map.bounds.maxZ);
      assert.ok(map.landmarks.some(mark => (mark.colliderIds || mark.collisionIds || []).includes(box.id)),
        `${box.id}: authored material art describes a genuine solid`);
      assert.ok(!base.colliders.some(old => old.y < box.y + box.h && old.y + old.h > box.y
        && old.x < box.x + box.w && old.x + old.w > box.x && old.z < box.z + box.d && old.z + old.d > box.z),
      `${box.id}: new supplies do not intersect old buildings or climbing solids`);
    }
    const meshes = mapMeshes(map), vertices = (meshes.opaque.length + meshes.shadows.length) / 10;
    assert.ok(vertices < 100000, `${vertices}: original static vertex budget`);
    assert.ok(meshes.opaque.every(Number.isFinite) && meshes.shadows.every(Number.isFinite));
  });

  test(`${label}: original doors, loot, objectives, spawn clearings and high routes keep their standing footprints`, () => {
    for (const point of protectedPoints(map)) {
      assert.ok(navigationCanOccupy(map, point), `${label}: obstructed original ${point.id || JSON.stringify(point)}`);
      assert.ok(navigationCanOccupy(map, point, { radius: .5, height: WORLD.standHeight }),
        `${label}: a wider body still fits ${point.id || JSON.stringify(point)}`);
    }
    // Region anchors are label locations; Crownfall's existing orchard label
    // sits inside an old delivery prop. Preserve their original occupancy
    // instead of treating every decorative label as a gameplay spawn.
    const base = { ...map, colliders: map.colliders.filter(box => !sparse(map).includes(box)) };
    for (const region of map.regions || []) assert.equal(navigationCanOccupy(map, region.anchor),
      navigationCanOccupy(base, region.anchor), `${region.id}: preserve original district label occupancy`);
    for (const box of sparse(map)) {
      const approaches = faces(box).filter(({ point }) => navigationCanOccupy(map, point, { radius: .5, height: WORLD.standHeight }));
      assert.ok(approaches.length >= 2, `${box.id}: fight around at least two open sides`);
      for (const { point } of approaches) assert.ok(navigationPath(map, spawn(map), point).length,
        `${box.id}: supplies stay on the connected ground route`);
    }
  });

  test(`${label}: the shown obstacle stops bullets and bodies while its immediate upper edge stays open`, () => {
    for (const box of sparse(map)) {
      const { point, direction } = faces(box).find(({ point }) => navigationCanOccupy(map, point));
      const origin = { ...point, y: box.h / 2 };
      const hit = traceShot({ map, players: [] }, -1, origin, direction, 1);
      assert.equal(hit.colliderId, box.id, `${box.id}: exact physical bullet cover`);
      assert.equal(traceShot({ map, players: [] }, -1, { ...origin, y: box.h + .06 }, direction, 1).kind, 'none',
        `${box.id}: no invisible cover above the shown top`);
      assert.equal(navigationCanOccupy(map, { x: box.x + box.w / 2, y: 0, z: box.z + box.d / 2 }), false,
        `${box.id}: cannot walk through the visible prop`);
    }
  });

  test(`${label}: a player carrying the slowest gun can jump onto the new low supplies`, () => {
    for (const box of sparse(map).filter(box => box.h <= .84)) {
      const landing = { x: box.x + box.w / 2, y: box.h, z: box.z + box.d / 2 };
      assert.ok(navigationCanOccupy(map, landing), `${box.id}: complete standing headroom on top`);
      const { point } = faces(box).find(({ point }) => navigationCanOccupy(map, point));
      const player = Object.assign(createCombatPlayer(99, 1, heavy.id), point);
      let jumped = false;
      for (let tick = 0; tick < 300; tick++) {
        const dx = landing.x - player.x, dz = landing.z - player.z, gap = Math.hypot(dx, dz);
        const input = emptyInput({ yaw: Math.atan2(dx, -dz) });
        input.up = gap > .13;
        input.jump = !jumped;
        jumped = true;
        predictLocalMovement(player, input, map);
        assert.ok(navigationCanOccupy(map, player), `${box.id}: swept jump respects actual solids`);
        if (player.grounded && Math.abs(player.y - landing.y) < .03 && gap < .16) break;
      }
      assert.ok(player.grounded && Math.abs(player.y - landing.y) < .03,
        `${box.id}: stable real jump landing at ${JSON.stringify({ x: player.x, y: player.y, z: player.z })}`);
      assert.ok(Math.hypot(player.x - landing.x, player.z - landing.z) < .2, `${box.id}: player reaches the shown platform centre`);
    }
  });
}
