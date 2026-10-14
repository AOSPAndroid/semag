/** Lockdown's connected 3D architecture, built with Semag's voxel mesh primitives.
 * The navigation grid is an authoring aid, not a visible cube for every cell.
 * Adjacent cells merge into walls/decks; only the external contour gets a face.
 * Ornament stays on blocked footprints or beyond the playable perimeter. */
import { PaintedMesh, MATERIAL as M } from './lockdown-painted-mesh.js';
import { FoliageBatch, dressPlants, wallProp } from './lockdown-world-dressing.js';
import { TILE, levelCell, STAIRS } from './lockdown-maps.js';
import { FLOOR_RISE, GROUND } from './lockdown-scene-geometry.js';
import { onMapSurface, insideSurface } from './lockdown-map-surfaces.js';

export const VERTICAL = Math.sqrt(1 - GROUND * GROUND);
export const STOREY = FLOOR_RISE / VERTICAL;
const TAU = Math.PI * 2;
const color = hex => [...[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255), 1];
const tint = (hex, amount) => color(hex).map((v, i) => i === 3 ? v : Math.min(1, v * amount));
export const WORLD_STYLES = Object.freeze({
  castle: { floor: '#bac2a4', wall: '#9ea98f', trim: '#c7cba9', roof: '#416d69', plant: '#659e42', pit: '#275d60', sky: '#78a29a', kind: 'keep', ground: M.paving, stone: M.masonry },
  maze: { floor: '#5b9744', wall: '#4e6941', trim: '#85b95b', roof: '#426c3b', plant: '#74b83f', pit: '#236569', sky: '#5a8c7c', kind: 'garden', ground: M.grass, stone: M.rock },
  foundry: { floor: '#344657', wall: '#932f35', trim: '#ad673b', roof: '#343247', plant: '#ca8356', pit: '#151e29', sky: '#202b3a', kind: 'industrial', ground: M.metal, stone: M.iron },
  ruins: { floor: '#acb798', wall: '#a4b095', trim: '#c8d0ad', roof: '#4d8b7b', plant: '#6aab48', pit: '#397e80', sky: '#81b6a6', kind: 'temple', ground: M.paving, stone: M.masonry },
  graveyard: { floor: '#758987', wall: '#6d817f', trim: '#b0bfb1', roof: '#414f66', plant: '#63916a', pit: '#293b49', sky: '#708d91', kind: 'crypt', ground: M.temple, stone: M.masonry },
  skyway: { floor: '#bac6a1', wall: '#849a74', trim: '#d2c995', roof: '#378b84', plant: '#6eaa40', pit: '#598b93', sky: '#83ada9', kind: 'sky', ground: M.paving, stone: M.masonry },
});

/** Greedy rectangles preserve the exact occupied footprint without tile seams. */
export function mergeCells(map, select) {
  const used = new Set(), rectangles = [];
  for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
    const key = select(col, row); if (key == null || used.has(row * map.cols + col)) continue;
    let w = 1, d = 1;
    while (col + w < map.cols && !used.has(row * map.cols + col + w) && select(col + w, row) === key) w++;
    outer: while (row + d < map.rows) {
      for (let x = col; x < col + w; x++) if (used.has((row + d) * map.cols + x) || select(x, row + d) !== key) break outer;
      d++;
    }
    for (let y = row; y < row + d; y++) for (let x = col; x < col + w; x++) used.add(y * map.cols + x);
    rectangles.push({ col, row, cols: w, rows: d, key, x: col * TILE, z: row * TILE, w: w * TILE, d: d * TILE });
  }
  return rectangles;
}

