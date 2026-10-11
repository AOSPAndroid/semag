import { WORLD } from './voxel-engine.js';
import { meleeSlashOrigin } from './voxel-melee.js';

export const SHINOBI_CAMERA = Object.freeze({ distance: 3.65, shoulder: .64, lift: .16, radius: .18, minPitch: -.92, maxPitch: .70, defaultPitch: -.13, returnRate: 16, stanceRate: 22, aimDistance: 48 });
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const direction = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
const pointArray = point => Array.isArray(point) ? point : [point.x, point.y, point.z];

/** Finite segment against a real minimum-corner 3D collider. */
export function shinobiSegmentBoxFraction(from, to, box, padding = 0) {
  if (!from.every(Number.isFinite) || !to.every(Number.isFinite) || ![box?.x, box?.y, box?.z, box?.w, box?.h, box?.d].every(Number.isFinite)) return null;
  const low = [box.x - padding, box.y - padding, box.z - padding], high = [box.x + box.w + padding, box.y + box.h + padding, box.z + box.d + padding];
  let near = 0, far = 1;
  for (let axis = 0; axis < 3; axis++) {
    const delta = to[axis] - from[axis];
    if (Math.abs(delta) < 1e-9) { if (from[axis] < low[axis] || from[axis] > high[axis]) return null; continue; }
    let first = (low[axis] - from[axis]) / delta, last = (high[axis] - from[axis]) / delta;
    if (first > last) [first, last] = [last, first];
    near = Math.max(near, first); far = Math.min(far, last);
    if (near > far) return null;
  }
  return far >= 0 && near <= 1 ? Math.max(0, near) : null;
}

/** Roof undersides, elevated platforms and room walls all shorten the boom. */
export function clampShinobiCameraBoom(anchor, wanted, map, radius = SHINOBI_CAMERA.radius) {
  const length = Math.hypot(...wanted.map((n, axis) => n - anchor[axis]));
  if (length < 1e-8) return [...anchor];
  let fraction = 1;
  for (const box of map?.colliders || []) {
    const contact = shinobiSegmentBoxFraction(anchor, wanted, box, radius);
    if (contact !== null) fraction = Math.min(fraction, Math.max(0, contact - .008 / length));
  }
  const bounds = map?.bounds;
  const low = [finite(bounds?.minX, -Infinity) + radius, radius, finite(bounds?.minZ, -Infinity) + radius];
  const high = [finite(bounds?.maxX, Infinity) - radius, Infinity, finite(bounds?.maxZ, Infinity) - radius];
  for (let axis = 0; axis < 3; axis++) {
    const delta = wanted[axis] - anchor[axis];
    if (delta < 0 && wanted[axis] < low[axis]) fraction = Math.min(fraction, Math.max(0, (low[axis] - anchor[axis]) / delta));
    if (delta > 0 && wanted[axis] > high[axis]) fraction = Math.min(fraction, Math.max(0, (high[axis] - anchor[axis]) / delta));
  }
  return anchor.map((n, axis) => n + (wanted[axis] - n) * fraction);
}

/** Aim from the actual crosshair ray, then test the player's chest against cover. */
export function shinobiCrosshairAim(camera, player, map, players = [], maxDistance = SHINOBI_CAMERA.aimDistance) {
  const ray = direction(camera.yaw, camera.pitch), far = camera.eye.map((n, axis) => n + ray[axis] * maxDistance);
  let fraction = 1, targetId = null;
  const test = (box, id = null) => { const hit = shinobiSegmentBoxFraction(camera.eye, far, box); if (hit !== null && hit < fraction) { fraction = hit; targetId = id; } };
  for (const box of map?.colliders || []) test(box);
  // The ground is a real collision plane even in maps with no floor collider.
  if (ray[1] < -1e-8 && camera.eye[1] >= 0) fraction = Math.min(fraction, -camera.eye[1] / (ray[1] * maxDistance));
  for (const actor of players) {
    if (actor.id === player.id || actor.alive === false || ![actor.x, actor.z].every(Number.isFinite)) continue;
    test({ x: actor.x - WORLD.radius, y: finite(actor.y), z: actor.z - WORLD.radius, w: WORLD.radius * 2, h: actor.crouching ? WORLD.crouchHeight : WORLD.standHeight, d: WORLD.radius * 2 }, actor.id);
  }
  let target = camera.eye.map((n, axis) => n + ray[axis] * clamp(fraction, 0, 1) * maxDistance);
  const origin = pointArray(meleeSlashOrigin(player));
  let blocked = false, cover = 1;
  for (const box of map?.colliders || []) { const hit = shinobiSegmentBoxFraction(origin, target, box); if (hit !== null && hit < cover - .001) { cover = hit; blocked = true; } }
  // A shoulder can see over a ledge the blade cannot reach. Direction stays
  // crosshair-correct; the obstruction flag lets the HUD explain that cover.
  const delta = target.map((n, axis) => n - origin[axis]), horizontal = Math.hypot(delta[0], delta[2]);
  const yaw = horizontal > 1e-8 ? Math.atan2(delta[0], -delta[2]) : camera.yaw;
  const pitch = clamp(Math.atan2(delta[1], horizontal), -1.35, 1.35);
  return Object.freeze({ yaw, pitch, target: Object.freeze(target), targetId, blocked, coverDistance: blocked ? Math.hypot(...delta) * cover : null });
}

