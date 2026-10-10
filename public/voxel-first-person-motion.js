import { createPlayerAnimationPresenter } from './voxel-player-animation.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const approach = (current, target, elapsed, duration) => target + (current - target) * Math.exp(-elapsed / duration);
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const neutral = () => ({ bobY: 0, roll: 0, weaponX: 0, weaponY: 0, phase: 0, stride: 0, speed: 0, land: 0, sprint: 0, weaponZ: 0, weaponPitch: 0, airborne: false });

/** Cosmetic head motion follows travelled distance, including predicted sub-tick poses. */
export function createFirstPersonMotionPresenter() {
  const gait = createPlayerAnimationPresenter({ maxPlayers: 1 });
  let previous = null, pose = neutral();
  const present = (player, time, contextKey = null, { aim = 0, paused = false } = {}) => {
    const valid = player?.alive !== false && [player?.x, player?.y, player?.z, time].every(Number.isFinite);
    if (!valid) { present.reset(); return pose; }
    const elapsed = previous ? time - previous.time : 0;
    const reset = !previous || previous.id !== player.id || previous.contextKey !== contextKey || previous.lifeId !== player.lifeId || previous.deaths !== player.deaths
      || elapsed < 0 || elapsed > 1000 || previous.paused && !paused
      || Math.hypot(player.x - previous.x, player.y - previous.y, player.z - previous.z) > Math.max(.5, elapsed * .016);
    if (reset) gait.reset();
    const animation = gait(player, time, contextKey, { paused });
    const ground = reset ? (animation.airborne ? 0 : 1) : approach(previous.ground, animation.airborne ? 0 : 1, elapsed, 55);
    if (!paused || reset) {
      const steadiness = 1 - clamp(finite(aim), 0, 1);
      const weight = animation.stride * ground * steadiness * (1 - animation.crouch * .55);
      // Downward-only eye travel cannot reveal anything above the real head.
      // Roll leaves the central forward ray and mouse angles exactly unchanged.
      pose = {
        bobY: -Math.min(.018, (1 - Math.cos(animation.phase * 2)) * .009 * weight + animation.land * .012 * steadiness) || 0,
        roll: Math.sin(animation.phase) * .0034 * weight,
        weaponX: Math.sin(animation.phase) * (.009 + animation.sprint * .006) * animation.stride * ground,
        weaponY: -(1 - Math.cos(animation.phase * 2)) * (.004 + animation.sprint * .002) * animation.stride * ground - animation.land * .009 - animation.sprint * .045 || 0,
        weaponZ: animation.sprint * .035, weaponPitch: -animation.sprint * .18, sprint: animation.sprint,
        phase: animation.phase, stride: animation.stride, speed: animation.speed, land: animation.land, airborne: animation.airborne,
      };
    }
    previous = { x: player.x, y: player.y, z: player.z, time, id: player.id, lifeId: player.lifeId, deaths: player.deaths, contextKey, ground, paused };
    return pose;
  };
  present.reset = () => { gait.reset(); previous = null; pose = neutral(); };
  return present;
}

