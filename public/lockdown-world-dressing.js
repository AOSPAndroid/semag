/** Painted cutouts decorate real geometry; they never alter navigation. */
import { TILE, levelCell, STAIRS } from './lockdown-maps.js';
import { surfaceSupportsBody } from './lockdown-map-surfaces.js';
import { GROUND } from './lockdown-scene-geometry.js';
const VERTICAL = Math.sqrt(1 - GROUND * GROUND);
export class FoliageBatch {
  constructor() { this.vertices = []; }
  add(kind, x, y, z, size) {
    const u = kind % 4 / 4, v = Math.floor(kind / 4) / 2;
    const top = y + size * 500 / 512 / VERTICAL, bottom = y - size * 12 / 512 / VERTICAL;
    const points = [[x-size/2,top,z,u,v], [x-size/2,bottom,z,u,v+.5], [x+size/2,bottom,z,u+.25,v+.5], [x+size/2,top,z,u+.25,v]];
    for (const i of [0,1,2,0,2,3]) this.vertices.push(...points[i]);
  }
  get array() { return new Float32Array(this.vertices); }
}
export function wallProp(map, wall) {
  const { w, d } = wall;
  if (map.theme === 'foundry') {
    if (w === TILE && d === TILE) return { kind: 7, size: 116 };
    if (w >= TILE * 2 && d >= TILE * 2 && w <= TILE * 3 && d <= TILE * 3) return { kind: 6, size: w * 1.16 };
  } else if (map.theme !== 'maze') {
    if (w === TILE && d === TILE) return { kind: map.theme === 'graveyard' ? 5 : 4, size: map.theme === 'graveyard' ? 53 : 116 };
    if (w >= TILE * 2 && d >= TILE * 2 && w <= TILE * 3 && d <= TILE * 3) return { kind: 5, size: w * 1.06 };
  }
  return null;
}
export function dressPlants(map, foliage, storey) {
  if (map.theme === 'foundry') return;
  for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) {
    const tile = map.grid[r][c], lv = levelCell(map, c, r), x = (c + .5) * TILE, z = (r + .5) * TILE;
    if (tile === '~' || STAIRS[lv]) continue;
    const y = lv === '1' ? storey : 0, seed = c * 17 + r * 31;
    if (tile === '#') {
      if (map.theme === 'maze') {
        foliage.add(0, x, y + 1, z + 17, 76 + seed % 9);
        if (seed % 4 === 0) foliage.add(1, x - 16, y + 1, z + 22, 32);
      } else if (seed % 3 === 0) {
        // Plants root on the cover's footprint, not in the middle of a route.
        foliage.add(1, x + 10, y + 1, z + 23, 38);
        foliage.add(3, x - 14, y + 1, z + 23, 23);
      }
      continue;
    }
    const nearWall = [[1,0],[-1,0],[0,1],[0,-1]].some(([dc,dr]) => map.grid[r+dr]?.[c+dc] === '#');
    if (nearWall && seed % 3 === 0 && surfaceSupportsBody(map, x, z, 22)) {
      foliage.add(seed % 2 ? 2 : 3, x - 12, y + .3, z + 17, seed % 2 ? 21 : 18);
    }
  }
}