/** Orbit turns and inward collisions react immediately; outward return is smooth. */
export function createShinobiCameraPresenter() {
  let pose = null, context = null, lastTime = null, stance = 0, boomDistance = 0;
  const present = (state, options = {}) => {
    if (!state) return null;
    const players = options.players || state.players || state.fighters || [];
    const player = options.cameraPlayer || players.find(actor => actor.id === (options.localId ?? options.playerId)) || players[0];
    if (!player) return null;
    const map = state.map, time = finite(options.time, typeof performance === 'object' ? performance.now() : 0);
    const key = `${map?.id}:${state.matchId ?? ''}:${state.round ?? ''}:${player.id}:${player.lifeId ?? ''}:${player.deaths ?? ''}`;
    const changedContext = !pose || key !== context || time < finite(lastTime);
    if ((options.paused || state.phase === 'paused') && pose && !changedContext) { lastTime = time; return pose; }
    const reset = changedContext || time - finite(lastTime) > 500;
    const elapsed = reset ? 0 : clamp((time - lastTime) / 1000, 0, .05);
    const requestedStance = player.crouching ? 1 : 0;
    stance = reset ? requestedStance : requestedStance + (stance - requestedStance) * Math.exp(-SHINOBI_CAMERA.stanceRate * elapsed);
    const yaw = finite(options.yaw, finite(player.yaw)), pitch = clamp(finite(options.pitch, finite(player.pitch, SHINOBI_CAMERA.defaultPitch)), SHINOBI_CAMERA.minPitch, SHINOBI_CAMERA.maxPitch);
    const anchor = [finite(player.x), finite(player.y) + WORLD.eyeHeight - stance * (WORLD.eyeHeight - WORLD.crouchEyeHeight), finite(player.z)];
    const forward = direction(yaw, pitch), right = [Math.cos(yaw), 0, Math.sin(yaw)];
    const wanted = anchor.map((n, axis) => n - forward[axis] * SHINOBI_CAMERA.distance + right[axis] * SHINOBI_CAMERA.shoulder + (axis === 1 ? SHINOBI_CAMERA.lift : 0));
    const safe = clampShinobiCameraBoom(anchor, wanted, map), requestedDistance = Math.hypot(...safe.map((n, axis) => n - anchor[axis]));
    boomDistance = reset || requestedDistance < boomDistance ? requestedDistance : requestedDistance + (boomDistance - requestedDistance) * Math.exp(-SHINOBI_CAMERA.returnRate * elapsed);
    const eye = requestedDistance < 1e-8 ? [...anchor] : anchor.map((n, axis) => n + (safe[axis] - n) * boomDistance / requestedDistance);
    const target = eye.map((n, axis) => n + forward[axis] * SHINOBI_CAMERA.aimDistance);
    const next = { eye: Object.freeze(eye), target: Object.freeze(target), yaw, pitch, roll: 0, distance: boomDistance, collisionDistance: requestedDistance, crouchAmount: stance, nearBody: boomDistance < .70 };
    next.aim = shinobiCrosshairAim(next, player, map, players);
    pose = Object.freeze(next); context = key; lastTime = time; return pose;
  };
  present.reset = () => { pose = null; context = null; lastTime = null; stance = 0; boomDistance = 0; };
  present.inspect = () => pose;
  return present;
}
