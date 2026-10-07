import { MAPS, WEAPONS } from './voxel-engine.js';

// All solid world surfaces come directly from the engine's minimum-corner
// colliders. Decoration is either painted on those surfaces or outside bounds.
const VERTEX_STRIDE = 10;
const MAX_PARTICLES = 84;
const MAX_TRACERS = 14;
const MAX_EVENT_IDS = 256;
const TEAM_COLORS = ['#efad64', '#66d3c8'];
const TAU = Math.PI * 2;
const ATMOSPHERE = Object.freeze({
  courtyard: { sun: [-.52, .76, .39], direct: [.66, .51, .35], ambient: [.45, .52, .60], top: '#729aac', horizon: '#efd1ac', sunColor: '#ffe2a6' },
  depot: { sun: [-.36, .88, -.31], direct: [.51, .59, .61], ambient: [.40, .49, .59], top: '#719cae', horizon: '#d0ddd9', sunColor: '#e8f2df' },
  canal: { sun: [.47, .81, -.35], direct: [.62, .58, .45], ambient: [.44, .52, .61], top: '#799fb6', horizon: '#e7dfc5', sunColor: '#fff0c5' },
});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

function rgba(value, alpha = 1) {
  if (Array.isArray(value)) return [value[0] ?? 1, value[1] ?? 1, value[2] ?? 1, value[3] ?? alpha];
  const hex = typeof value === 'string' ? value.replace('#', '') : '879498';
  if (hex.length === 3) return [parseInt(hex[0] + hex[0], 16) / 255, parseInt(hex[1] + hex[1], 16) / 255, parseInt(hex[2] + hex[2], 16) / 255, alpha];
  if (hex.length === 6 && /^[0-9a-f]+$/i.test(hex)) return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255, alpha];
  return [.53, .58, .60, alpha];
}
function shade(color, amount, alpha = color[3] ?? 1) {
  return [clamp(color[0] * amount, 0, 1), clamp(color[1] * amount, 0, 1), clamp(color[2] * amount, 0, 1), alpha];
}
function mix(a, b, amount) {
  return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount, a[3] ?? 1];
}
function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}
function rotate(vector, yaw = 0, pitch = 0) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const y = vector[1] * cp - vector[2] * sp;
  const z = vector[1] * sp + vector[2] * cp;
  return [vector[0] * cy - z * sy, y, vector[0] * sy + z * cy];
}
function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), out = new Float32Array(16);
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) / (near - far);
  out[11] = -1; out[14] = 2 * far * near / (near - far);
  return out;
}
function viewMatrix(eye, yaw, pitch) {
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  const right = [cy, 0, sy], up = [-sy * sp, cp, cy * sp], forward = [sy * cp, sp, -cy * cp];
  const dot = vector => vector[0] * eye[0] + vector[1] * eye[1] + vector[2] * eye[2];
  return new Float32Array([right[0], up[0], -forward[0], 0, right[1], up[1], -forward[1], 0, right[2], up[2], -forward[2], 0, -dot(right), -dot(up), dot(forward), 1]);
}
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

