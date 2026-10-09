import { tickFraction } from './display-timing.js';
import { ADS, INPUT_KEYS, copyMovementState, movementPredictionRevision, separatePresentationBodies, sweepPresentationOffset } from './voxel-engine.js';
import { advanceBolts, MAX_BOLTS } from './voxel-projectiles.js';
import { meleeProfile, meleeStartupAim } from './voxel-melee.js';

const STEP = 1 / 120;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = value => Number.isFinite(value) ? value : 0;
const COMBAT_FIELDS = ['aimTicks', 'recoil', 'reloadTicks', 'healTicks', 'grenadeThrowTicks', 'meleeTicks', 'meleeCooldown', 'shotCooldown', 'parryTicks', 'parryCooldown', 'meleeSecondaryCooldown'];
const INPUT_FIELDS = [...INPUT_KEYS, 'yaw', 'pitch'];
const MOVEMENT_FIELDS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'pitch', 'grounded', 'crouching', 'jumpBufferTicks', 'knockbackX', 'knockbackZ', 'knockbackTicks', 'knockbackReadyTicks', 'stamina', 'staminaRegenTicks', 'sprintExhausted', 'sprinting', 'previousInput'];
const CONTEXT_FIELDS = [...MOVEMENT_FIELDS, 'alive', 'radius', 'weapon', 'slot', 'reloadTicks', 'healTicks', 'grenadeThrowTicks', 'meleeTicks', 'meleeCooldown', 'pendingMeleeTicks', 'inventoryIndex', 'meleeIndex', 'meleeInitialYaw', 'meleeInitialPitch', 'meleeYaw', 'meleePitch', 'meleeAction', 'meleeSecondaryCooldown', 'meleeAimBlocked', 'parryTicks', 'parryCooldown', 'parryYaw', 'parryPitch', 'parryStartTick', 'parryIndex', 'parryConsumed', 'burstRemaining', 'pendingFireTicks', 'shotCooldown', 'triggerBlocked', 'ammo', 'reserve', 'lifeId', 'deaths', 'meleeStartTick', 'healStartTick', 'interaction', 'interactTicks', 'meleeWeapon', 'bot', 'monster'];
const matches = (old, next, fields) => fields.every(field => old[field] === next[field]);

/** Resolve the complete displayed body batch; independent previews share no future poses. */
export function resolvePresentationContacts(players, mapOrId, options) {
  return separatePresentationBodies(players, mapOrId, options);
}

/** Simulation ticks and wire packet ordering are separate clocks. */
export function reconcileMovement(player, history, ack, map, predictMovement, allowMovement = true, peers = [], authoritativeTick) {
  const timed = Number.isSafeInteger(authoritativeTick) && authoritativeTick >= 0;
  const pending = history.filter(frame => timed && Number.isSafeInteger(frame.tick) ? frame.tick > authoritativeTick : frame.seq > ack).slice(-240);
  const predicted = structuredClone(player);
  if (predicted?.alive && allowMovement) for (const frame of pending) predictMovement(predicted, frame.buttons, map, 1, peers);
  return { predicted, pending, predictionTick: timed ? Math.max(authoritativeTick, ...pending.map(frame => Number.isSafeInteger(frame.tick) ? frame.tick : authoritativeTick)) : undefined };
}

function interpolateMovement(player, next, fraction) {
  const pose = copyMovementState(player);
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
    if (!cache || cache.player !== player || cache.map !== map || cache.predict !== predictMovement || cache.peers !== peers || cache.actionRevision !== movementPredictionRevision(player) || !matches(cache.source, player, CONTEXT_FIELDS) || !matches(cache.buttons, buttons, INPUT_FIELDS)) {
      const next = copyMovementState(player);
      predictMovement(next, buttons, map, 1, peers);
      cache = { player, map, predict: predictMovement, peers, source: { ...player }, buttons: { ...buttons }, next, actionRevision: movementPredictionRevision(player) };
    }
    return interpolateMovement(player, cache.next, fraction);
  };
}

/** A display pose between fixed physics steps. Neither copy enters input history. */
export function movementPresentation(player, buttons, map, remainder, predictMovement, peers = []) {
  if (!player?.alive || typeof predictMovement !== 'function') return player;
  const fraction = tickFraction(remainder, STEP);
  if (!fraction) return player;
  const next = copyMovementState(player);
  predictMovement(next, buttons, map, 1, peers);
  return interpolateMovement(player, next, fraction);
}

const remoteEndpoints = new WeakMap();
const receivedPaths = new WeakMap();

