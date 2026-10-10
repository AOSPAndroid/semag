import assert from 'node:assert/strict';
import test from 'node:test';
import { createSnowMap } from '../public/voxel-snow-map.js';
import { createSewerMap } from '../public/voxel-sewer-map.js';
import { createTradingMap } from '../public/voxel-trading-map.js';
import { WORLD, emptyInput } from '../public/voxel-engine.js';
import { navigationCanOccupy, navigationVisible } from '../public/voxel-navigation.js';
import { MONSTER_BODIES } from '../public/voxel-monster-bodies.js';
import * as Horde from '../public/voxel-horde-engine.js';

const factories = [createSnowMap, createSewerMap, createTradingMap];
const bodies = [{ radius: WORLD.radius, height: WORLD.standHeight }, MONSTER_BODIES.hound];

for (const mode of ['breach', 'royale']) for (const factory of factories) {
  const map = factory(mode);
  test(`${mode}/${map.id}: elevated floors retain separate usable ground and upper footprints`, () => {
    for (const floor of map.upperFloors) {
      assert.ok(Object.isFrozen(floor));
      for (const key of ['colliderIds', 'routeIds', 'underpasses', 'traverse']) assert.ok(Object.isFrozen(floor[key]));
      for (const point of [...floor.underpasses, ...floor.traverse]) assert.ok(Object.isFrozen(point));
      for (const point of floor.underpasses) {
        const deck = floor.colliderIds.map(id => map.colliders.find(box => box.id === id)).find(box =>
          point.x >= box.x + .5 && point.x <= box.x + box.w - .5
          && point.z >= box.z + .5 && point.z <= box.z + box.d - .5);
        assert.ok(deck, `${floor.id}: a real floor covers the complete underpass footprint`);
        for (const body of bodies) {
          assert.ok(navigationCanOccupy(map, { ...point, y: 0 }, body), 'ground body fits below the floor');
          assert.ok(navigationCanOccupy(map, { ...point, y: deck.y + deck.h }, body), 'upper body fits above the same floor');
        }
        assert.equal(navigationVisible(map, { ...point, y: WORLD.standHeight }, { ...point, y: deck.y + deck.h + .1 }), false,
          'the rendered upper floor stops shots between levels');
      }
      const approaches = floor.routeIds.map(id => map.routes.find(route => route.id === id));
      assert.ok(approaches.every(Boolean) && new Set(approaches.map(route => route.side)).size >= 2, 'opposite approaches contest each upper area');
    }
  });
}

test('upper instrument housings, pressure-pipe alcoves and office screens provide actual solid cover', () => {
  const fixtures = [
    [createSnowMap, 'snow-gallery-instrument-0'],
    [createSewerMap, 'sewers-gallery-pressure-pipe-0'],
    [createTradingMap, 'trading-upper-monitor'],
  ];
  for (const mode of ['breach', 'royale']) for (const [factory, id] of fixtures) {
    const map = factory(mode), cover = map.colliders.find(box => box.id === id);
    const center = { x: cover.x + cover.w / 2, y: cover.y + cover.h / 2, z: cover.z + cover.d / 2 };
    const entry = { ...center, z: cover.z - .2 }, exit = { ...center, z: cover.z + cover.d + .2 };
    const group = map.landmarks.find(landmark => landmark.collisionIds.includes(id)).collisionIds;
    assert.equal(navigationVisible(map, entry, exit), false, `${mode}/${id}: cover blocks the real shot lane`);
    assert.equal(navigationVisible({ ...map, colliders: map.colliders.filter(box => !group.includes(box.id)) }, entry, exit), true,
      `${mode}/${id}: no hidden collision extends beyond the visible cover`);
    assert.equal(navigationCanOccupy(map, { ...center, y: cover.y }), false, `${mode}/${id}: visible housing blocks a body`);
  }
});

test('sewer north and south approach starts and landings admit the full hound footprint', () => {
  for (const mode of ['breach', 'royale']) {
    const map = createSewerMap(mode);
    for (const route of map.routes) {
      assert.ok(navigationCanOccupy(map, route.start, MONSTER_BODIES.hound), `${mode}/${route.id}: start clears riser and chamber wall`);
      const end = route.steps.at(-1), deck = map.colliders.find(box => box.id === end.colliderId);
      assert.ok(end.x >= deck.x + .5 && end.x <= deck.x + deck.w - .5);
      assert.ok(end.z >= deck.z + .5 && end.z <= deck.z + deck.d - .5);
      assert.ok(navigationCanOccupy(map, { ...end, y: deck.y + deck.h }, MONSTER_BODIES.hound));
    }
  }
});

for (const route of createTradingMap().routes) for (const side of [-1, 1]) {
test(`office hounds: ${route.id}/${side} reaches an upper-floor player from a lateral approach`, () => {
  const map = createTradingMap(), target = map.upperFloors[0].traverse.at(-1);
    const first = route.steps[0], start = { x: first.x + side * 3.2, y: 0, z: first.z };
    const state = Horde.createState({ mapId: map.id, capacity: 1, seed: 71049 });
    Horde.startMatch(state, [0]);
    while (state.phase === 'countdown') Horde.step(state);
    state.horde.pending = 1; state.horde.nextSpawnTick = 1e9;
    const human = state.players[0];
    Object.assign(human, target, { vx: 0, vy: 0, vz: 0, grounded: true, hp: 10000, maxHp: 10000 });
    human.previousInput = emptyInput(human);
    state.spawnWarnings = [{ id: ++state.horde.spawnId, ...start, ticksLeft: 1, monsterType: 'hound' }];
    Horde.step(state);
    const hound = state.players.find(player => player.monster && player.alive);
    assert.ok(hound, `${route.id}/${side}: clear lateral approach permits a real spawn`);
    hound.emergenceTicks = 0;
    let climbed = false;
    for (let tick = 0; tick < 6000 && human.hp === human.maxHp; tick++) {
      Horde.step(state);
      assert.ok(navigationCanOccupy(map, hound), `${route.id}/${side}: pursuing body remains clear`);
      climbed ||= hound.y >= target.y - .1;
    }
    assert.ok(climbed && human.hp < human.maxHp,
      `${route.id}/${side}: hound must reach and damage the upper player; ended ${JSON.stringify({ x: hound.x, y: hound.y, z: hound.z,
        visible: state.horde.brains[hound.id].visible, path: state.horde.brains[hound.id].path.slice(0, 3), input: hound.previousInput })}`);
});
}
