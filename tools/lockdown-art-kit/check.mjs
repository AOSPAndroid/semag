#!/usr/bin/env node
/** Lockdown art checker. Run it after every batch and fix every ERROR before handing art over:
 *   node check.mjs [art folder, default ./art] [--only=<key prefix>]
 * It catches the defects earlier art shipped with: wrong sizes, baked-in backgrounds, stray fragments
 * from neighbouring sprites, vertically smeared rows, dark grid lines at tile edges, seams where tiles
 * repeat, empty animation frames and stairs that are not a full flight. */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { decodePng } from './png.mjs';

const kit = new URL('.', import.meta.url).pathname;
const args = process.argv.slice(2), dir = (args.find(arg => !arg.startsWith('--')) || 'art').replace(/\/?$/, '/');
const only = args.find(arg => arg.startsWith('--only='))?.slice(7) || '';
const manifest = JSON.parse(readFileSync(kit + 'manifest.json', 'utf8')).filter(entry => entry.key.startsWith(only));

/** What each kind of sprite must satisfy. */
const kind = key =>
  /^(tile_(floor|wall_top|pit)_|terrain_)/.test(key) ? 'seamless' :
  /^tile_(wall_front|ledge|bank_front)_/.test(key) ? 'strip' :
  /^tile_stairs_/.test(key) ? 'stairs' :
  /^(tile_spawn|base_court)/.test(key) ? 'opaque' :
  /^(character|armor|gear)_/.test(key) ? 'sheet' :
  /^(fx|proj)_/.test(key) ? 'effect' : 'sprite';

const errors = [], warnings = [];
const error = (file, text) => errors.push(`ERROR ${file}: ${text}`), warn = (file, text) => warnings.push(`warn  ${file}: ${text}`);
const at = (img, x, y) => (y * img.width + x) * 4;
const lum = (img, x, y) => { const i = at(img, x, y); return .3 * img.data[i] + .59 * img.data[i + 1] + .11 * img.data[i + 2]; };
const alpha = (img, x, y) => img.data[at(img, x, y) + 3];
const diff = (img, x1, y1, x2, y2) => { const a = at(img, x1, y1), b = at(img, x2, y2); let d = 0; for (let c = 0; c < 4; c++) d += Math.abs(img.data[a + c] - img.data[b + c]); return d / 4; };

