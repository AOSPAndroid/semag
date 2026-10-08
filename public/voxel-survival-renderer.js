// Exact block surfaces, cached per horizontal chunk. Art never changes the
// engine's collision volume: even a torch or hearth occupies its full cube.
const STRIDE = 12;
const CHUNK_SIZE = 8;
const TILE_SIZE = 32;
const ATLAS_SIZE = TILE_SIZE * 4;
const MAX_PARTICLES = 64;
const MAX_ENEMIES = 24;
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const lerp = (a, b, fraction) => a + (b - a) * fraction;
const mix = (a, b, fraction) => a.map((value, index) => lerp(value, b[index], fraction));
const color = hex => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
const shade = (rgb, amount) => rgb.map(value => value * amount);
const hash = (x, y, z = 0) => {
  let seed = Math.imul(x + 719, 374761393) ^ Math.imul(y + 131, 668265263) ^ Math.imul(z + 23, 2147483647);
  seed = Math.imul(seed ^ seed >>> 13, 1274126177);
  return (seed ^ seed >>> 16) >>> 0;
};
const PALETTE = Object.freeze({
  0: '#eeeeee', 1: '#424753', 2: '#83634b', 3: '#768c53', 4: '#858c8b',
  5: '#85694b', 6: '#446d43', 7: '#424948', 8: '#a48568', 9: '#b69969',
  10: '#a68156', 11: '#d68c4c', 12: '#ddaa61', 13: '#486840',
});
const FACES = Object.freeze([
  { normal: [0, 1, 0], u: 0, v: 2, corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { normal: [0, -1, 0], u: 0, v: 2, corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { normal: [0, 0, -1], u: 0, v: 1, corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
  { normal: [0, 0, 1], u: 0, v: 1, corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { normal: [-1, 0, 0], u: 2, v: 1, corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { normal: [1, 0, 0], u: 2, v: 1, corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
]);

function dimensions(world) {
  return { x: world.width ?? world.sizeX, y: world.height ?? world.sizeY, z: world.depth ?? world.sizeZ };
}
export function survivalBlockAt(world, x, y, z) {
  const size = dimensions(world);
  if (x < 0 || y < 0 || z < 0 || x >= size.x || y >= size.y || z >= size.z) return 0;
  return world.blocks[x + size.x * (z + size.z * y)] || 0;
}
function tileFor(id, normal) {
  if (id === 3) return normal[1] > 0 ? 3 : normal[1] < 0 ? 2 : 14;
  if (id === 5 && normal[1] !== 0) return 15;
  return clamp(id, 0, 13);
}
function atlasUV(tile, u, v) {
  // Keep every edge half a texel inside its tile. Nearest sampling preserves
  // pixel art without the bleeding/mipmap halos of an unpadded atlas.
  return [((tile % 4) * TILE_SIZE + .5 + u * (TILE_SIZE - 1)) / ATLAS_SIZE,
    (Math.floor(tile / 4) * TILE_SIZE + .5 + v * (TILE_SIZE - 1)) / ATLAS_SIZE];
}
function cornerAO(world, x, y, z, face, corner) {
  const base = [x + face.normal[0], y + face.normal[1], z + face.normal[2]];
  const a = [...base], b = [...base], diagonal = [...base];
  const du = corner[face.u] ? 1 : -1, dv = corner[face.v] ? 1 : -1;
  a[face.u] += du; b[face.v] += dv; diagonal[face.u] += du; diagonal[face.v] += dv;
  const sideA = !!survivalBlockAt(world, ...a), sideB = !!survivalBlockAt(world, ...b), both = !!survivalBlockAt(world, ...diagonal);
  return sideA && sideB ? .58 : 1 - (Number(sideA) + Number(sideB) + Number(both)) * .11;
}

/** Pure exposed-face mesher, also usable by CPU budget/regression checks. */
export function buildSurvivalChunkMesh(world, chunkX, chunkZ) {
  const size = dimensions(world), chunkSize = world.chunkSize || CHUNK_SIZE;
  const startX = chunkX * chunkSize, startZ = chunkZ * chunkSize;
  const endX = Math.min(size.x, startX + chunkSize), endZ = Math.min(size.z, startZ + chunkSize);
  const vertices = [];
  let faces = 0;
  for (let y = 0; y < size.y; y++) for (let z = startZ; z < endZ; z++) for (let x = startX; x < endX; x++) {
    const id = survivalBlockAt(world, x, y, z);
    if (!id) continue;
    for (const face of FACES) {
      if (survivalBlockAt(world, x + face.normal[0], y + face.normal[1], z + face.normal[2])) continue;
      const tile = tileFor(id, face.normal), variation = .96 + (hash(x, y, z) % 9) * .009;
      const points = face.corners.map(corner => {
        const uv = atlasUV(tile, corner[face.u], corner[face.v]);
        const ao = cornerAO(world, x, y, z, face, corner) * variation;
        const glow = id === 11 || id === 12 ? .18 : 0;
        return [x + corner[0], y + corner[1], z + corner[2], ...face.normal, ao, ao, ao, ...uv, glow];
      });
      // Flip the internal diagonal toward the brighter AO pair, avoiding a
      // large dark wedge under overhangs while keeping outward winding.
      const order = points[0][6] + points[2][6] > points[1][6] + points[3][6] ? [0, 1, 3, 1, 2, 3] : [0, 1, 2, 0, 2, 3];
      for (const index of order) vertices.push(...points[index]);
      faces++;
    }
  }
  return { vertices: new Float32Array(vertices), faces, count: faces * 6 };
}

/** Deterministic, local pixel textures: no downloads or external dependency. */
export function createSurvivalAtlas() {
  const pixels = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4);
  for (let tile = 0; tile < 16; tile++) for (let py = 0; py < TILE_SIZE; py++) for (let px = 0; px < TILE_SIZE; px++) {
    let rgb = color(PALETTE[tile] || (tile === 14 ? '#83634b' : '#ad8d60'));
    const noise = hash(px >> 1, py >> 1, tile), speckle = noise % 19;
    let brightness = .90 + (speckle % 7) * .027;
    if (tile === 0) rgb = [1, 1, 1], brightness = 1;
    else if (tile === 1 || tile === 4) {
      if ((px + Math.floor(py / 8) * 7) % 16 === 0 || py % 16 === 0 && px % 16 < 11) brightness *= .80;
      if (speckle === 0) brightness *= 1.08;
    } else if (tile === 3) {
      if (speckle === 0) rgb = color('#acb076');
      if (speckle === 1) rgb = color('#667744');
    } else if (tile === 14) {
      // UV v points upward, so the turf seam really sits at the block top.
      const grassDepth = 3 + hash(px >> 2, 4) % 5;
      if (py >= TILE_SIZE - grassDepth) rgb = color('#768c53');
      else if (py >= TILE_SIZE - grassDepth - 1) brightness *= .81;
    } else if (tile === 5) {
      brightness *= [1, .78, 1.13, .93][Math.floor((px + (py > 15 ? 2 : 0)) / 4) % 4];
      if (px % 8 === 0 && py % 16 < 10) brightness *= .76;
    } else if (tile === 15) {
      const ring = Math.floor(Math.max(Math.abs(px - 15.5), Math.abs(py - 15.5)) / 3);
      rgb = color(ring % 2 ? '#967451' : '#b29063');
    } else if (tile === 6 || tile === 13) {
      brightness = [.84, .94, 1.02, 1.13][noise % 4];
      if (tile === 13 && ((px > 6 && px < 11 && py > 9 && py < 14) || (px > 21 && px < 26 && py > 19 && py < 24))) rgb = color('#bd6659'), brightness = 1;
    } else if (tile === 7 || tile === 8) {
      rgb = color('#858c8b');
      const ore = hash(Math.floor(px / 5), Math.floor(py / 5), tile) % 5 < 2;
      if (ore && px % 5 > 0 && py % 5 > 0) rgb = color(tile === 7 ? '#343c3b' : '#c59373'), brightness *= px % 5 === 1 ? 1.16 : 1;
    } else if (tile === 9 || tile === 10) {
      if (py % 8 === 0) brightness *= .62;
      if ((px + Math.floor(py / 8) * 13) % 32 === 0) brightness *= .67;
      if (py % 8 === 4 && px % 9 < 4) brightness *= .87;
      if (tile === 10 && (px === 4 || px === 27 || py === 4 || py === 27)) brightness *= .55;
    } else if (tile === 11) {
      rgb = color('#5a5146');
      if (Math.abs(px - 16) < 8 && Math.abs(py - 16) < 8) rgb = color((px + py) % 7 < 3 ? '#e9ad59' : '#c46c3f');
      if (py % 10 < 3) brightness *= .67;
    } else if (tile === 12) {
      rgb = color(py > 19 ? '#e5b666' : '#987454');
      if (py > 23 && px > 10 && px < 22) rgb = color('#ffe7a1');
      if (py < 19 && (px % 8 < 2)) brightness *= .7;
    }
    const offset = ((Math.floor(tile / 4) * TILE_SIZE + py) * ATLAS_SIZE + tile % 4 * TILE_SIZE + px) * 4;
    pixels[offset] = clamp(Math.round(rgb[0] * brightness * 255), 0, 255);
    pixels[offset + 1] = clamp(Math.round(rgb[1] * brightness * 255), 0, 255);
    pixels[offset + 2] = clamp(Math.round(rgb[2] * brightness * 255), 0, 255);
    pixels[offset + 3] = 255;
  }
  return { width: ATLAS_SIZE, height: ATLAS_SIZE, pixels };
}

function projection(fov, aspect) {
  const f = 1 / Math.tan(fov / 2), near = .045, far = 110, out = new Float32Array(16);
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) / (near - far); out[11] = -1; out[14] = 2 * far * near / (near - far);
  return out;
}
function viewMatrix(eye, yaw, pitch) {
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  const right = [cy, 0, sy], up = [-sy * sp, cp, cy * sp], forward = [sy * cp, sp, -cy * cp];
  const dot = vector => vector[0] * eye[0] + vector[1] * eye[1] + vector[2] * eye[2];
  return new Float32Array([right[0], up[0], -forward[0], 0, right[1], up[1], -forward[1], 0, right[2], up[2], -forward[2], 0, -dot(right), -dot(up), dot(forward), 1]);
}
const QUAD_ORDER = [0, 1, 2, 0, 2, 3];
const WHITE_UV = atlasUV(0, .5, .5);
export class SurvivalDynamicMesh {
  constructor() { this.vertices = new Float32Array(8192); this.length = 0; }
  reset() { this.length = 0; return this; }
  reserve(amount) {
    if (this.length + amount <= this.vertices.length) return;
    const next = new Float32Array(Math.max(this.vertices.length * 2, Math.ceil((this.length + amount) / 8192) * 8192));
    next.set(this.vertices.subarray(0, this.length)); this.vertices = next;
  }
  vertex(x, y, z, nx, ny, nz, rgb, emission) {
    const array = this.vertices, offset = this.length;
    array[offset] = x; array[offset + 1] = y; array[offset + 2] = z;
    array[offset + 3] = nx; array[offset + 4] = ny; array[offset + 5] = nz;
    array[offset + 6] = rgb[0]; array[offset + 7] = rgb[1]; array[offset + 8] = rgb[2];
    array[offset + 9] = WHITE_UV[0]; array[offset + 10] = WHITE_UV[1]; array[offset + 11] = emission;
    this.length += STRIDE;
  }
  box(x, y, z, width, height, depth, rgb, pose = null, emission = 0) {
    this.reserve(36 * STRIDE);
    const cy = pose ? Math.cos(pose.yaw || 0) : 1, sy = pose ? Math.sin(pose.yaw || 0) : 0;
    const cp = pose ? Math.cos(pose.pitch || 0) : 1, sp = pose ? Math.sin(pose.pitch || 0) : 0;
    const scale = pose?.scale || 1;
    for (const face of FACES) {
      const [nx, ny, nz] = face.normal, rotatedY = ny * cp - nz * sp, rotatedZ = ny * sp + nz * cp;
      const normalX = nx * cy - rotatedZ * sy, normalZ = nx * sy + rotatedZ * cy;
      for (const index of QUAD_ORDER) {
        const point = face.corners[index], px = (x + point[0] * width) * scale, py = (y + point[1] * height) * scale, pz = (z + point[2] * depth) * scale;
        const ry = py * cp - pz * sp, rz = py * sp + pz * cp;
        this.vertex(px * cy - rz * sy + (pose?.x || 0), ry + (pose?.y || 0), px * sy + rz * cy + (pose?.z || 0), normalX, rotatedY, normalZ, rgb, emission);
      }
    }
  }
  line(a, b, width, rgb, emission = .3) {
    const delta = b.map((value, index) => value - a[index]), length = Math.hypot(...delta);
    if (length <= 0) return;
    this.box(-width / 2, 0, -width / 2, width, length, width, rgb, {
      x: a[0], y: a[1], z: a[2], yaw: Math.atan2(-delta[0], delta[2]), pitch: Math.atan2(Math.hypot(delta[0], delta[2]), delta[1]),
    }, emission);
  }
  array() { return this.vertices.subarray(0, this.length); }
}
const Mesh = SurvivalDynamicMesh;
const VERTEX = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;
attribute vec2 aUV;
attribute float aEmission;
uniform mat4 uProjection;
uniform mat4 uView;
uniform vec3 uEye;
uniform vec3 uLight;
uniform vec3 uAmbient;
uniform vec3 uSun;
uniform vec4 uLamps[4];
varying vec3 vColor;
varying vec2 vUV;
varying float vDistance;
varying float vEmission;
void main() {
  gl_Position = uProjection * uView * vec4(aPosition, 1.0);
  vec3 normal = normalize(aNormal);
  vec3 illumination = uAmbient + uSun * max(0.0, dot(normal, uLight));
  illumination += vec3(0.06, 0.07, 0.06) * (normal.y * 0.5 + 0.5);
  for (int i = 0; i < 4; i++) {
    vec3 delta = uLamps[i].xyz - aPosition;
    float falloff = max(0.0, 1.0 - length(delta) / 7.0);
    float facing = max(0.20, dot(normal, normalize(delta + vec3(0.001))));
    illumination += vec3(0.80, 0.47, 0.19) * falloff * falloff * facing * uLamps[i].w;
  }
  vColor = aColor * illumination;
  vUV = aUV; vEmission = aEmission;
  vDistance = length(aPosition - uEye);
}`;
const FRAGMENT = `
precision mediump float;
uniform sampler2D uAtlas;
uniform vec3 uFog;
uniform float uOpacity;
uniform float uFogStrength;
varying vec3 vColor;
varying vec2 vUV;
varying float vDistance;
varying float vEmission;
void main() {
  vec3 texel = texture2D(uAtlas, vUV).rgb;
  vec3 lit = texel * vColor + texel * vEmission;
  float haze = smoothstep(18.0, 65.0, vDistance) * uFogStrength;
  gl_FragColor = vec4(mix(lit, uFog, haze), uOpacity);
}`;
const SKY_VERTEX = `attribute vec2 aPosition; varying vec2 vScreen;
void main() { gl_Position = vec4(aPosition, 0.999, 1.0); vScreen = aPosition; }`;
const SKY_FRAGMENT = `
precision mediump float;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunDirection;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uForward;
uniform vec2 uScale;
uniform float uDaylight;
uniform float uTime;
varying vec2 vScreen;
float square(vec3 ray, vec3 direction, float size) {
  vec3 side = normalize(cross(direction, vec3(0.0, 1.0, 0.0)));
  vec3 up = normalize(cross(side, direction));
  return step(abs(dot(ray, side)), size) * step(abs(dot(ray, up)), size) * step(0.99, dot(ray, direction));
}
void main() {
  vec3 ray = normalize(uForward + uRight * vScreen.x * uScale.x + uUp * vScreen.y * uScale.y);
  vec3 sky = mix(uHorizon, uTop, smoothstep(-0.04, 0.65, ray.y));
  vec3 sun = normalize(uSunDirection);
  float glow = pow(max(0.0, dot(ray, sun)), 36.0) * 0.15 * uDaylight;
  float disk = square(ray, sun, .025) * uDaylight;
  float moon = square(ray, -sun, .021) * (1.0 - uDaylight);
  vec2 cell = floor(ray.xz / max(.13, abs(ray.y)) * 48.0);
  float starHash = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  vec2 small = fract(ray.xz / max(.13, abs(ray.y)) * 48.0);
  float star = step(.991, starHash) * step(.37, small.x) * step(small.x, .60) * step(.37, small.y) * step(small.y, .60) * step(.14, ray.y) * (1.0 - uDaylight);
  // Wide block clouds drift slowly in world space, never tied to frame count.
  vec2 cloudCell = floor(ray.xz / max(.08, ray.y) * 8.0 + vec2(uTime * .008, 0.0));
  float cloudNoise = fract(sin(dot(cloudCell, vec2(41.1, 73.7))) * 951.1357);
  float clouds = step(.56, cloudNoise) * smoothstep(.07, .2, ray.y) * (1.0 - smoothstep(.27, .50, ray.y)) * .19 * uDaylight;
  sky = mix(sky, vec3(.92, .90, .78), clouds);
  sky = mix(sky, vec3(1.0, .89, .63), min(1.0, glow + disk));
  sky = mix(sky, vec3(.72, .83, .86), min(1.0, moon + star * .7));
  gl_FragColor = vec4(sky, 1.0);
}`;
function shader(gl, type, source) {
  const item = gl.createShader(type); gl.shaderSource(item, source); gl.compileShader(item);
  if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) {
    const reason = gl.getShaderInfoLog(item); gl.deleteShader(item); throw new Error(`Voxel Wilds shader: ${reason}`);
  }
  return item;
}
function program(gl, vertex, fragment) {
  const vs = shader(gl, gl.VERTEX_SHADER, vertex), fs = shader(gl, gl.FRAGMENT_SHADER, fragment), result = gl.createProgram();
  gl.attachShader(result, vs); gl.attachShader(result, fs); gl.linkProgram(result); gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) { const error = gl.getProgramInfoLog(result); gl.deleteProgram(result); throw new Error(`Voxel Wilds graphics: ${error}`); }
  return result;
}
function selectedItem(state, options) {
  return options.selectedItem || state.inventory?.[state.selectedSlot || 0] || null;
}
function targetOutline(mesh, target, tint, progress = 0) {
  const x = target.x - .004, y = target.y - .004, z = target.z - .004, extent = 1.008;
  for (let axis = 0; axis < 3; axis++) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    const start = [x, y, z], end = [x, y, z], others = [0, 1, 2].filter(value => value !== axis);
    start[others[0]] += a * extent; start[others[1]] += b * extent;
    for (let i = 0; i < 3; i++) end[i] = start[i]; end[axis] += extent;
    mesh.line(start, end, .013, tint, .45);
  }
  if (progress <= 0 || !target.normal) return;
  const normal = [target.normal.x, target.normal.y, target.normal.z], axis = normal.findIndex(value => value !== 0);
  if (axis < 0) return;
  const u = (axis + 1) % 3, v = (axis + 2) % 3, center = [target.x + .5, target.y + .5, target.z + .5];
  center[axis] += normal[axis] * .508;
  // Cracks sit on the contacted physical face; they cannot float through cover.
  const count = Math.min(7, 1 + Math.floor(progress * 7));
  for (let i = 0; i < count; i++) {
    const angle = i * 2.39996, a = [...center], b = [...center], radius = .15 + progress * .28;
    a[u] += Math.cos(angle) * .035; a[v] += Math.sin(angle) * .035;
    b[u] += Math.cos(angle) * radius; b[v] += Math.sin(angle) * radius;
    mesh.line(a, b, .019, [.16, .19, .15], .10);
  }
}
function enemyMesh(mesh, enemy, time, reducedMotion) {
  const flash = finite(enemy.hitFlash) > 0, wisp = enemy.type === 'wisp';
  const body = flash ? color('#d7ab83') : color(wisp ? '#73b7ba' : enemy.type === 'archer' ? '#727f63' : '#818474');
  const dark = color('#424e43'), eyes = color(wisp ? '#d3f0dd' : '#e0bc7e');
  const pose = { x: enemy.x, y: finite(enemy.y), z: enemy.z, yaw: finite(enemy.yaw), pitch: 0 };
  const gait = reducedMotion ? 0 : Math.sin(time * 7 + finite(enemy.id) * 1.7) * .045;
  if (wisp) {
    pose.y += reducedMotion ? .025 : .025 + Math.sin(time * 2.4 + finite(enemy.id)) * .025;
    mesh.box(-.25, .15, -.25, .50, .44, .50, body, pose, .35);
    mesh.box(-.18, .35, -.265, .11, .09, .016, eyes, pose, .7);
    mesh.box(.07, .35, -.265, .11, .09, .016, eyes, pose, .7);
    mesh.box(-.13, .02, -.13, .26, .13, .26, dark, pose, .15);
  } else {
    const height = finite(enemy.height, 1.5), head = Math.min(.44, height * .3);
    mesh.box(-.24, .40, -.19, .48, Math.max(.25, height - head - .40), .38, body, pose);
    mesh.box(-.24, height - head, -.24, .48, head, .48, body, pose);
    mesh.box(-.19, height - head * .62, -.253, .12, .07, .016, eyes, pose, .35);
    mesh.box(.07, height - head * .62, -.253, .12, .07, .016, eyes, pose, .35);
    mesh.box(-.20, .06 + gait, -.15, .17, .35, .29, dark, pose);
    mesh.box(.03, .06 - gait, -.15, .17, .35, .29, dark, pose);
    mesh.box(-.32, .51 + gait, -.12, .09, .43, .20, dark, pose);
    mesh.box(.23, .51 - gait, -.12, .09, .43, .20, dark, pose);
    if (enemy.type === 'archer') {
      mesh.box(.32, .54, -.33, .04, .58, .045, color('#bf9b6a'), pose);
      mesh.box(.33, .58, -.30, .02, .50, .018, color('#e3d2ae'), pose);
    }
  }
}
/** Action-relative hands start at the same pose regardless of world time. */
export function survivalHandMotion(state, camera, options = {}) {
  const player = options.player || state.player || camera;
  const time = finite(options.displayTime, finite(state.time));
  const moving = Math.hypot(finite(camera.vx), finite(camera.vz));
  const bob = options.reducedMotion ? 0 : Math.sin(time * 9) * Math.min(.011, moving * .0018);
  const miningState = options.mining === undefined ? state.mining : options.mining;
  const mining = miningState && finite(miningState.progress) > 0;
  const swinging = finite(player.swingTime) > 0 || mining;
  const progress = clamp(1 - finite(player.swingTime) / .22, 0, 1);
  const swing = options.reducedMotion ? (swinging ? .06 : 0)
    : player.swingTime > 0 ? Math.sin(progress * Math.PI) * .14
    : mining ? Math.sin(finite(miningState.progress) * 18) * .09 : 0;
  return { bob, swing };
}
function handMesh(state, camera, item, options, mesh) {
  const { bob, swing } = survivalHandMotion(state, camera, options);
  const pose = { x: .36 - swing * .30, y: -.38 + bob - Math.abs(swing) * .50, z: -.74 - Math.max(0, swing), yaw: -.20 - swing * 2.8, pitch: -.12 + swing * 2.1, scale: .70 };
  mesh.box(-.078, -.20, -.02, .15, .27, .16, color('#52614d'), pose);
  mesh.box(-.08, .01, -.04, .16, .14, .18, color('#c9a37b'), pose);
  const id = item?.id || '';
  if (id.endsWith('pick')) {
    const metal = color(id === 'iron-pick' ? '#b8c6c2' : id === 'stone-pick' ? '#8f9b95' : '#c49d67');
    mesh.box(-.025, .08, .013, .05, .40, .06, color('#967752'), pose);
    mesh.box(-.029, .17, .009, .058, .032, .068, color('#526254'), pose);
    mesh.box(-.029, .225, .009, .058, .027, .068, color('#65745c'), pose);
    mesh.box(-.017, .265, -.002, .017, .13, .016, color('#c1a37a'), pose);
    mesh.box(-.22, .42, -.01, .43, .078, .11, metal, pose);
    mesh.box(-.24, .33, -.01, .055, .10, .11, metal, pose);
    mesh.box(.18, .33, -.01, .055, .10, .11, metal, pose);
    mesh.box(-.07, .42, -.017, .14, .08, .123, color('#4e625a'), pose);
    mesh.box(-.225, .412, -.018, .43, .014, .012, shade(metal, 1.14), pose);
    mesh.box(-.07, .495, -.020, .14, .012, .126, color('#819381'), pose);
  } else if (id === 'sword') {
    mesh.box(-.023, .09, .01, .047, .13, .06, color('#927150'), pose);
    mesh.box(-.11, .20, -.003, .22, .046, .082, color('#747f74'), pose);
    mesh.box(-.045, .246, .003, .09, .51, .065, color('#bdcec7'), pose);
    mesh.box(-.021, .75, .01, .043, .067, .05, color('#dce5cf'), pose);
  } else if (id === 'torch') {
    mesh.box(-.045, .09, -.014, .09, .37, .09, color('#987450'), pose);
    mesh.box(-.07, .42, -.035, .14, .12, .14, color('#d88a4a'), pose, .4);
    mesh.box(-.043, .47, -.014, .086, .10, .09, color('#ffe0a1'), pose, .65);
  } else if (id) {
    const blockIds = { dirt: 2, stone: 4, wood: 5, plank: 9, workbench: 10, campfire: 11, berries: 13, coal: 7, 'iron-ore': 8, iron: 8 };
    const tint = color(PALETTE[blockIds[id]] || (id === 'bandage' ? '#e7dfc4' : '#8ea077'));
    mesh.box(-.12, .07, -.10, .24, .24, .24, tint, pose, id === 'campfire' ? .15 : 0);
    if (id === 'berries') {
      mesh.box(-.06, .27, -.12, .055, .055, .05, color('#d17b65'), pose);
      mesh.box(.027, .18, -.12, .057, .055, .05, color('#b85d52'), pose);
    }
  }
  return mesh.array();
}

export class SurvivalRenderer {
  constructor(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new Error('Voxel Wilds requires a canvas.');
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: true, powerPreference: 'high-performance' }) || canvas.getContext('experimental-webgl');
    if (!this.gl) throw new Error('Voxel Wilds needs WebGL. Enable browser hardware acceleration to play.');
    this.available = true; this.contextLost = false; this.destroyed = false; this.error = null;
    this.world = null; this.chunks = new Map(); this.lamps = []; this.particles = []; this.eventIds = new Set(); this.eventQueue = [];
    this.frameStats = {}; this._lastRevision = -1; this._lampCell = null; this._nearestLamps = []; this._lampArray = new Float32Array(16);
    this._dynamicMesh = new Mesh(); this._outlineMesh = new Mesh(); this._ghostMesh = new Mesh(); this._handMesh = new Mesh();
    this._onLost = event => {
      event.preventDefault(); this.available = false; this.contextLost = true;
      this.error = 'Graphics interrupted. Waiting for the browser to restore WebGL.';
      if (typeof CustomEvent === 'function') canvas.dispatchEvent(new CustomEvent('voxel-survival-renderer-error', { detail: { message: this.error, recoverable: true } }));
    };
    this._onRestored = () => {
      if (this.destroyed) return;
      try {
        this.chunks.clear(); this.world = null; this._lastRevision = -1; this._resources();
        this.contextLost = false; this.available = true; this.error = null; this.resize();
        if (typeof CustomEvent === 'function') canvas.dispatchEvent(new CustomEvent('voxel-survival-renderer-restored'));
      } catch (error) { this.error = error.message; this.available = false; }
    };
    canvas.addEventListener('webglcontextlost', this._onLost); canvas.addEventListener('webglcontextrestored', this._onRestored);
    try { this._resources(); this.resize(); } catch (error) { this.destroy(); throw error; }
  }
  _resources() {
    const gl = this.gl;
    this.program = program(gl, VERTEX, FRAGMENT);
    this.attributes = Object.fromEntries(['Position', 'Normal', 'Color', 'UV', 'Emission'].map(name => [name.toLowerCase(), gl.getAttribLocation(this.program, `a${name}`)]));
    this.uniforms = Object.fromEntries(['Projection', 'View', 'Eye', 'Light', 'Ambient', 'Sun', 'Fog', 'Opacity', 'FogStrength', 'Atlas'].map(name => [name.toLowerCase(), gl.getUniformLocation(this.program, `u${name}`)]));
    this.uniforms.lamps = gl.getUniformLocation(this.program, 'uLamps[0]');
    this.skyProgram = program(gl, SKY_VERTEX, SKY_FRAGMENT);
    this.skyPosition = gl.getAttribLocation(this.skyProgram, 'aPosition');
    this.skyUniforms = Object.fromEntries(['Top', 'Horizon', 'SunDirection', 'Right', 'Up', 'Forward', 'Scale', 'Daylight', 'Time'].map(name => [name.toLowerCase(), gl.getUniformLocation(this.skyProgram, `u${name}`)]));
    this.skyBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.dynamicBuffer = gl.createBuffer(); this.handBuffer = gl.createBuffer(); this.overlayBuffer = gl.createBuffer();
    this.dynamicCapacity = 0; this.handCapacity = 0; this.overlayCapacity = 0;
    const atlas = createSurvivalAtlas(); this.atlas = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlas.width, atlas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, atlas.pixels);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW); gl.disable(gl.DITHER);
  }
  resize() {
    if (this.destroyed || this.contextLost) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || this.canvas.clientWidth || 960), height = Math.max(1, rect.height || this.canvas.clientHeight || 540);
    const pixelRatio = Math.min(1.75, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, Math.sqrt(1800000 / (width * height)));
    const w = Math.round(width * pixelRatio), h = Math.round(height * pixelRatio);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = Math.max(1, w); this.canvas.height = Math.max(1, h); }
    this.aspect = width / height; this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  _clearWorld() {
    if (!this.contextLost) for (const chunk of this.chunks.values()) this.gl.deleteBuffer(chunk.buffer);
    this.chunks.clear(); this.lamps.length = 0; this._lampCell = null; this._nearestLamps = []; this.particles.length = 0; this.eventIds.clear(); this.eventQueue.length = 0; this._lastRevision = -1;
  }
  _updateWorld(world) {
    if (this.world !== world) { this._clearWorld(); this.world = world; }
    const size = dimensions(world), chunkSize = world.chunkSize || CHUNK_SIZE, countX = Math.ceil(size.x / chunkSize), countZ = Math.ceil(size.z / chunkSize);
    let uploads = 0;
    for (let cz = 0; cz < countZ; cz++) for (let cx = 0; cx < countX; cx++) {
      const key = cx + cz * countX, revision = world.chunkRevisions ? world.chunkRevisions[key] : finite(world.revision);
      let cached = this.chunks.get(key);
      if (cached && cached.revision === revision) continue;
      const mesh = buildSurvivalChunkMesh(world, cx, cz);
      if (!cached) { cached = { buffer: this.gl.createBuffer() }; this.chunks.set(key, cached); }
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, cached.buffer); this.gl.bufferData(this.gl.ARRAY_BUFFER, mesh.vertices, this.gl.STATIC_DRAW);
      cached.count = mesh.count; cached.faces = mesh.faces; cached.revision = revision; uploads++;
    }
    if (this._lastRevision !== world.revision || uploads) {
      this.lamps.length = 0; this._lampCell = null;
      for (let y = 0; y < size.y; y++) for (let z = 0; z < size.z; z++) for (let x = 0; x < size.x; x++) {
        const id = survivalBlockAt(world, x, y, z);
        if (id === 11 || id === 12) this.lamps.push({ x: x + .5, y: y + .8, z: z + .5, strength: id === 11 ? 1.2 : .9 });
      }
      this._lastRevision = world.revision;
    }
    this.frameStats.uploadedChunks = uploads;
  }
  _draw(mesh) {
    if (!mesh.count) return;
    const gl = this.gl, a = this.attributes, stride = STRIDE * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    for (const [name, count, offset] of [['position', 3, 0], ['normal', 3, 12], ['color', 3, 24], ['uv', 2, 36], ['emission', 1, 44]]) {
      gl.enableVertexAttribArray(a[name]); gl.vertexAttribPointer(a[name], count, gl.FLOAT, false, stride, offset);
    }
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count); this.frameStats.drawCalls++;
  }
  _dynamic(array, kind = 'dynamic') {
    const gl = this.gl, buffer = this[`${kind}Buffer`], key = `${kind}Capacity`;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (array.byteLength > this[key]) { this[key] = Math.max(8192, Math.ceil(array.byteLength / 8192) * 8192); gl.bufferData(gl.ARRAY_BUFFER, this[key], gl.DYNAMIC_DRAW); }
    if (array.byteLength) gl.bufferSubData(gl.ARRAY_BUFFER, 0, array);
    this.frameStats.dynamicVertices += array.length / STRIDE;
    return { buffer, count: array.length / STRIDE };
  }
  _events(state) {
    const time = finite(state.time);
    for (const event of state.events || []) {
      const key = event.id ?? `${event.type}:${event.time ?? event.tick}:${event.x}:${event.y}:${event.z}`;
      if (this.eventIds.has(key)) continue;
      this.eventIds.add(key); this.eventQueue.push(key);
      while (this.eventQueue.length > 128) this.eventIds.delete(this.eventQueue.shift());
      if (!['mined', 'hit', 'placed'].includes(event.type) || ![event.x, event.y, event.z].every(Number.isFinite)) continue;
      if (Number.isFinite(event.time) && time - event.time > .5) continue;
      const tint = color(PALETTE[event.blockId ?? event.idBlock ?? event.block ?? event.material] || (event.type === 'hit' ? '#a28671' : '#aa997b'));
      for (let i = 0; i < (event.type === 'placed' ? 3 : 6) && this.particles.length < MAX_PARTICLES; i++) {
        const seed = hash(i, this.eventQueue.length, Math.floor(time * 100));
        this.particles.push({ x: event.x + (event.type === 'hit' ? 0 : .5), y: event.y + (event.type === 'hit' ? 0 : .55), z: event.z + (event.type === 'hit' ? 0 : .5), born: time,
          vx: ((seed % 99) / 99 - .5) * 1.5, vy: .9 + ((seed >> 9) % 99) / 99, vz: (((seed >> 17) % 99) / 99 - .5) * 1.5, tint });
      }
    }
    let count = 0;
    for (const particle of this.particles) if (time - particle.born < .43 && time >= particle.born) this.particles[count++] = particle;
    this.particles.length = count;
  }
  /** Camera x/z are center, y is feet. Set camera.eye to an eye-height override. */
  render(state, camera = state?.player, options = {}) {
    if (!this.available || this.destroyed || this.contextLost || !state?.world?.blocks || !camera) return false;
    this.frameStats = { uploadedChunks: 0, drawCalls: 0, dynamicVertices: 0, staticVertices: 0, chunks: 0, particles: 0 };
    this._updateWorld(state.world); this._events(state);
    const gl = this.gl, yaw = finite(camera.yaw), pitch = clamp(finite(camera.pitch), -1.54, 1.54);
    const eye = [finite(camera.x), finite(camera.y) + finite(camera.eye, 1.62), finite(camera.z)];
    const time = finite(options.displayTime, finite(state.time)), dayTime = ((time % 180) + 180) % 180;
    // Twilight gives a useful transition before the engine's night attack wave.
    let daylight = state.night ? .10 : 1;
    if (dayTime > 100 && dayTime < 118) daylight = lerp(1, .10, (dayTime - 100) / 18);
    else if (dayTime > 170) daylight = lerp(.10, 1, (dayTime - 170) / 10);
    const dawn = color('#c8c4a2'), night = color('#263b49'), horizon = mix(night, dawn, daylight);
    const top = mix(color('#101f33'), color('#6f9ca6'), daylight);
    const sunAngle = dayTime < 110 ? dayTime / 110 * Math.PI : Math.PI + (dayTime - 110) / 70 * Math.PI;
    const light = [-.48, Math.sin(sunAngle), .58], lightLength = Math.hypot(...light);
    for (let i = 0; i < 3; i++) light[i] /= lightLength;
    const fov = finite(options.fov, Math.PI * .405), fovScale = Math.tan(fov / 2);
    const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
    gl.clearColor(...horizon, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.useProgram(this.skyProgram);
    const sky = this.skyUniforms;
    gl.uniform3fv(sky.top, top); gl.uniform3fv(sky.horizon, horizon); gl.uniform3fv(sky.sundirection, light);
    gl.uniform3fv(sky.right, [cy, 0, sy]); gl.uniform3fv(sky.up, [-sy * sp, cp, cy * sp]); gl.uniform3fv(sky.forward, [sy * cp, sp, -cy * cp]);
    gl.uniform2fv(sky.scale, [fovScale * this.aspect, fovScale]); gl.uniform1f(sky.daylight, daylight); gl.uniform1f(sky.time, time);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffer); gl.enableVertexAttribArray(this.skyPosition); gl.vertexAttribPointer(this.skyPosition, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.frameStats.drawCalls++;
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.useProgram(this.program);
    const u = this.uniforms;
    gl.uniformMatrix4fv(u.projection, false, projection(fov, this.aspect)); gl.uniformMatrix4fv(u.view, false, viewMatrix(eye, yaw, pitch)); gl.uniform3fv(u.eye, eye);
    gl.uniform3fv(u.light, light); gl.uniform3fv(u.ambient, mix([.29, .35, .39], [.61, .65, .54], daylight)); gl.uniform3fv(u.sun, mix([.10, .13, .15], [.42, .39, .27], daylight));
    gl.uniform3fv(u.fog, horizon); gl.uniform1f(u.fogstrength, .69); gl.uniform1f(u.opacity, 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.atlas); gl.uniform1i(u.atlas, 0);
    const item = selectedItem(state, options), lampArray = this._lampArray;
    // Even a deliberately lantern-filled world scans only when the camera
    // enters another block or the world changes. The cache contains four
    // references, rather than a sorted copy of every light on every RAF.
    const lampCell = `${Math.floor(eye[0])}:${Math.floor(eye[1])}:${Math.floor(eye[2])}`;
    if (this._lampCell !== lampCell) {
      const nearest = [], distances = [];
      for (const lamp of this.lamps) {
        const distance = (lamp.x - eye[0]) ** 2 + (lamp.y - eye[1]) ** 2 + (lamp.z - eye[2]) ** 2;
        let index = 0; while (index < distances.length && distances[index] <= distance) index++;
        if (index >= 4) continue;
        nearest.splice(index, 0, lamp); distances.splice(index, 0, distance);
        if (nearest.length > 4) nearest.pop(), distances.pop();
      }
      this._nearestLamps = nearest; this._lampCell = lampCell;
    }
    lampArray.fill(0);
    let lampCount = 0;
    if (item?.id === 'torch') { lampArray[0] = eye[0] + .3; lampArray[1] = eye[1] - .25; lampArray[2] = eye[2]; lampArray[3] = 1; lampCount++; }
    for (let index = 0; index < this._nearestLamps.length && lampCount < 4; index++, lampCount++) {
      const lamp = this._nearestLamps[index], offset = lampCount * 4;
      lampArray[offset] = lamp.x; lampArray[offset + 1] = lamp.y; lampArray[offset + 2] = lamp.z; lampArray[offset + 3] = lamp.strength;
    }
    gl.uniform4fv(u.lamps, lampArray);
    for (const chunk of this.chunks.values()) { this._draw(chunk); this.frameStats.staticVertices += chunk.count; this.frameStats.chunks++; }
    const dynamic = this._dynamicMesh.reset();
    const enemies = options.enemies || state.enemies || [];
    for (let index = 0; index < Math.min(enemies.length, MAX_ENEMIES); index++) {
      const enemy = enemies[index];
      if (enemy.hp <= 0 || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.z)) continue;
      enemyMesh(dynamic, enemy, time, options.reducedMotion);
    }
    const arrows = options.projectiles || state.projectiles || [];
    for (let index = 0; index < Math.min(arrows.length, 24); index++) {
      const arrow = arrows[index];
      if (!Number.isFinite(arrow.x) || !Number.isFinite(arrow.y) || !Number.isFinite(arrow.z) || arrow.life <= 0) continue;
      const speed = Math.hypot(finite(arrow.vx), finite(arrow.vy), finite(arrow.vz));
      if (speed < .001) continue;
      const tip = [arrow.x, arrow.y, arrow.z], tail = tip.map((value, axis) => value - [arrow.vx, arrow.vy, arrow.vz][axis] / speed * .32);
      dynamic.line(tail, tip, .018, color('#b9a579'), .16);
      dynamic.box(tip[0] - .017, tip[1] - .017, tip[2] - .017, .034, .034, .034, color('#cad4c2'), null, .18);
    }
    if (!options.reducedMotion) for (const particle of this.particles) {
      const age = Math.max(0, time - particle.born), amount = .043 * (1 - age / .43);
      const x = particle.x + particle.vx * age, y = particle.y + particle.vy * age - 3.6 * age * age, z = particle.z + particle.vz * age;
      // Dust remains inside clear cells instead of appearing through a ledge.
      if (survivalBlockAt(state.world, Math.floor(x), Math.floor(y), Math.floor(z))) continue;
      dynamic.box(x - amount / 2, y - amount / 2, z - amount / 2, amount, amount, amount, particle.tint);
      this.frameStats.particles++;
    }
    this._draw(this._dynamic(dynamic.array()));
    const outline = this._outlineMesh.reset(), target = options.target || state.target;
    if (target) {
      const mining = options.mining === undefined ? state.mining : options.mining, progress = mining && mining.x === target.x && mining.y === target.y && mining.z === target.z ? clamp(finite(mining.progress) / Math.max(.001, finite(mining.total, 1)), 0, 1) : 0;
      targetOutline(outline, target, color(progress ? '#d6b776' : '#d2d9b2'), progress);
    }
    const placement = options.placement || state.placement;
    if (placement) targetOutline(outline, placement, color(placement.valid ? '#8bc8ac' : '#d68575'));
    this._draw(this._dynamic(outline.array(), 'overlay'));
    if (placement) {
      const ghost = this._ghostMesh.reset(); ghost.box(placement.x + .006, placement.y + .006, placement.z + .006, .988, .988, .988, color(placement.valid ? '#8ac5a8' : '#ca806d'), null, .15);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.uniform1f(u.opacity, .16);
      this._draw(this._dynamic(ghost.array(), 'overlay')); gl.depthMask(true); gl.disable(gl.BLEND); gl.uniform1f(u.opacity, 1);
    }
    if (!options.hideHands && state.phase !== 'dead') {
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.uniformMatrix4fv(u.view, false, IDENTITY); gl.uniform3fv(u.eye, [0, 0, 0]); gl.uniform1f(u.fogstrength, 0);
      gl.uniform3fv(u.light, [-.36, .66, .62]); gl.uniform3fv(u.ambient, [.65, .68, .61]); gl.uniform3fv(u.sun, [.32, .31, .27]); gl.uniform4fv(u.lamps, new Float32Array(16));
      this._draw(this._dynamic(handMesh(state, camera, item, options, this._handMesh.reset()), 'hand'));
    }
    return true;
  }
  getStats() { return Object.freeze({ ...this.frameStats, cachedChunks: this.chunks.size, maxParticles: MAX_PARTICLES, maxEnemies: MAX_ENEMIES, pixelWidth: this.canvas.width, pixelHeight: this.canvas.height,
    dynamicScratchBytes: this._dynamicMesh.vertices.byteLength + this._outlineMesh.vertices.byteLength + this._ghostMesh.vertices.byteLength + this._handMesh.vertices.byteLength }); }
  get stats() { return this.getStats(); }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true; this.available = false; this.canvas.removeEventListener('webglcontextlost', this._onLost); this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
    if (!this.contextLost) {
      this._clearWorld();
      for (const buffer of [this.skyBuffer, this.dynamicBuffer, this.handBuffer, this.overlayBuffer]) if (buffer) this.gl.deleteBuffer(buffer);
      if (this.atlas) this.gl.deleteTexture(this.atlas);
      if (this.program) this.gl.deleteProgram(this.program); if (this.skyProgram) this.gl.deleteProgram(this.skyProgram);
    }
    this.chunks.clear(); this.world = null; this.particles.length = 0; this.lamps.length = 0;
  }
}
export const createSurvivalRenderer = canvas => new SurvivalRenderer(canvas);
