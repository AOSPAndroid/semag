/** Armory inspection draws the game's actual meshes, only when requested.
 * The renderer and its geometry dependencies are loaded when an inspection opens.
 * Cards use pre-rendered images and never allocate a WebGL context.
 */
let geometryPromise;
const activeCanvases = new WeakSet();
const resources = { activeContexts: 0, contextsCreated: 0, contextsReleased: 0, drawCalls: 0 };
/** Read-only lifecycle counters for checking that closed inspections are idle. */
export const armoryPreviewDiagnostics = Object.freeze(Object.defineProperties({}, Object.fromEntries(Object.keys(resources).map(key => [key, {
  enumerable: true, get: () => resources[key],
}]))));
const loadGeometry = () => geometryPromise ||= Promise.all([
  import('./voxel-renderer.js'), import('./voxel-weapons.js'), import('./voxel-melee.js'),
]).then(([renderer, guns, melee]) => ({ weaponMeshes: renderer.weaponMeshes, meleeMeshes: renderer.meleeMeshes,
  WEAPONS: guns.WEAPONS, MELEE_WEAPONS: melee.MELEE_WEAPONS }));

const DEFAULT_VIEW = Object.freeze({
  gun: Object.freeze({ yaw: 1.18, pitch: .18, roll: -.075 }),
  melee: Object.freeze({ yaw: 1.38, pitch: .91, roll: -.035 }),
});
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const VERTEX_SOURCE = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute vec4 aColor;
  uniform mat3 uRotation;
  uniform vec3 uCenter;
  uniform vec2 uExtent;
  varying vec3 vNormal;
  varying vec4 vColor;
  void main() {
    vec3 p = uRotation * (aPosition - uCenter);
    gl_Position = vec4(p.xy / uExtent, -p.z / 8.0, 1.0);
    vNormal = uRotation * aNormal;
    vColor = aColor;
  }
`;
const FRAGMENT_SOURCE = `
  precision mediump float;
  varying vec3 vNormal;
  varying vec4 vColor;
  void main() {
    vec3 n = normalize(vNormal);
    float key = max(0.0, dot(n, normalize(vec3(-0.45, 0.8, 0.7))));
    float fill = max(0.0, dot(n, normalize(vec3(0.8, 0.1, 0.4))));
    vec3 light = vec3(0.69) + key * vec3(0.48, 0.46, 0.40) + fill * vec3(0.10, 0.14, 0.19);
    gl_FragColor = vec4(vColor.rgb * light, vColor.a);
  }
