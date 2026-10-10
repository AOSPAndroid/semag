import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS } from '../public/voxel-maps.js';
import { addTacticalJumpCover } from '../public/voxel-tactical-cover.js';
import { WORLD, WEAPONS, createCombatPlayer, emptyInput, predictLocalMovement, traceShot } from '../public/voxel-engine.js';
import { navigationCanOccupy, navigationPath, navigationPoints } from '../public/voxel-navigation.js';
import * as Horde from '../public/voxel-horde-engine.js';

const heavy = Object.values(WEAPONS).reduce((slow, gun) => gun.speed < slow.speed ? gun : slow);
const profiles = [{ name: 'heavy player', actor: {} }, { name: 'hound', actor: { monster: true, human: false, monsterType: 'hound', radius: .5 } }];

/** Public navigation followed with real swept 120 Hz movement, including landings. */
function follow(map, from, target, profile, label) {
  const player = Object.assign(createCombatPlayer(99, 1, heavy.id), from, profile.actor, { y: from.y || 0, vx: 0, vy: 0, vz: 0, grounded: true });
  player.previousInput = emptyInput(player);
  const path = navigationPath(map, player, target);
  assert.ok(path.length, `${label}: connected navigation`);
  let waypoint = 0, jumps = 0;
  for (let tick = 0; tick < 1800 && waypoint < path.length; tick++) {
    const point = path[waypoint], dx = point.x - player.x, dz = point.z - player.z, gap = Math.hypot(dx, dz);
    if (gap < .22 && Math.abs(point.y - player.y) < .04 && player.grounded) { waypoint++; continue; }
    const input = emptyInput({ yaw: Math.atan2(dx, -dz) });
    input.up = gap > .1;
    input.walk = point.y < player.y - .1;
    input.jump = point.jump && player.grounded && player.y < point.y - .1 && !player.previousInput.jump;
    if (input.jump) jumps++;
    predictLocalMovement(player, input, map);
    assert.ok(navigationCanOccupy(map, player), `${label}: no solid-body overlap`);
  }
  assert.equal(waypoint, path.length, `${label}: stuck ${JSON.stringify({ x: player.x, y: player.y, z: player.z })}`);
  assert.ok(player.grounded && Math.abs(player.y - (target.y || 0)) < .04, `${label}: stable physical landing`);
  assert.ok(Math.hypot(player.x - target.x, player.z - target.z) < .25, `${label}: correct landing footprint`);
  return { player, jumps };
}