export function cylinder(mesh, x, y, z, radius, height, paint, sides = 20, topRadius = radius) {
  const c = typeof paint === 'string' ? color(paint) : paint;
  for (let i = 0; i < sides; i++) {
    const a = i * TAU / sides, b = (i + 1) * TAU / sides;
    const loA = [x + Math.cos(a) * radius, y, z + Math.sin(a) * radius], loB = [x + Math.cos(b) * radius, y, z + Math.sin(b) * radius];
    const hiA = [x + Math.cos(a) * topRadius, y + height, z + Math.sin(a) * topRadius], hiB = [x + Math.cos(b) * topRadius, y + height, z + Math.sin(b) * topRadius];
    const slope = (radius - topRadius) / Math.max(1, height), n = [Math.cos((a + b) / 2), slope, Math.sin((a + b) / 2)], len = Math.hypot(...n);
    mesh.quad(loA, hiA, hiB, loB, n.map(v => v / len), c);
    for (const p of [[x, y + height, z], hiB, hiA]) mesh.vertex(p, [0, 1, 0], c);
  }
}

function crown(mesh, x, y, z, radius, paint) {
  cylinder(mesh, x, y, z, radius * .55, radius * .52, paint, 9, radius);
  cylinder(mesh, x, y + radius * .52, z, radius, radius * .66, paint, 9, radius * .72);
  cylinder(mesh, x, y + radius * 1.18, z, radius * .72, radius * .4, paint, 9, 0);
}

function cloudPuff(mesh, x, y, z, rx, ry, rz, paint) {
  const c = color(paint), sides = 16, rings = 6;
  const point = (a, b) => [x + Math.cos(a) * Math.cos(b) * rx, y + Math.sin(b) * ry, z + Math.sin(a) * Math.cos(b) * rz];
  for (let j = 0; j < rings; j++) for (let i = 0; i < sides; i++) {
    const a = i * TAU / sides, b = (i + 1) * TAU / sides, lo = -Math.PI / 2 + j * Math.PI / rings, hi = lo + Math.PI / rings;
    const mid = (lo + hi) / 2, n = [Math.cos((a + b) / 2) * Math.cos(mid), Math.sin(mid), Math.sin((a + b) / 2) * Math.cos(mid)];
    mesh.quad(point(a, lo), point(a, hi), point(b, hi), point(b, lo), n, c);
  }
}

function arch(mesh, x, z, width, base, height, depth, paint) {
  const r = width / 2, thickness = 7, segments = 12;
  for (let i = 0; i < segments; i++) {
    const a = i * Math.PI / segments, b = (i + 1) * Math.PI / segments;
    const p = (angle, radius, dz) => [x + Math.cos(angle) * radius, base + height + Math.sin(angle) * radius, z + dz];
    const c = tint(paint, i % 2 ? 1 : .92);
    mesh.quad(p(a, r, 0), p(b, r, 0), p(b, r + thickness, 0), p(a, r + thickness, 0), [0, 0, -1], c);
    mesh.quad(p(a, r + thickness, depth), p(b, r + thickness, depth), p(b, r, depth), p(a, r, depth), [0, 0, 1], c);
    mesh.quad(p(a, r, depth), p(b, r, depth), p(b, r, 0), p(a, r, 0), [-Math.cos((a + b) / 2), -Math.sin((a + b) / 2), 0], c);
    mesh.quad(p(a, r + thickness, 0), p(b, r + thickness, 0), p(b, r + thickness, depth), p(a, r + thickness, depth), [Math.cos((a + b) / 2), Math.sin((a + b) / 2), 0], c);
  }
}

/** Steps occupy one navigation cell and meet both adjoining landings exactly. */
export function stairSolids(col, row, direction) {
  const [dx, dz] = STAIRS[direction], n = 8, size = TILE / n;
  return Array.from({ length: n }, (_, i) => ({
    x: col * TILE + (dx ? (dx > 0 ? i : n - 1 - i) * size : 0),
    z: row * TILE + (dz ? (dz > 0 ? i : n - 1 - i) * size : 0),
    w: dx ? size : TILE, d: dz ? size : TILE, h: (i + 1) * STOREY / n,
  }));
}

function tower(mesh, rect, base, style) {
  const { x, z, w, d } = rect, radius = Math.min(w, d) * .44, cx = x + w / 2, cz = z + d / 2;
  // A full foundation occupies the physical blocker; round drums and tapered
  // roofs above it break the silhouette without introducing invisible corners.
  cylinder(mesh, cx, base + 42, cz, radius, 48, style.wall, 20);
  cylinder(mesh, cx, base + 85, cz, radius + 4, 7, style.trim, 20);
  cylinder(mesh, cx, base + 92, cz, radius + 9, 43, style.roof, 20, 3);
  cylinder(mesh, cx, base + 135, cz, 3, 13, style.trim, 10, 0);
  for (const offset of [-.45, .45]) mesh.box(cx + offset * radius - 3, base + 59, z + d - 1, 6, 19, 2, '#293e46');
}

