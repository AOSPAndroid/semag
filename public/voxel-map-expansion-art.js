/** Static surface finishes for the expanded dojo and Crownfall environments.
 * Every solid is the original collision box. Ornament is millimetre-thin paint
 * on its faces, never extra cover, an invented step, or a decorative opening.
 */
export const MAP_EXPANSION_ATMOSPHERE = Object.freeze({
  'dojo-lantern': Object.freeze({ sun: [-.22, .94, .24], direct: [.36, .28, .18], ambient: [.72, .64, .52], top: '#343e3e', horizon: '#9b8870', sunColor: '#ffe0a1' }),
  'dojo-iron': Object.freeze({ sun: [.35, .88, -.31], direct: [.47, .54, .63], ambient: [.51, .57, .63], top: '#7093ae', horizon: '#d9e2e7', sunColor: '#eef5ff' }),
  medieval: Object.freeze({ sun: [-.52, .78, .36], direct: [.63, .52, .36], ambient: [.48, .53, .60], top: '#728fa7', horizon: '#e4d4b5', sunColor: '#ffe6b2' }),
});
export const MAP_EXPANSION_ART = Object.freeze({
  'dojo-lantern': Object.freeze({ paving: '#9a7a54', accent: '#e8c083', skyline: '#5f776d', cloud: '#eddfc7', tile: 2 }),
  'dojo-iron': Object.freeze({ paving: '#64747f', accent: '#e2b45f', skyline: '#647b8c', cloud: '#edf2f4', tile: 3 }),
  medieval: Object.freeze({ paving: '#938f77', accent: '#cbb377', skyline: '#737f7d', cloud: '#eee3ce', tile: 3.2 }),
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rgba = color => Array.isArray(color) ? color : [1, 3, 5].map(at => parseInt(color.slice(at, at + 2), 16) / 255).concat(1);
const shade = (color, amount) => rgba(color).map((value, at) => at === 3 ? value : clamp(value * amount, 0, 1));
const hash = value => { let result = 2166136261; for (const character of String(value)) result = Math.imul(result ^ character.charCodeAt(0), 16777619); return result >>> 0; };
const FACES = Object.freeze(['north', 'south', 'west', 'east']);

function surface(mesh, box, face, left, bottom, width, height, color, offset = .004) {
  const { x, y, z, w, h, d } = box, span = face === 'north' || face === 'south' ? w : d;
  // Clip both axes, including tiny posts and short stair risers. No material
  // can grow geometry beyond the engine's minimum-corner box footprint.
  const lowX = Math.max(.012, left), lowY = Math.max(.012, bottom);
  const highX = Math.min(span - .012, left + width), highY = Math.min(h - .012, bottom + height);
  if (highX <= lowX || highY <= lowY) return;
  const a = y + lowY, b = y + highY, c = rgba(color);
  if (face === 'north') mesh.quad([x + lowX, a, z - offset], [x + lowX, b, z - offset], [x + highX, b, z - offset], [x + highX, a, z - offset], [0, 0, -1], c);
  if (face === 'south') mesh.quad([x + highX, a, z + d + offset], [x + highX, b, z + d + offset], [x + lowX, b, z + d + offset], [x + lowX, a, z + d + offset], [0, 0, 1], c);
  if (face === 'west') mesh.quad([x - offset, a, z + highX], [x - offset, b, z + highX], [x - offset, b, z + lowX], [x - offset, a, z + lowX], [-1, 0, 0], c);
  if (face === 'east') mesh.quad([x + w + offset, a, z + lowX], [x + w + offset, b, z + lowX], [x + w + offset, b, z + highX], [x + w + offset, a, z + highX], [1, 0, 0], c);
}
function underside(mesh, box, left, front, width, depth, color, offset = .005) {
  const a = Math.max(.012, left), b = Math.max(.012, front), c = Math.min(box.w - .012, left + width), d = Math.min(box.d - .012, front + depth);
  if (c <= a || d <= b) return;
  const y = box.y - offset;
  mesh.quad([box.x + a, y, box.z + b], [box.x + c, y, box.z + b], [box.x + c, y, box.z + d], [box.x + a, y, box.z + d], [0, -1, 0], rgba(color));
}
function top(mesh, box, left, front, width, depth, color, offset = .004) {
  const a = Math.max(.012, left), b = Math.max(.012, front), c = Math.min(box.w - .012, left + width), d = Math.min(box.d - .012, front + depth);
  if (c > a && d > b) mesh.floor(box.x + a, box.z + b, c - a, d - b, color, box.y + box.h + offset);
}

function lanternFinish(mesh, box) {
  const material = String(box.material), { w, h, d } = box;
  for (const face of FACES) {
    const width = face === 'north' || face === 'south' ? w : d;
    const patch = (left, bottom, ww, hh, color, offset) => surface(mesh, box, face, left, bottom, ww, hh, color, offset);
    if (material === 'shoji') {
      patch(.02, .02, width - .04, h - .04, '#e9ddba');
      const columns = clamp(Math.ceil(width / .55), 1, 12), rows = clamp(Math.ceil(h / .66), 1, 8);
      for (let i = 1; i < columns; i++) patch(i * width / columns, .025, .040, h - .05, '#785a40', .012);
      for (let i = 1; i < rows; i++) patch(.025, i * h / rows, width - .05, .040, '#785a40', .012);
      for (const left of [.026, width - .067]) patch(left, .025, .040, h - .05, '#614c37', .020);
    } else if (material === 'dojo-cedar') {
      for (const fraction of [.24, .55, .81]) patch(width * fraction, .026, Math.min(.021, width * .04), h - .052, '#65442f');
      if (width > .8 && h > .25) { patch(.03, .035, width - .06, .035, '#bd9666', .012); patch(.03, h - .065, width - .06, .029, '#bd9666', .012); }
    } else if (material === 'lantern') {
      patch(.025, .045, width - .05, h - .09, '#ffe1a0');
      for (const fraction of [.22, .49, .76]) patch(width * fraction, .080, .024, h - .16, '#99764b', .012);
      patch(.03, .045, width - .06, .024, '#725438', .012); patch(.03, h - .075, width - .06, .024, '#725438', .012);
      patch(width * .39, h * .38, width * .23, h * .20, '#fff0bd', .020);
    } else if (material === 'dojo-plaster') {
      patch(.025, .035, width - .05, Math.min(.24, h * .12), '#785d43');
      patch(.025, h - .22, width - .05, .085, '#a48b66');
      if (h > 1.8 && width > 1.5) for (let at = 1.9; at < width - .3; at += Math.max(2.8, width / 8)) patch(at, .31, .032, h - .57, '#baaa8c');
    } else if (material === 'dojo-roof') {
      patch(.025, .025, width - .05, .025, '#2d3935');
      for (let at = .2; at < width - .10; at += Math.max(.85, width / 12)) patch(at, .065, .040, h - .10, '#728376');
    } else {
      patch(.025, .05, width - .05, .023, '#777565');
      if (h > .5) patch(.025, h * .52, width - .05, .019, '#635f50');
    }
  }
  if (material === 'dojo-roof' && box.overhead) {
    underside(mesh, box, 0, 0, w, d, '#735538', .004);
    for (let at = .10; at < w - .05; at += Math.max(1.8, w / 12)) underside(mesh, box, at, .02, .14, d - .04, '#4b3829', .012);
    for (let at = .10; at < d - .05; at += Math.max(1.8, d / 12)) underside(mesh, box, .02, at, w - .04, .14, '#4b3829', .012);
  } else if (material === 'dojo-cedar' && w > .7 && d > .4) {
    top(mesh, box, .025, .025, w - .05, d - .05, '#a5784b');
    for (let at = .18; at < d - .06; at += Math.max(.70, d / 10)) top(mesh, box, .025, at, w - .05, .035, '#65442f', .012);
  }
}

function ironFinish(mesh, box) {
  const material = String(box.material), id = String(box.id), { w, h, d } = box;
  for (const face of FACES) {
    const width = face === 'north' || face === 'south' ? w : d;
    const patch = (left, bottom, ww, hh, color, offset) => surface(mesh, box, face, left, bottom, ww, hh, color, offset);
    if (/crate/.test(material)) {
      const rows = clamp(Math.round(h / .4), 1, 5);
      for (let i = 1; i < rows; i++) patch(.025, i * h / rows, width - .05, .024, '#654f39');
      for (const fraction of [.11, .83]) patch(width * fraction, .03, Math.min(.065, width * .07), h - .06, '#b09165', .012);
      continue;
    }
    if (/concrete/.test(material)) {
      patch(.025, .045, width - .05, Math.min(.1, h * .15), '#53636a');
      if (h > .8 && width > .8) { patch(.025, h * .52, width - .05, .018, '#708086'); patch(width * .31, .025, .018, h - .05, '#708086'); }
    } else {
      patch(.022, .022, width - .044, h - .044, '#4c6472');
      patch(.035, .035, width - .07, .040, '#92a7ae', .012); patch(.035, h - .075, width - .07, .040, '#273d47', .012);
      if (width > .3 && h > .2) for (const fraction of [.12, .85]) for (const bottom of [.08, h - .11]) patch(width * fraction, bottom, .030, .030, '#c2ced0', .020);
      if (/panel/.test(material) && width > .8 && h > .8) {
        patch(width * .18, h * .19, width * .64, h * .62, '#203842', .012);
        for (let row = 0; row < 4; row++) patch(width * .23, h * (.29 + row * .10), width * .54, .040, '#6f8a97', .020);
      }
    }
    if (/hazard/.test(material) || /backstop|gantry|cover/.test(id) && width > 1.1 && h > .4) {
      const band = Math.min(.14, h * .23), bottom = Math.min(h - band - .03, .18);
      patch(.025, bottom, width - .05, band, '#dcb265', .012);
      const segments = clamp(Math.ceil(width / .56), 1, 12);
      for (let i = 0; i < segments; i++) patch(.03 + i * (width - .06) / segments, bottom + .025, (width - .06) / segments * .38, band - .05, '#354650', .020);
    }
  }
  if (/grate/.test(material)) {
    top(mesh, box, .018, .018, w - .036, d - .036, '#4b616c');
    for (let at = .12; at < w - .05; at += Math.max(.72, w / 16)) top(mesh, box, at, .025, .040, d - .05, '#95a8ab', .012);
    for (let at = .12; at < d - .05; at += Math.max(.80, d / 16)) top(mesh, box, .025, at, w - .05, .040, '#95a8ab', .012);
    top(mesh, box, .045, .045, Math.min(.05, w * .1), d - .09, '#e3b45c', .020);
    top(mesh, box, w - .09, .045, Math.min(.05, w * .1), d - .09, '#e3b45c', .020);
  }
}

function heraldry(patch, width, h) {
  const ww = Math.min(.67, width * .33), hh = Math.min(1.24, h * .46), left = (width - ww) / 2, bottom = h * .49 - hh * .25;
  patch(left, bottom, ww, hh, '#913d43', .012);
  patch(left + ww * .10, bottom + hh * .13, ww * .80, .035, '#e7ce89', .020);
  patch(left + ww * .46, bottom + hh * .24, ww * .08, hh * .57, '#e7ce89', .020);
  patch(left + ww * .23, bottom + hh * .56, ww * .54, hh * .07, '#e7ce89', .020);
  // A small crown rather than a pretend window hole identifies the keep.
  for (const fraction of [.21, .46, .71]) patch(left + ww * fraction, bottom + hh * .73, ww * .10, hh * .15, '#e7ce89', .020);
}
function medievalFinish(mesh, box) {
  const material = String(box.material), id = String(box.id), { w, h, d } = box;
  const dark = '#625e52', mortar = '#5c6058', pale = '#b0ac92';
  if (material === 'castle-floor' || material === 'castle-stair') {
    // Thin galleries and solid treads need paving, rather than full wall art.
    for (const face of FACES) surface(mesh, box, face, .025, h - .07,
      face === 'north' || face === 'south' ? w - .05 : d - .05, .025, pale);
    for (let i = 1; i < Math.min(4, Math.ceil(w / 2)); i++) top(mesh, box, i * w / Math.min(4, Math.ceil(w / 2)), .025, .025, d - .05, mortar);
    for (let i = 1; i < Math.min(4, Math.ceil(d / 2)); i++) top(mesh, box, .025, i * d / Math.min(4, Math.ceil(d / 2)), w - .05, .025, mortar);
    return;
  }
  for (const face of FACES) {
    const width = face === 'north' || face === 'south' ? w : d;
    const patch = (left, bottom, ww, hh, color, offset) => surface(mesh, box, face, left, bottom, ww, hh, color, offset);
    if (/timber|wood/.test(material)) {
      const columns = clamp(Math.ceil(width / .40), 1, 8);
      for (let i = 1; i < columns; i++) patch(i * width / columns, .025, .018, h - .05, '#533d2b');
      for (const fraction of [.20, .61]) patch(width * fraction, .12, Math.min(.08, width * .09), Math.min(.022, h * .04), '#b18d62', .005);
      if (h > .6 && width > .7) for (const fraction of [.20, .73]) { patch(.025, h * fraction, width - .05, .055, '#454d48', .012); for (const u of [.12, .84]) patch(width * u, h * fraction + .014, .025, .025, '#b2a887', .020); }
    } else if (/slate|roof/.test(material)) {
      for (let i = 1; i < 4; i++) patch(.025, h * i / 4, width - .05, .014, '#6c797e');
    } else if (/iron/.test(material)) {
      patch(.025, .025, width - .05, .026, '#84918d');
      if (width > .25) for (const fraction of [.12, .83]) patch(width * fraction, h * .48, .035, .035, '#c2bda7', .012);
    } else if (/gold/.test(material)) {
      patch(.026, h * .25, width - .052, Math.min(.032, h * .10), '#f0d696');
    } else if (/heraldic/.test(material)) {
      heraldry(patch, width, h);
    } else {
      // Four courses and at most four joints per face bound the entire castle
      // mesh even when its Royale village contains hundreds of solids.
      const courses = /story-/.test(id) ? 3 : 4;
      const rows = clamp(Math.round(h / .66), 1, courses), columns = clamp(Math.round(width / 1.18), 1, courses);
      for (let row = 1; row < rows; row++) patch(.025, row * h / rows, width - .05, .024, mortar);
      for (let row = 0; row < rows; row++) for (let column = 1; column < columns; column++) {
        const left = (column + (row % 2) * .31) * width / columns;
        patch(left, row * h / rows + .035, .024, h / rows - .07, mortar);
      }
      if (width > .5 && h > .3) { patch(.03, h - .09, width - .06, .035, pale, .012); patch(.03, .065, width - .06, .030, dark, .012); }
      if (width > 1.4 && h > 2.5 && /tower|keep|gatehouse|battlement|hall/.test(id) && hash(`${id}:${face}`) % 3 === 0) heraldry(patch, width, h);
      if (width > 2.8 && h > 2.8 && /tower|keep|hall/.test(id) && hash(`${id}:${face}`) % 3 === 1) {
        // Leaded, reflective closed glass painted on the solid wall. The
        // bright mullion makes clear this is a sealed window, not a route.
        const left = width * .5 - .21, bottom = h * .58;
        // Four non-overlapping frame strips leave one glazing layer and one
        // raised lead/reflection layer, all within 20mm of the true wall.
        patch(left - .065, bottom - .065, .55, .065, '#bab299', .012);
        patch(left - .065, bottom + .71, .55, .065, '#bab299', .012);
        patch(left - .065, bottom, .065, .71, '#bab299', .012);
        patch(left + .42, bottom, .065, .71, '#bab299', .012);
        patch(left, bottom, .42, .71, '#56787b', .012);
        patch(left + .045, bottom + .40, .12, .21, '#9db1a5', .020);
        patch(left + .20, bottom, .035, .71, '#d0bf90', .020);
        patch(left, bottom + .35, .42, .035, '#d0bf90', .020);
      }
      if (width > .75 && h > .4 && hash(`${id}:${face}`) % 4 === 0) patch(width * .18, .11, Math.min(.37, width * .3), .065, '#819076', .012);
    }
  }
  if (/slate|roof/.test(material)) {
    top(mesh, box, .025, .025, w - .05, d - .05, '#4c6069');
    for (let at = .14; at < d - .07; at += Math.max(.72, d / 10)) top(mesh, box, .025, at, w - .05, .040, '#879294', .012);
    for (let at = .24; at < w - .07; at += Math.max(1.0, w / 10)) top(mesh, box, at, .025, .035, d - .05, '#879294', .012);
  } else if (/timber|wood/.test(material)) {
    top(mesh, box, .025, .025, w - .05, d - .05, '#a18056');
    for (let at = .16; at < d - .06; at += Math.max(.72, d / 10)) top(mesh, box, .025, at, w - .05, .035, '#66503a', .012);
  } else if (!/iron|gold|heraldic/.test(material)) top(mesh, box, .035, .035, w - .07, d - .07, shade(box.color || '#979580', 1.055));
}

/** Returns false for every legacy theme, preserving its existing artwork. */
export function appendVoxelMapExpansionCollider(mesh, box, theme) {
  if (!Object.hasOwn(MAP_EXPANSION_ART, theme)) return false;
  mesh.box(box.x, box.y, box.z, box.w, box.h, box.d, box.color || MAP_EXPANSION_ART[theme].paving);
  if (box.h < .06) return true;
  if (theme === 'dojo-lantern') lanternFinish(mesh, box);
  else if (theme === 'dojo-iron') ironFinish(mesh, box);
  else medievalFinish(mesh, box);
  return true;
}

/** Surface paint for new training floors, kept within each authored rectangle. */
export function appendVoxelMapExpansionFloor(mesh, decoration, theme, y) {
  const { x, z, w, d, kind = '' } = decoration;
  if (theme === 'dojo-iron' && /concrete-floor|range-asphalt/.test(kind)) {
    for (let at = .04; at < d - .03; at += Math.max(2.4, d / 24)) mesh.floor(x + .03, z + at, w - .06, .040, '#465b65', y + .008);
    for (let at = 1.4; at < w - .03; at += Math.max(2.4, w / 20)) mesh.floor(x + at, z + .03, .040, d - .06, '#465b65', y + .008);
    return true;
  }
  if (theme === 'dojo-iron' && kind === 'hazard-stripe') {
    const alongX = w >= d, length = (alongX ? w : d) - .03, count = clamp(Math.round(length / .55), 1, 64);
    for (let i = 0; i < count; i++) mesh.floor(x + .015 + (alongX ? i * length / count : 0), z + .015 + (alongX ? 0 : i * length / count), alongX ? length / count * .48 : w - .03, alongX ? d - .03 : length / count * .48, '#283d47', y + .008);
    return true;
  }
  return false;
}

function subtractRectangle(rect, mask) {
  const left = Math.max(rect.x, mask.x), right = Math.min(rect.x + rect.w, mask.x + mask.w);
  const front = Math.max(rect.z, mask.z), back = Math.min(rect.z + rect.d, mask.z + mask.d);
  if (right <= left || back <= front) return [rect];
  return [
    { x: rect.x, z: rect.z, w: left - rect.x, d: rect.d },
    { x: right, z: rect.z, w: rect.x + rect.w - right, d: rect.d },
    { x: left, z: rect.z, w: right - left, d: front - rect.z },
    { x: left, z: back, w: right - left, d: rect.z + rect.d - back },
  ].filter(item => item.w > .00001 && item.d > .00001);
}
function clipRectangle(rect, masks) {
  let regions = [rect];
  for (const mask of masks) regions = regions.flatMap(item => subtractRectangle(item, mask));
  return regions;
}
function floorSupport(map, decoration) {
  if (!(decoration.y > .10)) return 0;
  const supports = (map.colliders || []).filter(box => box.y + box.h <= decoration.y + .025
    && decoration.x >= box.x - .001 && decoration.x + decoration.w <= box.x + box.w + .001
    && decoration.z >= box.z - .001 && decoration.z + decoration.d <= box.z + box.d + .001);
  return supports.length ? Math.max(...supports.map(box => box.y + box.h)) : 0;
}

/** Resolve a sign to one complete real wall face. A malformed or oversized
 * panel is omitted rather than stretched across neighbouring door jambs. */
export function resolveVoxelWallSign(map, decoration) {
  if (decoration.kind !== 'wall-sign' || !FACES.includes(decoration.face)) return null;
  const wall = (map.colliders || []).find(item => item.id === decoration.colliderId);
  if (!wall) return null;
  const { left, bottom, w, h } = decoration;
  const span = decoration.face === 'north' || decoration.face === 'south' ? wall.w : wall.d;
  if (![left, bottom, w, h].every(Number.isFinite) || left < .025 || bottom < .025 || w < .4 || h < .25
    || left + w > span - .025 || bottom + h > wall.h - .025) return null;
  return { ...decoration, wall };
}

const IDENTITY_THEMES = new Set(['snow', 'sewers', 'trading', 'paris']);

/** Shared floor-layer plan for outdoor routes and genuine office/Paris rooms.
 * Later authored paths take precedence, room interiors remain on their own
 * support level, and every background rectangle is disjoint at that level. */
export function voxelIdentityFloorRegions(map) {
  if (!IDENTITY_THEMES.has(map.theme)) return [];
  const floors = (map.decorations || []).filter(item => item.kind !== 'wall-sign'
    && [item.x, item.z, item.w, item.d].every(Number.isFinite) && item.w > 0 && item.d > 0)
    .map(item => ({ ...item, support: floorSupport(map, item) }));
  for (const building of map.buildings || []) {
    const room = building.interior;
    if (!room || ![room.minX, room.minZ, room.maxX, room.maxZ].every(Number.isFinite)) continue;
    const x = room.minX + .025, z = room.minZ + .025, w = room.maxX - room.minX - .05, d = room.maxZ - room.minZ - .05;
    if (w <= 0 || d <= 0) continue;
    const floorY = Number.isFinite(building.floorY) ? building.floorY : Number.isFinite(room.y) ? room.y : 0;
    floors.push({ kind: `${map.theme}-interior`, buildingId: building.id, x, z, w, d, support: floorY,
      color: map.theme === 'trading' ? '#78858a' : map.theme === 'sewers' ? '#797760' : map.theme === 'snow' ? '#b6c4ca'
        : building.id === 'paris-cafe' ? '#c0ad8d' : '#a99272' });
  }
  return floors.flatMap((floor, index) => clipRectangle(floor,
    floors.slice(index + 1).filter(item => Math.abs(item.support - floor.support) < .001))
    .map(rect => ({ ...floor, ...rect, y: floor.support + .008 })));
}

/** Emit broad floors once, followed by bounded, flush route-specific detail.
 * Geometry is clipped before paint, so a water crossing or overlapping path
 * does not fight a second broad rectangle at the same GPU depth. */
export function appendVoxelIdentityFloors(mesh, map) {
  if (!IDENTITY_THEMES.has(map.theme)) return false;
  for (const region of voxelIdentityFloorRegions(map)) {
    const { x, z, w, d, y, kind = '', color = '#8e958b' } = region;
    mesh.floor(x, z, w, d, color, y);
    const detail = (xx, zz, ww, dd, tint) => {
      const left = Math.max(x, xx), front = Math.max(z, zz), right = Math.min(x + w, xx + ww), back = Math.min(z + d, zz + dd);
      if (right > left && back > front) mesh.floor(left, front, right - left, back - front, tint, y + .008);
    };
    if (/water/.test(kind)) {
      const alongZ = d > w, length = alongZ ? d : w;
      for (let at = .4; at < length - .1; at += 1.25) detail(x + (alongZ ? .04 : at), z + (alongZ ? at : .04), alongZ ? w - .08 : .018, alongZ ? .018 : d - .08, '#70816b');
    } else if (map.theme === 'snow') {
      if (/path|yard|trail/.test(kind)) {
        const alongZ = d > w, length = alongZ ? d : w;
        for (let at = .4, index = 0; at < length - .3; at += 1.1, index++) detail(x + (alongZ ? w / 2 + (index % 2 ? .14 : -.14) : at), z + (alongZ ? at : d / 2 + (index % 2 ? .14 : -.14)), alongZ ? .11 : .22, alongZ ? .22 : .11, '#96b3c1');
      }
      if (/interior/.test(kind)) for (let at = 1; at < d; at += 1.8) detail(x + .04, z + at, w - .08, .018, '#819aa4');
    } else if (map.theme === 'trading') {
      for (let at = 1.5; at < d; at += 2.4) detail(x + .03, z + at, w - .06, .025, '#626f75');
      if (/aisle/.test(kind)) detail(x + .12, z + .04, .035, d - .08, '#6bb4ce');
    } else if (map.theme === 'sewers') {
      for (let at = .5; at < d - .15; at += 1.8) detail(x + .13, z + at, Math.min(.44, w - .2), .065, '#4b5b43');
      if (/bridge/.test(kind)) for (let at = .18; at < d; at += .45) detail(x + .05, z + at, w - .10, .025, '#2e443c');
    } else if (kind === 'road') {
      const alongZ = d > w, length = alongZ ? d : w;
      for (let at = .8; at < length - .8; at += 3.6) detail(x + (alongZ ? w / 2 - .045 : at), z + (alongZ ? at : d / 2 - .045), alongZ ? .09 : Math.min(1.35, length - at), alongZ ? Math.min(1.35, length - at) : .09, '#e3d6af');
      if (alongZ) for (const xx of [x + .13, x + w - .18]) detail(xx, z + .05, .05, d - .10, '#b7b8a5');
    } else if (kind === 'crosswalk') {
      for (let at = .15; at < d - .20; at += .68) detail(x + .25, z + at, w - .50, Math.min(.30, d - at), '#e9e2cd');
    } else if (kind === 'park') {
      for (let index = 0; index < 14; index++) {
        const seed = hash(`${map.id}:park:${x}:${z}:${index}`);
        detail(x + .25 + seed % 90 / 100 * Math.max(0, w - .5), z + .25 + (seed >>> 8) % 90 / 100 * Math.max(0, d - .5), .045, .045, index % 3 ? '#d4c489' : '#b98377');
      }
    } else {
      const interior = kind === 'paris-interior';
      for (let at = .12; at < d - .12; at += interior ? .8 : 1.2) detail(x + .04, z + at, w - .08, .018, interior ? '#827661' : '#a49d8e');
      if (kind === 'cafe' || interior && region.buildingId === 'paris-cafe') {
        for (let xx = .16; xx < w - .20; xx += 1.1) for (let zz = .16; zz < d - .20; zz += 1.1) {
          if ((Math.round(xx / 1.1) + Math.round(zz / 1.1)) % 2 === 0) detail(x + xx, z + zz, Math.min(.58, w - xx - .08), Math.min(.58, d - zz - .08), '#b79f82');
        }
      }
    }
  }
  return true;
}

/** New-map floor layers have no overlapping background rectangles. Detail is
 * 8mm above that single background; later paths/pads clip both layers instead
 * of relying on nearly-coplanar depth ordering at a distant grazing angle.
 */
export function appendVoxelMapExpansionFloors(mesh, map) {
  if (!Object.hasOwn(MAP_EXPANSION_ART, map.theme)) return false;
  const floors = (map.decorations || []).filter(item => item.kind !== 'castle-banner'
    && [item.x, item.z, item.w, item.d].every(Number.isFinite) && item.w > 0 && item.d > 0)
    .map(item => ({ ...item, support: floorSupport(map, item) }));
  for (let index = 0; index < floors.length; index++) {
    const floor = floors[index], { x, z, w, d, kind = '', support } = floor, y = support + .008;
    const masks = floors.slice(index + 1).filter(item => Math.abs(item.support - support) < .001);
    for (const rect of clipRectangle(floor, masks)) mesh.floor(rect.x, rect.z, rect.w, rect.d, floor.color || MAP_EXPANSION_ART[map.theme].accent, y);
    const labelMasks = map.mode === 'dojo' ? (map.rangeLanes || []).filter(lane => Math.abs((lane.origin?.y || 0) - support) < .001).map(lane => ({ x: lane.origin.x - 1.3, z: lane.origin.z + .20, w: 2.6, d: .76 })) : [];
    const detailMesh = { floor(xx, zz, ww, dd, color, yy, extraMasks = []) {
      const left = Math.max(x, xx), front = Math.max(z, zz), right = Math.min(x + w, xx + ww), back = Math.min(z + d, zz + dd);
      if (right <= left || back <= front) return;
      for (const rect of clipRectangle({ x: left, z: front, w: right - left, d: back - front }, [...masks, ...labelMasks, ...extraMasks])) mesh.floor(rect.x, rect.z, rect.w, rect.d, color, yy);
    } };
    if (appendVoxelMapExpansionFloor(detailMesh, floor, map.theme, y)) continue;
    if (kind === 'cedar-floor') for (let at = .04; at < w; at += .84) detailMesh.floor(x + at, z + .02, .035, d - .04, '#755a40', y + .008);
    if (kind === 'dojo-tatami') {
      const borders = [];
      for (let at = .04; at < w; at += 1.04) borders.push({ x: x + at, z, w: .040, d });
      for (let at = .04; at < d; at += 1.75) borders.push({ x, z: z + at, w, d: .040 });
      for (let at = .08; at < d - .02; at += .28) detailMesh.floor(x + .02, z + at, w - .04, .025, '#999768', y + .008, borders);
      for (const border of borders) detailMesh.floor(border.x, border.z, border.w, border.d, '#545f45', y + .008);
    }
    if (kind === 'stone-path') {
      for (let at = .04; at < d - .01; at += .92) detailMesh.floor(x + .02, z + at, w - .04, .040, '#8e887a', y + .008);
      for (let at = .8; at < w - .02; at += .86) detailMesh.floor(x + at, z + .02, .040, d - .04, '#8e887a', y + .008);
    }
    if (map.theme === 'medieval') {
      const rows = clamp(Math.ceil(d / .90), 1, 48), columns = clamp(Math.ceil(w / 1.10), 1, 32);
      for (let row = 1; row < rows; row++) detailMesh.floor(x + .025, z + row * d / rows, w - .05, .040, '#6d7363', y + .008);
      for (let column = 1; column < columns; column++) detailMesh.floor(x + column * w / columns, z + .025, .040, d - .05, '#6d7363', y + .008);
    }
  }
  return true;
}

/** Authored castle banners attach to a real wall segment, including its face.
 * Resolving the segment prevents a banner from bridging an open doorway.
 */
export function appendVoxelMapExpansionDecoration(mesh, map, decoration) {
  if (map.theme !== 'medieval') return false;
  const { x, y, z, w, h, d, kind = '', face } = decoration;
  if (kind === 'castle-banner') {
    const building = (map.buildings || []).find(item => item.id === decoration.buildingId);
    if (!building || !FACES.includes(face) || ![x, y, z, w, h].every(Number.isFinite)) return true;
    const ids = new Set(building.wallIds || []);
    const alongX = face === 'north' || face === 'south';
    const candidates = (map.colliders || []).filter(box => ids.has(box.id)
      && (alongX ? x >= box.x && x + w <= box.x + box.w : z >= box.z && z + w <= box.z + box.d)
      && y >= box.y && y + h <= box.y + box.h);
    const distance = box => Math.abs(alongX ? z - (box.z + (face === 'south' ? box.d : 0)) : x - (box.x + (face === 'east' ? box.w : 0)));
    const wall = candidates.sort((a, b) => distance(a) - distance(b))[0];
    if (!wall || distance(wall) > .06) return true;
    const left = alongX ? x - wall.x : z - wall.z, bottom = y - wall.y;
    const patch = (xx, yy, ww, hh, color, offset = .012) => surface(mesh, wall, face, left + xx, bottom + yy, ww, hh, color, offset);
    const gold = decoration.trimColor || '#d0af63';
    patch(0, 0, w, h, decoration.color || '#8e343b', .004);
    patch(.035, .045, .025, h - .09, gold); patch(w - .06, .045, .025, h - .09, gold);
    patch(.035, h - .085, w - .07, .035, gold); patch(.035, .045, w - .07, .035, gold);
    patch(w * .27, h * .43, w * .46, .055, '#e8d398', .020);
    patch(w * .36, h * .23, w * .28, h * .42, '#e8d398', .020);
    patch(w * .25, h * .69, w * .50, .065, '#e8d398', .020);
    for (const fraction of [.25, .46, .67]) patch(w * fraction, h * .69, w * .08, h * .13, '#e8d398', .020);
    return true;
  }
  if (!/castle-.*paving|castle-processional-road|castle-inner-court|village-cobbled-lane/.test(kind) || ![x, z, w, d].every(Number.isFinite) || w <= .08 || d <= .08) return false;
  const ground = .008;
  mesh.floor(x, z, w, d, decoration.color || '#94927b', ground);
  const rows = clamp(Math.ceil(d / .72), 1, 48), columns = clamp(Math.ceil(w / .88), 1, 32);
  for (let row = 1; row < rows; row++) mesh.floor(x + .025, z + row * d / rows, w - .05, .040, '#6d7363', ground + .008);
  // Alternating partial joints suggest cobbles without tessellating every
  // paving block into an individual GPU object.
  for (let column = 1; column < columns; column++) mesh.floor(x + column * w / columns, z + .025, .040, d - .05, '#6d7363', ground + .008);
  return true;
}