for (const map of Object.values(MAPS)) {
  test(`${map.id}: low thematic cover has honest solid art, standable tops and bounded cost`, () => {
    assert.equal(map.jumpCover.length, 6);
    assert.equal(map.hopRoutes.length, 3);
    assert.ok(Object.isFrozen(map.jumpCover) && Object.isFrozen(map.hopRoutes));
    assert.equal(addTacticalJumpCover(map), map, 'idempotent catalog assembly');
    assert.ok(navigationPoints(map).length <= 6000, 'bounded navigation graph');
    for (const prop of map.jumpCover) {
      const box = map.colliders.find(value => value.id === prop.colliderId);
      assert.ok(box && Object.isFrozen(box) && Object.isFrozen(prop));
      assert.ok(prop.name && prop.kind && box.h >= .4 && box.h <= .9 && box.y === 0);
      assert.ok(box.w >= 1.4 && box.d >= 1.4, 'both human and hound feet fit the top');
      assert.ok(map.landmarks.some(mark => mark.kind === 'combat-cover' && mark.collisionIds.includes(box.id)), 'art identifies the exact real collider');
      assert.ok(map.coverIds.includes(box.id));
      const origin = { x: prop.landing.x, y: box.h / 2, z: box.z - .4 };
      const hit = traceShot({ map, players: [] }, -1, origin, { x: 0, y: 0, z: 1 }, 1.8);
      assert.equal(hit.colliderId, box.id, 'visible low cover stops the actual shot trace');
      const clear = traceShot({ map, players: [] }, -1, { ...origin, y: box.h + .06 }, { x: 0, y: 0, z: 1 }, 1.8);
      assert.equal(clear.kind, 'none', 'shots immediately above the shown top remain open');
    }
  });

  test(`${map.id}: every new obstacle can be jumped onto and left by a heavy player and hound`, () => {
    for (const prop of map.jumpCover) for (const profile of profiles) for (const approach of prop.approaches) {
      const label = `${prop.colliderId}/${profile.name}`;
      assert.ok(navigationCanOccupy(map, { ...approach, ...profile.actor }), `${label}: clear ground approach`);
      const ascent = follow(map, approach, prop.landing, profile, `${label}/ascent`);
      assert.ok(ascent.jumps > 0, `${label}: actual jump rather than teleport/step`);
      follow(map, ascent.player, approach, profile, `${label}/escape`);
    }
    for (const chain of map.hopRoutes) for (const profile of profiles) {
      let current = chain.start;
      for (const step of chain.steps) current = follow(map, current, step, profile, `${chain.id}/${profile.name}/sequence`).player;
      follow(map, current, chain.end, profile, `${chain.id}/${profile.name}/exit`);
    }
  });

  test(`${map.id}: spawns, doorways, sites and old climbs stay clear and connected`, () => {
    const starts = map.spawns.flat();
    const protectedPoints = [...starts, ...map.sites,
      ...(map.buildings || []).flatMap(room => room.doorways.flatMap(door => [door.inside, door.outside])),
      ...map.routes.flatMap(route => [route.start, ...route.steps.map(step => {
        const box = map.colliders.find(value => value.id === step.colliderId); return { ...step, y: box.y + box.h };
      })]), ...map.upperFloors.flatMap(floor => [...floor.underpasses, ...floor.traverse])];
    for (const profile of profiles) {
      for (const point of protectedPoints) assert.ok(navigationCanOccupy(map, { ...point, ...profile.actor }), `${profile.name}: protected footprint ${JSON.stringify(point)}`);
      for (const point of [...starts, ...map.sites, ...(map.buildings || []).flatMap(room => room.doorways.flatMap(door => [door.inside, door.outside]))]) {
        assert.ok(navigationPath(map, { ...starts[0], ...profile.actor }, point).length, `${profile.name}: protected ground point still reachable`);
      }
      for (const prop of map.jumpCover) assert.ok(navigationPath(map, { ...starts[0], ...profile.actor }, prop.landing).length, `${profile.name}: new cover connects to the arena`);
    }
  });

  test(`${map.id}: real Last Stand melee enemies can attack a player using the new low cover`, () => {
    for (const type of ['stalker', 'hound']) for (const chain of map.hopRoutes) {
      const prop = map.jumpCover.find(value => value.colliderId === chain.steps.at(-1).colliderId);
      const state = Horde.createState({ mapId: map.id, capacity: 1, seed: 51104 });
      Horde.startMatch(state, [0]);
      while (state.phase === 'countdown') Horde.step(state);
      state.horde.pending = 1; state.horde.nextSpawnTick = 1e9;
      const human = state.players[0];
      Object.assign(human, prop.landing, { grounded: true, vx: 0, vy: 0, vz: 0, hp: 10000, maxHp: 10000 });
      human.previousInput = emptyInput(human);
      state.spawnWarnings = [{ id: ++state.horde.spawnId, ...prop.approaches[0], ticksLeft: 1, monsterType: type }];
      Horde.step(state);
      const monster = state.players.find(player => player.monster && player.alive);
      assert.ok(monster, `${chain.id}/${type}: real clear enemy entry`);
      monster.emergenceTicks = 0;
      for (let tick = 0; tick < 1800 && human.hp === human.maxHp; tick++) {
        Horde.step(state);
        assert.ok(navigationCanOccupy(map, monster), `${chain.id}/${type}: pursuit stays outside solids`);
      }
      assert.ok(human.hp < human.maxHp, `${chain.id}/${type}: low cover cannot make an untouchable camping spot`);
    }
  });
}

test('a no-jump movement sweep cannot pass through newly drawn low cover', () => {
  const map = MAPS.courtyard, prop = map.jumpCover.at(-1), box = map.colliders.find(value => value.id === prop.colliderId);
  const player = Object.assign(createCombatPlayer(99, 1, heavy.id), prop.approaches[1], { grounded: true });
  const input = emptyInput({ yaw: 0 }); input.up = true;
  for (let tick = 0; tick < 120; tick++) predictLocalMovement(player, input, map);
  assert.equal(player.y, 0);
  assert.ok(player.z >= box.z + box.d + WORLD.radius - 1e-5, 'solid front face blocks the full real body');
});