function dressWall(mesh, rect, style) {
  const { x, z, w, d, key } = rect, base = Number(key) * STOREY;
  const garden = style.kind === 'garden', small = Math.min(w, d) <= TILE * 1.1;
  const height = garden ? 22 : 72;
  if (style.kind === 'industrial') {
    mesh.paint(M.iron, () => mesh.box(x, base, z, w, height, d, style.wall));
    mesh.paint(M.metal, () => mesh.box(x + 4, base + height, z + 4, w - 8, 2, d - 8, style.roof));
    mesh.box(x, base + height - 3, z, w, 7, 4, '#9f3435');
    mesh.box(x, base + height - 3, z + d - 4, w, 7, 4, '#9f3435');
    mesh.box(x, base + height - 3, z, 4, 7, d, '#9f3435');
    mesh.box(x + w - 4, base + height - 3, z, 4, 7, d, '#9f3435');
    mesh.paint(M.hazard, () => mesh.box(x, base + 2, z, w, 8, d, style.trim));
    for (let px = x + 5; px < x + w; px += 64) {
      mesh.box(px, base, z + d - 7, 9, height + 5, 7, '#b74940');
      cylinder(mesh, px + 4, base + height + 5, z + d - 4, 4, 2, '#ebaf64', 10);
      mesh.box(px + 1, base + 26, z + d + .3, 6, 15, 1, '#b7eee2');
    }
    return;
  }
  if (w === TILE && d === TILE && (style.kind === 'temple' || style.kind === 'crypt')) {
    mesh.paint(style.stone, () => mesh.box(x, base, z, w, 9, d, style.wall));
    if (style.kind === 'temple') {
      cylinder(mesh, x + w / 2, base + 9, z + d / 2, 22, 8, style.trim, 16);
      cylinder(mesh, x + w / 2, base + 17, z + d / 2, 16, 57, style.wall, 16, 14);
      cylinder(mesh, x + w / 2, base + 74, z + d / 2, 22, 8, style.trim, 16);
    } else {
      mesh.box(x + 8, base + 9, z + 14, 32, 33, 15, style.wall);
      arch(mesh, x + 24, z + 14, 18, base, 37, 15, style.trim);
      mesh.box(x + 21, base + 16, z + 30, 6, 20, 1, style.roof);
      mesh.box(x + 15, base + 26, z + 30, 18, 5, 1, style.roof);
    }
    return;
  }
  mesh.paint(style.stone, () => mesh.box(x, base, z, w, height, d, style.wall));
  if (garden) {
    mesh.paint(M.leaves, () => mesh.floor(x, z, w, d, style.plant, base + height + .1));
    return;
  }
  // Continuous cornices and masonry courses, not a separate cap per grid tile.
  mesh.paint(M.masonry, () => mesh.box(x, base + height - 8, z, w, 8, d, style.trim));
  for (let y = 16; y < height - 8; y += 18) {
    mesh.box(x, base + y, z - .2, w, 1.2, d + .4, tint(style.wall, .8));
    for (let px = x + (y === 16 ? 25 : 49); px < x + w; px += 55) mesh.box(px, base + y - 14, z + d, 1, 14, .3, tint(style.wall, .8));
  }
  if (!small && w <= TILE * 4 && d <= TILE * 4) { tower(mesh, rect, base, style); return; }
  for (let px = x + 10; px < x + w - 8; px += 58) {
    mesh.box(px, base + height, z + 5, 22, 10, Math.max(12, d - 10), style.wall);
    if (w > 95) {
      const ax = px + 11;
      mesh.box(ax - 8, base + 15, z + d + .3, 16, 22, .6, style.roof);
      arch(mesh, ax, z + d + .9, 16, base, 37, .5, style.trim);
    }
  }
  if (d > 75 && w <= TILE) for (let pz = z + 25; pz < z + d; pz += 66) {
    cylinder(mesh, x + w / 2, base + height, pz, w * .35, 14, style.trim, 12);
    cylinder(mesh, x + w / 2, base + height + 14, pz, w * .42, 26, style.roof, 12, 0);
  }
}

