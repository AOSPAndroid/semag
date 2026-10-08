import { ROAD_HALF, BIKE_WIDTH, BIKE_LENGTH, DISTRICTS, MAX_TRAFFIC } from './paris-engine.js';

// A metre stays a metre in every layer: the road, tyre contact, shadows, and
// signalled envelopes share this projection. The camera never changes physics.
const W = 720, H = 520, HORIZON_Y = 160, RIDER_Y = 458;
const DEPTH = 18, METRE = 49, FAR = 100, NEAR = -3.1;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mod = (n, d) => ((n % d) + d) % d;
const COLORS = ['#dfb668', '#bf6b5a', '#85a5a4', '#d5d6ce', '#888f9c', '#a58799'];
const WALL_COLORS = ['#decdb1', '#e4d1b9', '#d7c6ac', '#d9d1ba', '#ddc6be'];
const BUILDING_LENGTH = 13, WALL_X = 7.45, RIDGE_X = 10.45, ROOF_RISE = 2.3;
const MAX_ROOF_STRIPS = 32;
const RASTER_WIDTH = 256;
// A fixed atlas holds independent, tightly cropped building patches. Uploading
// them together avoids repeatedly transferring the same software canvas to the
// display context, while each patch keeps its original painter position.
const ATLAS_WIDTH = 1024, ATLAS_HEIGHT = H * 2, MAX_PROJECTION_CACHE = 4;

// Vertical walls have a constant world x. Inverting their projected x gives
// exact depth and material U for a raster column, without affine triangle shear.
// The renderer supplies its reusable output; independent geometry checks can
// omit it. The unclipped world endpoint is deliberately part of this mapping.
export function projectParisWallColumn(side, worldNear, distance, height, screenX, out = {}) {
  const p = (screenX - W / 2) / (side * WALL_X * METRE);
  out.z = DEPTH / p - DEPTH;
  out.u = (distance + out.z - worldNear) / BUILDING_LENGTH;
  out.top = HORIZON_Y + (RIDER_Y - HORIZON_Y - height * METRE) * p;
  out.bottom = HORIZON_Y + (RIDER_Y - HORIZON_Y) * p;
  return out;
}

