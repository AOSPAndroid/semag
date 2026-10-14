/** Authored, continuous ground outlines. Shared by physics and 3D presentation. */
const TAU = Math.PI * 2;
const disc = (id, x, y, radius) => ({ id, kind: 'island', points: Array.from({ length: 48 }, (_, i) => [x + Math.cos(i * TAU / 48) * radius, y + Math.sin(i * TAU / 48) * radius]) });
const rounded = (id, x, y, w, h, radius, kind = 'bridge') => {
  const points = [];
  for (const [cx, cy, start] of [[x + w - radius, y + h - radius, 0], [x + radius, y + h - radius, Math.PI / 2], [x + radius, y + radius, Math.PI], [x + w - radius, y + radius, Math.PI * 1.5]]) {
    for (let i = 0; i <= 8; i++) { const a = start + i * Math.PI / 16; points.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]); }
  }
  return { id, kind, points };
};
const freezeSurface = surface => Object.freeze({ ...surface,
  bounds: Object.freeze({ minX: Math.min(...surface.points.map(p => p[0])), maxX: Math.max(...surface.points.map(p => p[0])), minY: Math.min(...surface.points.map(p => p[1])), maxY: Math.max(...surface.points.map(p => p[1])) }),
  points: Object.freeze(surface.points.map(Object.freeze)),
});

export const SKY_SURFACES = Object.freeze([
  rounded('west-sanctuary', 48, 48, 288, 1104, 64, 'island'),
  rounded('east-sanctuary', 1680, 48, 288, 1104, 64, 'island'),
  rounded('central-crossing', 192, 556, 1632, 88, 12),
  rounded('north-walk', 192, 96, 1632, 48, 8),
  rounded('south-walk', 192, 1056, 1632, 48, 8),
  rounded('west-link', 528, 120, 48, 960, 8),
  rounded('east-link', 1440, 120, 48, 960, 8),
  disc('a-court', 552, 600, 176), disc('b-court', 1008, 600, 190), disc('c-court', 1464, 600, 176),
  rounded('northwest-terrace', 480, 192, 240, 96, 22, 'terrace'),
  rounded('northeast-terrace', 1296, 192, 240, 96, 22, 'terrace'),
  rounded('southwest-terrace', 480, 912, 240, 96, 22, 'terrace'),
  rounded('southeast-terrace', 1296, 912, 240, 96, 22, 'terrace'),
  // The north-facing landings join the upper loop to the raised terraces.
  rounded('northwest-landing', 576, 96, 48, 144, 0),
  rounded('northeast-landing', 1392, 96, 48, 144, 0),
  rounded('southwest-landing', 576, 960, 48, 144, 0),
  rounded('southeast-landing', 1392, 960, 48, 144, 0),
].map(freezeSurface));

export function insideSurface(surface, x, y) {
  const b = surface.bounds;
  if (x < b.minX - .001 || x > b.maxX + .001 || y < b.minY - .001 || y > b.maxY + .001) return false;
  // Convex outlines are counter-clockwise; include their boundary.
  for (let i = 0; i < surface.points.length; i++) {
    const a = surface.points[i], b = surface.points[(i + 1) % surface.points.length];
    if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < -.001) return false;
  }
  return true;
}
export const onMapSurface = (map, x, y) => !map.surfaces || map.surfaces.some(surface => insideSurface(surface, x, y));

/** Test the body's circumference against the union (seams between overlapping
 * bridge/island polygons are walkable, unlike independently shrinking shapes). */
export function surfaceSupportsBody(map, x, y, radius) {
  if (!onMapSurface(map, x, y)) return false;
  for (let i = 0; i < 16; i++) if (!onMapSurface(map, x + Math.cos(i * TAU / 16) * radius, y + Math.sin(i * TAU / 16) * radius)) return false;
  return true;
}
