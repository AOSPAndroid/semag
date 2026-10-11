/** Real, lit voxel geometry for Ember Delve. All ground positions use engine / 32. */
export const EMBER_VOXEL = Object.freeze({
  scale: 1 / 32, coverHeight: 2.65, wallHeight: 3.8, stride: 9,
  bounds: Object.freeze({ minX: 42 / 32, maxX: 918 / 32, minZ: 42 / 32, maxZ: 598 / 32 }),
  roomVertexBudget: 60000, actorVertexBudget: 50000,
});

export const EMBER_THEMES = Object.freeze([
  Object.freeze({ stone: '#43554b', edge: '#6b7961', dark: '#293930', floor: '#34473c', grout: '#22362c', light: '#f1bd72', rune: '#aab67d', metal: '#b58f58', wood: '#624e3c' }),
  Object.freeze({ stone: '#536473', edge: '#829aaa', dark: '#303f53', floor: '#3e5361', grout: '#293d50', light: '#b0e8ef', rune: '#a5e9e1', metal: '#839ab6', wood: '#514d59' }),
  Object.freeze({ stone: '#58423c', edge: '#936b52', dark: '#392b2b', floor: '#463733', grout: '#2f2928', light: '#ffc479', rune: '#df9d65', metal: '#bc8852', wood: '#5b3c30' }),
]);

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const rgbCache = new Map();
function rgb(value) {
  if (Array.isArray(value)) return value;
  if (!rgbCache.has(value)) rgbCache.set(value, [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255));
  return rgbCache.get(value);
}
function shade(value, amount) { return rgb(value).map(c => clamp(c * amount, 0, 1)); }

// Right-handed outward faces, with a separate normal per face for crisp voxel lighting.
const faces = [
  [[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]],
  [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]],
  [[0, 1, 0], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]],
  [[0, -1, 0], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]]],
  [[0, 0, 1], [[1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, -1, 1]]],
  [[0, 0, -1], [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]]],
];

function rotate(x, y, z, pitch = 0, yaw = 0, roll = 0) {
  if (pitch) { const c = Math.cos(pitch), s = Math.sin(pitch); [y, z] = [y * c - z * s, y * s + z * c]; }
  if (yaw) { const c = Math.cos(yaw), s = Math.sin(yaw); [x, z] = [x * c - z * s, x * s + z * c]; }
  if (roll) { const c = Math.cos(roll), s = Math.sin(roll); [x, y] = [x * c - y * s, x * s + y * c]; }
  return [x, y, z];
}

/** Small geometry writer; box dimensions are full extents, x/y/z are its centre. */
export function createEmberMeshBuilder({ x: rootX = 0, y: rootY = 0, z: rootZ = 0, yaw: rootYaw = 0, scale = 1 } = {}) {
  let data = new Float32Array(4096), length = 0, cos = Math.cos(rootYaw), sin = Math.sin(rootYaw);
  function reserve(count) {
    if (length + count <= data.length) return;
    const grown = new Float32Array(Math.max(data.length * 2, length + count));
    grown.set(data); data = grown;
  }
  function vertex(x, y, z, nx, ny, nz, color) {
    data[length++] = rootX + (x * cos - z * sin) * scale;
    data[length++] = rootY + y * scale;
    data[length++] = rootZ + (x * sin + z * cos) * scale;
    data[length++] = nx * cos - nz * sin;
    data[length++] = ny;
    data[length++] = nx * sin + nz * cos;
    data[length++] = color[0]; data[length++] = color[1]; data[length++] = color[2];
  }
  return {
    setTransform({ x = 0, y = 0, z = 0, yaw = 0, scale: size = 1 } = {}) {
      rootX = x; rootY = y; rootZ = z; cos = Math.cos(yaw); sin = Math.sin(yaw); scale = size;
    },
    box(x, y, z, width, height, depth, color, { pitch = 0, yaw = 0, roll = 0 } = {}) {
      const c = rgb(color);
      reserve(324);
      const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll);
      const m00 = cr * cy, m01 = -cr * sy * sp - sr * cp, m02 = -cr * sy * cp + sr * sp;
      const m10 = sr * cy, m11 = -sr * sy * sp + cr * cp, m12 = -sr * sy * cp - cr * sp;
      const m20 = sy, m21 = cy * sp, m22 = cy * cp;
      for (const [normal, corners] of faces) {
        const nx = m00 * normal[0] + m01 * normal[1] + m02 * normal[2];
        const ny = m10 * normal[0] + m11 * normal[1] + m12 * normal[2];
        const nz = m20 * normal[0] + m21 * normal[1] + m22 * normal[2];
        for (const i of [0, 1, 2, 0, 2, 3]) {
          const corner = corners[i], a = corner[0] * width / 2, b = corner[1] * height / 2, d = corner[2] * depth / 2;
          vertex(x + m00 * a + m01 * b + m02 * d, y + m10 * a + m11 * b + m12 * d, z + m20 * a + m21 * b + m22 * d, nx, ny, nz, c);
        }
      }
    },
    triangle(a, b, c, color) {
      const u = b.map((n, i) => n - a[i]), v = c.map((n, i) => n - a[i]);
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const length = Math.hypot(...n);
      if (!length) return;
      const normal = n.map(component => component / length);
      reserve(27);
      for (const point of [a, b, c]) vertex(...point, ...normal, rgb(color));
    },
    finish() { return data.slice(0, length); },
    get vertexCount() { return length / 9; },
  };
}

