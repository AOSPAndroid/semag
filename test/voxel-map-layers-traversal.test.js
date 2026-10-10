import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS as BREACH } from '../public/voxel-maps.js';
import { MAPS as ROYALE } from '../public/voxel-royale-maps.js';
import { WORLD, WEAPONS, createCombatPlayer, emptyInput, predictLocalMovement } from '../public/voxel-engine.js';
import { navigationCanOccupy, navigationPath, navigationPoints } from '../public/voxel-navigation.js';
import { MONSTER_BODIES } from '../public/voxel-monster-bodies.js';
import * as Horde from '../public/voxel-horde-engine.js';

const EPS = 1e-6;
const heaviest = Object.values(WEAPONS).reduce((slow, weapon) => weapon.speed < slow.speed ? weapon : slow);
const hound = Object.freeze({ monster: true, human: false, monsterType: 'hound' });
const profiles = Object.freeze([
  { name: 'heavy human', actor: {}, body: { radius: WORLD.radius, height: WORLD.standHeight } },
  { name: 'hound', actor: hound, body: MONSTER_BODIES.hound },
]);

function supported(map, point, radius = WORLD.radius) {
  return Math.abs(point.y || 0) < EPS || map.colliders.some(box => Math.abs(box.y + box.h - point.y) < EPS
    && point.x >= box.x + radius - EPS && point.x <= box.x + box.w - radius + EPS
    && point.z >= box.z + radius - EPS && point.z <= box.z + box.d - radius + EPS);
}

// Follow the public planner with the real 120 Hz swept movement. A graph link
// alone does not prove a slow, armed player can physically land on a new floor.
function follow(map, from, target, profile, label) {
  const player = Object.assign(createCombatPlayer(99, 1, heaviest.id), from, profile.actor,
    { y: from.y || 0, vx: 0, vy: 0, vz: 0, grounded: true, radius: profile.body.radius });
  player.previousInput = emptyInput(player);
  assert.ok(navigationCanOccupy(map, player), `${label}: clear starting body`);
  const path = navigationPath(map, player, target);
  assert.ok(path.length, `${label}: no navigable route to ${JSON.stringify(target)}`);
  let waypoint = 0, jumps = 0;
  for (let tick = 0; tick < 4200 && waypoint < path.length; tick++) {
    const point = path[waypoint], dx = point.x - player.x, dz = point.z - player.z, gap = Math.hypot(dx, dz);
    if (gap < .22 && Math.abs(point.y - player.y) < .04 && player.grounded) { waypoint++; continue; }
    const input = emptyInput({ yaw: Math.atan2(dx, -dz) });
    input.up = gap > .1;
    // Descending feet must leave their current support before falling. Slow
    // deliberate movement proves the ledge can be used without sprinting past
    // a small intermediate terrace and trying to return to it from below.
    input.walk = point.y < player.y - .1;
    input.jump = point.jump && player.grounded && player.y < point.y - .1 && !player.previousInput.jump;
    if (input.jump) jumps++;
    predictLocalMovement(player, input, map);
    assert.ok(navigationCanOccupy(map, player), `${label}: swept body crossed solid geometry`);
    assert.ok(['x', 'y', 'z', 'vx', 'vy', 'vz'].every(key => Number.isFinite(player[key])), `${label}: finite movement`);
  }
  assert.equal(waypoint, path.length, `${label}: stuck at ${waypoint}/${path.length}, body ${JSON.stringify({ x: player.x, y: player.y, z: player.z })}`);
  assert.ok(Math.hypot(player.x - target.x, player.z - target.z) < .25, `${label}: reached target footprint`);
  assert.ok(Math.abs(player.y - (target.y || 0)) < .04, `${label}: reached target floor`);
  assert.ok(player.grounded, `${label}: stable physical landing`);
  return { player, path, jumps };
}

function landing(map, route) {
  const point = route.steps.at(-1), support = map.colliders.find(box => box.id === point.colliderId);
  assert.ok(support, `${map.id}/${route.id}: real final support`);
  return { x: point.x, y: support.y + support.h, z: point.z };
}

