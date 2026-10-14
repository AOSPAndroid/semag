import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import sharp from 'sharp';
import { PAINTED_ASSETS } from '../public/lockdown-painted-mesh.js';

test('painted atlases fit GPU limits and every scenery sprite retains a clear alpha border', async () => {
  let bytes = 0;
  for (const url of Object.values(PAINTED_ASSETS)) {
    const path = new URL(`../public${url}`, import.meta.url), info = await sharp(await readFile(path)).metadata();
    assert.ok(info.width <= 2048 && info.height <= 2048);
    assert.equal(info.width & (info.width - 1), 0); assert.equal(info.height & (info.height - 1), 0);
    bytes += (await stat(path)).size;
  }
  assert.ok(bytes < 4 * 1024 * 1024, 'painted runtime kit stays below 4 MiB');
  const path = new URL(`../public${PAINTED_ASSETS.foliage}`, import.meta.url);
  const { data, info } = await sharp(await readFile(path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let cell = 0; cell < 8; cell++) {
    const x0 = cell % 4 * 512, y0 = Math.floor(cell / 4) * 512; let opaque = 0;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const alpha = data[((y0 + y) * info.width + x0 + x) * 4 + 3];
      if (x < 4 || x >= 508 || y < 4 || y >= 508) assert.equal(alpha, 0, `clear sprite ${cell} border`);
      if (alpha > 200) opaque++;
    }
    assert.ok(opaque > 10000 && opaque < 240000, `sprite ${cell}: substantial isolated object`);
  }
});