/** The same physical footprints as the engine, useful to camera obstruction checks. */
export function getEmberRoomSolids(state) {
  const { bounds: b, wallHeight: h, coverHeight: c } = EMBER_VOXEL;
  return [
    { kind: 'boundary', minX: 0, maxX: b.minX, minZ: 0, maxZ: 20, height: h },
    { kind: 'boundary', minX: b.maxX, maxX: 30, minZ: 0, maxZ: 20, height: h },
    { kind: 'boundary', minX: b.minX, maxX: b.maxX, minZ: 0, maxZ: b.minZ, height: h },
    { kind: 'boundary', minX: b.minX, maxX: b.maxX, minZ: b.maxZ, maxZ: 20, height: h },
    ...state.room.obstacles.map(o => ({ kind: 'cover', minX: o.x / 32, maxX: (o.x + o.width) / 32,
      minZ: o.y / 32, maxZ: (o.y + o.height) / 32, height: c })),
  ];
}

function floor(builder, theme, act) {
  builder.box(15, -.18, 10, 30, .36, 20, theme.grout);
  // Inlaid floor faces remain flat: these are markings, never fake obstructions.
  for (let row = 0; row < 10; row++) for (let col = 0; col < 15; col++) {
    const x = col * 2 + 1, z = row * 2 + 1;
    const tone = 1 + (((col * 7 + row * 11) % 5) - 2) * .035;
    builder.box(x, -.014, z, 1.95, .028, 1.95, shade(theme.floor, tone));
    if ((col * 3 + row * 5) % 11 === 0) builder.box(x + .4, .004, z - .3, .45, .008, .04, shade(theme.edge, .75));
  }
  const line = act === 2 ? '#65878e' : act === 3 ? '#775241' : '#536147';
  for (const z of [8.65, 11.35]) builder.box(15, .007, z, 26.5, .014, .055, line);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, radius = 2.2;
    builder.box(15 + Math.sin(a) * radius, .014, 10 - Math.cos(a) * radius, .12, .018, .52, theme.rune, { yaw: -a });
  }
}

function wall(builder, solid, theme, act) {
  const w = solid.maxX - solid.minX, d = solid.maxZ - solid.minZ;
  const x = (solid.minX + solid.maxX) / 2, z = (solid.minZ + solid.maxZ) / 2;
  builder.box(x, solid.height / 2, z, w - .12, solid.height, d - .12, theme.dark);
  // All dressed wall details stay within its solid footprint.
  const horizontal = w > d, span = horizontal ? w : d, courses = 4;
  for (let row = 0; row < courses; row++) {
    const count = Math.ceil(span / 2.1), step = span / count;
    for (let col = 0; col < count; col++) {
      const offset = (col + .5) * step - span / 2;
      builder.box(x + (horizontal ? offset : 0), .43 + row * .84, z + (horizontal ? 0 : offset),
        horizontal ? step - .065 : w, .77, horizontal ? d : step - .065,
        shade(theme.stone, 1 + ((row + col * 3) % 4 - 1.5) * .06));
    }
  }
  builder.box(x, 3.62, z, w, .26, d, theme.edge);
  builder.box(x, .18, z, w, .36, d, theme.edge);
  if (act === 3) builder.box(x, 1.08, z, w - .02, .065, d - .02, theme.metal);
}

