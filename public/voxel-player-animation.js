/** Cosmetic human motion. Rendered positions are observed; combat state is never changed. */
const TAU = Math.PI * 2;
const STANDING_CYCLE_METRES = 2.45, CROUCHED_CYCLE_METRES = 1.90, SPRINT_CYCLE_METRES = 2.85;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const approach = (current, target, elapsed, duration) => target + (current - target) * Math.exp(-elapsed / duration);
const validId = id => Number.isSafeInteger(id) && id >= 0;
const cycleLengthFor = (crouch, sprint = 0) => STANDING_CYCLE_METRES + (CROUCHED_CYCLE_METRES - STANDING_CYCLE_METRES) * crouch + (SPRINT_CYCLE_METRES - STANDING_CYCLE_METRES) * sprint * (1 - crouch);
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const ramp = (value, start, end) => smooth((value - start) / (end - start));
const pulse = (value, start, middle, end) => ramp(value, start, middle) * (1 - ramp(value, middle, end));
const mix = (a, b, t) => a.map((value, axis) => value + (b[axis] - value) * t);

/** Shared mechanical stages, measured only from the accepted reload's remaining ticks. */
export function weaponReloadPose(weapon, progress, { active = true, hand = 0 } = {}) {
  const globalProgress = clamp(finite(progress), 0, 1);
  const paired = weapon === 'dualpistols' || weapon === 'dualsmg';
  const start = hand === 1 ? .50 : .02, end = hand === 1 ? .98 : .48;
  const p = paired ? clamp((globalProgress - start) / (end - start), 0, 1) : globalProgress;
  const running = active && globalProgress < 1 && (!paired || globalProgress > start && globalProgress < end);
  const style = weapon === 'shotgun' || weapon === 'slugshotgun' ? 'shell' : weapon === 'revolver' ? 'cylinder' : weapon === 'crossbow' ? 'string' : weapon === 'lmg' ? 'belt' : 'magazine';
  const stage = !running ? 'ready' : style === 'shell' ? p < .14 ? 'lower' : p < .76 ? 'load' : p < .90 ? 'pump' : 'return'
    : style === 'cylinder' ? p < .20 ? 'open' : p < .38 ? 'eject' : p < .70 ? 'load' : p < .88 ? 'close' : 'return'
    : style === 'string' ? p < .14 ? 'lower' : p < .62 ? 'draw' : p < .88 ? 'place' : 'return'
    : style === 'belt' ? p < .17 ? 'open' : p < .34 ? 'remove' : p < .61 ? 'insert' : p < .75 ? 'seat' : p < .85 ? 'close' : p < .94 ? 'bolt' : 'return'
    : p < .12 ? 'lower' : p < .32 ? 'remove' : p < .48 ? 'fetch' : p < .67 ? 'insert' : p < .76 ? 'seat' : p < .90 ? 'bolt' : 'return';
  const weight = running ? ramp(p, 0, .12) * (1 - ramp(p, .90, 1)) : 0;
  const remove = ramp(p, style === 'belt' ? .17 : .12, style === 'belt' ? .34 : .32);
  const insert = ramp(p, style === 'belt' ? .40 : .48, style === 'belt' ? .61 : .67);
  const magazineDrop = running && ['magazine', 'belt'].includes(style) ? .25 * remove * (1 - insert) : 0;
  const seat = running ? pulse(p, style === 'belt' ? .61 : .67, style === 'belt' ? .68 : .715, style === 'belt' ? .75 : .76) : 0;
  const bolt = running && ['magazine', 'belt'].includes(style) ? pulse(p, style === 'belt' ? .85 : .76, style === 'belt' ? .895 : .83, style === 'belt' ? .94 : .90) : 0;
  const cylinder = running && style === 'cylinder' ? ramp(p, .04, .20) * (1 - ramp(p, .70, .88)) : 0;
  const lid = running && style === 'belt' ? ramp(p, .02, .17) * (1 - ramp(p, .75, .85)) : 0;
  const pump = running && style === 'shell' ? pulse(p, .76, .825, .90) : 0;
  const shellCycle = clamp((p - .14) / .62, 0, .999999) * 3;
  const shell = running && style === 'shell' && p >= .14 && p < .76 ? pulse(shellCycle % 1, 0, .65, 1) : 0;
  const draw = style === 'string' && running ? ramp(p, .14, .62) : 1;
  const home = weapon === 'pistol' ? [-.071, -.148, -.060] : weapon === 'pdw' ? [-.063, -.084, -.40] : [-.063, -.084, -.502];
  let support = home;
  if (running) {
    if (style === 'magazine' || style === 'belt') {
      const grasp = style === 'belt' ? [-.10, -.25 - magazineDrop, -.25] : weapon === 'pistol' ? [-.04, -.185 - magazineDrop, -.06] : [-.03, -.245 - magazineDrop, weapon === 'pdw' ? -.075 : -.18];
      support = mix(home, grasp, ramp(p, .04, .16) * (1 - ramp(p, .72, .78)));
      support[1] += seat * .035;
      support = mix(support, [.085, .027, -.23 + bolt * .09], pulse(p, .73, .79, .94));
    } else if (style === 'shell') support = mix(home, [-.075, -.20 + shell * .065, -.25 + shell * .04], weight * (1 - ramp(p, .74, .80)));
    else if (style === 'cylinder') support = [-.071 - cylinder * .125, -.148 - weight * .06, -.06 - cylinder * .12];
    else if (style === 'string') support = mix(home, [0, -.032, -.61 + draw * .42], weight);
  }
  const audioPhase = stage === 'load' && style === 'shell' ? `shell${Math.floor(shellCycle) + 1}` : stage;
  return { active: running, reloadActive: active && globalProgress < 1, progress: p, globalProgress, style, stage, audioPhase, hand: paired && hand === 1 ? 1 : 0, weight, magazineDrop, magazineVisible: !running || style !== 'magazine' || p < .32 || p >= .48, seat, bolt, cylinder, lid, pump, shell, shellVisible: running && style === 'shell' && p >= .14 && p < .76, draw, loaded: style === 'string' && running && p >= .80, support,
    weapon: { x: -weight * .035, y: weight * .035 + seat * .014, z: -weight * .015, yaw: weight * (style === 'cylinder' ? .28 : .20), pitch: -weight * (style === 'shell' ? .12 : .075) + seat * .025 } };
}

