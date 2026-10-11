import { buildEmberRoomMesh, buildEmberActorMesh, buildEmberActorGeometry } from '../art/ember-voxel-models.js';
import { EmberVoxelCamera, groundAimDirection, lookAtMatrix, perspectiveMatrix, multiplyMatrices } from './ember-voxel-camera.js';

const STRIDE = 9, MAX_PARTICLES = 144, MAX_TRAILS = 6, MAX_ROOM_CACHE = 3, MAX_CORPSES = 8;
const TAU = Math.PI * 2;
const BOX_FACES = [
  [1, 0, 0, 1, 3, 7, 1, 7, 5], [-1, 0, 0, 4, 6, 2, 4, 2, 0],
  [0, 1, 0, 2, 6, 7, 2, 7, 3], [0, -1, 0, 4, 0, 1, 4, 1, 5],
  [0, 0, 1, 5, 7, 6, 5, 6, 4], [0, 0, -1, 0, 2, 3, 0, 3, 1],
];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const THEMES = [
  { fog: [.025, .066, .054], ambient: [.31, .40, .33], direct: [.63, .58, .42], torch: [1, .49, .13] },
  { fog: [.024, .040, .075], ambient: [.30, .39, .49], direct: [.52, .67, .74], torch: [.27, .77, 1] },
  { fog: [.073, .025, .023], ambient: [.44, .32, .28], direct: [.78, .49, .31], torch: [1, .28, .065] },
];

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform mat4 uViewProjection;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vColor;
void main() { vPosition=aPosition; vNormal=aNormal; vColor=aColor; gl_Position=uViewProjection*vec4(aPosition,1.0); }
`;
const FRAGMENT_SHADER = `
precision mediump float;
uniform vec3 uEye;
uniform vec3 uFog;
uniform vec3 uAmbient;
uniform vec3 uDirect;
uniform vec3 uTorch;
uniform float uTime;
uniform float uGlow;
uniform float uAlpha;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vColor;
void main() {
 vec3 n=normalize(vNormal);
 float directional=max(0.0,dot(n,normalize(vec3(-.44,.83,-.36))));
 vec3 lighting=uAmbient+uDirect*directional;
 vec3 lights[4]; lights[0]=vec3(1.75,2.5,4.0);lights[1]=vec3(28.25,2.5,16.0);lights[2]=vec3(15.0,2.8,1.7);lights[3]=vec3(15.0,2.8,18.3);
 for(int i=0;i<4;i++){vec3 delta=lights[i]-vPosition;float d=length(delta);float facing=max(.15,dot(n,normalize(delta)));lighting+=uTorch*facing/(1.0+d*d*.18)*(.69+.025*sin(uTime*7.0+float(i)*3.0));}
 vec3 color=vColor*lighting+vColor*uGlow;
 float rim=pow(1.0-max(0.0,dot(n,normalize(uEye-vPosition))),3.0);color+=vColor*rim*.075;
 float fog=smoothstep(15.0,43.0,length(uEye-vPosition));
 gl_FragColor=vec4(mix(color,uFog,fog*.8),uAlpha);
}
`;

function shader(gl, type, source) {
  const result = gl.createShader(type); gl.shaderSource(result, source); gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) { const message = gl.getShaderInfoLog(result); gl.deleteShader(result); throw new Error(message || 'Voxel shader compilation failed'); }
  return result;
}
function createProgram(gl) {
  const vertex = shader(gl, gl.VERTEX_SHADER, VERTEX_SHADER), fragment = shader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER), program = gl.createProgram();
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { const message = gl.getProgramInfoLog(program); gl.deleteProgram(program); throw new Error(message || 'Voxel shader linking failed'); }
  return program;
}

/** An allocation-reused writer for the short-lived combat mesh. */
export class EmberEffectMesh {
  constructor(capacity = 8192) { this.vertices = new Float32Array(capacity); this.length = 0; }
  clear() { this.length = 0; return this; }
  reserve(size) {
    if (this.length + size <= this.vertices.length) return;
    let capacity = this.vertices.length; while (capacity < this.length + size) capacity *= 2;
    const replacement = new Float32Array(capacity); replacement.set(this.vertices); this.vertices = replacement;
  }
  triangle(a, b, c, color) {
    this.reserve(27);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const length = Math.hypot(nx, ny, nz) || 1; nx /= length; ny /= length; nz /= length;
    for (const point of [a, b, c]) {
      const out = this.vertices; let i = this.length;
      out[i++] = point[0]; out[i++] = point[1]; out[i++] = point[2]; out[i++] = nx; out[i++] = ny; out[i++] = nz; out[i++] = color[0]; out[i++] = color[1]; out[i++] = color[2]; this.length = i;
    }
  }
  quad(a, b, c, d, color) { this.triangle(a, b, c, color); this.triangle(a, c, d, color); }
  box(x, y, z, width, height, depth, color) {
    this.reserve(324); const out = this.vertices; let i = this.length;
    for (const face of BOX_FACES) for (let corner = 3; corner < 9; corner++) {
      const bits = face[corner];
      out[i++] = x + (bits & 1 ? .5 : -.5) * width; out[i++] = y + (bits & 2 ? height : 0); out[i++] = z + (bits & 4 ? .5 : -.5) * depth;
      out[i++] = face[0]; out[i++] = face[1]; out[i++] = face[2]; out[i++] = color[0]; out[i++] = color[1]; out[i++] = color[2];
    }
    this.length = i;
  }
  ring(x, z, radius, width, color, { y = .028, from = 0, to = TAU, dashed = false, segments = 48 } = {}) {
    const inner = Math.max(.01, radius - width / 2), outer = radius + width / 2;
    const point = (angle, distance) => [x + Math.cos(angle) * distance, y, z + Math.sin(angle) * distance];
    for (let i = 0; i < segments; i++) {
      if (dashed && i % 4 === 3) continue;
      const a = from + (to - from) * i / segments, b = from + (to - from) * (i + 1) / segments;
      this.quad(point(a, inner), point(b, inner), point(b, outer), point(a, outer), color);
    }
  }
  line(x, z, ex, ez, width, color, y = .03) {
    const length = Math.hypot(ex - x, ez - z); if (length < .001) return;
    const nx = -(ez - z) / length * width / 2, nz = (ex - x) / length * width / 2;
    this.quad([x + nx, y, z + nz], [ex + nx, y, ez + nz], [ex - nx, y, ez - nz], [x - nx, y, z - nz], color);
  }
  get data() { return this.vertices.subarray(0, this.length); }
}

/** Telegraph dimensions are the actual committed engine attack footprints. */
export function appendEmberTelegraphs(mesh, state) {
  for (const enemy of state.enemies || []) {
    if (enemy.phase !== 'tell') continue;
    const x = enemy.x / 32, z = enemy.y / 32, angle = Math.atan2(enemy.aimY, enemy.aimX), color = enemy.tell === 'summon' ? [.35, .90, .79] : [1, .52, .16];
    const progress = clamp(1 - enemy.timer / (enemy.tellDuration || 1), 0, 1);
    if (enemy.tell === 'charge') {
      const reach = (enemy.chargeSpeed ?? 450) * (enemy.chargeDuration ?? .42) / 32, half = (enemy.radius + 10) / 32;
      const fx = Math.cos(angle), fz = Math.sin(angle), ex = x + fx * reach, ez = z + fz * reach;
      for (const side of [-1, 1]) mesh.line(x - fz * half * side, z + fx * half * side, ex - fz * half * side, ez + fx * half * side, .055, color);
      mesh.line(ex - fz * half, ez + fx * half, ex + fz * half, ez - fx * half, .07, color);
      for (let i = 1; i <= 4; i++) {
        const distance = reach * i / 5, cx = x + fx * distance, cz = z + fz * distance;
        mesh.line(cx - fx * .22 - fz * .19, cz - fz * .22 + fx * .19, cx + fx * .22, cz + fz * .22, .045, color);
        mesh.line(cx - fx * .22 + fz * .19, cz - fz * .22 - fx * .19, cx + fx * .22, cz + fz * .22, .045, color);
      }
    } else if (enemy.tell === 'fan') {
      const count = enemy.fanCount ?? (enemy.boss ? 7 : 3), spread = enemy.fanSpread ?? (enemy.boss ? .16 : .14);
      for (let i = 0; i < count; i++) {
        const a = angle + (i - (count - 1) / 2) * spread;
        mesh.line(x, z, x + Math.cos(a) * 230 / 32, z + Math.sin(a) * 230 / 32, .028 + progress * .025, color);
      }
    } else if (enemy.tell === 'fault' || enemy.tell === 'summon') {
      for (const target of enemy.targets || []) {
        mesh.ring(target.x / 32, target.y / 32, target.radius / 32, .065, color, { dashed: true });
        mesh.ring(target.x / 32, target.y / 32, target.radius / 32 + .10, .09, color, { from: -Math.PI / 2, to: -Math.PI / 2 + TAU * progress, y: .037 });
        mesh.line(target.x / 32 - .20, target.y / 32, target.x / 32 + .20, target.y / 32, .045, color);
        mesh.line(target.x / 32, target.y / 32 - .20, target.x / 32, target.y / 32 + .20, .045, color);
      }
    } else {
      const radius = enemy.tell === 'sweep' ? (enemy.boss ? 150 : 80) / 32 : enemy.tell === 'ring' ? 62 / 32 : 40 / 32;
      mesh.ring(x, z, radius, .06, color, { dashed: true });
      mesh.ring(x, z, radius + .08, .09, color, { from: angle - Math.PI, to: angle - Math.PI + TAU * progress, y: .04 });
    }
  }
  for (const effect of state.effects || []) if (effect.kind === 'fault') {
    const x = effect.x / 32, z = effect.y / 32, radius = effect.radius / 32;
    mesh.ring(x, z, radius, .11, [1, .78, .34]);
    for (let i = 0; i < 8; i++) {
      const angle = i * TAU / 8;
      mesh.line(x + Math.cos(angle) * .25, z + Math.sin(angle) * .25, x + Math.cos(angle + .14) * radius, z + Math.sin(angle + .14) * radius, .09, [1, .35, .10]);
      mesh.box(x + Math.cos(angle) * radius * .55, .02, z + Math.sin(angle) * radius * .55, .14, .4 * effect.life / .3, .14, [1, .43, .16]);
    }
  }
  return mesh;
}

function ensureMesh(mesh) {
  const vertices = mesh?.vertices || mesh;
  if (!(vertices instanceof Float32Array) || vertices.length % STRIDE) throw new Error('Ember voxel meshes require position, normal and color vertices');
  return vertices;
}

export class EmberVoxelRenderer {
  constructor(canvas) {
    this.canvas = canvas; this.available = false; this.error = null; this.destroyed = false; this.contextLost = false;
    this.camera = new EmberVoxelCamera(); this.roomCache = new Map(); this.effectMesh = new EmberEffectMesh(); this.shadowMesh = new EmberEffectMesh();
    this.particles = []; this.trails = []; this.corpses = []; this.actorHistory = new Map(); this.gaitById = new Map(); this.walkingById = new Map(); this.enemyYawById = new Map();
    this.lastEvent = 0; this.lastTime = null; this.currentRoom = null; this.frameCount = 0; this.staticBuilds = 0; this.roomVertices = 0; this.actorVertices = 0; this.effectVertices = 0; this.pose = null;
    this.onLost = event => { event.preventDefault(); this.contextLost = true; this.available = false; this.error = 'Graphics context paused. Return to the hub and reopen Ember Delve.'; };
    canvas.addEventListener('webglcontextlost', this.onLost);
    try {
      const gl = this.gl = canvas.getContext('webgl', { alpha: false, antialias: true, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
      if (!gl) throw new Error('WebGL is unavailable in this browser. Enable hardware acceleration to enter the dungeon.');
      this.program = createProgram(gl);
      this.attributes = Object.fromEntries(['Position', 'Normal', 'Color'].map(name => [name, gl.getAttribLocation(this.program, `a${name}`)]));
      this.uniforms = Object.fromEntries(['ViewProjection', 'Eye', 'Fog', 'Ambient', 'Direct', 'Torch', 'Time', 'Glow', 'Alpha'].map(name => [name, gl.getUniformLocation(this.program, `u${name}`)]));
      this.actorBuffer = gl.createBuffer(); this.effectBuffer = gl.createBuffer(); this.shadowBuffer = gl.createBuffer();
      this.dynamicCapacity = new Map(); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); this.available = true; this.resize();
    } catch (error) { this.error = error.message || 'Unable to open the voxel dungeon.'; this.available = false; }
  }
  resize() {
    if (!this.available || this.destroyed) return;
    const rectangle = this.canvas.getBoundingClientRect();
    const baseWidth = rectangle.width || this.canvas.clientWidth || 960, baseHeight = rectangle.height || this.canvas.clientHeight || 640;
    const ratio = Math.min(1.7, finite(globalThis.devicePixelRatio, 1), 1920 / baseWidth, 1200 / baseHeight);
    const width = Math.max(1, Math.round(baseWidth * ratio)), height = Math.max(1, Math.round(baseHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    this.gl.viewport(0, 0, width, height);
  }
  upload(buffer, vertices, dynamic = true) {
    const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (dynamic) {
      const capacity = this.dynamicCapacity.get(buffer) || 0;
      if (capacity < vertices.byteLength) { const bytes = Math.max(4096, 2 ** Math.ceil(Math.log2(vertices.byteLength || 1))); gl.bufferData(gl.ARRAY_BUFFER, bytes, gl.DYNAMIC_DRAW); this.dynamicCapacity.set(buffer, bytes); }
      if (vertices.byteLength) gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices);
    } else gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }
  draw(buffer, count, glow = 0, alpha = 1) {
    if (!count) return;
    const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (const [name, offset] of [['Position', 0], ['Normal', 12], ['Color', 24]]) { const index = this.attributes[name]; gl.enableVertexAttribArray(index); gl.vertexAttribPointer(index, 3, gl.FLOAT, false, STRIDE * 4, offset); }
    gl.uniform1f(this.uniforms.Glow, glow); gl.uniform1f(this.uniforms.Alpha, alpha); gl.drawArrays(gl.TRIANGLES, 0, count); this.drawCalls++;
  }
  resetPresentation() {
    this.particles.length = 0; this.trails.length = 0; this.corpses.length = 0; this.actorHistory.clear(); this.gaitById.clear(); this.walkingById.clear(); this.enemyYawById.clear(); this.lastEvent = 0; this.camera.reset();
  }
  presentActors(state, time, reducedMotion) {
    const actors = [['hero', state.player], ...state.enemies.map(enemy => [enemy.id, enemy])], live = new Set();
    for (const [id, actor] of actors) {
      live.add(id); const previous = this.actorHistory.get(id); const delta = previous ? time - previous.time : 0;
      const travel = previous && delta > 0 && delta < .1 ? Math.hypot(actor.x - previous.x, actor.y - previous.y) / 32 : 0;
      const walk = travel > .0005 && travel < 1.0;
      const phase = reducedMotion ? 0 : finite(this.gaitById.get(id)) + (walk ? travel * TAU / (actor.boss ? 1.8 : 1.20) : 0);
      this.gaitById.set(id, phase % TAU); this.walkingById.set(id, walk);
      const aimX = finite(actor.aimX, 1), aimY = finite(actor.aimY);
      if (id !== 'hero') this.enemyYawById.set(id, Math.atan2(aimX, -aimY));
      // A repeated paused frame retains its gait and grounded foot stance.
      if (delta === 0 && previous) this.walkingById.set(id, previous.walking);
      this.actorHistory.set(id, { x: actor.x, y: actor.y, time, walking: this.walkingById.get(id), kind: actor.type || 'hero', boss: actor.boss === true, yaw: Math.atan2(aimX, -aimY) });
    }
    for (const id of this.actorHistory.keys()) if (!live.has(id)) { this.actorHistory.delete(id); this.gaitById.delete(id); this.walkingById.delete(id); this.enemyYawById.delete(id); }
  }
  presentEvents(state, time, reducedMotion) {
    for (const event of state.events || []) {
      if (event.id <= this.lastEvent) continue; this.lastEvent = event.id;
      const age = time - event.time; if (age < -.1 || age > .85) continue;
      const x = event.x / 32, z = event.y / 32;
      if (event.type === 'swing') this.trails.push({ x, z, angle: Math.atan2(state.player.aimY, state.player.aimX), time: event.time, empowered: state.player.empowered > 0 });
      if (event.type === 'kill' && !reducedMotion) {
        const live = new Set(state.enemies.map(e => e.id)), claimed = new Set(this.corpses.map(body => body.id));
        const candidates = [...this.actorHistory].filter(([id]) => id !== 'hero' && !live.has(id) && !claimed.has(id));
        candidates.sort((a, b) => Math.hypot(a[1].x - event.x, a[1].y - event.y) - Math.hypot(b[1].x - event.x, b[1].y - event.y));
        const selected = candidates[0];
        if (selected) { const [id, actor] = selected; const body = { ...actor, x, z, act: state.act, time: event.time, id }; body.mesh = ensureMesh(buildEmberActorGeometry({ kind: body.kind, x, z, yaw: body.yaw, boss: body.boss, act: state.act })); this.corpses.push(body); }
      }
      if (!['hit', 'kill', 'hurt', 'perfect', 'impact', 'dash', 'cast', 'clear'].includes(event.type)) continue;
      const color = event.type === 'hurt' ? [.96, .22, .14] : event.type === 'perfect' ? [.36, .96, .81] : event.type === 'kill' ? [.92, .48, .19] : [1, .77, .34];
      const count = reducedMotion ? 2 : event.type === 'kill' ? event.boss ? 28 : 18 : event.type === 'clear' ? 20 : 6;
      for (let i = 0; i < count; i++) {
        const a = event.id * 2.399 + i * TAU / count, speed = event.type === 'kill' ? 1.8 + (i % 4) * .6 : 1.0 + (i % 3) * .5;
        this.particles.push({ x, z, y: event.type === 'kill' ? event.boss ? 1.6 : .7 : .82, vx: reducedMotion ? 0 : Math.cos(a) * speed, vz: reducedMotion ? 0 : Math.sin(a) * speed, vy: reducedMotion ? 0 : 1.5 + i % 5 * .36, color, size: event.type === 'kill' ? .14 + i % 3 * .03 : .075, time: event.time, life: reducedMotion ? .13 : event.type === 'kill' ? .72 : .35 });
      }
    }
    this.particles = this.particles.filter(p => time - p.time < p.life && time >= p.time - .05).slice(-MAX_PARTICLES);
    this.trails = this.trails.filter(p => time - p.time < .22).slice(-MAX_TRAILS);
    this.corpses = this.corpses.filter(body => time - body.time < .42).slice(-MAX_CORPSES);
  }
  appendCorpses(actors, time) {
    if (!this.corpses.length) return actors;
    const required = actors.length + this.corpses.reduce((sum, body) => sum + body.mesh.length, 0);
    if (!this.corpseVertices || this.corpseVertices.length < required) this.corpseVertices = new Float32Array(2 ** Math.ceil(Math.log2(required)));
    const vertices = this.corpseVertices; vertices.set(actors); let offset = actors.length;
    for (const body of this.corpses) {
      const progress = clamp((time - body.time) / .42, 0, 1), angle = progress * 1.35, c = Math.cos(angle), s = Math.sin(angle), cx = Math.cos(body.yaw), sz = Math.sin(body.yaw);
      const rotate = (x, y, z) => { const along = cx * x + sz * z, fwd = -sz * x + cx * z, vertical = y * c - fwd * s, front = y * s + fwd * c; return [along * cx - front * sz, vertical, along * sz + front * cx]; };
      for (let i = 0; i < body.mesh.length; i += STRIDE) {
        const position = rotate(body.mesh[i] - body.x, body.mesh[i + 1], body.mesh[i + 2] - body.z), normal = rotate(body.mesh[i + 3], body.mesh[i + 4], body.mesh[i + 5]);
        vertices.set([position[0] + body.x, Math.max(.027, position[1]), position[2] + body.z, ...normal, body.mesh[i + 6] * (1 - progress * .65), body.mesh[i + 7] * (1 - progress * .65), body.mesh[i + 8] * (1 - progress * .65)], offset); offset += STRIDE;
      }
    }
    return vertices.subarray(0, required);
  }
  buildCombatMesh(state, time, reducedMotion) {
    const mesh = this.effectMesh.clear(); appendEmberTelegraphs(mesh, state);
    for (const shot of state.projectiles || []) {
      const speed = Math.hypot(shot.vx, shot.vy) || 1, x = shot.x / 32, z = shot.y / 32, dx = shot.vx / speed, dz = shot.vy / speed;
      const color = shot.owner === 'player' ? [1, .81, .38] : [1, .29, .14], length = shot.owner === 'player' ? .65 : .43;
      mesh.line(x - dx * length, z - dz * length, x + dx * .10, z + dz * .10, .10, color, .84);
      mesh.box(x, .77, z, .16, .16, .16, [1, .91, .65]);
    }
    for (const trail of this.trails) {
      const age = Math.max(0, time - trail.time), progress = clamp(age / .15, 0, 1), end = trail.angle - 1.18 + progress * 2.36, start = Math.max(trail.angle - 1.18, end - (reducedMotion ? .32 : 1.25));
      const radius = 96 / 32, width = .13 * (1 - age / .22), color = [1, .78 + .14 * (1 - progress), .35];
      mesh.ring(trail.x, trail.z, radius, width, color, { from: start, to: end, y: .94, segments: 28 });
      mesh.ring(trail.x, trail.z, radius * .94, width * .42, [1, .96, .68], { from: start + .1, to: end, y: 1.02, segments: 24 });
      if (age < .15) mesh.line(trail.x + Math.cos(end) * 1.1, trail.z + Math.sin(end) * 1.1, trail.x + Math.cos(end) * radius, trail.z + Math.sin(end) * radius, .045, [1, .91, .58], .98);
    }
    for (const particle of this.particles) {
      const age = Math.max(0, time - particle.time), weight = clamp(1 - age / particle.life, 0, 1), size = particle.size * Math.max(.2, weight);
      const y = Math.max(.026, particle.y + particle.vy * age - (reducedMotion ? 0 : 5.2 * age * age));
      mesh.box(particle.x + particle.vx * age, y, particle.z + particle.vz * age, size, size, size, particle.color);
    }
    // The reticle is a world-ground aim marker, not a screen-fixed fake weapon.
    const p = state.player;
    if (p.hp > 0 && state.phase === 'playing') {
      const ax = p.x / 32 + p.aimX * 3.0, az = p.y / 32 + p.aimY * 3.0;
      mesh.ring(ax, az, .16, .027, [.76, .94, .80], { segments: 12 });
    }
    return mesh.data;
  }
  buildShadowMesh(state) {
    const mesh = this.shadowMesh.clear();
    for (const body of [state.player, ...state.enemies]) {
      const radius = body.boss ? .72 : body.type === 'crawler' ? .47 : .42, x = body.x / 32, z = body.y / 32;
      for (let i = 0; i < 16; i++) {
        const a = i * TAU / 16, b = (i + 1) * TAU / 16;
        mesh.triangle([x, .019, z], [x + Math.cos(a) * radius, .019, z + Math.sin(a) * radius * .7], [x + Math.cos(b) * radius, .019, z + Math.sin(b) * radius * .7], [.015, .023, .022]);
      }
    }
    const right = [Math.cos(this.pose.yaw), 0, Math.sin(this.pose.yaw)];
    for (const enemy of state.enemies) {
      const x = enemy.x / 32, z = enemy.y / 32, y = enemy.boss ? 3.25 : enemy.type === 'crawler' ? 1.25 : 2.10, width = enemy.boss ? 1.65 : .75;
      const point = (h, v) => [x + right[0] * h, y + v, z + right[2] * h];
      mesh.quad(point(-width / 2 - .04, -.045), point(width / 2 + .04, -.045), point(width / 2 + .04, .075), point(-width / 2 - .04, .075), [.05, .055, .06]);
      const end = -width / 2 + width * clamp(enemy.hp / enemy.maxHp, 0, 1);
      // Offset toward the camera prevents the bar fighting its own backdrop.
      const color = enemy.slow > 0 ? [.40, .78, .96] : enemy.burn > 0 ? [1, .45, .16] : [.94, .62, .29];
      const raised = (h, v) => { const p = point(h, v); p[0] += Math.sin(this.pose.yaw) * -.006; p[2] += Math.cos(this.pose.yaw) * .006; return p; };
      mesh.quad(raised(-width / 2, -.02), raised(end, -.02), raised(end, .048), raised(-width / 2, .048), color);
    }
    return mesh.data;
  }
  render(state, { yaw = 0, pitch = .32, time = state.elapsed, reducedMotion = false } = {}) {
    if (!this.available || this.destroyed || !state?.room || !state.player) return false;
    time = finite(time, state.elapsed);
    if (state.phase !== 'playing') time = finite(state.elapsed, time);
    if (this.currentRoom !== state.room.id || this.currentSeed !== state.seed || state.eventId < this.lastEvent || this.lastTime !== null && time < this.lastTime - .01) this.resetPresentation();
    this.currentRoom = state.room.id; this.currentSeed = state.seed; this.lastTime = time; this.drawCalls = 0;
    this.lastPlayer = { x: state.player.x, y: state.player.y };
    const gl = this.gl, theme = THEMES[clamp(state.act - 1, 0, 2)]; this.resize();
    this.pose = this.camera.update(state, { yaw, pitch, time });
    this.presentEvents(state, time, reducedMotion); this.presentActors(state, time, reducedMotion);
    const key = `${state.act}:${state.room.id}:${state.room.obstacles.map(o => `${o.x},${o.y},${o.width},${o.height}`).join(';')}`;
    let room = this.roomCache.get(key);
    if (!room) {
      const vertices = ensureMesh(buildEmberRoomMesh(state, { reducedMotion })); const buffer = gl.createBuffer(); this.upload(buffer, vertices, false);
      room = { buffer, count: vertices.length / STRIDE }; this.roomCache.set(key, room); this.staticBuilds++;
      if (this.roomCache.size > MAX_ROOM_CACHE) { const oldest = this.roomCache.keys().next().value; gl.deleteBuffer(this.roomCache.get(oldest).buffer); this.roomCache.delete(oldest); }
    }
    this.heroVisible = this.pose.collisionDistance >= .68;
    const actors = this.appendCorpses(ensureMesh(buildEmberActorMesh(state, time, { reducedMotion, hideHero: !this.heroVisible, gaitById: this.gaitById, walkingById: this.walkingById, enemyYawById: this.enemyYawById })), time);
    const effects = this.buildCombatMesh(state, time, reducedMotion), shadows = this.buildShadowMesh(state);
    this.upload(this.actorBuffer, actors); this.upload(this.effectBuffer, effects); this.upload(this.shadowBuffer, shadows);
    gl.clearColor(...theme.fog, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.useProgram(this.program);
    const matrix = multiplyMatrices(perspectiveMatrix(this.canvas.width / this.canvas.height), lookAtMatrix(this.pose.eye, this.pose.target));
    gl.uniformMatrix4fv(this.uniforms.ViewProjection, false, matrix); gl.uniform3fv(this.uniforms.Eye, this.pose.eye);
    for (const [name, value] of [['Fog', theme.fog], ['Ambient', theme.ambient], ['Direct', theme.direct], ['Torch', theme.torch]]) gl.uniform3fv(this.uniforms[name], value);
    gl.uniform1f(this.uniforms.Time, reducedMotion ? 0 : time); gl.disable(gl.BLEND); gl.depthMask(true);
    this.draw(room.buffer, room.count); this.draw(this.shadowBuffer, shadows.length / STRIDE, 0); this.draw(this.actorBuffer, actors.length / STRIDE, .10);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false); this.draw(this.effectBuffer, effects.length / STRIDE, .90, .84); gl.depthMask(true); gl.disable(gl.BLEND);
    this.frameCount++; this.roomVertices = room.count; this.actorVertices = actors.length / STRIDE; this.effectVertices = effects.length / STRIDE;
    return true;
  }
  getCenterAimDirection(state, { yaw = 0, pitch = .32 } = {}) {
    if (!this.pose || Math.abs(this.pose.yaw - yaw) + Math.abs(this.pose.pitch - pitch) > .00001) this.pose = this.camera.update(state, { yaw, pitch, time: state.elapsed });
    return groundAimDirection(0, 0, state.player, this.pose, this.canvas.width / Math.max(1, this.canvas.height), .84);
  }
  screenGroundDirection(clientX, clientY, state, { yaw = 0, pitch = .32, rectangle: cachedRectangle } = {}) {
    const rectangle = cachedRectangle || this.canvas.getBoundingClientRect();
    if (!this.pose || Math.abs(this.pose.yaw - yaw) + Math.abs(this.pose.pitch - pitch) > .00001) this.pose = this.camera.update(state, { yaw, pitch, time: state.elapsed });
    const pose = this.pose;
    const x = (clientX - rectangle.left) / Math.max(1, rectangle.width) * 2 - 1, y = 1 - (clientY - rectangle.top) / Math.max(1, rectangle.height) * 2;
    return groundAimDirection(x, y, state.player, pose, Math.max(1, rectangle.width) / Math.max(1, rectangle.height), .84);
  }
  get diagnostics() {
    return { available: this.available, error: this.error, backend: this.available ? 'webgl' : 'unavailable', frames: this.frameCount, staticBuilds: this.staticBuilds, roomCache: this.roomCache.size, gpuBuffers: this.available ? this.roomCache.size + 3 : 0, drawCalls: this.drawCalls || 0, roomVertices: this.roomVertices, actorVertices: this.actorVertices, effectVertices: this.effectVertices, particles: this.particles.length, trails: this.trails.length, corpses: this.corpses.length, actors: this.actorHistory.size, heroVisible: this.heroVisible ?? false, projectileHeight: .84, centerAimDirection: this.pose && this.lastPlayer ? groundAimDirection(0, 0, this.lastPlayer, this.pose, this.canvas.width / Math.max(1, this.canvas.height), .84) : null, renderPixels: [this.canvas.width, this.canvas.height], camera: this.pose ? { eye: [...this.pose.eye], target: [...this.pose.target], yaw: this.pose.yaw, pitch: this.pose.pitch, collisionDistance: this.pose.collisionDistance } : null };
  }
  destroy() {
    if (this.destroyed) return; this.destroyed = true; this.available = false; this.canvas.removeEventListener('webglcontextlost', this.onLost);
    if (this.gl) { for (const room of this.roomCache.values()) this.gl.deleteBuffer(room.buffer); for (const buffer of [this.actorBuffer, this.effectBuffer, this.shadowBuffer]) if (buffer) this.gl.deleteBuffer(buffer); if (this.program) this.gl.deleteProgram(this.program); }
    this.roomCache.clear(); this.dynamicCapacity?.clear(); this.resetPresentation(); this.corpseVertices = null;
  }
}