function pillar(builder, solid, theme, index, act) {
  const w = solid.maxX - solid.minX, d = solid.maxZ - solid.minZ;
  const x = (solid.minX + solid.maxX) / 2, z = (solid.minZ + solid.maxZ) / 2;
  // The complete opaque obstruction exactly matches the engine rectangle.
  builder.box(x, 1.325, z, w, 2.65, d, theme.stone);
  for (const y of [.15, 1.3, 2.5]) builder.box(x, y, z, w, .2, d, y === 1.3 ? theme.dark : theme.edge);
  // Paint the carved runes directly on the outer faces. Buried boxes disappear
  // under depth testing, and protruding plaques would narrow the collision lane.
  for (let i = 0; i < 3; i++) {
    const left = x - w / 2 + .17 + i * .22, right = left + .065;
    const low = 1.63, high = 2.15, color = shade(theme.rune, .82);
    for (const front of [true, false]) {
      const plane = front ? solid.minZ : solid.maxZ;
      const a = [front ? left : right, low, plane], b = [front ? left : right, high, plane];
      const c = [front ? right : left, high, plane], end = [front ? right : left, low, plane];
      builder.triangle(a, b, c, color); builder.triangle(a, c, end, color);
    }
  }
  builder.box(x, 2.7, z, w - .18, .1, d - .18, theme.dark);
  if (act === 1) {
    for (let i = 0; i < 3; i++) builder.box(x - w * .3 + i * .35, 2.77, z + d * .23, .32, .045, .34, ['#4f6650', '#708253', '#52654a'][i]);
  } else if (act === 2) {
    for (let i = 0; i < 3; i++) builder.box(x + (i - 1) * .46, 2.95 + i % 2 * .1, z, .22, .5 + i % 2 * .2, .25, i % 2 ? '#a1cccf' : '#769eae', { roll: (i - 1) * .15 });
  } else {
    builder.box(x, 2.86, z, w * .65, .22, d * .48, theme.metal);
    for (let i = 0; i < 3; i++) builder.box(x + (i - 1) * .46, 2.99, z, .09, .035, d * .45, '#ffc27d');
  }
  // Torches stand on the solid, keeping silhouettes clear of walkable corners.
  builder.box(x, 2.89, z - d * .25, .2, .38, .2, theme.wood);
  builder.box(x, 3.07, z - d * .25, .36, .16, .36, theme.metal);
}

function exitFrame(builder, theme) {
  const x = EMBER_VOXEL.bounds.maxX + .42, z = 10;
  // Door posts are inset in the boundary wall; the engine's exit stays accessible.
  for (const offset of [-1.22, 1.22]) {
    builder.box(x, 1.6, z + offset, .7, 3.2, .34, theme.edge);
    for (let row = 0; row < 5; row++) builder.box(x - .01, .28 + row * .59, z + offset, .71, .045, .35, theme.dark);
    builder.box(x - .36, 1.6, z + offset, .012, 2.8, .065, theme.rune);
  }
  builder.box(x, 3.25, z, .78, .32, 2.83, theme.edge);
  builder.box(x, 3.48, z, .54, .16, 2.42, theme.metal);
  builder.box(x - .4, 2.99, z, .012, .15, .22, theme.rune);
}

export function buildEmberRoomMesh(state) {
  const builder = createEmberMeshBuilder(), act = clamp(state.act || 1, 1, 3), theme = EMBER_THEMES[act - 1];
  floor(builder, theme, act);
  const solids = getEmberRoomSolids(state);
  solids.forEach((solid, i) => solid.kind === 'boundary' ? wall(builder, solid, theme, act) : pillar(builder, solid, theme, i - 4, act));
  exitFrame(builder, theme);
  return builder.finish();
}

function leg(builder, x, hipY, z, length, angle, palette, width = .2) {
  const centre = rotate(0, -length / 2, 0, angle);
  builder.box(x, hipY + centre[1], z + centre[2], width, length, width * 1.1, palette.leg, { pitch: angle });
  const end = rotate(0, -length, 0, angle);
  builder.box(x, .085 + Math.max(0, Math.sin(angle)) * .13, z + end[2] - .075, width * 1.17, .17, width * 1.65, palette.boot, { pitch: angle * .2 });
}

function arm(builder, x, shoulderY, z, angle, palette, width = .2, length = .52) {
  const mid = rotate(0, -length / 2, 0, angle);
  builder.box(x, shoulderY + mid[1], z + mid[2], width, length, width, palette.arm, { pitch: angle });
  const end = rotate(0, -length, 0, angle);
  builder.box(x, shoulderY + end[1], z + end[2], width * .94, .18, width * .94, palette.hand);
  return { x, y: shoulderY + end[1], z: z + end[2] };
}

