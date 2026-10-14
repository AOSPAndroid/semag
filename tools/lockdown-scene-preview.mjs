/** Deterministic renderer fixture, separate from the real keyboard/mouse smoke test. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const base = process.env.LOCKDOWN_URL || 'http://127.0.0.1:3128';
const dir = process.argv[2] || 'test-results/lockdown';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
if (process.env.LOCKDOWN_NO_GRADIENTS === '1') await page.addInitScript(() => {
  const get = WebGLRenderingContext.prototype.getExtension;
  WebGLRenderingContext.prototype.getExtension = function(name) {
    return ['EXT_shader_texture_lod', 'OES_standard_derivatives'].includes(name) ? null : get.call(this, name);
  };
});
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.route('**/lockdown-client.js', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
await page.goto(`${base}/lockdown.html?solo=1`);
await page.evaluate(async () => {
  const [{ LockdownVoxelRenderer: LockdownRenderer }, { createAssetLibrary, MANIFEST }, E] = await Promise.all([
    import('/lockdown-voxel-renderer.js'), import('/lockdown-assets.js'), import('/lockdown-engine.js'),
  ]);
  document.body.replaceChildren();
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100vw;height:100vh;display:block';
  document.body.append(canvas);
  const assets = createAssetLibrary();
  await new Promise((resolve, reject) => {
    const started = Date.now(), poll = setInterval(() => {
      if (assets.count === MANIFEST.length) { clearInterval(poll); resolve(); }
      else if (Date.now() - started > 20000) { clearInterval(poll); reject(Error(`Only ${assets.count}/${MANIFEST.length} assets loaded`)); }
    }, 50);
  });
  const renderer = new LockdownRenderer(canvas, assets); window.previewRenderer = renderer;
  if (!await renderer.world.materialsReady) throw new Error(renderer.world.assetError);
  window.preview = (mapId, close = false) => {
    const state = E.createState({ mapId, seed: 5 });
    E.setConnected(state, 0, true, 'Challenger'); E.startMatch(state, [0]); state.phase = 'fight';
    state.players.forEach(p => { p.alive = false; });
    Object.assign(state.players[0], { alive: true, x: 11.5 * 48, y: 5.2 * 48, armor: 'duelist', helmet: 'feather', pants: 'breeches', shoes: 'sabatons', aim: .8, vx: 0, vy: 0, shieldTicks: 0 });
    if (!close) Object.assign(state.players[0], { x: state.points[0].x + 30, y: state.points[0].y - 30 });
    renderer.camera = { x: 0, y: 0, zoom: 1 };
    renderer.render(state, { localId: 0, now: 1500, focus: { x: close ? 12 * 48 : E.MAPS[mapId].width / 2, y: close ? 8 * 48 : E.MAPS[mapId].height / 2 } });
    return { count: assets.count, camera: renderer.camera, mode: canvas.dataset.renderer, stats: renderer.stats, error: renderer.world?.gl.getError() };
  };
});
const maps = ['skyway', 'keep', 'maze', 'foundry', 'temple', 'graveyard', 'ramparts', 'atrium'];
for (const map of maps) {
  const result = await page.evaluate(id => window.preview(id), map);
  assert.equal(result.mode, 'webgl'); assert.equal(result.error, 0); console.log(map, result.stats);
  await page.screenshot({ path: `${dir}/${map}.png` });
}
await page.setViewportSize({ width: 393, height: 852 });
await page.evaluate(() => window.preview('skyway', true));
await page.screenshot({ path: `${dir}/skyway-phone.png` });
for (const map of ['maze', 'temple', 'foundry']) {
  const result = await page.evaluate(id => window.preview(id, true), map);
  assert.equal(result.mode, 'webgl'); assert.equal(result.error, 0); assert.equal(result.stats.paintedMaterials, true);
  await page.screenshot({ path: `${dir}/${map}-phone.png` });
}
const overview = [];
for (const [i, map] of maps.entries()) overview.push({ input: await sharp(`${dir}/${map}.png`).resize(480, 308).png().toBuffer(), left: i % 2 * 480, top: Math.floor(i / 2) * 308 });
await sharp({ create: { width: 960, height: 1232, channels: 3, background: '#111317' } }).composite(overview).png().toFile(`${dir}/overview.png`);
// Exercise real context loss/restoration on the private scene canvas.
await page.evaluate(() => { window.lossExtension = window.previewRenderer.world.gl.getExtension('WEBGL_lose_context'); window.lossExtension?.loseContext(); });
await page.waitForFunction(() => window.previewRenderer.world.lost);
assert.equal((await page.evaluate(() => window.preview('skyway', true))).mode, 'canvas-fallback');
await page.evaluate(() => window.lossExtension.restoreContext());
await page.waitForFunction(() => !window.previewRenderer.world.lost);
const restored = await page.evaluate(() => window.preview('skyway', true));
assert.equal(restored.mode, 'webgl'); assert.equal(restored.error, 0);
await browser.close();
if (errors.length) throw new Error(errors.join('\n'));
