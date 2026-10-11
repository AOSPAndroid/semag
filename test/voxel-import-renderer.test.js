import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatPlayer, WORLD } from '../public/voxel-engine.js';
import { MAPS } from '../public/voxel-royale-maps.js';
import { SMOKE } from '../public/voxel-ordnance.js';
import { VoxelRenderer, leanTiltAngle } from '../public/voxel-renderer.js';

test('all eight smoke clouds retain an opaque finite shape throughout growth and fading inside a bounded mesh', () => {
  const renderer = {}, boxes = [];
  for (const ageTicks of [30, SMOKE.growTicks, SMOKE.ticks - 60]) {
    boxes.length = 0;
    const smokes = Array.from({ length: 8 }, (_, id) => ({ id, x: id * 20, y: 1.4, z: 0, ageTicks }));
    VoxelRenderer.prototype._smokes.call(renderer, { box(...args) { boxes.push(args); } }, { smokes }, 1000);
    assert.ok(boxes.length > 0 && boxes.length <= 392, `${boxes.length}: fixed upper geometry budget`);
    for (const cloud of smokes) assert.ok(boxes.some(([x, , , w]) => x <= cloud.x && x + w >= cloud.x), `cloud ${cloud.id} must not disappear to save budget`);
    for (const [x, y, z, w, h, d, color] of boxes) {
      assert.ok([x, y, z, w, h, d, ...color].every(Number.isFinite));
      assert.ok(y >= 0 && w > 0 && h > 0 && d > 0 && color[3] === 1);
    }
  }
});

test('eight smokes fit a real ten-player rendering frame with world loot and live grenades', () => {
  const gl = new Proxy({}, { get(_target, name) {
    if (name === 'getShaderParameter' || name === 'getProgramParameter') return () => true;
    if (name === 'getAttribLocation') return () => 0;
    if (typeof name === 'string' && name.startsWith('create')) return () => ({});
    return () => {};
  } });
  const renderer = new VoxelRenderer({ getContext: () => gl, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ width: 960, height: 540 }) });
  const players = Array.from({ length: 10 }, (_, id) => ({ ...createCombatPlayer(id, id, 'lmg'), x: id * 2 - 10, z: 9 }));
  const state = { gameId: 'voxel-royale', map: MAPS.paris, mapId: 'paris', phase: 'fight', round: 1, tick: 100, players,
    smokes: Array.from({ length: 8 }, (_, id) => ({ id, x: id * 4 - 14, y: 1.4, z: -6, ageTicks: SMOKE.growTicks })),
    loot: Array.from({ length: 128 }, (_, id) => ({ id, kind: 'weapon', weapon: 'sniper', x: id % 16 - 8, y: 0, z: Math.floor(id / 16) - 4 })),
    maxGrenades: 20, grenades: Array.from({ length: 20 }, (_, id) => ({ id, x: id % 10 * 2 - 10, y: .12, z: 22 + Math.floor(id / 10) * 3, radius: .12, fuseTicks: 180 })),
    events: Array.from({ length: 150 }, (_, id) => ({ id, tick: 100, type: 'shot', weapon: 'lmg', playerId: id % 10, x: 0, y: 1.6, z: 4, dx: 0, dy: 0, dz: -1, hitX: 0, hitY: 1.6, hitZ: 0, hitKind: 'body', damage: 26 })) };
  try {
    assert.equal(renderer.render(state, { localId: 0, time: 1000 }), true);
    assert.equal(renderer.stats.lootItems, 128);
    assert.ok(renderer._smokeCubes > 0);
    assert.ok(renderer.stats.dynamicVertices < 72000, `${renderer.stats.dynamicVertices}: existing dynamic budget`);
    assert.ok(renderer.stats.drawCalls <= 7, 'smoke stays in the existing world batch');
  } finally { renderer.destroy(); }
});

test('crouched and standing lean visuals reach the same accepted horizontal head offset', () => {
  for (const crouching of [false, true]) {
    const height = crouching ? WORLD.crouchEyeHeight : WORLD.eyeHeight;
    for (const leanOffset of [-.38, 0, .38]) assert.ok(Math.abs(Math.sin(leanTiltAngle({ crouching, leanOffset })) * height - leanOffset) < 1e-9);
  }
});