function sword(builder, hand, attack, color = '#c6d8cd', length = 1.03) {
  const yaw = attack ? -1.45 + (1 - clamp(attack / .15, 0, 1)) * 2.9 : -.14;
  const forward = rotate(0, 0, -1, 0, yaw);
  const base = { x: hand.x + forward[0] * .11, y: hand.y + .01, z: hand.z + forward[2] * .11 };
  builder.box(base.x, base.y, base.z, .32, .08, .075, '#c5a66a', { yaw });
  builder.box(base.x - forward[0] * .13, base.y, base.z - forward[2] * .13, .09, .085, .2, '#61513f', { yaw });
  builder.box(base.x + forward[0] * (length / 2 + .12), base.y, base.z + forward[2] * (length / 2 + .12), .12, .054, length, color, { yaw });
  builder.box(base.x + forward[0] * (length + .13), base.y, base.z + forward[2] * (length + .13), .075, .047, .15, '#e6ead1', { yaw });
  builder.box(base.x + forward[0] * (length / 2 + .12), base.y + .03, base.z + forward[2] * (length / 2 + .12), .032, .015, length * .84, '#e5f3dd', { yaw });
}

function hero(builder, spec, gait) {
  const { attack, cast, dash, hurt } = spec;
  const palette = { leg: '#435447', boot: '#302e29', arm: '#527563', hand: '#d4aa7d' };
  leg(builder, -.16, .67, .02, .55, gait * .68, palette);
  leg(builder, .16, .67, .02, .55, -gait * .68, palette);
  builder.box(0, .93, 0, .54, .56, .35, '#956e43');
  builder.box(0, 1.05, -.18, .42, .26, .045, '#b79b6a');
  builder.box(0, .75, 0, .61, .095, .39, '#414335');
  builder.box(.06, .75, -.205, .115, .11, .035, '#d9b467');
  // Visible from behind: layered cloak, leather satchel and scabbard.
  const flutter = spec.reducedMotion ? 0 : gait * .04 + (dash ? .14 : 0);
  for (let i = 0; i < 4; i++) builder.box(0, 1.15 - i * .16, .215 + i * .037 + flutter, .59 - i * .055, .2, .07, i % 2 ? '#3c6454' : '#46755e', { pitch: -.06 - flutter });
  builder.box(0, 1.22, .22, .6, .1, .08, '#a59566');
  builder.box(-.28, .86, .2, .22, .31, .22, '#624c37');
  builder.box(-.285, .96, .318, .15, .055, .025, '#b0945a');
  builder.box(-.21, .95, .34, .075, .82, .08, '#3b3b35', { roll: -.32 });
  builder.box(-.08, 1.34, .34, .24, .065, .07, '#b9a069', { roll: -.32 });
  builder.box(.29, .74, .08, .13, .22, .13, '#55898c');
  builder.box(.29, .86, .08, .065, .055, .065, '#9fa78a');
  const left = arm(builder, -.36, 1.15, 0, cast ? 1.22 : gait * -.55 - .1, palette);
  const right = arm(builder, .36, 1.15, 0, attack ? 1.04 : .23 + gait * .35, palette);
  sword(builder, right, attack);
  if (cast) {
    builder.box(left.x, left.y + .16, left.z - .18, .2, .2, .2, '#a8e0d9', { yaw: .7 });
    builder.box(left.x, left.y + .16, left.z - .18, .08, .33, .08, '#def5c7');
  }
  builder.box(0, 1.48, -.035, .41, .42, .42, '#719779');
  builder.box(0, 1.66, -.005, .33, .12, .34, '#89ab83');
  builder.box(0, 1.43, -.263, .29, .28, .045, '#2d4038');
  builder.box(0, 1.44, -.292, .21, .23, .03, '#d4aa7d');
  builder.box(0, 1.56, -.3, .29, .05, .07, '#496b50');
  for (const x of [-.065, .065]) builder.box(x, 1.47, -.315, .032, .035, .017, '#262f2b');
  builder.box(0, 1.3, -.08, .45, .12, .35, '#ba925d');
  if (hurt) builder.box(0, 1.02, -.207, .34, .04, .035, '#de9b76');
}

function crawler(builder, spec, gait) {
  builder.box(0, .51, .1, .63, .48, .8, '#586044');
  builder.box(0, .77, .22, .5, .12, .52, '#89905b');
  for (let i = 0; i < 3; i++) builder.box(0, .61, -.09 + i * .22, .68, .09, .08, '#2e3c32');
  builder.box(0, .47, -.43, .47, .34, .34, '#806347');
  builder.box(0, .37, -.64, .29, .08, .12, '#362d26');
  for (const side of [-1, 1]) {
    builder.box(side * .14, .52, -.61, .08, .07, .028, '#f2b267');
    builder.box(side * .19, .29, -.62, .07, .2, .08, '#c1a57a', { roll: side * .3 });
    for (let i = 0; i < 3; i++) {
      const a = gait * (i % 2 ? -1 : 1), z = -.24 + i * .3;
      builder.box(side * .43, .36, z + a * .09, .33, .11, .11, '#7c7852', { roll: side * -.4, yaw: a * .2 });
      builder.box(side * .54, .19, z + a * .15, .1, .36, .1, '#444936', { roll: side * .3 });
      builder.box(side * .56, .045, z + a * .15 - .055, .14, .09, .19, '#2c352c');
    }
  }
}