for (const [mode, catalog] of [['breach', BREACH], ['royale', ROYALE]]) for (const map of Object.values(catalog)) {
  test(`${mode}/${map.id}: every old and new climb remains physically usable by heavy players and hounds`, () => {
    for (const profile of profiles) {
      const points = navigationPoints(map, profile.actor);
      assert.ok(points.length > 100 && points.length <= 6000, `${profile.name}: bounded cached graph`);
      for (const route of map.routes) {
        const end = landing(map, route), label = `${mode}/${map.id}/${route.id}/${profile.name}`;
        for (const step of route.steps) {
          const support = map.colliders.find(box => box.id === step.colliderId);
          assert.ok(support, `${label}/${step.colliderId}: real intermediate support`);
          const feet = { ...step, y: support.y + support.h, ...profile.actor };
          assert.ok(navigationCanOccupy(map, feet) && supported(map, feet, profile.body.radius), `${label}/${step.colliderId}: unobstructed full intermediate landing`);
        }
        assert.ok(navigationCanOccupy(map, { ...end, ...profile.actor }) && supported(map, end, profile.body.radius), `${label}: full unobstructed endpoint`);
        const ascent = follow(map, route.start, end, profile, `${label}/ascent`);
        assert.ok(ascent.jumps >= 4, `${label}: genuinely reaches another floor through jumps`);
        follow(map, end, route.start, profile, `${label}/escape`);
      }
    }
  });

  test(`${mode}/${map.id}: usable second floors have alternate approaches and actual clear ground underneath`, () => {
    assert.ok(Array.isArray(map.upperFloors) && Object.isFrozen(map.upperFloors) && map.upperFloors.length, `${map.id}: authored upper-floor metadata`);
    for (const floor of map.upperFloors) {
      assert.ok(Object.isFrozen(floor) && floor.name && floor.colliderIds.length, `${floor.id}: named immutable floor`);
      assert.ok(new Set(floor.routeIds).size >= 2, `${floor.id}: multiple approaches`);
      assert.ok(floor.underpasses.length && floor.traverse.length >= 2, `${floor.id}: playable below and above`);
      const supports = floor.colliderIds.map(id => map.colliders.find(box => box.id === id));
      assert.ok(supports.every(Boolean), `${floor.id}: all rendered floors are real colliders`);
      const routes = floor.routeIds.map(id => map.routes.find(route => route.id === id));
      assert.ok(routes.every(Boolean), `${floor.id}: real authored approach routes`);
      for (const point of floor.underpasses) {
        assert.ok(navigationCanOccupy(map, { ...point, y: 0 }), `${floor.id}: full standing underpass`);
        assert.ok(supports.some(box => box.y > WORLD.standHeight && point.x > box.x && point.x < box.x + box.w
          && point.z > box.z && point.z < box.z + box.d), `${floor.id}: ground is genuinely beneath the second floor`);
        for (const profile of profiles) follow(map, routes[0].start, { ...point, y: 0 }, profile, `${floor.id}/${profile.name}/underpass`);
      }
      for (const profile of profiles) {
        let current = routes[0].start;
        for (const point of floor.traverse) {
          assert.ok(point.y >= 3.2 - EPS, `${floor.id}: useful floor height`);
          assert.ok(navigationCanOccupy(map, { ...point, ...profile.actor }) && supported(map, point, profile.body.radius), `${floor.id}: complete upper standing footprint`);
          current = follow(map, current, point, profile, `${floor.id}/${profile.name}/upper traverse`).player;
        }
        follow(map, current, routes.at(-1).start, profile, `${floor.id}/${profile.name}/alternate escape`);
      }
    }
  });

  test(`${mode}/${map.id}: new cover preserves every spawn, charge site, cache, and doorway`, () => {
    const starts = map.spawns?.flat() || map.spawnPoints;
    const locations = [...starts, ...(map.sites || []), ...(map.lootPoints || []),
      ...(map.buildings || []).flatMap(building => building.doorways.flatMap(door => [door.inside, door.outside])),
      ...(map.stormCenter ? [map.stormCenter] : [])];
    for (const point of locations) {
      assert.ok(navigationCanOccupy(map, point), `${point.id || JSON.stringify(point)}: unobstructed player footprint`);
      assert.ok(supported(map, point), `${point.id || JSON.stringify(point)}: supported gameplay point`);
      const path = navigationPath(map, starts[0], point);
      assert.ok(path.length, `${point.id || JSON.stringify(point)}: connected to a real starting location`);
    }
  });
}

