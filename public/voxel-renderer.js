import { MAPS, ADS, MELEE, HEAL } from './voxel-engine.js';
import { WEAPONS, weaponAimFovRatio } from './voxel-weapons.js';
import { grenadeCapacity } from './voxel-ordnance.js';

// All solid world surfaces come directly from the engine's minimum-corner
// colliders. Decoration is either painted on those surfaces or outside bounds.
const VERTEX_STRIDE = 10;
const MAX_PARTICLES = 84;
const MAX_TRACERS = 14;
const MAX_EVENT_IDS = 256;
const TEAM_COLORS = ['#efad64', '#66d3c8'];
const SURVIVOR_COLORS = ['#cfb785', '#94bca3', '#c69e8f', '#a9b6d5', '#b4a0c3', '#d2aa6e', '#8bb7b8', '#c5bd8b', '#9bac80', '#c897b1'];
const ROYALE_THEMES = new Set(['forest', 'maze', 'desert']);
const MAX_LOOT = 128;
const TAU = Math.PI * 2;
const ATMOSPHERE = Object.freeze({
  courtyard: { sun: [-.52, .76, .39], direct: [.66, .51, .35], ambient: [.45, .52, .60], top: '#729aac', horizon: '#efd1ac', sunColor: '#ffe2a6' },
  depot: { sun: [-.36, .88, -.31], direct: [.51, .59, .61], ambient: [.40, .49, .59], top: '#719cae', horizon: '#d0ddd9', sunColor: '#e8f2df' },
  canal: { sun: [.47, .81, -.35], direct: [.62, .58, .45], ambient: [.44, .52, .61], top: '#799fb6', horizon: '#e7dfc5', sunColor: '#fff0c5' },
  rooftops: { sun: [-.58, .75, -.30], direct: [.64, .57, .43], ambient: [.43, .53, .61], top: '#729aac', horizon: '#eee0c3', sunColor: '#ffe6b6' },
  foundry: { sun: [.42, .80, .43], direct: [.60, .50, .35], ambient: [.44, .49, .56], top: '#748b9c', horizon: '#c5bdac', sunColor: '#ffd69d' },
  bastion: { sun: [-.37, .84, .40], direct: [.56, .59, .54], ambient: [.44, .53, .62], top: '#7699b0', horizon: '#d9e4d9', sunColor: '#f0edc5' },
  forest: { sun: [-.48, .78, .38], direct: [.53, .55, .36], ambient: [.44, .54, .48], top: '#749fac', horizon: '#d6ddbc', sunColor: '#fff0bd' },
  maze: { sun: [.40, .82, -.36], direct: [.52, .50, .42], ambient: [.47, .52, .60], top: '#7a9dab', horizon: '#d9dfcf', sunColor: '#efe9c8' },
  desert: { sun: [-.34, .90, -.28], direct: [.68, .57, .39], ambient: [.52, .55, .60], top: '#6ca9ba', horizon: '#eed9b7', sunColor: '#fff1c6' },
  paris: { sun: [-.47, .76, .45], direct: [.64, .56, .43], ambient: [.47, .53, .61], top: '#789eaf', horizon: '#ecd6b5', sunColor: '#ffebbd' },
});
const ART = Object.freeze({
  courtyard: { paving: '#d7c7aa', accent: '#cc9d76', skyline: '#748b90', cloud: '#f4dcc0', tile: 2.5 },
  depot: { paving: '#4f626c', accent: '#c79152', skyline: '#5f747c', cloud: '#dfe9df', tile: 5 },
  canal: { paving: '#a9b8b2', accent: '#608f91', skyline: '#657c81', cloud: '#dfe9df', tile: 1.6 },
  rooftops: { paving: '#b6c5bc', accent: '#6faaa3', skyline: '#7e9d9b', cloud: '#ece8d5', tile: 2.5 },
  foundry: { paving: '#5d6769', accent: '#d69b62', skyline: '#5f7078', cloud: '#d9d7c9', tile: 5 },
  bastion: { paving: '#a2afa9', accent: '#c4b06c', skyline: '#70878a', cloud: '#e2e9dd', tile: 2.5 },
  forest: { paving: '#657b48', accent: '#bdd19c', skyline: '#47674f', cloud: '#edf0dc', tile: 4 },
  maze: { paving: '#899783', accent: '#9cc6bd', skyline: '#718d78', cloud: '#e5e9de', tile: 4 },
  desert: { paving: '#d7ba83', accent: '#51aca5', skyline: '#bd9867', cloud: '#f6e9c8', tile: 4 },
  paris: { paving: '#b9b4a7', accent: '#68847d', skyline: '#b3a894', cloud: '#f0e3cd', tile: 3 },
});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, amount) => a + (b - a) * amount;

/** Free-for-all uniforms never imply the two tactical teams. */
export function survivorColor(player) {
  const id = player?.id;
  const index = Number.isInteger(id) ? Math.abs(id) % SURVIVOR_COLORS.length : hash(id ?? 'spectator') % SURVIVOR_COLORS.length;
  return SURVIVOR_COLORS[index];
}

function aimProgress(player) {
  return player.slot === 'sword' || player.healing || finite(player.healTicks) > 0 || finite(player.reloadTicks) > 0 || finite(player.grenadeThrowTicks) > 0 || player.alive === false ? 0 : smooth(finite(player.aimTicks) / ADS.ticks);
}

function swordMotion(player) {
  const total = MELEE.startupTicks + MELEE.activeTicks + MELEE.recoveryTicks;
  const remaining = clamp(finite(player.meleeTicks), 0, total), elapsed = total - remaining;
  if (!remaining) return { yaw: -.18, pitch: .48, extension: 0, active: false };
  if (elapsed < MELEE.startupTicks) {
    const progress = smooth(elapsed / MELEE.startupTicks);
    return { yaw: lerp(-.18, -.64, progress), pitch: lerp(.48, .30, progress), extension: 0, active: false };
  }
  if (elapsed < MELEE.startupTicks + MELEE.activeTicks) {
    const progress = smooth((elapsed - MELEE.startupTicks) / MELEE.activeTicks);
    return { yaw: lerp(-.64, .64, progress), pitch: lerp(.30, -.30, progress), extension: Math.sin(progress * Math.PI) * .37, active: true };
  }
  const progress = smooth((elapsed - MELEE.startupTicks - MELEE.activeTicks) / MELEE.recoveryTicks);
  return { yaw: lerp(.64, -.18, progress), pitch: lerp(-.30, .48, progress), extension: 0, active: false };
}

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
const DEFAULT_SHOT_EFFECT = Object.freeze({ tracerColor: '#f5ce83', muzzleColor: '#f6d991', impactColor: '#e4c286', tracerWidth: .009, tracerTicks: 8, muzzleTicks: 5, muzzleSize: 1, muzzleStrength: 1, impactStrength: 1, kickStrength: 1, kickTicks: 28 });
const shotEffect = weapon => WEAPONS[weapon]?.effects || DEFAULT_SHOT_EFFECT;
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalized = (vector, fallback = [0, 1, 0]) => { const length = Math.hypot(...vector); return length > 1e-6 ? vector.map(value => value / length) : fallback; };