function archer(builder, spec, gait) {
  const palette = { leg: '#454250', boot: '#302c35', arm: '#71546f', hand: '#c6b18b' };
  leg(builder, -.14, .7, 0, .58, gait * .58, palette, .17);
  leg(builder, .14, .7, 0, .58, -gait * .58, palette, .17);
  builder.box(0, 1.03, .02, .44, .66, .31, '#67506a');
  builder.box(0, .84, -.16, .32, .075, .045, '#a6a591');
  builder.box(0, .9, .2, .4, .67, .075, '#40394c');
  const raised = spec.tell ? .92 : .4;
  arm(builder, -.3, 1.2, -.08, raised, palette, .17, .52);
  const right = arm(builder, .3, 1.2, -.06, raised * .7, palette, .17, .52);
  builder.box(.05, 1.1, .23, .17, .55, .16, '#665343', { roll: -.2 });
  for (const x of [-.04, .04]) builder.box(x, 1.45, .23, .02, .38, .02, '#b5b99c', { roll: -.2 });
  // Bow is a three-piece arc rather than a gun silhouette.
  builder.box(right.x + .03, right.y, right.z - .1, .065, .58, .065, '#b49565');
  for (const sign of [-1, 1]) builder.box(right.x + .03, right.y + sign * .32, right.z - .2, .065, .28, .065, '#b49565', { pitch: sign * -.6 });
  builder.box(right.x + .03, right.y, right.z - .31, .018, .91, .018, '#d9d8b5');
  builder.box(0, 1.49, -.015, .37, .42, .4, '#6c5276');
  builder.box(0, 1.67, -.005, .29, .1, .29, '#907195');
  builder.box(0, 1.44, -.236, .26, .25, .045, '#302b36');
  builder.box(0, 1.38, -.264, .19, .055, .015, '#bca787');
  for (const x of [-.072, .072]) builder.box(x, 1.5, -.27, .055, .026, .025, '#f0ce86');
}

function charger(builder, spec, gait) {
  const palette = { leg: '#776046', boot: '#4b4133', arm: '#936e48', hand: '#a38b62' };
  leg(builder, -.22, .71, .03, .58, gait * .8, palette, .25);
  leg(builder, .22, .71, .03, .58, -gait * .8, palette, .25);
  builder.box(0, .97, -.06, .73, .62, .48, '#9b764b', { pitch: .13 });
  builder.box(0, 1.14, -.31, .59, .3, .075, '#bb935d');
  for (const side of [-1, 1]) {
    builder.box(side * .4, 1.2, -.035, .3, .22, .42, '#76664d');
    builder.box(side * .43, 1.31, -.035, .2, .06, .3, '#b19a71');
    arm(builder, side * .44, 1.15, -.1, .38 + gait * side * .5, palette, .25, .6);
  }
  builder.box(0, 1.43, -.19, .51, .39, .46, '#b09263');
  builder.box(0, 1.3, -.47, .41, .17, .23, '#706047');
  for (const side of [-1, 1]) {
    builder.box(side * .12, 1.49, -.435, .063, .052, .027, '#faad61');
    builder.box(side * .25, 1.65, -.15, .12, .35, .12, '#d5bd8b', { roll: side * -.35 });
    builder.box(side * .3, 1.79, -.15, .1, .19, .1, '#eee0ae', { roll: side * .55 });
    builder.box(side * .15, 1.27, -.59, .055, .2, .065, '#e1c99a', { pitch: -.2 });
  }
}

