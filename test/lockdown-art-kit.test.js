import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { MANIFEST } from '../public/lockdown-assets.js';
import { createImage, encodePng, decodePng } from '../tools/lockdown-art-kit/png.mjs';

const kit = new URL('../tools/lockdown-art-kit/', import.meta.url).pathname;

test('the art kit manifest matches the game manifest (run node tools/lockdown-art-kit.mjs after changing it)', () => {
  const exported = JSON.parse(readFileSync(kit + 'manifest.json', 'utf8'));
  assert.deepEqual(exported.map(entry => [entry.file, entry.size, entry.anchor, entry.frames]), MANIFEST.map(entry => [entry.file, [...entry.size], [...entry.anchor], entry.frames]));
});

test('the art checker passes clean art and catches smears, slab stairs, baked backgrounds and tile grids', () => {
  const dir = mkdtempSync(join(tmpdir(), 'art-')), art = join(dir, 'art');
  mkdirSync(art);
  const paint = (w, h, colour) => { const img = createImage(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img.data.set(colour(x, y), (y * w + x) * 4); return img; };
  const grain = (x, y) => ((x * 73856093) ^ (y * 19349663)) % 13; // painted art always has some grain
  const wave = (x, y, w, h) => 120 + grain(x, y) + Math.round(40 * Math.sin(x / w * Math.PI * 4) * Math.cos(y / h * Math.PI * 2));
  const save = (name, img) => writeFileSync(join(art, name), encodePng(img));
  // Clean: a floor tile that wraps seamlessly, and stairs that fill the height on a transparent canvas.
  save('tile_floor_castle.png', paint(96, 96, (x, y) => { const v = wave(x, y, 96, 96); return [v, v - 10, v - 20, 255]; }));
  save('tile_stairs_castle_up.png', paint(96, 120, (x, y) => x > 12 && x < 84 && y > 6 && y < 114 ? [150 + (y % 12) * 6 + grain(x, y), 140, 130, 255] : [0, 0, 0, 0]));
  // Faulty: a tile with a dark frame, a slab for stairs, a smeared ledge and a weapon on a baked background.
  save('tile_floor_maze.png', paint(96, 96, (x, y) => { const edge = x < 3 || y < 3 || x > 92 || y > 92, v = wave(x, y, 96, 96) - (edge ? 60 : 0); return [v, v, v, 255]; }));
  save('tile_stairs_castle_down.png', paint(96, 120, (x, y) => y > 4 && y < 24 && x > 8 && x < 88 ? [160, 150, 140, 255] : [0, 0, 0, 0]));
  save('tile_ledge_castle.png', paint(96, 48, (x, y) => { const v = y < 14 ? 100 + (x % 9) * 12 : wave(x, y, 96, 48); return [v, v, v, 255]; }));
  save('weapon_brand.png', paint(128, 64, (x, y) => [40 + x, 60, 80 + y, 255]));
  const run = spawnSync(process.execPath, [kit + 'check.mjs', art], { cwd: dir, encoding: 'utf8' });
  const errorsFor = file => run.stdout.split('\n').filter(line => line.startsWith(`ERROR ${file}`));
  assert.equal(run.status, 1);
  assert.deepEqual(errorsFor('tile_floor_castle.png'), []); assert.deepEqual(errorsFor('tile_stairs_castle_up.png'), []);
  assert.match(errorsFor('tile_floor_maze.png').join(), /darker/);
  assert.match(errorsFor('tile_stairs_castle_down.png').join(), /full flight/);
  assert.match(errorsFor('tile_ledge_castle.png').join(), /smeared/);
  assert.match(errorsFor('weapon_brand.png').join(), /background/);
  // The review sheets render and decode.
  const sheets = spawnSync(process.execPath, [kit + 'sheets.mjs', art, join(dir, 'review')], { cwd: dir, encoding: 'utf8' });
  assert.equal(sheets.status, 0, sheets.stderr);
  assert.ok(decodePng(readFileSync(join(dir, 'review', 'tiling_castle.png'))).width > 0);
});
