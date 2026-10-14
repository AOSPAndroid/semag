/** Pack the approved painted kit. Source PNGs and prompts are kept alongside it. */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'public/assets/lockdown/painted';
await mkdir(out, { recursive: true });
const materials = [];
for (let i = 0; i < 9; i++) {
  const input = await sharp('tools/art-source/lockdown-painted-materials.png')
    .extract({ left: i % 3 * 418 + 2, top: Math.floor(i / 3) * 418 + 2, width: 414, height: 414 })
    .resize(480, 480).extend({ top: 16, bottom: 16, left: 16, right: 16, extendWith: 'copy' }).png().toBuffer();
  materials.push({ input, left: i % 4 * 512, top: Math.floor(i / 4) * 512 });
}
await sharp({ create: { width: 2048, height: 2048, channels: 3, background: '#435e3a' } })
  .composite(materials).webp({ quality: 94 }).toFile(`${out}/materials.webp`);
// The generated objects do not occupy exact quarters. Pack their actual bounds
// with a common bottom-centre anchor rather than clipping leaves at a grid line.
const bounds = [[0, 80, 696, 602], [696, 165, 558, 527], [76, 767, 515, 432], [655, 778, 579, 427]];
const foliage = [], frames = [];
const propsInfo = await sharp('tools/art-source/lockdown-painted-props.png').metadata();
const propWidth = Math.floor(propsInfo.width / 2), propHeight = Math.floor(propsInfo.height / 2);
const names = ['hedge', 'fern', 'flowers', 'grass', 'torch', 'shrine', 'power-unit', 'lamp-post'];
for (let i = 0; i < 8; i++) {
  const [left, top, width, height] = i < 4 ? bounds[i] : [(i - 4) % 2 * propWidth, Math.floor((i - 4) / 2) * propHeight, propWidth, propHeight];
  const cropped = await sharp(`tools/art-source/lockdown-painted-${i < 4 ? 'foliage' : 'props'}.png`).extract({ left, top, width, height }).png().toBuffer();
  const { data, info } = await sharp(cropped).trim({ threshold: 5 }).resize({ width: 492, height: 488, fit: 'inside' }).png().toBuffer({ resolveWithObject: true });
  const x = i % 4 * 512 + Math.round((512 - info.width) / 2), y = Math.floor(i / 4) * 512 + 500 - info.height;
  foliage.push({ input: data, left: x, top: y });
  frames.push({ id: names[i], x, y, width: info.width, height: info.height, anchorY: 500 });
}
await sharp({ create: { width: 2048, height: 1024, channels: 4, background: '#00000000' } })
  .composite(foliage).webp({ lossless: true }).toFile(`${out}/foliage.webp`);
await writeFile(`${out}/frames.json`, `${JSON.stringify(frames, null, 2)}\n`);
console.log('Packed nine painted materials and eight transparent scenery sprites.');