class Mesh {
  constructor() { this.vertices = []; }
  vertex(position, normal, color) { this.vertices.push(...position, ...normal, ...color); }
  quad(a, b, c, d, normal, color) {
    this.vertex(a, normal, color); this.vertex(b, normal, color); this.vertex(c, normal, color);
    this.vertex(a, normal, color); this.vertex(c, normal, color); this.vertex(d, normal, color);
  }
  box(x, y, z, w, h, d, color, pose = null) {
    if (w <= 0 || h <= 0 || d <= 0) return;
    const c = rgba(color), cy = shade(c, 1.075), low = shade(c, .83);
    const transform = point => {
      if (!pose) return point;
      const p = rotate(pose.scale ? point.map(value => value * pose.scale) : point, pose.yaw, pose.pitch);
      return [p[0] + pose.x, p[1] + pose.y, p[2] + pose.z];
    };
    const normal = value => pose ? rotate(value, pose.yaw, pose.pitch) : value;
    const face = (points, n, tint) => this.quad(...points.map(transform), normal(n), tint);
    face([[x, y + h, z], [x, y + h, z + d], [x + w, y + h, z + d], [x + w, y + h, z]], [0, 1, 0], cy);
    face([[x, y, z], [x + w, y, z], [x + w, y, z + d], [x, y, z + d]], [0, -1, 0], low);
    face([[x, y, z], [x, y + h, z], [x + w, y + h, z], [x + w, y, z]], [0, 0, -1], c);
    face([[x + w, y, z + d], [x + w, y + h, z + d], [x, y + h, z + d], [x, y, z + d]], [0, 0, 1], shade(c, .93));
    face([[x, y, z + d], [x, y + h, z + d], [x, y + h, z], [x, y, z]], [-1, 0, 0], shade(c, .94));
    face([[x + w, y, z], [x + w, y + h, z], [x + w, y + h, z + d], [x + w, y, z + d]], [1, 0, 0], shade(c, .98));
  }
  floor(x, z, w, d, color, y = .008) {
    this.quad([x, y, z], [x, y, z + d], [x + w, y, z + d], [x + w, y, z], [0, 1, 0], rgba(color));
  }
  floorPolygon(points, color, y = .006) {
    // The monotone hull supplies a convex silhouette for static sun shadows.
    const sorted = points.map(point => [...point]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const half = list => { const hull = []; for (const point of list) { while (hull.length > 1 && cross(hull.at(-2), hull.at(-1), point) <= 0) hull.pop(); hull.push(point); } return hull; };
    const hull = [...half(sorted).slice(0, -1), ...half(sorted.reverse()).slice(0, -1)], c = rgba(color);
    for (let i = 1; i < hull.length - 1; i++) {
      // Reverse the X/Z winding to point upward in the X/Y/Z world.
      for (const point of [hull[0], hull[i + 1], hull[i]]) this.vertex([point[0], y, point[1]], [0, 1, 0], c);
    }
  }
  panel(x, y, z, w, h, d, color) {
    const c = rgba(color);
    if (d <= w) {
      this.quad([x, y, z], [x, y + h, z], [x + w, y + h, z], [x + w, y, z], [0, 0, -1], c);
      this.quad([x + w, y, z + d], [x + w, y + h, z + d], [x, y + h, z + d], [x, y, z + d], [0, 0, 1], c);
    } else {
      this.quad([x, y, z + d], [x, y + h, z + d], [x, y + h, z], [x, y, z], [-1, 0, 0], c);
      this.quad([x + w, y, z], [x + w, y + h, z], [x + w, y + h, z + d], [x + w, y, z + d], [1, 0, 0], c);
    }
  }
  floorRing(x, z, inner, outer, color, y = .009, segments = 40) {
    const c = rgba(color);
    for (let i = 0; i < segments; i++) {
      const a = i * TAU / segments, b = (i + 1) * TAU / segments;
      this.quad([x + Math.sin(a) * inner, y, z + Math.cos(a) * inner], [x + Math.sin(a) * outer, y, z + Math.cos(a) * outer], [x + Math.sin(b) * outer, y, z + Math.cos(b) * outer], [x + Math.sin(b) * inner, y, z + Math.cos(b) * inner], [0, 1, 0], c);
    }
  }
  line(a, b, width, color, camera) {
    const delta = b.map((value, i) => value - a[i]);
    const middle = a.map((value, i) => (value + b[i]) / 2);
    const toEye = camera.map((value, i) => value - middle[i]);
    const side = [delta[1] * toEye[2] - delta[2] * toEye[1], delta[2] * toEye[0] - delta[0] * toEye[2], delta[0] * toEye[1] - delta[1] * toEye[0]];
    const length = Math.hypot(...side) || 1;
    const offset = side.map(value => value * width / length);
    this.quad(a.map((v, i) => v - offset[i]), b.map((v, i) => v - offset[i]), b.map((v, i) => v + offset[i]), a.map((v, i) => v + offset[i]), [0, 1, 0], rgba(color));
  }
  get array() { return new Float32Array(this.vertices); }
}

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec4 aColor;
uniform mat4 uProjection;
uniform mat4 uView;
uniform vec3 uEye;
uniform vec3 uLightDirection;
uniform vec3 uSun;
uniform vec3 uAmbient;
varying vec4 vColor;
varying float vDistance;
void main() {
  gl_Position = uProjection * uView * vec4(aPosition, 1.0);
  vec3 normal = normalize(aNormal);
  float direct = max(0.0, dot(normal, normalize(uLightDirection)));
  vec3 light = uAmbient + uSun * direct + vec3(0.08, 0.09, 0.10) * (normal.y * 0.5 + 0.5);
  vColor = vec4(aColor.rgb * light, aColor.a);
  vDistance = length(aPosition - uEye);
}`;
const FRAGMENT_SHADER = `
precision mediump float;
uniform vec3 uFog;
uniform float uFogStrength;
varying vec4 vColor;
varying float vDistance;
void main() {
  float fog = clamp((vDistance - 27.0) / 90.0, 0.0, 0.56) * uFogStrength;
  gl_FragColor = vec4(mix(vColor.rgb, uFog, fog), vColor.a);
}`;
const SKY_VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vScreen;
void main() {
  gl_Position = vec4(aPosition, 0.999, 1.0);
  vScreen = aPosition;
}`;
const SKY_FRAGMENT_SHADER = `
precision mediump float;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDirection;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uForward;
uniform vec2 uScale;
varying vec2 vScreen;
void main() {
  vec3 ray = normalize(uForward + uRight * vScreen.x * uScale.x + uUp * vScreen.y * uScale.y);
  vec3 sun = normalize(uSunDirection);
  float glow = pow(max(0.0, dot(ray, sun)), 48.0) * 0.13;
  // A tiny square sun suits the block world. Its basis is world-relative so
  // the sky and light direction remain attached to the map when looking up.
  vec3 side = normalize(cross(sun, vec3(0.0, 1.0, 0.0)));
  vec3 up = normalize(cross(side, sun));
  float square = step(abs(dot(ray, side)), 0.016) * step(abs(dot(ray, up)), 0.016) * step(0.99, dot(ray, sun));
  vec3 sky = mix(uHorizon, uTop, smoothstep(-0.05, 0.70, ray.y));
  gl_FragColor = vec4(mix(sky, uSunColor, min(1.0, glow + square)), 1.0);
}`;

function shader(gl, type, source) {
  const result = gl.createShader(type);
  gl.shaderSource(result, source); gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
    const reason = gl.getShaderInfoLog(result); gl.deleteShader(result);
    throw new Error(`Voxel shader could not compile: ${reason}`);
  }
  return result;
}
function rayCoverDistance(origin, direction, colliders, maximum) {
  let nearest = maximum;
  for (const collider of colliders) {
    let entry = 0, exit = nearest;
    const mins = [collider.x, collider.y, collider.z], maxs = [collider.x + collider.w, collider.y + collider.h, collider.z + collider.d];
    let valid = true;
    for (let axis = 0; axis < 3; axis++) {
      if (Math.abs(direction[axis]) < 1e-8) {
        if (origin[axis] < mins[axis] || origin[axis] > maxs[axis]) { valid = false; break; }
      } else {
        const a = (mins[axis] - origin[axis]) / direction[axis], b = (maxs[axis] - origin[axis]) / direction[axis];
        entry = Math.max(entry, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
        if (entry > exit) { valid = false; break; }
      }
    }
    if (valid && exit >= 0) nearest = Math.min(nearest, Math.max(0, entry));
  }
  return nearest;
}

const GLYPHS = Object.freeze({
  A: ['01110','10001','10001','11111','10001','10001','10001'], B: ['11110','10001','10001','11110','10001','10001','11110'],
  C: ['01111','10000','10000','10000','10000','10000','01111'], D: ['11110','10001','10001','10001','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'], F: ['11111','10000','10000','11110','10000','10000','10000'],
  G: ['01111','10000','10000','10111','10001','10001','01111'], H: ['10001','10001','10001','11111','10001','10001','10001'],
  I: ['111','010','010','010','010','010','111'], L: ['10000','10000','10000','10000','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'], N: ['10001','11001','10101','10011','10001','10001','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'], P: ['11110','10001','10001','11110','10000','10000','10000'],
  R: ['11110','10001','10001','11110','10100','10010','10001'], S: ['01111','10000','10000','01110','00001','00001','11110'],
  T: ['11111','00100','00100','00100','00100','00100','00100'], U: ['10001','10001','10001','10001','10001','10001','01110'],
  V: ['10001','10001','10001','10001','10001','01010','00100'], W: ['10001','10001','10001','10101','10101','10101','01010'],
  X: ['10001','10001','01010','00100','01010','10001','10001'], Y: ['10001','10001','01010','00100','00100','00100','00100'],
  '0': ['01110','10001','10011','10101','11001','10001','01110'], '1': ['010','110','010','010','010','010','111'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'], '3': ['11110','00001','00001','01110','00001','00001','11110'],
  '4': ['10010','10010','10010','11111','00010','00010','00010'], '5': ['11111','10000','10000','11110','00001','00001','11110'],
  '6': ['01110','10000','10000','11110','10001','10001','01110'], '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'], '9': ['01110','10001','10001','01111','00001','00001','01110'],
  '<': ['00100','01000','10000','11111','10000','01000','00100'], '>': ['00100','00010','00001','11111','00001','00010','00100'],
});

function wallPatch(mesh, collider, face, left, bottom, width, height, color, offset = .015) {
  if (width <= 0 || height <= 0) return;
  const { x, y, z, w, d } = collider, c = rgba(color), low = y + bottom, high = low + height;
  // Every patch is paint directly on an existing solid face. It never adds a
  // protruding prop, a fake doorway or an uncollidable sight-line obstruction.
  if (face === 'south') mesh.quad([x + left + width, low, z + d + offset], [x + left + width, high, z + d + offset], [x + left, high, z + d + offset], [x + left, low, z + d + offset], [0, 0, 1], c);
  if (face === 'north') mesh.quad([x + left, low, z - offset], [x + left, high, z - offset], [x + left + width, high, z - offset], [x + left + width, low, z - offset], [0, 0, -1], c);
  if (face === 'west') mesh.quad([x - offset, low, z + left + width], [x - offset, high, z + left + width], [x - offset, high, z + left], [x - offset, low, z + left], [-1, 0, 0], c);
  if (face === 'east') mesh.quad([x + w + offset, low, z + left], [x + w + offset, high, z + left], [x + w + offset, high, z + left + width], [x + w + offset, low, z + left + width], [1, 0, 0], c);
}

function wallText(mesh, collider, face, text, left, bottom, height, color, offset = .026) {
  const pixel = height / 7, reversed = face === 'north' || face === 'east';
  const glyphs = [...text].map(character => GLYPHS[character.toUpperCase()]);
  const total = glyphs.reduce((sum, glyph) => sum + (glyph ? glyph[0].length + 1 : 3), 0) - 1;
  let cursor = 0;
  for (const rows of glyphs) {
    if (rows) for (let row = 0; row < rows.length; row++) for (let column = 0; column < rows[row].length; column++) {
      if (rows[row][column] === '1') wallPatch(mesh, collider, face, left + (reversed ? total - cursor - column - 1 : cursor + column) * pixel, bottom + (6 - row) * pixel, pixel * .88, pixel * .88, color, offset);
    }
    cursor += rows ? rows[0].length + 1 : 3;
  }
}

function siteSign(mesh, collider, siteId) {
  const color = siteId === 'A' ? '#ecb964' : '#64c9bc', dark = '#263b3e';
  for (const face of ['north', 'south', 'west', 'east']) {
    const width = face === 'north' || face === 'south' ? collider.w : collider.d;
    if (width < .8) continue;
    const size = Math.min(.83, width - .22), left = (width - size) / 2;
    wallPatch(mesh, collider, face, left, 1.42, size, 1.02, dark, .025);
    wallPatch(mesh, collider, face, left + .04, 1.47, size - .08, .065, color, .028);
    wallText(mesh, collider, face, siteId, left + (size - .50) / 2, 1.67, .70, color, .03);
  }
}

function paintCollider(mesh, collider, theme) {
  const { x, y, z, w, h, d } = collider;
  const original = rgba(collider.color || (theme === 'canal' ? '#b6b0a2' : '#8d9b9b'));
  const material = String(collider.material || 'concrete').toLowerCase();
  const c = /wood|crate/.test(material) ? mix(original, rgba('#bd8042'), .28) : material === 'stone' && theme === 'courtyard' ? mix(original, rgba('#dfcbb1'), .24) : original;
  mesh.box(x, y, z, w, h, d, c);
  const detail = (xx, yy, zz, ww, hh, dd, color) => {
    if (Math.min(ww, dd) <= .049) mesh.panel(xx, yy, zz, ww, hh, dd, color);
    else mesh.box(xx, yy, zz, ww, hh, dd, color);
  };
  const skin = .012;
  const dark = shade(c, .58), pale = mix(c, rgba('#e4dfcb'), .30), accent = rgba(theme === 'canal' ? '#608f91' : theme === 'depot' ? '#c79152' : '#cc9d76');
  const rim = Math.min(.08, w / 5, d / 5, h / 6);
  if (material === 'water') {
    for (let i = 0; i < 9; i++) {
      const zz = z + .45 + i * Math.max(.25, (d - .8) / 9);
      mesh.floor(x + .20 + (i % 3) * .22, zz, Math.max(.15, w - .55 - (i % 2) * .45), .028, mix(c, rgba('#d9e8d6'), .30), y + h + .001);
    }
    return;
  }
  if (h > .5) {
    detail(x - skin, y + .035, z - skin, w + skin * 2, Math.min(.105, h / 8), d + skin * 2, dark);
    detail(x - skin, y + h - rim, z - skin, w + skin * 2, rim, d + skin * 2, pale);
  }
  if (/crate|wood|cargo|container|metal/.test(material)) {
    if (/wood|crate/.test(material)) {
      const boards = clamp(Math.round(h / .22), 2, 10);
      for (let i = 0; i < boards; i++) {
        const tint = shade(c, .88 + (hash(`${collider.id}:board:${i}`) % 5) * .045);
        for (const face of ['north', 'south']) wallPatch(mesh, collider, face, .05, i * h / boards + .025, w - .1, h / boards - .04, tint, .003);
        for (const face of ['west', 'east']) wallPatch(mesh, collider, face, .05, i * h / boards + .025, d - .1, h / boards - .04, tint, .003);
      }
      for (let xx = x + .05; xx < x + w - .05; xx += .28) mesh.floor(xx, z + .025, Math.min(.25, x + w - xx - .025), d - .05, shade(c, .9 + (hash(`${collider.id}:${xx}`) % 4) * .045), y + h + .002);
      for (const face of ['north', 'south']) for (const left of [.10, w - .13]) for (const bottom of [.15, h - .19]) wallPatch(mesh, collider, face, left, bottom, .035, .035, '#3b4140', .026);
    }
    const panelsX = clamp(Math.round(w / .65), 1, 18), panelsZ = clamp(Math.round(d / .65), 1, 18);
    for (let i = 0; i <= panelsX; i++) {
      const xx = x + .06 + i * (w - .12) / panelsX;
      detail(xx - .025, y + .15, z - skin, .05, Math.max(.04, h - .25), skin, dark);
      detail(xx - .025, y + .15, z + d, .05, Math.max(.04, h - .25), skin, dark);
    }
    for (let i = 0; i <= panelsZ; i++) {
      const zz = z + .06 + i * (d - .12) / panelsZ;
      detail(x - skin, y + .15, zz - .025, skin, Math.max(.04, h - .25), .05, dark);
      detail(x + w, y + .15, zz - .025, skin, Math.max(.04, h - .25), .05, dark);
    }
    if (w > .9 && h > .65) {
      for (const zz of [z - skin - .001, z + d + .001]) {
        detail(x + w * .15, y + h * .49, zz, w * .7, .12, skin, accent);
        detail(x + w * .30, y + h * .49 + .025, zz - .001, w * .32, .045, skin + .002, dark);
      }
    }
    if (/metal|container/.test(material) && w > 2 && h > 2) {
      for (const face of ['north', 'south']) {
        wallPatch(mesh, collider, face, w * .15, h * .57, w * .70, .78, shade(c, .73), .018);
        wallText(mesh, collider, face, 'CARGO', w * .19, h * .63, .48, '#e5dac2', .031);
        wallText(mesh, collider, face, String(hash(collider.id) % 90 + 10), w * .18, h * .34, .34, '#dcc29a', .032);
      }
      for (const zz of [z - skin - .002, z + d + .002]) {
        for (const fraction of [.28, .72]) {
          detail(x + w * fraction, y + .30, zz, .038, h - .56, skin + .004, pale);
          detail(x + w * fraction - .06, y + h * .38, zz - .002, .16, .07, skin + .009, '#313c40');
          for (const yy of [.45, h - .58]) detail(x + w * fraction - .055, y + yy, zz - .002, .14, .05, skin + .008, pale);
        }
      }
    }
    if (/wood|crate/.test(material)) {
      const count = clamp(Math.round(h / .25), 1, 12);
      for (let i = 1; i < count; i++) {
        detail(x - skin, y + i * h / count, z - skin, w + skin * 2, .013, d + skin * 2, dark);
      }
    }
    return;
  }
  if (/stone|brick|wall|plaster|concrete/.test(material)) {
    const count = clamp(Math.round(h / .48), 1, 14);
    for (let i = 1; i < count; i++) {
      const yy = y + i * h / count;
      detail(x - skin, yy, z - skin, w + skin * 2, .017, d + skin * 2, shade(c, .84));
      const rowsX = Math.min(20, Math.floor(w / 1.1)), rowsZ = Math.min(20, Math.floor(d / 1.1));
      for (let j = 0; j < rowsX; j++) {
        const xx = x + .50 + j * w / Math.max(1, rowsX) + (i % 2) * .25;
        if (xx < x + w - .06) {
          detail(xx, yy - h / count + .026, z - skin * .6, .013, h / count - .045, skin * .6, shade(c, .82));
          detail(xx, yy - h / count + .026, z + d, .013, h / count - .045, skin * .6, shade(c, .82));
        }
      }
      for (let j = 0; j < rowsZ; j++) {
        const zz = z + .50 + j * d / Math.max(1, rowsZ) + (i % 2) * .25;
        if (zz < z + d - .06) {
          detail(x - skin * .6, yy - h / count + .026, zz, skin * .6, h / count - .045, .013, shade(c, .82));
          detail(x + w, yy - h / count + .026, zz, skin * .6, h / count - .045, .013, shade(c, .82));
        }
      }
    }
    // Broad masonry faces get shallow vertical pilasters, never extra cover.
    if (h > 2.3) {
      const xxCount = clamp(Math.floor(w / 3), 0, 10), zzCount = clamp(Math.floor(d / 3), 0, 10);
      for (let i = 0; i <= xxCount && xxCount; i++) {
        const xx = x + .12 + i * (w - .24) / xxCount;
        detail(xx - .07, y + .12, z - skin * 2, .14, h - .16, skin * 2, pale);
        detail(xx - .07, y + .12, z + d, .14, h - .16, skin * 2, pale);
      }
      for (let i = 0; i <= zzCount && zzCount; i++) {
        const zz = z + .12 + i * (d - .24) / zzCount;
        detail(x - skin * 2, y + .12, zz - .07, skin * 2, h - .16, .14, pale);
        detail(x + w, y + .12, zz - .07, skin * 2, h - .16, .14, pale);
      }
      // Sealed ventilation panels sit above eye level. The full solid stone
      // behind them remains visible around the frame; they cannot suggest an
      // open doorway, crawlspace, or window that shots would pass through.
      const windowY = y + Math.min(h - .82, 2.30), glass = rgba(theme === 'courtyard' ? '#766f64' : '#526d76');
      for (let xx = x + 1.03; xx < x + w - .95 && w > 3; xx += 2.6) {
        for (const zz of [z - skin * 3, z + d]) {
          detail(xx - .38, windowY - .08, zz, .76, .64, skin * 3, dark);
          detail(xx - .32, windowY - .025, zz - .001, .64, .52, skin * 3 + .002, glass);
          for (let slat = 0; slat < 4; slat++) detail(xx - .32, windowY + slat * .135, zz - .002, .64, .024, skin * 3 + .004, pale);
          detail(xx - .39, windowY - .09, zz - .003, .78, .06, skin * 3 + .008, pale);
        }
      }
      for (let zz = z + 1.03; zz < z + d - .95 && d > 3; zz += 2.6) {
        for (const xx of [x - skin * 3, x + w]) {
          detail(xx, windowY - .08, zz - .38, skin * 3, .64, .76, dark);
          detail(xx - .001, windowY - .025, zz - .32, skin * 3 + .002, .52, .64, glass);
          for (let slat = 0; slat < 4; slat++) detail(xx - .002, windowY + slat * .135, zz - .32, skin * 3 + .004, .024, .64, pale);
          detail(xx - .003, windowY - .09, zz - .39, skin * 3 + .008, .06, .78, pale);
        }
      }
    }
    // Staggered stone wear is surface paint; its low contrast keeps the useful
    // outer silhouette stronger than the masonry pattern at long distances.
    for (const face of ['north', 'south', 'west', 'east']) {
      const width = face === 'north' || face === 'south' ? w : d;
      for (let left = .24; left < width - .60; left += 1.46) {
        const seed = hash(`${collider.id}:${face}:${left}`), bottom = .35 + seed % Math.max(1, Math.floor((h - .7) * 10)) / 10;
        wallPatch(mesh, collider, face, left, bottom, Math.min(.64, width - left - .10), .23, shade(c, seed % 2 ? 1.06 : .94), .004);
      }
      wallPatch(mesh, collider, face, 0, .02, width, Math.min(.14, h / 6), shade(c, .54), .014);
      wallPatch(mesh, collider, face, 0, h - .23, width, .085, mix(c, rgba('#e6dbc6'), .6), .014);
    }
  }
  if (String(collider.id).includes('planter')) {
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      mesh.floor(x + .05 + i * (w - .1) / 5, z + .05 + j * (d - .1) / 5, (w - .1) / 5, (d - .1) / 5, (i + j) % 2 ? '#6e8263' : '#81936c', y + h + .001);
    }
  }
}

