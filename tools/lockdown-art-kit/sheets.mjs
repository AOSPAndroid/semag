#!/usr/bin/env node
/** Review sheets: look at these before calling a batch done.
 *   node sheets.mjs [art folder, default ./art] [output folder, default ./review]
 * - review/<group>.png: every sprite of a group on a checkerboard (transparency shows), labelled.
 * - review/tiling_<theme>.png: how a theme's surfaces repeat in game — 4×4 floor tiles with variants, the
 *   ground and pit paintings tiled 2×2, the wall front under its top, ledge over cut bank, and each stair
 *   on the floor. Seams, grids and smears jump out here. */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { decodePng, encodePng, createImage } from './png.mjs';

const kit = new URL('.', import.meta.url).pathname;
const [dir = 'art', out = 'review'] = process.argv.slice(2).map(arg => arg.replace(/\/?$/, '/'));
const manifest = JSON.parse(readFileSync(kit + 'manifest.json', 'utf8'));
mkdirSync(out, { recursive: true });
const load = file => existsSync(dir + file) ? decodePng(readFileSync(dir + file)) : null;

/** Copy src (optionally a sub-rectangle, scaled by nearest/box sampling) onto dst with alpha blending. */
function blit(dst, src, dx, dy, { sx = 0, sy = 0, sw = src.width, sh = src.height, w = sw, h = sh } = {}) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const tx = dx + x, ty = dy + y; if (tx < 0 || ty < 0 || tx >= dst.width || ty >= dst.height) continue;
    const ux = sx + Math.floor(x * sw / w), uy = sy + Math.floor(y * sh / h), s = (uy * src.width + ux) * 4, d = (ty * dst.width + tx) * 4, a = src.data[s + 3] / 255;
    for (let c = 0; c < 3; c++) dst.data[d + c] = Math.round(src.data[s + c] * a + dst.data[d + c] * (1 - a));
    dst.data[d + 3] = 255;
  }
}
function checker(img, x0, y0, w, h) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = ((y0 + y) * img.width + x0 + x) * 4, light = ((x >> 3) + (y >> 3)) % 2 ? 205 : 160; img.data.set([light, light, light, 255], d); } }

// A 3×5 pixel font for labels.
const FONT = { a: '25755', b: '44757', c: '74447', d: '11757', e: '74647', f: '74644', g: '74557', h: '55755', i: '72227', j: '11157', k: '55655', l: '44447', m: '57755', n: '65555', o: '75557', p: '75744', q: '75571', r: '65655', s: '74717', t: '72222', u: '55557', v: '55552', w: '55775', x: '55255', y: '55222', z: '71247', 0: '75557', 1: '26227', 2: '71747', 3: '71717', 4: '55711', 5: '74717', 6: '74757', 7: '71122', 8: '75757', 9: '75717', _: '00007', '.': '00002', '-': '00700', ':': '02020', '/': '11244', ' ': '00000' };
function text(img, string, x, y, scale = 2) {
  for (const [i, ch] of [...string.toLowerCase()].entries()) {
    const rows = (FONT[ch] || FONT[' ']).split('').map(hex => parseInt(hex, 16));
    rows.forEach((bits, r) => { for (let c = 0; c < 3; c++) if (bits & (4 >> c)) for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) { const px = x + (i * 4 + c) * scale + xx, py = y + r * scale + yy; if (px < img.width && py < img.height) img.data.set([20, 20, 24, 255], (py * img.width + px) * 4); } });
  }
}

// Group sheets.
for (const group of [...new Set(manifest.map(entry => entry.group))]) {
  const entries = manifest.filter(entry => entry.group === group), big = group === 'characters' || group === 'armors' || group === 'gear';
  const cell = big ? 660 : 200, label = 16, cols = big ? 2 : 8, rows = Math.ceil(entries.length / cols);
  const sheet = createImage(cols * cell, rows * (cell + label), [245, 245, 245, 255]);
  entries.forEach((entry, i) => {
    const x = (i % cols) * cell, y = Math.floor(i / cols) * (cell + label), img = load(entry.file);
    text(sheet, entry.key.slice(0, Math.floor(cell / 8) - 1), x + 4, y + 3);
    if (!img) { text(sheet, 'missing', x + 8, y + label + 8); return; }
    const fit = Math.min(1, (cell - 8) / img.width, (cell - 8) / img.height), w = Math.max(1, Math.round(img.width * fit)), h = Math.max(1, Math.round(img.height * fit));
    checker(sheet, x + 4, y + label, w, h); blit(sheet, img, x + 4, y + label, { w, h });
  });
  writeFileSync(`${out}${group}.png`, encodePng(sheet));
}

// Tiling previews per theme, at 1x display size (2x art is sampled down).
const themes = [...new Set(manifest.filter(entry => entry.key.startsWith('tile_floor_') && !entry.key.endsWith('_alt')).map(entry => entry.key.slice(11)))];
for (const theme of themes) {
  const T = 48, img = createImage(T * 18, T * 14, [30, 30, 34, 255]);
  const tile = (key, x, y, w = T, h = T) => { const src = load(`${key}.png`); if (src) blit(img, src, x, y, { w, h }); return !!src; };
  // Floor 4×4 with an alt tile mixed in, then the broad ground painting 2×2 (each copy spans 4×4 cells).
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) tile(`tile_floor_${theme}${(r * 4 + c) % 7 === 3 ? '_alt' : ''}`, c * T, r * T);
  const ground = manifest.find(entry => entry.key === `terrain_ground_${theme}`);
  if (ground) for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) tile(ground.key, T * 5 + c * ground.size[0] / 2, r * ground.size[1] / 2, ground.size[0] / 2, ground.size[1] / 2);
  // Pits: tile 4×4 and painting 2×2.
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) tile(`tile_pit_${theme}`, T * 10 + c * T, r * T);
  const pit = manifest.find(entry => entry.key === `terrain_pit_${theme}`);
  if (pit) for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) tile(pit.key, T * 14 + c * pit.size[0] / 2, r * pit.size[1] / 2, pit.size[0] / 2, pit.size[1] / 2);
  // A wall: six top tiles over two copies of the three-cell front.
  for (let c = 0; c < 6; c++) tile(`tile_wall_top_${theme}`, c * T, T * 5);
  for (let c = 0; c < 2; c++) tile(`tile_wall_front_${theme}`, c * T * 3, T * 6, T * 3, T * 1.5);
  // Raised floor edge: floor, ledge row, then the cut bank under it, as stacked in game.
  for (let c = 0; c < 6; c++) tile(`tile_floor_${theme}`, T * 7 + c * T, T * 5);
  for (let c = 0; c < 6; c++) tile(`tile_ledge_${theme}`, T * 7 + c * T, T * 6, T, T / 2);
  for (let c = 0; c < 3; c++) tile(`tile_bank_front_${theme}`, T * 7 + c * T * 2, T * 6.5, T * 2, T * 40 / 48);
  // Each stair on a floor patch.
  ['up', 'down', 'left', 'right'].forEach((dir, i) => {
    const x = T * 1 + i * T * 3, y = T * 9;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) tile(`tile_floor_${theme}`, x - T + c * T, y - T / 2 + r * T);
    tile(`tile_stairs_${theme}_${dir}`, x, y, T, T * 60 / 48);
    text(img, dir, x, y + T * 2 + 6);
  });
  text(img, `${theme}: floor 4x4 / ground 2x2 / pit 4x4 / pit painting 2x2 / wall / ledge over bank / stairs`, 4, T * 13 + 20);
  writeFileSync(`${out}tiling_${theme}.png`, encodePng(img));
}
console.log(`Review sheets written to ${out}`);