export function createParisRenderer(ctx, { sprites, reducedMotion = false } = {}) {
  // Reused bounded lists; continuous positions never become sprite cache keys.
  const actors = [], warnings = [];
  const wallColumn = { z: 0, u: 0, top: 0, bottom: 0 };
  // Exact UVs are sampled into a reusable atlas instead of hundreds of
  // narrow image blits, roof clips, and per-building canvas transfers.
  const rasterCanvas = ctx.canvas?.ownerDocument?.createElement?.('canvas') || globalThis.document?.createElement?.('canvas');
  if (rasterCanvas) { rasterCanvas.width = ATLAS_WIDTH; rasterCanvas.height = ATLAS_HEIGHT; }
  const rasterCtx = rasterCanvas?.getContext('2d', { alpha: true });
  const rasterData = rasterCtx?.createImageData(ATLAS_WIDTH, ATLAS_HEIGHT);
  const rasterPixels = rasterData?.data ? new Uint32Array(rasterData.data.buffer, rasterData.data.byteOffset, rasterData.data.byteLength / 4) : null;
  const materialPixels = new WeakMap();
  const projectionCache = new Map();
  const buildingPatches = Array.from({ length: 20 }, () => ({}));
  const packedPatches = [];
  let patchCount = 0, patchIndex = 0;
  const warningLabels = Array.from({ length: 4 }, () => ({ x: 0, y: 0, width: 0 }));
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON_Y + 45);
  sky.addColorStop(0, '#93c5ce'); sky.addColorStop(0.68, '#c9dbd4'); sky.addColorStop(1, '#efe4cb');
  const asphalt = ctx.createLinearGradient(0, HORIZON_Y, 0, H);
  asphalt.addColorStop(0, '#969a8a'); asphalt.addColorStop(0.35, '#737b71'); asphalt.addColorStop(1, '#596560');
  let state = null, actorFar = FAR, warningFar = 45, survival = false;

  const scale = z => DEPTH / (DEPTH + Math.max(NEAR, z));
  const py = z => HORIZON_Y + (RIDER_Y - HORIZON_Y) * scale(z);
  const px = (x, z) => W / 2 + x * METRE * scale(z);
  const vertical = (height, z) => height * METRE * scale(z);
  const motionReduced = () => typeof reducedMotion === 'object' ? reducedMotion.matches === true : reducedMotion === true;
  function rect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  }
  function quad(ax, ay, bx, by, cx, cy, dx, dy, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath(); ctx.fill();
  }
  function strip(x1, x2, near, far, color) {
    quad(px(x1, far), py(far), px(x2, far), py(far), px(x2, near), py(near), px(x1, near), py(near), color);
  }
  function label(value, x, y, color, size = 10) {
    ctx.font = `bold ${size}px ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#173d3bdd'; ctx.fillRect(Math.round(x - ctx.measureText(value).width / 2 - 6), Math.round(y - 9), Math.ceil(ctx.measureText(value).width + 12), 18);
    ctx.fillStyle = color; ctx.fillText(value, Math.round(x), Math.round(y + 1));
  }

  function background(district) {
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // Stable daylight clouds, kept behind the distant Paris silhouette.
    for (let i = 0; i < 5; i++) {
      const x = mod(i * 167 + district * 43, 790) - 55;
      const y = 28 + (i % 3) * 23;
      rect(x + 15, y, 59, 8, '#eef0dabb'); rect(x, y + 8, 102, 10, '#eef0dabb');
      rect(x + 8, y + 18, 79, 5, '#e3ead8aa');
    }
    const silhouette = sprites?.skyline?.(district);
    if (silhouette) ctx.drawImage(silhouette, -5 - state.x * 0.6, HORIZON_Y - 141, W + 10, 150);
    else {
      for (let i = 0; i < 20; i++) {
        const height = 24 + (i * 17 % 42);
        rect(i * 39 - 12, HORIZON_Y - height, 44, height + 12, '#aaa995');
      }
    }
    // A bridge exposes open water; the other quartiers form a street canyon.
    rect(0, HORIZON_Y + 6, W, H - HORIZON_Y, district === 3 ? '#94afa6' : '#c4bda5');
    if (district === 3) {
      for (let i = 0; i < 22; i++) {
        const z = 3 + i * 5, y = py(z), p = scale(z);
        rect(15 + (i * 41 % 78), y, 78 * p + 6, Math.max(1, p * 2), '#d0d9ba88');
        rect(W - 125 - (i * 29 % 67), y + 7, 87 * p + 6, Math.max(1, p * 2), '#c4d3c199');
      }
    }
  }

  function road(district) {
    strip(-ROAD_HALF - 1.55, ROAD_HALF + 1.55, NEAR, 3000, district === 3 ? '#cec6ad' : '#d7ceb6');
    // Broad, quiet asphalt and a true vanishing point, with no HUD across gaps.
    quad(W / 2 - 1, HORIZON_Y, W / 2 + 1, HORIZON_Y,
      px(ROAD_HALF, NEAR), H + 2, px(-ROAD_HALF, NEAR), H + 2, asphalt);
    strip(-5.12, -5, NEAR, 3000, '#ede1be'); strip(5, 5.12, NEAR, 3000, '#ede1be');
    strip(-4.99, -4.84, NEAR, FAR, '#485b4c'); strip(4.84, 4.99, NEAR, FAR, '#485b4c');
    // World-anchored marks flow toward the rider instead of resizing in place.
    const first = Math.floor((state.distance + NEAR) / 10) * 10;
    for (let i = 0; i < 12; i++) {
      const z = first + i * 10 - state.distance;
      const near = Math.max(NEAR, z), far = Math.min(FAR, z + 4.2);
      if (near >= far || far < NEAR || near > FAR) continue;
      for (const x of [-2.625, -0.875, 0.875, 2.625]) strip(x - 0.035, x + 0.035, near, far, '#d6d1af99');
    }
    // Crossings and gutter stones give speed cues without a field of particles.
    const crossing = Math.floor((state.distance + 38) / 95) * 95 + 55 - state.distance;
    if (crossing > NEAR && crossing < FAR) {
      const near = Math.max(NEAR, crossing), far = Math.min(FAR, crossing + 2.4);
      for (let x = -4.5; x < 4.6; x += 1.2) strip(x, x + 0.58, near, far, '#ded9b3b0');
    }
    for (let i = 0; i < 18; i++) {
      const z = mod(i * 7 - state.distance, 116) - 3;
      const y = py(z), p = scale(z), x = ((i * 37 % 83) / 10 - 4.15);
      rect(px(x, z), y, 5 * p + 1, 1.3 * p, '#cad1b01b');
    }
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 18; i++) {
        const z = mod(i * 6 - state.distance, 108);
        strip(side * 5.18, side * 5.63, Math.max(NEAR, z), Math.min(FAR, z + 0.20), '#a99d83');
      }
    }
  }

  // Roof interpolation is accurate over a small depth interval. Each narrow
  // strip keeps its original UV range when the camera plane clips the building.
  function materialStrip(image, u0, u1, ax, ay, bx, by, cx, cy, dx, dy) {
    if (!image || Math.max(ay, by, cy, dy) < 0 || Math.min(ay, by, cy, dy) > H ||
      Math.max(ax, bx, cx, dx) < 0 || Math.min(ax, bx, cx, dx) > W) return;
    const sourceX = u0 * image.width, sourceWidth = (u1 - u0) * image.width, ih = image.height;
    if (sourceWidth <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(dx, dy); ctx.closePath(); ctx.clip();
    ctx.transform((bx - ax) / sourceWidth, (by - ay) / sourceWidth, (dx - ax) / ih, (dy - ay) / ih, ax, ay);
    ctx.drawImage(image, sourceX, 0, sourceWidth, ih, 0, 0, sourceWidth, ih); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath(); ctx.clip();
    const a = (cx - dx) / sourceWidth, b = (cy - dy) / sourceWidth, c = (cx - bx) / ih, d = (cy - by) / ih;
    ctx.transform(a, b, c, d, bx - a * sourceWidth, by - b * sourceWidth);
    ctx.drawImage(image, sourceX, 0, sourceWidth, ih, 0, 0, sourceWidth, ih); ctx.restore();
  }
  function wallMaterial(image, side, worldNear, height, near, far) {
    if (!image) return;
    const x1 = px(side * WALL_X, near), x2 = px(side * WALL_X, far);
    const left = Math.max(0, Math.min(x1, x2)), right = Math.min(W, Math.max(x1, x2));
    // Adjacent modules partition the visible wall, so both sides together use
    // at most 720 full columns, plus bounded partial columns at module joins.
    // One-pixel sampling bounds geometric error to 0.5px horizontally and 0.408px
    // vertically. Floor rows never acquire a diagonal triangle seam.
    for (let x = Math.floor(left); x < Math.ceil(right); x++) {
      const start = Math.max(left, x), end = Math.min(right, x + 1);
      if (start >= end) continue;
      projectParisWallColumn(side, worldNear, state.distance, height, (start + end) / 2, wallColumn);
      const sourceX = clamp(Math.floor(wallColumn.u * image.width), 0, image.width - 1);
      ctx.drawImage(image, sourceX, 0, 1, image.height, start, wallColumn.top, end - start, wallColumn.bottom - wallColumn.top);
    }
  }
  function pixelsFor(image) {
    if (!image?.getContext) return null;
    let material = materialPixels.get(image);
    if (material) return material;
    const data = image.getContext('2d')?.getImageData?.(0, 0, image.width, image.height)?.data;
    if (!data) return null;
    material = { width: image.width, height: image.height,
      pixels: new Uint32Array(data.buffer, data.byteOffset, data.byteLength / 4) };
    materialPixels.set(image, material); return material;
  }
  function projectionFor(height, wallHeight, roofHeight) {
    const key = `${height}:${wallHeight}:${roofHeight}`;
    let projection = projectionCache.get(key);
    if (projection) return projection;
    const wall = [], roof = [];
    const slope = ROOF_RISE / (RIDGE_X - WALL_X);
    const denominator = RIDER_Y - HORIZON_Y - height * METRE + slope * WALL_X * METRE;
    for (let x = 0; x < W; x++) {
      const side = x < W / 2 ? -1 : 1;
      projectParisWallColumn(side, 0, 0, height, x + 0.5, wallColumn);
      const firstY = Math.max(0, Math.ceil(wallColumn.top - 0.5));
      const lastY = Math.min(H, Math.ceil(wallColumn.bottom - 0.5));
      const wallRows = new Uint32Array(Math.max(0, lastY - firstY));
      const sourceStep = wallHeight / (wallColumn.bottom - wallColumn.top);
      let sourceY = (firstY + 0.5 - wallColumn.top) * sourceStep;
      for (let row = 0; row < wallRows.length; row++, sourceY += sourceStep)
        wallRows[row] = clamp(Math.floor(sourceY), 0, wallHeight - 1);
      wall.push({ z: wallColumn.z, firstY, rows: wallRows });
      const lateral = side * (x + 0.5 - W / 2), offset = slope * lateral;
      const pMin = Math.max(scale(121), lateral / (RIDGE_X * METRE));
      const pMax = Math.min(scale(NEAR), lateral / (WALL_X * METRE));
      const roofFirst = Math.max(0, Math.ceil(HORIZON_Y - offset + denominator * pMin - 0.5));
      const roofLast = Math.min(H, Math.ceil(HORIZON_Y - offset + denominator * pMax - 0.5));
      const depth = new Float64Array(Math.max(0, roofLast - roofFirst));
      const rows = new Uint32Array(depth.length);
      for (let row = 0; row < depth.length; row++) {
        const p = (roofFirst + row + 0.5 - HORIZON_Y + offset) / denominator;
        const inverse = 1 / p, v = (RIDGE_X - lateral * inverse / METRE) / (RIDGE_X - WALL_X);
        depth[row] = p > 0 && v >= 0 && v < 1 ? DEPTH * inverse - DEPTH : NaN;
        rows[row] = clamp(Math.floor(v * roofHeight), 0, roofHeight - 1);
      }
      roof.push({ firstY: roofFirst, depth, rows });
    }
    // Camera planes are fixed; distance changes only material U, never these
    // pixel-center rays. Two district heights share their bounded row maps.
    projection = { wall, roof };
    if (projectionCache.size >= MAX_PROJECTION_CACHE) projectionCache.delete(projectionCache.keys().next().value);
    projectionCache.set(key, projection); return projection;
  }
  function prepareBuildingPatch(patch, side, worldNear, height, near, far, wall, roof) {
    patch.valid = false; patch.empty = false;
    const wallImage = pixelsFor(wall), roofImage = pixelsFor(roof);
    if (!wallImage || !roofImage) return;
    const wallNear = px(side * WALL_X, near), wallFar = px(side * WALL_X, far);
    const ridgeNear = px(side * RIDGE_X, near), ridgeFar = px(side * RIDGE_X, far);
    const eaveNear = py(near) - vertical(height, near), eaveFar = py(far) - vertical(height, far);
    const ridgeNearY = py(near) - vertical(height + ROOF_RISE, near), ridgeFarY = py(far) - vertical(height + ROOF_RISE, far);
    const left = Math.max(0, Math.floor(Math.min(wallNear, wallFar, ridgeNear, ridgeFar)));
    const right = Math.min(W, Math.ceil(Math.max(wallNear, wallFar, ridgeNear, ridgeFar)));
    const top = Math.max(0, Math.floor(Math.min(eaveNear, eaveFar, ridgeNearY, ridgeFarY)));
    const bottom = Math.min(H, Math.ceil(Math.max(py(near), py(far))));
    const width = right - left, rows = bottom - top;
    patch.empty = width <= 0 || rows <= 0;
    if (patch.empty || width > RASTER_WIDTH) return;
    patch.side = side; patch.worldNear = worldNear; patch.height = height;
    patch.near = near; patch.far = far; patch.wallImage = wallImage; patch.roofImage = roofImage;
    patch.wallNear = wallNear; patch.wallFar = wallFar; patch.eaveNear = eaveNear; patch.eaveFar = eaveFar;
    patch.ridgeNearY = ridgeNearY; patch.ridgeFarY = ridgeFarY;
    patch.left = left; patch.right = right; patch.top = top; patch.bottom = bottom;
    patch.width = width; patch.rows = rows;
    patch.projection = projectionFor(height, wallImage.height, roofImage.height);
    packedPatches.push(patch);
  }
  function rasterPatch(patch) {
    const { side, worldNear, height, near, far, wallImage, roofImage,
      wallNear, wallFar, eaveNear, eaveFar, ridgeNearY, ridgeFarY,
      left, right, top, bottom, width, atlasX, atlasY, projection } = patch;
    const stride = ATLAS_WIDTH, destinationOffset = atlasY * stride + atlasX - top * stride - left;
    for (let y = top; y < bottom; y++)
      rasterPixels.fill(0, destinationOffset + y * stride + left, destinationOffset + y * stride + left + width);
    const wallLeft = Math.max(0, Math.min(wallNear, wallFar));
    const wallRight = Math.min(W, Math.max(wallNear, wallFar));
    for (let x = Math.floor(wallLeft); x < Math.ceil(wallRight); x++) {
      const column = projection.wall[x];
      // A typed pixel has one owner even when a module boundary crosses it.
      if (column.z < near || column.z >= far) continue;
      const u = (state.distance + column.z - worldNear) / BUILDING_LENGTH;
      const sourceX = clamp(Math.floor(u * wallImage.width), 0, wallImage.width - 1);
      let destination = destinationOffset + column.firstY * stride + x;
      for (let row = 0; row < column.rows.length; row++, destination += stride)
        rasterPixels[destination] = wallImage.pixels[column.rows[row] * wallImage.width + sourceX];
    }
    // Ray/plane inversion gives the actual pitched-roof U and V at each pixel;
    // no affine diagonal or near-plane remapping is involved.
    const slope = ROOF_RISE / (RIDGE_X - WALL_X);
    const denominator = RIDER_Y - HORIZON_Y - height * METRE + slope * WALL_X * METRE;
    const roofBottom = Math.min(H, Math.ceil(Math.max(eaveNear, eaveFar, ridgeNearY, ridgeFarY)));
    const originalNear = worldNear - state.distance;
    for (let x = left; x < right; x++) {
      const lateral = side * (x + 0.5 - W / 2);
      const offset = slope * lateral;
      const pMin = Math.max(scale(far), lateral / (RIDGE_X * METRE));
      const pMax = Math.min(scale(near), lateral / (WALL_X * METRE));
      const firstY = Math.max(top, Math.ceil(HORIZON_Y - offset + denominator * pMin - 0.5));
      const lastY = Math.min(roofBottom, Math.ceil(HORIZON_Y - offset + denominator * pMax - 0.5));
      const column = projection.roof[x];
      for (let y = firstY; y < lastY; y++) {
        const row = y - column.firstY, z = column.depth[row];
        if (!Number.isFinite(z) || z < near || z >= far) continue;
        const u = (z - originalNear) / BUILDING_LENGTH;
        const sx = clamp(Math.floor(u * roofImage.width), 0, roofImage.width - 1);
        rasterPixels[destinationOffset + y * stride + x] = roofImage.pixels[column.rows[row] * roofImage.width + sx];
      }
    }
  }
  function prepareBuildings(district) {
    patchCount = 0; patchIndex = 0; packedPatches.length = 0;
    if (!rasterPixels || district === 3) return;
    const base = Math.floor(state.distance / BUILDING_LENGTH) * BUILDING_LENGTH;
    for (let i = 8; i >= -1; i--) {
      const worldNear = base + i * BUILDING_LENGTH;
      const originalNear = worldNear - state.distance, originalFar = originalNear + BUILDING_LENGTH;
      if (originalFar < -1 || originalNear > 108) continue;
      const near = Math.max(NEAR, originalNear), far = Math.min(121, originalFar);
      if (near >= far) continue;
      for (let side = -1; side <= 1; side += 2) {
        const block = Math.floor(worldNear / BUILDING_LENGTH), variant = mod(block + (side > 0 ? 2 : 0), 3);
        const kind = mod(block + side, 5) === 0 ? 'cafe' : mod(block, 4) === 0 ? 'shop' : 'haussmann';
        const wall = sprites?.wall?.(kind, variant) || sprites?.facade?.(kind, variant);
        const roof = sprites?.roof?.(variant);
        prepareBuildingPatch(buildingPatches[patchCount++], side, worldNear, district === 4 ? 8 : 10.3, near, far, wall, roof);
      }
    }
    // Tallest-first shelves bound the atlas to two logical canvas heights.
    // Sorting only this reused list leaves the painting list in depth order.
    packedPatches.sort((a, b) => b.rows - a.rows);
    let x = 0, y = 0, shelfHeight = 0, usedWidth = 0, usedHeight = 0;
    for (const patch of packedPatches) {
      if (x + patch.width > ATLAS_WIDTH) { y += shelfHeight; x = 0; shelfHeight = 0; }
      if (y + patch.rows > ATLAS_HEIGHT) continue;
      patch.atlasX = x; patch.atlasY = y; patch.valid = true;
      x += patch.width; shelfHeight = Math.max(shelfHeight, patch.rows);
      usedWidth = Math.max(usedWidth, x); usedHeight = Math.max(usedHeight, y + patch.rows);
      rasterPatch(patch);
    }
    if (usedWidth && usedHeight) rasterCtx.putImageData(rasterData, 0, 0, 0, 0, usedWidth, usedHeight);
  }
  function rasterBuilding() {
    if (!rasterPixels) return false;
    const patch = buildingPatches[patchIndex++];
    if (!patch) return false;
    if (patch.empty) return true;
    if (!patch.valid) return false;
    ctx.drawImage(rasterCanvas, patch.atlasX, patch.atlasY, patch.width, patch.rows,
      patch.left, patch.top, patch.width, patch.rows);
    return true;
  }
  function building(side, worldNear, height, wall, roof, color) {
    const originalNear = worldNear - state.distance, originalFar = originalNear + BUILDING_LENGTH;
    const near = Math.max(NEAR, originalNear), far = Math.min(121, originalFar);
    if (near >= far) return;
    const wallX = side * WALL_X, ridgeX = side * RIDGE_X;
    const nearGround = py(near), farGround = py(far);
    const nearEave = nearGround - vertical(height, near), farEave = farGround - vertical(height, far);
    const nearRidge = nearGround - vertical(height + ROOF_RISE, near), farRidge = farGround - vertical(height + ROOF_RISE, far);
    // Opaque adjoining geometry closes the old transparent sprite margins.
    // Blocks share exact endpoints, eaves, floor heights, and a roof pitch.
    quad(px(wallX, near), nearEave, px(wallX, far), farEave,
      px(wallX, far), farGround, px(wallX, near), nearGround, color);
    quad(px(ridgeX, near), nearRidge, px(ridgeX, far), farRidge,
      px(wallX, far), farEave, px(wallX, near), nearEave, '#71858a');
    if (!rasterBuilding()) {
      wallMaterial(wall, side, worldNear, height, near, far);
      const span = Math.abs(px(wallX, near) - px(wallX, far));
      const strips = clamp(Math.ceil(span / 2), 4, MAX_ROOF_STRIPS);
      const depthStep = BUILDING_LENGTH / strips;
      for (let i = 0; i < strips; i++) {
        const a = Math.max(near, originalNear + i * depthStep);
        const b = Math.min(far, originalNear + (i + 1) * depthStep);
        if (a >= b) continue;
        // UVs refer to the unclipped building. Its material therefore stays fixed
        // to the street as the camera passes through the near clipping plane.
        const u0 = clamp((a - originalNear) / BUILDING_LENGTH, 0, 1);
        const u1 = clamp((b - originalNear) / BUILDING_LENGTH, 0, 1);
        const ga = py(a), gb = py(b), ea = ga - vertical(height, a), eb = gb - vertical(height, b);
        materialStrip(roof, u0, u1, px(ridgeX, a), ga - vertical(height + ROOF_RISE, a),
          px(ridgeX, b), gb - vertical(height + ROOF_RISE, b), px(wallX, b), eb, px(wallX, a), ea);
      }
    }
    // Continuous stone cornices use world heights rather than texture edges.
    // Each straight band reaches the same endpoint as its neighboring block.
    for (let floor = 1; floor <= 4; floor++) {
      const h = height * floor / 4, band = floor === 4 ? 0.10 : 0.055;
      quad(px(wallX, near), nearGround - vertical(h + band, near), px(wallX, far), farGround - vertical(h + band, far),
        px(wallX, far), farGround - vertical(h, far), px(wallX, near), nearGround - vertical(h, near), '#f1dfbb');
    }
  }
  function scenery(district) {
    const base = Math.floor(state.distance / BUILDING_LENGTH) * BUILDING_LENGTH;
    for (let i = 8; i >= -1; i--) {
      const worldNear = base + i * BUILDING_LENGTH;
      const near = worldNear - state.distance, far = near + BUILDING_LENGTH;
      if (far < -1 || near > 108) continue;
      for (let side = -1; side <= 1; side += 2) {
        const block = Math.floor(worldNear / BUILDING_LENGTH), variant = mod(block + (side > 0 ? 2 : 0), 3);
        if (district !== 3) {
          const kind = mod(block + side, 5) === 0 ? 'cafe' : mod(block, 4) === 0 ? 'shop' : 'haussmann';
          const wall = sprites?.wall?.(kind, variant) || sprites?.facade?.(kind, variant);
          const roof = sprites?.roof?.(variant);
          const height = district === 4 ? 8.0 : 10.3;
          building(side, worldNear, height, wall, roof, WALL_COLORS[district]);
        }
        const z = near + 8;
        if (z < 1 || z > 100) continue;
        if (district === 3) {
          // Stone bridge piers and dark railings run along the open Seine view.
          const p = scale(z), x = px(side * 6.0, z), y = py(z);
          rect(x - 5 * p, y - 36 * p, 10 * p, 38 * p, '#d1c7aa');
          rect(x - 7 * p, y - 39 * p, 14 * p, 5 * p, '#f1dfb4');
        } else {
          const tree = sprites?.tree?.();
          if (tree && mod(block, 3) === 0) {
            const height = vertical(3.9, z), width = height * tree.width / tree.height;
            ctx.drawImage(tree, px(side * 6.25, z) - width / 2, py(z) - height, width, height);
          }
          if (mod(block, 7) === 2 && side === -1) {
            const metro = sprites?.metro?.();
            if (metro) {
              const height = vertical(2.8, z), width = height * metro.width / metro.height;
              ctx.drawImage(metro, px(-6.2, z) - width / 2, py(z) - height, width, height);
            }
          }
        }
        // Slender Paris street lamps: two-tone iron, simple daytime lantern.
        if (mod(block, 2) === 0) {
          const p = scale(z), x = px(side * 5.95, z), y = py(z), top = y - vertical(4.0, z);
          rect(x - p, top, 2 * p, y - top, '#4b675d');
          rect(x - 5 * p, top - 7 * p, 10 * p, 11 * p, '#647a67');
          rect(x - 3 * p, top - 5 * p, 6 * p, 6 * p, '#f8d9a0');
          rect(x - 6 * p, top - 9 * p, 12 * p, 3 * p, '#35544f');
        }
      }
    }
    if (district === 3) {
      for (const side of [-1, 1]) {
        const x = side * 6.0;
        quad(px(x - 0.025, FAR), py(FAR) - vertical(0.75, FAR), px(x + 0.025, FAR), py(FAR) - vertical(0.75, FAR),
          px(x + 0.025, NEAR), py(NEAR) - vertical(0.75, NEAR), px(x - 0.025, NEAR), py(NEAR) - vertical(0.75, NEAR), '#59786a');
      }
    }
  }

  function footprint(actor, color = '#203b3442', inset = 0) {
    if (!actorVisible(actor)) return;
    const z = actor.z - state.distance, rear = Math.max(NEAR, z - actor.length / 2), front = Math.max(NEAR, z + actor.length / 2);
    const half = Math.max(0.02, actor.width / 2 - inset);
    strip(actor.x - half, actor.x + half, rear, front, color);
  }
  function actorDepth(actor) { return actor.z - actor.length / 2; }
  function actorVisible(actor) {
    const relative = actor.z - state.distance;
    return relative + actor.length / 2 >= NEAR && relative - actor.length / 2 <= actorFar;
  }
  function actorBody(actor) {
    const z = actor.z - state.distance, actualRear = z - actor.length / 2, front = z + actor.length / 2;
    // A bus can extend from below the canvas to several metres ahead. Clip its
    // visible roof/side at the bottom plane instead of dropping the whole bus.
    const rear = Math.max(NEAR, actualRear);
    if (!actorVisible(actor)) return;
    const p = scale(rear), x = px(actor.x, rear), ground = py(rear), width = actor.width * METRE * p;
    const variant = Math.max(0, COLORS.indexOf(actor.color));
    if (actor.crashed) ctx.globalAlpha = 0.58;
    if (actor.kind === 'barrier') {
      const height = vertical(0.9, rear);
      rect(x - width / 2, ground - height, width, height, '#e0a857');
      ctx.save(); ctx.beginPath(); ctx.rect(x - width / 2, ground - height, width, height * 0.75); ctx.clip();
      ctx.strokeStyle = '#f7e5ba'; ctx.lineWidth = Math.max(2, 8 * p);
      for (let i = -3; i < 12; i++) {
        ctx.beginPath(); ctx.moveTo(x - width / 2 + i * 14 * p, ground); ctx.lineTo(x - width / 2 + (i + 3) * 14 * p, ground - height); ctx.stroke();
      }
      ctx.restore(); rect(x - width * 0.38, ground - height * 0.1, width * 0.12, height * 0.12, '#655c46');
      rect(x + width * 0.26, ground - height * 0.1, width * 0.12, height * 0.12, '#655c46');
    } else if (actor.kind === 'door') {
      const side = Math.sign(actor.x) || 1;
      const outer = actor.x + side * actor.width / 2;
      const bodyCenter = outer - side * 0.55;
      const bodyWidth = 1.1 * METRE * p, height = vertical(1.45, rear);
      const image = sprites?.rearCar?.(3);
      if (image) ctx.drawImage(image, 4, 0, 64, 83, px(bodyCenter, rear) - bodyWidth / 2, ground - height, bodyWidth, height);
      else rect(px(bodyCenter, rear) - bodyWidth / 2, ground - height, bodyWidth, height, '#aa9a7e');
      const extension = Math.max(0, actor.width - 1.1);
      if (extension > 0.015) {
        // A hinged door grows only as far as the current occupied engine width.
        const hingeX = outer - side * 1.1, edgeX = outer - side * actor.width;
        const hinge = px(hingeX, rear), edge = px(edgeX, rear + 0.5);
        quad(hinge, ground - height * 0.8, edge, py(rear + 0.5) - height * 0.58,
          edge, py(rear + 0.5) - height * 0.14, hinge, ground - height * 0.12, '#bfa987');
        ctx.strokeStyle = '#f6cf7a'; ctx.lineWidth = Math.max(1.5, 2.5 * p); ctx.beginPath();
        ctx.moveTo(hinge, ground - height * 0.8); ctx.lineTo(edge, py(rear + 0.5) - height * 0.58);
        ctx.lineTo(edge, py(rear + 0.5) - height * 0.14); ctx.stroke();
        rect(edge - 2 * p, py(rear + 0.5) - height * 0.5, 4 * p, 12 * p, '#d67347');
      }
    } else if (actor.kind === 'cyclist') {
      const image = sprites?.rearCyclist?.(variant % 4), height = vertical(1.73, rear);
      if (image) ctx.drawImage(image, 4, 0, 32, image.height, x - width / 2, ground - height, width, height);
      else rect(x - width / 3, ground - height, width * 2 / 3, height, actor.color);
    } else {
      const bus = actor.kind === 'bus', heightM = bus ? 2.7 : 1.45;
      const height = vertical(heightM, rear), farHeight = vertical(heightM, front);
      const leftNear = px(actor.x - actor.width / 2, rear), rightNear = px(actor.x + actor.width / 2, rear);
      const leftFar = px(actor.x - actor.width / 2, front), rightFar = px(actor.x + actor.width / 2, front);
      // The roof and side continue to the front of the real wheelbase. Long
      // buses therefore occupy depth, rather than looking like narrow cards.
      quad(leftNear, ground - height * 0.73, leftFar, py(front) - farHeight * 0.73,
        rightFar, py(front) - farHeight * 0.73, rightNear, ground - height * 0.73, bus ? '#becbb2' : actor.color);
      const side = actor.x >= state.x ? -1 : 1;
      const nearSide = side < 0 ? leftNear : rightNear, farSide = side < 0 ? leftFar : rightFar;
      quad(nearSide, ground, farSide, py(front), farSide, py(front) - farHeight * 0.73,
        nearSide, ground - height * 0.73, bus ? '#577e70' : '#677d71');
      if (bus) {
        for (let i = 0; i < 5; i++) {
          const za = rear + 0.8 + i * 1.4, zb = Math.min(front - 0.3, za + 1.03);
          if (za >= front || zb <= za) continue;
          const worldX = actor.x + side * actor.width / 2;
          quad(px(worldX, za), py(za) - vertical(1.93, za), px(worldX, zb), py(zb) - vertical(1.93, zb),
            px(worldX, zb), py(zb) - vertical(1.05, zb), px(worldX, za), py(za) - vertical(1.05, za), '#43675f');
        }
      }
      const image = bus ? sprites?.rearBus?.() : sprites?.rearCar?.(variant);
      if (actualRear >= NEAR) {
        if (image) ctx.drawImage(image, 4, 0, bus ? 68 : 64, bus ? 115 : 83, x - width / 2, ground - height, width, height);
        else rect(x - width / 2, ground - height, width, height, actor.color);
      }
      // Real turn lamps remain distinct from the projected intent arrow.
      if (actor.turnSignal && (motionReduced() || Math.floor(state.elapsed * 3) % 2 === 0)) {
        const direction = actor.turnSignal < 0 ? -1 : 1;
        rect(x + direction * width * 0.34 - width * 0.055, ground - height * 0.31, width * 0.11, height * 0.08, '#ffce6c');
      }
    }
    ctx.globalAlpha = 1;
  }

  function intent(actor, index) {
    const relative = actor.z - state.distance, rear = relative - actor.length / 2;
    if (!actorVisible(actor) || relative < -2 || rear > warningFar) return;
    const door = actor.kind === 'door', color = door ? '#ffad69' : '#f9d581';
    const targetX = Number.isFinite(actor.targetX) ? actor.targetX : actor.x;
    const futureWidth = door ? Math.max(actor.width, actor.targetWidth || actor.width) : actor.width;
    const envelopeLeft = Math.min(actor.x - actor.width / 2, targetX - futureWidth / 2);
    const envelopeRight = Math.max(actor.x + actor.width / 2, targetX + futureWidth / 2);
    const near = Math.max(NEAR, rear), far = Math.min(actorFar, relative + actor.length / 2);
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, 2.6 * scale(near));
    ctx.setLineDash([4, 4]); ctx.beginPath();
    ctx.moveTo(px(envelopeLeft, near), py(near)); ctx.lineTo(px(envelopeRight, near), py(near));
    ctx.lineTo(px(envelopeRight, far), py(far)); ctx.lineTo(px(envelopeLeft, far), py(far)); ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]);
    const baseZ = Math.max(0, relative), y = py(baseZ) + 6;
    const from = px(actor.x, baseZ), to = px(targetX, baseZ);
    if (Math.abs(to - from) > 2) {
      const direction = Math.sign(to - from);
      ctx.beginPath(); ctx.moveTo(from, y); ctx.lineTo(to, y); ctx.lineTo(to - direction * 6, y - 5);
      ctx.moveTo(to, y); ctx.lineTo(to - direction * 6, y + 5); ctx.stroke();
    }
    ctx.restore();
    // Final overlay pass keeps the warning readable beside a bus or roof.
    const actorHeight = actor.kind === 'bus' ? 2.7 : actor.kind === 'cyclist' ? 1.73 : 1.45;
    const labelY = clamp(py(Math.max(NEAR, rear)) - vertical(actorHeight, Math.max(NEAR, rear)) - 11 - (index % 2) * 2, 178, 475);
    const position = warningLabels[index];
    label(door ? 'DOOR' : actor.kind === 'cyclist' ? 'DRIFT' : 'MERGE', survival ? position.x : clamp(px(actor.x, baseZ), 48, W - 48), survival ? position.y : labelY, color, Math.max(9, Math.min(11, 11 * scale(baseZ) + 3)));
  }
  function layoutWarningLabels() {
    for (let i = 0; i < warnings.length; i++) {
      const actor = warnings[i], relative = actor.z - state.distance, rear = relative - actor.length / 2;
      const height = actor.kind === 'bus' ? 2.7 : actor.kind === 'cyclist' ? 1.73 : 1.45;
      const position = warningLabels[i];
      position.x = clamp(px(actor.x, Math.max(0, relative)), 48, W - 48);
      position.y = clamp(py(Math.max(NEAR, rear)) - vertical(height, Math.max(NEAR, rear)) - 11 - (i % 2) * 2, 178, 475);
      ctx.font = `bold ${Math.max(9, Math.min(11, 11 * scale(Math.max(0, relative)) + 3))}px ui-monospace, monospace`;
      position.width = ctx.measureText(actor.kind === 'door' ? 'DOOR' : actor.kind === 'cyclist' ? 'DRIFT' : 'MERGE').width + 12;
      // At high pace several signalled actors converge near the horizon. Give
      // the nearest label its usual anchor and only shift overlapping distant
      // labels, using the same four reused slots as the warning cap.
      if (rear <= 45) continue;
      for (let attempt = 0; attempt < 4; attempt++) {
        let nextY = position.y;
        for (let j = 0; j < i; j++) {
          const previous = warningLabels[j];
          if (Math.abs(position.x - previous.x) < (position.width + previous.width) / 2 + 2 && Math.abs(position.y - previous.y) < 20) nextY = Math.max(nextY, previous.y + 20);
        }
        if (nextY === position.y) break;
        position.y = nextY;
      }
    }
  }
  function rider(bellPulseUntil) {
    const ground = py(-BIKE_LENGTH / 2), x = px(state.x, -BIKE_LENGTH / 2);
    const collisionWidth = BIKE_WIDTH * METRE * scale(-BIKE_LENGTH / 2);
    strip(state.x - BIKE_WIDTH / 2, state.x + BIKE_WIDTH / 2, -BIKE_LENGTH / 2, BIKE_LENGTH / 2,
      state.crashCooldown > 0.8 ? '#cd805c66' : '#25413655');
    if (state.assistActive && !motionReduced()) {
      for (let i = 0; i < 3; i++) {
        const z = -1.4 - i * 0.4, y = py(z);
        rect(px(state.x - 0.18, z), y, 2, 6 + i * 3, '#fff1a3a0');
        rect(px(state.x + 0.18, z), y, 2, 6 + i * 3, '#fff1a3a0');
      }
    }
    const image = sprites?.rearCourier?.({
      pedal: motionReduced() ? 0 : state.elapsed * state.speed * 0.3,
      assist: state.assistActive === true, damaged: state.crashCooldown > 0,
    });
    const height = vertical(1.91, -BIKE_LENGTH / 2);
    // Transparent sprite margins accommodate a tall courier while the opaque
    // handlebar and shoulders fit the same physical width as the collision box.
    const width = image ? collisionWidth * image.width / 50 : collisionWidth;
    ctx.save(); ctx.translate(x, ground); ctx.rotate((state.lean || 0) * 0.045);
    if (image) ctx.drawImage(image, -width / 2, -height, width, height);
    else {
      rect(-collisionWidth * 0.4, -height * 0.76, collisionWidth * 0.8, height * 0.5, '#d37f48');
      rect(-collisionWidth * 0.2, -height, collisionWidth * 0.4, height * 0.25, '#f0dfba');
      rect(-3, -height * 0.30, 6, height * 0.30, '#23403a');
    }
    ctx.restore();
    if (state.elapsed < bellPulseUntil) {
      const progress = clamp(1 - (bellPulseUntil - state.elapsed) / 0.65, 0, 1);
      ctx.save(); ctx.strokeStyle = '#ffe8a4'; ctx.globalAlpha = 1 - progress; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, ground - height * 0.65, 18 + progress * 37, 9 + progress * 14, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); ctx.restore();
    }
  }

  return {
    draw(nextState, { bellPulseUntil = 0 } = {}) {
      state = nextState;
      if (!state) return;
      survival = state.mode === 'survival' || state.mode === 'rush' && state.difficulty !== 'standard';
      warningFar = survival && Number.isFinite(state.warningDistance) ? Math.max(45, state.warningDistance) : 45;
      actorFar = survival ? Math.max(FAR, warningFar, Number.isFinite(state.lookAheadDistance) ? state.lookAheadDistance : FAR) : FAR;
      ctx.save(); ctx.imageSmoothingEnabled = false;
      const district = mod(state.stageIndex || 0, DISTRICTS.length);
      prepareBuildings(district);
      background(district); road(district); scenery(district);
      actors.length = 0; warnings.length = 0;
      for (const actor of state.traffic || []) {
        if (actors.length >= MAX_TRAFFIC) break;
        const relative = actor.z - state.distance;
        if (!actorVisible(actor)) continue;
        actors.push(actor);
        if (!actor.passed && relative >= -2 && relative - actor.length / 2 <= warningFar &&
          (actor.warningActive || !survival && actor.turnSignal || actor.kind === 'door' && actor.maneuverStarted)) warnings.push(actor);
      }
      actors.sort((a, b) => actorDepth(b) - actorDepth(a) || a.id - b.id);
      let impactActorId = null;
      for (let i = (state.events?.length || 0) - 1; i >= 0; i--) {
        const event = state.events[i];
        if (event.type === 'crash') {
          if (state.elapsed - event.time < 0.3) impactActorId = event.actorId;
          break;
        }
      }
      for (const actor of actors)
        footprint(actor, actor.id === impactActorId ? '#cd805c66' : '#203b3442');
      let riderDrawn = false;
      for (const actor of actors) {
        if (!riderDrawn && actorDepth(actor) - state.distance < -BIKE_LENGTH / 2) { rider(bellPulseUntil); riderDrawn = true; }
        actorBody(actor);
      }
      if (!riderDrawn) rider(bellPulseUntil);
      warnings.sort((a, b) => actorDepth(a) - actorDepth(b));
      if (warnings.length > 4) warnings.length = 4;
      if (survival) layoutWarningLabels();
      for (let i = warnings.length - 1; i >= 0; i--) intent(warnings[i], i);
      ctx.restore();
    },
    clear() { actors.length = 0; warnings.length = 0; state = null; },
  };
}