function impactParticles(event, contact, direction, map, time, key) {
  const effects = shotEffect(event.weapon || (event.type === 'boltHit' ? 'crossbow' : 'carbine'));
  const collider = map?.colliders?.find(box => box.id === event.colliderId);
  let normal = [finite(event.nx), finite(event.ny), finite(event.nz)];
  if (Math.hypot(...normal) < 1e-5) {
    if (event.colliderId === 'floor') normal = [0, 1, 0];
    else if (collider) {
      // Use the contacted physical face, including the underside of a deck.
      const faces = [[Math.abs(contact[0] - collider.x), [-1, 0, 0]], [Math.abs(contact[0] - collider.x - collider.w), [1, 0, 0]], [Math.abs(contact[1] - collider.y), [0, -1, 0]], [Math.abs(contact[1] - collider.y - collider.h), [0, 1, 0]], [Math.abs(contact[2] - collider.z), [0, 0, -1]], [Math.abs(contact[2] - collider.z - collider.d), [0, 0, 1]]];
      normal = faces.reduce((nearest, face) => face[0] < nearest[0] ? face : nearest)[1];
    } else normal = direction.map(value => -value);
  }
  normal = normalized(normal);
  const tangent = normalized(cross(normal, Math.abs(normal[1]) > .9 ? [1, 0, 0] : [0, 1, 0]));
  const bitangent = cross(normal, tangent);
  const material = event.hitKind === 'wall' ? collider?.material || 'stone' : event.damage > 0 ? event.hitKind : 'cloth';
  const metal = material === 'metal', wood = material === 'wood' || material === 'bark', leaves = material === 'foliage', head = material === 'head', leg = material === 'leg';
  const strength = clamp(finite(effects.impactStrength, 1), .25, 2);
  const count = clamp(Math.round((metal || head ? 6 : 5) * strength), 3, 10);
  const color = leaves ? '#90ac6f' : wood ? '#bd9163' : metal ? effects.impactColor : head ? '#ffdfad' : leg ? '#ad7d68' : material === 'body' ? '#d6a189' : material === 'cloth' ? '#89928a' : '#c6bba5';
  const seed = hash(key), origin = contact.map((value, i) => value + normal[i] * .055);
  return Array.from({ length: count }, (_, i) => {
    const angle = seed % 7 + i * 2.39996, outward = (metal ? .75 : .40) * strength;
    const scatter = (metal ? .75 : wood ? .55 : .35) * (.5 + i / count) * strength;
    const velocity = normal.map((value, axis) => value * outward + (tangent[axis] * Math.cos(angle) + bitangent[axis] * Math.sin(angle)) * scatter);
    return { origin, born: time, vx: velocity[0], vy: velocity[1] + .12, vz: velocity[2], color, life: (metal ? 145 : wood ? 250 : 190) + i * 13, gravity: metal ? 3 : 4, cover: true, size: metal ? .016 : wood ? .026 : .030, material };
  });
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
  append(array) { for (const value of array) this.vertices.push(value); }
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
  beam(a, b, width, color) {
    const delta = b.map((value, i) => value - a[i]), length = Math.hypot(...delta);
    if (length <= 0) return;
    this.box(-width / 2, 0, -width / 2, width, length, width, color, {
      x: a[0], y: a[1], z: a[2], yaw: Math.atan2(-delta[0], delta[2]), pitch: Math.atan2(Math.hypot(delta[0], delta[2]), delta[1]),
    });
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
varying vec2 vWorldXZ;
void main() {
  gl_Position = uProjection * uView * vec4(aPosition, 1.0);
  vec3 normal = normalize(aNormal);
  float direct = max(0.0, dot(normal, normalize(uLightDirection)));
  vec3 light = uAmbient + uSun * direct + vec3(0.08, 0.09, 0.10) * (normal.y * 0.5 + 0.5);
  vColor = vec4(aColor.rgb * light, aColor.a);
  vDistance = length(aPosition - uEye);
  vWorldXZ = aPosition.xz;
}`;
const FRAGMENT_SHADER = `
precision mediump float;
uniform vec3 uFog;
uniform float uFogStrength;
uniform vec3 uStormCircle;
uniform float uStormStrength;
varying vec4 vColor;
varying float vDistance;
varying vec2 vWorldXZ;
void main() {
  float fog = clamp((vDistance - 27.0) / 90.0, 0.0, 0.56) * uFogStrength;
  vec3 color = mix(vColor.rgb, uFog, fog);
  // Surface haze adds no opaque wall or false cover at the safe-zone edge.
  float outside = smoothstep(-0.20, 3.5, length(vWorldXZ - uStormCircle.xy) - uStormCircle.z);
  color = mix(color, vec3(0.30, 0.48, 0.69), outside * uStormStrength * (0.20 + fog * 0.35));
  gl_FragColor = vec4(color, vColor.a);
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
function rayCoverDistance(origin, direction, colliders, maximum, padding = 0) {
  let nearest = maximum;
  for (const collider of colliders) {
    let entry = 0, exit = nearest;
    const mins = [collider.x - padding, collider.y - padding, collider.z - padding], maxs = [collider.x + collider.w + padding, collider.y + collider.h + padding, collider.z + collider.d + padding];
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

/** Cosmetic fragments remain on the visible side of real collision surfaces. */
export function particlePosition(particle, time, colliders = []) {
  const elapsed = clamp(finite(time - particle.born), 0, finite(particle.life, 1));
  const age = elapsed / 1000, fade = 1 - elapsed / finite(particle.life, 1);
  const size = finite(particle.size, .026) + fade * .028;
  let point = [particle.origin[0] + finite(particle.vx) * age, Math.max(size / 2, particle.origin[1] + finite(particle.vy) * age - age * age * finite(particle.gravity, 3)), particle.origin[2] + finite(particle.vz) * age];
  if (particle.cover) {
    const delta = point.map((value, i) => value - particle.origin[i]), length = Math.hypot(...delta);
    if (length > 1e-5) {
      const direction = delta.map(value => value / length), limit = Math.min(length, finite(particle.radius, Infinity));
      const contact = rayCoverDistance(particle.origin, direction, colliders, limit, size * .55);
      const travel = contact < length ? Math.max(0, contact - size * .6) : Math.min(length, limit);
      point = particle.origin.map((value, i) => value + direction[i] * travel);
    }
  }
  return { point, size, fade };
}

/** Highest surface beneath a point, independent of authored collider order. */
export function surfaceBelow(colliders, x, z, height) {
  let support = null, top = 0;
  for (const collider of colliders || []) {
    const candidate = collider.y + collider.h;
    if (x < collider.x || x > collider.x + collider.w || z < collider.z || z > collider.z + collider.d || candidate > height + .005 || candidate <= top) continue;
    support = collider; top = candidate;
  }
  return support;
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

function paintRoyaleCollider(mesh, collider, theme) {
  const { x, y, z, w, h, d } = collider;
  const color = rgba(collider.color || (theme === 'desert' ? '#c8a574' : theme === 'forest' ? '#6f7c52' : '#8c9788'));
  const material = String(collider.material || 'stone').toLowerCase();
  const id = String(collider.id || ''), dark = shade(color, .78), pale = shade(color, 1.10);
  // The complete base box is always emitted; painted detail can never erase
  // collision surfaces or replace a physical doorway with decoration.
  mesh.box(x, y, z, w, h, d, color);
  if (h < .12) return;
  const leaves = /foliage|leaves|leaf|canopy/.test(`${material}:${id}`);
  const trunk = /bark|trunk/.test(`${material}:${id}`);
  for (const face of ['north', 'south', 'west', 'east']) {
    const width = face === 'north' || face === 'south' ? w : d;
    if (leaves) {
      for (let i = 0; i < 3; i++) {
        const seed = hash(`${id}:${face}:${i}`), left = (.12 + (seed % 60) / 100) * width;
        wallPatch(mesh, collider, face, left, h * (.18 + i * .22), Math.min(width - left, width * .19), h * .16, seed % 2 ? pale : dark, .003);
      }
    } else if (trunk) {
      for (const fraction of [.22, .63]) wallPatch(mesh, collider, face, width * fraction, .03, Math.min(.07, width * .13), Math.max(.01, h - .06), dark, .003);
    } else if (/wood|crate/.test(material)) {
      const rows = clamp(Math.round(h / .42), 1, 7);
      for (let i = 1; i < rows; i++) wallPatch(mesh, collider, face, .01, h * i / rows, Math.max(.01, width - .02), .015, dark, .003);
      for (const fraction of [.14, .84]) wallPatch(mesh, collider, face, width * fraction, h * .12, .025, Math.max(.01, h * .76), pale, .004);
    } else {
      // Broad stone blocks use a bounded number of masonry seams. A 200-box
      // survival map must not inherit the city renderer's dense window art.
      const rows = clamp(Math.round(h / .72), 1, 4);
      for (let i = 1; i < rows; i++) {
        wallPatch(mesh, collider, face, .01, h * i / rows, Math.max(.01, width - .02), .014, dark, .003);
        for (const fraction of [.26, .66]) wallPatch(mesh, collider, face, width * fraction + (i % 2) * .11, h * (i - 1) / rows + .025, .015, Math.max(.01, h / rows - .04), dark, .003);
      }
      if (h > 1.1 && width > .65) {
        wallPatch(mesh, collider, face, .03, Math.max(.03, h - .18), width - .06, .055, pale, .004);
        if (theme === 'desert' && /temple|column|pyramid|shrine/.test(id)) {
          const turquoise = mix(color, rgba('#428f91'), .58);
          wallPatch(mesh, collider, face, .03, Math.min(h * .64, h - .27), width - .06, .075, turquoise, .004);
          for (const fraction of [.25, .55, .80]) wallPatch(mesh, collider, face, width * fraction, Math.min(h * .64, h - .27) + .025, .033, .025, '#e9cb85', .006);
        }
      }
    }
  }
  if (leaves) {
    for (let i = 0; i < 3; i++) mesh.floor(x + w * (.06 + i * .30), z + d * .13, w * .23, d * .69, i % 2 ? dark : pale, y + h + .002);
  } else mesh.floor(x + .025, z + .025, Math.max(.01, w - .05), Math.max(.01, d - .05), pale, y + h + .002);
}

function paintParisCollider(mesh, collider) {
  const { x, y, z, w, h, d } = collider, id = String(collider.id || '');
  const material = String(collider.material || 'stone').toLowerCase();
  if (id.startsWith('paris-bus-stop-')) {
    mesh.box(x, y, z, w, h, d, collider.color);
    for (const face of ['north', 'south', 'west', 'east']) {
      const width = face === 'north' || face === 'south' ? w : d;
      wallPatch(mesh, collider, face, .04, .09, width - .08, .065, '#354e49', .004);
      wallPatch(mesh, collider, face, .07, .58, width - .14, 1.04, '#d9d6be', .005);
      const routeWidth = Math.max(.04, width - .32);
      wallPatch(mesh, collider, face, .16, .86, routeWidth, .025, '#738f75', .008);
      wallPatch(mesh, collider, face, width / 2 - .012, .74, .024, .52, '#877ca0', .008);
      for (const fraction of [.29, .52, .77]) wallPatch(mesh, collider, face, width / 2 - .032, .74 + fraction * .52, .064, .037, '#47665f', .010);
      wallPatch(mesh, collider, face, .07, 1.78, width - .14, .32, '#334f49', .005);
      const label = width > 1 ? 'METRO' : 'M', height = .23, textWidth = (label.length * 6 - 1) * height / 7;
      wallText(mesh, collider, face, label, (width - textWidth) / 2, 1.82, height, '#e6d1a0', .011);
      wallPatch(mesh, collider, face, .04, h - .065, width - .08, .025, '#c0b486', .008);
    }
    return;
  }
  if (id === 'paris-bus-body' || id === 'paris-bus-top') {
    mesh.box(x, y, z, w, h, d, collider.color);
    if (id === 'paris-bus-top') return;
    for (const face of ['east', 'west']) {
      wallPatch(mesh, collider, face, .05, .60, d - .10, .17, '#c9ccbc', .004);
      for (let left = .36; left < d - .70; left += .90) {
        wallPatch(mesh, collider, face, left, 1.0, .74, .50, '#253d47', .006);
        wallPatch(mesh, collider, face, left + .045, 1.07, .65, .36, '#87a4aa', .008);
        wallPatch(mesh, collider, face, left + .06, 1.30, .62, .035, '#bdcfca', .010);
      }
      for (const left of [.45, d - 1.0]) {
        wallPatch(mesh, collider, face, left, .05, .62, .43, '#283537', .007);
        wallPatch(mesh, collider, face, left + .17, .15, .28, .23, '#abb5b0', .009);
      }
      wallText(mesh, collider, face, 'BUS', d / 2 - .33, .31, .25, '#e4dfbc', .011);
    }
    for (const face of ['north', 'south']) {
      wallPatch(mesh, collider, face, .26, .98, w - .52, .50, '#304a53', .006);
      wallPatch(mesh, collider, face, .33, 1.06, w - .66, .34, '#8aa6aa', .008);
      wallPatch(mesh, collider, face, w / 2 - .13, .40, .26, .12, '#e6ddc1', .006);
      for (const left of [.15, w - .38]) wallPatch(mesh, collider, face, left, .67, .23, .13, face === 'north' ? '#efe1b7' : '#b0715b', .008);
    }
    return;
  }
  if (/foliage|bark/.test(material)) return paintRoyaleCollider(mesh, collider, 'forest');
  if (/wood|crate|metal/.test(material)) return paintRoyaleCollider(mesh, collider, 'paris');
  const slate = material === 'slate' || /roof|chimney/.test(id);
  const color = rgba(collider.color || (slate ? '#536574' : '#d6c7ae'));
  mesh.box(x, y, z, w, h, d, color);
  if (h < .08) return;
  const dark = mix(color, rgba(slate ? '#253b48' : '#887d6b'), .35), pale = mix(color, rgba('#f0e3c9'), .42);
  const buildingWall = /paris-(opera|atelier|cafe|librairie)-/.test(id) && !/climb|roof|chimney/.test(id);
  for (const face of ['north', 'south', 'west', 'east']) {
    const width = face === 'north' || face === 'south' ? w : d;
    if (width < .12) continue;
    const patch = (left, bottom, patchWidth, patchHeight, tint, offset = .005) => {
      // Thin lintels and split door jambs receive only paint that fits their
      // actual face. Detail must never bridge a doorway or shifted roof tier.
      if (left >= .02 && bottom >= .02 && left + patchWidth <= width - .02 && bottom + patchHeight <= h - .02) wallPatch(mesh, collider, face, left, bottom, patchWidth, patchHeight, tint, offset);
    };
    if (slate) {
      patch(.03, Math.max(.03, h * .15), width - .06, Math.min(.05, h * .18), '#85959d');
      for (let left = .32; left < width - .10; left += 1.25) patch(left, .04, .016, Math.max(.01, h - .08), dark);
      continue;
    }
    patch(.03, .04, width - .06, Math.min(.13, h / 4), dark);
    patch(.03, h - .16, width - .06, .08, pale);
    // Align cornices and window rows in world coordinates, including the
    // separate left/right pieces around each genuine open entrance.
    for (let level = 1.45; level < y + h; level += 1.9) patch(.03, level - y, width - .06, .045, pale);
    if (!buildingWall) {
      for (let level = .62; level < y + h; level += .72) patch(.03, level - y, width - .06, .012, dark);
      continue;
    }
    const origin = face === 'north' || face === 'south' ? x : z, spacing = 2.6;
    const first = Math.ceil((origin + .23) / spacing) * spacing - origin;
    for (let left = first; left + 1.02 < width - .20; left += spacing) {
      for (let level = 2.12; level + 1.09 < y + h; level += 1.9) {
        const bottom = level - y;
        if (bottom < .05) continue;
        patch(left, bottom, .98, 1.04, '#756f65', .005);
        patch(left + .08, bottom + .07, .82, .88, '#4c6672', .008);
        patch(left + .09, bottom + .60, .79, .065, '#8da6aa', .011);
        patch(left + .465, bottom + .07, .045, .88, pale, .012);
        patch(left + .08, bottom + .47, .82, .038, pale, .012);
        for (const shutter of [left + .04, left + .88]) {
          patch(shutter, bottom + .05, .06, .95, '#506e66', .013);
          for (let line = 0; line < 3; line++) patch(shutter, bottom + .22 + line * .22, .06, .012, '#a0b4a1', .014);
        }
        // Wrought-iron balcony impressions are surface paint, not invisible
        // protruding platforms that players could mistake for jump targets.
        patch(left + .02, bottom - .025, .94, .035, '#293e40', .018);
        for (const fraction of [.12, .39, .66, .86]) patch(left + fraction, bottom + .01, .024, .20, '#293e40', .019);
        patch(left + .02, bottom + .19, .94, .035, '#293e40', .020);
        patch(left - .03, bottom - .08, 1.04, .045, pale, .016);
      }
    }
  }
  if (slate && w > .2 && d > .2) {
    for (let row = .12; row < d - .12; row += .72) mesh.floor(x + .06, z + row, w - .12, .018, dark, y + h + .002);
    for (let column = .20; column < w - .12; column += 1.30) mesh.floor(x + column, z + .06, .018, d - .12, '#8b9c9f', y + h + .003);
  }
  if (/planter/.test(id) && w > .20 && d > .20) {
    mesh.floor(x + .08, z + .08, w - .16, d - .16, '#617b54', y + h + .002);
    for (let i = 0; i < 7; i++) mesh.floor(x + .15 + i % 3 * (w - .30) / 3, z + .15 + Math.floor(i / 3) * (d - .30) / 3, .055, .055, i % 2 ? '#d6c292' : '#b68f7d', y + h + .003);
  }
}

function paintCollider(mesh, collider, theme) {
  if (theme === 'paris') return paintParisCollider(mesh, collider);
  if (ROYALE_THEMES.has(theme)) return paintRoyaleCollider(mesh, collider, theme);
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
  const dark = shade(c, .58), pale = mix(c, rgba('#e4dfcb'), .30), accent = rgba((ART[theme] || ART.courtyard).accent);
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

function floorChevron(mesh, x, z, yaw, color, y = .016) {
  const point = ([xx, zz]) => {
    const rotated = rotate([xx, 0, zz], yaw);
    return [x + rotated[0], y, z + rotated[2]];
  };
  for (const points of [[[-.30, .20], [-.22, .28], [.045, .015], [-.04, -.07]], [[-.045, .015], [.22, .28], [.30, .20], [.04, -.07]]]) {
    mesh.quad(...points.map(point), [0, 1, 0], rgba(color));
  }
}

function routePaint(mesh, map) {
  const byId = new Map((map.colliders || []).map(collider => [collider.id, collider]));
  const trimmed = new Set();
  const color = mix(rgba('#e1c88e'), rgba((ART[map.theme || map.id] || ART.courtyard).accent), .23);
  for (const route of map.routes || []) {
    const steps = route.steps || [], start = route.start, first = steps[0];
    if (start && first && [start.x, start.z, first.x, first.z].every(Number.isFinite)) {
      floorChevron(mesh, start.x, start.z, Math.atan2(first.x - start.x, start.z - first.z), color);
    }
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i], collider = byId.get(step.colliderId);
      if (!collider || ![step.x, step.z].every(Number.isFinite)) continue;
      const top = collider.y + collider.h;
      if (!trimmed.has(collider.id)) {
        trimmed.add(collider.id);
        // These narrow strips are paint on the playable top, never a railing
        // or a lip that would alter the jump or its collision silhouette.
        const inset = .065, edge = .027;
        if (collider.w > .20 && collider.d > .20) {
          mesh.floor(collider.x + inset, collider.z + inset, collider.w - inset * 2, edge, color, top + .004);
          mesh.floor(collider.x + inset, collider.z + collider.d - inset - edge, collider.w - inset * 2, edge, color, top + .004);
          mesh.floor(collider.x + inset, collider.z + inset, edge, collider.d - inset * 2, color, top + .004);
          mesh.floor(collider.x + collider.w - inset - edge, collider.z + inset, edge, collider.d - inset * 2, color, top + .004);
        }
      }
      const next = steps[i + 1];
      if (collider.w >= .75 && collider.d >= .75) {
        const x = clamp(step.x, collider.x + .36, collider.x + collider.w - .36);
        const z = clamp(step.z, collider.z + .36, collider.z + collider.d - .36);
        floorChevron(mesh, x, z, next ? Math.atan2(next.x - x, z - next.z) : route.side === 'north' ? Math.PI : 0, color, top + .016);
      }
    }
  }
}

function mapPaint(mesh, map, theme) {
  const find = id => map.colliders.find(collider => collider.id === id);
  const siteColumn = id => {
    const side = id === 'A' ? 'west' : 'east';
    const prefix = ({ rooftops: 'roofline', foundry: 'foundry', bastion: 'bastion' })[theme];
    return find(prefix ? `${prefix}-${side}-site-column` : `${side}-${theme === 'courtyard' ? 'site-column' : theme === 'depot' ? 'loading-column' : 'site-pillar'}`);
  };
  for (const site of map.sites || []) {
    const column = siteColumn(site.id) || map.colliders.filter(collider => collider.h >= 2.5 && collider.y < .1 && collider.w >= .8 && collider.d >= .8 && !String(collider.id).startsWith('wall-')).sort((a, b) => Math.hypot(a.x + a.w / 2 - site.x, a.z + a.d / 2 - site.z) - Math.hypot(b.x + b.w / 2 - site.x, b.z + b.d / 2 - site.z))[0];
    if (column) siteSign(mesh, column, site.id);
  }
  if (theme === 'paris') {
    for (const decoration of map.decorations || []) {
      const { kind, x, z, w, d } = decoration;
      if (![x, z, w, d].every(Number.isFinite) || w <= 0 || d <= 0) continue;
      if (kind === 'road') {
        mesh.floor(x, z, w, d, decoration.color || '#667076', .003);
        const vertical = d > w;
        const length = vertical ? d : w;
        for (let cursor = .8; cursor < length - .8; cursor += 3.6) {
          if (vertical) mesh.floor(x + w / 2 - .045, z + cursor, .09, Math.min(1.35, length - cursor), '#e3d6af', .004);
          else mesh.floor(x + cursor, z + d / 2 - .045, Math.min(1.35, length - cursor), .09, '#e3d6af', .004);
        }
      } else if (kind === 'crosswalk') {
        for (let cursor = .15; cursor < d - .20; cursor += .68) mesh.floor(x + .25, z + cursor, Math.max(.01, w - .50), Math.min(.30, d - cursor), '#e9e2cd', .004);
      } else if (kind === 'park') {
        mesh.floor(x, z, w, d, decoration.color || '#829465', .003);
        for (let i = 0; i < 14; i++) {
          const seed = hash(`${map.id}:park:${x}:${z}:${i}`), xx = x + .25 + seed % 90 / 100 * Math.max(0, w - .5), zz = z + .25 + (seed >>> 8) % 90 / 100 * Math.max(0, d - .5);
          mesh.floor(xx, zz, .045, .045, i % 3 ? '#d4c489' : '#b98377', .004);
        }
      } else if (kind === 'sidewalk' || kind === 'cafe') {
        mesh.floor(x, z, w, d, decoration.color || (kind === 'cafe' ? '#c6b292' : '#c7c1b1'), .003);
        for (let row = .12; row < d - .12; row += 1.2) mesh.floor(x + .04, z + row, w - .08, .014, '#a49d8e', .004);
      }
    }
    for (const building of map.buildings || []) {
      const label = ({ 'paris-opera': 'OPERA', 'paris-atelier': 'ATELIER', 'paris-cafe': 'CAFE', 'paris-librairie': 'LIVRES' })[building.id] || 'PARIS';
      for (const sign of map.colliders.filter(collider => building.wallIds?.includes(collider.id) && /lintel/.test(collider.id))) {
        const face = /north/.test(sign.id) ? 'north' : 'south';
        if (sign.w < 1 || sign.h < .50) continue;
        const height = Math.min(.30, sign.h - .30), textWidth = (label.length * 6 - 1) * height / 7;
        if (textWidth > sign.w - .30) continue;
        wallPatch(mesh, sign, face, .09, .10, sign.w - .18, .46, building.facade?.accent || '#57746b', .016);
        wallText(mesh, sign, face, label, (sign.w - textWidth) / 2, .19, height, '#eddfbd', .024);
        wallPatch(mesh, sign, face, .13, .13, sign.w - .26, .016, '#bcaa84', .026);
      }
    }
  } else if (theme === 'courtyard') {
    for (const side of ['west', 'east']) {
      const collider = find(`${side}-arcade`), color = side === 'west' ? '#dfa962' : '#68aaa2';
      if (!collider) continue;
      for (const face of ['north', 'south']) {
        wallPatch(mesh, collider, face, .24, 1.57, 2.02, .73, '#354648', .027);
        const label = face === 'south' ? (side === 'west' ? 'A <' : '> B') : (side === 'west' ? '> A' : 'B <');
        wallText(mesh, collider, face, label, .42, 1.73, .45, color, .034);
        wallPatch(mesh, collider, face, .28, .48, collider.w - .56, .08, color, .025);
      }
    }
    const central = find('central-north');
    if (central) for (const face of ['north', 'south']) {
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
    if (central) for (const face of ['west', 'east']) {
      wallPatch(mesh, central, face, .34, .42, .14, 2.32, '#d7b269', .032);
      wallText(mesh, central, face, '03', .79, 1.31, .82, '#eddfc7', .032);
    }
  } else if (theme === 'canal') {
    for (const side of ['west', 'east']) {
      const market = find(`${side}-market`), accent = side === 'west' ? '#527f81' : '#bf7f59';
      if (!market) continue;
      for (const face of ['north', 'south']) {
        wallPatch(mesh, market, face, .08, .19, market.w - .16, .55, accent, .024);
        for (let left = .10; left < market.w - .10; left += .72) wallPatch(mesh, market, face, left, 2.74, .33, .34, '#d6d4b6', .025);
        wallPatch(mesh, market, face, 2.25, 1.5, 2.5, .85, accent, .024);
        wallText(mesh, market, face, 'MARCHE', 2.38, 1.71, .40, '#eee2bf', .030);
      }
    }
    for (const id of ['canal-west-bank', 'canal-east-bank']) {
      const bank = find(id);
      if (!bank) continue;
      for (let z = bank.z + .20; z < bank.z + bank.d - .20; z += .38) mesh.floor(bank.x + .025, z, bank.w - .05, .035, '#d0cdb7', bank.y + bank.h + .003);
    }
  } else if (theme === 'rooftops') {
    // Flat service-lane paint keeps the alleys readable below the walkways.
    for (const x of [-10.5, 10.5]) for (let z = -17; z < 18; z += 3.2) mesh.floor(x, z, .085, 1.15, '#d9dfc9', .005);
    for (const collider of map.colliders) {
      if (collider.y > 2 && collider.h < .8) {
        const top = collider.y + collider.h;
        mesh.floor(collider.x + .08, collider.z + .08, collider.w - .16, .08, '#719e98', top + .003);
        mesh.floor(collider.x + .08, collider.z + collider.d - .16, collider.w - .16, .08, '#719e98', top + .003);
      }
    }
  } else if (theme === 'foundry') {
    for (const x of [-10, 10]) for (let z = -18; z < 18; z += 3) mesh.floor(x - .08, z, .16, 1.4, '#caa063', .005);
    for (const collider of map.colliders) {
      if (collider.h > 1.8 && collider.w > 3 && collider.y < .1 && !String(collider.id).startsWith('wall-')) {
        for (const face of ['north', 'south']) {
          wallPatch(mesh, collider, face, .15, .38, collider.w - .3, .08, '#d2a16a', .021);
          for (let left = .2; left < collider.w - .25; left += .48) wallPatch(mesh, collider, face, left, .58, .15, .16, '#c48b52', .021);
        }
      }
    }
  } else if (theme === 'bastion') {
    for (const x of [-12.5, 12.5]) {
      for (let z = -17; z < 18; z += 1.5) mesh.floor(x - .24, z, .48, .14, '#bdc3aa', .005);
    }
    for (const collider of map.colliders) {
      if (collider.h > 2.4 && collider.w > 3 && collider.y < .1) {
        for (const face of ['north', 'south']) {
          wallPatch(mesh, collider, face, .06, 1.1, collider.w - .12, .12, '#8c9d85', .021);
          wallPatch(mesh, collider, face, .06, collider.h - .40, collider.w - .12, .10, '#c4ba88', .021);
        }
      }
    }
  }
  if (['rooftops', 'foundry', 'bastion'].includes(theme)) {
    const sign = map.colliders.find(collider => collider.w >= 5 && collider.h >= 2.7 && collider.y < .1 && !String(collider.id).startsWith('wall-'));
    if (sign) {
      const label = theme === 'rooftops' ? 'ROOFLINE' : theme === 'foundry' ? 'FOUNDRY' : 'BASTION';
      const width = Math.min(4.2, sign.w - .4), left = (sign.w - width) / 2;
      for (const face of ['north', 'south']) {
        wallPatch(mesh, sign, face, left, 1.72, width, .78, '#314748', .026);
        wallText(mesh, sign, face, label, left + .15, 1.91, .42, '#e5d2a4', .034);
      }
    }
  }
  routePaint(mesh, map);
}

export function mapMeshes(map) {
  const opaque = new Mesh(), shadows = new Mesh();
  const bounds = map.bounds || { minX: -25, maxX: 25, minZ: -25, maxZ: 25 };
  const theme = map.theme || map.id;
  const art = ART[theme] || ART.courtyard;
  const floorColor = mix(rgba(map.floorColor || '#929b8b'), rgba(art.paving), .36);
  const { minX, maxX, minZ, maxZ } = bounds;
  const width = maxX - minX, depth = maxZ - minZ;
  opaque.floor(minX - 35, minZ - 35, width + 70, depth + 70, shade(floorColor, .72), -.025);
  opaque.floor(minX, minZ, width, depth, floorColor, 0);
  // Repeating paving seams are flat markings, so visible traversable ground is
  // identical to collision ground. A single GPU mesh serves the entire map.
  const tile = art.tile;
  for (let x = minX; x < maxX; x += tile) for (let z = minZ; z < maxZ; z += tile) {
    const seed = hash(`${map.id}:${x}:${z}`), lane = theme === 'courtyard' && Math.abs(Math.abs(x + tile / 2) - 11) < 2;
    const tint = shade(floorColor, .94 + seed % 5 * .022);
    opaque.floor(x + .025, z + .025, Math.min(tile - .05, maxX - x - .025), Math.min(tile - .05, maxZ - z - .025), lane ? mix(tint, rgba('#94a09a'), .25) : tint, .001);
    if (theme === 'depot' && seed % 4 === 0) opaque.floor(x + .27, z + .57, tile * .49, tile * .44, shade(floorColor, .89), .002);
    if (theme === 'forest') {
      opaque.floor(x + .36 + seed % 13 / 10, z + .28 + seed % 17 / 10, .42, .14, shade(floorColor, .78), .002);
      if (seed % 3 === 0) opaque.floor(x + .58, z + .72, .09, .25, '#adab6c', .003);
    }
    if (theme === 'desert') for (let i = 0; i < 2; i++) opaque.floor(x + .35 + i * .28, z + .65 + i * 1.15, 2.4 - i * .5, .025, shade(floorColor, .90), .002);
    if (theme === 'maze' && seed % 3 === 0) opaque.floor(x + .35, z + .42, .81, .31, '#728b71', .002);
  }
  const atmosphere = ATMOSPHERE[theme] || ATMOSPHERE.courtyard;
  for (const collider of map.colliders || []) {
    paintCollider(opaque, collider, theme);
    if (collider.h < .15) continue;
    const sun = atmosphere.sun, elevation = collider.y + collider.h, dx = -sun[0] / sun[1] * elevation, dz = -sun[2] / sun[1] * elevation;
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
  const skylineColor = rgba(art.skyline);
  const backdrop = (axis, side, start, length) => {
    for (let i = 0; i < length; i += theme === 'paris' ? 7 : ROYALE_THEMES.has(theme) ? 8 : 4.5) {
      const seed = hash(`${map.id}:${axis}:${side}:${i}`), h = 6 + seed % 7;
      const x = axis === 'x' ? side : start + i;
      const z = axis === 'z' ? side : start + i;
      const w = axis === 'x' ? 4 : 4.1, d = axis === 'z' ? 4 : 4.1;
      const c = shade(skylineColor, .80 + (seed % 4) * .07);
      if (theme === 'forest') {
        opaque.box(x + 1.65, -.05, z + 1.65, .70, h + 1, .70, '#5a6650');
        for (let tier = 0; tier < 4; tier++) {
          const spread = 5 - tier * .82;
          opaque.box(x + 2 - spread / 2, 3.2 + tier * 1.4, z + 2 - spread / 2, spread, 1.85, spread, shade(c, .83 + tier * .07));
        }
        continue;
      }
      if (theme === 'desert') {
        // Distant stepped dunes, never city towers or walls inside the arena.
        for (let tier = 0; tier < 3; tier++) opaque.box(x - 1 + tier * .8, -.10 + tier * 1.0, z - 1 + tier * .8, 8 - tier * 1.6, 1.2, 8 - tier * 1.6, shade(c, .94 + tier * .035));
        continue;
      }
      if (theme === 'maze') {
        for (let tier = 0; tier < 3; tier++) opaque.box(x + tier * .18, -.10 + tier * 1.6, z + tier * .18, 5.6 - tier * .36, 1.8, 5.6 - tier * .36, shade(c, .84 + tier * .09));
        continue;
      }
      if (theme === 'paris') {
        const building = { x, y: -.05, z, w, h, d };
        opaque.box(x, -.05, z, w, h, d, c);
        for (const face of ['north', 'south', 'west', 'east']) {
          const faceWidth = face === 'north' || face === 'south' ? w : d;
          wallPatch(opaque, building, face, .04, h - .24, faceWidth - .08, .10, '#e0d3b8', .004);
          for (let level = 2.12; level < h - 1.12; level += 1.9) {
            wallPatch(opaque, building, face, .04, level - .13, faceWidth - .08, .032, shade(c, 1.12), .004);
            for (let slot = .45; slot < faceWidth - .95; slot += 1.75) {
              wallPatch(opaque, building, face, slot, level, .73, .98, '#716e65', .005);
              wallPatch(opaque, building, face, slot + .06, level + .06, .61, .84, '#526e76', .007);
              wallPatch(opaque, building, face, slot + .33, level + .06, .025, .84, '#d1c4aa', .009);
              wallPatch(opaque, building, face, slot + .06, level + .43, .61, .025, '#d1c4aa', .009);
            }
          }
        }
        // Stepped zinc mansards and dormers are outside the playable perimeter.
        // Inside the arena, every rooftop remains the exact shared collider.
        for (let tier = 0; tier < 3; tier++) opaque.box(x + tier * .31, h + tier * .39, z + tier * .31, w - tier * .62, .43, d - tier * .62, shade(rgba('#576b79'), .95 + tier * .06));
        opaque.box(x + .58, h + .23, z + .45, .54, .65, .63, '#c4bba7');
        opaque.box(x + w - 1.10, h + .35, z + d - 1.00, .47, 1.08, .51, '#a2917b');
        continue;
      }
      opaque.box(x, -.05, z, w, h, d, c);
      opaque.box(x - .07, h - .2, z - .07, w + .14, .18, d + .14, shade(c, .70));
      if (theme === 'courtyard') opaque.box(x + .16, h, z + .16, w - .32, .30, d - .32, mix(c, rgba('#ad8971'), .34));
      if ((theme === 'depot' || theme === 'foundry') && seed % 3 === 0) {
        opaque.box(x + .45, h, z + .45, 1.4, .72, 1.6, shade(c, .72));
        opaque.box(x + 2.50, h, z + 1.1, .38, 2.3, .38, '#80634f');
      }
      if (theme === 'canal') {
        opaque.box(x + .1, h, z + .1, w - .2, .40, d - .2, mix(c, rgba('#b48369'), .42));
        opaque.box(x + .65, h + .4, z + .8, 2.6, .35, 2.4, mix(c, rgba('#b48369'), .54));
      }
      if (theme === 'rooftops') opaque.box(x + .1, h, z + .1, w - .2, .18, d - .2, '#c4cbb9');
      if (theme === 'bastion') {
        for (let xx = x + .2; xx < x + w - .25; xx += 1.1) opaque.box(xx, h, z + .1, .55, .48, .52, mix(c, rgba('#9eaa98'), .22));
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
  if (theme === 'paris') opaque.append(parisLandmarkMesh(bounds));
  const cloud = rgba(art.cloud);
  for (let i = 0; i < 6; i++) {
    const seed = hash(`${map.id}:cloud:${i}`), xx = minX - 22 + i * 17, zz = minZ - 28 + (seed % 35), yy = 23 + seed % 7;
    opaque.box(xx, yy, zz, 8 + seed % 5, .65, 3.6, cloud);
    opaque.box(xx + 2, yy + .62, zz + .7, 5.5, .65, 2.5, shade(cloud, 1.025));
    opaque.box(xx + 7, yy - .35, zz + .45, 4.5, .40, 2.5, shade(cloud, .94));
  }
  return { opaque: opaque.array, shadows: shadows.array };
}

/** Original low-cost Eiffel silhouette: all of it stays beyond the north wall. */
export function parisLandmarkMesh(bounds) {
  const mesh = new Mesh(), centerX = (bounds.minX + bounds.maxX) / 2 - 9, centerZ = bounds.minZ - 24;
  const iron = '#716a58', warm = '#91846b', dark = '#575b51';
  const corner = (sx, sz, spread, y) => [centerX + sx * spread, y, centerZ + sz * spread];
  const levels = [{ y: 0, spread: 6.7 }, { y: 3, spread: 5.6 }, { y: 6, spread: 4.3 }, { y: 9, spread: 3.1 }, { y: 13.5, spread: 2.1 }, { y: 18, spread: 1.25 }, { y: 22, spread: .70 }, { y: 26, spread: .32 }];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    mesh.box(centerX + sx * 6.7 - .72, 0, centerZ + sz * 6.7 - .72, 1.44, .42, 1.44, '#b8ab8e');
    for (let i = 1; i < levels.length; i++) {
      const a = levels[i - 1], b = levels[i];
      mesh.beam(corner(sx, sz, a.spread, a.y), corner(sx, sz, b.spread, b.y), i < 4 ? .52 : .31, sx === sz ? warm : iron);
    }
  }
  // Leave the recognizable ground arch open below the first platform.
  for (let level = 3; level < levels.length; level++) {
    const below = levels[level - 1], above = levels[level];
    for (const side of [-1, 1]) {
      mesh.beam(corner(-1, side, below.spread, below.y + .18), corner(1, side, above.spread, above.y), .12, dark);
      mesh.beam(corner(1, side, below.spread, below.y + .18), corner(-1, side, above.spread, above.y), .12, dark);
      mesh.beam(corner(side, -1, below.spread, below.y + .18), corner(side, 1, above.spread, above.y), .12, iron);
      mesh.beam(corner(side, 1, below.spread, below.y + .18), corner(side, -1, above.spread, above.y), .12, iron);
    }
  }
  for (const { y, spread } of [levels[3], levels[5]]) {
    mesh.box(centerX - spread - .32, y - .22, centerZ - spread - .32, spread * 2 + .64, .40, spread * 2 + .64, warm);
    for (const sx of [-1, 1]) mesh.box(centerX + sx * (spread + .22) - .04, y + .18, centerZ - spread - .26, .08, .33, spread * 2 + .52, dark);
    for (const sz of [-1, 1]) mesh.box(centerX - spread - .26, y + .18, centerZ + sz * (spread + .22) - .04, spread * 2 + .52, .33, .08, dark);
  }
  mesh.box(centerX - .40, 25.8, centerZ - .40, .80, 1.18, .80, warm);
  mesh.box(centerX - .19, 26.98, centerZ - .19, .38, 2.05, .38, iron);
  mesh.box(centerX - .055, 29.03, centerZ - .055, .11, 2.58, .11, dark);
  return mesh.array;
}

const weaponLength = weapon => ({ pistol: .42, smg: .68, marksman: 1.04, shotgun: 1.02, burst: .87, sniper: 1.26, lmg: 1.08, crossbow: .83 })[weapon] || .92;

function weaponParts(mesh, weapon, pose, options = {}) {
  const pistol = weapon === 'pistol', shotgun = weapon === 'shotgun', burst = weapon === 'burst';
  const rifle = !pistol, smg = weapon === 'smg', marksman = weapon === 'marksman', sniper = weapon === 'sniper', lmg = weapon === 'lmg';
  const scoped = !!WEAPONS[weapon]?.scoped;
  const length = weaponLength(weapon);
  const limit = options.limit ?? length + .20;
  const body = rgba(options.body || (smg ? '#506f76' : sniper ? '#62706a' : lmg ? '#79764f' : marksman ? '#465d62' : shotgun ? '#7d6248' : burst ? '#765b52' : pistol ? '#63788a' : '#57675e')), trim = '#202d32', metal = '#b2bfb7';
  const reload = clamp(finite(options.reloadProgress), 0, 1), magazineDrop = reload > .04 && reload < .64 ? Math.sin((reload - .04) / .60 * Math.PI) * .25 : 0;
  const part = (x, y, z, w, h, d, color) => {
    // The weapon points down local -Z. Clamp each part at the first solid
    // cover contact so a barrel cannot reappear through a thin wall.
    const clippedZ = Math.max(z, -limit);
    const clippedDepth = z + d - clippedZ;
    if (clippedDepth > 0) mesh.box(x, y, clippedZ, w, h, clippedDepth, color, pose);
  };
  const string = (a, b, width, color) => {
    const dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz) || 1;
    const offset = [-dz / length * width / 2, 0, dx / length * width / 2];
    const transform = point => {
      const clipped = [point[0], point[1], Math.max(point[2], -limit)];
      const rotated = rotate(pose.scale ? clipped.map(value => value * pose.scale) : clipped, pose.yaw, pose.pitch);
      return [rotated[0] + pose.x, rotated[1] + pose.y, rotated[2] + pose.z];
    };
    const points = [a.map((v, i) => v - offset[i]), a.map((v, i) => v + offset[i]), b.map((v, i) => v + offset[i]), b.map((v, i) => v - offset[i])].map(transform);
    const normal = rotate([0, 1, 0], pose.yaw, pose.pitch), tint = rgba(color);
    // A two-sided continuous ribbon reads as a taut string from either side,
    // using fewer triangles than disconnected tiny boxes along its length.
    mesh.quad(...points, normal, tint);
    mesh.quad(...[...points].reverse(), normal.map(value => -value), tint);
  };
  if (weapon === 'crossbow') {
    const loaded = options.loaded !== false && reload === 0;
    const draw = reload > 0 ? smooth(reload) : 1;
    const stringZ = lerp(-.61, -.19, draw);
    part(-.055, -.061, -.62, .11, .132, .68, '#676d52');
    part(-.065, -.012, -.65, .13, .080, .51, '#354844');
    part(-.045, .069, -.72, .09, .020, .63, '#a0ac8a');
    part(-.067, -.060, -.055, .134, .13, .26, options.stock || '#ad9170');
    part(-.034, -.20, -.01, .068, .15, .075, '#31433d');
    // The horizontal limbs and thin cocking string distinguish this weapon
    // from a rifle. A real loaded bolt disappears as soon as ammo is spent.
    part(-.44, -.014, -.69, .88, .052, .085, '#6f8d79');
    part(-.49, -.010, -.76, .17, .046, .084, '#a2b59a');
    part(.32, -.010, -.76, .17, .046, .084, '#a2b59a');
    string([-.45, .014, -.69], [0, .014, stringZ], .009, '#d7d3b1');
    string([0, .014, stringZ], [.45, .014, -.69], .009, '#d7d3b1');
    if (loaded) {
      part(-.009, .094, -.79, .018, .018, .66, '#ddcc99');
      part(-.015, .090, -.84, .030, .024, .078, '#c4d1c3');
      part(-.040, .089, -.16, .080, .012, .11, '#709d8e');
      part(-.006, .073, -.16, .012, .056, .11, '#709d8e');
    }
    part(-.034, .112, -.13, .015, .040, .027, trim);
    part(.019, .112, -.13, .015, .040, .027, trim);
    part(-.006, .112, -.61, .012, .040, .020, '#cce1af');
    return length;
  }
  if (rifle) {
    part(-.067, -.055, -.44, .134, .145, .45, body);
    part(-.055, -.032, -.64, .11, .10, .24, trim);
    part(-.025, -.014, -length, .05, .054, length - .60 + .04, metal);
    part(-.041, -.02, -length - .035, .082, .075, .06, trim);
    part(-.049, .080, -.36, .098, .033, .30, '#262f35');
    if (!shotgun && !lmg) {
      const magazineZ = burst ? -.11 : -.18;
      part(-.045, -.25 - magazineDrop, magazineZ + magazineDrop * .16, .09, .20, .105, trim);
      part(-.045, -.23 - magazineDrop, magazineZ - .002 + magazineDrop * .16, .09, .04, .109, burst ? '#bb8878' : '#738b80');
    }
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
    if (burst) {
      part(-.08, -.045, -.50, .16, .10, .18, '#5a4441');
      part(-.08, .055, -.43, .16, .025, .30, '#b88271');
      part(-.075, -.03, -.66, .15, .036, .14, '#c39e84');
      for (let i = 0; i < 3; i++) part(.075, -.01, -.40 + i * .035, .008, .035, .019, '#d7b399');
      part(-.060, -.048, .15, .12, .095, .075, '#795c52');
    }
    if (shotgun) {
      // A pump, tubular magazine and shell saddle make the close-range gun
      // readable without adding another material or rendering pass.
      const pump = clamp(finite(options.pump), 0, 1) * .12;
      part(-.040, -.088, -.91, .08, .063, .43, '#303a3c');
      part(-.073, -.087, -.72 + pump, .146, .105, .26, '#996f48');
      for (let i = 0; i < 5; i++) part(-.075, -.084, -.69 + pump + i * .04, .15, .098, .012, '#523f32');
      part(-.087, -.013, -.34, .020, .055, .19, '#473b35');
      for (let i = 0; i < 4; i++) {
        part(-.103, -.026, -.33 + i * .045, .030, .068, .032, '#a65c45');
        part(-.104, .033, -.33 + i * .045, .032, .014, .033, '#d1b36b');
      }
      if (reload > .18 && reload < .85) {
        const shell = Math.sin((reload - .18) / .67 * Math.PI);
        part(-.10 - shell * .025, -.11 - (1 - shell) * .06, -.25, .033, .075, .033, '#b36f47');
        part(-.10 - shell * .025, -.039 - (1 - shell) * .06, -.25, .033, .015, .033, '#d5b871');
      }
    }
    if (lmg) {
      part(-.090, -.068, -.51, .18, .17, .37, '#536250');
      part(-.100, -.030, -.34, .20, .18, .31, '#797d58');
      part(-.075, -.27 - magazineDrop, -.27, .15, .23, .24, '#485340');
      part(-.074, -.262 - magazineDrop, -.268, .148, .048, .236, '#9c9d70');
      part(-.05, -.092, -.95, .10, .063, .41, '#435442');
      for (let i = 0; i < 6; i++) {
        part(-.155 - i * .022, .040 - i * .012, -.30, .027, .034, .043, '#b5a570');
        part(-.154 - i * .022, .067 - i * .012, -.30, .025, .009, .042, '#d4c189');
      }
      part(-.15, .017, -.34, .07, .05, .105, '#344331');
      part(-.032, -.038, -1.11, .064, .073, .082, '#293830');
      const spin = clamp(finite(options.spin), 0, 1);
      for (let i = 0; i < 3; i++) part(.102, .062, -.20 + i * .034, .006, .018, .022, spin >= (i + 1) / 3 ? '#d4dba2' : '#35483c');
    }
    if (sniper) {
      part(-.071, -.025, -.58, .142, .11, .46, '#718170');
      part(-.044, -.01, -1.18, .088, .075, .29, '#344740');
      part(-.065, -.018, -1.30, .13, .095, .14, '#43594f');
      part(-.075, .02, .10, .15, .16, .17, '#7e8b70');
      part(-.030, -.040, -1.01, .022, .11, .035, '#516055');
      part(.008, -.040, -1.01, .022, .11, .035, '#516055');
      const recovery = clamp(finite(options.cycle), 0, 1), bolt = Math.sin(recovery * Math.PI) * .15;
      part(.065, .013, -.28 + bolt, .087, .023, .037, '#b7c6b6');
      part(.13, -.025 + Math.sin(recovery * Math.PI) * .055, -.28 + bolt, .045, .07, .045, '#31483e');
    }
    if (scoped) {
      part(-.050, .105, -.36, .10, .023, .19, '#2c3f43');
      const front = sniper ? -.58 : -.465;
      for (const z of [front, -.14]) {
        // The scope is an open square tube. At full ADS the camera looks
        // through its aperture, rather than at a solid painted glass block.
        part(-.063, .115, z, .023, .12, .045, '#202f34');
        part(.040, .115, z, .023, .12, .045, '#202f34');
        part(-.040, .115, z, .080, .017, .045, '#202f34');
        part(-.040, .216, z, .080, .019, .045, '#202f34');
      }
      part(-.060, .139, front + .045, .017, .063, -front - .18, '#31464a');
      part(.043, .139, front + .045, .017, .063, -front - .18, '#31464a');
      part(-.03, -.023, -.68, .06, .025, .05, '#bca6de');
      part(.057, .160, -.29, .029, .035, .065, '#a1bdb1');
      if (finite(options.aim) < .2) {
        part(-.040, .132, front - .004, .08, .075, .004, '#73aaa7');
        part(-.040, .132, -.094, .08, .075, .004, '#5f9c9d');
        part(-.007, .132, -.089, .004, .075, .002, '#203d40');
        part(-.040, .171, -.089, .08, .004, .002, '#203d40');
      }
    }
  } else {
    const slide = clamp(finite(options.bolt), 0, 1) * .053;
    part(-.048, -.025, -.38, .096, .088, .34, body);
    part(-.046, .063, -.385 + slide, .092, .044, .345, metal);
    part(-.022, -.018, -.44, .044, .044, .065, trim);
    part(-.040, -.19 - magazineDrop, -.11, .08, .18, .105, trim);
    part(-.041, -.08, -.115, .008, .066, .086, '#a4b1ae');
    part(.033, -.08, -.115, .008, .066, .086, '#a4b1ae');
    part(-.040, -.19 - magazineDrop, -.113, .08, .015, .109, '#8eb0bd');
    for (let i = 0; i < 4; i++) part(.046, .066, -.17 + slide + i * .02, .006, .035, .008, '#596e79');
  }
  if (!scoped) {
    // A genuine open rear notch and luminous front post share the same
    // .152 sight line, which the first-person ADS pose places on camera Y=0.
    const front = pistol ? -.355 : -length + .05, rear = pistol ? -.085 : -.15;
    part(-.036, .112, rear, .017, .040, .035, '#253237');
    part(.019, .112, rear, .017, .040, .035, '#253237');
    part(-.008, .109, front, .016, .043, .025, '#c3d2bc');
    part(-.004, .142, front - .002, .008, .010, .005, '#c8e6b4');
    part(-.031, .137, rear + .036, .010, .010, .004, '#bdd4ae');
    part(.021, .137, rear + .036, .010, .010, .004, '#bdd4ae');
  }
  return length;
}

function swordParts(mesh, pose, options = {}) {
  const limit = finite(options.limit, 1.24);
  const part = (x, y, z, w, h, d, color) => {
    const clippedZ = Math.max(z, -limit), clippedDepth = z + d - clippedZ;
    if (clippedDepth > 0) mesh.box(x, y, clippedZ, w, h, clippedDepth, color, pose);
  };
  part(-.030, -.036, -.045, .060, .072, .235, '#443a35');
  for (let i = 0; i < 4; i++) part(-.032, -.038, -.013 + i * .045, .064, .076, .018, '#887953');
  part(-.044, -.047, .167, .088, .094, .047, '#aebfc0');
  part(-.172, -.035, -.09, .344, .070, .055, '#bba772');
  part(-.18, -.043, -.095, .047, .086, .065, '#6a755c');
  part(.133, -.043, -.095, .047, .086, .065, '#6a755c');
  const blade = options.active ? '#dde9e4' : '#b6c9cc';
  part(-.062, -.024, -.83, .124, .048, .75, blade);
  part(-.036, -.018, -1.03, .072, .036, .22, blade);
  part(-.019, -.010, -1.14, .038, .020, .13, '#eef2dc');
  part(-.011, -.026, -.82, .022, .052, .70, '#748d96');
  part(-.065, -.026, -.81, .011, .052, .69, '#e5eadd');
  part(.054, -.026, -.81, .011, .052, .69, '#e5eadd');
}

function potionParts(mesh, pose, progress = 0) {
  // An opaque faceted bottle avoids translucent sorting and makes the
  // consumable readable in the same low-cost batch as the operative's hands.
  mesh.box(-.066, -.082, -.059, .132, .175, .118, '#547e72', pose);
  mesh.box(-.051, -.068, -.064, .102, .125, .128, '#7fb5a0', pose);
  mesh.box(-.041, .086, -.04, .082, .044, .080, '#b8d4b6', pose);
  mesh.box(-.031, .123, -.031, .062, .059, .062, '#90b59c', pose);
  if (progress < .13 || progress > .94) mesh.box(-.037, .174, -.037, .074, .039, .074, '#bb9762', pose);
  mesh.box(-.018, -.037, -.066, .036, .074, .005, '#e9e4be', pose);
  mesh.box(-.041, -.014, -.066, .082, .026, .005, '#e9e4be', pose);
  mesh.box(-.047, -.049, .061, .094, .054, .005, '#314e4a', pose);
  mesh.box(-.063, .052, -.030, .014, .028, .049, '#c9ded0', pose);
}

function grenadeParts(mesh, pose, radius, fuseTicks, time) {
  const r = clamp(finite(radius, .12), .04, .25), scale = r / .12;
  const blinkPeriod = lerp(70, 320, clamp(finite(fuseTicks) / 288, 0, 1));
  const lit = Math.floor(time / blinkPeriod) % 2 === 0;
  const shell = lit && fuseTicks < 120 ? '#977457' : '#4a6655';
  const part = (x, y, z, w, h, d, color) => mesh.box(x * scale, y * scale, z * scale, w * scale, h * scale, d * scale, color, pose);
  // Every corner stays inside the engine's .12m sphere. Voxel steps suggest a
  // rounded shell without the corners of a large cube becoming false cover.
  part(-.069, -.069, -.069, .138, .138, .138, shell);
  part(-.104, -.034, -.034, .208, .068, .068, shell);
  part(-.034, -.104, -.034, .068, .208, .068, shell);
  part(-.034, -.034, -.104, .068, .068, .208, shell);
  part(-.079, -.052, -.049, .015, .104, .098, '#263b37');
  part(.064, -.052, -.049, .015, .104, .098, '#263b37');
  part(-.024, .071, -.027, .048, .035, .054, '#859287');
  part(-.022, .105, -.020, .044, .009, .040, lit ? '#efb86a' : '#aa7a4f');
}

function lootGun(mesh, weapon, pose) {
  const part = (...values) => mesh.box(...values, pose);
  const metal = '#bcc5b6', trim = '#2a3b3d', body = weapon === 'shotgun' ? '#ad8057' : weapon === 'lmg' ? '#8b9161' : weapon === 'sniper' ? '#80937e' : '#698779';
  if (weapon === 'crossbow') {
    part(-.045, -.045, -.52, .09, .10, .62, '#8d9970');
    part(-.39, -.02, -.55, .78, .04, .08, '#9ac2a0');
    part(-.009, .06, -.65, .018, .018, .64, '#eddbad');
    part(-.06, -.04, .05, .12, .11, .17, '#987954');
    part(-.025, -.16, -.07, .05, .12, .06, trim);
    return;
  }
  const pistol = weapon === 'pistol', length = weaponLength(weapon), barrel = pistol ? .34 : length * .88;
  part(-.07, -.045, -.47, .14, .12, .42, body);
  if (pistol) part(-.045, .075, -.47, .09, .04, .36, metal);
  part(-.025, -.005, -barrel, .05, .05, Math.max(.03, barrel - .44), trim);
  part(-.035, -.19, -.14, .07, .16, .09, trim);
  if (pistol) return;
  part(-.06, -.06, -.03, .12, .12, .23, '#aa9370');
  if (weapon === 'shotgun') {
    part(-.025, -.065, -.86, .05, .05, .43, trim);
    part(-.065, -.08, -.69, .13, .08, .23, '#bc9060');
  } else if (weapon === 'lmg') {
    part(-.095, -.21, -.31, .19, .20, .23, '#5b7153');
    part(-.15, .09, -.29, .07, .025, .19, '#dcc37c');
  } else {
    part(-.055, -.21, -.29, .11, .17, .12, trim);
    if (weapon === 'smg') part(-.085, -.03, -.57, .17, .08, .19, '#6aafa5');
    if (weapon === 'burst') part(-.079, .048, -.56, .158, .035, .21, '#b88870');
  }
  if (weapon === 'marksman' || weapon === 'sniper') {
    part(-.06, .12, -.48, .12, .10, weapon === 'sniper' ? .37 : .27, trim);
    // The glass is one painted face instead of another six-sided box.
    const point = vector => { const rotated = rotate(vector.map(value => value * pose.scale), pose.yaw, pose.pitch); return rotated.map((value, axis) => value + [pose.x, pose.y, pose.z][axis]); };
    mesh.quad(...[[-.052, .132, -.482], [-.052, .207, -.482], [.052, .207, -.482], [.052, .132, -.482]].map(point), rotate([0, 0, -1], pose.yaw, pose.pitch), rgba('#a2cbd0'));
  }
}

const validLoot = item => item && ['weapon', 'heal', 'ammo', 'grenade'].includes(item.kind) && [item.x, item.y, item.z].every(Number.isFinite) && (item.kind !== 'weapon' || !!WEAPONS[item.weapon]);

/** Pickups are deliberately small display props, not misleading solid cover. */
export function lootMeshes(items = [], time = 0) {
  const opaque = new Mesh(), contacts = new Mesh();
  let count = 0;
  for (const item of items) {
    if (count >= MAX_LOOT) break;
    if (!validLoot(item)) continue;
    count++;
    const x = item.x, y = item.y, z = item.z, seed = hash(item.id);
    const tint = item.kind === 'heal' ? '#a3e6b7' : item.kind === 'weapon' ? '#edd494' : item.kind === 'grenade' ? '#deb39c' : '#94c8da';
    contacts.floorRing(x, z, .23, .275, rgba(tint, .64), y + .018, 8);
    const bob = Math.sin(finite(time) * .0023 + seed % 13) * .016;
    if (item.kind === 'weapon') {
      const length = weaponLength(item.weapon);
      const yaw = (seed % 4) * Math.PI / 2 + .45;
      // Center the sideways miniature over its marker; it cannot resemble a
      // crate or a wall that a player could use as cover.
      const offset = rotate([0, 0, length * .22], yaw);
      lootGun(opaque, item.weapon, { x: x + offset[0], y: y + .27 + bob, z: z + offset[2], yaw, pitch: 0, scale: .44 });
      opaque.floor(x - .15, z - .15, .30, .30, '#6f6d51', y + .022);
    } else if (item.kind === 'heal') {
      const pose = { x, y: y + .15 + bob, z, yaw: .32, pitch: 0, scale: 1.10 };
      opaque.box(-.066, -.082, -.059, .132, .175, .118, '#71af8e', pose);
      opaque.box(-.039, .086, -.039, .078, .079, .078, '#b2d2aa', pose);
      opaque.box(-.037, .164, -.037, .074, .038, .074, '#bd9a66', pose);
      opaque.box(-.017, -.037, -.063, .034, .074, .005, '#f3edcb', pose);
      opaque.box(-.041, -.014, -.063, .082, .026, .005, '#f3edcb', pose);
      opaque.box(-.047, -.049, .060, .094, .054, .005, '#314e4a', pose);
    } else if (item.kind === 'ammo') {
      opaque.box(x - .14, y + .025, z - .11, .28, .18, .22, '#496b71');
      opaque.box(x - .15, y + .205, z - .12, .30, .035, .24, '#9fbdb6');
      for (let i = 0; i < 3; i++) {
        opaque.box(x - .075 + i * .06, y + .06, z - .118, .025, .08, .018, '#e3c77e');
      }
    } else {
      // A ground pickup has an intact pin and no live fuse blink.
      const bottom = y + .035 + bob;
      opaque.box(x - .069, bottom, z - .069, .138, .17, .138, '#5e7f60');
      opaque.box(x - .095, bottom + .042, z - .042, .19, .085, .084, '#4d6c52');
      opaque.box(x - .042, bottom + .042, z - .095, .084, .085, .19, '#4d6c52');
      opaque.box(x - .025, bottom + .17, z - .027, .05, .043, .054, '#afbb9b');
      opaque.box(x - .015, bottom + .201, z - .02, .06, .014, .04, '#ceb980');
      opaque.box(x + .015, bottom + .16, z - .047, .029, .032, .06, '#e4d8b0');
    }
  }
  return { opaque: opaque.array, contacts: contacts.array, count };
}

/** The circle is a ground projection; outside danger comes from surface haze. */
export function stormMesh(storm) {
  const mesh = new Mesh();
  if (!storm?.active || ![storm.x, storm.z, storm.radius].every(Number.isFinite) || storm.radius < 0) return mesh.array;
  const radius = Math.min(storm.radius, 256);
  mesh.floorRing(storm.x, storm.z, Math.max(0, radius - .11), radius + .11, [.49, .79, .94, .68], .035, 64);
  mesh.floorRing(storm.x, storm.z, Math.max(0, radius - .43), Math.max(.025, radius - .32), [.47, .73, .90, .19], .034, 64);
  return mesh.array;
}

function playerMesh(mesh, player, map, time, allied, freeForAll = false) {
  const crouch = player.crouching, scale = crouch ? 1.15 / 1.8 : 1;
  const yaw = finite(player.yaw), pitch = clamp(finite(player.pitch) + finite(player.recoil), -1.45, 1.45);
  // The simulation targets axis-aligned voxel boxes. Quarter-turn silhouettes
  // keep the visible body and exact square head inside those hitboxes at every
  // aim angle; the held weapon still follows continuous yaw and pitch.
  const bodyYaw = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
  const pose = { x: player.x, y: finite(player.y), z: player.z, yaw: bodyYaw, pitch: 0 };
  const color = freeForAll ? survivorColor(player) : TEAM_COLORS[player.team === 1 ? 1 : 0];
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
  const healing = finite(player.healTicks) > 0;
  const sword = player.slot === 'sword', motion = swordMotion(player);
  const heldYaw = sword && player.meleeTicks > 0 ? finite(player.meleeYaw, yaw) : yaw;
  const heldPitch = sword && player.meleeTicks > 0 ? finite(player.meleePitch, pitch) : pitch;
  const handOffset = rotate([healing ? -.16 : .21, healing ? (crouch ? .87 : 1.42) : (crouch ? .82 : 1.24), healing ? -.34 : -.24 - (sword ? motion.extension : 0)], heldYaw);
  const reloadProgress = player.reloadTicks > 0 ? clamp(1 - player.reloadTicks / (WEAPONS[player.weapon]?.reloadTicks || 252), 0, 1) : 0;
  const reloadTilt = Math.sin(reloadProgress * Math.PI);
  const gunPose = { x: pose.x + handOffset[0], y: pose.y + handOffset[1] - reloadTilt * .12, z: pose.z + handOffset[2], yaw: heldYaw + (sword ? motion.yaw : 0), pitch: heldPitch + (sword ? motion.pitch : -reloadTilt * .24), scale: sword && !healing ? 1.35 : 1 };
  const direction = [Math.sin(gunPose.yaw) * Math.cos(gunPose.pitch), Math.sin(gunPose.pitch), -Math.cos(gunPose.yaw) * Math.cos(gunPose.pitch)];
  const limit = Math.max(0, rayCoverDistance([gunPose.x, gunPose.y, gunPose.z], direction, map.colliders || [], sword ? 1.24 * 1.35 : weaponLength(player.weapon) + .12, sword ? .088 : 0) - .025) / gunPose.scale;
  if (healing) {
    const progress = clamp(1 - player.healTicks / HEAL.ticks, 0, 1), drink = Math.sin(progress * Math.PI);
    const bottlePose = { ...gunPose, pitch: drink * .72 };
    potionParts(mesh, bottlePose, progress);
    mesh.box(-.084, -.105, -.037, .17, .093, .17, '#526662', bottlePose);
  } else if (sword) {
    swordParts(mesh, gunPose, { limit, active: motion.active });
    mesh.box(-.070, -.085, -.025, .14, .16, .20, '#526662', gunPose);
    mesh.box(-.060, -.075, .15, .12, .15, .27, uniform, gunPose);
  } else {
    weaponParts(mesh, player.weapon, gunPose, { limit, stock: color, reloadProgress, aim: aimProgress(player), loaded: player.ammo > 0, spin: finite(player.spinTicks) / (WEAPONS[player.weapon]?.spinupTicks || 1), cycle: 1 - finite(player.shotCooldown) / (WEAPONS[player.weapon]?.cooldown || 1) });
    mesh.box(-.33, -.072, -.43, .17, .14, .26, '#526662', gunPose);
    mesh.box(-.08, -.14, -.11, .13, .14, .17, '#526662', gunPose);
  }
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
    this.mapCache = new Map(); this.mapId = null; this.effectMap = null; this.effectGameId = null; this.effectRound = null; this.effectPhase = null; this.eventIds = new Set(); this.eventQueue = [];
    this.particles = []; this.tracers = []; this.localShot = null; this.localReload = null;
    this.lastAim = null; this.swayX = 0; this.swayY = 0;
    this._frameDrawCalls = 0; this._frameDynamicVertices = 0; this._mapVertices = 0; this._lootItems = 0; this._stormVertices = 0;
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
    this.uniforms = Object.fromEntries(['Projection', 'View', 'Eye', 'Fog', 'FogStrength', 'LightDirection', 'Sun', 'Ambient', 'StormCircle', 'StormStrength'].map(name => [name.toLowerCase(), gl.getUniformLocation(program, `u${name}`)]));
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
    // The immutable catalog object distinguishes mode variants that share an
    // id, such as the differently sized Breach and Royale Paris districts.
    if (this.mapCache.has(map)) return this.mapCache.get(map);
    const meshes = mapMeshes(map);
    const result = { opaque: this._staticMesh(meshes.opaque), shadows: this._staticMesh(meshes.shadows) };
    this.mapCache.set(map, result);
    // A bounded cache keeps authored maps from doubling resident memory.
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
    this._frameDrawCalls++;
  }
  _dynamic(array, kind = 'world') {
    const gl = this.gl, buffer = kind === 'weapon' ? this.weaponBuffer : kind === 'tracer' ? this.tracerBuffer : kind === 'contact' ? this.contactBuffer : this.dynamicBuffer, capacityKey = kind === 'weapon' ? 'weaponCapacity' : kind === 'tracer' ? 'tracerCapacity' : kind === 'contact' ? 'contactCapacity' : 'dynamicCapacity';
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (array.byteLength > this[capacityKey]) {
      this[capacityKey] = Math.max(16384, Math.ceil(array.byteLength / 16384) * 16384);
      gl.bufferData(gl.ARRAY_BUFFER, this[capacityKey], gl.DYNAMIC_DRAW);
    }
    if (array.byteLength) gl.bufferSubData(gl.ARRAY_BUFFER, 0, array);
    this._frameDynamicVertices += array.length / VERTEX_STRIDE;
    return { buffer, count: array.length / VERTEX_STRIDE };
  }
  _events(state, time, localId) {
    const combat = !state.phase || ['fight', 'roundEnd', 'matchEnd'].includes(state.phase);
    const map = typeof state.map === 'object' && state.map?.colliders ? state.map : MAPS[state.mapId];
    for (const event of state.events || []) {
      const key = event.id ?? `${event.tick}:${event.type}:${event.playerId}:${event.shotIndex ?? ''}`;
      if (this.eventIds.has(key)) continue;
      this.eventIds.add(key); this.eventQueue.push(key);
      while (this.eventQueue.length > MAX_EVENT_IDS) this.eventIds.delete(this.eventQueue.shift());
      if (Number.isFinite(state.tick) && Number.isFinite(event.tick) && state.tick - event.tick > 18) continue;
      if (!combat) continue;
      if (event.type === 'shot') {
        // Ballistic bolts are represented only by their moving world geometry.
        if (WEAPONS[event.weapon]?.projectile) continue;
        const origin = [finite(event.x), finite(event.y), finite(event.z)];
        const direction = [finite(event.dx), finite(event.dy), finite(event.dz, -1)];
        const end = [event.hitX, event.hitY, event.hitZ].every(Number.isFinite) ? [event.hitX, event.hitY, event.hitZ] : origin.map((value, i) => value + direction[i] * 60);
        const effects = shotEffect(event.weapon);
        this.tracers.push({ origin, end, born: time, team: event.team, local: event.playerId === localId, width: effects.tracerWidth, color: effects.tracerColor, life: effects.tracerTicks * 1000 / 120, weapon: event.weapon });
        if (event.playerId === localId && (!event.pellet || event.pelletCount === 1)) this.localShot = { born: time, weapon: event.weapon };
        if (event.hitKind && event.hitKind !== 'none') {
          this.particles.push(...impactParticles(event, end, direction, map, time, key));
        }
      } else if (event.type === 'boltLaunch') {
        if (event.playerId === localId) this.localShot = { born: time, weapon: 'crossbow' };
      } else if (event.type === 'boltHit') {
        const origin = [finite(event.x), finite(event.y), finite(event.z)];
        this.particles.push(...impactParticles(event, origin, [-finite(event.nx), -finite(event.ny), -finite(event.nz)], map, time, key));
      } else if (event.type === 'reload' && event.playerId === localId) this.localReload = { born: time, weapon: event.weapon };
      else if (event.type === 'grenadeBounce' || event.type === 'meleeHit' || event.type === 'healComplete') {
        const origin = [finite(event.x), finite(event.y, .2), finite(event.z)], heal = event.type === 'healComplete';
        const count = heal ? 8 : 4;
        for (let i = 0; i < count; i++) {
          const angle = i * 2.39996 + hash(key) % 7;
          this.particles.push({ origin, born: time, vx: Math.sin(angle) * (heal ? .25 : .48) + finite(event.nx) * .45, vy: heal ? .35 + i * .04 : .25 + finite(event.ny) * .40, vz: Math.cos(angle) * (heal ? .25 : .48) + finite(event.nz) * .45, color: heal ? '#a9d6b9' : event.type === 'grenadeBounce' ? '#bfa47b' : '#e4c286', life: heal ? 360 + i * 15 : 180 + i * 12, gravity: heal ? 0 : 3, cover: true });
        }
      } else if (event.type === 'explosion' || event.type === 'grenadeExplosion') {
        const origin = [finite(event.x), finite(event.y, .25), finite(event.z)];
        const grenade = event.type === 'grenadeExplosion', count = grenade ? 28 : 24;
        for (let i = 0; i < count; i++) {
          const angle = i * 2.39996;
          this.particles.push({ origin, born: time, vx: Math.sin(angle) * (2 + i % 4), vy: 1 + i % 5, vz: Math.cos(angle) * (2 + i % 4), color: i % 3 ? '#efbc77' : '#8c8c79', life: grenade ? 330 + i * 9 : 450 + i * 12, gravity: 3, cover: true, radius: grenade ? finite(event.radius, 5.5) : 8 });
        }
      }
    }
    if (this.tracers.length > MAX_TRACERS) this.tracers.splice(0, this.tracers.length - MAX_TRACERS);
    if (this.particles.length > MAX_PARTICLES) this.particles.splice(0, this.particles.length - MAX_PARTICLES);
    this.tracers = this.tracers.filter(trace => time - trace.born < finite(trace.life, 68));
    this.particles = this.particles.filter(particle => time - particle.born < particle.life);
  }
  _bomb(mesh, state, players, time) {
    if (state.gameId === 'voxel-royale') return;
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
  _grenades(mesh, contacts, state, map, time) {
    for (const grenade of (state.grenades || []).slice(0, grenadeCapacity(state))) {
      if (![grenade.x, grenade.y, grenade.z].every(Number.isFinite)) continue;
      const r = clamp(finite(grenade.radius, .12), .04, .25);
      const speed = Math.hypot(finite(grenade.vx), finite(grenade.vy), finite(grenade.vz));
      const spin = speed > .12 ? time * .005 + finite(grenade.bounces) * .8 : finite(grenade.bounces) * .8;
      grenadeParts(mesh, { x: grenade.x, y: grenade.y, z: grenade.z, yaw: spin, pitch: spin * .7 }, r, grenade.fuseTicks, time);
      const support = surfaceBelow(map.colliders, grenade.x, grenade.z, grenade.y - r);
      const ground = support ? support.y + support.h : 0, altitude = Math.max(0, grenade.y - r - ground);
      for (let layer = 1; layer >= 0; layer--) {
        const size = r * (.8 + layer * .5) + Math.min(.10, altitude * .05);
        const minX = Math.max(grenade.x - size, support?.x ?? -Infinity), maxX = Math.min(grenade.x + size, support ? support.x + support.w : Infinity);
        const minZ = Math.max(grenade.z - size, support?.z ?? -Infinity), maxZ = Math.min(grenade.z + size, support ? support.z + support.d : Infinity);
        contacts.floor(minX, minZ, maxX - minX, maxZ - minZ, [.035, .055, .08, .17 / (1 + altitude * 1.5)], ground + .014 + layer * .0004);
      }
    }
  }
  _bolts(mesh, state) {
    for (const bolt of (state.bolts || []).slice(0, 24)) {
      if (![bolt.x, bolt.y, bolt.z, bolt.vx, bolt.vy, bolt.vz].every(Number.isFinite)) continue;
      const horizontal = Math.hypot(bolt.vx, bolt.vz);
      const pose = { x: bolt.x, y: bolt.y, z: bolt.z, yaw: Math.atan2(bolt.vx, -bolt.vz), pitch: Math.atan2(bolt.vy, horizontal) };
      const feather = state.gameId === 'voxel-royale' ? survivorColor({ id: bolt.playerId }) : bolt.team === 1 ? '#7baaa1' : '#b7a177';
      // The live projectile is depth-tested in the operative batch. It never
      // draws an instantaneous beam or a trail through solid cover.
      // The simulated point is the tip; the shaft stays behind it so it cannot
      // visually enter a wall before the swept projectile contact does.
      mesh.box(-.009, -.009, .04, .018, .018, .37, '#d8ceaa', pose);
      mesh.box(-.015, -.012, 0, .030, .024, .078, '#c3d2c1', pose);
      mesh.box(-.045, -.006, .32, .09, .012, .09, feather, pose);
      mesh.box(-.006, -.042, .32, .012, .084, .09, feather, pose);
    }
  }
  _viewModel(player, yaw, pitch, time, freeForAll = false) {
    const mesh = new Mesh(), team = freeForAll ? survivorColor(player) : TEAM_COLORS[player.team === 1 ? 1 : 0];
    const speed = Math.hypot(finite(player.vx), finite(player.vz));
    const walking = clamp(speed / 5.5, 0, 1), step = time * .011;
    const age = this.localShot?.weapon === player.weapon ? Math.max(0, time - this.localShot.born) : 10000;
    const effects = shotEffect(player.weapon), kickDuration = finite(effects.kickTicks, 28) * 1000 / 120;
    const kick = age < kickDuration ? finite(effects.kickStrength, 1) * Math.exp(-age / Math.max(25, kickDuration * .28)) * (1 - age / kickDuration) : 0;
    if (this.lastAim) {
      let yawDelta = yaw - this.lastAim.yaw;
      while (yawDelta > Math.PI) yawDelta -= TAU;
      while (yawDelta < -Math.PI) yawDelta += TAU;
      this.swayX += (clamp(-yawDelta * .19, -.027, .027) - this.swayX) * .3;
      this.swayY += (clamp((pitch - this.lastAim.pitch) * .17, -.021, .021) - this.swayY) * .3;
    }
    this.lastAim = { yaw, pitch };
    if (finite(player.healTicks) > 0) {
      const progress = clamp(1 - player.healTicks / HEAL.ticks, 0, 1), drink = Math.sin(progress * Math.PI);
      const pose = { x: -.14 - drink * .025, y: -.22 + drink * .11, z: -.43 + drink * .08, yaw: .12, pitch: drink * .72, scale: .93 };
      potionParts(mesh, pose, progress);
      mesh.box(-.078, -.119, -.042, .156, .123, .15, '#526661', pose);
      mesh.box(-.063, -.22, -.019, .132, .16, .17, '#435952', pose);
      mesh.box(-.067, -.28, .026, .141, .095, .115, mix(rgba(team), rgba('#64796b'), .24), pose);
      return mesh.array;
    }
    if (player.slot === 'sword') {
      const motion = swordMotion(player);
      // The committed attack direction stays fixed for the full swing. Camera
      // motion can inspect its recovery without visually steering the blade.
      let committedYaw = player.meleeTicks > 0 ? finite(player.meleeYaw, yaw) - yaw : 0;
      while (committedYaw > Math.PI) committedYaw -= TAU;
      while (committedYaw < -Math.PI) committedYaw += TAU;
      const committedPitch = player.meleeTicks > 0 ? finite(player.meleePitch, pitch) - pitch : 0;
      const pose = { x: .27 + this.swayX * .5, y: -.32 - Math.abs(Math.cos(step)) * .007 * walking, z: -.42 - motion.extension * .12, yaw: motion.yaw + committedYaw, pitch: motion.pitch + committedPitch, scale: .90 };
      swordParts(mesh, pose, { active: motion.active });
      mesh.box(-.085, -.09, -.026, .17, .18, .20, '#526661', pose);
      mesh.box(-.072, -.13, .17, .15, .19, .27, '#435952', pose);
      mesh.box(-.077, -.145, .31, .16, .20, .11, mix(rgba(team), rgba('#64796b'), .24), pose);
      return mesh.array;
    }
    const reloadActive = finite(player.reloadTicks) > 0;
    let reload = 0, reloadProgress = 0;
    if (reloadActive) {
      const ticks = finite(player.reloadTicks);
      const duration = WEAPONS[player.weapon]?.reloadTicks || WEAPONS.carbine.reloadTicks;
      reloadProgress = clamp(1 - ticks / duration, 0, 1);
      reload = Math.sin(clamp(reloadProgress, .04, .96) * Math.PI);
    }
    const aim = aimProgress(player), steady = 1 - aim * .92;
    const throwing = Math.sin(clamp(finite(player.grenadeThrowTicks) / 24, 0, 1) * Math.PI);
    const pose = {
      x: lerp(.29, 0, aim) + (this.swayX + Math.sin(step) * .008 * walking) * steady,
      y: lerp(-.29, -(WEAPONS[player.weapon]?.adsSightHeight || .152) * .74, aim) + (this.swayY - Math.abs(Math.cos(step)) * .008 * walking) * steady - reload * .105 - throwing * .15,
      z: lerp(-.49, -.35, aim) + kick * .052 + reload * .065,
      yaw: -.065 * (1 - aim) + this.swayX * 2 * steady + reload * .22,
      pitch: kick * .055 * (1 - aim * .70) - reload * .23 - throwing * .20,
      scale: .74,
    };
    const pump = player.weapon === 'shotgun' && age > 80 && age < 640 ? Math.sin((age - 80) / 560 * Math.PI) : 0;
    const length = weaponParts(mesh, player.weapon, pose, { stock: team, reloadProgress, bolt: kick * .75, pump, aim, loaded: player.ammo > 0, spin: finite(player.spinTicks) / (WEAPONS[player.weapon]?.spinupTicks || 1), cycle: 1 - finite(player.shotCooldown) / (WEAPONS[player.weapon]?.cooldown || 1) });
    const handShift = reload * .30, handDrop = reload * .17;
    if (player.weapon === 'pistol') {
      mesh.box(-.15, -.17 - handDrop, -.19 + handShift, .12, .13, .17, '#526661', pose);
      mesh.box(-.17, -.23 - handDrop, -.12 + handShift, .14, .14, .22, '#435952', pose);
      mesh.box(-.175, -.235 - handDrop, .01 + handShift, .15, .15, .10, mix(rgba(team), rgba('#64796b'), .24), pose);
    } else {
      mesh.box(-.17, -.09 - handDrop, -.52 + handShift + pump * .12, .15, .12, .30, '#526661', pose);
      mesh.box(-.20, -.15 - handDrop, -.27 + handShift + pump * .12, .17, .17, .32, '#435952', pose);
      mesh.box(-.205, -.14 - handDrop, -.11 + handShift + pump * .12, .18, .17, .12, mix(rgba(team), rgba('#64796b'), .24), pose);
      mesh.box(-.178, -.073 - handDrop, -.46 + handShift + pump * .12, .126, .026, .23, '#72887b', pose);
    }
    mesh.box(-.065, -.16, -.06, .13, .13, .16, '#526661', pose);
    mesh.box(.015, -.22, -.01, .17, .17, .32, '#435952', pose);
    mesh.box(.07, -.235, .12, .15, .18, .10, mix(rgba(team), rgba('#64796b'), .24), pose);
    mesh.box(.078, -.057, .13, .126, .018, .083, '#2a4143', pose);
    mesh.box(.113, -.038, .16, .062, .006, .039, '#79d0c0', pose);
    if (throwing > 0) {
      const hand = { x: -.20, y: -.17 - (1 - throwing) * .22, z: -.39 - throwing * .18, yaw: .17, pitch: -.16, scale: .74 };
      mesh.box(-.061, -.073, -.092, .122, .145, .184, '#526661', hand);
      mesh.box(-.071, -.08, .085, .142, .163, .28, '#435952', hand);
      mesh.box(-.075, -.085, .26, .15, .175, .09, mix(rgba(team), rgba('#64796b'), .24), hand);
    }
    const flashDuration = finite(effects.muzzleTicks, 5) * 1000 / 120;
    if (age < flashDuration && !reloadActive && !throwing && finite(effects.muzzleStrength, 1) > 0 && player.weapon !== 'crossbow') {
      const flare = (1 - age / flashDuration) * finite(effects.muzzleStrength, 1);
      const flash = (.025 + flare * .036) * finite(effects.muzzleSize, 1);
      const glow = rgba(effects.muzzleColor), core = mix(glow, rgba('#fff8dc'), .60);
      mesh.box(-flash / 2, -.015, -length - .070, flash, flash, .05 + flare * .04, glow, pose);
      mesh.box(-flash * .95, -.013 + flash * .2, -length - .055, flash * 1.9, flash * .38, .028, core, pose);
    }
    return mesh.array;
  }
  render(state, options = {}) {
    if (this.destroyed || this.contextLost || !this.available || !state) return false;
    const map = typeof state.map === 'object' && state.map?.colliders ? state.map : MAPS[state.mapId] || MAPS.courtyard;
    if (!map) return false;
    const players = state.players || state.fighters || [];
    const freeForAll = state.gameId === 'voxel-royale';
    const localId = options.localId ?? options.playerId;
    let cameraPlayer = options.viewPlayer ?? options.cameraPlayer ?? options.predictedPlayer ?? options.localPlayer ?? players.find(player => player.id === localId) ?? players.find(player => player.alive) ?? players[0];
    if (typeof cameraPlayer === 'string' || typeof cameraPlayer === 'number') cameraPlayer = players.find(player => player.id === cameraPlayer);
    if (!cameraPlayer) {
      const spawn = map.spawns?.[0]?.[0] || { x: 0, z: 0, yaw: 0 };
      cameraPlayer = { ...spawn, y: 0, alive: false };
    }
    const time = finite(options.time, typeof performance !== 'undefined' ? performance.now() : 0);
    const freshRound = Number.isFinite(state.round) && state.round !== this.effectRound;
    const setupTransition = state.phase !== this.effectPhase && ['lobby', 'countdown', 'buy'].includes(state.phase);
    if (map !== this.effectMap || state.gameId !== this.effectGameId || freshRound || setupTransition) this.resetEffects();
    this.mapId = map.id; this.effectMap = map; this.effectGameId = state.gameId; this.effectRound = state.round; this.effectPhase = state.phase;
    this._events(state, time, localId);
    const yaw = finite(options.aimYaw ?? options.yaw, finite(cameraPlayer.yaw));
    const pitch = clamp(finite(options.aimPitch ?? options.pitch, finite(cameraPlayer.pitch)), -1.48, 1.48);
    const eye = [finite(cameraPlayer.x), finite(cameraPlayer.y) + (cameraPlayer.crouching ? .98 : 1.62), finite(cameraPlayer.z)];
    const gl = this.gl;
    this._frameDrawCalls = 0; this._frameDynamicVertices = 0;
    this.resize();
    const aim = aimProgress(cameraPlayer), zoom = weaponAimFovRatio(cameraPlayer.weapon, ADS);
    const fov = clamp(finite(options.fov, 70), 55, 95) * lerp(1, zoom, aim) * Math.PI / 180;
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
    gl.uniform2fv(this.skyUniforms.scale, [tangent * this.aspect, tangent]); gl.drawArrays(gl.TRIANGLES, 0, 3); this._frameDrawCalls++;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uniforms.projection, false, projection); gl.uniformMatrix4fv(this.uniforms.view, false, view);
    gl.uniform3fv(this.uniforms.eye, eye); gl.uniform3fv(this.uniforms.fog, sky.slice(0, 3)); gl.uniform1f(this.uniforms.fogstrength, 1);
    const storm = freeForAll && state.storm?.active && [state.storm.x, state.storm.z, state.storm.radius].every(Number.isFinite) && state.storm.radius >= 0 ? state.storm : null;
    gl.uniform3fv(this.uniforms.stormcircle, storm ? [storm.x, storm.z, Math.min(storm.radius, 256)] : [0, 0, 256]);
    gl.uniform1f(this.uniforms.stormstrength, storm ? 1 : 0);
    gl.uniform3fv(this.uniforms.lightdirection, atmosphere.sun); gl.uniform3fv(this.uniforms.sun, atmosphere.direct); gl.uniform3fv(this.uniforms.ambient, atmosphere.ambient);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    const cached = this._getMap(map);
    this._mapVertices = cached.opaque.count + cached.shadows.count;
    this._draw(cached.opaque);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    this._draw(cached.shadows); gl.depthMask(true); gl.disable(gl.BLEND);
    const dynamic = new Mesh(), contacts = new Mesh(), local = players.find(player => player.id === localId) || cameraPlayer;
    for (const player of players) {
      if (!player.alive || player.id === cameraPlayer.id || !Number.isFinite(player.x) || !Number.isFinite(player.z)) continue;
      playerMesh(dynamic, player, map, time, !freeForAll && player.team === local.team, freeForAll);
      const support = surfaceBelow(map.colliders, player.x, player.z, finite(player.y) + .045);
      const ground = support ? support.y + support.h : 0;
      const altitude = Math.max(0, finite(player.y) - ground), spread = .26 + Math.min(.22, altitude * .08), opacity = .15 / (1 + altitude);
      for (let layer = 2; layer >= 0; layer--) {
        const size = spread + layer * .055;
        const minX = Math.max(player.x - size, support?.x ?? -Infinity), maxX = Math.min(player.x + size, support ? support.x + support.w : Infinity);
        const minZ = Math.max(player.z - size * .8, support?.z ?? -Infinity), maxZ = Math.min(player.z + size * .8, support ? support.z + support.d : Infinity);
        contacts.floor(minX, minZ, maxX - minX, maxZ - minZ, [.035, .055, .08, opacity], ground + .012 + (2 - layer) * .0003);
      }
    }
    this._lootItems = 0; this._stormVertices = 0;
    if (freeForAll) {
      const loot = lootMeshes(state.loot || [], time), boundary = stormMesh(storm);
      dynamic.append(loot.opaque); contacts.append(loot.contacts); contacts.append(boundary);
      this._lootItems = loot.count; this._stormVertices = boundary.length / VERTEX_STRIDE;
    }
    this._bomb(dynamic, state, players.filter(player => player.id !== cameraPlayer.id), time);
    this._grenades(dynamic, contacts, state, map, time);
    this._bolts(dynamic, state);
    for (const particle of this.particles) {
      const { point, size, fade } = particlePosition(particle, time, map.colliders);
      dynamic.box(point[0] - size / 2, point[1] - size / 2, point[2] - size / 2, size, size, size, shade(rgba(particle.color), .7 + fade * .3));
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
        const fade = 1 - clamp((time - trace.born) / finite(trace.life, 68), 0, 1);
        traces.line(start, trace.end, finite(trace.width, .009), rgba(trace.color || '#f5ce83', .42 * fade), eye);
      }
      gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false);
      this._draw(this._dynamic(traces.array, 'tracer'));
      gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    }
    const scoped = WEAPONS[cameraPlayer.weapon]?.scoped && aim >= smooth(14 / ADS.ticks);
    if (cameraPlayer.alive && cameraPlayer.id === localId && !options.hideWeapon && !scoped) {
      // Independent depth for the hands prevents flickering against a near
      // wall. World cover and hit detection continue using the real camera.
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.uniformMatrix4fv(this.uniforms.view, false, IDENTITY);
      gl.uniform3fv(this.uniforms.eye, [0, 0, 0]); gl.uniform1f(this.uniforms.fogstrength, 0);
      gl.uniform1f(this.uniforms.stormstrength, 0);
      // The hands use a stable soft key light so turning into map shade cannot
      // hide the weapon's sights or the magazine during a reload.
      gl.uniform3fv(this.uniforms.lightdirection, [-.30, .70, .62]); gl.uniform3fv(this.uniforms.sun, [.43, .43, .40]); gl.uniform3fv(this.uniforms.ambient, [.64, .68, .72]);
      this._draw(this._dynamic(this._viewModel(cameraPlayer, yaw, pitch, time, freeForAll), 'weapon'));
    }
    return true;
  }
  get stats() {
    return Object.freeze({ mapId: this.mapId, mapVertices: this._mapVertices, cachedMaps: this.mapCache.size, drawCalls: this._frameDrawCalls, dynamicVertices: this._frameDynamicVertices, lootItems: this._lootItems, stormVertices: this._stormVertices });
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