`;

// Column-major rotation for yaw, then pitch, then a subtle presentation roll.
function rotation({ yaw, pitch, roll }) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  return new Float32Array([
    cr * cy - sr * sp * sy, sr * cy + cr * sp * sy, -cp * sy,
    -sr * cp, cr * cp, sp,
    cr * sy + sr * sp * cy, sr * sy - cr * sp * cy, cp * cy,
  ]);
}

/**
 * @returns {Promise<{setWeapon: Function, resize: Function, reset: Function, destroy: Function}>}
 * Arrow keys and dragging orbit the mesh; Home or 0 restores its display angle.
 * reducedMotion is accepted for callers' accessibility settings. There is no
 * automatic motion in either mode, and no requestAnimationFrame or timer loop.
 * sceneWidth/pixelRatio/preserveDrawingBuffer are also used by the art generator.
 */
export async function createWeaponPreview(canvas, options = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('A canvas is required to inspect a weapon.');
  const geometry = await loadGeometry();
  let weaponId = options.weaponId, kind = options.kind || 'gun';
  const validate = (id, type) => {
    const catalog = type === 'gun' ? geometry.WEAPONS : type === 'melee' ? geometry.MELEE_WEAPONS : null;
    if (!catalog || !Object.hasOwn(catalog, id)) throw new RangeError('Choose a weapon from the Armory.');
  };
  validate(weaponId, kind);
  if (activeCanvases.has(canvas)) throw new Error('This weapon inspection is already open.');
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: options.preserveDrawingBuffer === true });
  if (!gl) throw new Error('Interactive inspection is unavailable on this device.');
  activeCanvases.add(canvas); resources.activeContexts++; resources.contextsCreated++;
  let destroyed = false, failed = false, buffer, program, observer, pointer;
  const shaders = [], listeners = [];
  let vertices, count = 0, center, view = { ...DEFAULT_VIEW[kind] };
  const listen = (type, fn) => { canvas.addEventListener(type, fn); listeners.push([type, fn]); };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    observer?.disconnect();
    for (const [type, fn] of listeners) canvas.removeEventListener(type, fn);
    if (pointer && canvas.hasPointerCapture?.(pointer.id)) canvas.releasePointerCapture(pointer.id);
    pointer = null;
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    for (const shader of shaders) gl.deleteShader(shader);
    vertices = null;
    activeCanvases.delete(canvas); resources.activeContexts--; resources.contextsReleased++;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
  const fail = error => {
    if (failed || destroyed) return;
    failed = true;
    destroy();
    options.onError?.(error);
  };
  try {
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Interactive inspection could not start.');
      shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Interactive inspection could not start.');
      return shader;
    };
    program = gl.createProgram();
    if (!program) throw new Error('Interactive inspection could not start.');
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SOURCE));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SOURCE));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Interactive inspection could not start.');
    buffer = gl.createBuffer();
    if (!buffer) throw new Error('Interactive inspection could not start.');
    gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (const [name, size, offset] of [['aPosition', 3, 0], ['aNormal', 3, 12], ['aColor', 4, 24]]) {
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 40, offset);
    }
    const uniforms = Object.fromEntries(['uRotation', 'uCenter', 'uExtent'].map(name => [name, gl.getUniformLocation(program, name)]));
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE); gl.clearColor(0, 0, 0, 0);
    const draw = () => {
      if (destroyed) return;
      if (gl.isContextLost()) { fail(new Error('Interactive inspection lost its connection.')); return; }
      const r = rotation(view), aspect = canvas.width / Math.max(1, canvas.height);
      let width = Number.isFinite(options.sceneWidth) && options.sceneWidth > 0 ? options.sceneWidth : 0;
      if (!width) {
        let boundX = 0, boundY = 0;
        for (let i = 0; i < vertices.length; i += 10) {
          const x = vertices[i] - center[0], y = vertices[i + 1] - center[1], z = vertices[i + 2] - center[2];
          boundX = Math.max(boundX, Math.abs(r[0] * x + r[3] * y + r[6] * z));
          boundY = Math.max(boundY, Math.abs(r[1] * x + r[4] * y + r[7] * z));
        }
        width = Math.max(.72, boundX * 2.5, boundY * 2.7 * aspect);
      }
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix3fv(uniforms.uRotation, false, r); gl.uniform3fv(uniforms.uCenter, center);
      gl.uniform2f(uniforms.uExtent, width / 2, width / (2 * aspect));
      gl.drawArrays(gl.TRIANGLES, 0, count);
      resources.drawCalls++;
    };
    const resize = () => {
      if (destroyed) return;
      const ratio = Number.isFinite(options.pixelRatio) ? clamp(options.pixelRatio, .5, 2) : Math.min(2, globalThis.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round((rect.width || canvas.width || 360) * ratio));
      const height = Math.max(1, Math.round((rect.height || canvas.height || 240) * ratio));
      // A high-DPI inspection stays below a bounded 2-megapixel drawing buffer.
      const limit = Math.min(1, Math.sqrt(2_000_000 / (width * height)));
      canvas.width = Math.max(1, Math.floor(width * limit)); canvas.height = Math.max(1, Math.floor(height * limit));
      draw();
    };
    const setWeapon = (id, type = kind) => {
      if (destroyed) return;
      validate(id, type);
      weaponId = id; kind = type;
      vertices = kind === 'gun' ? geometry.weaponMeshes(id) : geometry.meleeMeshes({ meleeWeapon: id });
      count = vertices.length / 10;
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < vertices.length; i += 10) for (let axis = 0; axis < 3; axis++) {
        lo[axis] = Math.min(lo[axis], vertices[i + axis]); hi[axis] = Math.max(hi[axis], vertices[i + axis]);
      }
      center = new Float32Array(lo.map((value, axis) => (value + hi[axis]) / 2));
      view = { ...DEFAULT_VIEW[kind] };
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      draw();
    };
    const reset = () => { if (!destroyed) { view = { ...DEFAULT_VIEW[kind] }; draw(); } };
    if (options.interactive !== false) {
      listen('pointerdown', event => {
        if (event.button !== 0 || destroyed) return;
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
        canvas.setPointerCapture?.(event.pointerId); canvas.focus?.({ preventScroll: true });
        event.preventDefault();
      });
      listen('pointermove', event => {
        if (!pointer || event.pointerId !== pointer.id || destroyed) return;
        view.yaw += (event.clientX - pointer.x) * .009;
        view.pitch = clamp(view.pitch + (event.clientY - pointer.y) * .009, -1.5, 1.5);
        pointer.x = event.clientX; pointer.y = event.clientY;
        draw();
      });
      const stopDrag = event => {
        if (!pointer || pointer.id !== event.pointerId) return;
        if (canvas.hasPointerCapture?.(pointer.id)) canvas.releasePointerCapture(pointer.id);
        pointer = null;
      };
      listen('pointerup', stopDrag); listen('pointercancel', stopDrag); listen('lostpointercapture', stopDrag);
      listen('keydown', event => {
        if (destroyed) return;
        const step = event.shiftKey ? .28 : .13;
        if (event.key === 'ArrowLeft') view.yaw -= step;
        else if (event.key === 'ArrowRight') view.yaw += step;
        else if (event.key === 'ArrowUp') view.pitch = clamp(view.pitch - step, -1.5, 1.5);
        else if (event.key === 'ArrowDown') view.pitch = clamp(view.pitch + step, -1.5, 1.5);
        else if (event.key === 'Home' || event.key === '0') { event.preventDefault(); reset(); return; }
        else return;
        event.preventDefault(); draw();
      });
    }
    listen('webglcontextlost', event => { event.preventDefault(); fail(new Error('Interactive inspection is unavailable. The weapon image is still available.')); });
    setWeapon(weaponId, kind); resize();
    if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(resize); observer.observe(canvas); }
    return Object.freeze({ setWeapon, resize, reset, destroy });
  } catch (error) {
    destroy();
    throw error;
  }
}
