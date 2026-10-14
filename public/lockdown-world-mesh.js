/** Lockdown's connected 3D architecture, built with Semag's voxel mesh primitives.
 * The navigation grid is an authoring aid, not a visible cube for every cell.
 * Adjacent cells merge into walls/decks; only the external contour gets a face.
 * Ornament stays on blocked footprints or beyond the playable perimeter. */
import { VoxelMesh } from './voxel-renderer.js';
import { TILE, levelCell, STAIRS } from './lockdown-maps.js';
import { FLOOR_RISE, GROUND } from './lockdown-scene-geometry.js';
import { onMapSurface, insideSurface } from './lockdown-map-surfaces.js';

export const VERTICAL = Math.sqrt(1 - GROUND * GROUND);
export const STOREY = FLOOR_RISE / VERTICAL;
const TAU = Math.PI * 2;
const color = hex => [...[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255), 1];
const tint = (hex, amount) => color(hex).map((v, i) => i === 3 ? v : Math.min(1, v * amount));
export const WORLD_STYLES = Object.freeze({
  castle: { floor: '#b4ad92', wall: '#989888', trim: '#d7c7a0', roof: '#425e67', plant: '#687f50', pit: '#467c89', sky: '#b4cbd0', kind: 'keep' },
  maze: { floor: '#879574', wall: '#516c45', trim: '#9db778', roof: '#456640', plant: '#678b48', pit: '#486657', sky: '#b8cbb7', kind: 'garden' },
  foundry: { floor: '#71797a', wall: '#45565b', trim: '#ba8654', roof: '#344953', plant: '#ca8356', pit: '#d06137', sky: '#667e89', kind: 'industrial' },
  ruins: { floor: '#c2b28e', wall: '#aaa68b', trim: '#e5d1a0', roof: '#54877e', plant: '#74844c', pit: '#4f999a', sky: '#bcd5ca', kind: 'temple' },
  graveyard: { floor: '#8c9190', wall: '#737f86', trim: '#b0bebd', roof: '#424e66', plant: '#677778', pit: '#3c5262', sky: '#8dabbc', kind: 'crypt' },
  skyway: { floor: '#c8c2a4', wall: '#859c9a', trim: '#e5cc8f', roof: '#407e85', plant: '#75946a', pit: '#8cbbca', sky: '#bbd5dc', kind: 'sky' },
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
  const height = garden ? 46 : 62;
  if (w === TILE && d === TILE && (style.kind === 'temple' || style.kind === 'crypt')) {
    mesh.box(x, base, z, w, 9, d, style.wall);
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
  mesh.box(x, base, z, w, height, d, style.wall);
  if (garden) {
    for (let px = x + 18; px < x + w; px += 29) for (let pz = z + 18; pz < z + d; pz += 29) crown(mesh, px, base + 29, pz, 23, style.plant);
    return;
  }
  // Continuous cornices and masonry courses, not a separate cap per grid tile.
  mesh.box(x, base + height - 8, z, w, 8, d, style.trim);
  for (let y = 16; y < height - 8; y += 18) {
    mesh.box(x, base + y, z - .2, w, 1.2, d + .4, tint(style.wall, .8));
    for (let px = x + (y === 16 ? 25 : 49); px < x + w; px += 55) mesh.box(px, base + y - 14, z + d, 1, 14, .3, tint(style.wall, .8));
  }
  if (!small && w <= TILE * 4 && d <= TILE * 4 && style.kind !== 'industrial') { tower(mesh, rect, base, style); return; }
  if (style.kind === 'industrial') {
    if (!small) {
      cylinder(mesh, x + w / 2, base + height, z + d / 2, Math.min(w, d) * .43, 40, style.roof, 24);
      cylinder(mesh, x + w / 2, base + height + 33.2, z + d / 2, Math.min(w, d) * .45, 7, style.trim, 24);
    }
    for (let px = x + 16; px < x + w; px += 76) {
      mesh.box(px, base, z + d - 5, 8, height + 5, 5, style.trim);
      cylinder(mesh, px + 4, base + height, z + d / 2, 8, 22, style.roof, 10);
    }
    return;
  }
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
  const mesh = new VoxelMesh(), style = WORLD_STYLES[map.theme] || WORLD_STYLES.castle;
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
    const points = surface.points, bottom = surface.kind === 'bridge' ? -14 : -42;
    mesh.floorPolygon(points, style.floor, 0);
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
        mesh.quad([a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], bottom, b[1]], [a[0], bottom, a[1]], [dz / length, 0, -dx / length], color(style.wall));
        // A lip is inset into the walkable top; the collision contour is the
        // outer edge of the same polygon consumed by movement and navigation.
        const nx = -dz / length * 2, nz = dx / length * 2;
        mesh.quad([a[0], .1, a[1]], [a[0] + nx, .1, a[1] + nz], [b[0] + nx, .1, b[1] + nz], [b[0], .1, b[1]], [0, 1, 0], color(style.trim));
      }
    }
    if (surface.kind === 'island') {
      const b = surface.bounds, x = (b.minX + b.maxX) / 2, z = (b.minY + b.maxY) / 2, radius = Math.min(b.maxX - b.minX, b.maxY - b.minY) * .42;
      cylinder(mesh, x, -138, z, radius * .36, 96, tint(style.wall, .81), 10, radius);
    }
  }
  for (const f of floors) if (!map.surfaces || f.key === '1') mesh.floor(f.x, f.z, f.w, f.d, style.floor, Number(f.key) * STOREY);
  for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) {
    const tile = map.grid[r][c], lv = levelCell(map, c, r), x = c * TILE, z = r * TILE;
    if (tile === '~') continue;
    const y = lv === '1' ? STOREY : 0;
    if (STAIRS[lv]) {
      const steps = stairSolids(c, r, lv); staircases.push({ col: c, row: r, direction: lv, steps });
      for (const step of steps) {
        mesh.box(step.x, -1, step.z, step.w, step.h + 1, step.d, style.wall);
        mesh.floor(step.x, step.z, step.w, step.d, style.trim, step.h + .02);
      }
    } else if (tile !== '#' && (!map.surfaces || [[x, z], [x + TILE, z], [x, z + TILE], [x + TILE, z + TILE]].every(([px, pz]) => onMapSurface(map, px, pz)))) {
      // Large staggered paving stones are surface markings only; shared edges
      // stay coplanar and the navigation cell outline is never highlighted.
      mesh.floor(x + 1, z + 1, TILE - 2, TILE / 2 - 1, tint(style.floor, .96 + (c * 7 + r * 3) % 5 * .016), y + .04);
      mesh.floor(x + 1, z + TILE / 2 + 1, TILE - 2, TILE / 2 - 2, tint(style.floor, .98 + (c + r) % 3 * .016), y + .04);
      if (tile === '1' || tile === '2') mesh.floor(x + 3, z + 3, TILE - 6, TILE - 6, tile === '1' ? '#a68e60' : '#699999', y + .1);
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
      mesh.quad(a, b, [b[0], bottom, b[2]], [a[0], bottom, a[2]], [dc, 0, dr], color(style.wall));
      if (dc) mesh.box(x + (dc > 0 ? TILE - 3 : 0), y, z, 3, 2, TILE, style.trim);
      else mesh.box(x, y, z + (dr > 0 ? TILE - 3 : 0), TILE, 2, 3, style.trim);
      if ((c + r) % 3 === 0 && neighbor === '~') {
        // Buttresses are rooted in the bank, below the route surface.
        cylinder(mesh, x + TILE / 2, bottom, z + TILE / 2, 13, y - bottom - 3, tint(style.wall, .86), 7, 19);
      }
    }
  }
  for (const w of walls) dressWall(mesh, w, style);
  for (const w of walls) {
    const y = Number(w.key) * STOREY + .16, dx = 27, dz = 20;
    // Limit shadows to supported floor cells so they do not bridge a chasm.
    for (let r = Math.floor(w.z / TILE); r <= Math.floor((w.z + w.d + dz) / TILE); r++) for (let c = Math.floor(w.x / TILE); c <= Math.floor((w.x + w.w + dx) / TILE); c++) {
      if (map.grid[r]?.[c] !== '.' || levelCell(map, c, r) !== String(w.key)) continue;
      const x = c * TILE, z = r * TILE;
      // Clip the shadow to supported receiver cells.
      if (map.surfaces && ![[x, z], [x + TILE, z], [x, z + TILE], [x + TILE, z + TILE]].every(([px, pz]) => onMapSurface(map, px, pz))) continue;
      const loX = Math.max(x, w.x + dx), hiX = Math.min(x + TILE, w.x + w.w + dx), loZ = Math.max(z, w.z + dz), hiZ = Math.min(z + TILE, w.z + w.d + dz);
      if (hiX > loX && hiZ > loZ) mesh.floor(loX, loZ, hiX - loX, hiZ - loZ, tint(style.floor, .79), y);
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
  return { opaque: mesh.array, floors, walls, staircases, style };
}
