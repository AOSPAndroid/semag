import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/lockdown-engine.js';
import { levelAt, STAIRS, TILE } from '../public/lockdown-maps.js';
import { buildLockdownWorld, STOREY, VERTICAL } from '../public/lockdown-world-mesh.js';
import { onMapSurface, surfaceSupportsBody } from '../public/lockdown-map-surfaces.js';
import { groundToView, viewToGround, LOCKDOWN_YAW } from '../public/lockdown-camera.js';
import { worldProjection } from '../public/lockdown-world-view.js';
import { FLOOR_RISE } from '../public/lockdown-scene-geometry.js';

test('GPU projection, HUD projection and aiming agree at both floors and on stairs', () => {
  for (const [width, height] of [[320, 720], [393, 852], [1280, 820]]) {
    const camera = { x: 560, y: 420, zoom: width / 700 }, matrix = worldProjection(camera, width, height);
    for (const [x, y, floor] of [[152, 492, 0], [576, 260, 1], [600, 168, .5], [1008, 600, 0]]) for (const chest of [0, 22]) {
      const lift = floor * FLOOR_RISE + chest, p = groundToView(x, y, lift), picked = viewToGround(p.x, p.y, lift);
      assert.ok(Math.hypot(picked.x - x, picked.y - y) < 1e-9);
      const world = [x, lift / VERTICAL, y, 1], q = [0, 1, 2, 3].map(row => world.reduce((sum, v, col) => sum + matrix[col * 4 + row] * v, 0));
      const sx = (q[0] / q[3] + 1) * width / 2, sy = (1 - q[1] / q[3]) * height / 2;
      assert.ok(Math.abs(sx - (width / 2 + (p.x - camera.x) * camera.zoom)) < .002);
      assert.ok(Math.abs(sy - (height / 2 + (p.y - camera.y) * camera.zoom)) < .002);
    }
  }
});

test('camera-relative movement and dash directions keep screen cardinal directions and speed', () => {
  for (const key of ['right', 'left', 'up', 'down']) {
    const v = E.movementVector({ [key]: true, moveYaw: -LOCKDOWN_YAW }), projected = groundToView(v.x, v.y);
    assert.ok(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-10);
    assert.ok(Math.abs(['right', 'left'].includes(key) ? projected.y : projected.x) < 1e-10);
    assert.equal(Math.sign(['right', 'left'].includes(key) ? projected.x : projected.y), ['right', 'down'].includes(key) ? 1 : -1);
  }
  assert.deepEqual(E.movementVector({ right: true, moveYaw: NaN }), { x: 1, y: 0 });
});

test('all eight 3D maps have finite bounded geometry, continuous wall footprints and supported stair landings', () => {
  const before = JSON.stringify(E.MAPS);
  for (const map of Object.values(E.MAPS)) {
    const scene = buildLockdownWorld(map);
    assert.ok(scene.opaque.length > 1000 && scene.opaque.length / 10 < 400000, `${map.id} geometry budget`);
    assert.ok(scene.opaque.every(Number.isFinite), map.id);
    assert.equal(scene.opaque.length % 30, 0);
    let occupied = 0;
    for (const wall of scene.walls) {
      for (let r = wall.row; r < wall.row + wall.rows; r++) for (let c = wall.col; c < wall.col + wall.cols; c++) {
        assert.equal(map.grid[r][c], '#'); occupied++;
      }
    }
    assert.equal(occupied, map.grid.join('').split('#').length - 1);
    for (const stair of scene.staircases) {
      const [dx, dy] = STAIRS[stair.direction], x = (stair.col + .5) * TILE, y = (stair.row + .5) * TILE;
      assert.equal(levelAt(map, x + dx * TILE, y + dy * TILE), 1);
      assert.equal(levelAt(map, x - dx * TILE, y - dy * TILE), 0);
      assert.equal(stair.steps.at(-1).h, STOREY);
      assert.ok(surfaceSupportsBody(map, x + dx * TILE, y + dy * TILE, E.RULES.radius), `${map.id} upper landing`);
      assert.ok(surfaceSupportsBody(map, x - dx * TILE, y - dy * TILE, E.RULES.radius), `${map.id} lower landing`);
    }
  }
  assert.equal(JSON.stringify(E.MAPS), before, 'rendering never changes navigation data');
});

function arena(x, y) {
  const state = E.createState({ mapId: 'skyway', seed: 9 }); E.setConnected(state, 0, true, 'Ada'); E.startMatch(state, [0]); state.phase = 'fight';
  for (const p of state.players) Object.assign(p, { alive: p.id === 0, bot: false, respawnTicks: 1e9 });
  Object.assign(state.players[0], { x, y, z: levelAt(E.MAPS.skyway, x, y), vx: 0, vy: 0, shieldTicks: 0 });
  return state;
}
function walk(state, input, ticks) { for (let i = 0; i < ticks; i++) E.step(state, [{ ...E.emptyInput(), ...input }]); }

test('rounded island edges stop bodies, bridge seams remain traversable and pit shoes still cross', () => {
  const map = E.MAPS.skyway, state = arena(650, 490);
  walk(state, { right: true }, 100);
  const p = state.players[0];
  assert.ok(p.x < 698 && p.x > 663, `stopped at curved edge: ${p.x}`);
  assert.ok(surfaceSupportsBody(map, p.x, p.y, E.RULES.radius));
  assert.equal(onMapSurface(map, 712, 490), false);
  // Use the catalogue's actual chasm-walking shoes instead of a visual-only perk.
  p.shoes = Object.keys(E.GEAR.shoes).find(id => E.GEAR.shoes[id].walk?.includes('chasm'));
  assert.ok(p.shoes, 'chasm shoes are available');
  walk(state, { right: true }, 70); assert.ok(p.x > 712);
  const cross = arena(552, 600); walk(cross, { right: true }, 300);
  assert.ok(cross.players[0].x > 1008, 'crossed from rounded A onto the bridge and B');
  const climb = arena(552, 360); walk(climb, { up: true }, 75);
  assert.equal(climb.players[0].z, 1, 'actual movement climbs the connected terrace stairs');
});
