/** Cosmetic human motion. Rendered positions are observed; combat state is never changed. */
const TAU = Math.PI * 2;
const STANDING_CYCLE_METRES = 2.45, CROUCHED_CYCLE_METRES = 1.90;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const approach = (current, target, elapsed, duration) => target + (current - target) * Math.exp(-elapsed / duration);
const validId = id => Number.isSafeInteger(id) && id >= 0;
const cycleLengthFor = crouch => STANDING_CYCLE_METRES + (CROUCHED_CYCLE_METRES - STANDING_CYCLE_METRES) * crouch;

function direction(dx, dz, yaw) {
  const scale = Math.max(Math.abs(dx), Math.abs(dz));
  if (scale < 1e-8) return { forward: 1, strafe: 0 };
  const x = dx / scale, z = dz / scale, length = Math.hypot(x, z);
  return { forward: (Math.sin(yaw) * x - Math.cos(yaw) * z) / length, strafe: (Math.cos(yaw) * x + Math.sin(yaw) * z) / length };
}

function poseOf(motion) {
  const { phase, speed, stride, forward, strafe, crouch, airborne, jump, fall, land } = motion;
  // Bob goes down into the real body silhouette, never above the head hitbox.
  const bodyBob = airborne ? 0 : -Math.min(.028, (1 - Math.cos(phase * 2)) * .009 * stride * (1 - crouch * .35) + land * .022);
  const lean = airborne ? 0 : Math.min(1, speed / 5.5) * stride;
  const legs = [0, Math.PI].map(offset => {
    const swing = Math.sin(phase + offset), raised = Math.max(0, Math.cos(phase + offset));
    const travel = airborne ? 0 : swing * stride * .18;
    const lift = airborne ? jump * .07 + fall * .018 : raised * stride * .075;
    const hip = airborne ? jump * .12 : swing * stride * forward * .38;
    const knee = .10 + crouch * .9 + (airborne ? jump * .48 + fall * .18 : raised * stride * .58) + land * .12;
    return { hip, knee, ankle: -hip - knee * .25, lift, forward: travel * forward, side: travel * strafe * .55 };
  });
  return { phase, speed, stride, forward, strafe, crouch, airborne, jump, fall, land, bodyBob, torsoBob: bodyBob, leanForward: forward * lean * .065, leanSide: strafe * lean * .045, legs };
}

function initialMotion(player) {
  const airborne = player?.grounded === false && player?.alive !== false;
  return { phase: 0, speed: 0, stride: 0, forward: 1, strafe: 0, crouch: player?.crouching ? 1 : 0, airborne, jump: airborne ? clamp(finite(player?.vy) / 6.4, 0, 1) : 0, fall: airborne ? clamp(-finite(player?.vy) / 8, 0, 1) : 0, land: 0 };
}

/** Stateless inspection fallback. Runtime rendering uses the displacement presenter below. */
export function playerAnimationPose(player, timeSeconds = 0) {
  const motion = initialMotion(player);
  if (player?.alive === false || motion.airborne) return poseOf(motion);
  const vx = finite(player?.vx), vz = finite(player?.vz), speed = Math.min(10, Math.hypot(vx, vz));
  const movement = direction(vx, vz, finite(player?.yaw));
  motion.speed = speed;
  motion.stride = speed < .05 ? 0 : clamp(speed / 5, 0, 1);
  motion.forward = movement.forward; motion.strafe = movement.strafe;
  const cycleLength = cycleLengthFor(motion.crouch);
  motion.phase = speed ? (((finite(timeSeconds) % (cycleLength / speed)) * speed * TAU / cycleLength) % TAU + TAU) % TAU : 0;
  return poseOf(motion);
}

/**
 * One independent gait per visible human seat, measured from its final presented position.
 * Time is in milliseconds. The caller supplies a stable game/map/match/round context key.
 * Call retain(visibleIds) once per frame so a departed seat releases its history immediately.
 */