function floorLetter(mesh, letter, x, z, size, color) {
  const rows = GLYPHS[letter] || GLYPHS.A;
  const pixel = size / 7;
  for (let row = 0; row < rows.length; row++) {
    for (let column = 0; column < rows[row].length; column++) {
      if (rows[row][column] === '1') mesh.floor(x + (column - 2.5) * pixel, z + (row - 3.5) * pixel, pixel * .87, pixel * .87, color, .014);
    }
  }
}

function mapPaint(mesh, map, theme) {
  const find = id => map.colliders.find(collider => collider.id === id);
  const siteColumn = id => id === 'A' ? find(theme === 'courtyard' ? 'west-site-column' : theme === 'depot' ? 'west-loading-column' : 'west-site-pillar') : find(theme === 'courtyard' ? 'east-site-column' : theme === 'depot' ? 'east-loading-column' : 'east-site-pillar');
  for (const site of map.sites) { const column = siteColumn(site.id); if (column) siteSign(mesh, column, site.id); }
  if (theme === 'courtyard') {
    for (const side of ['west', 'east']) {
      const collider = find(`${side}-arcade`), color = side === 'west' ? '#dfa962' : '#68aaa2';
      for (const face of ['north', 'south']) {
        wallPatch(mesh, collider, face, .24, 1.57, 2.02, .73, '#354648', .027);
        const label = face === 'south' ? (side === 'west' ? 'A <' : '> B') : (side === 'west' ? '> A' : 'B <');
        wallText(mesh, collider, face, label, .42, 1.73, .45, color, .034);
        wallPatch(mesh, collider, face, .28, .48, collider.w - .56, .08, color, .025);
      }
    }
    const central = find('central-north');
    for (const face of ['north', 'south']) {
      wallPatch(mesh, central, face, 3.53, 2.01, 2.94, .93, '#9b6851', .025);
      wallText(mesh, central, face, 'COURT', 3.75, 2.28, .49, '#edd9b3', .034);
    }
  } else if (theme === 'depot') {
    // Loading-lane markings sit on traversable asphalt, never on phantom kerbs.
    for (const x of [-10.2, 10.2]) {
      for (let z = -18; z < 19; z += 3.2) mesh.floor(x - .055, z, .11, 1.5, '#c8ac68', .005);
    }
    for (const site of map.sites) {
      mesh.floor(site.x - 2.75, site.z - 2.75, 5.5, .075, '#d6b35f', .005);
      mesh.floor(site.x - 2.75, site.z + 2.70, 5.5, .075, '#d6b35f', .005);
      for (const x of [site.x - 2.75, site.x + 2.70]) mesh.floor(x, site.z - 2.75, .075, 5.5, '#d6b35f', .005);
    }
    const central = find('mid-container');
    for (const face of ['west', 'east']) {
      wallPatch(mesh, central, face, .34, .42, .14, 2.32, '#d7b269', .032);
      wallText(mesh, central, face, '03', .79, 1.31, .82, '#eddfc7', .032);
    }
  } else {
    for (const side of ['west', 'east']) {
      const market = find(`${side}-market`), accent = side === 'west' ? '#527f81' : '#bf7f59';
      for (const face of ['north', 'south']) {
        wallPatch(mesh, market, face, .08, .19, market.w - .16, .55, accent, .024);
        for (let left = .10; left < market.w - .10; left += .72) wallPatch(mesh, market, face, left, 2.74, .33, .34, '#d6d4b6', .025);
        wallPatch(mesh, market, face, 2.25, 1.5, 2.5, .85, accent, .024);
        wallText(mesh, market, face, 'MARCHE', 2.38, 1.71, .40, '#eee2bf', .030);
      }
    }
    for (const id of ['canal-west-bank', 'canal-east-bank']) {
      const bank = find(id);
      for (let z = bank.z + .20; z < bank.z + bank.d - .20; z += .38) mesh.floor(bank.x + .025, z, bank.w - .05, .035, '#d0cdb7', bank.y + bank.h + .003);
    }
  }
}