/** Return actual GPU geometry plus structural data for traversal/render checks. */
export function buildLockdownWorld(map) {
  const mesh = new PaintedMesh(), foliage = new FoliageBatch(), style = WORLD_STYLES[map.theme] || WORLD_STYLES.castle;
  const floors = mergeCells(map, (c, r) => map.grid[r][c] !== '~' && !STAIRS[levelCell(map, c, r)] ? levelCell(map, c, r) : null);
  const walls = mergeCells(map, (c, r) => map.grid[r][c] === '#' ? levelCell(map, c, r) : null);
  const staircases = [];
  const pitY = map.theme === 'skyway' ? -160 : -35;
  mesh.floor(-map.width, -map.height, map.width * 3, map.height * 3, style.pit, pitY);
  // Broad irregular water/cloud bands give the environment depth outside the
  // playable contour. They never create false walkable ground inside the map.
  for (let i = 0; i < 40; i++) {
    const x = (i * 371 % (map.width + 800)) - 400, z = (i * 193 % (map.height + 600)) - 300;
    if (map.theme === 'skyway') {
      const radius = 70 + i % 4 * 23;
      cloudPuff(mesh, x, pitY + 6, z, radius, 15, radius * .52, '#dae5df');
      cloudPuff(mesh, x + radius * .25, pitY + 18, z, radius * .58, 24, radius * .42, '#e5eee4');
      cloudPuff(mesh, x - radius * .42, pitY + 12, z + 6, radius * .44, 19, radius * .38, '#e5eee4');
    }
    else mesh.floor(x, z, 60 + i % 4 * 50, 2 + i % 3, tint(style.pit, 1.08), pitY + .5);
  }
  if (map.surfaces) for (const surface of map.surfaces) {
    const points = surface.points, bottom = surface.kind === 'bridge' ? -35 : -88;
    mesh.paint(surface.kind === 'island' ? M.grass : style.ground, () => mesh.floorPolygon(points, style.floor, 0));
    for (let i = 0; i < points.length; i++) {
      const start = points[i], end = points[(i + 1) % points.length], dx = end[0] - start[0], dz = end[1] - start[1], length = Math.hypot(dx, dz);
      if (length < .001) continue;
      // The union has one outer contour: overlapping island/bridge outlines
      // must not leave a curb or a vertical face across a connected route.
      const divisions = Math.ceil(length / 8);
      for (let part = 0; part < divisions; part++) {
        const a = [start[0] + dx * part / divisions, start[1] + dz * part / divisions], b = [start[0] + dx * (part + 1) / divisions, start[1] + dz * (part + 1) / divisions];
        const outside = [(a[0] + b[0]) / 2 + dz / length * .15, (a[1] + b[1]) / 2 - dx / length * .15];
        if (map.surfaces.some(other => other !== surface && insideSurface(other, ...outside))) continue;
        mesh.paint(M.rock, () => mesh.quad([a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], bottom, b[1]], [a[0], bottom, a[1]], [dz / length, 0, -dx / length], color(style.wall)));
        // A lip is inset into the walkable top; the collision contour is the
        // outer edge of the same polygon consumed by movement and navigation.
        const nx = -dz / length * 12, nz = dx / length * 12;
        mesh.paint(M.grass, () => mesh.quad([a[0], .12, a[1]], [a[0] + nx, .12, a[1] + nz], [b[0] + nx, .12, b[1] + nz], [b[0], .12, b[1]], [0, 1, 0], color(style.trim)));
        if (part % 2 === 0) foliage.add(3, (a[0] + b[0]) / 2 + nx * .35, .1, (a[1] + b[1]) / 2 + nz * .35, 16 + part % 4 * 2);
      }
    }
    if (surface.kind === 'island') {
      const b = surface.bounds, x = (b.minX + b.maxX) / 2, z = (b.minY + b.maxY) / 2, radius = Math.min(b.maxX - b.minX, b.maxY - b.minY) * .42;
      mesh.paint(M.rock, () => cylinder(mesh, x, -180, z, radius * .36, 92, tint(style.wall, .81), 10, radius), .78);
    }
  }
  for (const f of floors) if (!map.surfaces || f.key === '1') mesh.paint(style.ground, () => mesh.floor(f.x, f.z, f.w, f.d, style.floor, Number(f.key) * STOREY));
  for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) {
    const tile = map.grid[r][c], lv = levelCell(map, c, r), x = c * TILE, z = r * TILE;
    if (tile === '~') continue;
    const y = lv === '1' ? STOREY : 0;
    if (STAIRS[lv]) {
      const steps = stairSolids(c, r, lv); staircases.push({ col: c, row: r, direction: lv, steps });
      for (const step of steps) {
        mesh.paint(style.stone, () => mesh.box(step.x, -1, step.z, step.w, step.h + 1, step.d, style.wall));
        mesh.paint(map.theme === 'foundry' ? M.metal : M.paving, () => mesh.floor(step.x, step.z, step.w, step.d, style.trim, step.h + .02), 1.08);
        // A narrow worn nose makes each connected tread readable at phone scale.
        if (STAIRS[lv][1]) mesh.floor(step.x, step.z + (STAIRS[lv][1] > 0 ? 0 : step.d - 1), step.w, 1, style.trim, step.h + .05);
        else mesh.floor(step.x + (STAIRS[lv][0] > 0 ? 0 : step.w - 1), step.z, 1, step.d, style.trim, step.h + .05);
      }
    } else if (tile !== '#' && (!map.surfaces || [[x, z], [x + TILE, z], [x, z + TILE], [x + TILE, z + TILE]].every(([px, pz]) => onMapSurface(map, px, pz)))) {
      // Painted materials run across cells. Broad garden paths meet the stairs,
      // while the grass shoulders remain fully walkable.
      if ((map.surfaces || map.theme === 'maze') && r >= 11 && r <= 13) mesh.paint(M.paving, () => mesh.floor(x, z, TILE, TILE, style.floor, y + .04));
      if (map.theme === 'foundry' && r === 12 && c % 2 === 0) mesh.floor(x + 11, z + 20, 25, 5, '#b8b093', y + .1);
    }
    // Only external/height boundaries receive a connected vertical face.
    for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const neighbor = map.grid[r + dr]?.[c + dc], nl = levelCell(map, c + dc, r + dr);
      if (STAIRS[lv]) continue;
      if (map.surfaces && lv === '0') continue;
      const bottom = neighbor == null || neighbor === '~' ? map.surfaces ? -42 : pitY - 12 : nl === '1' ? STOREY : 0;
      if (y <= bottom || STAIRS[nl]) continue;
      const face = [[x, y, z], [x + TILE, y, z], [x + TILE, y, z + TILE], [x, y, z + TILE]];
      const edge = dc === 1 ? [2, 1] : dc === -1 ? [0, 3] : dr === -1 ? [1, 0] : [3, 2];
      const a = face[edge[0]], b = face[edge[1]];
      mesh.paint(map.theme === 'foundry' ? M.iron : M.rock, () => mesh.quad(a, b, [b[0], bottom, b[2]], [a[0], bottom, a[2]], [dc, 0, dr], color(style.wall)));
      mesh.paint(map.theme === 'foundry' ? M.hazard : M.grass, () => {
        if (dc) mesh.box(x + (dc > 0 ? TILE - 8 : 0), y, z, 8, .3, TILE, style.trim);
        else mesh.box(x, y, z + (dr > 0 ? TILE - 8 : 0), TILE, .3, 8, style.trim);
      });
      if (map.theme !== 'foundry' && tile !== '#') for (let i = 0; i < 3; i++) {
        const px = dc ? x + (dc > 0 ? TILE - 4 : 4) : x + 8 + i * 16;
        const pz = dr ? z + (dr > 0 ? TILE - 4 : 4) : z + 8 + i * 16;
        foliage.add((c + r + i) % 11 === 0 ? 2 : 3, px, y + .2, pz, 18);
      }
      if ((c + r) % 3 === 0 && neighbor === '~') {
        // Buttresses are rooted in the bank, below the route surface.
        cylinder(mesh, x + TILE / 2, bottom, z + TILE / 2, 13, y - bottom - 3, tint(style.wall, .86), 7, 19);
      }
    }
  }
  for (const w of walls) {
    const prop = wallProp(map, w), base = Number(w.key) * STOREY;
    if (prop) {
      mesh.paint(style.stone, () => mesh.box(w.x, base, w.z, w.w, 6, w.d, style.wall));
      foliage.add(prop.kind, w.x + w.w / 2, base + 6, w.z + w.d - 2, prop.size);
    } else dressWall(mesh, w, style);
  }
  for (const w of walls) {
    const y = Number(w.key) * STOREY + .16, dx = 27, dz = 20;
    // Limit shadows to supported floor cells so they do not bridge a chasm.
    for (let r = Math.floor(w.z / TILE); r <= Math.floor((w.z + w.d + dz) / TILE); r++) for (let c = Math.floor(w.x / TILE); c <= Math.floor((w.x + w.w + dx) / TILE); c++) {
      if (map.grid[r]?.[c] !== '.' || levelCell(map, c, r) !== String(w.key)) continue;
      const x = c * TILE, z = r * TILE;
      // Clip the shadow to supported receiver cells.
      if (map.surfaces && ![[x, z], [x + TILE, z], [x, z + TILE], [x + TILE, z + TILE]].every(([px, pz]) => onMapSurface(map, px, pz))) continue;
      const loX = Math.max(x, w.x + dx), hiX = Math.min(x + TILE, w.x + w.w + dx), loZ = Math.max(z, w.z + dz), hiZ = Math.min(z + TILE, w.z + w.d + dz);
      if (hiX > loX && hiZ > loZ) mesh.paint(style.ground, () => mesh.floor(loX, loZ, hiX - loX, hiZ - loZ, style.floor, y), .72);
    }
  }
  // Each spawn is an authored healing pavilion with round columns and an arch.
  for (let team = 0; team < 2; team++) {
    const spots = map.spawns[team], x = spots.reduce((sum, p) => sum + p.x, 0) / spots.length;
    const z = Math.min(...spots.map(p => p.y)) - TILE / 2, base = levelCell(map, Math.floor(x / TILE), Math.floor(z / TILE)) === '1' ? STOREY : 0;
    const accent = team ? '#67c7c8' : '#d9ae61';
    arch(mesh, x, z - 10, 96, base, 38, 14, style.trim);
    // Posts are located in the already-blocked back wall, never on the base floor.
    for (const px of [x - 55, x + 55]) cylinder(mesh, px, base, z - 4, 8, 48, style.trim, 12);
    mesh.box(x - 16, base + 75, z - 9, 32, 23, 3, accent);
  }
  // Distinct landmarks outside bounds frame each arena without hidden blockers.
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const x = side < 0 ? -90 - i % 2 * 35 : map.width + 90 + i % 2 * 35, z = 90 + i * (map.height - 180) / 4;
    if (style.kind === 'garden' || style.kind === 'temple' || style.kind === 'crypt') {
      cylinder(mesh, x, -25, z, 9, 85, '#69644e', 9, 6); crown(mesh, x, 38, z, 52, style.plant);
    } else if (style.kind === 'industrial') {
      cylinder(mesh, x, -30, z, 38, 140 + i % 2 * 45, style.wall, 18); cylinder(mesh, x, 80, z, 42, 12, style.trim, 18);
    } else {
      cylinder(mesh, x, -150, z, 63, 140, tint(style.wall, .8), 8, 76);
      tower(mesh, { x: x - 38, z: z - 38, w: 76, d: 76 }, -20, style);
    }
  }
  dressPlants(map, foliage, STOREY);
  return { opaque: mesh.array, foliage: foliage.array, floors, walls, staircases, style };
}