function sentinel(builder, spec, gait) {
  const palette = { leg: '#53645e', boot: '#34433b', arm: '#63776a', hand: '#9c9770' };
  leg(builder, -.22, .73, .03, .58, gait * .44, palette, .29);
  leg(builder, .22, .73, .03, .58, -gait * .44, palette, .29);
  builder.box(0, 1.05, 0, .73, .68, .49, '#71806a');
  builder.box(0, 1.07, -.27, .51, .42, .075, '#405646');
  builder.box(0, 1.08, -.316, .09, .35, .025, '#d2b67a');
  for (const side of [-1, 1]) builder.box(side * .4, 1.36, 0, .29, .22, .48, '#929779');
  const left = arm(builder, -.48, 1.24, -.08, .22, palette, .27, .53);
  const right = arm(builder, .48, 1.24, -.08, spec.tell ? -.9 : .24, palette, .27, .53);
  builder.box(left.x, .96, left.z - .17, .64, .96, .15, '#506b57');
  builder.box(left.x, .96, left.z - .255, .48, .78, .023, '#a4a67c');
  builder.box(left.x, .96, left.z - .273, .32, .58, .022, '#485e4c');
  builder.box(left.x, .96, left.z - .29, .08, .41, .02, '#d4bd80');
  builder.box(right.x, right.y + .02, right.z -.19, .07, .065, .65, '#655645');
  builder.box(right.x, right.y + .02, right.z -.54, .46, .34, .2, '#9b9f86');
  builder.box(0, 1.62, -.04, .47, .42, .48, '#829175');
  builder.box(0, 1.78, -.04, .55, .12, .52, '#a6ad86');
  builder.box(0, 1.61, -.291, .29, .095, .025, '#2c3f34');
  for (const x of [-.085, .085]) builder.box(x, 1.64, -.31, .075, .025, .018, '#ebce86');
}

function ashWarden(builder, spec, gait) {
  const palette = { leg: '#57483b', boot: '#3c342e', arm: '#96724c', hand: '#b39667' };
  leg(builder, -.33, .93, .06, .76, gait * .39, palette, .41);
  leg(builder, .33, .93, .06, .76, -gait * .39, palette, .41);
  builder.box(0, 1.46, .07, 1.1, 1.1, .71, '#916c43');
  builder.box(0, 1.4, -.34, .78, .76, .095, '#3c3630');
  for (let i = 0; i < 5; i++) builder.box((i - 2) * .135, 1.43, -.402, .045, .58, .035, i % 2 ? '#ffd38c' : '#bc8150');
  builder.box(0, 1.02, -.36, 1.12, .18, .1, '#c19a5e');
  for (const side of [-1, 1]) {
    builder.box(side * .63, 1.84, .045, .45, .31, .73, '#a98050');
    builder.box(side * .67, 2.03, .07, .24, .2, .38, '#ccb079');
    const hand = arm(builder, side * .75, 1.74, -.04, spec.tell ? side * .6 : .23 + gait * side * .3, palette, .34, .82);
    builder.box(hand.x, hand.y + .19, hand.z - .14, .095, .86, .095, '#76583c');
    builder.box(hand.x, hand.y + .64, hand.z - .14, .52, .26, .18, '#b7c0a8');
    builder.box(hand.x + side * .2, hand.y + .67, hand.z - .14, .15, .34, .19, '#d1d6b7');
  }
  builder.box(0, 2.26, -.02, .63, .55, .56, '#b28c5b');
  builder.box(0, 2.28, -.315, .44, .12, .035, '#41392d');
  for (const side of [-1, 1]) {
    builder.box(side * .12, 2.29, -.338, .075, .035, .025, '#ffd787');
    builder.box(side * .33, 2.6, 0, .13, .38, .13, '#d4b789', { roll: side * -.43 });
    builder.box(side * .45, 2.76, 0, .12, .22, .12, '#e1cca4', { roll: side * .4 });
  }
  builder.box(0, 2.3, -.35, .065, .45, .08, '#d0b880');
}

function mirrorStag(builder, spec, gait) {
  const shell = '#7197a3', crystal = '#bdddda', dark = '#345667';
  builder.box(0, 1.18, .14, .94, .66, 1.2, shell);
  builder.box(0, 1.5, .13, .69, .13, .95, '#a6c6c9');
  for (const side of [-1, 1]) for (const rear of [-1, 1]) {
    const angle = gait * side * rear * .49, z = .14 + rear * .42;
    leg(builder, side * .36, .99, z, .84, angle, { leg: '#7aa3ac', boot: '#344f60' }, .18);
    builder.box(side * .36, .75, z, .22, .12, .22, crystal);
  }
  builder.box(0, 1.6, -.45, .37, .91, .39, shell, { pitch: -.19 });
  builder.box(0, 2.07, -.68, .47, .45, .58, crystal);
  builder.box(0, 1.93, -.99, .32, .19, .32, shell);
  for (const side of [-1, 1]) {
    builder.box(side * .16, 2.12, -.976, .055, .07, .028, '#efcf89');
    builder.box(side * .3, 2.19, -.57, .11, .29, .15, dark, { roll: side * -.65 });
    builder.box(side * .2, 2.52, -.63, .11, .72, .12, crystal, { roll: side * -.29 });
    builder.box(side * .34, 2.81, -.65, .1, .48, .1, '#d4eee0', { roll: side * -.41 });
    for (let i = 0; i < 3; i++) builder.box(side * (.3 + i * .08), 2.57 + i * .19, -.63, .25, .08, .08, '#b6d6d3', { roll: side * .4 });
  }
  builder.box(0, 1.22, .81, .13, .35, .15, shell, { pitch: -.38 });
  for (let i = 0; i < 3; i++) builder.box((i - 1) * .23, 1.62, .19 + i * .12, .13, .32, .15, crystal, { roll: (i - 1) * -.16 });
}