function mapMeshes(map) {
  const opaque = new Mesh(), shadows = new Mesh();
  const bounds = map.bounds || { minX: -25, maxX: 25, minZ: -25, maxZ: 25 };
  const theme = map.theme || map.id;
  const floorColor = mix(rgba(map.floorColor || '#929b8b'), rgba(theme === 'courtyard' ? '#d7c7aa' : theme === 'depot' ? '#4f626c' : '#a9b8b2'), .36);
  const { minX, maxX, minZ, maxZ } = bounds;
  const width = maxX - minX, depth = maxZ - minZ;
  opaque.floor(minX - 35, minZ - 35, width + 70, depth + 70, shade(floorColor, .72), -.025);
  opaque.floor(minX, minZ, width, depth, floorColor, 0);
  // Repeating paving seams are flat markings, so visible traversable ground is
  // identical to collision ground. A single GPU mesh serves the entire map.
  const tile = theme === 'depot' ? 5 : theme === 'canal' ? 1.6 : 2.5;
  for (let x = minX; x < maxX; x += tile) for (let z = minZ; z < maxZ; z += tile) {
    const seed = hash(`${map.id}:${x}:${z}`), lane = theme === 'courtyard' && Math.abs(Math.abs(x + tile / 2) - 11) < 2;
    const tint = shade(floorColor, .94 + seed % 5 * .022);
    opaque.floor(x + .025, z + .025, Math.min(tile - .05, maxX - x - .025), Math.min(tile - .05, maxZ - z - .025), lane ? mix(tint, rgba('#94a09a'), .25) : tint, .001);
    if (theme === 'depot' && seed % 4 === 0) opaque.floor(x + .27, z + .57, tile * .49, tile * .44, shade(floorColor, .89), .002);
  }
  const atmosphere = ATMOSPHERE[theme] || ATMOSPHERE.courtyard;
  for (const collider of map.colliders || []) {
    paintCollider(opaque, collider, theme);
    if (collider.h < .15) continue;
    const sun = atmosphere.sun, dx = -sun[0] / sun[1] * collider.h, dz = -sun[2] / sun[1] * collider.h;
    for (let layer = 3; layer >= 0; layer--) {
      const soft = .035 + layer * .075;
      const corners = [[collider.x - soft, collider.z - soft], [collider.x + collider.w + soft, collider.z - soft], [collider.x + collider.w + soft, collider.z + collider.d + soft], [collider.x - soft, collider.z + collider.d + soft]];
      shadows.floorPolygon([...corners, ...corners.map(point => [point[0] + dx, point[1] + dz])], [.075, .095, .13, .062], .005 + (3 - layer) * .0003);
    }
    shadows.floor(collider.x - .08, collider.z - .08, collider.w + .16, collider.d + .16, [.055, .07, .08, .22], .007);
  }
  mapPaint(opaque, map, theme);
  for (const site of map.sites || []) {
    const color = site.id === 'A' ? rgba('#d9ae72') : rgba('#69bcb6');
    const radius = site.radius || 2.2;
    opaque.floorRing(site.x, site.z, radius - .045, radius + .045, color);
    floorLetter(opaque, site.id, site.x, site.z, 1.25, color);
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      opaque.floor(site.x + Math.sin(angle) * (radius + .20) - .075, site.z + Math.cos(angle) * (radius + .20) - .075, .15, .15, color);
    }
  }
  // Only skyline geometry sits outside the collision perimeter. It cannot
  // create misleading obstacles, routes, or peek-through decorative windows.
  const skylineColor = rgba(theme === 'canal' ? '#657c81' : theme === 'depot' ? '#5f747c' : '#748b90');
  const backdrop = (axis, side, start, length) => {
    for (let i = 0; i < length; i += 4.5) {
      const seed = hash(`${map.id}:${axis}:${side}:${i}`), h = 6 + seed % 7;
      const x = axis === 'x' ? side : start + i;
      const z = axis === 'z' ? side : start + i;
      const w = axis === 'x' ? 4 : 4.1, d = axis === 'z' ? 4 : 4.1;
      const c = shade(skylineColor, .80 + (seed % 4) * .07);
      opaque.box(x, -.05, z, w, h, d, c);
      opaque.box(x - .07, h - .2, z - .07, w + .14, .18, d + .14, shade(c, .70));
      if (theme === 'courtyard') opaque.box(x + .16, h, z + .16, w - .32, .30, d - .32, mix(c, rgba('#ad8971'), .34));
      if (theme === 'depot' && seed % 3 === 0) {
        opaque.box(x + .45, h, z + .45, 1.4, .72, 1.6, shade(c, .72));
        opaque.box(x + 2.50, h, z + 1.1, .38, 2.3, .38, '#80634f');
      }
      if (theme === 'canal') {
        opaque.box(x + .1, h, z + .1, w - .2, .40, d - .2, mix(c, rgba('#b48369'), .42));
        opaque.box(x + .65, h + .4, z + .8, 2.6, .35, 2.4, mix(c, rgba('#b48369'), .54));
      }
      if (seed % 4 === 0) {
        const xx = x + 1.2, zz = z + 1.4;
        opaque.box(xx, h - .02, zz, .075, 1.70, .075, '#4b626b');
        opaque.box(xx - .55, h + 1.14, zz, 1.18, .055, .055, '#4b626b');
        opaque.box(xx - .35, h + 1.54, zz, .78, .055, .055, '#4b626b');
        opaque.box(x + 2.5, h, z + .55, .68, .40, .75, shade(c, .80));
      }
      for (let level = 1.8; level < h - .8; level += 1.55) {
        for (let slot = .55; slot < 3.8; slot += 1.15) {
          const glass = ((seed + Math.round(level * 10) + Math.round(slot * 7)) % 4 === 0) ? '#bcaa79' : '#526d76';
          // Outward backdrop faces on both axes remain aligned to their walls.
          const building = { x, y: 0, z, w, d };
          for (const face of ['north', 'south', 'west', 'east']) wallPatch(opaque, building, face, slot, level, .48, .62, glass, .012);
        }
      }
    }
  };
  backdrop('z', minZ - 11, minX - 8, width + 16);
  backdrop('z', maxZ + 7, minX - 8, width + 16);
  backdrop('x', minX - 11, minZ - 8, depth + 16);
  backdrop('x', maxX + 7, minZ - 8, depth + 16);
  const cloud = rgba(theme === 'courtyard' ? '#f4dcc0' : '#dfe9df');
  for (let i = 0; i < 6; i++) {
    const seed = hash(`${map.id}:cloud:${i}`), xx = minX - 22 + i * 17, zz = minZ - 28 + (seed % 35), yy = 23 + seed % 7;
    opaque.box(xx, yy, zz, 8 + seed % 5, .65, 3.6, cloud);
    opaque.box(xx + 2, yy + .62, zz + .7, 5.5, .65, 2.5, shade(cloud, 1.025));
    opaque.box(xx + 7, yy - .35, zz + .45, 4.5, .40, 2.5, shade(cloud, .94));
  }
  return { opaque: opaque.array, shadows: shadows.array };
}