// Presentation impulses only: these do not change the gun's authoritative recoil,
// spread, cooldown, damage, shot direction or the player's mouse-look angles.
const SHOT_PROFILES = Object.freeze({
  carbine: { attack: 7, decay: 25, duration: 200, push: .090, pitch: .105, side: .006, yaw: .014, lift: .006 },
  smg: { attack: 5, decay: 19, duration: 155, push: .050, pitch: .076, side: .004, yaw: .011, lift: .003 },
  marksman: { attack: 8, decay: 34, duration: 275, push: .116, pitch: .139, side: .005, yaw: .015, lift: .008 },
  pistol: { attack: 6, decay: 27, duration: 220, push: .082, pitch: .205, side: .007, yaw: .021, lift: .012 },
  shotgun: { strike: .68, attack: 7, decay: 37, duration: 330, push: .156, pitch: .260, side: .007, yaw: .018, lift: .023 },
  burst: { attack: 6, decay: 23, duration: 190, push: .074, pitch: .095, side: .005, yaw: .013, lift: .005 },
  sniper: { attack: 9, decay: 48, duration: 385, push: .158, pitch: .266, side: .008, yaw: .018, lift: .015 },
  lmg: { attack: 7, decay: 29, duration: 235, push: .112, pitch: .147, side: .008, yaw: .017, lift: .009 },
  crossbow: { attack: 6, decay: 24, duration: 200, push: .042, pitch: .046, side: .003, yaw: .007, lift: .003 },
  revolver: { attack: 7, decay: 34, duration: 280, push: .124, pitch: .295, side: .008, yaw: .023, lift: .020 },
  pdw: { attack: 5, decay: 17, duration: 145, push: .045, pitch: .065, side: .0035, yaw: .010, lift: .004 },
  autoshotgun: { strike: .62, attack: 6, decay: 30, duration: 250, push: .149, pitch: .235, side: .005, yaw: .014, lift: .017 },
  battlerifle: { attack: 8, decay: 35, duration: 280, push: .134, pitch: .210, side: .007, yaw: .019, lift: .013 },
  dualpistols: { attack: 6, decay: 24, duration: 205, push: .075, pitch: .184, side: .008, yaw: .023, lift: .013 },
  dualsmg: { attack: 5, decay: 18, duration: 150, push: .049, pitch: .084, side: .006, yaw: .017, lift: .005 },
  slugshotgun: { strike: .65, attack: 8, decay: 42, duration: 350, push: .159, pitch: .282, side: .006, yaw: .019, lift: .024 },
  classic: { attack: 6, decay: 25, duration: 205, push: .077, pitch: .183, side: .005, yaw: .018, lift: .010 },
  shorty: { strike: .76, attack: 6, decay: 30, duration: 255, push: .133, pitch: .245, side: .009, yaw: .024, lift: .016 },
  frenzy: { attack: 5, decay: 19, duration: 155, push: .047, pitch: .102, side: .004, yaw: .014, lift: .006 },
  ghost: { attack: 6, decay: 26, duration: 215, push: .067, pitch: .157, side: .004, yaw: .014, lift: .009 },
  sheriff: { attack: 8, decay: 37, duration: 300, push: .138, pitch: .315, side: .008, yaw: .025, lift: .022 },
  bandit: { attack: 7, decay: 30, duration: 245, push: .092, pitch: .211, side: .006, yaw: .020, lift: .013 },
  stinger: { attack: 4, decay: 18, duration: 130, push: .047, pitch: .108, side: .005, yaw: .014, lift: .006 },
  spectre: { attack: 5, decay: 19, duration: 155, push: .045, pitch: .068, side: .003, yaw: .009, lift: .003 },
  bucky: { strike: .70, attack: 8, decay: 40, duration: 340, push: .158, pitch: .275, side: .007, yaw: .018, lift: .022 },
  judge: { strike: .66, attack: 6, decay: 28, duration: 235, push: .148, pitch: .230, side: .006, yaw: .015, lift: .017 },
  bulldog: { attack: 6, decay: 24, duration: 195, push: .083, pitch: .110, side: .005, yaw: .014, lift: .006 },
  guardian: { attack: 8, decay: 36, duration: 290, push: .139, pitch: .220, side: .005, yaw: .017, lift: .014 },
  phantom: { attack: 6, decay: 22, duration: 180, push: .074, pitch: .086, side: .004, yaw: .010, lift: .005 },
  vandal: { attack: 7, decay: 27, duration: 220, push: .107, pitch: .175, side: .006, yaw: .016, lift: .010 },
  warden: { attack: 8, decay: 32, duration: 260, push: .125, pitch: .200, side: .006, yaw: .015, lift: .013 },
  marshal: { attack: 8, decay: 39, duration: 320, push: .132, pitch: .170, side: .006, yaw: .016, lift: .010 },
  outlaw: { attack: 9, decay: 43, duration: 350, push: .153, pitch: .190, side: .007, yaw: .018, lift: .013 },
  operator: { attack: 9.5, decay: 48, duration: 385, push: .159, pitch: .285, side: .008, yaw: .020, lift: .019 },
  ares: { attack: 7, decay: 27, duration: 220, push: .096, pitch: .148, side: .007, yaw: .018, lift: .009 },
  odin: { attack: 7, decay: 30, duration: 245, push: .116, pitch: .168, side: .009, yaw: .020, lift: .010 },
});

/** A fast attack and analytic damped recovery are identical at every refresh rate. */
export function weaponShotPose(weapon, age, aim = 0, side = 1) {
  const profile = Object.hasOwn(SHOT_PROFILES, weapon) ? SHOT_PROFILES[weapon] : SHOT_PROFILES.carbine;
  const t = finite(age, Infinity);
  const strike = profile.strike ?? .42;
  const peakTime = profile.decay - strike * profile.attack;
  const maximum = (profile.decay / profile.attack) * Math.exp(-peakTime / profile.decay);
  const envelope = t >= 0 && t < profile.duration ? ((strike + t / profile.attack) * Math.exp(-t / profile.decay) / maximum) * (1 - smooth((t - profile.duration * .65) / (profile.duration * .35))) : 0;
  const steady = 1 - clamp(finite(aim), 0, 1) * .72, sideways = Math.sign(finite(side, 1)) || 1;
  // A small analytic return dip gives the weapon a spring-like settle without
  // accumulating frame impulses or moving the camera's authoritative aim.
  const settle = t >= 0 && t < profile.duration ? .065 * smooth((t - profile.decay * 2.2) / (profile.decay * 1.2)) * (1 - smooth((t - profile.decay * 3.4) / Math.max(1, profile.duration - profile.decay * 3.4))) : 0;
  return { kick: envelope, x: envelope * profile.side * sideways * steady, y: (envelope * profile.lift - settle * .012) * steady, z: envelope * profile.push * (1 - clamp(finite(aim), 0, 1) * .22), yaw: (envelope - settle * .35) * profile.yaw * sideways * steady, pitch: (envelope - settle) * profile.pitch * steady };
}

