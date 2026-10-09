/** Shared trigger and timing rules. Nominal rates retain fractional 120 Hz ticks. */
import { WEAPONS } from './voxel-weapons.js';

const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const resolveWeapon = value => typeof value === 'string' ? (Object.hasOwn(WEAPONS, value) ? WEAPONS[value] : null) : value;
const readInput = (player, input) => input || player?.previousInput || player || {};

/** The magazine remains unchanged while reloading, so snapshots retain its variant. */
export function weaponReloadDuration(weaponOrId, ammo = 0) {
  const weapon = resolveWeapon(weaponOrId);
  if (!weapon) return 0;
  return Math.max(0, finite(ammo, 0) <= 0 ? finite(weapon.emptyReloadTicks, weapon.reloadTicks) : weapon.reloadTicks);
}
export const weaponReloadTicks = weaponReloadDuration;

/** Odin ramps its real firing rate; release/interrupt resets its shared spin clock. */
export function weaponFireIntervalTicks(weaponOrId, player = {}, input = null) {
  const weapon = resolveWeapon(weaponOrId); if (!weapon) return 0;
  const controls = readInput(player, input), aiming = controls.aim === true && weapon.adsEnabled !== false && weapon.adsSupported !== false;
  const ramp = weapon.fireRamp;
  if (ramp) {
    if (aiming && Number.isFinite(ramp.adsCooldownTicks)) return ramp.adsCooldownTicks;
    const progress = Math.max(0, Math.min(1, finite(player.spinTicks, 0) / Math.max(1, ramp.rampTicks)));
    const startRate = 120 / ramp.startCooldownTicks, endRate = 120 / ramp.endCooldownTicks;
    return 120 / (startRate + (endRate - startRate) * progress);
  }
  return aiming ? finite(weapon.adsFireIntervalTicks, finite(weapon.fireIntervalTicks, weapon.cooldown)) : finite(weapon.fireIntervalTicks, weapon.cooldown);
}

/** An in-progress ADS burst keeps its committed profile even after RMB is released. */
export function resolveActiveFire(weaponOrId, player = {}, input = null) {
  const weapon = resolveWeapon(weaponOrId); if (!weapon) return null;
  const controls = readInput(player, input), alternate = weapon.alternateFire && controls.aim === true;
  if (alternate) {
    const profile = weapon.alternateFire, cooldown = finite(profile.fireIntervalTicks, profile.cooldown), burstDistance = profile.burstDistance ?? profile.popDistance;
    const airburst = profile.mode === 'airburst';
    return { mode: profile.mode, trigger: 'aim', count: profile.count, ammoCost: airburst ? 1 : profile.count, intervalTicks: 0, recoveryTicks: cooldown, cooldown, automatic: false, alternate: true, spread: airburst ? (weapon.hipSpread || 0) : profile.spread, burstDistance, popDistance: burstDistance, pelletCount: profile.count, pelletSpread: airburst ? profile.spread : 0 };
  }
  if (weapon.adsBurst && (controls.aim === true || player.burstRemaining > 0)) {
    const profile = weapon.adsBurst;
    return { mode: 'burst', trigger: 'fire', count: profile.count, intervalTicks: profile.intervalTicks, recoveryTicks: profile.recoveryTicks, cooldown: profile.recoveryTicks, automatic: true, alternate: false, pelletCount: weapon.pellets || 1, pelletSpread: weapon.pelletSpread || 0 };
  }
  const mode = weapon.mode || 'auto', burst = mode === 'burst', interval = weaponFireIntervalTicks(weapon, player, controls);
  return { mode, trigger: 'fire', count: burst ? weapon.burstCount : 1, intervalTicks: burst ? weapon.burstInterval : interval, recoveryTicks: burst ? weapon.cooldown : interval, cooldown: burst ? weapon.cooldown : interval, automatic: mode === 'auto', alternate: false, pelletCount: weapon.pellets || 1, pelletSpread: weapon.pelletSpread || 0 };
}

/** Pure authoritative/predicted trigger clock; no rounds, effects or inventory are emitted here. */
export function advanceWeaponFireClock(weaponOrId, player = {}, input = {}, previousInput = {}) {
  const weapon = resolveWeapon(weaponOrId); if (!weapon) return null;
  const oldCooldown = Math.max(0, finite(player.shotCooldown, 0)), remaining = oldCooldown - 1;
  const carry = oldCooldown > 0 ? Math.min(0, remaining) : 0;
  const result = { ammo: Math.max(0, finite(player.ammo, 0)), reserve: Math.max(0, finite(player.reserve, 0)), reloadTicks: Math.max(0, finite(player.reloadTicks, 0) - 1), shotCooldown: Math.max(0, remaining), burstRemaining: Math.max(0, finite(player.burstRemaining, 0)), spinTicks: Math.max(0, finite(player.spinTicks, 0)), pendingFireTicks: 0, rounds: 0, reloadStarted: false, reloadCompleted: false, dryFire: false, durationTicks: 0, fireProfile: null };
  if (player.reloadTicks > 0 && !result.reloadTicks) {
    const loaded = Math.min(weapon.magazine - result.ammo, result.reserve);
    result.ammo += loaded; result.reserve -= loaded; result.reloadCompleted = true;
  }
  if (player.slot !== 'primary' || player.healTicks || player.grenadeThrowTicks) { result.spinTicks = result.burstRemaining = 0; return result; }
  if (input.reload && !previousInput.reload && !result.reloadTicks && result.ammo < weapon.magazine && result.reserve > 0) {
    result.durationTicks = weaponReloadDuration(weapon, result.ammo); result.reloadTicks = result.durationTicks;
    result.reloadStarted = true; result.burstRemaining = result.spinTicks = 0;
  }
  if (input.interact) result.burstRemaining = result.spinTicks = 0;
  if (weapon.fireRamp && input.fire && !player.triggerBlocked && !result.reloadTicks && !input.interact && result.ammo > 0) result.spinTicks = Math.min(weapon.fireRamp.rampTicks, result.spinTicks + 1);
  else result.spinTicks = 0;
  if (player.triggerBlocked || result.shotCooldown || result.reloadTicks || input.interact) return result;
  const active = resolveActiveFire(weapon, { ...player, ...result }, input);
  const freshPrimary = input.fire && !previousInput.fire;
  const freshAlternate = input.aim && !previousInput.aim && !input.fire && !player.meleeAimBlocked;
  if (!result.burstRemaining) {
    const eligible = active.trigger === 'aim' ? freshAlternate : input.fire && (active.automatic || freshPrimary);
    if (!eligible) return result;
    if (result.ammo <= 0) { result.dryFire = active.trigger === 'aim' ? freshAlternate : freshPrimary; return result; }
    if (active.mode === 'burst') result.burstRemaining = Math.min(active.count, result.ammo);
  }
  result.fireProfile = active;
  result.rounds = active.mode === 'volley' ? Math.min(active.count, result.ammo) : 1;
  result.ammo -= result.rounds;
  if (active.mode === 'burst') {
    result.burstRemaining--;
    result.shotCooldown = (result.burstRemaining ? active.intervalTicks : active.recoveryTicks) + carry;
  } else result.shotCooldown = active.recoveryTicks + carry;
  result.shotCooldown = Math.max(0, result.shotCooldown);
  return result;
}