let checked = 0;
const present = new Set(existsSync(dir) ? readdirSync(dir) : []);
for (const entry of manifest) {
  if (!present.has(entry.file)) continue;
  checked++;
  let img;
  try { img = decodePng(readFileSync(dir + entry.file)); } catch (problem) { error(entry.file, problem.message); continue; }
  const scale = img.width / entry.size[0];
  if (![1, 2].includes(scale) || img.height !== entry.size[1] * scale) { error(entry.file, `size ${img.width}x${img.height}; must be ${entry.size.join('x')} or 2x (${entry.size.map(n => n * 2).join('x')})`); continue; }
  if (scale === 1) warn(entry.file, 'drawn at 1x; 2x (HD) is preferred');
  const type = kind(entry.key), { width: w, height: h } = img;
  const share = above => { let n = 0; for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > above) n++; return n / (w * h); };
  const opaqueShare = share(250);
  if (share(24) === 0) { error(entry.file, 'nothing visible: the image is empty'); continue; }

  if (type === 'seamless' || type === 'opaque') {
    if (opaqueShare < .999) error(entry.file, `must be fully opaque (only ${(opaqueShare * 100).toFixed(1)}% is)`);
  }
  if (type === 'seamless') {
    // Seams: the wrap-around edge must look like any other neighbouring pair of pixels.
    let inner = 0, n = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w - 1; x++) { inner += diff(img, x, y, x + 1, y); n++; } inner /= n;
    let lr = 0; for (let y = 0; y < h; y++) lr += diff(img, 0, y, w - 1, y); lr /= h;
    let tb = 0; for (let x = 0; x < w; x++) tb += diff(img, x, 0, x, h - 1); tb /= w;
    if (lr > Math.max(10, inner * 2.5)) error(entry.file, `left and right edges do not match (seam ${lr.toFixed(0)} vs ${inner.toFixed(0)} inside): it must tile seamlessly`);
    if (tb > Math.max(10, inner * 2.5)) error(entry.file, `top and bottom edges do not match (seam ${tb.toFixed(0)} vs ${inner.toFixed(0)} inside): it must tile seamlessly`);
    // A darker frame around the tile shows up in game as a grid over the whole floor.
    let ring = 0, rn = 0, all = 0; const band = Math.max(2, Math.round(w / 48));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const l = lum(img, x, y); all += l; if (x < band || y < band || x >= w - band || y >= h - band) { ring += l; rn++; } }
    ring /= rn; all /= w * h;
    if (ring < all * .93) error(entry.file, `edges are ${Math.round((1 - ring / all) * 100)}% darker than the middle: that draws a grid over the floor; paint through the edges`);
  }
  if (type === 'strip') {
    let lr = 0; for (let y = 0; y < h; y++) lr += diff(img, 0, y, w - 1, y); lr /= h;
    let inner = 0, n = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w - 1; x++) { inner += diff(img, x, y, x + 1, y); n++; } inner /= n;
    if (lr > Math.max(12, inner * 2.5)) error(entry.file, `left and right edges do not match (seam ${lr.toFixed(0)} vs ${inner.toFixed(0)}): it repeats sideways`);
  }
  if (['sprite', 'stairs', 'sheet', 'effect'].includes(type)) {
    // Baked background: opaque corners mean a backdrop was painted behind the sprite.
    const patch = Math.max(3, Math.round(3 * scale)), corner = (cx, cy) => { for (let y = cy; y < cy + patch; y++) for (let x = cx; x < cx + patch; x++) if (alpha(img, x, y) < 200) return false; return true; };
    const corners = [corner(0, 0), corner(w - patch, 0), corner(0, h - patch), corner(w - patch, h - patch)].filter(Boolean).length;
    if (corners >= 3 && type !== 'effect') error(entry.file, `${corners} corners are opaque: a background is baked in; the background must be transparent`);
    let border = 0, bn = 0; for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { bn++; if (alpha(img, x, y) > 40) border++; } for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { bn++; if (alpha(img, x, y) > 40) border++; }
    if (corners < 3 && border / bn > .02 && type === 'sprite') warn(entry.file, 'touches the canvas edge: it may be cropped in game');
    // Semi-transparent fog: almost every pixel faintly visible means a haze or matte was left behind.
    let faint = 0; for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 4 && img.data[i] < 60) faint++;
    if (faint / (w * h) > .35 && type !== 'effect') error(entry.file, 'most of the canvas is faintly opaque: remove the leftover haze or matte');
  }
  if (type === 'stairs') {
    // A flight of stairs climbs a full storey: its painted part must fill most of the height.
    let top = h, bottom = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (alpha(img, x, y) > 60) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    if (bottom - top < h * .55) error(entry.file, `the stairs fill only ${Math.round((bottom - top) / h * 100)}% of the height: draw a full flight of steps, not a slab`);
  }
  if (['seamless', 'strip', 'stairs', 'opaque'].includes(type) || /^(prop|base|point)_/.test(entry.key)) {
    // Smears: runs of identical rows or columns are stretched pixels, not painting.
    const run = (count, length, same) => { let best = 0, cur = 0; for (let i = 0; i < count - 1; i++) { if (same(i)) { cur++; best = Math.max(best, cur); } else cur = 0; } return best; };
    const visibleRow = y => { for (let x = 0; x < w; x += 2) if (alpha(img, x, y) > 60) return true; return false; };
    // Only textured rows count: a plain band of one colour may legitimately repeat; copied detail may not.
    const textured = values => { const mean = values.reduce((a, b) => a + b, 0) / values.length; return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) > 8; };
    const sameRow = y => { if (!visibleRow(y)) return false; let d = 0; for (let x = 0; x < w; x++) d += diff(img, x, y, x, y + 1); return d / w < .35 && textured(Array.from({ length: w }, (_, x) => lum(img, x, y))); };
    const visibleCol = x => { for (let y = 0; y < h; y += 2) if (alpha(img, x, y) > 60) return true; return false; };
    const sameCol = x => { if (!visibleCol(x)) return false; let d = 0; for (let y = 0; y < h; y++) d += diff(img, x, y, x + 1, y); return d / h < .35 && textured(Array.from({ length: h }, (_, y) => lum(img, x, y))); };
    const rows = run(h, w, sameRow), cols = run(w, h, sameCol), limit = Math.max(4, Math.round(3 * scale));
    if (rows >= limit) error(entry.file, `${rows + 1} identical rows in a row: the image is vertically smeared (stretched pixels)`);
    if (cols >= limit) error(entry.file, `${cols + 1} identical columns in a row: the image is horizontally smeared (stretched pixels)`);
  }
  if (type === 'sprite' || type === 'stairs') {
    // Stray fragments: small separate pieces far from the main shape, usually cut from a neighbouring sprite.
    const frameW = w / (entry.frames || 1);
    for (let f = 0; f < (entry.frames || 1); f++) {
      const seen = new Uint8Array(w * h), parts = [];
      for (let y = 0; y < h; y++) for (let x = Math.round(f * frameW); x < Math.round((f + 1) * frameW); x++) {
        if (seen[y * w + x] || alpha(img, x, y) <= 40) continue;
        const stack = [[x, y]]; seen[y * w + x] = 1; let area = 0, x0 = x, x1 = x, y0 = y, y1 = y;
        while (stack.length) {
          const [px, py] = stack.pop(); area++; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = px + dx, ny = py + dy; if (nx < f * frameW || nx >= (f + 1) * frameW || ny < 0 || ny >= h || seen[ny * w + nx] || alpha(img, nx, ny) <= 40) continue; seen[ny * w + nx] = 1; stack.push([nx, ny]); }
        }
        parts.push({ area, x0, x1, y0, y1 });
      }
      parts.sort((a, b) => b.area - a.area);
      const main = parts[0];
      for (const part of parts.slice(1)) {
        const gap = Math.max(main.x0 - part.x1, part.x0 - main.x1, main.y0 - part.y1, part.y0 - main.y1);
        if (!(part.area >= 4 * scale * scale && part.area < main.area * .05 && gap > 3 * scale)) continue;
        // A piece cut off by the canvas edge is a leftover from a neighbouring sprite on the source sheet.
        // So is a thin sliver: the trimmed edge of a neighbour.
        const cut = part.y0 === 0 || part.y1 === h - 1 || part.x0 <= Math.round(f * frameW) || part.x1 >= Math.round((f + 1) * frameW) - 1;
        const pw = part.x1 - part.x0 + 1, ph = part.y1 - part.y0 + 1, sliver = pw >= ph * 4 || ph >= pw * 4;
        (cut || sliver ? error : warn)(entry.file, `stray fragment (${part.area} px) at ${part.x0},${part.y0}${entry.frames > 1 ? ` in frame ${f + 1}` : ''}${cut ? ', cut off by the canvas edge' : sliver ? ', a thin sliver' : ''}: remove leftovers from other sprites`);
      }
    }
  }
  if (type === 'sheet' && entry.rows) {
    // Every frame of a knight sheet must hold a pose.
    const fw = w / (entry.frames || 1), fh = h / entry.rows;
    for (let r = 0; r < entry.rows; r++) for (let c = 0; c < entry.frames; c++) {
      let any = 0; for (let y = r * fh; y < (r + 1) * fh && !any; y += 2) for (let x = c * fw; x < (c + 1) * fw; x += 2) if (alpha(img, x, y) > 60) { any = 1; break; }
      if (!any) error(entry.file, `frame ${c + 1} of row ${r + 1} is empty`);
    }
  }
}
const missing = manifest.filter(entry => !present.has(entry.file)).map(entry => entry.file);
console.log(`${checked}/${manifest.length} sprites present in ${dir}${only ? ` (matching ${only})` : ''}.`);
for (const line of [...errors, ...warnings]) console.log(line);
if (missing.length) console.log(`Missing: ${missing.length} (${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ', …' : ''})`);
console.log(errors.length ? `\n${errors.length} errors: fix them before handing the art over.` : '\nNo errors.');
process.exit(errors.length ? 1 : 0);
