/** Pack the generated source paintings into registered game assets. npm run art:lockdown */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { MANIFEST_BY_KEY } from '../public/lockdown-assets.js';
import { stairSurfaces } from '../public/lockdown-scene-geometry.js';
const source = fileURLToPath(new URL('./art-source/', import.meta.url));
const output = fileURLToPath(new URL('../public/art/lockdown/', import.meta.url));
const themes = ['castle', 'maze', 'foundry', 'ruins', 'graveyard', 'skyway'];
const clear = { r: 0, g: 0, b: 0, alpha: 0 };
const blank = (width, height) => sharp({ create: { width, height, channels: 4, background: clear } });
async function cell(file, col, row, cols, rows) {
  const image = sharp(source + file), { width, height } = await image.metadata();
  const left = Math.round(col * width / cols), top = Math.round(row * height / rows);
  return image.extract({ left, top, width: Math.round((col + 1) * width / cols) - left, height: Math.round((row + 1) * height / rows) - top }).png().toBuffer();
}
// Alpha, not the RGB matte, determines the cutout. Keep the generated alpha intact.
async function bounds(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = 0, bottom = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 24) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  if (right <= left || bottom <= top) throw new Error('Empty generated sprite');
  return sharp(input).extract({ left, top, width: right - left + 1, height: bottom - top + 1 }).png().toBuffer();
}
async function sprite(input, key, maxWidth, maxHeight, bottom) {
  const entry = MANIFEST_BY_KEY[key], width = entry.size[0] * 2, height = entry.size[1] * 2;
  const trimmed = await bounds(input), fitted = await sharp(trimmed).resize({ width: maxWidth, height: maxHeight, fit: 'inside' }).png().toBuffer();
  const size = await sharp(fitted).metadata();
  await blank(width, height).composite([{ input: fitted, left: Math.round((width - size.width) / 2), top: bottom - size.height }]).png().toFile(output + entry.file);
}
for (const [row, theme] of themes.entries()) {
  const floor = await cell('lockdown-materials.png', 0, row, 3, 6);
  const wall = await cell('lockdown-materials.png', 1, row, 3, 6);
  const pit = await cell('lockdown-materials.png', 2, row, 3, 6);
  await sharp(floor).resize(384, 384).png().toFile(output + `terrain_ground_${theme}.png`);
  await sharp(pit).resize(288, 288).png().toFile(output + `terrain_pit_${theme}.png`);
  const floorSheet = await sharp(floor).resize(384, 384).png().toBuffer();
  const floorTile = await sharp(floorSheet).extract({ left: 0, top: 0, width: 96, height: 96 }).png().toBuffer();
  const wallSheet = await sharp(wall).resize(288, 288).png().toBuffer();
  const wallTile = await sharp(wallSheet).extract({ left: 0, top: 0, width: 288, height: 144 }).png().toBuffer();
  for (const key of [`tile_floor_${theme}`, `tile_floor_${theme}_alt`, `tile_wall_top_${theme}`]) await sharp(floorTile).png().toFile(output + key + '.png');
  await sharp(wallTile).png().toFile(output + `tile_wall_front_${theme}.png`);
  await sharp(pit).resize(96, 96).png().toFile(output + `tile_pit_${theme}.png`);
  await sharp(wallTile).extract({ left: 0, top: 0, width: 96, height: 48 }).png().toFile(output + `tile_ledge_${theme}.png`);
  await sharp(wallTile).extract({ left: 0, top: 0, width: 192, height: 80 }).png().toFile(output + `tile_bank_front_${theme}.png`);
  for (const [direction, name] of [['^', 'up'], ['v', 'down'], ['<', 'left'], ['>', 'right']]) {
    const layers = [];
    for (const step of stairSurfaces(direction)) {
      if (step.face) {
        const [x, y, width, height] = step.face;
        layers.push({ input: await sharp(wallTile).extract({ left: 0, top: 0, width: Math.round(width * 2), height: Math.round(height * 2) }).modulate({ brightness: .72 }).png().toBuffer(), left: Math.round(x * 2), top: Math.round(y * 2) });
      }
      layers.push({ input: await sharp(floorTile).extract({ left: Math.round(step.u * 2), top: Math.round(step.v * 2), width: Math.round(step.uw * 2), height: Math.round(step.vh * 2) }).resize(Math.round(step.width * 2), Math.round(step.height * 2)).png().toBuffer(), left: Math.round(step.x * 2), top: Math.round(step.y * 2) });
    }
    await blank(96, 120).composite(layers).png().toFile(output + `tile_stairs_${theme}_${name}.png`);
  }
  await sprite(await cell('lockdown-props.png', 0, row, 3, 6), `prop_column_${theme}`, 110, 224, 240);
  await sprite(await cell('lockdown-props.png', 1, row, 3, 6), `prop_border_${theme}`, 236, 120, 176);
  await sprite(await cell('lockdown-props.png', 2, row, 3, 6), `prop_vines_${theme}`, 144, 144, 160);
}
await sprite(source + 'lockdown-point.png', 'point_base', 312, 312, 316);
for (const [key, col, row, w, h, foot] of [
  ['point_beacon', 0, 0, 80, 80, 88], ['base_heal_station', 1, 0, 80, 100, 112],
  ['base_alcove', 2, 0, 368, 220, 272], ['base_banner_team0', 0, 1, 80, 224, 240],
  ['base_banner_team1', 1, 1, 80, 224, 240], ['pickup_heart', 2, 1, 56, 56, 60],
]) await sprite(await cell('lockdown-common.png', col, row, 3, 2), key, w, h, foot);
for (const team of [0, 1]) {
  const tile = await sharp(output + 'tile_floor_skyway.png').png().toBuffer();
  const layers = [];
  for (let y = 0; y < 7; y++) for (let x = 0; x < 3; x++) layers.push({ input: tile, left: x * 96, top: y * 96 });
  const color = team ? '#3bb8c4' : '#e39a3b';
  layers.push({ input: Buffer.from(`<svg width="288" height="672"><rect x="8" y="8" width="272" height="656" fill="none" stroke="${color}" stroke-width="4"/></svg>`), left: 0, top: 0 });
  await blank(288, 672).composite(layers).png().toFile(output + `base_court_team${team}.png`);
  await sharp(tile).png().toFile(output + `tile_spawn_team${team}.png`);
}
console.log('Rebuilt 107 environment, stair, objective and base sprites from the coordinated source paintings.');
