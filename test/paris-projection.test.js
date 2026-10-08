import test from 'node:test';
import assert from 'node:assert/strict';
import { createParisRenderer, projectParisWallColumn } from '../public/solo/paris-renderer.js';
import { createState } from '../public/solo/paris-engine.js';

// Independent pinhole-camera oracle: camera 18 m behind the rider, eye height
// 298/49 m, focal length 18*49 px. Wall material advances every 13 world metres.
function project(side, z, height) {
  const depth = z + 18;
  return { x: 360 + 18 * 49 * side * 7.45 / depth,
    y: 160 + 18 * 49 * (298 / 49 - height) / depth };
}
function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

test('wall interiors follow perspective at every floor and on both street sides', () => {
  for (const side of [-1, 1]) for (const height of [8, 10.3])
    for (const near of [-12.5, -3.1, 0, 6, 40, 100])
      for (const u of [0.07, 0.25, 0.5, 0.73, 0.97]) {
        const z = near + 13 * u;
        const point = project(side, z, 0);
        const column = projectParisWallColumn(side, 130, 130 - near, height, point.x);
        close(column.z, z); close(column.u, u);
        for (const fraction of [0, 0.18, 0.25, 0.5, 0.75, 0.93, 1])
          close(column.bottom + (column.top - column.bottom) * fraction,
            project(side, z, height * fraction).y);
      }
});

test('near clipping preserves the remaining original wall material', () => {
  for (const side of [-1, 1]) {
    const atClip = project(side, -3.1, 0);
    const column = projectParisWallColumn(side, 0, 12.5, 10.3, atClip.x);
    close(column.u, 9.4 / 13);
    assert.ok(column.u > 0.72, 'a clipped module must not restart its material at U=0');
    // A particular window stays at the same U while its screen position moves.
    for (const distance of [3.09, 3.11, 12.99, 13.01, 16.09, 16.11]) {
      const worldZ = 13 * 0.82;
      const point = project(side, worldZ - distance, 0);
      close(projectParisWallColumn(side, 0, distance, 10.3, point.x).u, 0.82);
    }
  }
});

test('adjoining modules share their ground, eaves and floor endpoints', () => {
  for (const side of [-1, 1]) for (const height of [8, 10.3])
    for (const distance of [0, 3.1, 12.99, 13, 13.01, 130000.01]) {
      const boundary = Math.floor(distance / 13) * 13 + 13;
      const screenX = project(side, boundary - distance, 0).x;
      const previous = projectParisWallColumn(side, boundary - 13, distance, height, screenX);
      const next = projectParisWallColumn(side, boundary, distance, height, screenX);
      close(previous.u, 1); close(next.u, 0);
      close(previous.top, next.top); close(previous.bottom, next.bottom);
      for (const fraction of [0.25, 0.5, 0.75])
        close(previous.bottom + (previous.top - previous.bottom) * fraction,
          next.bottom + (next.top - next.bottom) * fraction);
    }
});

test('one-pixel wall columns bound floor sampling error below half a pixel', () => {
  for (const side of [-1, 1]) for (const height of [8, 10.3])
    for (let x = side < 0 ? 0 : 420; x < (side < 0 ? 300 : 720); x++) {
      const center = projectParisWallColumn(side, 0, 0, height, x + 0.5);
      for (const edge of [x, x + 1]) {
        const precise = projectParisWallColumn(side, 0, 0, height, edge);
        assert.ok(Math.abs(center.bottom - precise.bottom) < 0.409);
        assert.ok(Math.abs(center.top - precise.top) < 0.409);
      }
      const quarter = projectParisWallColumn(side, 0, 0, height, x + 0.25);
      const threeQuarter = projectParisWallColumn(side, 0, 0, height, x + 0.75);
      close(center.top, (quarter.top + threeQuarter.top) / 2);
      close(center.bottom, (quarter.bottom + threeQuarter.bottom) / 2);
    }
});

test('projection supports the renderer reusing its scratch output', () => {
  const scratch = {};
  assert.equal(projectParisWallColumn(1, 0, 0, 10.3, 640, scratch), scratch);
  const oldU = scratch.u;
  assert.equal(projectParisWallColumn(-1, 13, 12, 8, 160, scratch), scratch);
  assert.notEqual(scratch.u, oldU);
});

