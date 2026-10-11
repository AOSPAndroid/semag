import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS as BREACH_MAPS } from '../public/voxel-maps.js';
import { MAPS as ROYALE_MAPS } from '../public/voxel-royale-maps.js';
import { WORLD, createCombatPlayer, emptyInput, findNearbyLoot, predictLocalMovement, traceShot } from '../public/voxel-engine.js';
import { navigationCanOccupy } from '../public/voxel-navigation.js';
import { grenadeBlastHits, sweepSphereBox } from '../public/voxel-ordnance.js';

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < .006, `${message}: ${actual} != ${expected}`);
const propsFor = (map, building) => map.colliders.filter(box => box.shopRoom === building.id);
const center = building => ({ x: (building.interior.minX + building.interior.maxX) / 2, y: 0,
  z: (building.interior.minZ + building.interior.maxZ) / 2 });

/** A room-only standing-floor flood fill. Mid-edge occupancy also matters:
 * connected sample centres cannot permit slipping diagonally through cover. */
function connectedRoomFloor(map, building) {
  const cell = .25, inset = WORLD.radius + .01, room = building.interior;
  const width = Math.floor((room.maxX - room.minX - inset * 2) / cell) + 1;
  const depth = Math.floor((room.maxZ - room.minZ - inset * 2) / cell) + 1;
  const point = index => ({ x: room.minX + inset + index % width * cell, y: 0,
    z: room.minZ + inset + Math.floor(index / width) * cell });
  const allowed = Uint8Array.from({ length: width * depth }, (_, index) => Number(navigationCanOccupy(map, point(index))));
  const nearest = target => {
    assert.ok(navigationCanOccupy(map, target), `${building.id}: standing access at ${JSON.stringify(target)}`);
    let chosen = -1, best = Infinity;
    for (let index = 0; index < allowed.length; index++) if (allowed[index]) {
      const candidate = point(index), gap = Math.hypot(candidate.x - target.x, candidate.z - target.z);
      if (gap < best && navigationCanOccupy(map, { x: (candidate.x + target.x) / 2, y: 0, z: (candidate.z + target.z) / 2 })) {
        chosen = index; best = gap;
      }
    }
    assert.ok(best < .26, `${building.id}: floor sample reaches the actual target`);
    return chosen;
  };
  const seen = new Uint8Array(allowed.length), origin = nearest(building.doorways[0].inside), queue = [origin]; seen[origin] = 1;
  for (let at = 0; at < queue.length; at++) {
    const index = queue[at], xx = index % width, zz = Math.floor(index / width), from = point(index);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (xx + dx < 0 || xx + dx >= width || zz + dz < 0 || zz + dz >= depth) continue;
      const next = index + dx + dz * width, target = point(next);
      if (!allowed[next] || seen[next] || !navigationCanOccupy(map, { x: (from.x + target.x) / 2, y: 0, z: (from.z + target.z) / 2 })) continue;
      seen[next] = 1; queue.push(next);
    }
  }
  return target => assert.equal(seen[nearest(target)], 1, `${building.id}: floor route reaches ${JSON.stringify(target)} without a jump`);
}

