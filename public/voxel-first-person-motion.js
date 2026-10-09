import { createPlayerAnimationPresenter } from './voxel-player-animation.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const approach = (current, target, elapsed, duration) => target + (current - target) * Math.exp(-elapsed / duration);
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const neutral = () => ({ bobY: 0, roll: 0, weaponX: 0, weaponY: 0, phase: 0, stride: 0, speed: 0, land: 0, airborne: false });

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
        weaponX: Math.sin(animation.phase) * .009 * animation.stride * ground,
        weaponY: -(1 - Math.cos(animation.phase * 2)) * .004 * animation.stride * ground - animation.land * .009 || 0,
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
  carbine: { attack: 7, decay: 25, duration: 200, push: .075, pitch: .080, side: .004, yaw: .009, lift: .004 },
  smg: { attack: 5, decay: 19, duration: 155, push: .044, pitch: .055, side: .003, yaw: .007, lift: .002 },
  marksman: { attack: 8, decay: 34, duration: 275, push: .103, pitch: .105, side: .004, yaw: .010, lift: .005 },
  pistol: { attack: 6, decay: 27, duration: 220, push: .070, pitch: .140, side: .005, yaw: .013, lift: .007 },
  shotgun: { attack: 9, decay: 42, duration: 340, push: .133, pitch: .130, side: .007, yaw: .014, lift: .007 },
  burst: { attack: 6, decay: 23, duration: 190, push: .061, pitch: .071, side: .004, yaw: .008, lift: .003 },
  sniper: { attack: 9, decay: 48, duration: 385, push: .155, pitch: .155, side: .006, yaw: .012, lift: .006 },
  lmg: { attack: 7, decay: 29, duration: 235, push: .086, pitch: .073, side: .006, yaw: .011, lift: .003 },
  crossbow: { attack: 6, decay: 24, duration: 200, push: .036, pitch: .034, side: .002, yaw: .005, lift: .002 },
});

/** A fast attack and analytic damped recovery are identical at every refresh rate. */
export function weaponShotPose(weapon, age, aim = 0, side = 1) {
  const profile = Object.hasOwn(SHOT_PROFILES, weapon) ? SHOT_PROFILES[weapon] : SHOT_PROFILES.carbine;
  const t = finite(age, Infinity);
  const peakTime = profile.decay - .42 * profile.attack;
  const maximum = (profile.decay / profile.attack) * Math.exp(-peakTime / profile.decay);
  const envelope = t >= 0 && t < profile.duration ? ((.42 + t / profile.attack) * Math.exp(-t / profile.decay) / maximum) * (1 - smooth((t - profile.duration * .65) / (profile.duration * .35))) : 0;
  const steady = 1 - clamp(finite(aim), 0, 1) * .72, sideways = Math.sign(finite(side, 1)) || 1;
  return { kick: envelope, x: envelope * profile.side * sideways * steady, y: envelope * profile.lift * steady, z: envelope * profile.push * (1 - clamp(finite(aim), 0, 1) * .22), yaw: envelope * profile.yaw * sideways * steady, pitch: envelope * profile.pitch * steady };
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
    shots.push({ born: time, weapon, side: ++accepted % 2 ? 1 : -1 });
    while (shots.length > 16) shots.shift();
    return true;
  };
  const sample = (weapon, time, aim = 0) => {
    for (let i = shots.length - 1; i >= 0; i--) if (time < shots[i].born || time - shots[i].born >= 400) shots.splice(i, 1);
    const pose = { kick: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    for (const shot of shots) {
      if (shot.weapon !== weapon) continue;
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
  return { report, sample, reset() { shots.length = 0; seen.clear(); order.length = 0; accepted = 0; }, getStats() { return { acceptedShots: accepted, activeShots: shots.length }; } };
}
