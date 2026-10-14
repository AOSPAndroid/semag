/** Minimal PNG reader and writer (no dependencies): 8-bit greyscale, RGB, palette and RGBA images,
 * non-interlaced, which covers what image tools export. Images are { width, height, data: RGBA bytes }. */
import { inflateSync, deflateSync } from 'node:zlib';

export function decodePng(buffer) {
  if (buffer.toString('latin1', 1, 4) !== 'PNG') throw new Error('not a PNG');
  let offset = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0, palette = null, alpha = null;
  const chunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset), name = buffer.toString('latin1', offset + 4, offset + 8), body = buffer.subarray(offset + 8, offset + 8 + length);
    if (name === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]; type = body[9]; interlace = body[12]; }
    else if (name === 'PLTE') palette = body;
    else if (name === 'tRNS') alpha = body;
    else if (name === 'IDAT') chunks.push(body);
    else if (name === 'IEND') break;
    offset += 12 + length;
  }
  if (depth !== 8 || interlace) throw new Error(`unsupported PNG (bit depth ${depth}${interlace ? ', interlaced' : ''}): export 8-bit, non-interlaced`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!channels) throw new Error(`unsupported PNG colour type ${type}`);
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * channels, pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), out = pixels.subarray(y * stride, (y + 1) * stride), up = y ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[x - channels] : 0, b = up ? up[x] : 0, c = up && x >= channels ? up[x - channels] : 0;
      let value = line[x];
      if (filter === 1) value += a; else if (filter === 2) value += b; else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[x] = value & 255;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * channels, d = i * 4;
    if (type === 6) { data[d] = pixels[s]; data[d + 1] = pixels[s + 1]; data[d + 2] = pixels[s + 2]; data[d + 3] = pixels[s + 3]; }
    else if (type === 2) { data[d] = pixels[s]; data[d + 1] = pixels[s + 1]; data[d + 2] = pixels[s + 2]; data[d + 3] = 255; }
    else if (type === 0 || type === 4) { data[d] = data[d + 1] = data[d + 2] = pixels[s]; data[d + 3] = type === 4 ? pixels[s + 1] : 255; }
    else { const p = pixels[s]; data[d] = palette[p * 3]; data[d + 1] = palette[p * 3 + 1]; data[d + 2] = palette[p * 3 + 2]; data[d + 3] = alpha && p < alpha.length ? alpha[p] : 255; }
  }
  return { width, height, data };
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = bytes => { let c = -1; for (const byte of bytes) c = CRC[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (name, body) => { const head = Buffer.alloc(8); head.writeUInt32BE(body.length); head.write(name, 4, 'latin1'); const tail = Buffer.alloc(4); tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body]))); return Buffer.concat([head, body, tail]); };

export function encodePng({ width, height, data }) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export const createImage = (width, height, fill = [0, 0, 0, 0]) => { const data = new Uint8Array(width * height * 4); for (let i = 0; i < data.length; i += 4) data.set(fill, i); return { width, height, data }; };