function weaponParts(mesh, weapon, pose, options = {}) {
  const rifle = !/pistol|sidearm/.test(weapon || ''), smg = /smg|compact/.test(weapon || ''), marksman = weapon === 'marksman';
  const length = rifle ? (smg ? .68 : marksman ? 1.04 : .92) : .42;
  const limit = options.limit ?? length + .20;
  const body = rgba(options.body || (smg ? '#506f76' : marksman ? '#465d62' : '#57675e')), trim = '#202d32', metal = '#b2bfb7';
  const reload = clamp(finite(options.reloadProgress), 0, 1), magazineDrop = reload > .04 && reload < .64 ? Math.sin((reload - .04) / .60 * Math.PI) * .25 : 0;
  const part = (x, y, z, w, h, d, color) => {
    // The weapon points down local -Z. Clamp each part at the first solid
    // cover contact so a barrel cannot reappear through a thin wall.
    const clippedZ = Math.max(z, -limit);
    const clippedDepth = z + d - clippedZ;
    if (clippedDepth > 0) mesh.box(x, y, clippedZ, w, h, clippedDepth, color, pose);
  };
  if (rifle) {
    part(-.067, -.055, -.44, .134, .145, .45, body);
    part(-.055, -.032, -.64, .11, .10, .24, trim);
    part(-.025, -.014, -length, .05, .054, length - .60 + .04, metal);
    part(-.041, -.02, -length - .035, .082, .075, .06, trim);
    part(-.049, .080, -.36, .098, .040, .30, '#262f35');
    part(-.016, .120, -.41, .032, .030, .05, '#b8c5bc');
    part(-.020, .116, -.18, .040, .041, .055, '#b8c5bc');
    part(-.045, -.25 - magazineDrop, -.18 + magazineDrop * .16, .09, .20, .105, trim);
    part(-.045, -.23 - magazineDrop, -.182 + magazineDrop * .16, .09, .04, .109, '#738b80');
    part(-.06, -.067, -.06, .12, .125, .25, options.stock || '#b39872');
    part(-.033, -.19, -.035, .066, .13, .09, '#6a746d');
    part(-.072, .016, -.51, .144, .014, .045, '#c6a474');
    part(-.071, -.016, -.36, .008, .07, .13, '#9ba99c');
    part(.067, -.016, -.34, .008, .060, .18, '#293c3e');
    for (let i = 0; i < 4; i++) part(-.06, .026, -.61 + i * .045, .12, .012, .017, '#667f78');
    const bolt = options.bolt || (reload > .72 && reload < .90 ? Math.sin((reload - .72) / .18 * Math.PI) : 0);
    part(.061, .022, -.23 + bolt * .09, .046, .025, .06, metal);
    if (smg) {
      part(-.079, -.04, -.50, .016, .082, .14, '#77a9a5');
      part(.063, -.04, -.50, .016, .082, .14, '#77a9a5');
      part(-.073, -.014, .15, .146, .055, .055, '#748a80');
    }
    if (marksman) {
      part(-.055, .11, -.43, .11, .13, .30, '#2c3f43');
      part(-.063, .115, -.465, .126, .12, .045, '#202f34');
      part(-.040, .132, -.469, .08, .075, .004, '#73aaa7');
      part(-.063, .115, -.14, .126, .12, .045, '#202f34');
      part(-.03, -.023, -.68, .06, .025, .05, '#bca6de');
      part(-.040, .132, -.094, .08, .075, .004, '#5f9c9d');
      part(-.011, .132, -.089, .007, .075, .002, '#203d40');
      part(-.040, .165, -.089, .08, .006, .002, '#203d40');
      part(-.011, .201, -.13, .032, .010, .008, '#c0d9c5');
    }
  } else {
    part(-.048, -.025, -.38, .096, .088, .34, body);
    part(-.046, .063, -.385, .092, .04, .345, metal);
    part(-.022, -.018, -.44, .044, .044, .065, trim);
    part(-.040, -.19, -.11, .08, .18, .105, trim);
    part(-.032, .103, -.10, .064, .025, .035, '#232e32');
    part(-.016, .102, -.36, .032, .024, .025, '#dab46a');
  }
  return length;
}

