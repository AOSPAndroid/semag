/** Shared projection contract for all Lockdown architecture. World collision stays unchanged. */
import { TILE, STAIRS, levelCell } from './lockdown-maps.js';

export const GROUND = .75;
export const FLOOR_RISE = 24;
export const PIT_DROP = 28;
export const POINT_PLATE_DIAMETER = 104;

/** Exact projected treads, local to a 48 × (36 + 24) stair cell.
 * The first/last surface meets the neighbouring floor; there is no sprite padding. */
export function stairSurfaces(direction) {
  if (!Object.hasOwn(STAIRS, direction)) return [];
  const count = 6, depth = TILE * GROUND, rise = FLOOR_RISE;
  return Array.from({ length: count }, (_, i) => {
    if (direction === '^') return {
      x: 0, y: i * (depth + rise) / count, width: TILE, height: depth / count,
      face: [0, i * (depth + rise) / count + depth / count, TILE, rise / count],
      u: 0, v: i * TILE / count, uw: TILE, vh: TILE / count,
    };
    if (direction === 'v') return {
      x: 0, y: rise + i * (depth - rise) / count, width: TILE, height: (depth - rise) / count,
      face: null, u: 0, v: i * TILE / count, uw: TILE, vh: TILE / count,
    };
    const step = direction === '>' ? i : count - 1 - i, lift = (step + 1) * rise / count;
    return {
      x: i * TILE / count, y: rise - lift, width: TILE / count, height: depth,
      face: [i * TILE / count, rise - lift + depth, TILE / count, lift],
      u: i * TILE / count, v: 0, uw: TILE / count, vh: TILE,
    };
  });
}

/** Only exposed edges get a rim. A stair's landing is an open connection. */
export function exposedFloorEdges(map, col, row) {
  const height = levelCell(map, col, row) === '1' ? 1 : 0;
  return [[0, -1, 'north'], [1, 0, 'east'], [0, 1, 'south'], [-1, 0, 'west']].filter(([dx, dy]) => {
    const cell = map.grid[row + dy]?.[col + dx];
    if (cell === undefined || cell === '~') return true;
    if (cell === '#') return false;
    const next = levelCell(map, col + dx, row + dy), stair = STAIRS[next];
    if (stair && (height ? stair[0] === -dx && stair[1] === -dy : stair[0] === dx && stair[1] === dy)) return false;
    return height > (next === '1' ? 1 : 0);
  }).map(([, , name]) => name);
}

/** Mirrored texture repeats share the same boundary texel, without visible atlas seams. */
export function materialCell(col, row, span) {
  const axis = value => {
    const block = Math.floor(value / span), part = ((value % span) + span) % span, flip = Math.abs(block % 2) === 1;
    return { part: flip ? span - 1 - part : part, flip };
  };
  return { x: axis(col), y: axis(row) };
}

/** Portrait still shows the approaches around a point, while keeping a knight readable. */
export function sceneWorldWidth(width, height) {
  return Math.min(1100, Math.max(600, 820 * width / Math.max(1, height)));
}

export function sceneZoom(width, height, mapHeight) {
  return Math.max(width / sceneWorldWidth(width, height), height / (mapHeight * GROUND + 80));
}
