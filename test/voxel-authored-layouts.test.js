import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS } from '../public/voxel-maps.js';
import { createCloseCombatMap } from '../public/voxel-close-combat-maps.js';
import { WORLD, WEAPONS, createCombatPlayer, emptyInput, predictLocalMovement, rayBox } from '../public/voxel-engine.js';
import { navigationCanOccupy, navigationPath, navigationVisible } from '../public/voxel-navigation.js';
import { MONSTER_BODIES } from '../public/voxel-monster-bodies.js';

const ids = ['courtyard', 'depot', 'canal', 'rooftops', 'foundry', 'bastion', 'market', 'lockdown'];
const arenas = [...ids.map(id => MAPS[id]), ...['market', 'lockdown'].map(id => createCloseCombatMap(id, 'royale'))];
const heavy = Object.values(WEAPONS).reduce((slow, weapon) => weapon.speed < slow.speed ? weapon : slow);
const profiles = [{ name: 'heavy player', actor: {}, radius: WORLD.radius },
  { name: 'hound', actor: { monster: true, human: false, monsterType: 'hound' }, radius: MONSTER_BODIES.hound.radius }];
const EPS = 1e-6;

function supported(arena, point, radius = WORLD.radius) {
  return Math.abs(point.y || 0) < EPS || arena.colliders.some(box => Math.abs(box.y + box.h - point.y) < EPS
    && point.x >= box.x + radius - EPS && point.x <= box.x + box.w - radius + EPS
    && point.z >= box.z + radius - EPS && point.z <= box.z + box.d - radius + EPS);
}

function travel(arena, from, to, profile) {
  const player = Object.assign(createCombatPlayer(98, 1, heavy.id), from, profile.actor,
    { y: from.y || 0, vx: 0, vy: 0, vz: 0, grounded: true, radius: profile.radius });
  player.previousInput = emptyInput(player);
  const path = navigationPath(arena, player, to);
  assert.ok(path.length, `${arena.id}: real route from ${JSON.stringify(from)} to ${JSON.stringify(to)}`);
  let index = 0, jumps = 0;
  for (let tick = 0; tick < 4200 && index < path.length; tick++) {
    const next = path[index], dx = next.x - player.x, dz = next.z - player.z, distance = Math.hypot(dx, dz);
    if (distance < .22 && Math.abs(next.y - player.y) < .04 && player.grounded) { index++; continue; }
    const input = emptyInput({ yaw: Math.atan2(dx, -dz) });
    input.up = distance > .1; input.walk = next.y < player.y - .1;
    input.jump = next.jump && player.grounded && player.y < next.y - .1 && !player.previousInput.jump;
    if (input.jump) jumps++;
    predictLocalMovement(player, input, arena);
    assert.ok(navigationCanOccupy(arena, player), `${arena.id}/${profile.name}: movement stays outside solids`);
  }
  assert.equal(index, path.length, `${arena.id}/${profile.name}: physical route completed`);
  assert.ok(player.grounded && Math.abs(player.y - (to.y || 0)) < .04 && supported(arena, player, profile.radius), `${arena.id}: stable supported landing`);
  return { player, jumps };
}

test('the eight authored floor plans are different without considering colors, names or materials', () => {
  const masks = ids.map(id => {
    const arena = MAPS[id], result = [];
    for (const y of [0, 3.2]) for (let z = -20; z <= 20; z += 2) for (let x = -23; x <= 23; x += 2)
      result.push(navigationCanOccupy(arena, { x, y, z }) && supported(arena, { x, y, z }));
    return result;
  });
  for (let first = 0; first < ids.length; first++) for (let second = first + 1; second < ids.length; second++) {
    const different = masks[first].filter((value, index) => value !== masks[second][index]).length;
    assert.ok(different >= 55, `${ids[first]} and ${ids[second]} need substantially different ground/second-floor routes (${different} cells differ)`);
  }
});

test('authored start cover prevents an immediate opposing squad headshot on every core arena', () => {
  for (const id of ids) for (const attacker of MAPS[id].spawns[0]) for (const defender of MAPS[id].spawns[1])
    assert.equal(navigationVisible(MAPS[id], { ...attacker, y: 1.64 }, { ...defender, y: 1.64 }), false,
      `${id}: players must move to earn their opening firing angle`);
});

