import { tickFraction } from './display-timing.js';
import { ADS } from './voxel-engine.js';

const STEP = 1 / 120;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = value => Number.isFinite(value) ? value : 0;
const COMBAT_FIELDS = ['aimTicks', 'recoil', 'reloadTicks', 'healTicks', 'grenadeThrowTicks', 'meleeTicks', 'meleeCooldown', 'shotCooldown'];
const INPUT_FIELDS = ['up', 'down', 'left', 'right', 'jump', 'crouch', 'walk', 'aim', 'yaw', 'pitch'];
const MOVEMENT_FIELDS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'pitch', 'grounded', 'crouching', 'jumpBufferTicks', 'previousInput'];
const CONTEXT_FIELDS = [...MOVEMENT_FIELDS, 'alive', 'radius', 'weapon', 'slot', 'reloadTicks', 'healTicks', 'grenadeThrowTicks', 'meleeWeapon'];
const matches = (old, next, fields) => fields.every(field => old[field] === next[field]);

function interpolateMovement(player, next, fraction) {
  const pose = { ...player };
  for (const field of ['x', 'y', 'z', 'vx', 'vy', 'vz']) {
    if (Number.isFinite(player[field]) && Number.isFinite(next[field])) pose[field] += (next[field] - player[field]) * fraction;
  }
  return pose;
}

/** Reuse the collision-tested endpoint until physics, input or body context changes. */
export function createMovementPresenter() {
  let cache;
  return (player, buttons, map, remainder, predictMovement, peers = []) => {
    if (!player?.alive || typeof predictMovement !== 'function') return player;
    const fraction = tickFraction(remainder, STEP);
    if (!fraction) return player;
    if (!cache || cache.player !== player || cache.map !== map || cache.predict !== predictMovement || cache.peers !== peers || !matches(cache.source, player, CONTEXT_FIELDS) || !matches(cache.buttons, buttons, INPUT_FIELDS)) {
      const next = { ...player };
      predictMovement(next, buttons, map, 1, peers);
      cache = { player, map, predict: predictMovement, peers, source: { ...player }, buttons: { ...buttons }, next };
    }
    return interpolateMovement(player, cache.next, fraction);
  };
}

/** A display pose between fixed physics steps. Neither copy enters input history. */
export function movementPresentation(player, buttons, map, remainder, predictMovement, peers = []) {
  if (!player?.alive || typeof predictMovement !== 'function') return player;
  const fraction = tickFraction(remainder, STEP);
  if (!fraction) return player;
  const next = { ...player };
  predictMovement(next, buttons, map, 1, peers);
  return interpolateMovement(player, next, fraction);
}

const remoteEndpoints = new WeakMap();
/** Continue a received body with the real collision sweep, including a sub-tick pose. */
export function projectedMovement(player, buttons, map, elapsedMs, predictMovement, peers = [], source = player) {
  const ticks = clamp(finite(elapsedMs), 0, 25) * 120 / 1000;
  const whole = Math.floor(ticks);
  let endpoints = remoteEndpoints.get(source);
  if (!endpoints || endpoints.map !== map || endpoints.predict !== predictMovement || endpoints.peers !== peers || !matches(endpoints.source, source, CONTEXT_FIELDS) || !matches(endpoints.buttons, buttons, INPUT_FIELDS)) {
    endpoints = { map, predict: predictMovement, peers, source: { ...source }, buttons: { ...buttons }, poses: new Map() };
    remoteEndpoints.set(source, endpoints);
  }
  let endpoint = endpoints.poses.get(whole);
  if (!endpoint) {
    const pose = { ...source };
    if (whole) predictMovement(pose, buttons, map, whole, peers);
    endpoint = { pose };
    endpoints.poses.set(whole, endpoint);
  }
  const pose = { ...player };
  for (const field of MOVEMENT_FIELDS) if (field in endpoint.pose) pose[field] = endpoint.pose[field];
  const fraction = tickFraction((ticks - whole) * STEP, STEP);
  if (!fraction) return pose;
  if (!endpoint.next) {
    endpoint.next = { ...endpoint.pose };
    predictMovement(endpoint.next, buttons, map, 1, peers);
  }
  return interpolateMovement(pose, endpoint.next, fraction);
}

const sameEquipment = (player, old) => old && player.id === old.id && player.alive === old.alive && player.team === old.team && player.weapon === old.weapon && player.slot === old.slot && player.meleeWeapon === old.meleeWeapon;

/** Smooth only visual combat values; health, inventory and action results stay newest. */
export function combatPresentation(player, old, ratio, elapsedMs = 0) {
  if (!player.alive || !sameEquipment(player, old)) return player;
  const pose = { ...player }, amount = clamp(finite(ratio), 0, 1), extra = clamp(finite(elapsedMs), 0, 25) * 120 / 1000;
  const interpolate = field => finite(old[field]) + (finite(player[field]) - finite(old[field])) * amount;
  // Start/release changes are immediate. An ongoing aim transition advances
  // smoothly on every display frame without changing the shot's server aim.
  const continuingAim = player.aiming === old.aiming && player.healing === old.healing;
  pose.aimTicks = clamp((continuingAim ? interpolate('aimTicks') : finite(player.aimTicks)) + extra * (player.aiming ? 1 : -2), 0, ADS.ticks);
  // A fresh recoil impulse is never delayed behind an interpolation window.
  pose.recoil = Math.max(0, (finite(player.recoil) <= finite(old.recoil) ? interpolate('recoil') : finite(player.recoil)) - extra * .04 / 120);
  for (const field of COMBAT_FIELDS.slice(2)) {
    if (!(player[field] > 0)) continue;
    if (field === 'healTicks' && player.healStartTick !== old.healStartTick) continue;
    const ongoing = old[field] >= player[field] && old[field] > 0;
    // Keep the current action visible until authority confirms its completion.
    pose[field] = Math.max(.001, (ongoing ? interpolate(field) : player[field]) - extra);
  }
  return pose;
}

/** Combine smooth visual timers with a separately reconciled local movement copy. */
export function withCombatPresentation(player, visual) {
  if (!player || !sameEquipment(player, visual)) return player;
  const pose = { ...player };
  for (const field of COMBAT_FIELDS) if (Number.isFinite(visual[field])) pose[field] = visual[field];
  return pose;
}
