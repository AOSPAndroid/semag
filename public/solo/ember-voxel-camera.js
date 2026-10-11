/** Third-person camera in the engine's unchanged ground plane (32 px = 1 m). */
export const EMBER_CAMERA = Object.freeze({ scale: 1 / 32, distance: 5.4, shoulder: .58, targetHeight: 1.18, clearance: .20, coverHeight: 2.65, minPitch: .12, maxPitch: 1.05, fov: Math.PI / 3.1, near: .075, far: 72, followRate: 18 });
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const finite = (v, d = 0) => Number.isFinite(v) ? v : d;
export const cameraForward = yaw => ({ x: Math.sin(finite(yaw)), y: -Math.cos(finite(yaw)) });
export const cameraRight = yaw => ({ x: Math.cos(finite(yaw)), y: Math.sin(finite(yaw)) });
const normalized = a => { const l = Math.hypot(...a); return l ? a.map(x => x / l) : [0, 0, -1]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

/** Slab intersection includes vertical cover: a raised boom can clear a pillar. */
export function segmentBoxFraction(start, end, box) {
  let near = 0, far = 1;
  for (let i = 0; i < 3; i++) {
    const delta = end[i] - start[i], low = box.min[i], high = box.max[i];
    if (Math.abs(delta) < 1e-9) { if (start[i] < low || start[i] > high) return null; }
    else {
      const a = (low - start[i]) / delta, b = (high - start[i]) / delta;
      near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
      if (near > far) return null;
    }
  }
  return near <= 1 && far >= 0 ? clamp(near, 0, 1) : null;
}

export function clampCameraBoom(anchor, requestedEye, room) {
  const r = EMBER_CAMERA.clearance;
  const lo = [42 / 32 + r, r, 42 / 32 + r], hi = [918 / 32 - r, 12, 598 / 32 - r];
  const desired = requestedEye.map((v, i) => clamp(finite(v, anchor[i]), lo[i], hi[i]));
  let fraction = 1;
  for (const o of room?.obstacles || []) {
    const box = { min: [o.x / 32 - r, -r, o.y / 32 - r], max: [(o.x + o.width) / 32 + r, EMBER_CAMERA.coverHeight + r, (o.y + o.height) / 32 + r] };
    const hit = segmentBoxFraction(anchor, desired, box);
    if (hit !== null) fraction = Math.min(fraction, Math.max(0, hit - .008));
  }
  return anchor.map((v, i) => v + (desired[i] - v) * fraction);
}

export function lookAtMatrix(eye, target) {
  const z = normalized(eye.map((v, i) => v - target[i]));
  const x = normalized(cross([0, 1, 0], z));
  const y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
}
export function perspectiveMatrix(aspect, fov = EMBER_CAMERA.fov, near = EMBER_CAMERA.near, far = EMBER_CAMERA.far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  return new Float32Array([f / Math.max(.01, finite(aspect, 1)), 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
export function multiplyMatrices(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
    out[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
  }
  return out;
}
export function projectWorld(point, camera, aspect = 1) {
  const m = multiplyMatrices(perspectiveMatrix(aspect), lookAtMatrix(camera.eye, camera.target));
  const p = [...point, 1], q = [0, 0, 0, 0].map((_, row) => p.reduce((s, v, col) => s + v * m[col * 4 + row], 0));
  return q[3] > 0 ? { x: q[0] / q[3], y: q[1] / q[3], depth: q[2] / q[3] } : null;
}

/** Ground picking derives from the same camera basis/FOV as the visible scene. */
export function groundAimDirection(ndcX, ndcY, player, camera, aspect = 1, height = 0) {
  const forward = normalized(camera.target.map((v, i) => v - camera.eye[i]));
  const right = normalized(cross(forward, [0, 1, 0])), up = cross(right, forward), spread = Math.tan(EMBER_CAMERA.fov / 2);
  const ray = forward.map((v, i) => v + right[i] * finite(ndcX) * spread * aspect + up[i] * finite(ndcY) * spread);
  if (ray[1] < -.0001) {
    const t = (height - camera.eye[1]) / ray[1], x = camera.eye[0] + ray[0] * t - player.x / 32, y = camera.eye[2] + ray[2] * t - player.y / 32;
    const length = Math.hypot(x, y);
    if (length > .015) return { x: x / length, y: y / length };
  }
  return cameraForward(camera.yaw);
}

export class EmberVoxelCamera {
  constructor() { this.pose = null; this.roomId = null; this.lastTime = null; }
  reset() { this.pose = null; this.roomId = null; this.lastTime = null; }
  update(state, { yaw = 0, pitch = .32, time = state.elapsed } = {}) {
    yaw = finite(yaw); pitch = clamp(finite(pitch, .32), EMBER_CAMERA.minPitch, EMBER_CAMERA.maxPitch); time = finite(time, state.elapsed);
    if (state.phase !== 'playing' && this.pose && this.roomId === state.room.id && state.elapsed >= finite(this.lastTime) - .01) return this.pose;
    const changedRoom = this.roomId !== state.room.id || this.lastTime !== null && time < this.lastTime - .01;
    const anchor = [state.player.x / 32, EMBER_CAMERA.targetHeight, state.player.y / 32];
    const forward = cameraForward(yaw), right = cameraRight(yaw);
    const wanted = clampCameraBoom(anchor, [anchor[0] - forward.x * EMBER_CAMERA.distance + right.x * EMBER_CAMERA.shoulder, anchor[1] + Math.tan(pitch) * EMBER_CAMERA.distance, anchor[2] - forward.y * EMBER_CAMERA.distance + right.y * EMBER_CAMERA.shoulder], state.room);
    const elapsedDelta = Math.max(0, time - finite(this.lastTime, time));
    const orbit = this.pose && Math.abs(yaw - this.pose.yaw) + Math.abs(pitch - this.pose.pitch) > .0001;
    // Zero simulation time means pause/decision frames cannot continue creeping.
    let eye = wanted;
    if (this.pose && !changedRoom) {
      const weight = orbit ? 1 : 1 - Math.exp(-EMBER_CAMERA.followRate * Math.min(.05, elapsedDelta));
      eye = clampCameraBoom(anchor, this.pose.eye.map((v, i) => v + (wanted[i] - v) * weight), state.room);
    }
    const target = [anchor[0] + forward.x * .8, anchor[1] - .10, anchor[2] + forward.y * .8];
    // Near-wall orbit can shorten the boom to centimetres. Keep a finite basis.
    if (Math.hypot(...target.map((v, i) => v - eye[i])) < .1) target[1] -= .2;
    this.pose = { eye, target, yaw, pitch, collisionDistance: Math.hypot(...eye.map((v, i) => v - anchor[i])) };
    this.roomId = state.room.id; this.lastTime = time;
    return this.pose;
  }
}
