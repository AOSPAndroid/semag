import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS as BREACH_MAPS } from '../public/voxel-maps.js';
import { MAPS as ROYALE_MAPS } from '../public/voxel-royale-maps.js';
import { WORLD, createCombatPlayer, createState, emptyInput, predictLocalMovement, traceShot } from '../public/voxel-engine.js';
import { grenadeBlastHits } from '../public/voxel-ordnance.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const clearFloor = (arena, p) => !arena.colliders.some(box => box.y < WORLD.standHeight && box.y + box.h > 0
  && Math.hypot(p.x - Math.max(box.x, Math.min(p.x, box.x + box.w)), p.z - Math.max(box.z, Math.min(p.z, box.z + box.d))) < WORLD.radius + .025);

function walk(player, arena, target) {
  for (let tick = 0; tick < 900; tick++) {
    const dx = target.x - player.x, dz = target.z - player.z, distance = Math.hypot(dx, dz);
    if (distance < .11 && Math.hypot(player.vx, player.vz) < .08) break;
    predictLocalMovement(player, { ...emptyInput(player), up: distance > .1, walk: true, yaw: distance > .01 ? Math.atan2(dx, -dz) : player.yaw }, arena);
  }
  assert.ok(Math.hypot(player.x - target.x, player.z - target.z) < .16, `${arena.id} doorway blocked at ${player.x},${player.z}`);
  near(player.y, 0); assert.equal(player.grounded, true); assert.equal(player.crouching, false);
}

test('both Paris charge sites and every two-door interior connect to both squad spawn areas on standing floor', () => {
  const arena = BREACH_MAPS.paris, unit = .5;
  const nx = (arena.bounds.maxX - arena.bounds.minX) / unit + 1, nz = (arena.bounds.maxZ - arena.bounds.minZ) / unit + 1;
  const point = index => ({ x: arena.bounds.minX + index % nx * unit, z: arena.bounds.minZ + Math.floor(index / nx) * unit });
  const allowed = new Uint8Array(nx * nz), seen = new Uint8Array(nx * nz);
  for (let index = 0; index < allowed.length; index++) allowed[index] = Number(clearFloor(arena, point(index)));
  const nearest = p => {
    let chosen = -1, distance = Infinity;
    for (let index = 0; index < allowed.length; index++) if (allowed[index]) {
      const next = point(index), gap = Math.hypot(next.x - p.x, next.z - p.z);
      if (gap < distance && clearFloor(arena, { x: (next.x + p.x) / 2, z: (next.z + p.z) / 2 })) { distance = gap; chosen = index; }
    }
    assert.ok(distance <= .55, `no floor node at ${JSON.stringify(p)}`);
    return chosen;
  };
  const origin = nearest(arena.spawns[0][0]), queue = [origin]; seen[origin] = 1;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head], ix = current % nx, iz = Math.floor(current / nx);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (ix + dx < 0 || ix + dx >= nx || iz + dz < 0 || iz + dz >= nz) continue;
      const next = current + dx + dz * nx, a = point(current), b = point(next);
      if (!allowed[next] || seen[next] || !clearFloor(arena, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 })) continue;
      seen[next] = 1; queue.push(next);
    }
  }
  const destinations = [...arena.spawns.flat(), ...arena.sites, ...arena.routes.map(route => route.start),
    ...arena.buildings.flatMap(building => building.doorways.flatMap(door => [door.inside, door.outside]))];
  for (const destination of destinations) assert.equal(seen[nearest(destination)], 1, `disconnected Paris retake/flank ${JSON.stringify(destination)}`);
  assert.ok(queue.length > 5000, 'Paris retains broad connected ground counterplay');
});

for (const [mode, arena] of [['Breach', BREACH_MAPS.paris], ['Royale', ROYALE_MAPS.paris]]) {
  test(`${mode} Paris: each real shop can be crossed through both doors without crouching or jumping`, () => {
    for (const building of arena.buildings) {
      const [north, south] = building.doorways, player = Object.assign(createCombatPlayer(0), north.outside);
      walk(player, arena, north.inside); walk(player, arena, south.inside); walk(player, arena, south.outside);
      walk(player, arena, south.inside); walk(player, arena, north.inside); walk(player, arena, north.outside);
    }
  });

  test(`${mode} Paris: apartment ceilings share movement, shot and grenade shielding geometry`, () => {
    for (const building of arena.buildings) {
      const deck = arena.colliders.find(box => box.id === building.roofId);
      const x = building.interior.minX + 1.2, z = building.interior.minZ + 1.2;
      const state = createState({ mapId: 'paris' }); state.map = arena;
      const [above, below] = state.players;
      Object.assign(above, { x, y: deck.y + deck.h, z }); Object.assign(below, { x, y: 0, z });
      const down = traceShot(state, above.id, { x, y: above.y + 1.64, z }, { x: 0, y: -1, z: 0 });
      const up = traceShot(state, below.id, { x, y: 1.64, z }, { x: 0, y: 1, z: 0 });
      assert.equal(down.colliderId, deck.id); assert.equal(up.colliderId, deck.id);
      assert.equal(down.kind, 'wall'); assert.equal(up.kind, 'wall');
      const grenade = { x, y: deck.y - .4, z, playerId: below.id, team: below.team };
      assert.equal(grenadeBlastHits({ players: [above] }, grenade, arena).length, 0, 'roof stops grenade damage from the apartment below');
      assert.equal(grenadeBlastHits({ players: [above] }, grenade, { ...arena, colliders: [] }).length, 1, 'the same exposed player would take the blast');
    }
  });
}

test('every Paris firing roof has two different ground approaches and unobstructed 4 m standing landings', () => {
  for (const arena of [BREACH_MAPS.paris, ROYALE_MAPS.paris]) for (const building of arena.buildings) {
    const routes = arena.routes.filter(route => route.steps.at(-1).colliderId === building.roofId);
    assert.equal(routes.length, 2, `${building.id} needs alternative access`);
    assert.ok(Math.hypot(routes[0].start.x - routes[1].start.x, routes[0].start.z - routes[1].start.z) >= 8, 'approaches start on different streets');
    const deck = arena.colliders.find(box => box.id === building.roofId); near(deck.y + deck.h, 4);
    for (const route of routes) {
      const last = route.steps.at(-1);
      assert.ok(last.x > deck.x + WORLD.radius && last.x < deck.x + deck.w - WORLD.radius);
      assert.ok(last.z > deck.z + WORLD.radius && last.z < deck.z + deck.d - WORLD.radius);
    }
  }
});