function playerMesh(mesh, player, map, time, allied) {
  const crouch = player.crouching, scale = crouch ? 1.15 / 1.8 : 1;
  const yaw = finite(player.yaw), pitch = clamp(finite(player.pitch) + finite(player.recoil), -1.45, 1.45);
  // The simulation targets axis-aligned voxel boxes. Quarter-turn silhouettes
  // keep the visible body and exact square head inside those hitboxes at every
  // aim angle; the held weapon still follows continuous yaw and pitch.
  const bodyYaw = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
  const pose = { x: player.x, y: finite(player.y), z: player.z, yaw: bodyYaw, pitch: 0 };
  const color = TEAM_COLORS[player.team === 1 ? 1 : 0];
  const team = rgba(color), uniform = mix(team, rgba('#27373e'), .33), dark = '#202f36', plate = '#34484f';
  const box = (x, y, z, w, h, d, c) => {
    const bottom = y * scale, top = Math.min((y + h) * scale, crouch ? .83 : 1.48);
    mesh.box(x, bottom, z, w, top - bottom, d, c, pose);
  };
  const speed = Math.hypot(finite(player.vx), finite(player.vz));
  const step = Math.sin(time * .011 + (hash(player.id) % 30)) * clamp(speed / 6, 0, 1) * .075;
  box(-.245, .018, -.18 + step, .205, .18, .33, dark);
  box(.04, .018, -.18 - step, .205, .18, .33, dark);
  box(-.22, .17, -.11 + step, .18, .62, .23, uniform);
  box(.04, .17, -.11 - step, .18, .62, .23, uniform);
  box(-.24, .47, -.132 + step, .20, .15, .036, plate);
  box(.035, .47, -.132 - step, .20, .15, .036, plate);
  box(-.29, .78, -.20, .58, .62, .40, uniform);
  box(-.25, .87, -.25, .50, .39, .065, plate);
  box(-.21, 1.25, -.255, .42, .075, .035, team);
  for (const xx of [-.18, -.025, .13]) box(xx, .97, -.29, .11, .18, .08, '#79897c');
  box(-.29, .80, -.23, .58, .075, .46, '#2d393c');
  box(-.21, .89, .16, .42, .35, .12, '#465b5b');
  box(-.29, 1.16, -.12, .10, .22, .22, uniform);
  box(.19, 1.16, -.12, .10, .22, .22, uniform);
  box(-.285, 1.28, -.245, .09, .065, .025, team);
  box(.195, 1.28, -.245, .09, .065, .025, team);
  box(-.13, 1.40, -.13, .26, .09, .26, '#344a4c');
  // Head width and top match the engine's real ±.22, top 1.8/1.15 box.
  const headBase = crouch ? .83 : 1.48;
  const headPose = { ...pose, y: pose.y + headBase, pitch: 0 };
  const eyeY = .095 + Math.sin(pitch) * .018;
  mesh.box(-.22, 0, -.22, .44, .32, .44, '#344a4d', headPose);
  mesh.box(-.22, .19, -.22, .44, .13, .44, mix(team, rgba('#5a736c'), .52), headPose);
  mesh.box(-.185, .072, -.22, .37, .07, .006, '#bdc6ac', headPose);
  mesh.box(-.155, eyeY, -.22, .12, .022, .009, '#121f26', headPose);
  mesh.box(.038, eyeY, -.22, .12, .022, .009, '#121f26', headPose);
  mesh.box(-.20, 0, -.22, .40, .067, .006, '#22383c', headPose);
  mesh.box(-.22, .088, -.13, .031, .15, .15, '#25383c', headPose);
  mesh.box(.189, .088, -.13, .031, .15, .15, '#25383c', headPose);
  mesh.box(-.07, .23, -.22, .14, .04, .006, team, headPose);
  mesh.box(-.22, .235, -.12, .006, .035, .24, team, headPose);
  mesh.box(.214, .235, -.12, .006, .035, .24, team, headPose);
  const handOffset = rotate([.21, crouch ? .82 : 1.24, -.24], yaw);
  const reloadProgress = player.reloadTicks > 0 ? clamp(1 - player.reloadTicks / (WEAPONS[player.weapon]?.reloadTicks || 252), 0, 1) : 0;
  const reloadTilt = Math.sin(reloadProgress * Math.PI);
  const gunPose = { x: pose.x + handOffset[0], y: pose.y + handOffset[1] - reloadTilt * .12, z: pose.z + handOffset[2], yaw, pitch: pitch - reloadTilt * .24 };
  const direction = [Math.sin(yaw) * Math.cos(gunPose.pitch), Math.sin(gunPose.pitch), -Math.cos(yaw) * Math.cos(gunPose.pitch)];
  const limit = Math.max(0, rayCoverDistance([gunPose.x, gunPose.y, gunPose.z], direction, map.colliders || [], 1.05) - .015);
  weaponParts(mesh, player.weapon, gunPose, { limit, stock: color, reloadProgress });
  mesh.box(-.33, -.072, -.43, .17, .14, .26, '#526662', gunPose);
  mesh.box(-.08, -.14, -.11, .13, .14, .17, '#526662', gunPose);
  if (allied) {
    // A small in-world team tab is depth-tested like every other triangle.
    mesh.box(-.055, (crouch ? 1.15 : 1.8) + .09, -.045, .11, .045, .09, team, pose);
  }
}

