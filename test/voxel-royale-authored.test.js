import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTHORED_ROYALE_MAPS } from '../public/voxel-royale-authored.js';
import { MAPS, createState, startMatch, step, emptyInput, ROYALE } from '../public/voxel-royale-engine.js';
import { navigationCanOccupy, navigationPath } from '../public/voxel-navigation.js';

test('woodland, labyrinth and Egyptian reserves own genuinely different floor plans and connected storeys', () => {
  const maps = Object.values(AUTHORED_ROYALE_MAPS);
  // Colour/material swaps cannot satisfy this geometry-only comparison.
  const signatures = maps.map(map => JSON.stringify(map.colliders.map(({ x, y, z, w, h, d }) => [x, y, z, w, h, d])));
  assert.equal(new Set(signatures).size, 3);
  for (const map of maps) {
    assert.strictEqual(MAPS[map.id], map, 'catalog uses the authored map directly, without adding old generic layers');
    assert.ok(map.upperFloors[0].colliderIds.length >= 4 && map.upperFloors[0].routeIds.length >= 4);
    assert.ok(new Set(map.buildings.map(room => `${room.interior.maxX - room.interior.minX}:${room.interior.maxZ - room.interior.minZ}`)).size >= 4,
      `${map.id}: shelters have varied footprints, rather than cloned corner rooms`);
    const supports = map.upperFloors[0].colliderIds.map(id => map.colliders.find(box => box.id === id));
    assert.ok(supports.reduce((sum, box) => sum + box.w * box.d, 0) > 380, `${map.id}: substantial second-storey playable area`);
    assert.ok(map.colliders.length <= 200, `${map.id}: bounded solid geometry`);
    assert.ok(map.lootPoints.length <= ROYALE.maxLoot);
  }
  assert.ok(AUTHORED_ROYALE_MAPS.forest.colliders.some(box => box.id === 'firewatch-tower' && box.y + box.h === 5.04));
  assert.ok(AUTHORED_ROYALE_MAPS.maze.colliders.filter(box => box.id.startsWith('maze-labyrinth-wall-')).length >= 15);
  assert.ok(AUTHORED_ROYALE_MAPS.desert.colliders.filter(box => box.id.startsWith('temple-column-')).length >= 20);
});

for (const mapId of Object.keys(AUTHORED_ROYALE_MAPS)) {
  test(`${mapId}: an actual knife-only spawn reaches and loots an elevated weapon through real movement`, () => {
    const state = createState({ mapId, seed: 1681 });
    startMatch(state, [0, 1]);
    while (state.phase === 'countdown') step(state);
    const player = state.players[0];
    assert.equal(player.hasGun, false);
    const candidates = state.loot.filter(item => item.kind === 'weapon' && item.y > 3);
    candidates.sort((a, b) => Math.hypot(player.x - a.x, player.z - a.z) - Math.hypot(player.x - b.x, player.z - b.z));
    assert.ok(candidates.length);
    const target = candidates[0], path = navigationPath(state.map, player, target);
    assert.ok(path.length, 'actual spawned player has a route to a seeded high cache');
    let waypoint = 0, jumps = 0;
    for (let tick = 0; tick < 6000 && waypoint < path.length; tick++) {
      const next = path[waypoint], dx = next.x - player.x, dz = next.z - player.z, gap = Math.hypot(dx, dz);
      if (gap < .22 && Math.abs(player.y - next.y) < .04 && player.grounded) { waypoint++; continue; }
      // Deliberate walking keeps the knife's faster strafe from overshooting a
      // small intermediate landing; no test-only movement or teleport is used.
      const input = { ...emptyInput(player), up: gap > .1, yaw: Math.atan2(dx, -dz), walk: true,
        jump: Boolean(next.jump && player.grounded && player.y < next.y - .1 && !player.previousInput.jump) };
      jumps += Number(input.jump);
      step(state, [input]);
      assert.equal(state.phase, 'fight');
      assert.ok(navigationCanOccupy(state.map, player), 'real body stays clear of solid geometry');
    }
    assert.equal(waypoint, path.length, `${mapId}: physical player follows the route to the cache; pose ${JSON.stringify({ x: player.x, y: player.y, z: player.z })}, next ${JSON.stringify(path[waypoint])}`);
    assert.ok(jumps >= 4, 'looting high ground requires genuine successive jumps');
    assert.ok(player.grounded && player.y >= 3.36 - 1e-6);
    step(state, [{ ...emptyInput(player), interact: true }]);
    assert.equal(player.hasGun, true);
    assert.equal(player.weapon, target.weapon);
    assert.ok(!state.loot.some(item => item.id === target.id), 'finite cache is consumed by actual E pickup');
    assert.ok(state.events.some(event => event.type === 'lootPickup' && event.playerId === 0 && event.lootId === target.id));
    assert.ok(player.hp > 0);
  });
}