function pursuitFixture(map, route, target, type) {
  const state = Horde.createState({ mapId: map.id, capacity: 1, seed: 71049 });
  Horde.startMatch(state, [0]);
  while (state.phase === 'countdown') Horde.step(state);
  state.horde.pending = 1; state.horde.nextSpawnTick = 1e9;
  const human = state.players[0];
  Object.assign(human, target, { vx: 0, vy: 0, vz: 0, grounded: true, hp: 10000, maxHp: 10000 });
  human.previousInput = emptyInput(human);
  state.spawnWarnings = [{ id: ++state.horde.spawnId, ...route.start, y: route.start.y || 0, ticksLeft: 1, monsterType: type }];
  Horde.step(state);
  const monster = state.players.find(player => player.monster && player.alive);
  assert.ok(monster, `${map.id}/${type}: a real clear rift can materialize at the approach`);
  monster.emergenceTicks = 0;
  return { state, monster, human };
}

for (const map of Object.values(BREACH)) {
  test(`breach/${map.id}: real Last Stand melee AI chases and damages a player on the second floor`, () => {
    assert.ok(map.upperFloors?.length, `${map.id}: second floor authored`);
    const floor = map.upperFloors[0], route = map.routes.find(value => value.id === floor.routeIds[0]);
    const target = floor.traverse.at(-1);
    for (const type of ['stalker', 'hound']) {
      const { state, monster, human } = pursuitFixture(map, route, target, type);
      let climbed = false;
      for (let tick = 0; tick < 4800 && human.hp === human.maxHp; tick++) {
        Horde.step(state);
        assert.ok(navigationCanOccupy(map, monster), `${map.id}/${type}: AI stays outside solid geometry`);
        climbed ||= monster.y >= target.y - .1;
      }
      assert.ok(climbed, `${map.id}/${type}: AI must climb rather than wait underneath a camper; last body ${JSON.stringify({ x: monster.x, y: monster.y, z: monster.z, state: monster.monsterState, path: state.horde.brains[monster.id].path.slice(0, 2) })}`);
      assert.ok(human.hp < human.maxHp, `${map.id}/${type}: upper floor offers fair melee counterplay; last body ${JSON.stringify({ x: monster.x, y: monster.y, z: monster.z, state: monster.monsterState, stuck: state.horde.brains[monster.id].stuckTicks })}`);
    }
  });

  test(`breach/${map.id}: real Last Stand melee AI leaves the second floor to continue ground pursuit`, () => {
    assert.ok(map.upperFloors?.length, `${map.id}: second floor authored`);
    const floor = map.upperFloors[0], route = map.routes.find(value => value.id === floor.routeIds[0]);
    for (const type of ['stalker', 'hound']) {
      const { state, monster, human } = pursuitFixture(map, { start: floor.traverse.at(-1) }, { ...route.start, y: route.start.y || 0 }, type);
      for (let tick = 0; tick < 4800 && human.hp === human.maxHp; tick++) {
        Horde.step(state);
        assert.ok(navigationCanOccupy(map, monster), `${map.id}/${type}: descending AI stays clear of solids`);
      }
      assert.ok(human.hp < human.maxHp, `${map.id}/${type}: the upper floor must not trap a real pursuer; last body ${JSON.stringify({ x: monster.x, y: monster.y, z: monster.z, state: monster.monsterState, stuck: state.horde.brains[monster.id].stuckTicks })}`);
    }
  });
}