/** Mechanical cycling is also sampled from accepted-shot age, never trigger input. */
export function weaponCyclePose(weapon, age) {
  const t = finite(age, Infinity);
  const stroke = (start, pull, release) => t >= start && t < release ? smooth((t - start) / (pull - start)) * (1 - smooth((t - pull) / (release - pull))) : 0;
  const pump = weapon === 'shotgun' || weapon === 'slugshotgun' || weapon === 'bucky';
  const boltAction = weapon === 'sniper' || weapon === 'operator' || weapon === 'marshal';
  return { pump: pump ? stroke(90, 245, 525) : 0, bolt: boltAction ? stroke(105, 265, 480) : weapon === 'crossbow' || pump || weapon === 'shorty' || weapon === 'outlaw' ? 0 : stroke(0, 19, 78) };
}

/** Bounded accepted-shot history. Pellet contacts never multiply a shell's impulse. */
export function createWeaponShotPresenter() {
  const shots = [], seen = new Set(), order = [];
  let accepted = 0;
  const report = (event, time) => {
    if (!event || !Number.isFinite(time) || !['shot', 'boltLaunch'].includes(event.type) || !Object.hasOwn(SHOT_PROFILES, event.weapon || (event.type === 'boltLaunch' ? 'crossbow' : ''))) return false;
    if (event.type === 'shot' && finite(event.pellet) !== 0) return false;
    const weapon = event.weapon || 'crossbow';
    const key = event.id ?? `${event.type}:${event.playerId}:${event.tick}:${weapon}:${event.shotIndex ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key); order.push(key);
    while (order.length > 256) seen.delete(order.shift());
    const dual = weapon === 'dualpistols' || weapon === 'dualsmg';
    const hand = event.hand === 1 ? 1 : event.hand === 0 ? 0 : dual && Number.isInteger(event.shotIndex) ? Math.max(0, event.shotIndex - 1) % 2 : 0;
    const side = dual ? hand === 0 ? 1 : -1 : (accepted + 1) % 2 ? 1 : -1;
    accepted++;
    shots.push({ born: time, weapon, side, hand });
    while (shots.length > 16) shots.shift();
    return true;
  };
  const sample = (weapon, time, aim = 0, hand = null) => {
    for (let i = shots.length - 1; i >= 0; i--) {
      const duration = Math.max(SHOT_PROFILES[shots[i].weapon].duration, ['sniper', 'operator', 'marshal'].includes(shots[i].weapon) ? 480 : ['shotgun', 'slugshotgun', 'bucky'].includes(shots[i].weapon) ? 525 : 0);
      if (time < shots[i].born || time - shots[i].born >= duration) shots.splice(i, 1);
    }
    const pose = { kick: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    for (const shot of shots) {
      if (shot.weapon !== weapon || hand !== null && shot.hand !== hand) continue;
      const impulse = weaponShotPose(weapon, time - shot.born, aim, shot.side);
      for (const field of Object.keys(pose)) pose[field] += impulse[field];
    }
    // Real automatic reports can overlap; retain their weight without growing
    // indefinitely or moving an aimed weapon across the whole screen.
    if (pose.kick > 1.7) {
      const scale = 1.7 / pose.kick;
      for (const field of Object.keys(pose)) pose[field] *= scale;
    }
    return pose;
  };
  const age = (weapon, time, hand = null) => {
    if (!Number.isFinite(time)) return Infinity;
    for (let i = shots.length - 1; i >= 0; i--) if (shots[i].weapon === weapon && (hand === null || shots[i].hand === hand) && shots[i].born <= time) return time - shots[i].born;
    return Infinity;
  };
  return { report, sample, age, reset() { shots.length = 0; seen.clear(); order.length = 0; accepted = 0; }, getStats() { return { acceptedShots: accepted, activeShots: shots.length }; } };
}