/** Cosmetic interpolation between 30 Hz snapshots; completion remains authoritative. */
export function createWeaponReloadPresenter({ maxPlayers = 16, maxAdvanceTicks = 4 } = {}) {
  const histories = new Map(), capacity = clamp(Number.isInteger(maxPlayers) ? maxPlayers : 16, 1, 32);
  const advance = clamp(finite(maxAdvanceTicks, 4), 0, 4);
  const present = (player, time, contextKey = null, { durationTicks = 252, paused = false } = {}) => {
    const id = player?.id, duration = Math.max(1, finite(durationTicks, 252));
    const active = validId(id) && Number.isFinite(time) && player.alive !== false && !['sword', 'potion', 'grenade', 'empty'].includes(player.slot) && finite(player.reloadTicks) > 0;
    if (!active) {
      if (validId(id)) histories.delete(id);
      return { ...weaponReloadPose(player?.weapon, 0, { active: false }), remainingTicks: 0, authoritativeTicks: Math.max(0, finite(player?.reloadTicks)) };
    }
    const ticks = clamp(player.reloadTicks, 1, duration);
    let history = histories.get(id);
    const reset = !history || history.contextKey !== contextKey || history.lifeId !== player.lifeId || history.deaths !== player.deaths
      || history.weapon !== player.weapon || history.slot !== player.slot || history.inventoryIndex !== player.inventoryIndex || history.duration !== duration
      || time < history.time || time - history.time > 1000 || ticks > history.ticks + .25;
    if (reset) {
      history = { contextKey, lifeId: player.lifeId, deaths: player.deaths, weapon: player.weapon, slot: player.slot, inventoryIndex: player.inventoryIndex, duration, ticks, anchorTicks: ticks, anchorTime: time, time, paused, pose: null };
      while (histories.size >= capacity && !histories.has(id)) histories.delete(histories.keys().next().value);
      histories.set(id, history);
    }
    if (history.pose && paused) { history.time = time; history.paused = true; return history.pose; }
    if (history.paused && !paused) {
      history.anchorTicks = Math.min(ticks, history.pose?.remainingTicks ?? ticks); history.anchorTime = time;
    } else if (ticks !== history.ticks) {
      history.anchorTicks = ticks; history.anchorTime = time;
    }
    const elapsed = paused ? 0 : Math.max(0, time - history.anchorTime);
    const remainingTicks = Math.max(1, ticks - advance, history.anchorTicks - Math.min(advance, elapsed * .12));
    history.pose = { ...weaponReloadPose(player.weapon, 1 - remainingTicks / duration), remainingTicks, authoritativeTicks: ticks };
    history.ticks = ticks; history.time = time; history.paused = paused;
    histories.delete(id); histories.set(id, history);
    return history.pose;
  };
  present.retain = ids => { const keep = new Set(ids); for (const id of histories.keys()) if (!keep.has(id)) histories.delete(id); };
  present.reset = () => histories.clear();
  Object.defineProperty(present, 'size', { get: () => histories.size });
  return present;
}