for (const [mode, map] of [['Breach', BREACH_MAPS.paris], ['Royale', ROYALE_MAPS.paris]]) {
  test(`${mode} Paris shops have distinct solid furnishings without crowding their full doorway lanes`, () => {
    const identities = new Set();
    assert.ok(map.colliders.length <= 128, 'furnishing stays within the original Paris collision budget');
    for (const building of map.buildings) {
      const props = propsFor(map, building), room = building.interior, middle = center(building);
      assert.ok(props.length >= 4, `${building.id}: a furnished room`);
      assert.deepEqual(new Set(building.interiorPropIds), new Set(props.map(box => box.id)));
      assert.ok(Object.isFrozen(building.interiorPropIds));
      identities.add(props.map(box => box.shopProp).sort().join(':'));
      for (const box of props) {
        assert.ok(Object.isFrozen(box) && box.material === 'paris-shop' && box.shopProp);
        assert.ok(box.x >= room.minX && box.x + box.w <= room.maxX && box.z >= room.minZ && box.z + box.d <= room.maxZ, `${box.id}: inside its room`);
        assert.ok(box.y >= 0 && box.y + box.h < building.facade.wallHeight, `${box.id}: below the real ceiling`);
      }
      for (let z = room.minZ + .4; z <= room.maxZ - .4; z += .2) for (const dx of [-.85, 0, .85]) {
        assert.ok(navigationCanOccupy(map, { x: middle.x + dx, y: 0, z }), `${building.id}: the original door-width lane remains open`);
      }
    }
    assert.equal(identities.size, 4, 'each shop contains a different useful furniture set');
  });

  test(`${mode} Paris side aisles and supply corners remain connected to both shop doors on standing floor`, () => {
    for (const building of map.buildings) {
      const reachable = connectedRoomFloor(map, building), room = building.interior;
      reachable(building.doorways[1].inside); reachable(center(building));
      const targets = (map.lootPoints || []).filter(item => item.y === 0 && item.x > room.minX && item.x < room.maxX && item.z > room.minZ && item.z < room.maxZ);
      for (const target of targets) {
        reachable(target);
        const player = Object.assign(createCombatPlayer(0), target), item = { ...target, id: 1, weapon: 'carbine', amount: 20 };
        const state = { phase: 'fight', players: [player], loot: [item], map };
        assert.equal(findNearbyLoot(state, 0)?.id, item.id, `${target.id}: real pickup visibility from the reachable floor`);
      }
      if (mode === 'Royale') for (const suffix of ['supply', 'medicine', 'ammunition', 'hidden']) {
        assert.ok(targets.some(target => target.id === `${building.id}-${suffix}`), `${building.id}: existing ${suffix} corner retained`);
      }
    }
  });

  test(`${mode} Paris furniture stops movement and shots on the same surfaces used as room cover`, () => {
    for (const building of map.buildings) {
      const props = propsFor(map, building), middle = center(building);
      for (const box of props) {
        const side = box.x + box.w / 2 < middle.x ? 1 : -1;
        const origin = { x: side > 0 ? box.x + box.w + .6 : box.x - .6, y: box.y + box.h / 2, z: box.z + box.d / 2 };
        const hit = traceShot({ map, players: [] }, 0, origin, { x: -side, y: 0, z: 0 }, box.w + 1.2);
        assert.equal(hit.kind, 'wall', `${box.id}: real shot cover`);
        assert.equal(hit.colliderId, box.id, `${box.id}: painted cover matches the first physical surface`);
      }
      const box = props.find(prop => ['coffee-counter', 'workbench', 'book-display', 'ticket-counter'].includes(prop.shopProp));
      const side = box.x + box.w / 2 < middle.x ? 1 : -1;
      const player = Object.assign(createCombatPlayer(0), { x: middle.x, z: box.z + box.d / 2 });
      assert.ok(navigationCanOccupy(map, player));
      for (let tick = 0; tick < 360; tick++) predictLocalMovement(player, { ...emptyInput(player), up: true, walk: true, yaw: side > 0 ? -Math.PI / 2 : Math.PI / 2 }, map);
      near(player.x, side > 0 ? box.x + box.w + WORLD.radius : box.x - WORLD.radius, `${box.id}: movement meets visible cover`);
      near(player.y, 0, 'furniture does not auto-climb');
    }
  });

  test(`${mode} Paris bistro tables have a real tabletop and pedestal with usable clearance beneath`, () => {
    const top = map.colliders.find(box => box.shopProp === 'bistro-top'), base = map.colliders.find(box => box.shopProp === 'bistro-base');
    assert.ok(top && base); near(base.y + base.h, top.y, 'pedestal supports the tabletop');
    const x = top.x + .16, origin = { x, y: .35, z: top.z - .6 }, direction = { x: 0, y: 0, z: 1 };
    const low = traceShot({ map, players: [] }, 0, origin, direction, top.d + 1.1);
    assert.equal(low.kind, 'none', 'low shots pass through the visible gap beside the pedestal');
    const slab = traceShot({ map, players: [] }, 0, { ...origin, y: top.y + top.h / 2 }, direction, top.d + 1.1);
    assert.equal(slab.colliderId, top.id, 'a shot at tabletop height hits the slab');
    assert.equal(sweepSphereBox(origin, { x: 0, y: 0, z: top.d + 1.1 }, top), null, 'low grenades fit beneath the slab');
    assert.ok(sweepSphereBox({ ...origin, x: base.x + base.w / 2 }, { x: 0, y: 0, z: top.d + 1.1 }, base), 'the pedestal still catches grenades');
    const player = Object.assign(createCombatPlayer(0), { x: top.x - 1, z: top.z + top.d / 2 });
    for (let tick = 0; tick < 150; tick++) predictLocalMovement(player, { ...emptyInput(player), up: true, walk: true, yaw: Math.PI / 2 }, map);
    near(player.x, top.x - WORLD.radius, 'the tabletop blocks standing movement at its exact edge');

    const cabinet = map.colliders.find(box => box.shopProp === 'tool-cabinet');
    const protectedPlayer = Object.assign(createCombatPlayer(0), { x: cabinet.x - .55, z: cabinet.z + cabinet.d / 2, crouching: true });
    const grenade = { x: cabinet.x + cabinet.w + .2, y: .6, z: protectedPlayer.z, playerId: 2, team: 1 };
    assert.equal(grenadeBlastHits({ players: [protectedPlayer] }, grenade, map).length, 0, 'closed cabinets shield every crouched body sample');
    assert.equal(grenadeBlastHits({ players: [protectedPlayer] }, grenade, { ...map, colliders: [] }).length, 1, 'the same unprotected body lies inside the blast');
  });
}
