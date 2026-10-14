import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { MAPS, RULES, TILE } from '../public/lockdown-engine.js';
import { STAIRS, levelCell } from '../public/lockdown-maps.js';
import { MANIFEST } from '../public/lockdown-assets.js';
import { GROUND, FLOOR_RISE, stairSurfaces, exposedFloorEdges, POINT_PLATE_DIAMETER, sceneZoom } from '../public/lockdown-scene-geometry.js';

test('north and south stair surfaces exactly meet both projected landings without holes', () => {
  const depth = TILE * GROUND;
  for (const direction of ['^', 'v']) {
    const steps = stairSurfaces(direction);
    const intervals = steps.flatMap(s => [[s.y, s.y + s.height], ...(s.face ? [[s.face[1], s.face[1] + s.face[3]]] : [])]).sort((a, b) => a[0] - b[0]);
    const expected = direction === '^' ? [0, depth + FLOOR_RISE] : [FLOOR_RISE, depth];
    assert.equal(intervals[0][0], expected[0]);
    let end = expected[0];
    for (const [from, to] of intervals) { assert.ok(from <= end, `${direction}: gap before ${from}`); end = Math.max(end, to); }
    assert.equal(end, expected[1]);
    assert.ok(steps.every(s => s.x === 0 && s.width === TILE));
  }
});

test('side stairs cover the full bridge width and terminate at one-storey elevation', () => {
  for (const direction of ['<', '>']) {
    const steps = stairSurfaces(direction);
    assert.equal(steps[0].x, 0);
    assert.equal(steps.at(-1).x + steps.at(-1).width, TILE);
    assert.equal(steps[direction === '<' ? 0 : 5].y, 0);
    for (const [i, step] of steps.entries()) {
      if (i) assert.equal(steps[i - 1].x + steps[i - 1].width, step.x);
      assert.equal(step.y + step.height, step.face[1]);
      assert.equal(step.face[1] + step.face[3], TILE * GROUND + FLOOR_RISE);
    }
  }
});

test('all arena stairs open into both landings without an obstructing rim', () => {
  const edge = (dx, dy) => dx === 1 ? 'east' : dx === -1 ? 'west' : dy === 1 ? 'south' : 'north';
  for (const map of Object.values(MAPS)) for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
    const direction = STAIRS[levelCell(map, col, row)];
    if (!direction) continue;
    const [dx, dy] = direction;
    for (const sign of [-1, 1]) {
      const edges = exposedFloorEdges(map, col + dx * sign, row + dy * sign);
      assert.ok(!edges.includes(edge(-dx * sign, -dy * sign)), `${map.id}: closed stair landing ${col},${row}`);
    }
  }
});

test('point artwork stays compact while the actual capture radius remains readable on phones', () => {
  assert.ok(POINT_PLATE_DIAMETER < RULES.pointRadius);
  for (const [w, h] of [[320, 720], [393, 852], [852, 393], [1280, 820]]) {
    const world = w / sceneZoom(w, h, MAPS.skyway.height);
    assert.ok(POINT_PLATE_DIAMETER / world < .25);
    assert.ok(RULES.pointRadius * 2 / world < .65);
  }
});

test('every manifest sprite has exact independent source-frame dimensions', async () => {
  for (const entry of MANIFEST) {
    const meta = await sharp(fileURLToPath(new URL(`../public/art/lockdown/${entry.file}`, import.meta.url))).metadata();
    const density = meta.width / entry.size[0];
    assert.ok(density === 1 || density === 2, entry.key);
    assert.equal(meta.height / entry.size[1], density, entry.key);
    assert.equal(meta.width % entry.frames, 0, entry.key);
    assert.equal(meta.height % (entry.rows || 1), 0, entry.key);
  }
});

test('regenerated cutouts preserve real transparent corners and opaque object pixels', async () => {
  for (const key of ['point_base', 'point_beacon', 'base_alcove', 'base_heal_station', 'base_banner_team0', 'prop_column_skyway']) {
    const { data, info } = await sharp(fileURLToPath(new URL(`../public/art/lockdown/${key}.png`, import.meta.url))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const [x, y] of [[0, 0], [info.width - 1, 0], [0, info.height - 1], [info.width - 1, info.height - 1]]) assert.equal(data[(y * info.width + x) * 4 + 3], 0, key);
    assert.ok(data.some((v, i) => i % 4 === 3 && v >= 245), `${key}: no opaque subject`);
  }
});
