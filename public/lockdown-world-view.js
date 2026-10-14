/** Small WebGL scene pass using the same vertex layout as Semag's voxel games.
 * Gameplay sprites are depth-tested against the real map, not sorted by tile row. */
import { lookAtMatrix, multiplyMatrices } from './solo/ember-voxel-camera.js';
import { GROUND } from './lockdown-scene-geometry.js';
import { VERTICAL } from './lockdown-world-mesh.js';
import { CAMERA_COS, CAMERA_SIN, viewToGround } from './lockdown-camera.js';

export function worldProjection(camera, width, height) {
  const w = width / camera.zoom, h = height / camera.zoom;
  const projection = new Float32Array([2 / w, 0, 0, 0, 0, 2 / h, 0, 0, 0, 0, -2 / 8000, 0, 0, 0, -1, 1]);
  const ground = viewToGround(camera.x, camera.y), target = [ground.x, 0, ground.y];
  const eye = [target[0] + 3000 * VERTICAL * CAMERA_SIN, 3000 * GROUND, target[2] + 3000 * VERTICAL * CAMERA_COS];
  return multiplyMatrices(projection, lookAtMatrix(eye, target));
}

const VERTEX = `
attribute vec3 aPosition; attribute vec3 aNormal; attribute vec4 aColor;
uniform mat4 uMatrix; varying vec3 vNormal; varying vec4 vColor; varying vec3 vWorld;
void main() { gl_Position=uMatrix*vec4(aPosition,1.); vNormal=aNormal; vColor=aColor; vWorld=aPosition; }`;
const FRAGMENT = `
precision mediump float; varying vec3 vNormal; varying vec4 vColor; varying vec3 vWorld;
uniform vec3 uFog;
void main() {
  float sun=max(0.,dot(normalize(vNormal),normalize(vec3(-.45,.82,.38))));
  vec3 lit=vColor.rgb*(vec3(.55,.62,.67)+sun*vec3(.48,.42,.32));
  float fog=clamp((-vWorld.y-12.)/650.,0.,.38);
  gl_FragColor=vec4(mix(lit,uFog,fog),vColor.a);
}`;
const SPRITE_VERTEX = `
attribute vec3 aPosition; attribute vec2 aUV; uniform mat4 uMatrix; varying vec2 vUV;
void main(){ gl_Position=uMatrix*vec4(aPosition,1.); vUV=aUV; }`;
const SPRITE_FRAGMENT = `
precision mediump float; varying vec2 vUV; uniform sampler2D uTexture; uniform float uAlpha;
void main(){ vec4 c=texture2D(uTexture,vUV); if(c.a<.035) discard; gl_FragColor=vec4(c.rgb,c.a*uAlpha); }`;

