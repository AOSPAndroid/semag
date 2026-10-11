/** Render the existing pixel S on an opaque app tile, without image dependencies. */
import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../public/icons/', import.meta.url));
const colors = { background: [9, 9, 11], amber: [245, 158, 11], ink: [24, 24, 27] };
const letter = [[5,3,6,1],[4,4,2,1],[4,5,2,1],[4,6,2,1],[5,7,5,1],[9,8,2,1],[9,9,2,1],[9,10,2,1],[4,11,6,1]];
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
function icon(size, grid) {
  const raw = Buffer.alloc((size * 3 + 1) * size), margin = (grid - 16) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = Math.floor(x * grid / size) - margin, py = Math.floor(y * grid / size) - margin;
    const inset = py === 0 || py === 15 ? 2 : py === 1 || py === 14 ? 1 : 0;
    let color = colors.background;
    if (py >= 0 && py < 16 && px >= inset && px < 16 - inset) color = colors.amber;
    if (letter.some(([lx, ly, w, h]) => px >= lx && px < lx + w && py >= ly && py < ly + h)) color = colors.ink;
    const offset = y * (size * 3 + 1) + 1 + x * 3;
    for (let c = 0; c < 3; c++) raw[offset + c] = color[c];
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
await mkdir(output, { recursive: true });
for (const [name, size, grid] of [['semag-192.png',192,24],['semag-512.png',512,24],['semag-maskable-512.png',512,32],['apple-touch-icon.png',180,24]]) {
  await writeFile(output + name, icon(size, grid));
}
console.log('Built four opaque semaG pixel icons.');
