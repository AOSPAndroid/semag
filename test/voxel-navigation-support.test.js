import assert from 'node:assert/strict';
import test from 'node:test';
import { MAPS as ROYALE } from '../public/voxel-royale-maps.js';
import { WORLD, createCombatPlayer, emptyInput, predictLocalMovement } from '../public/voxel-engine.js';
import { navigationCanOccupy, navigationPath, navigationPoints } from '../public/voxel-navigation.js';

const from = Object.freeze({ x: -25.195204757407424, y: 4.2, z: 7.9588190499449105 });
const target = Object.freeze({ x: -22.07703720636855, y: 4.2, z: -14.670476408188136 });
const box = (id, x, z, w, d, top = 4.2) => ({ id, x, y: top - .3, z, w, h: .3, d });
const fixture = colliders => ({ bounds: { minX: -6, maxX: 6, minZ: -6, maxZ: 6 }, colliders });

function follow(map, start, goal, controls = {}, fixedFloor = null) {
  const path = navigationPath(map, start, goal);
  assert.ok(path.length, 'a supported route must exist');
  const player = Object.assign(createCombatPlayer(99, 0, 'carbine'), start, { grounded: true, vx: 0, vy: 0, vz: 0 });
  player.previousInput = emptyInput(player);
  let waypoint = 0;
  for (let tick = 0; tick < 2500 && waypoint < path.length; tick++) {
    const point = path[waypoint], dx = point.x - player.x, dz = point.z - player.z, gap = Math.hypot(dx, dz);
    if (gap < .16 && Math.abs(point.y - player.y) < .04 && player.grounded) { waypoint++; continue; }
    predictLocalMovement(player, { ...emptyInput(player), ...controls, up: gap > .08, yaw: Math.atan2(dx, -dz), jump: Boolean(point.jump && player.grounded && player.y < point.y - .1 && !player.previousInput.jump) }, map);
    assert.ok(navigationCanOccupy(map, player), `route crosses a solid at tick ${tick}`);
    if (fixedFloor !== null) {
      assert.ok(Math.abs(player.y - fixedFloor) < 1e-7 && player.grounded, `same-height route loses its floor at tick ${tick}: ${JSON.stringify({ x: player.x, y: player.y, z: player.z })}`);
    }
  }
  assert.equal(waypoint, path.length, 'the actual 120 Hz body finishes every waypoint');
  assert.ok(Math.hypot(player.x - goal.x, player.z - goal.z) < .2 && Math.abs(player.y - goal.y) < .04 && player.grounded);
  return path;
}

test('the native Maze corner cannot shortcut across a 72 mm unsupported interval', () => {
  const map = ROYALE.maze, path = navigationPath(map, from, target);
  // The old 180 mm samples missed the gap between the gallery's south edge
  // and the west face of the root causeway. Exact-yaw walking then fell.
  assert.ok(path.length > 1, 'the diagonal must use the connected gallery/causeway elbow');
  assert.ok(path.every(point => point.y === 4.2 && !point.jump), 'the existing floor offers a walkable route');
  for (const controls of [{ walk: true }, { crouch: true }, {}]) follow(map, from, target, controls, 4.2);
});

test('adjacent coplanar floor rectangles retain a direct supported route across their seam', () => {
  const map = fixture([box('west', -4, -2, 4, 4), box('east', 0, -2, 4, 4)]);
  const start = { x: -3, y: 4.2, z: .35 }, goal = { x: 3, y: 4.2, z: -.35 };
  assert.equal(navigationPath(map, start, goal).length, 1);
  follow(map, start, goal, { walk: true }, 4.2);
});

test('a 30 mm interval without any foot contact disconnects two elevated sheets', () => {
  const map = fixture([box('west', -4, -2, 3.665, 4), box('east', .335, -2, 3.665, 4)]);
  assert.equal(.67 > 2 * WORLD.radius, true, 'the open slit exceeds the actual disc diameter');
  // None of the old 180 mm samples landed in the final 30 mm unsupported gap.
  assert.deepEqual(navigationPath(map, { x: -3.1, y: 4.2, z: 0 }, { x: 3.17, y: 4.2, z: 0 }), []);
});

test('two floor edges separated by exactly one disc diameter do not invent support at tangency', () => {
  const map = fixture([box('west', -4, -2, 3.68, 4), box('east', .32, -2, 3.68, 4)]);
  assert.deepEqual(navigationPath(map, { x: -3.1, y: 4.2, z: 0 }, { x: 3.17, y: 4.2, z: 0 }), []);
});

test('a lower intervening terrace cannot support an invented same-height crossing', () => {
  const map = fixture([box('west', -4, -2, 3, 4), box('lower', -1, -2, 2, 4, 3), box('east', 1, -2, 3, 4)]);
  assert.deepEqual(navigationPath(map, { x: -3, y: 4.2, z: 0 }, { x: 3, y: 4.2, z: 0 }), []);
});

test('ground walking, physical walls, and genuine short jump links preserve their behavior', () => {
  const empty = fixture([]), start = { x: -3, y: 0, z: 0 }, goal = { x: 3, y: 0, z: 0 };
  assert.equal(navigationPath(empty, start, goal).length, 1);
  const sealed = fixture([{ id: 'wall', x: -.1, y: 0, z: -6, w: .2, h: 4, d: 12 }]);
  assert.deepEqual(navigationPath(sealed, start, goal), []);
  const crate = fixture([{ id: 'crate', x: -1, y: 0, z: -1, w: 2, h: .84, d: 2 }]);
  assert.ok(follow(crate, { x: 0, y: 0, z: 2 }, { x: 0, y: .84, z: 0 }).some(point => point.jump));
});

test('the exact-support planner retains the bounded immutable Maze navigation graph', () => {
  const points = navigationPoints(ROYALE.maze);
  assert.ok(points.length > 100 && points.length <= 6000);
  assert.equal(points, navigationPoints(ROYALE.maze));
  assert.ok(Object.isFrozen(points) && points.every(point => Object.isFrozen(point) && navigationCanOccupy(ROYALE.maze, point)));
});