test('actual wall draws keep world UVs and a fixed work bound across camera boundaries', () => {
  const wall = { width: 120, height: 160 };
  const columns = [];
  const ctx = new Proxy({
    canvas: undefined,
    createLinearGradient: () => ({ addColorStop() {} }),
    measureText: () => ({ width: 30 }),
    drawImage(image, ...args) { if (image === wall) columns.push(args); },
  }, { get: (target, key) => target[key] ?? (() => {}) });
  const renderer = createParisRenderer(ctx, { sprites: { wall: () => wall }, reducedMotion: true });
  const state = createState({ seed: 31, difficulty: 'veteran', mode: 'survival' });
  state.traffic = [];
  for (const stageIndex of [0, 1, 2, 4]) {
    state.stageIndex = stageIndex;
    const height = stageIndex === 4 ? 8 : 10.3;
    for (const distance of [0, 3.09, 3.11, 12.99, 13, 13.01, 14.01, 16.11, 130000.01]) {
      columns.length = 0; state.distance = distance; renderer.draw(state);
      assert.ok(columns.length > 300 && columns.length <= 760,
        `wall work must stay bounded, observed ${columns.length} draws`);
      for (const [sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, drawnHeight] of columns) {
        assert.equal(sourceY, 0); assert.equal(sourceWidth, 1); assert.equal(sourceHeight, 160);
        assert.ok(width > 0 && width <= 1);
        const screenX = x + width / 2, side = screenX < 360 ? -1 : 1;
        const relativeZ = 18 * 49 * side * 7.45 / (screenX - 360) - 18;
        const absoluteZ = distance + relativeZ;
        const block = Math.floor(absoluteZ / 13) * 13;
        const expectedSourceX = Math.floor((absoluteZ - block) / 13 * wall.width);
        assert.equal(sourceX, expectedSourceX, 'camera clipping or a module join reset the source material');
        close(y, project(side, relativeZ, height).y);
        close(y + drawnHeight, project(side, relativeZ, 0).y);
      }
    }
  }
});

test('typed wall and pitched-roof pixels preserve world UVs with one bounded atlas upload', () => {
  let createdCanvases = 0, createdBuffers = 0, uploads = 0, composites = 0;
  const sourceReads = { wall: 0, roof: 0 };
  function encodedMaterial(kind, width, height, blue) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++)
      data.set([x + 1, y + 1, blue, 255], (y * width + x) * 4);
    return { width, height, getContext: () => ({ getImageData() {
      sourceReads[kind]++; return { data };
    } }) };
  }
  const wall = encodedMaterial('wall', 120, 160, 91);
  const roof = encodedMaterial('roof', 120, 64, 189);
  let latestData, points = [];
  const observed = new Map();
  const rasterCtx = {
    createImageData(width, height) {
      createdBuffers++; return { width, height, data: new Uint8ClampedArray(width * height * 4) };
    },
    putImageData(data, dx, dy, dirtyX, dirtyY, width, height) {
      uploads++; latestData = data;
      assert.equal(dx, 0); assert.equal(dy, 0); assert.equal(dirtyX, 0);
      assert.ok(width > 0 && width <= 1024 && height > 0 && height <= 1040);
      assert.equal(dirtyY, 0);
    },
  };
  const rasterCanvas = { width: 0, height: 0, getContext: () => rasterCtx };
  const ctx = new Proxy({
    canvas: { ownerDocument: { createElement(tag) {
      assert.equal(tag, 'canvas'); createdCanvases++; return rasterCanvas;
    } } },
    createLinearGradient: () => ({ addColorStop() {} }), measureText: () => ({ width: 30 }),
    drawImage(image, ...args) {
      assert.notEqual(image, wall, 'real materials should use the typed raster');
      assert.notEqual(image, roof, 'real materials should use the typed raster');
      if (image !== rasterCanvas) return;
      composites++;
      const [sx, sy, sw, sh, dx, dy, dw, dh] = args;
      assert.equal(sw, dw); assert.equal(sh, dh);
      for (const point of points) {
        if (point.x < dx || point.x >= dx + dw || point.y < dy || point.y >= dy + dh) continue;
        const offset = ((sy + point.y - dy) * latestData.width + sx + point.x - dx) * 4;
        const rgba = Array.from(latestData.data.subarray(offset, offset + 4));
        if (rgba[3]) observed.set(point.name, rgba);
      }
    },
  }, { get: (target, key) => target[key] ?? (() => {}) });
  const renderer = createParisRenderer(ctx, { sprites: { wall: () => wall, roof: () => roof }, reducedMotion: true });
  const state = createState({ seed: 31, difficulty: 'veteran', mode: 'survival' });
  state.traffic = [];
  function materialU(z, distance) {
    const worldZ = z + distance, module = Math.floor(worldZ / 13) * 13;
    return (worldZ - module) / 13;
  }
  for (const stageIndex of [0, 4]) for (const distance of [0, 3.09, 3.11, 5.39, 5.4, 12.99, 13.01, 16.09, 16.11, 130000.01]) {
    state.stageIndex = stageIndex; state.distance = distance;
    const height = stageIndex === 4 ? 8 : 10.3;
    points = []; observed.clear(); uploads = 0; composites = 0;
    for (const x of [20, 100, 260, 420, 620, 700]) {
      const side = x < 360 ? -1 : 1;
      const p = (x + 0.5 - 360) / (side * 7.45 * 49), z = 18 / p - 18;
      const top = 160 + (298 - height * 49) * p, bottom = 160 + 298 * p;
      for (const v of [0.17, 0.41, 0.68, 0.88]) {
        const y = Math.floor(top + (bottom - top) * v);
        if (y < 0 || y >= 520) continue;
        const sourceY = Math.floor((y + 0.5 - top) / (bottom - top) * 160);
        points.push({ name: `wall:${x}:${v}`, x, y,
          expected: [Math.floor(materialU(z, distance) * 120) + 1, sourceY + 1, 91, 255] });
      }
    }
    for (const side of [-1, 1]) for (const z of [14, 31, 58, 91]) for (const v of [0.16, 0.52, 0.84]) {
      const p = 18 / (18 + z), roofHeight = height + 2.3 * (1 - v);
      const x = Math.floor(360 + side * (10.45 - 3 * v) * 49 * p);
      const y = Math.floor(160 + (298 - roofHeight * 49) * p);
      if (x < 0 || x >= 720 || y < 0 || y >= 520) continue;
      // Intersect the pixel-center camera ray with the independently specified
      // plane h=height+(abs(worldX)-7.45)*2.3/3, then recover both material axes.
      const lateral = Math.abs(x + 0.5 - 360), slope = 2.3 / 3;
      const rayP = (y + 0.5 - 160 + slope * lateral) / (298 - height * 49 + slope * 7.45 * 49);
      const rayZ = 18 / rayP - 18, rayV = (10.45 - lateral / (49 * rayP)) / 3;
      points.push({ name: `roof:${side}:${z}:${v}`, x, y,
        expected: [Math.floor(materialU(rayZ, distance) * 120) + 1, Math.floor(rayV * 64) + 1, 189, 255] });
    }
    renderer.draw(state);
    assert.equal(uploads, 1, 'all visible buildings must share one atlas upload');
    assert.ok(composites > 0 && composites <= 20, `unbounded building patches: ${composites}`);
    for (const point of points)
      assert.deepEqual(observed.get(point.name), point.expected, `${point.name}, distance ${distance}, district ${stageIndex}`);
  }
  assert.equal(createdCanvases, 1); assert.equal(createdBuffers, 1);
  assert.equal(rasterCanvas.width, 1024); assert.equal(rasterCanvas.height, 1040);
  assert.deepEqual(sourceReads, { wall: 1, roof: 1 }, 'source pixel arrays must be cached');
});


