import assert from 'node:assert/strict';
import test from 'node:test';
import { createParisMap } from '../public/voxel-paris.js';
import { createSnowMap } from '../public/voxel-snow-map.js';
import { createSewerMap } from '../public/voxel-sewer-map.js';
import { createTradingMap } from '../public/voxel-trading-map.js';
import { WORLD, WEAPONS, createCombatPlayer, emptyInput, predictLocalMovement, traceShot } from '../public/voxel-engine.js';
import { navigationCanOccupy, navigationPath } from '../public/voxel-navigation.js';

const builders = { paris: createParisMap, snow: createSnowMap, sewers: createSewerMap, trading: createTradingMap };
const heavy = Object.values(WEAPONS).reduce((slow, gun) => gun.speed < slow.speed ? gun : slow);
const profiles = [{ name: 'heavy human', actor: {} }, { name: 'hound', actor: { monster: true, human: false, monsterType: 'hound' } }];

/** Follow the production planner and swept physics; graph connectivity alone is insufficient. */
function travel(map, from, destination, profile, label) {
  const player = Object.assign(createCombatPlayer(99, 1, heavy.id), from, profile.actor, { y: from.y || 0, vx: 0, vy: 0, vz: 0, grounded: true });
  player.previousInput = emptyInput(player);
  assert.ok(navigationCanOccupy(map, player), `${label}: clear start`);
  const path = navigationPath(map, player, destination);
  assert.ok(path.length, `${label}: connected path`);
  let waypoint = 0, jumps = 0;
  for (let tick = 0; tick < 4800 && waypoint < path.length; tick++) {
    const target = path[waypoint], dx = target.x - player.x, dz = target.z - player.z;
    const gap = Math.hypot(dx, dz);
    if (gap < .22 && Math.abs(target.y - player.y) < .04 && player.grounded) { waypoint++; continue; }
    const input = emptyInput({ yaw: Math.atan2(dx, -dz) });
    input.up = gap > .1; input.walk = target.y < player.y - .1;
    input.jump = target.jump && player.grounded && player.y < target.y - .1 && !player.previousInput.jump;
    if (input.jump) jumps++;
    predictLocalMovement(player, input, map);
    assert.ok(navigationCanOccupy(map, player), `${label}: no solid-body overlap`);
  }
  assert.equal(waypoint, path.length, `${label}: stuck at ${JSON.stringify({ x: player.x, y: player.y, z: player.z })}`);
  assert.ok(player.grounded && Math.abs(player.y - (destination.y || 0)) < .04, `${label}: supported final floor`);
  assert.ok(Math.hypot(player.x - destination.x, player.z - destination.z) < .25, `${label}: correct final footprint`);
  return { player, jumps };
}

for (const mode of ['breach', 'royale']) for (const [id, build] of Object.entries(builders)) {
  const map = build(mode);
  test(`${mode}/${id}: every physical solid has finite positive dimensions inside the authored world`, () => {
    assert.equal(new Set(map.colliders.map(box => box.id)).size, map.colliders.length, 'unique physical IDs');
    for (const box of map.colliders) {
      for (const field of ['x', 'y', 'z', 'w', 'h', 'd']) assert.ok(Number.isFinite(box[field]), `${id}/${box.id}/${field}: finite geometry`);
      for (const field of ['w', 'h', 'd']) assert.ok(box[field] > 0, `${id}/${box.id}/${field}: positive physical dimension`);
      if (/^(wall|boundary)-/.test(box.id)) continue;
      assert.ok(box.x >= map.bounds.minX - 1e-7 && box.x + box.w <= map.bounds.maxX + 1e-7, `${id}/${box.id}: complete horizontal bounds`);
      assert.ok(box.z >= map.bounds.minZ - 1e-7 && box.z + box.d <= map.bounds.maxZ + 1e-7, `${id}/${box.id}: complete depth bounds`);
    }
  });

  test(`${mode}/${id}: authored upper circuit physically connects all wings and both escape routes`, () => {
    const floor = map.upperFloors[0], routes = floor.routeIds.map(id => map.routes.find(route => route.id === id));
    assert.ok(map.authoredLayout && Object.isFrozen(map.upperFloors));
    assert.ok(routes.length >= 4 && floor.traverse.length >= 4);
    for (const profile of profiles) {
      let current = routes[0].start, totalJumps = 0;
      for (const target of floor.traverse) {
        const reached = travel(map, current, target, profile, `${mode}/${id}/${profile.name}`);
        current = reached.player; totalJumps += reached.jumps;
      }
      assert.ok(totalJumps >= 4, 'high ground is earned by real consecutive jumps');
      travel(map, current, routes.at(-1).start, profile, `${mode}/${id}/${profile.name}/alternate escape`);
      for (const underpass of floor.underpasses) travel(map, routes[0].start, underpass, profile, `${mode}/${id}/${profile.name}/ground underpass`);
    }
  });

  test(`${mode}/${id}: authored small obstacles support actual jumps and retain every spawn and supply`, () => {
    assert.equal(map.jumpCover.length, 6); assert.equal(map.hopRoutes.length, 3);
    for (const point of [...map.spawns?.flat() || map.spawnPoints, ...map.sites, ...map.lootPoints || []]) {
      assert.ok(navigationCanOccupy(map, point), `${id}/${point.id || 'spawn'}: legal footprint`);
      assert.ok(navigationPath(map, (map.spawns?.flat() || map.spawnPoints)[0], point).length, 'connected start or supply');
    }
    for (const profile of profiles) for (const chain of map.hopRoutes) {
      let current = chain.start;
      for (const target of chain.steps) {
        const result = travel(map, current, target, profile, `${id}/${chain.id}/${profile.name}`);
        assert.ok(result.jumps > 0, 'obstacle reached through a jump'); current = result.player;
      }
      travel(map, current, chain.end, profile, `${id}/${chain.id}/${profile.name}/exit`);
    }
  });
}