function cinderQueen(builder, spec, gait) {
  const palette = { leg: '#4c3939', boot: '#342b2d', arm: '#a15d49', hand: '#cd9d73' };
  leg(builder, -.23, .9, .02, .72, gait * .43, palette, .23);
  leg(builder, .23, .9, .02, .72, -gait * .43, palette, .23);
  for (let i = 0; i < 4; i++) builder.box(0, .53 + i * .27, .08, 1.01 - i * .13, .31, .59 - i * .06, i % 2 ? '#8e453c' : '#a75943');
  builder.box(0, 1.65, 0, .64, .58, .38, '#b87a51');
  builder.box(0, 1.5, -.216, .7, .1, .07, '#d2ab62');
  builder.box(0, 1.8, -.226, .1, .24, .045, '#f0c67f');
  for (const side of [-1, 1]) {
    builder.box(side * .39, 1.86, -.01, .28, .18, .43, '#bb8a55');
    builder.box(side * .31, 1.93, .2, .14, .69, .095, '#8c443e', { roll: side * -.45 });
    const hand = arm(builder, side * .48, 1.8, -.04, spec.tell ? .8 : .3 + gait * side * .23, palette, .22, .66);
    if (side === 1) {
      builder.box(hand.x, 1.12, hand.z, .075, 2.1, .075, '#8d623e');
      builder.box(hand.x, 2.28, hand.z, .28, .34, .2, '#f4b773', { yaw: .7 });
      builder.box(hand.x, 2.3, hand.z, .13, .48, .13, '#ffe2a2');
    }
  }
  builder.box(0, 2.12, -.05, .38, .45, .39, '#cbab82');
  builder.box(0, 2.28, .09, .46, .39, .28, '#542f32');
  for (const x of [-.2, .2]) builder.box(x, 2.05, .1, .12, .52, .26, '#6d3a38');
  for (const x of [-.065, .065]) builder.box(x, 2.17, -.253, .043, .025, .025, '#fff0b2');
  builder.box(0, 2.4, -.06, .53, .1, .46, '#c99750');
  for (let i = 0; i < 5; i++) builder.box((i - 2) * .107, 2.53 + (i % 2 ? 0 : .08), -.19, .073, .26 + (i % 2 ? 0 : .16), .075, i === 2 ? '#ffdaa0' : '#d9b268');
  builder.box(0, 1.8, .25, .61, .84, .07, '#773c37');
}

const actorKinds = { hero, crawler, archer, charger, sentinel };

/** Faces yaw=0 towards world -z. Engine forward maps to atan2(aimX, -aimY). */
export function buildEmberActorGeometry(spec) {
  const builder = createEmberMeshBuilder();
  writeActor(builder, spec);
  return builder.finish();
}

function writeActor(builder, spec) {
  const options = { kind: 'hero', x: 0, y: 0, z: 0, yaw: 0, gait: 0, walking: false, attack: 0, cast: 0, dash: 0, hurt: 0, act: 1, reducedMotion: false, ...spec };
  const gait = options.walking && !options.reducedMotion ? Math.sin(options.gait) : 0;
  builder.setTransform({ x: options.x, y: options.y + (options.walking && !options.reducedMotion ? Math.abs(gait) * .025 : 0), z: options.z, yaw: options.yaw });
  if (options.kind === 'boss' || options.boss) [ashWarden, mirrorStag, cinderQueen][clamp(options.act, 1, 3) - 1](builder, options, gait);
  else (actorKinds[options.kind] || crawler)(builder, options, gait);
}