for (const arena of arenas) {
  const name = `${arena.mode || 'breach'}/${arena.id}`;
  test(`${name}: second-floor networks have substantial playable area and clear standing underpasses`, () => {
    assert.equal(arena.authoredLayout, true);
    const decks = new Set(arena.upperFloors.flatMap(floor => floor.colliderIds));
    let area = 0;
    for (let z = arena.bounds.minZ + .5; z < arena.bounds.maxZ; z++) for (let x = arena.bounds.minX + .5; x < arena.bounds.maxX; x++)
      if (arena.colliders.some(box => decks.has(box.id) && x >= box.x + WORLD.radius && x <= box.x + box.w - WORLD.radius
        && z >= box.z + WORLD.radius && z <= box.z + box.d - WORLD.radius && navigationCanOccupy(arena, { x, y: box.y + box.h, z }))) area++;
    assert.ok(area >= 85, `${name}: a real floor, rather than a tiny recolored perch (${area}m²)`);
    for (const floor of arena.upperFloors) {
      assert.ok(new Set(floor.routeIds).size >= 2, `${floor.id}: contestable from alternate approaches`);
      for (const point of floor.underpasses) {
        assert.ok(navigationCanOccupy(arena, point), `${floor.id}: standing ground footprint`);
        assert.ok(floor.colliderIds.some(id => { const box = arena.colliders.find(value => value.id === id);
          return box.y >= WORLD.standHeight + .6 && point.x > box.x && point.x < box.x + box.w && point.z > box.z && point.z < box.z + box.d; }), `${floor.id}: genuinely beneath its visible solid ceiling`);
      }
    }
  });

  test(`${name}: shipped heavy and hound movement can use every rise, cross the roof network and escape below`, () => {
    for (const profile of profiles) {
      for (const route of arena.routes) {
        const last = route.steps.at(-1), box = arena.colliders.find(value => value.id === last.colliderId), end = { x: last.x, y: box.y + box.h, z: last.z };
        const { jumps } = travel(arena, route.start, end, profile);
        assert.ok(jumps >= 4, `${route.id}/${profile.name}: four physically successful jumps`);
        travel(arena, end, route.start, profile);
      }
      for (const floor of arena.upperFloors) {
        let from = arena.routes.find(route => route.id === floor.routeIds[0]).start;
        for (const target of floor.traverse) from = travel(arena, from, target, profile).player;
        const escape = arena.routes.find(route => route.id === floor.routeIds.at(-1)).start;
        travel(arena, from, escape, profile);
      }
    }
  });

  test(`${name}: gameplay starts, objectives, opposed shop doors and supplies remain reachable`, () => {
    const starts = arena.spawns?.flat() || arena.spawnPoints;
    const targets = [...starts, ...arena.sites, ...(arena.lootPoints || []), ...arena.routes.map(route => route.start),
      ...arena.buildings.flatMap(building => building.doorways.flatMap(door => [door.inside, door.outside]))];
    for (const point of targets) {
      assert.ok(navigationCanOccupy(arena, point) && supported(arena, point), `${name}/${point.id || JSON.stringify(point)}: supported clear gameplay point`);
      assert.ok(navigationPath(arena, starts[0], point).length, `${name}: connected ground and supply access`);
    }
  });

  test(`${name}: individually placed small cover is jumpable and shares real body/shot surfaces`, () => {
    assert.ok(arena.hopRoutes.length >= 2 && arena.jumpCover.length >= 4);
    for (const item of arena.jumpCover) {
      const box = arena.colliders.find(value => value.id === item.colliderId);
      assert.ok(box && arena.coverIds.includes(box.id), `${name}: cover collider is shared`);
      assert.ok(item.approaches.every(point => navigationCanOccupy(arena, point)), `${name}: ground approaches stay open`);
      for (const from of item.approaches) travel(arena, from, item.landing, profiles[0]);
      const origin = { x: box.x + box.w / 2, y: box.y + box.h / 2, z: box.z - 1 };
      assert.ok(rayBox(origin, { x: 0, y: 0, z: 1 }, box, 3) !== null, `${name}: visible low obstacle blocks the same bullet ray`);
    }
  });
}