/** Use a received bracket's real swept path only when replay verifies both endpoints. */
function receivedMovementPath(old, endpoint, from, to, map, predictMovement) {
  if (typeof predictMovement !== 'function' || !old.previousInput || !endpoint.previousInput
      || !matches(old.previousInput, endpoint.previousInput, INPUT_FIELDS)) return null;
  const ticks = (to.time - from.time) * 120 / 1000, count = Math.round(ticks);
  if (count < 1 || count > 8 || Math.abs(ticks - count) > 1e-7) return null;
  // Constant ground velocity already describes an exact straight path. Keep
  // its cheap existing sweep; verify only acceleration, falling or curved motion.
  const duration = count * STEP;
  if (old.grounded && endpoint.grounded && old.crouching === endpoint.crouching
      && Math.abs(old.y - endpoint.y) < 1e-8 && Math.abs(old.vy) < 1e-8 && Math.abs(endpoint.vy) < 1e-8
      && ['x', 'z'].every(axis => Math.abs(old[`v${axis}`] - endpoint[`v${axis}`]) < 1e-8 && Math.abs(old[axis] + old[`v${axis}`] * duration - endpoint[axis]) < 1e-8)) return null;
  let cached = receivedPaths.get(old);
  if (cached?.endpoint === endpoint && cached.count === count && cached.map === map && cached.predict === predictMovement && cached.peers === from.state.players
      && cached.sourceAction === movementPredictionRevision(old) && cached.targetAction === movementPredictionRevision(endpoint)
      && matches(cached.source, old, CONTEXT_FIELDS) && matches(cached.target, endpoint, CONTEXT_FIELDS) && matches(cached.buttons, old.previousInput, INPUT_FIELDS)) return cached.poses;
  const poses = [copyMovementState(old)];
  for (let tick = 0; tick < count; tick++) {
    const next = copyMovementState(poses[tick]);
    predictMovement(next, old.previousInput, map, 1, from.state.players); poses.push(next);
  }
  const last = poses[count];
  const verified = ['x', 'y', 'z', 'vx', 'vy', 'vz'].every(axis => Number.isFinite(last[axis]) && Number.isFinite(endpoint[axis]) && Math.abs(last[axis] - endpoint[axis]) < 1e-6)
    && last.crouching === endpoint.crouching && last.grounded === endpoint.grounded;
  cached = { endpoint, count, map, predict: predictMovement, peers: from.state.players, source: { ...old }, target: { ...endpoint }, sourceAction: movementPredictionRevision(old), targetAction: movementPredictionRevision(endpoint), buttons: { ...old.previousInput }, poses: verified ? poses : null };
  receivedPaths.set(old, cached); return cached.poses;
}

/** Continue a received body with the real collision sweep, including a sub-tick pose. */
export function projectedMovement(player, buttons, map, elapsedMs, predictMovement, peers = [], source = player) {
  const ticks = clamp(finite(elapsedMs), 0, 25) * 120 / 1000;
  const whole = Math.floor(ticks);
  let endpoints = remoteEndpoints.get(source);
  if (!endpoints || endpoints.map !== map || endpoints.predict !== predictMovement || endpoints.peers !== peers || endpoints.actionRevision !== movementPredictionRevision(source) || !matches(endpoints.source, source, CONTEXT_FIELDS) || !matches(endpoints.buttons, buttons, INPUT_FIELDS)) {
    endpoints = { map, predict: predictMovement, peers, source: { ...source }, actionRevision: movementPredictionRevision(source), buttons: { ...buttons }, poses: new Map() };
    remoteEndpoints.set(source, endpoints);
  }
  let endpoint = endpoints.poses.get(whole);
  if (!endpoint) {
    const pose = copyMovementState(source);
    if (whole) predictMovement(pose, buttons, map, whole, peers);
    endpoint = { pose };
    endpoints.poses.set(whole, endpoint);
  }
  const pose = copyMovementState(player);
  for (const field of MOVEMENT_FIELDS) if (field in endpoint.pose) pose[field] = endpoint.pose[field];
  const fraction = tickFraction((ticks - whole) * STEP, STEP);
  if (!fraction) return pose;
  if (!endpoint.next) {
    endpoint.next = copyMovementState(endpoint.pose);
    predictMovement(endpoint.next, buttons, map, 1, peers);
  }
  return interpolateMovement(pose, endpoint.next, fraction);
}