test('different universes have distinct substantial playable second-floor shapes', () => {
  const maps = Object.values(builders).map(build => build('breach'));
  const area = map => map.upperFloors[0].colliderIds.map(id => map.colliders.find(box => box.id === id)).reduce((sum, box) => sum + box.w * box.d, 0);
  assert.ok(area(maps.find(map => map.id === 'trading')) > 400, 'office has a full working second floor around an atrium');
  assert.ok(area(maps.find(map => map.id === 'paris')) > 400, 'rooftop rotation is a connected district');
  const signatures = maps.map(map => new Set(map.colliders.map(box => [box.x, box.y, box.z, box.w, box.h, box.d].join(':'))));
  for (let a = 0; a < maps.length; a++) for (let b = a + 1; b < maps.length; b++) {
    const identical = [...signatures[a]].filter(key => signatures[b].has(key)).length;
    assert.ok(identical / Math.min(signatures[a].size, signatures[b].size) < .2, 'layout uniqueness is independent of asset colours');
  }
});

test('enclosed snow skybridge and sewer service duct shield shots while keeping real standing headroom', () => {
  for (const [build, deckId, roofId, x, z, feet] of [
    [createSnowMap, 'snow-research-gallery', 'snow-enclosed-gallery-ceiling', 0, -.5, 4],
    [createSewerMap, 'sewers-service-duct-floor', 'sewers-upper-service-link-ceiling', -12, -8.7, 3.2],
  ]) {
    const map = build('breach'), roof = map.colliders.find(box => box.id === roofId), deck = map.colliders.find(box => box.id === deckId);
    assert.ok(roof.y - feet > WORLD.standHeight + WORLD.jumpSpeed ** 2 / (2 * WORLD.gravity));
    assert.ok(navigationCanOccupy(map, { x, y: feet, z }));
    const up = traceShot({ map, players: [] }, -1, { x, y: feet + WORLD.eyeHeight, z }, { x: 0, y: 1, z: 0 });
    const down = traceShot({ map, players: [] }, -1, { x, y: feet + WORLD.eyeHeight, z }, { x: 0, y: -1, z: 0 });
    assert.equal(up.colliderId, roof.id); assert.equal(down.colliderId, deck.id);
  }
});

test('Barclays signs attach to real inward wall faces and do not occupy the floor or doors', () => {
  for (const mode of ['breach', 'royale']) {
    const map = createTradingMap(mode), signs = map.decorations.filter(value => value.kind === 'wall-sign');
    assert.ok(signs.length >= 3);
    for (const sign of signs) {
      const wall = map.colliders.find(box => box.id === sign.colliderId);
      assert.ok(wall && sign.label === 'BARCLAYS' && sign.emblem === 'barclays');
      assert.ok(sign.bottom >= 0 && sign.bottom + sign.h <= wall.h);
      assert.ok(sign.left >= 0 && sign.left + sign.w <= (['north', 'south'].includes(sign.face) ? wall.w : wall.d));
    }
  }
});