function program(gl, vs, fs) {
  const shaders = [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].map(([type, source]) => {
    const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  });
  const p = gl.createProgram(); for (const s of shaders) gl.attachShader(p, s); gl.linkProgram(p);
  for (const s of shaders) gl.deleteShader(s);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

export class LockdownWorldView {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.gl = this.canvas.getContext('webgl', { alpha: false, antialias: true, depth: true, preserveDrawingBuffer: false });
    if (!this.gl) throw new Error('3D graphics unavailable');
    this.atlas = document.createElement('canvas'); this.atlas.width = 1024; this.atlas.height = 1024;
    this.paint = this.atlas.getContext('2d'); this.maps = new Map(); this.lost = false;
    this.onLost = event => { event.preventDefault(); this.lost = true; };
    this.onRestored = () => { this.maps.clear(); this.createResources(); this.lost = false; };
    this.canvas.addEventListener('webglcontextlost', this.onLost);
    this.canvas.addEventListener('webglcontextrestored', this.onRestored);
    this.createResources();
  }
  createResources() {
    const gl = this.gl;
    this.solid = program(gl, VERTEX, FRAGMENT); this.sprite = program(gl, SPRITE_VERTEX, SPRITE_FRAGMENT);
    this.dynamic = gl.createBuffer(); this.spriteBuffer = gl.createBuffer(); this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.locations = new Map([this.solid, this.sprite].map(p => [p, {
      position: gl.getAttribLocation(p, 'aPosition'), normal: gl.getAttribLocation(p, 'aNormal'), color: gl.getAttribLocation(p, 'aColor'), uv: gl.getAttribLocation(p, 'aUV'),
      matrix: gl.getUniformLocation(p, 'uMatrix'), fog: gl.getUniformLocation(p, 'uFog'), alpha: gl.getUniformLocation(p, 'uAlpha'), texture: gl.getUniformLocation(p, 'uTexture'),
    }]));
  }
  begin(width, height) {
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    this.paint.setTransform(1, 0, 0, 1, 0, 0); this.paint.clearRect(0, 0, 1024, 1024);
    this.vertices = []; this.spriteCount = 0; this.ghost = null;
  }
  /** One 128-world-unit sprite, rendered at 2x resolution. Eight knights fit in
   * the first half of the atlas; offscreen actors need no texture upload work. */
  billboard(x, z, elevation, draw, local = false) {
    if (this.spriteCount >= 16) return false;
    const index = this.spriteCount++, sx = index % 4 * 256, sy = Math.floor(index / 4) * 256;
    const ctx = this.paint; ctx.save(); ctx.beginPath(); ctx.rect(sx + 1, sy + 1, 254, 254); ctx.clip();
    ctx.translate(sx + 128, sy + 208); ctx.scale(2, 2); draw(ctx); ctx.restore();
    const corner = (dx, dy) => [x + dx * CAMERA_COS, elevation + dy / VERTICAL, z - dx * CAMERA_SIN];
    const corners = [corner(-64, 104), corner(-64, -24), corner(64, -24), corner(64, 104)];
    const uv = [[sx / 1024, sy / 1024], [sx / 1024, (sy + 256) / 1024], [(sx + 256) / 1024, (sy + 256) / 1024], [(sx + 256) / 1024, sy / 1024]];
    const start = this.vertices.length / 5;
    for (const i of [0, 1, 2, 0, 2, 3]) this.vertices.push(...corners[i], ...uv[i]);
    if (local) this.ghost = { start, count: 6 };
    return true;
  }
  drawSolid(buffer, count, matrix, fog) {
    const gl = this.gl, loc = this.locations.get(this.solid); gl.useProgram(this.solid);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (const [id, size, offset] of [[loc.position, 3, 0], [loc.normal, 3, 12], [loc.color, 4, 24]]) {
      gl.enableVertexAttribArray(id); gl.vertexAttribPointer(id, size, gl.FLOAT, false, 40, offset);
    }
    gl.uniformMatrix4fv(loc.matrix, false, matrix); gl.uniform3fv(loc.fog, fog);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  }
  render(map, world, dynamic, camera) {
    if (this.lost) return false;
    const gl = this.gl, { width, height } = this.canvas, matrix = worldProjection(camera, width, height);
    const fog = [1, 3, 5].map(i => parseInt(world.style.sky.slice(i, i + 2), 16) / 255);
    gl.viewport(0, 0, width, height); gl.clearColor(...fog, 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.depthMask(true);
    if (!this.maps.has(map)) {
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, world.opaque, gl.STATIC_DRAW);
      this.maps.set(map, { buffer, count: world.opaque.length / 10 });
      while (this.maps.size > 3) { const [key, old] = this.maps.entries().next().value; gl.deleteBuffer(old.buffer); this.maps.delete(key); }
    }
    const cached = this.maps.get(map); this.drawSolid(cached.buffer, cached.count, matrix, fog);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dynamic); gl.bufferData(gl.ARRAY_BUFFER, dynamic, gl.DYNAMIC_DRAW);
    this.drawSolid(this.dynamic, dynamic.length / 10, matrix, fog);
    if (this.vertices.length) {
      const loc = this.locations.get(this.sprite); gl.useProgram(this.sprite);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.DYNAMIC_DRAW);
      // Disable stale solid attributes so their old pointers cannot read past
      // this smaller position/UV buffer on strict WebGL implementations.
      const solid = this.locations.get(this.solid); gl.disableVertexAttribArray(solid.normal); gl.disableVertexAttribArray(solid.color);
      gl.enableVertexAttribArray(loc.position); gl.vertexAttribPointer(loc.position, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(loc.uv); gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, 20, 12);
      gl.uniformMatrix4fv(loc.matrix, false, matrix); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlas); gl.uniform1i(loc.texture, 0);
      // A faint local silhouette keeps the controlled knight findable behind
      // tall architecture; other actors still obey normal depth occlusion.
      if (this.ghost) { gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.uniform1f(loc.alpha, .2); gl.drawArrays(gl.TRIANGLES, this.ghost.start, this.ghost.count); }
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.uniform1f(loc.alpha, 1); gl.drawArrays(gl.TRIANGLES, 0, this.vertices.length / 5);
    }
    this.stats = { mode: 'webgl', staticVertices: cached.count, dynamicVertices: dynamic.length / 10, sprites: this.spriteCount, cachedMaps: this.maps.size };
    return true;
  }
  destroy() {
    const gl = this.gl;
    for (const { buffer } of this.maps.values()) gl.deleteBuffer(buffer);
    for (const buffer of [this.dynamic, this.spriteBuffer]) gl.deleteBuffer(buffer);
    gl.deleteTexture(this.texture); gl.deleteProgram(this.solid); gl.deleteProgram(this.sprite); this.maps.clear();
    this.canvas.removeEventListener('webglcontextlost', this.onLost); this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
  }
}
