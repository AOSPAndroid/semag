import test from 'node:test';
import assert from 'node:assert/strict';
import { createParisPerspective } from '../public/art/paris-perspective.js';
import { createParisRenderer } from '../public/solo/paris-renderer.js';
import { createState } from '../public/solo/paris-engine.js';

function recordingDocument(t) {
  const hadDocument = Object.hasOwn(globalThis, 'document'), previousDocument = globalThis.document;
  const canvases = [];
  globalThis.document = { createElement(tag) {
    assert.equal(tag, 'canvas');
    const canvas = { width: 0, height: 0, contextRequests: [], paints: 0, reads: 0 };
    const ctx = new Proxy({
      fillStyle: '',
      fillRect() { canvas.paints++; }, fill() { canvas.paints++; },
      drawImage() { canvas.paints++; },
      getImageData(x, y, width, height) {
        assert.deepEqual([x, y, width, height], [0, 0, canvas.width, canvas.height]);
        assert.equal(canvas.contextRequests[0].options?.willReadFrequently, true,
          'the first context must request CPU backing before the renderer reads its painted pixels');
        assert.ok(canvas.paints > 0, 'renderer must read the actual painted material');
        canvas.reads++;
        const data = new Uint8ClampedArray(width * height * 4); data.fill(255);
        return { data };
      },
      createImageData(width, height) { return { width, height, data: new Uint8ClampedArray(width * height * 4) }; },
      createLinearGradient() { return { addColorStop() {} }; },
      measureText() { return { width: 30 }; },
    }, { get: (object, key) => object[key] ?? (() => {}) });
    canvas.getContext = (kind, options) => {
      assert.equal(kind, '2d');
      canvas.contextRequests.push({ kind, options: options && { ...options } }); return ctx;
    };
    canvas.context = ctx; canvases.push(canvas); return canvas;
  } };
  t.after(() => {
    if (hadDocument) globalThis.document = previousDocument;
    else delete globalThis.document;
  });
  return canvases;
}

test('all projected Paris wall and roof variants request readable backing before painting and reuse their canvas', t => {
  const canvases = recordingDocument(t), sprites = createParisPerspective(), materials = [];
  for (const kind of ['haussmann', 'cafe', 'shop']) for (let variant = 0; variant < 3; variant++) {
    const image = sprites.wall(kind, variant); materials.push(image);
    assert.equal(sprites.facade(kind, variant + 3), image);
    assert.equal(sprites.wall(kind, -variant), image);
    assert.deepEqual([image.width, image.height], [120, 160]);
  }
  for (let variant = 0; variant < 3; variant++) {
    const image = sprites.roof(variant); materials.push(image);
    assert.equal(sprites.roof(variant + 3), image);
    assert.deepEqual([image.width, image.height], [120, 64]);
  }
  assert.equal(sprites.wall('unknown', 0), materials[0]);
  assert.equal(canvases.length, 12);
  for (const image of materials) {
    assert.deepEqual(image.contextRequests, [{ kind: '2d', options: { willReadFrequently: true } }]);
    assert.ok(image.paints > 0); assert.equal(image.reads, 0);
    assert.equal(image.context.imageSmoothingEnabled, false);
  }
  sprites.clear();
  assert.notEqual(sprites.wall('haussmann', 0), materials[0]);
  assert.notEqual(sprites.roof(0), materials[9]);
  assert.equal(canvases.length, 14, 'cleared caches recreate each material with readable backing');
  assert.equal(canvases[12].contextRequests[0].options.willReadFrequently, true);
  assert.equal(canvases[13].contextRequests[0].options.willReadFrequently, true);
});

test('Paris draw-only sprites retain their original canvas backend and cache behavior', t => {
  const canvases = recordingDocument(t), sprites = createParisPerspective();
  const draws = [
    ...Array.from({ length: 6 }, (_, variant) => () => sprites.rearCar(variant)),
    ...Array.from({ length: 4 }, (_, variant) => () => sprites.rearCyclist(variant)),
    ...Array.from({ length: 3 }, (_, variant) => () => sprites.endWall(variant)),
    ...Array.from({ length: 5 }, (_, district) => () => sprites.skyline(district)),
    () => sprites.rearBus(), () => sprites.busSide(), () => sprites.busRoof(),
    () => sprites.rearCourier(), () => sprites.rearCourier({ pedal: .75, assist: true, damaged: true }),
    () => sprites.tree(), () => sprites.metro(),
  ];
  const first = draws.map(draw => draw()), count = canvases.length;
  assert.deepEqual(draws.map(draw => draw()), first); assert.equal(canvases.length, count);
  for (const image of canvases) {
    assert.deepEqual(image.contextRequests, [{ kind: '2d', options: undefined }]);
    assert.ok(image.paints > 0); assert.equal(image.reads, 0);
    assert.equal(image.context.imageSmoothingEnabled, false);
  }
});

test('the actual Paris renderer reads each CPU material once over the complete street material cycle', t => {
  const canvases = recordingDocument(t), sprites = createParisPerspective();
  const main = document.createElement('canvas'); main.context.canvas = main;
  const renderer = createParisRenderer(main.context, { sprites, reducedMotion: true });
  const state = createState({ seed: 31, difficulty: 'veteran', mode: 'survival' }); state.traffic = [];
  // Kinds repeat every 5/4 blocks and colours every 3: 60 blocks cover every
  // combination, including previously unseen materials entering the camera.
  for (let block = 0; block < 60; block++) {
    state.distance = block * 13 + .37; renderer.draw(state);
  }
  const materials = canvases.filter(image => image.contextRequests[0]?.options?.willReadFrequently);
  assert.equal(materials.length, 12);
  for (const image of materials) assert.equal(image.reads, 1, 'later buildings must reuse cached pixel arrays');
  const firstReadCount = canvases.reduce((sum, image) => sum + image.reads, 0);
  for (const distance of [780.37, 130000.01, 130013.999]) {
    state.distance = distance; state.stageIndex = 4; renderer.draw(state);
  }
  assert.equal(canvases.reduce((sum, image) => sum + image.reads, 0), firstReadCount,
    'travel distance and a different district height cannot trigger another source readback');
  assert.ok(canvases.filter(image => !materials.includes(image)).every(image => image.reads === 0));
});