export function createPlayerAnimationPresenter({ maxPlayers = 16 } = {}) {
  const capacity = clamp(Number.isSafeInteger(maxPlayers) ? maxPlayers : 16, 1, 32);
  const histories = new Map();
  const newHistory = (player, time, contextKey) => {
    const motion = initialMotion(player);
    return { x: player.x, y: player.y, z: player.z, gaitX: player.x, gaitZ: player.z, vy: finite(player.vy), time, contextKey, lifeId: player.lifeId, deaths: player.deaths, paused: false, motion, pose: poseOf(motion) };
  };
  const present = (player, time, contextKey = null, { paused = false } = {}) => {
    const id = player?.id;
    if (!validId(id) || !Number.isFinite(time) || ![player?.x, player?.y, player?.z].every(Number.isFinite) || player.alive === false || player.monster === true) {
      if (validId(id)) histories.delete(id);
      return poseOf(initialMotion(player));
    }
    let history = histories.get(id);
    const dx = history ? player.x - history.x : 0, dy = history ? player.y - history.y : 0, dz = history ? player.z - history.z : 0;
    const elapsed = history ? time - history.time : 0;
    const discontinuity = !history || history.contextKey !== contextKey || history.lifeId !== player.lifeId || history.deaths !== player.deaths
      || elapsed < 0 || elapsed > 1000 || history.paused && !paused || Math.hypot(dx, dy, dz) > Math.max(.5, elapsed * .016);
    if (discontinuity) {
      history = newHistory(player, time, contextKey);
      if (histories.has(id)) histories.delete(id);
      while (histories.size >= capacity) histories.delete(histories.keys().next().value);
      histories.set(id, history);
    }
    if (paused) {
      history.paused = true; history.time = time;
      history.x = player.x; history.y = player.y; history.z = player.z;
      return history.pose;
    }
    // A paused render or a second pass at the same display timestamp is the same pose.
    if (discontinuity || elapsed === 0) return history.pose;
    const motion = history.motion;
    const gaitDx = player.x - history.gaitX, gaitDz = player.z - history.gaitZ, gaitDistance = Math.hypot(gaitDx, gaitDz);
    // A one-millimetre dead zone rejects correction wiggle. Its anchor remains
    // fixed until real travel escapes it, so slow movement accumulates rather
    // than losing a tiny piece of distance on every high-refresh frame.
    const distance = gaitDistance > .001 ? gaitDistance : 0;
    const speed = distance ? Math.min(10, Math.hypot(dx, dz) * 1000 / elapsed) : 0;
    const airborne = player.grounded === false;
    const landed = motion.airborne && !airborne;
    const crouch = player.crouching ? 1 : approach(motion.crouch, 0, elapsed, 60);
    motion.speed = approach(motion.speed, speed, elapsed, 45);
    motion.stride = approach(motion.stride, !airborne && speed >= .05 ? clamp(speed / 5, 0, 1) : 0, elapsed, speed >= .05 ? 45 : 70);
    if (!airborne && !motion.airborne && distance >= 1e-8) {
      motion.phase = (motion.phase + distance * TAU / cycleLengthFor(crouch)) % TAU;
      const movement = direction(gaitDx, gaitDz, finite(player.yaw));
      // Directions may change without restarting the stride or snapping a swinging foot.
      motion.forward = approach(motion.forward, movement.forward, elapsed, 45);
      motion.strafe = approach(motion.strafe, movement.strafe, elapsed, 45);
    }
    motion.crouch = crouch; motion.airborne = airborne;
    motion.jump = airborne ? approach(motion.jump, clamp(finite(player.vy) / 6.4, 0, 1), elapsed, 45) : 0;
    motion.fall = airborne ? approach(motion.fall, clamp(-finite(player.vy) / 8, 0, 1), elapsed, 45) : 0;
    motion.land = landed ? clamp(.25 + Math.max(0, -history.vy) / 10, .25, 1) : approach(motion.land, 0, elapsed, 90);
    if (distance || airborne || landed) { history.gaitX = player.x; history.gaitZ = player.z; }
    history.x = player.x; history.y = player.y; history.z = player.z; history.vy = finite(player.vy); history.time = time;
    history.pose = poseOf(motion);
    // Refresh insertion order so pathological changing identities cannot evict active teammates.
    histories.delete(id); histories.set(id, history);
    return history.pose;
  };
  present.retain = ids => {
    const keep = new Set(ids);
    for (const id of histories.keys()) if (!keep.has(id)) histories.delete(id);
  };
  present.reset = () => histories.clear();
  Object.defineProperty(present, 'size', { get: () => histories.size });
  return present;
}