test('atlas packing covers the full moving module cycle without dropping patches or growing buffers', () => {
  let buffers = 0, uploads = 0, composites = 0, samples = 0;
  function material(width, height) {
    const data = new Uint8ClampedArray(width * height * 4); data.fill(255);
    return { width, height, getContext: () => ({ getImageData: () => ({ data }) }) };
  }
  const wall = material(120, 160), roof = material(120, 64);
  const rasterCtx = {
    createImageData(width, height) {
      buffers++; return { width, height, data: new Uint8ClampedArray(width * height * 4) };
    },
    putImageData(data, dx, dy, x, y, width, height) {
      uploads++;
      assert.ok(width <= data.width && height <= data.height, 'packed upload must fit its fixed atlas');
    },
  };
  const atlas = { getContext: () => rasterCtx };
  const ctx = new Proxy({
    canvas: { ownerDocument: { createElement: () => atlas } },
    createLinearGradient: () => ({ addColorStop() {} }), measureText: () => ({ width: 30 }),
    drawImage(image, sx, sy, width, height) {
      assert.notEqual(image, wall, 'a full atlas must not fall back to per-column wall draws');
      assert.notEqual(image, roof, 'a full atlas must not fall back to roof triangle clips');
      if (image !== atlas) return;
      composites++;
      assert.ok(sx >= 0 && sy >= 0 && sx + width <= atlas.width && sy + height <= atlas.height,
        'each independently painted patch must stay inside the atlas');
    },
  }, { get: (target, key) => target[key] ?? (() => {}) });
  const renderer = createParisRenderer(ctx, { sprites: { wall: () => wall, roof: () => roof }, reducedMotion: true });
  const state = createState({ seed: 31, difficulty: 'veteran', mode: 'survival' }); state.traffic = [];
  for (const stageIndex of [0, 4]) for (let offset = 0; offset < 13; offset += 0.08) {
    state.stageIndex = stageIndex; state.distance = 130000 + offset;
    uploads = 0; composites = 0; renderer.draw(state); samples++;
    assert.equal(uploads, 1);
    assert.ok(composites > 0 && composites <= 20);
  }
  assert.ok(samples > 300, 'sample the entire moving module cycle at both building heights');
  assert.equal(buffers, 1, 'steady movement must not create new raster buffers');
  state.stageIndex = 3; uploads = 0; composites = 0; renderer.draw(state);
  assert.equal(uploads, 0, 'the open Seine district has no architecture to upload');
  assert.equal(composites, 0);
});