/** Buffer transforms on simulation time while publishing newest gameplay immediately. */
export function interpolatedVoxelState(samples, targetTime, localId, { predictMovement, traceProjectile, maxExtrapolationMs = 25, combatTime = targetTime } = {}) {
  if (!samples.length) return null;
  const newest = samples[samples.length - 1];
  let from = samples[0], to = newest;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].time >= targetTime) { from = samples[i - 1]; to = samples[i]; break; }
    from = samples[i];
  }
  const state = { ...newest.state, players: newest.state.players.map(player => ({ ...player })),
    bolts: (newest.state.bolts || []).slice(0, MAX_BOLTS).map(bolt => ({ ...bolt })) };
  state.fighters = state.players;
  const compatible = sample => ['phase', 'round', 'matchId', 'mapId'].every(field => sample.state[field] === newest.state[field]);
  if (!compatible(from) || !compatible(to)) return state;
  const span = to.time - from.time;
  const ratio = span > 0 ? clamp((targetTime - from.time) / span, 0, 1) : 1;
  const projectedMs = clamp(targetTime - newest.time, 0, Math.min(25, Math.max(0, maxExtrapolationMs)));
  const combatMs = clamp(combatTime - newest.time, 0, 25);
  const previousNewest = samples[samples.length - 2] || newest;
  const wrap = angle => ((angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

  for (const player of state.players) {
    const endpoint = to.state.players.find(other => other.id === player.id);
    const old = from.state.players.find(other => other.id === player.id);
    if (!endpoint || !old) continue;
    const previousCombat = previousNewest.state.players.find(other => other.id === player.id) || player;
    // Action starts, cancellation and completion come from the newest state,
    // independently of the older bracket used to smooth an opponent's body.
    Object.assign(player, combatPresentation(player, previousCombat, 1, combatMs));
    if (player.id === localId || !player.alive || old.alive !== player.alive || endpoint.alive !== player.alive || old.team !== player.team || endpoint.team !== player.team
        || (old.lifeId || 0) !== (player.lifeId || 0) || (endpoint.lifeId || 0) !== (player.lifeId || 0) || (old.deaths || 0) !== (player.deaths || 0) || (endpoint.deaths || 0) !== (player.deaths || 0)) continue;
    if (distance(endpoint, old) > 4 || distance(player, endpoint) > 4) continue;
    const map = newest.state.map || newest.state.mapId;
    const path = receivedMovementPath(old, endpoint, from, to, map, predictMovement);
    if (path) {
      const progress = ratio * (path.length - 1), index = Math.min(path.length - 2, Math.floor(progress));
      const pose = interpolateMovement(path[index], path[index + 1], progress - index);
      for (const axis of ['x', 'y', 'z', 'vx', 'vy', 'vz']) player[axis] = pose[axis];
      const swept = sweepPresentationOffset(path[index], { x: pose.x - path[index].x, y: pose.y - path[index].y, z: pose.z - path[index].z }, map, from.state.players);
      for (const axis of ['x', 'y', 'z']) player[axis] = swept[axis];
    } else {
      for (const axis of ['x', 'y', 'z', 'vx', 'vy', 'vz']) {
        if (Number.isFinite(old[axis]) && Number.isFinite(endpoint[axis])) player[axis] = old[axis] + (endpoint[axis] - old[axis]) * ratio;
      }
      const anchor = { ...old, crouching: old.crouching || endpoint.crouching || player.crouching };
      const swept = sweepPresentationOffset(anchor, { x: player.x - old.x, y: player.y - old.y, z: player.z - old.z }, map, to.state.players);
      for (const axis of ['x', 'y', 'z']) player[axis] = swept[axis];
    }
    player.yaw = wrap(finite(old.yaw) + wrap(finite(endpoint.yaw) - finite(old.yaw)) * ratio);
    player.pitch = finite(old.pitch) + (finite(endpoint.pitch) - finite(old.pitch)) * ratio;
  }
  for (const bolt of state.bolts) {
    const matchesBolt = other => other.id === bolt.id && other.playerId === bolt.playerId && other.bornTick === bolt.bornTick;
    const endpoint = to.state.bolts?.find(matchesBolt), old = from.state.bolts?.find(matchesBolt);
    if (!endpoint || !old) continue;
    for (const axis of ['x', 'y', 'z', 'vx', 'vy', 'vz']) if (Number.isFinite(old[axis]) && Number.isFinite(endpoint[axis])) bolt[axis] = old[axis] + (endpoint[axis] - old[axis]) * ratio;
  }
  if (projectedMs > 0 && state.phase === 'fight' && typeof predictMovement === 'function') {
    const peers = newest.state.players, map = newest.state.map || newest.state.mapId;
    for (const player of state.players) if (player.id !== localId && player.alive) {
      const source = peers.find(other => other.id === player.id);
      Object.assign(player, projectedMovement(player, source.previousInput || source, map, projectedMs, predictMovement, peers, source));
    }
  }
  let seconds = projectedMs / 1000;
  if (seconds > 0 && state.phase === 'fight' && state.bolts.length && typeof traceProjectile === 'function') {
    const projection = { ...state, tick: state.tick };
    while (seconds > 1e-8 && projection.bolts.length) { const dt = Math.min(1 / 120, seconds); projection.tick++; advanceBolts(projection, { dt, trace: traceProjectile }); seconds -= dt; }
    state.bolts = projection.bolts;
  }
  state.players = resolvePresentationContacts(state.players, newest.state.map || newest.state.mapId);
  state.fighters = state.players;
  return state;
}

const sameEquipment = (player, old) => old && player.id === old.id && player.alive === old.alive && player.team === old.team && player.weapon === old.weapon && player.slot === old.slot && player.meleeWeapon === old.meleeWeapon
  && (player.lifeId || 0) === (old.lifeId || 0) && (player.deaths || 0) === (old.deaths || 0) && player.inventoryIndex === old.inventoryIndex;
const sameSwing = (player, old) => sameEquipment(player, old) && player.meleeStartTick === old.meleeStartTick && player.meleeIndex === old.meleeIndex && (player.meleeAction || 'primary') === (old.meleeAction || 'primary')
  && player.meleeInitialYaw === old.meleeInitialYaw && player.meleeInitialPitch === old.meleeInitialPitch;
const bladeDirection = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
function blendBladeAim(from, to, amount) {
  const a = bladeDirection(finite(from.meleeYaw), finite(from.meleePitch)), b = bladeDirection(finite(to.meleeYaw), finite(to.meleePitch));
  const angle = Math.acos(clamp(a.reduce((sum, value, index) => sum + value * b[index], 0), -1, 1));
  if (angle < 1e-8 || angle > Math.PI - 1e-6) return { meleeYaw: finite(to.meleeYaw), meleePitch: finite(to.meleePitch) };
  const denominator = Math.sin(angle), first = Math.sin((1 - amount) * angle) / denominator, second = Math.sin(amount * angle) / denominator;
  const vector = a.map((value, index) => value * first + b[index] * second);
  return { meleeYaw: Math.atan2(vector[0], -vector[2]), meleePitch: Math.asin(clamp(vector[1], -1, 1)) };
}
function bladePresentation(pose, player, old, amount, extra) {
  if (!(player.meleeTicks > 0) || player.slot !== 'sword') return;
  const profile = meleeProfile(player), startupBoundary = profile.activeTicks + profile.recoveryTicks;
  const continuing = sameSwing(player, old);
  if (!continuing) pose.meleeTicks = Math.max(.001, player.meleeTicks - extra);
  if (player.meleeTicks <= startupBoundary) {
    // Once authority commits a cut, neither an older windup nor delayed visual
    // interpolation may rotate or rewind its physical contact slice.
    pose.meleeYaw = player.meleeYaw; pose.meleePitch = player.meleePitch;
    pose.meleeTicks = Math.max(.001, player.meleeTicks - extra);
    return;
  }
  // A still-pending windup can be displayed smoothly, but cannot invent the
  // first active contact before the authoritative phase arrives.
  pose.meleeTicks = Math.max(startupBoundary + .001, pose.meleeTicks);
  if (!['sword', 'katana'].includes(profile.id) || player.meleeAction === 'secondary') return;
  if (continuing && old.meleeTicks > startupBoundary) Object.assign(pose, blendBladeAim(old, player, amount));
  const preview = { ...player, meleeYaw: pose.meleeYaw, meleePitch: pose.meleePitch };
  let remaining = extra;
  while (remaining > 1e-8 && preview.meleeTicks > startupBoundary) {
    const next = meleeStartupAim(preview, player), endpoint = { meleeYaw: next.yaw, meleePitch: next.pitch };
    Object.assign(preview, blendBladeAim(preview, endpoint, Math.min(1, remaining)));
    preview.meleeTicks--; remaining--;
  }
  pose.meleeYaw = preview.meleeYaw; pose.meleePitch = preview.meleePitch;
}

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
    if (field === 'parryTicks' && player.parryStartTick !== old.parryStartTick) continue;
    if ((field === 'meleeTicks' || field === 'meleeCooldown') && !sameSwing(player, old)) continue;
    const ongoing = old[field] >= player[field] && old[field] > 0;
    // Keep the current action visible until authority confirms its completion.
    pose[field] = Math.max(.001, (ongoing ? interpolate(field) : player[field]) - extra);
  }
  bladePresentation(pose, player, old, amount, extra);
  return pose;
}