function direction(dx, dz, yaw) {
  const scale = Math.max(Math.abs(dx), Math.abs(dz));
  if (scale < 1e-8) return { forward: 1, strafe: 0 };
  const x = dx / scale, z = dz / scale, length = Math.hypot(x, z);
  return { forward: (Math.sin(yaw) * x - Math.cos(yaw) * z) / length, strafe: (Math.cos(yaw) * x + Math.sin(yaw) * z) / length };
}

function poseOf(motion) {
  const { phase, speed, stride, forward, strafe, crouch, airborne, jump, fall, land, sprint } = motion;
  // Bob goes down into the real body silhouette, never above the head hitbox.
  const bodyBob = airborne ? 0 : -Math.min(.028, (1 - Math.cos(phase * 2)) * .009 * stride * (1 - crouch * .35) + land * .022);
  const lean = airborne ? 0 : Math.min(1, speed / 5.5) * stride;
  const legs = [0, Math.PI].map(offset => {
    const swing = Math.sin(phase + offset), raised = Math.max(0, Math.cos(phase + offset));
    const travel = airborne ? 0 : swing * stride * .18;
    const lift = airborne ? jump * .07 + fall * .018 : raised ** 1.4 * stride * (.075 + sprint * .024);
    const hip = airborne ? jump * .12 : swing * stride * forward * .38;
    const knee = .10 + crouch * .9 + (airborne ? jump * .48 + fall * .18 : raised * stride * .58) + land * .12;
    return { hip, knee, ankle: -hip - knee * .25, lift, forward: travel * forward, side: travel * strafe * .55 };
  });
  return { phase, speed, stride, forward, strafe, crouch, airborne, jump, fall, land, sprint, bodyBob, torsoBob: bodyBob, leanForward: forward * lean * (.065 + sprint * .01), leanSide: strafe * lean * .045, armSwing: Math.sin(phase) * stride * (.027 + sprint * .014), legs };
}

function initialMotion(player) {
  const airborne = player?.grounded === false && player?.alive !== false;
  return { phase: 0, speed: 0, stride: 0, forward: 1, strafe: 0, crouch: player?.crouching ? 1 : 0, sprint: 0, airborne, jump: airborne ? clamp(finite(player?.vy) / 6.4, 0, 1) : 0, fall: airborne ? clamp(-finite(player?.vy) / 8, 0, 1) : 0, land: 0 };
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
  motion.sprint = player?.sprinting && !motion.crouch ? motion.stride : 0;
  const cycleLength = cycleLengthFor(motion.crouch, player?.sprinting ? 1 : 0);
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
    motion.sprint = approach(motion.sprint, player.sprinting && !player.crouching && !airborne && speed >= .05 ? 1 : 0, elapsed, 85);
    if (!airborne && !motion.airborne && distance >= 1e-8) {
      motion.phase = (motion.phase + distance * TAU / cycleLengthFor(crouch, player.sprinting ? 1 : 0)) % TAU;
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
