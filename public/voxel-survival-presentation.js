import { canOccupy } from './voxel-survival-engine.js';

// Completed 120 Hz steps remain the authority. These reusable display poses
// keep the camera, creatures, arrows and animation clock on one timeline.
const EPS = 1e-7;
const POSITION = ['x', 'y', 'z'];
const MOTION = [...POSITION, 'vx', 'vy', 'vz'];
const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
const mix = (before, current, fraction) => before + (current - before) * fraction;
const angle = (before, current, fraction) => before + Math.atan2(Math.sin(current - before), Math.cos(current - before)) * fraction;
const overlaps = (a, b) => a.y + a.height > b.y + EPS && a.y < b.y + b.height - EPS
  && Math.hypot(a.x - b.x, a.z - b.z) < a.radius + b.radius - EPS;

function record(body, records) {
  let saved = records.get(body);
  if (!saved) { saved = {}; records.set(body, saved); }
  for (const field of MOTION) saved[field] = body[field];
  saved.body = body; saved.yaw = body.yaw; saved.type = body.type;
  saved.alive = body.hp === undefined || body.hp > 0;
  saved.swingTime = body.swingTime; saved.hurtTime = body.hurtTime; saved.hitFlash = body.hitFlash;
  return saved;
}

function sampleBody(body, before, poses, fraction, maximumDistance = 1) {
  if (!before || before.body !== body || before.type !== body.type
    || before.alive !== (body.hp === undefined || body.hp > 0)
    || Math.hypot(body.x - before.x, body.y - before.y, body.z - before.z) > maximumDistance) return body;
  let pose = poses.get(body);
  if (!pose) { pose = {}; poses.set(body, pose); }
  Object.assign(pose, body);
  for (const field of MOTION) if (Number.isFinite(before[field]) && Number.isFinite(body[field])) pose[field] = mix(before[field], body[field], fraction);
  if (Number.isFinite(before.yaw) && Number.isFinite(body.yaw)) pose.yaw = angle(before.yaw, body.yaw, fraction);
  // A fresh swing or damage flash starts immediately; only its decay is sampled.
  for (const field of ['swingTime', 'hurtTime', 'hitFlash']) {
    if (Number.isFinite(before[field]) && Number.isFinite(body[field]) && body[field] > 0 && body[field] <= before[field])
      pose[field] = mix(before[field], body[field], fraction);
  }
  return pose;
}

export function createSurvivalPresentation() {
  const records = new WeakMap(), poses = new WeakMap();
  const previousEnemies = new Map(), previousProjectiles = new Map();
  const enemies = [], projectiles = [], camera = {}, options = {}, miningPose = {};
  const result = { camera, options };
  const stats = { physicsSamples: 0, renderSamples: 0, interpolatedSamples: 0, lastFraction: 1 };
  let previous = null, previousPlayer = null;

  function clearBodies(state, candidate, source) {
    if (!canOccupy(state, candidate.x, candidate.y, candidate.z, candidate.radius, candidate.height)) return false;
    if (source !== state.player && state.player.hp > 0 && overlaps(candidate, state.player)) return false;
    for (const peer of state.enemies) if (peer !== source && peer.hp > 0 && overlaps(candidate, peer)) return false;
    return true;
  }

  return {
    capture(state) {
      stats.physicsSamples++;
      if (!previous) previous = {};
      Object.assign(previous, { state, world: state.world, revision: state.world.revision, phase: state.phase, paused: state.paused,
        day: state.day, time: state.time, elapsed: state.elapsed, mining: state.mining, miningProgress: state.mining?.progress, slot: state.selectedSlot });
      previousPlayer = record(state.player, records);
      previousEnemies.clear(); previousProjectiles.clear();
      for (const enemy of state.enemies) previousEnemies.set(enemy, record(enemy, records));
      for (const projectile of state.projectiles) previousProjectiles.set(projectile, record(projectile, records));
    },
    sample(state, amount = 1, look = state.player) {
      const fraction = clamp(amount);
      stats.renderSamples++; stats.lastFraction = fraction;
      Object.assign(camera, state.player, { yaw: look.yaw, pitch: look.pitch });
      Object.assign(options, { displayTime: state.time, worldRevision: state.world.revision, player: state.player, enemies: state.enemies, projectiles: state.projectiles, mining: state.mining });
      if (fraction === 1 || !previous || previous.state !== state || previous.world !== state.world || previous.revision !== state.world.revision
        || state.paused || previous.paused !== state.paused || state.phase !== 'playing' || previous.phase !== state.phase || previous.day !== state.day) return result;

      const player = sampleBody(state.player, previousPlayer, poses, fraction);
      if (player === state.player) return result;
      if (player !== state.player && clearBodies(state, player, state.player)) Object.assign(camera, player, { yaw: look.yaw, pitch: look.pitch });
      options.player = player;
      options.displayTime = mix(previous.time, state.time, fraction);
      if (state.mining && previous.mining === state.mining && previous.slot === state.selectedSlot) {
        Object.assign(miningPose, state.mining, { progress: mix(previous.miningProgress, state.mining.progress, fraction) });
        options.mining = miningPose;
      }
      enemies.length = 0; projectiles.length = 0;
      for (const enemy of state.enemies) {
        const pose = sampleBody(enemy, previousEnemies.get(enemy), poses, fraction);
        enemies.push(pose !== enemy && enemy.hp > 0 && clearBodies(state, pose, enemy) ? pose : enemy);
      }
      // Keep the displayed scene clear too, including a foe snapping to its
      // completed contact pose. Conservative current-peer checks above mean
      // that replacing a rejected pose cannot create another overlap.
      for (let index = 0; index < enemies.length; index++) {
        const pose = enemies[index], body = state.enemies[index];
        if (pose === body || pose.hp <= 0) continue;
        if (overlaps(pose, camera) || enemies.some((peer, other) => other !== index && peer.hp > 0 && overlaps(pose, peer))) enemies[index] = body;
      }
      if (enemies.some(peer => peer.hp > 0 && overlaps(camera, peer))) Object.assign(camera, state.player, { yaw: look.yaw, pitch: look.pitch });
      for (const projectile of state.projectiles) projectiles.push(sampleBody(projectile, previousProjectiles.get(projectile), poses, fraction, 2));
      options.enemies = enemies; options.projectiles = projectiles;
      stats.interpolatedSamples++;
      return result;
    },
    reset() { previous = null; previousPlayer = null; previousEnemies.clear(); previousProjectiles.clear(); enemies.length = 0; projectiles.length = 0; },
    getStats() { return { ...stats }; },
    getPresentation() { return { camera: { ...camera }, time: options.displayTime, worldRevision: options.worldRevision,
      enemies: (options.enemies || []).map(body => ({ id: body.id, type: body.type, x: body.x, y: body.y, z: body.z, radius: body.radius, height: body.height, hp: body.hp })),
      projectiles: (options.projectiles || []).map(body => ({ id: body.id, x: body.x, y: body.y, z: body.z })) }; },
  };
}