/** Combine smooth visual timers with a separately reconciled local movement copy. */
export function withCombatPresentation(player, visual) {
  if (!player || !sameEquipment(player, visual)) return player;
  const pose = { ...player };
  const coherentSwing = sameSwing(player, visual);
  for (const field of COMBAT_FIELDS) if (Number.isFinite(visual[field]) && (!['meleeTicks', 'meleeCooldown'].includes(field) || coherentSwing)) pose[field] = visual[field];
  if (coherentSwing && player.meleeTicks > 0 && visual.meleeTicks > 0 && player.meleeTicks > meleeProfile(player).activeTicks + meleeProfile(player).recoveryTicks) {
    if (Number.isFinite(visual.meleeYaw)) pose.meleeYaw = visual.meleeYaw;
    if (Number.isFinite(visual.meleePitch)) pose.meleePitch = visual.meleePitch;
  }
  // Queued input is authority, not a tweened or predicted combat value.
  pose.pendingMeleeTicks = player.pendingMeleeTicks;
  return pose;
}

/** A short display correction; input aim and authoritative gameplay never enter it. */
export function createCorrectionPresenter({ halfLifeMs = 40, maxOffset = .5, snapDistance = 1, maxAgeMs = 240 } = {}) {
  let offset = { x: 0, y: 0, z: 0 }, at = 0, corrections = 0, snaps = 0, lastDistance = 0;
  const reset = () => { offset = { x: 0, y: 0, z: 0 }; at = 0; };
  const decayed = now => {
    const age = Math.max(0, finite(now) - at);
    const amount = age >= maxAgeMs ? 0 : Math.pow(.5, age / Math.max(1, halfLifeMs));
    return Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, offset[axis] * amount]));
  };
  function correct(before, after, now, { continuous = true } = {}) {
    const compatible = continuous && before?.alive && after?.alive && before.id === after.id && before.team === after.team;
    if (!compatible || !['x', 'y', 'z'].every(axis => Number.isFinite(before[axis]) && Number.isFinite(after[axis]))) { reset(); snaps++; return false; }
    const previous = decayed(now);
    const next = Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, before[axis] + previous[axis] - after[axis]]));
    lastDistance = Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z);
    if (lastDistance >= snapDistance || Math.hypot(next.x, next.y, next.z) > maxOffset) { reset(); snaps++; return false; }
    offset = next; at = finite(now); corrections++; return true;
  }
  function present(player, now, sweep, map, peers = []) {
    if (!player?.alive || typeof sweep !== 'function') { reset(); return player; }
    const visualOffset = decayed(now);
    if (Math.hypot(visualOffset.x, visualOffset.y, visualOffset.z) < .00001) { reset(); return player; }
    const pose = sweep(player, visualOffset, map, peers);
    if (!pose) { reset(); return player; }
    const actual = Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, finite(pose[axis]) - finite(player[axis])]));
    if (Math.hypot(actual.x - visualOffset.x, actual.y - visualOffset.y, actual.z - visualOffset.z) > .00001) {
      // A correction clipped by a wall must not reappear after turning its corner.
      offset = actual; at = finite(now);
    }
    return pose;
  }
  return Object.freeze({ correct, present, reset, getState: () => ({ offset: { ...offset }, at, corrections, snaps, lastDistance }) });
}

/** Urgent HUD changes bypass periodic painting; movement/countdowns use its cadence. */
export function hudTransitionKey(state, roster, playerId, context = '') {
  const players = state?.players?.map(player => [player.id, player.team, player.alive, player.hp, player.maxHp,
    player.weapon, player.slot, player.hasGun, player.ammo, player.reserve, player.potions, player.grenades,
    !!player.reloadTicks, !!player.healTicks, !!player.grenadeThrowTicks, player.meleePhase, player.meleeAction, !!player.pendingMeleeTicks, !!player.parryTicks, !!player.parryCooldown, !!player.meleeSecondaryCooldown, player.parryConsumed, player.aiming, player.aimTicks >= 14, player.grounded]);
  const bomb = state?.bomb;
  return JSON.stringify([context, playerId, state?.phase, state?.round, state?.matchId, state?.mapId,
    state?.scores, state?.attackTeam, state?.winner, state?.winnerId, state?.placements, state?.participantIds,
    state?.storm?.mode, players, roster, bomb && [bomb.status, bomb.carrierId, bomb.siteId, bomb.plantPlayerId,
      bomb.defusePlayerId, !!bomb.plantTicks, !!bomb.defuseTicks]]);
}