export class VoxelRenderer {
  constructor(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new Error('A canvas is required for Voxel Breach.');
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }) || canvas.getContext('experimental-webgl');
    if (!this.gl) throw new Error('Voxel Breach needs WebGL. Enable hardware acceleration in your browser and reopen the game.');
    this.available = true; this.contextLost = false; this.error = null; this.destroyed = false;
    this.mapCache = new Map(); this.mapId = null; this.eventIds = new Set(); this.eventQueue = [];
    this.particles = []; this.tracers = []; this.localShot = null; this.localReload = null;
    this.lastAim = null; this.swayX = 0; this.swayY = 0;
    this._onLost = event => {
      event.preventDefault(); this.contextLost = true; this.available = false;
      this.error = 'The 3D graphics context was interrupted. Waiting for the browser to restore it.';
      this._notify(this.error, true);
    };
    this._onRestored = () => {
      if (this.destroyed) return;
      try {
        this.mapCache.clear(); this._createResources(); this.contextLost = false; this.available = true; this.error = null; this.resetEffects();
        this.canvas.dispatchEvent(new CustomEvent('voxel-renderer-restored'));
      } catch (error) { this.error = error.message; this.available = false; this._notify(this.error, false); }
    };
    canvas.addEventListener('webglcontextlost', this._onLost, false);
    canvas.addEventListener('webglcontextrestored', this._onRestored, false);
    try { this._createResources(); this.resize(); } catch (error) { this.destroy(); throw error; }
  }
  _notify(message, recoverable) {
    if (typeof CustomEvent === 'function') this.canvas.dispatchEvent(new CustomEvent('voxel-renderer-error', { detail: { message, recoverable } }));
  }
  _createResources() {
    const gl = this.gl;
    const vertex = shader(gl, gl.VERTEX_SHADER, VERTEX_SHADER), fragment = shader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const reason = gl.getProgramInfoLog(program); gl.deleteProgram(program);
      throw new Error(`Voxel graphics could not initialize: ${reason}`);
    }
    this.program = program;
    this.attributes = { position: gl.getAttribLocation(program, 'aPosition'), normal: gl.getAttribLocation(program, 'aNormal'), color: gl.getAttribLocation(program, 'aColor') };
    this.uniforms = Object.fromEntries(['Projection', 'View', 'Eye', 'Fog', 'FogStrength', 'LightDirection', 'Sun', 'Ambient'].map(name => [name.toLowerCase(), gl.getUniformLocation(program, `u${name}`)]));
    this.dynamicBuffer = gl.createBuffer(); this.weaponBuffer = gl.createBuffer(); this.contactBuffer = gl.createBuffer();
    this.tracerBuffer = gl.createBuffer();
    this.dynamicCapacity = 0; this.weaponCapacity = 0; this.tracerCapacity = 0; this.contactCapacity = 0;
    const skyVertex = shader(gl, gl.VERTEX_SHADER, SKY_VERTEX_SHADER), skyFragment = shader(gl, gl.FRAGMENT_SHADER, SKY_FRAGMENT_SHADER);
    this.skyProgram = gl.createProgram(); gl.attachShader(this.skyProgram, skyVertex); gl.attachShader(this.skyProgram, skyFragment); gl.linkProgram(this.skyProgram);
    gl.deleteShader(skyVertex); gl.deleteShader(skyFragment);
    if (!gl.getProgramParameter(this.skyProgram, gl.LINK_STATUS)) throw new Error('Voxel sky graphics could not initialize.');
    this.skyAttributes = { position: gl.getAttribLocation(this.skyProgram, 'aPosition') };
    this.skyUniforms = Object.fromEntries(['Top', 'Horizon', 'SunColor', 'SunDirection', 'Right', 'Up', 'Forward', 'Scale'].map(name => [name.toLowerCase(), gl.getUniformLocation(this.skyProgram, `u${name}`)]));
    this.skyBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);
    gl.disable(gl.DITHER);
  }
  resize() {
    if (this.destroyed || this.contextLost) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || this.canvas.clientWidth || 960), height = Math.max(1, rect.height || this.canvas.clientHeight || 540);
    const ratio = Math.min(1.75, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
    // Keep large/retina screens within a fixed pixel budget rather than scaling
    // draw cost without limit. Projection still uses the true CSS aspect.
    const cappedRatio = Math.min(ratio, Math.sqrt(2200000 / (width * height)));
    const pixelWidth = Math.max(1, Math.round(width * cappedRatio)), pixelHeight = Math.max(1, Math.round(height * cappedRatio));
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) { this.canvas.width = pixelWidth; this.canvas.height = pixelHeight; }
    this.aspect = width / height; this.gl.viewport(0, 0, pixelWidth, pixelHeight);
  }
  _staticMesh(array) {
    const gl = this.gl, buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
    return { buffer, count: array.length / VERTEX_STRIDE };
  }
  _getMap(map) {
    if (this.mapCache.has(map.id)) return this.mapCache.get(map.id);
    const meshes = mapMeshes(map);
    const result = { opaque: this._staticMesh(meshes.opaque), shadows: this._staticMesh(meshes.shadows) };
    this.mapCache.set(map.id, result);
    // At most the three authored maps remain resident.
    while (this.mapCache.size > 3) {
      const [key, old] = this.mapCache.entries().next().value;
      this.gl.deleteBuffer(old.opaque.buffer); this.gl.deleteBuffer(old.shadows.buffer); this.mapCache.delete(key);
    }
    return result;
  }
  _draw(mesh) {
    if (!mesh.count) return;
    const gl = this.gl, attributes = this.attributes, stride = VERTEX_STRIDE * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    gl.enableVertexAttribArray(attributes.position); gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(attributes.normal); gl.vertexAttribPointer(attributes.normal, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(attributes.color); gl.vertexAttribPointer(attributes.color, 4, gl.FLOAT, false, stride, 24);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }
  _dynamic(array, kind = 'world') {
    const gl = this.gl, buffer = kind === 'weapon' ? this.weaponBuffer : kind === 'tracer' ? this.tracerBuffer : kind === 'contact' ? this.contactBuffer : this.dynamicBuffer, capacityKey = kind === 'weapon' ? 'weaponCapacity' : kind === 'tracer' ? 'tracerCapacity' : kind === 'contact' ? 'contactCapacity' : 'dynamicCapacity';
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (array.byteLength > this[capacityKey]) {
      this[capacityKey] = Math.max(16384, Math.ceil(array.byteLength / 16384) * 16384);
      gl.bufferData(gl.ARRAY_BUFFER, this[capacityKey], gl.DYNAMIC_DRAW);
    }
    if (array.byteLength) gl.bufferSubData(gl.ARRAY_BUFFER, 0, array);
    return { buffer, count: array.length / VERTEX_STRIDE };
  }
  _events(state, time, localId) {
    for (const event of state.events || []) {
      const key = event.id ?? `${event.tick}:${event.type}:${event.playerId}:${event.shotIndex ?? ''}`;
      if (this.eventIds.has(key)) continue;
      this.eventIds.add(key); this.eventQueue.push(key);
      while (this.eventQueue.length > MAX_EVENT_IDS) this.eventIds.delete(this.eventQueue.shift());
      if (Number.isFinite(state.tick) && Number.isFinite(event.tick) && state.tick - event.tick > 18) continue;
      if (event.type === 'shot') {
        const origin = [finite(event.x), finite(event.y), finite(event.z)];
        const direction = [finite(event.dx), finite(event.dy), finite(event.dz, -1)];
        const end = [event.hitX, event.hitY, event.hitZ].every(Number.isFinite) ? [event.hitX, event.hitY, event.hitZ] : origin.map((value, i) => value + direction[i] * 60);
        this.tracers.push({ origin, end, born: time, team: event.team, local: event.playerId === localId });
        if (event.playerId === localId) this.localShot = { born: time, weapon: event.weapon };
        if (event.hitKind && event.hitKind !== 'none') {
          const count = event.hitKind === 'wall' ? 5 : 7;
          const seed = hash(key);
          for (let i = 0; i < count; i++) {
            const angle = (seed % 1000 + i * 1.618) * 2.39;
            this.particles.push({ origin: end, born: time, vx: Math.sin(angle) * (.5 + i * .13), vy: .6 + i * .11, vz: Math.cos(angle) * (.5 + i * .13), color: event.hitKind === 'wall' ? '#d4c7a1' : '#edb56f', life: 230 + i * 17 });
          }
        }
      } else if (event.type === 'reload' && event.playerId === localId) this.localReload = { born: time, weapon: event.weapon };
      else if (event.type === 'explosion') {
        const origin = [finite(event.x), finite(event.y, .25), finite(event.z)];
        for (let i = 0; i < 24; i++) {
          const angle = i * 2.39996;
          this.particles.push({ origin, born: time, vx: Math.sin(angle) * (2 + i % 4), vy: 1 + i % 5, vz: Math.cos(angle) * (2 + i % 4), color: i % 2 ? '#efbc77' : '#a9896e', life: 450 + i * 12 });
        }
      }
    }
    if (this.tracers.length > MAX_TRACERS) this.tracers.splice(0, this.tracers.length - MAX_TRACERS);
    if (this.particles.length > MAX_PARTICLES) this.particles.splice(0, this.particles.length - MAX_PARTICLES);
    this.tracers = this.tracers.filter(trace => time - trace.born < 68);
    this.particles = this.particles.filter(particle => time - particle.born < particle.life);
  }
  _bomb(mesh, state, players, time) {
    const bomb = state.bomb;
    if (!bomb) return;
    if (bomb.status === 'carried') {
      const carrier = players.find(player => player.id === bomb.carrierId && player.alive);
      if (!carrier) return;
      const pose = { x: carrier.x, y: finite(carrier.y), z: carrier.z, yaw: carrier.yaw, pitch: 0 };
      const y = carrier.crouching ? .58 : .99;
      mesh.box(-.16, y, .18, .32, .28, .15, '#a88f68', pose);
      mesh.box(-.12, y + .07, .325, .24, .05, .018, '#d8b96d', pose);
      return;
    }
    if (bomb.status !== 'planted' && bomb.status !== 'dropped') return;
    const x = finite(bomb.x), y = finite(bomb.y) + .035, z = finite(bomb.z);
    mesh.box(x - .22, y, z - .16, .44, .13, .32, '#2d3d40');
    mesh.box(x - .20, y + .13, z - .14, .40, .07, .28, '#bba777');
    mesh.box(x - .10, y + .20, z - .07, .14, .008, .10, bomb.status === 'planted' && Math.floor(time / 220) % 2 ? '#f4a76f' : '#74c7b4');
    mesh.box(x + .10, y + .20, z - .06, .06, .01, .11, '#263d3f');
    for (let i = 0; i < 3; i++) mesh.box(x - .17 + i * .034, y + .03, z - .168, .016, .13, .016, i === 1 ? '#b45e4c' : '#6e998c');
  }
  _viewModel(player, yaw, pitch, time) {
    const mesh = new Mesh(), team = TEAM_COLORS[player.team === 1 ? 1 : 0];
    const speed = Math.hypot(finite(player.vx), finite(player.vz));
    const walking = clamp(speed / 5.5, 0, 1), step = time * .011;
    const age = this.localShot ? Math.max(0, time - this.localShot.born) : 10000;
    const kick = age < 240 ? Math.exp(-age / 65) : 0;
    if (this.lastAim) {
      let yawDelta = yaw - this.lastAim.yaw;
      while (yawDelta > Math.PI) yawDelta -= TAU;
      while (yawDelta < -Math.PI) yawDelta += TAU;
      this.swayX += (clamp(-yawDelta * .19, -.027, .027) - this.swayX) * .3;
      this.swayY += (clamp((pitch - this.lastAim.pitch) * .17, -.021, .021) - this.swayY) * .3;
    }
    this.lastAim = { yaw, pitch };
    const reloadActive = finite(player.reloadTicks) > 0;
    let reload = 0, reloadProgress = 0;
    if (reloadActive) {
      const ticks = finite(player.reloadTicks);
      const duration = WEAPONS[player.weapon]?.reloadTicks || WEAPONS.carbine.reloadTicks;
      reloadProgress = clamp(1 - ticks / duration, 0, 1);
      reload = Math.sin(clamp(reloadProgress, .04, .96) * Math.PI);
    }
    const pose = {
      x: .29 + this.swayX + Math.sin(step) * .008 * walking,
      y: -.29 + this.swayY - Math.abs(Math.cos(step)) * .008 * walking - reload * .105,
      z: -.49 + kick * .052 + reload * .065,
      yaw: -.065 + this.swayX * 2 + reload * .22,
      pitch: kick * .055 - reload * .23,
      scale: .74,
    };
    const length = weaponParts(mesh, player.weapon, pose, { stock: team, reloadProgress, bolt: kick * .75 });
    const handShift = reload * .30, handDrop = reload * .17;
    mesh.box(-.17, -.09 - handDrop, -.52 + handShift, .15, .12, .30, '#526661', pose);
    mesh.box(-.20, -.15 - handDrop, -.27 + handShift, .17, .17, .32, '#435952', pose);
    mesh.box(-.205, -.14 - handDrop, -.11 + handShift, .18, .17, .12, mix(rgba(team), rgba('#64796b'), .24), pose);
    mesh.box(-.178, -.073 - handDrop, -.46 + handShift, .126, .026, .23, '#72887b', pose);
    mesh.box(-.065, -.16, -.06, .13, .13, .16, '#526661', pose);
    mesh.box(.015, -.22, -.01, .17, .17, .32, '#435952', pose);
    mesh.box(.07, -.235, .12, .15, .18, .10, mix(rgba(team), rgba('#64796b'), .24), pose);
    mesh.box(.078, -.057, .13, .126, .018, .083, '#2a4143', pose);
    mesh.box(.113, -.038, .16, .062, .006, .039, '#79d0c0', pose);
    if (age < 44 && !reloadActive) {
      const flash = .032 + (1 - age / 44) * .040;
      mesh.box(-flash / 2, -.015, -length - .070, flash, flash, .085, '#f6d991', pose);
      mesh.box(-flash * .95, -.013 + flash * .2, -length - .055, flash * 1.9, flash * .38, .030, '#ffeabd', pose);
    }
    return mesh.array;
  }
  render(state, options = {}) {
    if (this.destroyed || this.contextLost || !this.available || !state) return false;
    const map = typeof state.map === 'object' && state.map?.colliders ? state.map : MAPS[state.mapId] || MAPS.courtyard;
    if (!map) return false;
    const players = state.players || state.fighters || [];
    const localId = options.localId ?? options.playerId;
    let cameraPlayer = options.viewPlayer ?? options.cameraPlayer ?? options.predictedPlayer ?? options.localPlayer ?? players.find(player => player.id === localId) ?? players.find(player => player.alive) ?? players[0];
    if (typeof cameraPlayer === 'string' || typeof cameraPlayer === 'number') cameraPlayer = players.find(player => player.id === cameraPlayer);
    if (!cameraPlayer) {
      const spawn = map.spawns?.[0]?.[0] || { x: 0, z: 0, yaw: 0 };
      cameraPlayer = { ...spawn, y: 0, alive: false };
    }
    const time = finite(options.time, typeof performance !== 'undefined' ? performance.now() : 0);
    if (map.id !== this.mapId) { this.resetEffects(); this.mapId = map.id; }
    this._events(state, time, localId);
    const yaw = finite(options.aimYaw ?? options.yaw, finite(cameraPlayer.yaw));
    const pitch = clamp(finite(options.aimPitch ?? options.pitch, finite(cameraPlayer.pitch)), -1.48, 1.48);
    const eye = [finite(cameraPlayer.x), finite(cameraPlayer.y) + (cameraPlayer.crouching ? .98 : 1.62), finite(cameraPlayer.z)];
    const gl = this.gl;
    this.resize();
    const fov = clamp(finite(options.fov, 70), 55, 95) * Math.PI / 180;
    const projection = perspective(fov, this.aspect || 16 / 9, .025, 110), view = viewMatrix(eye, yaw, pitch);
    const sky = rgba(map.skyColor || (map.id === 'canal' ? '#a3bdc2' : map.id === 'depot' ? '#8da6b0' : '#a8bcb9'));
    const atmosphere = ATMOSPHERE[map.theme || map.id] || ATMOSPHERE.courtyard;
    gl.clearColor(...sky); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.useProgram(this.skyProgram); gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffer);
    gl.enableVertexAttribArray(this.skyAttributes.position); gl.vertexAttribPointer(this.skyAttributes.position, 2, gl.FLOAT, false, 8, 0);
    gl.uniform3fv(this.skyUniforms.top, rgba(atmosphere.top).slice(0, 3));
    gl.uniform3fv(this.skyUniforms.horizon, rgba(atmosphere.horizon).slice(0, 3));
    gl.uniform3fv(this.skyUniforms.suncolor, rgba(atmosphere.sunColor).slice(0, 3));
    gl.uniform3fv(this.skyUniforms.sundirection, atmosphere.sun);
    const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch), tangent = Math.tan(fov / 2);
    gl.uniform3fv(this.skyUniforms.right, [cy, 0, sy]); gl.uniform3fv(this.skyUniforms.up, [-sy * sp, cp, cy * sp]); gl.uniform3fv(this.skyUniforms.forward, [sy * cp, sp, -cy * cp]);
    gl.uniform2fv(this.skyUniforms.scale, [tangent * this.aspect, tangent]); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uniforms.projection, false, projection); gl.uniformMatrix4fv(this.uniforms.view, false, view);
    gl.uniform3fv(this.uniforms.eye, eye); gl.uniform3fv(this.uniforms.fog, sky.slice(0, 3)); gl.uniform1f(this.uniforms.fogstrength, 1);
    gl.uniform3fv(this.uniforms.lightdirection, atmosphere.sun); gl.uniform3fv(this.uniforms.sun, atmosphere.direct); gl.uniform3fv(this.uniforms.ambient, atmosphere.ambient);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    const cached = this._getMap(map);
    this._draw(cached.opaque);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    this._draw(cached.shadows); gl.depthMask(true); gl.disable(gl.BLEND);
    const dynamic = new Mesh(), contacts = new Mesh(), local = players.find(player => player.id === localId) || cameraPlayer;
    for (const player of players) {
      if (!player.alive || player.id === cameraPlayer.id || !Number.isFinite(player.x) || !Number.isFinite(player.z)) continue;
      playerMesh(dynamic, player, map, time, player.team === local.team);
      const support = map.colliders.find(collider => player.x >= collider.x && player.x <= collider.x + collider.w && player.z >= collider.z && player.z <= collider.z + collider.d && collider.y + collider.h <= finite(player.y) + .05 && collider.y + collider.h > 0);
      const ground = support ? support.y + support.h : 0;
      const altitude = Math.max(0, finite(player.y) - ground), spread = .26 + Math.min(.22, altitude * .08), opacity = .15 / (1 + altitude);
      for (let layer = 2; layer >= 0; layer--) {
        const size = spread + layer * .055;
        const minX = Math.max(player.x - size, support?.x ?? -Infinity), maxX = Math.min(player.x + size, support ? support.x + support.w : Infinity);
        const minZ = Math.max(player.z - size * .8, support?.z ?? -Infinity), maxZ = Math.min(player.z + size * .8, support ? support.z + support.d : Infinity);
        contacts.floor(minX, minZ, maxX - minX, maxZ - minZ, [.035, .055, .08, opacity], ground + .012 + (2 - layer) * .0003);
      }
    }
    this._bomb(dynamic, state, players.filter(player => player.id !== cameraPlayer.id), time);
    for (const particle of this.particles) {
      const age = (time - particle.born) / 1000, fade = 1 - (time - particle.born) / particle.life;
      const size = .026 + fade * .028;
      dynamic.box(particle.origin[0] + particle.vx * age - size / 2, particle.origin[1] + particle.vy * age - age * age * 3, particle.origin[2] + particle.vz * age - size / 2, size, size, size, shade(rgba(particle.color), .7 + fade * .3));
    }
    this._draw(this._dynamic(dynamic.array));
    if (contacts.vertices.length) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      this._draw(this._dynamic(contacts.array, 'contact')); gl.depthMask(true); gl.disable(gl.BLEND);
    }
    if (this.tracers.length) {
      const traces = new Mesh();
      for (const trace of this.tracers) {
        // Start local tracers just beyond the eye to avoid a giant full-screen
        // quad when a shot originates inside the camera's near plane.
        const delta = trace.end.map((value, i) => value - trace.origin[i]), length = Math.hypot(...delta) || 1;
        const start = trace.local ? trace.origin.map((value, i) => value + delta[i] / length * Math.min(.35, length * .2)) : trace.origin;
        traces.line(start, trace.end, .009, [1, .83, .49, .40], eye);
      }
      gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false);
      this._draw(this._dynamic(traces.array, 'tracer'));
      gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    }
    if (cameraPlayer.alive && cameraPlayer.id === localId && !options.hideWeapon) {
      // Independent depth for the hands prevents flickering against a near
      // wall. World cover and hit detection continue using the real camera.
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.uniformMatrix4fv(this.uniforms.view, false, IDENTITY);
      gl.uniform3fv(this.uniforms.eye, [0, 0, 0]); gl.uniform1f(this.uniforms.fogstrength, 0);
      // The hands use a stable soft key light so turning into map shade cannot
      // hide the weapon's sights or the magazine during a reload.
      gl.uniform3fv(this.uniforms.lightdirection, [-.30, .70, .62]); gl.uniform3fv(this.uniforms.sun, [.43, .43, .40]); gl.uniform3fv(this.uniforms.ambient, [.64, .68, .72]);
      this._draw(this._dynamic(this._viewModel(cameraPlayer, yaw, pitch, time), 'weapon'));
    }
    return true;
  }
  resetEffects() {
    this.eventIds.clear(); this.eventQueue.length = 0; this.particles.length = 0; this.tracers.length = 0;
    this.localShot = null; this.localReload = null; this.lastAim = null; this.swayX = 0; this.swayY = 0;
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true; this.available = false;
    this.canvas.removeEventListener('webglcontextlost', this._onLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
    const gl = this.gl;
    if (!this.contextLost) {
      for (const cached of this.mapCache.values()) { gl.deleteBuffer(cached.opaque.buffer); gl.deleteBuffer(cached.shadows.buffer); }
      if (this.dynamicBuffer) gl.deleteBuffer(this.dynamicBuffer);
      if (this.weaponBuffer) gl.deleteBuffer(this.weaponBuffer);
      if (this.contactBuffer) gl.deleteBuffer(this.contactBuffer);
      if (this.tracerBuffer) gl.deleteBuffer(this.tracerBuffer);
      if (this.skyBuffer) gl.deleteBuffer(this.skyBuffer);
      if (this.program) gl.deleteProgram(this.program);
      if (this.skyProgram) gl.deleteProgram(this.skyProgram);
    }
    this.mapCache.clear(); this.resetEffects();
  }
}