function roomAnimatedProps(builder, state, time, reducedMotion) {
  const theme = EMBER_THEMES[clamp(state.act || 1, 1, 3) - 1], t = reducedMotion ? 0 : time;
  for (const solid of getEmberRoomSolids(state).filter(s => s.kind === 'cover')) {
    const x = (solid.minX + solid.maxX) / 2, z = (solid.minZ + solid.maxZ) / 2 - (solid.maxZ - solid.minZ) * .25;
    builder.box(x, 3.28, z, .18, .3 + Math.sin(t * 7 + x) * .035, .18, theme.light);
    builder.box(x - .045, 3.48, z + .016, .1, .19, .11, '#ffe5ac');
  }
  const doorX = EMBER_VOXEL.bounds.maxX - .01;
  if (state.room.cleared) {
    // A luminous doorway on the solid face, never a fake open collision passage.
    for (let i = 0; i < 7; i++) builder.box(doorX - .012 - i * .001, 1.56, 10 + (i - 3) * .29, .025, 2.8, .25, i % 2 ? theme.light : '#e2d2a0');
    for (const z of [8.92, 11.08]) builder.box(doorX - .065, 1.57, z, .025, 2.81, .055, '#fff1bf');
  } else {
    builder.box(doorX, 1.5, 10, .03, 2.85, 2.18, theme.wood);
    for (let i = 0; i < 7; i++) builder.box(doorX - .024, 1.5, 10 + (i - 3) * .3, .012, 2.76, .035, theme.dark);
    for (const y of [.57, 2.28]) builder.box(doorX - .048, y, 10, .025, .12, 2.2, theme.metal);
    builder.box(doorX - .07, 1.34, 9.34, .09, .16, .09, '#c2a565');
  }
  const shrine = state.room.shrine, x = shrine.x / 32, z = shrine.y / 32;
  if (state.room.kind === 'treasure') {
    builder.box(x, .12, z, 1.4, .24, .98, theme.dark);
    builder.box(x, .52, z, 1.24, .7, .78, '#967149');
    builder.box(x, .94, z + (state.room.rewardTaken ? .27 : 0), 1.28, .21, .82, '#b48c56', { pitch: state.room.rewardTaken ? -.85 : 0 });
    for (const sign of [-1, 1]) builder.box(x + sign * .42, .62, z, .085, .91, .84, '#cead65');
    builder.box(x, .65, z - .405, .18, .24, .055, '#ebcc82');
    builder.box(x, .66, z - .439, .045, .08, .025, '#433a2e');
    if (!state.room.rewardTaken) for (let i = 0; i < 4; i++) builder.box(x + Math.sin(t + i * 1.57) * .77, 1.2 + i * .08, z + Math.cos(t + i * 1.57) * .6, .055, .055, .055, '#f9d990');
  } else if (state.room.kind === 'camp') {
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; builder.box(x + Math.sin(a) * .62, .15, z + Math.cos(a) * .62, .3, .3, .28, theme.edge, { yaw: -a }); }
    for (const yaw of [-.58, .68]) builder.box(x, .18, z, .2, .21, .91, '#8d6140', { yaw });
    for (let i = 0; i < 5; i++) builder.box(x + (i - 2) * .14, .47 + (i % 2) * .1, z + ((i * 3) % 2) * .1, .13, .46 + Math.sin(t * 8 + i * 2) * .05, .16, i % 2 ? '#ffdaa0' : '#e6a363');
  }
}

/** Animated actors and stateful room props; combat tells/projectiles are the renderer's layer. */
export function buildEmberActorMesh(state, time = state.elapsed || 0, options = {}) {
  const builder = createEmberMeshBuilder(), reducedMotion = Boolean(options.reducedMotion), player = state.player;
  const idValue = (map, id, fallback) => map?.get?.(id) ?? fallback;
  const playerSpeed = Math.hypot(player.velocityX || 0, player.velocityY || 0);
  if (!options.hideHero) writeActor(builder, { kind: 'hero', x: player.x / 32, z: player.y / 32,
    yaw: options.heroYaw ?? Math.atan2(player.aimX || 0, -(player.aimY || 0)),
    gait: idValue(options.gaitById, 'hero', time * 10), walking: idValue(options.walkingById, 'hero', playerSpeed > 3),
    attack: player.attackTime || 0, cast: player.castTime || 0, dash: player.dashTime || 0, hurt: player.damageCooldown || 0,
    act: state.act, reducedMotion });
  for (const e of state.enemies) {
    const angle = e.phase === 'tell' || e.phase === 'charge' ? Math.atan2(e.aimX || 0, -(e.aimY || 0)) : Math.atan2(player.x - e.x, -(player.y - e.y));
    writeActor(builder, { kind: e.type, boss: e.boss, x: e.x / 32, z: e.y / 32,
      yaw: idValue(options.enemyYawById, e.id, angle), gait: idValue(options.gaitById, e.id, time * (e.type === 'crawler' ? 14 : 8) + e.id),
      walking: idValue(options.walkingById, e.id, e.phase === 'seek' || e.phase === 'charge'),
      tell: e.phase === 'tell', act: state.act, reducedMotion });
  }
  builder.setTransform();
  roomAnimatedProps(builder, state, time, reducedMotion);
  return builder.finish();
}
